/**
 * Workflow Service
 * Servicio principal para gestion de workflows
 * Fase 6.6 - LUCI Customs Agent
 *
 * Responsabilidades:
 * - CRUD de workflows
 * - Escuchar eventos y disparar workflows
 * - Programacion de workflows (cron)
 * - Procesamiento por lotes
 * - Estadisticas y monitoreo
 */

const logger = require('../../config/logger');
const { Workflow, WorkflowExecution } = require('../../models');
const workflowEngine = require('./workflowEngine');
const { registerAllHandlers } = require('./actionHandlers');
const { workflowEvents } = require('./eventEmitter');

// ==================== Workflow Service ====================

class WorkflowService {
  constructor() {
    this.initialized = false;
    this.scheduledJobs = new Map();
    this.eventSubscriptions = new Map();
  }

  /**
   * Inicializar el servicio
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('WorkflowService: Already initialized');
      return;
    }

    logger.info('WorkflowService: Initializing...');

    // Registrar handlers de acciones
    registerAllHandlers(workflowEngine);

    // Suscribirse al evento generico para debug
    workflowEvents.on('workflow:event', (event) => {
      logger.debug(`WorkflowService: Event received - ${event.name}`);
    });

    // Cargar y activar workflows programados
    await this.loadScheduledWorkflows();

    // Suscribirse a eventos para workflows basados en eventos
    await this.subscribeToEvents();

    this.initialized = true;
    logger.info('WorkflowService: Initialized successfully');
  }

  /**
   * Cargar workflows programados (cron)
   */
  async loadScheduledWorkflows() {
    try {
      const scheduledWorkflows = await Workflow.find({
        enabled: true,
        status: 'active',
        'trigger.type': 'schedule'
      });

      for (const workflow of scheduledWorkflows) {
        this.scheduleWorkflow(workflow);
      }

      logger.info(`WorkflowService: Loaded ${scheduledWorkflows.length} scheduled workflows`);
    } catch (error) {
      logger.error('WorkflowService: Error loading scheduled workflows:', error);
    }
  }

  /**
   * Programar un workflow con cron
   */
  scheduleWorkflow(workflow) {
    // En produccion usar node-cron o agenda
    // Por ahora, implementacion basica con setInterval para demo

    const cronExpression = workflow.trigger.schedule?.cron;
    if (!cronExpression) return;

    // Simplificacion: ejecutar cada hora si hay cron definido
    // En produccion: usar libreria de cron real
    const intervalId = setInterval(async () => {
      if (this.shouldRunScheduledWorkflow(workflow)) {
        await this.executeWorkflow(workflow._id, {
          type: 'schedule',
          scheduledTime: new Date()
        });
      }
    }, 60 * 60 * 1000); // Cada hora

    this.scheduledJobs.set(workflow._id.toString(), intervalId);
    logger.info(`WorkflowService: Scheduled workflow ${workflow.name}`);
  }

  /**
   * Verificar si un workflow programado debe ejecutarse
   */
  shouldRunScheduledWorkflow(workflow) {
    const schedule = workflow.trigger.schedule;
    if (!schedule) return false;

    const now = new Date();

    // Verificar fecha de inicio/fin
    if (schedule.startDate && now < new Date(schedule.startDate)) return false;
    if (schedule.endDate && now > new Date(schedule.endDate)) return false;

    // Verificar horario laboral si aplica
    if (workflow.trigger.config?.onlyBusinessHours) {
      const hour = now.getHours();
      const start = workflow.trigger.config.businessHoursStart || 9;
      const end = workflow.trigger.config.businessHoursEnd || 18;
      if (hour < start || hour >= end) return false;

      // Verificar dia laboral (L-V)
      const day = now.getDay();
      if (day === 0 || day === 6) return false;
    }

    return true;
  }

  /**
   * Cancelar programacion de un workflow
   */
  unscheduleWorkflow(workflowId) {
    const intervalId = this.scheduledJobs.get(workflowId.toString());
    if (intervalId) {
      clearInterval(intervalId);
      this.scheduledJobs.delete(workflowId.toString());
      logger.info(`WorkflowService: Unscheduled workflow ${workflowId}`);
    }
  }

  /**
   * Suscribirse a eventos del sistema
   */
  async subscribeToEvents() {
    // Lista de todos los eventos posibles
    const eventTypes = [
      'expedition.created', 'expedition.updated', 'expedition.status_changed',
      'expedition.completed', 'expedition.cancelled',
      'document.uploaded', 'document.validated', 'document.rejected',
      'declaration.created', 'declaration.submitted', 'declaration.accepted',
      'declaration.rejected', 'declaration.channel_assigned',
      'requirement.created', 'requirement.responded', 'requirement.resolved',
      'requirement.deadline_approaching',
      'channel.green', 'channel.yellow', 'channel.orange', 'channel.red',
      'guarantee.created', 'guarantee.consumed', 'guarantee.low_balance', 'guarantee.expired',
      'transit.initiated', 'transit.arrived', 'transit.completed', 'transit.incident',
      'inspection.scheduled', 'inspection.completed', 'inspection.passed', 'inspection.failed',
      'paraduanero.required', 'paraduanero.approved', 'paraduanero.rejected',
      'communication.received', 'communication.sent',
      'payment.required', 'payment.completed',
      'ml.fraud_detected', 'ml.high_risk_predicted', 'ml.recommendation_generated'
    ];

    // Suscribirse a cada tipo de evento
    for (const eventType of eventTypes) {
      workflowEvents.on(eventType, async (event) => {
        await this.handleEvent(eventType, event);
      });
    }

    logger.info(`WorkflowService: Subscribed to ${eventTypes.length} event types`);
  }

  /**
   * Manejar un evento y ejecutar workflows correspondientes
   */
  async handleEvent(eventName, event) {
    try {
      const organizationId = event.organizationId;
      if (!organizationId) {
        logger.debug(`WorkflowService: Event ${eventName} has no organizationId, skipping`);
        return;
      }

      // Buscar workflows que escuchen este evento
      const workflows = await Workflow.findByEvent(organizationId, eventName);

      if (workflows.length === 0) {
        return;
      }

      logger.info(`WorkflowService: Found ${workflows.length} workflows for event ${eventName}`);

      // Ejecutar cada workflow
      for (const workflow of workflows) {
        // Verificar limite de ejecuciones diarias si aplica
        if (workflow.trigger.config?.maxExecutionsPerDay) {
          const todayExecutions = await this.getTodayExecutionCount(workflow._id);
          if (todayExecutions >= workflow.trigger.config.maxExecutionsPerDay) {
            logger.warn(`WorkflowService: Workflow ${workflow.name} exceeded daily limit`);
            continue;
          }
        }

        // Ejecutar workflow de forma asincrona
        this.executeWorkflow(workflow._id, {
          type: 'event',
          event: eventName,
          eventData: event.data
        }, {
          entityType: event.entityType,
          entityId: event.entityId,
          entityData: event.data
        }).catch(error => {
          logger.error(`WorkflowService: Error executing workflow ${workflow.name}:`, error);
        });
      }
    } catch (error) {
      logger.error(`WorkflowService: Error handling event ${eventName}:`, error);
    }
  }

  /**
   * Obtener conteo de ejecuciones de hoy
   */
  async getTodayExecutionCount(workflowId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return WorkflowExecution.countDocuments({
      workflowId,
      createdAt: { $gte: startOfDay }
    });
  }

  // ==================== CRUD Operations ====================

  /**
   * Crear workflow
   */
  async createWorkflow(data, userId) {
    const workflow = new Workflow({
      ...data,
      createdBy: userId,
      updatedBy: userId,
      status: 'draft'
    });

    await workflow.save();

    logger.info(`WorkflowService: Created workflow ${workflow.name} (${workflow._id})`);

    return workflow;
  }

  /**
   * Obtener workflow por ID
   */
  async getWorkflow(workflowId, organizationId) {
    return Workflow.findOne({
      _id: workflowId,
      organizationId
    });
  }

  /**
   * Listar workflows de una organizacion
   */
  async listWorkflows(organizationId, options = {}) {
    const {
      status,
      category,
      enabled,
      search,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = options;

    const query = { organizationId };

    if (status) query.status = status;
    if (category) query.category = category;
    if (enabled !== undefined) query.enabled = enabled;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const [workflows, total] = await Promise.all([
      Workflow.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name email'),
      Workflow.countDocuments(query)
    ]);

    return {
      workflows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Actualizar workflow
   */
  async updateWorkflow(workflowId, data, userId, organizationId) {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      organizationId
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Actualizar campos permitidos
    const allowedFields = [
      'name', 'description', 'category', 'trigger', 'conditions',
      'actions', 'tags', 'settings'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        workflow[field] = data[field];
      }
    }

    workflow.updatedBy = userId;
    await workflow.save();

    // Re-programar si es necesario
    if (workflow.trigger.type === 'schedule' && workflow.enabled) {
      this.unscheduleWorkflow(workflowId);
      this.scheduleWorkflow(workflow);
    }

    logger.info(`WorkflowService: Updated workflow ${workflow.name}`);

    return workflow;
  }

  /**
   * Eliminar workflow
   */
  async deleteWorkflow(workflowId, organizationId) {
    const workflow = await Workflow.findOneAndDelete({
      _id: workflowId,
      organizationId
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Cancelar programacion si existe
    this.unscheduleWorkflow(workflowId);

    // Eliminar ejecuciones asociadas (opcional, pueden mantenerse para historial)
    // await WorkflowExecution.deleteMany({ workflowId });

    logger.info(`WorkflowService: Deleted workflow ${workflow.name}`);

    return workflow;
  }

  /**
   * Activar/desactivar workflow
   */
  async toggleWorkflow(workflowId, enabled, userId, organizationId) {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      organizationId
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    workflow.enabled = enabled;
    workflow.updatedBy = userId;

    if (enabled && workflow.status === 'draft') {
      workflow.status = 'active';
    } else if (!enabled && workflow.status === 'active') {
      workflow.status = 'paused';
    }

    await workflow.save();

    // Manejar programacion
    if (workflow.trigger.type === 'schedule') {
      if (enabled) {
        this.scheduleWorkflow(workflow);
      } else {
        this.unscheduleWorkflow(workflowId);
      }
    }

    logger.info(`WorkflowService: Workflow ${workflow.name} ${enabled ? 'enabled' : 'disabled'}`);

    return workflow;
  }

  /**
   * Publicar workflow (de draft a active)
   */
  async publishWorkflow(workflowId, userId, organizationId, changeDescription) {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      organizationId
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    await workflow.publish(userId, changeDescription);

    // Programar si es necesario
    if (workflow.trigger.type === 'schedule') {
      this.scheduleWorkflow(workflow);
    }

    logger.info(`WorkflowService: Published workflow ${workflow.name} v${workflow.version}`);

    return workflow;
  }

  /**
   * Clonar workflow
   */
  async cloneWorkflow(workflowId, newName, userId, organizationId) {
    const original = await Workflow.findOne({
      _id: workflowId,
      organizationId
    });

    if (!original) {
      throw new Error('Workflow not found');
    }

    const cloned = original.clone(newName, userId);
    await cloned.save();

    logger.info(`WorkflowService: Cloned workflow ${original.name} to ${cloned.name}`);

    return cloned;
  }

  // ==================== Execution ====================

  /**
   * Ejecutar workflow manualmente
   */
  async executeWorkflow(workflowId, triggerContext, entityContext) {
    const workflow = await Workflow.findById(workflowId);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.enabled) {
      throw new Error('Workflow is disabled');
    }

    return workflowEngine.executeWorkflow(workflow, triggerContext, entityContext);
  }

  /**
   * Ejecutar workflow manualmente con datos de entidad
   */
  async executeWorkflowManually(workflowId, userId, entityType, entityId, organizationId) {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      organizationId
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Obtener datos de la entidad
    let entityData = null;
    if (entityType && entityId) {
      const { Expedition, Requirement } = require('../../models');
      const modelMap = { expedition: Expedition, requirement: Requirement };
      const Model = modelMap[entityType];
      if (Model) {
        entityData = await Model.findById(entityId);
      }
    }

    return workflowEngine.executeWorkflow(
      workflow,
      {
        type: 'manual',
        triggeredBy: { userId }
      },
      {
        entityType,
        entityId,
        entityData
      }
    );
  }

  /**
   * Obtener historial de ejecuciones
   */
  async getExecutionHistory(workflowId, organizationId, options = {}) {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      organizationId
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return WorkflowExecution.getByWorkflow(workflowId, options);
  }

  /**
   * Obtener detalle de una ejecucion
   */
  async getExecution(executionId, organizationId) {
    return WorkflowExecution.findOne({
      executionId,
      organizationId
    });
  }

  /**
   * Cancelar ejecucion en progreso
   */
  async cancelExecution(executionId, reason, organizationId) {
    const execution = await WorkflowExecution.findOne({
      executionId,
      organizationId,
      status: 'running'
    });

    if (!execution) {
      throw new Error('Execution not found or not running');
    }

    return workflowEngine.cancelExecution(executionId, reason);
  }

  // ==================== Statistics ====================

  /**
   * Obtener estadisticas de workflows
   */
  async getStats(organizationId) {
    const [workflowStats, executionStats] = await Promise.all([
      Workflow.getGlobalStats(organizationId),
      WorkflowExecution.getStats(organizationId)
    ]);

    return {
      workflows: workflowStats,
      executions: executionStats,
      running: workflowEngine.getRunningExecutions().length
    };
  }

  /**
   * Obtener workflows mas activos
   */
  async getTopWorkflows(organizationId, limit = 10) {
    return Workflow.find({ organizationId })
      .sort({ 'stats.totalExecutions': -1 })
      .limit(limit)
      .select('name category stats enabled');
  }
}

// Instancia singleton
const workflowService = new WorkflowService();

module.exports = workflowService;
