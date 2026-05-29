const mongoose = require('mongoose');

const EmailSuppressionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  reason: { type: String, required: true, enum: ['BOUNCE_PERMANENT', 'BOUNCE_TRANSIENT', 'COMPLAINT', 'UNSUBSCRIBE', 'MANUAL'] },
  source: { type: String, enum: ['ses-feedback', 'user-request', 'admin'], default: 'ses-feedback' },
  bounceType: String,
  bounceSubType: String,
  complaintFeedbackType: String,
  diagnosticCode: String,
  messageId: String,
  expiresAt: { type: Date, default: null, index: { expireAfterSeconds: 0 } }
}, {
  timestamps: true,
  collection: 'emailsuppressions'
});

EmailSuppressionSchema.statics.isSuppressed = async function (email) {
  if (!email) return false;
  const doc = await this.findOne({ email: email.toLowerCase().trim() }).lean();
  return !!doc;
};

EmailSuppressionSchema.statics.suppress = async function (email, payload = {}) {
  const normalized = email.toLowerCase().trim();
  return this.findOneAndUpdate(
    { email: normalized },
    { $set: { email: normalized, ...payload } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('EmailSuppression', EmailSuppressionSchema);
