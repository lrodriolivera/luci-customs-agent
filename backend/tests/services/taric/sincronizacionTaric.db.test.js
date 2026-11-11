/**
 * Sincronizacion del catalogo TARIC con la nomenclatura oficial, de punta a
 * punta contra Mongo en memoria. Los ficheros de CIRCABC y el servicio web se
 * sustituyen por dobles: no se sale a internet.
 */
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { xlsxDePrueba } = require('../../helpers/xlsxDePrueba');
const { MINIMO_CODIGOS_OFICIALES } = require('../../../src/services/taric/planSincronizacion');
const { prepararSincronizacion, aplicarSincronizacion, documentoDeAlta, derechosDeAlta } = require('../../../src/services/taric/sincronizacionTaric');
const circabc = require('../../../src/services/taric/circabcTaric');
const TaricCode = require('../../../src/models/TaricCode');
const dutyCalculationService = require('../../../src/services/dutyCalculationService');

usarBaseDeDatosEnMemoria();

const CAB_NOM = ['Goods code', 'Start date', 'End date', 'Language', 'Hier. Pos.', 'Indent', 'Description', 'Descr. start date'];
const CAB_DEC = ['Goods code', 'Start date', 'Decl. start date', 'IS_LEAF', 'End date'];
const CAB_DER = ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'RED_IND', 'Origin', 'Measure type', 'Legal base', 'Duty', 'Origin code', 'Meas. type code'];
const derecho103 = (codigo, texto) => [codigo, '', '', '01-01-2012', '', '', 'ERGA OMNES', 'Third country duty', 'Regulation 2658/87', texto, '1011', '103'];
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
  // Derechos: el cable hereda el 3,3 % de su codigo de 8 digitos, el pato un
  // importe por 100 kg, y el relleno tiene un 3,3 % en el capitulo.
  const der = [CAB_DER, derecho103('8544429000', '3.300 % '), derecho103('0207412000', '38.000 EUR DTN '), derecho103('9900000000', '3.300 % ')];
  return {
    mes: { anio: 2026, mes: 11, name: '11 - November' }, mesEs: { anio: 2026, mes: 7, name: '07 - July' },
    nomenclaturaEn: xlsxDePrueba(en), nomenclaturaEs: xlsxDePrueba(es), declarables: xlsxDePrueba(dec),
    derechosImport: xlsxDePrueba(der)
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
const { cargarCatalogo } = require('../../../src/services/taric/sincronizacionAutomatica');
const catalogo = () => cargarCatalogo(TaricCode);

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

    expect(hecho).toMatchObject({ altas: 3, bajas: 1, reactivados: 0, declarable: 1, nivel: 0 });
    const cable = await TaricCode.findOne({ code: '8544429010' }).lean();
    expect(cable).toMatchObject({
      level: 10, isLeaf: true, isActive: true,
      description: { es: 'Cable de transmisión de datos', en: 'Data cable' },
      breakdown: { chapter: '85', heading: '8544', subheading: '854442', cnCode: '85444290', taricCode: '8544429010' },
      keywords: ['cable', 'transmisión', 'datos'],
      legalDescription: 'Cable de transmisión de datos'
    });
    // El codigo nuevo que cuelga de uno que ya estaba en el fichero en español lleva su ruta.
    const patoNuevo = await TaricCode.findOne({ code: '0207412010' }).lean();
    expect(patoNuevo.legalDescription).toBe('Sin trocear > De pato de Pekin');
    expect(patoNuevo.keywords).toEqual(['pato', 'pekin', 'trocear']);
    // Arancel oficial heredado del codigo de 8 digitos, con su procedencia.
    expect(cable.duties.thirdCountry).toBe(3.3);
    expect(cable.duties.origen).toMatchObject({ fuente: 'taric_oficial', metodo: 'fichero_circabc' });
    expect(cable.duties.origen.evidencia).toBe('«3.300 %» (heredado de 8544429000). Comision Europea - TARIC (CIRCABC), 2026-11');
    // Derecho por unidad: sin componente ad valorem.
    const pato = await TaricCode.findOne({ code: '0207412010' }).lean();
    expect(pato.duties).toMatchObject({ thirdCountry: 0, specific: { amount: 38, unit: 'EUR/100 kg' }, origen: { fuente: 'taric_oficial' } });
    // Un codigo que no se declara no lleva arancel.
    expect((await TaricCode.findOne({ code: '0207412000' }).lean()).duties.thirdCountry).toBeNull();
    expect(cable.validFrom.toISOString().slice(0, 10)).toBe('2026-07-01');

    const caducado = await TaricCode.findOne({ code: '2811220040' }).lean();
    expect(caducado).toMatchObject({ isActive: false, validTo: ahora });
    expect(caducado.duties.thirdCountry).toBe(5.5);
    expect((await TaricCode.findOne({ code: codigoRelleno(1) }).lean()).isLeaf).toBe(true);
    expect(await TaricCode.countDocuments()).toBe(MINIMO_CODIGOS_OFICIALES + 4);

    // Repetirla no cambia nada: es idempotente.
    const otra = await prepararSincronizacion(await catalogo(), { ficheros: F, describir: async () => null });
    expect(otra.resumen).toMatchObject({
      altas: 0, bajas: 0, reactivar: 0, declarable: 0, nivel: 0,
      descripcionesACorregir: 0, arancelesACorregir: 0, arancelesAContrastar: 0
    });
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

  test('con `corregir: false` los aranceles que no coinciden solo se listan', async () => {
    await sembrar();
    await TaricCode.collection.updateOne({ code: codigoRelleno(5) }, { $set: { 'duties.thirdCountry': 12 } });

    const plan = await prepararSincronizacion(await catalogo(), { ficheros: F, describir: async () => 'x' });
    await aplicarSincronizacion(plan, { TaricCode, corregir: false });

    expect(plan.resumen.arancelesDelCatalogo).toEqual({ comparados: MINIMO_CODIGOS_OFICIALES, coinciden: MINIMO_CODIGOS_OFICIALES - 1, distintos: 1, noComparables: 0 });
    expect(plan.arancelesDistintos).toEqual([expect.objectContaining({ code: codigoRelleno(5), catalogo: 12, oficial: 3.3, heredadoDe: '9900000000' })]);
    expect(plan.resumen.arancelesDeAltas).toMatchObject({ ok: 2, sin_medida: 0 });
    expect((await TaricCode.findOne({ code: codigoRelleno(5) }).lean()).duties.thirdCountry).toBe(12);
  });

  test('corrige lo que ya estaba: descripcion oficial, ruta, palabras de busqueda y arancel', async () => {
    await sembrar([
      // Descripcion traducida que no es la oficial, y arancel equivocado con una unidad mal guardada.
      { ...existente('8544429010'), description: { es: 'Cable de datos de alta velocidad', en: 'High speed cable' }, duties: { thirdCountry: 5, specific: { amount: 7, unit: '100' }, sancionRusiaBielorrusia: { adValorem: 50, certificado: 'Y155' } } },
      // Arancel ya contrastado a mano que no coincide: no se pisa.
      { ...existente('0207412010'), description: { es: 'De pato de Pekin', en: 'Of Pekin Duck' }, duties: { thirdCountry: 9, origen: { fuente: 'taric_oficial' } } }
    ]);
    const ahora = new Date('2026-11-11T12:00:00Z');

    const plan = await prepararSincronizacion(await catalogo(), { ficheros: F, describir: async () => 'x' });
    const hecho = await aplicarSincronizacion(plan, { TaricCode, ahora });

    expect(plan.resumen).toMatchObject({ arancelesACorregir: 1, arancelesEnConflicto: 1 });
    expect(plan.correcciones.aranceles.conflictos).toEqual([expect.objectContaining({ code: '0207412010', thirdCountry: 0, specific: { amount: 38, unit: 'EUR/100 kg' } })]);
    expect(hecho.correcciones).toMatchObject({ aranceles: 1 });

    const cable = await TaricCode.findOne({ code: '8544429010' }).lean();
    expect(cable.description).toEqual({ es: 'Cable de transmisión de datos', en: 'Data cable' });
    expect(cable.legalDescription).toBe('Cable de transmisión de datos');
    expect(cable.keywords).toEqual(['cable', 'transmisión', 'datos']);
    expect(cable.duties.thirdCountry).toBe(3.3);
    expect(cable.duties.specific).toBeUndefined();
    expect(cable.duties.origen).toMatchObject({ fuente: 'taric_oficial', metodo: 'fichero_circabc' });
    expect(cable.duties.origen.evidencia).toBe('«3.300 %» (heredado de 8544429000). Comision Europea - TARIC (CIRCABC), 2026-11. Antes: 5 % + 7 100.');
    // Lo demas que cuelga de `duties` sigue ahi.
    expect(cable.duties.sancionRusiaBielorrusia).toEqual({ adValorem: 50, certificado: 'Y155' });

    const pato = await TaricCode.findOne({ code: '0207412010' }).lean();
    expect(pato.duties.thirdCountry).toBe(9);

    // Los que ya coincidian pasan a constar como contrastados, sin cambiar la cifra.
    const relleno = await TaricCode.findOne({ code: codigoRelleno(7) }).lean();
    expect(relleno.duties).toMatchObject({ thirdCountry: 3.3, origen: { fuente: 'taric_oficial' } });
  });

  test('sin el fichero de derechos del mes las altas entran sin arancel y no se compara nada', async () => {
    await sembrar();

    const plan = await prepararSincronizacion(await catalogo(), { ficheros: { ...F, derechosImport: null }, describir: async () => 'x' });

    expect(plan.resumen.arancelesDeAltas).toMatchObject({ ok: 0, sin_fichero: 2 });
    expect(plan.resumen.arancelesDelCatalogo).toBeNull();
    expect(plan.arancelesDistintos).toEqual([]);
  });

  test('un derecho que no es simple entra sin dato y con el texto oficial como motivo', () => {
    const contexto = { ahora: new Date('2026-11-11T12:00:00Z'), fuente: 'Comision Europea - TARIC (CIRCABC), 2026-11' };

    const mixto = derechosDeAlta({ code: '0811101100', arancel: { estado: 'no_simple', texto: '20.800 % + 8.400 EUR DTN', heredadoDe: '0811101100' } }, contexto);
    const variantes = derechosDeAlta({ code: '2918220020', arancel: { estado: 'variantes', texto: '0.000 % | 6.500 %', heredadoDe: '2918220000' } }, contexto);
    const sinMedida = derechosDeAlta({ code: '9880000000', arancel: { estado: 'sin_medida' } }, contexto);

    expect(mixto).toMatchObject({ thirdCountry: null, origen: { fuente: 'pendiente' } });
    expect(mixto.origen.evidencia).toContain('derecho mixto, condicionado o con minimos («20.800 % + 8.400 EUR DTN»)');
    expect(variantes.origen.evidencia).toContain('varios tipos segun codigo adicional («0.000 % | 6.500 %»)');
    expect(sinMedida.origen.evidencia).toContain('sin derecho de terceros paises en el fichero oficial');
    expect(sinMedida.thirdCountry).toBeNull();
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
    m11: [fichero('dec11', 'Declarable codes.xlsx'), fichero('en11', 'Nomenclature EN.xlsx'), fichero('fr11', 'Nomenclature FR.xlsx'), fichero('der11', 'Duties Import 01-99.xlsx')],
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
    expect(f.derechosImport.toString()).toBe('contenido de der11');
    // Se entra como invitado.
    expect(c.get.mock.calls[0][1].params).toMatchObject({ guest: true });
  });

  test('sin ningun mes con los ficheros necesarios, error claro; una respuesta rara tambien', async () => {
    const vacio = { get: jest.fn(async (url) => ({ data: { data: url.includes(circabc.CARPETA_TARIC) ? [carpeta('a2026', '2026')] : [] } })) };
    await expect(circabc.ficherosDeNomenclatura({ cliente: vacio })).rejects.toThrow('no se encontro ningun mes');
    await expect(circabc.hijos('x', { cliente: { get: async () => ({ data: '<html>' }) } })).rejects.toThrow('respuesta inesperada');
  });
});
