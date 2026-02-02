/**
 * Workflow Model
 * Motor de automatizacion de flujos para operaciones aduaneras
 * Fase 6.6 - LUCI Customs Agent
 *
 * Permite definir flujos automatizados basados en:
 * - Eventos del sistema (documento subido, declaracion enviada, etc)
 * - Programacion temporal (cron)
 * - Ejecucion manual
 */

const mongoose = require('mongoose');

// ==================== Sub-schemas ====================

/**
 * Condicion para evaluar si el workflow debe ejecutarse
 */
const ConditionSchema = new mongoose.Schema({
  field: { type: String, required: true },      // Campo a evaluar (ej: 'expedition.status')
  operator: {
    type: String,
    enum: [
      'equals', 'not_equals',
      'contains', 'not_contains',
      'starts_with', 'ends_with',
      'greater_than', 'less_than',
      'greater_or_equal', 'less_or_equal',
      'in', 'not_in',
      'is_empty', 'is_not_empty',
      'is_true', 'is_false',
      'regex'
    ],
    required: true
  },
  value: mongoose.Schema.Types.Mixed,           // Valor a comparar
  caseSensitive: { type: Boolean, default: false }
}, { _id: false });

/**
 * Grupo de condiciones con operador logico
 */
const ConditionGroupSchema = new mongoose.Schema({
  logic: {
    type: String,
    enum: ['AND', 'OR'],
    default: 'AND'
  },
  conditions: [ConditionSchema]
}, { _id: false });

/**
 * Configuracion del trigger
 */
const TriggerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['event', 'schedule', 'manual', 'webhook'],
    required: true
  },
  // Para triggers basados en eventos
  event: {
    type: String,
    enum: [
      // Expedientes
      'expedition.created',
      'expedition.updated',
      'expedition.status_changed',
      'expedition.completed',
      'expedition.cancelled',
      // Documentos
      'document.uploaded',
      'document.validated',
      'document.rejected',
      'document.expired',
      // Declaraciones
      'declaration.created',
      'declaration.submitted',
      'declaration.accepted',
      'declaration.rejected',
      'declaration.channel_assigned',
      // Requerimientos
      'requirement.created',
      'requirement.responded',
      'requirement.resolved',
      'requirement.deadline_approaching',
      // Canal aduanero
      'channel.green',
      'channel.yellow',
      'channel.orange',
      'channel.red',
      // Garantias
      'guarantee.created',
      'guarantee.consumed',
      'guarantee.low_balance',
      'guarantee.expired',
      // Transito
      'transit.initiated',
      'transit.arrived',
      'transit.completed',
      'transit.incident',
      // Inspecciones
      'inspection.scheduled',
      'inspection.completed',
      'inspection.passed',
      'inspection.failed',
      // Controles paraduaneros
      'paraduanero.required',
      'paraduanero.approved',
      'paraduanero.rejected',
      // Comunicaciones
      'communication.received',
      'communication.sent',
      // Pagos
      'payment.required',
      'payment.completed',
      // ML/Alertas
      'ml.fraud_detected',
      'ml.high_risk_predicted',
      'ml.recommendation_generated',
      // Sistema
      'system.daily_check',
      'system.weekly_report'
    ]
  },
  // Para triggers programados (cron)
  schedule: {
    cron: String,                               // Expresion cron (ej: '0 9 * * 1-5')
    timezone: { type: String, default: 'Europe/Madrid' },
    startDate: Date,
    endDate: Date
  },
  // Configuracion adicional
  config: {
    debounceMs: Number,                         // Evitar ejecuciones repetidas
    maxExecutionsPerDay: Number,                // Limite de ejecuciones diarias
    onlyBusinessHours: { type: Boolean, default: false },
    businessHoursStart: { type: Number, default: 9 },
    businessHoursEnd: { type: Number, default: 18 }
  }
}, { _id: false });

/**
 * Accion a ejecutar
 */
const ActionSchema = new mongoose.Schema({
  order: { type: Number, required: true },      // Orden de ejecucion
  type: {
    type: String,
    enum: [
      // Notificaciones
      'send_email',
      'send_sms',
      'send_notification',
      'send_portal_message',
      // Actualizaciones
      'update_status',
      'update_field',
      'add_tag',
      'remove_tag',
      'add_note',
      // Creacion
      'create_task',
      'create_deadline',
      'create_requirement',
      // Asignacion
      'assign_user',
      'assign_team',
      // Integraciones
      'call_webhook',
      'call_api',
      // ML/AI
      'run_ml_prediction',
      'generate_recommendation',
      'auto_respond',
      // Documentos
      'generate_document',
      'request_document',
      'validate_document',
      // Declaraciones
      'submit_declaration',
      'schedule_submission',
      // Workflow
      'trigger_workflow',
      'wait',
      'conditional_branch'
    ],
    required: true
  },
  name: String,                                 // Nombre descriptivo de la accion
  config: {
    // Configuracion especifica por tipo de accion
    // send_email
    emailTemplate: String,
    emailTo: [String],                          // Puede usar variables: {{client.email}}
    emailSubject: String,
    emailBody: String,
    // send_notification
    notificationTitle: String,
    notificationBody: String,
    notificationPriority: { type: String, enum: ['low', 'normal', 'high', 'urgent'] },
    // update_status
    newStatus: String,
    // update_field
    fieldPath: String,
    fieldValue: mongoose.Schema.Types.Mixed,
    // add_tag / remove_tag
    tag: String,
    // add_note
    noteContent: String,
    noteVisibility: { type: String, enum: ['internal', 'client', 'all'] },
    // create_deadline
    deadlineType: String,
    deadlineDays: Number,
    deadlineTitle: String,
    // assign_user
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignmentRule: { type: String, enum: ['specific', 'round_robin', 'least_loaded', 'random'] },
    // call_webhook
    webhookUrl: String,
    webhookMethod: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH'], default: 'POST' },
    webhookHeaders: mongoose.Schema.Types.Mixed,
    webhookBody: mongoose.Schema.Types.Mixed,
    webhookTimeout: { type: Number, default: 30000 },
    // wait
    waitSeconds: Number,
    waitUntilDate: Date,
    waitUntilEvent: String,
    // conditional_branch
    branchConditions: [ConditionSchema],
    branchTrueActions: [String],               // IDs de acciones a ejecutar si true
    branchFalseActions: [String],              // IDs de acciones a ejecutar si false
    // trigger_workflow
    targetWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
    // Retry config
    retryOnFailure: { type: Boolean, default: false },
    maxRetries: { type: Number, default: 3 },
    retryDelayMs: { type: Number, default: 5000 }
  },
  // Para errores
  continueOnError: { type: Boolean, default: false },
  errorHandler: {
    action: { type: String, enum: ['ignore', 'retry', 'stop', 'notify'] },
    notifyUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
}, { _id: true });

// ==================== Schema principal ====================

const WorkflowSchema = new mongoose.Schema({
  // Identificacion
  name: { type: String, required: true },
  description: String,
  slug: { type: String, unique: true, sparse: true },

  // Multi-tenancy
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Categoria para organizacion
  category: {
    type: String,
    enum: [
      'import',           // Flujos de importacion
      'export',           // Flujos de exportacion
      'transit',          // Flujos de transito
      'requirement',      // Gestion de requerimientos
      'inspection',       // Coordinacion de inspecciones
      'notification',     // Notificaciones automaticas
      'compliance',       // Cumplimiento y alertas
      'reporting',        // Reportes programados
      'integration',      // Integraciones externas
      'custom'            // Personalizados
    ],
    default: 'custom'
  },

  // Trigger que inicia el workflow
  trigger: { type: TriggerSchema, required: true },

  // Condiciones para ejecutar (filtro adicional)
  conditions: ConditionGroupSchema,

  // Acciones a ejecutar
  actions: [ActionSchema],

  // Estado
  enabled: { type: Boolean, default: true, index: true },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'archived'],
    default: 'draft'
  },

  // Metadata de ejecucion
  stats: {
    totalExecutions: { type: Number, default: 0 },
    successfulExecutions: { type: Number, default: 0 },
    failedExecutions: { type: Number, default: 0 },
    lastExecutedAt: Date,
    lastSuccessAt: Date,
    lastFailureAt: Date,
    averageExecutionTimeMs: Number
  },

  // Control de versiones
  version: { type: Number, default: 1 },
  publishedVersion: Number,
  changelog: [{
    version: Number,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changes: String
  }],

  // Creacion y modificacion
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Tags para busqueda
  tags: [String],

  // Configuracion avanzada
  settings: {
    runOnce: { type: Boolean, default: false },         // Ejecutar solo una vez por entidad
    concurrentExecutions: { type: Number, default: 10 }, // Max ejecuciones simultaneas
    timeout: { type: Number, default: 300000 },         // Timeout en ms (5 min default)
    priority: { type: Number, default: 5 },             // 1-10, mayor = mas prioritario
    logLevel: { type: String, enum: ['none', 'errors', 'all'], default: 'errors' }
  }
}, {
  timestamps: true,
  collection: 'workflows'
});

// ==================== Indexes ====================

WorkflowSchema.index({ organizationId: 1, status: 1 });
WorkflowSchema.index({ organizationId: 1, 'trigger.type': 1 });
WorkflowSchema.index({ organizationId: 1, 'trigger.event': 1 });
WorkflowSchema.index({ organizationId: 1, category: 1 });
WorkflowSchema.index({ enabled: 1, 'trigger.type': 1 });
WorkflowSchema.index({ tags: 1 });

// ==================== Virtuals ====================

WorkflowSchema.virtual('successRate').get(function() {
  if (this.stats.totalExecutions === 0) return 0;
  return Math.round((this.stats.successfulExecutions / this.stats.totalExecutions) * 100);
});

// ==================== Methods ====================

/**
 * Incrementar contador de ejecuciones
 */
WorkflowSchema.methods.recordExecution = async function(success, executionTimeMs) {
  this.stats.totalExecutions += 1;
  this.stats.lastExecutedAt = new Date();

  if (success) {
    this.stats.successfulExecutions += 1;
    this.stats.lastSuccessAt = new Date();
  } else {
    this.stats.failedExecutions += 1;
    this.stats.lastFailureAt = new Date();
  }

  // Actualizar tiempo promedio
  if (executionTimeMs) {
    const total = this.stats.totalExecutions;
    const currentAvg = this.stats.averageExecutionTimeMs || executionTimeMs;
    this.stats.averageExecutionTimeMs = Math.round(
      ((currentAvg * (total - 1)) + executionTimeMs) / total
    );
  }

  return this.save();
};

/**
 * Clonar workflow
 */
WorkflowSchema.methods.clone = function(newName, userId) {
  const cloned = this.toObject();
  delete cloned._id;
  delete cloned.createdAt;
  delete cloned.updatedAt;
  cloned.name = newName || `${this.name} (copia)`;
  cloned.status = 'draft';
  cloned.enabled = false;
  cloned.stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0
  };
  cloned.version = 1;
  cloned.changelog = [];
  cloned.createdBy = userId;
  return new this.constructor(cloned);
};

/**
 * Publicar version
 */
WorkflowSchema.methods.publish = async function(userId, changeDescription) {
  this.version += 1;
  this.publishedVersion = this.version;
  this.status = 'active';
  this.enabled = true;
  this.updatedBy = userId;
  this.changelog.push({
    version: this.version,
    changedBy: userId,
    changes: changeDescription || 'Publicado'
  });
  return this.save();
};

// ==================== Statics ====================

/**
 * Buscar workflows por evento
 */
WorkflowSchema.statics.findByEvent = function(organizationId, eventName) {
  return this.find({
    organizationId,
    enabled: true,
    status: 'active',
    'trigger.type': 'event',
    'trigger.event': eventName
  }).sort({ 'settings.priority': -1 });
};

/**
 * Buscar workflows programados
 */
WorkflowSchema.statics.findScheduled = function(organizationId) {
  return this.find({
    organizationId,
    enabled: true,
    status: 'active',
    'trigger.type': 'schedule'
  });
};

/**
 * Obtener estadisticas globales
 */
WorkflowSchema.statics.getGlobalStats = async function(organizationId) {
  const result = await this.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    {
      $group: {
        _id: null,
        totalWorkflows: { $sum: 1 },
        activeWorkflows: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        totalExecutions: { $sum: '$stats.totalExecutions' },
        successfulExecutions: { $sum: '$stats.successfulExecutions' },
        failedExecutions: { $sum: '$stats.failedExecutions' }
      }
    }
  ]);

  return result[0] || {
    totalWorkflows: 0,
    activeWorkflows: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0
  };
};

module.exports = mongoose.model('Workflow', WorkflowSchema);
