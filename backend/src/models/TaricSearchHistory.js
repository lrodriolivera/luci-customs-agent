const mongoose = require('mongoose');

/**
 * Modelo para almacenar historial de busquedas de codigos TARIC
 * Permite rastrear que codigos buscan los usuarios y con que frecuencia
 */
const TaricSearchHistorySchema = new mongoose.Schema({
  // Usuario que realizo la busqueda
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Tenant (para multi-tenancy)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  // Codigo TARIC buscado
  code: {
    type: String,
    required: true,
    index: true
  },

  // Codigo normalizado (siempre 10 digitos)
  normalizedCode: {
    type: String,
    required: true,
    index: true
  },

  // Tipo de busqueda
  searchType: {
    type: String,
    enum: ['code_lookup', 'description_search', 'classification'],
    default: 'code_lookup'
  },

  // Si se encontro el codigo
  found: {
    type: Boolean,
    default: false
  },

  // Fuente del resultado
  source: {
    type: String,
    enum: ['local_db', 'ai', 'eu_api', 'cache', 'not_found'],
    default: 'not_found'
  },

  // Descripcion del codigo (si se encontro)
  description: String,

  // Resultado completo (resumido)
  resultSummary: {
    chapter: String,
    heading: String,
    dutyRate: String,
    hasSpecialMeasures: Boolean
  },

  // Tiempo de respuesta en ms
  responseTime: Number,

  // Si el usuario uso el resultado (aplico a un expediente)
  wasUsed: {
    type: Boolean,
    default: false
  },

  // ID del expediente donde se uso (si aplica)
  expeditionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  },

  // Metadata adicional
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String
  }

}, {
  timestamps: true
});

// Indices compuestos para consultas frecuentes
TaricSearchHistorySchema.index({ userId: 1, createdAt: -1 });
TaricSearchHistorySchema.index({ normalizedCode: 1, createdAt: -1 });
TaricSearchHistorySchema.index({ tenantId: 1, createdAt: -1 });
TaricSearchHistorySchema.index({ source: 1, createdAt: -1 });

// Indice para TTL (opcional: eliminar despues de 1 ano)
TaricSearchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Metodos estaticos
TaricSearchHistorySchema.statics.getRecentByUser = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

TaricSearchHistorySchema.statics.getMostSearchedCodes = function(tenantId, days = 30, limit = 20) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  const match = { createdAt: { $gte: dateLimit }, found: true };
  if (tenantId) match.tenantId = tenantId;

  return this.aggregate([
    { $match: match },
    { $group: {
        _id: '$normalizedCode',
        count: { $sum: 1 },
        description: { $first: '$description' },
        lastSearched: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

TaricSearchHistorySchema.statics.getSearchStats = function(tenantId, days = 30) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  const match = { createdAt: { $gte: dateLimit } };
  if (tenantId) match.tenantId = tenantId;

  return this.aggregate([
    { $match: match },
    { $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        foundCount: { $sum: { $cond: ['$found', 1, 0] } },
        usedCount: { $sum: { $cond: ['$wasUsed', 1, 0] } },
        avgResponseTime: { $avg: '$responseTime' },
        bySource: { $push: '$source' }
      }
    },
    { $project: {
        _id: 0,
        totalSearches: 1,
        foundCount: 1,
        usedCount: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        foundRate: { $multiply: [{ $divide: ['$foundCount', '$totalSearches'] }, 100] },
        usageRate: { $multiply: [{ $divide: ['$usedCount', '$totalSearches'] }, 100] }
      }
    }
  ]);
};

module.exports = mongoose.model('TaricSearchHistory', TaricSearchHistorySchema);
