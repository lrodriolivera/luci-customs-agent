const { TaricCode, Expedition, TaricSearchHistory, TaricAICache } = require('../models');
const logger = require('../config/logger');
const aiService = require('../services/aiService');
const taricService = require('../services/taricService');

/**
 * Sugerir codigo TARIC basado en descripcion
 * POST /api/classification/suggest
 */
const suggestTaricCode = async (req, res) => {
  try {
    const { description, additionalInfo, expeditionId, itemIndex } = req.body;

    // Obtener contexto del expediente si se proporciona
    let expeditionContext = null;
    if (expeditionId) {
      expeditionContext = await Expedition.findById(expeditionId).lean();
    }

    // Llamar al servicio de IA para clasificacion
    const suggestions = await aiService.classifyProduct({
      description,
      additionalInfo: additionalInfo || {},
      expeditionContext
    });

    // Si hay expediente e itemIndex, guardar sugerencias
    if (expeditionId && itemIndex !== undefined) {
      const expedition = await Expedition.findById(expeditionId);
      if (expedition) {
        expedition.aiAnalysis = expedition.aiAnalysis || {};
        expedition.aiAnalysis.classificationSuggestions = expedition.aiAnalysis.classificationSuggestions || [];

        // Remover sugerencias anteriores para este item
        expedition.aiAnalysis.classificationSuggestions = expedition.aiAnalysis.classificationSuggestions
          .filter(s => s.itemIndex !== itemIndex);

        // Agregar nuevas sugerencias
        suggestions.forEach(s => {
          expedition.aiAnalysis.classificationSuggestions.push({
            itemIndex,
            suggestedTaricCode: s.code,
            confidence: s.confidence,
            reasoning: s.reasoning
          });
        });

        expedition.aiAnalysis.lastAnalysisAt = new Date();
        await expedition.save();
      }
    }

    // Enriquecer sugerencias con datos de la BD TARIC
    const enrichedSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => {
        const taricInfo = await TaricCode.findOne({ code: suggestion.code });
        return {
          ...suggestion,
          taricInfo: taricInfo ? {
            description: taricInfo.description,
            duties: taricInfo.duties,
            vat: taricInfo.vat,
            supplementaryUnit: taricInfo.supplementaryUnit,
            requiredDocuments: taricInfo.requiredDocuments,
            measures: taricInfo.measures
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        suggestions: enrichedSuggestions,
        query: { description, additionalInfo }
      }
    });

  } catch (error) {
    logger.error('Error sugiriendo codigo TARIC:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sugerir codigo TARIC'
    });
  }
};

/**
 * Obtener informacion de codigo TARIC
 * GET /api/classification/taric/:code
 */
const getTaricInfo = async (req, res) => {
  const startTime = Date.now();
  let source = 'not_found';

  try {
    const { code } = req.params;
    const userId = req.user?._id;
    const tenantId = req.user?.tenantId;

    // Normalizar codigo
    const normalizedCode = code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);

    // 1. Buscar codigo exacto en base de datos local
    let taricCode = await TaricCode.findOne({ code: normalizedCode });

    if (taricCode) {
      source = 'local_db';

      // Obtener jerarquia completa
      const hierarchy = await taricCode.getFullPath();

      // Obtener codigos hijos si no es hoja
      let children = [];
      if (!taricCode.isLeaf) {
        children = await taricCode.getChildren();
      }

      // Guardar en historial
      await taricService.recordSearch({
        userId,
        tenantId,
        code: normalizedCode,
        searchType: 'code_lookup',
        found: true,
        source: 'local_db',
        description: taricCode.description?.es,
        responseTime: Date.now() - startTime,
        resultSummary: {
          chapter: taricCode.breakdown?.chapter,
          heading: taricCode.breakdown?.heading,
          dutyRate: taricCode.duties?.thirdCountry ? `${taricCode.duties.thirdCountry}%` : '0%',
          hasSpecialMeasures: taricCode.measures?.length > 0
        }
      });

      return res.json({
        success: true,
        data: {
          code: taricCode.toObject(),
          found: true,
          source: 'local_db',
          hierarchy: hierarchy.map(h => ({
            code: h.code,
            level: h.level,
            description: h.description
          })),
          children: children.map(c => ({
            code: c.code,
            description: c.description
          }))
        }
      });
    }

    // 2. Si no esta en BD local, buscar el codigo padre mas cercano
    if (!taricCode && normalizedCode.length > 2) {
      for (let len = normalizedCode.length - 2; len >= 2; len -= 2) {
        const parentCode = normalizedCode.substring(0, len).padEnd(10, '0');
        taricCode = await TaricCode.findOne({ code: parentCode });
        if (taricCode) {
          source = 'local_db_parent';
          break;
        }
      }
    }

    // 3. Si no esta en BD, verificar cache de IA
    const cachedResult = await taricService.getFromAICache(normalizedCode);
    if (cachedResult && cachedResult.aiResponse) {
      source = 'ai_cache';

      // Guardar en historial
      await taricService.recordSearch({
        userId,
        tenantId,
        code: normalizedCode,
        searchType: 'code_lookup',
        found: true,
        source: 'cache',
        description: cachedResult.aiResponse.description_es,
        responseTime: Date.now() - startTime,
        resultSummary: {
          chapter: cachedResult.aiResponse.chapter,
          heading: cachedResult.aiResponse.heading,
          dutyRate: cachedResult.aiResponse.dutyRate,
          hasSpecialMeasures: cachedResult.aiResponse.measures?.length > 0
        }
      });

      return res.json({
        success: true,
        data: {
          code: normalizedCode,
          found: true,
          source: 'ai_cache',
          cached: true,
          cacheHits: cachedResult.hits,
          description: cachedResult.aiResponse.description,
          description_es: cachedResult.aiResponse.description_es,
          chapter: cachedResult.aiResponse.chapter,
          heading: cachedResult.aiResponse.heading,
          subheading: cachedResult.aiResponse.subheading,
          hierarchy: cachedResult.aiResponse.hierarchy || [],
          dutyRate: cachedResult.aiResponse.dutyRate,
          notes: cachedResult.aiResponse.notes,
          measures: cachedResult.aiResponse.measures || [],
          examples: cachedResult.aiResponse.examples || []
        }
      });
    }

    // 4. Intentar API de la UE
    try {
      const euApiResult = await taricService._getCodeFromAPI(normalizedCode);
      if (euApiResult) {
        source = 'eu_api';

        // Guardar en BD local para futuras consultas
        await TaricCode.findOneAndUpdate(
          { code: normalizedCode },
          {
            code: normalizedCode,
            description: euApiResult.description,
            breakdown: euApiResult.breakdown,
            duties: euApiResult.duties,
            vat: euApiResult.vat,
            level: 10,
            isLeaf: true,
            isActive: true,
            lastUpdated: new Date()
          },
          { upsert: true }
        );

        // Guardar en historial
        await taricService.recordSearch({
          userId,
          tenantId,
          code: normalizedCode,
          searchType: 'code_lookup',
          found: true,
          source: 'eu_api',
          description: euApiResult.description?.es,
          responseTime: Date.now() - startTime
        });

        return res.json({
          success: true,
          data: {
            code: normalizedCode,
            found: true,
            source: 'eu_api',
            ...euApiResult
          }
        });
      }
    } catch (apiError) {
      logger.debug('API UE no disponible:', apiError.message);
    }

    // 5. Ultimo recurso: usar IA (Claude)
    try {
      const aiResult = await aiService.getTaricCodeInfo(normalizedCode);
      if (aiResult && aiResult.description) {
        source = 'ai';

        // Guardar en cache de IA
        await taricService.saveToAICache(normalizedCode, aiResult, {
          model: 'claude-sonnet-4-20250514'
        });

        // Guardar en historial
        await taricService.recordSearch({
          userId,
          tenantId,
          code: normalizedCode,
          searchType: 'code_lookup',
          found: true,
          source: 'ai',
          description: aiResult.description_es || aiResult.description,
          responseTime: Date.now() - startTime,
          resultSummary: {
            chapter: aiResult.chapter,
            heading: aiResult.heading,
            dutyRate: aiResult.dutyRate,
            hasSpecialMeasures: aiResult.measures?.length > 0
          }
        });

        return res.json({
          success: true,
          data: {
            code: normalizedCode,
            found: true,
            source: 'ai',
            description: aiResult.description,
            description_es: aiResult.description_es || aiResult.description,
            chapter: aiResult.chapter,
            heading: aiResult.heading,
            subheading: aiResult.subheading,
            hierarchy: aiResult.hierarchy || [],
            dutyRate: aiResult.dutyRate,
            notes: aiResult.notes,
            measures: aiResult.measures || [],
            examples: aiResult.examples || []
          }
        });
      }
    } catch (aiError) {
      logger.warn('Error obteniendo info TARIC via IA:', aiError.message);
    }

    // 6. No encontrado en ninguna fuente
    await taricService.recordSearch({
      userId,
      tenantId,
      code: normalizedCode,
      searchType: 'code_lookup',
      found: false,
      source: 'not_found',
      responseTime: Date.now() - startTime
    });

    return res.json({
      success: true,
      data: {
        code: normalizedCode,
        found: false,
        message: 'Codigo no encontrado. Verifique que el codigo sea correcto o consulte TARIC UE.'
      }
    });

  } catch (error) {
    logger.error('Error obteniendo info TARIC:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener informacion TARIC'
    });
  }
};

/**
 * Buscar codigos TARIC
 * GET /api/classification/search
 */
const searchTaric = async (req, res) => {
  try {
    const { q, chapter, limit = 20 } = req.query;

    let results;

    if (q) {
      // Busqueda por texto
      results = await TaricCode.search(q, parseInt(limit));
    } else if (chapter) {
      // Buscar por capitulo
      results = await TaricCode.findByChapter(chapter);
    } else {
      // Devolver capitulos (nivel 2)
      results = await TaricCode.getChapters();
    }

    res.json({
      success: true,
      data: {
        results,
        count: results.length
      }
    });

  } catch (error) {
    logger.error('Error buscando TARIC:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar codigos TARIC'
    });
  }
};

/**
 * Validar clasificacion propuesta
 * POST /api/classification/validate
 */
const validateClassification = async (req, res) => {
  try {
    const { taricCode, description, origin, value } = req.body;

    // Verificar codigo existe
    const taricInfo = await TaricCode.findOne({ code: taricCode });

    // Validar con IA
    const validationResult = await aiService.validateClassification({
      taricCode,
      description,
      taricInfo,
      origin,
      value
    });

    // Calcular aranceles si es valido
    let dutyCalculation = null;
    if (validationResult.isValid && taricInfo) {
      dutyCalculation = {
        dutyRate: taricInfo.duties?.thirdCountry || 0,
        vatRate: taricInfo.vat?.applicable || 21,
        estimatedDuty: value * (taricInfo.duties?.thirdCountry || 0) / 100,
        estimatedVat: value * (taricInfo.vat?.applicable || 21) / 100
      };
    }

    res.json({
      success: true,
      data: {
        isValid: validationResult.isValid,
        confidence: validationResult.confidence,
        reasoning: validationResult.reasoning,
        warnings: validationResult.warnings,
        requiredDocuments: taricInfo?.requiredDocuments || [],
        measures: taricInfo?.measures || [],
        dutyCalculation
      }
    });

  } catch (error) {
    logger.error('Error validando clasificacion:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar clasificacion'
    });
  }
};

/**
 * Aplicar clasificacion a item del expediente
 * POST /api/classification/apply
 */
const applyClassification = async (req, res) => {
  try {
    const { expeditionId, itemIndex, taricCode, hsCode } = req.body;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.goods[itemIndex]) {
      return res.status(404).json({
        success: false,
        error: 'Item no encontrado en el expediente'
      });
    }

    // Actualizar clasificacion
    expedition.goods[itemIndex].taricCode = taricCode;
    expedition.goods[itemIndex].hsCode = hsCode || taricCode.substring(0, 6);

    // Obtener info del TARIC para aranceles
    const taricInfo = await TaricCode.findOne({ code: taricCode });
    if (taricInfo) {
      expedition.goods[itemIndex].dutyRate = taricInfo.duties?.thirdCountry || 0;
      expedition.goods[itemIndex].vatRate = taricInfo.vat?.applicable || 21;

      // Calcular montos si hay valor
      const value = expedition.goods[itemIndex].invoiceValue || 0;
      expedition.goods[itemIndex].dutyAmount = value * (expedition.goods[itemIndex].dutyRate / 100);
      expedition.goods[itemIndex].vatAmount = (value + expedition.goods[itemIndex].dutyAmount) *
        (expedition.goods[itemIndex].vatRate / 100);
    }

    // Timeline
    expedition.timeline.push({
      action: 'classification_applied',
      description: `Clasificacion TARIC ${taricCode} aplicada al item ${itemIndex + 1}`,
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { itemIndex, taricCode }
    });

    // Verificar si todos los items estan clasificados
    const allClassified = expedition.goods.every(g => g.taricCode);
    if (allClassified && expedition.status === 'classification_pending') {
      expedition.status = 'classification_done';
    }

    await expedition.save();

    res.json({
      success: true,
      data: {
        item: expedition.goods[itemIndex],
        expeditionStatus: expedition.status
      }
    });

  } catch (error) {
    logger.error('Error aplicando clasificacion:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aplicar clasificacion'
    });
  }
};

/**
 * Obtener capitulos TARIC
 * GET /api/classification/chapters
 */
const getChapters = async (req, res) => {
  try {
    const chapters = await TaricCode.getChapters();

    res.json({
      success: true,
      data: chapters
    });

  } catch (error) {
    logger.error('Error obteniendo capitulos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener capitulos TARIC'
    });
  }
};

/**
 * Calcular derechos de importacion
 * POST /api/classification/calculate-duties
 */
const calculateDuties = async (req, res) => {
  try {
    const { taricCode, customsValue, origin, preference, quantity, netWeight } = req.body;

    const calculation = await taricService.calculateDuties({
      taricCode,
      customsValue,
      origin,
      preference: preference || '100',
      quantity,
      netWeight
    });

    res.json({
      success: true,
      data: calculation
    });

  } catch (error) {
    logger.error('Error calculando derechos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al calcular derechos de importacion'
    });
  }
};

/**
 * Obtener documentos requeridos para un codigo TARIC
 * GET /api/classification/required-documents/:code
 */
const getRequiredDocuments = async (req, res) => {
  try {
    const { code } = req.params;
    const { origin } = req.query;

    const documents = await taricService.getRequiredDocuments(code, origin);

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    logger.error('Error obteniendo documentos requeridos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener documentos requeridos'
    });
  }
};

/**
 * Obtener preferencias disponibles por pais
 * GET /api/classification/preferences/:origin
 */
const getPreferences = async (req, res) => {
  try {
    const { origin } = req.params;

    const preferences = taricService.getAvailablePreferences(origin);

    res.json({
      success: true,
      data: {
        origin,
        preferences
      }
    });

  } catch (error) {
    logger.error('Error obteniendo preferencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener preferencias'
    });
  }
};

/**
 * Poblar base de datos TARIC con codigos comunes
 * POST /api/classification/seed
 */
const seedTaricDatabase = async (req, res) => {
  try {
    const result = await taricService.seedCommonCodes();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error poblando base TARIC:', error);
    res.status(500).json({
      success: false,
      error: 'Error al poblar base de datos TARIC'
    });
  }
};

// ==================== AI ENDPOINTS - LUCI Integration ====================

/**
 * Mejorar clasificación con feedback histórico
 * POST /api/classification/ai/improve-with-feedback
 */
const aiImproveWithFeedback = async (req, res) => {
  try {
    const { productDescription, currentSuggestions, feedbackHistory } = req.body;

    if (!productDescription) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere descripción del producto'
      });
    }

    const result = await aiService.improveClassificationWithFeedback(
      productDescription,
      currentSuggestions || [],
      feedbackHistory || []
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error mejorando clasificación con feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Error al mejorar clasificación con feedback'
    });
  }
};

/**
 * Sugerir clasificación basada en historial
 * POST /api/classification/ai/suggest-from-history
 */
const aiSuggestFromHistory = async (req, res) => {
  try {
    const { productDescription, historicalClassifications, clientProfile } = req.body;

    if (!productDescription) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere descripción del producto'
      });
    }

    const result = await aiService.suggestBasedOnHistory(
      productDescription,
      historicalClassifications || [],
      clientProfile || {}
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sugiriendo desde historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sugerir clasificación desde historial'
    });
  }
};

/**
 * Validar clasificación con normativa
 * POST /api/classification/ai/cross-validate
 */
const aiCrossValidate = async (req, res) => {
  try {
    const { classification, productDetails } = req.body;

    if (!classification || !classification.taricCode) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere clasificación con código TARIC'
      });
    }

    const result = await aiService.crossValidateWithRegulations(
      classification,
      productDetails || {}
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error validando con normativa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar clasificación con normativa'
    });
  }
};

/**
 * Análisis completo de clasificación TARIC
 * POST /api/classification/ai/full-analysis
 */
const aiFullAnalysis = async (req, res) => {
  try {
    const { productData, options } = req.body;

    if (!productData || !productData.description) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere productData con descripción'
      });
    }

    const result = await aiService.fullTaricAnalysis(productData, options || {});

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error en análisis completo de clasificación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al realizar análisis completo de clasificación'
    });
  }
};

/**
 * Registrar feedback de clasificación
 * POST /api/classification/ai/record-feedback
 */
const aiRecordFeedback = async (req, res) => {
  try {
    const { classificationData, feedback } = req.body;

    if (!classificationData || !feedback) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere classificationData y feedback'
      });
    }

    const result = await aiService.recordClassificationFeedback(classificationData, feedback);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error registrando feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar feedback de clasificación'
    });
  }
};

// ==================== HISTORIAL Y CACHE ENDPOINTS ====================

/**
 * Obtener historial de busquedas del usuario
 * GET /api/classification/history
 */
const getSearchHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const history = await taricService.getUserSearchHistory(userId, parseInt(limit));

    res.json({
      success: true,
      data: {
        history,
        count: history.length
      }
    });

  } catch (error) {
    logger.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de busquedas'
    });
  }
};

/**
 * Obtener codigos mas buscados
 * GET /api/classification/most-searched
 */
const getMostSearched = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { days = 30, limit = 20 } = req.query;

    const mostSearched = await taricService.getMostSearchedCodes(tenantId, parseInt(days), parseInt(limit));

    res.json({
      success: true,
      data: {
        codes: mostSearched,
        period: `${days} dias`
      }
    });

  } catch (error) {
    logger.error('Error obteniendo codigos mas buscados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener codigos mas buscados'
    });
  }
};

/**
 * Obtener estadisticas de busquedas
 * GET /api/classification/search-stats
 */
const getSearchStats = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { days = 30 } = req.query;

    const stats = await TaricSearchHistory.getSearchStats(tenantId, parseInt(days));

    res.json({
      success: true,
      data: stats[0] || {
        totalSearches: 0,
        foundCount: 0,
        usedCount: 0,
        avgResponseTime: 0,
        foundRate: 0,
        usageRate: 0
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadisticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas de busquedas'
    });
  }
};

/**
 * Obtener estadisticas del cache de IA
 * GET /api/classification/cache-stats
 */
const getCacheStats = async (req, res) => {
  try {
    const stats = await taricService.getAICacheStats();

    res.json({
      success: true,
      data: stats || {
        totalEntries: 0,
        totalHits: 0,
        avgHits: 0,
        validatedCount: 0,
        avgQuality: 0,
        topCodes: []
      }
    });

  } catch (error) {
    logger.error('Error obteniendo stats de cache:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas de cache'
    });
  }
};

/**
 * Marcar busqueda como usada (aplicada a expediente)
 * PUT /api/classification/history/:searchId/mark-used
 */
const markSearchAsUsed = async (req, res) => {
  try {
    const { searchId } = req.params;
    const { expeditionId } = req.body;

    const search = await TaricSearchHistory.findByIdAndUpdate(
      searchId,
      {
        wasUsed: true,
        expeditionId
      },
      { new: true }
    );

    if (!search) {
      return res.status(404).json({
        success: false,
        error: 'Busqueda no encontrada'
      });
    }

    res.json({
      success: true,
      data: search
    });

  } catch (error) {
    logger.error('Error marcando busqueda como usada:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar busqueda como usada'
    });
  }
};

/**
 * Limpiar cache antiguo de IA
 * DELETE /api/classification/cache/clean
 */
const cleanOldCache = async (req, res) => {
  try {
    const { daysOld = 60 } = req.query;

    const result = await TaricAICache.cleanOldCache(parseInt(daysOld));

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        message: `Cache de mas de ${daysOld} dias limpiado`
      }
    });

  } catch (error) {
    logger.error('Error limpiando cache:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar cache'
    });
  }
};

module.exports = {
  suggestTaricCode,
  getTaricInfo,
  searchTaric,
  validateClassification,
  applyClassification,
  getChapters,
  calculateDuties,
  getRequiredDocuments,
  getPreferences,
  seedTaricDatabase,
  // AI endpoints
  aiImproveWithFeedback,
  aiSuggestFromHistory,
  aiCrossValidate,
  aiFullAnalysis,
  aiRecordFeedback,
  // History & Cache endpoints
  getSearchHistory,
  getMostSearched,
  getSearchStats,
  getCacheStats,
  markSearchAsUsed,
  cleanOldCache
};
