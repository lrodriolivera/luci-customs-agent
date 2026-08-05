/**
 * Rules Engine Controller
 * Endpoints para analisis automatico de requisitos aduaneros
 */

const rulesEngine = require('../services/rulesEngine');
const logger = require('../config/logger');

/**
 * POST /api/rules/analyze
 * Analizar operacion completa y determinar requisitos
 */
exports.analyzeOperation = async (req, res) => {
  try {
    const operation = req.body;

    // Validar datos minimos
    if (!operation.type || !operation.originCountry || !operation.goods) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos obligatorios: type, originCountry, goods'
      });
    }

    const analysis = await rulesEngine.analyzeOperation(operation);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in analyzeOperation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/check-sanctions
 * Verificar si un pais tiene sanciones
 */
exports.checkSanctions = async (req, res) => {
  try {
    const { countryCode } = req.body;

    if (!countryCode) {
      return res.status(400).json({
        success: false,
        error: 'countryCode es obligatorio'
      });
    }

    const result = rulesEngine.checkSanctions(countryCode);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in checkSanctions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/check-preferences
 * Verificar preferencias arancelarias disponibles
 */
exports.checkPreferences = async (req, res) => {
  try {
    const operation = req.body;

    if (!operation.originCountry) {
      return res.status(400).json({
        success: false,
        error: 'originCountry es obligatorio'
      });
    }

    const preferences = rulesEngine.checkPreferences(operation);

    res.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in checkPreferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/rules/agreements/:countryCode
 * Obtener acuerdos comerciales de un pais
 */
exports.getAgreements = async (req, res) => {
  try {
    const { countryCode } = req.params;

    const agreements = rulesEngine.getApplicableAgreements(countryCode);

    res.json({
      success: true,
      data: {
        country: countryCode,
        agreements,
        count: agreements.length
      }
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in getAgreements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/calculate-tariff
 * Calcular arancel para una operacion
 */
exports.calculateTariff = async (req, res) => {
  try {
    const operation = req.body;

    if (!operation.goods || !Array.isArray(operation.goods)) {
      return res.status(400).json({
        success: false,
        error: 'goods array es obligatorio'
      });
    }

    const tariff = await rulesEngine.calculateTariff(operation);

    res.json({
      success: true,
      data: tariff
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in calculateTariff:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/calculate-taxes
 * Calcular todos los impuestos (arancel + IVA + IIEE)
 */
exports.calculateTaxes = async (req, res) => {
  try {
    const operation = req.body;

    if (!operation.goods || !Array.isArray(operation.goods)) {
      return res.status(400).json({
        success: false,
        error: 'goods array es obligatorio'
      });
    }

    const tariff = await rulesEngine.calculateTariff(operation);
    const taxes = await rulesEngine.calculateTaxes(operation, tariff);

    res.json({
      success: true,
      data: taxes
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in calculateTaxes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/check-restrictions
 * Verificar si un producto esta restringido
 */
exports.checkRestrictions = async (req, res) => {
  try {
    const { taricCode } = req.body;

    if (!taricCode) {
      return res.status(400).json({
        success: false,
        error: 'taricCode es obligatorio'
      });
    }

    const restriction = rulesEngine.checkRestrictions(taricCode);

    res.json({
      success: true,
      data: restriction
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in checkRestrictions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/check-dual-use
 * Verificar si productos son de doble uso
 */
exports.checkDualUse = async (req, res) => {
  try {
    const { goods } = req.body;

    if (!goods || !Array.isArray(goods)) {
      return res.status(400).json({
        success: false,
        error: 'goods array es obligatorio'
      });
    }

    const dualUse = rulesEngine.checkDualUse(goods);

    res.json({
      success: true,
      data: dualUse
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in checkDualUse:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/rules/validate-compliance
 * Validar si operacion cumple con requisitos
 */
exports.validateCompliance = async (req, res) => {
  try {
    const { operation, providedDocuments } = req.body;

    if (!operation) {
      return res.status(400).json({
        success: false,
        error: 'operation es obligatorio'
      });
    }

    const compliance = await rulesEngine.validateCompliance(operation, providedDocuments || []);

    res.json({
      success: true,
      data: compliance
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in validateCompliance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/rules/info
 * Obtener informacion sobre capacidades del motor
 */
exports.getInfo = async (req, res) => {
  try {
    const info = {
      version: '1.0.0',
      capabilities: [
        'sanctions_screening',
        'tariff_calculation',
        'tax_calculation',
        'preferential_agreements',
        'paracustoms_controls',
        'dual_use_detection',
        'restrictions_check',
        'documentation_requirements',
        'compliance_validation'
      ],
      supported_agreements: [
        'CETA (Canada)',
        'JEFTA (Japan)',
        'EU-UK',
        'EU-MERCOSUR',
        'EU-MEXICO',
        'EU-CHILE',
        'EU-KOREA',
        'EU-VIETNAM',
        'GSP',
        'GSP+',
        'EBA'
      ],
      coverage: {
        countries: 150,
        taric_chapters: 97,
        fta_agreements: 11
      }
    };

    res.json({
      success: true,
      data: info
    });

  } catch (error) {
    logger.error('[RulesEngineController] Error in getInfo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
