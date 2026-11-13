/**
 * Puesta al dia del catalogo TARIC de LUCI con la nomenclatura oficial de la
 * Comision Europea.
 *
 * `prepararSincronizacion` no escribe nada: descarga, compara y devuelve el plan
 * con todo lo necesario para aplicarlo. `aplicarSincronizacion` es la unica
 * funcion que modifica la base de datos.
 */
const { leerPrimeraHoja } = require('./xlsxSimple');
const { leerNomenclatura, leerDeclarables, leerRutas } = require('./nomenclaturaOficial');
const { planificar, desglose, palabrasClave } = require('./planSincronizacion');
const circabc = require('./circabcTaric');
const { descripcionOficial } = require('./descripcionOficial');
const { leerDerechosTercerosPaises, arancelDe, compararAranceles, camposDeDerecho } = require('./arancelesOficiales');
const {
  corregirDescripciones, corregirAranceles, resolverDerechoNoSimple, evidenciaSinDerecho, sinDerechoOficial, SEPARADOR_RUTA
} = require('./correccionesCatalogo');
const { leerDescripcionesCodigosAdicionales } = require('./codigosAdicionales');

const sinNulos = (objeto) => Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== null && v !== undefined));

const PAUSA_ENTRE_CONSULTAS_MS = 60;
const TAMANO_LOTE = 2000;
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * @param {Array<{ code, level, isLeaf, isActive }>} catalogo estado actual del catalogo
 * @param {{ ficheros?: object, describir?: Function, log?: Function }} [deps]
 * @returns {Promise<object>} plan con `altas` ya descritas y `resumen`
 */
async function prepararSincronizacion(catalogo, { ficheros, describir = descripcionOficial, log = () => {} } = {}) {
  const f = ficheros || await circabc.ficherosDeNomenclatura();
  const oficial = leerNomenclatura(leerPrimeraHoja(f.nomenclaturaEn));
  const declarables = leerDeclarables(leerPrimeraHoja(f.declarables));
  const hojaEs = f.nomenclaturaEs ? leerPrimeraHoja(f.nomenclaturaEs) : null;
  const enEspanol = hojaEs ? leerNomenclatura(hojaEs) : new Map();
  const rutas = hojaEs ? leerRutas(hojaEs) : new Map();
  log(`Nomenclatura oficial de ${f.mes.name} ${f.mes.anio}: ${oficial.size} codigos, ${declarables.size} declarables` +
    (f.mesEs ? `; español de ${f.mesEs.name} ${f.mesEs.anio}` : '; sin fichero en español'));

  // La extraccion mensual esta proyectada al dia 1 del mes.
  const fechaFichero = new Date(Date.UTC(f.mes.anio, f.mes.mes - 1, 1, 12));
  const plan = planificar(oficial, declarables, catalogo, { fechaFichero });

  // Arancel de terceros paises oficial (puede faltar el fichero del mes).
  const derechos = f.derechosImport ? leerDerechosTercerosPaises(leerPrimeraHoja(f.derechosImport)) : null;
  // Descripcion oficial de los codigos adicionales (para las variantes del derecho); puede faltar.
  const codigosAdicionales = f.codigosAdicionales ? leerDescripcionesCodigosAdicionales(leerPrimeraHoja(f.codigosAdicionales)) : new Map();
  const aranceles = { ok: 0, variantes: 0, no_simple: 0, sin_medida: 0, sin_fichero: 0 };
  for (const alta of plan.altas) {
    const arancel = derechos ? arancelDe(alta.code, derechos) : { estado: 'sin_fichero' };
    // Un codigo que no se declara solo lleva arancel si la fuente se lo da a el.
    if (!alta.isLeaf && arancel.heredadoDe !== alta.code) continue;
    alta.arancel = arancel;
    if (arancel.estado === 'variantes' || arancel.estado === 'no_simple') alta.arancelResuelto = resolverDerechoNoSimple(arancel, { codigosAdicionales });
    if (alta.isLeaf) aranceles[arancel.estado] += 1;
  }
  // Los que ya estan en el catalogo solo se comparan: aqui no se corrige ninguno.
  const comparacion = derechos ? compararAranceles(catalogo, derechos) : null;
  if (derechos) log(`Derechos de importacion oficiales: ${derechos.size} codigos con arancel de terceros paises vigente`);

  // Descripcion de cada alta: español del fichero de CIRCABC; si el codigo es
  // posterior a ese fichero, del servicio web; y si tampoco, queda en ingles y
  // marcado para revisarlo. Nunca se inventa ni se traduce aqui.
  let sinEspanol = 0;
  for (const alta of plan.altas) {
    const en = oficial.get(alta.code).descripcion;
    let es = enEspanol.get(alta.code)?.descripcion || null;
    let origenEs = es ? 'circabc' : null;
    if (!es) {
      try {
        es = await describir(alta.code, { idioma: 'es' });
        if (es) origenEs = 'servicio_web';
      } catch (error) {
        log(`  ${alta.code}: el servicio web no dio la descripcion (${error.message})`);
      }
      await pausa(PAUSA_ENTRE_CONSULTAS_MS);
    }
    if (!es) sinEspanol += 1;
    Object.assign(alta, { descripcionEs: es || en, descripcionEn: en, descripcionEsOrigen: origenEs || 'ingles_pendiente_de_traduccion' });
    // Ruta en el arbol: la del fichero en español si el codigo ya estaba; si es
    // posterior, la del codigo de 8 digitos del que cuelga mas su descripcion.
    const ruta = rutas.get(alta.code) || [...(rutas.get(`${alta.code.slice(0, 8)}00`) || []), alta.descripcionEs];
    alta.ruta = ruta;
  }

  // Correcciones de lo que el catalogo ya tiene: descripciones y aranceles.
  const descripciones = corregirDescripciones(catalogo, { es: enEspanol, en: oficial, rutas });
  // Los aranceles se corrigen sobre el catalogo tal como va a quedar: un codigo
  // que pasa a ser declarable en esta misma sincronizacion ya cuenta.
  const comoQuedara = catalogo.map((c) => (oficial.has(c.code) ? { ...c, isLeaf: declarables.has(c.code), isActive: true } : { ...c, isActive: false }));
  const correccionAranceles = derechos
    ? corregirAranceles(comoQuedara, derechos, { codigosAdicionales })
    : { corregir: [], contrastar: [], conflictos: [], unidades: [], noCalculables: [], sinDerecho: [], variantes: [], compuestos: [] };

  return {
    ...plan,
    fuente: { nombre: circabc.FUENTE, mes: `${f.mes.anio}-${String(f.mes.mes).padStart(2, '0')}`, mesEspanol: f.mesEs ? `${f.mesEs.anio}-${String(f.mesEs.mes).padStart(2, '0')}` : null },
    resumen: {
      oficiales: oficial.size, declarablesOficiales: declarables.size, catalogo: catalogo.length,
      altas: plan.altas.length, altasDeclarables: plan.altas.filter((a) => a.isLeaf).length, altasSinEspanol: sinEspanol,
      bajas: plan.bajas.length, reactivar: plan.reactivar.length, declarable: plan.declarable.length, nivel: plan.nivel.length,
      sinCambios: plan.sinCambios,
      posterioresAlFichero: plan.posterioresAlFichero,
      arancelesDeAltas: aranceles,
      descripcionesACorregir: descripciones.length,
      descripcionesEsACorregir: descripciones.filter((d) => d.es).length,
      arancelesACorregir: correccionAranceles.corregir.length,
      arancelesAContrastar: correccionAranceles.contrastar.length,
      arancelesEnConflicto: correccionAranceles.conflictos.length,
      arancelesUnidadAUnificar: correccionAranceles.unidades.length,
      arancelesNoCalculables: correccionAranceles.noCalculables.length,
      arancelesConVariantes: correccionAranceles.variantes.length,
      arancelesCompuestos: correccionAranceles.compuestos.length,
      codigosSinDerechoOficial: correccionAranceles.sinDerecho.length,
      arancelesDelCatalogo: comparacion
        ? { comparados: comparacion.comparados, coinciden: comparacion.coinciden, distintos: comparacion.distintos.length, noComparables: comparacion.noComparables }
        : null
    },
    arancelesDistintos: comparacion ? comparacion.distintos : [],
    correcciones: { descripciones, aranceles: correccionAranceles }
  };
}

/**
 * Arancel con el que entra un codigo nuevo: el oficial si es un porcentaje o un
 * importe por unidad; si no, sin dato (null) y con el motivo. Nunca se estima.
 */
function derechosDeAlta(alta, { ahora, fuente, codigosAdicionales }) {
  const a = alta.arancel;
  if (a?.estado === 'ok') {
    const herencia = a.heredadoDe === alta.code ? '' : ` (heredado de ${a.heredadoDe})`;
    const campos = camposDeDerecho(a.derecho);
    return {
      // Un derecho solo especifico no lleva componente ad valorem (thirdCountry 0).
      thirdCountry: campos.thirdCountry,
      ...(campos.specific ? { specific: campos.specific } : {}),
      ...(campos.combinacion ? { combinacion: campos.combinacion } : {}),
      ...(campos.minimo ? { minimo: campos.minimo } : {}),
      ...(campos.maximo ? { maximo: campos.maximo } : {}),
      ...(campos.sancion ? { sancionRusiaBielorrusia: campos.sancion } : {}),
      origen: {
        fuente: 'taric_oficial', consultadoEl: ahora, metodo: 'fichero_circabc', rotulo: a.rotulo || 'Third country duty',
        evidencia: `«${a.texto}»${herencia}. ${fuente}`,
        ...(a.soloDestinoFinal ? { soloDestinoFinal: true } : {})
      }
    };
  }
  // Variantes por codigo adicional o suma con minimo o maximo: se guardan para
  // liquidarlas. Lo demas, sin dato: null, no 0 (un 0 % se leeria como «libre
  // de derechos»), con el texto oficial y el dato que falta.
  if (a?.estado === 'variantes' || a?.estado === 'no_simple') {
    const r = alta.arancelResuelto || resolverDerechoNoSimple(a, { codigosAdicionales });
    const dato = { ...a, code: alta.code };
    if (r.tipo === 'variantes') {
      return { thirdCountry: null, variantes: r.variantes, origen: origenOficial(dato, { ahora, fuente, forma: 'variantes_codigo_adicional', extra: variantesLegibles(r.variantes) }) };
    }
    if (r.tipo === 'compuesto') {
      return { ...sinNulos(r.campos), formula: r.formula, origen: origenOficial(dato, { ahora, fuente, forma: 'compuesto' }) };
    }
    return { thirdCountry: null, origen: origenNoCalculable({ ...r, texto: a.texto }, ahora) };
  }
  if (a?.estado === 'sin_medida' && sinDerechoOficial(alta.code)) {
    return { thirdCountry: null, origen: { fuente: 'sin_derecho_oficial', consultadoEl: ahora, metodo: 'fichero_circabc', evidencia: evidenciaSinDerecho(alta.code, fuente) } };
  }
  const motivo = a?.estado === 'sin_medida' ? ': sin derecho de terceros paises en el fichero oficial' : a?.estado === 'sin_fichero' ? ': fichero de derechos no disponible' : '';
  return { thirdCountry: null, origen: { fuente: 'pendiente', consultadoEl: ahora, evidencia: `Alta por sincronizacion con ${fuente}${motivo}` } };
}

/** Documento del catalogo para un codigo nuevo. */
function documentoDeAlta(alta, { ahora, fuente }) {
  return {
    code: alta.code,
    breakdown: desglose(alta.code),
    description: { es: alta.descripcionEs, en: alta.descripcionEn },
    level: alta.level,
    isLeaf: alta.isLeaf,
    isActive: true,
    validFrom: alta.validFrom || undefined,
    ...(alta.ruta ? { legalDescription: alta.ruta.join(SEPARADOR_RUTA) } : {}),
    keywords: palabrasClave(alta.ruta ? [...alta.ruta].reverse().join(' ') : alta.descripcionEs, 25),
    duties: derechosDeAlta(alta, { ahora, fuente }),
    notes: alta.descripcionEsOrigen === 'ingles_pendiente_de_traduccion' ? ['Descripcion oficial todavia no disponible en español'] : [],
    lastUpdated: ahora
  };
}

const ROTULO = 'Third country duty';
const CAMPOS_DEL_DERECHO = ['specific', 'combinacion', 'minimo', 'maximo', 'variantes', 'formula'];
const legible = (c) => `${c.thirdCountry ?? 'sin dato'} %${c.specific ? ` + ${c.specific.amount} ${c.specific.unit}` : ''}`;
const herenciaDe = (dato) => (dato.heredadoDe === dato.code ? '' : ` (heredado de ${dato.heredadoDe})`);

/**
 * Operacion que fija un derecho: rutas puntuales (`duties.thirdCountry`…),
 * nunca el objeto `duties` entero, que borraria la sancion a Rusia y lo demas
 * que cuelga de el. Cada campo del derecho se fija o se borra: no puede quedar
 * un importe por unidad, un minimo, unas variantes o una formula de una carga
 * anterior.
 */
function fijarDerecho(code, campos, origen, { ahora, sancion } = {}) {
  const $set = { 'duties.thirdCountry': campos.thirdCountry ?? null, 'duties.origen': origen, lastUpdated: ahora };
  const $unset = {};
  for (const campo of CAMPOS_DEL_DERECHO) {
    if (campos[campo]) $set[`duties.${campo}`] = campos[campo];
    else $unset[`duties.${campo}`] = '';
  }
  // La sancion solo se escribe si la fuente la da: no se borra una contrastada a mano.
  if (sancion) $set['duties.sancionRusiaBielorrusia'] = sancion;
  return { updateOne: { filter: { code }, update: { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) } } };
}

const origenOficial = (dato, { ahora, fuente, forma, extra = '' }) => ({
  fuente: 'taric_oficial', consultadoEl: ahora, metodo: 'fichero_circabc', rotulo: dato.rotulo || ROTULO,
  ...(forma ? { forma } : {}),
  evidencia: `«${dato.texto}»${herenciaDe(dato)}. ${fuente}.${extra}`.slice(0, 500),
  ...(dato.soloDestinoFinal ? { soloDestinoFinal: true } : {})
});

const variantesLegibles = (variantes) => ` Segun codigo adicional: ${variantes.map((v) => `${v.codigoAdicional} ${v.descripcion || 'sin descripcion oficial'}: ${v.texto}`).join('; ')}.`;

/**
 * Operaciones de escritura de las correcciones de aranceles (`corregirAranceles`).
 *
 * @param {object} a resultado de `corregirAranceles`
 * @param {{ ahora: Date, fuente: string }} contexto
 * @returns {object[]} operaciones de `bulkWrite`
 */
function operacionesDeAranceles(a, { ahora, fuente }) {
  const arancel = (dato, corregido) => fijarDerecho(dato.code, dato,
    origenOficial(dato, { ahora, fuente, extra: corregido ? ` Antes: ${legible(dato.antes)}.` : '' }), { ahora, sancion: dato.sancion });
  return [
    ...(a.corregir || []).map((d) => arancel(d, true)),
    ...(a.contrastar || []).map((d) => arancel(d, false)),
    // Misma cifra, unidad escrita de otra forma (EUR/tonne -> EUR/1000 kg): solo la unidad.
    ...(a.unidades || []).map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: Object.fromEntries(d.unidades.map((u) => [`duties.${u.campo}.unit`, u.unit])) } } })),
    // Varios tipos segun codigo adicional: sin tipo unico (null), con las variantes y su descripcion oficial.
    ...(a.variantes || []).map((d) => fijarDerecho(d.code, { thirdCountry: null, variantes: d.variantes },
      origenOficial(d, { ahora, fuente, forma: 'variantes_codigo_adicional', extra: variantesLegibles(d.variantes) }), { ahora })),
    // Suma con minimo o maximo: la formula oficial, y el porcentaje para quien solo lee ese campo.
    ...(a.compuestos || []).map((d) => fijarDerecho(d.code, { thirdCountry: d.thirdCountry, specific: d.specific, combinacion: d.combinacion, formula: d.formula },
      origenOficial(d, { ahora, fuente, forma: 'compuesto' }), { ahora })),
    // Derecho oficial que LUCI no sabe liquidar: el dato antiguo se queda, marcado y con el texto oficial y lo que falta.
    ...(a.noCalculables || []).map((d) => ({
      updateOne: {
        filter: { code: d.code },
        update: { $set: { 'duties.origen': origenNoCalculable(d, ahora), lastUpdated: ahora } }
      }
    })),
    // Capitulos 98 y 99: el TARIC no les asigna derecho de terceros paises.
    ...(a.sinDerecho || []).map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: { 'duties.thirdCountry': null, 'duties.origen': { fuente: 'sin_derecho_oficial', consultadoEl: ahora, metodo: 'fichero_circabc', evidencia: evidenciaSinDerecho(d.code, fuente) }, lastUpdated: ahora } } } }))
  ];
}

const origenNoCalculable = (d, ahora) => ({
  fuente: 'no_calculable', consultadoEl: ahora, metodo: 'fichero_circabc', rotulo: ROTULO, evidencia: d.evidencia,
  ...(d.texto ? { textoOficial: d.texto } : {}), ...(d.forma ? { forma: d.forma } : {}), ...(d.faltan ? { faltan: d.faltan } : {})
});

/**
 * Escribe el plan en el catalogo. Las bajas no se borran: quedan inactivas.
 *
 * @param {object} plan resultado de `prepararSincronizacion`
 * @param {{ TaricCode: object, ahora?: Date, corregir?: boolean }} deps `corregir: false` deja como estan las
 *   descripciones y los aranceles de los codigos que ya existen
 * @returns {Promise<{ altas: number, bajas: number, reactivados: number, declarable: number, nivel: number, correcciones: object }>}
 */
async function aplicarSincronizacion(plan, { TaricCode, ahora = new Date(), corregir = true }) {
  const fuente = `${plan.fuente.nombre}, ${plan.fuente.mes}`;
  const operaciones = [
    ...plan.bajas.map((b) => ({ updateOne: { filter: { code: b.code }, update: { $set: { isActive: false, validTo: ahora, lastUpdated: ahora } } } })),
    ...plan.reactivar.map((r) => ({ updateOne: { filter: { code: r.code }, update: { $set: { isActive: true, lastUpdated: ahora }, $unset: { validTo: '' } } } })),
    ...plan.declarable.map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: { isLeaf: d.isLeaf, lastUpdated: ahora } } } })),
    ...plan.nivel.map((n) => ({ updateOne: { filter: { code: n.code }, update: { $set: { level: n.level, lastUpdated: ahora } } } }))
  ];
  if (operaciones.length > 0) await TaricCode.bulkWrite(operaciones, { ordered: false });

  const correcciones = { descripciones: 0, aranceles: 0, arancelesContrastados: 0, unidades: 0, noCalculables: 0, sinDerecho: 0, variantes: 0, compuestos: 0 };
  if (corregir && plan.correcciones) {
    const fijar = (cambio) => {
      const set = { lastUpdated: ahora };
      if (cambio.es) set['description.es'] = cambio.es;
      if (cambio.en) set['description.en'] = cambio.en;
      if (cambio.legalDescription) { set.legalDescription = cambio.legalDescription; set.keywords = cambio.keywords; }
      return { updateOne: { filter: { code: cambio.code }, update: { $set: set } } };
    };
    const a = plan.correcciones.aranceles;
    const lotes = [...plan.correcciones.descripciones.map(fijar), ...operacionesDeAranceles(a, { ahora, fuente })];
    for (let i = 0; i < lotes.length; i += TAMANO_LOTE) await TaricCode.bulkWrite(lotes.slice(i, i + TAMANO_LOTE), { ordered: false });
    correcciones.descripciones = plan.correcciones.descripciones.length;
    correcciones.aranceles = a.corregir.length;
    correcciones.arancelesContrastados = a.contrastar.length;
    correcciones.unidades = (a.unidades || []).length;
    correcciones.noCalculables = (a.noCalculables || []).length;
    correcciones.sinDerecho = (a.sinDerecho || []).length;
    correcciones.variantes = (a.variantes || []).length;
    correcciones.compuestos = (a.compuestos || []).length;
  }

  if (plan.altas.length > 0) {
    await TaricCode.insertMany(plan.altas.map((a) => documentoDeAlta(a, { ahora, fuente })), { ordered: false });
  }
  return { altas: plan.altas.length, bajas: plan.bajas.length, reactivados: plan.reactivar.length, declarable: plan.declarable.length, nivel: plan.nivel.length, correcciones };
}

module.exports = { prepararSincronizacion, aplicarSincronizacion, documentoDeAlta, derechosDeAlta, operacionesDeAranceles };
