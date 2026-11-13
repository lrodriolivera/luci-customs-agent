/**
 * Publicaciones diarias del TARIC: se leen las que aun no se han visto, se
 * guarda lo que traen de interes para LUCI y se compara con el catalogo.
 *
 * Leer y registrar no modifica el catalogo. Aplicar (automatico tras la
 * sincronizacion diaria, salvo TARIC_DIARIO_APLICAR=false) esta limitado al
 * caso bien definido del derecho de terceros paises (o de destino final) que
 * cambia en un codigo declarable ya existente y que ya esta en vigor. Las altas
 * de codigos en vigor las da `altasDiarias.js`. Las bajas, los cambios de
 * descripcion y los derechos fijados en un nivel superior quedan anotados; los
 * incorpora la sincronizacion con la extraccion mensual.
 */
const logger = require('../../../config/logger');
const { leerPrimeraHoja } = require('../xlsxSimple');
const { interpretarDerecho, camposDeDerecho } = require('../arancelesOficiales');
const { aplicarSincronizacion } = require('../sincronizacionTaric');
const { leerNomenclaturaDiaria, leerMedidasDiarias, enVigor } = require('./cambiosDiarios');
const publicaciones = require('./publicacionesDiarias');

const FUENTE = 'Comision Europea - TARIC (publicacion diaria)';
// Mas cambios de derecho que estos en una pasada no se aplican solos: se revisan.
const MAXIMO_A_APLICAR = 50;
// En la primera pasada no se recorre todo el historico de la pagina.
const MAXIMO_POR_PASADA = 10;

const hoyOrdenable = (fecha = new Date()) => fecha.toISOString().slice(0, 10).replace(/-/g, '');
const normalizar = (texto) => String(texto || '').toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/g, '');
const mismoImporte = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.0005);

/** ¿Coincide el derecho del catalogo con el del fichero? */
function mismoDerecho(duties, campos) {
  const actual = duties || {};
  return mismoImporte(actual.thirdCountry, campos.thirdCountry)
    && mismoImporte(actual.specific?.amount, campos.specific?.amount)
    && (actual.specific?.unit || null) === (campos.specific?.unit || null);
}

/** Estado de un cambio frente a lo que hay en el catalogo. */
function clasificar(cambio, doc) {
  if (cambio.clase === 'control') {
    return { estado: 'informativo', motivo: 'Las medidas de control se cargan enteras con la extracción mensual' };
  }
  if (cambio.clase === 'codigo') {
    if (cambio.accion === 'alta') return doc?.isActive ? { estado: 'en_catalogo' } : { estado: 'pendiente', motivo: 'Código nuevo: se da de alta cuando entra en vigor' };
    if (cambio.accion === 'baja') return doc?.isActive ? { estado: 'pendiente', motivo: 'Código que deja de estar vigente: lo da de baja la sincronización mensual' } : { estado: 'en_catalogo' };
    if (!doc) return { estado: 'informativo', motivo: 'El código no está en el catálogo' };
    return normalizar(doc.description?.es) === normalizar(cambio.detalle)
      ? { estado: 'en_catalogo' }
      : { estado: 'pendiente', motivo: 'Descripción distinta: la corrige la sincronización mensual' };
  }
  // Derecho de terceros paises o de destino final.
  if (cambio.accion === 'baja') return { estado: 'informativo', motivo: 'Medida retirada: se refleja con la extracción mensual' };
  if (!doc || !doc.isLeaf) return { estado: 'informativo', motivo: 'Derecho fijado en un nivel superior o en un código que no está en el catálogo' };
  const derecho = interpretarDerecho(cambio.detalle);
  if (!derecho) return { estado: 'no_calculable', motivo: 'LUCI no sabe liquidar este derecho' };
  return mismoDerecho(doc.duties, camposDeDerecho(derecho)) ? { estado: 'en_catalogo' } : { estado: 'pendiente' };
}

/** Cambios de una publicacion, ya clasificados contra el catalogo. */
async function cambiosDe(ficheros, { TaricCode }) {
  const nomenclatura = ficheros.nomenclatura ? leerNomenclaturaDiaria(leerPrimeraHoja(ficheros.nomenclatura)) : [];
  const medidas = ficheros.medidas ? leerMedidasDiarias(leerPrimeraHoja(ficheros.medidas)) : { cambios: [], otras: 0 };
  const cambios = [...nomenclatura, ...medidas.cambios];
  const codigos = [...new Set(cambios.map((c) => c.code))];
  const docs = codigos.length > 0
    ? await TaricCode.find({ code: { $in: codigos } }, { code: 1, isActive: 1, isLeaf: 1, 'description.es': 1, duties: 1 }).lean()
    : [];
  const porCodigo = new Map(docs.map((d) => [d.code, d]));
  const clasificados = cambios.map((c) => ({ ...c, ...clasificar(c, porCodigo.get(c.code)) }));
  const contar = (clase, estado) => clasificados.filter((c) => c.clase === clase && (!estado || c.estado === estado)).length;
  return {
    cambios: clasificados,
    resumen: {
      codigos: contar('codigo'), derechos: contar('derecho'), controles: contar('control'), otrasMedidas: medidas.otras,
      pendientes: clasificados.filter((c) => c.estado === 'pendiente').length
    }
  };
}

/**
 * Lee y registra las publicaciones que aun no se han visto (las mas antiguas
 * primero). No modifica el catalogo.
 *
 * @returns {Promise<{ nuevas: Array<{ nombre: string, resumen: object }> }>}
 */
async function registrarPublicacionesNuevas({
  TaricCode, TaricDailyPublication, listar = publicaciones.listarPublicaciones, descargar = publicaciones.descargarPublicacion,
  leerCambios = cambiosDe, ahora = new Date(), maximo = MAXIMO_POR_PASADA
}) {
  const publicadas = await listar();
  const vistas = new Set((await TaricDailyPublication.find({ nombre: { $in: publicadas.map((p) => p.nombre) } }, { nombre: 1 }).lean()).map((p) => p.nombre));
  // De las no vistas, las mas recientes; se procesan de la mas antigua a la mas nueva.
  const porLeer = publicadas.filter((p) => !vistas.has(p.nombre)).slice(0, maximo).reverse();
  const nuevas = [];
  for (const publicacion of porLeer) {
    const { cambios, resumen } = await leerCambios(await descargar(publicacion), { TaricCode });
    await TaricDailyPublication.create({ nombre: publicacion.nombre, fecha: publicacion.fecha, procesadoEn: ahora, resumen, cambios });
    nuevas.push({ nombre: publicacion.nombre, resumen });
    logger.info(`[TARIC] Publicación diaria ${publicacion.nombre}: ${resumen.codigos} códigos, ${resumen.derechos} derechos, ${resumen.controles} controles, ${resumen.pendientes} pendientes`);
  }
  return { nuevas };
}

/**
 * Cambios de derecho pendientes que ya estan en vigor y se pueden aplicar.
 * Vuelve a compararlos con el catalogo: puede haberlos recogido ya la carga
 * mensual.
 */
async function prepararAplicacion({ TaricCode, TaricDailyPublication, ahora = new Date() }) {
  const hoy = hoyOrdenable(ahora);
  const publicacionesConPendientes = await TaricDailyPublication.find({ 'cambios.estado': 'pendiente' }).sort({ nombre: 1 }).lean();
  // Si un codigo cambia en varias publicaciones, manda la mas reciente.
  const ultimo = new Map();
  for (const p of publicacionesConPendientes) {
    for (const c of p.cambios) {
      if (c.clase === 'derecho' && c.estado === 'pendiente' && enVigor(c, hoy)) ultimo.set(c.code, { ...c, publicacion: p.nombre });
    }
  }
  const candidatos = [...ultimo.values()];
  const docs = candidatos.length > 0 ? await TaricCode.find({ code: { $in: candidatos.map((c) => c.code) } }).lean() : [];
  const porCodigo = new Map(docs.map((d) => [d.code, d]));
  const aplicar = [];
  const yaEnCatalogo = [];
  for (const c of candidatos) {
    const doc = porCodigo.get(c.code);
    const derecho = interpretarDerecho(c.detalle);
    if (!doc || !doc.isLeaf || !derecho) continue;
    const campos = camposDeDerecho(derecho);
    if (mismoDerecho(doc.duties, campos)) { yaEnCatalogo.push(c); continue; }
    aplicar.push({
      cambio: c,
      dato: {
        code: c.code, ...campos, texto: c.detalle, heredadoDe: c.code,
        rotulo: c.tipo === '105' ? 'Non preferential duty under end-use' : 'Third country duty',
        ...(c.tipo === '105' ? { soloDestinoFinal: true } : {}),
        antes: { thirdCountry: doc.duties?.thirdCountry ?? null, specific: doc.duties?.specific || null }
      }
    });
  }
  return { aplicar, yaEnCatalogo, retenido: aplicar.length > MAXIMO_A_APLICAR ? `${aplicar.length} cambios de derecho en una pasada (máximo ${MAXIMO_A_APLICAR}): revísalos antes de aplicar` : null };
}

async function marcar(TaricDailyPublication, cambios, estado, ahora) {
  for (const c of cambios) {
    await TaricDailyPublication.updateMany(
      { cambios: { $elemMatch: { clase: 'derecho', code: c.code, estado: 'pendiente' } } },
      { $set: { 'cambios.$[x].estado': estado, ...(estado === 'aplicado' ? { 'cambios.$[x].aplicadoEn': ahora } : {}) } },
      { arrayFilters: [{ 'x.clase': 'derecho', 'x.code': c.code, 'x.estado': 'pendiente' }] }
    );
  }
}

/**
 * Aplica al catalogo los cambios de derecho pendientes ya en vigor.
 * Con `forzar` se salta el limite de cambios por pasada.
 */
async function aplicarPendientes({ TaricCode, TaricDailyPublication, ahora = new Date(), forzar = false }) {
  const plan = await prepararAplicacion({ TaricCode, TaricDailyPublication, ahora });
  await marcar(TaricDailyPublication, plan.yaEnCatalogo, 'en_catalogo', ahora);
  if (plan.aplicar.length === 0) return { aplicados: 0, yaEnCatalogo: plan.yaEnCatalogo.length };
  if (plan.retenido && !forzar) return { aplicados: 0, yaEnCatalogo: plan.yaEnCatalogo.length, retenido: plan.retenido };

  await aplicarSincronizacion({
    fuente: { nombre: FUENTE, mes: plan.aplicar.map((a) => a.cambio.publicacion).sort().pop() },
    altas: [], bajas: [], reactivar: [], declarable: [], nivel: [],
    correcciones: { descripciones: [], aranceles: { corregir: plan.aplicar.map((a) => a.dato), contrastar: [] } }
  }, { TaricCode, ahora });
  await marcar(TaricDailyPublication, plan.aplicar.map((a) => a.cambio), 'aplicado', ahora);
  logger.info(`[TARIC] Publicación diaria: ${plan.aplicar.length} derechos actualizados en el catálogo`);
  return { aplicados: plan.aplicar.length, yaEnCatalogo: plan.yaEnCatalogo.length, codigos: plan.aplicar.map((a) => a.cambio.code) };
}

/** Lo que las publicaciones diarias traen y aun no esta en el catalogo. */
async function estadoDiario({ TaricDailyPublication, limite = 50 }) {
  const ultima = await TaricDailyPublication.findOne({}, { nombre: 1, fecha: 1, procesadoEn: 1, resumen: 1 }).sort({ nombre: -1 }).lean();
  const conPendientes = await TaricDailyPublication.find({ 'cambios.estado': 'pendiente' }, { nombre: 1, cambios: 1 }).sort({ nombre: -1 }).lean();
  const pendientes = conPendientes.flatMap((p) => p.cambios.filter((c) => c.estado === 'pendiente').map((c) => ({ publicacion: p.nombre, ...c })));
  return { ultima, totalPendientes: pendientes.length, pendientes: pendientes.slice(0, limite) };
}

module.exports = {
  registrarPublicacionesNuevas, prepararAplicacion, aplicarPendientes, estadoDiario, clasificar, cambiosDe, mismoDerecho,
  hoyOrdenable, MAXIMO_A_APLICAR, MAXIMO_POR_PASADA, FUENTE
};
