const mongoose = require('mongoose');
const { tenantListGuard } = require('../utils/tenantListGuard');

const ChatMessageSchema = new mongoose.Schema({
  // Referencia al expediente
  expedition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition',
    required: true,
    index: true
  },

  // Tenant del expediente. Se rellena solo al validar (hook de abajo) para que
  // el historial global se pueda acotar al tenant del usuario.
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

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
  // Los mensajes legacy no tienen tenantId: filtrar por el los ocultaria de su
  // propia conversacion.
  return this.find(query)
    .setOptions({ sinTenant: 'acotado por expediente: quien llama ya comprobo que el expediente es del tenant (ensureSameTenant o token del portal)' })
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
  }).setOptions({ sinTenant: 'acotado por expediente: quien llama ya comprobo que el expediente es del tenant (ensureSameTenant o token del portal)' });
};

// El tenant sale del expediente: los diez sitios que crean mensajes solo
// conocen el expediente, asi que se resuelve aqui una vez.
ChatMessageSchema.pre('validate', async function () {
  if (this.tenantId || !this.expedition) return;
  const Expedition = mongoose.model('Expedition');
  const exp = await Expedition.findById(this.expedition).select('tenantId').lean();
  if (exp?.tenantId) this.tenantId = exp.tenantId;
});

// Listados sin tenantId fallan: ver utils/tenantListGuard.
ChatMessageSchema.plugin(tenantListGuard, { modelo: 'ChatMessage' });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
