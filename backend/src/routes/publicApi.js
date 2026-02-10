/**
 * Public API Routes
 * Phase 6.7: Portal Cliente Avanzado
 * REST API v1 for client ERP integrations
 */

const express = require('express');
const router = express.Router();
const publicApiController = require('../controllers/publicApiController');
const { authenticateApiKey, requirePermission } = require('../middleware/apiKeyAuth');
const { auth: jwtAuth } = require('../middleware/auth');
const { ClientApiKey } = require('../models');
const logger = require('../config/logger');

// ==================== API Key Management (JWT Auth) ====================

/**
 * @route POST /api/v1/keys
 * @desc Generate a new API key (requires JWT login, not API key)
 * @access JWT Authenticated (admin)
 */
router.post('/keys', jwtAuth, async (req, res) => {
  try {
    const { name, permissions, ipWhitelist, expiresInDays } = req.body;

    const { key, prefix, hash } = ClientApiKey.generateKey();

    const apiKeyDoc = new ClientApiKey({
      name: name || 'API Key',
      keyPrefix: prefix,
      keyHash: hash,
      organizationId: req.user.tenantId || req.user._id,
      createdBy: req.user._id,
      permissions: permissions || [
        'classification:read', 'classification:write',
        'calculation:read',
        'expeditions:read',
        'stats:read'
      ],
      ipWhitelist: ipWhitelist || [],
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
      rateLimit: { requestsPerMinute: 60, requestsPerDay: 5000 }
    });

    await apiKeyDoc.save();

    logger.info(`API key created: ${prefix} by user ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: {
        apiKey: key,
        prefix,
        name: apiKeyDoc.name,
        permissions: apiKeyDoc.permissions,
        expiresAt: apiKeyDoc.expiresAt,
        rateLimit: apiKeyDoc.rateLimit,
        warning: 'Guarda esta API key de forma segura. No se puede recuperar.'
      }
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/v1/keys
 * @desc List API keys for current organization
 * @access JWT Authenticated
 */
router.get('/keys', jwtAuth, async (req, res) => {
  try {
    const keys = await ClientApiKey.find({
      organizationId: req.user.tenantId || req.user._id,
      status: 'active'
    }).select('-keyHash').sort({ createdAt: -1 });

    res.json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/v1/keys/:keyId
 * @desc Revoke an API key
 * @access JWT Authenticated
 */
router.delete('/keys/:keyId', jwtAuth, async (req, res) => {
  try {
    const key = await ClientApiKey.findOneAndUpdate(
      { _id: req.params.keyId, organizationId: req.user.tenantId || req.user._id },
      { status: 'revoked' },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, error: 'API key not found' });
    res.json({ success: true, data: { message: 'API key revoked' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Public API (API Key Auth) ====================

// All routes below require API key authentication
router.use(authenticateApiKey);

// ==================== Expeditions ====================

/**
 * @route GET /api/v1/expeditions
 * @desc List expeditions
 * @access API Key (expeditions:read)
 */
router.get(
  '/expeditions',
  requirePermission('expeditions:read'),
  publicApiController.listExpeditions
);

/**
 * @route GET /api/v1/expeditions/:expeditionId
 * @desc Get expedition details
 * @access API Key (expeditions:read)
 */
router.get(
  '/expeditions/:expeditionId',
  requirePermission('expeditions:read'),
  publicApiController.getExpedition
);

/**
 * @route POST /api/v1/expeditions
 * @desc Create new expedition
 * @access API Key (expeditions:create)
 */
router.post(
  '/expeditions',
  requirePermission('expeditions:create'),
  publicApiController.createExpedition
);

/**
 * @route PUT /api/v1/expeditions/:expeditionId
 * @desc Update expedition
 * @access API Key (expeditions:write)
 */
router.put(
  '/expeditions/:expeditionId',
  requirePermission('expeditions:write'),
  publicApiController.updateExpedition
);

/**
 * @route GET /api/v1/expeditions/:expeditionId/status
 * @desc Get expedition status
 * @access API Key (expeditions:read)
 */
router.get(
  '/expeditions/:expeditionId/status',
  requirePermission('expeditions:read'),
  publicApiController.getExpeditionStatus
);

// ==================== Documents ====================

/**
 * @route GET /api/v1/expeditions/:expeditionId/documents
 * @desc List documents for expedition
 * @access API Key (documents:read)
 */
router.get(
  '/expeditions/:expeditionId/documents',
  requirePermission('documents:read'),
  publicApiController.listDocuments
);

// ==================== Declarations ====================

/**
 * @route GET /api/v1/expeditions/:expeditionId/declaration
 * @desc Get declaration info
 * @access API Key (declarations:read)
 */
router.get(
  '/expeditions/:expeditionId/declaration',
  requirePermission('declarations:read'),
  publicApiController.getDeclaration
);

// ==================== Payments ====================

/**
 * @route GET /api/v1/payments
 * @desc List payments
 * @access API Key (payments:read)
 */
router.get(
  '/payments',
  requirePermission('payments:read'),
  publicApiController.listPayments
);

/**
 * @route GET /api/v1/payments/:paymentId
 * @desc Get payment details
 * @access API Key (payments:read)
 */
router.get(
  '/payments/:paymentId',
  requirePermission('payments:read'),
  publicApiController.getPayment
);

// ==================== Statistics ====================

/**
 * @route GET /api/v1/stats
 * @desc Get organization statistics
 * @access API Key (stats:read)
 */
router.get(
  '/stats',
  requirePermission('stats:read'),
  publicApiController.getStats
);

// ==================== TARIC Classification ====================

const classificationController = require('../controllers/classificationController');
const aiService = require('../services/aiService');
const { TaricCode } = require('../models');

/**
 * @route GET /api/v1/taric/:code
 * @desc Get TARIC code information
 * @access API Key (classification:read)
 */
router.get(
  '/taric/:code',
  requirePermission('classification:read'),
  async (req, res) => {
    try {
      const code = req.params.code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);

      // Try DB first
      const taricCode = await TaricCode.findOne({ code, isActive: true }).lean();
      if (taricCode) {
        return res.json({
          success: true,
          data: {
            code: taricCode.code,
            description: taricCode.description?.es || '',
            chapter: taricCode.breakdown?.chapter,
            heading: taricCode.breakdown?.heading,
            duties: taricCode.duties,
            vat: taricCode.vat,
            measures: taricCode.measures || [],
            source: 'database'
          }
        });
      }

      // Fallback to AI
      const aiInfo = await aiService.getTaricCodeInfo(code);
      res.json({
        success: true,
        data: {
          code,
          description: aiInfo.description_es || aiInfo.description || '',
          chapter: aiInfo.chapter,
          heading: aiInfo.heading,
          dutyRate: aiInfo.dutyRate,
          notes: aiInfo.notes,
          hierarchy: aiInfo.hierarchy,
          source: 'ai'
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/v1/taric/tree/:parent
 * @desc Get TARIC tree children for a parent code
 * @access API Key (classification:read)
 */
router.get(
  '/taric/tree/:parent',
  requirePermission('classification:read'),
  async (req, res) => {
    // Delegate to classification controller's getTreeData
    req.query.parent = req.params.parent;
    return classificationController.getTreeData(req, res);
  }
);

/**
 * @route POST /api/v1/classify
 * @desc Classify a product description using AI
 * @access API Key (classification:write)
 */
router.post(
  '/classify',
  requirePermission('classification:write'),
  async (req, res) => {
    try {
      const { description, material, use, origin } = req.body;

      if (!description) {
        return res.status(400).json({ success: false, error: 'description is required' });
      }

      const result = await aiService.classifyProduct({
        description,
        additionalInfo: { material, use, origin }
      });

      res.json({
        success: true,
        data: {
          suggestions: result.suggestions || [],
          warnings: result.warnings || [],
          additionalInfoNeeded: result.additionalInfoNeeded || []
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==================== Duty Calculation ====================

const dutyCalculationService = require('../services/dutyCalculationService');

/**
 * @route POST /api/v1/calculate
 * @desc Calculate duties, VAT and total taxes for an import
 * @access API Key (calculation:read)
 */
router.post(
  '/calculate',
  requirePermission('calculation:read'),
  async (req, res) => {
    try {
      const { taricCode, countryOfOrigin, customsValue, currency, preference, date } = req.body;

      if (!taricCode || !countryOfOrigin || !customsValue) {
        return res.status(400).json({
          success: false,
          error: 'Required fields: taricCode, countryOfOrigin, customsValue'
        });
      }

      const result = await dutyCalculationService.calculateDutiesWithAI({
        taricCode,
        countryOfOrigin,
        customsValue: parseFloat(customsValue),
        currency: currency || 'EUR',
        preference: preference || '100',
        date: date || new Date().toISOString()
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/v1/countries
 * @desc List available countries with ISO codes
 * @access API Key (calculation:read)
 */
router.get(
  '/countries',
  requirePermission('calculation:read'),
  async (req, res) => {
    try {
      const countries = require('../data/countries') || [];
      res.json({ success: true, data: countries });
    } catch (error) {
      // Return basic list if catalog not available
      res.json({ success: true, data: [] });
    }
  }
);

module.exports = router;
