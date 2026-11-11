/**
 * Arancel de terceros paises oficial (fichero «Duties Import 01-99.xlsx» de la
 * Comision). Las filas de ejemplo son reales, de la extraccion de noviembre de 2026.
 */
const {
  interpretarDerecho, leerDerechosTercerosPaises, arancelDe, compararAranceles
} = require('../../../src/services/taric/arancelesOficiales');

const CAB = ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'RED_IND', 'Origin', 'Measure type', 'Legal base', 'Duty', 'Origin code', 'Meas. type code'];
const fila = (codigo, derecho, extra = {}) => [
  codigo, extra.add || '', '', extra.desde || '01-01-2012', extra.hasta || '', '', extra.origen === 'RU' ? 'Russia' : 'ERGA OMNES',
  extra.tipo ? 'Tariff preference' : 'Third country duty', 'Regulation 2658/87', derecho, extra.origen || '1011', extra.tipo || '103'
];
const FECHA = new Date('2026-11-11T12:00:00Z');
const FILAS = [
  CAB,
  fila('0810201000', '8.800 % '),
  fila('0207412000', '38.000 EUR DTN '),
  fila('0811101100', '20.800 % + 8.400 EUR DTN '),
  fila('0810100000', '11.200 % ', { desde: '01-08-2026', hasta: '31-12-2026' }),
  fila('0810100000', '12.800 % MIN 2.400 EUR DTN ', { desde: '01-05-2027', hasta: '31-07-2027' }),
  fila('2918220000', '0.000 % ', { add: '2500' }),
  fila('2918220000', '6.500 % ', { add: '2501' }),
  fila('8544429000', '3.300 % '),
  fila('8544429000', '50.000 % ', { origen: 'RU' }),                 // sancion: no es el arancel general
  fila('8544429000', '0.000 % ', { tipo: '142', origen: 'GB' }),     // preferencia: tampoco
  fila('2204210000', '13.100 EUR HLT ')
];

describe('interpretarDerecho', () => {
  test('porcentaje simple', () => {
    expect(interpretarDerecho('8.800 % ')).toEqual({ tipo: 'ad_valorem', adValorem: 8.8 });
    expect(interpretarDerecho('0.000 %')).toEqual({ tipo: 'ad_valorem', adValorem: 0 });
  });

  test('importe por unidad, con la unidad como la guarda el catalogo', () => {
    expect(interpretarDerecho('38.000 EUR DTN ')).toEqual({ tipo: 'especifico', specific: { amount: 38, unit: 'EUR/100 kg' } });
    expect(interpretarDerecho('13.100 EUR HLT')).toEqual({ tipo: 'especifico', specific: { amount: 13.1, unit: 'EUR/hl' } });
    expect(interpretarDerecho('102.000 EUR TNE')).toEqual({ tipo: 'especifico', specific: { amount: 102, unit: 'EUR/1000 kg' } });
  });

  test.each([
    ['20.800 % + 8.400 EUR DTN'], ['12.800 % MIN 2.400 EUR DTN'], ['9.000 % + EA MAX 24.200 % +ADSZ'],
    ['Cond:  B cert: Y-155 (01):50.000 % ; B (01):6.400 %'], ['48.000 EUR ASV X'], ['0.500 EUR KGM P + 2.100 EUR DTN'], [''], [undefined]
  ])('no simplifica a una cifra lo que no es simple: %s', (texto) => {
    expect(interpretarDerecho(texto)).toBeNull();
  });
});

describe('leerDerechosTercerosPaises', () => {
  test('solo la medida 103 ERGA OMNES vigente en la fecha', () => {
    const derechos = leerDerechosTercerosPaises(FILAS, { fecha: FECHA });

    expect(derechos.get('8544429000')).toEqual([{ codigoAdicional: '', texto: '3.300 %' }]);
    // De temporada: en noviembre de 2026 solo vale el 11,2 %.
    expect(derechos.get('0810100000')).toEqual([{ codigoAdicional: '', texto: '11.200 %' }]);
    expect(derechos.get('2918220000')).toHaveLength(2);
  });

  test('en otra fecha manda el derecho de esa temporada', () => {
    const derechos = leerDerechosTercerosPaises(FILAS, { fecha: new Date('2027-06-01T12:00:00Z') });
    expect(derechos.get('0810100000')).toEqual([{ codigoAdicional: '', texto: '12.800 % MIN 2.400 EUR DTN' }]);
  });

  test('formato cambiado o fichero sin derechos: error claro', () => {
    expect(() => leerDerechosTercerosPaises([['Goods code', 'Duty']])).toThrow('el formato del fichero oficial ha cambiado (se esperaba la columna «Add code»)');
    expect(() => leerDerechosTercerosPaises([CAB, fila('8544429000', '0.000 % ', { tipo: '142' })])).toThrow('no trae ningun derecho de terceros paises vigente');
  });
});

describe('arancelDe', () => {
  const derechos = leerDerechosTercerosPaises(FILAS, { fecha: FECHA });

  test('arancel propio', () => {
    expect(arancelDe('0810201000', derechos)).toEqual({ estado: 'ok', derecho: { tipo: 'ad_valorem', adValorem: 8.8 }, texto: '8.800 %', heredadoDe: '0810201000' });
  });

  test('heredado del codigo de 8 digitos del que cuelga', () => {
    expect(arancelDe('8544429010', derechos)).toMatchObject({ estado: 'ok', derecho: { adValorem: 3.3 }, heredadoDe: '8544429000' });
    expect(arancelDe('0207412010', derechos)).toMatchObject({ estado: 'ok', derecho: { tipo: 'especifico', specific: { amount: 38, unit: 'EUR/100 kg' } }, heredadoDe: '0207412000' });
  });

  test('heredado de mas arriba (6 digitos)', () => {
    expect(arancelDe('2204210610', derechos)).toMatchObject({ estado: 'ok', heredadoDe: '2204210000' });
  });

  test('mixto: sin resolver, con el texto literal', () => {
    expect(arancelDe('0811101100', derechos)).toEqual({ estado: 'no_simple', texto: '20.800 % + 8.400 EUR DTN', heredadoDe: '0811101100' });
  });

  test('varios tipos por codigo adicional: no hay «el» arancel', () => {
    expect(arancelDe('2918220020', derechos)).toEqual({ estado: 'variantes', texto: '0.000 % | 6.500 %', heredadoDe: '2918220000' });
  });

  test('sin medida en ningun nivel', () => {
    expect(arancelDe('9880000000', derechos)).toEqual({ estado: 'sin_medida' });
  });
});

describe('compararAranceles', () => {
  const derechos = leerDerechosTercerosPaises(FILAS, { fecha: FECHA });
  const codigo = (code, thirdCountry, extra = {}) => ({ code, isLeaf: true, isActive: true, duties: { thirdCountry, ...extra } });

  test('lista los que no coinciden y no cuenta los que no se pueden comparar', () => {
    const r = compararAranceles([
      codigo('8544429010', 3.3),                                             // coincide (heredado)
      codigo('0810201000', 12, { origen: { fuente: 'carga_inicial' } }),     // distinto
      codigo('0810100000', 0),                                               // distinto: 0 % frente a 11,2 %
      codigo('8544429090', 3.3, { specific: { amount: 5, unit: 'EUR/hl' } }),// el catalogo añade un especifico que el oficial no tiene
      codigo('0207412010', 0),                                               // oficial especifico: no comparable
      codigo('2918220020', 6.5),                                             // variantes: no comparable
      codigo('9880000000', 0),                                               // sin medida: no comparable
      codigo('0811101100', null),                                            // sin arancel en el catalogo: no comparable
      { code: '8544420000', isLeaf: false, isActive: true, duties: { thirdCountry: 9 } },   // no declarable: fuera
      { code: '8544429099', isLeaf: true, isActive: false, duties: { thirdCountry: 9 } }    // de baja: fuera
    ], derechos);

    expect(r).toMatchObject({ comparados: 4, coinciden: 1, noComparables: 4 });
    expect(r.distintos).toEqual([
      { code: '0810100000', catalogo: 0, oficial: 11.2, heredadoDe: '0810100000', especificoCatalogo: null, fuenteCatalogo: null },
      { code: '0810201000', catalogo: 12, oficial: 8.8, heredadoDe: '0810201000', especificoCatalogo: null, fuenteCatalogo: 'carga_inicial' },
      { code: '8544429090', catalogo: 3.3, oficial: 3.3, heredadoDe: '8544429000', especificoCatalogo: 5, fuenteCatalogo: null }
    ]);
  });
});
