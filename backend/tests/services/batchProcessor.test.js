/**
 * batchProcessor: procesamiento masivo de declaraciones/H7/transitos.
 *
 * Es un singleton con estado en memoria (`batchJobs` Map a nivel de modulo) y
 * una maquina de estados: createBatchJob -> startBatchJob -> validateItems ->
 * processItems (con reintentos) -> completed/completed_with_errors/failed.
 *
 * Se ejercita la logica REAL contra Mongo en memoria (modelos Expedition/
 * H7Declaration/Transit sin mockear). Lo unico que se espia es
 * `workflowEvents.emitWorkflowEvent` para observar las emisiones sin efectos.
 *
 * ⚠️ HALLAZGO documentado en SECURITY_AUDIT.md (decision de Luis: NO arreglar,
 * solo fijar el comportamiento real): los 3 metodos create* construyen los
 * documentos contra un esquema antiguo (createdBy string, status fuera de enum,
 * faltan transportMode/offices/totals/owner, usan organizationId inexistente)
 * -> `expedition.save()` SIEMPRE lanza ValidationError. Es codigo de la
 * "Fase 6.6" nunca cableado a produccion. Estos tests fijan esa realidad: la
 * fase de validacion funciona, pero la de procesamiento deja todo item en
 * 'failed'. Si algun dia se arregla create*, estos tests obligaran a revisarlo.
 *
 * Notas de aislamiento del singleton:
 *  - cada test usa un organizationId propio (los jobs no se limpian entre tests).
 *  - fake timers para saltarse el retryDelayMs (5s x 3 intentos por item) y los
 *    setTimeout de jobs programados, sin esperas reales.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const batchProcessor = require('../../src/services/workflow/batchProcessor');
const { workflowEvents } = require('../../src/services/workflow/eventEmitter');

usarBaseDeDatosEnMemoria();

let emitSpy;
beforeEach(() => {
  emitSpy = jest.spyOn(workflowEvents, 'emitWorkflowEvent').mockImplementation(() => {});
});
afterEach(() => {
  emitSpy.mockRestore();
});

const orgId = () => new mongoose.Types.ObjectId();

const itemH1Valido = () => ({
  client: { companyName: 'ACME SL', nif: 'B12345678' },
  goods: [{ description: 'Portatil', quantity: 1, taricCode: '84713000' }],
  originCountry: 'CN'
});

describe('createBatchJob', () => {
  test('crea un job pending con stats iniciales e items indexados', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido(), itemH1Valido()]);
    expect(job.status).toBe('pending');
    expect(job.stats).toMatchObject({ total: 2, pending: 2, completed: 0, failed: 0 });
    expect(job.items[0].index).toBe(0);
    expect(job.items[1].index).toBe(1);
    expect(job.logs.some(l => /created/i.test(l.message))).toBe(true);
  });

  test('rechaza lotes que exceden el maximo (500)', async () => {
    const items = Array.from({ length: 501 }, itemH1Valido);
    await expect(batchProcessor.createBatchJob(orgId(), orgId(), items))
      .rejects.toThrow(/exceeds maximum/i);
  });
});

describe('validateItem (validacion pura por tipo)', () => {
  test('H1: exige expeditionId/cliente, mercancia, origen y TARIC >= 8', async () => {
    const r = await batchProcessor.validateItem({}, 'h1');
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/expeditionId o datos del cliente/),
      expect.stringMatching(/al menos una mercancia/),
      expect.stringMatching(/origen es requerido/)
    ]));
  });

  test('H1: un TARIC corto invalida la mercancia', async () => {
    const r = await batchProcessor.validateItem(
      { client: { nif: 'B1' }, originCountry: 'CN', goods: [{ description: 'x', taricCode: '123' }] }, 'h1');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => /TARIC invalido/.test(e))).toBe(true);
  });

  test('H1 valido pasa', async () => {
    const r = await batchProcessor.validateItem(itemH1Valido(), 'h1');
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('H7: rechaza valor total > 150 EUR', async () => {
    const r = await batchProcessor.validateItem({ goods: [{ description: 'x' }], totalValue: 200 }, 'h7');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => /150 EUR/.test(e))).toBe(true);
  });

  test('transit: exige aduanas de partida y destino', async () => {
    const r = await batchProcessor.validateItem({}, 'transit');
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/partida/), expect.stringMatching(/destino/)
    ]));
  });

  test('tipo desconocido es invalido', async () => {
    const r = await batchProcessor.validateItem({}, 'no_existe');
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/desconocido/);
  });
});

describe('startBatchJob + validateOnly (fase de validacion aislada)', () => {
  // startBatchJob lanza processJob en background (no lo espera) y retorna al
  // instante -> el estado inmediato es 'validating'. Para observar el resultado
  // deterministico de validateOnly (sin reintentos) se ejercita processJob
  // directamente, que SI es awaitable.
  test('validateOnly=true: termina en completed sin procesar, marca validated/failed', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(),
      [itemH1Valido(), { goods: [] }], { validateOnly: true });

    await batchProcessor.processJob(job);

    expect(job.status).toBe('completed');
    expect(job.items[0].status).toBe('validated');
    expect(job.items[1].status).toBe('validation_failed');
    expect(job.stats.failed).toBe(1);
  });

  test('sin items validos el job termina en failed', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(),
      [{ goods: [] }], { validateOnly: true });
    await batchProcessor.processJob(job);
    expect(job.status).toBe('failed');
  });

  test('startBatchJob deja el job en validating (procesa en background) y no re-arranca', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()], { validateOnly: true });
    const returned = await batchProcessor.startBatchJob(job.id);
    // Retorna el job de inmediato, sin esperar al procesamiento de fondo.
    expect(returned.status).toBe('validating');
    expect(returned.startedAt).toBeInstanceOf(Date);
    await expect(batchProcessor.startBatchJob(job.id)).rejects.toThrow(/Cannot start job/);
  });

  test('arrancar un job inexistente lanza', async () => {
    await expect(batchProcessor.startBatchJob('no_existe')).rejects.toThrow(/not found/i);
  });
});

describe('fase de procesamiento (HALLAZGO: create* rompe con el esquema actual)', () => {
  test('un H1 valido pasa validacion pero NO persiste: item queda failed', async () => {
    jest.useFakeTimers();
    try {
      const job = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()]);
      const proc = batchProcessor.processJob(job); // corre en "background"
      // NO runAllTimers: el setInterval de cleanup a nivel de modulo nunca
      // drena. Avanzamos solo la ventana de reintentos (3 x retryDelayMs=5s).
      await jest.advanceTimersByTimeAsync(20000);
      await proc;

      // La validacion lo dio por bueno...
      expect(job.items[0].attempts).toBe(3); // reintenta el maximo
      // ...pero el save real revienta -> el item acaba failed y el job con errores.
      expect(job.items[0].status).toBe('failed');
      expect(job.items[0].error).toMatch(/validation failed|required|enum/i);
      expect(job.status).toBe('completed_with_errors');
      expect(job.stats.failed).toBe(1);
      expect(job.stats.completed).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  // Comportamiento real de stopOnError: processItem marca job.status='failed' y
  // deja un log al fallar el item, PERO processJob recomputa el estado final a
  // partir de stats.failed al terminar -> un lote de un solo item (una sola
  // "chunk") acaba en 'completed_with_errors'. El efecto util de stopOnError
  // (cortar el bucle de chunks) solo se observa con >maxConcurrent items. Aqui
  // se fija que, al menos, deja rastro del corte.
  test('stopOnError registra el corte aunque processJob recompute el estado final', async () => {
    jest.useFakeTimers();
    try {
      const job = await batchProcessor.createBatchJob(orgId(), orgId(),
        [itemH1Valido()], { stopOnError: true, notifyOnComplete: false });
      const proc = batchProcessor.processJob(job);
      await jest.advanceTimersByTimeAsync(20000);
      await proc;
      expect(job.stats.failed).toBe(1);
      expect(job.status).toBe('completed_with_errors');
      expect(job.logs.some(l => /stopOnError/i.test(l.message))).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('gestion de jobs', () => {
  test('getJobStatus resume estado y ultimos logs; null si no existe', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()]);
    const status = batchProcessor.getJobStatus(job.id);
    expect(status.id).toBe(job.id);
    expect(status.status).toBe('pending');
    expect(Array.isArray(status.logs)).toBe(true);
    expect(batchProcessor.getJobStatus('nope')).toBeNull();
  });

  test('getJobDetail devuelve el job completo', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()]);
    expect(batchProcessor.getJobDetail(job.id)).toBe(job);
  });

  test('cancelJob marca cancelled; no cancela finalizados; lanza si no existe', async () => {
    const job = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()]);
    const cancelled = batchProcessor.cancelJob(job.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).toBeInstanceOf(Date);

    expect(() => batchProcessor.cancelJob('nope')).toThrow(/not found/i);

    const finished = await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()]);
    finished.status = 'completed';
    expect(() => batchProcessor.cancelJob(finished.id)).toThrow(/Cannot cancel/);
  });

  test('listJobs acota por organizacion y filtra por estado', async () => {
    const org = orgId();
    const a = await batchProcessor.createBatchJob(org, orgId(), [itemH1Valido()]);
    const b = await batchProcessor.createBatchJob(org, orgId(), [itemH1Valido()]);
    await batchProcessor.createBatchJob(orgId(), orgId(), [itemH1Valido()]); // otra org

    const todos = batchProcessor.listJobs(org);
    expect(todos.map(j => j.id).sort()).toEqual([a.id, b.id].sort());

    b.status = 'cancelled';
    const soloCancelados = batchProcessor.listJobs(org, { status: 'cancelled' });
    expect(soloCancelados.map(j => j.id)).toEqual([b.id]);
  });

  test('cleanupOldJobs elimina los completados antiguos y conserva los recientes', async () => {
    const org = orgId();
    const viejo = await batchProcessor.createBatchJob(org, orgId(), [itemH1Valido()]);
    viejo.status = 'completed';
    viejo.completedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h atras
    const reciente = await batchProcessor.createBatchJob(org, orgId(), [itemH1Valido()]);
    reciente.status = 'completed';
    reciente.completedAt = new Date();

    batchProcessor.cleanupOldJobs(24);

    expect(batchProcessor.getJobDetail(viejo.id)).toBeUndefined();
    expect(batchProcessor.getJobDetail(reciente.id)).toBeDefined();
  });
});

describe('scheduleJob (job programado a futuro)', () => {
  test('startBatchJob con scheduledFor futuro no procesa, programa un timeout', async () => {
    jest.useFakeTimers();
    try {
      const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const job = await batchProcessor.createBatchJob(orgId(), orgId(),
        [itemH1Valido()], { scheduledFor: futuro });
      await batchProcessor.startBatchJob(job.id);

      expect(job.status).toBe('pending'); // no arranco la validacion
      expect(job.scheduledTimeout).toBeDefined();
      expect(job.logs.some(l => /scheduled/i.test(l.message))).toBe(true);
      clearTimeout(job.scheduledTimeout); // evitar que dispare
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('helpers', () => {
  test('chunkArray parte en trozos del tamano pedido', () => {
    expect(batchProcessor.chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batchProcessor.chunkArray([], 3)).toEqual([]);
  });
});
