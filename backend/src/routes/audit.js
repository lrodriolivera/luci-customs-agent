const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const auditService = require('../services/auditService');

/**
 * @openapi
 * /api/audit:
 *   get:
 *     tags: [admin]
 *     summary: Query audit log (admin only, tenant-scoped)
 *     parameters:
 *       - { in: query, name: userId, schema: { type: string } }
 *       - { in: query, name: resource, schema: { type: string } }
 *       - { in: query, name: resourceId, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 1000 } }
 *     responses:
 *       200: { description: Lista de entradas de audit }
 */
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const results = await auditService.query({
      tenantId: req.user.tenantId,
      userId: req.query.userId,
      resource: req.query.resource,
      resourceId: req.query.resourceId,
      from: req.query.from,
      to: req.query.to,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
