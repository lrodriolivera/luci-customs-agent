/**
 * Puesta al dia del catalogo TARIC de LUCI con la nomenclatura oficial de la
 * Comision Europea.
 *
 * `prepararSincronizacion` no escribe nada: descarga, compara y devuelve el plan
 * con todo lo necesario para aplicarlo. `aplicarSincronizacion` es la unica
 * funcion que modifica la base de datos.
 */
const { leerPrimeraHoja } = require('./xlsxSimple');
const { leerNomenclatura, leerDeclarables } = require('./nomenclaturaOficial');
const { planificar, desglose, palabrasClave } = require('./planSincronizacion');
const circabc = require('./circabcTaric');
const { descripcionOficial } = require('./descripcionOficial');

const PAUSA_ENTRE_CONSULTAS_MS = 60;
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
  const enEspanol = f.nomenclaturaEs ? leerNomenclatura(leerPrimeraHoja(f.nomenclaturaEs)) : new Map();
  log(`Nomenclatura oficial de ${f.mes.name} ${f.mes.anio}: ${oficial.size} codigos, ${declarables.size} declarables` +
    (f.mesEs ? `; español de ${f.mesEs.name} ${f.mesEs.anio}` : '; sin fichero en español'));

  const plan = planificar(oficial, declarables, catalogo);

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
  }

  return {
    ...plan,
    fuente: { nombre: circabc.FUENTE, mes: `${f.mes.anio}-${String(f.mes.mes).padStart(2, '0')}`, mesEspanol: f.mesEs ? `${f.mesEs.anio}-${String(f.mesEs.mes).padStart(2, '0')}` : null },
    resumen: {
      oficiales: oficial.size, declarablesOficiales: declarables.size, catalogo: catalogo.length,
      altas: plan.altas.length, altasDeclarables: plan.altas.filter((a) => a.isLeaf).length, altasSinEspanol: sinEspanol,
      bajas: plan.bajas.length, reactivar: plan.reactivar.length, declarable: plan.declarable.length, nivel: plan.nivel.length,
      sinCambios: plan.sinCambios
    }
  };
}

/** Documento del catalogo para un codigo nuevo. El arancel queda sin dato: no se estima. */
function documentoDeAlta(alta, { ahora, fuente }) {
  return {
    code: alta.code,
    breakdown: desglose(alta.code),
    description: { es: alta.descripcionEs, en: alta.descripcionEn },
    level: alta.level,
    isLeaf: alta.isLeaf,
    isActive: true,
    validFrom: alta.validFrom || undefined,
    keywords: palabrasClave(alta.descripcionEs),
    // Sin arancel contrastado: null, no 0. Un 0 % se leeria como «libre de derechos».
    duties: { thirdCountry: null, origen: { fuente: 'pendiente', consultadoEl: ahora, evidencia: `Alta por sincronizacion con ${fuente}` } },
    notes: alta.descripcionEsOrigen === 'ingles_pendiente_de_traduccion' ? ['Descripcion oficial todavia no disponible en español'] : [],
    lastUpdated: ahora
  };
}

/**
 * Escribe el plan en el catalogo. Las bajas no se borran: quedan inactivas.
 *
 * @param {object} plan resultado de `prepararSincronizacion`
 * @param {{ TaricCode: object, ahora?: Date }} deps
 * @returns {Promise<{ altas: number, bajas: number, reactivados: number, declarable: number, nivel: number }>}
 */
async function aplicarSincronizacion(plan, { TaricCode, ahora = new Date() }) {
  const fuente = `${plan.fuente.nombre}, ${plan.fuente.mes}`;
  const operaciones = [
    ...plan.bajas.map((b) => ({ updateOne: { filter: { code: b.code }, update: { $set: { isActive: false, validTo: ahora, lastUpdated: ahora } } } })),
    ...plan.reactivar.map((r) => ({ updateOne: { filter: { code: r.code }, update: { $set: { isActive: true, lastUpdated: ahora }, $unset: { validTo: '' } } } })),
    ...plan.declarable.map((d) => ({ updateOne: { filter: { code: d.code }, update: { $set: { isLeaf: d.isLeaf, lastUpdated: ahora } } } })),
    ...plan.nivel.map((n) => ({ updateOne: { filter: { code: n.code }, update: { $set: { level: n.level, lastUpdated: ahora } } } }))
  ];
  if (operaciones.length > 0) await TaricCode.bulkWrite(operaciones, { ordered: false });
  if (plan.altas.length > 0) {
    await TaricCode.insertMany(plan.altas.map((a) => documentoDeAlta(a, { ahora, fuente })), { ordered: false });
  }
  return { altas: plan.altas.length, bajas: plan.bajas.length, reactivados: plan.reactivar.length, declarable: plan.declarable.length, nivel: plan.nivel.length };
}

module.exports = { prepararSincronizacion, aplicarSincronizacion, documentoDeAlta };
