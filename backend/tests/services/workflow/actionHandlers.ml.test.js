/**
 * Tests de los handlers de workflow que delegan en servicios externos
 * (ML, Workflow model, workflowEngine) mediante require() dinámico.
 *
 * Estos 3 handlers (run_ml_prediction, generate_recommendation,
 * trigger_workflow) NO tocan la base de datos directamente en su lógica propia,
 * así que aquí se mockean las fronteras (../ml, ../../models, ./workflowEngine)
 * y NO se usa Mongo real, evitando el cuelgue de jest.doMock + conexión Mongoose
 * persistente que obligó a saltar estos casos en la suite principal.
 */

// Mocks estáticos de las fronteras que los handlers cargan por require() dinámico
jest.mock('../../../src/services/ml', () => ({
  predictChannel: jest.fn(),
  analyzeForFraud: jest.fn(),
  generateRecommendations: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  Workflow: { findById: jest.fn() },
  // Los demás modelos no se usan en estos handlers, pero actionHandlers.js
  // desestructura Expedition/Deadline/Requirement al cargarse.
  Expedition: {},
  Deadline: {},
  Requirement: {}
}));

jest.mock('../../../src/services/workflow/workflowEngine', () => ({
  executeWorkflow: jest.fn()
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const mlServices = require('../../../src/services/ml');
const { Workflow } = require('../../../src/models');
const workflowEngine = require('../../../src/services/workflow/workflowEngine');
const { actionHandlers } = require('../../../src/services/workflow/actionHandlers');

// jest.config.js tiene resetMocks:true → reinstalar implementaciones por defecto
beforeEach(() => {
  mlServices.predictChannel.mockResolvedValue({ channel: 'green', confidence: 0.9 });
  mlServices.analyzeForFraud.mockResolvedValue({ risk: 'low', score: 0.1 });
  mlServices.generateRecommendations.mockResolvedValue({ recommendations: ['usar régimen 42'] });
  Workflow.findById.mockResolvedValue(null);
  workflowEngine.executeWorkflow.mockResolvedValue({ executionId: 'child-1', success: true });
});

describe('run_ml_prediction', () => {
  const context = { entity: { id: 'exp-1', taricCode: '8471300000' } };

  it('predice canal por defecto cuando no se indica predictionType', async () => {
    const result = await actionHandlers.run_ml_prediction({}, context, {});

    expect(mlServices.predictChannel).toHaveBeenCalledWith(context.entity);
    expect(result).toEqual({ channel: 'green', confidence: 0.9 });
  });

  it('predice canal cuando predictionType es "channel"', async () => {
    const result = await actionHandlers.run_ml_prediction(
      { predictionType: 'channel' }, context, {}
    );

    expect(mlServices.predictChannel).toHaveBeenCalledWith(context.entity);
    expect(result.channel).toBe('green');
  });

  it('analiza fraude cuando predictionType es "fraud"', async () => {
    const result = await actionHandlers.run_ml_prediction(
      { predictionType: 'fraud' }, context, {}
    );

    expect(mlServices.analyzeForFraud).toHaveBeenCalledWith(context.entity);
    expect(result.risk).toBe('low');
  });

  it('lanza error si predictionType es desconocido', async () => {
    await expect(
      actionHandlers.run_ml_prediction({ predictionType: 'inexistente' }, context, {})
    ).rejects.toThrow('Unknown prediction type: inexistente');
  });
});

describe('generate_recommendation', () => {
  it('delega en mlServices.generateRecommendations con la entidad del contexto', async () => {
    const context = { entity: { id: 'exp-2' } };

    const result = await actionHandlers.generate_recommendation({}, context, {});

    expect(mlServices.generateRecommendations).toHaveBeenCalledWith(context.entity);
    expect(result.recommendations).toContain('usar régimen 42');
  });
});

describe('trigger_workflow', () => {
  const context = {
    workflow: { id: 'wf-padre' },
    entityType: 'expedition',
    entityId: 'exp-3',
    entity: { id: 'exp-3' }
  };
  const execution = { executionId: 'exec-padre' };

  it('lanza error si el workflow objetivo no existe', async () => {
    Workflow.findById.mockResolvedValue(null);

    await expect(
      actionHandlers.trigger_workflow({ targetWorkflowId: 'wf-x' }, context, execution)
    ).rejects.toThrow('Target workflow not found: wf-x');
  });

  it('retorna triggered:false si el workflow objetivo está deshabilitado', async () => {
    Workflow.findById.mockResolvedValue({ _id: 'wf-hijo', enabled: false });

    const result = await actionHandlers.trigger_workflow(
      { targetWorkflowId: 'wf-hijo' }, context, execution
    );

    expect(result).toEqual({ triggered: false, reason: 'target_workflow_disabled' });
    expect(workflowEngine.executeWorkflow).not.toHaveBeenCalled();
  });

  it('ejecuta el workflow hijo cuando está habilitado y propaga el contexto', async () => {
    Workflow.findById.mockResolvedValue({ _id: 'wf-hijo', enabled: true });

    const result = await actionHandlers.trigger_workflow(
      { targetWorkflowId: 'wf-hijo' }, context, execution
    );

    expect(workflowEngine.executeWorkflow).toHaveBeenCalledTimes(1);
    const [targetWf, trigger, ctx] = workflowEngine.executeWorkflow.mock.calls[0];
    expect(targetWf.enabled).toBe(true);
    expect(trigger.type).toBe('workflow');
    expect(trigger.triggeredBy.workflowId).toBe('wf-padre');
    expect(trigger.triggeredBy.executionId).toBe('exec-padre');
    expect(ctx.entityType).toBe('expedition');
    expect(ctx.entityId).toBe('exp-3');
    expect(result).toEqual({
      triggered: true,
      childExecutionId: 'child-1',
      childSuccess: true
    });
  });
});
