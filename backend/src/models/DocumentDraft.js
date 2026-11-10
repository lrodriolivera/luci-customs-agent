const mongoose = require('mongoose');

/**
 * Documento subido y leido ANTES de que exista el expediente.
 *
 * En el alta, el agente empieza subiendo la factura, el packing list o el
 * documento de transporte; LUCI los lee y rellena el formulario. Hasta que el
 * expediente se crea no hay donde colgarlos: se guardan aqui, a nombre del
 * usuario que los subio, y al crear el expediente pasan a `expedition.documents`
 * ya leidos (no se vuelve a llamar a la IA).
 *
 * Un borrador que no acaba en un expediente se borra, con su archivo, a las
 * 24 horas (services/documentos/borradoresDocumento.js -> limpiarCaducados).
 */
const DocumentDraftSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  fileName: { type: String, required: true },
  originalName: String,
  filePath: String,
  fileSize: Number,
  mimeType: String,
  extractedData: mongoose.Schema.Types.Mixed,
  aiConfidence: Number
}, { timestamps: true });

DocumentDraftSchema.index({ createdAt: 1 });

module.exports = mongoose.model('DocumentDraft', DocumentDraftSchema);
