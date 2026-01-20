/**
 * Channel Prediction Service
 * ML-based prediction of customs channel assignment
 * Phase 6.5: Advanced Machine Learning
 */

const logger = require('../../config/logger');

// ==================== Risk Factors Configuration ====================

/**
 * Risk weights for different factors
 * Based on historical AEAT patterns and customs expertise
 */
const RISK_WEIGHTS = {
  // Country risk factors (0-1 scale)
  countryRisk: {
    high: ['CN', 'HK', 'TR', 'AE', 'PK', 'BD', 'VN', 'IN', 'TH', 'MY'],
    medium: ['MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'EG', 'MA', 'ZA', 'NG'],
    low: ['US', 'CA', 'JP', 'KR', 'AU', 'NZ', 'SG', 'CH', 'NO', 'GB'],
    eu: ['DE', 'FR', 'IT', 'NL', 'BE', 'PT', 'PL', 'AT', 'SE', 'DK', 'FI', 'IE', 'CZ', 'RO', 'HU', 'GR']
  },

  // Product category risk (TARIC chapters)
  productRisk: {
    high: ['84', '85', '61', '62', '63', '64', '42', '71', '90', '95'], // Electronics, textiles, leather, jewelry, toys
    medium: ['39', '73', '94', '87', '69', '70', '44', '48'], // Plastics, iron, furniture, vehicles
    low: ['01', '02', '03', '04', '07', '08', '09', '10', '15', '17', '19', '20', '21', '22'] // Food products
  },

  // Value thresholds (EUR)
  valueThresholds: {
    veryHigh: 500000,
    high: 100000,
    medium: 50000,
    low: 10000
  },

  // Operator history factors
  operatorHistory: {
    newOperator: 0.3,
    previousIssues: 0.4,
    goodHistory: -0.2,
    oeaCertified: -0.4
  }
};

// ==================== Historical Data Storage ====================

// In-memory storage for demo (use MongoDB in production)
const predictionHistory = new Map();
const feedbackData = [];
let modelVersion = '1.0.0';
let modelAccuracy = 0.85;

// ==================== Feature Extraction ====================

/**
 * Extract features from operation data
 */
function extractFeatures(operationData) {
  const {
    originCountry,
    destinationCountry = 'ES',
    taricCode,
    customsValue,
    weight,
    declarationType,
    operatorNIF,
    operatorHistory = {},
    documents = [],
    previousDeclarations = 0
  } = operationData;

  const features = {
    // Geographic features
    originCountryRisk: calculateCountryRisk(originCountry),
    isEUOrigin: RISK_WEIGHTS.countryRisk.eu.includes(originCountry) ? 1 : 0,

    // Product features
    taricChapter: taricCode ? taricCode.substring(0, 2) : '00',
    productRiskScore: calculateProductRisk(taricCode),

    // Value features
    customsValue: customsValue || 0,
    valueCategory: categorizeValue(customsValue),
    valuePerKg: weight > 0 ? (customsValue / weight) : 0,

    // Operator features
    isNewOperator: previousDeclarations < 5,
    operatorRiskScore: calculateOperatorRisk(operatorHistory),
    hasOEA: operatorHistory.oea || false,

    // Document features
    documentCount: documents.length,
    hasOriginCertificate: documents.some(d =>
      ['EUR1', 'FORM_A', 'ATR', 'ORIGIN'].includes(d.type?.toUpperCase())
    ),
    hasInvoice: documents.some(d => d.type?.toUpperCase() === 'INVOICE'),

    // Declaration features
    declarationType: declarationType || 'H1',
    isImport: declarationType !== 'AES',

    // Temporal features
    dayOfWeek: new Date().getDay(),
    monthOfYear: new Date().getMonth(),
    isEndOfQuarter: [2, 5, 8, 11].includes(new Date().getMonth())
  };

  return features;
}

/**
 * Calculate country risk score (0-1)
 */
function calculateCountryRisk(countryCode) {
  if (!countryCode) return 0.5;

  if (RISK_WEIGHTS.countryRisk.eu.includes(countryCode)) return 0.1;
  if (RISK_WEIGHTS.countryRisk.low.includes(countryCode)) return 0.2;
  if (RISK_WEIGHTS.countryRisk.medium.includes(countryCode)) return 0.5;
  if (RISK_WEIGHTS.countryRisk.high.includes(countryCode)) return 0.8;

  return 0.5; // Unknown country
}

/**
 * Calculate product risk score (0-1)
 */
function calculateProductRisk(taricCode) {
  if (!taricCode) return 0.5;

  const chapter = taricCode.substring(0, 2);

  if (RISK_WEIGHTS.productRisk.low.includes(chapter)) return 0.2;
  if (RISK_WEIGHTS.productRisk.medium.includes(chapter)) return 0.4;
  if (RISK_WEIGHTS.productRisk.high.includes(chapter)) return 0.7;

  return 0.5;
}

/**
 * Categorize value for risk assessment
 */
function categorizeValue(value) {
  if (!value) return 'unknown';
  if (value >= RISK_WEIGHTS.valueThresholds.veryHigh) return 'very_high';
  if (value >= RISK_WEIGHTS.valueThresholds.high) return 'high';
  if (value >= RISK_WEIGHTS.valueThresholds.medium) return 'medium';
  if (value >= RISK_WEIGHTS.valueThresholds.low) return 'low';
  return 'very_low';
}

/**
 * Calculate operator risk based on history
 */
function calculateOperatorRisk(history) {
  let risk = 0.3; // Base risk

  if (history.isNew) risk += RISK_WEIGHTS.operatorHistory.newOperator;
  if (history.previousIssues) risk += RISK_WEIGHTS.operatorHistory.previousIssues;
  if (history.goodHistory) risk += RISK_WEIGHTS.operatorHistory.goodHistory;
  if (history.oea) risk += RISK_WEIGHTS.operatorHistory.oeaCertified;

  return Math.max(0, Math.min(1, risk));
}

// ==================== Prediction Model ====================

/**
 * Calculate channel probabilities using weighted scoring
 */
function calculateChannelProbabilities(features) {
  // Base probabilities (from historical distribution)
  let greenProb = 0.70;
  let yellowProb = 0.15;
  let orangeProb = 0.10;
  let redProb = 0.05;

  // Adjust based on country risk
  const countryAdjustment = features.originCountryRisk * 0.3;
  greenProb -= countryAdjustment;
  orangeProb += countryAdjustment * 0.5;
  redProb += countryAdjustment * 0.5;

  // Adjust based on product risk
  const productAdjustment = features.productRiskScore * 0.25;
  greenProb -= productAdjustment;
  orangeProb += productAdjustment * 0.6;
  redProb += productAdjustment * 0.4;

  // Adjust based on value
  if (features.valueCategory === 'very_high') {
    greenProb -= 0.2;
    orangeProb += 0.15;
    redProb += 0.05;
  } else if (features.valueCategory === 'high') {
    greenProb -= 0.1;
    orangeProb += 0.1;
  }

  // Adjust based on operator
  if (features.hasOEA) {
    greenProb += 0.15;
    orangeProb -= 0.1;
    redProb -= 0.05;
  }

  if (features.isNewOperator) {
    greenProb -= 0.1;
    yellowProb += 0.05;
    orangeProb += 0.05;
  }

  // Adjust based on documents
  if (!features.hasOriginCertificate && !features.isEUOrigin) {
    yellowProb += 0.1;
    greenProb -= 0.1;
  }

  if (!features.hasInvoice) {
    yellowProb += 0.15;
    greenProb -= 0.15;
  }

  // Value per kg anomaly detection (potential undervaluation)
  if (features.valuePerKg > 0 && features.valuePerKg < 1) {
    orangeProb += 0.1;
    greenProb -= 0.1;
  }

  // Normalize probabilities
  const total = greenProb + yellowProb + orangeProb + redProb;

  return {
    green: Math.max(0, greenProb / total),
    yellow: Math.max(0, yellowProb / total),
    orange: Math.max(0, orangeProb / total),
    red: Math.max(0, redProb / total)
  };
}

/**
 * Determine most likely channel
 */
function determineChannel(probabilities) {
  const entries = Object.entries(probabilities);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// ==================== Public API ====================

/**
 * Predict customs channel for an operation
 * @param {Object} operationData - Operation details
 * @returns {Object} Prediction result
 */
function predictChannel(operationData) {
  try {
    // Extract features
    const features = extractFeatures(operationData);

    // Calculate probabilities
    const probabilities = calculateChannelProbabilities(features);

    // Determine predicted channel
    const predictedChannel = determineChannel(probabilities);

    // Calculate overall risk score
    const riskScore = 1 - probabilities.green;

    // Generate risk factors explanation
    const riskFactors = generateRiskFactors(features, operationData);

    // Generate recommendations
    const recommendations = generateRecommendations(features, riskFactors);

    const prediction = {
      predictedChannel,
      confidence: probabilities[predictedChannel],
      probabilities: {
        green: Math.round(probabilities.green * 100),
        yellow: Math.round(probabilities.yellow * 100),
        orange: Math.round(probabilities.orange * 100),
        red: Math.round(probabilities.red * 100)
      },
      riskScore: Math.round(riskScore * 100),
      riskLevel: riskScore < 0.2 ? 'low' : riskScore < 0.4 ? 'medium' : riskScore < 0.6 ? 'high' : 'very_high',
      riskFactors,
      recommendations,
      features: {
        countryRisk: features.originCountryRisk,
        productRisk: features.productRiskScore,
        operatorRisk: features.operatorRiskScore,
        valueCategory: features.valueCategory
      },
      modelVersion,
      modelAccuracy: Math.round(modelAccuracy * 100),
      timestamp: new Date().toISOString()
    };

    // Store prediction for feedback loop
    const predictionId = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    predictionHistory.set(predictionId, {
      ...prediction,
      operationData,
      createdAt: new Date()
    });

    prediction.predictionId = predictionId;

    logger.info('Channel prediction generated', {
      predictionId,
      predictedChannel,
      confidence: prediction.confidence
    });

    return {
      success: true,
      prediction
    };
  } catch (error) {
    logger.error('Channel prediction error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate risk factors explanation
 */
function generateRiskFactors(features, operationData) {
  const factors = [];

  // Country risk
  if (features.originCountryRisk >= 0.7) {
    factors.push({
      factor: 'origin_country',
      severity: 'high',
      description: `Pais de origen ${operationData.originCountry} tiene alto riesgo aduanero`,
      impact: '+25% probabilidad inspeccion'
    });
  } else if (features.originCountryRisk >= 0.5) {
    factors.push({
      factor: 'origin_country',
      severity: 'medium',
      description: `Pais de origen ${operationData.originCountry} tiene riesgo medio`,
      impact: '+10% probabilidad inspeccion'
    });
  }

  // Product risk
  if (features.productRiskScore >= 0.7) {
    factors.push({
      factor: 'product_category',
      severity: 'high',
      description: `Categoria de producto (capitulo ${features.taricChapter}) frecuentemente inspeccionada`,
      impact: '+20% probabilidad inspeccion'
    });
  }

  // Value risk
  if (features.valueCategory === 'very_high') {
    factors.push({
      factor: 'high_value',
      severity: 'medium',
      description: 'Valor aduanero muy alto requiere mayor escrutinio',
      impact: '+15% probabilidad revision documental'
    });
  }

  // Missing documents
  if (!features.hasOriginCertificate && !features.isEUOrigin) {
    factors.push({
      factor: 'missing_origin_cert',
      severity: 'medium',
      description: 'Sin certificado de origen para mercancia extra-UE',
      impact: 'Canal amarillo probable'
    });
  }

  // New operator
  if (features.isNewOperator) {
    factors.push({
      factor: 'new_operator',
      severity: 'low',
      description: 'Operador con pocas declaraciones previas',
      impact: '+5% probabilidad revision'
    });
  }

  // Undervaluation risk
  if (features.valuePerKg > 0 && features.valuePerKg < 2) {
    factors.push({
      factor: 'potential_undervaluation',
      severity: 'high',
      description: 'Valor por kg muy bajo, posible subvaloracion',
      impact: '+30% probabilidad inspeccion fisica'
    });
  }

  // OEA benefit
  if (features.hasOEA) {
    factors.push({
      factor: 'oea_certified',
      severity: 'positive',
      description: 'Operador certificado OEA',
      impact: '-15% probabilidad inspeccion'
    });
  }

  return factors;
}

/**
 * Generate recommendations based on risk factors
 */
function generateRecommendations(features, riskFactors) {
  const recommendations = [];

  // Based on missing documents
  if (!features.hasOriginCertificate && !features.isEUOrigin) {
    recommendations.push({
      priority: 'high',
      action: 'Obtener certificado de origen (EUR.1, Form A, o ATR segun acuerdo)',
      benefit: 'Evitar canal amarillo y posible retraso'
    });
  }

  if (!features.hasInvoice) {
    recommendations.push({
      priority: 'high',
      action: 'Adjuntar factura comercial completa',
      benefit: 'Documento obligatorio para despacho'
    });
  }

  // Based on high risk
  const highRiskFactors = riskFactors.filter(f => f.severity === 'high');
  if (highRiskFactors.length > 0) {
    recommendations.push({
      priority: 'medium',
      action: 'Preparar documentacion adicional de soporte (contratos, catalogos, fichas tecnicas)',
      benefit: 'Acelerar respuesta ante posible requerimiento'
    });
  }

  // OEA recommendation
  if (!features.hasOEA && features.operatorRiskScore > 0.3) {
    recommendations.push({
      priority: 'low',
      action: 'Considerar certificacion OEA para el importador',
      benefit: 'Reduccion significativa de inspecciones a largo plazo'
    });
  }

  // Value documentation
  if (features.valueCategory === 'very_high' || features.valuePerKg < 2) {
    recommendations.push({
      priority: 'high',
      action: 'Preparar justificacion de valor (listas de precios, comparativas de mercado)',
      benefit: 'Defensa ante posible ajuste de valor en aduana'
    });
  }

  return recommendations;
}

/**
 * Record actual channel for feedback loop
 * @param {string} predictionId - Prediction ID
 * @param {string} actualChannel - Actual assigned channel
 */
function recordFeedback(predictionId, actualChannel) {
  const prediction = predictionHistory.get(predictionId);

  if (!prediction) {
    return { success: false, error: 'Prediction not found' };
  }

  const feedback = {
    predictionId,
    predictedChannel: prediction.predictedChannel,
    actualChannel,
    wasCorrect: prediction.predictedChannel === actualChannel,
    features: prediction.features,
    timestamp: new Date()
  };

  feedbackData.push(feedback);

  // Update model accuracy (rolling average of last 100)
  const recentFeedback = feedbackData.slice(-100);
  const correctPredictions = recentFeedback.filter(f => f.wasCorrect).length;
  modelAccuracy = correctPredictions / recentFeedback.length;

  logger.info('Feedback recorded', {
    predictionId,
    wasCorrect: feedback.wasCorrect,
    newAccuracy: modelAccuracy
  });

  return {
    success: true,
    feedback,
    modelAccuracy: Math.round(modelAccuracy * 100)
  };
}

/**
 * Get prediction statistics
 */
function getStatistics() {
  const totalPredictions = predictionHistory.size;
  const totalFeedback = feedbackData.length;
  const correctPredictions = feedbackData.filter(f => f.wasCorrect).length;

  // Channel distribution from feedback
  const channelDistribution = feedbackData.reduce((acc, f) => {
    acc[f.actualChannel] = (acc[f.actualChannel] || 0) + 1;
    return acc;
  }, {});

  return {
    success: true,
    statistics: {
      totalPredictions,
      totalFeedback,
      accuracy: totalFeedback > 0 ? Math.round((correctPredictions / totalFeedback) * 100) : null,
      channelDistribution,
      modelVersion,
      lastUpdated: new Date().toISOString()
    }
  };
}

/**
 * Batch prediction for multiple operations
 */
function batchPredict(operations) {
  const results = operations.map(op => {
    const result = predictChannel(op);
    return {
      operationId: op.id || op.reference,
      ...result.prediction
    };
  });

  // Summary statistics
  const summary = {
    total: results.length,
    byChannel: results.reduce((acc, r) => {
      acc[r.predictedChannel] = (acc[r.predictedChannel] || 0) + 1;
      return acc;
    }, {}),
    averageRiskScore: Math.round(
      results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
    ),
    highRiskCount: results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very_high').length
  };

  return {
    success: true,
    predictions: results,
    summary
  };
}

module.exports = {
  predictChannel,
  recordFeedback,
  getStatistics,
  batchPredict,
  extractFeatures,
  // Expose for testing
  RISK_WEIGHTS,
  calculateCountryRisk,
  calculateProductRisk
};
