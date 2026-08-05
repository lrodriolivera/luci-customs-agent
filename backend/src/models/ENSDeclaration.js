/**
 * ENSDeclaration Model
 * Declaracion Sumaria de Entrada (Entry Summary Declaration) - ICS2 Release 3
 *
 * Aplicable a:
 * - Envios por carretera (ROAD)
 * - Envios por ferrocarril (RAIL)
 * - Envios por via aerea (AIR) - Release 2
 * - Envios maritimos (SEA) - Release 3
 *
 * Normativa: Reglamento (UE) 2019/1896 - ICS2 (Import Control System 2)
 */
const mongoose = require('mongoose');

// Esquema de direccion
const AddressSchema = new mongoose.Schema({
  streetAndNumber: String,
  city: String,
  postalCode: String,
  country: {
    type: String,
    match: /^[A-Z]{2}$/
  }
}, { _id: false });

// Esquema de parte (consignor/consignee)
const PartySchema = new mongoose.Schema({
  eori: String,
  name: {
    type: String,
    required: true
  },
  address: AddressSchema,
  contactPerson: String,
  phone: String,
  email: String
}, { _id: false });

// Esquema de item de mercancia
const GoodsItemSchema = new mongoose.Schema({
  sequenceNumber: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    required: true,
    maxlength: 512
  },
  // Codigo HS/TARIC (minimo 6 digitos para ENS)
  commodityCode: {
    type: String,
    required: true,
    match: /^\d{6,10}$/
  },
  // Cantidad y unidad
  quantity: {
    type: Number,
    min: 0
  },
  unitOfMeasure: {
    type: String,
    default: 'KGM',
    enum: ['KGM', 'PCE', 'MTR', 'LTR', 'M2', 'M3', 'PAR', 'SET', 'TNE']
  },
  // Peso bruto en kg
  grossMass: {
    type: Number,
    required: true,
    min: 0.001
  },
  // Pais de origen
  countryOfOrigin: {
    type: String,
    match: /^[A-Z]{2}$/
  },
  // Documentos asociados a este item
  documents: [{
    type: {
      type: String,
      enum: ['N380', 'N714', 'N722', 'N730', 'N785', 'OTHER'] // Invoice, B/L, CMR, etc.
    },
    reference: String,
    issuedAt: Date
  }],
  // Marcas y numeros de los bultos
  marksAndNumbers: String,
  // Numero de bultos
  numberOfPackages: Number,
  // Tipo de embalaje
  kindOfPackages: String,
  // UCR - Unique Consignment Reference
  ucr: String
}, { _id: false });

// Esquema de house consignment (grupaje)
const HouseConsignmentSchema = new mongoose.Schema({
  sequenceNumber: {
    type: Number,
    required: true,
    min: 1
  },
  // Referencia del house (HBL, HAWB)
  referenceNumber: {
    type: String,
    required: true
  },
  // Consignor (expedidor) del house
  consignor: PartySchema,
  // Consignee (destinatario) del house
  consignee: PartySchema,
  // Notificar a
  notifyParty: PartySchema,
  // Mercancias en este house
  goods: [GoodsItemSchema],
  // Peso bruto total del house
  grossMass: Number,
  // Total de bultos en el house
  numberOfPackages: Number,
  // Valor declarado
  declaredValue: Number,
  // Moneda
  currency: {
    type: String,
    default: 'EUR',
    match: /^[A-Z]{3}$/
  }
}, { _id: false });

// Esquema de decision de control
const ControlDecisionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  description: String,
  requestedAt: Date,
  deadline: Date,
  status: {
    type: String,
    enum: ['pending', 'complied', 'expired'],
    default: 'pending'
  }
}, { _id: false });

// Esquema principal ENSDeclaration
const ENSDeclarationSchema = new mongoose.Schema({
  // Multi-tenancy
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // Referencia unica interna
  reference: {
    type: String,
    unique: true,
    sparse: true
  },

  // MRN asignado por AEAT
  mrn: {
    type: String,
    sparse: true
  },

  // LRN - Local Reference Number (referencia del declarante)
  lrn: {
    type: String,
    required: true
  },

  // Usuario que crea la declaracion
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // === TIPO DE DECLARACION ===

  declarationType: {
    type: String,
    enum: ['ENS', 'ENS_AMENDMENT', 'ENS_ARRIVALS'],
    default: 'ENS'
  },

  // Modo de transporte
  transportMode: {
    type: String,
    required: true,
    enum: ['ROAD', 'RAIL', 'AIR', 'SEA']
  },

  // === ADUANA DE ENTRADA ===

  entryOffice: {
    // Codigo de aduana (formato ES0028XX)
    code: {
      type: String,
      required: true,
      match: /^[A-Z]{2}\d{6}$/
    },
    name: String,
    // Fecha/hora esperada de llegada
    expectedArrival: {
      type: Date,
      required: true
    }
  },

  // === TRANSPORTISTA / CARRIER ===

  carrier: {
    eori: {
      type: String,
      required: true,
      match: /^[A-Z]{2}\w{1,15}$/
    },
    name: {
      type: String,
      required: true
    },
    address: AddressSchema
  },

  // === MEDIO DE TRANSPORTE ===

  transportMeans: {
    // Identificacion del medio (matricula camion, numero tren, vuelo, buque)
    identification: {
      type: String,
      required: true
    },
    // Tipo de identificacion
    identificationType: {
      type: String,
      enum: ['VEHICLE_REGISTRATION', 'TRAIN_NUMBER', 'FLIGHT_NUMBER', 'VESSEL_IMO', 'VESSEL_NAME'],
      required: true
    },
    // Nacionalidad del medio de transporte
    nationality: {
      type: String,
      match: /^[A-Z]{2}$/
    },
    // Modo en frontera
    modeAtBorder: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '7', '8', '9'], // 1=Sea, 2=Rail, 3=Road, 4=Air, etc.
      required: true
    }
  },

  // === CONSIGNMENT (Envio principal) ===

  consignment: {
    // Numero de referencia (Master B/L, CMR, CIM)
    referenceNumber: {
      type: String,
      required: true
    },
    // Tipo de referencia
    referenceType: {
      type: String,
      enum: ['MBL', 'MAWB', 'CMR', 'CIM', 'OTHER'],
      default: 'CMR'
    },
    // Numero de contenedor (si aplica)
    containerNumber: String,
    // Numero de precinto
    sealNumber: String,
    // Peso bruto total
    grossMass: {
      type: Number,
      required: true,
      min: 0
    },
    // Numero total de bultos
    numberOfPackages: {
      type: Number,
      required: true,
      min: 1
    },
    // Descripcion general de mercancias
    goodsDescription: {
      type: String,
      required: true,
      maxlength: 512
    },
    // Pais de expedicion
    countryOfDispatch: {
      type: String,
      match: /^[A-Z]{2}$/
    },
    // Pais de destino
    countryOfDestination: {
      type: String,
      default: 'ES',
      match: /^[A-Z]{2}$/
    },
    // UCR
    ucr: String
  },

  // === CONSIGNOR (Expedidor a nivel master) ===

  consignor: PartySchema,

  // === CONSIGNEE (Destinatario a nivel master) ===

  consignee: PartySchema,

  // === HOUSE CONSIGNMENTS (Para grupaje) ===

  houseConsignments: {
    type: [HouseConsignmentSchema],
    default: [],
    validate: {
      validator: function(houses) {
        return houses.length <= 999;
      },
      message: 'Maximo 999 house consignments permitidos'
    }
  },

  // === MERCANCIAS (Si no hay houses) ===

  goods: [GoodsItemSchema],

  // === ANALISIS DE RIESGO ===

  riskAssessment: {
    // Estado del analisis
    status: {
      type: String,
      enum: ['PENDING', 'DNL', 'HOLD', 'ACK', 'CLEARED'],
      default: 'PENDING'
    },
    // Decisiones de control
    controlDecisions: [ControlDecisionSchema],
    // DNL - Do Not Load
    doNotLoadList: {
      type: Boolean,
      default: false
    },
    // Motivo DNL
    dnlReason: String,
    // Fecha de analisis
    assessedAt: Date,
    // Puntuacion de riesgo (0-100)
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    }
  },

  // === ESTADO ===

  status: {
    type: String,
    enum: [
      'draft',           // Borrador
      'validated',       // Validada localmente
      'submitted',       // Enviada a AEAT
      'accepted',        // Aceptada por AEAT
      'rejected',        // Rechazada por AEAT
      'amendment_pending', // Rectificacion pendiente
      'amended',         // Rectificada
      'arrived',         // Llegada notificada
      'released',        // Levante concedido
      'dnl',            // Do Not Load emitido
      'cancelled'       // Anulada
    ],
    default: 'draft'
  },

  // Fecha de presentacion
  submittedAt: Date,

  // === RESPUESTA DE AEAT ===

  aeatResponse: {
    code: String,
    message: String,
    timestamp: Date,
    correlationId: String,
    errors: [{
      field: String,
      code: String,
      message: String
    }]
  },

  // === LLEGADA ===

  arrival: {
    notifiedAt: Date,
    actualArrival: Date,
    presentationOffice: {
      code: String,
      name: String
    },
    unloadingPlace: String
  },

  // === RECTIFICACION ===

  amendment: {
    originalMRN: String,
    amendmentReason: String,
    amendmentDetails: String,
    requestedAt: Date,
    processedAt: Date
  },

  // Resultado de la rectificacion IE313 que escribe ensController.amend tras el
  // envio a AEAT (aeatSubmitService.submitENSAmendment). Sin declararlos, el
  // esquema estricto los descartaba silenciosamente: la ENS quedaba en estado
  // 'amended' pero SIN el MRN oficial devuelto por la enmienda ni la fecha, de
  // modo que se perdia la referencia AEAT resultante de la rectificacion.
  amendmentMRN: String,
  amendedAt: Date,

  // === DOCUMENTOS ADJUNTOS ===

  documents: [{
    type: {
      type: String,
      enum: ['CMR', 'BL', 'AWB', 'INVOICE', 'PACKING_LIST', 'CERTIFICATE', 'OTHER']
    },
    documentNumber: String,
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // === NOTAS Y HISTORIAL ===

  notes: [{
    text: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    aeatCode: String
  }],

  // XML generado
  generatedXML: String,

  // Expediente asociado (opcional)
  expedition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  }

}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indices
ENSDeclarationSchema.index({ reference: 1 });
ENSDeclarationSchema.index({ mrn: 1 });
ENSDeclarationSchema.index({ lrn: 1 });
ENSDeclarationSchema.index({ status: 1, createdAt: -1 });
ENSDeclarationSchema.index({ 'carrier.eori': 1 });
ENSDeclarationSchema.index({ 'consignment.containerNumber': 1 });
ENSDeclarationSchema.index({ 'consignment.referenceNumber': 1 });
ENSDeclarationSchema.index({ 'entryOffice.code': 1 });
ENSDeclarationSchema.index({ 'entryOffice.expectedArrival': 1 });
ENSDeclarationSchema.index({ transportMode: 1 });
ENSDeclarationSchema.index({ createdBy: 1, createdAt: -1 });
ENSDeclarationSchema.index({ 'riskAssessment.status': 1 });

// Generar referencia automatica
ENSDeclarationSchema.pre('save', async function(next) {
  if (!this.reference) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: new Date(year, 0, 1) }
    });
    this.reference = `ENS-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  // Generar LRN si no existe
  if (!this.lrn) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.lrn = `LUCI${timestamp}${random}`;
  }

  // Registrar cambio de estado
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  next();
});

// Metodo de instancia: Validar ENS antes de envio
ENSDeclarationSchema.methods.validateForSubmission = function() {
  const errors = [];

  // Validar carrier EORI
  if (!this.carrier || !this.carrier.eori) {
    errors.push({
      field: 'carrier.eori',
      code: 'ENS_CARRIER_REQUIRED',
      message: 'EORI del transportista es obligatorio'
    });
  }

  // Validar aduana de entrada
  if (!this.entryOffice || !this.entryOffice.code) {
    errors.push({
      field: 'entryOffice.code',
      code: 'ENS_ENTRY_OFFICE_REQUIRED',
      message: 'Aduana de entrada es obligatoria'
    });
  }

  // Validar fecha de llegada
  if (!this.entryOffice?.expectedArrival) {
    errors.push({
      field: 'entryOffice.expectedArrival',
      code: 'ENS_ARRIVAL_DATE_REQUIRED',
      message: 'Fecha esperada de llegada es obligatoria'
    });
  } else {
    const now = new Date();
    const arrival = new Date(this.entryOffice.expectedArrival);
    if (arrival <= now) {
      errors.push({
        field: 'entryOffice.expectedArrival',
        code: 'ENS_ARRIVAL_DATE_PAST',
        message: 'Fecha de llegada debe ser futura'
      });
    }
  }

  // Validar consignment
  if (!this.consignment?.referenceNumber) {
    errors.push({
      field: 'consignment.referenceNumber',
      code: 'ENS_REFERENCE_REQUIRED',
      message: 'Numero de referencia del envio es obligatorio'
    });
  }

  // Validar peso
  if (!this.consignment?.grossMass || this.consignment.grossMass <= 0) {
    errors.push({
      field: 'consignment.grossMass',
      code: 'ENS_GROSS_MASS_REQUIRED',
      message: 'Peso bruto debe ser mayor que 0'
    });
  }

  // Validar bultos
  if (!this.consignment?.numberOfPackages || this.consignment.numberOfPackages < 1) {
    errors.push({
      field: 'consignment.numberOfPackages',
      code: 'ENS_PACKAGES_REQUIRED',
      message: 'Numero de bultos debe ser al menos 1'
    });
  }

  // Validar descripcion
  if (!this.consignment?.goodsDescription) {
    errors.push({
      field: 'consignment.goodsDescription',
      code: 'ENS_DESCRIPTION_REQUIRED',
      message: 'Descripcion de mercancias es obligatoria'
    });
  }

  // Validar medio de transporte
  if (!this.transportMeans?.identification) {
    errors.push({
      field: 'transportMeans.identification',
      code: 'ENS_TRANSPORT_REQUIRED',
      message: 'Identificacion del medio de transporte es obligatoria'
    });
  }

  // Validar que haya mercancias o houses
  if (this.houseConsignments.length === 0 && this.goods.length === 0) {
    errors.push({
      field: 'goods',
      code: 'ENS_GOODS_REQUIRED',
      message: 'Debe incluir mercancias o house consignments'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Metodo: Calcular totales
ENSDeclarationSchema.methods.calculateTotals = function() {
  let totalGrossMass = 0;
  let totalPackages = 0;

  if (this.houseConsignments.length > 0) {
    for (const house of this.houseConsignments) {
      totalGrossMass += house.grossMass || 0;
      totalPackages += house.numberOfPackages || 0;
    }
  } else if (this.goods.length > 0) {
    for (const item of this.goods) {
      totalGrossMass += item.grossMass || 0;
      totalPackages += item.numberOfPackages || 0;
    }
  }

  this.consignment.grossMass = totalGrossMass || this.consignment.grossMass;
  this.consignment.numberOfPackages = totalPackages || this.consignment.numberOfPackages;

  return {
    grossMass: this.consignment.grossMass,
    numberOfPackages: this.consignment.numberOfPackages
  };
};

// Metodo estatico: Obtener estadisticas
ENSDeclarationSchema.statics.getStats = async function(filters = {}) {
  const match = {};

  if (filters.startDate || filters.endDate) {
    match.createdAt = {};
    if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
  }

  if (filters.transportMode) match.transportMode = filters.transportMode;
  if (filters.createdBy) match.createdBy = new mongoose.Types.ObjectId(filters.createdBy);

  const byStatus = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalWeight: { $sum: '$consignment.grossMass' },
        totalPackages: { $sum: '$consignment.numberOfPackages' }
      }
    }
  ]);

  const byTransportMode = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$transportMode',
        count: { $sum: 1 },
        totalWeight: { $sum: '$consignment.grossMass' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const byRiskStatus = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$riskAssessment.status',
        count: { $sum: 1 }
      }
    }
  ]);

  const byEntryOffice = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$entryOffice.code',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  return {
    byStatus,
    byTransportMode,
    byRiskStatus,
    byEntryOffice,
    totals: {
      declarations: byStatus.reduce((acc, s) => acc + s.count, 0),
      weight: byStatus.reduce((acc, s) => acc + s.totalWeight, 0),
      packages: byStatus.reduce((acc, s) => acc + s.totalPackages, 0)
    }
  };
};

// Metodo estatico: Buscar por contenedor
ENSDeclarationSchema.statics.findByContainer = async function(containerNumber) {
  return this.find({
    'consignment.containerNumber': { $regex: containerNumber, $options: 'i' }
  }).sort({ createdAt: -1 });
};

// Metodo estatico: Buscar por conocimiento
ENSDeclarationSchema.statics.findByBillOfLading = async function(bol) {
  return this.find({
    $or: [
      { 'consignment.referenceNumber': { $regex: bol, $options: 'i' } },
      { 'houseConsignments.referenceNumber': { $regex: bol, $options: 'i' } }
    ]
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('ENSDeclaration', ENSDeclarationSchema);
