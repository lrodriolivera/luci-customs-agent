/**
 * Action Handlers
 * Implementacion de las acciones disponibles en workflows
 * Fase 6.6 - LUCI Customs Agent
 */

const logger = require('../../config/logger');
const emailService = require('../emailService');
const { Expedition, Deadline, Requirement } = require('../../models');
const axios = require('axios');

// ==================== Action Handlers ====================

const actionHandlers = {
  /**
   * Enviar email
   */
  send_email: async (config, context, execution) => {
    const { emailTo, emailSubject, emailBody, emailTemplate } = config;

    const recipients = Array.isArray(emailTo) ? emailTo : [emailTo];

    execution.addActionLog(execution.actionResults[execution.actionResults.length - 1].actionId,
      'info', `Enviando email a ${recipients.length} destinatarios`);

    // Usar emailService existente
    const result = await emailService.sendEmail({
      to: recipients,
      subject: emailSubject,
      body: emailBody,
      template: emailTemplate
    });

    return { sent: true, recipients, messageId: result?.messageId };
  },

  /**
   * Enviar notificacion del sistema
   */
  send_notification: async (config, context, execution) => {
    const { notificationTitle, notificationBody, notificationPriority } = config;

    // Aqui se integraria con el sistema de notificaciones push
    logger.info(`WorkflowAction: Notification - ${notificationTitle}`);

    return {
      sent: true,
      title: notificationTitle,
      priority: notificationPriority
    };
  },

  /**
   * Enviar mensaje al portal del cliente
   */
  send_portal_message: async (config, context, execution) => {
    const { ChatMessage } = require('../../models');

    if (!context.entityId) {
      throw new Error('No entity ID available for portal message');
    }

    const message = new ChatMessage({
      expedition: context.entityId,
      sender: 'system',
      senderInfo: {
        name: 'LUCI (Automatico)',
        email: 'luci@stocklogistic.com'
      },
      content: config.messageContent || config.notificationBody,
      messageType: 'system_notification'
    });

    await message.save();

    return { messageId: message._id, sent: true };
  },

  /**
   * Actualizar estado de una entidad
   */
  update_status: async (config, context, execution) => {
    const { newStatus } = config;

    if (!context.entityType || !context.entityId) {
      throw new Error('No entity context available for status update');
    }

    let Model;
    switch (context.entityType) {
      case 'expedition':
        Model = Expedition;
        break;
      case 'requirement':
        Model = Requirement;
        break;
      default:
        throw new Error(`Unknown entity type: ${context.entityType}`);
    }

    const entity = await Model.findById(context.entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${context.entityType} ${context.entityId}`);
    }

    const previousStatus = entity.status;
    entity.status = newStatus;

    // Agregar al timeline si existe
    if (entity.timeline) {
      entity.timeline.push({
        action: 'status_change',
        description: `Estado cambiado de ${previousStatus} a ${newStatus} por workflow`,
        performedBy: 'workflow'
      });
    }

    await entity.save();

    return { previousStatus, newStatus, entityId: context.entityId };
  },

  /**
   * Actualizar un campo especifico
   */
  update_field: async (config, context, execution) => {
    const { fieldPath, fieldValue } = config;

    if (!context.entityType || !context.entityId) {
      throw new Error('No entity context available for field update');
    }

    // Mapeo de tipos de entidad a modelos
    const modelMap = {
      expedition: Expedition,
      requirement: Requirement
    };

    const Model = modelMap[context.entityType];
    if (!Model) {
      throw new Error(`Unknown entity type: ${context.entityType}`);
    }

    const updateQuery = {};
    updateQuery[fieldPath] = fieldValue;

    await Model.findByIdAndUpdate(context.entityId, { $set: updateQuery });

    return { fieldPath, fieldValue, updated: true };
  },

  /**
   * Agregar tag a una entidad
   */
  add_tag: async (config, context, execution) => {
    const { tag } = config;

    if (!context.entityId) {
      throw new Error('No entity ID available');
    }

    await Expedition.findByIdAndUpdate(context.entityId, {
      $addToSet: { tags: tag }
    });

    return { tag, added: true };
  },

  /**
   * Remover tag de una entidad
   */
  remove_tag: async (config, context, execution) => {
    const { tag } = config;

    if (!context.entityId) {
      throw new Error('No entity ID available');
    }

    await Expedition.findByIdAndUpdate(context.entityId, {
      $pull: { tags: tag }
    });

    return { tag, removed: true };
  },

  /**
   * Agregar nota a una entidad
   */
  add_note: async (config, context, execution) => {
    const { noteContent, noteVisibility } = config;

    if (!context.entityId) {
      throw new Error('No entity ID available');
    }

    const expedition = await Expedition.findById(context.entityId);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    expedition.timeline.push({
      action: 'note_added',
      description: noteContent,
      performedBy: 'workflow',
      metadata: { visibility: noteVisibility || 'internal' }
    });

    await expedition.save();

    return { noteAdded: true, visibility: noteVisibility };
  },

  /**
   * Crear deadline
   */
  create_deadline: async (config, context, execution) => {
    const { deadlineType, deadlineDays, deadlineTitle } = config;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (deadlineDays || 7));

    const deadline = new Deadline({
      deadlineType: deadlineType || 'other',
      category: 'workflow',
      title: deadlineTitle || 'Deadline creado por workflow',
      dueDate,
      references: {
        expeditionId: context.entityId
      },
      organizationId: context.workflow?.organizationId,
      status: 'pending',
      source: 'automatic'
    });

    await deadline.save();

    return { deadlineId: deadline._id, dueDate };
  },

  /**
   * Llamar webhook externo
   */
  call_webhook: async (config, context, execution) => {
    const {
      webhookUrl,
      webhookMethod = 'POST',
      webhookHeaders = {},
      webhookBody,
      webhookTimeout = 30000
    } = config;

    if (!webhookUrl) {
      throw new Error('Webhook URL is required');
    }

    execution.addActionLog(execution.actionResults[execution.actionResults.length - 1].actionId,
      'info', `Calling webhook: ${webhookMethod} ${webhookUrl}`);

    const response = await axios({
      method: webhookMethod,
      url: webhookUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Workflow-Execution': execution.executionId,
        ...webhookHeaders
      },
      data: webhookBody || {
        event: context.trigger?.event,
        entityType: context.entityType,
        entityId: context.entityId,
        entity: context.entity,
        timestamp: new Date().toISOString()
      },
      timeout: webhookTimeout
    });

    return {
      statusCode: response.status,
      responseData: response.data
    };
  },

  /**
   * Llamar API interna o externa
   */
  call_api: async (config, context, execution) => {
    const { apiUrl, apiMethod = 'GET', apiHeaders = {}, apiBody, apiTimeout = 30000 } = config;

    const response = await axios({
      method: apiMethod,
      url: apiUrl,
      headers: apiHeaders,
      data: apiBody,
      timeout: apiTimeout
    });

    return {
      statusCode: response.status,
      data: response.data
    };
  },

  /**
   * Esperar un tiempo determinado
   */
  wait: async (config, context, execution) => {
    const { waitSeconds } = config;

    if (waitSeconds && waitSeconds > 0) {
      execution.addActionLog(execution.actionResults[execution.actionResults.length - 1].actionId,
        'info', `Waiting ${waitSeconds} seconds`);

      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    }

    return { waited: waitSeconds };
  },

  /**
   * Ejecutar prediccion ML
   */
  run_ml_prediction: async (config, context, execution) => {
    const mlServices = require('../ml');

    const predictionType = config.predictionType || 'channel';

    let result;
    switch (predictionType) {
      case 'channel':
        result = await mlServices.predictChannel(context.entity);
        break;
      case 'fraud':
        result = await mlServices.analyzeForFraud(context.entity);
        break;
      default:
        throw new Error(`Unknown prediction type: ${predictionType}`);
    }

    return result;
  },

  /**
   * Generar recomendaciones
   */
  generate_recommendation: async (config, context, execution) => {
    const mlServices = require('../ml');

    const result = await mlServices.generateRecommendations(context.entity);

    return result;
  },

  /**
   * Trigger otro workflow
   */
  trigger_workflow: async (config, context, execution) => {
    const { Workflow } = require('../../models');
    const workflowEngine = require('./workflowEngine');

    const { targetWorkflowId } = config;

    const targetWorkflow = await Workflow.findById(targetWorkflowId);
    if (!targetWorkflow) {
      throw new Error(`Target workflow not found: ${targetWorkflowId}`);
    }

    if (!targetWorkflow.enabled) {
      return { triggered: false, reason: 'target_workflow_disabled' };
    }

    // Ejecutar el workflow hijo
    const result = await workflowEngine.executeWorkflow(
      targetWorkflow,
      {
        type: 'workflow',
        triggeredBy: {
          workflowId: context.workflow.id,
          executionId: execution.executionId
        }
      },
      {
        entityType: context.entityType,
        entityId: context.entityId,
        entityData: context.entity
      }
    );

    return {
      triggered: true,
      childExecutionId: result.executionId,
      childSuccess: result.success
    };
  }
};

// ==================== Registro de Handlers ====================

/**
 * Registrar todos los handlers en el engine
 */
function registerAllHandlers(workflowEngine) {
  for (const [actionType, handler] of Object.entries(actionHandlers)) {
    workflowEngine.registerActionHandler(actionType, handler);
  }
  logger.info(`WorkflowActionHandlers: Registered ${Object.keys(actionHandlers).length} action handlers`);
}

module.exports = {
  actionHandlers,
  registerAllHandlers
};
