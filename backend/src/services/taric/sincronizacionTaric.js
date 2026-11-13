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
  corregirDescripciones, corregirAranceles, evidenciaNoCalculable, evidenciaSinDerecho, sinDerechoOficial, SEPARADOR_RUTA
} = require('./correccionesCatalogo');

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
  const aranceles = { ok: 0, variantes: 0, no_simple: 0, sin_medida: 0, sin_fichero: 0 };
  for (const alta of plan.altas) {
    const arancel = derechos ? arancelDe(alta.code, derechos) : { estado: 'sin_fichero' };
    // Un codigo que no se declara solo lleva arancel si la fuente se lo da a el.
    if (!alta.isLeaf && arancel.heredadoDe !== alta.code) continue;
    alta.arancel = arancel;
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
    ? corregirAranceles(comoQuedara, derechos)
    : { corregir: [], contrastar: [], conflictos: [], unidades: [], noCalculables: [], sinDerecho: [] };

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
function derechosDeAlta(alta, { ahora, fuente }) {
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
  // Sin arancel que LUCI sepa liquidar: null, no 0 (un 0 % se leeria como «libre
  // de derechos»), y con el motivo.
  if (a?.estado === 'variantes' || a?.estado === 'no_simple') {
    return { thirdCountry: null, origen: { fuente: 'no_calculable', consultadoEl: ahora, metodo: 'fichero_circabc', rotulo: 'Third country duty', evidencia: evidenciaNoCalculable(a) } };
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

  const correcciones = { descripciones: 0, aranceles: 0, arancelesContrastados: 0, unidades: 0, noCalculables: 0, sinDerecho: 0 };
  if (corregir && plan.correcciones) {
    const fijar = (cambio) => {
      const set = { lastUpdated: ahora };
      if (cambio.es) set['description.es'] = cambio.es;
      if (cambio.en) set['description.en'] = cambio.en;
      if (cambio.legalDescription) { set.legalDescription = cambio.legalDescription; set.keywords = cambio.keywords; }
      return { updateOne: { filter: { code: cambio.code }, update: { $set: set } } };
    };
    // Rutas puntuales (`duties.thirdCountry`), nunca el objeto `duties` entero:
    // asignarlo borraria la sancion a Rusia y lo demas que cuelga de el.
    const legible = (c) => `${c.thirdCountry ?? 'sin dato'} %${c.specific ? ` + ${c.specific.amount} ${c.specific.unit}` : ''}`;
    const arancel = (dato, corregido) => {
      const antes = corregido ? ` Antes: ${legible(dato.antes)}.` : '';
      const herencia = dato.heredadoDe === dato.code ? '' : ` (heredado de ${dato.heredadoDe})`;
      const $set = {
        'duties.thirdCountry': dato.thirdCountry,
        'duties.origen': {
          fuente: 'taric_oficial', consultadoEl: ahora, metodo: 'fichero_circabc', rotulo: dato.rotulo || 'Third country duty',
          evidencia: `«${dato.texto}»${herencia}. ${fuente}.${antes}`.slice(0, 500),
          ...(dato.soloDestinoFinal ? { soloDestinoFinal: true } : {})
        },
        lastUpdated: ahora
      };
      const $unset = {};
      // Cada campo del derecho se fija o se borra: no puede quedar un importe
      // por unidad, un minimo o una combinacion de una carga anterior.
      for (const campo of ['specific', 'combinacion', 'minimo', 'maximo']) {
        if (dato[campo]) $set[`duties.${campo}`] = dato[campo];
        else $unset[`duties.${campo}`] = '';
      }
      // La sancion solo se escribe si la fuente la da: no se borra una contrastada a mano.
      if (dato.sancion) $set['duties.sancionRusiaBielorrusia'] = dato.sancion;
      return { updateOne: { filter: { code: dato.code }, update: { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) } } };
    };
    const a = plan.correcciones.aranceles;
    const lotes = [
      ...plan.correcciones.descripciones.map(fijar),
      ...a.corregir.map((d) => arancel(d, true)),
      ...a.contrastar.map((d) => arancel(d, false)),
      // Misma cifra, unidad escrita de otra forma (EUR/tonne -> EUR/1000 kg): solo la unidad.
      ...(a.unidades || []).map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: Object.fromEntries(d.unidades.map((u) => [`duties.${u.campo}.unit`, u.unit])) } } })),
      // Derecho oficial que LUCI no sabe liquidar: el dato antiguo se queda, marcado y con el texto oficial.
      ...(a.noCalculables || []).map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: { 'duties.origen': { fuente: 'no_calculable', consultadoEl: ahora, metodo: 'fichero_circabc', rotulo: 'Third country duty', evidencia: d.evidencia }, lastUpdated: ahora } } } })),
      // Capitulos 98 y 99: el TARIC no les asigna derecho de terceros paises.
      ...(a.sinDerecho || []).map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: { 'duties.thirdCountry': null, 'duties.origen': { fuente: 'sin_derecho_oficial', consultadoEl: ahora, metodo: 'fichero_circabc', evidencia: evidenciaSinDerecho(d.code, fuente) }, lastUpdated: ahora } } } }))
    ];
    for (let i = 0; i < lotes.length; i += TAMANO_LOTE) await TaricCode.bulkWrite(lotes.slice(i, i + TAMANO_LOTE), { ordered: false });
    correcciones.descripciones = plan.correcciones.descripciones.length;
    correcciones.aranceles = plan.correcciones.aranceles.corregir.length;
    correcciones.arancelesContrastados = plan.correcciones.aranceles.contrastar.length;
    correcciones.unidades = (a.unidades || []).length;
    correcciones.noCalculables = (a.noCalculables || []).length;
    correcciones.sinDerecho = (a.sinDerecho || []).length;
  }

  if (plan.altas.length > 0) {
    await TaricCode.insertMany(plan.altas.map((a) => documentoDeAlta(a, { ahora, fuente })), { ordered: false });
  }
  return { altas: plan.altas.length, bajas: plan.bajas.length, reactivados: plan.reactivar.length, declarable: plan.declarable.length, nivel: plan.nivel.length, correcciones };
}

module.exports = { prepararSincronizacion, aplicarSincronizacion, documentoDeAlta, derechosDeAlta };
