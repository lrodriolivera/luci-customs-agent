const mongoose = require('mongoose');

/**
 * Tipos de cambio que rigen para el valor en aduana durante un mes
 * (los del BCE del penultimo miercoles del mes anterior). Uno por mes: una vez
 * guardado no cambia, y asi una declaracion se puede recalcular con el tipo
 * que le correspondia.
 */
const CustomsExchangeRateSchema = new mongoose.Schema({
  // Mes de vigencia, «AAAA-MM».
  mes: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}$/ },
  // Penultimo miercoles del mes anterior y dia del que es realmente el tipo
  // (el anterior publicado si ese miercoles no hubo publicacion).
  fechaReferencia: { type: String, required: true },
  fechaPublicacion: { type: String, required: true },
  // Unidades de la divisa por 1 EUR, como lo publica el BCE.
  tipos: { type: Map, of: Number, required: true },
  fuente: { type: String, default: 'BCE' }
}, { timestamps: true });

module.exports = mongoose.model('CustomsExchangeRate', CustomsExchangeRateSchema);
