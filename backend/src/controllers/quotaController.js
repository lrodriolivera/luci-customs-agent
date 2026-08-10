/**
 * Contingentes Arancelarios (TRQ) — endpoints.
 *
 * Todo sale del catalogo oficial sincronizado (`TariffQuota`), no de una lista
 * escrita en el codigo: los 11 contingentes que habia cableados en
 * `quotaService.js` no existen en la base de la Comision (10 de los 11 numeros
 * de orden no aparecen en ningun ano).
 *
 * Dos endpoints cambian de contrato a proposito:
 *  - `/reserve` pasa a ser `/claim-data`: no habia reserva ninguna, el cupo lo
 *    atribuye la aduana al admitir la declaracion.
 *  - `/by-agreement` desaparece: la fuente no clasifica los contingentes por
 *    acuerdo comercial, y los que se devolvian (CETA, EU-MERCOSUR) estaban
 *    inventados —EU-MERCOSUR no esta ni en vigor—.
 */

const quotaService = require('../services/quotaService');
const TariffQuota = require('../models/TariffQuota');
const logger = require('../config/logger');

const anoDe = (valor) => {
  const n = parseInt(valor, 10);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : new Date().getFullYear();
};

/**
 * POST /api/quotas/check-availability
 * Contingentes aplicables a un codigo TARIC.
 */
exports.checkAvailability = async (req, res) => {
  try {
    const { taricCode, originCountry, quantity, unit, year } = req.body;

    if (!taricCode || !originCountry || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'taricCode, originCountry y quantity son obligatorios'
      });
    }

    const result = await quotaService.checkQuotaAvailability(
      taricCode,
      originCountry,
      quantity,
      unit || 'kg',
      { year: anoDe(year) }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[QuotaController] Error in checkAvailability:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/quotas/claim-data
 * Datos para consignar el contingente en la declaracion.
 *
 * Sustituye al antiguo `/reserve`, que devolvia un `reservationId` y una validez
 * de 30 dias sin que existiera reserva alguna: el cupo se atribuye al admitirse
 * la declaracion, no antes.
 */
exports.getClaimData = async (req, res) => {
  try {
    const { orderNumber, quantity, year } = req.body;

    if (!orderNumber || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'orderNumber y quantity son obligatorios'
      });
    }

    const result = await quotaService.getQuotaClaimData(orderNumber, quantity, { year: anoDe(year) });

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error, details: result });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[QuotaController] Error in getClaimData:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/quotas/calculate-savings
 *
 * Exige los dos tipos (dentro y fuera del contingente) en la peticion: el
 * sistema de contingentes no publica el tipo in-quota, esta en la medida de
 * TARIC del codigo y el origen concretos. Sin ellos se responde que no se puede
 * cuantificar, no un ahorro de cero.
 */
exports.calculateSavings = async (req, res) => {
  try {
    const { taricCode, originCountry, quantity, customsValue, inQuotaDuty, outQuotaDuty } = req.body;

    if (!taricCode || !originCountry || !quantity || !customsValue) {
      return res.status(400).json({
        success: false,
        error: 'taricCode, originCountry, quantity y customsValue son obligatorios'
      });
    }

    const result = await quotaService.calculateQuotaSavings(
      taricCode,
      originCountry,
      quantity,
      customsValue,
      { inQuotaDuty, outQuotaDuty }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[QuotaController] Error in calculateSavings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/quotas/critical
 * Contingentes que TARIC declara criticos (no un umbral de consumo).
 */
exports.getCritical = async (req, res) => {
  try {
    const critical = await quotaService.getCriticalQuotas({ year: anoDe(req.query?.year) });

    res.json({
      success: true,
      data: {
        count: critical.length,
        criticalSource: 'taric',
        officialSource: quotaService.URL_OFICIAL,
        quotas: critical
      }
    });
  } catch (error) {
    logger.error('[QuotaController] Error in getCritical:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/quotas/report
 */
exports.generateReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const report = await quotaService.generateQuotaReport({ ...filters, year: anoDe(filters.year) });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('[QuotaController] Error in generateReport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/quotas/list
 * Listado paginado del catalogo sincronizado.
 *
 * Se pagina porque la fuente publica ~1.125 contingentes por ano: la version
 * anterior devolvia los 11 inventados de golpe.
 */
exports.listAll = async (req, res) => {
  try {
    const year = anoDe(req.query?.year);
    const limit = Math.min(parseInt(req.query?.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);

    const total = await TariffQuota.countDocuments({ year });
    const report = await quotaService.generateQuotaReport({ year, limit: 0 });

    const quotas = await TariffQuota.find({ year })
      .sort({ orderNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        count: quotas.length,
        total,
        page,
        limit,
        year,
        // Si el catalogo esta vacio es que no se ha sincronizado, no que la UE no
        // tenga contingentes. Decirlo evita leer la lista vacia como "sin TRQ".
        synced: total > 0,
        lastSyncAt: report.summary.lastSyncAt,
        officialSource: quotaService.URL_OFICIAL,
        quotas: quotas.map((q) => quotaService.presentar(q))
      }
    });
  } catch (error) {
    logger.error('[QuotaController] Error in listAll:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/quotas/:orderNumber
 */
exports.getByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const year = anoDe(req.query?.year);

    const quota = await TariffQuota.findOne({ orderNumber: String(orderNumber), year }).lean();

    if (!quota) {
      return res.status(404).json({
        success: false,
        error: `Contingente ${orderNumber} no encontrado en el catalogo oficial de ${year}`,
        officialSource: quotaService.URL_OFICIAL
      });
    }

    res.json({ success: true, data: quotaService.presentar(quota) });
  } catch (error) {
    logger.error('[QuotaController] Error in getByOrderNumber:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/quotas/info
 */
exports.getInfo = async (req, res) => {
  try {
    const year = anoDe(req.query?.year);
    const total = await TariffQuota.countDocuments({ year });
    const critical = await TariffQuota.countDocuments({ year, critical: true });
    const ultimo = await TariffQuota.findOne({ year }).sort({ syncedAt: -1 }).select('syncedAt').lean();

    res.json({
      success: true,
      data: {
        system: 'Contingentes arancelarios (TRQ)',
        description: 'Catalogo de contingentes de la Comision Europea sincronizado desde el sistema QUOTA',
        source: {
          name: 'QUOTA - DG TAXUD',
          url: quotaService.URL_OFICIAL,
          // El saldo se sincroniza, no se lee en vivo en cada peticion.
          isLiveBalance: false,
          lastSyncAt: ultimo?.syncedAt ? new Date(ultimo.syncedAt).toISOString() : null,
          syncedQuotas: total,
          criticalQuotas: critical,
          year
        },
        limitations: [
          'El saldo corresponde a la ultima sincronizacion: un contingente de reparto ' +
          'simultaneo (FCFS) puede agotarse en horas.',
          'El tipo aplicable dentro del contingente no lo publica el sistema de ' +
          'contingentes: esta en la medida de TARIC del codigo y el origen concretos.',
          'La elegibilidad por origen no se resuelve automaticamente: hay que ' +
          'comprobarla en la consulta oficial.',
          'Este sistema no reserva cupo: la atribucion la hace la aduana al admitir ' +
          'la declaracion.'
        ],
        allocationMethods: {
          fcfs: 'First Come First Served - por orden de llegada',
          license: 'Licencia de importacion - requiere autorizacion previa'
        },
        documentation: {
          dua_field: 'Numero de orden del contingente en la declaracion',
          proof: 'Documentacion probatoria del origen'
        }
      }
    });
  } catch (error) {
    logger.error('[QuotaController] Error in getInfo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;
