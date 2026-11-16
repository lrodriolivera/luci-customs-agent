const mongoose = require('mongoose');

/**
 * Aviso recogido de la bandeja de entrada de la AEAT (exportación AES:
 * levantes, resultado de la salida, disconformes, invalidación...).
 *
 * Leer el detalle de un aviso lo marca como leído en la AEAT y ya no vuelve a
 * salir en la lista, así que se guarda aquí en cuanto se lee, aunque todavía no
 * se sepa de qué expediente es (`sin_expediente`): las pasadas siguientes lo
 * vuelven a intentar asociar. La `clave` de la bandeja es única: un aviso no se
 * lee ni se aplica dos veces. Ver services/aesBandejaProceso.js.
 *
 * Sin rutas: no se expone a los tenants; `tenantId` solo existe una vez
 * asociado a un expediente de ese tenant.
 */
const AvisoAeatSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  nif: { type: String, required: true },
  referencia: String,
  tipoRespuesta: String,
  tipo: String,
  mrn: { type: String, index: true },
  avisoId: String,
  estadoAES: String,
  fechaPreparacion: String,
  datos: mongoose.Schema.Types.Mixed,
  // Respuesta tal cual (recortada), por si hay que revisar un aviso que no se entendió.
  xml: String,
  leidoEn: Date,
  estado: {
    type: String,
    enum: ['error_lectura', 'no_valido', 'sin_expediente', 'ambiguo', 'aplicado', 'repetido'],
    required: true
  },
  error: String,
  intentos: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  expeditionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expedition' },
  aplicadoEn: Date
}, { timestamps: true, collection: 'avisosaeat' });

AvisoAeatSchema.index({ estado: 1, nif: 1 });

module.exports = mongoose.models.AvisoAeat || mongoose.model('AvisoAeat', AvisoAeatSchema);
