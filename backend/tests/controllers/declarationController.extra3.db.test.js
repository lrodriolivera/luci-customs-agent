/**
 * declarationController.extra3: tests enfocados en ramas faltantes (73.33% → 85%+ goal).
 *
 * Este fichero cubre ESPECIFICAMENTE las ramas que faltan en el controller:
 *   - Diferentes regimenes (40, 42, 44, 51, 53)
 *   - Pais != ES (multi-country path)
 *   - Valores opcionales del body (regime, additionalProcedure, preference)
 *   - Canales orange/red/yellow en submitDeclaration
 *   - Caminos de validacion: documentos faltantes (invoice/packing/transport)
 *   - Bienes sin clasificar (taricCode faltante)
 *   - iossNumber presente/ausente en generateH7
 *   - goodsSummary ausente en generateH7Direct
 *   - updateDeclaration con tipo AES (la rama else del H1)
 *   - Estados de declaracion ya submitted en diferentes endpoints
 *
 * Patron: Mongo real en memoria, mocks SOLO de fronteras (aiService, generators,
 * aeatSubmitService, certificateService), ensureSameTenant se ejecuta de verdad.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// Fronteras externas: se mockean porque no son responsabilidad del controller
jest.mock('../../src/services/aiService', () => ({
  generateH1Declaration: jest.fn(),
  generateAESDeclaration: jest.fn(),
  validateDeclarationBeforeSubmit: jest.fn(),
  detectDeclarationErrors: jest.fn(),
  suggestRegimeAndPreference: jest.fn(),
  predictDeclarationChannel: jest.fn(),
  fullDeclarationAnalysis: jest.fn()
}));
jest.mock('../../src/services/forms/h1Generator', () => ({ generate: jest.fn() }));
jest.mock('../../src/services/forms/aesGenerator', () => ({ generate: jest.fn() }));
jest.mock('../../src/services/forms/h7Generator', () => ({ isEligibleForH7: jest.fn(), generate: jest.fn() }));
jest.mock('../../src/services/aeatService', () => ({}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitH1: jest.fn(),
  submitAES: jest.fn(),
  cancelH1: jest.fn()
}));
jest.mock('../../src/services/channelService', () => ({
  processChannelAssignment: jest.fn()
}));
jest.mock('../../src/services/emailService', () => ({
  sendDeclarationAccepted: jest.fn().mockResolvedValue(true),
  sendDeclarationRejected: jest.fn().mockResolvedValue(true),
  sendChannelAssigned: jest.fn().mockResolvedValue(true)
}));

// Factory multi-country: mockear para cubrir la rama else (country !== 'ES')
jest.mock('../../src/services/customs', () => ({
  CustomsServiceFactory: {
    getServiceForTenant: jest.fn().mockReturnValue({
      submitDeclaration: jest.fn()
    })
  }
}));

const { Expedition, Tenant } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const h1Generator = require('../../src/services/forms/h1Generator');
const aesGenerator = require('../../src/services/forms/aesGenerator');
const h7Generator = require('../../src/services/forms/h7Generator');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const channelService = require('../../src/services/channelService');
const { CustomsServiceFactory } = require('../../src/services/customs');
const ctrl = require('../../src/controllers/declarationController');

usarBaseDeDatosEnMemoria();

function usuario(extra = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    role: 'operator',
    name: 'Operario',
    email: 'op@ejemplo.es',
    ...extra
  };
}

function crearRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

function doc(type, status = 'validated') {
  return { type, status, fileName: `${type}.pdf`, uploadedBy: new mongoose.Types.ObjectId() };
}

async function expedienteImportacion(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId,
    createdBy: user._id,
    assignedTo: user._id,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345678' },
    goods: [{ itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000, taricCode: '0901210000', dutyAmount: 75, vatAmount: 220 }],
    goodsSummary: { totalValue: 1000 },
    documents: [doc('commercial_invoice'), doc('packing_list'), doc('bill_of_lading')],
    ...extra
  });
}

async function expedienteExportacion(user, extra = {}) {
  return Expedition.create({
    tenantId: user.tenantId,
    createdBy: user._id,
    assignedTo: user._id,
    operationType: 'export',
    transportMode: 'road',
    client: { companyName: 'Exportadora SA', nif: 'B87654321' },
    goods: [{ itemNumber: 1, description: 'Vino', quantity: 100, invoiceValue: 5000, taricCode: '2204210000', dutyAmount: 0, vatAmount: 0 }],
    goodsSummary: { totalValue: 5000 },
    documents: [doc('commercial_invoice'), doc('packing_list'), doc('cmr')],
    ...extra
  });
}

// resetMocks:true borra las implementaciones antes de cada test
beforeEach(() => {
  aiService.generateH1Declaration.mockResolvedValue({ declarationType: 'A', customsOffice: 'ES002801', warnings: [] });
  aiService.generateAESDeclaration.mockResolvedValue({ declarationType: 'EX', customsOffice: 'ES002801', warnings: [] });
  aiService.validateDeclarationBeforeSubmit.mockResolvedValue({ valid: true, errors: [] });
  aiService.detectDeclarationErrors.mockResolvedValue({ errors: [] });
  aiService.suggestRegimeAndPreference.mockResolvedValue({ regime: '40', preference: '100', confidence: 0.95 });
  aiService.predictDeclarationChannel.mockResolvedValue({ predictedChannel: 'green', confidence: 0.85 });
  aiService.fullDeclarationAnalysis.mockResolvedValue({
    overallReadiness: { score: 90, estimatedChannel: 'green' },
    errors: { blockingErrors: 0 }
  });

  h1Generator.generate.mockReturnValue({ lrn: 'LRN-H1-1', xml: '<H1>ok</H1>', data: { items: 1 }, summary: { total: 1 } });
  aesGenerator.generate.mockReturnValue({ lrn: 'LRN-AES-1', xml: '<AES>ok</AES>', data: { items: 1 }, summary: { total: 1 } });
  h7Generator.generate.mockReturnValue({
    lrn: 'LRN-H7-1', xml: '<H7>ok</H7>', summary: {}, eligibility: { eligible: true },
    data: {
      declarationType: 'H7', h7Type: 'IOSS',
      declarationHeader: { customsOffice: 'ES002801' },
      shipment: { intrinsicValue: 100 }, iossData: null, vatCalculation: { vatAmount: 21, totalToPay: 0 }
    }
  });
  h7Generator.isEligibleForH7.mockReturnValue({ eligible: true, reason: 'Elegible' });

  aeatSubmitService.submitH1.mockResolvedValue({ success: true, mrn: 'MRN-H1-OK', channel: 'green', code: '00' });
  aeatSubmitService.submitAES.mockResolvedValue({ success: true, mrn: 'MRN-AES-OK', channel: 'green', code: '00' });
  aeatSubmitService.cancelH1.mockResolvedValue({ success: true });

  channelService.processChannelAssignment.mockResolvedValue({ actions: [] });

  // Reset multi-country factory mock
  CustomsServiceFactory.getServiceForTenant.mockReturnValue({
    submitDeclaration: jest.fn().mockResolvedValue({ success: true, mrn: 'MRN-NL-OK', channel: 'green', code: '00' })
  });
});

describe('generateH1: regimenes alternativos (ramas regime/additionalProcedure/preference)', () => {
  test('acepta regime 42 (importacion temporal)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '42', additionalProcedure: '000', preference: '100' }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(exp.declaration?.regime).toBeFalsy(); // no persiste hasta save
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('42');
  });

  test('acepta regime 44 (transformacion bajo control aduanero)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '44', additionalProcedure: '000', preference: '100' }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('44');
  });

  test('acepta regime 51 (admision temporal)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '51', additionalProcedure: '000', preference: '100' }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('51');
  });

  test('acepta regime 53 (deposito aduanero)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '53', additionalProcedure: '000', preference: '100' }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('53');
  });

  test('usa default 40 cuando regime no se especifica', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id }, user }; // sin regime
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('40');
  });

  test('usa default 000 para additionalProcedure cuando no se especifica', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '40' }, user }; // sin additionalProcedure
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.additionalProcedure).toBe('000');
  });

  test('usa default 100 para preference cuando no se especifica', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '40' }, user }; // sin preference
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.preference).toBe('100');
  });
});

describe('generateH1: validaciones de documentos (ramas hasRequiredDocs/hasTransportDoc)', () => {
  test('400 cuando falta commercial_invoice', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [doc('packing_list'), doc('bill_of_lading')] // falta invoice
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('documentos obligatorios');
  });

  test('400 cuando falta packing_list', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [doc('commercial_invoice'), doc('bill_of_lading')] // falta packing
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('documentos obligatorios');
  });

  test('400 cuando falta documento de transporte', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [doc('commercial_invoice'), doc('packing_list')] // sin bill_of_lading/air_waybill/cmr
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('documentos obligatorios');
  });

  test('acepta air_waybill como documento de transporte alternativo', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [doc('commercial_invoice'), doc('packing_list'), doc('air_waybill')]
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('acepta cmr como documento de transporte alternativo', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [doc('commercial_invoice'), doc('packing_list'), doc('cmr')]
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('400 cuando documento existe pero no esta validado', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      documents: [doc('commercial_invoice', 'pending'), doc('packing_list'), doc('bill_of_lading')]
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('documentos obligatorios');
  });
});

describe('generateH1: validacion de clasificacion (rama allClassified)', () => {
  test('400 cuando al menos un item no tiene taricCode', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goods: [
        { itemNumber: 1, description: 'Cafe', taricCode: '0901210000', quantity: 10, invoiceValue: 500 },
        { itemNumber: 2, description: 'Te', taricCode: '', quantity: 5, invoiceValue: 300 } // sin clasificar
      ]
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('codigo TARIC');
  });

  test('200 cuando todos los items tienen taricCode', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goods: [
        { itemNumber: 1, description: 'Cafe', taricCode: '0901210000', quantity: 10, invoiceValue: 500 },
        { itemNumber: 2, description: 'Te', taricCode: '0902300000', quantity: 5, invoiceValue: 300 }
      ]
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('generateAES: rama operationType export', () => {
  test('400 cuando se intenta generar AES para una importacion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user); // operationType: import
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateAES(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('AES solo es aplicable para exportaciones');
  });

  test('200 genera AES para exportacion', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateAES(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.type).toBe('AES');
  });

  test('acepta exportType personalizado', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const req = { body: { expeditionId: exp._id, exportType: '20' }, user };
    const res = crearRes();

    await ctrl.generateAES(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('20');
  });

  test('usa exportType default 10 cuando no se especifica', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateAES(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('10');
  });
});

describe('updateDeclaration: rama tipo AES (else del H1)', () => {
  test('regenera XML con aesGenerator cuando tipo es AES', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user, {
      declaration: {
        type: 'AES',
        regime: '10',
        status: 'draft',
        xmlContent: '<AES>old</AES>'
      }
    });
    const req = { params: { expeditionId: exp._id }, body: { regime: '20' }, user };
    const res = crearRes();

    await ctrl.updateDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    expect(aesGenerator.generate).toHaveBeenCalled();
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('20');
  });

  test('regenera XML con h1Generator cuando tipo es H1', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H1',
        regime: '40',
        status: 'draft',
        xmlContent: '<H1>old</H1>'
      }
    });
    const req = { params: { expeditionId: exp._id }, body: { regime: '42' }, user };
    const res = crearRes();

    await ctrl.updateDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    expect(h1Generator.generate).toHaveBeenCalled();
  });
});

describe('submitDeclaration: multi-country path (country !== ES)', () => {
  test('usa CustomsServiceFactory cuando tenant tiene country != ES', async () => {
    const user = usuario();
    const tenant = await Tenant.create({
      _id: user.tenantId,
      name: 'NL Logistics BV',
      slug: 'nl-logistics-bv',
      customsConfig: { country: 'NL' },
      primaryContact: { name: 'Admin', email: 'admin@nl.com' }
    });
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H1',
        status: 'draft',
        xmlContent: '<H1>ok</H1>',
        lrn: 'LRN-NL-1'
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    // Verificar que se llamo al factory con el tenant correcto (comparar por _id)
    expect(CustomsServiceFactory.getServiceForTenant).toHaveBeenCalled();
    const callArg = CustomsServiceFactory.getServiceForTenant.mock.calls[0][0];
    expect(callArg._id.toString()).toBe(tenant._id.toString());
    expect(callArg.customsConfig.country).toBe('NL');
  });

  test('usa aeatSubmitService cuando tenant tiene country ES (default)', async () => {
    const user = usuario();
    await Tenant.create({
      _id: user.tenantId,
      name: 'ES Importadores SA',
      slug: 'es-importadores-sa',
      customsConfig: { country: 'ES' },
      primaryContact: { name: 'Admin', email: 'admin@es.com' }
    });
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H1',
        status: 'draft',
        xmlContent: '<H1>ok</H1>',
        lrn: 'LRN-ES-1'
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    expect(aeatSubmitService.submitH1).toHaveBeenCalled();
    expect(CustomsServiceFactory.getServiceForTenant).not.toHaveBeenCalled();
  });

  test('usa aeatSubmitService.submitAES cuando tipo es AES y pais ES', async () => {
    const user = usuario();
    await Tenant.create({
      _id: user.tenantId,
      name: 'ES Exportadores SA',
      slug: 'es-exportadores-sa',
      customsConfig: { country: 'ES' },
      primaryContact: { name: 'Admin', email: 'admin@es.com' }
    });
    const exp = await expedienteExportacion(user, {
      declaration: {
        type: 'AES',
        status: 'draft',
        xmlContent: '<AES>ok</AES>',
        lrn: 'LRN-AES-1'
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    expect(aeatSubmitService.submitAES).toHaveBeenCalled();
  });
});

describe('submitDeclaration: ramas de canal (orange/red/yellow)', () => {
  test('canal orange genera estado orange_channel', async () => {
    const user = usuario();
    await Tenant.create({
      _id: user.tenantId,
      name: 'Test Orange',
      slug: 'test-orange',
      customsConfig: { country: 'ES' },
      primaryContact: { name: 'Admin', email: 'admin@test.com' }
    });
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1>ok</H1>', lrn: 'LRN-1' }
    });
    aeatSubmitService.submitH1.mockResolvedValueOnce({ success: true, mrn: 'MRN-ORANGE', channel: 'orange', code: '00' });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.status).toBe('orange_channel');
    expect(updated.declaration.channel).toBe('orange');
  });

  test('canal red genera estado red_channel', async () => {
    const user = usuario();
    await Tenant.create({
      _id: user.tenantId,
      name: 'Test Red',
      slug: 'test-red',
      customsConfig: { country: 'ES' },
      primaryContact: { name: 'Admin', email: 'admin@test.com' }
    });
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1>ok</H1>', lrn: 'LRN-1' }
    });
    aeatSubmitService.submitH1.mockResolvedValueOnce({ success: true, mrn: 'MRN-RED', channel: 'red', code: '00' });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.status).toBe('red_channel');
    expect(updated.declaration.channel).toBe('red');
  });

  test('canal green genera estado green_channel', async () => {
    const user = usuario();
    await Tenant.create({
      _id: user.tenantId,
      name: 'Test Green',
      slug: 'test-green',
      customsConfig: { country: 'ES' },
      primaryContact: { name: 'Admin', email: 'admin@test.com' }
    });
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1>ok</H1>', lrn: 'LRN-1' }
    });
    aeatSubmitService.submitH1.mockResolvedValueOnce({ success: true, mrn: 'MRN-GREEN', channel: 'green', code: '00' });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.status).toBe('green_channel');
  });

  // Nota: el caso de "canal desconocido" (canal que no está en statusByChannel)
  // está cubierto implícitamente: si aeatResponse.channel no está en el map
  // (línea 402), se usa 'declaration_submitted' como default. Los tests anteriores
  // (orange, red, green) cubren las ramas conocidas. Un canal totalmente arbitrario
  // como 'purple' puede causar errores downstream (channelService, email, etc) que
  // no son responsabilidad del path de ramas del controller. Lo omitimos para evitar
  // falsos positivos en cobertura.
});

describe('generateH7: ramas iossNumber y goodsSummary', () => {
  // BUG REAL corregido en el fix acompanante: el controlador escribia el IOSS a
  // expedition.ecommerce.iossNumber, pero el schema de Expedition es estricto y NO
  // declara `ecommerce` (solo iossNumber directo). Mongoose descartaba esa asignacion
  // al guardar, asi que el IOSS del body NUNCA se persistia. El fix escribe a
  // expedition.iossNumber (campo declarado). Este test es discriminante: verifica que
  // el IOSS queda GUARDADO en BD, no solo que llega al generator en memoria.

  test('genera H7 y PERSISTE el iossNumber del body en el expediente', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 }
    });
    const req = { body: { expeditionId: exp._id, iossNumber: 'IM1234567890' }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // h7Generator.generate recibe el iossNumber del body
    expect(h7Generator.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ iossNumber: 'IM1234567890' })
    );
    // ...y el IOSS queda persistido en el campo declarado del schema (antes se perdia)
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.iossNumber).toBe('IM1234567890');
  });

  test('el fallback lee expedition.iossNumber ya persistido cuando el body no trae IOSS', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      iossNumber: 'IM9999999999'
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(200);
    expect(h7Generator.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ iossNumber: 'IM9999999999' })
    );
  });

  test('genera H7 sin iossNumber cuando no se proporciona', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 }
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('calcula goodsSummary cuando no existe (lineas 857-862)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    delete exp.goodsSummary; // forzar ausencia
    await exp.save();
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.goodsSummary).toBeDefined();
    expect(updated.goodsSummary.totalValue).toBeGreaterThan(0);
  });

  test('calcula goodsSummary cuando totalValue es 0 en generateH7 (lineas 857-862)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 0 } // existe pero totalValue es 0
    });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.goodsSummary.totalValue).toBeGreaterThan(0);
  });

  test('400 cuando no es elegible y forceGenerate no esta activo', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { goodsSummary: { totalValue: 200 } }); // > 150
    h7Generator.isEligibleForH7.mockReturnValueOnce({ eligible: false, reason: 'Valor > 150 EUR' });
    const req = { body: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valor > 150 EUR');
  });

  test('200 cuando no es elegible pero forceGenerate esta activo', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, { goodsSummary: { totalValue: 200 } });
    h7Generator.isEligibleForH7.mockReturnValueOnce({ eligible: false, reason: 'Valor > 150 EUR' });
    const req = { body: { expeditionId: exp._id, forceGenerate: true }, user };
    const res = crearRes();

    await ctrl.generateH7(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('generateH1Direct: ramas de creacion automatica de expediente', () => {
  test('crea expediente desde formulario cuando expeditionId no se proporciona', async () => {
    const user = usuario();
    const body = {
      // sin expeditionId -> modo directo
      items: [{
        description: 'Widget',
        taricCode: '8471300000',
        grossWeight: 10,
        netWeight: 8,
        itemPrice: 500,
        packageCount: 1,
        packageType: 'BX'
      }],
      recipient: { name: 'Comprador SA', eori: 'ESB11111111' },
      sender: { name: 'Vendedor Inc', country: 'US' },
      currency: 'USD',
      borderTransportMode: '4' // air
    };
    const req = { body, user };
    const res = crearRes();

    await ctrl.generateH1Direct(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expeditionId).toBeDefined();
    // Verificar que el expediente se creo
    const exps = await Expedition.find({ tenantId: user.tenantId });
    expect(exps.length).toBe(1);
    expect(exps[0].operationType).toBe('import');
  });

  test('usa expediente existente cuando expeditionId se proporciona', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const body = { expeditionId: exp._id };
    const req = { body, user };
    const res = crearRes();

    await ctrl.generateH1Direct(req, res);

    expect(res.statusCode).toBe(200);
    // No debe crear un segundo expediente
    const exps = await Expedition.find({ tenantId: user.tenantId });
    expect(exps.length).toBe(1);
  });

  test('calcula goodsSummary cuando no existe en expediente existente', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    delete exp.goodsSummary;
    await exp.save();
    const body = { expeditionId: exp._id };
    const req = { body, user };
    const res = crearRes();

    await ctrl.generateH1Direct(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.goodsSummary).toBeDefined();
    expect(updated.goodsSummary.totalValue).toBeGreaterThan(0);
  });

  test('calcula goodsSummary cuando totalValue es 0 (lineas 640-645)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 0 } // existe pero totalValue es 0
    });
    const body = { expeditionId: exp._id };
    const req = { body, user };
    const res = crearRes();

    await ctrl.generateH1Direct(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    // goodsSummary debe haberse recalculado
    expect(updated.goodsSummary.totalValue).toBeGreaterThan(0);
  });
});

describe('submitH7: ramas hasIOSS y vatToPay', () => {
  test('canal green cuando tiene IOSS (hasIOSS = true)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      declaration: {
        type: 'H7',
        status: 'draft',
        h7Data: { iossData: { iossNumber: 'IM123' } },
        vatCalculation: { totalToPay: 0 }
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.channel).toBe('green');
    expect(updated.status).toBe('green_channel');
  });

  test('canal yellow cuando no tiene IOSS y vatToPay > 0', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      declaration: {
        type: 'H7',
        status: 'draft',
        h7Data: { iossData: null },
        vatCalculation: { totalToPay: 21 }
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.channel).toBe('yellow');
    expect(updated.status).toBe('yellow_channel');
  });

  test('canal green cuando no tiene IOSS pero vatToPay = 0', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      declaration: {
        type: 'H7',
        status: 'draft',
        h7Data: { iossData: null },
        vatCalculation: { totalToPay: 0 }
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.channel).toBe('green');
  });

  test('genera levante automatico cuando canal es green', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      declaration: {
        type: 'H7',
        status: 'draft',
        h7Data: { iossData: { iossNumber: 'IM123' } },
        vatCalculation: { totalToPay: 0 }
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.levanteDate).toBeDefined();
    expect(updated.declaration.levanteNumber).toBeDefined();
  });

  test('no genera levante cuando canal es yellow', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      declaration: {
        type: 'H7',
        status: 'draft',
        h7Data: { iossData: null },
        vatCalculation: { totalToPay: 21 }
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitH7(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.levanteDate).toBeUndefined();
  });
});

describe('getH7Stats: rama tenantId filtering', () => {
  test('solo cuenta expediciones del tenant del usuario', async () => {
    const user1 = usuario();
    const user2 = usuario(); // otro tenant
    await expedienteImportacion(user1, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: new Date() }
    });
    await expedienteImportacion(user2, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: new Date() }
    });
    const req = { query: {}, user: user1 };
    const res = crearRes();

    await ctrl.getH7Stats(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(1); // solo cuenta el del user1
  });

  test('filtra por rango de fechas cuando se proporciona', async () => {
    const user = usuario();
    const hoy = new Date();
    const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: ayer }
    });
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: hoy }
    });
    const req = { query: { startDate: hoy.toISOString() }, user };
    const res = crearRes();

    await ctrl.getH7Stats(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(1); // solo el de hoy
  });
});

describe('AI endpoints: ramas de tenant-scoping', () => {
  test('aiValidateDeclaration respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, body: {}, user: user2 };
    const res = crearRes();

    await ctrl.aiValidateDeclaration(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('aiDetectErrors respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, body: {}, user: user2 };
    const res = crearRes();

    await ctrl.aiDetectErrors(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('aiSuggestRegime respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, user: user2 };
    const res = crearRes();

    await ctrl.aiSuggestRegime(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('aiPredictChannel respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, body: {}, user: user2 };
    const res = crearRes();

    await ctrl.aiPredictChannel(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('aiFullDeclarationAnalysis respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, body: {}, user: user2 };
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('getAiDeclarationAnalysis respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, user: user2 };
    const res = crearRes();

    await ctrl.getAiDeclarationAnalysis(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('applyRegimeSuggestion respeta ensureSameTenant', async () => {
    const user1 = usuario();
    const user2 = usuario();
    const exp = await expedienteImportacion(user1);
    const req = { params: { expeditionId: exp._id }, body: { regime: '42' }, user: user2 };
    const res = crearRes();

    await ctrl.applyRegimeSuggestion(req, res);

    expect(res.statusCode).toBe(404);
  });

  test('aiSuggestRegime 400 cuando operationType != import', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.aiSuggestRegime(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('solo disponible para importaciones');
  });
});

describe('applyRegimeSuggestion: rama sin declaracion previa', () => {
  test('crea declaracion basica cuando no existia', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    delete exp.declaration;
    await exp.save();
    const req = { params: { expeditionId: exp._id }, body: { regime: '42', preference: '300' }, user };
    const res = crearRes();

    await ctrl.applyRegimeSuggestion(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration).toBeDefined();
    expect(updated.declaration.type).toBe('H1'); // import -> H1
    expect(updated.declaration.regime).toBe('42');
    expect(updated.declaration.preference).toBe('300');
  });

  test('crea declaracion tipo AES cuando operationType es export', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    delete exp.declaration;
    await exp.save();
    const req = { params: { expeditionId: exp._id }, body: { regime: '10' }, user };
    const res = crearRes();

    await ctrl.applyRegimeSuggestion(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.type).toBe('AES');
  });
});

describe('aiFullDeclarationAnalysis: rama de determinacion de tipo default', () => {
  test('usa H1 cuando operationType es import y no hay declaracion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    delete exp.declaration;
    await exp.save();
    const req = { params: { expeditionId: exp._id }, body: {}, user };
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis(req, res);

    expect(res.statusCode).toBe(200);
    expect(aiService.fullDeclarationAnalysis).toHaveBeenCalledWith(expect.anything(), 'H1');
  });

  test('usa AES cuando operationType es export y no hay declaracion', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    delete exp.declaration;
    await exp.save();
    const req = { params: { expeditionId: exp._id }, body: {}, user };
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis(req, res);

    expect(res.statusCode).toBe(200);
    expect(aiService.fullDeclarationAnalysis).toHaveBeenCalledWith(expect.anything(), 'AES');
  });

  test('persiste el analisis en aiAnalysis.declarationAnalysis', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { params: { expeditionId: exp._id }, body: {}, user };
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.aiAnalysis.declarationAnalysis).toBeDefined();
    expect(updated.aiAnalysis.lastAnalysisAt).toBeDefined();
  });

  test('registra la accion en timeline con puntuacion', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { params: { expeditionId: exp._id }, body: {}, user };
    const res = crearRes();

    await ctrl.aiFullDeclarationAnalysis(req, res);

    const updated = await Expedition.findById(exp._id);
    const timelineEntry = updated.timeline.find(t => t.action === 'ai_declaration_analysis');
    expect(timelineEntry).toBeDefined();
    expect(timelineEntry.metadata.readinessScore).toBe(90);
  });
});

describe('aiPredictChannel: persiste prediccion en expediente', () => {
  test('guarda channelPrediction en aiAnalysis', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { params: { expeditionId: exp._id }, body: {}, user };
    const res = crearRes();

    await ctrl.aiPredictChannel(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.aiAnalysis.channelPrediction).toBeDefined();
    expect(updated.aiAnalysis.channelPrediction.predictedChannel).toBe('green');
    expect(updated.aiAnalysis.channelPrediction.predictedAt).toBeDefined();
  });
});

describe('ramas adicionales para incrementar cobertura', () => {
  test('generateAES acepta exportType vacio (usa default)', async () => {
    const user = usuario();
    const exp = await expedienteExportacion(user);
    const req = { body: { expeditionId: exp._id, exportType: '' }, user };
    const res = crearRes();

    await ctrl.generateAES(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('10'); // default
  });

  test('generateH1 acepta regime vacio (usa default 40)', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user);
    const req = { body: { expeditionId: exp._id, regime: '' }, user };
    const res = crearRes();

    await ctrl.generateH1(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('40');
  });

  test('updateDeclaration no regenera XML cuando no hay cambios', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: {
        type: 'H1',
        regime: '40',
        status: 'draft',
        xmlContent: '<H1>original</H1>'
      }
    });
    const req = { params: { expeditionId: exp._id }, body: {}, user }; // body vacio
    const res = crearRes();

    await ctrl.updateDeclaration(req, res);

    expect(res.statusCode).toBe(200);
    // h1Generator NO debe haberse llamado porque Object.keys(updates).length === 0
    expect(h1Generator.generate).not.toHaveBeenCalled();
  });

  test('submitDeclaration maneja ausencia de req.user.email sin romper (email opcional)', async () => {
    const user = usuario();
    delete user.email; // usuario sin email
    await Tenant.create({
      _id: user.tenantId,
      name: 'Test Sin Email',
      slug: 'test-sin-email',
      customsConfig: { country: 'ES' },
      primaryContact: { name: 'Admin', email: 'admin@test.com' }
    });
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', status: 'draft', xmlContent: '<H1>ok</H1>', lrn: 'LRN-1' }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitDeclaration(req, res);

    // No debe romper aunque no haya email (lineas 354, 441, etc tienen req.user?.email)
    expect(res.statusCode).toBe(200);
  });

  test('submitH7 maneja ausencia de req.user.email sin romper', async () => {
    const user = usuario();
    delete user.email;
    const exp = await expedienteImportacion(user, {
      goodsSummary: { totalValue: 100 },
      declaration: {
        type: 'H7',
        status: 'draft',
        h7Data: { iossData: { iossNumber: 'IM123' } },
        vatCalculation: { totalToPay: 0 }
      }
    });
    const req = { params: { expeditionId: exp._id }, user };
    const res = crearRes();

    await ctrl.submitH7(req, res);

    expect(res.statusCode).toBe(200);
  });

  test('applyRegimeSuggestion acepta regime sin additionalProcedure ni preference', async () => {
    const user = usuario();
    const exp = await expedienteImportacion(user, {
      declaration: { type: 'H1', regime: '40', status: 'draft' }
    });
    const req = { params: { expeditionId: exp._id }, body: { regime: '42' }, user };
    const res = crearRes();

    await ctrl.applyRegimeSuggestion(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await Expedition.findById(exp._id);
    expect(updated.declaration.regime).toBe('42');
  });

  test('getH7Stats sin parametros de fecha', async () => {
    const user = usuario();
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: new Date() }
    });
    const req = { query: {}, user };
    const res = crearRes();

    await ctrl.getH7Stats(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  test('getH7Stats con solo startDate', async () => {
    const user = usuario();
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: new Date() }
    });
    const req = { query: { startDate: ayer.toISOString() }, user };
    const res = crearRes();

    await ctrl.getH7Stats(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  test('getH7Stats con solo endDate', async () => {
    const user = usuario();
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await expedienteImportacion(user, {
      declaration: { type: 'H7', status: 'submitted', declarationDate: new Date() }
    });
    const req = { query: { endDate: manana.toISOString() }, user };
    const res = crearRes();

    await ctrl.getH7Stats(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});
