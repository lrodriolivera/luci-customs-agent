/**
 * Guion de las publicaciones diarias del TARIC contra un Mongo real (en
 * memoria): sin `--aplicar` es una simulacion que no escribe NADA (es lo que se
 * enseña para pedir el visto bueno en produccion); con `--aplicar` registra y
 * actualiza el catalogo.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const TaricCode = require('../../src/models/TaricCode');
const TaricDailyPublication = require('../../src/models/TaricDailyPublication');
const { ejecutar } = require('../../src/scripts/procesarDiarioTaric');

usarBaseDeDatosEnMemoria();

const AHORA = new Date('2026-11-13T05:00:00Z');
const PUB_1106 = 'TARIC_20261106_1917';
const PUB_1110 = 'TARIC_20261110_1914';
const modelos = { TaricCode, TaricDailyPublication };

const existente = (code, extra = {}) => ({
  code, breakdown: { chapter: code.slice(0, 2) }, description: { es: 'Poliamidas', en: 'Polyamides' }, level: 10, isLeaf: true, isActive: true,
  duties: { thirdCountry: 6.5, origen: { fuente: 'taric_oficial' } }, ...extra
});
const alta = (code, extra = {}) => ({
  clase: 'codigo', code, accion: 'alta', desde: '20261106', hasta: '', detalle: 'Las demás', detalleEn: 'Other', nivel: 10, estado: 'pendiente', ...extra
});
const derechoPendiente = { clase: 'derecho', code: '8507600090', tipo: '103', origen: '1011', accion: 'cambio', desde: '20261101', hasta: '', detalle: '2.700 %', estado: 'pendiente' };

// Lo que traen las publicaciones: la nueva del 10/11 y la del 06/11 al releerla.
const deps = () => ({
  ahora: AHORA,
  listar: jest.fn(async () => [{ nombre: PUB_1110, fecha: '2026-11-10 19:14' }, { nombre: PUB_1106, fecha: '2026-11-06 19:17' }]),
  descargar: jest.fn(async (p) => ({ nombre: p.nombre })),
  leerCambios: jest.fn(async (ficheros) => (ficheros.nombre === PUB_1110
    ? { cambios: [alta('3908100010', { detalle: 'Poliamida-6 (PA 6)', detalleEn: 'Polyamide-6 (PA 6)' })], resumen: { codigos: 1, derechos: 0, controles: 0, otrasMedidas: 0, pendientes: 1 } }
    : { cambios: [alta('3908100090'), derechoPendiente], resumen: { codigos: 1, derechos: 1, controles: 0, otrasMedidas: 0, pendientes: 2 } })),
  derechos: jest.fn(async () => ({ mes: '2026-11', derechos: new Map([['3908100000', [{ codigoAdicional: '', texto: '6.500 %' }]]]) }))
});

/** Todo lo que hay en la base de datos, coleccion a coleccion. */
async function fotografia() {
  const colecciones = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name).sort();
  const contenido = {};
  for (const nombre of colecciones) contenido[nombre] = await mongoose.connection.db.collection(nombre).find({}).sort({ _id: 1 }).toArray();
  return JSON.parse(JSON.stringify(contenido));
}

beforeEach(async () => {
  await TaricCode.create(existente('3908100000', { level: 6, legalDescription: 'Plástico > Poliamidas' }));
  await TaricCode.create(existente('8507600090'));
  // Registrada antes de que se guardara el nivel de las altas: hay que releerla.
  await TaricDailyPublication.create({
    nombre: PUB_1106, fecha: '2026-11-06 19:17', procesadoEn: AHORA, resumen: {},
    cambios: [alta('3908100090', { nivel: undefined, detalleEn: undefined }), derechoPendiente]
  });
});

afterEach(() => jest.restoreAllMocks());

describe('procesarDiarioTaric sin --aplicar', () => {
  test('descarga, relee y calcula, pero no escribe nada en la base de datos', async () => {
    const escrituras = ['create', 'insertMany', 'bulkWrite', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'replaceOne']
      .flatMap((metodo) => [TaricCode, TaricDailyPublication].map((modelo) => jest.spyOn(modelo, metodo)));
    const guardar = jest.spyOn(mongoose.Model.prototype, 'save');
    const antes = await fotografia();
    const d = deps();

    const sim = await ejecutar({ aplicar: false, modelos, deps: d, salida: jest.fn() });

    // Calcula lo mismo que aplicaria.
    expect(sim.nuevas.map((n) => n.nombre)).toEqual([PUB_1110]);
    expect(sim.releidas).toEqual([PUB_1106]);
    expect(sim.derechos.aplicar.map((a) => a.dato.code)).toEqual(['8507600090']);
    expect(sim.altas.aplicar.map((a) => a.documento.code).sort()).toEqual(['3908100010', '3908100090']);
    expect(sim.altas.padres).toEqual(['3908100000']);
    expect(d.descargar).toHaveBeenCalledTimes(2);
    // Y no ha escrito nada.
    escrituras.forEach((espia) => expect(espia).not.toHaveBeenCalled());
    expect(guardar).not.toHaveBeenCalled();
    expect(await fotografia()).toEqual(antes);
  });

  test('lo que imprime avisa de que no se ha escrito nada', async () => {
    const salida = jest.fn();

    await ejecutar({ aplicar: false, modelos, deps: deps(), salida });

    const texto = salida.mock.calls.map((c) => c[0]).join('\n');
    expect(texto).toContain('SIMULACION — códigos que se darían de alta ahora: 2');
    expect(texto).toContain('3908100010 · «Poliamida-6 (PA 6)» · 6.5 %');
    expect(texto).toContain('Dejarían de ser declarables: 3908100000');
    expect(texto).toContain('Nada se ha escrito en la base de datos');
  });
});

describe('procesarDiarioTaric con --aplicar', () => {
  test('registra, relee y actualiza el catálogo', async () => {
    await ejecutar({ aplicar: true, modelos, deps: deps(), salida: jest.fn() });

    expect(await TaricDailyPublication.countDocuments({ nombre: PUB_1110 })).toBe(1);
    expect((await TaricCode.findOne({ code: '8507600090' }).lean()).duties.thirdCountry).toBe(2.7);
    expect(await TaricCode.countDocuments({ code: { $in: ['3908100010', '3908100090'] } })).toBe(2);
    expect((await TaricCode.findOne({ code: '3908100000' }).lean()).isLeaf).toBe(false);
    const releida = await TaricDailyPublication.findOne({ nombre: PUB_1106 }).lean();
    expect(releida.cambios.find((c) => c.code === '3908100090')).toMatchObject({ nivel: 10, estado: 'aplicado' });
  });
});
