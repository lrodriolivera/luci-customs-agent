/**
 * Guarantee Model
 * Sistema de Garantias Aduaneras
 *
 * Tipos de garantias soportados:
 * - CGU: Garantia Global (Comprehensive Guarantee) para operadores frecuentes
 * - Individual: Garantia para operacion especifica
 * - Deposito: Deposito en efectivo
 * - Aval: Aval bancario
 * - Seguro: Poliza de seguro de caucion
 *
 * Usos:
 * - Transito (T1/T2)
 * - Deposito aduanero
 * - Importacion temporal
 * - Perfeccionamiento activo/pasivo
 * - Deuda aduanera potencial
 */
const mongoose = require('mongoose');

// Esquema de movimiento/consumo de garantia
const GuaranteeMovementSchema = new mongoose.Schema({
  // Tipo de movimiento
  type: {
    type: String,
    enum: ['consumption', 'release', 'adjustment', 'expiry'],
    required: true
  },

  // Importe del movimiento
  amount: {
    type: Number,
    required: true
  },

  // Referencia de la operacion
  reference: {
    type: {
      type: String,
      enum: ['expedition', 'declaration', 'transit', 'deposit', 'manual']
    },
    id: mongoose.Schema.Types.ObjectId,
    code: String  // MRN, referencia externa, etc.
  },

  // Descripcion
  description: String,

  // Saldo tras el movimiento
  balanceAfter: Number,

  // Usuario que registra
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Esquema de alerta
const GuaranteeAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['low_balance', 'expiring', 'expired', 'exceeded', 'document_expiry'],
    required: true
  },
  message: String,
  threshold: Number,  // Umbral que disparo la alerta
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Esquema principal de Garantia
const GuaranteeSchema = new mongoose.Schema({
  // Referencia unica interna
  reference: {
    type: String,
    unique: true,
    sparse: true
  },

  // GRN - Guarantee Reference Number (asignado por AEAT)
  grn: {
    type: String,
    sparse: true,
    index: true
  },

  // Usuario propietario
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // === TIPO Y CONFIGURACION ===

  // Tipo de garantia
  type: {
    type: String,
    enum: [
      'CGU',           // Garantia Global Comprensiva
      'individual',    // Garantia individual
      'deposit',       // Deposito en efectivo
      'bank_guarantee', // Aval bancario
      'insurance',     // Seguro de caucion
      'surety'         // Fianza
    ],
    required: true
  },

  // Subtipo/uso principal
  usage: {
    type: String,
    enum: [
      'transit',           // Transito comunitario T1/T2
      'customs_warehouse', // Deposito aduanero
      'temporary_import',  // Importacion temporal
      'inward_processing', // Perfeccionamiento activo
      'outward_processing', // Perfeccionamiento pasivo
      'end_use',           // Destino final
      'duty_deferment',    // Pago diferido de derechos
      'general'            // Uso general
    ],
    default: 'general'
  },

  // Nombre descriptivo
  name: {
    type: String,
    required: true
  },

  // Descripcion
  description: String,

  // === IMPORTES ===

  // Importe total de la garantia
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Importe actualmente consumido/bloqueado
  consumedAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Importe disponible (calculado)
  availableAmount: {
    type: Number,
    default: function() {
      return this.totalAmount - this.consumedAmount;
    }
  },

  // Moneda
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD', 'GBP']
  },

  // === DATOS DEL GARANTE ===

  guarantor: {
    // Tipo de garante
    type: {
      type: String,
      enum: ['bank', 'insurance', 'self', 'other']
    },
    // Nombre del garante (banco, aseguradora)
    name: String,
    // Codigo BIC/SWIFT del banco
    bic: String,
    // Numero de poliza o aval
    policyNumber: String,
    // Datos de contacto
    contact: {
      name: String,
      phone: String,
      email: String
    }
  },

  // === VIGENCIA ===

  // Fecha de inicio de validez
  validFrom: {
    type: Date,
    required: true
  },

  // Fecha de fin de validez
  validUntil: {
    type: Date,
    required: true
  },

  // Si es renovable automaticamente
  autoRenew: {
    type: Boolean,
    default: false
  },

  // === ESTADO ===

  status: {
    type: String,
    enum: [
      'draft',      // Borrador
      'pending',    // Pendiente de aprobacion AEAT
      'active',     // Activa
      'suspended',  // Suspendida
      'expired',    // Expirada
      'cancelled',  // Cancelada
      'exhausted'   // Agotada
    ],
    default: 'draft'
  },

  // === CONFIGURACION DE ALERTAS ===

  alertThresholds: {
    // Alertar cuando disponible < X% del total
    lowBalancePercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100
    },
    // Alertar X dias antes de expiracion
    expiryWarningDays: {
      type: Number,
      default: 30,
      min: 1
    }
  },

  // Alertas activas
  alerts: [GuaranteeAlertSchema],

  // === MOVIMIENTOS ===

  movements: [GuaranteeMovementSchema],

  // === DOCUMENTOS ===

  documents: [{
    type: {
      type: String,
      enum: ['guarantee_certificate', 'bank_letter', 'insurance_policy', 'amendment', 'other']
    },
    name: String,
    url: String,
    validUntil: Date,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // === OPERACIONES VINCULADAS ===

  // Expedientes que usan esta garantia
  linkedExpeditions: [{
    expedition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expedition'
    },
    amount: Number,
    status: {
      type: String,
      enum: ['active', 'released', 'executed']
    },
    linkedAt: { type: Date, default: Date.now }
  }],

  // === AUTORIZACIONES AEAT ===

  aeatAuthorization: {
    // Numero de autorizacion
    authNumber: String,
    // Fecha de autorizacion
    authDate: Date,
    // Oficina que autoriza
    customsOffice: String,
    // Notas
    notes: String
  },

  // === LIMITES ESPECIALES ===

  limits: {
    // Limite por operacion individual
    perOperationMax: Number,
    // Limite diario de consumo
    dailyMax: Number,
    // Paises excluidos
    excludedCountries: [String],
    // Tipos de mercancia excluidos (codigos TARIC)
    excludedGoods: [String]
  },

  // Notas internas
  notes: [{
    text: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  // Historial de estados
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }]

}, {
  timestamps: true
});

// Indices
GuaranteeSchema.index({ owner: 1, status: 1 });
GuaranteeSchema.index({ grn: 1 });
GuaranteeSchema.index({ type: 1, status: 1 });
GuaranteeSchema.index({ validUntil: 1 });
GuaranteeSchema.index({ 'linkedExpeditions.expedition': 1 });

// Generar referencia automatica
GuaranteeSchema.pre('save', async function(next) {
  if (!this.reference) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: new Date(year, 0, 1) }
    });
    const typePrefix = {
      'CGU': 'CGU',
      'individual': 'IND',
      'deposit': 'DEP',
      'bank_guarantee': 'AVL',
      'insurance': 'SEG',
      'surety': 'FZA'
    }[this.type] || 'GAR';
    this.reference = `${typePrefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // Calcular disponible
  this.availableAmount = this.totalAmount - this.consumedAmount;

  // Verificar alertas
  await this.checkAlerts();

  // Registrar cambio de estado
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  next();
});

// Verificar y generar alertas
GuaranteeSchema.methods.checkAlerts = async function() {
  const now = new Date();
  const newAlerts = [];

  // Alerta de saldo bajo
  const availablePercent = (this.availableAmount / this.totalAmount) * 100;
  if (availablePercent <= this.alertThresholds.lowBalancePercent) {
    const existingAlert = this.alerts.find(a =>
      a.type === 'low_balance' && !a.acknowledged
    );
    if (!existingAlert) {
      newAlerts.push({
        type: 'low_balance',
        message: `Saldo disponible (${availablePercent.toFixed(1)}%) por debajo del umbral (${this.alertThresholds.lowBalancePercent}%)`,
        threshold: this.alertThresholds.lowBalancePercent
      });
    }
  }

  // Alerta de proxima expiracion
  const daysToExpiry = Math.ceil((this.validUntil - now) / (1000 * 60 * 60 * 24));
  if (daysToExpiry <= this.alertThresholds.expiryWarningDays && daysToExpiry > 0) {
    const existingAlert = this.alerts.find(a =>
      a.type === 'expiring' && !a.acknowledged
    );
    if (!existingAlert) {
      newAlerts.push({
        type: 'expiring',
        message: `Garantia expira en ${daysToExpiry} dias (${this.validUntil.toLocaleDateString('es-ES')})`,
        threshold: this.alertThresholds.expiryWarningDays
      });
    }
  }

  // Alerta de expirada
  if (daysToExpiry <= 0 && this.status === 'active') {
    const existingAlert = this.alerts.find(a => a.type === 'expired');
    if (!existingAlert) {
      newAlerts.push({
        type: 'expired',
        message: 'Garantia ha expirado'
      });
      this.status = 'expired';
    }
  }

  // Agregar nuevas alertas
  this.alerts.push(...newAlerts);

  return newAlerts;
};

// Consumir garantia
GuaranteeSchema.methods.consume = function(amount, reference, description, userId) {
  if (amount > this.availableAmount) {
    throw new Error(`Importe ${amount} EUR excede disponible ${this.availableAmount} EUR`);
  }

  if (this.status !== 'active') {
    throw new Error(`Garantia no activa (estado: ${this.status})`);
  }

  // Verificar limite por operacion
  if (this.limits?.perOperationMax && amount > this.limits.perOperationMax) {
    throw new Error(`Importe ${amount} EUR excede limite por operacion ${this.limits.perOperationMax} EUR`);
  }

  this.consumedAmount += amount;
  this.availableAmount = this.totalAmount - this.consumedAmount;

  // Registrar movimiento
  this.movements.push({
    type: 'consumption',
    amount: -amount,
    reference,
    description,
    balanceAfter: this.availableAmount,
    createdBy: userId
  });

  // Verificar si agotada
  if (this.availableAmount <= 0) {
    this.status = 'exhausted';
  }

  return this.availableAmount;
};

// Liberar garantia
GuaranteeSchema.methods.release = function(amount, reference, description, userId) {
  if (amount > this.consumedAmount) {
    amount = this.consumedAmount;  // No liberar mas de lo consumido
  }

  this.consumedAmount -= amount;
  this.availableAmount = this.totalAmount - this.consumedAmount;

  // Registrar movimiento
  this.movements.push({
    type: 'release',
    amount: amount,
    reference,
    description,
    balanceAfter: this.availableAmount,
    createdBy: userId
  });

  // Reactivar si estaba agotada
  if (this.status === 'exhausted' && this.availableAmount > 0) {
    const now = new Date();
    if (this.validUntil > now) {
      this.status = 'active';
    }
  }

  return this.availableAmount;
};

// Vincular expediente
GuaranteeSchema.methods.linkExpedition = function(expeditionId, amount) {
  // Verificar si ya esta vinculado
  const existing = this.linkedExpeditions.find(
    le => le.expedition.toString() === expeditionId.toString()
  );

  if (existing) {
    existing.amount = amount;
    existing.status = 'active';
  } else {
    this.linkedExpeditions.push({
      expedition: expeditionId,
      amount,
      status: 'active'
    });
  }
};

// Desvincular expediente
GuaranteeSchema.methods.unlinkExpedition = function(expeditionId) {
  const link = this.linkedExpeditions.find(
    le => le.expedition.toString() === expeditionId.toString()
  );

  if (link) {
    link.status = 'released';
  }
};

// Metodos estaticos
GuaranteeSchema.statics.getActiveByOwner = function(ownerId) {
  return this.find({
    owner: ownerId,
    status: 'active',
    validUntil: { $gt: new Date() }
  }).sort({ availableAmount: -1 });
};

GuaranteeSchema.statics.findSuitableGuarantee = async function(ownerId, amount, usage) {
  const guarantees = await this.find({
    owner: ownerId,
    status: 'active',
    validUntil: { $gt: new Date() },
    availableAmount: { $gte: amount },
    $or: [
      { usage: 'general' },
      { usage: usage }
    ]
  }).sort({ availableAmount: 1 });  // Usar la mas ajustada

  return guarantees[0] || null;
};

GuaranteeSchema.statics.getStats = async function(ownerId) {
  const guarantees = await this.find({ owner: ownerId });

  const stats = {
    total: guarantees.length,
    active: 0,
    expired: 0,
    totalAmount: 0,
    consumedAmount: 0,
    availableAmount: 0,
    byType: {},
    expiringIn30Days: 0,
    lowBalance: 0
  };

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const g of guarantees) {
    if (g.status === 'active') {
      stats.active++;
      stats.totalAmount += g.totalAmount;
      stats.consumedAmount += g.consumedAmount;
      stats.availableAmount += g.availableAmount;

      // Por tipo
      stats.byType[g.type] = (stats.byType[g.type] || 0) + 1;

      // Proximas a expirar
      if (g.validUntil <= in30Days) {
        stats.expiringIn30Days++;
      }

      // Saldo bajo
      const availablePercent = (g.availableAmount / g.totalAmount) * 100;
      if (availablePercent <= g.alertThresholds.lowBalancePercent) {
        stats.lowBalance++;
      }
    } else if (g.status === 'expired') {
      stats.expired++;
    }
  }

  return stats;
};

module.exports = mongoose.model('Guarantee', GuaranteeSchema);
