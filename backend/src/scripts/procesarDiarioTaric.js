/**
 * Publicaciones diarias del TARIC lanzadas a mano.
 *
 * Sin `--aplicar` es una SIMULACION que no escribe nada en la base de datos:
 * descarga las publicaciones que LUCI aun no ha visto, vuelve a leer las
 * registradas sin nivel, y calcula en memoria que derechos se actualizarian y
 * que codigos se darian de alta. Solo lee de Mongo.
 *
 * Con `--aplicar` hace lo mismo que la pasada de cada madrugada:
 *   1. registra las publicaciones nuevas y relee las incompletas;
 *   2. actualiza el derecho de terceros paises (o de destino final) de los
 *      codigos declarables cuyo cambio ya esta en vigor;
 *   3. da de alta los codigos nuevos de nivel 10 ya en vigor, con su
 *      descripcion oficial en español de la publicacion y el derecho que les
 *      da el TARIC; el codigo del que cuelgan deja de ser declarable.
 * Nada mas.
 *
 * Ejecutar:  node src/scripts/procesarDiarioTaric.js             (simula, no escribe)
 *            node src/scripts/procesarDiarioTaric.js --aplicar
 *            node src/scripts/procesarDiarioTaric.js --aplicar --forzar   (sin limite de cambios por pasada)
 * Requiere MONGODB_URI en el entorno (o .env).
 */
const diario = require('../services/taric/diario/sincronizacionDiaria');
const altasDiarias = require('../services/taric/diario/altasDiarias');
const { simularPasada } = require('../services/taric/diario/simulacionDiaria');

const derechoLegible = (duties) => {
  const o = duties.origen || {};
  if (o.fuente === 'taric_oficial') return `${duties.thirdCountry} %${duties.specific ? ` + ${duties.specific.amount} ${duties.specific.unit}` : ''} (${o.evidencia})`;
  return `sin dato, ${o.fuente}: ${o.evidencia}`;
};

function mostrarLeidas(salida, nuevas, releidas, fallidas) {
  salida(`Publicaciones nuevas leídas: ${nuevas.length}`);
  nuevas.forEach((n) => salida(`  ${n.nombre}: ${n.resumen.codigos} códigos, ${n.resumen.derechos} derechos, ${n.resumen.controles} controles, ${n.resumen.otrasMedidas} otras medidas, ${n.resumen.pendientes} pendientes`));
  if (releidas.length > 0) salida(`Publicaciones vueltas a leer para completar sus altas: ${releidas.join(', ')}`);
  fallidas.forEach((f) => salida(`  No se pudo volver a leer ${f.nombre}: ${f.error}`));
}

function mostrarPendientes(salida, pendientes, total) {
  salida(`\nCambios publicados que aún no están en el catálogo: ${total}`);
  pendientes.forEach((c) => salida(`  ${c.publicacion} · ${c.clase} ${c.code} · ${c.accion} · desde ${c.desde || '—'} · ${String(c.detalle || '').slice(0, 60)}${c.motivo ? ` · ${c.motivo}` : ''}`));
}

function mostrarSimulacion(salida, { derechos, altas }) {
  salida(`\nSIMULACION — derechos que se actualizarían ahora: ${derechos.aplicar.length}`);
  derechos.aplicar.forEach((a) => salida(`  ${a.dato.code}: ${a.dato.antes.thirdCountry ?? 'sin dato'} % -> «${a.dato.texto}» (${a.cambio.publicacion})`));
  if (derechos.retenido) salida(`  Retenido: ${derechos.retenido}`);
  salida(`\nSIMULACION — códigos que se darían de alta ahora: ${altas.aplicar.length}`);
  altas.aplicar.forEach(({ documento: d }) => salida(`  ${d.code} · «${d.description.es}» · ${derechoLegible(d.duties)}`));
  if (altas.padres.length > 0) salida(`  Dejarían de ser declarables: ${altas.padres.join(', ')}`);
  if (altas.yaEnCatalogo.length > 0) salida(`  Ya en el catálogo (solo se marcarían): ${altas.yaEnCatalogo.map((c) => c.code).join(', ')}`);
  altas.esperando.forEach((e) => salida(`  Espera ${e.cambio.code}: ${e.motivo}`));
  if (altas.retenido) salida(`  Retenido: ${altas.retenido}`);
}

/**
 * @param {{ aplicar?: boolean, forzar?: boolean, modelos: { TaricCode, TaricDailyPublication }, deps?: object, salida?: Function }} opciones
 *   `deps` (listar, descargar, leerCambios, derechos, ahora) solo para las pruebas.
 */
async function ejecutar({ aplicar = false, forzar = false, modelos, deps = {}, salida = console.log }) {
  if (!aplicar) {
    const sim = await simularPasada({ ...modelos, ...deps });
    mostrarLeidas(salida, sim.nuevas, sim.releidas, sim.fallidas);
    mostrarPendientes(salida, sim.pendientes.slice(0, 30), sim.pendientes.length);
    mostrarSimulacion(salida, sim);
    salida('\nNada se ha escrito en la base de datos. Repite con --aplicar para registrar y actualizar el catálogo.');
    return sim;
  }

  const { listar, descargar, leerCambios, derechos, ahora } = deps;
  const definidos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const { nuevas } = await diario.registrarPublicacionesNuevas({ ...modelos, ...definidos({ listar, descargar, leerCambios, ahora }) });
  const relectura = await altasDiarias.releerPublicacionesIncompletas({ ...modelos, ...definidos({ descargar, leerCambios }) });
  mostrarLeidas(salida, nuevas, relectura.releidas, relectura.fallidas);
  const estado = await diario.estadoDiario({ TaricDailyPublication: modelos.TaricDailyPublication, limite: 30 });
  mostrarPendientes(salida, estado.pendientes, estado.totalPendientes);

  const r = await diario.aplicarPendientes({ ...modelos, forzar, ...definidos({ ahora }) });
  salida(r.retenido ? `\nDerechos no aplicados: ${r.retenido}` : `\nDerechos actualizados: ${r.aplicados}${r.codigos ? ` (${r.codigos.join(', ')})` : ''}. Ya en el catálogo: ${r.yaEnCatalogo}.`);
  const a = await altasDiarias.aplicarAltas({ ...modelos, forzar, ...definidos({ derechos, ahora }) });
  salida(a.retenido && a.altas === 0
    ? `Altas no aplicadas: ${a.retenido}`
    : `Códigos dados de alta: ${a.altas}${a.codigos ? ` (${a.codigos.join(', ')})` : ''}. Dejan de ser declarables: ${(a.padres || []).join(', ') || 'ninguno'}. Ya en el catálogo: ${a.yaEnCatalogo}. Esperando: ${a.esperando}.`);
  return { derechos: r, altas: a };
}

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const tiene = (nombre) => process.argv.slice(2).includes(`--${nombre}`);
  const modelos = { TaricCode: require('../models/TaricCode'), TaricDailyPublication: require('../models/TaricDailyPublication') };
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await ejecutar({ aplicar: tiene('aplicar'), forzar: tiene('forzar'), modelos });
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
}

module.exports = { ejecutar };
