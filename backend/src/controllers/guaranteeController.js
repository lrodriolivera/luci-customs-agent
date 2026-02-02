/**
 * Guarantee Controller
 * Controlador para gestion de garantias aduaneras
 */
const { Guarantee } = require('../models');
const guaranteeService = require('../services/guaranteeService');
const aiService = require('../services/aiService');
const logger = require('../config/logger');

/**
 * Listar garantias
 * GET /api/guarantees
 */
exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      usage,
      search
    } = req.query;

    const query = { owner: req.user._id };

    if (status) query.status = status;
    if (type) query.type = type;
    if (usage) query.usage = usage;

    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { grn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [guarantees, total] = await Promise.all([
      Guarantee.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-movements -statusHistory'),
      Guarantee.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: guarantees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error listing guarantees:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar garantias',
      error: error.message
    });
  }
};

/**
 * Obtener estadisticas
 * GET /api/guarantees/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await guaranteeService.getStats(req.user._id);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting guarantee stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas',
      error: error.message
    });
  }
};

/**
 * Obtener alertas pendientes
 * GET /api/guarantees/alerts
 */
exports.getAlerts = async (req, res) => {
  try {
    const alerts = await guaranteeService.getPendingAlerts(req.user._id);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });

  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas',
      error: error.message
    });
  }
};

/**
 * Crear garantia
 * POST /api/guarantees
 */
exports.create = async (req, res) => {
  try {
    const result = await guaranteeService.createGuarantee(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: 'Garantia creada correctamente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error creating guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear garantia',
      error: error.message
    });
  }
};

/**
 * Obtener garantia
 * GET /api/guarantees/:id
 */
exports.get = async (req, res) => {
  try {
    const guarantee = await Guarantee.findOne({
      _id: req.params.id,
      owner: req.user._id
    }).populate('linkedExpeditions.expedition', 'reference status client');

    if (!guarantee) {
      return res.status(404).json({
        success: false,
        message: 'Garantia no encontrada'
      });
    }

    res.json({
      success: true,
      data: guarantee
    });

  } catch (error) {
    logger.error('Error getting guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener garantia',
      error: error.message
    });
  }
};

/**
 * Actualizar garantia (solo en draft)
 * PUT /api/guarantees/:id
 */
exports.update = async (req, res) => {
  try {
    const guarantee = await Guarantee.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!guarantee) {
      return res.status(404).json({
        success: false,
        message: 'Garantia no encontrada'
      });
    }

    if (guarantee.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `No se puede modificar garantia en estado ${guarantee.status}`
      });
    }

    const allowedFields = [
      'name', 'description', 'type', 'usage', 'totalAmount',
      'guarantor', 'validFrom', 'validUntil', 'alertThresholds', 'limits'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        guarantee[field] = req.body[field];
      }
    }

    await guarantee.save();

    res.json({
      success: true,
      message: 'Garantia actualizada',
      data: guarantee
    });

  } catch (error) {
    logger.error('Error updating guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar garantia',
      error: error.message
    });
  }
};

/**
 * Activar garantia
 * POST /api/guarantees/:id/activate
 */
exports.activate = async (req, res) => {
  try {
    const { grn, authNumber, authDate, customsOffice, notes } = req.body;

    if (!grn) {
      return res.status(400).json({
        success: false,
        message: 'GRN (Guarantee Reference Number) es requerido'
      });
    }

    const result = await guaranteeService.activateGuarantee(
      req.params.id,
      grn,
      { authNumber, authDate, customsOffice, notes },
      req.user._id
    );

    res.json({
      success: true,
      message: 'Garantia activada correctamente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error activating guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al activar garantia',
      error: error.message
    });
  }
};

/**
 * Calcular garantia requerida
 * POST /api/guarantees/calculate
 */
exports.calculate = async (req, res) => {
  try {
    const calculation = guaranteeService.calculateRequiredGuarantee(req.body);

    res.json({
      success: true,
      data: calculation
    });

  } catch (error) {
    logger.error('Error calculating guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular garantia',
      error: error.message
    });
  }
};

/**
 * Consumir garantia
 * POST /api/guarantees/:id/consume
 */
exports.consume = async (req, res) => {
  try {
    const { amount, referenceType, referenceId, referenceCode, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Importe debe ser positivo'
      });
    }

    const reference = {
      type: referenceType || 'manual',
      id: referenceId,
      code: referenceCode
    };

    const result = await guaranteeService.consumeGuarantee(
      req.params.id,
      amount,
      reference,
      description || 'Consumo manual',
      req.user._id
    );

    res.json({
      success: true,
      message: `Consumo de ${amount} EUR registrado`,
      data: result.data
    });

  } catch (error) {
    logger.error('Error consuming guarantee:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Liberar garantia
 * POST /api/guarantees/:id/release
 */
exports.release = async (req, res) => {
  try {
    const { amount, referenceType, referenceId, referenceCode, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Importe debe ser positivo'
      });
    }

    const reference = {
      type: referenceType || 'manual',
      id: referenceId,
      code: referenceCode
    };

    const result = await guaranteeService.releaseGuarantee(
      req.params.id,
      amount,
      reference,
      description || 'Liberacion manual',
      req.user._id
    );

    res.json({
      success: true,
      message: `Liberacion de ${amount} EUR registrada`,
      data: result.data
    });

  } catch (error) {
    logger.error('Error releasing guarantee:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Vincular a expediente
 * POST /api/guarantees/:id/link-expedition
 */
exports.linkExpedition = async (req, res) => {
  try {
    const { expeditionId, amount } = req.body;

    if (!expeditionId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'expeditionId y amount son requeridos'
      });
    }

    const result = await guaranteeService.linkToExpedition(
      req.params.id,
      expeditionId,
      amount,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Garantia vinculada a expediente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error linking guarantee to expedition:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Liberar de expediente
 * POST /api/guarantees/:id/release-expedition
 */
exports.releaseExpedition = async (req, res) => {
  try {
    const { expeditionId } = req.body;

    if (!expeditionId) {
      return res.status(400).json({
        success: false,
        message: 'expeditionId es requerido'
      });
    }

    const result = await guaranteeService.releaseFromExpedition(
      req.params.id,
      expeditionId,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Garantia liberada del expediente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error releasing guarantee from expedition:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Buscar garantia adecuada
 * GET /api/guarantees/find-suitable
 */
exports.findSuitable = async (req, res) => {
  try {
    const { amount, usage } = req.query;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'amount es requerido'
      });
    }

    const guarantee = await guaranteeService.findSuitableGuarantee(
      req.user._id,
      parseFloat(amount),
      usage || 'general'
    );

    if (!guarantee) {
      return res.json({
        success: true,
        data: null,
        message: 'No se encontro garantia adecuada'
      });
    }

    res.json({
      success: true,
      data: {
        _id: guarantee._id,
        reference: guarantee.reference,
        name: guarantee.name,
        type: guarantee.type,
        availableAmount: guarantee.availableAmount,
        totalAmount: guarantee.totalAmount
      }
    });

  } catch (error) {
    logger.error('Error finding suitable guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar garantia',
      error: error.message
    });
  }
};

/**
 * Renovar garantia
 * POST /api/guarantees/:id/renew
 */
exports.renew = async (req, res) => {
  try {
    const { newValidUntil, newAmount } = req.body;

    if (!newValidUntil) {
      return res.status(400).json({
        success: false,
        message: 'newValidUntil es requerido'
      });
    }

    const result = await guaranteeService.renewGuarantee(
      req.params.id,
      newValidUntil,
      newAmount,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Garantia renovada correctamente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error renewing guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al renovar garantia',
      error: error.message
    });
  }
};

/**
 * Suspender garantia
 * POST /api/guarantees/:id/suspend
 */
exports.suspend = async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await guaranteeService.suspendGuarantee(
      req.params.id,
      reason || 'Suspension solicitada',
      req.user._id
    );

    res.json({
      success: true,
      message: 'Garantia suspendida',
      data: result.data
    });

  } catch (error) {
    logger.error('Error suspending guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al suspender garantia',
      error: error.message
    });
  }
};

/**
 * Cancelar garantia
 * POST /api/guarantees/:id/cancel
 */
exports.cancel = async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await guaranteeService.cancelGuarantee(
      req.params.id,
      reason || 'Cancelacion solicitada',
      req.user._id
    );

    res.json({
      success: true,
      message: 'Garantia cancelada',
      data: result.data
    });

  } catch (error) {
    logger.error('Error cancelling guarantee:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Reconocer alerta
 * POST /api/guarantees/:id/alerts/:alertId/acknowledge
 */
exports.acknowledgeAlert = async (req, res) => {
  try {
    await guaranteeService.acknowledgeAlert(
      req.params.id,
      req.params.alertId,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Alerta reconocida'
    });

  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reconocer alerta',
      error: error.message
    });
  }
};

/**
 * Agregar documento
 * POST /api/guarantees/:id/document
 */
exports.addDocument = async (req, res) => {
  try {
    const guarantee = await Guarantee.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!guarantee) {
      return res.status(404).json({
        success: false,
        message: 'Garantia no encontrada'
      });
    }

    const { type, name, url, validUntil } = req.body;

    guarantee.documents.push({
      type,
      name,
      url,
      validUntil: validUntil ? new Date(validUntil) : undefined
    });

    await guarantee.save();

    res.json({
      success: true,
      message: 'Documento agregado',
      data: guarantee
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
 * Obtener movimientos
 * GET /api/guarantees/:id/movements
 */
exports.getMovements = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const guarantee = await Guarantee.findOne({
      _id: req.params.id,
      owner: req.user._id
    }).select('reference movements');

    if (!guarantee) {
      return res.status(404).json({
        success: false,
        message: 'Garantia no encontrada'
      });
    }

    // Paginar movimientos (mas recientes primero)
    const movements = guarantee.movements
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: guarantee.movements.length
      }
    });

  } catch (error) {
    logger.error('Error getting movements:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener movimientos',
      error: error.message
    });
  }
};

/**
 * Generar informe
 * GET /api/guarantees/report
 */
exports.generateReport = async (req, res) => {
  try {
    const report = await guaranteeService.generateReport(req.user._id, req.query);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar informe',
      error: error.message
    });
  }
};

// ===========================================
// AI ENDPOINTS - LUCI Integration
// ===========================================

/**
 * Analizar necesidades de garantia para una operacion
 * POST /api/guarantees/ai/analyze-needs
 */
exports.aiAnalyzeNeeds = async (req, res) => {
  try {
    const { operation } = req.body;

    if (!operation) {
      return res.status(400).json({
        success: false,
        message: 'operation es requerido'
      });
    }

    // Obtener garantias existentes del usuario
    const existingGuarantees = await Guarantee.find({
      owner: req.user._id,
      status: 'active'
    }).select('reference name type usage totalAmount usedAmount availableAmount validUntil');

    const analysis = await aiService.analyzeGuaranteeNeeds(operation, existingGuarantees);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Error analyzing guarantee needs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al analizar necesidades de garantia',
      error: error.message
    });
  }
};

/**
 * Recomendar tipo de garantia optimo
 * POST /api/guarantees/ai/recommend-type
 */
exports.aiRecommendType = async (req, res) => {
  try {
    const { operatorProfile, operationDetails } = req.body;

    if (!operationDetails) {
      return res.status(400).json({
        success: false,
        message: 'operationDetails es requerido'
      });
    }

    // Construir perfil del operador si no se proporciona
    const profile = operatorProfile || {
      oeaStatus: req.user.oeaStatus || 'none',
      operationVolume: req.user.operationVolume || 'medium',
      historicalCompliance: req.user.historicalCompliance || 95
    };

    const recommendation = await aiService.recommendGuaranteeType(profile, operationDetails);

    res.json({
      success: true,
      data: recommendation
    });

  } catch (error) {
    logger.error('Error recommending guarantee type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al recomendar tipo de garantia',
      error: error.message
    });
  }
};

/**
 * Optimizar uso de garantias existentes
 * POST /api/guarantees/ai/optimize
 */
exports.aiOptimize = async (req, res) => {
  try {
    const { upcomingOperations } = req.body;

    // Obtener garantias activas del usuario
    const guarantees = await Guarantee.find({
      owner: req.user._id,
      status: { $in: ['active', 'draft'] }
    }).select('reference name type usage totalAmount usedAmount availableAmount validUntil utilizationRate linkedExpeditions');

    if (guarantees.length === 0) {
      return res.json({
        success: true,
        data: {
          currentStatus: {
            totalGuarantees: 0,
            message: 'No hay garantias activas para optimizar'
          },
          recommendation: 'Considere crear garantias antes de realizar operaciones aduaneras'
        }
      });
    }

    const optimization = await aiService.optimizeGuaranteeUsage(guarantees, upcomingOperations || []);

    res.json({
      success: true,
      data: optimization
    });

  } catch (error) {
    logger.error('Error optimizing guarantees:', error);
    res.status(500).json({
      success: false,
      message: 'Error al optimizar garantias',
      error: error.message
    });
  }
};

/**
 * Calcular importe optimo de garantia con IA
 * POST /api/guarantees/ai/smart-calculate
 */
exports.aiSmartCalculate = async (req, res) => {
  try {
    const { operation } = req.body;

    if (!operation) {
      return res.status(400).json({
        success: false,
        message: 'operation es requerido'
      });
    }

    const calculation = await aiService.calculateSmartGuaranteeAmount(operation);

    res.json({
      success: true,
      data: calculation
    });

  } catch (error) {
    logger.error('Error calculating smart guarantee:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular garantia inteligente',
      error: error.message
    });
  }
};

/**
 * Analisis completo de garantias
 * POST /api/guarantees/ai/full-analysis
 */
exports.aiFullAnalysis = async (req, res) => {
  try {
    const { operation, upcomingOperations } = req.body;

    // Obtener garantias del usuario
    const guarantees = await Guarantee.find({
      owner: req.user._id,
      status: { $in: ['active', 'draft'] }
    });

    // Perfil del operador
    const operatorProfile = {
      oeaStatus: req.user.oeaStatus || 'none',
      operationVolume: req.user.operationVolume || 'medium',
      historicalCompliance: req.user.historicalCompliance || 95
    };

    // Ejecutar analisis en paralelo
    const [needsAnalysis, typeRecommendation, optimization, smartCalculation] = await Promise.all([
      operation ? aiService.analyzeGuaranteeNeeds(operation, guarantees) : null,
      operation ? aiService.recommendGuaranteeType(operatorProfile, operation) : null,
      guarantees.length > 0 ? aiService.optimizeGuaranteeUsage(guarantees, upcomingOperations || []) : null,
      operation ? aiService.calculateSmartGuaranteeAmount(operation) : null
    ]);

    // Calcular score de preparacion
    let readinessScore = 0;
    let factors = [];

    if (guarantees.length > 0) {
      const activeGuarantees = guarantees.filter(g => g.status === 'active');
      const totalAvailable = activeGuarantees.reduce((sum, g) => sum + (g.availableAmount || 0), 0);

      if (activeGuarantees.length > 0) {
        readinessScore += 30;
        factors.push('Tiene garantias activas');
      }

      if (totalAvailable > 50000) {
        readinessScore += 20;
        factors.push('Disponibilidad suficiente');
      }

      if (optimization?.utilizationAnalysis?.averageUtilization < 80) {
        readinessScore += 15;
        factors.push('Margen de utilizacion disponible');
      }
    }

    if (needsAnalysis?.existingCoverage?.sufficient) {
      readinessScore += 35;
      factors.push('Cobertura existente suficiente');
    }

    // Generar proximos pasos
    const nextSteps = [];

    if (needsAnalysis && !needsAnalysis.existingCoverage?.sufficient) {
      nextSteps.push({
        priority: 1,
        action: 'Aumentar cobertura de garantia',
        details: needsAnalysis.recommendation
      });
    }

    if (optimization?.optimizations?.length > 0) {
      nextSteps.push({
        priority: 2,
        action: 'Aplicar optimizaciones sugeridas',
        details: `${optimization.optimizations.length} optimizaciones identificadas`
      });
    }

    if (typeRecommendation?.recommendedType) {
      nextSteps.push({
        priority: 3,
        action: `Considerar ${typeRecommendation.recommendedType}`,
        details: typeRecommendation.reasoning
      });
    }

    res.json({
      success: true,
      data: {
        needsAnalysis,
        typeRecommendation,
        optimization,
        smartCalculation,
        summary: {
          readinessScore,
          factors,
          totalActiveGuarantees: guarantees.filter(g => g.status === 'active').length,
          totalAvailableAmount: guarantees
            .filter(g => g.status === 'active')
            .reduce((sum, g) => sum + (g.availableAmount || 0), 0)
        },
        nextSteps: nextSteps.sort((a, b) => a.priority - b.priority)
      }
    });

  } catch (error) {
    logger.error('Error in full guarantee analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error al realizar analisis completo',
      error: error.message
    });
  }
};

/**
 * Obtener ultimo analisis guardado
 * GET /api/guarantees/ai/analysis
 */
exports.getAiAnalysis = async (req, res) => {
  try {
    // Por ahora retornamos null ya que el analisis no se guarda
    // En el futuro se podria guardar en una coleccion aparte
    res.json({
      success: true,
      data: null,
      message: 'Los analisis de garantias se generan bajo demanda'
    });

  } catch (error) {
    logger.error('Error getting AI analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener analisis',
      error: error.message
    });
  }
};
