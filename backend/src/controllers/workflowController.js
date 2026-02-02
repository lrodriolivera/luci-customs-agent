/**
 * Workflow Controller
 * API endpoints para gestion de workflows
 * Fase 6.6 - LUCI Customs Agent
 */

const logger = require('../config/logger');
const workflowService = require('../services/workflow');

// ==================== CRUD Endpoints ====================

/**
 * Crear workflow
 * POST /api/workflows
 */
const createWorkflow = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    const workflowData = {
      ...req.body,
      organizationId
    };

    const workflow = await workflowService.createWorkflow(workflowData, userId);

    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    logger.error('WorkflowController: Error creating workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear workflow'
    });
  }
};

/**
 * Listar workflows
 * GET /api/workflows
 */
const listWorkflows = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const {
      status,
      category,
      enabled,
      search,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;

    const result = await workflowService.listWorkflows(organizationId, {
      status,
      category,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      search,
      page: parseInt(page),
      limit: parseInt(limit),
      sort
    });

    res.json({
      success: true,
      data: result.workflows,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('WorkflowController: Error listing workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar workflows'
    });
  }
};

/**
 * Obtener workflow por ID
 * GET /api/workflows/:id
 */
const getWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const workflow = await workflowService.getWorkflow(id, organizationId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow no encontrado'
      });
    }

    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener workflow'
    });
  }
};

/**
 * Actualizar workflow
 * PUT /api/workflows/:id
 */
const updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    const workflow = await workflowService.updateWorkflow(
      id,
      req.body,
      userId,
      organizationId
    );

    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    logger.error('WorkflowController: Error updating workflow:', error);
    res.status(error.message === 'Workflow not found' ? 404 : 500).json({
      success: false,
      error: error.message === 'Workflow not found' ? 'Workflow no encontrado' : 'Error al actualizar workflow'
    });
  }
};

/**
 * Eliminar workflow
 * DELETE /api/workflows/:id
 */
const deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    await workflowService.deleteWorkflow(id, organizationId);

    res.json({
      success: true,
      message: 'Workflow eliminado correctamente'
    });
  } catch (error) {
    logger.error('WorkflowController: Error deleting workflow:', error);
    res.status(error.message === 'Workflow not found' ? 404 : 500).json({
      success: false,
      error: error.message === 'Workflow not found' ? 'Workflow no encontrado' : 'Error al eliminar workflow'
    });
  }
};

// ==================== Status Endpoints ====================

/**
 * Activar/Desactivar workflow
 * PATCH /api/workflows/:id/toggle
 */
const toggleWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'El campo enabled es requerido'
      });
    }

    const workflow = await workflowService.toggleWorkflow(
      id,
      enabled,
      userId,
      organizationId
    );

    res.json({
      success: true,
      data: workflow,
      message: `Workflow ${enabled ? 'activado' : 'desactivado'} correctamente`
    });
  } catch (error) {
    logger.error('WorkflowController: Error toggling workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado del workflow'
    });
  }
};

/**
 * Publicar workflow
 * POST /api/workflows/:id/publish
 */
const publishWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { changeDescription } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    const workflow = await workflowService.publishWorkflow(
      id,
      userId,
      organizationId,
      changeDescription
    );

    res.json({
      success: true,
      data: workflow,
      message: `Workflow publicado (v${workflow.version})`
    });
  } catch (error) {
    logger.error('WorkflowController: Error publishing workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Error al publicar workflow'
    });
  }
};

/**
 * Clonar workflow
 * POST /api/workflows/:id/clone
 */
const cloneWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    const workflow = await workflowService.cloneWorkflow(
      id,
      name,
      userId,
      organizationId
    );

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Workflow clonado correctamente'
    });
  } catch (error) {
    logger.error('WorkflowController: Error cloning workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Error al clonar workflow'
    });
  }
};

// ==================== Execution Endpoints ====================

/**
 * Ejecutar workflow manualmente
 * POST /api/workflows/:id/execute
 */
const executeWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { entityType, entityId } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    const result = await workflowService.executeWorkflowManually(
      id,
      userId,
      entityType,
      entityId,
      organizationId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('WorkflowController: Error executing workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al ejecutar workflow'
    });
  }
};

/**
 * Obtener historial de ejecuciones
 * GET /api/workflows/:id/executions
 */
const getExecutionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = 50, skip = 0 } = req.query;
    const organizationId = req.user.organizationId;

    const executions = await workflowService.getExecutionHistory(
      id,
      organizationId,
      {
        status,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    );

    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting execution history:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de ejecuciones'
    });
  }
};

/**
 * Obtener detalle de una ejecucion
 * GET /api/workflows/executions/:executionId
 */
const getExecution = async (req, res) => {
  try {
    const { executionId } = req.params;
    const organizationId = req.user.organizationId;

    const execution = await workflowService.getExecution(executionId, organizationId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Ejecucion no encontrada'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting execution:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener ejecucion'
    });
  }
};

/**
 * Cancelar ejecucion en progreso
 * POST /api/workflows/executions/:executionId/cancel
 */
const cancelExecution = async (req, res) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;
    const organizationId = req.user.organizationId;

    await workflowService.cancelExecution(executionId, reason, organizationId);

    res.json({
      success: true,
      message: 'Ejecucion cancelada correctamente'
    });
  } catch (error) {
    logger.error('WorkflowController: Error cancelling execution:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al cancelar ejecucion'
    });
  }
};

// ==================== Statistics Endpoints ====================

/**
 * Obtener estadisticas de workflows
 * GET /api/workflows/stats
 */
const getStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const stats = await workflowService.getStats(organizationId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas'
    });
  }
};

/**
 * Obtener workflows mas activos
 * GET /api/workflows/top
 */
const getTopWorkflows = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { limit = 10 } = req.query;

    const workflows = await workflowService.getTopWorkflows(
      organizationId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: workflows
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting top workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener workflows populares'
    });
  }
};

// ==================== Templates Endpoints ====================

/**
 * Obtener plantillas de workflows predefinidas
 * GET /api/workflows/templates
 */
const getTemplates = async (req, res) => {
  try {
    // Plantillas predefinidas de workflows comunes
    const templates = [
      {
        id: 'notify_channel_red',
        name: 'Notificar Canal Rojo',
        description: 'Enviar notificacion urgente cuando se asigna canal rojo',
        category: 'notification',
        trigger: {
          type: 'event',
          event: 'channel.red'
        },
        actions: [
          {
            order: 1,
            type: 'send_email',
            name: 'Email urgente',
            config: {
              emailSubject: 'URGENTE: Canal Rojo asignado - {{entity.expeditionId}}',
              emailBody: 'Se ha asignado canal rojo al expediente {{entity.expeditionId}}. Se requiere inspeccion fisica.'
            }
          },
          {
            order: 2,
            type: 'send_notification',
            name: 'Notificacion push',
            config: {
              notificationTitle: 'Canal Rojo',
              notificationBody: 'Expediente {{entity.expeditionId}} requiere inspeccion',
              notificationPriority: 'urgent'
            }
          }
        ]
      },
      {
        id: 'auto_respond_documentary',
        name: 'Auto-respuesta Documental',
        description: 'Generar respuesta automatica para requerimientos documentales',
        category: 'requirement',
        trigger: {
          type: 'event',
          event: 'requirement.created'
        },
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'entity.requirementType', operator: 'equals', value: 'documentary' }
          ]
        },
        actions: [
          {
            order: 1,
            type: 'run_ml_prediction',
            name: 'Generar respuesta',
            config: { predictionType: 'auto_response' }
          },
          {
            order: 2,
            type: 'add_note',
            name: 'Agregar nota',
            config: {
              noteContent: 'Respuesta automatica generada por LUCI',
              noteVisibility: 'internal'
            }
          }
        ]
      },
      {
        id: 'deadline_reminder',
        name: 'Recordatorio de Vencimiento',
        description: 'Enviar recordatorio cuando se acerca un vencimiento',
        category: 'compliance',
        trigger: {
          type: 'event',
          event: 'requirement.deadline_approaching'
        },
        actions: [
          {
            order: 1,
            type: 'send_email',
            name: 'Recordatorio',
            config: {
              emailSubject: 'Recordatorio: Vencimiento proximo - {{entity.title}}',
              emailBody: 'El plazo para {{entity.title}} vence en {{entity.daysRemaining}} dias.'
            }
          }
        ]
      },
      {
        id: 'fraud_alert',
        name: 'Alerta de Fraude',
        description: 'Notificar cuando se detecta posible fraude',
        category: 'compliance',
        trigger: {
          type: 'event',
          event: 'ml.fraud_detected'
        },
        actions: [
          {
            order: 1,
            type: 'send_notification',
            name: 'Alerta fraude',
            config: {
              notificationTitle: 'Posible Fraude Detectado',
              notificationBody: 'Expediente {{entity.expeditionId}}: {{entity.fraudType}}',
              notificationPriority: 'urgent'
            }
          },
          {
            order: 2,
            type: 'add_tag',
            name: 'Marcar expediente',
            config: { tag: 'revision_fraude' }
          }
        ]
      },
      {
        id: 'webhook_erp',
        name: 'Notificar ERP Externo',
        description: 'Enviar datos a sistema ERP cuando se completa expediente',
        category: 'integration',
        trigger: {
          type: 'event',
          event: 'expedition.completed'
        },
        actions: [
          {
            order: 1,
            type: 'call_webhook',
            name: 'Llamar ERP',
            config: {
              webhookUrl: 'https://erp.example.com/api/customs/complete',
              webhookMethod: 'POST',
              webhookHeaders: {
                'Authorization': 'Bearer {{variables.erp_token}}'
              }
            }
          }
        ]
      }
    ];

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener plantillas'
    });
  }
};

/**
 * Obtener lista de eventos disponibles
 * GET /api/workflows/events
 */
const getAvailableEvents = async (req, res) => {
  try {
    const events = [
      { category: 'Expedientes', events: [
        { name: 'expedition.created', description: 'Expediente creado' },
        { name: 'expedition.updated', description: 'Expediente actualizado' },
        { name: 'expedition.status_changed', description: 'Estado de expediente cambiado' },
        { name: 'expedition.completed', description: 'Expediente completado' },
        { name: 'expedition.cancelled', description: 'Expediente cancelado' }
      ]},
      { category: 'Documentos', events: [
        { name: 'document.uploaded', description: 'Documento subido' },
        { name: 'document.validated', description: 'Documento validado' },
        { name: 'document.rejected', description: 'Documento rechazado' },
        { name: 'document.expired', description: 'Documento expirado' }
      ]},
      { category: 'Declaraciones', events: [
        { name: 'declaration.created', description: 'Declaracion creada' },
        { name: 'declaration.submitted', description: 'Declaracion enviada' },
        { name: 'declaration.accepted', description: 'Declaracion aceptada' },
        { name: 'declaration.rejected', description: 'Declaracion rechazada' },
        { name: 'declaration.channel_assigned', description: 'Canal asignado' }
      ]},
      { category: 'Canales', events: [
        { name: 'channel.green', description: 'Canal verde asignado' },
        { name: 'channel.yellow', description: 'Canal amarillo asignado' },
        { name: 'channel.orange', description: 'Canal naranja asignado' },
        { name: 'channel.red', description: 'Canal rojo asignado' }
      ]},
      { category: 'Requerimientos', events: [
        { name: 'requirement.created', description: 'Requerimiento creado' },
        { name: 'requirement.responded', description: 'Requerimiento respondido' },
        { name: 'requirement.resolved', description: 'Requerimiento resuelto' },
        { name: 'requirement.deadline_approaching', description: 'Vencimiento proximo' }
      ]},
      { category: 'ML/Alertas', events: [
        { name: 'ml.fraud_detected', description: 'Fraude detectado' },
        { name: 'ml.high_risk_predicted', description: 'Alto riesgo predicho' },
        { name: 'ml.recommendation_generated', description: 'Recomendacion generada' }
      ]}
    ];

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting events:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener eventos'
    });
  }
};

/**
 * Obtener lista de acciones disponibles
 * GET /api/workflows/actions
 */
const getAvailableActions = async (req, res) => {
  try {
    const actions = [
      { category: 'Notificaciones', actions: [
        { type: 'send_email', name: 'Enviar email', description: 'Envia un email a destinatarios' },
        { type: 'send_sms', name: 'Enviar SMS', description: 'Envia un SMS' },
        { type: 'send_notification', name: 'Notificacion push', description: 'Envia notificacion al sistema' },
        { type: 'send_portal_message', name: 'Mensaje portal', description: 'Envia mensaje al portal del cliente' }
      ]},
      { category: 'Actualizaciones', actions: [
        { type: 'update_status', name: 'Cambiar estado', description: 'Actualiza el estado de la entidad' },
        { type: 'update_field', name: 'Actualizar campo', description: 'Actualiza un campo especifico' },
        { type: 'add_tag', name: 'Agregar etiqueta', description: 'Agrega una etiqueta' },
        { type: 'remove_tag', name: 'Quitar etiqueta', description: 'Quita una etiqueta' },
        { type: 'add_note', name: 'Agregar nota', description: 'Agrega una nota al timeline' }
      ]},
      { category: 'Creacion', actions: [
        { type: 'create_task', name: 'Crear tarea', description: 'Crea una nueva tarea' },
        { type: 'create_deadline', name: 'Crear vencimiento', description: 'Crea un nuevo deadline' }
      ]},
      { category: 'Integraciones', actions: [
        { type: 'call_webhook', name: 'Llamar webhook', description: 'Llama a un webhook externo' },
        { type: 'call_api', name: 'Llamar API', description: 'Llama a una API' }
      ]},
      { category: 'ML/AI', actions: [
        { type: 'run_ml_prediction', name: 'Ejecutar prediccion', description: 'Ejecuta modelo de ML' },
        { type: 'generate_recommendation', name: 'Generar recomendacion', description: 'Genera recomendaciones' }
      ]},
      { category: 'Control', actions: [
        { type: 'wait', name: 'Esperar', description: 'Espera un tiempo determinado' },
        { type: 'trigger_workflow', name: 'Ejecutar workflow', description: 'Ejecuta otro workflow' }
      ]}
    ];

    res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    logger.error('WorkflowController: Error getting actions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener acciones'
    });
  }
};

module.exports = {
  // CRUD
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  // Status
  toggleWorkflow,
  publishWorkflow,
  cloneWorkflow,
  // Execution
  executeWorkflow,
  getExecutionHistory,
  getExecution,
  cancelExecution,
  // Stats
  getStats,
  getTopWorkflows,
  // Templates
  getTemplates,
  getAvailableEvents,
  getAvailableActions
};
