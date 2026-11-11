/**
 * Fecha del propio documento (no la de subida), tal como la indica quien lo sube.
 *
 * Existe por la autorizacion de despacho: vale cuatro años desde su fecha, y
 * una autorizacion antigua subida hoy no puede contar como si fuera de hoy
 * (decision de Luis, 11/Nov/2026).
 */
const TIPOS_CON_FECHA_OBLIGATORIA = ['dispatch_authorization'];
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ANIO_MINIMO = 1990;

/**
 * @param {*} valor fecha en formato AAAA-MM-DD (lo que envia un <input type="date">)
 * @param {string} tipo tipo de documento
 * @param {{ ahora?: Date }} [opciones]
 * @returns {{ fecha: Date|null, error: string|null }}
 */
function fechaDeDocumento(valor, tipo, { ahora = new Date() } = {}) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) {
    return TIPOS_CON_FECHA_OBLIGATORIA.includes(tipo)
      ? { fecha: null, error: 'Indica la fecha de la autorizacion de despacho' }
      : { fecha: null, error: null };
  }

  const partes = FORMATO.exec(texto);
  const fecha = partes ? new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), 12)) : null;
  const existe = fecha && fecha.getUTCMonth() === Number(partes[2]) - 1 && fecha.getUTCDate() === Number(partes[3]);
  if (!existe || Number(partes[1]) < ANIO_MINIMO) {
    return { fecha: null, error: 'La fecha del documento no es valida (formato AAAA-MM-DD)' };
  }
  // Margen de un dia por el huso horario de quien la teclea.
  if (fecha.getTime() > ahora.getTime() + 24 * 3600 * 1000) {
    return { fecha: null, error: 'La fecha del documento no puede ser futura' };
  }
  return { fecha, error: null };
}

module.exports = { fechaDeDocumento, TIPOS_CON_FECHA_OBLIGATORIA };
