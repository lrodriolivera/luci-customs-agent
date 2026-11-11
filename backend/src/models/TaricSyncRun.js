const mongoose = require('mongoose');

/**
 * Registro de cada sincronizacion del catalogo TARIC con la fuente oficial:
 * cuando corrio, contra que extraccion, que cambio y, si fallo, por que.
 * Sirve para saber si el catalogo esta al dia sin entrar al servidor.
 */
const TaricSyncRunSchema = new mongoose.Schema({
  trigger: { type: String, enum: ['automatica', 'manual'], required: true },
  startedAt: { type: Date, required: true },
  finishedAt: Date,
  ok: { type: Boolean, default: false },
  // Extraccion oficial usada (p. ej. «2026-11») y de que mes era el español.
  fuente: { nombre: String, mes: String, mesEspanol: String },
  resumen: mongoose.Schema.Types.Mixed,
  aplicado: mongoose.Schema.Types.Mixed,
  // Motivo por el que no se aplicaron las correcciones de lo existente.
  correccionesRetenidas: String,
  error: String
}, { timestamps: true });

TaricSyncRunSchema.index({ startedAt: -1 });

module.exports = mongoose.model('TaricSyncRun', TaricSyncRunSchema);
