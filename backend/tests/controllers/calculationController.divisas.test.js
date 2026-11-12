/**
 * calculationController y el tipo de cambio oficial de la aduana: el valor en
 * otra divisa se pasa a euros con el tipo del BCE del mes, no con un cambio de
 * mercado ni tratándolo como euros.
 */
const mockCalcDuties = jest.fn();
const mockTipoOficial = jest.fn();
const mockDivisasOficiales = jest.fn();
const mockAxiosGet = jest.fn();
const mockFindById = jest.fn();

jest.mock('../../src/services/dutyCalculationService', () => ({
  calculateDutiesWithAI: (...a) => mockCalcDuties(...a)
}));
jest.mock('../../src/services/divisas/tiposCambioOficiales', () => ({
  tipoOficial: (...a) => mockTipoOficial(...a),
  divisasOficiales: (...a) => mockDivisasOficiales(...a),
  aEuros: jest.requireActual('../../src/services/divisas/tipoCambioAduanero').aEuros
}));
jest.mock('axios', () => ({ get: (...a) => mockAxiosGet(...a) }));
jest.mock('../../src/models', () => ({ Expedition: { findById: (...a) => mockFindById(...a) }, TaricCode: {} }));
jest.mock('../../src/utils/tenantGuard', () => ({ ensureSameTenant: () => true }));

const ctrl = require('../../src/controllers/calculationController');

const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaReferencia: '2026-10-21', fechaPublicacion: '2026-10-21', fuente: 'BCE' };
const CALCULO = {
  description: 'x', duties: { totalDuty: 178.03, effectiveDutyRate: 2 }, vat: { amount: 1906.71, rate: 21 }, source: 'db', confidence: 90
};

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

beforeEach(() => {
  [mockCalcDuties, mockTipoOficial, mockDivisasOficiales, mockAxiosGet, mockFindById].forEach((m) => m.mockReset());
  mockCalcDuties.mockResolvedValue(CALCULO);
});

describe('calculateTotal con factura en divisa', () => {
  test('convierte con el tipo oficial y lo devuelve', async () => {
    mockTipoOficial.mockResolvedValue(USD);
    const res = crearRes();

    await ctrl.calculateTotal({ body: { items: [{ taricCode: '8518300090', value: 10000, currency: 'USD' }] } }, res);

    expect(mockCalcDuties.mock.calls[0][0].customsValue).toBe(8901.55);
    expect(res.body.data.summary.invoiceTotal).toBe(8901.55);
    expect(res.body.data.exchangeRates).toEqual([{ ...USD, official: true }]);
    expect(res.body.data.warnings).toEqual([]);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  test('usa la divisa de las partidas del expediente y guarda el tipo', async () => {
    mockTipoOficial.mockResolvedValue(USD);
    const expedition = {
      goods: [{ taricCode: '8518300090', invoiceValue: 10000, currency: 'USD', originCountry: 'CN' }],
      save: jest.fn()
    };
    mockFindById.mockResolvedValue(expedition);
    const res = crearRes();

    await ctrl.calculateTotal({ body: { expeditionId: 'e1' } }, res);

    expect(mockTipoOficial).toHaveBeenCalledWith('USD');
    expect(mockCalcDuties.mock.calls[0][0].customsValue).toBe(8901.55);
    expect(expedition.calculations.invoiceCurrency).toBe('USD');
    expect(expedition.calculations.exchangeRate).toBe(1.1234);
    expect(expedition.calculations.invoiceTotal).toBe(10000);
    expect(expedition.calculations.invoiceTotalEur).toBe(8901.55);
    expect(expedition.save).toHaveBeenCalled();
  });

  test('un expediente en euros guarda tipo 1', async () => {
    const expedition = { goods: [{ taricCode: 'x', invoiceValue: 500 }], save: jest.fn() };
    mockFindById.mockResolvedValue(expedition);

    await ctrl.calculateTotal({ body: { expeditionId: 'e1' } }, crearRes());

    expect(mockTipoOficial).not.toHaveBeenCalled();
    expect(expedition.calculations.invoiceCurrency).toBe('EUR');
    expect(expedition.calculations.exchangeRate).toBe(1);
    expect(expedition.calculations.invoiceTotal).toBe(500);
  });

  test('sin tipo oficial cae al cambio de mercado y lo avisa', async () => {
    mockTipoOficial.mockResolvedValue(null);
    mockAxiosGet.mockResolvedValue({ data: { rates: { ARS: 1000 } } });
    const res = crearRes();

    await ctrl.calculateTotal({ body: { items: [{ taricCode: 'x', value: 50000, currency: 'ARS' }] } }, res);

    expect(mockCalcDuties.mock.calls[0][0].customsValue).toBeCloseTo(50, 5);
    expect(res.body.data.exchangeRates[0]).toMatchObject({ divisa: 'ARS', official: false, fuente: 'mercado' });
    expect(res.body.data.warnings[0]).toContain('sin tipo de cambio oficial');
  });

  test('si la fuente oficial falla también cae al mercado con aviso', async () => {
    mockTipoOficial.mockRejectedValue(new Error('BCE caído'));
    mockAxiosGet.mockResolvedValue({ data: { rates: { USD: 1.1 } } });
    const res = crearRes();

    await ctrl.calculateDuties({ body: { taricCode: 'x', value: 110, currency: 'USD' } }, res);

    expect(res.body.data.valueEur).toBeCloseTo(100, 5);
    expect(res.body.data.exchangeRate.official).toBe(false);
  });
});

describe('tipo de cambio oficial por API', () => {
  test('?currency=usd devuelve el tipo oficial del mes', async () => {
    mockTipoOficial.mockResolvedValue(USD);
    const res = crearRes();

    await ctrl.getExchangeRate({ query: { currency: 'usd' } }, res);

    expect(mockTipoOficial).toHaveBeenCalledWith('USD');
    expect(res.body.data).toEqual({ ...USD, official: true });
  });

  test('una divisa que el BCE no cotiza responde 404', async () => {
    mockTipoOficial.mockResolvedValue(null);
    const res = crearRes();

    await ctrl.getExchangeRate({ query: { currency: 'ARS' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('DIVISA_SIN_TIPO_OFICIAL');
  });

  test('una divisa mal formada responde 400 sin consultar', async () => {
    const res = crearRes();

    await ctrl.getExchangeRate({ query: { currency: 'US$' } }, res);

    expect(res.statusCode).toBe(400);
    expect(mockTipoOficial).not.toHaveBeenCalled();
  });

  test('lista las divisas oficiales del mes', async () => {
    const lista = { mes: '2026-11', divisas: [{ codigo: 'EUR', tipo: 1 }, { codigo: 'USD', tipo: 1.1234 }] };
    mockDivisasOficiales.mockResolvedValue(lista);
    const res = crearRes();

    await ctrl.getOfficialCurrencies({}, res);

    expect(res.body).toEqual({ success: true, data: lista });
  });

  test('si no hay tipos disponibles responde 503', async () => {
    mockDivisasOficiales.mockRejectedValue(new Error('BCE caído'));
    const res = crearRes();

    await ctrl.getOfficialCurrencies({}, res);

    expect(res.statusCode).toBe(503);
  });
});
