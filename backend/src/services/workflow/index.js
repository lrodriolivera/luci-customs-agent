/**
 * Workflow Services Index
 * Phase 6.6: Workflow Engine
 * Exports all workflow services for centralized access
 */

const workflowService = require('./workflowService');
const workflowEngine = require('./workflowEngine');
const { workflowEvents, eventHelpers } = require('./eventEmitter');
const { actionHandlers, registerAllHandlers } = require('./actionHandlers');
const batchProcessor = require('./batchProcessor');

module.exports = {
  // Main service
  workflowService,

  // Engine
  workflowEngine,

  // Events
  workflowEvents,
  eventHelpers,

  // Batch Processing
  batchProcessor,

  // Actions
  actionHandlers,
  registerAllHandlers,

  // Convenience methods
  initialize: () => workflowService.initialize(),

  // CRUD
  createWorkflow: (...args) => workflowService.createWorkflow(...args),
  getWorkflow: (...args) => workflowService.getWorkflow(...args),
  listWorkflows: (...args) => workflowService.listWorkflows(...args),
  updateWorkflow: (...args) => workflowService.updateWorkflow(...args),
  deleteWorkflow: (...args) => workflowService.deleteWorkflow(...args),
  toggleWorkflow: (...args) => workflowService.toggleWorkflow(...args),
  publishWorkflow: (...args) => workflowService.publishWorkflow(...args),
  cloneWorkflow: (...args) => workflowService.cloneWorkflow(...args),

  // Execution
  executeWorkflow: (...args) => workflowService.executeWorkflow(...args),
  executeWorkflowManually: (...args) => workflowService.executeWorkflowManually(...args),
  getExecutionHistory: (...args) => workflowService.getExecutionHistory(...args),
  getExecution: (...args) => workflowService.getExecution(...args),
  cancelExecution: (...args) => workflowService.cancelExecution(...args),

  // Stats
  getStats: (...args) => workflowService.getStats(...args),
  getTopWorkflows: (...args) => workflowService.getTopWorkflows(...args),

  // Events helpers
  emitEvent: (...args) => workflowEvents.emitWorkflowEvent(...args)
};
