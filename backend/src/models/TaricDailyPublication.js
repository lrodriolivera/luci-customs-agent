const mongoose = require('mongoose');

/**
 * Publicacion diaria del TARIC ya leida: que traia de interes para LUCI y que
 * de ello esta o no reflejado en el catalogo. Una por fichero publicado.
 */
const CambioSchema = new mongoose.Schema({
  clase: { type: String, enum: ['codigo', 'derecho', 'control'], required: true },
  code: String,
  tipo: String,
  origen: String,
  accion: String,
  desde: String,
  hasta: String,
  norma: String,
  detalle: String,
  // pendiente: aun no esta en el catalogo · en_catalogo: ya coincide ·
  // aplicado: lo aplico LUCI desde este fichero · informativo: no se aplica
  // desde aqui (lo recoge la carga mensual) · no_calculable: derecho que LUCI
  // no sabe liquidar.
  estado: { type: String, enum: ['pendiente', 'en_catalogo', 'aplicado', 'informativo', 'no_calculable'], default: 'pendiente' },
  motivo: String,
  aplicadoEn: Date
}, { _id: false });

const TaricDailyPublicationSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  fecha: String,
  procesadoEn: { type: Date, required: true },
  resumen: mongoose.Schema.Types.Mixed,
  cambios: [CambioSchema]
}, { timestamps: true });

module.exports = mongoose.model('TaricDailyPublication', TaricDailyPublicationSchema);
