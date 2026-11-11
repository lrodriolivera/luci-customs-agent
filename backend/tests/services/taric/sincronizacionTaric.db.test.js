/**
 * Sincronizacion del catalogo TARIC con la nomenclatura oficial, de punta a
 * punta contra Mongo en memoria. Los ficheros de CIRCABC y el servicio web se
 * sustituyen por dobles: no se sale a internet.
 */
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { xlsxDePrueba } = require('../../helpers/xlsxDePrueba');
const { MINIMO_CODIGOS_OFICIALES } = require('../../../src/services/taric/planSincronizacion');
const { prepararSincronizacion, aplicarSincronizacion, documentoDeAlta } = require('../../../src/services/taric/sincronizacionTaric');
const circabc = require('../../../src/services/taric/circabcTaric');
const TaricCode = require('../../../src/models/TaricCode');
const dutyCalculationService = require('../../../src/services/dutyCalculationService');

usarBaseDeDatosEnMemoria();

const CAB_NOM = ['Goods code', 'Start date', 'End date', 'Language', 'Hier. Pos.', 'Indent', 'Description', 'Descr. start date'];
const CAB_DEC = ['Goods code', 'Start date', 'Decl. start date', 'IS_LEAF', 'End date'];
const codigoRelleno = (i) => `99${String(i).padStart(8, '0')}`;

// Nomenclatura oficial: relleno + tres codigos con nombre propio.
const PROPIOS = [
  { code: '8544429010', nivel: '10', en: 'Data cable', es: 'Cable de transmisión de datos', hoja: '1' },
  { code: '0207412010', nivel: '10', en: 'Of Pekin Duck', es: null, hoja: '1' },           // posterior al fichero en español
  { code: '0207412000', nivel: '8', en: 'Not cut in pieces', es: 'Sin trocear', hoja: '0' }
];
const ficheros = () => {
  const en = [CAB_NOM]; const es = [CAB_NOM]; const dec = [CAB_DEC];
  for (let i = 0; i < MINIMO_CODIGOS_OFICIALES; i++) {
    en.push([`${codigoRelleno(i)} 80`, '01-01-2020', '', 'EN', '10', '- ', 'Other', '01-01-2020']);
    dec.push([`${codigoRelleno(i)} 80`, '01-01-2020', '01-01-2020', '1', '']);
  }
  for (const p of PROPIOS) {
    en.push([`${p.code} 80`, '01-07-2026', '', 'EN', p.nivel, '- ', p.en, '01-07-2026']);
    if (p.es) es.push([`${p.code} 80`, '01-07-2026', '', 'ES', p.nivel, '- ', p.es, '01-07-2026']);
    dec.push([`${p.code} 80`, '01-07-2026', '01-07-2026', p.hoja, '']);
  }
  es.push([`${codigoRelleno(0)} 80`, '01-01-2020', '', 'ES', '10', '- ', 'Los demás', '01-01-2020']);
  return {
    mes: { anio: 2026, mes: 11, name: '11 - November' }, mesEs: { anio: 2026, mes: 7, name: '07 - July' },
    nomenclaturaEn: xlsxDePrueba(en), nomenclaturaEs: xlsxDePrueba(es), declarables: xlsxDePrueba(dec)
  };
};
const existente = (code, extra = {}) => ({
  code, breakdown: { chapter: code.slice(0, 2) }, description: { es: 'Los demás' }, level: 10, isLeaf: true, isActive: true,
  duties: { thirdCountry: 3.3 }, ...extra
});
const sembrar = async (extras = []) => {
  const docs = [];
  for (let i = 0; i < MINIMO_CODIGOS_OFICIALES; i++) docs.push(existente(codigoRelleno(i)));
  await TaricCode.collection.insertMany([...docs, ...extras]);
};
const catalogo = () => TaricCode.find({}, { _id: 0, code: 1, level: 1, isLeaf: 1, isActive: 1 }).lean();

describe('sincronizacion del catalogo TARIC', () => {
  let F;
  beforeAll(() => { F = ficheros(); });

  test('prepara el plan sin escribir nada y describe cada alta en español', async () => {
    await sembrar([existente('2811220040'), existente(codigoRelleno(999999).replace(/^99/, '98'), { isLeaf: false })]);
    const describir = jest.fn().mockResolvedValue('De pato de Pekin');

    const plan = await prepararSincronizacion(await catalogo(), { ficheros: F, describir });

    expect(plan.resumen).toMatchObject({ altas: 3, altasDeclarables: 2, altasSinEspanol: 0, bajas: 2, declarable: 0 });
    expect(plan.fuente).toEqual({ nombre: circabc.FUENTE, mes: '2026-11', mesEspanol: '2026-07' });
    const porCodigo = Object.fromEntries(plan.altas.map((a) => [a.code, a]));
    expect(porCodigo['8544429010']).toMatchObject({ descripcionEs: 'Cable de transmisión de datos', descripcionEn: 'Data cable', descripcionEsOrigen: 'circabc', isLeaf: true });
    expect(porCodigo['0207412010']).toMatchObject({ descripcionEs: 'De pato de Pekin', descripcionEsOrigen: 'servicio_web' });
    expect(porCodigo['0207412000']).toMatchObject({ level: 8, isLeaf: false });
    // Solo se pregunta al servicio web por el codigo que el fichero en español no trae.
    expect(describir).toHaveBeenCalledTimes(1);
    expect(describir).toHaveBeenCalledWith('0207412010', { idioma: 'es' });
    expect(await TaricCode.countDocuments()).toBe(MINIMO_CODIGOS_OFICIALES + 2);
  });

  test('si el servicio web no da español, el alta queda en ingles y marcada', async () => {
    await sembrar();
    const describir = jest.fn().mockRejectedValueOnce(new Error('timeout'));

    const plan = await prepararSincronizacion(await catalogo(), { ficheros: F, describir });

    const pato = plan.altas.find((a) => a.code === '0207412010');
    expect(pato).toMatchObject({ descripcionEs: 'Of Pekin Duck', descripcionEsOrigen: 'ingles_pendiente_de_traduccion' });
    expect(plan.resumen.altasSinEspanol).toBe(1);
  });

  test('aplica: da de alta, deja inactivos los caducados sin borrarlos y corrige la marca de declarable', async () => {
    await sembrar([existente('2811220040', { duties: { thirdCountry: 5.5 } })]);
    await TaricCode.collection.updateOne({ code: codigoRelleno(1) }, { $set: { isLeaf: false } });
    const ahora = new Date('2026-11-11T12:00:00Z');
    const plan = await prepararSincronizacion(await catalogo(), { ficheros: F, describir: async () => 'De pato de Pekin' });

    const hecho = await aplicarSincronizacion(plan, { TaricCode, ahora });

    expect(hecho).toEqual({ altas: 3, bajas: 1, reactivados: 0, declarable: 1, nivel: 0 });
    const cable = await TaricCode.findOne({ code: '8544429010' }).lean();
    expect(cable).toMatchObject({
      level: 10, isLeaf: true, isActive: true,
      description: { es: 'Cable de transmisión de datos', en: 'Data cable' },
      breakdown: { chapter: '85', heading: '8544', subheading: '854442', cnCode: '85444290', taricCode: '8544429010' },
      keywords: ['cable', 'transmisión', 'datos']
    });
    expect(cable.duties.thirdCountry).toBeNull();
    expect(cable.duties.origen).toMatchObject({ fuente: 'pendiente' });
    expect(cable.validFrom.toISOString().slice(0, 10)).toBe('2026-07-01');

    const caducado = await TaricCode.findOne({ code: '2811220040' }).lean();
    expect(caducado).toMatchObject({ isActive: false, validTo: ahora });
    expect(caducado.duties.thirdCountry).toBe(5.5);
    expect((await TaricCode.findOne({ code: codigoRelleno(1) }).lean()).isLeaf).toBe(true);
    expect(await TaricCode.countDocuments()).toBe(MINIMO_CODIGOS_OFICIALES + 4);

    // Repetirla no cambia nada: es idempotente.
    const otra = await prepararSincronizacion(await catalogo(), { ficheros: F, describir: async () => null });
    expect(otra.resumen).toMatchObject({ altas: 0, bajas: 0, reactivar: 0, declarable: 0, nivel: 0 });
  });

  test('un codigo de baja que vuelve a la oficial se reactiva', async () => {
    await sembrar();
    await TaricCode.collection.updateOne({ code: codigoRelleno(2) }, { $set: { isActive: false, validTo: new Date('2026-01-01') } });
    const plan = await prepararSincronizacion(await catalogo(), { ficheros: F, describir: async () => 'x' });

    await aplicarSincronizacion(plan, { TaricCode });

    const reactivado = await TaricCode.findOne({ code: codigoRelleno(2) }).lean();
    expect(reactivado.isActive).toBe(true);
    expect(reactivado.validTo).toBeUndefined();
  });

  test('el alta sin español lleva una nota y nunca un arancel inventado', () => {
    const doc = documentoDeAlta(
      { code: '0207412010', level: 10, isLeaf: true, validFrom: null, descripcionEs: 'Of Pekin Duck', descripcionEn: 'Of Pekin Duck', descripcionEsOrigen: 'ingles_pendiente_de_traduccion' },
      { ahora: new Date('2026-11-11T12:00:00Z'), fuente: 'Comision Europea - TARIC (CIRCABC), 2026-11' }
    );

    expect(doc.notes).toEqual(['Descripcion oficial todavia no disponible en español']);
    expect(doc.duties.thirdCountry).toBeNull();
    expect(doc.duties.origen.evidencia).toContain('Comision Europea - TARIC (CIRCABC), 2026-11');
  });

  test('el calculo de derechos no toma por 0 % un codigo sin arancel contrastado', async () => {
    await TaricCode.collection.insertOne({ ...existente('0207412010'), duties: { thirdCountry: null, origen: { fuente: 'pendiente' } } });
    await TaricCode.collection.insertOne(existente('8544429090'));

    const conArancel = await dutyCalculationService.getDutyInfo('8544429090').catch((e) => ({ error: e.message }));
    const sinArancel = await dutyCalculationService.getDutyInfo('0207412010').catch((e) => ({ error: e.message }));

    expect(conArancel).toMatchObject({ source: 'local_db', dutyRate: 3.3 });
    expect(sinArancel.source).not.toBe('local_db');
  });
});

describe('circabcTaric', () => {
  const carpeta = (id, name) => ({ id, name, type: '{http://www.alfresco.org/model/content/1.0}folder', properties: {} });
  const fichero = (id, name) => ({ id, name, type: '{http://www.alfresco.org/model/content/1.0}content', properties: {} });
  const ARBOL = {
    [circabc.CARPETA_TARIC]: [carpeta('a2026', '2026'), carpeta('a2025', '2025'), carpeta('x', 'Archivo')],
    a2026: [carpeta('m11', '11 - November'), carpeta('m07', '07 - July'), carpeta('m10', '10 - October')],
    a2025: [carpeta('m12', '12 - December')],
    m11: [fichero('dec11', 'Declarable codes.xlsx'), fichero('en11', 'Nomenclature EN.xlsx'), fichero('fr11', 'Nomenclature FR.xlsx')],
    m10: [fichero('dec10', 'Declarable codes.xlsx'), fichero('en10', 'Nomenclature EN.xlsx')],
    m07: [fichero('dec07', 'Declarable codes.xlsx'), fichero('en07', 'Nomenclature EN.xlsx'), fichero('es07', 'Nomenclature ES.xlsx')],
    m12: []
  };
  const cliente = () => ({
    get: jest.fn(async (url) => {
      const lista = /spaces\/([^/]+)\/children/.exec(url);
      if (lista) return { data: { data: ARBOL[lista[1]] || [] } };
      return { data: Buffer.from(`contenido de ${/download\/(.+)$/.exec(url)[1]}`) };
    })
  });

  test('ordena los meses del mas reciente al mas antiguo, de los dos ultimos años', async () => {
    const meses = await circabc.mesesPublicados({ cliente: cliente() });
    expect(meses.map((m) => `${m.anio}-${m.mes}`)).toEqual(['2026-11', '2026-10', '2026-7', '2025-12']);
  });

  test('toma los declarables y el ingles del mes mas reciente y el español del ultimo mes que lo trae', async () => {
    const c = cliente();

    const f = await circabc.ficherosDeNomenclatura({ cliente: c });

    expect(f.mes).toMatchObject({ anio: 2026, mes: 11 });
    expect(f.mesEs).toMatchObject({ anio: 2026, mes: 7 });
    expect(f.declarables.toString()).toBe('contenido de dec11');
    expect(f.nomenclaturaEn.toString()).toBe('contenido de en11');
    expect(f.nomenclaturaEs.toString()).toBe('contenido de es07');
    // Se entra como invitado.
    expect(c.get.mock.calls[0][1].params).toMatchObject({ guest: true });
  });

  test('sin ningun mes con los ficheros necesarios, error claro; una respuesta rara tambien', async () => {
    const vacio = { get: jest.fn(async (url) => ({ data: { data: url.includes(circabc.CARPETA_TARIC) ? [carpeta('a2026', '2026')] : [] } })) };
    await expect(circabc.ficherosDeNomenclatura({ cliente: vacio })).rejects.toThrow('no se encontro ningun mes');
    await expect(circabc.hijos('x', { cliente: { get: async () => ({ data: '<html>' }) } })).rejects.toThrow('respuesta inesperada');
  });
});
