/**
 * Que hay que cambiar en el catalogo TARIC de LUCI para que coincida con la
 * nomenclatura oficial. Funcion pura: no lee ni escribe en ninguna parte.
 *
 * - alta:        codigo oficial que el catalogo no tiene.
 * - baja:        codigo activo del catalogo que ya no esta en la nomenclatura
 *                vigente. No se borra: se marca inactivo, porque puede haber
 *                expedientes antiguos que lo usan.
 * - reactivar:   codigo que estaba de baja y vuelve a estar vigente.
 * - declarable:  codigo cuya marca de «se puede declarar» (isLeaf) no coincide.
 * - nivel:       codigo cuyo nivel jerarquico no coincide.
 *
 * Las descripciones de los codigos que ya existen no se tocan aqui.
 */

/** Minimo de codigos oficiales por debajo del cual el fichero se da por incompleto. */
const MINIMO_CODIGOS_OFICIALES = 15000;
/** Proporcion maxima del catalogo que una sincronizacion puede dar de baja. */
const MAXIMO_BAJAS_RELATIVO = 0.05;

/**
 * @param {Map<string, { nivel: number, validoDesde?: Date|null }>} oficial lineas declarables oficiales
 * @param {Set<string>} declarables codigos oficiales que son hoja
 * @param {Array<{ code: string, level: number, isLeaf: boolean, isActive: boolean, altaDiaria?: object }>} catalogo
 * @param {{ fechaFichero?: Date }} [opciones] fecha a la que esta proyectado el fichero oficial (dia 1 del mes).
 *   Con ella, un codigo dado de alta desde la publicacion diaria que entro en vigor despues no se da de
 *   baja (el fichero aun no puede traerlo) y el codigo del que cuelga no vuelve a marcarse declarable.
 * @returns {{ altas: object[], bajas: object[], reactivar: object[], declarable: object[], nivel: object[], sinCambios: number, posterioresAlFichero: number }}
 */
function planificar(oficial, declarables, catalogo, { fechaFichero = null } = {}) {
  if (!(oficial instanceof Map) || oficial.size < MINIMO_CODIGOS_OFICIALES) {
    throw new Error(`La nomenclatura oficial trae ${oficial?.size ?? 0} codigos: parece incompleta y no se sincroniza`);
  }

  const plan = { altas: [], bajas: [], reactivar: [], declarable: [], nivel: [], sinCambios: 0, posterioresAlFichero: 0 };
  const enCatalogo = new Set();
  const posterior = (c) => Boolean(fechaFichero && c.isActive !== false && c.altaDiaria?.enVigorDesde && new Date(c.altaDiaria.enVigorDesde) > fechaFichero);
  const posteriores = catalogo.filter((c) => posterior(c) && !oficial.has(c.code)).map((c) => c.code);
  const tieneHijoPosterior = (c) => Number(c.level) < 10 && posteriores.some((p) => p !== c.code && p.slice(0, c.level) === c.code.slice(0, c.level));

  for (const actual of catalogo) {
    enCatalogo.add(actual.code);
    const linea = oficial.get(actual.code);
    const activo = actual.isActive !== false;
    if (!linea) {
      if (posterior(actual)) plan.posterioresAlFichero += 1;
      else if (activo) plan.bajas.push({ code: actual.code, level: actual.level });
      continue;
    }
    // Un codigo que el fichero da por declarable pero del que ya cuelga un alta diaria posterior, ya no lo es.
    const esHoja = declarables.has(actual.code) && !tieneHijoPosterior(actual);
    let cambia = false;
    if (!activo) { plan.reactivar.push({ code: actual.code }); cambia = true; }
    if (Boolean(actual.isLeaf) !== esHoja) { plan.declarable.push({ code: actual.code, isLeaf: esHoja }); cambia = true; }
    if (Number(actual.level) !== linea.nivel) { plan.nivel.push({ code: actual.code, level: linea.nivel, antes: actual.level }); cambia = true; }
    if (!cambia) plan.sinCambios += 1;
  }

  for (const [code, linea] of oficial) {
    if (enCatalogo.has(code)) continue;
    plan.altas.push({ code, level: linea.nivel, isLeaf: declarables.has(code), validFrom: linea.validoDesde || null });
  }

  const activos = catalogo.filter((c) => c.isActive !== false).length;
  if (activos > 0 && plan.bajas.length > activos * MAXIMO_BAJAS_RELATIVO) {
    throw new Error(`La sincronizacion daria de baja ${plan.bajas.length} de ${activos} codigos (mas del ${MAXIMO_BAJAS_RELATIVO * 100} %): se detiene por si el fichero oficial esta incompleto`);
  }

  const porCodigo = (a, b) => a.code.localeCompare(b.code);
  ['altas', 'bajas', 'reactivar', 'declarable', 'nivel'].forEach((k) => plan[k].sort(porCodigo));
  return plan;
}

/** Desglose del codigo de 10 digitos, como lo guarda el catalogo. */
const desglose = (code) => ({
  chapter: code.slice(0, 2), heading: code.slice(0, 4), subheading: code.slice(0, 6), cnCode: code.slice(0, 8), taricCode: code
});

const PALABRAS_VACIAS = new Set(['para', 'como', 'esta', 'este', 'estos', 'estas', 'sean', 'sido', 'sobre', 'entre', 'hasta', 'desde', 'cuyo', 'cuya', 'otros', 'otras', 'incluso', 'excepto']);

/** Palabras de busqueda a partir de la descripcion oficial (sin HTML, sin vacias). */
function palabrasClave(descripcion, maximo = 10) {
  const palabras = String(descripcion || '').toLowerCase().replace(/<[^>]+>/g, ' ')
    .split(/[^a-z0-9áéíóúüñ]+/i).filter((p) => p.length >= 4 && !PALABRAS_VACIAS.has(p));
  return [...new Set(palabras)].slice(0, maximo);
}

module.exports = { planificar, desglose, palabrasClave, MINIMO_CODIGOS_OFICIALES, MAXIMO_BAJAS_RELATIVO };
