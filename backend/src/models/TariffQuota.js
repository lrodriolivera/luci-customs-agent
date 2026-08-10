const mongoose = require('mongoose');

/**
 * Contingente arancelario (TRQ) tal como lo publica el sistema QUOTA de la
 * Comision Europea.
 *
 * POR QUE EXISTE ESTE MODELO
 * --------------------------
 * `quotaService.js` llevaba 11 contingentes escritos a mano en el codigo, con
 * el volumen, el consumo y el saldo cableados. Contrastados contra la base
 * oficial, 10 de esos 11 numeros de orden NO EXISTEN en ningun ano y el unico
 * que existe describe otro producto y otra unidad. La base real publica ~1.125
 * contingentes para 2026, asi que el catalogo no se podia arreglar refrescando
 * cifras: hay que traerlo entero de la fuente y guardarlo aqui.
 *
 * QUE NO SE GUARDA
 * ----------------
 * Nada que la fuente no publique. `used` y `utilizationPercent` se derivan de
 * volumen menos saldo y quedan a `null` si falta cualquiera de los dos.
 * `exhaustionDate` es el campo oficial, no una proyeccion: el servicio anterior
 * extrapolaba una fecha y la presentaba como dato.
 *
 * EL SALDO CADUCA
 * ---------------
 * Un contingente FCFS se puede agotar en horas. `syncedAt` esta para que quien
 * lo muestre pueda decir de cuando es el dato en vez de presentarlo como
 * disponibilidad actual.
 */
const ImporteSchema = new mongoose.Schema({
  amount: Number,
  unit: String            // Kilogram, EURO, Cubic metre, Hectolitre...
}, { _id: false });

const TariffQuotaSchema = new mongoose.Schema({
  // Numero de orden de 6 digitos (casilla 39 del DUA)
  orderNumber: {
    type: String,
    required: true,
    index: true
  },

  // Ano de la consulta: el mismo numero de orden se reabre cada campana con
  // volumenes distintos, asi que la clave unica es numero + ano.
  year: {
    type: Number,
    required: true,
    index: true
  },

  // Descripcion de origenes que da la fuente (a menudo el propio producto)
  origins: String,

  startDate: String,       // AAAA-MM-DD
  endDate: String,

  initialVolume: ImporteSchema,
  balance: ImporteSchema,

  // Volumen inicial menos saldo. `null` si la fuente no da volumen.
  used: Number,
  utilizationPercent: Number,

  /**
   * Criticidad que declara TARIC. NO es un umbral de consumo: la Comision marca
   * critico un contingente por sus propias reglas de gestion, y un contingente
   * al 17% puede no serlo mientras otro al 60% si. Deducirlo de un porcentaje
   * fue lo que llevo a marcar como criticos contingentes cuyo propio dato decia
   * que tenian mas de 90 dias de margen.
   */
  critical: {
    type: Boolean,
    default: false
  },

  // Fecha oficial de agotamiento. Vacia mientras el contingente sigue abierto:
  // si la fuente no la da, no hay fecha.
  exhaustionDate: String,

  lastImportDate: String,
  lastAllocationDate: String,

  // Codigos TARIC de 10 digitos a los que se puede aplicar el contingente
  taricCodes: [String],

  // Cuando se trajo de la fuente. Imprescindible para no presentar un saldo de
  // hace semanas como disponibilidad en vivo.
  syncedAt: {
    type: Date,
    default: Date.now
  },

  source: {
    type: String,
    default: 'quota_dds2'
  }
}, { timestamps: true });

TariffQuotaSchema.index({ orderNumber: 1, year: 1 }, { unique: true });
TariffQuotaSchema.index({ taricCodes: 1, year: 1 });

module.exports = mongoose.model('TariffQuota', TariffQuotaSchema);
