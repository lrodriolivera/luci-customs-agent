/**
 * Requirement Model
 * Gestiona los requerimientos de AEAT cuando una declaracion cae en canal naranja o rojo
 *
 * Un requerimiento se crea cuando:
 * - La declaracion es asignada a canal naranja (revision documental)
 * - La declaracion es asignada a canal rojo (inspeccion fisica)
 * - AEAT solicita informacion adicional sobre valoracion, clasificacion u origen
 */

const mongoose = require('mongoose');
// Contador atomico: el patron countDocuments()+1 reutilizaba referencias vivas
// tras un borrado (E11000) y repartia el mismo numero en altas concurrentes.
const { nextReference } = require('../utils/sequence');

// Schema para documentos adjuntos a la respuesta
const ResponseDocumentSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  fileName: String,
  filePath: String,
  fileSize: Number,
  mimeType: String,
  uploadedAt: { type: Date, default: Date.now },
  description: String
}, { _id: true });

// Schema para cada respuesta enviada
const ResponseSchema = new mongoose.Schema({
  responseNumber: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  responseType: {
    type: String,
    enum: ['documentary', 'clarification', 'additional_info', 'inspection_coordination'],
    required: true
  },
  notes: { type: String, required: true },
  documents: [ResponseDocumentSchema],
  // Si se envio a AEAT
  aeatSubmission: {
    submitted: { type: Boolean, default: false },
    submittedAt: Date,
    confirmationNumber: String,
    xmlContent: String,
    responseXml: String
  },
  // Resultado de esta respuesta
  result: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'needs_more_info']
    },
    notes: String,
    evaluatedAt: Date,
    evaluatedBy: String // Inspector ID o nombre
  }
}, { _id: true });

// Schema para items solicitados en el requerimiento
const RequestedItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: [
      'document',           // Documento especifico
      'clarification',      // Aclaracion sobre datos
      'valuation_proof',    // Justificacion de valor
      'origin_proof',       // Prueba de origen
      'classification_proof', // Justificacion de clasificacion
      'physical_inspection', // Inspeccion fisica
      'sample',             // Muestra del producto
      'other'
    ],
    required: true
  },
  description: { type: String, required: true },
  documentType: String, // Si es tipo 'document', cual documento
  // Codigo oficial del documento/accion solicitado (N380, C400, PHYSICAL...).
  // channelService lo escribe en todos los items, pero el schema no lo declaraba
  // y el subdocumento lo descartaba: los requerimientos quedaban sin el codigo
  // AEAT de lo solicitado.
  code: String,
  authority: String, // Organismo emisor del documento requerido (MAPA, SOIVRE...)
  mandatory: { type: Boolean, default: true },
  provided: { type: Boolean, default: false },
  providedAt: Date,
  providedDocumentId: { type: mongoose.Schema.Types.ObjectId },
  notes: String
}, { _id: true });

// Schema para inspeccion fisica (canal rojo)
const PhysicalInspectionSchema = new mongoose.Schema({
  scheduled: { type: Boolean, default: false },
  // Tipo de inspeccion solicitada (complete/partial/documental...). channelService
  // lo fija desde la respuesta de AEAT, pero el subdocumento lo descartaba por no
  // estar declarado -> se perdia el alcance de la inspeccion en canal rojo.
  inspectionType: { type: String, default: 'complete' },
  scheduledDate: Date,
  scheduledTime: String,
  location: {
    name: String,
    address: String,
    type: { type: String, enum: ['port', 'airport', 'warehouse', 'customs_office', 'other'] }
  },
  inspectorName: String,
  inspectorId: String,
  inspectorPhone: String,
  inspectorEmail: String,
  // Resultado de la inspeccion
  completed: { type: Boolean, default: false },
  completedAt: Date,
  result: {
    type: String,
    enum: ['approved', 'rejected', 'partial', 'pending_analysis']
  },
  findings: String,
  discrepancies: [{
    field: String,
    declared: String,
    found: String,
    severity: { type: String, enum: ['minor', 'major', 'critical'] }
  }],
  photos: [{
    fileName: String,
    filePath: String,
    description: String,
    takenAt: Date
  }],
  actaNumber: String, // Numero de acta de inspeccion
  actaDocument: { type: mongoose.Schema.Types.ObjectId }
}, { _id: false });

// Schema principal de Requirement
const RequirementSchema = new mongoose.Schema({
  // Referencia al expediente
  expeditionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition',
    required: true
  },

  // Numero de requerimiento interno
  requirementNumber: {
    type: String,
    unique: true
  },

  // MRN de la declaracion asociada
  mrn: { type: String, required: true },

  // LRN (Local Reference Number)
  lrn: String,

  // Tipo de requerimiento
  requirementType: {
    type: String,
    enum: [
      'documentary',      // Canal naranja - revision documental
      'physical',         // Canal rojo - inspeccion fisica
      'valuation',        // Cuestionamiento del valor declarado
      'classification',   // Cuestionamiento de la clasificacion TARIC
      'origin',           // Verificacion de origen
      'license',          // Falta licencia o permiso
      'certificate',      // Falta certificado (sanitario, fitosanitario, etc.)
      'paraduanero',      // Requerimiento de SOIVRE, MAPA, Sanidad, etc.
      'other'
    ],
    required: true
  },

  // Organismo que emite el requerimiento
  issuingAuthority: {
    type: String,
    enum: ['AEAT', 'SOIVRE', 'MAPA', 'SANIDAD', 'MITERD', 'OTHER'],
    default: 'AEAT'
  },

  // Canal asignado
  channel: {
    type: String,
    enum: ['orange', 'red', 'yellow'],
    required: true
  },

  // Estado del requerimiento
  status: {
    type: String,
    enum: [
      'pending',          // Recibido, pendiente de atencion
      'in_progress',      // En proceso de preparacion de respuesta
      'awaiting_client',  // Esperando documentos/info del cliente
      'response_ready',   // Respuesta preparada, pendiente de envio
      'submitted',        // Respuesta enviada a AEAT
      'under_review',     // AEAT revisando respuesta
      'resolved',         // Requerimiento resuelto satisfactoriamente
      'rejected',         // Rechazado por AEAT
      'appealed',         // En recurso/alegacion
      'closed'            // Cerrado
    ],
    default: 'pending'
  },

  // Prioridad
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'high'
  },

  // Fechas importantes
  receivedAt: { type: Date, default: Date.now },
  deadline: { type: Date, required: true }, // Fecha limite para responder
  firstResponseAt: Date,
  resolvedAt: Date,
  closedAt: Date,

  // Aduana que emite el requerimiento
  customsOffice: {
    code: String,
    name: String,
    address: String,
    phone: String,
    email: String
  },

  // Inspector asignado
  inspector: {
    name: String,
    id: String,
    phone: String,
    email: String
  },

  // Descripcion del requerimiento
  subject: { type: String, required: true },
  description: { type: String, required: true },
  legalBasis: String, // Articulo de ley que fundamenta el requerimiento

  // Items solicitados
  requestedItems: [RequestedItemSchema],

  // Respuestas enviadas
  responses: [ResponseSchema],

  // Datos de inspeccion fisica (si aplica)
  physicalInspection: PhysicalInspectionSchema,

  // Resultado final
  resolution: {
    status: {
      type: String,
      enum: ['levante', 'rejected', 'partial_levante', 'pending_payment', 'destroyed', 'returned']
    },
    date: Date,
    notes: String,
    dutyAdjustment: Number, // Diferencia en derechos si hay ajuste
    penaltyAmount: Number,  // Sancion si aplica
    confirmedBy: String
  },

  // Documentos XML de AEAT
  aeatCommunication: {
    requestXml: String,      // XML del requerimiento recibido
    responseXml: String,     // XML de respuesta enviada
    notificationNumber: String
  },

  // Notas internas
  internalNotes: String,

  // Asignacion
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Aislamiento multi-tenant. Se deriva de la expedicion a la que pertenece el
  // requerimiento; sin este campo ensureSameTenant no puede comprobar nada y
  // cualquiera con el id podia leer requerimientos de otro cliente.
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // Timeline de eventos
  timeline: [{
    action: String,
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Notificaciones enviadas
  notifications: [{
    type: { type: String, enum: ['email', 'sms', 'portal', 'system'] },
    recipient: String,
    subject: String,
    sentAt: Date,
    status: { type: String, enum: ['sent', 'delivered', 'failed'] }
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
RequirementSchema.index({ expeditionId: 1 });
RequirementSchema.index({ mrn: 1 });
RequirementSchema.index({ status: 1, deadline: 1 });
RequirementSchema.index({ requirementType: 1 });
RequirementSchema.index({ channel: 1 });
RequirementSchema.index({ assignedTo: 1, status: 1 });
RequirementSchema.index({ deadline: 1 }); // Para alertas de vencimiento
RequirementSchema.index({ createdAt: -1 });

// Virtual: dias restantes hasta deadline
RequirementSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadline) return null;
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual: esta vencido?
RequirementSchema.virtual('isOverdue').get(function() {
  if (!this.deadline) return false;
  return new Date() > new Date(this.deadline) && !['resolved', 'closed'].includes(this.status);
});

// Virtual: porcentaje de items proporcionados
RequirementSchema.virtual('completionPercentage').get(function() {
  if (!this.requestedItems || this.requestedItems.length === 0) return 0;
  const provided = this.requestedItems.filter(item => item.provided).length;
  return Math.round((provided / this.requestedItems.length) * 100);
});

// Pre-save: generar numero de requerimiento
RequirementSchema.pre('save', async function(next) {
  if (!this.requirementNumber) {
    const year = new Date().getFullYear();
    this.requirementNumber = await nextReference(this.constructor, 'requirementNumber', `REQ-${year}`, 5);
  }
  next();
});

// Methods
RequirementSchema.methods.addTimelineEvent = function(action, description, userId, metadata = {}) {
  this.timeline.push({
    action,
    description,
    performedBy: userId,
    metadata
  });
  return this.save();
};

RequirementSchema.methods.addResponse = async function(responseData, userId) {
  const responseNumber = (this.responses?.length || 0) + 1;

  this.responses.push({
    responseNumber,
    submittedBy: userId,
    ...responseData
  });

  if (!this.firstResponseAt) {
    this.firstResponseAt = new Date();
  }

  // Actualizar status
  if (this.status === 'pending' || this.status === 'awaiting_client') {
    this.status = 'in_progress';
  }

  await this.addTimelineEvent(
    'response_added',
    `Respuesta #${responseNumber} agregada`,
    userId,
    { responseNumber, responseType: responseData.responseType }
  );

  return this.save();
};

RequirementSchema.methods.markItemProvided = function(itemId, documentId = null) {
  const item = this.requestedItems.id(itemId);
  if (item) {
    item.provided = true;
    item.providedAt = new Date();
    if (documentId) {
      item.providedDocumentId = documentId;
    }
  }
  return this.save();
};

RequirementSchema.methods.scheduleInspection = function(inspectionData) {
  this.physicalInspection = {
    ...this.physicalInspection,
    ...inspectionData,
    scheduled: true
  };
  return this.addTimelineEvent(
    'inspection_scheduled',
    `Inspeccion programada para ${inspectionData.scheduledDate}`,
    null,
    inspectionData
  );
};

RequirementSchema.methods.resolve = async function(resolutionData, userId) {
  this.resolution = {
    ...resolutionData,
    date: new Date()
  };
  this.status = 'resolved';
  this.resolvedAt = new Date();

  await this.addTimelineEvent(
    'requirement_resolved',
    `Requerimiento resuelto: ${resolutionData.status}`,
    userId,
    resolutionData
  );

  return this.save();
};

// Statics
RequirementSchema.statics.findByExpedition = function(expeditionId) {
  return this.find({ expeditionId }).sort({ createdAt: -1 });
};

RequirementSchema.statics.findByMRN = function(mrn) {
  return this.find({ mrn }).sort({ createdAt: -1 });
};

RequirementSchema.statics.findPending = function(userId = null) {
  const query = {
    status: { $in: ['pending', 'in_progress', 'awaiting_client'] }
  };
  if (userId) {
    query.assignedTo = userId;
  }
  return this.find(query).sort({ deadline: 1 });
};

RequirementSchema.statics.findOverdue = function(tenantId = null) {
  const filter = {
    deadline: { $lt: new Date() },
    status: { $nin: ['resolved', 'closed', 'rejected'] }
  };
  if (tenantId) filter.tenantId = tenantId;
  return this.find(filter).sort({ deadline: 1 });
};

RequirementSchema.statics.findUrgent = function(tenantId = null) {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const filter = {
    deadline: { $lte: threeDaysFromNow },
    status: { $nin: ['resolved', 'closed', 'rejected'] }
  };
  if (tenantId) filter.tenantId = tenantId;
  return this.find(filter).sort({ deadline: 1 });
};

RequirementSchema.statics.getStats = async function(options = {}) {
  // Compatibilidad: antes la firma era getStats(userId). Si llega un string se
  // interpreta como userId; lo normal ahora es getStats({ tenantId, userId }).
  const { userId, tenantId } = typeof options === 'string'
    ? { userId: options }
    : (options || {});

  // `new` obligatorio: en Mongoose 7 invocar ObjectId como funcion lanza
  // "Class constructor ObjectId cannot be invoked without 'new'". Sin el, pasar
  // userId reventaba getStats con 500; solo "funcionaba" el caso sin userId.
  //
  // El filtro por tenant es lo que impide que las tarjetas cuenten los
  // requerimientos de otros clientes: sin el, getStats agregaba sobre toda la
  // coleccion mientras la lista de abajo si se acotaba, dejando cifras que no
  // cuadraban y filtrando volumen de negocio ajeno.
  const match = {};
  if (tenantId) match.tenantId = new mongoose.Types.ObjectId(tenantId);
  if (userId) match.assignedTo = new mongoose.Types.ObjectId(userId);

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const byChannel = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$channel',
        count: { $sum: 1 }
      }
    }
  ]);

  const overdue = await this.countDocuments({
    ...match,
    deadline: { $lt: new Date() },
    status: { $nin: ['resolved', 'closed', 'rejected'] }
  });

  return {
    byStatus: stats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byChannel: byChannel.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    overdue
  };
};

module.exports = mongoose.model('Requirement', RequirementSchema);
