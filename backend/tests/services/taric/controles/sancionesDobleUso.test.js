const { regimenDeSanciones } = require('../../../../src/services/taric/controles/sanciones');
const { leerDobleUso, dobleUsoPara } = require('../../../../src/services/taric/controles/dobleUso');

describe('regímenes de sanciones por base legal', () => {
  test('reconoce los reglamentos de sanciones de la UE', () => {
    expect(regimenDeSanciones('Regulation 0833/14')).toEqual({ pais: 'Rusia', norma: 'Reglamento (UE) n.º 833/2014' });
    expect(regimenDeSanciones(' Regulation  0765/06 ').pais).toBe('Bielorrusia');
    expect(regimenDeSanciones('Regulation 1509/17').pais).toBe('Corea del Norte');
  });

  test('una medida sanitaria o comercial no es una sanción', () => {
    expect(regimenDeSanciones('Regulation 0632/21')).toBeNull();
    expect(regimenDeSanciones('Regulation 0936/15')).toBeNull();
    expect(regimenDeSanciones('')).toBeNull();
    expect(regimenDeSanciones(undefined)).toBeNull();
  });
});

describe('correlación de doble uso', () => {
  const tabla = leerDobleUso([
    ['\nCN Codes 2026', 'TARIC\nFootnote', 'Dual Use \nCodification'],
    ['2844305100', 'DU017', '0C001'],
    ['2844305100', 'DU085', '1C236'],
    ['2844305100', 'DU017', '0C001'],
    ['8401100000', 'DU583', '0A001a'],
    ['mal', 'DU000', '9X999'],
    ['8471300000', 'DU100', '']
  ]);

  test('agrupa las categorías por código, sin repetir ni admitir filas mal formadas', () => {
    expect(tabla['28443051']).toEqual([{ categoria: '0C001', nota: 'DU017' }, { categoria: '1C236', nota: 'DU085' }]);
    expect(tabla['840110']).toEqual([{ categoria: '0A001a', nota: 'DU583' }]);
    expect(Object.keys(tabla)).toHaveLength(2);
  });

  test('un código hereda las categorías de sus niveles superiores', () => {
    expect(dobleUsoPara('8401100010', tabla)).toEqual([{ categoria: '0A001a', nota: 'DU583' }]);
    expect(dobleUsoPara('2844305100', tabla).map((e) => e.categoria)).toEqual(['0C001', '1C236']);
  });

  test('un código que no figura no tiene correlación', () => {
    expect(dobleUsoPara('6302100000', tabla)).toEqual([]);
  });

  test('rechaza una tabla que no tiene el formato esperado', () => {
    expect(() => leerDobleUso([['a', 'b'], ['x', 'y']])).toThrow('formato');
    expect(() => leerDobleUso([])).toThrow('formato');
  });
});
