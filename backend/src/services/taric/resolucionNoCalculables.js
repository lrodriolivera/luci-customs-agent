/**
 * Resolucion de los codigos del catalogo marcados como «no calculables»
 * (`duties.origen.fuente = 'no_calculable'`) contra el fichero oficial de
 * derechos del mes. Lo usa el guion `resolverArancelesNoCalculables.js`.
 *
 * `planResolucion` es pura: agrupa por forma del derecho, dice que se haria con
 * cada grupo y lista los conflictos. `aplicarResolucion` escribe, con un limite
 * de cambios por pasada; repetida, termina sin cambios.
 */
const { arancelDe } = require('./arancelesOficiales');
const { corregirAranceles, resolverDerechoNoSimple } = require('./correccionesCatalogo');
const { operacionesDeAranceles } = require('./sincronizacionTaric');

const EJEMPLOS_POR_GRUPO = 5;
// Orden en que se escriben los cambios: primero lo que pasa a ser calculable.
const LISTAS = ['variantes', 'compuestos', 'corregir', 'contrastar', 'noCalculables', 'sinDerecho'];

/** Forma y accion de un codigo, aunque no cambie nada (para los totales por grupo). */
function formaDe(oficial, opciones) {
  if (oficial.estado === 'sin_medida') return { forma: 'sin_medida', accion: 'conflicto' };
  if (oficial.estado === 'ok') {
    return { forma: oficial.codigosAdicionales ? 'mismo_derecho_en_sus_codigos_adicionales' : 'ahora_simple', accion: 'corregir' };
  }
  const r = resolverDerechoNoSimple(oficial, opciones);
  if (r.tipo === 'variantes') return { forma: 'variantes_codigo_adicional', accion: 'variantes', variantes: r.variantes };
  if (r.tipo === 'compuesto') return { forma: 'compuesto', accion: 'formula' };
  return { forma: r.forma, accion: 'no_calculable', faltan: r.faltan };
}

/**
 * @param {object[]} catalogo codigos del catalogo (se usan solo los «no calculables» activos)
 * @param {Map} derechos `leerDerechosTercerosPaises`
 * @param {{ codigosAdicionales?: Map<string, string> }} [opciones]
 * @returns {{ total: number, grupos: object[], cambios: object, conflictos: object[], pendientes: number }}
 */
function planResolucion(catalogo, derechos, opciones = {}) {
  const candidatos = catalogo.filter((c) => c.isActive !== false && c.duties?.origen?.fuente === 'no_calculable');
  const grupos = new Map();
  const grupoDe = new Map();
  const conflictos = [];
  for (const actual of candidatos) {
    const oficial = arancelDe(actual.code, derechos);
    const { forma, accion, faltan, variantes } = formaDe(oficial, opciones);
    const grupo = grupos.get(forma) || { forma, accion, codigos: 0, cambian: 0, faltan: faltan || [], ejemplos: [] };
    grupo.codigos += 1;
    if (grupo.ejemplos.length < EJEMPLOS_POR_GRUPO) grupo.ejemplos.push({ code: actual.code, texto: oficial.texto || null, heredadoDe: oficial.heredadoDe || null });
    grupos.set(forma, grupo);
    grupoDe.set(actual.code, forma);

    if (forma === 'sin_medida') {
      conflictos.push({ code: actual.code, motivo: 'sin derecho de terceros paises vigente en el fichero oficial: revisar a mano' });
    }
    const sinDescripcion = (variantes || []).filter((v) => !v.descripcion).map((v) => v.codigoAdicional);
    if (sinDescripcion.length > 0) {
      conflictos.push({ code: actual.code, motivo: `sin descripcion oficial del codigo adicional ${sinDescripcion.join(', ')}: no se escribe` });
    }
  }

  const aranceles = corregirAranceles(candidatos, derechos, opciones);
  const enConflicto = new Set(conflictos.map((c) => c.code));
  const cambios = Object.fromEntries(LISTAS.map((lista) => [lista, (aranceles[lista] || []).filter((d) => !enConflicto.has(d.code))]));
  for (const d of aranceles.conflictos) conflictos.push({ code: d.code, motivo: `contrastado antes a mano y distinto del oficial «${d.texto}»` });

  // Cuantos cambian de cada grupo: los que estan en alguna lista de cambios.
  const cambia = new Set(LISTAS.flatMap((l) => cambios[l].map((d) => d.code)));
  for (const code of cambia) grupos.get(grupoDe.get(code)).cambian += 1;

  return {
    total: candidatos.length,
    grupos: [...grupos.values()].sort((a, b) => b.codigos - a.codigos),
    cambios,
    conflictos,
    pendientes: cambia.size
  };
}

/**
 * Escribe hasta `limite` cambios del plan, en el orden de `LISTAS`.
 *
 * @returns {Promise<{ escritos: number, pendientes: number, porLista: object }>}
 */
async function aplicarResolucion(plan, { TaricCode, ahora = new Date(), fuente, limite }) {
  if (!Number.isInteger(limite) || limite <= 0) throw new Error('aplicarResolucion: el limite de cambios por pasada es obligatorio');
  let restantes = limite;
  const seleccion = {};
  for (const lista of LISTAS) {
    seleccion[lista] = plan.cambios[lista].slice(0, restantes);
    restantes -= seleccion[lista].length;
  }
  const operaciones = operacionesDeAranceles(seleccion, { ahora, fuente });
  if (operaciones.length > 0) await TaricCode.bulkWrite(operaciones, { ordered: false });
  const escritos = LISTAS.reduce((n, l) => n + seleccion[l].length, 0);
  return {
    escritos,
    pendientes: plan.pendientes - escritos,
    porLista: Object.fromEntries(LISTAS.map((l) => [l, seleccion[l].length]))
  };
}

module.exports = { planResolucion, aplicarResolucion, LISTAS };
