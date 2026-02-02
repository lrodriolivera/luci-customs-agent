const mongoose = require('mongoose');

/**
 * Modelo para cachear respuestas de IA sobre codigos TARIC
 * Reduce llamadas a Claude y mejora tiempos de respuesta
 */
const TaricAICacheSchema = new mongoose.Schema({
  // Codigo TARIC (normalizado a 10 digitos)
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Respuesta completa de la IA
  aiResponse: {
    description: String,
    description_es: String,
    chapter: String,
    chapterDescription: String,
    heading: String,
    headingDescription: String,
    subheading: String,
    subheadingDescription: String,
    hierarchy: [{
      level: String,
      code: String,
      description: String
    }],
    dutyRate: String,
    notes: String,
    measures: [String],
    examples: [String],
    relatedCodes: [String],
    valid: { type: Boolean, default: true }
  },

  // Modelo de IA usado
  aiModel: {
    type: String,
    default: 'claude-sonnet-4-20250514'
  },

  // Tokens usados en la generacion
  tokensUsed: {
    input: Number,
    output: Number,
    total: Number
  },

  // Costo estimado de la llamada (USD)
  estimatedCost: Number,

  // Contador de hits (cuantas veces se uso el cache)
  hits: {
    type: Number,
    default: 0
  },

  // Ultima vez que se accedio
  lastAccessed: {
    type: Date,
    default: Date.now
  },

  // Version del cache (para invalidacion)
  version: {
    type: Number,
    default: 1
  },

  // Si fue validado manualmente por un experto
  manuallyValidated: {
    type: Boolean,
    default: false
  },

  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  validatedAt: Date,

  // Notas de validacion
  validationNotes: String,

  // Calidad del resultado (rating)
  qualityScore: {
    type: Number,
    min: 1,
    max: 5
  },

  // Feedback de usuarios
  userFeedback: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],

  // Si esta activo (para soft delete)
  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// TTL: expira despues de 30 dias si no se accede
// Se actualizara lastAccessed en cada hit para mantener vivo
TaricAICacheSchema.index({ lastAccessed: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Indices adicionales
TaricAICacheSchema.index({ hits: -1 });
TaricAICacheSchema.index({ manuallyValidated: 1 });
TaricAICacheSchema.index({ 'aiResponse.valid': 1 });

// Metodo para obtener del cache y actualizar hits
TaricAICacheSchema.statics.getFromCache = async function(code) {
  const normalizedCode = code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);

  const cached = await this.findOneAndUpdate(
    { code: normalizedCode, isActive: true },
    {
      $inc: { hits: 1 },
      $set: { lastAccessed: new Date() }
    },
    { new: true }
  ).lean();

  return cached;
};

// Metodo para guardar en cache
TaricAICacheSchema.statics.saveToCache = async function(code, aiResponse, metadata = {}) {
  const normalizedCode = code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);

  return this.findOneAndUpdate(
    { code: normalizedCode },
    {
      code: normalizedCode,
      aiResponse,
      aiModel: metadata.model || 'claude-sonnet-4-20250514',
      tokensUsed: metadata.tokensUsed || {},
      estimatedCost: metadata.estimatedCost || 0,
      hits: 0,
      lastAccessed: new Date(),
      isActive: true
    },
    { upsert: true, new: true }
  );
};

// Metodo para invalidar cache de un codigo
TaricAICacheSchema.statics.invalidateCache = function(code) {
  const normalizedCode = code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);
  return this.updateOne({ code: normalizedCode }, { isActive: false });
};

// Metodo para obtener estadisticas del cache
TaricAICacheSchema.statics.getCacheStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    { $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalHits: { $sum: '$hits' },
        avgHits: { $avg: '$hits' },
        validatedCount: { $sum: { $cond: ['$manuallyValidated', 1, 0] } },
        avgQuality: { $avg: '$qualityScore' }
      }
    }
  ]);

  const topCodes = await this.find({ isActive: true })
    .sort({ hits: -1 })
    .limit(10)
    .select('code hits aiResponse.description_es')
    .lean();

  return {
    ...stats[0],
    topCodes
  };
};

// Metodo para limpiar cache antiguo
TaricAICacheSchema.statics.cleanOldCache = function(daysOld = 60) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - daysOld);

  return this.deleteMany({
    lastAccessed: { $lt: dateLimit },
    manuallyValidated: { $ne: true } // No eliminar los validados manualmente
  });
};

module.exports = mongoose.model('TaricAICache', TaricAICacheSchema);
