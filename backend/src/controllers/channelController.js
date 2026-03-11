/**
 * Channel Controller
 * Controlador para operaciones relacionadas con los circuitos de control aduanero
 */

const { Expedition, Requirement } = require('../models');
const logger = require('../config/logger');
const channelService = require('../services/channelService');

/**
 * Obtener estado del canal de un expediente
 * GET /api/channels/:expeditionId/status
 */
const getChannelStatus = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration?.channel) {
      return res.status(400).json({
        success: false,
        error: 'El expediente no tiene canal asignado'
      });
    }

    const channelConfig = channelService.getChannelConfig(expedition.declaration.channel);

    // Obtener requerimientos asociados
    const requirements = await Requirement.find({ expeditionId: expedition._id })
      .sort({ createdAt: -1 });

    const status = {
      expeditionId: expedition.expeditionId,
      mrn: expedition.declaration.mrn,
      channel: expedition.declaration.channel,
      channelLabel: channelConfig?.label,
      channelDescription: channelConfig?.description,
      channelAssignedAt: expedition.declaration.channelAssignedAt,
      expeditionStatus: expedition.status,
      levante: {
        authorized: expedition.declaration.channel === 'green',
        date: expedition.declaration.levanteDate,
        number: expedition.declaration.levanteNumber
      },
      pendingCertificates: expedition.pendingCertificates || [],
      requirements: requirements.map(r => ({
        id: r._id,
        number: r.requirementNumber,
        type: r.requirementType,
        status: r.status,
        deadline: r.deadline,
        itemsCount: r.requestedItems?.length
      })),
      physicalInspection: requirements.find(r => r.requirementType === 'physical')?.physicalInspection,
      timeline: expedition.timeline?.filter(t =>
        t.action?.includes('channel') || t.action?.includes('levante')
      ).slice(-10)
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error getting channel status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado del canal'
    });
  }
};

/**
 * Reevaluar canal amarillo (despues de subir certificados)
 * POST /api/channels/:expeditionId/reevaluate
 */
const reevaluateChannel = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const result = await channelService.reevaluateYellowChannel(expeditionId, req.user);

    res.json({
      success: result.success,
      data: result
    });

  } catch (error) {
    logger.error('Error reevaluating channel:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al reevaluar canal'
    });
  }
};

/**
 * Obtener configuracion de canales
 * GET /api/channels/config
 */
const getChannelConfigs = async (req, res) => {
  try {
    const configs = channelService.getAllChannels();

    res.json({
      success: true,
      data: configs
    });

  } catch (error) {
    logger.error('Error getting channel configs:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuracion de canales'
    });
  }
};

/**
 * Obtener estadisticas de canales
 * GET /api/channels/stats
 */
const getChannelStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {
      'declaration.channel': { $exists: true, $ne: null }
    };

    if (Object.keys(dateFilter).length > 0) {
      matchStage['declaration.channelAssignedAt'] = dateFilter;
    }

    const stats = await Expedition.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$declaration.channel',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $and: ['$declaration.channelAssignedAt', '$declaration.levanteDate'] },
                { $subtract: ['$declaration.levanteDate', '$declaration.channelAssignedAt'] },
                null
              ]
            }
          }
        }
      }
    ]);

    // Formatear resultados
    const channelStats = {
      green: { count: 0, avgHours: null },
      yellow: { count: 0, avgHours: null },
      orange: { count: 0, avgHours: null },
      red: { count: 0, avgHours: null },
      total: 0
    };

    stats.forEach(s => {
      if (s._id && channelStats[s._id] !== undefined) {
        channelStats[s._id].count = s.count;
        channelStats[s._id].avgHours = s.avgProcessingTime
          ? Math.round(s.avgProcessingTime / (1000 * 60 * 60))
          : null;
        channelStats.total += s.count;
      }
    });

    // Calcular porcentajes
    if (channelStats.total > 0) {
      Object.keys(channelStats).forEach(key => {
        if (key !== 'total' && channelStats[key].count) {
          channelStats[key].percentage = Math.round(
            (channelStats[key].count / channelStats.total) * 100
          );
        }
      });
    }

    res.json({
      success: true,
      data: channelStats
    });

  } catch (error) {
    logger.error('Error getting channel stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas de canales'
    });
  }
};

/**
 * Procesar canal manualmente (para casos excepcionales)
 * POST /api/channels/:expeditionId/process
 */
const processChannelManually = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { channel } = req.body;

    if (!channel || !['green', 'yellow', 'orange', 'red'].includes(channel)) {
      return res.status(400).json({
        success: false,
        error: 'Canal no valido. Debe ser: green, yellow, orange o red'
      });
    }

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration?.mrn) {
      return res.status(400).json({
        success: false,
        error: 'El expediente debe tener MRN para procesar canal'
      });
    }

    const result = await channelService.processChannelAssignment(
      expeditionId,
      channel,
      { manual: true },
      req.user
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error processing channel manually:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar canal'
    });
  }
};

/**
 * Obtener levante de un expediente
 * GET /api/channels/:expeditionId/levante
 */
const getLevante = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration?.levanteDate) {
      return res.status(400).json({
        success: false,
        error: 'El expediente no tiene levante autorizado'
      });
    }

    const levanteData = {
      levanteNumber: expedition.declaration.levanteNumber,
      levanteDate: expedition.declaration.levanteDate,
      mrn: expedition.declaration.mrn,
      expeditionId: expedition.expeditionId,
      channel: expedition.declaration.channel,
      importer: {
        name: expedition.client?.companyName,
        nif: expedition.client?.nif,
        eori: expedition.client?.eori
      },
      customsOffice: expedition.declaration.customsOffice,
      goods: expedition.goods?.map((g, i) => ({
        item: i + 1,
        description: g.description,
        taricCode: g.taricCode,
        origin: g.originCountry,
        packages: g.packages?.quantity,
        grossWeight: g.grossWeight,
        value: g.invoiceValue
      })),
      totals: expedition.goodsSummary
    };

    res.json({
      success: true,
      data: levanteData
    });

  } catch (error) {
    logger.error('Error getting levante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener levante'
    });
  }
};

/**
 * Obtener expedientes con canal asignado
 * GET /api/channels/expeditions
 */
const getChannelExpeditions = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const query = { 'declaration.channel': { $exists: true, $ne: null } };
    if (tenantId) query.tenantId = tenantId;

    const expeditions = await Expedition.find(query)
      .select('expeditionId status client.companyName declaration.channel declaration.mrn declaration.channelAssignedAt declaration.submittedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const result = expeditions.map(exp => ({
      _id: exp._id,
      expeditionId: exp.expeditionId,
      status: exp.status,
      clientName: exp.client?.companyName || '-',
      channel: exp.declaration?.channel,
      mrn: exp.declaration?.mrn || '-',
      channelDate: exp.declaration?.channelAssignedAt || exp.declaration?.submittedAt || exp.createdAt
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error getting channel expeditions:', error);
    res.status(500).json({ success: false, error: 'Error al obtener expedientes con canal' });
  }
};

module.exports = {
  getChannelStatus,
  reevaluateChannel,
  getChannelConfigs,
  getChannelStats,
  getChannelExpeditions,
  processChannelManually,
  getLevante
};
