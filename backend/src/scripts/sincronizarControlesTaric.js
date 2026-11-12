/**
 * Carga en Mongo las medidas de control de importacion del TARIC (control
 * veterinario, fitosanitario, CITES, residuos, prohibiciones...) y los
 * certificados que exige cada una, desde los ficheros mensuales de la
 * Comision Europea (CIRCABC, sin cuenta).
 *
 * Por defecto es una SIMULACION: descarga, interpreta y dice que cargaria.
 *
 * Ejecutar:  node src/scripts/sincronizarControlesTaric.js              (simulacion)
 *            node src/scripts/sincronizarControlesTaric.js --aplicar
 *            node src/scripts/sincronizarControlesTaric.js --aplicar --forzar   (aunque el mes ya este cargado)
 *            node src/scripts/sincronizarControlesTaric.js --consulta=0201100000:BR
 * Requiere MONGODB_URI en el entorno (o .env).
 */
const opcion = (nombre) => {
  const a = process.argv.slice(2).find((x) => x === `--${nombre}` || x.startsWith(`--${nombre}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const TaricControlMeasure = require('../models/TaricControlMeasure');
  const TaricReference = require('../models/TaricReference');
  const { sincronizarControles, prepararControles, ficherosDeControles, sincronizarDobleUso, ficheroDobleUso } = require('../services/taric/controles/sincronizacionControles');
  const { controlesPara } = require('../services/taric/controles/controlesOficiales');

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const consulta = opcion('consulta');
    if (consulta) {
      const [codigo, pais] = String(consulta).split(':');
      console.log(JSON.stringify(await controlesPara(codigo, pais), null, 2));
      return;
    }
    if (!opcion('aplicar')) {
      const ficheros = await ficherosDeControles();
      const plan = prepararControles(ficheros);
      const porTipo = {};
      plan.medidas.forEach((m) => { porTipo[`${m.tipo} ${m.tipoNombre}`] = (porTipo[`${m.tipo} ${m.tipoNombre}`] || 0) + 1; });
      console.log(`SIMULACION — mes ${ficheros.mes}`);
      console.log(`Medidas de control vigentes: ${plan.medidas.length} (${plan.medidas.filter((m) => m.condiciones.length).length} con certificados)`);
      console.log(`Grupos de países: ${Object.keys(plan.areas).length} | Certificados con descripción: ${Object.keys(plan.certificados).length}`);
      console.log(`Certificados sin descripción en español: ${plan.certificadosSinDescripcion.join(', ') || 'ninguno'}`);
      Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(5)}  ${t}`));
      const dobleUso = await ficheroDobleUso();
      const tabla = require('../services/taric/controles/dobleUso').leerDobleUso(require('../services/taric/xlsxSimple').leerPrimeraHoja(dobleUso.contenido));
      console.log(`Doble uso: tabla «${dobleUso.nombre}», ${Object.keys(tabla).length} códigos con correlación`);
      console.log('Nada se ha escrito. Repite con --aplicar para cargarlo.');
      return;
    }
    const resultado = await sincronizarControles({ TaricControlMeasure, TaricReference, forzar: !!opcion('forzar') });
    console.log(resultado.omitido
      ? `El mes ${resultado.mes} ya estaba cargado: nada que hacer (usa --forzar para recargarlo).`
      : `Cargado ${resultado.mes}: ${resultado.medidas} medidas, ${resultado.areas} grupos de países, ${resultado.certificados} certificados.`);
    const dobleUso = await sincronizarDobleUso({ TaricReference, forzar: !!opcion('forzar') });
    console.log(dobleUso.omitido
      ? `La tabla de doble uso «${dobleUso.tabla}» ya estaba cargada.`
      : `Doble uso: cargada «${dobleUso.tabla}», ${dobleUso.codigos} códigos.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
