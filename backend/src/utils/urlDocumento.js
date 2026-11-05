/**
 * URL de un documento adjunto (ENS, etc.) que el frontend pinta en un href.
 *
 * Se acepta http(s) absoluta o una ruta relativa del propio sitio ("/ruta").
 * Se rechazan javascript:, data:, vbscript:, file:, otros esquemas, "//host"
 * (protocolo relativo = otro origen) y los esquemas ofuscados con espacios,
 * tabuladores o saltos de linea que el navegador ignora al interpretarlos (F2).
 * Vacia/ausente es valida: un documento puede no llevar enlace.
 */

const CONTROL_O_ESPACIO = /[\u0000- \u007f-\u009f]/;

function esUrlDocumentoValida(url) {
  if (url === undefined || url === null || url === '') return true;
  if (typeof url !== 'string') return false;

  // Ruta relativa del propio sitio: "/algo", sin "//" ni "/\" (otro host).
  if (url.startsWith('/')) {
    return !url.startsWith('//') && !url.startsWith('/\\') && !CONTROL_O_ESPACIO.test(url);
  }

  if (CONTROL_O_ESPACIO.test(url)) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/** Indices de los documentos con url no valida (para el mensaje de error). */
function documentosConUrlInvalida(documents) {
  if (!Array.isArray(documents)) return [];
  return documents
    .map((doc, indice) => ({ doc, indice }))
    .filter(({ doc }) => !esUrlDocumentoValida(doc?.url))
    .map(({ indice }) => indice);
}

module.exports = { esUrlDocumentoValida, documentosConUrlInvalida };
