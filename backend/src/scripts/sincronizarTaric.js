/**
 * Pone al dia el catalogo TARIC de LUCI con la nomenclatura oficial de la
 * Comision Europea (ficheros mensuales de CIRCABC, sin cuenta).
 *
 * Por defecto es una SIMULACION: descarga, compara y dice que cambiaria, sin
 * escribir nada. Con `--aplicar` hace los cambios:
 *   - da de alta los codigos oficiales que faltan (descripcion oficial en
 *     español; arancel sin dato, pendiente de contrastar);
 *   - marca como inactivos (no borra) los que ya no estan vigentes;
 *   - corrige la marca de «declarable» y el nivel de los que no coinciden.
 * No toca descripciones, aranceles ni medidas de los codigos que ya existen.
 *
 * Ejecutar:  node src/scripts/sincronizarTaric.js                 (simulacion)
 *            node src/scripts/sincronizarTaric.js --informe=/ruta/plan.json
 *            node src/scripts/sincronizarTaric.js --aplicar
 * Requiere MONGODB_URI en el entorno (o .env), como el resto de scripts.
 */
const MUESTRA = 15;

const argumento = (nombre) => {
  const a = process.argv.slice(2).find((x) => x === `--${nombre}` || x.startsWith(`--${nombre}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

const muestra = (titulo, lista, pintar) => {
  console.log(`\n${titulo}: ${lista.length}`);
  lista.slice(0, MUESTRA).forEach((x) => console.log(`  ${pintar(x)}`));
  if (lista.length > MUESTRA) console.log(`  … y ${lista.length - MUESTRA} mas`);
};

async function main() {
  require('dotenv').config();
  const fs = require('fs');
  const mongoose = require('mongoose');
  const TaricCode = require('../models/TaricCode');
  const { prepararSincronizacion, aplicarSincronizacion } = require('../services/taric/sincronizacionTaric');

  const aplicar = argumento('aplicar') === true;
  const informe = argumento('informe');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGODB_URI en el entorno');

  await mongoose.connect(uri);
  try {
    const catalogo = await TaricCode.find({}, { _id: 0, code: 1, level: 1, isLeaf: 1, isActive: 1 }).lean();
    console.log(`Catalogo de LUCI: ${catalogo.length} codigos`);
    const plan = await prepararSincronizacion(catalogo, { log: (linea) => console.log(linea) });

    console.log(`\nFuente: ${plan.fuente.nombre}, extraccion de ${plan.fuente.mes}` +
      (plan.fuente.mesEspanol ? ` (descripciones en español de ${plan.fuente.mesEspanol} y del servicio web)` : ''));
    muestra('ALTAS (codigos oficiales que faltan)', plan.altas,
      (a) => `${a.code} nivel ${a.level}${a.isLeaf ? ' declarable' : ''} | ${a.descripcionEs.slice(0, 80)}${a.descripcionEsOrigen === 'ingles_pendiente_de_traduccion' ? '  [EN]' : ''}`);
    muestra('BAJAS (ya no vigentes; quedan inactivos)', plan.bajas, (b) => `${b.code} nivel ${b.level}`);
    muestra('REACTIVAR', plan.reactivar, (r) => r.code);
    muestra('MARCA DE DECLARABLE A CORREGIR', plan.declarable, (d) => `${d.code} -> ${d.isLeaf ? 'declarable' : 'no declarable'}`);
    muestra('NIVEL A CORREGIR', plan.nivel, (n) => `${n.code}: ${n.antes} -> ${n.level}`);
    console.log('\nResumen:', JSON.stringify(plan.resumen));

    if (typeof informe === 'string') {
      fs.writeFileSync(informe, JSON.stringify(plan, null, 2));
      console.log(`Plan completo guardado en ${informe}`);
    }

    if (!aplicar) {
      console.log('\nSIMULACION: no se ha escrito nada. Repite con --aplicar para hacer los cambios.');
      return;
    }
    const hecho = await aplicarSincronizacion(plan, { TaricCode });
    console.log('\nAPLICADO:', JSON.stringify(hecho));
    console.log(`Catalogo de LUCI ahora: ${await TaricCode.countDocuments()} codigos, ${await TaricCode.countDocuments({ isActive: true })} activos`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exit(1); });
}

module.exports = { main };
