/**
 * Public API Routes
 * Phase 6.7: Portal Cliente Avanzado
 * REST API v1 for client ERP integrations
 */

const express = require('express');
const router = express.Router();
const publicApiController = require('../controllers/publicApiController');
const { authenticateApiKey, requirePermission } = require('../middleware/apiKeyAuth');

// All routes require API key authentication
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

module.exports = router;
