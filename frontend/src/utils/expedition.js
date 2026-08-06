/**
 * Helpers de expediente compartidos entre pantallas.
 *
 * Existen porque la misma comparacion mal escrita se repitio en cinco sitios:
 * el backend guarda operationType y status en minusculas ('import', 'export',
 * 'completed'), pero varias pantallas comparaban contra 'IMPORT' / 'COMPLETED'.
 * El sintoma en el portal del cliente era que toda importacion se anunciaba
 * como expediente "de exportacion". Comparar aqui, en un solo punto, evita que
 * vuelva a divergir pantalla a pantalla.
 */

const normalizar = (valor) => String(valor ?? '').toLowerCase()

export const esImportacion = (expedition) =>
  normalizar(expedition?.operationType) === 'import'

export const esCompletado = (expedition) =>
  normalizar(expedition?.status) === 'completed'
