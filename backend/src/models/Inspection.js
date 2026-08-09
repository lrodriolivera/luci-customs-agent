/**
 * Inspection Model
 * Gestiona las inspecciones físicas y documentales
 *
 * Tipos de inspecciones:
 * - Física (canal rojo): Inspección de mercancías en recinto
 * - Documental (canal naranja): Revisión de documentación
 * - Scanner: Paso por escáner
 * - SOIVRE/MAPA/Sanidad: Controles paraduaneros específicos
 */

const mongoose = require('mongoose');
// Contador atomico: el patron countDocuments()+1 reutilizaba referencias vivas
// tras un borrado (E11000) y repartia el mismo numero en altas concurrentes.
const { nextReference } = require('../utils/sequence');

// Schema para participantes en la inspección
const ParticipantSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['inspector', 'agent', 'client', 'transporter', 'witness', 'expert', 'other'],
    required: true
  },
  name: { type: String, required: true },
  organization: String,
  position: String,
  idNumber: String, // DNI/NIE
  phone: String,
  email: String,
  signature: String, // Base64 o referencia a archivo
  signedAt: Date,
  notes: String
}, { _id: true });

// Schema para items inspeccionados
const InspectedItemSchema = new mongoose.Schema({
  itemNumber: { type: Number, required: true },
  description: String,
  taricCode: String,
  declaredQuantity: Number,
  declaredUnit: String,
  foundQuantity: Number,
  foundUnit: String,
  declaredWeight: Number,
  foundWeight: Number,
  declaredValue: Number,
  declaredOrigin: String,
  foundOrigin: String,
  packagingType: String,
  packagingCount: Number,
  containerNumber: String,
  sealNumber: String,
  sealIntact: Boolean,
  condition: {
    type: String,
    enum: ['good', 'damaged', 'partial', 'missing', 'excess']
  },
  discrepancies: [{
    field: String,
    declared: String,
    found: String,
    severity: { type: String, enum: ['minor', 'major', 'critical'] },
    notes: String
  }],
  samplesTaken: [{
    sampleId: String,
    quantity: String,
    purpose: String,
    laboratory: String,
    takenAt: Date
  }],
  photos: [{
    fileName: String,
    filePath: String,
    description: String,
    takenAt: Date
  }],
  result: {
    type: String,
    enum: ['conform', 'non_conform', 'pending_analysis', 'not_inspected']
  },
  notes: String
}, { _id: true });

// Schema para documentos verificados
const VerifiedDocumentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: [
      'commercial_invoice', 'packing_list', 'bl', 'awb', 'cmr',
      'eur1', 'form_a', 'atr', 'certificate_origin',
      'phytosanitary', 'veterinary', 'health', 'cites',
      'ce_marking', 'conformity', 'quality', 'insurance',
      'import_license', 'quota_certificate', 'other'
    ],
    required: true
  },
  documentNumber: String,
  issueDate: Date,
  expiryDate: Date,
  issuingAuthority: String,
  originalProvided: { type: Boolean, default: false },
  copyProvided: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  verificationResult: {
    type: String,
    enum: ['valid', 'invalid', 'expired', 'suspicious', 'pending']
  },
  notes: String
}, { _id: true });

// Schema para el acta de inspección
const InspectionReportSchema = new mongoose.Schema({
  reportNumber: String,
  generatedAt: Date,
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  documentPath: String,
  signedByInspector: Boolean,
  signedByAgent: Boolean,
  signedByClient: Boolean,
  observations: String,
  conclusions: String,
  recommendations: String
}, { _id: false });

// Schema principal de Inspection
const InspectionSchema = new mongoose.Schema({
  // Número de inspección
  inspectionNumber: {
    type: String,
    unique: true
  },

  // Tipo de inspección
  inspectionType: {
    type: String,
    enum: [
      'physical',           // Inspección física (canal rojo)
      'documentary',        // Revisión documental (canal naranja)
      'scanner',            // Escáner
      'soivre',             // Inspección SOIVRE
      'mapa',               // Inspección MAPA/Veterinaria
      'sanidad',            // Inspección Sanidad
      'miterd',             // Inspección MITERD
      'combined',           // Combinada (varios tipos)
      'post_clearance',     // Post-despacho
      'random'              // Aleatoria
    ],
    required: true
  },

  // Referencias
  expeditionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expedition' },
  requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
  paraduaneroControlId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParaduaneroControl' },

  // Identificadores de declaración
  mrn: String,
  lrn: String,

  // Estado de la inspección
  status: {
    type: String,
    enum: [
      'requested',          // Solicitada
      'scheduled',          // Programada
      'confirmed',          // Confirmada
      'in_progress',        // En curso
      'suspended',          // Suspendida
      'completed',          // Completada
      'cancelled',          // Cancelada
      'pending_results'     // Esperando resultados (laboratorio, etc.)
    ],
    default: 'requested'
  },

  // Resultado de la inspección
  result: {
    type: String,
    enum: [
      'approved',           // Aprobada - levante
      'approved_conditions', // Aprobada con condiciones
      'rejected',           // Rechazada
      'partial',            // Resultado parcial
      'pending_analysis',   // Pendiente de análisis
      'pending_documents',  // Pendiente de documentos adicionales
      'referred'            // Derivada a otra autoridad
    ]
  },

  // Ubicación
  location: {
    type: {
      type: String,
      enum: ['port', 'airport', 'warehouse', 'customs_office', 'border', 'company', 'other'],
      required: true
    },
    name: { type: String, required: true },
    address: String,
    city: String,
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    contactPerson: String,
    contactPhone: String,
    accessInstructions: String
  },

  // Programación
  scheduling: {
    requestedDate: Date,
    requestedTimeSlot: String, // "morning", "afternoon", "09:00-11:00"
    scheduledDate: { type: Date, index: true },
    scheduledTime: String,
    estimatedDuration: Number, // Minutos
    confirmedAt: Date,
    confirmedBy: String,
    confirmationNumber: String
  },

  // Ejecución
  execution: {
    startedAt: Date,
    completedAt: Date,
    actualDuration: Number, // Minutos
    delayReason: String
  },

  // Autoridad que realiza la inspección
  authority: {
    type: {
      type: String,
      enum: ['AEAT', 'SOIVRE', 'MAPA', 'SANIDAD', 'MITERD', 'POLICE', 'OTHER']
    },
    office: String,
    officeName: String,
    officeAddress: String,
    officePhone: String,
    officeEmail: String
  },

  // Inspector asignado
  inspector: {
    id: String,
    name: String,
    badge: String,
    phone: String,
    email: String
  },

  // Participantes
  participants: [ParticipantSchema],

  // Mercancías a inspeccionar
  goods: {
    description: String,
    totalPackages: Number,
    totalGrossWeight: Number,
    totalNetWeight: Number,
    containerNumbers: [String],
    sealNumbers: [String],
    vehiclePlates: [String]
  },

  // Items inspeccionados
  inspectedItems: [InspectedItemSchema],

  // Documentos verificados
  verifiedDocuments: [VerifiedDocumentSchema],

  // Hallazgos
  findings: {
    discrepanciesFound: { type: Boolean, default: false },
    discrepancySummary: String,
    quantityDiscrepancy: Boolean,
    qualityDiscrepancy: Boolean,
    originDiscrepancy: Boolean,
    classificationDiscrepancy: Boolean,
    valueDiscrepancy: Boolean,
    documentDiscrepancy: Boolean,
    safetyIssues: Boolean,
    safetyDescription: String,
    suspiciousActivity: Boolean,
    suspiciousDescription: String
  },

  // Muestras tomadas
  samples: [{
    sampleId: String,
    itemReference: String,
    quantity: String,
    purpose: String,
    laboratory: String,
    sentAt: Date,
    expectedResultDate: Date,
    resultReceivedAt: Date,
    result: String,
    resultDocument: String
  }],

  // Fotografías/Evidencias
  evidence: [{
    type: { type: String, enum: ['photo', 'video', 'document', 'other'] },
    fileName: String,
    filePath: String,
    description: String,
    capturedAt: Date,
    capturedBy: String,
    geoLocation: {
      latitude: Number,
      longitude: Number
    }
  }],

  // Acta de inspección
  report: InspectionReportSchema,

  // Acciones resultantes
  resultingActions: [{
    actionType: {
      type: String,
      enum: [
        'levante',              // Autorización de levante
        'retention',            // Retención de mercancía
        'destruction',          // Destrucción
        'return',               // Devolución al origen
        'duty_adjustment',      // Ajuste de derechos
        'penalty',              // Sanción
        'additional_inspection', // Inspección adicional
        'referral',             // Derivación a otra autoridad
        'documentation_request', // Solicitud de documentación
        'laboratory_analysis'   // Análisis de laboratorio
      ]
    },
    description: String,
    amount: Number, // Para ajustes o sanciones
    deadline: Date,
    status: { type: String, enum: ['pending', 'in_progress', 'completed'] },
    completedAt: Date,
    notes: String
  }],

  // Recursos/Alegaciones
  appeals: [{
    appealNumber: String,
    filedAt: Date,
    filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    grounds: String,
    documents: [String],
    status: { type: String, enum: ['filed', 'under_review', 'accepted', 'rejected'] },
    resolution: String,
    resolvedAt: Date
  }],

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
  publicNotes: String,

  // Asignación
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Aislamiento multi-tenant. Se hereda de la expedicion inspeccionada, que es
  // su unico dueno posible: sin este campo no habia nada que comparar y
  // cualquiera con el id podia operar sobre inspecciones de otro cliente.
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // Cliente
  client: {
    name: String,
    nif: String,
    eori: String,
    contact: String,
    phone: String,
    email: String
  },

  // Prioridad
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
InspectionSchema.index({ inspectionType: 1, status: 1 });
InspectionSchema.index({ 'scheduling.scheduledDate': 1 });
InspectionSchema.index({ expeditionId: 1 });
InspectionSchema.index({ requirementId: 1 });
InspectionSchema.index({ mrn: 1 });
InspectionSchema.index({ status: 1 });
InspectionSchema.index({ result: 1 });
InspectionSchema.index({ assignedTo: 1, status: 1 });
InspectionSchema.index({ createdAt: -1 });
InspectionSchema.index({ 'authority.type': 1 });

// Virtual: está programada para hoy
InspectionSchema.virtual('isToday').get(function() {
  if (!this.scheduling?.scheduledDate) return false;
  const today = new Date();
  const scheduled = new Date(this.scheduling.scheduledDate);
  return today.toDateString() === scheduled.toDateString();
});

// Virtual: días hasta la inspección
InspectionSchema.virtual('daysUntilInspection').get(function() {
  if (!this.scheduling?.scheduledDate) return null;
  const now = new Date();
  const scheduled = new Date(this.scheduling.scheduledDate);
  const diffTime = scheduled - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save: generar número de inspección
InspectionSchema.pre('save', async function(next) {
  if (!this.inspectionNumber) {
    const year = new Date().getFullYear();
    const typePrefix = this.inspectionType.substring(0, 3).toUpperCase();
    this.inspectionNumber = await nextReference(this.constructor, 'inspectionNumber', `INS-${typePrefix}-${year}`, 5);
  }
  next();
});

// Methods
InspectionSchema.methods.schedule = async function(schedulingData, userId) {
  this.scheduling = {
    ...this.scheduling,
    ...schedulingData
  };
  this.status = 'scheduled';

  this.timeline.push({
    action: 'scheduled',
    description: `Inspección programada para ${schedulingData.scheduledDate}`,
    performedBy: userId,
    metadata: schedulingData
  });

  return this.save();
};

InspectionSchema.methods.confirm = async function(confirmationNumber, userId) {
  this.scheduling.confirmedAt = new Date();
  this.scheduling.confirmationNumber = confirmationNumber;
  this.status = 'confirmed';

  this.timeline.push({
    action: 'confirmed',
    description: `Inspección confirmada: ${confirmationNumber}`,
    performedBy: userId
  });

  return this.save();
};

InspectionSchema.methods.start = async function(userId) {
  this.execution = {
    ...this.execution,
    startedAt: new Date()
  };
  this.status = 'in_progress';

  this.timeline.push({
    action: 'started',
    description: 'Inspección iniciada',
    performedBy: userId
  });

  return this.save();
};

InspectionSchema.methods.complete = async function(resultData, userId) {
  this.execution.completedAt = new Date();
  if (this.execution.startedAt) {
    this.execution.actualDuration = Math.round((this.execution.completedAt - this.execution.startedAt) / 60000);
  }
  this.result = resultData.result;
  this.findings = resultData.findings || this.findings;
  this.status = 'completed';

  this.timeline.push({
    action: 'completed',
    description: `Inspección completada: ${resultData.result}`,
    performedBy: userId,
    metadata: resultData
  });

  return this.save();
};

InspectionSchema.methods.addParticipant = function(participantData) {
  this.participants.push(participantData);
  return this.save();
};

InspectionSchema.methods.addEvidence = function(evidenceData) {
  this.evidence.push({
    ...evidenceData,
    capturedAt: evidenceData.capturedAt || new Date()
  });
  return this.save();
};

InspectionSchema.methods.addInspectedItem = function(itemData) {
  const itemNumber = this.inspectedItems.length + 1;
  this.inspectedItems.push({
    itemNumber,
    ...itemData
  });
  return this.save();
};

InspectionSchema.methods.generateReport = async function(reportData, userId) {
  this.report = {
    ...reportData,
    generatedAt: new Date(),
    generatedBy: userId
  };

  this.timeline.push({
    action: 'report_generated',
    description: `Acta de inspección generada: ${reportData.reportNumber}`,
    performedBy: userId
  });

  return this.save();
};

InspectionSchema.methods.addResultingAction = function(actionData) {
  this.resultingActions.push({
    ...actionData,
    status: 'pending'
  });
  return this.save();
};

// Statics
InspectionSchema.statics.findScheduledForDate = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    'scheduling.scheduledDate': { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['scheduled', 'confirmed'] }
  }).sort({ 'scheduling.scheduledTime': 1 });
};

InspectionSchema.statics.findByExpedition = function(expeditionId) {
  return this.find({ expeditionId }).sort({ createdAt: -1 });
};

InspectionSchema.statics.findPending = function(userId = null) {
  const query = {
    status: { $in: ['requested', 'scheduled', 'confirmed', 'in_progress'] }
  };
  if (userId) {
    query.assignedTo = userId;
  }
  return this.find(query).sort({ 'scheduling.scheduledDate': 1 });
};

InspectionSchema.statics.findByAuthority = function(authorityType) {
  return this.find({ 'authority.type': authorityType }).sort({ createdAt: -1 });
};

InspectionSchema.statics.getStats = async function(filters = {}) {
  const [byStatus, byType, byResult, byAuthority] = await Promise.all([
    this.aggregate([
      { $match: filters },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: filters },
      { $group: { _id: '$inspectionType', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { ...filters, result: { $exists: true } } },
      { $group: { _id: '$result', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: filters },
      { $group: { _id: '$authority.type', count: { $sum: 1 } } }
    ])
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const scheduledToday = await this.countDocuments({
    ...filters,
    'scheduling.scheduledDate': { $gte: today, $lt: tomorrow },
    status: { $in: ['scheduled', 'confirmed'] }
  });

  return {
    byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byType: byType.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byResult: byResult.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    byAuthority: byAuthority.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    scheduledToday,
    total: await this.countDocuments(filters)
  };
};

InspectionSchema.statics.getCalendar = async function(startDate, endDate, filters = {}) {
  return this.find({
    'scheduling.scheduledDate': { $gte: startDate, $lte: endDate },
    ...filters
  }).sort({ 'scheduling.scheduledDate': 1, 'scheduling.scheduledTime': 1 });
};

module.exports = mongoose.model('Inspection', InspectionSchema);
