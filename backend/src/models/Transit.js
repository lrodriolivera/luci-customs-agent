/**
 * Transit Model (NCTS)
 * Modelo para operaciones de transito T1/T2/TIR
 *
 * NCTS: New Computerised Transit System
 * Conecta con las aduanas de la UE para seguimiento de transitos
 */

const mongoose = require('mongoose');

const transitSchema = new mongoose.Schema({
  // Multi-tenancy
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // Identificadores
  mrn: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  lrn: {
    type: String,
    required: true,
    unique: true
  },
  reference: {
    type: String,
    required: true
  },

  // Tipo de transito
  transitType: {
    type: String,
    enum: ['T1', 'T2', 'T2F', 'T2SM', 'TIR'],
    required: true
  },

  // Estado NCTS
  status: {
    type: String,
    enum: [
      'draft',              // Borrador
      'submitted',          // Enviada a NCTS
      'accepted',           // Aceptada, MRN asignado
      'released',           // Mercancias liberadas en partida
      'in_transit',         // En transito
      'arrived',            // Llegada notificada
      'control_requested',  // Control solicitado por destino
      'goods_released',     // Mercancia entregada en destino
      'discrepancy',        // Discrepancia detectada
      'enquiry',            // Procedimiento de busqueda iniciado
      'recovered',          // Recuperado tras busqueda
      'written_off',        // Dado de baja
      'cancelled',          // Anulado
      'completed'           // Completado
    ],
    default: 'draft'
  },

  // Principal obligado (Authorized Economic Operator)
  principal: {
    eori: String,
    name: String,
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: String
    },
    tir: {
      holderNumber: String,
      carnetNumber: String
    }
  },

  // Garantia de transito
  guarantee: {
    type: {
      type: String,
      enum: [
        '0', // Dispensa de garantia
        '1', // Garantia global
        '2', // Garantia individual por fianza
        '3', // Garantia individual en efectivo
        '4', // Garantia individual por titulo
        '5', // Dispensa (500 EUR max)
        '8', // Sin garantia (titulos)
        '9', // Garantia individual con multiples usos
        'R', // Garantia individual (TIR)
        'B', // Carnet TIR
        'C', // Sin garantia requerida
        'H', // Garantia de transito simplificada
        'J'  // Validacion garantia global (varias aduanas)
      ]
    },
    grn: String,  // Guarantee Reference Number
    accessCode: String,
    amount: Number,
    currency: { type: String, default: 'EUR' },
    validFrom: Date,
    validTo: Date,
    customsOffice: String
  },

  // Aduana de partida
  departureOffice: {
    code: { type: String, required: true },
    name: String,
    country: String
  },

  // Aduana de destino
  destinationOffice: {
    code: { type: String, required: true },
    name: String,
    country: String
  },

  // Aduanas de transito (paso por fronteras)
  transitOffices: [{
    sequence: Number,
    code: String,
    name: String,
    country: String,
    estimatedArrival: Date,
    actualArrival: Date,
    status: {
      type: String,
      enum: ['pending', 'arrived', 'passed', 'issue'],
      default: 'pending'
    }
  }],

  // Datos del transporte
  transport: {
    mode: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '7', '8'], // 1=Sea, 2=Rail, 3=Road, 4=Air, 5=Post, 7=Pipeline, 8=Inland
      required: true
    },
    modeAtBorder: String,
    nationality: String,
    identityAtDeparture: {
      vehicleType: String,  // Tipo: camion, avion, barco, etc.
      identification: String  // Matricula, numero de vuelo, etc.
    },
    identityAtBorder: {
      vehicleType: String,
      identification: String
    },
    // Contenedor
    containerIndicator: Boolean,
    containers: [{
      number: String,
      size: String,
      goodsItems: [Number]  // Items contenidos
    }],
    // Precintos
    seals: [{
      number: String,
      sealType: String,  // Tipo de precinto
      affixedBy: String,
      intactOnArrival: Boolean
    }],
    sealCount: Number
  },

  // Ruta
  route: {
    countries: [String],  // Codigos ISO de paises
    itinerary: String,
    bindingItinerary: Boolean,
    specialMentions: [String]
  },

  // Mercancias
  goodsItems: [{
    itemNumber: Number,
    description: String,
    taricCode: String,
    countryOfOrigin: String,
    countryOfDestination: String,
    grossWeight: Number,
    netWeight: Number,
    packages: {
      count: Number,
      packageType: String,  // Codigo tipo de bulto (CT, PK, BX, etc.)
      marks: String
    },
    previousDocuments: [{
      type: String,
      reference: String,
      date: Date
    }],
    specialMentions: [String]
  }],

  // Totales
  totals: {
    grossWeight: Number,
    itemCount: Number,
    packageCount: Number
  },

  // Documentos
  documents: [{
    type: { type: String },
    reference: String,
    date: Date,
    customsOffice: String
  }],

  // Fechas importantes
  dates: {
    declaration: Date,
    acceptance: Date,
    releaseAtDeparture: Date,
    estimatedArrival: Date,
    actualArrival: Date,
    unloadingNotification: Date,
    controlCompletion: Date,
    goodsRelease: Date,
    completion: Date
  },

  // Plazos
  deadlines: {
    arrivalDeadline: Date,  // Fecha limite de llegada
    presentationDeadline: Date,  // Fecha limite presentacion destino
    enquiryStart: Date  // Inicio procedimiento busqueda
  },

  // Resultados de control
  controlResult: {
    performed: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3']
      // A1=Satisfactorio, A2=OK con observaciones, A3=Discrepancia menor
      // A4=Discrepancia significativa, B1=Robo, B2=Perdida, B3=Destruccion
    },
    date: Date,
    officer: String,
    observations: String,
    discrepancies: [{
      itemNumber: Number,
      type: String,  // shortage, excess, description, taric
      declared: String,
      found: String,
      action: String
    }]
  },

  // Procedimiento de busqueda (enquiry)
  enquiry: {
    initiated: { type: Boolean, default: false },
    initiatedDate: Date,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'response_received', 'resolved', 'debt_notified']
    },
    responses: [{
      office: String,
      date: Date,
      response: String
    }],
    resolution: {
      date: Date,
      outcome: String,  // recovered, written_off, debt
      debtAmount: Number
    }
  },

  // TIR especifico
  tir: {
    carnetNumber: String,
    holderNumber: String,
    customsAgentNumber: String,
    tirType: {
      type: String,
      enum: ['simple', 'multiple']
    },
    loadingOffice: String,
    unloadingOffices: [{
      sequence: Number,
      code: String,
      goodsItems: [Number]
    }]
  },

  // Mensajes NCTS intercambiados
  messages: [{
    type: {
      type: String,
      enum: [
        'IE015', // Declaration data
        'IE016', // Declaration rejected
        'IE028', // MRN allocated
        'IE029', // Release for transit
        'IE044', // Unloading permission
        'IE045', // Write-off request
        'IE050', // Risk analysis
        'IE051', // No release for transit
        'IE055', // Guarantee invalid
        'IE060', // Control decision
        'IE118', // Enquiry request
        'IE140', // Request on transit operations
        'IE141', // Information request
        'IE142', // Information response
        'IE143', // Control results
        'IE160', // Arrival notification
        'IE906', // Functional NACK
        'IE917', // XML NACK
        'IE928'  // Positive ACK
      ]
    },
    direction: { type: String, enum: ['outbound', 'inbound'] },
    timestamp: { type: Date, default: Date.now },
    content: mongoose.Schema.Types.Mixed,
    correlationId: String
  }],

  // Historial de estados
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    office: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }],

  // Expediente relacionado
  expeditionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  },

  // Usuario propietario
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Notas
  notes: String

}, {
  timestamps: true
});

// Indices
transitSchema.index({ mrn: 1 });
transitSchema.index({ lrn: 1 });
transitSchema.index({ status: 1 });
transitSchema.index({ owner: 1, status: 1 });
transitSchema.index({ 'principal.eori': 1 });
transitSchema.index({ 'departureOffice.code': 1 });
transitSchema.index({ 'destinationOffice.code': 1 });
transitSchema.index({ 'deadlines.arrivalDeadline': 1 });

// Metodos de instancia

// Generar LRN
transitSchema.methods.generateLRN = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LRN${timestamp}${random}`;
};

// Verificar si esta vencido
transitSchema.methods.isOverdue = function() {
  if (!this.deadlines?.arrivalDeadline) return false;
  return new Date() > new Date(this.deadlines.arrivalDeadline);
};

// Dias restantes para llegada
transitSchema.methods.daysUntilDeadline = function() {
  if (!this.deadlines?.arrivalDeadline) return null;
  const now = new Date();
  const deadline = new Date(this.deadlines.arrivalDeadline);
  const diff = deadline - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Calcular plazo de llegada basado en ruta
transitSchema.methods.calculateDeadline = function() {
  const releaseDate = this.dates.releaseAtDeparture || new Date();
  const countries = this.route?.countries?.length || 2;

  // Formula simplificada: 8 dias base + 1 dia por frontera adicional
  const days = 8 + Math.max(0, countries - 2);

  const deadline = new Date(releaseDate);
  deadline.setDate(deadline.getDate() + days);

  return deadline;
};

// Verificar integridad de precintos
transitSchema.methods.checkSeals = function() {
  if (!this.transport?.seals?.length) return { valid: true, issues: [] };

  const issues = [];
  for (const seal of this.transport.seals) {
    if (seal.intactOnArrival === false) {
      issues.push({
        sealNumber: seal.number,
        issue: 'Precinto roto o manipulado'
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

// Pre-save hook para calcular totales
transitSchema.pre('save', function(next) {
  if (this.goodsItems && this.goodsItems.length > 0) {
    this.totals = {
      grossWeight: this.goodsItems.reduce((sum, g) => sum + (g.grossWeight || 0), 0),
      itemCount: this.goodsItems.length,
      packageCount: this.goodsItems.reduce((sum, g) => sum + (g.packages?.count || 0), 0)
    };
  }

  // Generar LRN si no existe
  if (!this.lrn) {
    this.lrn = this.generateLRN();
  }

  // Calcular deadline si no existe y hay fecha de salida
  if (!this.deadlines?.arrivalDeadline && this.dates?.releaseAtDeparture) {
    this.deadlines = this.deadlines || {};
    this.deadlines.arrivalDeadline = this.calculateDeadline();
  }

  next();
});

// Metodos estaticos

// Buscar transitos activos por corredor
transitSchema.statics.findByCorridor = function(departureCountry, destinationCountry, status = 'in_transit') {
  return this.find({
    'departureOffice.country': departureCountry,
    'destinationOffice.country': destinationCountry,
    status
  }).sort({ 'dates.releaseAtDeparture': -1 });
};

// Buscar transitos vencidos
transitSchema.statics.findOverdue = function() {
  return this.find({
    status: { $in: ['released', 'in_transit'] },
    'deadlines.arrivalDeadline': { $lt: new Date() }
  });
};

// Estadisticas de transitos
transitSchema.statics.getStats = async function(owner, filters = {}) {
  const query = { owner };
  if (filters.transitType) query.transitType = filters.transitType;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byType: {
          $push: '$transitType'
        },
        byStatus: {
          $push: '$status'
        },
        totalWeight: { $sum: '$totals.grossWeight' },
        avgDays: {
          $avg: {
            $divide: [
              { $subtract: ['$dates.goodsRelease', '$dates.releaseAtDeparture'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      total: 0,
      byType: {},
      byStatus: {},
      totalWeight: 0,
      avgTransitDays: 0
    };
  }

  const result = stats[0];

  // Contar por tipo
  const byType = {};
  result.byType.forEach(t => {
    byType[t] = (byType[t] || 0) + 1;
  });

  // Contar por estado
  const byStatus = {};
  result.byStatus.forEach(s => {
    byStatus[s] = (byStatus[s] || 0) + 1;
  });

  return {
    total: result.total,
    byType,
    byStatus,
    totalWeight: Math.round(result.totalWeight || 0),
    avgTransitDays: Math.round((result.avgDays || 0) * 10) / 10
  };
};

module.exports = mongoose.model('Transit', transitSchema);
