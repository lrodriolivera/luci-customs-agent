/**
 * Preferences Controller
 * Endpoints para gestion de Preferencias Arancelarias
 *
 * Stock Logistic - LUCI Customs Agent
 */

const preferencesService = require('../services/preferencesService');
const logger = require('../config/logger');

/**
 * POST /api/preferences/eligibility
 * Verificar elegibilidad para preferencias arancelarias
 *
 * Body:
 * {
 *   originCountry: 'CA',
 *   goods: [
 *     { taricCode: '8517120000', customsValue: 50000, description: 'Smartphones' }
 *   ]
 * }
 */
exports.checkEligibility = async (req, res) => {
  try {
    const operation = req.body;

    if (!operation.originCountry) {
      return res.status(400).json({
        success: false,
        error: 'originCountry es obligatorio'
      });
    }

    const result = await preferencesService.checkEligibility(operation);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in checkEligibility:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/preferences/agreements
 * Listar todos los acuerdos preferenciales disponibles
 */
exports.listAgreements = async (req, res) => {
  try {
    const agreements = preferencesService.getAllAgreements();

    res.json({
      success: true,
      data: {
        total: agreements.length,
        agreements
      }
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in listAgreements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/preferences/agreements/:key
 * Obtener informacion de un acuerdo especifico
 */
exports.getAgreement = async (req, res) => {
  try {
    const { key } = req.params;

    const agreement = preferencesService.getAgreementInfo(key);

    if (!agreement) {
      return res.status(404).json({
        success: false,
        error: `Acuerdo '${key}' no encontrado`
      });
    }

    res.json({
      success: true,
      data: agreement
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in getAgreement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/preferences/country/:code
 * Obtener acuerdos aplicables para un pais especifico
 */
exports.getByCountry = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Codigo de pais ISO-2 invalido'
      });
    }

    const agreements = preferencesService.findApplicableAgreements(code.toUpperCase());

    res.json({
      success: true,
      data: {
        country: code.toUpperCase(),
        total: agreements.length,
        agreements: agreements.map(a => ({
          key: a.key,
          name: a.name,
          type: a.type,
          certificate: a.certificate,
          preferentialRate: a.preferentialRate,
          originRules: a.originRules
        }))
      }
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in getByCountry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/preferences/validate-certificate
 * Validar un certificado de origen
 *
 * Body:
 * {
 *   type: 'EUR.1',
 *   certificateNumber: 'ES123456',
 *   issuedDate: '2024-01-15',
 *   exporterName: 'Company X',
 *   consigneeName: 'Company Y',
 *   originCountry: 'CA'
 * }
 */
exports.validateCertificate = async (req, res) => {
  try {
    const certificate = req.body;

    if (!certificate.type || !certificate.issuedDate) {
      return res.status(400).json({
        success: false,
        error: 'type e issuedDate son obligatorios'
      });
    }

    const result = await preferencesService.validateCertificate(certificate);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in validateCertificate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/preferences/optimize
 * Obtener recomendaciones de optimizacion para una operacion
 *
 * Body:
 * {
 *   originCountry: 'CA',
 *   goods: [...],
 *   materials: [...] // opcional, para verificar acumulacion
 * }
 */
exports.getRecommendations = async (req, res) => {
  try {
    const operation = req.body;

    if (!operation.originCountry) {
      return res.status(400).json({
        success: false,
        error: 'originCountry es obligatorio'
      });
    }

    const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

    res.json({
      success: true,
      data: {
        recommendations,
        total: recommendations.length,
        potentialSavings: recommendations.reduce((sum, r) => sum + (r.savings || 0), 0)
      }
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in getRecommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/preferences/origin-rules/:chapter
 * Obtener reglas de origen para un capitulo TARIC
 */
exports.getOriginRules = async (req, res) => {
  try {
    const { chapter } = req.params;

    if (!chapter || chapter.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Capitulo TARIC invalido (2 digitos)'
      });
    }

    const rule = preferencesService.getOriginRule(chapter.substring(0, 2));

    res.json({
      success: true,
      data: {
        chapter: chapter.substring(0, 2),
        ...rule
      }
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in getOriginRules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/preferences/info
 * Informacion general sobre el sistema de preferencias
 */
exports.getInfo = async (req, res) => {
  try {
    const info = {
      system: 'LUCI Preferential Tariffs Module',
      version: '1.0.0',
      description: 'Gestion de preferencias arancelarias para acuerdos de libre comercio',
      coverage: {
        fta: [
          'CETA (Canada)',
          'JEFTA (Japan)',
          'EU-UK Trade and Cooperation Agreement',
          'EU-Mexico',
          'EU-Chile',
          'EU-Korea',
          'EU-Vietnam'
        ],
        gsp: [
          'GSP Standard',
          'GSP+ (Special incentive)',
          'EBA (Everything But Arms)'
        ],
        regional: [
          'Pan-Euro-Mediterranean'
        ]
      },
      certificates: [
        'EUR.1 - Movement Certificate',
        'EUR-MED - Pan-Euro-Med Certificate',
        'Form A - GSP Certificate',
        'Statement on Origin - Invoice Declaration',
        'ATR - Turkey Customs Union'
      ],
      capabilities: [
        'Verificacion de elegibilidad por pais y producto',
        'Validacion de certificados de origen',
        'Calculo de ahorros potenciales',
        'Verificacion de reglas de origen (RVC, CTH, CC)',
        'Deteccion de oportunidades de acumulacion',
        'Recomendaciones de optimizacion'
      ],
      references: {
        euCommission: 'https://trade.ec.europa.eu/access-to-markets/',
        taric: 'https://ec.europa.eu/taxation_customs/dds2/taric/',
        aeat: 'https://www.agenciatributaria.es/'
      }
    };

    res.json({
      success: true,
      data: info
    });

  } catch (error) {
    logger.error('[PreferencesController] Error in getInfo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
