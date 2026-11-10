/**
 * Prepara una imagen para enviarla al modelo.
 *
 * El modelo rechaza las imagenes de mas de 5 MB una vez codificadas en base64
 * (el fichero crece un tercio: el limite real ronda los 3,7 MB) y las de mas
 * de 8.000 px de lado. Una foto de movil lo supera con facilidad: en la prueba
 * del 10/Nov/2026, una foto de 11 MB de un BL devolvia «Error al leer el
 * documento» tras 35 segundos.
 *
 * Solo se reduce la COPIA que se envia al modelo. El fichero subido por el
 * agente no se toca.
 */
const sharp = require('sharp');

// Por debajo de estos umbrales la imagen se envia tal cual.
const MAX_BYTES_SIN_REDUCIR = 3 * 1024 * 1024;
const MAX_LADO_SIN_REDUCIR = 4000;
// Tamaño al que se reduce: una pagina A4 a 3.000 px sigue siendo legible.
const LADO_REDUCIDO = 3000;
const CALIDAD_JPEG = 85;
// Si aun reducida pasa de aqui, no se envia.
const MAX_BYTES_ENVIABLE = 3.6 * 1024 * 1024;

const FORMATOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];

const esImagen = (mimeType) => FORMATOS_IMAGEN.includes(mimeType);

/**
 * @param {Buffer} bytes
 * @param {string} mimeType
 * @returns {Promise<{ bytes: Buffer, mimeType: string, reducida: boolean }>}
 * @throws {Error} si la imagen no se puede abrir o no cabe ni reducida
 */
async function prepararImagen(bytes, mimeType) {
  if (!esImagen(mimeType)) return { bytes, mimeType, reducida: false };

  const meta = await sharp(bytes).metadata();
  const ladoMayor = Math.max(meta.width || 0, meta.height || 0);
  // TIFF no lo admite el modelo: se convierte siempre.
  const hayQueConvertir = mimeType === 'image/tiff';
  if (!hayQueConvertir && bytes.length <= MAX_BYTES_SIN_REDUCIR && ladoMayor <= MAX_LADO_SIN_REDUCIR) {
    return { bytes, mimeType, reducida: false };
  }

  const reducida = await sharp(bytes)
    .rotate() // respeta la orientacion EXIF de las fotos de movil
    .resize({ width: LADO_REDUCIDO, height: LADO_REDUCIDO, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: CALIDAD_JPEG })
    .toBuffer();

  if (reducida.length > MAX_BYTES_ENVIABLE) {
    throw new Error('La imagen es demasiado grande para leerla automaticamente incluso reducida.');
  }
  return { bytes: reducida, mimeType: 'image/jpeg', reducida: true };
}

module.exports = { prepararImagen, esImagen, MAX_BYTES_SIN_REDUCIR, LADO_REDUCIDO };
