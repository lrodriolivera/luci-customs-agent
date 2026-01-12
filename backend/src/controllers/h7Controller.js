/**
 * H7 Controller
 * Controlador para declaraciones H7 (e-commerce bajo valor)
 */
const { H7Declaration } = require('../models');
const h7Service = require('../services/h7Service');
const logger = require('../config/logger');

/**
 * Listar declaraciones H7
 * GET /api/h7
 */
exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      carrier,
      startDate,
      endDate,
      search
    } = req.query;

    const query = { createdBy: req.user._id };

    if (status) query.status = status;
    if (carrier) query['carrier.code'] = carrier;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { trackingNumber: { $regex: search, $options: 'i' } },
        { mrn: { $regex: search, $options: 'i' } },
        { 'recipient.name': { $regex: search, $options: 'i' } },
        { 'recipient.taxId': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [declarations, total] = await Promise.all([
      H7Declaration.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-statusHistory -notes'),
      H7Declaration.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: declarations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error listing H7 declarations:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar declaraciones H7',
      error: error.message
    });
  }
};

/**
 * Obtener estadisticas
 * GET /api/h7/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await h7Service.getStats({
      ...req.query,
      createdBy: req.user._id
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting H7 stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas',
      error: error.message
    });
  }
};

/**
 * Crear declaracion H7
 * POST /api/h7
 */
exports.create = async (req, res) => {
  try {
    const result = await h7Service.createDeclaration(req.body, req.user._id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Error de validacion H7',
        errors: result.errors,
        suggestion: result.suggestion
      });
    }

    res.status(201).json({
      success: true,
      message: 'Declaracion H7 creada correctamente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error creating H7 declaration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear declaracion H7',
      error: error.message
    });
  }
};

/**
 * Crear H7 desde expediente
 * POST /api/h7/from-expedition/:expeditionId
 */
exports.createFromExpedition = async (req, res) => {
  try {
    const result = await h7Service.createFromExpedition(
      req.params.expeditionId,
      req.user._id
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Error al crear H7 desde expediente',
        errors: result.errors
      });
    }

    res.status(201).json({
      success: true,
      message: 'Declaracion H7 creada desde expediente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error creating H7 from expedition:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear H7 desde expediente',
      error: error.message
    });
  }
};

/**
 * Obtener declaracion H7
 * GET /api/h7/:id
 */
exports.get = async (req, res) => {
  try {
    const declaration = await H7Declaration.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    }).populate('expedition', 'reference status');

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion H7 no encontrada'
      });
    }

    res.json({
      success: true,
      data: declaration
    });

  } catch (error) {
    logger.error('Error getting H7 declaration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener declaracion H7',
      error: error.message
    });
  }
};

/**
 * Actualizar declaracion H7 (solo en draft)
 * PUT /api/h7/:id
 */
exports.update = async (req, res) => {
  try {
    const declaration = await H7Declaration.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion H7 no encontrada'
      });
    }

    if (declaration.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `No se puede modificar declaracion en estado ${declaration.status}`
      });
    }

    // Campos actualizables
    const allowedFields = [
      'trackingNumber', 'carrier', 'iossNumber', 'sender', 'recipient',
      'items', 'totals', 'documents', 'operationType', 'ecommercePlatform'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        declaration[field] = req.body[field];
      }
    }

    // Recalcular valores
    const calculated = h7Service.calculateValues(declaration.toObject());
    declaration.totals = calculated.totals;
    declaration.duties = calculated.duties;
    declaration.vatPrepaid = calculated.vatPrepaid;

    // Calcular derechos
    declaration.calculateDuties();

    await declaration.save();

    res.json({
      success: true,
      message: 'Declaracion H7 actualizada',
      data: declaration
    });

  } catch (error) {
    logger.error('Error updating H7 declaration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar declaracion H7',
      error: error.message
    });
  }
};

/**
 * Validar elegibilidad H7
 * POST /api/h7/validate
 */
exports.validate = async (req, res) => {
  try {
    const eligibility = h7Service.checkH7Eligibility(req.body);

    // Verificar productos restringidos
    const restrictedItems = [];
    if (req.body.items) {
      for (const item of req.body.items) {
        const check = h7Service.checkRestrictedGoods(item.taricCode);
        if (check.restricted) {
          restrictedItems.push({
            description: item.description,
            taricCode: item.taricCode,
            reason: check.reason
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        eligible: eligibility.eligible && restrictedItems.length === 0,
        errors: eligibility.errors,
        restrictedItems,
        calculatedValue: eligibility.calculatedValue,
        suggestion: eligibility.suggestion
      }
    });

  } catch (error) {
    logger.error('Error validating H7:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar H7',
      error: error.message
    });
  }
};

/**
 * Validar numero IOSS
 * GET /api/h7/validate-ioss/:iossNumber
 */
exports.validateIOSS = async (req, res) => {
  try {
    const result = await h7Service.validateIOSS(req.params.iossNumber);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error validating IOSS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar IOSS',
      error: error.message
    });
  }
};

/**
 * Enviar declaracion a AEAT
 * POST /api/h7/:id/submit
 */
exports.submit = async (req, res) => {
  try {
    const result = await h7Service.submitToAEAT(req.params.id, req.user._id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Error al enviar declaracion',
        errors: result.errors
      });
    }

    res.json({
      success: true,
      message: '[DEMO] Declaracion H7 enviada a AEAT',
      data: result.data
    });

  } catch (error) {
    logger.error('Error submitting H7:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar declaracion H7',
      error: error.message
    });
  }
};

/**
 * Procesar lote de declaraciones
 * POST /api/h7/batch
 */
exports.processBatch = async (req, res) => {
  try {
    const { declarations } = req.body;

    if (!declarations || !Array.isArray(declarations) || declarations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de declaraciones'
      });
    }

    if (declarations.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximo 100 declaraciones por lote'
      });
    }

    const result = await h7Service.processBatch(declarations, req.user._id);

    res.json({
      success: true,
      message: `Lote procesado: ${result.successful}/${result.total} exitosas`,
      data: result
    });

  } catch (error) {
    logger.error('Error processing H7 batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar lote',
      error: error.message
    });
  }
};

/**
 * Importar desde CSV
 * POST /api/h7/import-csv
 */
exports.importCSV = async (req, res) => {
  try {
    const { csv, autoSubmit = false } = req.body;

    if (!csv) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere contenido CSV'
      });
    }

    // Parsear CSV
    const declarations = h7Service.parseCSVBatch(csv);

    // Procesar lote
    const result = await h7Service.processBatch(declarations, req.user._id, {
      autoSubmit
    });

    res.json({
      success: true,
      message: `CSV importado: ${result.successful}/${result.total} declaraciones creadas`,
      data: result
    });

  } catch (error) {
    logger.error('Error importing CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Error al importar CSV',
      error: error.message
    });
  }
};

/**
 * Detectar fraude de valor
 * GET /api/h7/:id/fraud-check
 */
exports.fraudCheck = async (req, res) => {
  try {
    const declaration = await H7Declaration.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion no encontrada'
      });
    }

    const result = await h7Service.detectValueFraud(declaration);

    // Guardar resultado de validacion
    declaration.validations.valueCheck = {
      checked: true,
      flagged: result.flagged,
      reason: result.flags.map(f => f.message).join('; '),
      checkedAt: new Date()
    };
    await declaration.save();

    res.json({
      success: true,
      data: {
        reference: declaration.reference,
        ...result
      }
    });

  } catch (error) {
    logger.error('Error checking fraud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar fraude',
      error: error.message
    });
  }
};

/**
 * Cancelar declaracion
 * POST /api/h7/:id/cancel
 */
exports.cancel = async (req, res) => {
  try {
    const declaration = await H7Declaration.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion no encontrada'
      });
    }

    const cancellableStatuses = ['draft', 'pending', 'validating'];
    if (!cancellableStatuses.includes(declaration.status)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cancelar declaracion en estado ${declaration.status}`
      });
    }

    declaration.status = 'cancelled';
    declaration.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      user: req.user._id,
      reason: req.body.reason || 'Cancelada por usuario'
    });

    await declaration.save();

    res.json({
      success: true,
      message: 'Declaracion H7 cancelada',
      data: declaration
    });

  } catch (error) {
    logger.error('Error cancelling H7:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar declaracion',
      error: error.message
    });
  }
};

/**
 * Agregar documento
 * POST /api/h7/:id/document
 */
exports.addDocument = async (req, res) => {
  try {
    const declaration = await H7Declaration.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion no encontrada'
      });
    }

    const { type, name, url } = req.body;

    declaration.documents.push({
      type,
      name,
      url,
      uploadedAt: new Date()
    });

    await declaration.save();

    res.json({
      success: true,
      message: 'Documento agregado',
      data: declaration
    });

  } catch (error) {
    logger.error('Error adding document:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar documento',
      error: error.message
    });
  }
};

/**
 * Calcular derechos estimados
 * POST /api/h7/calculate-duties
 */
exports.calculateDuties = async (req, res) => {
  try {
    const calculated = h7Service.calculateValues(req.body);

    // Crear objeto temporal para calcular
    const tempDeclaration = new H7Declaration(calculated);
    tempDeclaration.calculateDuties();

    res.json({
      success: true,
      data: {
        totals: tempDeclaration.totals,
        duties: tempDeclaration.duties,
        vatPrepaid: tempDeclaration.vatPrepaid
      }
    });

  } catch (error) {
    logger.error('Error calculating duties:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular derechos',
      error: error.message
    });
  }
};
