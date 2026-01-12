const { TaricCode, Expedition } = require('../models');
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
  try {
    const { code } = req.params;

    // Buscar codigo exacto
    let taricCode = await TaricCode.findOne({ code });

    // Si no existe, intentar buscar el codigo padre mas cercano
    if (!taricCode && code.length > 2) {
      for (let len = code.length - 2; len >= 2; len -= 2) {
        const parentCode = code.substring(0, len).padEnd(code.length, '0');
        taricCode = await TaricCode.findOne({ code: parentCode });
        if (taricCode) break;
      }
    }

    if (!taricCode) {
      // Intentar obtener de API externa o devolver info basica
      return res.json({
        success: true,
        data: {
          code,
          found: false,
          message: 'Codigo no encontrado en base de datos local. Consulte TARIC UE.'
        }
      });
    }

    // Obtener jerarquia completa
    const hierarchy = await taricCode.getFullPath();

    // Obtener codigos hijos si no es hoja
    let children = [];
    if (!taricCode.isLeaf) {
      children = await taricCode.getChildren();
    }

    res.json({
      success: true,
      data: {
        code: taricCode.toObject(),
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
  seedTaricDatabase
};
