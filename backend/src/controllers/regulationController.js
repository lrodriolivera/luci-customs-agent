/**
 * Regulation Controller - BOE and EUR-Lex Search
 * Handles regulation search and LUCI analysis
 *
 * STRIX AI - LUCI Customs Agent
 */

const regulationService = require('../services/regulationService');
const aiService = require('../services/aiService');
const logger = require('../config/logger');

/**
 * Search BOE regulations
 * GET /api/regulations/boe/search
 */
const searchBOE = async (req, res) => {
  try {
    const { q: query, department, dateFrom, dateTo, limit } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un término de búsqueda (q)'
      });
    }

    const results = await regulationService.searchBOE({
      query,
      department,
      dateFrom,
      dateTo,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error('Error searching BOE:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error buscando en BOE'
    });
  }
};

/**
 * Search EUR-Lex regulations
 * GET /api/regulations/eurlex/search
 */
const searchEURLex = async (req, res) => {
  try {
    const { q: query, type, year, limit } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un término de búsqueda (q)'
      });
    }

    const results = await regulationService.searchEURLex({
      query,
      type,
      year,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error('Error searching EUR-Lex:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error buscando en EUR-Lex'
    });
  }
};

/**
 * Combined search across BOE and EUR-Lex
 * GET /api/regulations/search
 */
const searchAll = async (req, res) => {
  try {
    const { q: query, limit } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un término de búsqueda (q)'
      });
    }

    const results = await regulationService.searchAll(query, {
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error('Error in combined search:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error en búsqueda combinada'
    });
  }
};

/**
 * Get CAU regulations catalog
 * GET /api/regulations/cau/catalog
 */
const getCAUCatalog = async (req, res) => {
  try {
    const catalog = regulationService.getCAUCatalog();

    res.json({
      success: true,
      data: {
        catalog: catalog,
        description: 'Catálogo de reglamentos del Código Aduanero de la Unión (CAU)'
      }
    });

  } catch (error) {
    logger.error('Error getting CAU catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo catálogo CAU'
    });
  }
};

/**
 * Get BOE regulations catalog
 * GET /api/regulations/boe/catalog
 */
const getBOECatalog = async (req, res) => {
  try {
    const catalog = regulationService.getBOECatalog();

    res.json({
      success: true,
      data: {
        catalog: catalog,
        description: 'Catálogo de normativa aduanera española (BOE)'
      }
    });

  } catch (error) {
    logger.error('Error getting BOE catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo catálogo BOE'
    });
  }
};

/**
 * Get document content
 * GET /api/regulations/document
 */
const getDocument = async (req, res) => {
  try {
    const { source, id } = req.query;

    if (!source || !id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere source (BOE/EUR-Lex) e id del documento'
      });
    }

    const document = await regulationService.getDocumentContent(source, id);

    res.json({
      success: true,
      data: document
    });

  } catch (error) {
    logger.error('Error getting document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo documento'
    });
  }
};

/**
 * Search specific article
 * GET /api/regulations/article
 */
const searchArticle = async (req, res) => {
  try {
    const { celex, article } = req.query;

    if (!celex || !article) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere celex (número CELEX) y article (número de artículo)'
      });
    }

    const result = await regulationService.searchArticle(celex, article);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error searching article:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error buscando artículo'
    });
  }
};

/**
 * Analyze regulation with LUCI
 * POST /api/regulations/analyze
 */
const analyzeRegulation = async (req, res) => {
  try {
    const { source, documentId, question, context } = req.body;

    if (!documentId || !question) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere documentId y question'
      });
    }

    // Get document content if needed
    let documentContent = req.body.content;

    if (!documentContent && source && documentId) {
      try {
        const doc = await regulationService.getDocumentContent(source, documentId);
        documentContent = doc.content;
      } catch (error) {
        logger.warn(`Could not fetch document ${documentId}, using provided context only`);
      }
    }

    // Build prompt for LUCI
    const prompt = buildAnalysisPrompt(documentId, question, documentContent, context);

    // Call AI service for analysis
    const analysis = await aiService.analyzeRegulation(prompt, {
      documentId,
      source,
      question
    });

    res.json({
      success: true,
      data: {
        documentId: documentId,
        source: source,
        question: question,
        analysis: analysis.message,
        confidence: analysis.confidence,
        model: analysis.model,
        tokensUsed: analysis.tokensUsed,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error analyzing regulation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error analizando normativa'
    });
  }
};

/**
 * Analyze TARIC classification based on regulations
 * POST /api/regulations/analyze-classification
 */
const analyzeClassification = async (req, res) => {
  try {
    const { productDescription, proposedCode, regulations, context } = req.body;

    if (!productDescription) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere descripción del producto'
      });
    }

    // Build prompt for classification analysis
    const prompt = buildClassificationPrompt(productDescription, proposedCode, regulations, context);

    // Call AI service
    const analysis = await aiService.analyzeRegulation(prompt, {
      type: 'classification',
      productDescription,
      proposedCode
    });

    res.json({
      success: true,
      data: {
        productDescription,
        proposedCode,
        analysis: analysis.message,
        confidence: analysis.confidence,
        model: analysis.model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error analyzing classification:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error analizando clasificación'
    });
  }
};

/**
 * Quick query about customs regulations
 * POST /api/regulations/query
 */
const queryRegulations = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una pregunta'
      });
    }

    // Use LUCI to answer the question
    const response = await aiService.askLuci(
      `Consulta sobre normativa aduanera:\n\n${question}\n\n` +
      `Por favor, responde citando la normativa aplicable (CAU, Reglamentos Delegados, BOE, etc.) cuando sea relevante.`
    );

    res.json({
      success: true,
      data: {
        question: question,
        answer: response.message,
        confidence: response.confidence,
        model: response.model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error querying regulations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error consultando normativa'
    });
  }
};

/**
 * Build analysis prompt for LUCI
 */
function buildAnalysisPrompt(documentId, question, content, context) {
  let prompt = `ANÁLISIS DE NORMATIVA ADUANERA\n\n`;
  prompt += `Documento: ${documentId}\n`;

  if (content) {
    // Limit content length to avoid token limits
    const maxContentLength = 8000;
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '... [contenido truncado]'
      : content;

    prompt += `\nCONTENIDO DEL DOCUMENTO:\n${truncatedContent}\n\n`;
  }

  if (context) {
    prompt += `CONTEXTO ADICIONAL:\n${context}\n\n`;
  }

  prompt += `PREGUNTA:\n${question}\n\n`;
  prompt += `Por favor, proporciona un análisis detallado basado en la normativa aplicable. `;
  prompt += `Cita artículos específicos cuando sea posible y explica cómo se aplican al caso concreto.`;

  return prompt;
}

/**
 * Build classification analysis prompt
 */
function buildClassificationPrompt(productDescription, proposedCode, regulations, context) {
  let prompt = `ANÁLISIS DE CLASIFICACIÓN ARANCELARIA SEGÚN NORMATIVA\n\n`;
  prompt += `PRODUCTO: ${productDescription}\n`;

  if (proposedCode) {
    prompt += `CÓDIGO PROPUESTO: ${proposedCode}\n`;
  }

  if (regulations && regulations.length > 0) {
    prompt += `\nNORMATIVA DE REFERENCIA:\n`;
    regulations.forEach(reg => {
      prompt += `- ${reg.title || reg.id}\n`;
    });
  }

  if (context) {
    prompt += `\nCONTEXTO: ${context}\n`;
  }

  prompt += `\nPor favor, analiza:\n`;
  prompt += `1. Si el código propuesto es correcto según las Reglas Generales de Interpretación del SA\n`;
  prompt += `2. Notas de sección/capítulo aplicables\n`;
  prompt += `3. Posibles códigos alternativos y su justificación\n`;
  prompt += `4. Normativa específica (CAU, TARIC) que afecte a esta clasificación`;

  return prompt;
}

module.exports = {
  searchBOE,
  searchEURLex,
  searchAll,
  getCAUCatalog,
  getBOECatalog,
  getDocument,
  searchArticle,
  analyzeRegulation,
  analyzeClassification,
  queryRegulations
};
