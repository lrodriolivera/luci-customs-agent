/**
 * Construye en memoria un .xlsx minimo (una hoja) para los tests del lector de
 * ficheros del TARIC. `compartidas: true` usa la tabla de cadenas compartidas,
 * que es como llegan los ficheros reales de la Comision.
 */
const { zipSync, strToU8 } = require('fflate');

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const letra = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function xlsxDePrueba(filas, { compartidas = true } = {}) {
  const tabla = [];
  const indice = (texto) => {
    const i = tabla.indexOf(texto);
    return i >= 0 ? i : tabla.push(texto) - 1;
  };
  const hoja = filas.map((fila, f) => `<row r="${f + 1}">` + fila.map((valor, c) => {
    if (valor === '' || valor === null || valor === undefined) return '';
    const ref = `${letra(c)}${f + 1}`;
    return compartidas
      ? `<c r="${ref}" t="s"><v>${indice(String(valor))}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${escapar(valor)}</t></is></c>`;
  }).join('') + '</row>').join('');
  const ficheros = {
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0"?><worksheet><sheetData>${hoja}</sheetData></worksheet>`),
    '[Content_Types].xml': strToU8('<Types/>')
  };
  if (compartidas) {
    ficheros['xl/sharedStrings.xml'] = strToU8(`<?xml version="1.0"?><sst>${tabla.map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`).join('')}</sst>`);
  }
  return Buffer.from(zipSync(ficheros));
}

module.exports = { xlsxDePrueba };
