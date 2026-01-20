/**
 * Quota Controller
 * Endpoints para gestión de Contingentes Arancelarios (TRQ)
 */

const quotaService = require('../services/quotaService');
const logger = require('../config/logger');

/**
 * POST /api/quotas/check-availability
 * Verificar disponibilidad de contingente
 *
 * Body:
 * {
 *   taricCode: '02011000',
 *   originCountry: 'AR',
 *   quantity: 10000,
 *   unit: 'kg'
 * }
 */
exports.checkAvailability = async (req, res) => {
  try {
    const { taricCode, originCountry, quantity, unit } = req.body;

    if (!taricCode || !originCountry || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'taricCode, originCountry y quantity son obligatorios'
      });
    }

    const result = quotaService.checkQuotaAvailability(
      taricCode,
      originCountry,
      quantity,
      unit || 'kg'
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[QuotaController] Error in checkAvailability:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/quotas/reserve
 * Reservar contingente
 *
 * Body:
 * {
 *   quotaId: 'Q090001',
 *   quantity: 5000,
 *   operation: { ... }
 * }
 */
exports.reserveQuota = async (req, res) => {
  try {
    const { quotaId, quantity, operation } = req.body;

    if (!quotaId || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'quotaId y quantity son obligatorios'
      });
    }

    const result = quotaService.reserveQuota(quotaId, quantity, operation || {});

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result
      });
    }

  } catch (error) {
    logger.error('[QuotaController] Error in reserveQuota:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/quotas/calculate-savings
 * Calcular ahorro potencial usando contingente
 *
 * Body:
 * {
 *   taricCode: '02011000',
 *   originCountry: 'AR',
 *   quantity: 10000,
 *   customsValue: 50000
 * }
 */
exports.calculateSavings = async (req, res) => {
  try {
    const { taricCode, originCountry, quantity, customsValue } = req.body;

    if (!taricCode || !originCountry || !quantity || !customsValue) {
      return res.status(400).json({
        success: false,
        error: 'taricCode, originCountry, quantity y customsValue son obligatorios'
      });
    }

    const result = quotaService.calculateQuotaSavings(
      taricCode,
      originCountry,
      quantity,
      customsValue
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[QuotaController] Error in calculateSavings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/quotas/by-agreement/:agreementCode
 * Obtener contingentes por acuerdo comercial
 */
exports.getByAgreement = async (req, res) => {
  try {
    const { agreementCode } = req.params;

    const result = quotaService.getQuotasByAgreement(agreementCode);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[QuotaController] Error in getByAgreement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/quotas/critical
 * Obtener contingentes críticos (>90% utilización)
 */
exports.getCritical = async (req, res) => {
  try {
    const critical = quotaService.getCriticalQuotas();

    res.json({
      success: true,
      data: {
        count: critical.length,
        quotas: critical
      }
    });

  } catch (error) {
    logger.error('[QuotaController] Error in getCritical:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/quotas/report
 * Generar reporte de contingentes
 *
 * Body (opcional):
 * {
 *   type: 'fta',
 *   agreement: 'CETA',
 *   originCountry: 'CA'
 * }
 */
exports.generateReport = async (req, res) => {
  try {
    const filters = req.body || {};

    const report = quotaService.generateQuotaReport(filters);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('[QuotaController] Error in generateReport:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/quotas/list
 * Listar todos los contingentes activos
 */
exports.listAll = async (req, res) => {
  try {
    const quotas = quotaService.ACTIVE_QUOTAS;

    const quotaList = Object.entries(quotas).map(([quotaId, quota]) => {
      const utilization = (quota.volume.used / quota.volume.total) * 100;

      return {
        quotaId,
        orderNumber: quota.orderNumber,
        type: quota.type,
        agreement: quota.agreement,
        description: quota.description,
        originCountries: quota.originCountries,
        volume: {
          ...quota.volume,
          utilizationPercent: parseFloat(utilization.toFixed(2))
        },
        duty: quota.duty,
        period: quota.period,
        status: quota.volume.available <= 0 ? 'exhausted' :
                utilization > 90 ? 'critical' : 'available'
      };
    });

    res.json({
      success: true,
      data: {
        count: quotaList.length,
        quotas: quotaList
      }
    });

  } catch (error) {
    logger.error('[QuotaController] Error in listAll:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/quotas/:orderNumber
 * Obtener detalles de un contingente específico
 */
exports.getByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const quota = Object.entries(quotaService.ACTIVE_QUOTAS)
      .find(([_, q]) => q.orderNumber === orderNumber);

    if (!quota) {
      return res.status(404).json({
        success: false,
        error: 'Contingente no encontrado'
      });
    }

    const [quotaId, quotaData] = quota;
    const utilization = (quotaData.volume.used / quotaData.volume.total) * 100;

    res.json({
      success: true,
      data: {
        quotaId,
        orderNumber: quotaData.orderNumber,
        type: quotaData.type,
        agreement: quotaData.agreement,
        description: quotaData.description,
        taricCodes: quotaData.taricCodes,
        originCountries: quotaData.originCountries,
        volume: {
          ...quotaData.volume,
          utilizationPercent: parseFloat(utilization.toFixed(2))
        },
        duty: quotaData.duty,
        period: quotaData.period,
        allocationMethod: quotaData.allocationMethod,
        requiresCertificate: quotaData.requiresCertificate,
        status: quotaData.volume.available <= 0 ? 'exhausted' :
                utilization > 90 ? 'critical' : 'available'
      }
    });

  } catch (error) {
    logger.error('[QuotaController] Error in getByOrderNumber:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/quotas/info
 * Información sobre el sistema de contingentes
 */
exports.getInfo = async (req, res) => {
  try {
    const info = {
      system: 'Tariff Rate Quotas (TRQ)',
      description: 'Sistema de gestión de contingentes arancelarios de la UE',
      version: '1.0.0',
      capabilities: [
        'Verificación de disponibilidad en tiempo real',
        'Reserva y asignación de contingentes',
        'Cálculo de ahorros arancelarios',
        'Monitoreo de contingentes críticos',
        'Reportes por acuerdo comercial',
        'Alertas de agotamiento'
      ],
      allocationMethods: {
        fcfs: 'First Come First Served - Por orden de llegada',
        traditional: 'Importadores tradicionales - Basado en histórico',
        license: 'Licencia de importación - Requiere autorización previa'
      },
      quotaTypes: {
        autonomous: 'Contingentes autónomos UE',
        fta: 'Contingentes de acuerdos de libre comercio',
        agricultural: 'Contingentes agrícolas específicos',
        wto: 'Contingentes OMC'
      },
      coverage: {
        activeQuotas: Object.keys(quotaService.ACTIVE_QUOTAS).length,
        agreements: ['CETA', 'JEFTA', 'EU-MERCOSUR', 'Autónomos'],
        products: 'Principalmente agrícolas y agroalimentarios'
      },
      documentation: {
        dua_field: 'Casilla 47 del DUA - Número de orden',
        certificate: 'EUR.1 o equivalente según acuerdo',
        proof: 'Documentación probatoria por 3 años'
      }
    };

    res.json({
      success: true,
      data: info
    });

  } catch (error) {
    logger.error('[QuotaController] Error in getInfo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
