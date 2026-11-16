/**
 * Ajustes del valor en aduana (CL265 / CSRDC791): el flete y seguro hasta la
 * UE que no van en el precio (AK), el transporte despues de la entrada que si
 * va en el precio (BA, art. 72.a del CAU) y los ajustes opcionales del
 * expediente (comisiones, canones…), en euros.
 */
const {
  transporteTrasLaEntrada, ajustesDelValor, ajustesDeLaPartida, valorConAjustes, CODIGOS_OPCIONALES
} = require('../../../src/services/forms/ajustesDelValor');
const { divisasDeLosGastos } = require('../../../src/services/forms/gastosHastaLaFrontera');

const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fuente: 'BCE' };
const expediente = (incoterm, costs = {}) => ({ incoterm: { code: incoterm, place: 'Madrid' }, costs, goods: [{ invoiceValue: 10000, currency: 'USD' }] });
const cero = { freight: { amount: 0, currency: 'EUR' }, insurance: { amount: 0, currency: 'EUR' } };

describe('cuándo el precio incluye transporte después de la entrada en la UE', () => {
  test.each([
    ['DAP', 'exigir'], ['dpu', 'exigir'], ['DDP', 'exigir'],
    ['CPT', 'admitir'], ['CIP', 'admitir'], ['CFR', 'admitir'], ['CIF', 'admitir'],
    ['EXW', null], ['FCA', null], ['FAS', null], ['FOB', null], ['', null], ['XYZ', null]
  ])('%s → %s', (incoterm, esperado) => {
    expect(transporteTrasLaEntrada(incoterm)).toBe(esperado);
  });
});

describe('deducción BA', () => {
  test('DAP con transporte interior en USD: BA en euros con el tipo oficial', () => {
    const r = ajustesDelValor(expediente('DAP', { freightAfterEntry: { amount: 1123.4, currency: 'USD' } }), { cambios: { USD } });
    expect(r.faltan).toEqual([]);
    expect(r.ajustes).toEqual([{ codigo: 'BA', importe: 1000 }]);
  });

  test('DAP sin el dato: no se puede presentar y dice qué falta', () => {
    const r = ajustesDelValor(expediente('DAP'), { cambios: {} });
    expect(r.faltan).toEqual([
      'transporte desde la entrada en la UE hasta el lugar de entrega (Madrid) incluido en el precio: con DAP no forma parte del valor en aduana (0 si se entrega en el punto de entrada)'
    ]);
    expect(r.ajustes).toEqual([]);
  });

  test('DDP con 0: dato informado, sin deducción', () => {
    const r = ajustesDelValor(expediente('DDP', { freightAfterEntry: { amount: 0, currency: 'EUR' } }));
    expect(r).toEqual({ ajustes: [], faltan: [] });
  });

  test('CPT: el dato es opcional; si se informa, se deduce', () => {
    expect(ajustesDelValor(expediente('CPT', { insurance: { amount: 0 } })).faltan).toEqual([]);
    const r = ajustesDelValor(expediente('CPT', { insurance: { amount: 50, currency: 'EUR' }, freightAfterEntry: { amount: 300, currency: 'EUR' } }));
    expect(r.ajustes).toEqual([{ codigo: 'AK', importe: 50 }, { codigo: 'BA', importe: 300 }]);
  });

  test('FOB: el precio no incluye transporte en la UE; un dato antiguo no se deduce', () => {
    const r = ajustesDelValor(expediente('FOB', { ...cero, freightAfterEntry: { amount: 300, currency: 'EUR' } }));
    expect(r).toEqual({ ajustes: [], faltan: [] });
  });

  test('divisa sin tipo oficial: lo pide', () => {
    const r = ajustesDelValor(expediente('DAP', { freightAfterEntry: { amount: 10, currency: 'XAF' } }), { cambios: { XAF: null } });
    expect(r.faltan).toEqual(['tipo de cambio oficial de XAF para el transporte desde la entrada en la UE']);
  });

  test('se pide el tipo de cambio de la divisa del transporte posterior solo si cuenta', () => {
    expect(divisasDeLosGastos(expediente('DAP', { freightAfterEntry: { amount: 1, currency: 'gbp' } }))).toEqual(['GBP']);
    expect(divisasDeLosGastos(expediente('FOB', { ...cero, freightAfterEntry: { amount: 1, currency: 'GBP' } }))).toEqual([]);
  });
});

describe('ajustes opcionales del expediente', () => {
  test('comisiones (AB) y cánones (AI) se suman; comisiones de compra (BF) se restan', () => {
    const otros = [
      { code: 'AB', amount: 100, currency: 'EUR' }, { code: 'ai', amount: 224.68, currency: 'USD' },
      { code: 'BF', amount: 50, currency: 'EUR' }, { code: 'AB', amount: 20, currency: 'EUR' }
    ];
    const r = ajustesDelValor(expediente('CIF', { otherAdjustments: otros }), { cambios: { USD } });
    expect(r.faltan).toEqual([]);
    expect(r.ajustes).toEqual([{ codigo: 'AB', importe: 120 }, { codigo: 'AI', importe: 200 }, { codigo: 'BF', importe: 50 }]);
    expect(divisasDeLosGastos(expediente('CIF', { otherAdjustments: otros }))).toEqual(['USD']);
  });

  test('AK y BA no se aceptan a mano (los calcula LUCI) ni códigos que no existen', () => {
    const r = ajustesDelValor(expediente('CIF', { otherAdjustments: [{ code: 'AK', amount: 1 }, { code: 'ZZ', amount: 1 }, { code: 'AN', amount: 1 }] }));
    expect(r.faltan).toEqual([
      'código de ajuste no admitido: AK (el flete y seguro hasta la UE y el transporte posterior se informan aparte)',
      'código de ajuste no admitido: ZZ',
      'código de ajuste no admitido: AN'
    ]);
  });

  test('importe no válido: lo pide', () => {
    const r = ajustesDelValor(expediente('CIF', { otherAdjustments: [{ code: 'AB', amount: null }] }));
    expect(r.faltan).toEqual(['importe del ajuste AB']);
  });

  test('la lista de códigos opcionales no incluye los calculados ni los que exigen decisión del art. 71 AE', () => {
    expect(Object.keys(CODIGOS_OPCIONALES)).toEqual(['AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AL', 'BB', 'BC', 'BD', 'BE', 'BF']);
  });
});

describe('reparto por partidas y valor en aduana', () => {
  test('cada ajuste se reparte por valor y cuadra al céntimo', () => {
    const porPartida = ajustesDeLaPartida([{ codigo: 'AK', importe: 100 }, { codigo: 'BA', importe: 30 }], [1, 2]);
    expect(porPartida).toEqual([
      [{ codigo: 'AK', importe: 33.33 }, { codigo: 'BA', importe: 10 }],
      [{ codigo: 'AK', importe: 66.67 }, { codigo: 'BA', importe: 20 }]
    ]);
  });

  test('una partida sin valor no lleva ajustes a cero', () => {
    expect(ajustesDeLaPartida([{ codigo: 'BA', importe: 30 }], [10, 0])).toEqual([[{ codigo: 'BA', importe: 30 }], []]);
  });

  test('A* suma y B* resta (Información complementaria H1 v3.26, punto 5)', () => {
    expect(valorConAjustes(8901.55, [{ codigo: 'AK', importe: 500 }, { codigo: 'BA', importe: 401.55 }])).toBe(9000);
    expect(valorConAjustes(100, [])).toBe(100);
  });
});
