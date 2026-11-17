jest.mock('../../../src/services/aeat/arancelIntegrado', () => ({ consultarArancelIntegrado: jest.fn() }));
const { consultarArancelIntegrado } = require('../../../src/services/aeat/arancelIntegrado');
const { preferenciaAeatPara, aplicarPreferenciaAeat } = require('../../../src/services/aeat/preferenciaCalculadora');

// Cerezas de Chile (Jenifer, 17/11/2026): 12 % general, 0 % con la medida 142.
const CEREZAS_CHILE = {
  existe: true, areaGeografica: 'CL',
  medidas: [
    { codigo: '103-APPL', tipo: 'ue', areaGeografica: 'TODOS ERGA OMNES', derecho: '12,000%' },
    { codigo: '142-PREF', tipo: 'ue', areaGeografica: 'CL - CHILE', derecho: '0,000%' },
    { codigo: 'IVA-IVA', tipo: 'iva', areaGeografica: 'TODOS', derecho: '4,000%' }
  ]
};
const CALCULO = { customsValue: 1000, dutyRate: 12, dutyAmount: 120, adValoremDuty: 120, specificDuty: 0, vatRate: 4, vatBase: 1120, vatAmount: 44.8, totalTaxes: 164.8, totalToPay: 1164.8 };

describe('preferencia de la AEAT en la calculadora', () => {
  beforeEach(() => consultarArancelIntegrado.mockReset());

  test('lee el derecho general y la mejor preferencia del origen', async () => {
    consultarArancelIntegrado.mockResolvedValue(CEREZAS_CHILE);
    await expect(preferenciaAeatPara('0809290000', 'cl')).resolves.toEqual({ general: 12, preferencial: 0, medida: '142-PREF' });
  });

  test('sin origen, con un código incompleto o si la AEAT falla, no hay dato', async () => {
    consultarArancelIntegrado.mockRejectedValue(new Error('timeout'));
    await expect(preferenciaAeatPara('0809290000', '')).resolves.toBeNull();
    await expect(preferenciaAeatPara('080929', 'CL')).resolves.toBeNull();
    await expect(preferenciaAeatPara('0809290000', 'CL')).resolves.toBeNull();
  });

  test('con NMF elegido no cambia el cálculo (solo se informa)', () => {
    expect(aplicarPreferenciaAeat(CALCULO, { general: 12, preferencial: 0, medida: '142-PREF' }, '100')).toBe(CALCULO);
  });

  test('con una preferencia elegida aplica el 0 % y recalcula IVA y totales', () => {
    const r = aplicarPreferenciaAeat(CALCULO, { general: 12, preferencial: 0, medida: '142-PREF' }, '300');
    expect(r).toMatchObject({ dutyRate: 0, dutyAmount: 0, vatBase: 1000, vatAmount: 40, totalTaxes: 40, totalToPay: 1040 });
    expect(r.preferenceApplied.agreement).toMatch(/142-PREF/);
    expect(CALCULO.dutyAmount).toBe(120); // no muta el original
  });

  test('con derechos específicos no toca el cálculo', () => {
    const conEspecifico = { ...CALCULO, specificDuty: 50 };
    expect(aplicarPreferenciaAeat(conEspecifico, { general: 12, preferencial: 0, medida: '142-PREF' }, '300')).toBe(conEspecifico);
  });
});
