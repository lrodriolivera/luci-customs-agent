/**
 * integrationController — API REST de integraciones externas (VUA, TRACES, NCTS)
 * y del Integration Manager.
 *
 * Es un wrapper delgado sobre services/integrations. La lógica propia que se
 * ejercita: el 404 de getIntegration, el passthrough del resultado de cada
 * servicio, y el catch → 500. Los servicios se mockean (frontera: red a VUA/
 * TRACES/NCTS y a la AEAT; su lógica vive y se prueba en services/integrations).
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/integrations', () => ({
  integrationManager: {
    healthCheck: jest.fn(),
    getIntegrations: jest.fn(),
    getIntegration: jest.fn(),
    checkIntegration: jest.fn(),
    getServicesInfo: jest.fn(),
    getEnvironmentConfig: jest.fn(),
    getUsageStats: jest.fn(),
    getRequiredControls: jest.fn(),
    getInfo: jest.fn()
  },
  vuaService: {
    submitDocument: jest.fn(),
    queryStatus: jest.fn(),
    getAvailableServices: jest.fn(),
    getAvailableAuthorities: jest.fn()
  },
  tracesService: {
    createCHED: jest.fn(),
    getCHED: jest.fn(),
    getCHEDStatus: jest.fn(),
    submitCHED: jest.fn(),
    getCHEDTypes: jest.fn(),
    getBorderControlPosts: jest.fn(),
    isCountryAuthorized: jest.fn(),
    getApprovedCountries: jest.fn()
  },
  nctsService: {
    createTransitDeclaration: jest.fn(),
    getDeclarationStatus: jest.fn(),
    getTransitDetail: jest.fn(),
    notifyArrival: jest.fn(),
    queryGuarantee: jest.fn(),
    calculateGuaranteeAmount: jest.fn(),
    getTransitTypes: jest.fn(),
    getTransitOffices: jest.fn(),
    getGuaranteeTypes: jest.fn(),
    searchTransits: jest.fn()
  }
}));

const { integrationManager, vuaService, tracesService, nctsService } =
  require('../../src/services/integrations');
const ctrl = require('../../src/controllers/integrationController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (body = {}, params = {}, query = {}) => ({ body, params, query });

// Devuelve una implementación por defecto a cada jest.fn (resetMocks las borra).
function restaurar(obj, asincronas = []) {
  Object.keys(obj).forEach((k) => {
    if (typeof obj[k] === 'function') {
      if (asincronas.includes(k)) obj[k].mockResolvedValue({ ok: true });
      else obj[k].mockReturnValue({ ok: true });
    }
  });
}
beforeEach(() => {
  restaurar(integrationManager, ['healthCheck', 'checkIntegration', 'getServicesInfo', 'getRequiredControls']);
  restaurar(vuaService, ['submitDocument', 'queryStatus']);
  restaurar(tracesService, ['createCHED', 'getCHED', 'getCHEDStatus', 'submitCHED']);
  restaurar(nctsService, ['createTransitDeclaration', 'getDeclarationStatus', 'getTransitDetail', 'notifyArrival', 'queryGuarantee', 'searchTransits']);
});

// Genera pruebas éxito + 500 para un handler que solo delega y responde data.
function casoSimple(nombre, handler, servicio, fn, { esAsync = false, args = {} } = {}) {
  describe(nombre, () => {
    test('éxito devuelve data', async () => {
      const valor = { marca: nombre };
      esAsync ? servicio[fn].mockResolvedValue(valor) : servicio[fn].mockReturnValue(valor);
      const res = mockRes();
      await handler(req(args.body, args.params, args.query), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.marca).toBe(nombre);
    });

    test('500 si el servicio lanza', async () => {
      const err = new Error('fallo');
      esAsync ? servicio[fn].mockRejectedValue(err) : servicio[fn].mockImplementation(() => { throw err; });
      const res = mockRes();
      await handler(req(args.body, args.params, args.query), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
}

// ==================== Integration Manager ====================

casoSimple('getStatus', ctrl.getStatus, integrationManager, 'healthCheck', { esAsync: true });
casoSimple('listIntegrations', ctrl.listIntegrations, integrationManager, 'getIntegrations');
casoSimple('getServicesInfo', ctrl.getServicesInfo, integrationManager, 'getServicesInfo', { esAsync: true });
casoSimple('getEnvironmentConfig', ctrl.getEnvironmentConfig, integrationManager, 'getEnvironmentConfig');
casoSimple('getUsageStats', ctrl.getUsageStats, integrationManager, 'getUsageStats');
casoSimple('getRequiredControls', ctrl.getRequiredControls, integrationManager, 'getRequiredControls', { esAsync: true });
casoSimple('getInfo', ctrl.getInfo, integrationManager, 'getInfo');

describe('getIntegration', () => {
  test('404 si no existe la integración', async () => {
    integrationManager.getIntegration.mockReturnValue(null);
    const res = mockRes();
    await ctrl.getIntegration(req({}, { code: 'XXX' }), res);
    expect(res.statusCode).toBe(404);
  });

  test('éxito fusiona la info con el estado', async () => {
    integrationManager.getIntegration.mockReturnValue({ code: 'VUA', name: 'VUA' });
    integrationManager.checkIntegration.mockResolvedValue({ status: 'ok', environment: 'test', simulationMode: true });
    const res = mockRes();
    await ctrl.getIntegration(req({}, { code: 'VUA' }), res);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.simulationMode).toBe(true);
  });

  test('500 si checkIntegration lanza', async () => {
    integrationManager.getIntegration.mockReturnValue({ code: 'VUA' });
    integrationManager.checkIntegration.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getIntegration(req({}, { code: 'VUA' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('testConnectivity', () => {
  test('éxito', async () => {
    integrationManager.checkIntegration.mockResolvedValue({ status: 'ok' });
    const res = mockRes();
    await ctrl.testConnectivity(req({}, { code: 'VUA' }), res);
    expect(res.body.data.status).toBe('ok');
  });

  test('500 si lanza', async () => {
    integrationManager.checkIntegration.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.testConnectivity(req({}, { code: 'VUA' }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== VUA ====================

casoSimple('vuaSubmitDocument', ctrl.vuaSubmitDocument, vuaService, 'submitDocument', { esAsync: true });
casoSimple('vuaQueryStatus', ctrl.vuaQueryStatus, vuaService, 'queryStatus', { esAsync: true, args: { params: { reference: 'R1' } } });
casoSimple('vuaGetServices', ctrl.vuaGetServices, vuaService, 'getAvailableServices');
casoSimple('vuaGetAuthorities', ctrl.vuaGetAuthorities, vuaService, 'getAvailableAuthorities');

// ==================== TRACES ====================

casoSimple('tracesCreateCHED', ctrl.tracesCreateCHED, tracesService, 'createCHED', { esAsync: true });
casoSimple('tracesGetCHED', ctrl.tracesGetCHED, tracesService, 'getCHED', { esAsync: true, args: { params: { reference: 'R1' } } });
casoSimple('tracesGetCHEDStatus', ctrl.tracesGetCHEDStatus, tracesService, 'getCHEDStatus', { esAsync: true, args: { params: { reference: 'R1' } } });
casoSimple('tracesSubmitCHED', ctrl.tracesSubmitCHED, tracesService, 'submitCHED', { esAsync: true, args: { params: { reference: 'R1' } } });
casoSimple('tracesGetCHEDTypes', ctrl.tracesGetCHEDTypes, tracesService, 'getCHEDTypes');
casoSimple('tracesGetBCPs', ctrl.tracesGetBCPs, tracesService, 'getBorderControlPosts');

describe('tracesCheckCountry', () => {
  test('éxito combina authorized + approvedCountries', async () => {
    tracesService.isCountryAuthorized.mockReturnValue(true);
    tracesService.getApprovedCountries.mockReturnValue(['ES', 'FR']);
    const res = mockRes();
    await ctrl.tracesCheckCountry(req({}, { country: 'ES', productType: 'animal' }), res);
    expect(res.body.data.authorized).toBe(true);
    expect(res.body.data.approvedCountries).toEqual(['ES', 'FR']);
  });

  test('500 si lanza', async () => {
    tracesService.isCountryAuthorized.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.tracesCheckCountry(req({}, { country: 'ES', productType: 'animal' }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== NCTS ====================

casoSimple('nctsCreateDeclaration', ctrl.nctsCreateDeclaration, nctsService, 'createTransitDeclaration', { esAsync: true });
casoSimple('nctsGetStatus', ctrl.nctsGetStatus, nctsService, 'getDeclarationStatus', { esAsync: true, args: { params: { mrn: 'M1' } } });
casoSimple('nctsGetDetail', ctrl.nctsGetDetail, nctsService, 'getTransitDetail', { esAsync: true, args: { params: { mrn: 'M1' } } });
casoSimple('nctsNotifyArrival', ctrl.nctsNotifyArrival, nctsService, 'notifyArrival', { esAsync: true });
casoSimple('nctsCalculateGuarantee', ctrl.nctsCalculateGuarantee, nctsService, 'calculateGuaranteeAmount', { args: { body: { goods: [], transitType: 'T1' } } });
casoSimple('nctsGetTransitTypes', ctrl.nctsGetTransitTypes, nctsService, 'getTransitTypes');
casoSimple('nctsGetOffices', ctrl.nctsGetOffices, nctsService, 'getTransitOffices', { args: { query: { type: 'departure' } } });
casoSimple('nctsGetGuaranteeTypes', ctrl.nctsGetGuaranteeTypes, nctsService, 'getGuaranteeTypes');
casoSimple('nctsSearch', ctrl.nctsSearch, nctsService, 'searchTransits', { esAsync: true });

describe('nctsQueryGuarantee', () => {
  test('éxito pasa grn + accessCode', async () => {
    nctsService.queryGuarantee.mockResolvedValue({ balance: 1000 });
    const res = mockRes();
    await ctrl.nctsQueryGuarantee(req({}, { grn: 'GRN1' }, { accessCode: 'AC1' }), res);
    expect(res.body.data.balance).toBe(1000);
    expect(nctsService.queryGuarantee).toHaveBeenCalledWith('GRN1', 'AC1');
  });

  test('500 si lanza', async () => {
    nctsService.queryGuarantee.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.nctsQueryGuarantee(req({}, { grn: 'GRN1' }, {}), res);
    expect(res.statusCode).toBe(500);
  });
});
