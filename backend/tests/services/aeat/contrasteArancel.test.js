const { porcentaje, tiposAeat, diferencias, tiposParaAplicar } = require('../../../src/services/aeat/contrasteArancel');

const medida = (codigo, derecho, extra = {}) => ({ codigo, tipo: /^IVA/.test(codigo) ? 'iva' : (/^\d/.test(codigo) ? 'ue' : 'nacional'), areaGeografica: 'TODOS ERGA OMNES', derecho, documentos: [], ...extra });
const CN = { existe: true, areaGeografica: 'CN', medidas: [medida('103-APPL', '12,000%'), medida('107-LVC', '3,000 EUR'), medida('COM-COMER'), medida('IVA-IVA', '21,000%')] };
const VN = { ...CN, areaGeografica: 'VN', medidas: [...CN.medidas, medida('142-PREF', '0%', { areaGeografica: 'VN Vietnam' })] };

describe('porcentaje', () => {
  test.each([['12,000%', 12], ['0%', 0], ['4,5 %', 4.5], ['3,000 EUR', null], [undefined, null]])('%s -> %s', (entrada, salida) => {
    expect(porcentaje(entrada)).toBe(salida);
  });
});

describe('tiposAeat', () => {
  test('general, IVA y sin preferencias para China', () => {
    expect(tiposAeat(CN)).toEqual({ general: 12, preferencias: [], iva: 21 });
  });
  test('preferencia solo si su área es el origen consultado', () => {
    expect(tiposAeat(VN).preferencias).toEqual([{ codigo: '142-PREF', tipo: 0 }]);
    expect(tiposAeat({ ...VN, areaGeografica: 'CN' }).preferencias).toEqual([]);
  });
});

describe('diferencias', () => {
  test('arancel e IVA distintos', () => {
    expect(diferencias({ dutyRate: 8, vatRate: 10 }, CN)).toEqual([
      { campo: 'arancel', expediente: 8, aeat: 12 },
      { campo: 'iva', expediente: 10, aeat: 21 }
    ]);
  });
  test('coinciden: sin diferencias', () => {
    expect(diferencias({ dutyRate: 12, vatRate: 21 }, CN)).toEqual([]);
  });
  test('una preferencia del origen no es diferencia', () => {
    expect(diferencias({ dutyRate: 0, vatRate: 21 }, VN)).toEqual([]);
  });
  test('sin tipos en la partida o código inexistente no se compara', () => {
    expect(diferencias({}, CN)).toEqual([]);
    expect(diferencias({ dutyRate: 5 }, { existe: false, medidas: [] })).toEqual([]);
  });
});

describe('tiposParaAplicar', () => {
  test('por defecto el general y el IVA', () => {
    expect(tiposParaAplicar(CN)).toEqual({ dutyRate: 12, vatRate: 21, medidaArancel: '103-APPL' });
  });
  test('una preferencia elegida del origen', () => {
    expect(tiposParaAplicar(VN, '142-PREF')).toEqual({ dutyRate: 0, vatRate: 21, medidaArancel: '142-PREF' });
  });
  test('una preferencia que no es del origen se rechaza', () => {
    expect(() => tiposParaAplicar(CN, '142-PREF')).toThrow(expect.objectContaining({ codigo: 'PREFERENCIA_NO_VALIDA' }));
  });
  test('sin derecho general en porcentaje no se aplica nada', () => {
    expect(() => tiposParaAplicar({ existe: true, areaGeografica: 'CN', medidas: [medida('IVA-IVA', '21%')] }))
      .toThrow(expect.objectContaining({ codigo: 'SIN_ARANCEL' }));
  });
});
