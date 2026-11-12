/**
 * Flete y seguro hasta la entrada en la UE: lo que hay que sumar al precio de
 * la factura para llegar al valor en aduana (art. 71.1.e del CAU), segun el
 * incoterm, convertido a euros con el tipo oficial de su divisa.
 */
const {
  gastosQueSeSuman, gastosHastaLaFrontera, repartirPorValor, divisasDeLosGastos, cambiosDeLosGastos
} = require('../../../src/services/forms/gastosHastaLaFrontera');

const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fuente: 'BCE' };
const GBP = { divisa: 'GBP', tipo: 0.83825, mes: '2026-11', fuente: 'BCE' };

const expediente = (incoterm, costs) => ({ incoterm: { code: incoterm }, costs, goods: [{ invoiceValue: 10000, currency: 'USD' }] });

describe('qué gastos se suman según el incoterm', () => {
  test.each([
    ['EXW', { flete: true, seguro: true }],
    ['FCA', { flete: true, seguro: true }],
    ['FAS', { flete: true, seguro: true }],
    ['fob', { flete: true, seguro: true }],
    ['CFR', { flete: false, seguro: true }],
    ['CPT', { flete: false, seguro: true }],
    ['CIF', { flete: false, seguro: false }],
    ['CIP', { flete: false, seguro: false }],
    ['DAP', { flete: false, seguro: false }],
    ['DPU', { flete: false, seguro: false }],
    ['DDP', { flete: false, seguro: false }]
  ])('%s', (incoterm, esperado) => {
    expect(gastosQueSeSuman(incoterm)).toEqual(esperado);
  });

  test('un incoterm desconocido o vacío no se sabe', () => {
    expect(gastosQueSeSuman('XYZ')).toBeNull();
    expect(gastosQueSeSuman('')).toBeNull();
    expect(gastosQueSeSuman(undefined)).toBeNull();
  });
});

describe('gastos hasta la frontera en euros', () => {
  test('FOB: flete en dólares y seguro en euros, cada uno con su divisa', () => {
    const exp = expediente('FOB', { freight: { amount: 1123.4, currency: 'USD' }, insurance: { amount: 50, currency: 'EUR' } });

    const r = gastosHastaLaFrontera(exp, { cambios: { USD } });

    expect(r).toEqual({ flete: 1000, seguro: 50, total: 1050, faltan: [] });
  });

  test('CFR: el flete ya va en el precio y no se suma aunque esté informado', () => {
    const exp = expediente('CFR', { freight: { amount: 900, currency: 'EUR' }, insurance: { amount: 83.83, currency: 'GBP' } });

    const r = gastosHastaLaFrontera(exp, { cambios: { GBP } });

    expect(r).toEqual({ flete: 0, seguro: 100.01, total: 100.01, faltan: [] });
  });

  test('CIF: no se suma nada ni se pide nada', () => {
    expect(gastosHastaLaFrontera(expediente('CIF', undefined))).toEqual({ flete: 0, seguro: 0, total: 0, faltan: [] });
  });

  test('FOB sin flete ni seguro: los pide; un 0 escrito a propósito vale', () => {
    const vacio = gastosHastaLaFrontera(expediente('FOB', {}));
    expect(vacio.faltan).toEqual([
      'flete hasta la entrada en la UE (el incoterm FOB no lo incluye; 0 si no hay)',
      'seguro hasta la entrada en la UE (el incoterm FOB no lo incluye; 0 si no hay)'
    ]);

    const ceros = gastosHastaLaFrontera(expediente('FOB', { freight: { amount: 0, currency: 'EUR' }, insurance: { amount: 0, currency: 'EUR' } }));
    expect(ceros).toEqual({ flete: 0, seguro: 0, total: 0, faltan: [] });
  });

  test('sin el tipo oficial de la divisa del flete lo dice en vez de tomarlo como euros', () => {
    const exp = expediente('EXW', { freight: { amount: 500, currency: 'USD' }, insurance: { amount: 0, currency: 'EUR' } });

    expect(gastosHastaLaFrontera(exp, { cambios: {} }).faltan).toEqual(['tipo de cambio oficial de USD para el flete']);
    expect(gastosHastaLaFrontera(exp, { cambios: { USD: null } }).faltan).toEqual(['tipo de cambio oficial de USD para el flete']);
  });

  test('sin incoterm suma lo que haya (la falta del incoterm se avisa aparte)', () => {
    const exp = { costs: { freight: { amount: 200, currency: 'EUR' } } };
    expect(gastosHastaLaFrontera(exp)).toEqual({ flete: 200, seguro: 0, total: 200, faltan: [] });
  });

  test('incoterm desconocido: lo pide', () => {
    expect(gastosHastaLaFrontera(expediente('XYZ', {})).faltan).toEqual(['incoterm reconocido (EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU o DDP)']);
  });

  test('un importe guardado como número es en euros (dato antiguo)', () => {
    const exp = expediente('FOB', { freight: 500, insurance: 100 });
    expect(gastosHastaLaFrontera(exp)).toEqual({ flete: 500, seguro: 100, total: 600, faltan: [] });
  });
});

describe('reparto entre partidas', () => {
  test('en proporción al valor y cuadrando al céntimo en la última', () => {
    expect(repartirPorValor(100, [1, 1, 1])).toEqual([33.33, 33.33, 33.34]);
    expect(repartirPorValor(1050, [8901.55, 0, 2000])).toEqual([857.37, 0, 192.63]);
    expect(repartirPorValor(0, [5, 5])).toEqual([0, 0]);
  });

  test('sin valores, a partes iguales', () => {
    expect(repartirPorValor(10, [0, 0])).toEqual([5, 5]);
  });

  test('sin partidas, nada', () => {
    expect(repartirPorValor(10, [])).toEqual([]);
  });
});

describe('tipos de cambio que hacen falta', () => {
  test('solo las divisas distintas del euro de los gastos que se suman', () => {
    expect(divisasDeLosGastos(expediente('FOB', { freight: { amount: 1, currency: 'usd' }, insurance: { amount: 1, currency: 'GBP' } }))).toEqual(['USD', 'GBP']);
    expect(divisasDeLosGastos(expediente('CFR', { freight: { amount: 1, currency: 'USD' }, insurance: { amount: 1, currency: 'EUR' } }))).toEqual([]);
    expect(divisasDeLosGastos(expediente('CIF', { freight: { amount: 1, currency: 'USD' } }))).toEqual([]);
  });

  test('los pide al servicio oficial; si el BCE no la cotiza queda en null', async () => {
    const tipoOficial = jest.fn(async (d) => (d === 'USD' ? USD : null));
    const exp = expediente('FOB', { freight: { amount: 1, currency: 'USD' }, insurance: { amount: 1, currency: 'XAF' } });

    await expect(cambiosDeLosGastos(exp, { tipoOficial })).resolves.toEqual({ USD, XAF: null });
  });
});
