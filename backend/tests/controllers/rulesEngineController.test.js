/**
 * rulesEngineController — API del motor de reglas aduaneras: sanciones,
 * preferencias, cálculo de arancel/impuestos, restricciones, doble uso y
 * cumplimiento.
 *
 * Wrapper delgado sobre services/rulesEngine. Lo propio que se ejercita: las
 * validaciones de entrada (400), el passthrough del resultado y el catch → 500.
 * El motor se mockea (frontera: su lógica de cálculo ya se prueba en
 * tests/services/rulesEngine*). getInfo no depende del motor: se prueba su
 * salida estática.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/rulesEngine');

const rulesEngine = require('../../src/services/rulesEngine');
const ctrl = require('../../src/controllers/rulesEngineController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (body = {}, params = {}) => ({ body, params });

beforeEach(() => {
  Object.keys(rulesEngine).forEach((k) => {
    if (typeof rulesEngine[k] === 'function') rulesEngine[k].mockReturnValue({ ok: true });
  });
});

describe('analyzeOperation', () => {
  test('400 si faltan type/originCountry/goods', async () => {
    const res = mockRes();
    await ctrl.analyzeOperation(req({ type: 'import' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    rulesEngine.analyzeOperation.mockResolvedValue({ requirements: [] });
    const res = mockRes();
    await ctrl.analyzeOperation(req({ type: 'import', originCountry: 'CN', goods: [{}] }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requirements).toEqual([]);
  });

  test('500 si el motor lanza', async () => {
    rulesEngine.analyzeOperation.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.analyzeOperation(req({ type: 'import', originCountry: 'CN', goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('checkSanctions', () => {
  test('400 si falta countryCode', async () => {
    const res = mockRes();
    await ctrl.checkSanctions(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    rulesEngine.checkSanctions.mockReturnValue({ sanctioned: true });
    const res = mockRes();
    await ctrl.checkSanctions(req({ countryCode: 'RU' }), res);
    expect(res.body.data.sanctioned).toBe(true);
  });

  test('500 si lanza', async () => {
    rulesEngine.checkSanctions.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.checkSanctions(req({ countryCode: 'RU' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('checkPreferences', () => {
  test('400 si falta originCountry', async () => {
    const res = mockRes();
    await ctrl.checkPreferences(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    rulesEngine.checkPreferences.mockReturnValue({ agreement: 'CETA' });
    const res = mockRes();
    await ctrl.checkPreferences(req({ originCountry: 'CA' }), res);
    expect(res.body.data.agreement).toBe('CETA');
  });

  test('500 si lanza', async () => {
    rulesEngine.checkPreferences.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.checkPreferences(req({ originCountry: 'CA' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getAgreements', () => {
  test('éxito devuelve country/agreements/count', async () => {
    rulesEngine.getApplicableAgreements.mockReturnValue(['CETA', 'GSP']);
    const res = mockRes();
    await ctrl.getAgreements(req({}, { countryCode: 'CA' }), res);
    expect(res.body.data.country).toBe('CA');
    expect(res.body.data.count).toBe(2);
  });

  test('500 si lanza', async () => {
    rulesEngine.getApplicableAgreements.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.getAgreements(req({}, { countryCode: 'CA' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('calculateTariff', () => {
  test('400 si goods no es array', async () => {
    const res = mockRes();
    await ctrl.calculateTariff(req({ goods: 'x' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    rulesEngine.calculateTariff.mockResolvedValue({ total: 42 });
    const res = mockRes();
    await ctrl.calculateTariff(req({ goods: [{}] }), res);
    expect(res.body.data.total).toBe(42);
  });

  test('500 si lanza', async () => {
    rulesEngine.calculateTariff.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.calculateTariff(req({ goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('calculateTaxes', () => {
  test('400 si goods no es array', async () => {
    const res = mockRes();
    await ctrl.calculateTaxes(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito encadena calculateTariff → calculateTaxes', async () => {
    rulesEngine.calculateTariff.mockResolvedValue({ duty: 40 });
    rulesEngine.calculateTaxes.mockResolvedValue({ vat: 113.4, total: 153.4 });
    const res = mockRes();
    await ctrl.calculateTaxes(req({ goods: [{}] }), res);
    expect(res.body.data.total).toBe(153.4);
    expect(rulesEngine.calculateTaxes).toHaveBeenCalledWith({ goods: [{}] }, { duty: 40 });
  });

  test('500 si lanza', async () => {
    rulesEngine.calculateTariff.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.calculateTaxes(req({ goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('checkRestrictions', () => {
  test('400 si falta taricCode', async () => {
    const res = mockRes();
    await ctrl.checkRestrictions(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    rulesEngine.checkRestrictions.mockReturnValue({ restricted: false });
    const res = mockRes();
    await ctrl.checkRestrictions(req({ taricCode: '85171200' }), res);
    expect(res.body.data.restricted).toBe(false);
  });

  test('500 si lanza', async () => {
    rulesEngine.checkRestrictions.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.checkRestrictions(req({ taricCode: '8517' }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('checkDualUse', () => {
  test('400 si goods no es array', async () => {
    const res = mockRes();
    await ctrl.checkDualUse(req({ goods: 'x' }), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito', async () => {
    rulesEngine.checkDualUse.mockReturnValue({ dualUse: true });
    const res = mockRes();
    await ctrl.checkDualUse(req({ goods: [{}] }), res);
    expect(res.body.data.dualUse).toBe(true);
  });

  test('500 si lanza', async () => {
    rulesEngine.checkDualUse.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.checkDualUse(req({ goods: [{}] }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('validateCompliance', () => {
  test('400 si falta operation', async () => {
    const res = mockRes();
    await ctrl.validateCompliance(req({}), res);
    expect(res.statusCode).toBe(400);
  });

  test('éxito con providedDocuments por defecto []', async () => {
    rulesEngine.validateCompliance.mockReturnValue({ compliant: true });
    const res = mockRes();
    await ctrl.validateCompliance(req({ operation: { type: 'import' } }), res);
    expect(res.body.data.compliant).toBe(true);
    expect(rulesEngine.validateCompliance).toHaveBeenCalledWith({ type: 'import' }, []);
  });

  test('500 si lanza', async () => {
    rulesEngine.validateCompliance.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await ctrl.validateCompliance(req({ operation: {} }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getInfo', () => {
  test('devuelve las capacidades y acuerdos soportados', async () => {
    const res = mockRes();
    await ctrl.getInfo(req(), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capabilities).toContain('sanctions_screening');
    expect(res.body.data.coverage.fta_agreements).toBe(11);
  });
});
