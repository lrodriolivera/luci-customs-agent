/**
 * taric/declarable — ¿se puede declarar este codigo de 10 digitos?
 *
 * Casos reales de preproduccion (17/Nov/2026):
 *   - «Auriculares inalambricos Bluetooth 5.3 con estuche de carga»: la IA
 *     propuso 8518300000 y se aplico tal cual. En el TARIC esa linea tiene
 *     subdivisiones (8518300010 aeronaves civiles / 8518300090 los demas):
 *     no es declarable.
 *   - «Canales de bovino frescas o refrigeradas»: 0201100000, idem
 *     (subdivisiones 0201100021…0201100098).
 *   - 6302219000 (PR #116): codigo que no existe.
 * BD en memoria, nunca produccion.
 */
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const TaricCode = require('../../../src/models/TaricCode');
const { comprobarDeclarable } = require('../../../src/services/taric/declarable');

function linea(code, { isLeaf = true, isActive = true, es = `Descripcion ${code}` } = {}) {
  return { code, isLeaf, isActive, level: 10, description: { es } };
}

describe('comprobarDeclarable', () => {
  usarBaseDeDatosEnMemoria();

  async function sembrarCatalogo() {
    await TaricCode.insertMany([
      linea('8518300000', { isLeaf: false, es: 'Auriculares, incluidos los de casco' }),
      linea('8518300010', { es: 'Destinados a aeronaves civiles' }),
      linea('8518300090', { es: 'Los demás' }),
      linea('4911101000', { es: 'Catálogos comerciales' }),
      linea('4911109000', { es: 'Los demás' }),
      linea('0201100000', { isLeaf: false, es: 'En canales o medias canales' }),
      linea('0201100021', { es: 'de bisonte' }),
      linea('0201100029', { es: 'Las demás' }),
      linea('6302210000', { isLeaf: false, es: 'De algodón' }),
      linea('6302210010', { es: 'De algodón, estampadas' }),
      linea('8471300000', { es: 'Máquinas automáticas portátiles' }),
      linea('1509109000', { isActive: false, es: 'Aceite de oliva virgen (antigua)' })
    ]);
  }

  it('un codigo hoja y activo es declarable', async () => {
    await sembrarCatalogo();
    const r = await comprobarDeclarable('8471300000');
    expect(r).toMatchObject({ comprobado: true, declarable: true, codigo: '8471300000' });
  });

  it('acepta el codigo con espacios o puntos', async () => {
    await sembrarCatalogo();
    const r = await comprobarDeclarable('4911.10.10 00');
    expect(r).toMatchObject({ comprobado: true, declarable: true, codigo: '4911101000' });
  });

  it('caso real: 8518300000 (auriculares) no es declarable y ofrece sus subdivisiones', async () => {
    await sembrarCatalogo();
    const r = await comprobarDeclarable('8518300000');
    expect(r.comprobado).toBe(true);
    expect(r.declarable).toBe(false);
    expect(r.motivo).toMatch(/subdivisiones/);
    expect(r.alternativas.map(a => a.code)).toEqual(['8518300010', '8518300090']);
  });

  it('caso real: 0201100000 (canales de bovino) no es declarable', async () => {
    await sembrarCatalogo();
    const r = await comprobarDeclarable('0201100000');
    expect(r.declarable).toBe(false);
    expect(r.alternativas.map(a => a.code)).toEqual(['0201100021', '0201100029']);
  });

  it('una linea con subdivisiones no es declarable aunque la ficha no traiga isLeaf', async () => {
    await TaricCode.insertMany([
      linea('6109100000', { isLeaf: undefined }),
      linea('6109100010')
    ]);
    const r = await comprobarDeclarable('6109100000');
    expect(r.declarable).toBe(false);
    expect(r.alternativas.map(a => a.code)).toEqual(['6109100010']);
  });

  it('un codigo sin subdivisiones es declarable aunque la ficha no traiga isLeaf', async () => {
    await TaricCode.insertMany([linea('6109100010', { isLeaf: undefined }), linea('6109100090')]);
    const r = await comprobarDeclarable('6109100010');
    expect(r.declarable).toBe(true);
  });

  it('caso PR #116: 6302219000 no existe y ofrece los de la misma subpartida', async () => {
    await sembrarCatalogo();
    const r = await comprobarDeclarable('6302219000');
    expect(r.declarable).toBe(false);
    expect(r.motivo).toMatch(/no existe/);
    expect(r.alternativas.map(a => a.code)).toEqual(['6302210010']);
  });

  it('un codigo dado de baja no es declarable', async () => {
    await sembrarCatalogo();
    const r = await comprobarDeclarable('1509109000');
    expect(r.declarable).toBe(false);
    expect(r.motivo).toMatch(/baja/);
  });

  it('con el catalogo vacio no se comprueba (no se puede afirmar nada)', async () => {
    const r = await comprobarDeclarable('9999999999');
    expect(r).toMatchObject({ comprobado: false, codigo: '9999999999' });
  });

  it('un codigo que no tiene 10 digitos no se comprueba', async () => {
    await sembrarCatalogo();
    expect((await comprobarDeclarable('85183000')).comprobado).toBe(false);
    expect((await comprobarDeclarable('')).comprobado).toBe(false);
    expect((await comprobarDeclarable({ $ne: null })).comprobado).toBe(false);
  });
});
