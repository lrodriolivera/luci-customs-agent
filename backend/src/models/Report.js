/**
 * Report Model
 *
 * Informes de analitica generados (ejecutivo, financiero, cumplimiento...).
 * Antes vivian en un `Map` en memoria dentro de reportsService: se perdian en
 * cada reinicio del contenedor y el aislamiento entre tenants dependia solo de
 * comparar `generatedBy` en el codigo de aplicacion, nunca de una consulta a
 * BD acotada por tenant. Persistir en Mongo con tenantId obligatorio permite
 * filtrar SIEMPRE por tenant en la consulta, igual que el resto de recursos.
 *
 * tenantId es obligatorio en un informe nuevo: no hay informes "de plataforma"
 * (super_admin ve TODOS los tenants via filtroTenantOPlataforma, no necesita
 * un informe sin tenant). Ver tests/models/tenantIdRequerido.db.test.js para
 * el mismo patron en ChatMessage e InspectorCommunication.
 */

const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true,
    required: [function () { return this.isNew; }, 'tenantId es obligatorio en un informe nuevo']
  },

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  type: { type: String, required: true },
  template: String,
  format: { type: String, required: true },
  period: { type: String, required: true },

  metadata: {
    title: String,
    subtitle: String,
    organization: String,
    logo: String
  },

  // Secciones del informe (forma variable segun el tipo), resumen ejecutivo e
  // insights de LUCI: estructura heterogenea por diseno (ver reportsService).
  sections: { type: mongoose.Schema.Types.Mixed, default: {} },
  summary: mongoose.Schema.Types.Mixed,
  luciInsights: mongoose.Schema.Types.Mixed,

  generatedAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: 'reports'
});

// Listado por tenant ordenado por fecha: la consulta mas frecuente (listReports).
ReportSchema.index({ tenantId: 1, generatedAt: -1 });

// insertMany no dispara los validadores 'required' por defecto: sin esto, un
// alta masiva sin tenantId se guardaria igual (mismo motivo que en ChatMessage).
ReportSchema.pre('insertMany', function (next, docs) {
  const sinTenant = (docs || []).some((d) => !d.tenantId);
  if (sinTenant) return next(new Error('tenantId es obligatorio en un informe nuevo'));
  next();
});

module.exports = mongoose.model('Report', ReportSchema);
