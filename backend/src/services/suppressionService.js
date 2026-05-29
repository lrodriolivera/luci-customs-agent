const EmailSuppression = require('../models/EmailSuppression');
const logger = require('../config/logger');

const TRANSIENT_RETRY_DAYS = 7;

async function isSuppressed(email) {
  try {
    return await EmailSuppression.isSuppressed(email);
  } catch (err) {
    logger.warn('Suppression check failed, defaulting to allow', { error: err.message });
    return false;
  }
}

async function recordBounce(payload) {
  const { bounce, mail } = payload;
  if (!bounce || !mail) return;
  const isPermanent = bounce.bounceType === 'Permanent';
  const reason = isPermanent ? 'BOUNCE_PERMANENT' : 'BOUNCE_TRANSIENT';
  const expiresAt = isPermanent ? null : new Date(Date.now() + TRANSIENT_RETRY_DAYS * 86400000);

  for (const recipient of bounce.bouncedRecipients || []) {
    await EmailSuppression.suppress(recipient.emailAddress, {
      reason,
      source: 'ses-feedback',
      bounceType: bounce.bounceType,
      bounceSubType: bounce.bounceSubType,
      diagnosticCode: recipient.diagnosticCode,
      messageId: mail.messageId,
      expiresAt
    });
    logger.info('Email suppressed (bounce)', { email: recipient.emailAddress, type: bounce.bounceType, subType: bounce.bounceSubType });
  }
}

async function recordComplaint(payload) {
  const { complaint, mail } = payload;
  if (!complaint || !mail) return;
  for (const recipient of complaint.complainedRecipients || []) {
    await EmailSuppression.suppress(recipient.emailAddress, {
      reason: 'COMPLAINT',
      source: 'ses-feedback',
      complaintFeedbackType: complaint.complaintFeedbackType,
      messageId: mail.messageId,
      expiresAt: null
    });
    logger.warn('Email suppressed (complaint)', { email: recipient.emailAddress, type: complaint.complaintFeedbackType });
  }
}

async function recordUnsubscribe(email, source = 'user-request') {
  if (!email) return null;
  const doc = await EmailSuppression.suppress(email, { reason: 'UNSUBSCRIBE', source, expiresAt: null });
  logger.info('Email suppressed (unsubscribe)', { email, source });
  return doc;
}

async function remove(email) {
  if (!email) return false;
  const result = await EmailSuppression.deleteOne({ email: email.toLowerCase().trim() });
  return result.deletedCount > 0;
}

module.exports = { isSuppressed, recordBounce, recordComplaint, recordUnsubscribe, remove };
