/**
 * Contador atomico y monotono para las referencias de los modelos.
 *
 * El `_id` es la clave del contador (p.ej. `ENSDeclaration:reference:ENS-2026`),
 * asi que la unicidad la garantiza Mongo sin indices adicionales.
 */
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
