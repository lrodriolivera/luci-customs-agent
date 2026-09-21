const mongoose = require('mongoose');

/**
 * Central audit log for GDPR compliance and traceability.
 *
 * Records WHO did WHAT on WHICH resource, WHEN and from WHERE.
 * Append-only (no updates, no deletes by API).
 *
 * Retention: 4 years, then purged by a documented DBA procedure — NOT by cron.
 * A cron job cannot purge this collection: the hooks below reject deleteMany,
 * including our own. That is deliberate; a log the app can erase is not evidence.
 * See docs/compliance/retention-policy.md §2.4 for the procedure.
 */
const AuditLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  userEmail: String,

  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  resourceId: { type: String, index: true },

  method: String,
  url: String,
  ip: String,
  userAgent: String,
  requestId: String,

  status: { type: Number },
  success: { type: Boolean, default: true },
  errorMessage: String,

  changes: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed,

  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false,
  collection: 'auditlogs'
});

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });

// Prevent updates/deletes via Mongoose (defense in depth; DB user should also restrict)
AuditLogSchema.pre('findOneAndUpdate', function(next) { next(new Error('AuditLog is append-only')); });
AuditLogSchema.pre('updateOne',        function(next) { next(new Error('AuditLog is append-only')); });
AuditLogSchema.pre('updateMany',       function(next) { next(new Error('AuditLog is append-only')); });
AuditLogSchema.pre('deleteOne',        function(next) { next(new Error('AuditLog is append-only')); });
AuditLogSchema.pre('deleteMany',       function(next) { next(new Error('AuditLog is append-only')); });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
