/**
 * SummaryQuery Model
 * Modelo para consultas a servicios ADDS-JDIT de AEAT
 *
 * Servicios soportados:
 * - QIntNuCono: Consulta por numero de conocimiento (B/L, AWB)
 * - QIntCont: Consulta por contenedor
 * - QIntUbic: Consulta por ubicacion
 * - QIntDocAsoc: Consulta de documentos asociados
 */
const mongoose = require('mongoose');

// Esquema de documento encontrado
const DocumentResultSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ENS', 'H1', 'H7', 'AES', 'NCTS', 'DUA', 'T1', 'T2', 'OTHER']
  },
  documentNumber: String,
  referenceNumber: String,
  issuedAt: Date,
  status: String
}, { _id: false });

// Esquema de resultado de consulta
const QueryResultSchema = new mongoose.Schema({
  // MRN de la declaracion
  mrn: String,

  // LRN si disponible
  lrn: String,

  // Tipo de declaracion
  declarationType: {
    type: String,
    enum: ['ENS', 'H1', 'H7', 'AES', 'NCTS', 'EXS', 'DUA', 'T1', 'T2', 'OTHER']
  },

  // Estado de la declaracion
  status: String,

  // Canal asignado (si aplica)
  channel: {
    type: String,
    enum: ['GREEN', 'ORANGE', 'RED', 'YELLOW', null]
  },

  // Aduana
  customsOffice: {
    code: String,
    name: String
  },

  // Fecha de presentacion
  submissionDate: Date,

  // Fecha de aceptacion
  acceptanceDate: Date,

  // Fecha de levante
  releaseDate: Date,

  // Declarante
  declarant: {
    eori: String,
    name: String
  },

  // Carrier
  carrier: {
    eori: String,
    name: String
  },

  // Consignee
  consignee: {
    eori: String,
    name: String
  },

  // Referencia del transporte
  transportReference: String,

  // Contenedor
  containerNumber: String,

  // Peso bruto
  grossMass: Number,

  // Numero de bultos
  numberOfPackages: Number,

  // Descripcion de mercancias
  goodsDescription: String,

  // Documentos asociados
  documents: [DocumentResultSchema],

  // Mensajes del sistema
  messages: [{
    code: String,
    text: String,
    timestamp: Date
  }],

  // Acciones pendientes
  pendingActions: [{
    type: String,
    description: String,
    deadline: Date
  }]
}, { _id: false });

// Esquema principal SummaryQuery
const SummaryQuerySchema = new mongoose.Schema({
  // Identificador unico de consulta
  queryId: {
    type: String,
    unique: true,
    required: true
  },

  // Tipo de consulta
  queryType: {
    type: String,
    required: true,
    enum: ['QIntNuCono', 'QIntCont', 'QIntUbic', 'QIntDocAsoc', 'QIntMRN', 'QIntEORI']
  },

  // Usuario que ejecuta la consulta
  executedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Parametros de busqueda
  searchParams: {
    // Numero de conocimiento (B/L, AWB, CMR)
    billOfLading: String,

    // Numero AWB (carta de porte aereo)
    awbNumber: String,

    // Numero de contenedor
    containerNumber: String,

    // Codigo de ubicacion/aduana
    locationCode: String,

    // Referencia de documento
    documentReference: String,

    // MRN
    mrn: String,

    // EORI
    eori: String,

    // Rango de fechas
    dateFrom: Date,
    dateTo: Date,

    // Tipo de declaracion a buscar
    declarationType: String,

    // Estado a filtrar
    status: String,

    // Opciones adicionales
    includeHistory: {
      type: Boolean,
      default: false
    },
    includeDocuments: {
      type: Boolean,
      default: true
    }
  },

  // Resultados de la consulta
  results: [QueryResultSchema],

  // Numero de resultados
  resultsCount: {
    type: Number,
    default: 0
  },

  // Estado de la consulta
  queryStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'timeout'],
    default: 'pending'
  },

  // Error si fallo
  error: {
    code: String,
    message: String,
    details: String
  },

  // Respuesta original de AEAT
  rawResponse: String,

  // Tiempo de ejecucion en ms
  executionTime: Number,

  // Fecha de ejecucion
  executedAt: {
    type: Date,
    default: Date.now
  },

  // Metadatos de la consulta
  metadata: {
    // IP desde donde se ejecuto
    sourceIP: String,

    // User agent
    userAgent: String,

    // Certificado usado
    certificateAlias: String,

    // Entorno (sandbox/production/pre/test - PRE de AEAT y entornos adicionales)
    environment: {
      type: String,
      enum: ['sandbox', 'production', 'pre', 'test']
    }
  },

  // Notas
  notes: String

}, {
  timestamps: true
});

// Indices
SummaryQuerySchema.index({ queryId: 1 });
SummaryQuerySchema.index({ queryType: 1 });
SummaryQuerySchema.index({ executedBy: 1, executedAt: -1 });
SummaryQuerySchema.index({ 'searchParams.billOfLading': 1 });
SummaryQuerySchema.index({ 'searchParams.containerNumber': 1 });
SummaryQuerySchema.index({ 'searchParams.mrn': 1 });
SummaryQuerySchema.index({ queryStatus: 1 });
SummaryQuerySchema.index({ executedAt: -1 });

// Generar queryId automatico ANTES de la validacion (pre('save') corre tras validate(),
// asi que queryId required fallaba antes de poder asignarlo).
SummaryQuerySchema.pre('validate', function(next) {
  if (!this.queryId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.queryId = `Q${(this.queryType || 'GEN').replace('QInt', '')}-${timestamp}${random}`;
  }
  next();
});

// Metodo de instancia: Agregar resultado
SummaryQuerySchema.methods.addResult = function(resultData) {
  this.results.push(resultData);
  this.resultsCount = this.results.length;
};

// Metodo de instancia: Marcar como completada
SummaryQuerySchema.methods.complete = function(results = [], executionTime = 0) {
  this.results = results;
  this.resultsCount = results.length;
  this.queryStatus = 'completed';
  this.executionTime = executionTime;
};

// Metodo de instancia: Marcar como fallida
SummaryQuerySchema.methods.fail = function(error) {
  this.queryStatus = 'failed';
  this.error = {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'Error desconocido',
    details: error.details || ''
  };
};

// Metodo estatico: Obtener historial de consultas
SummaryQuerySchema.statics.getHistory = async function(userId, filters = {}) {
  const query = { executedBy: userId };

  if (filters.queryType) {
    query.queryType = filters.queryType;
  }

  if (filters.startDate || filters.endDate) {
    query.executedAt = {};
    if (filters.startDate) query.executedAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.executedAt.$lte = new Date(filters.endDate);
  }

  if (filters.queryStatus) {
    query.queryStatus = filters.queryStatus;
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const [queries, total] = await Promise.all([
    this.find(query)
      .sort({ executedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-rawResponse -results'), // Excluir campos pesados
    this.countDocuments(query)
  ]);

  return {
    queries,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Metodo estatico: Obtener estadisticas de consultas
SummaryQuerySchema.statics.getStats = async function(userId, filters = {}) {
  const match = { executedBy: new mongoose.Types.ObjectId(userId) };

  if (filters.startDate) {
    match.executedAt = { $gte: new Date(filters.startDate) };
  }

  const byType = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$queryType',
        count: { $sum: 1 },
        avgExecutionTime: { $avg: '$executionTime' },
        avgResults: { $avg: '$resultsCount' }
      }
    }
  ]);

  const byStatus = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$queryStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  const recentQueries = await this.find(match)
    .sort({ executedAt: -1 })
    .limit(5)
    .select('queryId queryType queryStatus resultsCount executedAt');

  return {
    byType,
    byStatus,
    recentQueries,
    totals: {
      queries: byType.reduce((acc, t) => acc + t.count, 0),
      successful: byStatus.find(s => s._id === 'completed')?.count || 0,
      failed: byStatus.find(s => s._id === 'failed')?.count || 0
    }
  };
};

module.exports = mongoose.model('SummaryQuery', SummaryQuerySchema);
