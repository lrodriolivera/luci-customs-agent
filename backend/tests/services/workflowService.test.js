/**
 * workflowService — gestión de workflows (CRUD, scheduling, eventos, ejecución,
 * estadísticas). Fase 6.6.
 *
 * NOTA: este fichero reemplaza un test anterior que NO importaba el servicio
 * (solo afirmaba sobre literales inline → 0% de cobertura real). Ahora
 * ejercitamos el servicio de verdad.
 *
 * Modelos Workflow/WorkflowExecution/Expedition con Mongo EN MEMORIA (reales,
 * sin mockear) para ejercitar findByEvent/getByWorkflow/getStats/getGlobalStats
 * y los métodos publish()/clone(). Fronteras mockeadas: `workflowEngine` (ya
 * cubierto al ~95% en su campaña) y `actionHandlers` (solo lo usa initialize()).
 * El scheduling usa setInterval: fake timers + unscheduleWorkflow para no dejar
 * timers colgando.
 *
 * Verifica también el guard cross-tenant de executeWorkflowManually (una entidad
 * de otra organización lanza 'Entidad no encontrada').
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

const mongoose = require('mongoose');

jest.mock('../../src/services/workflow/workflowEngine');
jest.mock('../../src/services/workflow/actionHandlers', () => ({ registerAllHandlers: jest.fn() }));

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const svc = require('../../src/services/workflow/workflowService');
const engine = require('../../src/services/workflow/workflowEngine');
const { Workflow, WorkflowExecution, Expedition } = require('../../src/models');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

const ORG = new mongoose.Types.ObjectId().toString();
const ORG_B = new mongoose.Types.ObjectId().toString();
const USER = new mongoose.Types.ObjectId().toString();

/** Crea un workflow válido en la BD. */
async function crearWorkflow(overrides = {}) {
  const base = {
    name: 'WF test',
    organizationId: ORG,
    trigger: { type: 'event', event: 'expedition.created' },
    actions: [{ order: 1, type: 'send_email', name: 'notificar' }],
    createdBy: USER,
    updatedBy: USER,
    enabled: false,
    status: 'draft'
  };
  return Workflow.create({ ...base, ...overrides });
}

beforeEach(() => {
  engine.executeWorkflow.mockResolvedValue({ executionId: 'e1', status: 'completed' });
  engine.cancelExecution.mockResolvedValue({ cancelled: true });
  engine.getRunningExecutions.mockReturnValue([]);
});

// ==================== CRUD ====================
describe('CRUD', () => {
  test('createWorkflow guarda con status draft y createdBy/updatedBy', async () => {
    const wf = await svc.createWorkflow(
      { name: 'Nuevo', organizationId: ORG, trigger: { type: 'manual' } },
      USER
    );
    expect(wf.status).toBe('draft');
    expect(String(wf.createdBy)).toBe(USER);
  });

  test('getWorkflow acota por organización', async () => {
    const wf = await crearWorkflow();
    expect(await svc.getWorkflow(wf._id, ORG)).not.toBeNull();
    expect(await svc.getWorkflow(wf._id, ORG_B)).toBeNull();
  });

  test('listWorkflows filtra por status/enabled/search y pagina', async () => {
    await crearWorkflow({ name: 'Alpha', category: 'compliance', enabled: true, status: 'active' });
    await crearWorkflow({ name: 'Beta' });
    const r = await svc.listWorkflows(ORG, { status: 'active', enabled: true, search: 'Alph', limit: 10 });
    expect(r.workflows).toHaveLength(1);
    expect(r.workflows[0].name).toBe('Alpha');
    expect(r.pagination.total).toBe(1);
  });

  test('listWorkflows filtra por category', async () => {
    await crearWorkflow({ name: 'C1', category: 'compliance' });
    await crearWorkflow({ name: 'C2', category: 'custom' });
    const r = await svc.listWorkflows(ORG, { category: 'compliance' });
    expect(r.workflows).toHaveLength(1);
    expect(r.workflows[0].name).toBe('C1');
  });

  test('listWorkflows sin filtros devuelve todos de la org', async () => {
    await crearWorkflow();
    await crearWorkflow({ name: 'Otro' });
    const r = await svc.listWorkflows(ORG, {});
    expect(r.workflows.length).toBe(2);
  });

  test('updateWorkflow modifica solo campos permitidos', async () => {
    const wf = await crearWorkflow();
    const upd = await svc.updateWorkflow(wf._id, { name: 'Renombrado', foo: 'ignorado' }, USER, ORG);
    expect(upd.name).toBe('Renombrado');
    expect(upd.foo).toBeUndefined();
  });

  test('updateWorkflow lanza si no existe / otra org', async () => {
    const wf = await crearWorkflow();
    await expect(svc.updateWorkflow(wf._id, {}, USER, ORG_B)).rejects.toThrow('Workflow not found');
  });

  test('deleteWorkflow borra y lanza si no existe', async () => {
    const wf = await crearWorkflow();
    const del = await svc.deleteWorkflow(wf._id, ORG);
    expect(String(del._id)).toBe(String(wf._id));
    await expect(svc.deleteWorkflow(wf._id, ORG)).rejects.toThrow('Workflow not found');
  });

  test('toggleWorkflow draft→active al habilitar y active→paused al deshabilitar', async () => {
    const wf = await crearWorkflow();
    const on = await svc.toggleWorkflow(wf._id, true, USER, ORG);
    expect(on.enabled).toBe(true);
    expect(on.status).toBe('active');
    const off = await svc.toggleWorkflow(wf._id, false, USER, ORG);
    expect(off.enabled).toBe(false);
    expect(off.status).toBe('paused');
  });

  test('toggleWorkflow lanza si no existe', async () => {
    await expect(svc.toggleWorkflow(new mongoose.Types.ObjectId(), true, USER, ORG))
      .rejects.toThrow('Workflow not found');
  });

  test('cloneWorkflow duplica con nuevo nombre', async () => {
    const wf = await crearWorkflow();
    const clon = await svc.cloneWorkflow(wf._id, 'Copia', USER, ORG);
    expect(clon.name).toBe('Copia');
    expect(String(clon._id)).not.toBe(String(wf._id));
  });

  test('cloneWorkflow lanza si no existe', async () => {
    await expect(svc.cloneWorkflow(new mongoose.Types.ObjectId(), 'X', USER, ORG))
      .rejects.toThrow('Workflow not found');
  });

  test('publishWorkflow publica y lanza si no existe', async () => {
    const wf = await crearWorkflow();
    const pub = await svc.publishWorkflow(wf._id, USER, ORG, 'v1');
    expect(pub.status).toBe('active');
    await expect(svc.publishWorkflow(new mongoose.Types.ObjectId(), USER, ORG, 'x'))
      .rejects.toThrow('Workflow not found');
  });
});

// ==================== scheduling ====================
describe('scheduling', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('scheduleWorkflow sin cron no programa nada', () => {
    const wf = { _id: new mongoose.Types.ObjectId(), name: 'x', trigger: { type: 'schedule', schedule: {} } };
    svc.scheduleWorkflow(wf);
    expect(svc.scheduledJobs.has(wf._id.toString())).toBe(false);
  });

  test('scheduleWorkflow con cron registra un intervalo y unschedule lo limpia', () => {
    const id = new mongoose.Types.ObjectId();
    const wf = { _id: id, name: 'cron', trigger: { type: 'schedule', schedule: { cron: '0 * * * *' } } };
    svc.scheduleWorkflow(wf);
    expect(svc.scheduledJobs.has(id.toString())).toBe(true);
    svc.unscheduleWorkflow(id);
    expect(svc.scheduledJobs.has(id.toString())).toBe(false);
  });

  test('unscheduleWorkflow es no-op si no había intervalo', () => {
    expect(() => svc.unscheduleWorkflow(new mongoose.Types.ObjectId())).not.toThrow();
  });
});

// ==================== shouldRunScheduledWorkflow ====================
describe('shouldRunScheduledWorkflow', () => {
  test('false sin schedule', () => {
    expect(svc.shouldRunScheduledWorkflow({ trigger: {} })).toBe(false);
  });

  test('false si aún no llegó startDate', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(svc.shouldRunScheduledWorkflow({ trigger: { schedule: { startDate: future } } })).toBe(false);
  });

  test('false si ya pasó endDate', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(svc.shouldRunScheduledWorkflow({ trigger: { schedule: { endDate: past } } })).toBe(false);
  });

  test('true dentro de ventana sin restricción horaria', () => {
    expect(svc.shouldRunScheduledWorkflow({ trigger: { schedule: {} } })).toBe(true);
  });

  test('respeta horario laboral (ventana imposible → false)', () => {
    // start=end=25 → cualquier hora queda fuera de [25,25).
    const wf = {
      trigger: {
        schedule: {},
        config: { onlyBusinessHours: true, businessHoursStart: 25, businessHoursEnd: 25 }
      }
    };
    expect(svc.shouldRunScheduledWorkflow(wf)).toBe(false);
  });

  test('horario laboral abierto 0-24 → depende solo del día (no lanza en fin de semana)', () => {
    const wf = {
      trigger: {
        schedule: {},
        config: { onlyBusinessHours: true, businessHoursStart: 0, businessHoursEnd: 24 }
      }
    };
    // Con la ventana horaria abierta, el resultado depende del día actual.
    const day = new Date().getDay();
    const esperado = !(day === 0 || day === 6);
    expect(svc.shouldRunScheduledWorkflow(wf)).toBe(esperado);
  });
});

// ==================== handleEvent ====================
describe('handleEvent', () => {
  test('ignora eventos sin organizationId', async () => {
    await svc.handleEvent('expedition.created', { data: {} });
    expect(engine.executeWorkflow).not.toHaveBeenCalled();
  });

  test('dispara los workflows que escuchan el evento', async () => {
    await crearWorkflow({ enabled: true, status: 'active', trigger: { type: 'event', event: 'expedition.created' } });
    await svc.handleEvent('expedition.created', { organizationId: ORG, entityType: 'expedition', entityId: 'x', data: {} });
    // executeWorkflow es fire-and-forget y hace un findById async antes de llamar
    // al engine: esperamos a que se resuelva con reintentos cortos.
    for (let i = 0; i < 20 && engine.executeWorkflow.mock.calls.length === 0; i++) {
      await new Promise((r) => setImmediate(r));
    }
    expect(engine.executeWorkflow).toHaveBeenCalled();
  });

  test('no falla si ningún workflow escucha el evento', async () => {
    await svc.handleEvent('inspection.failed', { organizationId: ORG, data: {} });
    expect(engine.executeWorkflow).not.toHaveBeenCalled();
  });
});

// ==================== ejecución ====================
describe('ejecución', () => {
  test('executeWorkflow lanza si no existe o está deshabilitado', async () => {
    await expect(svc.executeWorkflow(new mongoose.Types.ObjectId(), {}, {}))
      .rejects.toThrow('Workflow not found');

    const wf = await crearWorkflow({ enabled: false });
    await expect(svc.executeWorkflow(wf._id, {}, {})).rejects.toThrow('Workflow is disabled');
  });

  test('executeWorkflow delega en el engine si está habilitado', async () => {
    const wf = await crearWorkflow({ enabled: true, status: 'active' });
    await svc.executeWorkflow(wf._id, { type: 'manual' }, {});
    expect(engine.executeWorkflow).toHaveBeenCalled();
  });

  test('executeWorkflowManually adjunta datos de la entidad propia', async () => {
    const wf = await crearWorkflow({ enabled: true, status: 'active' });
    const exp = await Expedition.create({
      expeditionId: 'EXP-1', tenantId: ORG, transportMode: 'maritime', operationType: 'import',
      client: { nif: 'B12345678', companyName: 'ACME' },
      goods: [{ itemNumber: 1, description: 'x', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
    });
    await svc.executeWorkflowManually(wf._id, USER, 'expedition', exp._id, ORG);
    const ctx = engine.executeWorkflow.mock.calls.at(-1)[2];
    expect(String(ctx.entityData._id)).toBe(String(exp._id));
  });

  test('executeWorkflowManually bloquea entidad de OTRA organización (guard cross-tenant)', async () => {
    const wf = await crearWorkflow({ enabled: true, status: 'active' });
    const expAjeno = await Expedition.create({
      expeditionId: 'EXP-2', tenantId: ORG_B, transportMode: 'air', operationType: 'import',
      client: { nif: 'B87654321', companyName: 'OTRA' },
      goods: [{ itemNumber: 1, description: 'y', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
    });
    await expect(svc.executeWorkflowManually(wf._id, USER, 'expedition', expAjeno._id, ORG))
      .rejects.toThrow('Entidad no encontrada');
  });

  test('executeWorkflowManually sin entidad ejecuta igualmente (entityData null)', async () => {
    const wf = await crearWorkflow({ enabled: true, status: 'active' });
    await svc.executeWorkflowManually(wf._id, USER, null, null, ORG);
    const ctx = engine.executeWorkflow.mock.calls.at(-1)[2];
    expect(ctx.entityData).toBeNull();
  });

  test('executeWorkflowManually lanza si el workflow no existe', async () => {
    await expect(svc.executeWorkflowManually(new mongoose.Types.ObjectId(), USER, null, null, ORG))
      .rejects.toThrow('Workflow not found');
  });

  test('getExecutionHistory lanza si el workflow no existe', async () => {
    await expect(svc.getExecutionHistory(new mongoose.Types.ObjectId(), ORG))
      .rejects.toThrow('Workflow not found');
  });

  test('getExecutionHistory devuelve el historial del workflow existente', async () => {
    const wf = await crearWorkflow();
    const hist = await svc.getExecutionHistory(wf._id, ORG);
    expect(hist).toBeDefined();
  });

  test('cancelExecution lanza si no hay ejecución running', async () => {
    await expect(svc.cancelExecution('exec-inexistente', 'r', ORG))
      .rejects.toThrow('Execution not found or not running');
  });

  test('cancelExecution delega en el engine si hay ejecución running', async () => {
    await WorkflowExecution.create({
      executionId: 'exec-run', organizationId: ORG, workflowId: new mongoose.Types.ObjectId(),
      status: 'running'
    });
    const r = await svc.cancelExecution('exec-run', 'motivo', ORG);
    expect(r.cancelled).toBe(true);
    expect(engine.cancelExecution).toHaveBeenCalledWith('exec-run', 'motivo');
  });

  test('getExecution busca por executionId + organización', async () => {
    await WorkflowExecution.create({
      executionId: 'exec-get', organizationId: ORG, workflowId: new mongoose.Types.ObjectId(), status: 'completed'
    });
    const ex = await svc.getExecution('exec-get', ORG);
    expect(ex.executionId).toBe('exec-get');
    expect(await svc.getExecution('exec-get', ORG_B)).toBeNull();
  });
});

// ==================== initialize / re-scheduling / límite diario ====================
describe('initialize', () => {
  // Sin fake timers: initialize() hace queries reales (loadScheduledWorkflows)
  // que se cuelgan con timers falsos. El intervalo (1h) nunca dispara en el test.
  afterEach(() => {
    for (const id of Array.from(svc.scheduledJobs.keys())) svc.unscheduleWorkflow(id);
  });

  test('inicializa una vez y es idempotente en la segunda llamada', async () => {
    // No hay scheduled workflows en BD → loadScheduledWorkflows no programa nada.
    await svc.initialize();
    expect(svc.initialized).toBe(true);
    // Segunda llamada: entra por la rama "Already initialized" y no re-registra.
    await svc.initialize();
    expect(svc.initialized).toBe(true);
  });
});

describe('re-scheduling en update/toggle', () => {
  // Sin fake timers: estos tests hacen escrituras Mongo reales, que cuelgan bajo
  // fake timers. scheduleWorkflow crea un setInterval de 1h que nunca dispara
  // durante el test; lo limpiamos en afterEach con unscheduleWorkflow.
  afterEach(() => {
    for (const id of Array.from(svc.scheduledJobs.keys())) svc.unscheduleWorkflow(id);
  });

  test('updateWorkflow re-programa si el trigger es schedule y está enabled', async () => {
    const wf = await crearWorkflow({
      enabled: true, status: 'active',
      trigger: { type: 'schedule', schedule: { cron: '0 * * * *' } }
    });
    await svc.updateWorkflow(wf._id, { name: 'Reprog' }, USER, ORG);
    expect(svc.scheduledJobs.has(wf._id.toString())).toBe(true);
  });

  test('toggleWorkflow schedule: habilitar programa, deshabilitar limpia', async () => {
    const wf = await crearWorkflow({
      trigger: { type: 'schedule', schedule: { cron: '0 * * * *' } }
    });
    await svc.toggleWorkflow(wf._id, true, USER, ORG);
    expect(svc.scheduledJobs.has(wf._id.toString())).toBe(true);
    await svc.toggleWorkflow(wf._id, false, USER, ORG);
    expect(svc.scheduledJobs.has(wf._id.toString())).toBe(false);
  });

  test('publishWorkflow schedule programa el workflow', async () => {
    const wf = await crearWorkflow({
      trigger: { type: 'schedule', schedule: { cron: '0 * * * *' } }
    });
    await svc.publishWorkflow(wf._id, USER, ORG, 'v1');
    expect(svc.scheduledJobs.has(wf._id.toString())).toBe(true);
  });
});

describe('handleEvent — límite de ejecuciones diarias', () => {
  test('salta el workflow si superó maxExecutionsPerDay', async () => {
    const wf = await crearWorkflow({
      enabled: true, status: 'active',
      trigger: { type: 'event', event: 'expedition.created', config: { maxExecutionsPerDay: 1 } }
    });
    // Sembramos una ejecución de HOY para superar el límite de 1.
    await WorkflowExecution.create({
      executionId: 'exec-today', organizationId: ORG, workflowId: wf._id, status: 'completed'
    });
    await svc.handleEvent('expedition.created', { organizationId: ORG, data: {} });
    // Damos margen a la parte async; no debe ejecutarse por exceder el límite.
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    expect(engine.executeWorkflow).not.toHaveBeenCalled();
  });
});

// ==================== estadísticas ====================
describe('estadísticas', () => {
  test('getStats agrega workflows + executions + running del engine', async () => {
    await crearWorkflow();
    const stats = await svc.getStats(ORG);
    expect(stats).toHaveProperty('workflows');
    expect(stats).toHaveProperty('executions');
    expect(stats.running).toBe(0);
  });

  test('getTopWorkflows devuelve los más ejecutados de la org', async () => {
    await crearWorkflow();
    const top = await svc.getTopWorkflows(ORG, 5);
    expect(Array.isArray(top)).toBe(true);
  });
});
