/**
 * Correccion de lo que el catalogo ya tiene, contra la fuente oficial.
 * Medicion real del 11/Nov/2026: 15.061 descripciones en español no eran las
 * oficiales y los derechos especificos tenian la unidad mal guardada.
 */
const { corregirDescripciones, corregirAranceles, huella } = require('../../../src/services/taric/correccionesCatalogo');
const { leerDerechosTercerosPaises } = require('../../../src/services/taric/arancelesOficiales');

const linea = (descripcion) => ({ descripcion });
const OFICIAL = {
  es: new Map([['9506112100', linea('Monoesquís y "snowboard" (tabla para nieve)')], ['8703230000', linea('De cilindrada superior a 1 500 cm³ pero inferior o igual a 3 000 cm³')], ['8544429090', linea('Los demás')]]),
  en: new Map([['9506112100', linea('Monoskis and snowboards')], ['8703230000', linea('Of a cylinder capacity exceeding 1 500 cm³')], ['8544429090', linea('Other')], ['0207412010', linea('Of Pekin Duck')]]),
  rutas: new Map([['8544429090', ['MATERIAL ELÉCTRICO', 'Hilos, cables y demás conductores', 'Provistos de piezas de conexión', 'Los demás']]])
};

describe('corregirDescripciones', () => {
  test('sustituye la descripcion que no es la oficial y guarda la anterior', () => {
    const cambios = corregirDescripciones([{ code: '9506112100', description: { es: 'Esquís alpinos', en: 'Monoskis and snowboards' } }], OFICIAL);

    expect(cambios).toEqual([{ code: '9506112100', es: 'Monoesquís y "snowboard" (tabla para nieve)', antes: 'Esquís alpinos' }]);
  });

  test('una diferencia solo de formato (espacios, HTML, mayusculas, signos) no es un cambio', () => {
    const cambios = corregirDescripciones([
      { code: '8703230000', description: { es: 'de cilindrada superior a 1.500 cm3 pero inferior o igual a 3.000 cm3', en: 'Of a cylinder capacity exceeding 1&nbsp;500 cm<sup>3</sup>' } }
    ], OFICIAL);

    expect(cambios).toEqual([]);
  });

  test('añade la ruta y saca las palabras de busqueda de toda ella', () => {
    const [cambio] = corregirDescripciones([{ code: '8544429090', description: { es: 'Los demás', en: 'Other' } }], OFICIAL);

    expect(cambio).toEqual({
      code: '8544429090',
      legalDescription: 'MATERIAL ELÉCTRICO > Hilos, cables y demás conductores > Provistos de piezas de conexión > Los demás',
      keywords: ['demás', 'provistos', 'piezas', 'conexión', 'hilos', 'cables', 'conductores', 'material', 'eléctrico']
    });
  });

  test('con la ruta ya guardada no vuelve a proponerla', () => {
    const guardada = 'MATERIAL ELÉCTRICO > Hilos, cables y demás conductores > Provistos de piezas de conexión > Los demás';
    expect(corregirDescripciones([{ code: '8544429090', description: { es: 'Los demás', en: 'Other' }, legalDescription: guardada }], OFICIAL)).toEqual([]);
  });

  test('si la fuente no trae el español de un codigo, su español no se toca', () => {
    const cambios = corregirDescripciones([{ code: '0207412010', description: { es: 'De pato de Pekin', en: 'Pekin duck' } }], OFICIAL);

    expect(cambios).toEqual([{ code: '0207412010', en: 'Of Pekin Duck' }]);
  });

  test('un codigo que no esta en la fuente no aparece', () => {
    expect(corregirDescripciones([{ code: '9999999999', description: { es: 'x' } }], OFICIAL)).toEqual([]);
  });

  test('huella iguala lo que solo difiere en formato', () => {
    expect(huella('Fe₂O₃ <br> 70 %')).toBe(huella('fe₂o₃ 70%'));
    expect(huella(undefined)).toBe('');
  });
});

describe('corregirAranceles', () => {
  const CAB = ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'RED_IND', 'Origin', 'Measure type', 'Legal base', 'Duty', 'Origin code', 'Meas. type code'];
  const fila = (codigo, derecho, add = '') => [codigo, add, '', '01-01-2012', '', '', 'ERGA OMNES', 'Third country duty', '', derecho, '1011', '103'];
  const derechos = leerDerechosTercerosPaises([
    CAB, fila('8544429000', '3.300 % '), fila('0104103000', '80.500 EUR DTN '), fila('2204210000', '32.000 EUR HLT '),
    fila('0811101100', '20.800 % + 8.400 EUR DTN '), fila('2918220000', '0.000 % ', '2500'), fila('2918220000', '6.500 % ', '2501'),
    fila('2401103500', '18.400 % MIN 22.000 EUR DTN MAX 24.000 EUR DTN '), fila('1704905100', '9.000 % + EA MAX 18.700 % +ADSZ '),
    fila('2309903100', 'Cond: B cert: Y-155 (01):50.000 % ; B (01):23.000 EUR TNE '), fila('2303101100', '320.000 EUR TNE '), fila('0207412000', '38.000 EUR DTN '),
    fila('1704101000', '6.200 % + 27.100 EUR DTN MAX 17.900 % '), fila('2204219551', '1.750 EUR ASV X '),
    fila('1002000000', 'Cond:  B cert: Y-155 (01):93.000 EUR TNE ; B (01):0.000 EUR TNE ', '2550'),
    fila('1002000000', 'Cond:  B cert: Y-155 (01):93.000 EUR TNE ; B (01):0.000 EUR TNE ', '2551'),
    fila('1002000000', 'Cond:  B cert: Y-155 (01):93.000 EUR TNE ; B (01):0.000 EUR TNE ', '2552')
  ], { fecha: new Date('2026-11-11T12:00:00Z') });
  const codigosAdicionales = new Map([['2500', 'Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas)'], ['2501', 'Las demás']]);
  const codigo = (code, duties, extra = {}) => ({ code, isLeaf: true, isActive: true, duties, ...extra });

  test('corrige el porcentaje equivocado y quita un especifico que el oficial no tiene', () => {
    const r = corregirAranceles([codigo('8544429010', { thirdCountry: 5, specific: { amount: 7, unit: 'EUR/hl' } })], derechos);

    expect(r.corregir).toEqual([{
      code: '8544429010', thirdCountry: 3.3, specific: null, combinacion: null, minimo: null, maximo: null, sancion: null,
      texto: '3.300 %', heredadoDe: '8544429000', rotulo: 'Third country duty',
      antes: { thirdCountry: 5, specific: { amount: 7, unit: 'EUR/hl' }, combinacion: null, minimo: null, maximo: null, sancion: null }
    }]);
  });

  test('corrige la unidad mal guardada de un derecho especifico (el importe era correcto)', () => {
    const r = corregirAranceles([codigo('0104103000', { thirdCountry: 0, specific: { amount: 80.5, unit: '100' } })], derechos);

    expect(r.corregir).toEqual([expect.objectContaining({ code: '0104103000', thirdCountry: 0, specific: { amount: 80.5, unit: 'EUR/100 kg' } })]);
  });

  test('la misma unidad escrita de otra forma no es una diferencia', () => {
    const r = corregirAranceles([codigo('2204210610', { thirdCountry: 0, specific: { amount: 32, unit: 'EUR / HL' } })], derechos);

    expect(r.corregir).toEqual([]);
    expect(r.contrastar).toEqual([expect.objectContaining({ code: '2204210610' })]);
  });

  test('el que coincide pasa a contrastado; si ya lo estaba, no se toca', () => {
    const r = corregirAranceles([
      codigo('8544429010', { thirdCountry: 3.3 }),
      codigo('8544429090', { thirdCountry: 3.3, origen: { fuente: 'taric_oficial' } })
    ], derechos);

    expect(r.contrastar.map((d) => d.code)).toEqual(['8544429010']);
    expect(r.corregir).toEqual([]);
    expect(r.conflictos).toEqual([]);
  });

  test('un arancel contrastado antes a mano que no coincide es un conflicto: no se corrige', () => {
    const r = corregirAranceles([codigo('8544429010', { thirdCountry: 4, origen: { fuente: 'taric_oficial' } })], derechos);

    expect(r.corregir).toEqual([]);
    expect(r.conflictos).toEqual([expect.objectContaining({ code: '8544429010', thirdCountry: 3.3 })]);
  });

  test('un codigo sin arancel en el catalogo recibe el oficial', () => {
    const r = corregirAranceles([codigo('8544429010', { thirdCountry: null, origen: { fuente: 'pendiente' } }), codigo('8544429020', undefined)], derechos);

    expect(r.corregir.map((d) => [d.code, d.thirdCountry, d.antes.thirdCountry])).toEqual([['8544429010', 3.3, null], ['8544429020', 3.3, null]]);
  });

  test('mixto: guarda el porcentaje, el importe por unidad y que se suman, y arregla la unidad rota', () => {
    const r = corregirAranceles([codigo('0811101100', { thirdCountry: 20.8, specific: { amount: 8.4, unit: '100' } })], derechos);

    expect(r.corregir).toEqual([expect.objectContaining({
      code: '0811101100', thirdCountry: 20.8, specific: { amount: 8.4, unit: 'EUR/100 kg' }, combinacion: 'suma'
    })]);
    // Ya corregido, no vuelve a salir.
    const otra = corregirAranceles([codigo('0811101100', { thirdCountry: 20.8, specific: { amount: 8.4, unit: 'EUR/100 kg' }, combinacion: 'suma', origen: { fuente: 'taric_oficial' } })], derechos);
    expect(otra).toMatchObject({ corregir: [], contrastar: [], conflictos: [], unidades: [] });
  });

  test('minimo y maximo: el importe que se guardaba como «especifico» pasa a ser el minimo', () => {
    const r = corregirAranceles([codigo('2401103510', { thirdCountry: 18.4, specific: { amount: 22, unit: '100' } })], derechos);

    expect(r.corregir).toEqual([expect.objectContaining({
      code: '2401103510', thirdCountry: 18.4, specific: null,
      minimo: { amount: 22, unit: 'EUR/100 kg' }, maximo: { amount: 24, unit: 'EUR/100 kg' }
    })]);
  });

  test('medida condicionada al Y155: arancel general y sancion', () => {
    const r = corregirAranceles([codigo('2309903112', { thirdCountry: 0, specific: { amount: 17.25, unit: 'tonne' } })], derechos);

    expect(r.corregir).toEqual([expect.objectContaining({
      code: '2309903112', thirdCountry: 0, specific: { amount: 23, unit: 'EUR/1000 kg' }, sancion: { adValorem: 50, certificado: 'Y155' }
    })]);
    // Con la sancion ya guardada coincide.
    const otra = corregirAranceles([codigo('2309903112', {
      thirdCountry: 0, specific: { amount: 23, unit: 'EUR/1000 kg' }, sancionRusiaBielorrusia: { adValorem: 50, certificado: 'Y155' }, origen: { fuente: 'taric_oficial' }
    })], derechos);
    expect(otra.conflictos).toEqual([]);
  });

  test('un arancel contrastado a mano con la misma cifra y la unidad escrita de otra forma: solo se unifica la unidad', () => {
    const r = corregirAranceles([codigo('2303101110', { thirdCountry: 0, specific: { amount: 320, unit: 'EUR/tonne' }, origen: { fuente: 'taric_oficial' } })], derechos);

    expect(r.conflictos).toEqual([]);
    expect(r.corregir).toEqual([]);
    expect(r.unidades).toEqual([{ code: '2303101110', unidades: [{ campo: 'specific', unit: 'EUR/1000 kg' }] }]);
  });

  test('un codigo que no se declara se revisa si la fuente le da su propia medida', () => {
    const r = corregirAranceles([
      codigo('0207412000', { thirdCountry: 0, specific: { amount: 38, unit: '100' } }, { isLeaf: false }),   // medida propia
      codigo('8544420000', { thirdCountry: 1 }, { isLeaf: false })                                         // la hereda: no se toca
    ], derechos);

    expect(r.corregir.map((d) => d.code)).toEqual(['0207412000']);
  });

  test('derecho que LUCI no sabe liquidar: se deja el dato y se anota el texto oficial y el dato que falta, una sola vez', () => {
    const r = corregirAranceles([
      codigo('1704905100', { thirdCountry: 9, specific: { amount: 35.15, unit: '100' } }),   // elemento agricola
      codigo('2204219551', { thirdCountry: 0 })                                               // grado alcoholico
    ], derechos);

    expect(r.corregir).toEqual([]);
    expect(r.noCalculables).toEqual([
      expect.objectContaining({ code: '1704905100', motivo: 'no_simple', forma: 'elemento_agricola', evidencia: expect.stringContaining('«9.000 % + EA MAX 18.700 % +ADSZ»') }),
      expect.objectContaining({ code: '2204219551', motivo: 'no_simple', forma: 'grado_alcoholico', faltan: [expect.stringMatching(/grado alcoholico/)] })
    ]);
    expect(r.noCalculables[1].evidencia).toMatch(/Para liquidarlo hace falta el grado alcoholico/);

    const yaAnotado = corregirAranceles([codigo('1704905100', { thirdCountry: 9, origen: { fuente: 'no_calculable', evidencia: r.noCalculables[0].evidencia } })], derechos);
    expect(yaAnotado.noCalculables).toEqual([]);
    // Uno contrastado antes a mano no se toca.
    expect(corregirAranceles([codigo('1704905100', { thirdCountry: 9, origen: { fuente: 'taric_oficial' } })], derechos).noCalculables).toEqual([]);
  });

  test('varios tipos por codigo adicional: se guardan las variantes con su descripcion oficial, una sola vez', () => {
    const r = corregirAranceles([codigo('2918220020', { thirdCountry: 1, origen: { fuente: 'no_calculable' } })], derechos, { codigosAdicionales });

    expect(r.noCalculables).toEqual([]);
    expect(r.variantes).toEqual([{
      code: '2918220020', texto: '0.000 % | 6.500 %', heredadoDe: '2918220000',
      variantes: [
        { codigoAdicional: '2500', descripcion: 'Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas)', texto: '0.000 %', thirdCountry: 0 },
        { codigoAdicional: '2501', descripcion: 'Las demás', texto: '6.500 %', thirdCountry: 6.5 }
      ],
      antes: expect.objectContaining({ thirdCountry: 1 })
    }]);

    const guardado = { thirdCountry: null, variantes: r.variantes[0].variantes, origen: { fuente: 'taric_oficial' } };
    expect(corregirAranceles([codigo('2918220020', guardado)], derechos, { codigosAdicionales })).toMatchObject({ variantes: [], conflictos: [], noCalculables: [] });
    // Contrastado a mano con un solo tipo: no se pisa, se lista.
    const aMano = corregirAranceles([codigo('2918220020', { thirdCountry: 6.5, origen: { fuente: 'taric_oficial' } })], derechos, { codigosAdicionales });
    expect(aMano.variantes).toEqual([]);
    expect(aMano.conflictos).toEqual([expect.objectContaining({ code: '2918220020', variantes: expect.any(Array) })]);
  });

  test('sin el fichero de codigos adicionales las variantes se guardan sin descripcion', () => {
    const r = corregirAranceles([codigo('2918220020', { thirdCountry: 1 })], derechos);
    expect(r.variantes[0].variantes.map((v) => v.descripcion)).toEqual([null, null]);
  });

  test('suma con maximo en porcentaje: se guarda la formula oficial, una sola vez', () => {
    const r = corregirAranceles([codigo('1704101000', { thirdCountry: 6.2, specific: { amount: 27.1, unit: '100' }, origen: { fuente: 'no_calculable' } })], derechos);

    expect(r.noCalculables).toEqual([]);
    expect(r.compuestos).toEqual([{
      code: '1704101000', texto: '6.200 % + 27.100 EUR DTN MAX 17.900 %', heredadoDe: '1704101000',
      thirdCountry: 6.2, specific: { amount: 27.1, unit: 'EUR/100 kg' }, combinacion: 'suma',
      formula: { texto: '6.200 % + 27.100 EUR DTN MAX 17.900 %', sumandos: [{ adValorem: 6.2 }, { amount: 27.1, unit: 'EUR/100 kg' }], minimo: [], maximo: [{ adValorem: 17.9 }] },
      antes: expect.objectContaining({ thirdCountry: 6.2 })
    }]);

    const guardado = { thirdCountry: 6.2, formula: r.compuestos[0].formula, origen: { fuente: 'taric_oficial' } };
    expect(corregirAranceles([codigo('1704101000', guardado)], derechos)).toMatchObject({ compuestos: [], conflictos: [], noCalculables: [] });
  });

  test('el mismo derecho en todos los codigos adicionales se corrige como un derecho simple (cereales)', () => {
    const r = corregirAranceles([codigo('1002000000', { thirdCountry: 0, origen: { fuente: 'no_calculable' } })], derechos);
    // 0 EUR/t es el 0 % que ya tenia: pasa a constar como contrastado contra el TARIC.
    expect(r.contrastar).toEqual([expect.objectContaining({ code: '1002000000', thirdCountry: 0, specific: { amount: 0, unit: 'EUR/1000 kg' } })]);
    expect(r.noCalculables).toEqual([]);
  });

  test('un derecho simple con variantes o formula de una carga anterior se corrige para borrarlas', () => {
    const r = corregirAranceles([codigo('8544429010', { thirdCountry: 3.3, variantes: [{ codigoAdicional: '2500', texto: '0.000 %', thirdCountry: 0 }] })], derechos);
    expect(r.corregir.map((d) => d.code)).toEqual(['8544429010']);
  });

  test('capitulos 98 y 99 sin medida: constan como codigos sin derecho oficial; el resto sin medida no se toca', () => {
    const r = corregirAranceles([
      codigo('9880010000', { thirdCountry: null, origen: { fuente: 'pendiente' } }),
      codigo('9930240000', { thirdCountry: null, origen: { fuente: 'sin_derecho_oficial' } }),   // ya anotado
      codigo('3912398570', { thirdCountry: null, origen: { fuente: 'pendiente' } })
    ], derechos);

    expect(r.sinDerecho).toEqual([{ code: '9880010000' }]);
    expect(r).toMatchObject({ corregir: [], contrastar: [], conflictos: [], noCalculables: [] });
  });

  test('no actua sobre codigos de baja', () => {
    const r = corregirAranceles([codigo('8544429099', { thirdCountry: 1 }, { isActive: false })], derechos);
    expect(r).toEqual({ corregir: [], contrastar: [], conflictos: [], unidades: [], noCalculables: [], sinDerecho: [], variantes: [], compuestos: [] });
  });
});
