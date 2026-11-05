/**
 * Segmento de ruta seguro para las URLs de la API.
 *
 * Un valor con "/", "?", "#" o ".." interpolado a pelo en una ruta cambia el
 * endpoint al que va la petición (el navegador normaliza los "..") y esa
 * petición viaja con el token del usuario. `seg` codifica el valor y rechaza
 * lo que no puede ser un segmento: vacío, undefined/null, objetos, "." y "..".
 * Rechazar vacío evita además que `/api/x/${id}` degenere en `/api/x/`
 * (otro endpoint, normalmente el de la colección).
 */
export function seg(valor) {
  if (valor === null || valor === undefined || (typeof valor !== 'string' && typeof valor !== 'number')) {
    throw new Error('Valor de ruta vacío o no válido')
  }
  const texto = String(valor)
  if (texto.trim() === '') {
    throw new Error('Valor de ruta vacío o no válido')
  }
  if (texto === '.' || texto === '..') {
    throw new Error('Valor de ruta no válido')
  }
  return encodeURIComponent(texto)
}
