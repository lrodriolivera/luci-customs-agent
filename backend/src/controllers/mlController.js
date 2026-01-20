/**
 * ML Controller
 * Phase 6.5: Advanced Machine Learning
 * REST API endpoints for ML services
 */

const mlServices = require('../services/ml');
const logger = require('../config/logger');

// ==================== Channel Prediction ====================

/**
 * Predict customs channel for a declaration
 * POST /api/ml/predict-channel
 */
const predictChannel = async (req, res) => {
  try {
    const declaration = req.body;

    if (!declaration.originCountry || !declaration.goods) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere originCountry y goods'
      });
    }

    const result = mlServices.predictChannel(declaration);

    logger.info('Channel prediction requested', {
      country: declaration.originCountry,
      channel: result.predictedChannel,
      confidence: result.confidence
    });

    res.json(result);
  } catch (error) {
    logger.error('Channel prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en predicción de circuito'
    });
  }
};

/**
 * Batch predict channels for multiple declarations
 * POST /api/ml/predict-channel/batch
 */
const batchPredictChannels = async (req, res) => {
  try {
    const { declarations } = req.body;

    if (!Array.isArray(declarations) || declarations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de declaraciones'
      });
    }

    const result = mlServices.batchPredictChannels(declarations);
    res.json(result);
  } catch (error) {
    logger.error('Batch channel prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en predicción por lotes'
    });
  }
};

/**
 * Record channel prediction feedback
 * POST /api/ml/predict-channel/feedback
 */
const recordChannelFeedback = async (req, res) => {
  try {
    const { predictionId, actualChannel, notes } = req.body;

    if (!predictionId || !actualChannel) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere predictionId y actualChannel'
      });
    }

    const result = mlServices.recordChannelFeedback(predictionId, actualChannel, notes);
    res.json(result);
  } catch (error) {
    logger.error('Channel feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar feedback'
    });
  }
};

/**
 * Get channel prediction statistics
 * GET /api/ml/predict-channel/stats
 */
const getChannelStats = async (req, res) => {
  try {
    const result = mlServices.getChannelStats();
    res.json(result);
  } catch (error) {
    logger.error('Channel stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};

// ==================== Fraud Detection ====================

/**
 * Analyze declaration for potential fraud
 * POST /api/ml/fraud/analyze
 */
const analyzeForFraud = async (req, res) => {
  try {
    const declaration = req.body;

    if (!declaration.goods || !Array.isArray(declaration.goods)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de goods'
      });
    }

    const result = mlServices.analyzeForFraud(declaration);

    logger.info('Fraud analysis completed', {
      riskLevel: result.overallRiskLevel,
      score: result.riskScore,
      alerts: result.alerts?.length || 0
    });

    res.json(result);
  } catch (error) {
    logger.error('Fraud analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en análisis de fraude'
    });
  }
};

/**
 * Quick risk assessment
 * POST /api/ml/fraud/quick-check
 */
const quickRiskAssessment = async (req, res) => {
  try {
    const declaration = req.body;
    const result = mlServices.quickRiskAssessment(declaration);
    res.json(result);
  } catch (error) {
    logger.error('Quick risk assessment error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en evaluación rápida'
    });
  }
};

/**
 * Get fraud detection statistics
 * GET /api/ml/fraud/stats
 */
const getFraudStats = async (req, res) => {
  try {
    const result = mlServices.getFraudStats();
    res.json(result);
  } catch (error) {
    logger.error('Fraud stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};

/**
 * Record fraud detection feedback
 * POST /api/ml/fraud/feedback
 */
const recordFraudFeedback = async (req, res) => {
  try {
    const { analysisId, wasActualFraud, fraudType, notes } = req.body;

    if (!analysisId || wasActualFraud === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere analysisId y wasActualFraud'
      });
    }

    const result = mlServices.recordFraudFeedback(analysisId, wasActualFraud, fraudType, notes);
    res.json(result);
  } catch (error) {
    logger.error('Fraud feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar feedback'
    });
  }
};

// ==================== Classification ====================

/**
 * Classify product with ML-enhanced TARIC codes
 * POST /api/ml/classify
 */
const classifyProduct = async (req, res) => {
  try {
    const productData = req.body;

    if (!productData.description) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere descripción del producto'
      });
    }

    const result = mlServices.classifyProduct(productData);

    logger.info('Product classified', {
      code: result.classification?.code,
      confidence: result.confidence
    });

    res.json(result);
  } catch (error) {
    logger.error('Classification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en clasificación'
    });
  }
};

/**
 * Record classification feedback
 * POST /api/ml/classify/feedback
 */
const recordClassificationFeedback = async (req, res) => {
  try {
    const { classificationId, correctCode, notes } = req.body;

    if (!classificationId || !correctCode) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere classificationId y correctCode'
      });
    }

    const result = mlServices.recordClassificationFeedback(classificationId, correctCode, notes);
    res.json(result);
  } catch (error) {
    logger.error('Classification feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar feedback'
    });
  }
};

/**
 * Get classification statistics
 * GET /api/ml/classify/stats
 */
const getClassificationStats = async (req, res) => {
  try {
    const result = mlServices.getClassificationStats();
    res.json(result);
  } catch (error) {
    logger.error('Classification stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};

/**
 * Get classification patterns
 * GET /api/ml/classify/patterns
 */
const getClassificationPatterns = async (req, res) => {
  try {
    res.json({
      success: true,
      patterns: mlServices.CLASSIFICATION_PATTERNS
    });
  } catch (error) {
    logger.error('Classification patterns error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener patrones'
    });
  }
};

// ==================== Recommendations ====================

/**
 * Generate proactive recommendations
 * POST /api/ml/recommendations
 */
const generateRecommendations = async (req, res) => {
  try {
    const context = req.body;

    if (!context.operation && !context.goods) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere operation o goods'
      });
    }

    const result = mlServices.generateRecommendations(context);

    logger.info('Recommendations generated', {
      count: result.recommendations?.length || 0,
      potentialSavings: result.totalPotentialSavings
    });

    res.json(result);
  } catch (error) {
    logger.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar recomendaciones'
    });
  }
};

/**
 * Get quick recommendations
 * GET /api/ml/recommendations/quick
 */
const getQuickRecommendations = async (req, res) => {
  try {
    const { originCountry, taricCode, value, regime } = req.query;

    const result = mlServices.getQuickRecommendations({
      originCountry,
      taricCode,
      value: value ? parseFloat(value) : undefined,
      regime
    });

    res.json(result);
  } catch (error) {
    logger.error('Quick recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en recomendaciones rápidas'
    });
  }
};

/**
 * Get recommendation statistics
 * GET /api/ml/recommendations/stats
 */
const getRecommendationStats = async (req, res) => {
  try {
    const result = mlServices.getRecommendationStats();
    res.json(result);
  } catch (error) {
    logger.error('Recommendation stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};

/**
 * Record recommendation feedback
 * POST /api/ml/recommendations/feedback
 */
const recordRecommendationFeedback = async (req, res) => {
  try {
    const { recommendationId, wasUseful, wasImplemented, actualSavings, notes } = req.body;

    if (!recommendationId || wasUseful === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere recommendationId y wasUseful'
      });
    }

    const result = mlServices.recordRecommendationFeedback(
      recommendationId,
      wasUseful,
      wasImplemented,
      actualSavings,
      notes
    );
    res.json(result);
  } catch (error) {
    logger.error('Recommendation feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar feedback'
    });
  }
};

// ==================== Auto Response ====================

/**
 * Generate auto-response for AEAT requirement
 * POST /api/ml/auto-response
 */
const generateAutoResponse = async (req, res) => {
  try {
    const { requirement, declaration, expeditionData } = req.body;

    if (!requirement || !requirement.type) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere requirement con tipo'
      });
    }

    const result = mlServices.generateAutoResponse(requirement, declaration, expeditionData);

    logger.info('Auto-response generated', {
      type: requirement.type,
      confidence: result.confidence,
      requiresReview: result.requiresReview
    });

    res.json(result);
  } catch (error) {
    logger.error('Auto-response error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar respuesta'
    });
  }
};

/**
 * Get template preview
 * POST /api/ml/auto-response/preview
 */
const getTemplatePreview = async (req, res) => {
  try {
    const { templateId, context } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere templateId'
      });
    }

    const result = mlServices.getTemplatePreview(templateId, context);
    res.json(result);
  } catch (error) {
    logger.error('Template preview error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener preview'
    });
  }
};

/**
 * List available response templates
 * GET /api/ml/auto-response/templates
 */
const listResponseTemplates = async (req, res) => {
  try {
    const result = mlServices.listResponseTemplates();
    res.json(result);
  } catch (error) {
    logger.error('List templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar plantillas'
    });
  }
};

/**
 * Get auto-response statistics
 * GET /api/ml/auto-response/stats
 */
const getAutoResponseStats = async (req, res) => {
  try {
    const result = mlServices.getAutoResponseStats();
    res.json(result);
  } catch (error) {
    logger.error('Auto-response stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};

/**
 * Record auto-response feedback
 * POST /api/ml/auto-response/feedback
 */
const recordResponseFeedback = async (req, res) => {
  try {
    const { responseId, wasAccepted, wasModified, acceptedByAEAT, notes } = req.body;

    if (!responseId || wasAccepted === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere responseId y wasAccepted'
      });
    }

    const result = mlServices.recordResponseFeedback(
      responseId,
      wasAccepted,
      wasModified,
      acceptedByAEAT,
      notes
    );
    res.json(result);
  } catch (error) {
    logger.error('Response feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar feedback'
    });
  }
};

// ==================== Combined Stats ====================

/**
 * Get overall ML system statistics
 * GET /api/ml/stats
 */
const getOverallStats = async (req, res) => {
  try {
    const channelStats = mlServices.getChannelStats();
    const fraudStats = mlServices.getFraudStats();
    const classificationStats = mlServices.getClassificationStats();
    const recommendationStats = mlServices.getRecommendationStats();
    const autoResponseStats = mlServices.getAutoResponseStats();

    res.json({
      success: true,
      statistics: {
        channelPrediction: channelStats.statistics,
        fraudDetection: fraudStats.statistics,
        classification: classificationStats.statistics,
        recommendations: recommendationStats.statistics,
        autoResponse: autoResponseStats.statistics,
        systemHealth: {
          allServicesOperational: true,
          lastUpdated: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Overall stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas generales'
    });
  }
};

module.exports = {
  // Channel Prediction
  predictChannel,
  batchPredictChannels,
  recordChannelFeedback,
  getChannelStats,

  // Fraud Detection
  analyzeForFraud,
  quickRiskAssessment,
  getFraudStats,
  recordFraudFeedback,

  // Classification
  classifyProduct,
  recordClassificationFeedback,
  getClassificationStats,
  getClassificationPatterns,

  // Recommendations
  generateRecommendations,
  getQuickRecommendations,
  getRecommendationStats,
  recordRecommendationFeedback,

  // Auto Response
  generateAutoResponse,
  getTemplatePreview,
  listResponseTemplates,
  getAutoResponseStats,
  recordResponseFeedback,

  // Combined
  getOverallStats
};
