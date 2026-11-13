/**
 * Altas de codigos que traen las publicaciones diarias del TARIC.
 *
 * Un codigo nuevo entra en el catalogo el dia que entra en vigor, sin esperar a
 * la extraccion mensual, solo si la publicacion da todo lo necesario sin
 * interpretarlo:
 *   - descripcion oficial en español (si falta, o es el texto ingles, espera);
 *   - nivel 10: en la nomenclatura oficial toda linea 80 de nivel 10 es
 *     declarable (medido en la de noviembre de 2026: 9.584 de 9.584). Si es de
 *     otro nivel, si se declara o no lo decide la sincronizacion mensual;
 *   - derecho de terceros paises como lo da la sincronizacion mensual: el del
 *     propio codigo o heredado por prefijo, del fichero de CIRCABC del mes con
 *     los cambios de las publicaciones diarias encima. Si LUCI no sabe
 *     liquidarlo, entra como `no_calculable` con el texto oficial.
 *
 * El codigo declarable del que cuelga deja de serlo (3908100000 al dividirse
 * en 3908100010 y 3908100090 el 06/11/2026).
 *
 * Mismo freno que los derechos: si en una pasada hay mas altas que
 * MAXIMO_A_APLICAR no se aplica ninguna.
 */
const logger = require('../../../config/logger');
const { leerPrimeraHoja } = require('../xlsxSimple');
const { leerDerechosTercerosPaises, arancelDe } = require('../arancelesOficiales');
const { textoLegible } = require('../nomenclaturaOficial');
const { documentoDeAlta } = require('../sincronizacionTaric');
const { huella, SEPARADOR_RUTA } = require('../correccionesCatalogo');
const circabc = require('../circabcTaric');
const publicaciones = require('./publicacionesDiarias');
const { cambiosDe, hoyOrdenable, MAXIMO_A_APLICAR } = require('./sincronizacionDiaria');

const NIVEL_DECLARABLE = 10;
const CORTES_DE_ANCESTRO = [8, 6, 4, 2];
const MEDIDA_TERCEROS_PAISES = '103';
const ERGA_OMNES = '1011';

/** «20261106» -> «06/11/2026». */
const legible = (ordenable) => `${ordenable.slice(6, 8)}/${ordenable.slice(4, 6)}/${ordenable.slice(0, 4)}`;
/** «20261106» -> Date a mediodia UTC, como las fechas del fichero mensual. */
const fechaDe = (ordenable) => new Date(Date.UTC(Number(ordenable.slice(0, 4)), Number(ordenable.slice(4, 6)) - 1, Number(ordenable.slice(6, 8)), 12));
const ancestros = (code) => [...new Set(CORTES_DE_ANCESTRO.map((corte) => code.slice(0, corte).padEnd(10, '0')))].filter((c) => c !== code);

/** Derechos de terceros paises vigentes segun el fichero mensual de CIRCABC. */
async function derechosDeCircabc({ ahora }) {
  const { mes, contenido } = await circabc.ficheroDeDerechos();
  return { mes: `${mes.anio}-${String(mes.mes).padStart(2, '0')}`, derechos: leerDerechosTercerosPaises(leerPrimeraHoja(contenido), { fecha: ahora }) };
}

/**
 * Derechos del fichero mensual con los cambios de las publicaciones diarias
 * posteriores encima (derecho 103 ERGA OMNES ya en vigor). Un codigo con
 * varias medidas en el fichero (codigos adicionales) se deja como esta.
 */
function derechosVigentes(mensual, publicadas, hoy) {
  const mapa = new Map(mensual.derechos);
  const diarios = new Map();
  const inicioDelMes = `${mensual.mes.replace('-', '')}01`;
  for (const p of publicadas) {
    for (const c of p.cambios) {
      if (c.clase !== 'derecho' || c.tipo !== MEDIDA_TERCEROS_PAISES || c.origen !== ERGA_OMNES) continue;
      if ((mapa.get(c.code) || []).length > 1) continue;
      if (c.desde < inicioDelMes && p.nombre.slice(6, 14) < inicioDelMes) continue;
      if (c.accion === 'baja') {
        if (c.hasta && c.hasta < hoy) { mapa.delete(c.code); diarios.delete(c.code); }
      } else if ((!c.desde || c.desde <= hoy) && (!c.hasta || c.hasta >= hoy)) {
        mapa.set(c.code, [{ codigoAdicional: '', texto: c.detalle }]);
        diarios.set(c.code, p.nombre);
      }
    }
  }
  return { mapa, diarios };
}

/** Por que un alta no se puede dar hoy, o null si se puede. */
function motivoParaEsperar(c, hoy) {
  if (c.hasta && c.hasta < hoy) return { estado: 'informativo', motivo: `Código de vigencia limitada que terminó el ${legible(c.hasta)}` };
  if (c.desde && c.desde > hoy) return { estado: 'pendiente', motivo: `Código nuevo: entra en vigor el ${legible(c.desde)} y se da de alta ese día` };
  if (!c.nivel) return { estado: 'pendiente', motivo: 'Código nuevo: falta su nivel; se completa al volver a leer la publicación' };
  if (c.nivel !== NIVEL_DECLARABLE) return { estado: 'pendiente', motivo: `Código nuevo de nivel ${c.nivel}: si se declara lo decide la sincronización mensual` };
  if (!String(c.detalle || '').trim()) return { estado: 'pendiente', motivo: 'Código nuevo sin descripción en español en la publicación: espera a la sincronización mensual' };
  if (c.detalleEn && huella(c.detalle) === huella(c.detalleEn)) {
    return { estado: 'pendiente', motivo: 'Código nuevo cuyo texto «en español» de la publicación es el inglés: espera a la sincronización mensual' };
  }
  return null;
}

/** Ruta en el arbol: la del ancestro mas cercano que el catalogo tiene, mas la descripcion propia. */
function rutaDe(code, descripcion, porCodigo) {
  const ancestro = ancestros(code).map((c) => porCodigo.get(c)).find((d) => d && d.level < NIVEL_DECLARABLE && (d.legalDescription || d.description?.es));
  const base = ancestro ? (ancestro.legalDescription ? ancestro.legalDescription.split(SEPARADOR_RUTA) : [ancestro.description.es]) : [];
  return [...base, descripcion];
}

/** Documento del catalogo para un alta diaria, con la misma forma que las altas mensuales. */
function documentoDeAltaDiaria(c, { arancel, porDiario, mes, porCodigo, ahora }) {
  const descripcionEs = textoLegible(c.detalle);
  const origenDerecho = porDiario ? `derecho de la publicacion diaria ${porDiario}` : `derecho del fichero CIRCABC ${mes}`;
  const fuente = `Comision Europea - TARIC, publicacion diaria ${c.publicacion} (en vigor desde ${legible(c.desde)}); ${origenDerecho}`;
  const base = documentoDeAlta({
    code: c.code, level: NIVEL_DECLARABLE, isLeaf: true, descripcionEs, descripcionEn: c.detalleEn ? textoLegible(c.detalleEn) : undefined,
    descripcionEsOrigen: 'publicacion_diaria', validFrom: fechaDe(c.desde), ruta: rutaDe(c.code, descripcionEs, porCodigo), arancel
  }, { ahora, fuente });
  const origen = base.duties.origen;
  return {
    ...base,
    duties: { ...base.duties, origen: porDiario && origen.metodo ? { ...origen, metodo: 'publicacion_diaria' } : origen },
    ...(c.hasta ? { validTo: fechaDe(c.hasta) } : {}),
    notes: [`Alta desde la publicacion diaria del TARIC ${c.publicacion}, en vigor desde ${legible(c.desde)}`],
    altaDiaria: { publicacion: c.publicacion, enVigorDesde: fechaDe(c.desde), aplicadaEl: ahora }
  };
}

/**
 * Que altas pendientes entrarian hoy en el catalogo. No escribe nada.
 *
 * @returns {Promise<{ aplicar: Array<{ cambio, documento }>, padres: string[], yaEnCatalogo: object[], esperando: object[], retenido: string|null }>}
 */
async function prepararAltas({ TaricCode, TaricDailyPublication, ahora = new Date(), derechos = derechosDeCircabc, publicaciones: enMemoria = null }) {
  const hoy = hoyOrdenable(ahora);
  // `publicaciones`: las ya cargadas (simulacion sin escribir); si no, se leen de la base de datos.
  const ordenadas = enMemoria ? [...enMemoria].sort((a, b) => a.nombre.localeCompare(b.nombre)) : null;
  const esAltaPendiente = (c) => c.clase === 'codigo' && c.accion === 'alta' && c.estado === 'pendiente';
  const conAltas = ordenadas
    ? ordenadas.filter((p) => p.cambios.some(esAltaPendiente))
    : await TaricDailyPublication.find({ cambios: { $elemMatch: { clase: 'codigo', accion: 'alta', estado: 'pendiente' } } }).sort({ nombre: 1 }).lean();
  // Si un codigo aparece en varias publicaciones, manda la mas reciente.
  const ultimo = new Map();
  for (const p of conAltas) {
    for (const c of p.cambios) if (esAltaPendiente(c)) ultimo.set(c.code, { ...c, publicacion: p.nombre });
  }
  const candidatos = [...ultimo.values()];
  const codigos = [...new Set(candidatos.flatMap((c) => [c.code, ...ancestros(c.code)]))];
  const docs = codigos.length > 0
    ? await TaricCode.find({ code: { $in: codigos } }, { code: 1, level: 1, isLeaf: 1, isActive: 1, legalDescription: 1, 'description.es': 1 }).lean()
    : [];
  const porCodigo = new Map(docs.map((d) => [d.code, d]));

  const plan = { aplicar: [], padres: [], yaEnCatalogo: [], esperando: [], retenido: null };
  const listas = [];
  for (const c of candidatos) {
    const doc = porCodigo.get(c.code);
    if (doc?.isActive) { plan.yaEnCatalogo.push(c); continue; }
    const espera = doc
      ? { estado: 'pendiente', motivo: 'El código existe dado de baja en el catálogo: lo reactiva la sincronización mensual' }
      : motivoParaEsperar(c, hoy);
    if (espera) plan.esperando.push({ cambio: c, ...espera });
    else listas.push(c);
  }
  if (listas.length === 0) return plan;

  let vigentes;
  let mes;
  try {
    const mensual = await derechos({ ahora });
    mes = mensual.mes;
    const conDerechos = ordenadas
      ? ordenadas.filter((p) => p.cambios.some((c) => c.clase === 'derecho'))
      : await TaricDailyPublication.find({ 'cambios.clase': 'derecho' }, { nombre: 1, cambios: 1 }).sort({ nombre: 1 }).lean();
    vigentes = derechosVigentes(mensual, conDerechos, hoy);
  } catch (error) {
    return { ...plan, retenido: `No se pudo leer el fichero de derechos de CIRCABC (${error.message}): las ${listas.length} altas esperan a la próxima pasada` };
  }

  for (const c of listas) {
    const arancel = arancelDe(c.code, vigentes.mapa);
    const porDiario = arancel.heredadoDe ? vigentes.diarios.get(arancel.heredadoDe) : null;
    plan.aplicar.push({ cambio: c, documento: documentoDeAltaDiaria(c, { arancel, porDiario, mes, porCodigo, ahora }) });
  }
  const padres = listas.flatMap((c) => ancestros(c.code).map((a) => porCodigo.get(a))
    .filter((d) => d && d.isActive && d.isLeaf && d.level < NIVEL_DECLARABLE && d.code.slice(0, d.level) === c.code.slice(0, d.level)).map((d) => d.code));
  plan.padres = [...new Set(padres)].sort();
  if (plan.aplicar.length > MAXIMO_A_APLICAR) {
    plan.retenido = `${plan.aplicar.length} altas de código en una pasada (máximo ${MAXIMO_A_APLICAR}): revísalas antes de aplicar`;
  }
  return plan;
}

async function marcarAltas(TaricDailyPublication, marcas, ahora) {
  for (const { code, estado, motivo } of marcas) {
    const filtro = { 'x.clase': 'codigo', 'x.accion': 'alta', 'x.code': code, 'x.estado': 'pendiente' };
    const $set = { 'cambios.$[x].estado': estado, ...(motivo ? { 'cambios.$[x].motivo': motivo } : {}), ...(estado === 'aplicado' ? { 'cambios.$[x].aplicadoEn': ahora } : {}) };
    await TaricDailyPublication.updateMany(
      { cambios: { $elemMatch: { clase: 'codigo', accion: 'alta', code, estado: 'pendiente' } } },
      { $set },
      { arrayFilters: [filtro] }
    );
  }
}

/**
 * Da de alta en el catalogo los codigos nuevos ya en vigor. Con `forzar` se
 * salta el limite de altas por pasada.
 */
async function aplicarAltas({ TaricCode, TaricDailyPublication, ahora = new Date(), derechos = derechosDeCircabc, forzar = false }) {
  const plan = await prepararAltas({ TaricCode, TaricDailyPublication, ahora, derechos });
  await marcarAltas(TaricDailyPublication, [
    ...plan.yaEnCatalogo.map((c) => ({ code: c.code, estado: 'en_catalogo', motivo: 'Ya estaba en el catálogo' })),
    ...plan.esperando.map((e) => ({ code: e.cambio.code, estado: e.estado, motivo: e.motivo }))
  ], ahora);
  const resumen = { yaEnCatalogo: plan.yaEnCatalogo.length, esperando: plan.esperando.length };
  if (plan.aplicar.length === 0) return { altas: 0, ...resumen, ...(plan.retenido ? { retenido: plan.retenido } : {}) };
  if (plan.retenido && !forzar) return { altas: 0, ...resumen, retenido: plan.retenido };

  await TaricCode.insertMany(plan.aplicar.map((a) => a.documento), { ordered: false });
  if (plan.padres.length > 0) {
    await TaricCode.bulkWrite(plan.padres.map((code) => ({
      updateOne: { filter: { code, isLeaf: true }, update: { $set: { isLeaf: false, lastUpdated: ahora } } }
    })), { ordered: false });
  }
  await marcarAltas(TaricDailyPublication, plan.aplicar.map((a) => ({ code: a.cambio.code, estado: 'aplicado', motivo: 'Dado de alta desde la publicación diaria' })), ahora);
  const codigos = plan.aplicar.map((a) => a.cambio.code);
  logger.info(`[TARIC] Publicación diaria: ${codigos.length} códigos dados de alta (${codigos.join(', ')})${plan.padres.length > 0 ? `; dejan de ser declarables: ${plan.padres.join(', ')}` : ''}`);
  return { altas: codigos.length, ...resumen, codigos, padres: plan.padres };
}

/** Lo ya aplicado de una publicacion se conserva al volver a leerla. */
function conservarAplicados(antes, nuevos) {
  const clave = (c) => [c.clase, c.code, c.tipo || '', c.accion, c.desde || '', c.detalle || ''].join('|');
  const aplicados = new Map(antes.filter((c) => c.estado === 'aplicado').map((c) => [clave(c), c]));
  return nuevos.map((c) => {
    const previo = aplicados.get(clave(c));
    return previo ? { ...c, estado: 'aplicado', motivo: previo.motivo, aplicadoEn: previo.aplicadoEn } : c;
  });
}

/** ¿Tiene la publicacion altas pendientes registradas antes de que se guardara su nivel? */
const estaIncompleta = (p) => p.cambios.some((c) => c.clase === 'codigo' && c.accion === 'alta' && c.estado === 'pendiente' && c.nivel == null);

/**
 * Vuelve a descargar y leer una publicacion registrada, conservando lo ya
 * aplicado. No escribe nada: devuelve la publicacion como quedaria.
 */
async function releerEnMemoria(p, { TaricCode, descargar = publicaciones.descargarPublicacion, leerCambios = cambiosDe }) {
  const { cambios, resumen } = await leerCambios(await descargar({ nombre: p.nombre, fecha: p.fecha }), { TaricCode });
  return { ...p, cambios: conservarAplicados(p.cambios, cambios), resumen };
}

/**
 * Publicaciones registradas antes de que se guardara el nivel de las altas: se
 * vuelven a descargar y leer. Solo cambia el registro diario, no el catalogo.
 */
async function releerPublicacionesIncompletas({
  TaricCode, TaricDailyPublication, descargar = publicaciones.descargarPublicacion, leerCambios = cambiosDe
}) {
  const incompletas = await TaricDailyPublication.find(
    { cambios: { $elemMatch: { clase: 'codigo', accion: 'alta', estado: 'pendiente', nivel: { $exists: false } } } },
    { nombre: 1, fecha: 1, cambios: 1 }
  ).sort({ nombre: 1 }).lean();
  const releidas = [];
  const fallidas = [];
  for (const p of incompletas) {
    try {
      const releida = await releerEnMemoria(p, { TaricCode, descargar, leerCambios });
      await TaricDailyPublication.updateOne({ _id: p._id }, { $set: { cambios: releida.cambios, resumen: releida.resumen } });
      releidas.push(p.nombre);
    } catch (error) {
      fallidas.push({ nombre: p.nombre, error: error.message });
      logger.warn(`[TARIC] No se pudo volver a leer la publicación diaria ${p.nombre}: ${error.message}`);
    }
  }
  return { releidas, fallidas };
}

module.exports = {
  prepararAltas, aplicarAltas, releerPublicacionesIncompletas, releerEnMemoria, estaIncompleta, derechosDeCircabc, derechosVigentes, motivoParaEsperar, NIVEL_DECLARABLE
};
