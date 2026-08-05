/**
 * pueController — ramas de los handlers delegadores no cubiertas por
 * pueController.db.test.js (que ejercita el ciclo de vida contra BD real).
 *
 * Aquí el objetivo son las RAMAS baratas: validaciones de entrada (400),
 * passthrough del resultado del service, y los catch → 500. Se mockea
 * pueService por completo (frontera: su lógica ya está cubierta en
 * tests/services/pueService.test.js y en el .db de este controller); así estos
 * handlers se ejercitan sin re-correr el motor SOIVRE.
 *
 * aiService, pueGenerator y el modelo PUERequest NO se tocan aquí: los handlers
 * que dependen de ellos (AI, XML, guards de tenant sobre el modelo) ya están en
 * pueController.db.test.js. Este archivo cubre SOLO los handlers que delegan en
 * pueService.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/pueService');

const pueService = require('../../src/services/pueService');
const ctrl = require('../../src/controllers/pueController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (body = {}, query = {}, params = {}, user = { _id: 'u1', role: 'agent' }) =>
  ({ body, query, params, user });

// Da a cada función mockeada un valor por defecto razonable.
beforeEach(() => {
  Object.keys(pueService).forEach((k) => {
    if (typeof pueService[k] === 'function') pueService[k].mockReturnValue({ ok: true });
  });
});

// ==================== getStats ====================

describe('getStats', () => {
  test('agent: filtra createdBy por su _id', async () => {
    pueService.getStats.mockResolvedValue({ total: 3 });
    const res = mockRes();
    await ctrl.getStats(req({}, {}, {}, { _id: 'u1', role: 'agent' }), res);
    expect(res.body.data.total).toBe(3);
    expect(pueService.getStats).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u1' }));
  });

  test('admin: createdBy null (ve todo)', async () => {
    pueService.getStats.mockResolvedValue({ total: 9 });
    const res = mockRes();
    await ctrl.getStats(req({}, { pueType: 'ROHS' }, {}, { _id: 'admin1', role: 'admin' }), res);
    expect(pueService.getStats).toHaveBeenCalledWith(expect.objectContaining({ createdBy: null, pueType: 'ROHS' }));
  });

  test('500 si el service lanza', async () => {
    pueService.getStats.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getTypes / getSoivreOffices / getInfo ====================

describe('handlers de catálogo simples', () => {
  test('getTypes éxito + 500', async () => {
    pueService.getTypes.mockReturnValue([{ code: 'ROHS' }]);
    const res = mockRes();
    await ctrl.getTypes(req(), res);
    expect(res.body.data[0].code).toBe('ROHS');

    pueService.getTypes.mockImplementation(() => { throw new Error('x'); });
    const res2 = mockRes();
    await ctrl.getTypes(req(), res2);
    expect(res2.statusCode).toBe(500);
  });

  test('getSoivreOffices pasa province + 500', async () => {
    pueService.getSoivreOffices.mockReturnValue([{ id: 1 }]);
    const res = mockRes();
    await ctrl.getSoivreOffices(req({}, { province: 'Madrid' }), res);
    expect(pueService.getSoivreOffices).toHaveBeenCalledWith('Madrid');

    pueService.getSoivreOffices.mockImplementation(() => { throw new Error('x'); });
    const res2 = mockRes();
    await ctrl.getSoivreOffices(req(), res2);
    expect(res2.statusCode).toBe(500);
  });

  test('getInfo éxito + 500', async () => {
    pueService.getInfo.mockReturnValue({ version: '1' });
    const res = mockRes();
    await ctrl.getInfo(req(), res);
    expect(res.body.data.version).toBe('1');

    pueService.getInfo.mockImplementation(() => { throw new Error('x'); });
    const res2 = mockRes();
    await ctrl.getInfo(req(), res2);
    expect(res2.statusCode).toBe(500);
  });
});

// ==================== getRequiredDocuments ====================

describe('getRequiredDocuments', () => {
  test('404 si el tipo no tiene documentos', async () => {
    pueService.getRequiredDocuments.mockReturnValue([]);
    const res = mockRes();
    await ctrl.getRequiredDocuments(req({}, {}, { type: 'XXX' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('éxito devuelve documentos', async () => {
    pueService.getRequiredDocuments.mockReturnValue([{ name: 'Declaración CE' }]);
    const res = mockRes();
    await ctrl.getRequiredDocuments(req({}, {}, { type: 'ROHS' }), res);
    expect(res.body.data).toHaveLength(1);
  });

  test('500 si lanza', async () => {
    pueService.getRequiredDocuments.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.getRequiredDocuments(req({}, {}, { type: 'ROHS' }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== validate ====================

describe('validate', () => {
  test('éxito', async () => {
    pueService.preValidate.mockResolvedValue({ valid: true });
    const res = mockRes();
    await ctrl.validate(req({ pueType: 'ROHS' }), res);
    expect(res.body.data.valid).toBe(true);
  });

  test('500 si lanza', async () => {
    pueService.preValidate.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.validate(req({}), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== checkTaric ====================

describe('checkTaric', () => {
  test('400 si taricCodes no es array', async () => {
    const res = mockRes();
    await ctrl.checkTaric(req({ taricCodes: '8517' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    pueService.checkTaricCodes.mockReturnValue([{ code: '85171200', requiresPUE: true }]);
    const res = mockRes();
    await ctrl.checkTaric(req({ taricCodes: ['85171200'] }), res);
    expect(res.body.data[0].requiresPUE).toBe(true);
  });

  test('500 si lanza', async () => {
    pueService.checkTaricCodes.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.checkTaric(req({ taricCodes: ['x'] }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== processBatch ====================

describe('processBatch', () => {
  test('400 si requests no es array', async () => {
    const res = mockRes();
    await ctrl.processBatch(req({ requests: 'no' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito pasa opciones autoSubmit/certificateAlias', async () => {
    pueService.processBatch.mockResolvedValue({ processed: 2 });
    const res = mockRes();
    await ctrl.processBatch(req({ requests: [{}, {}], autoSubmit: true, certificateAlias: 'FNMT' }), res);
    expect(res.body.data.processed).toBe(2);
    expect(pueService.processBatch).toHaveBeenCalledWith(
      [{}, {}], 'u1', { autoSubmit: true, certificateAlias: 'FNMT' });
  });

  test('500 si lanza', async () => {
    pueService.processBatch.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.processBatch(req({ requests: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== list ====================

describe('list', () => {
  test('agent: fuerza createdBy propio', async () => {
    pueService.list.mockResolvedValue({ data: [], pagination: { total: 0 } });
    const res = mockRes();
    await ctrl.list(req({}, { page: '1' }, {}, { _id: 'u1', role: 'agent' }), res);
    expect(pueService.list).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u1', page: '1' }));
  });

  test('admin: respeta createdBy de la query', async () => {
    pueService.list.mockResolvedValue({ data: [], pagination: {} });
    const res = mockRes();
    await ctrl.list(req({}, { createdBy: 'otro' }, {}, { _id: 'a', role: 'admin' }), res);
    expect(pueService.list).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'otro' }));
  });

  test('500 si lanza', async () => {
    pueService.list.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.list(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== submit ====================

describe('submit', () => {
  test('400 si el service devuelve success:false', async () => {
    pueService.submitToAEAT.mockResolvedValue({ success: false, error: 'faltan docs' });
    const res = mockRes();
    await ctrl.submit(req({ certificateAlias: 'FNMT' }, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('éxito', async () => {
    pueService.submitToAEAT.mockResolvedValue({ success: true, data: { reference: 'PUE-1' } });
    const res = mockRes();
    await ctrl.submit(req({}, {}, { id: 'p1' }), res);
    expect(res.body.data.reference).toBe('PUE-1');
  });

  test('500 si lanza', async () => {
    pueService.submitToAEAT.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.submit(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== cancel (rama 400 sin motivo) ====================

describe('cancel', () => {
  test('400 si falta reason', async () => {
    const res = mockRes();
    await ctrl.cancel(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(400);
  });
});

// ==================== getUpcomingDeadlines / getRequiredControls ====================

describe('getRequiredControls', () => {
  test('400 si goods no es array', async () => {
    const res = mockRes();
    await ctrl.getRequiredControls(req({ goods: 'x' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    pueService.getRequiredPUE.mockReturnValue([{ type: 'ROHS' }]);
    const res = mockRes();
    await ctrl.getRequiredControls(req({ goods: [{ taricCode: '85171200' }] }), res);
    expect(res.body.data[0].type).toBe('ROHS');
  });

  test('500 si lanza', async () => {
    pueService.getRequiredPUE.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.getRequiredControls(req({ goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== Fase 5: catálogos SOIVRE ====================

describe('catálogos SOIVRE (fase 5)', () => {
  const casos = [
    ['getAllCatalogs', 'getAllCatalogs', {}],
    ['getSpecificities', 'getSpecificities', { params: { flowType: 'import' } }],
    ['getCenters', 'getSoivreCenters', {}],
    ['getInspectionPoints', 'getInspectionPoints', { params: { code: 'C1' } }],
    ['getUnits', 'getMerchandiseUnits', {}],
    ['getCertificateTypes', 'getCertificateTypes', {}]
  ];

  test.each(casos)('%s: éxito y 500', async (handler, svcFn, { params = {} }) => {
    pueService[svcFn].mockReturnValue([{ ok: 1 }]);
    const res = mockRes();
    await ctrl[handler](req({}, {}, params), res);
    expect(res.body.success).toBe(true);

    pueService[svcFn].mockImplementation(() => { throw new Error('x'); });
    const res2 = mockRes();
    await ctrl[handler](req({}, {}, params), res2);
    expect(res2.statusCode).toBe(500);
  });

  test('getSpecificities pasa el flowType; getInspectionPoints pasa el code', async () => {
    pueService.getSpecificities.mockReturnValue([]);
    pueService.getInspectionPoints.mockReturnValue([]);
    await ctrl.getSpecificities(req({}, {}, { flowType: 'export' }), mockRes());
    await ctrl.getInspectionPoints(req({}, {}, { code: 'C9' }), mockRes());
    expect(pueService.getSpecificities).toHaveBeenCalledWith('export');
    expect(pueService.getInspectionPoints).toHaveBeenCalledWith('C9');
  });
});

// ==================== lookupMRN / validateRII ====================

describe('lookupMRN', () => {
  test('400 si falta mrn', async () => {
    const res = mockRes();
    await ctrl.lookupMRN(req({ claveZeta: '1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/MRN/);
  });

  test('400 si falta claveZeta', async () => {
    const res = mockRes();
    await ctrl.lookupMRN(req({ mrn: '25ES001' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Clave Zeta/);
  });

  test('éxito devuelve el resultado tal cual', async () => {
    pueService.lookupMRN.mockResolvedValue({ success: true, declaration: { mrn: '25ES001' } });
    const res = mockRes();
    await ctrl.lookupMRN(req({ mrn: '25ES001', claveZeta: '1' }), res);
    expect(res.body.declaration.mrn).toBe('25ES001');
    expect(pueService.lookupMRN).toHaveBeenCalledWith('25ES001', '1');
  });

  test('500 si lanza', async () => {
    pueService.lookupMRN.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.lookupMRN(req({ mrn: '25ES001', claveZeta: '1' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('validateRII', () => {
  test('400 si falta nif', async () => {
    const res = mockRes();
    await ctrl.validateRII(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    pueService.validateRII.mockResolvedValue({ success: true, registered: true });
    const res = mockRes();
    await ctrl.validateRII(req({ nif: 'B12345678' }), res);
    expect(res.body.registered).toBe(true);
  });

  test('500 si lanza', async () => {
    pueService.validateRII.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.validateRII(req({ nif: 'B1' }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== catch 500 de delegadores por pueService ====================

describe('catch 500 de handlers delegadores', () => {
  test('create 500 si createRequest lanza', async () => {
    pueService.createRequest.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await ctrl.create(req({ pueType: 'ROHS' }, {}, {}, { _id: 'u1', tenantId: 't1' }), res);
    expect(res.statusCode).toBe(500);
  });

  test('create 400 si el service devuelve success:false', async () => {
    pueService.createRequest.mockResolvedValue({ success: false, error: 'inválida' });
    const res = mockRes();
    await ctrl.create(req({ pueType: 'ROHS' }, {}, {}, { _id: 'u1', tenantId: 't1' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('addDocument mapea 404 con "no encontrada"', async () => {
    pueService.addDocument.mockRejectedValue(new Error('Solicitud no encontrada'));
    const res = mockRes();
    await ctrl.addDocument(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('addDocument 500 en otros errores', async () => {
    pueService.addDocument.mockRejectedValue(new Error('otro'));
    const res = mockRes();
    await ctrl.addDocument(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(500);
  });

  test('scheduleInspection mapea 404 vs 500', async () => {
    pueService.scheduleInspection.mockRejectedValue(new Error('no encontrada'));
    const res = mockRes();
    await ctrl.scheduleInspection(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(404);

    pueService.scheduleInspection.mockRejectedValue(new Error('otro'));
    const res2 = mockRes();
    await ctrl.scheduleInspection(req({}, {}, { id: 'p1' }), res2);
    expect(res2.statusCode).toBe(500);
  });

  test('recordInspectionResult mapea 404 vs 500', async () => {
    pueService.recordInspectionResult.mockRejectedValue(new Error('no encontrada'));
    const res = mockRes();
    await ctrl.recordInspectionResult(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(404);

    pueService.recordInspectionResult.mockRejectedValue(new Error('otro'));
    const res2 = mockRes();
    await ctrl.recordInspectionResult(req({}, {}, { id: 'p1' }), res2);
    expect(res2.statusCode).toBe(500);
  });

  test('issueCertificate mapea 404 vs 400', async () => {
    pueService.issueCertificate.mockRejectedValue(new Error('no encontrada'));
    const res = mockRes();
    await ctrl.issueCertificate(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(404);

    pueService.issueCertificate.mockRejectedValue(new Error('estado inválido'));
    const res2 = mockRes();
    await ctrl.issueCertificate(req({}, {}, { id: 'p1' }), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('update mapea 404 vs 400', async () => {
    pueService.update.mockRejectedValue(new Error('Solicitud no encontrada'));
    const res = mockRes();
    await ctrl.update(req({}, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(404);

    pueService.update.mockRejectedValue(new Error('validación'));
    const res2 = mockRes();
    await ctrl.update(req({}, {}, { id: 'p1' }), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('cancel mapea 404 vs 400 (con reason presente)', async () => {
    pueService.cancelRequest.mockRejectedValue(new Error('no encontrada'));
    const res = mockRes();
    await ctrl.cancel(req({ reason: 'x' }, {}, { id: 'p1' }), res);
    expect(res.statusCode).toBe(404);

    pueService.cancelRequest.mockRejectedValue(new Error('estado'));
    const res2 = mockRes();
    await ctrl.cancel(req({ reason: 'x' }, {}, { id: 'p1' }), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('cancel éxito', async () => {
    pueService.cancelRequest.mockResolvedValue({ data: { status: 'cancelled' } });
    const res = mockRes();
    await ctrl.cancel(req({ reason: 'x' }, {}, { id: 'p1' }), res);
    expect(res.body.data.status).toBe('cancelled');
  });
});

// ==================== AI: 500 (aiService lanza) ====================

describe('AI: catch 500', () => {
  test('aiDetermineType 500', async () => {
    const aiService = require('../../src/services/aiService');
    jest.spyOn(aiService, 'determinePUEType').mockRejectedValue(new Error('bedrock'));
    const res = mockRes();
    await ctrl.aiDetermineType(req({ goods: [{ description: 'x' }] }), res);
    expect(res.statusCode).toBe(500);
    aiService.determinePUEType.mockRestore();
  });

  test('aiAnalyzeGoods 500', async () => {
    const aiService = require('../../src/services/aiService');
    jest.spyOn(aiService, 'analyzeGoodsForPUE').mockRejectedValue(new Error('bedrock'));
    const res = mockRes();
    await ctrl.aiAnalyzeGoods(req({ description: 'x' }), res);
    expect(res.statusCode).toBe(500);
    aiService.analyzeGoodsForPUE.mockRestore();
  });
});

// ==================== AI: validaciones 400 (sin llegar al aiService) ====================

describe('AI: validaciones de entrada', () => {
  test('aiDetermineType 400 si goods vacío/no-array', async () => {
    const res = mockRes();
    await ctrl.aiDetermineType(req({ goods: [] }), res);
    expect(res.statusCode).toBe(400);
    const res2 = mockRes();
    await ctrl.aiDetermineType(req({}), res2);
    expect(res2.statusCode).toBe(400);
  });

  test('aiAnalyzeGoods 400 si falta description', async () => {
    const res = mockRes();
    await ctrl.aiAnalyzeGoods(req({}), res);
    expect(res.statusCode).toBe(400);
  });
});
