/**
 * workflowEngine — motor de ejecucion de workflows (Fase 6.6). Es logica de
 * negocio central de automatizacion: evalua condiciones, interpola plantillas
 * con datos de la entidad, ejecuta acciones en orden con reintentos y registra
 * cada ejecucion. Un fallo aqui puede disparar acciones que no debian o saltarse
 * las que si.
 *
 * FRONTERAS mockeadas: SOLO el logger. Los modelos Workflow/WorkflowExecution son
 * REALES contra Mongo en memoria (persisten de verdad los WorkflowExecution). Los
 * handlers de accion se registran como jest.fn() de prueba: son la "frontera"
 * legitima del motor (el motor no los implementa, los invoca). No se mockea nada
 * del propio workflowEngine.
 */

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const workflowEngine = require('../../../src/services/workflow/workflowEngine');
const { Workflow, WorkflowExecution } = require('../../../src/models');

usarBaseDeDatosEnMemoria();

// El motor es un singleton: sus handlers y runningExecutions sobreviven entre
// tests. Se limpian para aislar cada caso.
beforeEach(() => {
  workflowEngine.actionHandlers.clear();
  workflowEngine.runningExecutions.clear();
});

// Helper: crea (y persiste) un Workflow minimo valido.
async function crearWorkflow(overrides = {}) {
  return Workflow.create({
    name: 'WF de prueba',
    organizationId: new mongoose.Types.ObjectId(),
    trigger: { type: 'manual' },
    actions: [],
    ...overrides
  });
}

// ==================== evaluateCondition (todos los operadores) ====================

describe('evaluateCondition', () => {
  const ctx = {
    entity: {
      status: 'PENDING',
      amount: 100,
      tags: ['a', 'b'],
      flag: true,
      empty: '',
      nil: null
    }
  };

  const evalOp = (field, operator, value, extra = {}) =>
    workflowEngine.evaluateCondition({ field, operator, value, ...extra }, ctx);

  test('equals / not_equals (case-insensitive por defecto)', () => {
    expect(evalOp('entity.status', 'equals', 'pending')).toBe(true);
    expect(evalOp('entity.status', 'not_equals', 'pending')).toBe(false);
    expect(evalOp('entity.status', 'not_equals', 'otro')).toBe(true);
  });

  test('equals respeta caseSensitive cuando se pide', () => {
    expect(evalOp('entity.status', 'equals', 'pending', { caseSensitive: true })).toBe(false);
    expect(evalOp('entity.status', 'equals', 'PENDING', { caseSensitive: true })).toBe(true);
  });

  test('contains / not_contains', () => {
    expect(evalOp('entity.status', 'contains', 'end')).toBe(true);
    expect(evalOp('entity.status', 'not_contains', 'zzz')).toBe(true);
    expect(evalOp('entity.status', 'not_contains', 'end')).toBe(false);
  });

  test('starts_with / ends_with', () => {
    expect(evalOp('entity.status', 'starts_with', 'pend')).toBe(true);
    expect(evalOp('entity.status', 'ends_with', 'ing')).toBe(true);
    expect(evalOp('entity.status', 'starts_with', 'xxx')).toBe(false);
  });

  test('comparadores numericos', () => {
    expect(evalOp('entity.amount', 'greater_than', 50)).toBe(true);
    expect(evalOp('entity.amount', 'less_than', 50)).toBe(false);
    expect(evalOp('entity.amount', 'greater_or_equal', 100)).toBe(true);
    expect(evalOp('entity.amount', 'less_or_equal', 100)).toBe(true);
    expect(evalOp('entity.amount', 'less_or_equal', 99)).toBe(false);
  });

  test('in / not_in exigen array como valor', () => {
    expect(evalOp('entity.amount', 'in', [100, 200])).toBe(true);
    expect(evalOp('entity.amount', 'not_in', [1, 2])).toBe(true);
    // Si value no es array, ambos devuelven false.
    expect(evalOp('entity.amount', 'in', 100)).toBe(false);
    expect(evalOp('entity.amount', 'not_in', 100)).toBe(false);
  });

  test('is_empty / is_not_empty (string vacio, null, array vacio)', () => {
    expect(evalOp('entity.empty', 'is_empty')).toBe(true);
    expect(evalOp('entity.nil', 'is_empty')).toBe(true);
    expect(evalOp('entity.noexiste', 'is_empty')).toBe(true); // undefined
    expect(evalOp('entity.status', 'is_not_empty')).toBe(true);
    expect(evalOp('entity.tags', 'is_not_empty')).toBe(true);
    // array vacio cuenta como empty
    expect(workflowEngine.evaluateCondition(
      { field: 'x', operator: 'is_empty' }, { x: [] }
    )).toBe(true);
  });

  test('is_true / is_false (booleanos, strings y 0/1)', () => {
    expect(evalOp('entity.flag', 'is_true')).toBe(true);
    expect(workflowEngine.evaluateCondition({ field: 'x', operator: 'is_true' }, { x: 'true' })).toBe(true);
    expect(workflowEngine.evaluateCondition({ field: 'x', operator: 'is_true' }, { x: 1 })).toBe(true);
    expect(workflowEngine.evaluateCondition({ field: 'x', operator: 'is_false' }, { x: false })).toBe(true);
    expect(workflowEngine.evaluateCondition({ field: 'x', operator: 'is_false' }, { x: 0 })).toBe(true);
    expect(workflowEngine.evaluateCondition({ field: 'x', operator: 'is_false' }, { x: 'false' })).toBe(true);
  });

  test('regex valido e invalido', () => {
    expect(evalOp('entity.status', 'regex', '^pend')).toBe(true);        // i por defecto
    expect(evalOp('entity.status', 'regex', 'xyz')).toBe(false);
    // Un patron invalido no revienta: devuelve false.
    expect(evalOp('entity.status', 'regex', '(')).toBe(false);
  });

  test('operador desconocido devuelve false', () => {
    expect(evalOp('entity.status', 'operador_inventado', 'x')).toBe(false);
  });
});

// ==================== evaluateConditions (grupo AND/OR/vacio) ====================

describe('evaluateConditions', () => {
  const ctx = { entity: { status: 'A', amount: 10 } };

  test('sin grupo o sin condiciones => true', () => {
    expect(workflowEngine.evaluateConditions(null, ctx)).toBe(true);
    expect(workflowEngine.evaluateConditions({}, ctx)).toBe(true);
    expect(workflowEngine.evaluateConditions({ conditions: [] }, ctx)).toBe(true);
  });

  test('AND por defecto: todas deben cumplirse', () => {
    const grupo = {
      conditions: [
        { field: 'entity.status', operator: 'equals', value: 'a' },
        { field: 'entity.amount', operator: 'greater_than', value: 5 }
      ]
    };
    expect(workflowEngine.evaluateConditions(grupo, ctx)).toBe(true);

    grupo.conditions[1].value = 50; // 10 > 50 falso
    expect(workflowEngine.evaluateConditions(grupo, ctx)).toBe(false);
  });

  test('OR: basta con una', () => {
    const grupo = {
      logic: 'OR',
      conditions: [
        { field: 'entity.status', operator: 'equals', value: 'nope' },
        { field: 'entity.amount', operator: 'greater_than', value: 5 }
      ]
    };
    expect(workflowEngine.evaluateConditions(grupo, ctx)).toBe(true);

    grupo.conditions[1].value = 500;
    expect(workflowEngine.evaluateConditions(grupo, ctx)).toBe(false);
  });
});

// ==================== getFieldValue (notacion de punto) ====================

describe('getFieldValue', () => {
  test('resuelve rutas anidadas', () => {
    const ctx = { entity: { client: { email: 'x@y.z' } } };
    expect(workflowEngine.getFieldValue('entity.client.email', ctx)).toBe('x@y.z');
  });

  test('ruta rota devuelve undefined sin lanzar', () => {
    const ctx = { entity: null };
    expect(workflowEngine.getFieldValue('entity.client.email', ctx)).toBeUndefined();
    expect(workflowEngine.getFieldValue('noexiste.a.b', {})).toBeUndefined();
  });

  test('campo de primer nivel', () => {
    expect(workflowEngine.getFieldValue('x', { x: 42 })).toBe(42);
  });
});

// ==================== interpolateString / interpolateObject ====================

describe('interpolateString', () => {
  const ctx = { entity: { name: 'ACME', client: { email: 'a@b.c' } } };

  test('sustituye variables {{...}} por su valor', () => {
    expect(workflowEngine.interpolateString('Hola {{entity.name}}', ctx)).toBe('Hola ACME');
    expect(workflowEngine.interpolateString('{{ entity.client.email }}', ctx)).toBe('a@b.c');
  });

  test('deja la plantilla intacta si la variable no existe', () => {
    expect(workflowEngine.interpolateString('{{entity.noexiste}}', ctx)).toBe('{{entity.noexiste}}');
  });

  test('no toca valores que no son string', () => {
    expect(workflowEngine.interpolateString(123, ctx)).toBe(123);
    expect(workflowEngine.interpolateString(null, ctx)).toBeNull();
  });
});

describe('interpolateObject', () => {
  const ctx = { entity: { name: 'ACME', id: 7 } };

  test('interpola recursivamente objetos y arrays', () => {
    const obj = {
      subject: 'Aviso para {{entity.name}}',
      nested: { path: '{{entity.name}}/{{entity.id}}' },
      list: ['{{entity.name}}', 'fijo'],
      numero: 5,
      bandera: true
    };
    const res = workflowEngine.interpolateObject(obj, ctx);
    expect(res.subject).toBe('Aviso para ACME');
    expect(res.nested.path).toBe('ACME/7');
    expect(res.list).toEqual(['ACME', 'fijo']);
    expect(res.numero).toBe(5);
    expect(res.bandera).toBe(true);
  });

  test('string suelto tambien se interpola', () => {
    expect(workflowEngine.interpolateObject('{{entity.name}}', ctx)).toBe('ACME');
  });
});

// ==================== registerActionHandler ====================

describe('registerActionHandler', () => {
  test('registra un handler recuperable por tipo', () => {
    const handler = jest.fn();
    workflowEngine.registerActionHandler('send_email', handler);
    expect(workflowEngine.actionHandlers.get('send_email')).toBe(handler);
  });
});

// ==================== executeAction ====================

describe('executeAction', () => {
  test('sin handler registrado devuelve success:false sin tocar la ejecucion', async () => {
    const wf = await crearWorkflow();
    const execution = new WorkflowExecution({
      workflowId: wf._id, organizationId: wf.organizationId, timing: { queuedAt: new Date() }
    });
    await execution.save();

    const action = { _id: new mongoose.Types.ObjectId(), type: 'send_email', order: 1 };
    const res = await workflowEngine.executeAction(action, {}, execution);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/No handler registered/);
    expect(execution.actionResults).toHaveLength(0);
  });

  test('handler exitoso: completa la accion e interpola la config', async () => {
    const wf = await crearWorkflow();
    const execution = new WorkflowExecution({
      workflowId: wf._id, organizationId: wf.organizationId, timing: { queuedAt: new Date() }
    });
    await execution.save();

    const handler = jest.fn().mockResolvedValue({ ok: true });
    workflowEngine.registerActionHandler('send_email', handler);

    const action = {
      _id: new mongoose.Types.ObjectId(),
      type: 'send_email',
      order: 1,
      config: { emailSubject: 'Hola {{entity.name}}' }
    };
    const context = { entity: { name: 'ACME' } };
    const res = await workflowEngine.executeAction(action, context, execution);

    expect(res.success).toBe(true);
    expect(res.result).toEqual({ ok: true });
    // La config llega interpolada al handler.
    expect(handler.mock.calls[0][0]).toEqual({ emailSubject: 'Hola ACME' });
    // Se registro la accion como completada.
    const ar = execution.actionResults.find(a => a.actionId.equals(action._id));
    expect(ar.status).toBe('completed');
    expect(execution.timing.actionsSucceeded).toBe(1);
  });

  test('sin retryOnFailure solo intenta una vez y falla', async () => {
    const wf = await crearWorkflow();
    const execution = new WorkflowExecution({
      workflowId: wf._id, organizationId: wf.organizationId, timing: { queuedAt: new Date() }
    });
    await execution.save();

    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    workflowEngine.registerActionHandler('send_email', handler);

    const action = { _id: new mongoose.Types.ObjectId(), type: 'send_email', order: 1 };
    const res = await workflowEngine.executeAction(action, {}, execution);

    expect(res.success).toBe(false);
    expect(res.error).toBe('boom');
    expect(handler).toHaveBeenCalledTimes(1);
    const ar = execution.actionResults.find(a => a.actionId.equals(action._id));
    expect(ar.status).toBe('failed');
    expect(execution.timing.actionsFailed).toBe(1);
  });

  test('con retryOnFailure reintenta hasta maxRetries y acaba en el intento que triunfe', async () => {
    const wf = await crearWorkflow();
    const execution = new WorkflowExecution({
      workflowId: wf._id, organizationId: wf.organizationId, timing: { queuedAt: new Date() }
    });
    await execution.save();

    const handler = jest.fn()
      .mockRejectedValueOnce(new Error('fallo 1'))
      .mockResolvedValueOnce({ ok: true });
    workflowEngine.registerActionHandler('send_email', handler);

    const action = {
      _id: new mongoose.Types.ObjectId(),
      type: 'send_email',
      order: 1,
      config: { retryOnFailure: true, maxRetries: 3, retryDelayMs: 1 }
    };
    const res = await workflowEngine.executeAction(action, {}, execution);

    expect(res.success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  test('con retryOnFailure agota los reintentos y activa el errorHandler notify', async () => {
    const wf = await crearWorkflow();
    const execution = new WorkflowExecution({
      workflowId: wf._id, organizationId: wf.organizationId, timing: { queuedAt: new Date() }
    });
    await execution.save();

    const handler = jest.fn().mockRejectedValue(new Error('siempre falla'));
    workflowEngine.registerActionHandler('send_email', handler);

    const action = {
      _id: new mongoose.Types.ObjectId(),
      type: 'send_email',
      order: 1,
      config: { retryOnFailure: true, maxRetries: 2, retryDelayMs: 1 },
      errorHandler: { action: 'notify', notifyUsers: ['u1'] }
    };
    const res = await workflowEngine.executeAction(action, {}, execution);

    expect(res.success).toBe(false);
    expect(handler).toHaveBeenCalledTimes(2);
    const logger = require('../../../src/config/logger');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/would notify users/));
  });
});

// ==================== executeWorkflow ====================

describe('executeWorkflow', () => {
  test('condiciones no cumplidas: omite y completa como skipped', async () => {
    const wf = await crearWorkflow({
      conditions: { logic: 'AND', conditions: [
        { field: 'entity.status', operator: 'equals', value: 'NUNCA' }
      ] },
      actions: [{ order: 1, type: 'send_email' }]
    });

    const handler = jest.fn();
    workflowEngine.registerActionHandler('send_email', handler);

    const res = await workflowEngine.executeWorkflow(
      wf, { type: 'manual' }, { entityData: { status: 'OTRO' } }
    );

    expect(res.success).toBe(true);
    expect(res.skipped).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    // La ejecucion quedo completada y persistida.
    const exec = await WorkflowExecution.findOne({ executionId: res.executionId });
    expect(exec.status).toBe('completed');
    expect(exec.output.skipped).toBe(true);
  });

  test('ejecuta las acciones en orden y completa; recordExecution suma exito', async () => {
    const orden = [];
    workflowEngine.registerActionHandler('send_email', async () => { orden.push('email'); return { s: 1 }; });
    workflowEngine.registerActionHandler('add_tag', async () => { orden.push('tag'); return { s: 2 }; });

    const wf = await crearWorkflow({
      actions: [
        { order: 2, type: 'send_email' },
        { order: 1, type: 'add_tag' }
      ]
    });

    const res = await workflowEngine.executeWorkflow(wf, { type: 'manual' }, { entityData: {} });

    expect(res.success).toBe(true);
    expect(orden).toEqual(['tag', 'email']); // ordenadas por order asc
    const exec = await WorkflowExecution.findOne({ executionId: res.executionId });
    expect(exec.status).toBe('completed');
    // recordExecution actualizo stats del workflow.
    const wfRecargado = await Workflow.findById(wf._id);
    expect(wfRecargado.stats.totalExecutions).toBe(1);
    expect(wfRecargado.stats.successfulExecutions).toBe(1);
    // Ya no queda en runningExecutions.
    expect(workflowEngine.runningExecutions.has(res.executionId)).toBe(false);
  });

  test('accion que falla sin continueOnError aborta el workflow (fail)', async () => {
    workflowEngine.registerActionHandler('send_email', async () => { throw new Error('kaputt'); });

    const wf = await crearWorkflow({
      actions: [{ order: 1, type: 'send_email', name: 'correo' }]
    });

    const res = await workflowEngine.executeWorkflow(wf, { type: 'manual' }, { entityData: {} });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/failed/);
    const exec = await WorkflowExecution.findOne({ executionId: res.executionId });
    expect(exec.status).toBe('failed');
    const wfRecargado = await Workflow.findById(wf._id);
    expect(wfRecargado.stats.failedExecutions).toBe(1);
  });

  test('accion que falla CON continueOnError no aborta: el workflow completa', async () => {
    const orden = [];
    workflowEngine.registerActionHandler('send_email', async () => { throw new Error('ignorame'); });
    workflowEngine.registerActionHandler('add_tag', async () => { orden.push('tag'); return {}; });

    const wf = await crearWorkflow({
      actions: [
        { order: 1, type: 'send_email', continueOnError: true },
        { order: 2, type: 'add_tag' }
      ]
    });

    const res = await workflowEngine.executeWorkflow(wf, { type: 'manual' }, { entityData: {} });

    expect(res.success).toBe(true);
    expect(orden).toEqual(['tag']); // la segunda accion si se ejecuto
    const exec = await WorkflowExecution.findOne({ executionId: res.executionId });
    expect(exec.status).toBe('completed');
  });
});

// ==================== cancelExecution / getRunningExecutions ====================

describe('cancelExecution / getRunningExecutions', () => {
  test('cancela una ejecucion en curso y la saca del registro', async () => {
    const wf = await crearWorkflow();
    const execution = new WorkflowExecution({
      workflowId: wf._id, organizationId: wf.organizationId,
      status: 'running', timing: { queuedAt: new Date(), startedAt: new Date() }
    });
    await execution.save();
    workflowEngine.runningExecutions.set(execution.executionId, execution);

    expect(workflowEngine.getRunningExecutions()).toHaveLength(1);

    const ok = await workflowEngine.cancelExecution(execution.executionId, 'test');
    expect(ok).toBe(true);
    expect(workflowEngine.runningExecutions.has(execution.executionId)).toBe(false);
    const exec = await WorkflowExecution.findOne({ executionId: execution.executionId });
    expect(exec.status).toBe('cancelled');
  });

  test('cancelExecution con id inexistente devuelve false', async () => {
    const ok = await workflowEngine.cancelExecution('exec_noexiste', 'x');
    expect(ok).toBe(false);
  });

  test('getRunningExecutions devuelve el array de ejecuciones vivas', () => {
    expect(workflowEngine.getRunningExecutions()).toEqual([]);
  });
});
