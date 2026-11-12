const mongoose = require('mongoose');

/**
 * Tablas de apoyo del TARIC que acompañan a las medidas de control: grupos de
 * paises (`area`), certificados de la casilla 44 (`certificado`) y el estado
 * de la ultima carga (`meta`).
 */
const TaricReferenceSchema = new mongoose.Schema({
  clase: { type: String, enum: ['area', 'certificado', 'meta'], required: true },
  codigo: { type: String, required: true },
  descripcion: String,
  miembros: { type: [String], default: undefined },
  datos: mongoose.Schema.Types.Mixed
}, { timestamps: true });

TaricReferenceSchema.index({ clase: 1, codigo: 1 }, { unique: true });
TaricReferenceSchema.index({ clase: 1, miembros: 1 });

module.exports = mongoose.model('TaricReference', TaricReferenceSchema);
