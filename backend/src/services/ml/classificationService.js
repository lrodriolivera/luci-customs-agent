/**
 * Enhanced Classification Service
 * ML-improved TARIC classification with feedback learning
 * Phase 6.5: Advanced Machine Learning
 */

const logger = require('../../config/logger');

// ==================== Classification Knowledge Base ====================

/**
 * Classification patterns learned from historical data
 * Maps keywords to TARIC chapters/codes
 */
const CLASSIFICATION_PATTERNS = {
  // Electronics (Chapter 85)
  electronics: {
    chapter: '85',
    keywords: ['electronico', 'electronic', 'electrico', 'electric', 'cable', 'bateria', 'battery'],
    subcategories: {
      phones: { code: '8517.12', keywords: ['telefono', 'movil', 'smartphone', 'phone', 'celular'] },
      computers: { code: '8471.30', keywords: ['ordenador', 'portatil', 'laptop', 'computer', 'pc'] },
      tablets: { code: '8471.30', keywords: ['tablet', 'tableta', 'ipad'] },
      tvs: { code: '8528.72', keywords: ['television', 'tv', 'monitor', 'pantalla'] },
      headphones: { code: '8518.30', keywords: ['auricular', 'headphone', 'earphone', 'cascos'] },
      chargers: { code: '8504.40', keywords: ['cargador', 'charger', 'adaptador', 'adapter'] },
      cables: { code: '8544.42', keywords: ['cable', 'usb', 'hdmi', 'conexion'] }
    }
  },

  // Textiles - Apparel (Chapters 61-62)
  apparel: {
    keywords: ['ropa', 'vestir', 'prenda', 'clothing', 'garment', 'wear'],
    subcategories: {
      tshirts: { code: '6109.10', keywords: ['camiseta', 't-shirt', 'tshirt', 'polo'] },
      shirts: { code: '6205.20', keywords: ['camisa', 'shirt', 'blusa', 'blouse'] },
      pants: { code: '6203.42', keywords: ['pantalon', 'pants', 'trousers', 'jeans', 'vaquero'] },
      sweaters: { code: '6110.20', keywords: ['jersey', 'sweater', 'sueter', 'pullover', 'sudadera'] },
      jackets: { code: '6201.93', keywords: ['chaqueta', 'jacket', 'abrigo', 'coat', 'cazadora'] },
      dresses: { code: '6204.42', keywords: ['vestido', 'dress', 'falda', 'skirt'] },
      underwear: { code: '6107.11', keywords: ['ropa interior', 'underwear', 'calzoncillo', 'boxer'] }
    }
  },

  // Footwear (Chapter 64)
  footwear: {
    chapter: '64',
    keywords: ['calzado', 'zapato', 'footwear', 'shoe'],
    subcategories: {
      sports: { code: '6404.11', keywords: ['deportivo', 'sport', 'zapatilla', 'sneaker', 'running'] },
      leather: { code: '6403.99', keywords: ['piel', 'cuero', 'leather'] },
      textile: { code: '6404.19', keywords: ['textil', 'tela', 'fabric'] },
      sandals: { code: '6402.99', keywords: ['sandalia', 'sandal', 'chancla', 'flip-flop'] },
      boots: { code: '6403.91', keywords: ['bota', 'boot', 'botin'] }
    }
  },

  // Machinery (Chapter 84)
  machinery: {
    chapter: '84',
    keywords: ['maquina', 'machine', 'equipo', 'equipment', 'motor', 'bomba', 'pump'],
    subcategories: {
      pumps: { code: '8413.70', keywords: ['bomba', 'pump'] },
      compressors: { code: '8414.80', keywords: ['compresor', 'compressor'] },
      filters: { code: '8421.29', keywords: ['filtro', 'filter'] },
      bearings: { code: '8482.10', keywords: ['rodamiento', 'bearing', 'cojinete'] }
    }
  },

  // Toys (Chapter 95)
  toys: {
    chapter: '95',
    keywords: ['juguete', 'toy', 'juego', 'game'],
    subcategories: {
      dolls: { code: '9503.00', keywords: ['muneca', 'doll', 'figura', 'figure', 'action'] },
      vehicles: { code: '9503.00', keywords: ['coche', 'car', 'vehiculo', 'vehicle', 'miniatura'] },
      construction: { code: '9503.00', keywords: ['construccion', 'building', 'lego', 'bloques'] },
      electronic: { code: '9504.50', keywords: ['videojuego', 'consola', 'game', 'console'] },
      educational: { code: '9503.00', keywords: ['educativo', 'educational', 'didactico'] }
    }
  },

  // Furniture (Chapter 94)
  furniture: {
    chapter: '94',
    keywords: ['mueble', 'furniture', 'mobiliario'],
    subcategories: {
      seats: { code: '9401.61', keywords: ['silla', 'chair', 'asiento', 'seat', 'sofa'] },
      tables: { code: '9403.60', keywords: ['mesa', 'table', 'escritorio', 'desk'] },
      beds: { code: '9403.50', keywords: ['cama', 'bed', 'colchon', 'mattress'] },
      storage: { code: '9403.30', keywords: ['armario', 'wardrobe', 'estanteria', 'shelf'] }
    }
  },

  // Plastics (Chapter 39)
  plastics: {
    chapter: '39',
    keywords: ['plastico', 'plastic', 'pvc', 'polietileno', 'polyethylene'],
    subcategories: {
      bags: { code: '3923.29', keywords: ['bolsa', 'bag', 'saco', 'envase'] },
      containers: { code: '3923.30', keywords: ['contenedor', 'container', 'botella', 'bottle'] },
      tubes: { code: '3917.32', keywords: ['tubo', 'tube', 'tuberia', 'pipe'] }
    }
  }
};

/**
 * Classification history for learning
 */
const classificationHistory = [];
const feedbackHistory = [];
let modelConfidence = 0.85;

// ==================== Classification Functions ====================

/**
 * Tokenize and normalize text
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Calculate keyword match score
 */
function calculateKeywordScore(tokens, keywords) {
  let matches = 0;
  const tokenSet = new Set(tokens);

  keywords.forEach(keyword => {
    const keywordTokens = tokenize(keyword);
    keywordTokens.forEach(kt => {
      if (tokenSet.has(kt)) matches++;
    });
  });

  return matches / Math.max(1, keywords.length);
}

/**
 * Find best matching category
 */
function findBestCategory(description) {
  const tokens = tokenize(description);
  let bestMatch = null;
  let bestScore = 0;

  Object.entries(CLASSIFICATION_PATTERNS).forEach(([category, data]) => {
    const categoryScore = calculateKeywordScore(tokens, data.keywords);

    if (categoryScore > 0) {
      // Check subcategories for more specific match
      Object.entries(data.subcategories || {}).forEach(([subcat, subdata]) => {
        const subcatScore = calculateKeywordScore(tokens, subdata.keywords);
        const totalScore = categoryScore * 0.3 + subcatScore * 0.7;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = {
            category,
            subcategory: subcat,
            code: subdata.code,
            chapter: data.chapter || subdata.code.substring(0, 2),
            score: totalScore
          };
        }
      });

      // If no subcategory matched well, use chapter
      if (!bestMatch || bestMatch.category !== category) {
        if (categoryScore > bestScore * 0.8 && data.chapter) {
          bestMatch = {
            category,
            subcategory: null,
            code: data.chapter + '00.00',
            chapter: data.chapter,
            score: categoryScore
          };
        }
      }
    }
  });

  return bestMatch;
}

/**
 * Enhanced classification with ML features
 * @param {Object} input - Classification input
 * @returns {Object} Classification result
 */
function classifyProduct(input) {
  try {
    const {
      description,
      material,
      use,
      origin,
      images = [],
      additionalInfo = {}
    } = input;

    // Build full description from all inputs
    const fullDescription = [
      description,
      material ? `material: ${material}` : '',
      use ? `uso: ${use}` : '',
      additionalInfo.composition || '',
      additionalInfo.function || ''
    ].filter(Boolean).join(' ');

    // Find best match
    const match = findBestCategory(fullDescription);

    if (!match) {
      return {
        success: true,
        classification: null,
        confidence: 0,
        message: 'No se pudo determinar clasificacion automatica',
        suggestions: getGeneralSuggestions(fullDescription),
        requiresManualReview: true
      };
    }

    // Generate suggestions for similar codes
    const suggestions = generateSuggestions(match, fullDescription);

    // Calculate confidence based on score and historical accuracy
    const confidence = Math.round(match.score * modelConfidence * 100);

    // Store for learning
    const classificationId = `class_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    classificationHistory.push({
      id: classificationId,
      input: fullDescription,
      result: match,
      timestamp: new Date()
    });

    const result = {
      success: true,
      classificationId,
      classification: {
        code: match.code,
        chapter: match.chapter,
        category: match.category,
        subcategory: match.subcategory
      },
      confidence,
      confidenceLevel: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low',
      suggestions,
      requiresManualReview: confidence < 70,
      reasoning: generateReasoning(match, fullDescription),
      additionalChecks: getAdditionalChecks(match)
    };

    logger.info('Product classified', {
      classificationId,
      code: match.code,
      confidence
    });

    return result;
  } catch (error) {
    logger.error('Classification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate alternative suggestions
 */
function generateSuggestions(match, description) {
  const suggestions = [];
  const tokens = tokenize(description);

  // Add primary match
  suggestions.push({
    code: match.code,
    description: getCodeDescription(match.code),
    confidence: 'primary',
    reason: 'Mejor coincidencia basada en descripcion'
  });

  // Find related codes in same chapter
  const chapter = match.chapter;
  Object.entries(CLASSIFICATION_PATTERNS).forEach(([category, data]) => {
    if (data.chapter === chapter || Object.values(data.subcategories || {}).some(s => s.code.startsWith(chapter))) {
      Object.entries(data.subcategories || {}).forEach(([subcat, subdata]) => {
        if (subdata.code !== match.code && subdata.code.startsWith(chapter)) {
          const score = calculateKeywordScore(tokens, subdata.keywords);
          if (score > 0.2) {
            suggestions.push({
              code: subdata.code,
              description: getCodeDescription(subdata.code),
              confidence: 'alternative',
              reason: `Alternativa en mismo capitulo (${Math.round(score * 100)}% coincidencia)`
            });
          }
        }
      });
    }
  });

  return suggestions.slice(0, 5);
}

/**
 * Get code description (simplified)
 */
function getCodeDescription(code) {
  const descriptions = {
    '8517.12': 'Telefonos moviles y redes celulares',
    '8471.30': 'Maquinas automaticas para tratamiento de datos portatiles',
    '8528.72': 'Aparatos receptores de television, en colores',
    '6109.10': 'Camisetas de algodon de punto',
    '6205.20': 'Camisas de algodon para hombres',
    '6203.42': 'Pantalones de algodon para hombres',
    '6110.20': 'Sueteres de algodon de punto',
    '6404.11': 'Calzado de deporte con suela de caucho',
    '6403.99': 'Otro calzado con parte superior de cuero',
    '9503.00': 'Juguetes diversos',
    '9401.61': 'Asientos con armazon de madera tapizados',
    '3923.29': 'Sacos, bolsas y cucuruchos de plastico'
  };

  return descriptions[code] || `Codigo ${code}`;
}

/**
 * Generate reasoning for classification
 */
function generateReasoning(match, description) {
  const reasons = [];

  reasons.push(`Categoria detectada: ${match.category}`);

  if (match.subcategory) {
    reasons.push(`Subcategoria: ${match.subcategory}`);
  }

  reasons.push(`Capitulo TARIC: ${match.chapter}`);
  reasons.push(`Puntuacion de coincidencia: ${Math.round(match.score * 100)}%`);

  return reasons;
}

/**
 * Get additional checks needed
 */
function getAdditionalChecks(match) {
  const checks = [];

  // Chapter-specific checks
  const chapterChecks = {
    '61': ['Verificar composicion textil (>50% algodon, sintetico, etc.)', 'Confirmar si es de punto'],
    '62': ['Verificar composicion textil', 'Confirmar si NO es de punto'],
    '64': ['Verificar material de la suela', 'Verificar material de la parte superior'],
    '85': ['Verificar funcion principal del aparato', 'Confirmar si incluye pantalla'],
    '84': ['Verificar si es maquina automatica', 'Confirmar uso principal']
  };

  if (chapterChecks[match.chapter]) {
    checks.push(...chapterChecks[match.chapter]);
  }

  checks.push('Verificar reglas de origen si aplica preferencia');
  checks.push('Comprobar si requiere certificados especiales');

  return checks;
}

/**
 * Get general suggestions when no match found
 */
function getGeneralSuggestions(description) {
  return [
    {
      action: 'Proporcionar mas detalles sobre el material',
      example: 'algodon, plastico, metal, cuero, etc.'
    },
    {
      action: 'Indicar el uso principal del producto',
      example: 'decoracion, vestir, herramienta, juego, etc.'
    },
    {
      action: 'Especificar la composicion',
      example: '80% algodon, 20% poliester'
    },
    {
      action: 'Consultar con experto en clasificacion',
      example: 'Para productos complejos o novedosos'
    }
  ];
}

/**
 * Record feedback for learning
 */
function recordClassificationFeedback(classificationId, correctCode, notes = '') {
  const original = classificationHistory.find(c => c.id === classificationId);

  if (!original) {
    return { success: false, error: 'Classification not found' };
  }

  const feedback = {
    classificationId,
    originalCode: original.result.code,
    correctCode,
    wasCorrect: original.result.code === correctCode,
    notes,
    timestamp: new Date()
  };

  feedbackHistory.push(feedback);

  // Update model confidence based on feedback
  const recentFeedback = feedbackHistory.slice(-100);
  const correctCount = recentFeedback.filter(f => f.wasCorrect).length;
  modelConfidence = Math.max(0.5, correctCount / recentFeedback.length);

  logger.info('Classification feedback recorded', {
    classificationId,
    wasCorrect: feedback.wasCorrect,
    newConfidence: modelConfidence
  });

  return {
    success: true,
    feedback,
    modelConfidence: Math.round(modelConfidence * 100)
  };
}

/**
 * Get classification statistics
 */
function getClassificationStats() {
  const totalClassifications = classificationHistory.length;
  const totalFeedback = feedbackHistory.length;
  const correctCount = feedbackHistory.filter(f => f.wasCorrect).length;

  // Most common categories
  const categoryCount = classificationHistory.reduce((acc, c) => {
    const cat = c.result?.category || 'unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return {
    success: true,
    statistics: {
      totalClassifications,
      totalFeedback,
      accuracy: totalFeedback > 0 ? Math.round((correctCount / totalFeedback) * 100) : null,
      modelConfidence: Math.round(modelConfidence * 100),
      categoryDistribution: categoryCount,
      lastUpdated: new Date().toISOString()
    }
  };
}

module.exports = {
  classifyProduct,
  recordClassificationFeedback,
  getClassificationStats,
  CLASSIFICATION_PATTERNS
};
