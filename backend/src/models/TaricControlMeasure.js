const mongoose = require('mongoose');

/**
 * Medida de control de importacion del TARIC (veterinaria, fitosanitaria,
 * CITES, residuos, prohibiciones...) para un codigo y un origen, con los
 * certificados que exige. Copia del fichero oficial de la Comision Europea:
 * se sustituye entera en cada carga, no se edita a mano.
 */
const TaricControlMeasureSchema = new mongoose.Schema({
  // Codigo al que se dirige la medida y la parte que comparten sus descendientes.
  codigo: { type: String, required: true },
  prefijo: { type: String, required: true },
  codigoAdicional: String,
  // Pais (ISO) o grupo de paises (1011 = todos, 1008 = terceros paises...).
  origen: { type: String, required: true },
  origenNombre: String,
  tipo: { type: String, required: true },
  tipoNombre: String,
  baseLegal: String,
  desde: String,
  hasta: String,
  // Cada grupo se cumple con UNO de sus certificados.
  condiciones: [{
    _id: false,
    grupo: String,
    certificados: [String],
    exenciones: [{ _id: false, cantidad: Number, unidad: String }],
    impideSinCertificado: Boolean
  }],
  excluidos: [String],
  // Carga a la que pertenece: permite sustituir el conjunto sin dejarlo vacio.
  lote: { type: String, required: true, index: true }
}, { timestamps: false });

TaricControlMeasureSchema.index({ prefijo: 1, origen: 1 });

module.exports = mongoose.model('TaricControlMeasure', TaricControlMeasureSchema);
