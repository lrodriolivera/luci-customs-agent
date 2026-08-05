/**
 * Public API Controller
 * Phase 6.7: Portal Cliente Avanzado
 * REST API for client ERP integrations
 */

const mongoose = require('mongoose');
const { Expedition, Payment } = require('../models');
const logger = require('../config/logger');

// aggregate() no castea los tipos como find(): hay que forzar el ObjectId en $match.
const toObjectId = (id) =>
  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);

// ==================== Expeditions ====================

/**
 * List expeditions
 * GET /api/v1/expeditions
 */
const listExpeditions = async (req, res) => {
  try {
    const {
      status,
      operationType,
      fromDate,
      toDate,
      limit = 50,
      skip = 0,
      sort = '-createdAt'
    } = req.query;

    const query = { tenantId: req.organizationId };

    if (status) query.status = status;
    if (operationType) query.operationType = operationType;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const expeditions = await Expedition.find(query)
      .select('expeditionId operationType status client.companyName createdAt declaration.mrn declaration.channel')
      .sort(sort)
      .skip(parseInt(skip))
      .limit(Math.min(parseInt(limit), 100));

    const total = await Expedition.countDocuments(query);

    res.json({
      success: true,
      data: {
        expeditions: expeditions.map(exp => ({
          expeditionId: exp.expeditionId,
          operationType: exp.operationType,
          status: exp.status,
          clientName: exp.client?.companyName,
          mrn: exp.declaration?.mrn,
          channel: exp.declaration?.channel,
          createdAt: exp.createdAt
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + expeditions.length < total
        }
      }
    });

  } catch (error) {
    logger.error('Public API - List expeditions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Get expedition by ID
 * GET /api/v1/expeditions/:expeditionId
 */
const getExpedition = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findOne({
      expeditionId,
      tenantId: req.organizationId
    });

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expedition not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        operationType: expedition.operationType,
        transportMode: expedition.transportMode,
        status: expedition.status,
        client: {
          companyName: expedition.client?.companyName,
          taxId: expedition.client?.nif,
          eoriNumber: expedition.client?.eori
        },
        goods: expedition.goods.map(g => ({
          itemNumber: g.itemNumber,
          description: g.description,
          taricCode: g.taricCode,
          quantity: g.quantity,
          unit: g.unit,
          invoiceValue: g.invoiceValue,
          currency: g.currency,
          originCountry: g.originCountry
        })),
        declaration: expedition.declaration ? {
          type: expedition.declaration.type,
          mrn: expedition.declaration.mrn,
          status: expedition.declaration.status,
          channel: expedition.declaration.channel,
          submittedAt: expedition.declaration.submittedAt,
          acceptanceDate: expedition.declaration.acceptanceDate,
          levanteDate: expedition.declaration.levanteDate
        } : null,
        calculations: expedition.calculations ? {
          invoiceTotal: expedition.calculations.invoiceTotalEur,
          dutyTotal: expedition.calculations.totalDuties,
          vatTotal: expedition.calculations.totalVat,
          totalToPay: expedition.calculations.totalToPay,
          paid: expedition.calculations.paid
        } : null,
        documentCompletion: expedition.documentCompletion,
        origin: expedition.origin,
        destination: expedition.destination,
        incoterm: expedition.incoterm,
        createdAt: expedition.createdAt,
        updatedAt: expedition.updatedAt
      }
    });

  } catch (error) {
    logger.error('Public API - Get expedition error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Create expedition via API
 * POST /api/v1/expeditions
 */
const createExpedition = async (req, res) => {
  try {
    const {
      operationType,
      transportMode,
      client,
      goods,
      origin,
      destination,
      incoterm,
      transport,
      notes
    } = req.body;

    // Validate required fields
    if (!operationType || !['import', 'export', 'transit'].includes(operationType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid operationType required (import/export/transit)',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!client?.companyName) {
      return res.status(400).json({
        success: false,
        error: 'client.companyName required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Generate expedition ID
    const prefix = operationType === 'import' ? 'IMP' : operationType === 'export' ? 'EXP' : 'TRA';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const expeditionId = `${prefix}-${timestamp}-${random}`;

    // Generate portal token
    const { v4: uuidv4 } = require('uuid');
    const portalToken = uuidv4();

    const expedition = new Expedition({
      expeditionId,
      tenantId: req.organizationId,
      operationType,
      transportMode: transportMode || 'maritime',
      status: 'draft',
      client: {
        companyName: client.companyName,
        nif: client.taxId,
        eori: client.eoriNumber,
        contact: client.contact || {},
        address: client.address || {}
      },
      goods: (goods || []).map((g, i) => ({
        itemNumber: i + 1,
        description: g.description,
        taricCode: g.taricCode,
        hsCode: g.hsCode,
        originCountry: g.originCountry,
        quantity: g.quantity || 1,
        unit: g.unit || 'KG',
        grossWeight: g.grossWeight,
        netWeight: g.netWeight,
        invoiceValue: g.invoiceValue || 0,
        currency: g.currency || 'EUR'
      })),
      origin: origin || {},
      destination: destination || { country: 'ES' },
      // incoterm en el schema es { code, place }; la API acepta un string simple.
      incoterm: typeof incoterm === 'string' ? { code: incoterm } : (incoterm || { code: 'CIF' }),
      transport: transport || {},
      clientNotes: notes,
      clientPortal: {
        token: portalToken,
        accessUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/portal/${portalToken}`,
        isActive: true,
        createdAt: new Date()
      },
      timeline: [{
        action: 'created',
        description: 'Expediente creado via API',
        performedBy: 'api',
        metadata: {
          apiKeyPrefix: req.apiKey?.keyPrefix,
          source: 'public_api'
        }
      }]
    });

    await expedition.save();

    logger.info(`API created expedition: ${expeditionId} by key ${req.apiKey?.keyPrefix}`);

    res.status(201).json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        status: expedition.status,
        portalToken,
        portalUrl: expedition.clientPortal.accessUrl,
        createdAt: expedition.createdAt
      }
    });

  } catch (error) {
    logger.error('Public API - Create expedition error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Update expedition via API
 * PUT /api/v1/expeditions/:expeditionId
 */
const updateExpedition = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const updates = req.body;

    const expedition = await Expedition.findOne({
      expeditionId,
      tenantId: req.organizationId
    });

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expedition not found',
        code: 'NOT_FOUND'
      });
    }

    // Only allow updates on draft expeditions
    if (expedition.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify expedition in current status',
        code: 'INVALID_STATUS'
      });
    }

    // Allowed update fields
    const allowedFields = ['client', 'goods', 'origin', 'destination', 'incoterm', 'transport', 'clientNotes'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'goods') {
          expedition.goods = updates.goods.map((g, i) => ({
            itemNumber: i + 1,
            description: g.description,
            taricCode: g.taricCode,
            hsCode: g.hsCode,
            originCountry: g.originCountry,
            quantity: g.quantity || 1,
            unit: g.unit || 'KG',
            grossWeight: g.grossWeight,
            netWeight: g.netWeight,
            invoiceValue: g.invoiceValue || 0,
            currency: g.currency || 'EUR'
          }));
        } else if (field === 'client') {
          expedition.client = {
            ...expedition.client.toObject(),
            ...updates.client
          };
        } else if (field === 'incoterm') {
          // incoterm en el schema es { code, place }; la API acepta un string simple.
          expedition.incoterm = typeof updates.incoterm === 'string'
            ? { code: updates.incoterm }
            : updates.incoterm;
        } else {
          expedition[field] = updates[field];
        }
      }
    }

    expedition.timeline.push({
      action: 'updated',
      description: 'Expediente actualizado via API',
      performedBy: 'api',
      metadata: { apiKeyPrefix: req.apiKey?.keyPrefix }
    });

    await expedition.save();

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        status: expedition.status,
        updatedAt: expedition.updatedAt
      }
    });

  } catch (error) {
    logger.error('Public API - Update expedition error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Get expedition status
 * GET /api/v1/expeditions/:expeditionId/status
 */
const getExpeditionStatus = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findOne({
      expeditionId,
      tenantId: req.organizationId
    }).select('expeditionId status declaration documentCompletion timeline');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expedition not found',
        code: 'NOT_FOUND'
      });
    }

    // Get recent timeline events
    const recentEvents = expedition.timeline
      .slice(-10)
      .reverse()
      .map(e => ({
        action: e.action,
        description: e.description,
        timestamp: e.timestamp
      }));

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        status: expedition.status,
        declaration: expedition.declaration ? {
          mrn: expedition.declaration.mrn,
          status: expedition.declaration.status,
          channel: expedition.declaration.channel,
          levanteDate: expedition.declaration.levanteDate
        } : null,
        documentCompletion: expedition.documentCompletion,
        recentEvents
      }
    });

  } catch (error) {
    logger.error('Public API - Get status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// ==================== Documents ====================

/**
 * List documents for expedition
 * GET /api/v1/expeditions/:expeditionId/documents
 */
const listDocuments = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findOne({
      expeditionId,
      tenantId: req.organizationId
    }).select('expeditionId documents documentChecklist');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expedition not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        documents: expedition.documents.map(doc => ({
          id: doc._id,
          type: doc.type,
          fileName: doc.originalName || doc.fileName,
          status: doc.status,
          uploadedAt: doc.uploadedAt
        })),
        checklist: expedition.documentChecklist.map(item => ({
          documentType: item.documentType,
          documentName: item.documentName,
          required: item.required,
          received: item.received,
          validated: item.validated
        }))
      }
    });

  } catch (error) {
    logger.error('Public API - List documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// ==================== Declarations ====================

/**
 * Get declaration info
 * GET /api/v1/expeditions/:expeditionId/declaration
 */
const getDeclaration = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findOne({
      expeditionId,
      tenantId: req.organizationId
    }).select('expeditionId declaration calculations');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expedition not found',
        code: 'NOT_FOUND'
      });
    }

    if (!expedition.declaration) {
      return res.status(404).json({
        success: false,
        error: 'No declaration for this expedition',
        code: 'NO_DECLARATION'
      });
    }

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        declaration: {
          type: expedition.declaration.type,
          mrn: expedition.declaration.mrn,
          lrn: expedition.declaration.lrn,
          regime: expedition.declaration.regime,
          status: expedition.declaration.status,
          channel: expedition.declaration.channel,
          customsOffice: expedition.declaration.customsOffice,
          submittedAt: expedition.declaration.submittedAt,
          acceptanceDate: expedition.declaration.acceptanceDate,
          levanteDate: expedition.declaration.levanteDate
        },
        calculations: expedition.calculations ? {
          dutyTotal: expedition.calculations.totalDuties,
          vatTotal: expedition.calculations.totalVat,
          totalToPay: expedition.calculations.totalToPay,
          paid: expedition.calculations.paid
        } : null
      }
    });

  } catch (error) {
    logger.error('Public API - Get declaration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// ==================== Payments ====================

/**
 * List payments
 * GET /api/v1/payments
 */
const listPayments = async (req, res) => {
  try {
    const { status, fromDate, toDate, limit = 50, skip = 0 } = req.query;

    const query = { organizationId: req.organizationId };

    if (status) query.status = status;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(Math.min(parseInt(limit), 100));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments: payments.map(p => p.toClientSummary()),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + payments.length < total
        }
      }
    });

  } catch (error) {
    logger.error('Public API - List payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Get payment by ID
 * GET /api/v1/payments/:paymentId
 */
const getPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      paymentId,
      organizationId: req.organizationId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: payment.toClientSummary()
    });

  } catch (error) {
    logger.error('Public API - Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// ==================== Stats ====================

/**
 * Get organization statistics
 * GET /api/v1/stats
 */
const getStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const dateQuery = {};
    if (fromDate) dateQuery.$gte = new Date(fromDate);
    if (toDate) dateQuery.$lte = new Date(toDate);

    const orgObjectId = toObjectId(req.organizationId);
    const expeditionQuery = { tenantId: orgObjectId };
    if (Object.keys(dateQuery).length) {
      expeditionQuery.createdAt = dateQuery;
    }

    // Expedition stats
    const expeditionStats = await Expedition.aggregate([
      { $match: expeditionQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Channel stats
    const channelStats = await Expedition.aggregate([
      { $match: { ...expeditionQuery, 'declaration.channel': { $exists: true } } },
      {
        $group: {
          _id: '$declaration.channel',
          count: { $sum: 1 }
        }
      }
    ]);

    // Payment stats
    const paymentStats = await Payment.aggregate([
      { $match: { organizationId: orgObjectId, status: 'completed', ...(Object.keys(dateQuery).length ? { paidAt: dateQuery } : {}) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        expeditions: {
          byStatus: Object.fromEntries(expeditionStats.map(s => [s._id, s.count])),
          total: expeditionStats.reduce((acc, s) => acc + s.count, 0)
        },
        channels: {
          byChannel: Object.fromEntries(channelStats.map(s => [s._id, s.count])),
          total: channelStats.reduce((acc, s) => acc + s.count, 0)
        },
        payments: paymentStats[0] || { totalAmount: 0, count: 0 },
        period: {
          from: fromDate || 'all time',
          to: toDate || 'now'
        }
      }
    });

  } catch (error) {
    logger.error('Public API - Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  // Expeditions
  listExpeditions,
  getExpedition,
  createExpedition,
  updateExpedition,
  getExpeditionStatus,

  // Documents
  listDocuments,

  // Declarations
  getDeclaration,

  // Payments
  listPayments,
  getPayment,

  // Stats
  getStats
};
