const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { migrar } = require('../../src/scripts/migrarIndiceTaricEspanol');

usarBaseDeDatosEnMemoria();

const coleccion = () => mongoose.connection.db.collection('tariccodes');
const indicesDeTexto = async () => (await coleccion().indexes()).filter((i) => i.key._fts === 'text');

describe('migrarIndiceTaricEspanol', () => {
  beforeEach(async () => {
    await coleccion().drop().catch(() => {});
    await coleccion().insertOne({ code: '6403999800', description: { es: 'Los demás calzados de cuero' }, keywords: ['zapatos'], isActive: true, isLeaf: true });
    await coleccion().createIndex({ 'description.es': 'text', keywords: 'text', examples: 'text' });
  });

  test('sin --aplicar no toca nada y dice qué haría', async () => {
    const r = await migrar(mongoose.connection.db);
    expect(r.cambiado).toBe(false);
    expect(r.motivo).toMatch(/se borraria/);
    expect((await indicesDeTexto())[0].default_language).toBe('english');
  });

  test('con --aplicar deja un único índice de texto en español y busca con plurales; repetirlo no hace nada', async () => {
    const r = await migrar(mongoose.connection.db, { aplicar: true });
    expect(r.cambiado).toBe(true);
    const indices = await indicesDeTexto();
    expect(indices).toHaveLength(1);
    expect(indices[0]).toMatchObject({ default_language: 'spanish', language_override: 'idiomaIndice' });
    const encontrados = await coleccion().find({ $text: { $search: 'calzado de cuero' } }).toArray();
    expect(encontrados.map((d) => d.code)).toContain('6403999800');
    expect((await migrar(mongoose.connection.db, { aplicar: true })).cambiado).toBe(false);
  });
});
