/**
 * Fraud Detection Service
 * ML-based detection of customs fraud patterns
 * Phase 6.5: Advanced Machine Learning
 */

const logger = require('../../config/logger');

// ==================== Fraud Pattern Definitions ====================

/**
 * Known fraud patterns and their indicators
 */
const FRAUD_PATTERNS = {
  undervaluation: {
    name: 'Subvaloracion',
    description: 'Declaracion de valor inferior al real para reducir aranceles',
    severity: 'high',
    indicators: ['low_value_per_unit', 'value_below_market', 'inconsistent_incoterm']
  },
  misclassification: {
    name: 'Clasificacion incorrecta',
    description: 'Uso de codigo TARIC con menor arancel',
    severity: 'high',
    indicators: ['suspicious_taric', 'description_mismatch', 'chapter_inconsistency']
  },
  falseOrigin: {
    name: 'Origen falso',
    description: 'Declaracion de origen incorrecto para beneficiarse de preferencias',
    severity: 'critical',
    indicators: ['transshipment_country', 'certificate_anomaly', 'route_inconsistency']
  },
  splitting: {
    name: 'Fraccionamiento',
    description: 'Division de envios para evitar controles o aranceles',
    severity: 'medium',
    indicators: ['multiple_shipments', 'similar_goods', 'same_period']
  },
  phantomGoods: {
    name: 'Mercancias fantasma',
    description: 'Declaracion de mercancias inexistentes',
    severity: 'critical',
    indicators: ['no_transport_docs', 'fake_supplier', 'impossible_weight']
  },
  smuggling: {
    name: 'Contrabando',
    description: 'Ocultacion de mercancias prohibidas o restringidas',
    severity: 'critical',
    indicators: ['container_anomaly', 'weight_mismatch', 'suspicious_route']
  }
};

/**
 * Reference market values by TARIC chapter (EUR/kg)
 * Used for undervaluation detection
 */
const MARKET_REFERENCE_VALUES = {
  '61': { min: 5, avg: 25, max: 200 },   // Apparel, knitted
  '62': { min: 5, avg: 30, max: 250 },   // Apparel, not knitted
  '64': { min: 3, avg: 15, max: 100 },   // Footwear
  '42': { min: 10, avg: 50, max: 500 },  // Leather articles
  '71': { min: 100, avg: 5000, max: 50000 }, // Jewelry
  '84': { min: 5, avg: 50, max: 500 },   // Machinery
  '85': { min: 10, avg: 100, max: 1000 }, // Electronics
  '90': { min: 20, avg: 200, max: 2000 }, // Optical instruments
  '95': { min: 2, avg: 10, max: 50 },    // Toys
  '39': { min: 1, avg: 3, max: 20 },     // Plastics
  '73': { min: 1, avg: 5, max: 30 },     // Iron/steel articles
  '94': { min: 3, avg: 15, max: 100 }    // Furniture
};

/**
 * Suspicious transshipment countries (potential origin laundering)
 */
const TRANSSHIPMENT_HUBS = ['HK', 'SG', 'AE', 'MY', 'TH', 'VN', 'TW'];

/**
 * High-risk TARIC codes for misclassification
 */
const MISCLASSIFICATION_RISK_CODES = {
  // Often confused pairs
  '8471.30': ['8471.41', '8471.49', '8528.52'], // Computers
  '6110.20': ['6110.30', '6109.10'],            // Sweaters
  '6403.99': ['6403.91', '6404.19'],            // Footwear
  '9503.00': ['9504.50', '9505.10'],            // Toys
  '8517.12': ['8517.62', '8471.30']             // Phones
};

// ==================== Detection Functions ====================

/**
 * Detect undervaluation fraud
 */
function detectUndervaluation(data) {
  const alerts = [];
  const { taricCode, customsValue, weight, quantity, unitPrice } = data;

  if (!taricCode || !customsValue || !weight) {
    return { detected: false, alerts };
  }

  const chapter = taricCode.substring(0, 2);
  const referenceValues = MARKET_REFERENCE_VALUES[chapter];

  if (referenceValues) {
    const declaredValuePerKg = customsValue / weight;

    // Check if significantly below market minimum
    if (declaredValuePerKg < referenceValues.min * 0.5) {
      alerts.push({
        type: 'undervaluation',
        severity: 'critical',
        indicator: 'value_below_market',
        message: `Valor declarado (${declaredValuePerKg.toFixed(2)} EUR/kg) muy inferior al minimo de mercado (${referenceValues.min} EUR/kg)`,
        deviation: Math.round((1 - declaredValuePerKg / referenceValues.min) * 100),
        recommendation: 'Solicitar justificacion de valor y documentacion de soporte'
      });
    } else if (declaredValuePerKg < referenceValues.min) {
      alerts.push({
        type: 'undervaluation',
        severity: 'high',
        indicator: 'low_value_per_unit',
        message: `Valor declarado (${declaredValuePerKg.toFixed(2)} EUR/kg) por debajo del minimo de mercado`,
        deviation: Math.round((1 - declaredValuePerKg / referenceValues.min) * 100),
        recommendation: 'Verificar precio con bases de datos de referencia'
      });
    }

    // Check for statistical outliers (below 25% of average)
    if (declaredValuePerKg < referenceValues.avg * 0.25) {
      alerts.push({
        type: 'undervaluation',
        severity: 'medium',
        indicator: 'statistical_outlier',
        message: `Valor significativamente por debajo del promedio de mercado (${referenceValues.avg} EUR/kg)`,
        deviation: Math.round((1 - declaredValuePerKg / referenceValues.avg) * 100),
        recommendation: 'Comparar con declaraciones similares anteriores'
      });
    }
  }

  // Check unit price if provided
  if (unitPrice && unitPrice < 0.5) {
    alerts.push({
      type: 'undervaluation',
      severity: 'high',
      indicator: 'suspicious_unit_price',
      message: `Precio unitario muy bajo: ${unitPrice} EUR`,
      recommendation: 'Verificar si el precio incluye todos los elementos del valor en aduana'
    });
  }

  return {
    detected: alerts.length > 0,
    alerts
  };
}

/**
 * Detect origin fraud
 */
function detectOriginFraud(data) {
  const alerts = [];
  const {
    declaredOrigin,
    shippingCountry,
    transshipmentCountries = [],
    hasOriginCertificate,
    certificateType,
    supplierCountry,
    productionCountry
  } = data;

  // Check for transshipment through high-risk hubs
  if (transshipmentCountries.some(c => TRANSSHIPMENT_HUBS.includes(c))) {
    alerts.push({
      type: 'falseOrigin',
      severity: 'high',
      indicator: 'transshipment_country',
      message: `Transbordo a traves de hub de alto riesgo: ${transshipmentCountries.join(', ')}`,
      recommendation: 'Verificar trazabilidad completa de la mercancia'
    });
  }

  // Check for origin-shipping mismatch
  if (declaredOrigin && shippingCountry && declaredOrigin !== shippingCountry) {
    if (TRANSSHIPMENT_HUBS.includes(shippingCountry)) {
      alerts.push({
        type: 'falseOrigin',
        severity: 'high',
        indicator: 'route_inconsistency',
        message: `Origen declarado (${declaredOrigin}) difiere del pais de embarque (${shippingCountry})`,
        recommendation: 'Solicitar documentacion de transporte completa'
      });
    }
  }

  // Check certificate anomalies
  if (hasOriginCertificate) {
    // EU preferential certificates for non-agreement countries
    const euPreferentialCerts = ['EUR1', 'ATR'];
    const euAgreementCountries = ['TR', 'CH', 'NO', 'IS', 'LI', 'CA', 'JP', 'KR', 'MX', 'CL', 'SG', 'VN'];

    if (euPreferentialCerts.includes(certificateType) && !euAgreementCountries.includes(declaredOrigin)) {
      alerts.push({
        type: 'falseOrigin',
        severity: 'critical',
        indicator: 'certificate_anomaly',
        message: `Certificado ${certificateType} no aplicable para origen ${declaredOrigin}`,
        recommendation: 'Rechazar certificado y aplicar arancel terceros paises'
      });
    }
  }

  // Check supplier vs production country
  if (supplierCountry && productionCountry && supplierCountry !== productionCountry) {
    if (TRANSSHIPMENT_HUBS.includes(supplierCountry)) {
      alerts.push({
        type: 'falseOrigin',
        severity: 'medium',
        indicator: 'supplier_production_mismatch',
        message: `Proveedor en ${supplierCountry} pero produccion en ${productionCountry}`,
        recommendation: 'Verificar cadena de suministro y valor agregado'
      });
    }
  }

  return {
    detected: alerts.length > 0,
    alerts
  };
}

/**
 * Detect misclassification fraud
 */
function detectMisclassification(data) {
  const alerts = [];
  const { taricCode, goodsDescription, weight, customsValue, quantity } = data;

  if (!taricCode || !goodsDescription) {
    return { detected: false, alerts };
  }

  // Check for suspicious code patterns
  // Extract first 4 digits + dot + next 2 digits to match MISCLASSIFICATION_RISK_CODES format
  const code6 = taricCode.substring(0, 4) + '.' + taricCode.substring(4, 6);
  const relatedCodes = MISCLASSIFICATION_RISK_CODES[code6];

  if (relatedCodes) {
    alerts.push({
      type: 'misclassification',
      severity: 'medium',
      indicator: 'suspicious_taric',
      message: `Codigo TARIC ${taricCode} frecuentemente confundido con: ${relatedCodes.join(', ')}`,
      recommendation: 'Verificar descripcion detallada y caracteristicas del producto'
    });
  }

  // Simple keyword analysis for description mismatch
  const descLower = goodsDescription.toLowerCase();
  const chapter = taricCode.substring(0, 2);

  // Check chapter consistency
  const chapterKeywords = {
    '61': ['tejido', 'punto', 'knit', 'jersey', 'camiseta', 'sweater'],
    '62': ['tejido', 'plano', 'woven', 'camisa', 'pantalon', 'traje'],
    '64': ['calzado', 'zapato', 'bota', 'sandalia', 'shoe', 'footwear'],
    '84': ['maquina', 'motor', 'bomba', 'machine', 'engine'],
    '85': ['electr', 'telefono', 'phone', 'television', 'cable'],
    '95': ['juguete', 'toy', 'juego', 'game', 'muneca', 'doll']
  };

  if (chapterKeywords[chapter]) {
    const hasMatchingKeyword = chapterKeywords[chapter].some(kw => descLower.includes(kw));
    if (!hasMatchingKeyword && goodsDescription.length > 10) {
      alerts.push({
        type: 'misclassification',
        severity: 'low',
        indicator: 'description_mismatch',
        message: `Descripcion no contiene palabras clave esperadas para capitulo ${chapter}`,
        recommendation: 'Revisar si el codigo TARIC corresponde a la mercancia'
      });
    }
  }

  return {
    detected: alerts.length > 0,
    alerts
  };
}

/**
 * Detect shipment splitting
 */
function detectSplitting(data, historicalData = []) {
  const alerts = [];
  const { operatorNIF, taricCode, originCountry, declarationDate } = data;

  if (!historicalData || historicalData.length === 0) {
    return { detected: false, alerts };
  }

  // Look for similar declarations in the last 30 days
  const thirtyDaysAgo = new Date(declarationDate || Date.now());
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const similarDeclarations = historicalData.filter(d => {
    const declDate = new Date(d.declarationDate);
    return (
      d.operatorNIF === operatorNIF &&
      d.taricCode?.substring(0, 4) === taricCode?.substring(0, 4) &&
      d.originCountry === originCountry &&
      declDate >= thirtyDaysAgo
    );
  });

  if (similarDeclarations.length >= 3) {
    const totalValue = similarDeclarations.reduce((sum, d) => sum + (d.customsValue || 0), 0);

    alerts.push({
      type: 'splitting',
      severity: 'medium',
      indicator: 'multiple_shipments',
      message: `${similarDeclarations.length} envios similares en los ultimos 30 dias (valor total: ${totalValue.toLocaleString()} EUR)`,
      recommendation: 'Verificar si hay fraccionamiento deliberado para evitar controles'
    });
  }

  return {
    detected: alerts.length > 0,
    alerts
  };
}

/**
 * Detect weight/quantity anomalies (potential smuggling)
 */
function detectWeightAnomalies(data) {
  const alerts = [];
  const { weight, grossWeight, quantity, packaging, containerType } = data;

  // Check gross vs net weight ratio
  if (weight && grossWeight) {
    const ratio = grossWeight / weight;

    if (ratio > 5) {
      alerts.push({
        type: 'smuggling',
        severity: 'high',
        indicator: 'weight_mismatch',
        message: `Ratio peso bruto/neto muy alto (${ratio.toFixed(1)}x)`,
        recommendation: 'Posible mercancia oculta. Considerar inspeccion fisica'
      });
    } else if (ratio < 1.01) {
      alerts.push({
        type: 'phantomGoods',
        severity: 'medium',
        indicator: 'impossible_weight',
        message: 'Peso neto practicamente igual al bruto (embalaje minimo)',
        recommendation: 'Verificar coherencia con tipo de embalaje declarado'
      });
    }
  }

  // Check container weight anomalies
  if (containerType && grossWeight) {
    const containerLimits = {
      '20GP': 28000,  // 20ft standard
      '40GP': 30500,  // 40ft standard
      '40HC': 30500,  // 40ft high cube
      '20RF': 27500,  // 20ft reefer
      '40RF': 29500   // 40ft reefer
    };

    const limit = containerLimits[containerType];
    if (limit && grossWeight > limit) {
      alerts.push({
        type: 'smuggling',
        severity: 'critical',
        indicator: 'container_anomaly',
        message: `Peso declarado (${grossWeight} kg) excede limite del contenedor ${containerType} (${limit} kg)`,
        recommendation: 'Inspeccion fisica obligatoria'
      });
    }
  }

  return {
    detected: alerts.length > 0,
    alerts
  };
}

// ==================== Main Analysis Function ====================

/**
 * Perform comprehensive fraud analysis
 * @param {Object} declarationData - Declaration details
 * @param {Array} historicalData - Historical declarations for context
 * @returns {Object} Fraud analysis result
 */
function analyzeForFraud(declarationData, historicalData = []) {
  try {
    const allAlerts = [];
    const detectionResults = {};

    // Run all detection modules
    const undervaluation = detectUndervaluation(declarationData);
    if (undervaluation.detected) {
      allAlerts.push(...undervaluation.alerts);
      detectionResults.undervaluation = true;
    }

    const originFraud = detectOriginFraud(declarationData);
    if (originFraud.detected) {
      allAlerts.push(...originFraud.alerts);
      detectionResults.originFraud = true;
    }

    const misclassification = detectMisclassification(declarationData);
    if (misclassification.detected) {
      allAlerts.push(...misclassification.alerts);
      detectionResults.misclassification = true;
    }

    const splitting = detectSplitting(declarationData, historicalData);
    if (splitting.detected) {
      allAlerts.push(...splitting.alerts);
      detectionResults.splitting = true;
    }

    const weightAnomalies = detectWeightAnomalies(declarationData);
    if (weightAnomalies.detected) {
      allAlerts.push(...weightAnomalies.alerts);
      detectionResults.weightAnomalies = true;
    }

    // Calculate overall risk score
    const severityScores = { critical: 40, high: 25, medium: 15, low: 5 };
    let totalScore = 0;
    allAlerts.forEach(alert => {
      totalScore += severityScores[alert.severity] || 10;
    });

    const riskScore = Math.min(100, totalScore);
    const riskLevel =
      riskScore >= 70 ? 'critical' :
      riskScore >= 50 ? 'high' :
      riskScore >= 25 ? 'medium' : 'low';

    // Group alerts by type
    const alertsByType = allAlerts.reduce((acc, alert) => {
      if (!acc[alert.type]) acc[alert.type] = [];
      acc[alert.type].push(alert);
      return acc;
    }, {});

    // Generate summary
    const summary = {
      fraudDetected: allAlerts.length > 0,
      alertCount: allAlerts.length,
      criticalAlerts: allAlerts.filter(a => a.severity === 'critical').length,
      highAlerts: allAlerts.filter(a => a.severity === 'high').length,
      patterns: Object.keys(detectionResults)
    };

    const result = {
      success: true,
      riskScore,
      riskLevel,
      summary,
      alerts: allAlerts,
      alertsByType,
      detectionResults,
      analyzedAt: new Date().toISOString()
    };

    if (allAlerts.length > 0) {
      logger.warn('Fraud indicators detected', {
        riskScore,
        alertCount: allAlerts.length,
        patterns: summary.patterns
      });
    }

    return result;
  } catch (error) {
    logger.error('Fraud analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick risk assessment without full analysis
 */
function quickRiskAssessment(data) {
  const riskFactors = [];
  let score = 0;

  // Country risk
  if (TRANSSHIPMENT_HUBS.includes(data.originCountry)) {
    score += 15;
    riskFactors.push('high_risk_origin');
  }

  // Value risk
  if (data.customsValue > 100000) {
    score += 10;
    riskFactors.push('high_value');
  }

  // Product risk
  const highRiskChapters = ['61', '62', '64', '71', '85', '95'];
  if (data.taricCode && highRiskChapters.includes(data.taricCode.substring(0, 2))) {
    score += 10;
    riskFactors.push('high_risk_product');
  }

  // Missing documents
  if (!data.hasOriginCertificate) {
    score += 5;
    riskFactors.push('missing_origin_cert');
  }

  return {
    quickScore: Math.min(100, score),
    riskFactors,
    requiresFullAnalysis: score >= 25
  };
}

// ==================== Statistics & Feedback ====================

// In-memory storage for demo
const analysisHistory = [];
const feedbackData = [];

/**
 * Get fraud detection statistics
 */
function getStatistics() {
  const totalAnalyses = analysisHistory.length;
  const totalFeedback = feedbackData.length;
  const confirmedFrauds = feedbackData.filter(f => f.wasActualFraud).length;

  // Distribution by risk level
  const riskDistribution = analysisHistory.reduce((acc, a) => {
    acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1;
    return acc;
  }, {});

  // Most common patterns
  const patternCounts = analysisHistory.reduce((acc, a) => {
    (a.detectedPatterns || []).forEach(p => {
      acc[p] = (acc[p] || 0) + 1;
    });
    return acc;
  }, {});

  return {
    success: true,
    statistics: {
      totalAnalyses,
      totalFeedback,
      confirmedFrauds,
      falsePositiveRate: totalFeedback > 0
        ? Math.round(((totalFeedback - confirmedFrauds) / totalFeedback) * 100)
        : null,
      riskDistribution,
      topPatterns: Object.entries(patternCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count })),
      lastUpdated: new Date().toISOString()
    }
  };
}

/**
 * Record feedback for fraud analysis
 */
function recordFeedback(analysisId, wasActualFraud, fraudType, notes) {
  const feedback = {
    analysisId,
    wasActualFraud,
    fraudType,
    notes,
    recordedAt: new Date().toISOString()
  };

  feedbackData.push(feedback);

  logger.info('Fraud feedback recorded', {
    analysisId,
    wasActualFraud,
    fraudType
  });

  return {
    success: true,
    feedback
  };
}

module.exports = {
  analyzeForFraud,
  quickRiskAssessment,
  getStatistics,
  recordFeedback,
  detectUndervaluation,
  detectOriginFraud,
  detectMisclassification,
  detectSplitting,
  detectWeightAnomalies,
  FRAUD_PATTERNS,
  MARKET_REFERENCE_VALUES
};
