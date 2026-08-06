/**
 * ParaduaneroControl Model
 * Gestiona los controles paraduaneros (no aduaneros) requeridos para ciertas mercancias
 *
 * Autoridades paraduaneras en Espana:
 * - SOIVRE: Productos industriales (juguetes, electricos, EPI, textiles)
 * - MAPA: Productos agricolas, veterinarios, fitosanitarios
 * - SANIDAD: Productos para consumo humano, medicamentos, cosmeticos
 * - MITERD: Residuos, CITES, productos quimicos REACH
 * - AEMPS: Medicamentos y productos sanitarios
 * - AESAN: Seguridad alimentaria
 */

const mongoose = require('mongoose');

// Schema para documentos requeridos
const RequiredDocumentSchema = new mongoose.Schema({
  code: { type: String, required: true }, // Codigo del documento (ej: C620, N851)
  name: { type: String, required: true },
  description: String,
  mandatory: { type: Boolean, default: true },
  provided: { type: Boolean, default: false },
  providedAt: Date,
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  validUntil: Date, // Fecha de validez del documento
  notes: String
}, { _id: true });

// Schema para resultado de inspeccion
const InspectionResultSchema = new mongoose.Schema({
  inspectionDate: Date,
  inspectorName: String,
  inspectorId: String,
  result: {
    type: String,
    enum: ['approved', 'rejected', 'conditional', 'pending_analysis', 'requires_treatment']
  },
  findings: String,
  conditions: [String], // Condiciones si es aprobacion condicional
  treatment: { // Si requiere tratamiento
    type: String,
    description: String,
    deadline: Date
  },
  samplesTaken: { type: Boolean, default: false },
  samplesDescription: String,
  labResults: {
    pending: { type: Boolean, default: false },
    expectedDate: Date,
    result: String,
    labName: String,
    reportNumber: String
  },
  actaNumber: String, // Numero de acta de inspeccion
  documents: [{
    type: { type: String },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    description: String
  }]
}, { _id: false });

// Schema para timeline de eventos
const TimelineEventSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'control_created',
      'document_uploaded',
      'document_validated',
      'document_rejected',
      'inspection_requested',
      'inspection_scheduled',
      'inspection_completed',
      'samples_sent',
      'lab_results_received',
      'control_approved',
      'control_rejected',
      'control_conditional',
      'treatment_required',
      'treatment_completed',
      'status_changed',
      'note_added'
    ],
    required: true
  },
  description: String,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: String,
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
}, { _id: true });

// Schema principal
const ParaduaneroControlSchema = new mongoose.Schema({
  // Referencias
  expeditionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition',
    required: true,
    index: true
  },
  // Aislamiento multi-tenant. Se hereda del expediente al crear el control
  // (ver paraduaneroService.createControlsForExpedition). Sin este campo el
  // guard ensureSameTenant caia en su rama legacy "sin tenant -> permitido" y
  // el listado filtraba por un campo inexistente (siempre 0). Ver SECURITY_AUDIT.md.
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  controlNumber: {
    type: String,
    unique: true
  },

  // Tipo de control
  controlType: {
    type: String,
    enum: ['SOIVRE', 'MAPA', 'SANIDAD', 'MITERD', 'AEMPS', 'AESAN'],
    required: true,
    index: true
  },

  // Subtipo especifico
  subType: {
    type: String,
    enum: [
      // SOIVRE
      'industrial_products',    // Productos industriales generales
      'toys',                   // Juguetes
      'electrical',             // Material electrico
      'ppe',                    // Equipos de proteccion personal
      'textiles',               // Textiles
      'machinery',              // Maquinaria
      // MAPA
      'veterinary',             // Control veterinario
      'phytosanitary',          // Control fitosanitario
      'cites_flora',            // CITES flora
      'animal_feed',            // Piensos
      // SANIDAD
      'food_safety',            // Seguridad alimentaria
      'cosmetics',              // Cosmeticos
      'pharmaceuticals',        // Medicamentos
      'medical_devices',        // Productos sanitarios
      // MITERD
      'waste',                  // Residuos
      'cites_fauna',            // CITES fauna
      'chemicals_reach',        // Productos quimicos REACH
      'ozone_depleting',        // Sustancias que agotan ozono
      'f_gases',                // Gases fluorados
      // Otros
      'other'
    ]
  },

  // Mercancia afectada
  affectedGoods: [{
    itemNumber: Number,
    description: String,
    taricCode: String,
    quantity: Number,
    unit: String,
    weight: Number
  }],

  // Estado del control
  status: {
    type: String,
    enum: [
      'pending',              // Pendiente de iniciar
      'documents_required',   // Esperando documentos
      'documents_submitted',  // Documentos enviados
      'inspection_pending',   // Pendiente de inspeccion
      'inspection_scheduled', // Inspeccion programada
      'under_inspection',     // En proceso de inspeccion
      'lab_analysis',         // En analisis de laboratorio
      'treatment_required',   // Requiere tratamiento
      'approved',             // Aprobado
      'conditional',          // Aprobado con condiciones
      'rejected',             // Rechazado
      'cancelled'             // Cancelado
    ],
    default: 'pending',
    index: true
  },

  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal'
  },

  // Fechas importantes
  requestedAt: { type: Date, default: Date.now },
  deadline: Date,
  resolvedAt: Date,

  // Autoridad responsable
  authority: {
    name: String,           // Nombre de la autoridad
    office: String,         // Oficina/delegacion
    contactName: String,
    contactEmail: String,
    contactPhone: String,
    referenceNumber: String // Numero de expediente de la autoridad
  },

  // Documentos requeridos
  requiredDocuments: [RequiredDocumentSchema],

  // Inspeccion (si aplica)
  inspection: {
    required: { type: Boolean, default: false },
    scheduled: { type: Boolean, default: false },
    scheduledDate: Date,
    scheduledTime: String,
    location: {
      name: String,
      address: String,
      type: { type: String, enum: ['port', 'airport', 'warehouse', 'pip', 'other'] }
    },
    result: InspectionResultSchema
  },

  // Tasas y costes
  fees: {
    inspectionFee: Number,
    labFee: Number,
    certificateFee: Number,
    otherFees: Number,
    totalFees: Number,
    currency: { type: String, default: 'EUR' },
    paid: { type: Boolean, default: false },
    paidAt: Date,
    receiptNumber: String
  },

  // Certificado/autorizacion emitido
  certificate: {
    issued: { type: Boolean, default: false },
    issuedAt: Date,
    certificateNumber: String,
    certificateType: String,
    validFrom: Date,
    validUntil: Date,
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
  },

  // Motivo de rechazo (si aplica)
  rejection: {
    reason: String,
    details: String,
    appealable: { type: Boolean, default: true },
    appealDeadline: Date,
    appealed: { type: Boolean, default: false }
  },

  // Notas y comentarios
  notes: String,
  internalNotes: String,

  // Timeline
  timeline: [TimelineEventSchema],

  // Notificaciones enviadas
  notifications: [{
    type: { type: String, enum: ['email', 'sms', 'portal'] },
    recipient: String,
    subject: String,
    sentAt: Date,
    status: { type: String, enum: ['sent', 'delivered', 'failed'] }
  }],

  // Usuario que creo el control
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, {
  timestamps: true
});

// Indices
ParaduaneroControlSchema.index({ expeditionId: 1, controlType: 1 });
ParaduaneroControlSchema.index({ status: 1, controlType: 1 });
ParaduaneroControlSchema.index({ deadline: 1 });
ParaduaneroControlSchema.index({ 'affectedGoods.taricCode': 1 });

// Generar numero de control antes de guardar
ParaduaneroControlSchema.pre('save', async function(next) {
  if (this.isNew && !this.controlNumber) {
    const year = new Date().getFullYear();
    const prefix = this.controlType.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      controlType: this.controlType,
      createdAt: { $gte: new Date(year, 0, 1) }
    });
    this.controlNumber = `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Metodo para agregar evento al timeline
ParaduaneroControlSchema.methods.addTimelineEvent = function(action, description, userId, metadata = {}) {
  this.timeline.push({
    action,
    description,
    performedBy: userId,
    metadata,
    timestamp: new Date()
  });
};

// Metodo para verificar si todos los documentos estan completos
ParaduaneroControlSchema.methods.documentsComplete = function() {
  const mandatoryDocs = this.requiredDocuments.filter(d => d.mandatory);
  return mandatoryDocs.every(d => d.provided);
};

// Metodo para calcular progreso
ParaduaneroControlSchema.methods.getProgress = function() {
  const totalDocs = this.requiredDocuments.length;
  const providedDocs = this.requiredDocuments.filter(d => d.provided).length;

  if (this.status === 'approved' || this.status === 'conditional') return 100;
  if (this.status === 'rejected' || this.status === 'cancelled') return 0;

  let progress = 0;
  if (totalDocs > 0) {
    progress = Math.round((providedDocs / totalDocs) * 50); // Documentos = 50%
  }

  if (this.inspection.required) {
    if (this.inspection.result?.result) {
      progress += 50; // Inspeccion completada = otro 50%
    } else if (this.inspection.scheduled) {
      progress += 25; // Inspeccion programada = 25%
    }
  } else {
    progress += 50; // Si no requiere inspeccion, documentos = 100%
  }

  return Math.min(progress, 99); // Nunca 100% hasta que este aprobado
};

// Metodo para verificar si esta vencido
ParaduaneroControlSchema.methods.isOverdue = function() {
  if (!this.deadline) return false;
  if (['approved', 'conditional', 'rejected', 'cancelled'].includes(this.status)) return false;
  return new Date() > this.deadline;
};

// Virtual para dias hasta vencimiento
ParaduaneroControlSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadline) return null;
  const diff = this.deadline - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual para duracion total
ParaduaneroControlSchema.virtual('totalDuration').get(function() {
  if (!this.resolvedAt) return null;
  const diff = this.resolvedAt - this.requestedAt;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

ParaduaneroControlSchema.set('toJSON', { virtuals: true });
ParaduaneroControlSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ParaduaneroControl', ParaduaneroControlSchema);
