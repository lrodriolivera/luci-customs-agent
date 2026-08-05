/**
 * pueService — parte con persistencia (PUE / controles SOIVRE). El suite hermano
 * pueService.test.js solo cubre helpers puros (mockea el modelo con {}). Aqui se
 * ejercita todo el ciclo de vida contra Mongo en memoria con el modelo REAL
 * PUERequest: crear, validar, enviar, documentar, inspeccionar, certificar,
 * cancelar y actualizar, mas la guardia de propiedad (_loadOwnedRequest) que
 * evita que un usuario toque solicitudes de otro. Es logica de negocio aduanero
 * critica.
 *
 * FRONTERAS mockeadas: logger, aeatSubmitService (red a AEAT), forms/pueGenerator
 * (generacion XML, se prueba aparte) y models/Expedition en lookupMRN. PUERequest
 * es real. No se mockea el propio pueService.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitPUE: jest.fn()
}));
jest.mock('../../src/services/forms/pueGenerator', () => ({
  generate: jest.fn(() => '<pue>xml</pue>')
}));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const pueService = require('../../src/services/pueService');
const { PUERequest } = require('../../src/models');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');

usarBaseDeDatosEnMemoria();

// Datos base de una solicitud ROHS valida. Incluye lo que exige
// validateForSubmission (fabricante en el good para ROHS + oficina SOIVRE), de
// modo que tras aportar documentos la solicitud pueda enviarse.
function datosSolicitud(overrides = {}) {
  return {
    pueType: 'ROHS',
    operator: { name: 'ACME Import SL', nif: 'B12345678', eori: 'ESB12345678' },
    goods: [{
      sequenceNumber: 1,
      description: 'Lavadora',
      taricCode: '84501100',
      manufacturer: { name: 'Fabricante SA' }
    }],
    soivreOffice: { code: 'SOIVRE-28', name: 'SOIVRE Madrid' },
    transport: { mode: 'SEA' },
    ...overrides
  };
}

const OWNER = new mongoose.Types.ObjectId();

// Crea una solicitud persistida de OWNER en el estado indicado.
async function crearPersistida(overrides = {}, userId = OWNER) {
  const res = await pueService.createRequest(datosSolicitud(overrides), userId);
  return res.data;
}

describe('createRequest', () => {
  test('crea la solicitud con documentos, tasas y deadline segun el tipo', async () => {
    const res = await pueService.createRequest(datosSolicitud(), OWNER);
    expect(res.success).toBe(true);
    const r = res.data;
    expect(r.status).toBe('draft');
    expect(r.createdBy.equals(OWNER)).toBe(true);
    // ROHS declara 6 documentos requeridos en la config.
    expect(r.requiredDocuments).toHaveLength(6);
    // Tasas: inspeccion + certificado (sin lab porque no se pidio).
    expect(r.fees.map(f => f.concept)).toEqual(
      expect.arrayContaining(['Tasa de inspeccion', 'Emision de certificado'])
    );
    expect(r.fees.find(f => f.concept.includes('laboratorio'))).toBeUndefined();
    // reference generada por el pre-save.
    expect(r.reference).toMatch(/^PUE-ROHS-\d{4}-\d{6}$/);
  });

  test('con requiresLabAnalysis anade la tasa de laboratorio', async () => {
    const res = await pueService.createRequest(datosSolicitud({ requiresLabAnalysis: true }), OWNER);
    expect(res.data.fees.some(f => f.concept.includes('laboratorio'))).toBe(true);
  });

  test('datos invalidos: devuelve success:false con los errores de preValidate', async () => {
    const res = await pueService.createRequest({ pueType: 'NOPE', goods: [] }, OWNER);
    expect(res.success).toBe(false);
    expect(res.errors.some(e => e.code === 'PUE_INVALID_TYPE')).toBe(true);
    expect(res.errors.some(e => e.code === 'PUE_GOODS_REQUIRED')).toBe(true);
  });
});

describe('validateRequest', () => {
  test('solicitud inexistente devuelve PUE_NOT_FOUND', async () => {
    const res = await pueService.validateRequest(new mongoose.Types.ObjectId());
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('PUE_NOT_FOUND');
  });

  test('faltan documentos requeridos -> invalido con PUE_DOC_MISSING', async () => {
    const r = await crearPersistida();
    const res = await pueService.validateRequest(r._id);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.code === 'PUE_DOC_MISSING')).toBe(true);
  });

  test('con todos los documentos aportados pasa a validated', async () => {
    const r = await crearPersistida();
    // Marcar todos los documentos requeridos como provistos.
    r.requiredDocuments.forEach(d => { d.provided = true; });
    await r.save();

    const res = await pueService.validateRequest(r._id);
    expect(res.valid).toBe(true);
    const recargada = await PUERequest.findById(r._id);
    expect(recargada.status).toBe('validated');
  });
});

describe('submitToAEAT', () => {
  test('rechaza estados que no sean draft/validated', async () => {
    const r = await crearPersistida();
    r.status = 'cancelled';
    await r.save();
    await expect(pueService.submitToAEAT(r._id, OWNER)).rejects.toThrow(/No se puede enviar/);
  });

  test('envio exitoso: guarda pueReference y pasa a pending_inspection', async () => {
    const r = await crearPersistida();
    r.requiredDocuments.forEach(d => { d.provided = true; });
    await r.save();
    aeatSubmitService.submitPUE.mockResolvedValue({
      success: true, mrn: '25ESPUE0001', code: 'OK', estado: 'Admitida', csv: 'CSV123'
    });

    const res = await pueService.submitToAEAT(r._id, OWNER);
    expect(res.success).toBe(true);
    expect(res.data.pueReference).toBe('25ESPUE0001');
    const recargada = await PUERequest.findById(r._id);
    expect(recargada.status).toBe('pending_inspection');
    expect(recargada.generatedXML).toBe('<pue>xml</pue>');
  });

  test('AEAT devuelve error: success:false sin cambiar el estado', async () => {
    const r = await crearPersistida();
    r.requiredDocuments.forEach(d => { d.provided = true; });
    await r.save();
    aeatSubmitService.submitPUE.mockResolvedValue({ success: false, error: 'rechazo AEAT' });

    const res = await pueService.submitToAEAT(r._id, OWNER);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/rechazo AEAT/);
    const recargada = await PUERequest.findById(r._id);
    expect(recargada.status).toBe('draft');
  });

  test('un usuario ajeno no puede enviar la solicitud (guardia de propiedad)', async () => {
    const r = await crearPersistida();
    const otro = new mongoose.Types.ObjectId();
    await expect(pueService.submitToAEAT(r._id, otro)).rejects.toThrow(/no encontrada/i);
  });
});

describe('_loadOwnedRequest (via addDocument)', () => {
  test('solicitud inexistente lanza', async () => {
    await expect(
      pueService.addDocument(new mongoose.Types.ObjectId(), { code: 'FACTURA' }, OWNER)
    ).rejects.toThrow(/no encontrada/i);
  });

  test('otro usuario recibe el mismo error que si no existiera', async () => {
    const r = await crearPersistida();
    await expect(
      pueService.addDocument(r._id, { code: 'FACTURA' }, new mongoose.Types.ObjectId())
    ).rejects.toThrow(/no encontrada/i);
  });

  test('un job sin userId puede operar sobre cualquier solicitud', async () => {
    const r = await crearPersistida();
    const res = await pueService.addDocument(r._id, { code: 'FACTURA', name: 'Factura', documentId: new mongoose.Types.ObjectId() }, null);
    expect(res.success).toBe(true);
    const doc = res.data.requiredDocuments.find(d => d.code === 'FACTURA');
    expect(doc.provided).toBe(true);
  });
});

describe('scheduleInspection / recordInspectionResult', () => {
  test('programa inspeccion y cambia el estado', async () => {
    const r = await crearPersistida();
    const res = await pueService.scheduleInspection(r._id, {
      date: '2026-09-01', time: '10:00', location: 'Puerto', type: 'fisica', inspector: 'Insp1'
    }, OWNER);
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('inspection_scheduled');
    expect(res.data.inspection.scheduled).toBe(true);
  });

  test('registra resultado; con lab pendiente pasa a pending_lab', async () => {
    const r = await crearPersistida();
    const res = await pueService.recordInspectionResult(r._id, {
      result: 'favorable',
      notes: 'ok',
      laboratoryAnalysis: { required: true },
      reportNumber: 'RPT-1'
    }, OWNER);
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('pending_lab');
    expect(res.data.inspection.reportNumber).toBe('RPT-1');
  });
});

describe('issueCertificate', () => {
  test('rechaza si la solicitud no esta aprobada', async () => {
    const r = await crearPersistida();
    await expect(
      pueService.issueCertificate(r._id, {}, OWNER)
    ).rejects.toThrow(/aprobadas/);
  });

  test('emite certificado para solicitud aprobada y marca la tasa como pagada', async () => {
    const r = await crearPersistida();
    r.status = 'approved';
    await r.save();

    const res = await pueService.issueCertificate(r._id, { officer: 'Funcionario X' }, OWNER);
    expect(res.success).toBe(true);
    expect(res.data.certificate.number).toMatch(/^CERT-ROHS-\d{4}-[0-9A-F]{8}$/);
    expect(res.data.certificate.status).toBe('active');
    const certFee = res.data.request.fees.find(f => f.concept.includes('certificado'));
    expect(certFee.status).toBe('paid');
  });
});

describe('cancelRequest', () => {
  test('cancela una solicitud en draft', async () => {
    const r = await crearPersistida();
    const res = await pueService.cancelRequest(r._id, 'ya no interesa', OWNER);
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('cancelled');
  });

  test('no cancela una solicitud aprobada', async () => {
    const r = await crearPersistida();
    r.status = 'approved';
    await r.save();
    await expect(
      pueService.cancelRequest(r._id, 'x', OWNER)
    ).rejects.toThrow(/No se puede cancelar/);
  });
});

describe('update', () => {
  test('actualiza campos permitidos en estado draft', async () => {
    const r = await crearPersistida();
    const res = await pueService.update(r._id, {
      declarationMRN: '25ES00280001',
      campoNoPermitido: 'ignorar'
    }, OWNER);
    expect(res.success).toBe(true);
    expect(res.data.declarationMRN).toBe('25ES00280001');
    expect(res.data.campoNoPermitido).toBeUndefined();
  });

  test('no permite modificar en estado no editable', async () => {
    const r = await crearPersistida();
    r.status = 'pending_inspection';
    await r.save();
    await expect(
      pueService.update(r._id, { declarationMRN: 'x' }, OWNER)
    ).rejects.toThrow(/No se puede modificar/);
  });
});

describe('processSoivreResponse', () => {
  test('registra la respuesta SOIVRE y cambia el estado', async () => {
    const r = await crearPersistida();
    const res = await pueService.processSoivreResponse(r.reference, {
      code: 'S01', message: 'Favorable', status: 'approved', expedientNumber: 'EXP-1'
    });
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('approved');
    expect(res.data.expedientNumber).toBe('EXP-1');
    expect(res.data.soivreResponse.code).toBe('S01');
  });

  test('referencia inexistente lanza', async () => {
    await expect(
      pueService.processSoivreResponse('NO-EXISTE', { code: 'x' })
    ).rejects.toThrow(/no encontrada/i);
  });
});

describe('queryStatus (modo simulacion)', () => {
  test('devuelve el siguiente estado simulado', async () => {
    const r = await crearPersistida();
    r.pueReference = 'PUEREF-1';
    r.status = 'registered';
    await r.save();

    const res = await pueService.queryStatus('PUEREF-1');
    expect(res.success).toBe(true);
    expect(res.currentStatus).toBe('registered');
    expect(res.nextStatus).toBe('pending_documents');
  });

  test('referencia inexistente lanza', async () => {
    await expect(pueService.queryStatus('NOPE')).rejects.toThrow(/no encontrada/i);
  });
});

describe('list / getById / getStats', () => {
  test('list pagina y filtra por tipo y estado', async () => {
    await crearPersistida();
    await crearPersistida({ pueType: 'COM', goods: [{ sequenceNumber: 1, description: 'Juguete', taricCode: '95030000' }] });

    const res = await pueService.list({ pueType: 'ROHS', page: 1, limit: 10 });
    expect(res.data.every(d => d.pueType === 'ROHS')).toBe(true);
    expect(res.pagination.total).toBe(1);
    expect(res.pagination.pages).toBe(1);
  });

  test('list con busqueda por texto', async () => {
    const r = await crearPersistida();
    const res = await pueService.list({ search: r.reference });
    expect(res.data.length).toBeGreaterThanOrEqual(1);
  });

  test('getById devuelve la solicitud', async () => {
    const r = await crearPersistida();
    const encontrada = await pueService.getById(r._id);
    expect(encontrada._id.equals(r._id)).toBe(true);
  });
});

describe('processBatch', () => {
  test('crea varias y contabiliza fallidas', async () => {
    const lote = [
      datosSolicitud(),
      { pueType: 'NOPE', goods: [] } // invalida -> failed
    ];
    const res = await pueService.processBatch(lote, OWNER);
    expect(res.total).toBe(2);
    expect(res.created).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors[0].phase).toBe('create');
  });

  test('con autoSubmit envia las creadas', async () => {
    aeatSubmitService.submitPUE.mockResolvedValue({ success: true, mrn: 'M1', code: 'OK' });
    // La solicitud debe pasar validateForSubmission: operador con id + goods (ya los tiene).
    const res = await pueService.processBatch([datosSolicitud()], OWNER, { autoSubmit: true });
    expect(res.created).toBe(1);
    expect(res.submitted).toBe(1);
  });
});

describe('validateRII (simulacion)', () => {
  test('sin NIF devuelve success:false', async () => {
    const res = await pueService.validateRII('');
    expect(res.success).toBe(false);
  });

  test('con NIF devuelve resultado simulado determinista', async () => {
    const res = await pueService.validateRII('B12345678');
    expect(res.success).toBe(true);
    expect(res.data).toHaveProperty('found');
    expect(res.data.nif).toBe('B12345678');
  });
});

describe('lookupMRN', () => {
  test('MRN inexistente devuelve success:false', async () => {
    const res = await pueService.lookupMRN('NO-MRN', '1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no encontrado/i);
  });
});

describe('catalogos SOIVRE (Phase 5)', () => {
  test('getAllCatalogs devuelve todas las secciones', () => {
    const c = pueService.getAllCatalogs();
    expect(c).toHaveProperty('soivreSpecificities');
    expect(c).toHaveProperty('rohsRaeeSpecificities');
    expect(c).toHaveProperty('merchandiseUnits');
    expect(c).toHaveProperty('centers');
  });

  test('getSpecificities segun flowType', () => {
    expect(Array.isArray(pueService.getSpecificities('SOIVRE'))).toBe(true);
    expect(Array.isArray(pueService.getSpecificities('ROHS_RAEE'))).toBe(true);
    // flowType desconocido -> lista vacia
    expect(pueService.getSpecificities('OTRO')).toEqual([]);
  });

  test('getSoivreCenters / getMerchandiseUnits / getCertificateTypes devuelven catalogos', () => {
    expect(pueService.getSoivreCenters()).toBeDefined();
    expect(pueService.getMerchandiseUnits()).toBeDefined();
    expect(pueService.getCertificateTypes()).toBeDefined();
  });

  test('getInspectionPoints de un centro inexistente devuelve []', () => {
    expect(pueService.getInspectionPoints('CENTRO_INEXISTENTE')).toEqual([]);
  });
});
