/**
 * Proactive Recommendation Service
 * ML-based recommendations for customs optimization
 * Phase 6.5: Advanced Machine Learning
 */

const logger = require('../../config/logger');

// ==================== Recommendation Rules ====================

/**
 * Preference agreements and savings potential
 */
const PREFERENCE_AGREEMENTS = {
  CA: { name: 'CETA (Canada)', avgSaving: 5.2, certificates: ['EUR.1', 'Statement'] },
  JP: { name: 'JEFTA (Japan)', avgSaving: 4.8, certificates: ['EUR.1', 'Statement'] },
  MX: { name: 'EU-Mexico', avgSaving: 6.1, certificates: ['EUR.1', 'Form A'] },
  KR: { name: 'EU-Korea', avgSaving: 5.5, certificates: ['EUR.1'] },
  SG: { name: 'EU-Singapore', avgSaving: 4.2, certificates: ['EUR.1', 'Statement'] },
  VN: { name: 'EU-Vietnam', avgSaving: 7.3, certificates: ['EUR.1'] },
  GB: { name: 'TCA (UK)', avgSaving: 3.8, certificates: ['EUR.1', 'Statement'] },
  CH: { name: 'EFTA (Switzerland)', avgSaving: 4.5, certificates: ['EUR.1'] },
  TR: { name: 'Customs Union (Turkey)', avgSaving: 3.2, certificates: ['ATR', 'EUR.1'] },
  CL: { name: 'EU-Chile', avgSaving: 5.8, certificates: ['EUR.1'] }
};

/**
 * Special regime recommendations
 */
const SPECIAL_REGIMES = {
  inwardProcessing: {
    code: '51',
    name: 'Perfeccionamiento Activo',
    conditions: ['reexport_planned', 'transformation_needed'],
    benefit: 'Exencion total de aranceles e IVA durante transformacion'
  },
  temporaryAdmission: {
    code: '53',
    name: 'Importacion Temporal',
    conditions: ['temporary_use', 'reexport_planned'],
    benefit: 'Exencion parcial (3%/mes) o total para uso temporal'
  },
  customsWarehouse: {
    code: '71',
    name: 'Deposito Aduanero',
    conditions: ['storage_needed', 'uncertain_destination'],
    benefit: 'Aplazamiento de derechos hasta salida del deposito'
  },
  freeZone: {
    code: '78',
    name: 'Zona Franca',
    conditions: ['high_volume', 'multiple_destinations'],
    benefit: 'Flexibilidad maxima para operaciones comerciales'
  }
};

/**
 * OEA benefits by type
 */
const OEA_BENEFITS = {
  AEOC: {
    name: 'OEA Simplificaciones Aduaneras',
    benefits: [
      'Reduccion de controles documentales y fisicos',
      'Prioridad en el despacho',
      'Autorizacion de procedimientos simplificados',
      'Menor importe de garantias'
    ]
  },
  AEOS: {
    name: 'OEA Seguridad y Proteccion',
    benefits: [
      'Notificacion previa reducida',
      'Menor riesgo de inspecciones de seguridad',
      'Reconocimiento mutuo con terceros paises'
    ]
  },
  AEOF: {
    name: 'OEA Completo',
    benefits: [
      'Todos los beneficios de AEOC y AEOS',
      'Maximo reconocimiento internacional',
      'Imagen de empresa fiable'
    ]
  }
};

// ==================== Recommendation Generation ====================

/**
 * Generate comprehensive recommendations for an operation
 * @param {Object} operationData - Operation details
 * @returns {Object} Recommendations
 */
function generateRecommendations(operationData) {
  try {
    const recommendations = [];
    const {
      originCountry,
      taricCode,
      customsValue,
      operationType = 'import',
      hasOriginCertificate,
      certificateType,
      specialRegimeCode,
      operatorOEA,
      reexportPlanned,
      temporaryUse,
      goodsDescription,
      frequency = 'occasional'
    } = operationData;

    // 1. Preference Recommendations
    const preferenceRec = analyzePreferences(originCountry, taricCode, customsValue, hasOriginCertificate);
    if (preferenceRec) recommendations.push(preferenceRec);

    // 2. Special Regime Recommendations
    const regimeRec = analyzeSpecialRegimes(operationData);
    if (regimeRec) recommendations.push(regimeRec);

    // 3. OEA Recommendations
    const oeaRec = analyzeOEABenefits(operatorOEA, customsValue, frequency);
    if (oeaRec) recommendations.push(oeaRec);

    // 4. Cost Optimization Recommendations
    const costRec = analyzeCostOptimization(operationData);
    if (costRec) recommendations.push(costRec);

    // 5. Compliance Recommendations
    const complianceRec = analyzeCompliance(operationData);
    if (complianceRec) recommendations.push(complianceRec);

    // 6. Timing Recommendations
    const timingRec = analyzeTimingOptimization(operationData);
    if (timingRec) recommendations.push(timingRec);

    // Sort by potential savings
    recommendations.sort((a, b) => (b.potentialSaving || 0) - (a.potentialSaving || 0));

    // Calculate total potential savings
    const totalSavings = recommendations
      .filter(r => r.potentialSaving)
      .reduce((sum, r) => sum + r.potentialSaving, 0);

    const result = {
      success: true,
      recommendations,
      summary: {
        totalRecommendations: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        totalPotentialSaving: Math.round(totalSavings),
        categories: [...new Set(recommendations.map(r => r.category))]
      },
      generatedAt: new Date().toISOString()
    };

    logger.info('Recommendations generated', {
      count: recommendations.length,
      totalSavings
    });

    return result;
  } catch (error) {
    logger.error('Recommendation generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze preference opportunities
 */
function analyzePreferences(originCountry, taricCode, customsValue, hasOriginCertificate) {
  const agreement = PREFERENCE_AGREEMENTS[originCountry];

  if (!agreement) return null;

  const potentialSaving = Math.round(customsValue * (agreement.avgSaving / 100));

  if (hasOriginCertificate) {
    return {
      category: 'preferences',
      type: 'preference_applied',
      priority: 'info',
      title: 'Preferencia Arancelaria Aplicada',
      description: `Acuerdo ${agreement.name} correctamente aplicado`,
      details: {
        agreement: agreement.name,
        estimatedSaving: potentialSaving,
        certificate: 'Presentado'
      },
      potentialSaving: 0 // Already saving
    };
  }

  return {
    category: 'preferences',
    type: 'preference_available',
    priority: 'high',
    title: 'Preferencia Arancelaria Disponible',
    description: `Puede beneficiarse del acuerdo ${agreement.name} con ${originCountry}`,
    action: `Obtener certificado de origen (${agreement.certificates.join(' o ')})`,
    details: {
      agreement: agreement.name,
      avgSavingPercent: agreement.avgSaving,
      requiredCertificates: agreement.certificates,
      originCountry
    },
    potentialSaving,
    implementationSteps: [
      'Verificar que el producto cumple las reglas de origen del acuerdo',
      `Solicitar certificado ${agreement.certificates[0]} al exportador`,
      'Presentar certificado con la declaracion de importacion',
      'Indicar preferencia en casilla 36 del DUA'
    ]
  };
}

/**
 * Analyze special regime opportunities
 */
function analyzeSpecialRegimes(operationData) {
  const { reexportPlanned, temporaryUse, customsValue, storageNeeded } = operationData;

  // Check for inward processing
  if (reexportPlanned) {
    const saving = Math.round(customsValue * 0.15); // Estimated 15% (duties + VAT)

    return {
      category: 'special_regimes',
      type: 'inward_processing',
      priority: 'high',
      title: 'Regimen de Perfeccionamiento Activo Recomendado',
      description: 'Al planear reexportacion, puede importar sin pagar aranceles ni IVA',
      action: 'Solicitar autorizacion de Perfeccionamiento Activo (codigo 51)',
      details: {
        regimeCode: '51',
        regimeName: SPECIAL_REGIMES.inwardProcessing.name,
        benefit: SPECIAL_REGIMES.inwardProcessing.benefit
      },
      potentialSaving: saving,
      implementationSteps: [
        'Solicitar autorizacion a la aduana (formulario INF1)',
        'Constituir garantia por los derechos suspendidos',
        'Controlar plazos de ultimacion (12-24 meses)',
        'Exportar productos transformados con referencia a la importacion'
      ]
    };
  }

  // Check for temporary admission
  if (temporaryUse) {
    return {
      category: 'special_regimes',
      type: 'temporary_admission',
      priority: 'medium',
      title: 'Regimen de Importacion Temporal Sugerido',
      description: 'Para uso temporal, puede beneficiarse de exencion total o parcial',
      action: 'Solicitar Importacion Temporal (codigo 53)',
      details: {
        regimeCode: '53',
        regimeName: SPECIAL_REGIMES.temporaryAdmission.name,
        benefit: SPECIAL_REGIMES.temporaryAdmission.benefit
      },
      potentialSaving: Math.round(customsValue * 0.21), // VAT saving
      implementationSteps: [
        'Determinar si aplica exencion total o parcial',
        'Solicitar autorizacion simplificada o formal',
        'Respetar plazo de reexportacion',
        'Mantener identificabilidad del bien'
      ]
    };
  }

  // Check for customs warehouse
  if (storageNeeded) {
    return {
      category: 'special_regimes',
      type: 'customs_warehouse',
      priority: 'medium',
      title: 'Deposito Aduanero Disponible',
      description: 'Almacene mercancias sin pagar derechos hasta su destino final',
      action: 'Utilizar Deposito Aduanero (codigo 71)',
      details: {
        regimeCode: '71',
        regimeName: SPECIAL_REGIMES.customsWarehouse.name,
        benefit: SPECIAL_REGIMES.customsWarehouse.benefit
      },
      potentialSaving: 0, // Deferred, not saved
      implementationSteps: [
        'Identificar deposito autorizado cerca del destino',
        'Presentar declaracion de vinculacion a deposito',
        'Pagar solo almacenaje hasta despacho final',
        'Flexibilidad para reexportar o nacionalizar'
      ]
    };
  }

  return null;
}

/**
 * Analyze OEA certification benefits
 */
function analyzeOEABenefits(operatorOEA, customsValue, frequency) {
  if (operatorOEA) {
    return {
      category: 'oea',
      type: 'oea_active',
      priority: 'info',
      title: 'Beneficios OEA Activos',
      description: `Certificacion ${operatorOEA} proporciona ventajas operativas`,
      details: {
        certification: operatorOEA,
        benefits: OEA_BENEFITS[operatorOEA]?.benefits || []
      },
      potentialSaving: 0
    };
  }

  if (frequency === 'frequent' && customsValue > 100000) {
    return {
      category: 'oea',
      type: 'oea_recommended',
      priority: 'medium',
      title: 'Certificacion OEA Recomendada',
      description: 'Alto volumen de operaciones justifica certificacion OEA',
      action: 'Iniciar proceso de certificacion OEA',
      details: {
        recommendedType: 'AEOF',
        benefits: OEA_BENEFITS.AEOF.benefits,
        estimatedTimeline: '6-12 meses'
      },
      potentialSaving: Math.round(customsValue * 0.02), // Estimated savings from reduced inspections
      implementationSteps: [
        'Realizar autoevaluacion con cuestionario AEAT',
        'Contratar consultoria especializada (opcional)',
        'Preparar documentacion (procedimientos, auditorias)',
        'Solicitar auditoria previa (recomendado)',
        'Presentar solicitud formal'
      ]
    };
  }

  return null;
}

/**
 * Analyze cost optimization opportunities
 */
function analyzeCostOptimization(operationData) {
  const { customsValue, freight, insurance, incoterm } = operationData;

  // Check incoterm optimization
  if (incoterm === 'EXW' && customsValue > 50000) {
    return {
      category: 'cost_optimization',
      type: 'incoterm_optimization',
      priority: 'low',
      title: 'Optimizacion de Incoterm',
      description: 'Incoterm EXW puede no ser el mas eficiente para grandes volumenes',
      action: 'Considerar negociar CIF o DDP con el proveedor',
      details: {
        currentIncoterm: incoterm,
        suggestion: 'Evaluar CIF o DDP para mejor control de costes'
      },
      potentialSaving: 0
    };
  }

  // Check for value adjustment opportunities
  if (freight && freight > customsValue * 0.1) {
    return {
      category: 'cost_optimization',
      type: 'freight_optimization',
      priority: 'low',
      title: 'Revision de Costes de Transporte',
      description: 'Flete representa >10% del valor. Comparar alternativas.',
      action: 'Solicitar cotizaciones de otros transitarios',
      details: {
        freightPercent: Math.round((freight / customsValue) * 100),
        benchmarkPercent: 5
      },
      potentialSaving: Math.round(freight * 0.2) // Potential 20% reduction
    };
  }

  return null;
}

/**
 * Analyze compliance recommendations
 */
function analyzeCompliance(operationData) {
  const { taricCode, originCountry, hasInvoice, hasPackingList, hasBL } = operationData;

  const missingDocs = [];
  if (!hasInvoice) missingDocs.push('Factura comercial');
  if (!hasPackingList) missingDocs.push('Packing list');
  if (!hasBL) missingDocs.push('Conocimiento de embarque');

  if (missingDocs.length > 0) {
    return {
      category: 'compliance',
      type: 'missing_documents',
      priority: 'high',
      title: 'Documentacion Faltante',
      description: `Faltan documentos obligatorios: ${missingDocs.join(', ')}`,
      action: 'Obtener documentacion antes del despacho',
      details: {
        missingDocuments: missingDocs,
        requiredFor: 'Despacho aduanero'
      },
      potentialSaving: 0,
      implementationSteps: missingDocs.map(doc => `Solicitar ${doc} al exportador/proveedor`)
    };
  }

  return null;
}

/**
 * Analyze timing optimization
 */
function analyzeTimingOptimization(operationData) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const hour = today.getHours();

  // Recommend avoiding Friday afternoon submissions
  if (dayOfWeek === 5 && hour > 12) {
    return {
      category: 'timing',
      type: 'submission_timing',
      priority: 'low',
      title: 'Recomendacion de Timing',
      description: 'Presentar declaraciones viernes tarde puede retrasar el levante',
      action: 'Considerar presentar el lunes para tramitacion mas rapida',
      details: {
        currentDay: 'Viernes tarde',
        suggestion: 'Lunes manana para mejor tiempo de respuesta'
      },
      potentialSaving: 0
    };
  }

  // Check for end of quarter (potential quota exhaustion)
  const month = today.getMonth();
  if ([2, 5, 8, 11].includes(month) && today.getDate() > 20) {
    return {
      category: 'timing',
      type: 'quota_warning',
      priority: 'medium',
      title: 'Fin de Trimestre - Contingentes',
      description: 'Final de trimestre: algunos contingentes pueden estar agotandose',
      action: 'Verificar disponibilidad de contingentes antes de declarar',
      details: {
        reason: 'Los contingentes trimestrales pueden agotarse a fin de periodo'
      },
      potentialSaving: 0
    };
  }

  return null;
}

/**
 * Get quick recommendations for a country-product pair
 */
function getQuickRecommendations(originCountry, taricCode, customsValue) {
  const recommendations = [];

  // Check preference
  const agreement = PREFERENCE_AGREEMENTS[originCountry];
  if (agreement) {
    recommendations.push({
      type: 'preference',
      message: `Acuerdo preferencial disponible: ${agreement.name}`,
      saving: `~${agreement.avgSaving}%`
    });
  }

  // Check high-risk products
  const highRiskChapters = ['85', '61', '62', '95'];
  if (taricCode && highRiskChapters.includes(taricCode.substring(0, 2))) {
    recommendations.push({
      type: 'warning',
      message: 'Producto de alto riesgo de inspeccion',
      action: 'Preparar documentacion adicional'
    });
  }

  // Check value threshold
  if (customsValue > 150) {
    recommendations.push({
      type: 'info',
      message: 'Valor superior a 150 EUR: requiere declaracion completa H1'
    });
  }

  return recommendations;
}

// ==================== Statistics & Feedback ====================

// In-memory storage for demo
const recommendationHistory = [];
const feedbackData = [];

/**
 * Get recommendation statistics
 */
function getStatistics() {
  const totalRecommendations = recommendationHistory.length;
  const totalFeedback = feedbackData.length;
  const usefulCount = feedbackData.filter(f => f.wasUseful).length;
  const implementedCount = feedbackData.filter(f => f.wasImplemented).length;
  const totalSavings = feedbackData.reduce((sum, f) => sum + (f.actualSavings || 0), 0);

  // By type distribution
  const typeDistribution = recommendationHistory.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  return {
    success: true,
    statistics: {
      totalRecommendations,
      totalFeedback,
      usefulnessRate: totalFeedback > 0 ? Math.round((usefulCount / totalFeedback) * 100) : null,
      implementationRate: totalFeedback > 0 ? Math.round((implementedCount / totalFeedback) * 100) : null,
      totalSavingsGenerated: totalSavings,
      typeDistribution,
      lastUpdated: new Date().toISOString()
    }
  };
}

/**
 * Record feedback for recommendation
 */
function recordFeedback(recommendationId, wasUseful, wasImplemented, actualSavings, notes) {
  const feedback = {
    recommendationId,
    wasUseful,
    wasImplemented,
    actualSavings: actualSavings || 0,
    notes,
    recordedAt: new Date().toISOString()
  };

  feedbackData.push(feedback);

  logger.info('Recommendation feedback recorded', {
    recommendationId,
    wasUseful,
    wasImplemented,
    actualSavings
  });

  return {
    success: true,
    feedback
  };
}

module.exports = {
  generateRecommendations,
  getQuickRecommendations,
  getStatistics,
  recordFeedback,
  PREFERENCE_AGREEMENTS,
  SPECIAL_REGIMES,
  OEA_BENEFITS
};
