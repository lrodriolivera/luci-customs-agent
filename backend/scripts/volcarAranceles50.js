#!/usr/bin/env node
/**
 * Volcado del derecho de terceros paises desde el TARIC oficial para los codigos
 * que el catalogo local tiene con `duties.thirdCountry: 50`.
 *
 * NO escribe en Mongo: produce un JSON auditable (cada cifra con el texto
 * literal de la fuente del que sale) que se revisa antes de aplicar con
 * `repoblarAranceles50.js`. Los codigos que la fuente no resuelve a un tipo
 * explicito salen con `arancelOficial: null` y su motivo; nunca se rellenan con
 * una estimacion, que es justo el bug que esto viene a corregir.
 *
 * Uso:
 *   node scripts/volcarAranceles50.js [--salida=/ruta.json] [--desde=N] [--limite=N]
 *
 * `TARIC_SIM_DATE=AAAAMMDD` fija la fecha de referencia de TARIC para que el
 * volcado sea reproducible.
 */
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const TaricCode = require('../src/models/TaricCode');
const { consultarDerecho, resolverArancelGeneral } = require('../src/services/taricOfficialClient');

const arg = (n, def) => {
  const v = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`));
  return v ? v.split('=')[1] : def;
};

const SALIDA = arg('salida', '/tmp/taric-oficial.json');
const DESDE = parseInt(arg('desde', '0'), 10);
const LIMITE = parseInt(arg('limite', '0'), 10);
const PAUSA_MS = parseInt(arg('pausa', '250'), 10);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Reintenta la consulta. Los codigos con muchos codigos adicionales piden hasta
 * 20 paginas de detalle y algunas dan timeout; sin reintento se quedaban sin
 * arancel por un fallo de red, que es un "no se pudo" disfrazado de "no hay dato".
 */
async function consultarConReintento(code, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      return await consultarDerecho(code, { maxIframes: 20 });
    } catch (err) {
      ultimo = err;
      await espera(2000 * (i + 1));
    }
  }
  throw ultimo;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const todos = await TaricCode.find({ 'duties.thirdCountry': 50 })
    .select('code description.es duties.specific level')
    .sort({ code: 1 })
    .lean();

  const lote = LIMITE > 0 ? todos.slice(DESDE, DESDE + LIMITE) : todos.slice(DESDE);
  console.log(`Consultando ${lote.length} codigos (de ${todos.length}) desde el indice ${DESDE}`);

  const resultados = [];
  let resueltos = 0;
  let fallos = 0;

  for (let i = 0; i < lote.length; i++) {
    const item = lote[i];
    try {
      const consulta = await consultarConReintento(item.code);
      const r = resolverArancelGeneral(consulta);
      resultados.push({
        code: item.code,
        descripcionLocal: item.description?.es || null,
        specificLocal: item.duties?.specific?.amount ? item.duties.specific : null,
        arancelOficial: r.arancel,
        sancionRuBy: r.sancion || null,
        // Tipos de cada codigo adicional cuando el codigo se abre en varios y no
        // coinciden: sin esto no hay forma de saber que el codigo consultado no
        // tiene un unico derecho.
        variantes: r.variantes || null,
        motivo: r.motivo,
        rotulo: r.rotulo || null,
        // Marca que el tipo solo vale con autorizacion de destino final (N990).
        soloDestinoFinal: r.soloDestinoFinal || false,
        evidencia: r.evidencia || null
      });
      if (r.arancel) resueltos++;
    } catch (err) {
      fallos++;
      resultados.push({
        code: item.code,
        descripcionLocal: item.description?.es || null,
        arancelOficial: null,
        motivo: `error: ${err.message}`
      });
    }

    if ((i + 1) % 10 === 0 || i === lote.length - 1) {
      console.log(`  ${i + 1}/${lote.length} | resueltos ${resueltos} | errores ${fallos}`);
      fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 1));
    }
    await espera(PAUSA_MS);
  }

  fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 1));

  const porMotivo = resultados.reduce((acc, r) => {
    acc[r.motivo] = (acc[r.motivo] || 0) + 1;
    return acc;
  }, {});
  console.log('\n=== RESUMEN ===');
  console.log('resueltos con tipo explicito:', resueltos, '/', lote.length);
  console.log('por motivo:', JSON.stringify(porMotivo, null, 1));
  console.log('salida:', SALIDA);

  await mongoose.disconnect();
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
