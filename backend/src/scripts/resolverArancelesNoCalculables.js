/**
 * Resuelve los codigos del catalogo marcados como «no calculables»
 * (`duties.origen.fuente = 'no_calculable'`) contra los ficheros oficiales del
 * mes de la Comision Europea en CIRCABC («Duties Import 01-99.xlsx» y
 * «Additional codes descriptions.xlsx»). Solo usa esa fuente: ni IA ni datos
 * de memoria.
 *
 *   - Derecho segun codigo adicional (2500 / 2501…): guarda las variantes con
 *     su codigo adicional y su descripcion oficial; el calculo usa la de la
 *     partida o, sin ella, la de mayor importe y pide el codigo adicional.
 *   - Suma con minimo o maximo («6,2 % + 27,1 EUR/100 kg MAX 17,9 %»): guarda
 *     la formula oficial y el calculo la liquida.
 *   - El mismo derecho en todos sus codigos adicionales (cereales): derecho simple.
 *   - Lo que exige datos que LUCI no tiene (elemento agricola, grado
 *     alcoholico, azucar, precio de entrada…): se queda como esta y se anota el
 *     texto oficial y el dato que falta, que el calculo enseña.
 *
 * Por defecto es una SIMULACION: lista por grupo cuantos codigos cambian, con
 * ejemplos, y los conflictos, sin escribir nada. Con `--aplicar` escribe como
 * mucho `--limite` cambios (300 por defecto); se repite hasta que no quede
 * nada: una pasada mas no cambia nada.
 *
 * Ejecutar:  node src/scripts/resolverArancelesNoCalculables.js                       (simulacion)
 *            node src/scripts/resolverArancelesNoCalculables.js --informe=/tmp/plan.json
 *            node src/scripts/resolverArancelesNoCalculables.js --aplicar --limite=600
 * Requiere MONGODB_URI en el entorno (o .env), como el resto de scripts.
 */
const LIMITE_POR_DEFECTO = 300;
const MUESTRA = 15;

const argumento = (nombre) => {
  const a = process.argv.slice(2).find((x) => x === `--${nombre}` || x.startsWith(`--${nombre}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

/** Ficheros de derechos y codigos adicionales del mes mas reciente que los trae. */
async function ficherosDelMes(circabc) {
  for (const mes of await circabc.mesesPublicados()) {
    const ficheros = await circabc.hijos(mes.id);
    const buscar = (nombre) => ficheros.find((f) => !f.carpeta && f.name.toLowerCase() === nombre);
    const derechos = buscar('duties import 01-99.xlsx');
    const adicionales = buscar('additional codes descriptions.xlsx');
    if (derechos && adicionales) {
      return { mes, derechos: await circabc.descargar(derechos.id), adicionales: await circabc.descargar(adicionales.id) };
    }
  }
  throw new Error('CIRCABC: ningun mes trae «Duties Import 01-99.xlsx» y «Additional codes descriptions.xlsx»');
}

function imprimirPlan(plan) {
  console.log(`\nCodigos «no calculables» activos en el catalogo: ${plan.total}`);
  console.log('\nGRUPOS (forma del derecho oficial | codigos | cambian | que se hace)');
  for (const g of plan.grupos) {
    console.log(`\n  ${g.forma}: ${g.codigos} codigos, cambian ${g.cambian} -> ${g.accion}`);
    if (g.faltan.length > 0) console.log(`    falta: ${g.faltan.join(' y ')}`);
    g.ejemplos.forEach((e) => console.log(`    ${e.code}${e.heredadoDe && e.heredadoDe !== e.code ? ` (de ${e.heredadoDe})` : ''} «${String(e.texto || 'sin medida').slice(0, 110)}»`));
  }
  const c = plan.cambios;
  console.log(`\nCAMBIOS: variantes ${c.variantes.length}, formulas ${c.compuestos.length}, corregir ${c.corregir.length}, contrastar ${c.contrastar.length}, ` +
    `anotar dato que falta ${c.noCalculables.length}, sin derecho ${c.sinDerecho.length}. Total ${plan.pendientes}`);
  console.log(`\nCONFLICTOS (no se escriben; revisar): ${plan.conflictos.length}`);
  plan.conflictos.slice(0, MUESTRA).forEach((x) => console.log(`  ${x.code}: ${x.motivo}`));
  if (plan.conflictos.length > MUESTRA) console.log(`  … y ${plan.conflictos.length - MUESTRA} mas`);
}

async function main() {
  require('dotenv').config();
  const fs = require('fs');
  const mongoose = require('mongoose');
  const TaricCode = require('../models/TaricCode');
  const circabc = require('../services/taric/circabcTaric');
  const { leerPrimeraHoja } = require('../services/taric/xlsxSimple');
  const { leerDerechosTercerosPaises } = require('../services/taric/arancelesOficiales');
  const { leerDescripcionesCodigosAdicionales } = require('../services/taric/codigosAdicionales');
  const { planResolucion, aplicarResolucion } = require('../services/taric/resolucionNoCalculables');

  const aplicar = argumento('aplicar') === true;
  const limite = Number(argumento('limite') || LIMITE_POR_DEFECTO);
  if (!Number.isInteger(limite) || limite <= 0) throw new Error('--limite debe ser un entero positivo');
  const informe = argumento('informe');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGODB_URI en el entorno');

  const f = await ficherosDelMes(circabc);
  const fuente = `${circabc.FUENTE}, ${f.mes.anio}-${String(f.mes.mes).padStart(2, '0')}`;
  const derechos = leerDerechosTercerosPaises(leerPrimeraHoja(f.derechos));
  const codigosAdicionales = leerDescripcionesCodigosAdicionales(leerPrimeraHoja(f.adicionales));
  console.log(`Fuente: ${fuente} (${derechos.size} codigos con derecho de terceros paises, ${codigosAdicionales.size} codigos adicionales descritos)`);

  await mongoose.connect(uri);
  try {
    const catalogo = await TaricCode.find(
      { 'duties.origen.fuente': 'no_calculable', isActive: { $ne: false } },
      { _id: 0, code: 1, isLeaf: 1, isActive: 1, duties: 1 }
    ).lean();
    const plan = planResolucion(catalogo, derechos, { codigosAdicionales });
    imprimirPlan(plan);
    if (typeof informe === 'string') {
      fs.writeFileSync(informe, JSON.stringify(plan, null, 2));
      console.log(`\nPlan completo guardado en ${informe}`);
    }

    if (!aplicar) {
      console.log(`\nSIMULACION: no se ha escrito nada. Repite con --aplicar (como mucho ${limite} cambios por pasada; --limite=N para cambiarlo).`);
      return;
    }
    const hecho = await aplicarResolucion(plan, { TaricCode, fuente, limite });
    console.log(`\nAPLICADO: ${hecho.escritos} cambios ${JSON.stringify(hecho.porLista)}. Pendientes para otra pasada: ${hecho.pendientes}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exit(1); });
}

module.exports = { main, ficherosDelMes };
