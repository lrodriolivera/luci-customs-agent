/**
 * Sustituye el indice de texto del catalogo TARIC (coleccion `tariccodes`) por
 * uno en español (ver models/TaricCode.js). Un indice de texto no se puede
 * modificar: se borra el existente y se crea el nuevo. Durante unos segundos
 * la busqueda por texto no tiene indice y devuelve error; hacerlo fuera de horas.
 *
 * Uso (dentro del contenedor del backend):
 *   node src/scripts/migrarIndiceTaricEspanol.js            -> solo dice que haria
 *   node src/scripts/migrarIndiceTaricEspanol.js --aplicar  -> lo hace
 */
const mongoose = require('mongoose');
const TaricCode = require('../models/TaricCode');

const CAMPOS = Object.freeze({ 'description.es': 'text', keywords: 'text', examples: 'text' });

/**
 * @param {import('mongodb').Db} db
 * @param {{ aplicar?: boolean }} opciones
 * @returns {Promise<{ cambiado: boolean, motivo?: string, nombre?: string, borrados?: string[] }>}
 */
async function migrar(db, { aplicar = false } = {}) {
  const coleccion = db.collection('tariccodes');
  const indices = await coleccion.indexes();
  const deTexto = indices.filter((i) => i.key && i.key._fts === 'text');
  const opciones = TaricCode.OPCIONES_INDICE_TEXTO;
  const yaEsta = deTexto.length === 1
    && deTexto[0].default_language === opciones.default_language
    && deTexto[0].language_override === opciones.language_override;
  if (yaEsta) return { cambiado: false, motivo: 'el indice ya esta en español' };
  if (!aplicar) {
    return { cambiado: false, motivo: `se borraria ${deTexto.map((i) => i.name).join(', ') || 'ninguno'} y se crearia el indice en español` };
  }
  for (const indice of deTexto) await coleccion.dropIndex(indice.name);
  const nombre = await coleccion.createIndex({ ...CAMPOS }, { ...opciones });
  return { cambiado: true, nombre, borrados: deTexto.map((i) => i.name) };
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const resultado = await migrar(mongoose.connection.db, { aplicar: process.argv.includes('--aplicar') });
    process.stdout.write(`${JSON.stringify(resultado)}\n`);
    await mongoose.disconnect();
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(1); });
}

module.exports = { migrar };
