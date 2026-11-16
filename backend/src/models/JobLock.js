const mongoose = require('mongoose');

/**
 * Candado de una tarea periódica (p. ej. la consulta automática de estados en
 * la AEAT) para que, con varias réplicas o tras un reinicio, solo una la
 * ejecute en cada intervalo. El _id es el nombre de la tarea. Ver
 * services/candadoMongo.js.
 */
const JobLockSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  lockedUntil: { type: Date, required: true },
  dueno: String,
  adquiridoEn: Date
}, { versionKey: false });

module.exports = mongoose.models.JobLock || mongoose.model('JobLock', JobLockSchema);
