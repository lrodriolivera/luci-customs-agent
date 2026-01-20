/**
 * Excise Duties Controller
 * Endpoints para gestión de Impuestos Especiales (SILICIE)
 */

const exciseDutiesService = require('../services/exciseDutiesService');
const logger = require('../config/logger');

/**
 * POST /api/excise/detect
 * Detectar si un producto está sujeto a impuestos especiales
 */
exports.detectExciseProduct = async (req, res) => {
  try {
    const { taricCode } = req.body;

    if (!taricCode) {
      return res.status(400).json({
        success: false,
        error: 'taricCode es obligatorio'
      });
    }

    const result = exciseDutiesService.detectExciseProduct(taricCode);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in detectExciseProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/excise/calculate
 * Calcular impuesto especial para un producto
 *
 * Body:
 * {
 *   taricCode: '2203000010',
 *   description: 'Cerveza',
 *   quantity: 1000,
 *   unit: 'L',
 *   alcoholContent: 5.0,
 *   price: 2000
 * }
 */
exports.calculateExciseDuty = async (req, res) => {
  try {
    const product = req.body;

    if (!product.taricCode || !product.quantity) {
      return res.status(400).json({
        success: false,
        error: 'taricCode y quantity son obligatorios'
      });
    }

    const result = exciseDutiesService.calculateExciseDuty(product);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in calculateExciseDuty:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/excise/calculate-total
 * Calcular impuestos especiales para múltiples productos
 *
 * Body:
 * {
 *   goods: [
 *     { taricCode: '2203000010', description: 'Cerveza', quantity: 1000, alcoholContent: 5.0 },
 *     { taricCode: '2402200000', description: 'Cigarrillos', quantity: 10000, price: 5000 }
 *   ]
 * }
 */
exports.calculateTotalExciseDuties = async (req, res) => {
  try {
    const { goods } = req.body;

    if (!goods || !Array.isArray(goods) || goods.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'goods array es obligatorio y debe contener al menos un producto'
      });
    }

    const result = exciseDutiesService.calculateTotalExciseDuties(goods);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in calculateTotalExciseDuties:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/excise/generate-document
 * Generar documento DUA-SILICIE
 *
 * Body:
 * {
 *   operation: { type: 'import', originCountry: 'FR', destinationCountry: 'ES' },
 *   goods: [...]
 * }
 */
exports.generateSILICIEDocument = async (req, res) => {
  try {
    const { operation, goods } = req.body;

    if (!operation || !goods || !Array.isArray(goods)) {
      return res.status(400).json({
        success: false,
        error: 'operation y goods array son obligatorios'
      });
    }

    // Calcular impuestos especiales
    const exciseDuties = exciseDutiesService.calculateTotalExciseDuties(goods);

    // Generar documento SILICIE
    const document = exciseDutiesService.generateSILICIEDocument(operation, exciseDuties);

    res.json({
      success: true,
      data: document
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in generateSILICIEDocument:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/excise/check-exemptions
 * Verificar exenciones aplicables
 *
 * Body:
 * {
 *   product: { taricCode: '2207100000', description: 'Alcohol etílico' },
 *   usage: 'medical use in hospital'
 * }
 */
exports.checkExemptions = async (req, res) => {
  try {
    const { product, usage } = req.body;

    if (!product || !product.taricCode) {
      return res.status(400).json({
        success: false,
        error: 'product con taricCode es obligatorio'
      });
    }

    const result = exciseDutiesService.checkExemptions(product, usage);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in checkExemptions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/excise/categories
 * Obtener categorías de productos sujetos a impuestos especiales
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = exciseDutiesService.EXCISE_CATEGORIES;

    res.json({
      success: true,
      data: {
        categories: Object.keys(categories).map(key => ({
          code: key,
          name: categories[key].name,
          taricRanges: categories[key].taricRanges,
          subcategories: categories[key].subcategories
        }))
      }
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in getCategories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/excise/rates
 * Obtener tarifas actuales de impuestos especiales
 */
exports.getRates = async (req, res) => {
  try {
    const rates = exciseDutiesService.EXCISE_RATES;

    res.json({
      success: true,
      data: {
        rates,
        year: 2024,
        currency: 'EUR',
        note: 'Tarifas basadas en Ley 38/1992 y actualizaciones vigentes'
      }
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in getRates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/excise/exemptions
 * Obtener lista de exenciones disponibles
 */
exports.getExemptions = async (req, res) => {
  try {
    const exemptions = exciseDutiesService.EXEMPTIONS;

    res.json({
      success: true,
      data: {
        exemptions,
        note: 'Exenciones sujetas a autorización y cumplimiento de requisitos específicos'
      }
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in getExemptions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/excise/info
 * Información sobre el sistema SILICIE
 */
exports.getInfo = async (req, res) => {
  try {
    const info = {
      system: 'SILICIE',
      fullName: 'Sistema de Información del Impuesto sobre Labores del Tabaco y otros Impuestos Especiales',
      version: '1.0.0',
      authority: 'Agencia Tributaria Española',
      coverage: {
        alcohol: 'Cerveza, vino, productos intermedios, alcohol etílico, bebidas espirituosas',
        tobacco: 'Cigarrillos, cigarros, picadura, otros tabacos',
        hydrocarbons: 'Gasolinas, gasóleo, GLP, gas natural, carbón, queroseno, fuelóleo',
        electricity: 'Energía eléctrica'
      },
      legislation: {
        main: 'Ley 38/1992, de 28 de diciembre',
        updates: 'Ley de Presupuestos Generales del Estado (anual)',
        regulations: 'Real Decreto 1165/1995'
      },
      emcs: {
        name: 'Excise Movement and Control System',
        description: 'Sistema europeo para control de circulación de productos en suspensión',
        required: true
      },
      capabilities: [
        'Detección automática de productos sujetos',
        'Cálculo de impuestos por categoría',
        'Generación de documentos DUA-SILICIE',
        'Verificación de exenciones',
        'Integración con EMCS',
        'Gestión de garantías'
      ]
    };

    res.json({
      success: true,
      data: info
    });

  } catch (error) {
    logger.error('[ExciseDutiesController] Error in getInfo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
