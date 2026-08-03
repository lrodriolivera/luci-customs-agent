/**
 * Requirement Controller
 * Gestiona los requerimientos de AEAT y organismos paraduaneros
 */

const Requirement = require('../models/Requirement');
const Expedition = require('../models/Expedition');
const aeatRealService = require('../services/aeat/aeatRealService');
const certificateService = require('../services/aeat/certificateService');
const logger = require('../config/logger');

/**
 * Obtener todos los requerimientos con filtros
 */
exports.getRequirements = async (req, res) => {
  try {
    const {
      status,
      channel,
      requirementType,
      expeditionId,
      assignedTo,
      overdue,
      urgent,
      page = 1,
      limit = 20
    } = req.query;

    // Construir filtro
    const filter = {};

    // Aislamiento por tenant: sin esto el listado devuelve los requerimientos
    // de todos los clientes. El campo se anadio al schema en 1a41c3c pero el
    // listado no lo usaba.
    if (req.user?.tenantId) filter.tenantId = req.user.tenantId;

    if (status) {
      filter.status = Array.isArray(status) ? { $in: status } : status;
    }

    if (channel) {
      filter.channel = channel;
    }

    if (requirementType) {
      filter.requirementType = requirementType;
    }

    if (expeditionId) {
      filter.expeditionId = expeditionId;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    // Filtrar vencidos
    if (overdue === 'true') {
      filter.deadline = { $lt: new Date() };
      filter.status = { $nin: ['resolved', 'closed', 'rejected'] };
    }

    // Filtrar urgentes (vencen en 3 dias o menos)
    if (urgent === 'true') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      filter.deadline = { $lte: threeDaysFromNow };
      filter.status = { $nin: ['resolved', 'closed', 'rejected'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requirements, total] = await Promise.all([
      Requirement.find(filter)
        .populate('expeditionId', 'expeditionId client.companyName operationType')
        .populate('assignedTo', 'name email')
        .sort({ deadline: 1, priority: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Requirement.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: requirements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error getting requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener requerimientos',
      error: error.message
    });
  }
};

/**
 * Obtener un requerimiento por ID
 */
exports.getRequirementById = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id)
      .populate('expeditionId')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('responses.submittedBy', 'name email');

    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    res.json({
      success: true,
      data: requirement
    });
  } catch (error) {
    logger.error('Error getting requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener requerimiento',
      error: error.message
    });
  }
};

/**
 * Crear nuevo requerimiento
 * Normalmente se crea automaticamente cuando AEAT asigna canal naranja/rojo
 */
exports.createRequirement = async (req, res) => {
  try {
    const {
      expeditionId,
      mrn,
      lrn,
      requirementType,
      channel,
      issuingAuthority,
      subject,
      description,
      legalBasis,
      deadline,
      requestedItems,
      customsOffice,
      inspector,
      priority
    } = req.body;

    // Verificar que existe el expediente y que es del tenant del usuario: sin
    // esto se podian crear requerimientos colgando del expediente de otro
    // cliente. ensureSameTenant ya responde 404 si no existe.
    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    // Calcular deadline si no se proporciona (por defecto 10 dias habiles)
    let deadlineDate = deadline ? new Date(deadline) : null;
    if (!deadlineDate) {
      deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 14); // 14 dias naturales ~ 10 habiles
    }

    // Crear requerimiento
    const requirement = new Requirement({
      expeditionId,
      // El tenant se hereda de la expedicion, que es su unico dueño posible.
      tenantId: expedition.tenantId,
      mrn: mrn || expedition.declaration?.mrn,
      lrn: lrn || expedition.declaration?.lrn,
      requirementType,
      channel,
      issuingAuthority: issuingAuthority || 'AEAT',
      subject,
      description,
      legalBasis,
      deadline: deadlineDate,
      requestedItems: requestedItems || [],
      customsOffice,
      inspector,
      priority: priority || 'high',
      assignedTo: expedition.assignedTo,
      createdBy: req.user._id
    });

    // Agregar evento de timeline
    requirement.timeline.push({
      action: 'requirement_created',
      description: `Requerimiento creado - Canal ${channel.toUpperCase()}`,
      performedBy: req.user._id,
      metadata: { channel, requirementType }
    });

    await requirement.save();

    // Actualizar estado del expediente
    const expeditionStatus = channel === 'red' ? 'red_channel' : 'orange_channel';
    await expedition.updateStatus(expeditionStatus, req.user._id);

    // Agregar timeline al expediente
    await expedition.addTimelineEvent(
      'requirement_received',
      `Requerimiento ${requirement.requirementNumber} recibido - ${subject}`,
      req.user._id,
      { requirementId: requirement._id, channel }
    );

    logger.info(`Requirement ${requirement.requirementNumber} created for expedition ${expedition.expeditionId}`);

    res.status(201).json({
      success: true,
      message: 'Requerimiento creado correctamente',
      data: requirement
    });
  } catch (error) {
    logger.error('Error creating requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear requerimiento',
      error: error.message
    });
  }
};

/**
 * Actualizar requerimiento
 */
exports.updateRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Campos que no se pueden actualizar directamente
    const protectedFields = ['requirementNumber', 'expeditionId', 'mrn', 'createdBy', 'createdAt'];
    protectedFields.forEach(field => delete updates[field]);

    const requirement = await Requirement.findById(id);
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    // Actualizar campos
    Object.assign(requirement, updates);

    // Agregar timeline si cambio el estado
    if (updates.status && updates.status !== requirement.status) {
      requirement.timeline.push({
        action: 'status_changed',
        description: `Estado cambiado a ${updates.status}`,
        performedBy: req.user._id,
        metadata: { oldStatus: requirement.status, newStatus: updates.status }
      });
    }

    await requirement.save();

    res.json({
      success: true,
      message: 'Requerimiento actualizado',
      data: requirement
    });
  } catch (error) {
    logger.error('Error updating requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar requerimiento',
      error: error.message
    });
  }
};

/**
 * Agregar respuesta a un requerimiento
 */
exports.addResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { responseType, notes, documents } = req.body;

    const requirement = await Requirement.findById(id);
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    // Verificar que el requerimiento esta en un estado que permite respuestas
    const allowedStatuses = ['pending', 'in_progress', 'awaiting_client', 'response_ready'];
    if (!allowedStatuses.includes(requirement.status)) {
      return res.status(400).json({
        success: false,
        message: `No se puede agregar respuesta en estado ${requirement.status}`
      });
    }

    await requirement.addResponse({
      responseType,
      notes,
      documents: documents || []
    }, req.user._id);

    // Recargar con populate
    await requirement.populate('expeditionId', 'expeditionId client.companyName');
    await requirement.populate('responses.submittedBy', 'name email');

    logger.info(`Response added to requirement ${requirement.requirementNumber}`);

    res.json({
      success: true,
      message: 'Respuesta agregada correctamente',
      data: requirement
    });
  } catch (error) {
    logger.error('Error adding response:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar respuesta',
      error: error.message
    });
  }
};

/**
 * Marcar item solicitado como proporcionado
 */
exports.markItemProvided = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { documentId } = req.body;

    const requirement = await Requirement.findById(id);
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    await requirement.markItemProvided(itemId, documentId);

    // Agregar timeline
    await requirement.addTimelineEvent(
      'item_provided',
      'Item solicitado marcado como proporcionado',
      req.user._id,
      { itemId, documentId }
    );

    res.json({
      success: true,
      message: 'Item marcado como proporcionado',
      data: requirement
    });
  } catch (error) {
    logger.error('Error marking item provided:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar item',
      error: error.message
    });
  }
};

/**
 * Enviar respuesta a AEAT
 */
exports.submitToAEAT = async (req, res) => {
  try {
    const { id } = req.params;
    const { responseIndex } = req.body;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    // Verificar que existe la respuesta
    if (!requirement.responses[responseIndex]) {
      return res.status(400).json({
        success: false,
        message: 'Respuesta no encontrada'
      });
    }

    const response = requirement.responses[responseIndex];

    // Enviar documentacion a AEAT real
    const certResult = await certificateService.listCertificates();
    const certs = certResult.certificates || [];
    const certAlias = certs.length > 0 ? (certs[0].metadata?.alias || certs[0].id) : null;

    const docs = (response.attachments || []).map(att => ({
      name: att.fileName || att.name,
      content: att.content || att.base64,
      mimeType: att.mimeType || 'application/pdf'
    }));

    const aeatResult = await aeatRealService.submitDigitalDocuments(
      requirement.mrn,
      docs,
      certAlias
    );

    response.aeatSubmission = {
      submitted: true,
      submittedAt: new Date(),
      confirmationNumber: aeatResult.csv || `CONF-${Date.now()}`,
      responseCode: aeatResult.code
    };
    response.result = {
      status: 'pending',
      notes: 'Respuesta enviada a AEAT, pendiente de evaluacion'
    };

    requirement.status = 'submitted';

    await requirement.addTimelineEvent(
      'response_submitted',
      `Respuesta #${responseIndex + 1} enviada a AEAT`,
      req.user._id,
      { confirmationNumber: response.aeatSubmission.confirmationNumber }
    );

    await requirement.save();

    logger.info(`Response submitted to AEAT for requirement ${requirement.requirementNumber}`);

    res.json({
      success: true,
      message: 'Respuesta enviada a AEAT',
      data: requirement
    });
  } catch (error) {
    logger.error('Error submitting to AEAT:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar a AEAT',
      error: error.message
    });
  }
};

/**
 * Programar inspeccion fisica (canal rojo)
 */
exports.scheduleInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      scheduledDate,
      scheduledTime,
      location,
      inspectorName,
      inspectorId,
      inspectorPhone,
      inspectorEmail
    } = req.body;

    const requirement = await Requirement.findById(id);
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    if (requirement.channel !== 'red') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden programar inspecciones para canal rojo'
      });
    }

    await requirement.scheduleInspection({
      scheduledDate,
      scheduledTime,
      location,
      inspectorName,
      inspectorId,
      inspectorPhone,
      inspectorEmail
    });

    logger.info(`Inspection scheduled for requirement ${requirement.requirementNumber}`);

    res.json({
      success: true,
      message: 'Inspeccion programada correctamente',
      data: requirement
    });
  } catch (error) {
    logger.error('Error scheduling inspection:', error);
    res.status(500).json({
      success: false,
      message: 'Error al programar inspeccion',
      error: error.message
    });
  }
};

/**
 * Registrar resultado de inspeccion fisica
 */
exports.recordInspectionResult = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      result,
      findings,
      discrepancies,
      actaNumber
    } = req.body;

    const requirement = await Requirement.findById(id);
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    if (!requirement.physicalInspection?.scheduled) {
      return res.status(400).json({
        success: false,
        message: 'No hay inspeccion programada'
      });
    }

    requirement.physicalInspection.completed = true;
    requirement.physicalInspection.completedAt = new Date();
    requirement.physicalInspection.result = result;
    requirement.physicalInspection.findings = findings;
    requirement.physicalInspection.discrepancies = discrepancies || [];
    requirement.physicalInspection.actaNumber = actaNumber;

    // Actualizar estado segun resultado
    if (result === 'approved') {
      requirement.status = 'resolved';
      requirement.resolution = {
        status: 'levante',
        date: new Date(),
        notes: 'Inspeccion fisica aprobada'
      };
    } else if (result === 'rejected') {
      requirement.status = 'rejected';
    }

    await requirement.addTimelineEvent(
      'inspection_completed',
      `Inspeccion fisica completada - Resultado: ${result}`,
      req.user._id,
      { result, actaNumber }
    );

    await requirement.save();

    // Actualizar expediente si fue aprobado
    if (result === 'approved') {
      const expedition = await Expedition.findById(requirement.expeditionId);
      if (expedition) {
        await expedition.updateStatus('levante', req.user._id);
      }
    }

    logger.info(`Inspection result recorded for requirement ${requirement.requirementNumber}: ${result}`);

    res.json({
      success: true,
      message: 'Resultado de inspeccion registrado',
      data: requirement
    });
  } catch (error) {
    logger.error('Error recording inspection result:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar resultado',
      error: error.message
    });
  }
};

/**
 * Resolver requerimiento
 */
exports.resolveRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      notes,
      dutyAdjustment,
      penaltyAmount
    } = req.body;

    const requirement = await Requirement.findById(id);
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    await requirement.resolve({
      status,
      notes,
      dutyAdjustment,
      penaltyAmount,
      confirmedBy: req.user.name
    }, req.user._id);

    // Actualizar expediente
    const expedition = await Expedition.findById(requirement.expeditionId);
    if (expedition) {
      if (status === 'levante') {
        await expedition.updateStatus('levante', req.user._id);
        expedition.declaration.levanteDate = new Date();
        await expedition.save();
      } else if (status === 'rejected') {
        await expedition.updateStatus('on_hold', req.user._id);
      }

      await expedition.addTimelineEvent(
        'requirement_resolved',
        `Requerimiento ${requirement.requirementNumber} resuelto: ${status}`,
        req.user._id,
        { requirementId: requirement._id, resolution: status }
      );
    }

    logger.info(`Requirement ${requirement.requirementNumber} resolved with status: ${status}`);

    res.json({
      success: true,
      message: 'Requerimiento resuelto',
      data: requirement
    });
  } catch (error) {
    logger.error('Error resolving requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error al resolver requerimiento',
      error: error.message
    });
  }
};

/**
 * Obtener estadisticas de requerimientos
 */
exports.getStats = async (req, res) => {
  try {
    const { userId } = req.query;

    const stats = await Requirement.getStats(userId);

    // Agregar requerimientos urgentes (vencen en 3 dias)
    const urgent = await Requirement.findUrgent();

    // Agregar requerimientos vencidos
    const overdue = await Requirement.findOverdue();

    // Calcular total
    const total = await Requirement.countDocuments(userId ? { assignedTo: userId } : {});

    // Formatear stats para el frontend
    const byStatus = stats.byStatus || {};
    const pending = (byStatus.pending || 0) + (byStatus.awaiting_client || 0);
    const inProgress = (byStatus.in_progress || 0) + (byStatus.response_ready || 0) + (byStatus.submitted || 0) + (byStatus.under_review || 0);
    const resolved = (byStatus.resolved || 0) + (byStatus.closed || 0);

    res.json({
      success: true,
      data: {
        // Stats planos para las cards del frontend
        total,
        pending,
        inProgress,
        resolved,
        // Stats detallados
        byStatus,
        byChannel: stats.byChannel || {},
        overdue: stats.overdue || 0,
        urgentCount: urgent.length,
        overdueCount: overdue.length,
        urgentRequirements: urgent.slice(0, 5), // Top 5 urgentes
        overdueRequirements: overdue.slice(0, 5)  // Top 5 vencidos
      }
    });
  } catch (error) {
    logger.error('Error getting requirement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas',
      error: error.message
    });
  }
};

/**
 * Obtener requerimientos de un expediente
 */
exports.getByExpedition = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const requirements = await Requirement.findByExpedition(expeditionId)
      .populate('assignedTo', 'name email')
      .populate('responses.submittedBy', 'name email');

    res.json({
      success: true,
      data: requirements
    });
  } catch (error) {
    logger.error('Error getting requirements by expedition:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener requerimientos',
      error: error.message
    });
  }
};

/**
 * Generar respuesta con IA (versión básica - mantenida por compatibilidad)
 * Usa Claude para sugerir respuesta basada en el tipo de requerimiento
 */
exports.generateAIResponse = async (req, res) => {
  try {
    const { id } = req.params;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    // Obtener servicio de IA
    const aiService = require('../services/aiService');

    // Usar el nuevo método mejorado
    const aiResponse = await aiService.generateRequirementResponse(requirement, requirement.expeditionId);

    res.json({
      success: true,
      data: {
        suggestedResponse: aiResponse.formalResponse?.body || aiResponse.rawResponse,
        formalResponse: aiResponse.formalResponse,
        suggestedDocuments: aiResponse.documentsToAttach || [],
        keyPoints: aiResponse.keyPoints || [],
        risks: aiResponse.risks || [],
        legalArguments: aiResponse.legalArguments || [],
        recommendedActions: aiResponse.recommendedActions || [],
        estimatedOutcome: aiResponse.estimatedOutcome,
        confidence: aiResponse.estimatedOutcome?.favorable / 100 || 0.8,
        model: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        summary: aiResponse.summary
      }
    });
  } catch (error) {
    logger.error('Error generating AI response:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar respuesta con IA',
      error: error.message
    });
  }
};

// ===========================================
// AI ENDPOINTS AVANZADOS - LUCI Integration
// ===========================================

const aiService = require('../services/aiService');
const { ensureSameTenant } = require('../utils/tenantGuard');

/**
 * Analizar documentación solicitada con IA
 * POST /api/requirements/:id/ai/analyze-documents
 */
exports.aiAnalyzeDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    logger.info(`AI: Analizando documentos solicitados para ${requirement.requirementNumber}`);

    const analysis = await aiService.analyzeRequestedDocuments(requirement, requirement.expeditionId);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Error en AI analyze documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error al analizar documentos',
      error: error.message
    });
  }
};

/**
 * Sugerir argumentación legal con IA
 * POST /api/requirements/:id/ai/suggest-arguments
 */
exports.aiSuggestArguments = async (req, res) => {
  try {
    const { id } = req.params;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    logger.info(`AI: Sugiriendo argumentación legal para ${requirement.requirementNumber}`);

    const arguments_ = await aiService.suggestLegalArguments(requirement, requirement.expeditionId);

    res.json({
      success: true,
      data: arguments_
    });

  } catch (error) {
    logger.error('Error en AI suggest arguments:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sugerir argumentación',
      error: error.message
    });
  }
};

/**
 * Analizar riesgo del requerimiento con IA
 * POST /api/requirements/:id/ai/analyze-risk
 */
exports.aiAnalyzeRisk = async (req, res) => {
  try {
    const { id } = req.params;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    logger.info(`AI: Analizando riesgo para ${requirement.requirementNumber}`);

    const riskAnalysis = await aiService.analyzeRequirementRisk(requirement, requirement.expeditionId);

    res.json({
      success: true,
      data: riskAnalysis
    });

  } catch (error) {
    logger.error('Error en AI analyze risk:', error);
    res.status(500).json({
      success: false,
      message: 'Error al analizar riesgo',
      error: error.message
    });
  }
};

/**
 * Análisis completo del requerimiento con IA
 * POST /api/requirements/:id/ai/full-analysis
 */
exports.aiFullAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    logger.info(`AI: Análisis completo para ${requirement.requirementNumber}`);

    const analysis = await aiService.fullRequirementAnalysis(requirement, requirement.expeditionId);

    // Registrar en timeline
    requirement.timeline.push({
      action: 'ai_analysis',
      description: `Análisis IA completado - Preparación: ${analysis.overallReadiness?.score}%`,
      performedBy: req.user?._id,
      metadata: {
        readinessScore: analysis.overallReadiness?.score,
        riskLevel: analysis.risk?.riskLevel,
        estimatedOutcome: analysis.overallReadiness?.estimatedOutcome
      }
    });
    await requirement.save();

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Error en AI full analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error al realizar análisis completo',
      error: error.message
    });
  }
};

/**
 * Generar borrador de respuesta formal con IA
 * POST /api/requirements/:id/ai/draft-response
 */
exports.aiDraftResponse = async (req, res) => {
  try {
    const { id } = req.params;

    const requirement = await Requirement.findById(id).populate('expeditionId');
    if (!ensureSameTenant(requirement, req, res, { resource: 'Requerimiento' })) return;

    logger.info(`AI: Generando borrador de respuesta para ${requirement.requirementNumber}`);

    const response = await aiService.generateRequirementResponse(requirement, requirement.expeditionId);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('Error en AI draft response:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar borrador de respuesta',
      error: error.message
    });
  }
};
