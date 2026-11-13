/**
 * Simulacion de una pasada diaria del TARIC sin escribir nada en la base de
 * datos: descarga las publicaciones que aun no se han visto, vuelve a leer las
 * registradas sin nivel, y calcula en memoria que derechos se actualizarian y
 * que codigos se darian de alta. Solo lee de Mongo.
 *
 * Es lo que enseña `procesarDiarioTaric.js` sin `--aplicar`, para pedir el
 * visto bueno antes de aplicar en produccion.
 */
const publicacionesDiarias = require('./publicacionesDiarias');
const { cambiosDe, prepararAplicacion, MAXIMO_POR_PASADA } = require('./sincronizacionDiaria');
const { prepararAltas, releerEnMemoria, estaIncompleta, derechosDeCircabc } = require('./altasDiarias');

/**
 * @returns {Promise<{ nuevas: object[], releidas: string[], fallidas: object[], pendientes: object[], derechos: object, altas: object }>}
 */
async function simularPasada({
  TaricCode, TaricDailyPublication, ahora = new Date(), maximo = MAXIMO_POR_PASADA,
  listar = publicacionesDiarias.listarPublicaciones, descargar = publicacionesDiarias.descargarPublicacion,
  leerCambios = cambiosDe, derechos = derechosDeCircabc
}) {
  const registradas = await TaricDailyPublication.find({}).sort({ nombre: 1 }).lean();
  const vistas = new Set(registradas.map((p) => p.nombre));

  // Publicaciones nuevas, leidas como lo haria la pasada (las mas recientes, de la mas antigua a la mas nueva).
  const porLeer = (await listar()).filter((p) => !vistas.has(p.nombre)).slice(0, maximo).reverse();
  const nuevas = [];
  for (const p of porLeer) {
    const { cambios, resumen } = await leerCambios(await descargar(p), { TaricCode });
    nuevas.push({ nombre: p.nombre, fecha: p.fecha, resumen, cambios });
  }

  // Las registradas sin nivel en sus altas se releen en memoria.
  const releidas = [];
  const fallidas = [];
  const actuales = [];
  for (const p of registradas) {
    if (!estaIncompleta(p)) { actuales.push(p); continue; }
    try {
      actuales.push(await releerEnMemoria(p, { TaricCode, descargar, leerCambios }));
      releidas.push(p.nombre);
    } catch (error) {
      fallidas.push({ nombre: p.nombre, error: error.message });
      actuales.push(p);
    }
  }

  const todas = [...actuales, ...nuevas].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const pendientes = [...todas].reverse().flatMap((p) => p.cambios.filter((c) => c.estado === 'pendiente').map((c) => ({ publicacion: p.nombre, ...c })));
  return {
    nuevas: nuevas.map((n) => ({ nombre: n.nombre, resumen: n.resumen })),
    releidas, fallidas, pendientes,
    derechos: await prepararAplicacion({ TaricCode, ahora, publicaciones: todas }),
    altas: await prepararAltas({ TaricCode, ahora, derechos, publicaciones: todas })
  };
}

module.exports = { simularPasada };
