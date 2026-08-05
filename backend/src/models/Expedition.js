const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AddressSchema = new mongoose.Schema({
  street: String,
  city: String,
  postalCode: String,
  province: String,
  country: { type: String, default: 'ES' }
}, { _id: false });

const ContactSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String
}, { _id: false });

const GoodsItemSchema = new mongoose.Schema({
  itemNumber: { type: Number, required: true },
  description: { type: String, required: true },
  descriptionEs: String,
  taricCode: { type: String, maxlength: 14 }, // 10 digits + 4 additional
  hsCode: { type: String, maxlength: 6 },
  originCountry: { type: String, length: 2 },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'KG' },
  grossWeight: Number, // kg
  netWeight: Number, // kg
  supplementaryUnits: Number,
  supplementaryUnitType: String,
  invoiceValue: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  statisticalValue: Number,
  packages: {
    quantity: Number,
    type: { type: String }, // CTN, PLT, BX, etc.
    marks: String
  },
  // Duty calculation
  dutyRate: Number,
  dutyAmount: Number,
  vatRate: { type: Number, default: 21 },
  vatAmount: Number,
  specialTaxRate: Number,
  specialTaxAmount: Number
}, { _id: true });

const DocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'commercial_invoice',
      'proforma_invoice',
      'packing_list',
      'bill_of_lading',
      'air_waybill',
      'cmr',
      'certificate_origin',
      'eur1',
      'eur_med',
      'atr',
      'form_a',
      'sanitary_certificate',
      'phytosanitary_certificate',
      'veterinary_certificate',
      'fumigation_certificate',
      'insurance_certificate',
      'dispatch_authorization',
      'import_license',
      'export_license',
      'ce_certificate',
      'quality_certificate',
      'other'
    ],
    required: true
  },
  fileName: { type: String, required: true },
  originalName: String,
  filePath: String,
  fileSize: Number,
  mimeType: String,
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['pending', 'validating', 'validated', 'rejected', 'needs_revision'],
    default: 'pending'
  },
  validationNotes: String,
  validatedAt: Date,
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  extractedData: mongoose.Schema.Types.Mixed, // OCR/AI extracted data
  aiConfidence: Number // 0-100
}, { _id: true });

const ChecklistItemSchema = new mongoose.Schema({
  documentType: { type: String, required: true },
  documentName: String,
  required: { type: Boolean, default: true },
  conditional: Boolean,
  condition: String,
  received: { type: Boolean, default: false },
  validated: { type: Boolean, default: false },
  documentId: { type: mongoose.Schema.Types.ObjectId },
  notes: String
}, { _id: true });

const TimelineEventSchema = new mongoose.Schema({
  action: { type: String, required: true },
  description: String,
  performedBy: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
}, { _id: true });

const DeclarationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'I1', 'I2', 'AES', 'TRANSIT']
  },
  declarationType: String, // A, B, C, D, E, F, X, Y, Z, U, V
  mrn: String, // Movement Reference Number
  lrn: String, // Local Reference Number
  regime: String, // 40, 42, 44, 51, 53, etc.
  additionalProcedure: String,
  preference: String, // 100, 200, 300, 400
  customsOffice: String,
  declarationDate: Date,
  acceptanceDate: Date,
  submittedAt: Date,
  status: {
    type: String,
    enum: ['draft', 'pending', 'submitted', 'accepted', 'rejected', 'amendment_required', 'correction_required', 'amendment_pending']
  },
  customsCountry: { type: String },
  customsSystem: { type: String }, // 'AEAT', 'DMS', 'DECO'
  channel: {
    // 'yellow' es el canal propio del H7 (bajo valor): IVA pendiente de pago.
    // submitH7 lo asignaba pero el enum no lo admitia -> ValidationError -> 500.
    type: String,
    enum: ['green', 'yellow', 'orange', 'red']
  },
  levanteDate: Date,
  // Sello temporal de asignacion de canal. channelService lo escribe al procesar
  // la respuesta de AEAT, pero el subdocumento estricto (_id:false) lo descartaba
  // por no estar declarado -> se perdia la traza de cuando se asigno el circuito.
  channelAssignedAt: Date,
  xmlContent: String, // Generated XML for AEAT
  responseXml: String,
  errors: [String],
  // Campos que el controller escribe tras generar/enviar la declaracion y que
  // el subdocumento estricto (_id:false) descartaba silenciosamente:
  //  - h7Data/vatCalculation: salida del generador H7. Sin persistirlos,
  //    getH7Stats leia siempre withIOSS=0/totalValue=0 (estadisticas basura) y
  //    submitH7 nunca veia IVA pendiente -> asignaba canal verde a toda H7 sin
  //    IOSS, despachando sin exigir el pago del IVA.
  //  - h1Data: bloque de datos H1 de generateH1Direct.
  //  - levanteNumber: numero de levante H7; se perdia al guardar.
  //  - aeatResponse: respuesta completa de AEAT (codigo, CSV, canal).
  //  - cancelledAt: sello de anulacion.
  h7Data: mongoose.Schema.Types.Mixed,
  vatCalculation: mongoose.Schema.Types.Mixed,
  h1Data: mongoose.Schema.Types.Mixed,
  aeatResponse: mongoose.Schema.Types.Mixed,
  levanteNumber: String,
  cancelledAt: Date
}, { _id: false, suppressReservedKeysWarning: true });

const CalculationsSchema = new mongoose.Schema({
  invoiceTotal: Number,
  invoiceCurrency: { type: String, default: 'EUR' },
  exchangeRate: { type: Number, default: 1 },
  invoiceTotalEur: Number,
  freightCost: Number,
  insuranceCost: Number,
  otherCosts: Number,
  customsValue: Number, // CIF value in EUR
  totalDuties: Number,
  totalVat: Number,
  totalSpecialTaxes: Number,
  totalTaxes: Number,
  // Importe total a pagar (valor en aduana + tributos). calculationController lo
  // calcula pero no lo persistia porque el schema no lo declaraba: el portal
  // cliente (getPendingPayments) lo leia y siempre valia undefined -> nunca se
  // mostraba un pago pendiente aunque hubiera aranceles/IVA calculados.
  totalToPay: Number,
  guaranteeRequired: Number,
  calculatedAt: Date,
  calculatedBy: String, // 'manual' or 'ai'
  // Estado de cobro. paymentService.updateExpeditionAfterPayment escribe estos
  // tres campos al confirmar un pago; sin declararlos, el subdocumento estricto
  // (_id: false) los descartaba y la expedicion nunca quedaba marcada como pagada.
  paid: Boolean,
  paidAt: Date,
  paymentId: String
}, { _id: false });

const ExpeditionSchema = new mongoose.Schema({
  // Unique identifier
  expeditionId: {
    type: String,
    unique: true,
    default: function() {
      const year = new Date().getFullYear();
      return `EXP-${year}-${uuidv4().substring(0, 8).toUpperCase()}`;
    }
  },

  // Multi-tenancy
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  // Country for customs routing
  country: {
    type: String,
    enum: ['ES', 'NL', 'BE', 'DE', 'FR', 'PT', 'IT'],
    default: 'ES'
  },

  // NL-specific fields
  iossNumber: { type: String },
  nlCustomsOffice: { type: String },
  cvbReleaseId: { type: String },
  cvbStatus: { type: String, enum: ['pending', 'released', 'rejected', null] },

  // Operation type
  operationType: {
    type: String,
    enum: ['import', 'export', 'transit'],
    required: true
  },

  // Transport mode
  transportMode: {
    type: String,
    enum: ['maritime', 'air', 'road', 'rail', 'postal', 'multimodal'],
    required: true
  },

  // Status workflow
  status: {
    type: String,
    enum: [
      'draft',
      'pending_documents',
      'documents_received',
      'validating_documents',
      'documents_incomplete',
      'documents_validated',
      'classification_pending',
      'classification_done',
      'ready_for_declaration',
      'declaration_draft',
      'declaration_submitted',
      'green_channel',
      'yellow_channel', // canal H7 (bajo valor) con IVA pendiente
      'orange_channel',
      'red_channel',
      'levante',
      'completed',
      'cancelled',
      'on_hold'
    ],
    default: 'draft'
  },

  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Client (importer/exporter who contracts the service)
  client: {
    companyName: { type: String, required: true },
    tradeName: String,
    nif: { type: String, required: true },
    eori: String,
    address: AddressSchema,
    contact: ContactSchema,
    isRecurrent: { type: Boolean, default: false }
  },

  // Exporter (seller - for imports)
  exporter: {
    companyName: String,
    address: String,
    city: String,
    country: String,
    vatNumber: String
  },

  // Importer (buyer - for imports)
  importer: {
    companyName: String,
    nif: String,
    eori: String,
    address: AddressSchema,
    isDeclarant: { type: Boolean, default: false }
  },

  // Consignee (recipient)
  consignee: {
    companyName: String,
    nif: String,
    eori: String,
    address: AddressSchema
  },

  // Representative (customs agent)
  representative: {
    companyName: String,
    nif: String,
    eori: String,
    representationType: { type: String, enum: ['direct', 'indirect'] },
    authorizationNumber: String
  },

  // Goods/Merchandise
  goods: [GoodsItemSchema],

  // Total goods summary
  goodsSummary: {
    totalItems: { type: Number, default: 0 },
    totalPackages: { type: Number, default: 0 },
    totalGrossWeight: { type: Number, default: 0 },
    totalNetWeight: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 }
  },

  // Transport details
  transport: {
    carrier: String,
    carrierCountry: String,
    vehicleId: String, // License plate, flight number, vessel name
    vehicleNationality: String,
    borderTransportMode: String,
    inlandTransportMode: String,
    documentType: String, // BL, AWB, CMR
    documentNumber: String,
    departureDate: Date,
    arrivalDate: Date,
    departurePort: String,
    arrivalPort: String,
    entryCustomsOffice: String,
    loadingPlace: String,
    unloadingPlace: String,
    containers: [{
      number: String,
      type: String, // 20GP, 40GP, 40HC, etc.
      sealNumber: String,
      grossWeight: Number
    }]
  },

  // Trade terms
  incoterm: {
    code: String, // EXW, FOB, CIF, DAP, DDP, etc.
    place: String
  },

  // Documents
  documents: [DocumentSchema],

  // Document checklist
  documentChecklist: [ChecklistItemSchema],

  // Declaration (H1/AES)
  declaration: DeclarationSchema,

  // Financial calculations
  calculations: CalculationsSchema,

  // Client portal
  clientPortal: {
    token: {
      type: String,
      default: () => uuidv4()
    },
    accessUrl: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    viewCount: { type: Number, default: 0 },
    lastViewedAt: Date
  },

  // Communications
  communications: [{
    type: { type: String, enum: ['email', 'portal', 'system'] },
    subject: String,
    content: String,
    sentAt: Date,
    sentTo: String,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Timeline/Audit trail
  timeline: [TimelineEventSchema],

  // AI Analysis
  aiAnalysis: {
    classificationSuggestions: [{
      itemIndex: Number,
      suggestedTaricCode: String,
      confidence: Number,
      reasoning: String
    }],
    riskFlags: [{
      type: { type: String }, // `type` es clave reservada: sin envolver, Mongoose
      // colapsaba cada elemento a un SchemaString ([String]) y guardar los flags
      // como objetos {type,severity,description} (lo que hace aiAnalyzeRisk al
      // detectar criticalIssues) reventaba con CastError -> HTTP 500.
      severity: String, // low, medium, high
      description: String
    }],
    recommendations: [String],
    documentValidation: mongoose.Schema.Types.Mixed,
    // channelPrediction/declarationAnalysis: los escriben aiPredictChannel y
    // aiFullDeclarationAnalysis. Sin declararlos, el objeto estricto los
    // descartaba y getAiDeclarationAnalysis devolvia siempre hasAnalysis=false
    // aunque el analisis IA ya se hubiera ejecutado (y facturado a Bedrock).
    channelPrediction: mongoose.Schema.Types.Mixed,
    declarationAnalysis: mongoose.Schema.Types.Mixed,
    // Mismo patron para los analisis IA del expedienteController: sin declarar
    // estos campos, el objeto estricto los descartaba al guardar y getAiAnalysis
    // nunca podia recuperar el resultado (facturado a Bedrock) -> el analisis se
    // perdia tras responder al cliente una sola vez.
    documentSuggestions: mongoose.Schema.Types.Mixed,
    riskAnalysis: mongoose.Schema.Types.Mixed,
    inconsistencies: mongoose.Schema.Types.Mixed,
    fullAnalysis: mongoose.Schema.Types.Mixed,
    lastAnalysisAt: Date
  },

  // Notes
  internalNotes: String,
  clientNotes: String,

  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Reference numbers
  clientReference: String,
  supplierReference: String,

  // Dates
  estimatedArrival: Date,
  actualArrival: Date,
  completedAt: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true
});

// Indexes
ExpeditionSchema.index({ expeditionId: 1 });
ExpeditionSchema.index({ 'client.nif': 1 });
ExpeditionSchema.index({ 'client.companyName': 'text' });
ExpeditionSchema.index({ status: 1, createdAt: -1 });
ExpeditionSchema.index({ operationType: 1 });
ExpeditionSchema.index({ 'clientPortal.token': 1 });
ExpeditionSchema.index({ assignedTo: 1, status: 1 });
ExpeditionSchema.index({ createdAt: -1 });

// Virtual for portal URL
ExpeditionSchema.virtual('portalUrl').get(function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  return `${baseUrl}/portal/${this.clientPortal.token}`;
});

// Virtual for document completion percentage
ExpeditionSchema.virtual('documentCompletion').get(function() {
  if (!this.documentChecklist || this.documentChecklist.length === 0) return 0;
  const required = this.documentChecklist.filter(d => d.required);
  if (required.length === 0) return 100;
  const received = required.filter(d => d.received).length;
  return Math.round((received / required.length) * 100);
});

// Pre-save middleware
ExpeditionSchema.pre('save', function(next) {
  // Update goods summary
  if (this.goods && this.goods.length > 0) {
    this.goodsSummary = {
      totalItems: this.goods.length,
      totalPackages: this.goods.reduce((sum, g) => sum + (g.packages?.quantity || 0), 0),
      totalGrossWeight: this.goods.reduce((sum, g) => sum + (g.grossWeight || 0), 0),
      totalNetWeight: this.goods.reduce((sum, g) => sum + (g.netWeight || 0), 0),
      totalValue: this.goods.reduce((sum, g) => sum + (g.invoiceValue || 0), 0)
    };
  }
  next();
});

// Methods
ExpeditionSchema.methods.addTimelineEvent = function(action, description, userId, metadata = {}) {
  this.timeline.push({
    action,
    description,
    userId,
    performedBy: userId ? 'user' : 'system',
    metadata
  });
  return this.save();
};

ExpeditionSchema.methods.updateStatus = function(newStatus, userId) {
  const oldStatus = this.status;
  this.status = newStatus;
  return this.addTimelineEvent(
    'status_change',
    `Estado cambiado de ${oldStatus} a ${newStatus}`,
    userId,
    { oldStatus, newStatus }
  );
};

ExpeditionSchema.methods.generateDocumentChecklist = function() {
  const checklists = require('../utils/documentChecklists');
  const checklist = checklists.getChecklist(this.operationType, this.transportMode, this.goods);
  this.documentChecklist = checklist;
  return this.save();
};

// Statics
ExpeditionSchema.statics.findByPortalToken = function(token) {
  return this.findOne({ 'clientPortal.token': token, 'clientPortal.isActive': true });
};

ExpeditionSchema.statics.findByClient = function(nif) {
  return this.find({ 'client.nif': nif }).sort({ createdAt: -1 });
};

ExpeditionSchema.statics.getStats = async function(userId = null, tenantId = null) {
  // Sin tenantId, un admin agregaba las expediciones de TODOS los clientes:
  // el match vacio no acota nada.
  const match = {};
  if (userId) match.assignedTo = userId;
  if (tenantId) match.tenantId = tenantId;

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return stats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {});
};

require('../utils/softDelete')(ExpeditionSchema);

module.exports = mongoose.model('Expedition', ExpeditionSchema);
