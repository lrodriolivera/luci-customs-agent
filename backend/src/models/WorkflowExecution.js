/**
 * WorkflowExecution Model
 * Historial de ejecuciones de workflows
 * Fase 6.6 - LUCI Customs Agent
 *
 * Registra cada ejecucion de un workflow con detalle de:
 * - Contexto que disparo la ejecucion
 * - Resultado de cada accion
 * - Errores y logs
 * - Metricas de tiempo
 */

const mongoose = require('mongoose');

// ==================== Sub-schemas ====================

/**
 * Resultado de una accion individual
 */
const ActionResultSchema = new mongoose.Schema({
  actionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  actionType: String,
  actionName: String,
  order: Number,
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
    default: 'pending'
  },
  startedAt: Date,
  completedAt: Date,
  durationMs: Number,
  result: mongoose.Schema.Types.Mixed,        // Resultado de la accion
  error: {
    message: String,
    code: String,
    stack: String
  },
  retryCount: { type: Number, default: 0 },
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['debug', 'info', 'warn', 'error'] },
    message: String,
    data: mongoose.Schema.Types.Mixed
  }]
}, { _id: true });

/**
 * Contexto del trigger
 */
const TriggerContextSchema = new mongoose.Schema({
  type: String,                               // event, schedule, manual, webhook
  event: String,                              // Nombre del evento si aplica
  eventData: mongoose.Schema.Types.Mixed,     // Datos del evento
  scheduledTime: Date,                        // Para triggers programados
  webhookPayload: mongoose.Schema.Types.Mixed,// Para triggers webhook
  triggeredBy: {                              // Usuario si fue manual
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String
  }
}, { _id: false });

// ==================== Schema principal ====================

const WorkflowExecutionSchema = new mongoose.Schema({
  // Referencia al workflow
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
    index: true
  },
  workflowName: String,
  workflowVersion: Number,

  // Multi-tenancy
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // ID unico de ejecucion (para tracking)
  executionId: {
    type: String,
    unique: true,
    default: function() {
      return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },

  // Estado de la ejecucion
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled', 'timeout'],
    default: 'queued',
    index: true
  },

  // Contexto del trigger
  triggerContext: TriggerContextSchema,

  // Entidad que disparo el workflow
  entityContext: {
    entityType: String,                       // expedition, declaration, requirement, etc
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityData: mongoose.Schema.Types.Mixed   // Snapshot de datos al momento de ejecucion
  },

  // Variables disponibles durante la ejecucion
  variables: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Resultados de acciones
  actionResults: [ActionResultSchema],

  // Metricas de tiempo
  timing: {
    queuedAt: Date,
    startedAt: Date,
    completedAt: Date,
    totalDurationMs: Number,
    actionsExecuted: { type: Number, default: 0 },
    actionsSucceeded: { type: Number, default: 0 },
    actionsFailed: { type: Number, default: 0 },
    actionsSkipped: { type: Number, default: 0 }
  },

  // Error global (si fallo todo el workflow)
  error: {
    message: String,
    code: String,
    actionId: mongoose.Schema.Types.ObjectId, // Accion donde fallo
    stack: String
  },

  // Output final
  output: mongoose.Schema.Types.Mixed,

  // Para reintentos
  retryOf: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowExecution' },
  retryCount: { type: Number, default: 0 },

  // Logs generales
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['debug', 'info', 'warn', 'error'] },
    message: String,
    data: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  collection: 'workflow_executions'
});

// ==================== Indexes ====================

WorkflowExecutionSchema.index({ workflowId: 1, createdAt: -1 });
WorkflowExecutionSchema.index({ organizationId: 1, createdAt: -1 });
WorkflowExecutionSchema.index({ organizationId: 1, status: 1 });
WorkflowExecutionSchema.index({ 'entityContext.entityType': 1, 'entityContext.entityId': 1 });
WorkflowExecutionSchema.index({ executionId: 1 });
WorkflowExecutionSchema.index({ createdAt: -1 });

// TTL index para limpiar ejecuciones antiguas (90 dias)
WorkflowExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ==================== Methods ====================

/**
 * Iniciar ejecucion
 */
WorkflowExecutionSchema.methods.start = async function() {
  this.status = 'running';
  this.timing.startedAt = new Date();
  this.addLog('info', 'Ejecucion iniciada');
  return this.save();
};

/**
 * Marcar accion como iniciada
 */
WorkflowExecutionSchema.methods.startAction = async function(actionId, actionType, actionName, order) {
  const result = {
    actionId,
    actionType,
    actionName,
    order,
    status: 'running',
    startedAt: new Date(),
    logs: []
  };
  this.actionResults.push(result);
  return this.save();
};

/**
 * Marcar accion como completada
 */
WorkflowExecutionSchema.methods.completeAction = async function(actionId, result) {
  const actionResult = this.actionResults.find(a => a.actionId.equals(actionId));
  if (actionResult) {
    actionResult.status = 'completed';
    actionResult.completedAt = new Date();
    actionResult.durationMs = actionResult.completedAt - actionResult.startedAt;
    actionResult.result = result;
    this.timing.actionsExecuted += 1;
    this.timing.actionsSucceeded += 1;
  }
  return this.save();
};

/**
 * Marcar accion como fallida
 */
WorkflowExecutionSchema.methods.failAction = async function(actionId, error) {
  const actionResult = this.actionResults.find(a => a.actionId.equals(actionId));
  if (actionResult) {
    actionResult.status = 'failed';
    actionResult.completedAt = new Date();
    actionResult.durationMs = actionResult.completedAt - actionResult.startedAt;
    actionResult.error = {
      message: error.message,
      code: error.code,
      stack: error.stack
    };
    this.timing.actionsExecuted += 1;
    this.timing.actionsFailed += 1;
  }
  return this.save();
};

/**
 * Completar ejecucion exitosamente
 */
WorkflowExecutionSchema.methods.complete = async function(output) {
  this.status = 'completed';
  this.timing.completedAt = new Date();
  this.timing.totalDurationMs = this.timing.completedAt - this.timing.startedAt;
  this.output = output;
  this.addLog('info', 'Ejecucion completada exitosamente');
  return this.save();
};

/**
 * Marcar ejecucion como fallida
 */
WorkflowExecutionSchema.methods.fail = async function(error, actionId) {
  this.status = 'failed';
  this.timing.completedAt = new Date();
  this.timing.totalDurationMs = this.timing.completedAt - (this.timing.startedAt || this.timing.queuedAt);
  this.error = {
    message: error.message,
    code: error.code || 'EXECUTION_ERROR',
    actionId,
    stack: error.stack
  };
  this.addLog('error', `Ejecucion fallida: ${error.message}`);
  return this.save();
};

/**
 * Cancelar ejecucion
 */
WorkflowExecutionSchema.methods.cancel = async function(reason) {
  this.status = 'cancelled';
  this.timing.completedAt = new Date();
  this.addLog('warn', `Ejecucion cancelada: ${reason || 'Sin motivo especificado'}`);
  return this.save();
};

/**
 * Agregar log
 */
WorkflowExecutionSchema.methods.addLog = function(level, message, data) {
  this.logs.push({
    timestamp: new Date(),
    level,
    message,
    data
  });
};

/**
 * Agregar log a una accion
 */
WorkflowExecutionSchema.methods.addActionLog = function(actionId, level, message, data) {
  const actionResult = this.actionResults.find(a => a.actionId.equals(actionId));
  if (actionResult) {
    actionResult.logs.push({
      timestamp: new Date(),
      level,
      message,
      data
    });
  }
};

// ==================== Statics ====================

/**
 * Obtener ejecuciones de un workflow
 */
WorkflowExecutionSchema.statics.getByWorkflow = function(workflowId, options = {}) {
  const { limit = 50, skip = 0, status } = options;
  const query = { workflowId };
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Obtener ejecuciones de una entidad
 */
WorkflowExecutionSchema.statics.getByEntity = function(entityType, entityId, options = {}) {
  const { limit = 20 } = options;
  return this.find({
    'entityContext.entityType': entityType,
    'entityContext.entityId': entityId
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Obtener estadisticas de ejecuciones
 */
WorkflowExecutionSchema.statics.getStats = async function(organizationId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$timing.totalDurationMs' }
      }
    }
  ]);

  const stats = {
    total: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    running: 0,
    avgDurationMs: 0
  };

  result.forEach(r => {
    stats[r._id] = r.count;
    stats.total += r.count;
    if (r._id === 'completed') {
      stats.avgDurationMs = Math.round(r.avgDuration);
    }
  });

  return stats;
};

/**
 * Limpiar ejecuciones antiguas
 */
WorkflowExecutionSchema.statics.cleanupOld = function(organizationId, daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return this.deleteMany({
    organizationId,
    createdAt: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model('WorkflowExecution', WorkflowExecutionSchema);
