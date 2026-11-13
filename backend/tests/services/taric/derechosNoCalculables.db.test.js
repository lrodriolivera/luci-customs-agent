/**
 * Codigos que el catalogo tenia como «no calculables» (552 en produccion el
 * 13/Nov/2026): variantes por codigo adicional, sumas con minimo o maximo y
 * derechos que exigen datos que LUCI no tiene. Textos reales del «Duties
 * Import 01-99.xlsx» de noviembre de 2026. Mongo en memoria.
 */
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { leerDerechosTercerosPaises } = require('../../../src/services/taric/arancelesOficiales');
const { corregirAranceles } = require('../../../src/services/taric/correccionesCatalogo');
const { aplicarSincronizacion, derechosDeAlta } = require('../../../src/services/taric/sincronizacionTaric');
const { planResolucion, aplicarResolucion } = require('../../../src/services/taric/resolucionNoCalculables');
const TaricCode = require('../../../src/models/TaricCode');
const servicio = require('../../../src/services/dutyCalculationService');

usarBaseDeDatosEnMemoria();

const CAB = ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'RED_IND', 'Origin', 'Measure type', 'Legal base', 'Duty', 'Origin code', 'Meas. type code'];
const fila = (codigo, derecho, add = '') => [codigo, add, '', '15-05-2015', '', '', 'ERGA OMNES', 'Third country duty', 'Regulation 3115/94', derecho, '1011', '103'];
const DERECHOS = leerDerechosTercerosPaises([
  CAB,
  fila('2818300090', '0.000 % ', '2500'), fila('2818300090', '5.500 % ', '2501'),
  fila('1704101000', '6.200 % + 27.100 EUR DTN MAX 17.900 % '),
  fila('9111000000', '0.500 EUR NAR MIN 2.700 % MAX 4.600 % '),
  fila('0402109100', '1.190 EUR KGM P + 27.500 EUR DTN '),
  fila('2204219551', '1.750 EUR ASV X '),
  fila('8544429000', '3.300 % ')
], { fecha: new Date('2026-11-13T12:00:00Z') });
const CODIGOS_ADICIONALES = new Map([
  ['2500', 'Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas), Anexos Arancelario 3 a 6 - R 2025/1926'],
  ['2501', 'Las demás']
]);
const AHORA = new Date('2026-11-13T12:00:00Z');
const FUENTE = 'Comision Europea - TARIC (CIRCABC), 2026-11';

// Como estan en produccion (volcado del 13/Nov/2026).
const noCalculable = (code, duties, extra = {}) => ({
  code, breakdown: { chapter: code.slice(0, 2) }, description: { es: 'Los demás' }, level: 10, isLeaf: true, isActive: true,
  duties: { ...duties, origen: { fuente: 'no_calculable', metodo: 'fichero_circabc', evidencia: 'Derecho oficial «…»: derecho con elemento agricola, grado alcoholico, precio de entrada o varios sumandos. LUCI no lo liquida automaticamente.' } },
  ...extra
});
const PRODUCCION = [
  noCalculable('2818300090', { thirdCountry: 0 }),
  noCalculable('1704101000', { thirdCountry: 6.2, specific: { amount: 27.1, unit: '100' } }),
  noCalculable('9111100000', { thirdCountry: 2.7, specific: { amount: 0.5, unit: 'p/st' } }),
  noCalculable('0402109100', { thirdCountry: 0, specific: { amount: 1.19, unit: 'kg/lactic' } }),
  noCalculable('2204219551', { thirdCountry: 0 })
];
const sembrar = () => TaricCode.collection.insertMany(PRODUCCION.map((d) => ({ ...d })));
const PROYECCION = { _id: 0, code: 1, isLeaf: 1, isActive: 1, duties: 1 };
const leer = (code) => TaricCode.findOne({ code }).lean();

describe('aplicarSincronizacion con variantes, formulas y no calculables', () => {
  test('escribe cada grupo con su texto oficial y es repetible sin efectos', async () => {
    await sembrar();
    const catalogo = await TaricCode.find({}, PROYECCION).lean();
    const aranceles = corregirAranceles(catalogo, DERECHOS, { codigosAdicionales: CODIGOS_ADICIONALES });
    const plan = { fuente: { nombre: 'Comision Europea - TARIC (CIRCABC)', mes: '2026-11' }, altas: [], bajas: [], reactivar: [], declarable: [], nivel: [], correcciones: { descripciones: [], aranceles } };

    const hecho = await aplicarSincronizacion(plan, { TaricCode, ahora: AHORA });

    expect(hecho.correcciones).toMatchObject({ variantes: 1, compuestos: 2, noCalculables: 2 });
    const farmacia = await leer('2818300090');
    expect(farmacia.duties.thirdCountry).toBeNull();
    expect(farmacia.duties.variantes).toEqual([
      { codigoAdicional: '2500', descripcion: CODIGOS_ADICIONALES.get('2500'), texto: '0.000 %', thirdCountry: 0 },
      { codigoAdicional: '2501', descripcion: 'Las demás', texto: '5.500 %', thirdCountry: 5.5 }
    ]);
    expect(farmacia.duties.origen).toMatchObject({ fuente: 'taric_oficial', forma: 'variantes_codigo_adicional', metodo: 'fichero_circabc' });
    expect(farmacia.duties.origen.evidencia).toContain('«0.000 % | 5.500 %»');

    const chicle = await leer('1704101000');
    expect(chicle.duties).toMatchObject({
      thirdCountry: 6.2, specific: { amount: 27.1, unit: 'EUR/100 kg' }, combinacion: 'suma',
      formula: { texto: '6.200 % + 27.100 EUR DTN MAX 17.900 %', maximo: [{ adValorem: 17.9 }] },
      origen: { fuente: 'taric_oficial', forma: 'compuesto' }
    });
    const reloj = await leer('9111100000');
    expect(reloj.duties.formula.minimo).toEqual([{ adValorem: 2.7 }]);
    expect(reloj.duties.specific).toEqual({ amount: 0.5, unit: 'EUR/p/st' });

    const leche = await leer('0402109100');
    expect(leche.duties.origen).toMatchObject({ fuente: 'no_calculable', forma: 'materia_lactea' });
    expect(leche.duties.origen.evidencia).toMatch(/materia lactea/);
    // El dato antiguo no se borra.
    expect(leche.duties.specific).toEqual({ amount: 1.19, unit: 'kg/lactic' });

    // Segunda pasada: nada que hacer.
    const otra = corregirAranceles(await TaricCode.find({}, PROYECCION).lean(), DERECHOS, { codigosAdicionales: CODIGOS_ADICIONALES });
    expect(otra).toMatchObject({ corregir: [], contrastar: [], conflictos: [], variantes: [], compuestos: [], noCalculables: [] });
  });

  test('un derecho simple borra variantes y formula de una carga anterior', async () => {
    await TaricCode.collection.insertOne(noCalculable('8544429010', { thirdCountry: 3.3, variantes: [{ codigoAdicional: '2500', texto: '0.000 %', thirdCountry: 0 }], formula: { texto: 'x', sumandos: [] } }));
    const aranceles = corregirAranceles(await TaricCode.find({}, PROYECCION).lean(), DERECHOS);
    await aplicarSincronizacion({ fuente: { nombre: 'X', mes: '2026-11' }, altas: [], bajas: [], reactivar: [], declarable: [], nivel: [], correcciones: { descripciones: [], aranceles } }, { TaricCode, ahora: AHORA });

    const cable = await leer('8544429010');
    expect(cable.duties.variantes).toBeUndefined();
    expect(cable.duties.formula).toBeUndefined();
    expect(cable.duties.origen.fuente).toBe('taric_oficial');
  });

  test('un alta con variantes o con formula entra ya calculable', () => {
    const variantes = derechosDeAlta({ code: '2818300090', arancel: { estado: 'variantes', texto: '0.000 % | 5.500 %', heredadoDe: '2818300090', variantes: [{ codigoAdicional: '2500', texto: '0.000 %' }, { codigoAdicional: '2501', texto: '5.500 %' }] } }, { ahora: AHORA, fuente: FUENTE, codigosAdicionales: CODIGOS_ADICIONALES });
    expect(variantes).toMatchObject({ thirdCountry: null, variantes: [{ codigoAdicional: '2500', descripcion: expect.stringContaining('farmac') }, { codigoAdicional: '2501', thirdCountry: 5.5 }], origen: { fuente: 'taric_oficial', forma: 'variantes_codigo_adicional' } });

    const formula = derechosDeAlta({ code: '1704101000', arancel: { estado: 'no_simple', texto: '6.200 % + 27.100 EUR DTN MAX 17.900 %', heredadoDe: '1704101000' } }, { ahora: AHORA, fuente: FUENTE });
    expect(formula).toMatchObject({ thirdCountry: 6.2, formula: { maximo: [{ adValorem: 17.9 }] }, origen: { fuente: 'taric_oficial', forma: 'compuesto' } });
  });
});

describe('guion de resolucion de los no calculables', () => {
  test('la simulacion agrupa por forma, con ejemplos, y no escribe', async () => {
    await sembrar();
    const catalogo = await TaricCode.find({ 'duties.origen.fuente': 'no_calculable' }, PROYECCION).lean();

    const plan = planResolucion(catalogo, DERECHOS, { codigosAdicionales: CODIGOS_ADICIONALES });

    expect(plan.grupos).toEqual(expect.arrayContaining([
      expect.objectContaining({ forma: 'variantes_codigo_adicional', accion: 'variantes', codigos: 1, ejemplos: [expect.objectContaining({ code: '2818300090' })] }),
      expect.objectContaining({ forma: 'compuesto', accion: 'formula', codigos: 2 }),
      expect.objectContaining({ forma: 'materia_lactea', accion: 'no_calculable', codigos: 1 }),
      expect.objectContaining({ forma: 'grado_alcoholico', accion: 'no_calculable', codigos: 1 })
    ]));
    expect(plan.total).toBe(5);
    expect(plan.conflictos).toEqual([]);
    expect((await leer('2818300090')).duties.origen.fuente).toBe('no_calculable');
  });

  test('un codigo adicional sin descripcion oficial o un codigo sin medida son conflictos', async () => {
    await TaricCode.collection.insertMany([noCalculable('2818300090', { thirdCountry: 0 }), noCalculable('3912398570', { thirdCountry: 0 })]);
    const plan = planResolucion(await TaricCode.find({}, PROYECCION).lean(), DERECHOS, { codigosAdicionales: new Map([['2501', 'Las demás']]) });
    expect(plan.conflictos).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '2818300090', motivo: expect.stringContaining('2500') }),
      expect.objectContaining({ code: '3912398570', motivo: expect.stringContaining('sin derecho de terceros paises') })
    ]));
  });

  test('aplica con limite de cambios por pasada y, repetido, termina sin cambios', async () => {
    await sembrar();
    const pasada = async (limite) => {
      const catalogo = await TaricCode.find({ 'duties.origen.fuente': 'no_calculable' }, PROYECCION).lean();
      return aplicarResolucion(planResolucion(catalogo, DERECHOS, { codigosAdicionales: CODIGOS_ADICIONALES }), { TaricCode, ahora: AHORA, fuente: FUENTE, limite });
    };

    const primera = await pasada(2);
    expect(primera).toMatchObject({ escritos: 2, pendientes: 3 });
    const segunda = await pasada(10);
    expect(segunda).toMatchObject({ escritos: 3, pendientes: 0 });
    const tercera = await pasada(10);
    expect(tercera).toMatchObject({ escritos: 0, pendientes: 0 });
    expect((await leer('2818300090')).duties.variantes).toHaveLength(2);
  });
});

describe('calculo con el derecho oficial', () => {
  beforeEach(sembrar);
  const aplicarTodo = async () => {
    const catalogo = await TaricCode.find({ 'duties.origen.fuente': 'no_calculable' }, PROYECCION).lean();
    await aplicarResolucion(planResolucion(catalogo, DERECHOS, { codigosAdicionales: CODIGOS_ADICIONALES }), { TaricCode, ahora: AHORA, fuente: FUENTE, limite: 100 });
  };
  const calcular = (params) => servicio.calculateDutiesWithAI({ customsValue: 1000, origin: 'CN', ...params });

  test('variantes: con el codigo adicional declarado, su tipo', async () => {
    await aplicarTodo();
    const conParametro = await calcular({ taricCode: '2818300090', additionalCode: '2500' });
    const enElCodigo = await calcular({ taricCode: '28183000902501' });

    expect(conParametro.duties.totalDuty).toBe(0);
    expect(conParametro.additionalCode).toMatchObject({ code: '2500', missing: false });
    expect(enElCodigo.duties).toMatchObject({ totalDuty: 55, effectiveDutyRate: 5.5 });
  });

  test('variantes: sin codigo adicional, la de mayor importe y se pide el codigo', async () => {
    await aplicarTodo();
    const r = await calcular({ taricCode: '2818300090' });

    expect(r.duties.totalDuty).toBe(55);
    expect(r.additionalCode).toMatchObject({ code: '2501', missing: true });
    expect(r.additionalCode.options).toEqual([
      expect.objectContaining({ code: '2500', description: expect.stringContaining('farmac'), duty: '0.000 %' }),
      expect.objectContaining({ code: '2501', description: 'Las demás', duty: '5.500 %' })
    ]);
    expect(r.warnings.join(' ')).toMatch(/Indica el codigo adicional/);
    expect(r.warnings.join(' ')).not.toMatch(/orientativo/);
  });

  test('formula: suma con maximo en porcentaje', async () => {
    await aplicarTodo();
    const r = await calcular({ taricCode: '1704101000', netWeight: 500 });
    // 62 + 135,5 = 197,5 -> maximo 17,9 % de 1.000 = 179
    expect(r.duties.totalDuty).toBe(179);
    expect(r.duties.dutyType).toBe('compound');
    expect(r.warnings.join(' ')).not.toMatch(/orientativo/);
  });

  test('formula: importe por pieza con minimo en porcentaje', async () => {
    await aplicarTodo();
    const r = await calcular({ taricCode: '9111100000', quantity: 10 });
    expect(r.duties.totalDuty).toBe(27);
  });

  test('no calculable: el aviso dice el texto oficial y el dato que falta', async () => {
    await aplicarTodo();
    const r = await calcular({ taricCode: '2204219551', quantity: 100 });
    const aviso = r.warnings.join(' ');
    expect(aviso).toContain('«1.750 EUR ASV X»');
    expect(aviso).toMatch(/hace falta el grado alcoholico/);
    expect(aviso).toMatch(/Arancel no calculado/);
    expect(r.dutyNotCalculable).toMatchObject({ text: '1.750 EUR ASV X', form: 'grado_alcoholico', missing: [expect.stringContaining('grado alcoholico')], calculated: 'none' });
    expect(r.duties.totalDuty).toBe(0);
  });

  test('cereales: el derecho punitivo en EUR/t de Rusia o Bielorrusia no se liquida, pero se avisa', async () => {
    await TaricCode.collection.insertOne({
      code: '1002100000', breakdown: { chapter: '10' }, description: { es: 'Trigo duro' }, level: 10, isLeaf: true, isActive: true,
      duties: { thirdCountry: 0, specific: { amount: 0, unit: 'EUR/1000 kg' }, origen: { fuente: 'taric_oficial', evidencia: '«Cond: B cert: Y-155 (01):93.000 EUR TNE ; B (01):0.000 EUR TNE» (heredado de 1002000000). X.' } }
    });
    const ucrania = await calcular({ taricCode: '1002100000', origin: 'UA', netWeight: 1000 });
    const rusia = await calcular({ taricCode: '1002100000', origin: 'RU', netWeight: 1000 });

    expect(ucrania.duties.totalDuty).toBe(0);
    expect(ucrania.warnings.join(' ')).not.toMatch(/punitivo/);
    expect(rusia.warnings.join(' ')).toMatch(/Origen RU: el derecho oficial lleva un derecho punitivo/);
  });

});

// Decision de Luis (13/Nov/2026): con un derecho no calculable no se usa el
// dato antiguo sin contrastar. Se liquida solo la parte exacta del texto
// oficial (sus porcentajes) como minimo, o nada si no la tiene.
describe('no calculables: solo la parte exacta del derecho oficial', () => {
  const OFICIALES = {
    '0402109100': '1.190 EUR KGM P + 27.500 EUR DTN',        // leche en polvo
    '2205109000': '0.900 EUR ASV X + 6.400 EUR HLT',          // vermut
    '0403204900': '7.600 % + EA',                             // yogur con elemento agricola
    '1702201000': '0.400 EUR DTN Z',                          // azucar de arce
    '0710400000': '5.100 % + 9.400 EUR DTN E',                // maiz dulce congelado
    '1704905100': '9.000 % + EA MAX 18.700 % +ADSZ',          // confiteria
    '3706109900': '6.500 % MAX 5.000 EUR HMT',                // pelicula: el tope no se puede calcular
    '0702000000': 'Cond: V 62.600 EUR/DTN(01):8.800 % ; V 61.300 EUR/DTN(01):8.800 % + 1.300 EUR DTN'  // tomates
  };
  // Datos antiguos del volcado de produccion: no deben usarse.
  const ANTIGUOS = {
    '0402109100': { thirdCountry: 0, specific: { amount: 1.19, unit: 'kg/lactic' } },
    '2205109000': { thirdCountry: 0, specific: { amount: 0.9, unit: '%' } },
    '0403204900': { thirdCountry: 8.3, specific: { amount: 95, unit: 'EUR/100 kg' } },
    '1702201000': { thirdCountry: 0, specific: { amount: 0.4, unit: 'EUR/100 kg' } },
    '0710400000': { thirdCountry: 5.1, specific: { amount: 9.4, unit: 'EUR/100 kg' } },
    '1704905100': { thirdCountry: 9, specific: { amount: 35.15, unit: '100' } },
    '3706109900': { thirdCountry: 6.5 },
    '0702000000': { thirdCountry: 8.8 }
  };
  beforeEach(async () => {
    const { leerDerechosTercerosPaises: leer } = require('../../../src/services/taric/arancelesOficiales');
    const derechos = leer([CAB, ...Object.entries(OFICIALES).map(([c, t]) => fila(c, `${t} `))], { fecha: AHORA });
    await TaricCode.collection.insertMany(Object.entries(ANTIGUOS).map(([code, duties]) => noCalculable(code, duties)));
    const catalogo = await TaricCode.find({ 'duties.origen.fuente': 'no_calculable' }, PROYECCION).lean();
    await aplicarResolucion(planResolucion(catalogo, derechos), { TaricCode, ahora: AHORA, fuente: FUENTE, limite: 100 });
  });
  const calcular = (taricCode) => servicio.calculateDutiesWithAI({ taricCode, customsValue: 1000, origin: 'CN', netWeight: 1000, quantity: 1000 });

  test('leche en polvo («EUR KGM P + EUR DTN»): solo los 27,50 EUR por 100 kg netos, como minimo', async () => {
    const r = await calcular('0402109100');
    expect(r.duties.totalDuty).toBe(275);
    expect(r.duties.specificDuty).toBe(275);
    expect(r.dutyNotCalculable).toMatchObject({ calculated: 'partial', exactPart: '27,5 EUR/100 kg', missing: [expect.stringContaining('materia lactea')] });
    expect(r.warnings.join(' ')).toMatch(/solo la parte exacta del derecho oficial \(27,5 EUR\/100 kg\): el importe es un minimo/);
    // El IVA, sobre el valor mas el arancel liquidado.
    expect(r.vat.base).toBe(1275);
  });

  test('leche en polvo sin peso neto: sin importe y se dice que falta', async () => {
    const r = await servicio.calculateDutiesWithAI({ taricCode: '0402109100', customsValue: 1000, origin: 'CN' });
    expect(r.duties.totalDuty).toBe(0);
    expect(r.dutyNotCalculable.calculated).toBe('none');
    expect(r.warnings.join(' ')).toMatch(/Arancel no calculado: 0 € no es el derecho real/);
    expect(r.warnings.join(' ')).toMatch(/27,5 EUR\/100 kg.*falta el peso neto/);
    expect(r.vat.base).toBe(1000);
  });

  test('«EUR ASV X + EUR HLT»: la parte por hl si hay volumen; si no, sin importe', async () => {
    expect((await calcular('2205109000')).duties.totalDuty).toBe(64);
    const sinVolumen = await servicio.calculateDutiesWithAI({ taricCode: '2205109000', customsValue: 1000, origin: 'CN', netWeight: 1000 });
    expect(sinVolumen.duties.totalDuty).toBe(0);
    expect(sinVolumen.dutyNotCalculable.calculated).toBe('none');
  });

  test('«N % + EA»: solo el porcentaje, como minimo', async () => {
    const r = await calcular('0403204900');
    expect(r.duties.totalDuty).toBe(76);
    expect(r.duties.effectiveDutyRate).toBe(7.6);
    expect(r.dutyNotCalculable).toMatchObject({ calculated: 'partial', exactPart: '7,6 %' });
    expect(r.warnings.join(' ')).toMatch(/solo la parte exacta del derecho oficial \(7,6 %\): el importe es un minimo/);
    expect(r.vat.base).toBe(1076);
  });

  test('«0.400 EUR DTN Z»: sin importe', async () => {
    const r = await calcular('1702201000');
    expect(r.duties.totalDuty).toBe(0);
    expect(r.dutyNotCalculable.calculated).toBe('none');
  });

  test('«N % + N EUR DTN E»: solo el porcentaje', async () => {
    expect((await calcular('0710400000')).duties.totalDuty).toBe(51);
  });

  test('con maximo: la parte exacta del maximo limita el minimo; si el maximo no se puede calcular, sin importe', async () => {
    expect((await calcular('1704905100')).duties.totalDuty).toBe(90);
    const pelicula = await calcular('3706109900');
    expect(pelicula.duties.totalDuty).toBe(0);
    expect(pelicula.dutyNotCalculable.calculated).toBe('none');
  });

  test('precio de entrada: sin importe', async () => {
    const r = await calcular('0702000000');
    expect(r.duties.totalDuty).toBe(0);
    expect(r.dutyNotCalculable).toMatchObject({ calculated: 'none', form: 'precio_entrada' });
  });

  test('getDutyInfo tampoco enseña el dato antiguo', async () => {
    const info = await servicio.getDutyInfo('1702201000', 'CN');
    expect(info).toMatchObject({ dutyRate: 0, specificDuty: null, minimumDuty: null, dutyType: 'ad_valorem' });
    const yogur = await servicio.getDutyInfo('0403204900', 'CN');
    expect(yogur).toMatchObject({ dutyRate: 7.6, specificDuty: null });
  });

  test('un codigo aun sin el texto oficial aparte lo toma de la evidencia', async () => {
    await TaricCode.collection.insertOne({
      code: '0403204933', breakdown: { chapter: '04' }, description: { es: 'x' }, level: 10, isLeaf: true, isActive: true,
      duties: { thirdCountry: 8.3, origen: { fuente: 'no_calculable', evidencia: 'Derecho oficial «7.600 % + EA»: derecho con elemento agricola, grado alcoholico, precio de entrada o varios sumandos. LUCI no lo liquida automaticamente.' } }
    });
    const r = await calcular('0403204933');
    expect(r.duties.totalDuty).toBe(76);
  });
});
