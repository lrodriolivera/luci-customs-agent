/**
 * InspectorCommunication Model
 * Gestiona las comunicaciones con inspectores y autoridades aduaneras
 *
 * Tipos de comunicaciones:
 * - Respuestas a requerimientos
 * - Alegaciones
 * - Recursos administrativos
 * - Solicitudes de información
 * - Notificaciones
 */

const mongoose = require('mongoose');

// Schema para documentos adjuntos
const AttachmentSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  filePath: String,
  fileSize: Number,
  mimeType: String,
  description: String,
  documentType: {
    type: String,
    enum: [
      'response',           // Documento de respuesta
      'evidence',           // Evidencia/Prueba
      'certificate',        // Certificado
      'invoice',            // Factura
      'legal_document',     // Documento legal
      'technical_report',   // Informe técnico
      'valuation_report',   // Informe de valoración
      'classification_proof', // Justificación clasificación
      'origin_proof',       // Prueba de origen
      'signature',          // Firma
      'other'
    ]
  },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

// Schema para mensajes en la comunicación
const MessageSchema = new mongoose.Schema({
  direction: {
    type: String,
    enum: ['outgoing', 'incoming'],
    required: true
  },
  messageType: {
    type: String,
    enum: ['initial', 'response', 'clarification', 'notification', 'resolution', 'other'],
    required: true
  },
  subject: String,
  content: { type: String, required: true },
  attachments: [AttachmentSchema],
  sentAt: Date,
  receivedAt: Date,
  readAt: Date,
  sender: {
    name: String,
    role: String,
    organization: String,
    email: String,
    phone: String
  },
  recipient: {
    name: String,
    role: String,
    organization: String,
    email: String
  },
  channel: {
    type: String,
    enum: ['email', 'portal', 'registered_mail', 'fax', 'in_person', 'electronic', 'other'],
    default: 'electronic'
  },
  deliveryConfirmation: {
    confirmed: Boolean,
    confirmedAt: Date,
    confirmationNumber: String
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true, timestamps: true });

// Schema principal de InspectorCommunication
const InspectorCommunicationSchema = new mongoose.Schema({
  // Número de comunicación
  communicationNumber: {
    type: String,
    unique: true
  },

  // Tipo de comunicación
  communicationType: {
    type: String,
    enum: [
      'requirement_response',   // Respuesta a requerimiento
      'allegation',             // Alegación
      'administrative_appeal',  // Recurso de reposición
      'economic_appeal',        // Recurso económico-administrativo
      'judicial_appeal',        // Recurso contencioso-administrativo
      'information_request',    // Solicitud de información
      'clarification',          // Aclaración
      'notification_response',  // Respuesta a notificación
      'inspection_coordination', // Coordinación de inspección
      'voluntary_rectification', // Rectificación voluntaria
      'prior_consultation',     // Consulta previa
      'complaint',              // Queja
      'other'
    ],
    required: true
  },

  // Categoría
  category: {
    type: String,
    enum: ['response', 'appeal', 'request', 'notification', 'coordination', 'other'],
    required: true
  },

  // Estado
  status: {
    type: String,
    enum: [
      'draft',              // Borrador
      'pending_review',     // Pendiente de revisión
      'approved',           // Aprobado para envío
      'sent',               // Enviado
      'delivered',          // Entregado
      'read',               // Leído
      'in_process',         // En proceso por la autoridad
      'awaiting_response',  // Esperando respuesta
      'responded',          // Respondido
      'resolved',           // Resuelto
      'rejected',           // Rechazado
      'expired',            // Expirado/Prescrito
      'archived'            // Archivado
    ],
    default: 'draft'
  },

  // Prioridad
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Referencias a entidades relacionadas
  references: {
    expeditionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expedition' },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspection' },
    declarationId: { type: mongoose.Schema.Types.ObjectId },
    parentCommunicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InspectorCommunication' }
  },

  // Identificadores externos
  externalReferences: {
    mrn: String,
    lrn: String,
    requirementNumber: String,
    notificationNumber: String,
    actaNumber: String,
    expedientNumber: String,  // Número de expediente sancionador
    resolutionNumber: String  // Número de resolución
  },

  // Autoridad destinataria
  authority: {
    type: {
      type: String,
      enum: ['AEAT', 'SOIVRE', 'MAPA', 'SANIDAD', 'MITERD', 'TEAR', 'TEAC', 'COURT', 'OTHER'],
      required: true
    },
    name: String,
    office: String,
    address: String,
    city: String,
    postalCode: String,
    phone: String,
    email: String,
    fax: String,
    registryNumber: String  // Número de registro de entrada
  },

  // Inspector/Funcionario asignado
  inspector: {
    id: String,
    name: String,
    position: String,
    department: String,
    phone: String,
    email: String
  },

  // Asunto
  subject: { type: String, required: true },

  // Descripción/Resumen
  description: String,

  // Base legal de la comunicación
  legalBasis: [{
    law: String,         // Ley o reglamento
    article: String,     // Artículo
    description: String  // Descripción de la aplicación
  }],

  // Argumentos (para alegaciones/recursos)
  arguments: [{
    title: String,
    content: String,
    supportingDocuments: [String],
    order: Number
  }],

  // Petición (lo que se solicita)
  petition: {
    type: String,  // Tipo de petición
    description: String,
    requestedRelief: String  // Alivio/Resolución solicitada
  },

  // Mensajes
  messages: [MessageSchema],

  // Plazos
  deadlines: {
    submissionDeadline: Date,      // Plazo para presentar
    responseDeadline: Date,        // Plazo de respuesta de la autoridad
    appealDeadline: Date,          // Plazo para recurrir (si aplica)
    silenceDate: Date              // Fecha de silencio administrativo
  },

  // Fechas importantes
  dates: {
    createdAt: { type: Date, default: Date.now },
    sentAt: Date,
    receivedAt: Date,              // Cuando la autoridad la recibe
    acknowledgedAt: Date,          // Cuando acusan recibo
    respondedAt: Date,             // Cuando responden
    resolvedAt: Date,
    archivedAt: Date
  },

  // Resolución
  resolution: {
    status: {
      type: String,
      enum: ['favorable', 'unfavorable', 'partial', 'inadmissible', 'withdrawn', 'silence_positive', 'silence_negative']
    },
    date: Date,
    summary: String,
    resolutionNumber: String,
    notifiedAt: Date,
    documentPath: String,
    appealable: Boolean,
    appealDeadline: Date,
    nextSteps: String
  },

  // Impacto económico
  economicImpact: {
    claimedAmount: Number,         // Importe reclamado
    recognizedAmount: Number,      // Importe reconocido
    penaltyAmount: Number,         // Sanción
    interestAmount: Number,        // Intereses
    totalAmount: Number,
    currency: { type: String, default: 'EUR' }
  },

  // Cliente/Operador
  client: {
    name: String,
    nif: String,
    eori: String,
    legalRepresentative: String,
    address: String,
    phone: String,
    email: String
  },

  // Representación
  representation: {
    type: { type: String, enum: ['direct', 'indirect', 'legal'] },
    representativeName: String,
    representativeNif: String,
    powerOfAttorney: String,
    powerDocumentPath: String
  },

  // Asignación interna
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Timeline
  timeline: [{
    action: String,
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Notas
  internalNotes: String,

  // Seguimiento
  followUp: {
    required: { type: Boolean, default: true },
    nextAction: String,
    nextActionDate: Date,
    reminderSent: Boolean
  },

  // Etiquetas para búsqueda
  tags: [String],

  // Activo
  active: { type: Boolean, default: true }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
InspectorCommunicationSchema.index({ communicationType: 1, status: 1 });
InspectorCommunicationSchema.index({ 'references.expeditionId': 1 });
InspectorCommunicationSchema.index({ 'references.requirementId': 1 });
InspectorCommunicationSchema.index({ 'externalReferences.mrn': 1 });
InspectorCommunicationSchema.index({ 'authority.type': 1 });
InspectorCommunicationSchema.index({ status: 1, 'deadlines.submissionDeadline': 1 });
InspectorCommunicationSchema.index({ assignedTo: 1, status: 1 });
InspectorCommunicationSchema.index({ createdAt: -1 });
InspectorCommunicationSchema.index({ category: 1, status: 1 });
InspectorCommunicationSchema.index({ 'client.nif': 1 });
InspectorCommunicationSchema.index({ tags: 1 });

// Virtual: días hasta deadline
InspectorCommunicationSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadlines?.submissionDeadline) return null;
  const now = new Date();
  const deadline = new Date(this.deadlines.submissionDeadline);
  const diffTime = deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual: está vencido
InspectorCommunicationSchema.virtual('isOverdue').get(function() {
  if (!this.deadlines?.submissionDeadline) return false;
  return new Date() > new Date(this.deadlines.submissionDeadline) &&
         !['sent', 'delivered', 'resolved', 'archived'].includes(this.status);
});

// Virtual: cantidad de mensajes
InspectorCommunicationSchema.virtual('messageCount').get(function() {
  return this.messages?.length || 0;
});

// Pre-save: generar número de comunicación
InspectorCommunicationSchema.pre('save', async function(next) {
  if (!this.communicationNumber) {
    const year = new Date().getFullYear();
    const typePrefix = this.communicationType.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.communicationNumber = `COM-${typePrefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Methods
InspectorCommunicationSchema.methods.addMessage = async function(messageData, userId) {
  this.messages.push({
    ...messageData,
    createdBy: userId
  });

  const action = messageData.direction === 'outgoing' ? 'message_sent' : 'message_received';
  this.timeline.push({
    action,
    description: messageData.subject || 'Nuevo mensaje',
    performedBy: userId,
    metadata: { messageType: messageData.messageType }
  });

  return this.save();
};

InspectorCommunicationSchema.methods.submit = async function(userId) {
  this.status = 'sent';
  this.dates.sentAt = new Date();

  this.timeline.push({
    action: 'submitted',
    description: 'Comunicación enviada',
    performedBy: userId
  });

  return this.save();
};

InspectorCommunicationSchema.methods.markDelivered = async function(confirmationNumber, userId) {
  this.status = 'delivered';
  this.dates.receivedAt = new Date();

  if (this.messages.length > 0) {
    const lastOutgoing = [...this.messages].reverse().find(m => m.direction === 'outgoing');
    if (lastOutgoing) {
      lastOutgoing.deliveryConfirmation = {
        confirmed: true,
        confirmedAt: new Date(),
        confirmationNumber
      };
    }
  }

  this.timeline.push({
    action: 'delivered',
    description: `Entrega confirmada: ${confirmationNumber}`,
    performedBy: userId
  });

  return this.save();
};

InspectorCommunicationSchema.methods.receiveResponse = async function(responseData, userId) {
  this.messages.push({
    direction: 'incoming',
    messageType: 'response',
    ...responseData
  });

  this.status = 'responded';
  this.dates.respondedAt = new Date();

  this.timeline.push({
    action: 'response_received',
    description: 'Respuesta recibida de la autoridad',
    performedBy: userId,
    metadata: responseData
  });

  return this.save();
};

InspectorCommunicationSchema.methods.resolve = async function(resolutionData, userId) {
  this.resolution = {
    ...resolutionData,
    date: new Date()
  };
  this.status = 'resolved';
  this.dates.resolvedAt = new Date();

  this.timeline.push({
    action: 'resolved',
    description: `Comunicación resuelta: ${resolutionData.status}`,
    performedBy: userId,
    metadata: resolutionData
  });

  return this.save();
};

InspectorCommunicationSchema.methods.archive = async function(userId) {
  this.status = 'archived';
  this.dates.archivedAt = new Date();
  this.active = false;

  this.timeline.push({
    action: 'archived',
    description: 'Comunicación archivada',
    performedBy: userId
  });

  return this.save();
};

InspectorCommunicationSchema.methods.addArgument = function(argumentData) {
  const order = (this.arguments?.length || 0) + 1;
  this.arguments.push({
    ...argumentData,
    order
  });
  return this.save();
};

// Statics
InspectorCommunicationSchema.statics.findPending = function(userId = null) {
  const query = {
    status: { $in: ['draft', 'pending_review', 'approved', 'awaiting_response', 'in_process'] },
    active: true
  };
  if (userId) {
    query.assignedTo = userId;
  }
  return this.find(query).sort({ 'deadlines.submissionDeadline': 1 });
};

InspectorCommunicationSchema.statics.findByType = function(communicationType, status = null) {
  const query = { communicationType, active: true };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

InspectorCommunicationSchema.statics.findByExpedition = function(expeditionId) {
  return this.find({ 'references.expeditionId': expeditionId, active: true }).sort({ createdAt: -1 });
};

InspectorCommunicationSchema.statics.findByRequirement = function(requirementId) {
  return this.find({ 'references.requirementId': requirementId, active: true }).sort({ createdAt: -1 });
};

InspectorCommunicationSchema.statics.findOverdue = function() {
  return this.find({
    'deadlines.submissionDeadline': { $lt: new Date() },
    status: { $in: ['draft', 'pending_review', 'approved'] },
    active: true
  }).sort({ 'deadlines.submissionDeadline': 1 });
};

InspectorCommunicationSchema.statics.findAppeals = function(status = null) {
  const query = {
    communicationType: { $in: ['allegation', 'administrative_appeal', 'economic_appeal', 'judicial_appeal'] },
    active: true
  };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

InspectorCommunicationSchema.statics.getStats = async function(filters = {}) {
  const match = { active: true, ...filters };

  const [byType, byStatus, byCategory, byAuthority] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $group: { _id: '$communicationType', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$authority.type', count: { $sum: 1 } } }
    ])
  ]);

  const overdue = await this.countDocuments({
    ...match,
    'deadlines.submissionDeadline': { $lt: new Date() },
    status: { $in: ['draft', 'pending_review', 'approved'] }
  });

  const pendingResponse = await this.countDocuments({
    ...match,
    status: 'awaiting_response'
  });

  return {
    byType: byType.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byCategory: byCategory.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byAuthority: byAuthority.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    overdue,
    pendingResponse,
    total: await this.countDocuments(match)
  };
};

module.exports = mongoose.model('InspectorCommunication', InspectorCommunicationSchema);
