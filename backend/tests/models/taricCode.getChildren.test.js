/**
 * TaricCode.getChildren() — hijos directos por prefijo y nivel.
 *
 * Bug real: `this.code` guarda el codigo YA relleno con ceros a 10 digitos
 * (ej. el capitulo 84 se guarda como "8400000000", no como "84"). getChildren
 * usaba `this.code` entero como prefijo de la regex, asi que nunca coincidia
 * con los hijos reales (ej. "8471000000" no empieza por "8400000000"): la
 * clasificacion nunca mostraba hijos y el campo `parent` tampoco se usaba para
 * suplir el fallo porque viene vacio en la carga actual del catalogo.
 *
 * El arreglo usa el prefijo SIGNIFICATIVO (los primeros `level` caracteres del
 * propio codigo, sin los ceros de relleno) para encontrar los hijos directos
 * (level + 2) por prefijo.
 */
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const TaricCode = require('../../src/models/TaricCode');

usarBaseDeDatosEnMemoria();

async function sembrarCatalogo() {
  await TaricCode.create([
    { code: '8400000000', level: 2, description: { es: 'Capitulo 84' }, isLeaf: false },
    { code: '8471000000', level: 4, description: { es: 'Partida 8471' }, isLeaf: false },
    { code: '8471300000', level: 6, description: { es: 'Subpartida 847130' }, isLeaf: true },
    // Otro capitulo, no debe salir como hijo de 84.
    { code: '0900000000', level: 2, description: { es: 'Capitulo 09' }, isLeaf: false },
    { code: '0901000000', level: 4, description: { es: 'Partida 0901' }, isLeaf: true }
  ]);
}

describe('TaricCode.getChildren()', () => {
  test('devuelve los hijos directos (nivel + 2) por prefijo significativo', async () => {
    await sembrarCatalogo();
    const capitulo84 = await TaricCode.findOne({ code: '8400000000' });

    const hijos = await capitulo84.getChildren();

    expect(hijos.map((h) => h.code)).toEqual(['8471000000']);
  });

  test('no devuelve codigos de otro capitulo aunque el relleno de ceros coincida parcialmente', async () => {
    await sembrarCatalogo();
    const capitulo09 = await TaricCode.findOne({ code: '0900000000' });

    const hijos = await capitulo09.getChildren();

    expect(hijos.map((h) => h.code)).toEqual(['0901000000']);
  });

  test('un codigo hoja sin hijos devuelve una lista vacia', async () => {
    await sembrarCatalogo();
    const subpartida = await TaricCode.findOne({ code: '8471300000' });

    const hijos = await subpartida.getChildren();

    expect(hijos).toEqual([]);
  });
});
