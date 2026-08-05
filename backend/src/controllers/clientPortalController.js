/**
 * Client Portal Controller - Advanced Features
 * Phase 6.7: Portal Cliente Avanzado
 * Handles self-service, payments, stats, and signed documents
 */

const { Expedition, Payment, ClientApiKey } = require('../models');
const clientPortalService = require('../services/clientPortalService');
const paymentService = require('../services/paymentService');
const logger = require('../config/logger');

// ==================== Self-Service Operations ====================

/**
 * Create new expedition from portal (self-service)
 * POST /api/portal/self-service/expeditions
 */
const createExpedition = async (req, res) => {
  try {
    const { client, operation } = req.body;

    // Validate required fields
    if (!client?.companyName || !client?.email) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere nombre de empresa y email'
      });
    }

    if (!operation?.operationType) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere tipo de operacion (import/export/transit)'
      });
    }

    // Get organization ID from request or use default
    const organizationId = req.organizationId || req.body.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const result = await clientPortalService.createExpeditionFromPortal(
      organizationId,
      client,
      operation
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Expediente creado exitosamente'
    });

  } catch (error) {
    logger.error('Error creating self-service expedition:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear expediente'
    });
  }
};

/**
 * Update expedition from portal
 * PUT /api/portal/:token/expedition
 */
const updateExpedition = async (req, res) => {
  try {
    const { token } = req.params;
    const updates = req.body;

    const expedition = await clientPortalService.updateExpeditionFromPortal(token, updates);

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        status: expedition.status,
        updatedAt: expedition.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error updating expedition from portal:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Submit expedition for processing
 * POST /api/portal/:token/submit
 */
const submitExpedition = async (req, res) => {
  try {
    const { token } = req.params;

    const expedition = await clientPortalService.submitExpedition(token);

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        status: expedition.status
      },
      message: 'Expediente enviado para procesamiento'
    });

  } catch (error) {
    logger.error('Error submitting expedition:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

// ==================== Payment Operations ====================

/**
 * Get pending payments for expedition
 * GET /api/portal/:token/payments
 */
const getPayments = async (req, res) => {
  try {
    const { token } = req.params;

    const pendingInfo = await clientPortalService.getPendingPayments(token);
    const paymentHistory = await paymentService.getPaymentsByPortalToken(token);

    res.json({
      success: true,
      data: {
        pending: pendingInfo,
        history: paymentHistory.map(p => p.toClientSummary())
      }
    });

  } catch (error) {
    logger.error('Error getting payments:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Create payment for expedition
 * POST /api/portal/:token/payments
 */
const createPayment = async (req, res) => {
  try {
    const { token } = req.params;

    const expedition = await Expedition.findByPortalToken(token);
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Check if payment already exists
    const existingPayment = await paymentService.getPendingPaymentForExpedition(expedition._id);
    if (existingPayment) {
      return res.json({
        success: true,
        data: {
          payment: existingPayment.toClientSummary(),
          message: 'Ya existe un pago pendiente'
        }
      });
    }

    // Create new payment — Expedition uses tenantId, not organizationId
    const payment = await paymentService.createExpeditionPayment(
      expedition._id,
      expedition.tenantId || expedition.organizationId
    );

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        totalAmount: payment.totalAmount,
        currency: payment.currency,
        items: payment.items.map(i => ({
          description: i.description,
          type: i.type,
          amount: i.amount
        }))
      }
    });

  } catch (error) {
    logger.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear pago'
    });
  }
};

/**
 * Create Stripe checkout session
 * POST /api/portal/:token/payments/:paymentId/checkout
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { token, paymentId } = req.params;

    const session = await paymentService.createCheckoutSession(paymentId, token);

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear sesion de pago'
    });
  }
};

/**
 * Get payment status
 * GET /api/portal/:token/payments/:paymentId
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const status = await paymentService.getPaymentStatus(paymentId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error getting payment status:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Handle Stripe webhook
 * POST /api/payments/webhook
 */
const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await paymentService.handleWebhook(req.rawBody || req.body, signature);

    res.json(result);

  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// ==================== Statistics ====================

/**
 * Get client statistics
 * GET /api/portal/:token/stats
 */
const getClientStats = async (req, res) => {
  try {
    const { token } = req.params;

    const stats = await clientPortalService.getClientStats(token);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting client stats:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get client expedition history
 * GET /api/portal/:token/history
 */
const getClientHistory = async (req, res) => {
  try {
    const { token } = req.params;
    const { limit, skip, status, operationType } = req.query;

    const expedition = await Expedition.findByPortalToken(token);
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const clientEmail = expedition.client?.contact?.email;
    if (!clientEmail) {
      return res.json({
        success: true,
        data: {
          expeditions: [{
            expeditionId: expedition.expeditionId,
            operationType: expedition.operationType,
            status: expedition.status,
            createdAt: expedition.createdAt
          }],
          total: 1,
          hasMore: false
        }
      });
    }

    const history = await clientPortalService.getClientHistory(
      expedition.tenantId, // el campo real; organizationId no existe en el schema -> historial vacio
      clientEmail,
      {
        limit: parseInt(limit) || 50,
        skip: parseInt(skip) || 0,
        status,
        operationType
      }
    );

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Error getting client history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==================== Signed Documents ====================

/**
 * Get list of signed/official documents
 * GET /api/portal/:token/signed-documents
 */
const getSignedDocuments = async (req, res) => {
  try {
    const { token } = req.params;

    const documents = await clientPortalService.getSignedDocuments(token);

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    logger.error('Error getting signed documents:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Download levante document
 * GET /api/portal/:token/signed-documents/levante
 */
const downloadLevante = async (req, res) => {
  try {
    const { token } = req.params;

    const levanteData = await clientPortalService.generateLevanteDocument(token);

    // Return JSON for now (in production, generate PDF)
    res.json({
      success: true,
      data: levanteData
    });

  } catch (error) {
    logger.error('Error generating levante:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Download declaration copy
 * GET /api/portal/:token/signed-documents/declaration
 */
const downloadDeclaration = async (req, res) => {
  try {
    const { token } = req.params;

    const declarationData = await clientPortalService.generateDeclarationCopy(token);

    res.json({
      success: true,
      data: declarationData
    });

  } catch (error) {
    logger.error('Error generating declaration copy:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

// ==================== API Key Management ====================

/**
 * Create API key (for authenticated users)
 * POST /api/portal/api-keys
 */
const createApiKey = async (req, res) => {
  try {
    const { name, description, permissions, ipWhitelist, expiresAt } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'API key name is required'
      });
    }

    // Generate key
    const { key, prefix, hash } = ClientApiKey.generateKey();

    const apiKey = new ClientApiKey({
      organizationId: req.user.organizationId,
      name,
      description,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: permissions || ['expeditions:read', 'documents:read'],
      ipWhitelist: ipWhitelist || [],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id
    });

    await apiKey.save();

    // Return the actual key only once (won't be retrievable later)
    res.status(201).json({
      success: true,
      data: {
        ...apiKey.toSafeJSON(),
        key // Only returned on creation!
      },
      message: 'API key created. Save the key now - it will not be shown again.'
    });

  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * List API keys
 * GET /api/portal/api-keys
 */
const listApiKeys = async (req, res) => {
  try {
    const apiKeys = await ClientApiKey.find({
      organizationId: req.user.organizationId,
      status: { $ne: 'revoked' }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: apiKeys.map(k => k.toSafeJSON())
    });

  } catch (error) {
    logger.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Revoke API key
 * DELETE /api/portal/api-keys/:keyId
 */
const revokeApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const { reason } = req.body;

    const apiKey = await ClientApiKey.findOne({
      _id: keyId,
      organizationId: req.user.organizationId
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    await apiKey.revoke(req.user._id, reason || 'Revoked by user');

    res.json({
      success: true,
      message: 'API key revoked'
    });

  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  // Self-service
  createExpedition,
  updateExpedition,
  submitExpedition,

  // Payments
  getPayments,
  createPayment,
  createCheckoutSession,
  getPaymentStatus,
  handleStripeWebhook,

  // Stats
  getClientStats,
  getClientHistory,

  // Signed documents
  getSignedDocuments,
  downloadLevante,
  downloadDeclaration,

  // API keys
  createApiKey,
  listApiKeys,
  revokeApiKey
};
