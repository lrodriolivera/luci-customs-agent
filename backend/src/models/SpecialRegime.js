/**
 * SpecialRegime Model
 * Gestiona los regimenes aduaneros especiales segun el CAU (Codigo Aduanero de la Union)
 *
 * Regimenes soportados:
 * - 51: Perfeccionamiento Activo (Inward Processing)
 * - 53: Importacion Temporal (Temporary Admission)
 * - 71: Deposito Aduanero (Customs Warehousing)
 * - T1/T2: Transito (Transit)
 *
 * Referencia: Reglamento (UE) 952/2013 - Articulos 210-262
 */
const mongoose = require('mongoose');
// Contador atomico: el patron countDocuments()+1 reutilizaba referencias vivas
// tras un borrado (E11000) y repartia el mismo numero en altas concurrentes.
const { nextReference } = require('../utils/sequence');

// Esquema de mercancia bajo regimen
const RegimeGoodsSchema = new mongoose.Schema({
  // Descripcion de la mercancia
  description: {
    type: String,
    required: true
  },

  // Codigo TARIC
  taricCode: {
    type: String,
    required: true,
    match: /^\d{8,10}$/
  },

  // Cantidad
  quantity: {
    type: Number,
    required: true,
    min: 0
  },

  // Unidad de medida
  unitOfMeasure: {
    type: String,
    default: 'KGM',
    enum: ['KGM', 'PCE', 'LTR', 'MTR', 'M2', 'M3', 'PAR', 'SET', 'GRM']
  },

  // Peso neto (kg)
  netWeight: {
    type: Number,
    required: true,
    min: 0
  },

  // Peso bruto (kg)
  grossWeight: Number,

  // Valor en aduana
  customsValue: {
    type: Number,
    required: true,
    min: 0
  },

  // Pais de origen
  countryOfOrigin: {
    type: String,
    match: /^[A-Z]{2}$/
  },

  // Derechos suspendidos (calculados)
  suspendedDuties: {
    tariff: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    excise: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },

  // Para regimen 51: productos obtenidos
  processedProducts: [{
    description: String,
    taricCode: String,
    quantity: Number,
    yieldRate: Number  // Tasa de rendimiento
  }]
});

// Esquema principal de Regimen Especial
const SpecialRegimeSchema = new mongoose.Schema({
  // Referencia unica
  reference: {
    type: String,
    unique: true,
    sparse: true
  },

  // Expediente asociado
  expedition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  },

  // Usuario propietario
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // === TIPO DE REGIMEN ===

  regimeCode: {
    type: String,
    required: true,
    enum: ['51', '53', '71', 'T1', 'T2', 'TIR']
  },

  regimeType: {
    type: String,
    required: true,
    enum: [
      'inward_processing',     // 51 - Perfeccionamiento activo
      'temporary_admission',   // 53 - Importacion temporal
      'customs_warehouse',     // 71 - Deposito aduanero
      'external_transit',      // T1 - Transito externo
      'internal_transit',      // T2 - Transito interno
      'tir_transit'            // TIR - Transito internacional
    ]
  },

  // Subtipo especifico
  subType: {
    type: String,
    enum: [
      // Perfeccionamiento Activo
      'standard_ip',           // Perfeccionamiento estandar
      'prior_export_ip',       // Exportacion anticipada (EX/IM)

      // Importacion Temporal
      'total_relief',          // Exencion total de derechos
      'partial_relief',        // Exencion parcial (3% mensual)

      // Deposito Aduanero
      'public_warehouse',      // Deposito publico
      'private_warehouse_i',   // Deposito privado tipo I
      'private_warehouse_ii',  // Deposito privado tipo II
      'private_warehouse_iii', // Deposito privado tipo III

      // Transito
      'normal_transit',        // Transito normal
      'simplified_transit'     // Transito simplificado
    ]
  },

  // === AUTORIZACION ===

  authorization: {
    // Numero de autorizacion AEAT
    number: String,

    // Fecha de autorizacion
    date: Date,

    // Fecha de vencimiento
    expiryDate: Date,

    // Oficina de control
    controlOffice: String,

    // Titular de la autorizacion
    holder: {
      name: String,
      eori: String,
      address: String
    },

    // Condiciones especiales
    conditions: [String]
  },

  // === MERCANCIAS ===

  goods: [RegimeGoodsSchema],

  // === OPERADORES ===

  // Declarante
  declarant: {
    name: String,
    eori: String,
    address: String,
    representativeType: {
      type: String,
      enum: ['direct', 'indirect']
    }
  },

  // Titular del regimen (puede ser diferente al declarante)
  holder: {
    name: String,
    eori: String,
    address: String
  },

  // === UBICACIONES ===

  // Aduana de entrada
  entryCustomsOffice: {
    code: String,
    name: String
  },

  // Aduana de salida (para transito)
  exitCustomsOffice: {
    code: String,
    name: String
  },

  // Lugar de almacenamiento/procesamiento
  premises: {
    code: String,
    name: String,
    address: String,
    type: {
      type: String,
      enum: ['warehouse', 'factory', 'temporary_storage', 'other']
    }
  },

  // === PLAZOS ===

  // Fecha de inicio del regimen
  startDate: {
    type: Date,
    required: true
  },

  // Fecha limite de ultimacion
  deadlineDate: {
    type: Date,
    required: true
  },

  // Fecha de ultimacion real
  dischargeDate: Date,

  // Duracion en meses
  durationMonths: {
    type: Number,
    default: 12
  },

  // Prorrogas concedidas
  extensions: [{
    requestDate: Date,
    grantedDate: Date,
    newDeadline: Date,
    reason: String,
    approvedBy: String
  }],

  // === GARANTIA ===

  guarantee: {
    // Referencia a garantia
    guaranteeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guarantee'
    },
    // GRN
    grn: String,
    // Importe afectado
    amount: { type: Number, default: 0 },
    // Estado
    status: {
      type: String,
      enum: ['pending', 'active', 'released', 'executed'],
      default: 'pending'
    }
  },

  // === VALORES ===

  totals: {
    // Valor en aduana total
    customsValue: { type: Number, default: 0 },
    // Derechos suspendidos
    suspendedDuties: { type: Number, default: 0 },
    // IVA suspendido
    suspendedVAT: { type: Number, default: 0 },
    // Impuestos especiales suspendidos
    suspendedExcise: { type: Number, default: 0 },
    // Total garantizado
    totalGuaranteed: { type: Number, default: 0 }
  },

  // === ESTADO ===

  status: {
    type: String,
    enum: [
      'draft',           // Borrador
      'pending',         // Pendiente de autorizacion
      'authorized',      // Autorizado
      'active',          // En curso
      'suspended',       // Suspendido
      'discharged',      // Ultimado
      'cancelled',       // Cancelado
      'expired'          // Vencido sin ultimar
    ],
    default: 'draft'
  },

  // === ULTIMACION (Discharge) ===

  discharge: {
    // Tipo de ultimacion
    type: {
      type: String,
      enum: [
        'reexport',              // Reexportacion
        'release_free_circulation', // Despacho a libre practica
        'transfer_regime',       // Transferencia a otro regimen
        'destruction',           // Destruccion bajo control
        'abandonment',           // Abandono al Estado
        'entry_free_zone'        // Entrada en zona franca
      ]
    },
    // Referencia de la declaracion de ultimacion
    declarationRef: String,
    // MRN de ultimacion
    mrn: String,
    // Fecha
    date: Date,
    // Observaciones
    notes: String,
    // Documentos adjuntos
    documents: [{
      type: { type: String },
      name: String,
      url: String
    }]
  },

  // === PARA PERFECCIONAMIENTO ACTIVO (51) ===

  inwardProcessing: {
    // Operaciones de perfeccionamiento autorizadas
    authorizedOperations: [String],

    // Tasa de rendimiento
    yieldRate: {
      type: Number,
      min: 0,
      max: 100
    },

    // Metodo de calculo de rendimiento
    yieldMethod: {
      type: String,
      enum: ['standard', 'calculated', 'actual']
    },

    // Productos compensadores principales
    mainCompensatingProducts: [{
      description: String,
      taricCode: String,
      expectedQuantity: Number
    }],

    // Productos compensadores secundarios
    secondaryCompensatingProducts: [{
      description: String,
      taricCode: String,
      expectedQuantity: Number
    }],

    // Perdidas y desperdicios
    wasteLoss: {
      expectedPercent: Number,
      actualPercent: Number,
      justification: String
    },

    // Equivalencia de mercancias
    equivalence: {
      allowed: { type: Boolean, default: false },
      description: String
    }
  },

  // === PARA IMPORTACION TEMPORAL (53) ===

  temporaryAdmission: {
    // Finalidad del uso temporal
    purpose: {
      type: String,
      enum: [
        'exhibition',        // Ferias y exposiciones
        'professional_equipment', // Material profesional
        'samples',           // Muestras comerciales
        'containers',        // Contenedores y pallets
        'means_transport',   // Medios de transporte
        'personal_effects',  // Efectos personales
        'sporting_goods',    // Material deportivo
        'educational',       // Material pedagogico
        'medical',           // Material medico
        'disaster_relief',   // Ayuda humanitaria
        'other'
      ]
    },

    // Descripcion del uso previsto
    intendedUse: String,

    // Lugar de uso
    placeOfUse: String,

    // Si es exencion parcial, % de derechos mensuales
    monthlyDutyPercent: {
      type: Number,
      default: 3  // 3% mensual del total de derechos
    },

    // Derechos acumulados (para exencion parcial)
    accumulatedDuties: {
      type: Number,
      default: 0
    },

    // Reexportacion obligatoria
    mandatoryReexport: {
      type: Boolean,
      default: true
    }
  },

  // === PARA DEPOSITO ADUANERO (71) ===

  customsWarehouse: {
    // Tipo de deposito
    warehouseType: {
      type: String,
      enum: ['public', 'private_I', 'private_II', 'private_III']
    },

    // Codigo de deposito
    warehouseCode: String,

    // Operador del deposito
    warehouseOperator: {
      name: String,
      eori: String
    },

    // Manipulaciones autorizadas
    authorizedHandling: [String],

    // Manipulaciones realizadas
    handlingPerformed: [{
      date: Date,
      description: String,
      authorizedBy: String
    }],

    // Inventario actual
    currentInventory: {
      quantity: Number,
      lastUpdated: Date
    }
  },

  // === PARA TRANSITO (T1/T2) ===

  transit: {
    // Numero de transito MRN
    mrn: String,

    // Fecha limite de presentacion
    presentationDeadline: Date,

    // Ruta autorizada
    authorizedRoute: String,

    // Aduanas de paso
    transitOffices: [{
      code: String,
      name: String,
      country: String,
      expectedArrival: Date,
      actualArrival: Date
    }],

    // Precintos
    seals: [{
      number: String,
      type: { type: String, enum: ['customs', 'carrier', 'shipper'] },
      placedAt: String,
      intactOnArrival: Boolean
    }],

    // Medio de transporte
    meansOfTransport: {
      mode: { type: String, enum: ['road', 'rail', 'sea', 'air', 'multimodal'] },
      identity: String,  // Matricula, IMO, etc.
      nationality: String
    },

    // Incidencias durante transito
    incidents: [{
      date: Date,
      location: String,
      description: String,
      resolution: String
    }]
  },

  // === DOCUMENTOS ===

  documents: [{
    type: {
      type: String,
      enum: [
        'authorization',      // Autorizacion del regimen
        'entry_declaration',  // Declaracion de entrada
        'exit_declaration',   // Declaracion de salida
        'invoice',            // Factura
        'transport_doc',      // Documento de transporte
        'certificate',        // Certificados varios
        'guarantee_doc',      // Documento de garantia
        'processing_record',  // Registro de transformacion
        'inventory',          // Inventario
        'other'
      ]
    },
    name: String,
    reference: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // === HISTORIAL ===

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }],

  // Notas internas
  notes: [{
    text: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]

}, {
  timestamps: true
});

// Indices
SpecialRegimeSchema.index({ owner: 1, status: 1 });
SpecialRegimeSchema.index({ regimeCode: 1, status: 1 });
SpecialRegimeSchema.index({ 'authorization.number': 1 });
SpecialRegimeSchema.index({ expedition: 1 });
SpecialRegimeSchema.index({ deadlineDate: 1 });
SpecialRegimeSchema.index({ 'transit.mrn': 1 });

// Generar referencia automatica
SpecialRegimeSchema.pre('save', async function(next) {
  if (!this.reference) {
    const year = new Date().getFullYear();
    const prefix = {
      '51': 'IP',   // Inward Processing
      '53': 'TA',   // Temporary Admission
      '71': 'CW',   // Customs Warehouse
      'T1': 'T1',
      'T2': 'T2',
      'TIR': 'TIR'
    }[this.regimeCode] || 'SR';
    this.reference = await nextReference(this.constructor, 'reference', `${prefix}-${year}`, 5);
  }

  // Calcular totales
  this.calculateTotals();

  // Registrar cambio de estado
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  next();
});

// Calcular totales
SpecialRegimeSchema.methods.calculateTotals = function() {
  let customsValue = 0;
  let suspendedDuties = 0;
  let suspendedVAT = 0;
  let suspendedExcise = 0;

  for (const good of this.goods) {
    customsValue += good.customsValue || 0;
    suspendedDuties += good.suspendedDuties?.tariff || 0;
    suspendedVAT += good.suspendedDuties?.vat || 0;
    suspendedExcise += good.suspendedDuties?.excise || 0;
  }

  this.totals = {
    customsValue,
    suspendedDuties,
    suspendedVAT,
    suspendedExcise,
    totalGuaranteed: suspendedDuties + suspendedVAT + suspendedExcise
  };
};

// Verificar si esta dentro del plazo
SpecialRegimeSchema.methods.isWithinDeadline = function() {
  return new Date() <= this.deadlineDate;
};

// Dias restantes hasta ultimacion
SpecialRegimeSchema.methods.daysRemaining = function() {
  const now = new Date();
  const diff = this.deadlineDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Verificar si puede ser ultimado
SpecialRegimeSchema.methods.canBeDischarge = function() {
  return ['active', 'authorized'].includes(this.status);
};

// Metodos estaticos
SpecialRegimeSchema.statics.getExpiring = function(days = 30) {
  const now = new Date();
  const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return this.find({
    status: 'active',
    deadlineDate: { $lte: deadline, $gt: now }
  }).sort({ deadlineDate: 1 });
};

SpecialRegimeSchema.statics.getByRegimeType = function(ownerId, regimeCode) {
  return this.find({
    owner: ownerId,
    regimeCode,
    status: { $in: ['active', 'authorized'] }
  }).sort({ createdAt: -1 });
};

SpecialRegimeSchema.statics.getStats = async function(ownerId) {
  const regimes = await this.find({ owner: ownerId });

  const stats = {
    total: regimes.length,
    byRegime: {},
    byStatus: {},
    active: 0,
    expiringSoon: 0,
    totalSuspendedDuties: 0
  };

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const r of regimes) {
    // Por regimen
    stats.byRegime[r.regimeCode] = (stats.byRegime[r.regimeCode] || 0) + 1;

    // Por estado
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;

    if (r.status === 'active') {
      stats.active++;
      stats.totalSuspendedDuties += r.totals?.totalGuaranteed || 0;

      // Por expirar
      if (r.deadlineDate <= in30Days) {
        stats.expiringSoon++;
      }
    }
  }

  return stats;
};

module.exports = mongoose.model('SpecialRegime', SpecialRegimeSchema);
