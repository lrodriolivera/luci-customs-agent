/**
 * Detecta declaraciones con un identificador inventado (SOLO LECTURA).
 *
 * Antes de la PR L, H1/AES/H7 componian el EORI del declarante como
 * `ES${representative.nif}` (=> "ESundefined" sin representante) o caian a
 * literales fijos (ESB22477020, ESB12345678). Este script lista los
 * expedientes cuyo XML o `declarant.identificationNumber` contienen esos
 * valores, para que quien administra decida que hacer con ellas (regenerar,
 * corregir o dejarlas). No escribe nada en la base.
 *
 * Ejecutar:  node src/scripts/detectarDeclaracionesSinEori.js
 *            node src/scripts/detectarDeclaracionesSinEori.js --json   (salida JSON)
 * Requiere MONGODB_URI en el entorno (o .env), como el resto de scripts.
 */

const FALSOS = ['ESundefined', 'ESnull', 'ESNaN', 'ESB22477020', 'ESB12345678'];

/** Primer identificador de respaldo que aparece en `texto`, o null. */
function falsoEn(texto) {
  if (typeof texto !== 'string' || texto === '') return null;
  return FALSOS.find((f) => texto.includes(f)) || null;
}

/**
 * Motivos por los que una declaracion lleva un identificador de respaldo.
 * @param {object} declaration subdocumento `declaration` de un expediente
 * @returns {{donde: string, valor: string}[]}
 */
function motivosDeclaracion(declaration) {
  if (!declaration || typeof declaration !== 'object') return [];
  const motivos = [];

  const enXml = falsoEn(declaration.xmlContent);
  if (enXml) motivos.push({ donde: 'xmlContent', valor: enXml });

  const cabeceras = [
    ['h1Data.declarationHeader.declarant', declaration.h1Data?.declarationHeader?.declarant],
    ['h7Data.declarationHeader.declarant', declaration.h7Data?.declarationHeader?.declarant]
  ];
  for (const [donde, declarante] of cabeceras) {
    const valor = falsoEn(declarante?.identificationNumber);
    if (valor) motivos.push({ donde: `${donde}.identificationNumber`, valor });
  }
  return motivos;
}

/** Recorre los expedientes con declaracion y devuelve los afectados. */
async function detectar(Expedition) {
  const afectados = [];
  const cursor = Expedition.find(
    { 'declaration.type': { $exists: true } },
    { expeditionId: 1, tenantId: 1, 'declaration.type': 1, 'declaration.status': 1, 'declaration.mrn': 1,
      'declaration.xmlContent': 1, 'declaration.h1Data.declarationHeader.declarant': 1,
      'declaration.h7Data.declarationHeader.declarant': 1 }
  ).lean().cursor();

  for await (const exp of cursor) {
    const motivos = motivosDeclaracion(exp.declaration);
    if (motivos.length === 0) continue;
    afectados.push({
      expeditionId: exp.expeditionId,
      tenantId: exp.tenantId ? String(exp.tenantId) : null,
      tipo: exp.declaration.type,
      estado: exp.declaration.status || null,
      mrn: exp.declaration.mrn || null,
      motivos
    });
  }
  return afectados;
}

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const connectDB = require('../config/database');
  const Expedition = require('../models/Expedition');
  const enJson = process.argv.includes('--json');

  await connectDB();
  try {
    const afectados = await detectar(Expedition);
    if (enJson) {
      process.stdout.write(`${JSON.stringify(afectados, null, 2)}\n`);
    } else if (afectados.length === 0) {
      process.stdout.write('Ninguna declaracion lleva un identificador de respaldo.\n');
    } else {
      process.stdout.write(`${afectados.length} expediente(s) con identificador de respaldo:\n`);
      for (const a of afectados) {
        const donde = a.motivos.map((m) => `${m.donde}=${m.valor}`).join(', ');
        process.stdout.write(`- ${a.expeditionId} [${a.tipo}/${a.estado || 'sin estado'}] tenant=${a.tenantId} mrn=${a.mrn || '-'} :: ${donde}\n`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { FALSOS, falsoEn, motivosDeclaracion, detectar };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  });
}
