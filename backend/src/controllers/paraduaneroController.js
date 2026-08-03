/**
 * Paraduanero Controller
 * Controlador para gestion de controles paraduaneros
 */

const { ParaduaneroControl, Expedition } = require('../models');
const logger = require('../config/logger');
const paraduaneroService = require('../services/paraduaneroService');
const { ensureSameTenant } = require('../utils/tenantGuard');

/**
 * Analizar expediente para determinar controles necesarios
 * GET /api/paraduanero/analyze/:expeditionId
 */
exports.analyzeExpedition = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const requiredControls = await paraduaneroService.analyzeExpedition(expedition);

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        totalGoods: expedition.goods?.length || 0,
        controlsRequired: requiredControls.length,
        controls: requiredControls
      }
    });
  } catch (error) {
    logger.error('Error analyzing expedition:', error);
    res.status(500).json({
      success: false,
      error: 'Error al analizar expediente'
    });
  }
};

/**
 * Crear controles para un expediente
 * POST /api/paraduanero/create/:expeditionId
 */
exports.createControls = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    // Sin este guard se podian crear controles paraduaneros colgando del
    // expediente de otro cliente.
    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const createdControls = await paraduaneroService.createControlsForExpedition(
      expeditionId,
      req.user
    );

    res.json({
      success: true,
      message: `${createdControls.length} control(es) creado(s)`,
      data: createdControls
    });
  } catch (error) {
    logger.error('Error creating controls:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear controles'
    });
  }
};

/**
 * Obtener todos los controles con filtros
 * GET /api/paraduanero
 */
exports.list = async (req, res) => {
  try {
    const {
      status,
      controlType,
      priority,
      expeditionId,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (controlType) filter.controlType = controlType;
    if (priority) filter.priority = priority;
    if (expeditionId) filter.expeditionId = expeditionId;

    const controls = await ParaduaneroControl.find(filter)
      .populate('expeditionId', 'expeditionId client.companyName')
      .sort({ priority: -1, deadline: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ParaduaneroControl.countDocuments(filter);

    res.json({
      success: true,
      data: controls,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error listing controls:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar controles'
    });
  }
};

/**
 * Obtener controles de un expediente
 * GET /api/paraduanero/expedition/:expeditionId
 */
exports.getByExpedition = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const controls = await paraduaneroService.getControlsForExpedition(expeditionId);

    res.json({
      success: true,
      data: controls
    });
  } catch (error) {
    logger.error('Error getting controls by expedition:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener controles'
    });
  }
};

/**
 * Obtener detalle de un control
 * GET /api/paraduanero/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const control = await ParaduaneroControl.findById(id)
      .populate('expeditionId', 'expeditionId client goods transport')
      .populate('createdBy', 'name email');

    if (!ensureSameTenant(control, req, res, { resource: 'Control' })) return;

    res.json({
      success: true,
      data: control
    });
  } catch (error) {
    logger.error('Error getting control:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener control'
    });
  }
};

/**
 * Actualizar control
 * PUT /api/paraduanero/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const control = await ParaduaneroControl.findById(id);
    if (!ensureSameTenant(control, req, res, { resource: 'Control' })) return;

    // Campos permitidos para actualizar
    const allowedFields = ['notes', 'internalNotes', 'priority', 'authority', 'deadline'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        control[field] = updateData[field];
      }
    });

    control.addTimelineEvent(
      'note_added',
      'Control actualizado',
      req.user?._id
    );

    await control.save();

    res.json({
      success: true,
      message: 'Control actualizado',
      data: control
    });
  } catch (error) {
    logger.error('Error updating control:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar control'
    });
  }
};

/**
 * Marcar documento como proporcionado
 * POST /api/paraduanero/:id/document/:code/provide
 */
exports.provideDocument = async (req, res) => {
  try {
    const { id, code } = req.params;
    const { documentId } = req.body;

    const control = await paraduaneroService.markDocumentProvided(
      id,
      code,
      documentId,
      req.user?._id
    );

    res.json({
      success: true,
      message: 'Documento registrado',
      data: control
    });
  } catch (error) {
    logger.error('Error providing document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al registrar documento'
    });
  }
};

/**
 * Programar inspeccion
 * POST /api/paraduanero/:id/inspection/schedule
 */
exports.scheduleInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const inspectionData = req.body;

    const control = await paraduaneroService.scheduleInspection(
      id,
      inspectionData,
      req.user?._id
    );

    res.json({
      success: true,
      message: 'Inspeccion programada',
      data: control
    });
  } catch (error) {
    logger.error('Error scheduling inspection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al programar inspeccion'
    });
  }
};

/**
 * Registrar resultado de inspeccion
 * POST /api/paraduanero/:id/inspection/result
 */
exports.recordInspectionResult = async (req, res) => {
  try {
    const { id } = req.params;
    const resultData = req.body;

    const control = await paraduaneroService.recordInspectionResult(
      id,
      resultData,
      req.user?._id
    );

    res.json({
      success: true,
      message: 'Resultado registrado',
      data: control
    });
  } catch (error) {
    logger.error('Error recording inspection result:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al registrar resultado'
    });
  }
};

/**
 * Emitir certificado
 * POST /api/paraduanero/:id/certificate
 */
exports.issueCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const certificateData = req.body;

    const control = await paraduaneroService.issueCertificate(
      id,
      certificateData,
      req.user?._id
    );

    res.json({
      success: true,
      message: 'Certificado emitido',
      data: control
    });
  } catch (error) {
    logger.error('Error issuing certificate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al emitir certificado'
    });
  }
};

/**
 * Obtener estadisticas
 * GET /api/paraduanero/stats
 */
exports.getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await paraduaneroService.getStats({ startDate, endDate });

    // Formatear estadisticas
    const formattedStats = {
      byType: {},
      totals: {
        total: 0,
        pending: 0,
        inProgress: 0,
        approved: 0,
        rejected: 0
      }
    };

    stats.forEach(s => {
      formattedStats.byType[s._id] = {
        total: s.total,
        pending: s.pending,
        inProgress: s.inProgress,
        approved: s.approved,
        rejected: s.rejected
      };
      formattedStats.totals.total += s.total;
      formattedStats.totals.pending += s.pending;
      formattedStats.totals.inProgress += s.inProgress;
      formattedStats.totals.approved += s.approved;
      formattedStats.totals.rejected += s.rejected;
    });

    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas'
    });
  }
};

/**
 * Cambiar estado manualmente
 * POST /api/paraduanero/:id/status
 */
exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const control = await ParaduaneroControl.findById(id);
    if (!ensureSameTenant(control, req, res, { resource: 'Control' })) return;

    const oldStatus = control.status;
    control.status = status;

    if (status === 'approved' || status === 'rejected') {
      control.resolvedAt = new Date();
    }

    control.addTimelineEvent(
      'status_changed',
      `Estado cambiado de ${oldStatus} a ${status}${reason ? ': ' + reason : ''}`,
      req.user?._id
    );

    await control.save();

    res.json({
      success: true,
      message: 'Estado actualizado',
      data: control
    });
  } catch (error) {
    logger.error('Error changing status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado'
    });
  }
};
