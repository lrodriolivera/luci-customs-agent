#!/usr/bin/env node
/**
 * Lectura REAL con la IA de un documento (por defecto, los ejemplos de esta
 * carpeta). Llama al modelo configurado en el entorno (gasta una llamada por
 * documento): no lo usan los tests ni se ejecuta en la integración continua.
 *
 * Uso (desde backend/, con las variables de la IA cargadas):
 *   node tests/fixtures/documentos/leerConIA.js tests/fixtures/documentos/EJEMPLO-CMR-specimen.pdf cmr
 *   node tests/fixtures/documentos/leerConIA.js tests/fixtures/documentos/EJEMPLO-T1-TAD-specimen.pdf transit_document
 *
 * Imprime la extracción normalizada (lo mismo que guarda LUCI en el documento).
 */
const path = require('path');
const aiService = require('../../../src/services/aiService');

async function leer(ruta, tipo) {
  const filePath = path.resolve(ruta);
  return aiService.extractDocumentData({
    filePath, mimeType: 'application/pdf', originalName: path.basename(filePath), type: tipo || 'other'
  });
}

if (require.main === module) {
  const [ruta, tipo] = process.argv.slice(2);
  if (!ruta) {
    process.stderr.write('Uso: node tests/fixtures/documentos/leerConIA.js <ruta.pdf> [tipo]\n');
    process.exit(2);
  }
  leer(ruta, tipo)
    .then((lectura) => { process.stdout.write(`${JSON.stringify(lectura, null, 2)}\n`); process.exit(0); })
    .catch((err) => { process.stderr.write(`${err.stack}\n`); process.exit(1); });
}

module.exports = { leer };
