const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  // Referencia al expediente
  expedition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition',
    required: true,
    index: true
  },

  // Tipo de participante
  sender: {
    type: String,
    enum: ['client', 'agent', 'luci'],
    required: true
  },

  // Datos del remitente
  senderInfo: {
    name: String,
    email: String,
    userId: mongoose.Schema.Types.ObjectId
  },

  // Contenido del mensaje
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },

  // Tipo de mensaje
  messageType: {
    type: String,
    enum: ['text', 'document_request', 'document_received', 'validation_result', 'system'],
    default: 'text'
  },

  // Metadatos adicionales
  metadata: {
    documentId: mongoose.Schema.Types.ObjectId,
    documentType: String,
    validationStatus: String,
    // Etiqueta de presentacion que devuelve `labelFor` ('sonnet-5', 'opus-5'),
    // no el ID invocable de Bedrock. Ver config/bedrockModels.js.
    aiModel: String,
    tokensUsed: Number,
    processingTime: Number // ms
  },

  // Para mensajes de LUCI - contexto usado
  aiContext: {
    systemPrompt: String,
    retrievedKnowledge: [String],
    confidence: Number
  },

  // Estado
  isRead: {
    type: Boolean,
    default: false
  },

  readAt: Date

}, {
  timestamps: true
});

// Indexes
ChatMessageSchema.index({ expedition: 1, createdAt: -1 });
ChatMessageSchema.index({ expedition: 1, sender: 1 });
ChatMessageSchema.index({ expedition: 1, isRead: 1 });

// Virtual para tiempo desde envio
ChatMessageSchema.virtual('timeSince').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'ahora';
});

// Metodos estaticos
ChatMessageSchema.statics.getConversation = function(expeditionId, limit = 50, before = null) {
  const query = { expedition: expeditionId };
  if (before) {
    query.createdAt = { $lt: before };
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

ChatMessageSchema.statics.markAsRead = function(expeditionId, sender) {
  return this.updateMany(
    { expedition: expeditionId, sender: { $ne: sender }, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

ChatMessageSchema.statics.getUnreadCount = function(expeditionId, forSender) {
  return this.countDocuments({
    expedition: expeditionId,
    sender: { $ne: forSender },
    isRead: false
  });
};

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
