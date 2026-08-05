/**
 * workflowController — API de gestión de workflows (Fase 6.6).
 *
 * Wrapper puro sobre services/workflow (única dependencia junto al logger). Se
 * mockea el service (frontera) y se ejercita lo PROPIO del controller: el mapeo
 * 404-vs-500 por mensaje ('Workflow not found') en update/delete, el 404-si-null
 * de getWorkflow/getExecution, la validación 400 de toggle (enabled undefined),
 * el parseo de la rama enabled 'true'/'false'/undefined en list, el shape de la
 * respuesta (data.workflows + pagination), y el catch → 500. Los catálogos
 * estáticos (templates/events/actions) se construyen en el controller: se
 * verifica su forma sin tocar el service.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

jest.mock('../../src/services/workflow');

const svc = require('../../src/services/workflow');
const ctrl = require('../../src/controllers/workflowController');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = ({ body = {}, query = {}, params = {}, user = { _id: 'u1', organizationId: 'ORG1' } } = {}) =>
  ({ body, query, params, user });

const SVC_FNS = [
  'createWorkflow', 'listWorkflows', 'getWorkflow', 'updateWorkflow',
  'deleteWorkflow', 'toggleWorkflow', 'publishWorkflow', 'cloneWorkflow',
  'executeWorkflowManually', 'getExecutionHistory', 'getExecution',
  'cancelExecution', 'getStats', 'getTopWorkflows'
];

beforeEach(() => {
  SVC_FNS.forEach((k) => { if (svc[k]) svc[k].mockResolvedValue({ ok: true }); });
});

// ==================== createWorkflow ====================
describe('createWorkflow', () => {
  test('201 e inyecta organizationId del token', async () => {
    svc.createWorkflow.mockResolvedValue({ _id: 'w1' });
    const res = mockRes();
    await ctrl.createWorkflow(req({ body: { name: 'W' } }), res);
    expect(res.statusCode).toBe(201);
    const [data, userId] = svc.createWorkflow.mock.calls[0];
    expect(data.name).toBe('W');
    expect(data.organizationId).toBe('ORG1');
    expect(userId).toBe('u1');
  });

  test('500 si lanza', async () => {
    svc.createWorkflow.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.createWorkflow(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== listWorkflows (rama enabled) ====================
describe('listWorkflows', () => {
  test('enabled="true" → true', async () => {
    svc.listWorkflows.mockResolvedValue({ workflows: [], pagination: { total: 0 } });
    const res = mockRes();
    await ctrl.listWorkflows(req({ query: { enabled: 'true', page: '2', limit: '5' } }), res);
    const [orgId, opts] = svc.listWorkflows.mock.calls[0];
    expect(orgId).toBe('ORG1');
    expect(opts.enabled).toBe(true);
    expect(opts.page).toBe(2);
    expect(opts.limit).toBe(5);
    expect(res.body.pagination.total).toBe(0);
  });

  test('enabled="false" → false', async () => {
    svc.listWorkflows.mockResolvedValue({ workflows: [], pagination: {} });
    const res = mockRes();
    await ctrl.listWorkflows(req({ query: { enabled: 'false' } }), res);
    expect(svc.listWorkflows.mock.calls[0][1].enabled).toBe(false);
  });

  test('enabled ausente → undefined', async () => {
    svc.listWorkflows.mockResolvedValue({ workflows: [{ _id: 'w1' }], pagination: {} });
    const res = mockRes();
    await ctrl.listWorkflows(req({ query: {} }), res);
    expect(svc.listWorkflows.mock.calls[0][1].enabled).toBeUndefined();
    expect(res.body.data).toHaveLength(1);
  });

  test('500 si lanza', async () => {
    svc.listWorkflows.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.listWorkflows(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== getWorkflow ====================
describe('getWorkflow', () => {
  test('éxito', async () => {
    svc.getWorkflow.mockResolvedValue({ _id: 'w1' });
    const res = mockRes();
    await ctrl.getWorkflow(req({ params: { id: 'w1' } }), res);
    expect(res.body.data._id).toBe('w1');
    expect(svc.getWorkflow).toHaveBeenCalledWith('w1', 'ORG1');
  });

  test('404 si null', async () => {
    svc.getWorkflow.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.getWorkflow(req({ params: { id: 'w1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('500 si lanza', async () => {
    svc.getWorkflow.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getWorkflow(req({ params: { id: 'w1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== updateWorkflow (mapeo 404-vs-500 por mensaje) ====================
describe('updateWorkflow', () => {
  test('éxito', async () => {
    svc.updateWorkflow.mockResolvedValue({ _id: 'w1', name: 'N' });
    const res = mockRes();
    await ctrl.updateWorkflow(req({ params: { id: 'w1' }, body: { name: 'N' } }), res);
    expect(res.body.data.name).toBe('N');
  });

  test('404 si el service lanza "Workflow not found"', async () => {
    svc.updateWorkflow.mockRejectedValue(new Error('Workflow not found'));
    const res = mockRes();
    await ctrl.updateWorkflow(req({ params: { id: 'w1' }, body: {} }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });

  test('500 con cualquier otro error', async () => {
    svc.updateWorkflow.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await ctrl.updateWorkflow(req({ params: { id: 'w1' }, body: {} }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== deleteWorkflow (mapeo 404-vs-500 por mensaje) ====================
describe('deleteWorkflow', () => {
  test('éxito', async () => {
    svc.deleteWorkflow.mockResolvedValue();
    const res = mockRes();
    await ctrl.deleteWorkflow(req({ params: { id: 'w1' } }), res);
    expect(res.body.success).toBe(true);
  });

  test('404 si "Workflow not found"', async () => {
    svc.deleteWorkflow.mockRejectedValue(new Error('Workflow not found'));
    const res = mockRes();
    await ctrl.deleteWorkflow(req({ params: { id: 'w1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('500 con otro error', async () => {
    svc.deleteWorkflow.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.deleteWorkflow(req({ params: { id: 'w1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== toggleWorkflow (validación 400) ====================
describe('toggleWorkflow', () => {
  test('400 si enabled es undefined', async () => {
    const res = mockRes();
    await ctrl.toggleWorkflow(req({ params: { id: 'w1' }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('activado (enabled=true) mensaje correcto', async () => {
    svc.toggleWorkflow.mockResolvedValue({ _id: 'w1' });
    const res = mockRes();
    await ctrl.toggleWorkflow(req({ params: { id: 'w1' }, body: { enabled: true } }), res);
    expect(res.body.message).toMatch(/activado/);
  });

  test('desactivado (enabled=false) mensaje correcto', async () => {
    svc.toggleWorkflow.mockResolvedValue({ _id: 'w1' });
    const res = mockRes();
    await ctrl.toggleWorkflow(req({ params: { id: 'w1' }, body: { enabled: false } }), res);
    expect(res.body.message).toMatch(/desactivado/);
  });

  test('500 si lanza', async () => {
    svc.toggleWorkflow.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.toggleWorkflow(req({ params: { id: 'w1' }, body: { enabled: true } }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== publishWorkflow / cloneWorkflow ====================
describe('publishWorkflow', () => {
  test('éxito con versión en el mensaje', async () => {
    svc.publishWorkflow.mockResolvedValue({ version: 3 });
    const res = mockRes();
    await ctrl.publishWorkflow(req({ params: { id: 'w1' }, body: { changeDescription: 'd' } }), res);
    expect(res.body.message).toMatch(/v3/);
  });

  test('500 si lanza', async () => {
    svc.publishWorkflow.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.publishWorkflow(req({ params: { id: 'w1' }, body: {} }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('cloneWorkflow', () => {
  test('201', async () => {
    svc.cloneWorkflow.mockResolvedValue({ _id: 'w2' });
    const res = mockRes();
    await ctrl.cloneWorkflow(req({ params: { id: 'w1' }, body: { name: 'copia' } }), res);
    expect(res.statusCode).toBe(201);
    expect(svc.cloneWorkflow).toHaveBeenCalledWith('w1', 'copia', 'u1', 'ORG1');
  });

  test('500 si lanza', async () => {
    svc.cloneWorkflow.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.cloneWorkflow(req({ params: { id: 'w1' }, body: {} }), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== executeWorkflow / cancelExecution (error.message || fallback) ====================
describe('executeWorkflow', () => {
  test('éxito pasa entityType/entityId', async () => {
    svc.executeWorkflowManually.mockResolvedValue({ executionId: 'e1' });
    const res = mockRes();
    await ctrl.executeWorkflow(req({ params: { id: 'w1' }, body: { entityType: 'expedition', entityId: 'x1' } }), res);
    expect(svc.executeWorkflowManually).toHaveBeenCalledWith('w1', 'u1', 'expedition', 'x1', 'ORG1');
  });

  test('500 usa error.message si existe', async () => {
    svc.executeWorkflowManually.mockRejectedValue(new Error('entidad inválida'));
    const res = mockRes();
    await ctrl.executeWorkflow(req({ params: { id: 'w1' }, body: {} }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('entidad inválida');
  });
});

describe('getExecutionHistory', () => {
  test('parsea limit/skip', async () => {
    svc.getExecutionHistory.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getExecutionHistory(req({ params: { id: 'w1' }, query: { status: 'completed', limit: '5', skip: '10' } }), res);
    const [id, orgId, opts] = svc.getExecutionHistory.mock.calls[0];
    expect(id).toBe('w1');
    expect(orgId).toBe('ORG1');
    expect(opts.limit).toBe(5);
    expect(opts.skip).toBe(10);
  });

  test('500 si lanza', async () => {
    svc.getExecutionHistory.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getExecutionHistory(req({ params: { id: 'w1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getExecution', () => {
  test('404 si null', async () => {
    svc.getExecution.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.getExecution(req({ params: { executionId: 'e1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('éxito', async () => {
    svc.getExecution.mockResolvedValue({ _id: 'e1' });
    const res = mockRes();
    await ctrl.getExecution(req({ params: { executionId: 'e1' } }), res);
    expect(res.body.data._id).toBe('e1');
  });

  test('500 si lanza', async () => {
    svc.getExecution.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getExecution(req({ params: { executionId: 'e1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('cancelExecution', () => {
  test('éxito', async () => {
    svc.cancelExecution.mockResolvedValue();
    const res = mockRes();
    await ctrl.cancelExecution(req({ params: { executionId: 'e1' }, body: { reason: 'r' } }), res);
    expect(res.body.success).toBe(true);
    expect(svc.cancelExecution).toHaveBeenCalledWith('e1', 'r', 'ORG1');
  });

  test('500 usa error.message', async () => {
    svc.cancelExecution.mockRejectedValue(new Error('no cancelable'));
    const res = mockRes();
    await ctrl.cancelExecution(req({ params: { executionId: 'e1' }, body: {} }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('no cancelable');
  });
});

// ==================== stats ====================
describe('getStats / getTopWorkflows', () => {
  test('getStats éxito', async () => {
    svc.getStats.mockResolvedValue({ total: 4 });
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.body.data.total).toBe(4);
    expect(svc.getStats).toHaveBeenCalledWith('ORG1');
  });

  test('getStats 500 si lanza', async () => {
    svc.getStats.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getStats(req(), res);
    expect(res.statusCode).toBe(500);
  });

  test('getTopWorkflows parsea limit', async () => {
    svc.getTopWorkflows.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.getTopWorkflows(req({ query: { limit: '3' } }), res);
    expect(svc.getTopWorkflows).toHaveBeenCalledWith('ORG1', 3);
  });

  test('getTopWorkflows 500 si lanza', async () => {
    svc.getTopWorkflows.mockRejectedValue(new Error('x'));
    const res = mockRes();
    await ctrl.getTopWorkflows(req(), res);
    expect(res.statusCode).toBe(500);
  });
});

// ==================== catálogos estáticos (construidos en el controller) ====================
describe('catálogos estáticos', () => {
  test('getTemplates devuelve las 5 plantillas predefinidas', async () => {
    const res = mockRes();
    await ctrl.getTemplates(req(), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.map(t => t.id)).toContain('notify_channel_red');
  });

  test('getAvailableEvents agrupa por categoría', async () => {
    const res = mockRes();
    await ctrl.getAvailableEvents(req(), res);
    expect(res.body.data.some(g => g.category === 'Canales')).toBe(true);
  });

  test('getAvailableActions agrupa por categoría', async () => {
    const res = mockRes();
    await ctrl.getAvailableActions(req(), res);
    expect(res.body.data.some(g => g.category === 'Notificaciones')).toBe(true);
  });
});
