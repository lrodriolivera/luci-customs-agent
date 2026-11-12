/**
 * Lee las publicaciones diarias del TARIC que LUCI aun no ha visto, guarda lo
 * que traen de interes y dice que de ello falta en el catalogo.
 *
 * Es lo mismo que hace LUCI cada madrugada, lanzado a mano. Leer y registrar
 * no modifica el catalogo. Con `--aplicar` se actualiza el
 * derecho de terceros paises (o de destino final) de los codigos declarables
 * cuyo cambio ya esta en vigor; nada mas.
 *
 * Ejecutar:  node src/scripts/procesarDiarioTaric.js             (registra y simula)
 *            node src/scripts/procesarDiarioTaric.js --aplicar
 *            node src/scripts/procesarDiarioTaric.js --aplicar --forzar   (sin limite de cambios por pasada)
 * Requiere MONGODB_URI en el entorno (o .env).
 */
const tiene = (nombre) => process.argv.slice(2).includes(`--${nombre}`);

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const TaricCode = require('../models/TaricCode');
  const TaricDailyPublication = require('../models/TaricDailyPublication');
  const diario = require('../services/taric/diario/sincronizacionDiaria');
  const modelos = { TaricCode, TaricDailyPublication };

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const { nuevas } = await diario.registrarPublicacionesNuevas(modelos);
    console.log(`Publicaciones nuevas leídas: ${nuevas.length}`);
    nuevas.forEach((n) => console.log(`  ${n.nombre}: ${n.resumen.codigos} códigos, ${n.resumen.derechos} derechos, ${n.resumen.controles} controles, ${n.resumen.otrasMedidas} otras medidas, ${n.resumen.pendientes} pendientes`));

    const estado = await diario.estadoDiario({ TaricDailyPublication, limite: 30 });
    console.log(`\nCambios publicados que aún no están en el catálogo: ${estado.totalPendientes}`);
    estado.pendientes.forEach((c) => console.log(`  ${c.publicacion} · ${c.clase} ${c.code} · ${c.accion} · desde ${c.desde || '—'} · ${String(c.detalle || '').slice(0, 60)}${c.motivo ? ` · ${c.motivo}` : ''}`));

    if (!tiene('aplicar')) {
      const plan = await diario.prepararAplicacion(modelos);
      console.log(`\nSIMULACION — derechos que se actualizarían ahora: ${plan.aplicar.length}`);
      plan.aplicar.forEach((a) => console.log(`  ${a.dato.code}: ${a.dato.antes.thirdCountry ?? 'sin dato'} % -> «${a.dato.texto}» (${a.cambio.publicacion})`));
      if (plan.retenido) console.log(`  Retenido: ${plan.retenido}`);
      console.log('Nada se ha escrito en el catálogo. Repite con --aplicar para actualizarlo.');
      return;
    }
    const r = await diario.aplicarPendientes({ ...modelos, forzar: tiene('forzar') });
    console.log(r.retenido ? `\nNo aplicado: ${r.retenido}` : `\nDerechos actualizados: ${r.aplicados}${r.codigos ? ` (${r.codigos.join(', ')})` : ''}. Ya en el catálogo: ${r.yaEnCatalogo}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
