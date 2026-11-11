/**
 * Sincronizacion automatica del catalogo TARIC: cuando toca, que se retiene y
 * que queda registrado. Mongo en memoria; la preparacion del plan se sustituye
 * por un doble (no se sale a internet).
 */
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const {
  sincronizarYRegistrar, tocaSincronizar, motivoParaRetenerCorrecciones, relojDeMadrid
} = require('../../../src/services/taric/sincronizacionAutomatica');
const TaricCode = require('../../../src/models/TaricCode');
const TaricSyncRun = require('../../../src/models/TaricSyncRun');
const worker = require('../../../src/workers/taricSyncWorker');

usarBaseDeDatosEnMemoria();

const planVacio = (extra = {}) => ({
  altas: [], bajas: [], reactivar: [], declarable: [], nivel: [],
  fuente: { nombre: 'Comision Europea - TARIC (CIRCABC)', mes: '2026-11', mesEspanol: '2026-07' },
  resumen: { altas: 0, bajas: 0 },
  correcciones: { descripciones: [], aranceles: { corregir: [], contrastar: [], conflictos: [] } },
  ...extra
});

describe('tocaSincronizar', () => {
  test('el reloj es el de Madrid, con su cambio de hora', () => {
    expect(relojDeMadrid(new Date('2026-11-11T03:30:00Z'))).toEqual({ dia: '2026-11-11', hora: 4 });   // invierno: UTC+1
    expect(relojDeMadrid(new Date('2026-07-01T01:59:00Z'))).toEqual({ dia: '2026-07-01', hora: 3 });   // verano: UTC+2
    expect(relojDeMadrid(new Date('2026-11-11T23:30:00Z'))).toEqual({ dia: '2026-11-12', hora: 0 });
  });

  test('antes de las 04:00 de Madrid no toca', () => {
    expect(tocaSincronizar(new Date('2026-11-11T02:59:00Z'), null)).toBe(false);
  });

  test('a partir de las 04:00 toca si hoy no ha habido ningun intento', () => {
    expect(tocaSincronizar(new Date('2026-11-11T03:00:00Z'), null)).toBe(true);
    expect(tocaSincronizar(new Date('2026-11-11T03:00:00Z'), new Date('2026-11-10T03:05:00Z'))).toBe(true);
  });

  test('con un intento hoy (aunque fallara) no se repite hasta mañana', () => {
    expect(tocaSincronizar(new Date('2026-11-11T15:00:00Z'), new Date('2026-11-11T03:05:00Z'))).toBe(false);
    expect(tocaSincronizar(new Date('2026-11-12T03:10:00Z'), new Date('2026-11-11T03:05:00Z'))).toBe(true);
  });
});

describe('motivoParaRetenerCorrecciones', () => {
  const descripciones = (n) => Array.from({ length: n }, (_, i) => ({ code: String(i).padStart(10, '0'), es: 'x' }));

  test('cambios pequeños se aplican solos', () => {
    expect(motivoParaRetenerCorrecciones(planVacio())).toBeNull();
    expect(motivoParaRetenerCorrecciones(planVacio({ correcciones: { descripciones: descripciones(500), aranceles: { corregir: Array(100).fill({}), contrastar: [], conflictos: [] } } }))).toBeNull();
  });

  test('una correccion masiva de descripciones o de aranceles se retiene', () => {
    const muchas = planVacio({ correcciones: { descripciones: descripciones(501), aranceles: { corregir: [], contrastar: [], conflictos: [] } } });
    const muchos = planVacio({ correcciones: { descripciones: [], aranceles: { corregir: Array(101).fill({}), contrastar: [], conflictos: [] } } });

    expect(motivoParaRetenerCorrecciones(muchas)).toContain('501 descripciones en español por corregir');
    expect(motivoParaRetenerCorrecciones(muchos)).toContain('101 aranceles por corregir');
  });

  test('las que solo cambian la ruta o el ingles no cuentan para el limite', () => {
    const soloRuta = planVacio({ correcciones: { descripciones: Array.from({ length: 5000 }, () => ({ code: 'x', legalDescription: 'a > b' })), aranceles: { corregir: [], contrastar: [], conflictos: [] } } });
    expect(motivoParaRetenerCorrecciones(soloRuta)).toBeNull();
  });
});

describe('sincronizarYRegistrar', () => {
  const existente = (code) => ({ code, breakdown: { chapter: code.slice(0, 2) }, description: { es: 'Los demás' }, level: 10, isLeaf: true, isActive: true });

  test('aplica el plan y deja el registro de la ejecucion', async () => {
    await TaricCode.collection.insertMany([existente('8544429090'), existente('2811220040')]);
    const preparar = jest.fn().mockResolvedValue(planVacio({
      bajas: [{ code: '2811220040', level: 10 }], resumen: { altas: 0, bajas: 1 },
      correcciones: { descripciones: [{ code: '8544429090', legalDescription: 'Cables > Los demás', keywords: ['cables'] }], aranceles: { corregir: [], contrastar: [], conflictos: [] } }
    }));

    const registro = await sincronizarYRegistrar({ TaricCode, TaricSyncRun, preparar, ahora: new Date('2026-11-12T03:05:00Z') });

    expect(registro).toMatchObject({ ok: true, trigger: 'automatica', fuente: { mes: '2026-11' }, aplicado: { bajas: 1, correcciones: { descripciones: 1 } } });
    expect(registro.finishedAt).toBeInstanceOf(Date);
    expect(await TaricSyncRun.countDocuments({ ok: true })).toBe(1);
    expect((await TaricCode.findOne({ code: '2811220040' }).lean()).isActive).toBe(false);
    expect((await TaricCode.findOne({ code: '8544429090' }).lean()).legalDescription).toBe('Cables > Los demás');
    // La preparacion recibe el catalogo con los campos que necesita.
    expect(preparar.mock.calls[0][0]).toEqual(expect.arrayContaining([expect.objectContaining({ code: '8544429090', description: { es: 'Los demás' } })]));
  });

  test('una correccion masiva no se aplica sola: se sincroniza el resto y se anota el motivo', async () => {
    await TaricCode.collection.insertMany([existente('8544429090')]);
    const descripciones = Array.from({ length: 600 }, () => ({ code: '8544429090', es: 'Texto oficial nuevo' }));
    const preparar = async () => planVacio({ correcciones: { descripciones, aranceles: { corregir: [], contrastar: [], conflictos: [] } } });

    const registro = await sincronizarYRegistrar({ TaricCode, TaricSyncRun, preparar });

    expect(registro.ok).toBe(true);
    expect(registro.correccionesRetenidas).toContain('600 descripciones en español por corregir');
    expect(registro.aplicado.correcciones).toEqual({ descripciones: 0, aranceles: 0, arancelesContrastados: 0, unidades: 0, noCalculables: 0, sinDerecho: 0 });
    expect((await TaricCode.findOne({ code: '8544429090' }).lean()).description.es).toBe('Los demás');
  });

  test('`forzarCorrecciones` (lanzamiento a mano) si las aplica', async () => {
    await TaricCode.collection.insertMany([existente('8544429090')]);
    const descripciones = Array.from({ length: 600 }, () => ({ code: '8544429090', es: 'Texto oficial nuevo' }));
    const preparar = async () => planVacio({ correcciones: { descripciones, aranceles: { corregir: [], contrastar: [], conflictos: [] } } });

    const registro = await sincronizarYRegistrar({ TaricCode, TaricSyncRun, preparar, trigger: 'manual', forzarCorrecciones: true });

    expect(registro).toMatchObject({ ok: true, trigger: 'manual' });
    expect((await TaricCode.findOne({ code: '8544429090' }).lean()).description.es).toBe('Texto oficial nuevo');
  });

  test('si la fuente falla no lanza: queda registrado el error y el catalogo intacto', async () => {
    await TaricCode.collection.insertMany([existente('8544429090')]);
    const preparar = jest.fn().mockRejectedValue(new Error('Nomenclatura: el formato del fichero oficial ha cambiado'));

    const registro = await sincronizarYRegistrar({ TaricCode, TaricSyncRun, preparar });

    expect(registro).toMatchObject({ ok: false, error: 'Nomenclatura: el formato del fichero oficial ha cambiado' });
    expect(registro.finishedAt).toBeInstanceOf(Date);
    expect(await TaricCode.countDocuments({ isActive: true })).toBe(1);
  });
});

describe('taricSyncWorker', () => {
  const entorno = { ...process.env };
  afterEach(() => { process.env = { ...entorno }; worker.stop(); });

  test('fuera de produccion, o con TARIC_SYNC_AUTO=false, no arranca', () => {
    const espia = jest.spyOn(global, 'setInterval');

    process.env.NODE_ENV = 'test';
    worker.start();
    process.env.NODE_ENV = 'production';
    process.env.TARIC_SYNC_AUTO = 'false';
    worker.start();

    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  test('en produccion programa la comprobacion cada media hora, sin retener el proceso', () => {
    const temporizador = { unref: jest.fn() };
    const espia = jest.spyOn(global, 'setInterval').mockReturnValue(temporizador);
    process.env.NODE_ENV = 'production';
    delete process.env.TARIC_SYNC_AUTO;

    worker.start();
    worker.start();   // una segunda llamada no duplica el temporizador

    expect(espia).toHaveBeenCalledTimes(1);
    expect(espia.mock.calls[0][1]).toBe(30 * 60 * 1000);
    expect(temporizador.unref).toHaveBeenCalled();
    espia.mockRestore();
  });

  test('si ya hubo un intento hoy no sincroniza', async () => {
    await TaricSyncRun.create({ trigger: 'automatica', startedAt: new Date('2026-11-11T03:05:00Z'), ok: false, error: 'x' });

    expect(await worker.comprobar({ ahora: new Date('2026-11-11T12:00:00Z') })).toBeNull();
    expect(await TaricSyncRun.countDocuments()).toBe(1);
  });
});
