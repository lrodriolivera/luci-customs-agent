const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { User, Expedition, H7Declaration, ENSDeclaration, PUERequest, Transit, AuditLog } = require('../models');
const auditService = require('../services/auditService');
const logger = require('../config/logger');

/**
 * @openapi
 * /api/gdpr/export:
 *   get:
 *     tags: [auth]
 *     summary: GDPR data export (user requests all their personal data)
 *     description: Returns a JSON with every record tied to the authenticated user. Art. 15 GDPR.
 *     responses:
 *       200: { description: Zipped JSON of user data }
 */
router.get('/export', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const tenantId = req.user.tenantId;

    const [user, expeditions, h7s, ens, pues, transits, audit] = await Promise.all([
      User.findById(userId).select('-password -resetPasswordToken').lean(),
      Expedition.find({ tenantId, createdBy: userId }).lean().setOptions({ withDeleted: true }),
      H7Declaration.find({ tenantId, createdBy: userId }).lean().setOptions({ withDeleted: true }),
      ENSDeclaration.find({ tenantId, createdBy: userId }).lean(),
      PUERequest.find({ tenantId, createdBy: userId }).lean(),
      Transit.find({ tenantId }).lean(),
      AuditLog.find({ userId }).sort({ timestamp: -1 }).limit(5000).lean()
    ]);

    req.audit?.({ action: 'gdpr_export', resource: 'User', resourceId: userId, metadata: { records: { expeditions: expeditions.length, h7s: h7s.length, audit: audit.length } } });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="luci-gdpr-export-${userId}-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      exportedFor: { userId, email: user?.email, tenantId },
      article: 'GDPR Art. 15 - Right of access',
      data: { user, expeditions, h7Declarations: h7s, ensDeclarations: ens, pueRequests: pues, transits, auditLog: audit }
    });
  } catch (err) {
    logger.error('GDPR export failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

/**
 * @openapi
 * /api/gdpr/delete-account:
 *   post:
 *     tags: [auth]
 *     summary: GDPR account deletion (soft-delete + anonymize PII)
 *     description: |
 *       Art. 17 GDPR "Right to erasure". Anonymizes the user's email/name/profile
 *       and soft-deletes the account. Associated customs records are retained
 *       for legal obligations (Art. 17.3.b - tax & customs retention 6-10 years)
 *       but the personal data fields are anonymized.
 *     responses:
 *       200: { description: Account deleted and anonymized }
 */
router.post('/delete-account', auth, async (req, res) => {
  try {
    const user = req.user;
    const confirm = req.body?.confirm;
    if (confirm !== 'DELETE') {
      return res.status(400).json({ success: false, error: "Body must include { confirm: 'DELETE' }" });
    }

    const anonymizedEmail = `deleted-${user._id}@anonymized.invalid`;
    const snapshot = { email: user.email, name: user.name };

    user.email = anonymizedEmail;
    user.name = 'Deleted User';
    user.profile = {};
    user.permissions = {};
    user.isActive = false;
    user.password = require('crypto').randomBytes(32).toString('hex'); // unloginable
    await user.softDelete(String(user._id));

    req.audit?.({ action: 'gdpr_delete_account', resource: 'User', resourceId: user._id, metadata: { previousEmail: snapshot.email } });
    logger.info('GDPR account deletion', { userId: user._id });

    res.json({
      success: true,
      message: 'Cuenta eliminada y datos personales anonimizados. Los registros aduaneros se retienen por obligación legal (AEAT) y están desvinculados de su identidad.'
    });
  } catch (err) {
    logger.error('GDPR delete-account failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Deletion failed' });
  }
});

module.exports = router;
