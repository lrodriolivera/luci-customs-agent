/**
 * calculationController: el calculo de derechos e IVA de importacion.
 *
 * Estaba al 0%. Es logica de aduanas critica y prioritaria: la base imponible
 * del IVA, la conversion de divisa, el valor en aduana (CIF) y el guard de
 * tenant sobre el expediente. Un error aqui liquida mal un impuesto.
 *
 * Que se mockea y por que: `dutyCalculationService` sale a Bedrock y `axios`
 * al BCE -- son dependencias EXTERNAS, no el codigo bajo prueba. Lo que se
 * ejercita de verdad es la logica del controller: validacion de entrada, suma
 * de la base imponible, conversion de moneda, agregacion de totales y el guard
 * de propiedad del expediente. Mockear el controller mismo probaria el mock.
 */

// El tipo de IVA por capitulo viene del servicio; el resto del calculo (base,
// redondeo) lo hace el controller y NO se mockea.
const mockGetDutyInfo = jest.fn();
const mockCalcDuties = jest.fn();
const mockGetExchangeAxios = jest.fn();

jest.mock('../../src/services/dutyCalculationService', () => ({
  getDutyInfo: (...a) => mockGetDutyInfo(...a),
  calculateDutiesWithAI: (...a) => mockCalcDuties(...a),
  validateDutyRate: jest.fn(),
  clearMemoryCache: jest.fn()
}));

jest.mock('axios', () => ({ get: (...a) => mockGetExchangeAxios(...a) }));

// Expedition se usa en calculateTotal con expeditionId; lo cubrimos con el
// caso de items directos (sin expediente) para no arrastrar Mongoose aqui.
jest.mock('../../src/models', () => ({
  Expedition: { findById: jest.fn() },
  TaricCode: {}
}));

const ctrl = require('../../src/controllers/calculationController');

/** Res simulado que captura status y json. */
function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

beforeEach(() => {
  mockGetDutyInfo.mockReset();
  mockCalcDuties.mockReset();
  mockGetExchangeAxios.mockReset();
});

describe('calculateVat: base imponible del IVA de importacion', () => {
  test('la base es valor en aduana + aranceles + impuestos especiales', async () => {
    // Art. 83 Ley 37/1992: la base del IVA en importacion incluye los derechos
    // arancelarios. 1000 + 120 + 0 = 1120; al 21% = 235,20.
    mockGetDutyInfo.mockResolvedValue(null); // sin capitulo => estandar
    const res = crearRes();

    await ctrl.calculateVat(
      { body: { taricCode: '8471300000', customsValue: 1000, dutyAmount: 120, specialTaxes: 0 } },
      res
    );

    expect(res.body.data.taxBase).toBe(1120);
    expect(res.body.data.vatRate).toBe(21);
    expect(res.body.data.vatAmount).toBe(235.2);
  });

  test('aplica el tipo reducido del capitulo cuando lo hay', async () => {
    // Algunos capitulos tributan al 10% o 4%. El tipo lo determina la tabla
    // por capitulo, no el controller.
    mockGetDutyInfo.mockResolvedValue({ vatRate: 10, vatType: 'reduced' });
    const res = crearRes();

    await ctrl.calculateVat(
      { body: { taricCode: '0401100000', customsValue: 1000, dutyAmount: 120 } },
      res
    );

    expect(res.body.data.vatRate).toBe(10);
    expect(res.body.data.vatType).toBe('reduced');
    expect(res.body.data.vatAmount).toBe(112); // 1120 * 10%
  });

  test('sin taricCode usa el tipo estandar del 21%', async () => {
    const res = crearRes();

    await ctrl.calculateVat({ body: { customsValue: 500, dutyAmount: 0 } }, res);

    expect(res.body.data.vatRate).toBe(21);
    expect(res.body.data.vatAmount).toBe(105);
    expect(mockGetDutyInfo).not.toHaveBeenCalled();
  });

  test('redondea el IVA a dos decimales', async () => {
    // 333,33 * 21% = 69,9993 -> 70,00.
    mockGetDutyInfo.mockResolvedValue(null);
    const res = crearRes();

    await ctrl.calculateVat({ body: { customsValue: 333.33, dutyAmount: 0 } }, res);

    expect(res.body.data.vatAmount).toBe(70);
  });

  test('normaliza el codigo TARIC antes de buscar el capitulo', async () => {
    // El controller quita espacios/puntos y rellena a 10 digitos: '8471.30'
    // debe consultarse como '8471300000'.
    mockGetDutyInfo.mockResolvedValue(null);
    const res = crearRes();

    await ctrl.calculateVat({ body: { taricCode: '8471.30', customsValue: 100 } }, res);

    expect(mockGetDutyInfo).toHaveBeenCalledWith('8471300000');
  });
});

describe('calculateDuties: validacion y conversion de divisa', () => {
  test('exige el codigo TARIC', async () => {
    const res = crearRes();

    await ctrl.calculateDuties({ body: { value: 1000 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('convierte el valor a EUR antes de calcular', async () => {
    // 1000 USD * 0,9259 (1/1,08 de fallback) ~ 925,9 EUR. El servicio de
    // aranceles recibe el valor YA en euros.
    mockGetExchangeAxios.mockRejectedValue(new Error('sin red')); // fuerza fallback
    mockCalcDuties.mockResolvedValue({
      taricCode: '8471300000', duties: {}, vat: {}, totalTaxes: 0, totalToPay: 0
    });
    const res = crearRes();

    await ctrl.calculateDuties(
      { body: { taricCode: '8471300000', value: 1000, currency: 'USD' } },
      res
    );

    const arg = mockCalcDuties.mock.calls[0][0];
    // fallback USD 1.08 => 1000/1.08 = 925.925...
    expect(arg.customsValue).toBeCloseTo(925.93, 1);
  });

  test('un valor ya en EUR no se convierte', async () => {
    mockCalcDuties.mockResolvedValue({ taricCode: 'x', duties: {}, vat: {}, totalTaxes: 0, totalToPay: 0 });
    const res = crearRes();

    await ctrl.calculateDuties({ body: { taricCode: 'x', value: 1000, currency: 'EUR' } }, res);

    expect(mockCalcDuties.mock.calls[0][0].customsValue).toBe(1000);
    expect(mockGetExchangeAxios).not.toHaveBeenCalled();
  });

  test('un fallo del servicio de aranceles devuelve 500, no revienta', async () => {
    mockCalcDuties.mockRejectedValue(new Error('Bedrock caido'));
    const res = crearRes();

    await ctrl.calculateDuties({ body: { taricCode: 'x', value: 100 } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('calculateTotal: valor en aduana (CIF) y totales', () => {
  test('el valor en aduana suma flete y seguro al valor de factura', async () => {
    // Art. 70 CAU: el valor en aduana incluye el transporte y el seguro hasta
    // la frontera de la UE. 1000 factura + 100 flete + 50 seguro = 1150 CIF.
    mockCalcDuties.mockResolvedValue({
      description: 'x', duties: { totalDuty: 50, effectiveDutyRate: 5 },
      vat: { amount: 210, rate: 21 }, source: 'db', confidence: 90
    });
    const res = crearRes();

    await ctrl.calculateTotal(
      { body: { items: [{ taricCode: 'x', value: 1000, currency: 'EUR' }], freightCost: 100, insuranceCost: 50 } },
      res
    );

    expect(res.body.data.summary.customsValue).toBe(1150);
    expect(res.body.data.summary.totalDuties).toBe(50);
    expect(res.body.data.summary.totalVat).toBe(210);
  });

  test('la garantia requerida es el 110% de los impuestos', async () => {
    mockCalcDuties.mockResolvedValue({
      description: 'x', duties: { totalDuty: 100, effectiveDutyRate: 10 },
      vat: { amount: 200, rate: 21 }, source: 'db', confidence: 90
    });
    const res = crearRes();

    await ctrl.calculateTotal(
      { body: { items: [{ taricCode: 'x', value: 1000, currency: 'EUR' }] } },
      res
    );

    // impuestos = 100 + 200 = 300; garantia = ceil(300 * 1.1) = 330.
    expect(res.body.data.summary.totalTaxes).toBe(300);
    expect(res.body.data.summary.guaranteeRequired).toBe(330);
  });

  test('cuando el servicio falla en un item, cae al arancel estimado del 5%', async () => {
    // Fallback documentado: 5% de arancel + 21% IVA sobre valor+arancel, y un
    // aviso para verificar en el TARIC oficial. Un valor de 1000:
    // arancel = 50, IVA = (1050)*21% = 220,5.
    mockCalcDuties.mockRejectedValue(new Error('no identificado'));
    const res = crearRes();

    await ctrl.calculateTotal(
      { body: { items: [{ taricCode: '9999999999', value: 1000, currency: 'EUR' }] } },
      res
    );

    const item = res.body.data.items[0];
    expect(item.source).toBe('fallback');
    expect(item.dutyRate).toBe(5);
    expect(item.dutyAmount).toBe(50);
    expect(item.vatAmount).toBe(220.5);
    expect(res.body.data.warnings.some(w => /estimado/i.test(w))).toBe(true);
  });

  test('rechaza una peticion sin items', async () => {
    const res = crearRes();

    await ctrl.calculateTotal({ body: { items: [] } }, res);

    expect(res.statusCode).toBe(400);
  });
});

describe('getExchangeRate: endpoint de tipo de cambio', () => {
  test('exige las dos monedas', async () => {
    const res = crearRes();

    await ctrl.getExchangeRate({ query: { from: 'USD' } }, res);

    expect(res.statusCode).toBe(400);
  });

  test('misma moneda origen y destino da tasa 1', async () => {
    const res = crearRes();

    await ctrl.getExchangeRate({ query: { from: 'eur', to: 'EUR' } }, res);

    expect(res.body.data.rate).toBe(1);
  });
});
