/**
 * Payment Routes
 * Phase 6.7: Portal Cliente Avanzado
 * Handles Stripe webhooks and payment management
 */

const express = require('express');
const router = express.Router();
const clientPortalController = require('../controllers/clientPortalController');
const paymentService = require('../services/paymentService');
const { authenticate, requireRole } = require('../middleware/auth');
const logger = require('../config/logger');

// ==================== Stripe Webhook (must be before body parser) ====================

/**
 * @route POST /api/payments/webhook
 * @desc Handle Stripe webhook events
 * @access Public (verified by Stripe signature)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  clientPortalController.handleStripeWebhook
);

// ==================== Authenticated Payment Routes ====================

/**
 * @route GET /api/payments
 * @desc List organization payments
 * @access Authenticated (admin)
 */
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const { Payment } = require('../models');

    const query = { organizationId: req.user.organizationId };
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        total,
        hasMore: parseInt(skip) + payments.length < total
      }
    });
  } catch (error) {
    logger.error('Error listing payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/payments/stats
 * @desc Get payment statistics
 * @access Authenticated (admin)
 */
router.get('/stats', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await paymentService.getPaymentStats(
      req.user.organizationId,
      { startDate, endDate }
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting payment stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/payments/:paymentId
 * @desc Get payment details
 * @access Authenticated
 */
router.get('/:paymentId', authenticate, async (req, res) => {
  try {
    const { Payment } = require('../models');
    const payment = await Payment.findOne({
      paymentId: req.params.paymentId,
      organizationId: req.user.organizationId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Error getting payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/payments/manual
 * @desc Create manual payment record
 * @access Authenticated (admin)
 */
router.post('/manual', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const payment = await paymentService.createManualPayment(
      req.user.organizationId,
      req.body
    );

    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Error creating manual payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/payments/:paymentId/confirm
 * @desc Confirm manual payment
 * @access Authenticated (admin)
 */
router.post('/:paymentId/confirm', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const payment = await paymentService.confirmManualPayment(
      req.params.paymentId,
      req.user._id
    );

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Error confirming payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/payments/:paymentId/refund
 * @desc Refund payment
 * @access Authenticated (admin)
 */
router.post('/:paymentId/refund', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { amount, reason } = req.body;

    const payment = await paymentService.refundPayment(
      req.params.paymentId,
      amount,
      reason,
      req.user._id
    );

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Error refunding payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
