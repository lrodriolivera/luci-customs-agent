/**
 * Deadline Model
 * Gestiona plazos y alertas de vencimientos del sistema
 *
 * Centraliza todos los plazos relevantes:
 * - Deadlines de requerimientos AEAT
 * - Vencimientos de garantías
 * - Plazos de regímenes especiales (ultimación, presentación cuentas)
 * - Renovaciones OEA
 * - Validez de certificados de origen
 * - Plazos de tránsitos NCTS
 * - Declaraciones H7 pendientes
 */

const mongoose = require('mongoose');

// Schema para configuración de alertas
const AlertConfigSchema = new mongoose.Schema({
  daysBeforeDeadline: { type: Number, required: true }, // Días antes del vencimiento
  alertType: {
    type: String,
    enum: ['email', 'sms', 'system', 'portal', 'all'],
    default: 'system'
  },
  recipients: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: String,
    phone: String,
    name: String
  }],
  enabled: { type: Boolean, default: true }
}, { _id: false });

// Schema para alertas enviadas
const SentAlertSchema = new mongoose.Schema({
  alertLevel: {
    type: String,
    enum: ['info', 'warning', 'urgent', 'critical'],
    required: true
  },
  sentAt: { type: Date, default: Date.now },
  sentTo: [{
    recipient: String,
    channel: String, // email, sms, system
    status: { type: String, enum: ['sent', 'delivered', 'failed', 'read'] },
    readAt: Date
  }],
  message: String,
  daysRemaining: Number
}, { _id: true });

// Schema principal de Deadline
const DeadlineSchema = new mongoose.Schema({
  // Tipo de deadline
  deadlineType: {
    type: String,
    enum: [
      'requirement_response',      // Respuesta a requerimiento AEAT
      'guarantee_expiration',      // Vencimiento de garantía
      'guarantee_renewal',         // Renovación de garantía
      'regime_ultimation',         // Ultimación de régimen especial
      'regime_account',            // Presentación cuenta de ultimación
      'oea_renewal',               // Renovación certificación OEA
      'oea_audit',                 // Auditoría OEA programada
      'transit_arrival',           // Llegada de tránsito NCTS
      'transit_discharge',         // Descarga de tránsito
      'certificate_expiration',    // Vencimiento de certificado de origen
      'license_expiration',        // Vencimiento de licencia/permiso
      'declaration_submission',    // Plazo presentación declaración
      'h7_completion',             // Completar H7
      'inspection_appointment',    // Cita de inspección física
      'paraduanero_response',      // Respuesta control paraduanero
      'appeal_deadline',           // Plazo para alegación/recurso
      'payment_deadline',          // Plazo de pago
      'document_presentation',     // Presentación de documento
      'customs_storage',           // Plazo almacenamiento temporal
      'other'
    ],
    required: true
  },

  // Categoría para agrupación
  category: {
    type: String,
    enum: ['requirement', 'guarantee', 'regime', 'oea', 'transit', 'certificate', 'declaration', 'inspection', 'payment', 'other'],
    required: true
  },

  // Título descriptivo
  title: { type: String, required: true },

  // Descripción detallada
  description: String,

  // Fecha límite
  dueDate: { type: Date, required: true, index: true },

  // Referencias a entidades relacionadas
  references: {
    expeditionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expedition' },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    guaranteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guarantee' },
    specialRegimeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SpecialRegime' },
    transitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transit' },
    oeaId: { type: mongoose.Schema.Types.ObjectId, ref: 'OEA' },
    h7DeclarationId: { type: mongoose.Schema.Types.ObjectId, ref: 'H7Declaration' },
    inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspection' }
  },

  // Identificadores externos
  externalReferences: {
    mrn: String,
    lrn: String,
    guaranteeNumber: String,
    regimeNumber: String,
    transitNumber: String,
    oeaNumber: String,
    certificateNumber: String
  },

  // Estado del deadline
  status: {
    type: String,
    enum: [
      'pending',       // Pendiente, dentro de plazo
      'approaching',   // Próximo a vencer (según configuración)
      'urgent',        // Urgente (menos de 48h)
      'critical',      // Crítico (menos de 24h o vencido)
      'completed',     // Completado a tiempo
      'overdue',       // Vencido sin completar
      'extended',      // Plazo extendido
      'cancelled'      // Cancelado
    ],
    default: 'pending'
  },

  // Prioridad
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Impacto si no se cumple
  impact: {
    type: String,
    enum: ['none', 'low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Descripción del impacto
  impactDescription: String,

  // Consecuencias legales/financieras
  consequences: {
    financial: String,    // Consecuencias financieras (sanciones, intereses)
    legal: String,        // Consecuencias legales
    operational: String   // Consecuencias operativas
  },

  // Base legal
  legalBasis: String,

  // Responsable del deadline
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Cliente/Operador relacionado
  client: {
    name: String,
    nif: String,
    eori: String
  },

  // Configuración de alertas
  alertConfig: {
    enabled: { type: Boolean, default: true },
    alerts: {
      type: [AlertConfigSchema],
      default: [
        { daysBeforeDeadline: 7, alertType: 'system' },
        { daysBeforeDeadline: 3, alertType: 'email' },
        { daysBeforeDeadline: 1, alertType: 'all' }
      ]
    }
  },

  // Alertas enviadas
  sentAlerts: [SentAlertSchema],

  // Última alerta enviada
  lastAlertSent: Date,

  // Próxima alerta programada
  nextAlertDue: Date,

  // Si se completó
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completionNotes: String,

  // Si se extendió el plazo
  extensions: [{
    originalDate: Date,
    newDate: Date,
    reason: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date, default: Date.now }
  }],

  // Metadatos adicionales
  metadata: mongoose.Schema.Types.Mixed,

  // Notas internas
  notes: String,

  // Quién creó el deadline
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Aislamiento multi-tenant. Se hereda de la expedicion de references, que es
  // su unico dueno posible: sin este campo no habia nada que comparar.
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // Origen del deadline (automático o manual)
  source: {
    type: String,
    enum: ['automatic', 'manual', 'import', 'sync'],
    default: 'automatic'
  },

  // Activo (soft delete)
  active: { type: Boolean, default: true }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
DeadlineSchema.index({ dueDate: 1, status: 1 });
DeadlineSchema.index({ deadlineType: 1, status: 1 });
DeadlineSchema.index({ category: 1, dueDate: 1 });
DeadlineSchema.index({ assignedTo: 1, status: 1 });
DeadlineSchema.index({ 'references.expeditionId': 1 });
DeadlineSchema.index({ 'references.requirementId': 1 });
DeadlineSchema.index({ 'references.guaranteeId': 1 });
DeadlineSchema.index({ status: 1, active: 1 });
DeadlineSchema.index({ nextAlertDue: 1 });
DeadlineSchema.index({ createdAt: -1 });

// Virtual: días restantes
DeadlineSchema.virtual('daysRemaining').get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual: horas restantes
DeadlineSchema.virtual('hoursRemaining').get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  return diffHours;
});

// Virtual: está vencido
DeadlineSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > new Date(this.dueDate) && !['completed', 'cancelled', 'extended'].includes(this.status);
});

// Virtual: nivel de urgencia
DeadlineSchema.virtual('urgencyLevel').get(function() {
  const days = this.daysRemaining;
  if (days === null) return 'unknown';
  if (days < 0) return 'overdue';
  if (days === 0) return 'critical';
  if (days <= 1) return 'urgent';
  if (days <= 3) return 'high';
  if (days <= 7) return 'medium';
  return 'low';
});

// Pre-save: actualizar status basado en fecha
DeadlineSchema.pre('save', function(next) {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return next();
  }

  const days = this.daysRemaining;

  if (days < 0) {
    this.status = 'overdue';
  } else if (days === 0) {
    this.status = 'critical';
  } else if (days <= 2) {
    this.status = 'urgent';
  } else if (days <= 7) {
    this.status = 'approaching';
  } else {
    this.status = 'pending';
  }

  next();
});

// Methods
DeadlineSchema.methods.complete = async function(userId, notes = '') {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;
  this.completionNotes = notes;
  return this.save();
};

DeadlineSchema.methods.extend = async function(newDate, reason, userId) {
  this.extensions.push({
    originalDate: this.dueDate,
    newDate: newDate,
    reason: reason,
    approvedBy: userId
  });
  this.dueDate = newDate;
  this.status = 'extended';
  return this.save();
};

DeadlineSchema.methods.cancel = async function(reason, userId) {
  this.status = 'cancelled';
  this.notes = (this.notes || '') + `\nCancelado: ${reason}`;
  return this.save();
};

DeadlineSchema.methods.addAlert = function(alertData) {
  this.sentAlerts.push(alertData);
  this.lastAlertSent = new Date();
  return this.save();
};

DeadlineSchema.methods.calculateNextAlert = function() {
  if (!this.alertConfig.enabled || this.status === 'completed' || this.status === 'cancelled') {
    this.nextAlertDue = null;
    return;
  }

  const days = this.daysRemaining;
  const configuredAlerts = this.alertConfig.alerts
    .filter(a => a.enabled && a.daysBeforeDeadline <= days)
    .sort((a, b) => b.daysBeforeDeadline - a.daysBeforeDeadline);

  if (configuredAlerts.length > 0) {
    const nextAlert = configuredAlerts[0];
    const alertDate = new Date(this.dueDate);
    alertDate.setDate(alertDate.getDate() - nextAlert.daysBeforeDeadline);
    this.nextAlertDue = alertDate;
  } else {
    this.nextAlertDue = null;
  }
};

// Statics
DeadlineSchema.statics.findPending = function(filters = {}) {
  const query = {
    status: { $in: ['pending', 'approaching', 'urgent', 'critical'] },
    active: true,
    ...filters
  };
  return this.find(query).sort({ dueDate: 1 });
};

DeadlineSchema.statics.findOverdue = function(filters = {}) {
  return this.find({
    status: 'overdue',
    active: true,
    ...filters
  }).sort({ dueDate: 1 });
};

DeadlineSchema.statics.findUrgent = function(hoursThreshold = 48) {
  const threshold = new Date();
  threshold.setHours(threshold.getHours() + hoursThreshold);

  return this.find({
    dueDate: { $lte: threshold },
    status: { $nin: ['completed', 'cancelled'] },
    active: true
  }).sort({ dueDate: 1 });
};

DeadlineSchema.statics.findByCategory = function(category, status = null) {
  const query = { category, active: true };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ dueDate: 1 });
};

DeadlineSchema.statics.findByType = function(deadlineType, status = null) {
  const query = { deadlineType, active: true };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ dueDate: 1 });
};

DeadlineSchema.statics.findByAssignee = function(userId, includeCompleted = false) {
  const query = {
    assignedTo: userId,
    active: true
  };
  if (!includeCompleted) {
    query.status = { $nin: ['completed', 'cancelled'] };
  }
  return this.find(query).sort({ dueDate: 1 });
};

DeadlineSchema.statics.findDueForAlerts = function() {
  return this.find({
    nextAlertDue: { $lte: new Date() },
    status: { $nin: ['completed', 'cancelled'] },
    'alertConfig.enabled': true,
    active: true
  });
};

DeadlineSchema.statics.getStats = async function(filters = {}) {
  const match = { active: true, ...filters };

  const [byStatus, byCategory, byUrgency] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { ...match, status: { $nin: ['completed', 'cancelled'] } } },
      {
        $project: {
          urgency: {
            $switch: {
              branches: [
                { case: { $lt: ['$dueDate', new Date()] }, then: 'overdue' },
                { case: { $lt: ['$dueDate', new Date(Date.now() + 24*60*60*1000)] }, then: 'critical' },
                { case: { $lt: ['$dueDate', new Date(Date.now() + 48*60*60*1000)] }, then: 'urgent' },
                { case: { $lt: ['$dueDate', new Date(Date.now() + 7*24*60*60*1000)] }, then: 'approaching' }
              ],
              default: 'normal'
            }
          }
        }
      },
      { $group: { _id: '$urgency', count: { $sum: 1 } } }
    ])
  ]);

  const overdue = await this.countDocuments({
    ...match,
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] }
  });

  const dueToday = await this.countDocuments({
    ...match,
    dueDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    },
    status: { $nin: ['completed', 'cancelled'] }
  });

  const dueThisWeek = await this.countDocuments({
    ...match,
    dueDate: {
      $gte: new Date(),
      $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    status: { $nin: ['completed', 'cancelled'] }
  });

  return {
    byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byCategory: byCategory.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byUrgency: byUrgency.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    overdue,
    dueToday,
    dueThisWeek,
    total: await this.countDocuments(match)
  };
};

DeadlineSchema.statics.getCalendarView = async function(startDate, endDate, filters = {}) {
  return this.find({
    dueDate: { $gte: startDate, $lte: endDate },
    active: true,
    ...filters
  }).sort({ dueDate: 1 });
};

module.exports = mongoose.model('Deadline', DeadlineSchema);
