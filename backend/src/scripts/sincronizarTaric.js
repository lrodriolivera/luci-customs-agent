/**
 * Pone al dia el catalogo TARIC de LUCI con la nomenclatura oficial de la
 * Comision Europea (ficheros mensuales de CIRCABC, sin cuenta).
 *
 * Por defecto es una SIMULACION: descarga, compara y dice que cambiaria, sin
 * escribir nada. Con `--aplicar` hace los cambios:
 *   - da de alta los codigos oficiales que faltan, con su descripcion oficial
 *     en español y su arancel de terceros paises oficial cuando es un
 *     porcentaje o un importe por unidad (si no, sin dato: no se estima);
 *   - marca como inactivos (no borra) los que ya no estan vigentes;
 *   - corrige la marca de «declarable» y el nivel de los que no coinciden.
 *   - corrige las descripciones y el arancel de terceros paises de los
 *     codigos que ya existen cuando no coinciden con los oficiales, y guarda
 *     la ruta de cada codigo en el arbol (`--sin-correcciones` lo omite).
 * Un arancel contrastado antes a mano contra el TARIC no se pisa: se lista.
 *
 * Ejecutar:  node src/scripts/sincronizarTaric.js                 (simulacion)
 *            node src/scripts/sincronizarTaric.js --informe=/ruta/plan.json
 *            node src/scripts/sincronizarTaric.js --aplicar
 *            node src/scripts/sincronizarTaric.js --aplicar --sin-correcciones
 * Requiere MONGODB_URI en el entorno (o .env), como el resto de scripts.
 */
const MUESTRA = 15;

const argumento = (nombre) => {
  const a = process.argv.slice(2).find((x) => x === `--${nombre}` || x.startsWith(`--${nombre}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

const arancelLegible = (alta) => {
  if (!alta.isLeaf) return 'sin arancel (no declarable)';
  const a = alta.arancel;
  if (a?.estado !== 'ok') return `arancel sin dato (${a?.estado || 'sin_fichero'})`;
  return a.derecho.tipo === 'ad_valorem' ? `${a.derecho.adValorem} %` : `${a.derecho.specific.amount} ${a.derecho.specific.unit}`;
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
  const { cargarCatalogo } = require('../services/taric/sincronizacionAutomatica');
  const TaricSyncRun = require('../models/TaricSyncRun');

  const aplicar = argumento('aplicar') === true;
  const corregir = argumento('sin-correcciones') !== true;
  const inicio = new Date();
  const informe = argumento('informe');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGODB_URI en el entorno');

  await mongoose.connect(uri);
  try {
    const catalogo = await cargarCatalogo(TaricCode);
    console.log(`Catalogo de LUCI: ${catalogo.length} codigos`);
    const plan = await prepararSincronizacion(catalogo, { log: (linea) => console.log(linea) });

    console.log(`\nFuente: ${plan.fuente.nombre}, extraccion de ${plan.fuente.mes}` +
      (plan.fuente.mesEspanol ? ` (descripciones en español de ${plan.fuente.mesEspanol} y del servicio web)` : ''));
    muestra('ALTAS (codigos oficiales que faltan)', plan.altas,
      (a) => `${a.code} nivel ${a.level}${a.isLeaf ? ' declarable' : ''} | ${arancelLegible(a)} | ${a.descripcionEs.slice(0, 70)}${a.descripcionEsOrigen === 'ingles_pendiente_de_traduccion' ? '  [EN]' : ''}`);
    muestra('BAJAS (ya no vigentes; quedan inactivos)', plan.bajas, (b) => `${b.code} nivel ${b.level}`);
    muestra('REACTIVAR', plan.reactivar, (r) => r.code);
    muestra('MARCA DE DECLARABLE A CORREGIR', plan.declarable, (d) => `${d.code} -> ${d.isLeaf ? 'declarable' : 'no declarable'}`);
    muestra('NIVEL A CORREGIR', plan.nivel, (n) => `${n.code}: ${n.antes} -> ${n.level}`);
    muestra('ARANCELES DEL CATALOGO QUE NO COINCIDEN CON EL OFICIAL (solo se listan, no se corrigen)', plan.arancelesDistintos,
      (d) => `${d.code}: catalogo ${d.catalogo} % | oficial ${d.oficial} %${d.heredadoDe !== d.code ? ` (de ${d.heredadoDe})` : ''} | ${d.fuenteCatalogo || 'sin fuente'}`);
    const c = plan.correcciones;
    muestra('DESCRIPCIONES EN ESPAÑOL QUE NO SON LA OFICIAL', c.descripciones.filter((d) => d.es),
      (d) => `${d.code}: «${String(d.antes).slice(0, 55)}» -> «${d.es.slice(0, 55)}»`);
    console.log(`\nRUTA JERARQUICA Y PALABRAS DE BUSQUEDA A ACTUALIZAR: ${c.descripciones.filter((d) => d.legalDescription).length}`);
    muestra('ARANCELES A CORREGIR', c.aranceles.corregir,
      (d) => `${d.code}: ${d.antes.thirdCountry ?? 'sin dato'} %${d.antes.specific ? ` + ${d.antes.specific.amount} ${d.antes.specific.unit}` : ''} -> ${d.thirdCountry} %${d.specific ? ` + ${d.specific.amount} ${d.specific.unit}` : ''} | oficial «${d.texto}»`);
    console.log(`\nARANCELES QUE COINCIDEN Y PASAN A CONSTAR COMO CONTRASTADOS: ${c.aranceles.contrastar.length}`);
    muestra('ARANCELES CONTRASTADOS ANTES A MANO QUE NO COINCIDEN (no se tocan; revisar)', c.aranceles.conflictos,
      (d) => `${d.code}: catalogo ${d.antes.thirdCountry} %${d.antes.specific ? ` + ${d.antes.specific.amount} ${d.antes.specific.unit}` : ''} | oficial «${d.texto}»`);
    console.log('\nResumen:', JSON.stringify(plan.resumen));

    if (typeof informe === 'string') {
      fs.writeFileSync(informe, JSON.stringify(plan, null, 2));
      console.log(`Plan completo guardado en ${informe}`);
    }

    if (!aplicar) {
      console.log('\nSIMULACION: no se ha escrito nada. Repite con --aplicar para hacer los cambios.');
      return;
    }
    const hecho = await aplicarSincronizacion(plan, { TaricCode, corregir });
    await TaricSyncRun.create({ trigger: 'manual', startedAt: inicio, finishedAt: new Date(), ok: true, fuente: plan.fuente, resumen: plan.resumen, aplicado: hecho });
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
