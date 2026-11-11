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
  fila('1704905100', '9.000 % + EA MAX 18.700 % +ADSZ '),
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

  test('porcentaje mas importe por unidad: se suman', () => {
    expect(interpretarDerecho('10.200 % + 93.100 EUR DTN')).toEqual({ tipo: 'suma', adValorem: 10.2, specific: { amount: 93.1, unit: 'EUR/100 kg' } });
    // Un sumando a cero no es una suma.
    expect(interpretarDerecho('6.500 % + 0.000 EUR TNE')).toEqual({ tipo: 'ad_valorem', adValorem: 6.5 });
  });

  test('porcentaje con minimo y maximo', () => {
    expect(interpretarDerecho('18.400 % MIN 22.000 EUR DTN MAX 24.000 EUR DTN')).toEqual({
      tipo: 'ad_valorem', adValorem: 18.4, minimo: { amount: 22, unit: 'EUR/100 kg' }, maximo: { amount: 24, unit: 'EUR/100 kg' }
    });
    expect(interpretarDerecho('12.800 % MIN 2.400 EUR DTN')).toEqual({ tipo: 'ad_valorem', adValorem: 12.8, minimo: { amount: 2.4, unit: 'EUR/100 kg' } });
    expect(interpretarDerecho('4.500 % MIN 0.300 EUR NAR MAX 0.800 EUR NAR')).toMatchObject({ minimo: { amount: 0.3, unit: 'EUR/p/st' }, maximo: { amount: 0.8, unit: 'EUR/p/st' } });
  });

  test('importes con coma de millares y por millar de unidades', () => {
    expect(interpretarDerecho('1,024.000 EUR TNE')).toEqual({ tipo: 'especifico', specific: { amount: 1024, unit: 'EUR/1000 kg' } });
    expect(interpretarDerecho('52.000 EUR MIL')).toEqual({ tipo: 'especifico', specific: { amount: 52, unit: 'EUR/1000 p/st' } });
  });

  test('medida condicionada al certificado Y155: la rama sin certificado es el arancel general y la otra, la sancion', () => {
    expect(interpretarDerecho('Cond:  B cert: Y-155 (01):50.000 % ; B (01):6.400 %'))
      .toEqual({ tipo: 'ad_valorem', adValorem: 6.4, sancion: { adValorem: 50, certificado: 'Y155' } });
    expect(interpretarDerecho('Cond: B cert: Y-155 (01):50.000 % ; B (01):23.000 EUR TNE'))
      .toEqual({ tipo: 'especifico', specific: { amount: 23, unit: 'EUR/1000 kg' }, sancion: { adValorem: 50, certificado: 'Y155' } });
    // Si la sancion no es un porcentaje simple, vale el arancel general y la sancion queda en el texto.
    expect(interpretarDerecho('Cond: B cert: Y-155 (01):6.500 % + 60.000 EUR TNE ; B (01):6.500 % + 0.000 EUR TNE'))
      .toEqual({ tipo: 'ad_valorem', adValorem: 6.5 });
  });

  test.each([
    ['9.000 % + EA MAX 24.200 % +ADSZ'], ['48.000 EUR ASV X'], ['0.500 EUR KGM P + 2.100 EUR DTN'], ['0.400 EUR DTN Z'],
    ['3.800 % MIN 0.600 EUR DTN G'], ['40.000 % + 121.000 EUR HLT + 20.600 EUR DTN'], ['6.200 % + 27.100 EUR DTN MAX 17.900 %'],
    ['Cond: V 62.600 EUR/DTN(01):8.800 % ; V 61.300 EUR/DTN(01):8.800 % + 1.300 EUR DTN'], ['Cond: B cert: Y-155 (01):50.000 % ; B (01):9.000 % + EA'],
    [''], [undefined]
  ])('no simplifica a una cifra lo que no sabe liquidar: %s', (texto) => {
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

  test('mixto: porcentaje mas importe por unidad', () => {
    expect(arancelDe('0811101100', derechos)).toMatchObject({ estado: 'ok', derecho: { tipo: 'suma', adValorem: 20.8, specific: { amount: 8.4, unit: 'EUR/100 kg' } } });
  });

  test('con elemento agricola: sin resolver, con el texto literal', () => {
    expect(arancelDe('1704905100', derechos)).toEqual({ estado: 'no_simple', texto: '9.000 % + EA MAX 18.700 % +ADSZ', heredadoDe: '1704905100' });
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
      codigo('1704905100', 9),                                               // oficial con elemento agricola: no comparable
      codigo('0811101100', null),                                            // sin arancel en el catalogo: no comparable
      { code: '8544420000', isLeaf: false, isActive: true, duties: { thirdCountry: 9 } },   // no declarable: fuera
      { code: '8544429099', isLeaf: true, isActive: false, duties: { thirdCountry: 9 } }    // de baja: fuera
    ], derechos);

    expect(r).toMatchObject({ comparados: 4, coinciden: 1, noComparables: 5 });
    expect(r.distintos).toEqual([
      { code: '0810100000', catalogo: 0, oficial: 11.2, heredadoDe: '0810100000', especificoCatalogo: null, fuenteCatalogo: null },
      { code: '0810201000', catalogo: 12, oficial: 8.8, heredadoDe: '0810201000', especificoCatalogo: null, fuenteCatalogo: 'carga_inicial' },
      { code: '8544429090', catalogo: 3.3, oficial: 3.3, heredadoDe: '8544429000', especificoCatalogo: 5, fuenteCatalogo: null }
    ]);
  });
});
