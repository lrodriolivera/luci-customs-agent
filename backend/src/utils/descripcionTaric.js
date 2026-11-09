/**
 * Texto de una descripcion TARIC, que puede venir como string o como objeto
 * multiidioma ({ es, en, ... }). Devuelve el string si ya lo es; si no, es, luego
 * en, luego el primer valor string no vacio del objeto; si no hay nada, ''.
 * Nunca devuelve un objeto.
 */
function textoDescripcion(description) {
  if (typeof description === 'string') return description;
  if (!description || typeof description !== 'object') return '';
  if (typeof description.es === 'string' && description.es) return description.es;
  if (typeof description.en === 'string' && description.en) return description.en;
  const primero = Object.values(description).find(v => typeof v === 'string' && v);
  return primero || '';
}

module.exports = { textoDescripcion };
