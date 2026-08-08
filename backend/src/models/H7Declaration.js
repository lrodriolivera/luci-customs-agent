/**
 * H7Declaration Model
 * Declaracion simplificada H7 para envios de bajo valor (e-commerce)
 *
 * Aplicable a:
 * - Envios B2C con valor <= 150 EUR
 * - Importaciones via plataformas e-commerce
 * - Envios postales y de mensajeria express
 *
 * Regimen: IOSS (Import One-Stop Shop) para IVA prepagado
 */
const mongoose = require('mongoose');
// Reglamento (UE) 2026/382: derecho fijo transitorio 3 EUR/articulo (ver config).
const { REG_2026_382, aplicaDerechoFijo2026 } = require('../config/reg2026382');

// Esquema de articulo individual en el envio
const H7ItemSchema = new mongoose.Schema({
  // Descripcion del articulo
  description: {
    type: String,
    required: true,
    maxlength: 512
  },

  // Codigo TARIC (6-10 digitos)
  taricCode: {
    type: String,
    required: true,
    match: /^\d{6,10}$/
  },

  // Cantidad
  quantity: {
    type: Number,
    required: true,
    min: 1
  },

  // Unidad de medida
  unitOfMeasure: {
    type: String,
    default: 'PCE', // Pieces
    enum: ['PCE', 'KGM', 'MTR', 'LTR', 'M2', 'M3', 'PAR', 'SET']
  },

  // Valor unitario en EUR
  unitValue: {
    type: Number,
    required: true,
    min: 0
  },

  // Valor total del articulo
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },

  // Peso neto en kg
  netWeight: {
    type: Number,
    required: true,
    min: 0
  },

  // Pais de origen (ISO 3166-1 alpha-2)
  countryOfOrigin: {
    type: String,
    required: true,
    match: /^[A-Z]{2}$/
  },

  // URL del producto (opcional, para verificacion)
  productUrl: String,

  // SKU o referencia del vendedor
  sellerSku: String
});

// Esquema principal H7
const H7DeclarationSchema = new mongoose.Schema({
  // Multi-tenancy
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // Referencia unica
  reference: {
    type: String,
    unique: true,
    sparse: true
  },

  // Country and customs system
  country: { type: String, enum: ['ES', 'NL'], default: 'ES' },
  customsOffice: { type: String },
  destinationCountry: { type: String, default: 'ES' },
  customsSystem: { type: String, enum: ['AEAT', 'DECO'], default: 'AEAT' },

  // === DOCUMENTO PREVIO G4 (obligatorio aereos desde 9/Mar/2026) ===
  // Ref: AEAT ADU-F-37/26, ADU-F-42/26 - Cierre DSDT aereas
  documentoPrevio: {
    tipo: { type: String, enum: ['N337', '5025', ''], default: '' },  // N337=G4 deposito temporal, 5025=PreH7 desde G3
    referencia: { type: String, default: '' },                         // MRN del G4 o referencia G3
    descripcion: { type: String, default: '' },                        // Descripcion libre
  },

  // === GARANTIA ===
  garantiaGRN: { type: String, default: '' },  // Jose Antonio: 26ESAGL2800000054

  // NL correction workflow
  correctionRequired: { type: Boolean, default: false },
  correctionDeadline: { type: Date },
  correctionHistory: [{
    errorCode: String,
    errorDescription: String,
    submittedAt: Date,
    resolvedAt: Date
  }],

  // Expediente asociado (opcional)
  expedition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  },

  // Usuario que crea la declaracion
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // === DATOS DEL ENVIO ===

  // Tipo de operacion
  operationType: {
    type: String,
    enum: ['B2C', 'C2C', 'B2B_LOW_VALUE'],
    default: 'B2C'
  },

  // Numero de tracking/AWB
  trackingNumber: {
    type: String,
    required: true,
    index: true
  },

  // Transportista
  carrier: {
    code: {
      type: String,
      required: true,
      enum: ['CORREOS', 'DHL', 'UPS', 'FEDEX', 'TNT', 'GLS', 'SEUR', 'MRW', 'AMAZON', 'OTHER']
    },
    name: String,
    eori: String
  },

  // === DATOS IOSS/IVA ===

  // Numero IOSS (Import One-Stop Shop)
  iossNumber: {
    type: String,
    match: /^IM\d{10}$/,  // Formato: IM + 10 digitos
    sparse: true
  },

  // Si tiene IOSS, el IVA ya esta pagado
  vatPrepaid: {
    type: Boolean,
    default: false
  },

  // Reglamento (UE) 2026/382: se aplico el derecho fijo transitorio de 3 EUR/articulo
  aplicarDerechoFijo2026: {
    type: Boolean,
    default: false
  },

  // Plataforma e-commerce (si aplica IOSS)
  ecommercePlatform: {
    type: String,
    enum: ['AMAZON', 'EBAY', 'ALIEXPRESS', 'WISH', 'SHEIN', 'TEMU', 'OTHER', null]
  },

  // === REMITENTE (Vendedor) ===

  sender: {
    name: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: {
        type: String,
        required: true,
        match: /^[A-Z]{2}$/
      }
    },
    eori: String,
    vatNumber: String,
    email: String,
    phone: String
  },

  // === DESTINATARIO (Comprador) ===

  recipient: {
    name: {
      type: String,
      required: true
    },
    // NIF/NIE del destinatario (opcional - particulares sin NIF = ImportadorParticular 'P')
    taxId: {
      type: String,
      default: ''
    },
    address: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      postalCode: {
        type: String,
        required: true
      },
      province: String,
      country: {
        type: String,
        default: 'ES',
        match: /^[A-Z]{2}$/
      }
    },
    email: String,
    phone: String
  },

  // === ARTICULOS ===

  items: {
    type: [H7ItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0 && items.length <= 99;
      },
      message: 'Debe tener entre 1 y 99 articulos'
    }
  },

  // === VALORES TOTALES ===

  totals: {
    // Valor intrinseco de la mercancia (sin transporte ni seguro)
    intrinsicValue: {
      type: Number,
      required: true,
      max: 150  // Limite H7
    },

    // Gastos de transporte
    shippingCost: {
      type: Number,
      default: 0
    },

    // Seguro
    insuranceCost: {
      type: Number,
      default: 0
    },

    // Valor en aduana (CIF)
    customsValue: {
      type: Number,
      required: true
    },

    // Moneda original
    originalCurrency: {
      type: String,
      default: 'EUR',
      match: /^[A-Z]{3}$/
    },

    // Tipo de cambio aplicado
    exchangeRate: {
      type: Number,
      default: 1
    },

    // Peso bruto total en kg
    grossWeight: {
      type: Number,
      required: true,
      min: 0.001
    },

    // Peso neto total en kg
    netWeight: {
      type: Number,
      required: true,
      min: 0.001
    },

    // Numero de bultos
    packages: {
      type: Number,
      default: 1,
      min: 1
    }
  },

  // === LIQUIDACION ===

  duties: {
    // Arancel (0% para la mayoria de envios B2C bajo 150 EUR)
    tariff: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },

    // IVA
    vat: {
      rate: { type: Number, default: 21 },  // 21% en Espana
      amount: { type: Number, default: 0 },
      prepaid: { type: Boolean, default: false }  // Si ya pagado via IOSS
    },

    // Tasa de gestion postal (si aplica)
    handlingFee: {
      type: Number,
      default: 0
    },

    // Total a pagar
    totalDue: {
      type: Number,
      default: 0
    }
  },

  // === ESTADO Y PROCESO ===

  status: {
    type: String,
    enum: [
      'draft',           // Borrador
      'validating',      // Validando datos
      'pending',         // Pendiente de envio
      'submitted',       // Enviada a aduanas
      'accepted',        // Aceptada (levante automatico)
      'held',            // Retenida para revision
      'rejected',        // Rechazada
      'released',        // Levante concedido
      'delivered',       // Entregada al destinatario
      'returned',        // Devuelta a origen
      'cancelled'        // Cancelada
    ],
    default: 'draft'
  },

  // MRN asignado por AEAT
  mrn: {
    type: String,
    sparse: true,
    // MRN AEAT: AA + ES + resto alfanumerico (18 chars). El H7 real llega como
    // 26ESH7A000067964R6 (el tipo 'H7' va tras ES, no al final): la regex anterior
    // (\d{14}H7$) lo rechazaba. Se valida el prefijo de pais y la longitud.
    match: /^\d{2}ES[A-Z0-9]{14}$/
  },

  // Fecha de presentacion
  submittedAt: Date,

  // Fecha de levante
  releasedAt: Date,

  // Canal/circuito asignado por AEAT
  channel: {
    type: String,
    enum: ['green', 'yellow', 'orange', 'red']
  },

  // Respuesta de AEAT
  aeatResponse: {
    code: String,
    message: String,
    timestamp: Date,
    csv: String,
    channel: String,
    errors: [{
      field: String,
      code: String,
      message: String
    }]
  },

  // === VALIDACIONES ===

  validations: {
    // Validacion de IOSS
    iossValid: {
      checked: { type: Boolean, default: false },
      valid: Boolean,
      checkedAt: Date
    },

    // Validacion de valor (anti-fraude)
    valueCheck: {
      checked: { type: Boolean, default: false },
      flagged: Boolean,
      reason: String,
      checkedAt: Date
    },

    // Validacion de clasificacion
    classificationCheck: {
      checked: { type: Boolean, default: false },
      flagged: Boolean,
      reason: String,
      checkedAt: Date
    }
  },

  // === LOTE (para procesamiento masivo) ===

  batch: {
    id: String,
    sequence: Number,
    totalInBatch: Number
  },

  // === DOCUMENTOS ADJUNTOS ===

  documents: [{
    type: {
      type: String,
      enum: ['INVOICE', 'PACKING_LIST', 'TRACKING_PROOF', 'PAYMENT_PROOF', 'OTHER']
    },
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Notas internas
  notes: [{
    text: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  // Historial de cambios de estado
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }]

}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indices
H7DeclarationSchema.index({ trackingNumber: 1 });
H7DeclarationSchema.index({ mrn: 1 });
H7DeclarationSchema.index({ status: 1, createdAt: -1 });
H7DeclarationSchema.index({ 'recipient.taxId': 1 });
H7DeclarationSchema.index({ iossNumber: 1 });
H7DeclarationSchema.index({ 'batch.id': 1 });
H7DeclarationSchema.index({ createdBy: 1, createdAt: -1 });

// Generar referencia automatica
H7DeclarationSchema.pre('save', async function(next) {
  if (!this.reference) {
    const year = new Date().getFullYear();
    // La referencia se basa en el MÁXIMO sufijo existente + 1, no en countDocuments:
    // usar el conteo colisiona (E11000) cuando el nº de documentos no coincide con
    // el número más alto (p. ej. tras borrados intermedios o huecos del seeder).
    const prefijo = `H7-${year}-`;
    const ultima = await this.constructor
      .findOne({ reference: new RegExp(`^${prefijo}`) })
      .sort({ reference: -1 })
      .select('reference')
      .lean();
    let siguiente = 1;
    if (ultima?.reference) {
      const n = parseInt(ultima.reference.slice(prefijo.length), 10);
      if (Number.isFinite(n)) siguiente = n + 1;
    }
    this.reference = `${prefijo}${String(siguiente).padStart(6, '0')}`;
  }

  // Calcular valor en aduana si no existe
  if (!this.totals.customsValue) {
    this.totals.customsValue = this.totals.intrinsicValue +
      (this.totals.shippingCost || 0) +
      (this.totals.insuranceCost || 0);
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

// Metodos de instancia
H7DeclarationSchema.methods.calculateDuties = function(fecha = new Date()) {
  const customsValue = this.totals.customsValue;

  // Arancel. Reglamento (UE) 2026/382: la franquicia de 150 EUR queda suprimida.
  // Durante el periodo transitorio (1/Jul/2026 -> 1/Jul/2028) se aplica un derecho
  // fijo de 3 EUR/articulo a los envios IOSS-exentos o postales (<= 150 EUR).
  let tariffAmount;
  if (aplicaDerechoFijo2026(this, fecha)) {
    const numArticulos = Array.isArray(this.items) && this.items.length > 0 ? this.items.length : 1;
    tariffAmount = REG_2026_382.derechoFijoPorArticulo * numArticulos;
    this.aplicarDerechoFijo2026 = true;
    this.duties.tariff.rate = 0; // no es porcentual, es cuota fija
  } else {
    // Fuera del supuesto del derecho fijo: arancel porcentual segun la tasa del envio
    // (0 por defecto; puede venir informada por clasificacion TARIC).
    const tariffRate = this.duties.tariff.rate || 0;
    tariffAmount = customsValue * (tariffRate / 100);
    this.aplicarDerechoFijo2026 = false;
  }

  // IVA: 21% en Espana (si no prepagado via IOSS). Base = valor en aduana + arancel.
  // El antiguo minimis de 22 EUR (exencion de IVA por importe) fue derogado en 2021.
  let vatAmount = 0;
  if (!this.vatPrepaid && !this.duties.vat.prepaid) {
    const vatBase = customsValue + tariffAmount;
    vatAmount = vatBase * (this.duties.vat.rate / 100);
  }

  // Tasa de gestion (Correos cobra ~3 EUR, couriers varia)
  const handlingFee = this.duties.handlingFee || 0;

  this.duties.tariff.amount = Math.round(tariffAmount * 100) / 100;
  this.duties.vat.amount = Math.round(vatAmount * 100) / 100;
  this.duties.totalDue = Math.round((tariffAmount + vatAmount + handlingFee) * 100) / 100;

  return this.duties;
};

// Validar que el envio cumple requisitos H7
H7DeclarationSchema.methods.validateH7Eligibility = function() {
  const errors = [];

  // Valor intrinseco <= 150 EUR
  if (this.totals.intrinsicValue > 150) {
    errors.push({
      field: 'totals.intrinsicValue',
      code: 'H7_VALUE_EXCEEDED',
      message: `Valor intrinseco ${this.totals.intrinsicValue} EUR excede limite H7 de 150 EUR`
    });
  }

  // Debe ser B2C o C2C
  if (this.operationType === 'B2B_LOW_VALUE' && this.totals.intrinsicValue > 22) {
    errors.push({
      field: 'operationType',
      code: 'H7_B2B_LIMIT',
      message: 'Envios B2B solo pueden usar H7 si valor <= 22 EUR'
    });
  }

  // Productos prohibidos/restringidos no pueden usar H7
  const restrictedCodes = ['2402', '2403', '2208', '3004'];  // Tabaco, alcohol, medicamentos
  for (const item of this.items) {
    const prefix4 = item.taricCode.substring(0, 4);
    if (restrictedCodes.includes(prefix4)) {
      errors.push({
        field: 'items.taricCode',
        code: 'H7_RESTRICTED_GOODS',
        message: `Codigo ${item.taricCode} corresponde a mercancia restringida que no puede usar H7`
      });
    }
  }

  // Validar IOSS si presente
  if (this.iossNumber && !/^IM\d{10}$/.test(this.iossNumber)) {
    errors.push({
      field: 'iossNumber',
      code: 'INVALID_IOSS',
      message: 'Formato IOSS invalido. Debe ser IM + 10 digitos'
    });
  }

  return {
    eligible: errors.length === 0,
    errors
  };
};

// Metodos estaticos
H7DeclarationSchema.statics.getStats = async function(filters = {}) {
  const match = {};

  if (filters.startDate || filters.endDate) {
    match.createdAt = {};
    if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
  }

  if (filters.carrier) match['carrier.code'] = filters.carrier;
  if (filters.createdBy) match.createdBy = new mongoose.Types.ObjectId(filters.createdBy);
  // aggregate() NO castea el tenantId: hay que forzar el ObjectId o el $match
  // no encaja y devuelve 0 (mismo problema que ya se documento en analytics).
  if (filters.tenantId) match.tenantId = new mongoose.Types.ObjectId(filters.tenantId);

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$totals.customsValue' },
        totalDuties: { $sum: '$duties.totalDue' }
      }
    }
  ]);

  const byCarrier = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$carrier.code',
        count: { $sum: 1 },
        totalValue: { $sum: '$totals.customsValue' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    byStatus: stats,
    byCarrier,
    totals: {
      declarations: stats.reduce((acc, s) => acc + s.count, 0),
      value: stats.reduce((acc, s) => acc + s.totalValue, 0),
      duties: stats.reduce((acc, s) => acc + s.totalDuties, 0)
    }
  };
};

require('../utils/softDelete')(H7DeclarationSchema);

const H7DeclarationModel = mongoose.model('H7Declaration', H7DeclarationSchema);

// Utilidades del Reglamento (UE) 2026/382 tambien accesibles via el modelo.
H7DeclarationModel.REG_2026_382 = REG_2026_382;
H7DeclarationModel.aplicaDerechoFijo2026 = aplicaDerechoFijo2026;

module.exports = H7DeclarationModel;
