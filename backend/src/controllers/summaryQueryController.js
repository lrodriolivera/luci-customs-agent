/**
 * Summary Query Controller
 * Controlador para servicios de consulta ADDS-JDIT de AEAT
 */
const summaryQueryService = require('../services/summaryQueryService');
const logger = require('../config/logger');

/**
 * Consulta por numero de conocimiento (B/L)
 * POST /api/queries/bill-of-lading
 */
exports.queryByBillOfLading = async (req, res) => {
  try {
    const { reference, dateFrom, dateTo, declarationType, includeDocuments } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Numero de conocimiento (B/L) es obligatorio'
      });
    }

    const result = await summaryQueryService.queryByBillOfLading(
      reference,
      req.user._id,
      {
        dateFrom,
        dateTo,
        declarationType,
        includeDocuments,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in queryByBillOfLading:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta por conocimiento',
      error: error.message
    });
  }
};

/**
 * Consulta por numero AWB
 * POST /api/queries/awb
 */
exports.queryByAWB = async (req, res) => {
  try {
    const { awbNumber, dateFrom, dateTo, includeDocuments } = req.body;

    if (!awbNumber) {
      return res.status(400).json({
        success: false,
        message: 'Numero AWB es obligatorio'
      });
    }

    const result = await summaryQueryService.queryByAWB(
      awbNumber,
      req.user._id,
      {
        dateFrom,
        dateTo,
        includeDocuments,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in queryByAWB:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta por AWB',
      error: error.message
    });
  }
};

/**
 * Consulta por contenedor
 * POST /api/queries/container
 */
exports.queryByContainer = async (req, res) => {
  try {
    const { containerNumber, dateFrom, dateTo, declarationType, includeDocuments } = req.body;

    if (!containerNumber) {
      return res.status(400).json({
        success: false,
        message: 'Numero de contenedor es obligatorio'
      });
    }

    const result = await summaryQueryService.queryByContainer(
      containerNumber,
      req.user._id,
      {
        dateFrom,
        dateTo,
        declarationType,
        includeDocuments,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    if (!result.success && result.error) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('Error in queryByContainer:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta por contenedor',
      error: error.message
    });
  }
};

/**
 * Consulta por ubicacion/aduana
 * POST /api/queries/location
 */
exports.queryByLocation = async (req, res) => {
  try {
    const { locationCode, dateFrom, dateTo, declarationType, status } = req.body;

    if (!locationCode) {
      return res.status(400).json({
        success: false,
        message: 'Codigo de ubicacion/aduana es obligatorio'
      });
    }

    const result = await summaryQueryService.queryByLocation(
      locationCode,
      req.user._id,
      {
        dateFrom,
        dateTo,
        declarationType,
        status,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in queryByLocation:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta por ubicacion',
      error: error.message
    });
  }
};

/**
 * Consulta documentos asociados
 * POST /api/queries/documents
 */
exports.queryDocuments = async (req, res) => {
  try {
    const { reference, mrn } = req.body;

    if (!reference && !mrn) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere referencia o MRN'
      });
    }

    const result = await summaryQueryService.queryAssociatedDocuments(
      reference || mrn,
      req.user._id,
      {
        mrn,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in queryDocuments:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta de documentos',
      error: error.message
    });
  }
};

/**
 * Consulta por MRN
 * POST /api/queries/mrn
 */
exports.queryByMRN = async (req, res) => {
  try {
    const { mrn, includeHistory, includeDocuments } = req.body;

    if (!mrn) {
      return res.status(400).json({
        success: false,
        message: 'MRN es obligatorio'
      });
    }

    const result = await summaryQueryService.queryByMRN(
      mrn,
      req.user._id,
      {
        includeHistory,
        includeDocuments,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in queryByMRN:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta por MRN',
      error: error.message
    });
  }
};

/**
 * Consulta por EORI
 * POST /api/queries/eori
 */
exports.queryByEORI = async (req, res) => {
  try {
    const { eori, dateFrom, dateTo, declarationType, status } = req.body;

    if (!eori) {
      return res.status(400).json({
        success: false,
        message: 'EORI es obligatorio'
      });
    }

    const result = await summaryQueryService.queryByEORI(
      eori,
      req.user._id,
      {
        dateFrom,
        dateTo,
        declarationType,
        status,
        sourceIP: req.ip,
        userAgent: req.get('User-Agent'),
        certificateAlias: req.body.certificateAlias
      }
    );

    if (!result.success && result.error) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('Error in queryByEORI:', error);
    res.status(500).json({
      success: false,
      message: 'Error en consulta por EORI',
      error: error.message
    });
  }
};

/**
 * Obtener historial de consultas
 * GET /api/queries/history
 */
exports.getHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      queryType,
      queryStatus,
      startDate,
      endDate
    } = req.query;

    const result = await summaryQueryService.getQueryHistory(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      queryType,
      queryStatus,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: result.queries,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Error getting query history:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de consultas',
      error: error.message
    });
  }
};

/**
 * Obtener una consulta especifica
 * GET /api/queries/:id
 */
exports.getQuery = async (req, res) => {
  try {
    const result = await summaryQueryService.getQueryById(
      req.params.id,
      req.user._id
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    logger.error('Error getting query:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consulta',
      error: error.message
    });
  }
};

/**
 * Obtener estadisticas de consultas
 * GET /api/queries/stats
 */
exports.getStats = async (req, res) => {
  try {
    const { startDate } = req.query;

    const stats = await summaryQueryService.getQueryStats(req.user._id, {
      startDate
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting query stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas de consultas',
      error: error.message
    });
  }
};

/**
 * Obtener servicios disponibles
 * GET /api/queries/services
 */
exports.getServices = async (req, res) => {
  try {
    const services = summaryQueryService.getAvailableServices();

    res.json({
      success: true,
      data: services
    });

  } catch (error) {
    logger.error('Error getting query services:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicios de consulta',
      error: error.message
    });
  }
};
