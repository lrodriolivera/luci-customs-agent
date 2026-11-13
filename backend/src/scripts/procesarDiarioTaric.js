/**
 * Lee las publicaciones diarias del TARIC que LUCI aun no ha visto, guarda lo
 * que traen de interes y dice que de ello falta en el catalogo.
 *
 * Es lo mismo que hace LUCI cada madrugada, lanzado a mano. Leer y registrar
 * no modifica el catalogo (si vuelve a leer las publicaciones registradas
 * antes de que se guardara el nivel de las altas). Con `--aplicar`:
 *   1. se actualiza el derecho de terceros paises (o de destino final) de los
 *      codigos declarables cuyo cambio ya esta en vigor;
 *   2. se dan de alta los codigos nuevos de nivel 10 ya en vigor, con su
 *      descripcion oficial en español de la publicacion y el derecho que les
 *      da el TARIC; el codigo del que cuelgan deja de ser declarable.
 * Nada mas.
 *
 * Ejecutar:  node src/scripts/procesarDiarioTaric.js             (registra y simula)
 *            node src/scripts/procesarDiarioTaric.js --aplicar
 *            node src/scripts/procesarDiarioTaric.js --aplicar --forzar   (sin limite de cambios por pasada)
 * Requiere MONGODB_URI en el entorno (o .env).
 */
const tiene = (nombre) => process.argv.slice(2).includes(`--${nombre}`);

const derechoLegible = (duties) => {
  const o = duties.origen || {};
  if (o.fuente === 'taric_oficial') return `${duties.thirdCountry} %${duties.specific ? ` + ${duties.specific.amount} ${duties.specific.unit}` : ''} (${o.evidencia})`;
  return `sin dato, ${o.fuente}: ${o.evidencia}`;
};

function mostrarAltas(plan) {
  console.log(`\nSIMULACION — códigos que se darían de alta ahora: ${plan.aplicar.length}`);
  plan.aplicar.forEach(({ documento: d }) => console.log(`  ${d.code} · «${d.description.es}» · ${derechoLegible(d.duties)}`));
  if (plan.padres.length > 0) console.log(`  Dejarían de ser declarables: ${plan.padres.join(', ')}`);
  if (plan.yaEnCatalogo.length > 0) console.log(`  Ya en el catálogo (solo se marcan): ${plan.yaEnCatalogo.map((c) => c.code).join(', ')}`);
  plan.esperando.forEach((e) => console.log(`  Espera ${e.cambio.code}: ${e.motivo}`));
  if (plan.retenido) console.log(`  Retenido: ${plan.retenido}`);
}

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const TaricCode = require('../models/TaricCode');
  const TaricDailyPublication = require('../models/TaricDailyPublication');
  const diario = require('../services/taric/diario/sincronizacionDiaria');
  const altas = require('../services/taric/diario/altasDiarias');
  const modelos = { TaricCode, TaricDailyPublication };

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const { nuevas } = await diario.registrarPublicacionesNuevas(modelos);
    console.log(`Publicaciones nuevas leídas: ${nuevas.length}`);
    nuevas.forEach((n) => console.log(`  ${n.nombre}: ${n.resumen.codigos} códigos, ${n.resumen.derechos} derechos, ${n.resumen.controles} controles, ${n.resumen.otrasMedidas} otras medidas, ${n.resumen.pendientes} pendientes`));
    const relectura = await altas.releerPublicacionesIncompletas(modelos);
    if (relectura.releidas.length > 0) console.log(`Publicaciones vueltas a leer para completar sus altas: ${relectura.releidas.join(', ')}`);
    relectura.fallidas.forEach((f) => console.log(`  No se pudo volver a leer ${f.nombre}: ${f.error}`));

    const estado = await diario.estadoDiario({ TaricDailyPublication, limite: 30 });
    console.log(`\nCambios publicados que aún no están en el catálogo: ${estado.totalPendientes}`);
    estado.pendientes.forEach((c) => console.log(`  ${c.publicacion} · ${c.clase} ${c.code} · ${c.accion} · desde ${c.desde || '—'} · ${String(c.detalle || '').slice(0, 60)}${c.motivo ? ` · ${c.motivo}` : ''}`));

    if (!tiene('aplicar')) {
      const plan = await diario.prepararAplicacion(modelos);
      console.log(`\nSIMULACION — derechos que se actualizarían ahora: ${plan.aplicar.length}`);
      plan.aplicar.forEach((a) => console.log(`  ${a.dato.code}: ${a.dato.antes.thirdCountry ?? 'sin dato'} % -> «${a.dato.texto}» (${a.cambio.publicacion})`));
      if (plan.retenido) console.log(`  Retenido: ${plan.retenido}`);
      mostrarAltas(await altas.prepararAltas(modelos));
      console.log('\nNada se ha escrito en el catálogo. Repite con --aplicar para actualizarlo.');
      return;
    }
    const r = await diario.aplicarPendientes({ ...modelos, forzar: tiene('forzar') });
    console.log(r.retenido ? `\nDerechos no aplicados: ${r.retenido}` : `\nDerechos actualizados: ${r.aplicados}${r.codigos ? ` (${r.codigos.join(', ')})` : ''}. Ya en el catálogo: ${r.yaEnCatalogo}.`);
    const a = await altas.aplicarAltas({ ...modelos, forzar: tiene('forzar') });
    console.log(a.retenido && a.altas === 0
      ? `Altas no aplicadas: ${a.retenido}`
      : `Códigos dados de alta: ${a.altas}${a.codigos ? ` (${a.codigos.join(', ')})` : ''}. Dejan de ser declarables: ${(a.padres || []).join(', ') || 'ninguno'}. Ya en el catálogo: ${a.yaEnCatalogo}. Esperando: ${a.esperando}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
