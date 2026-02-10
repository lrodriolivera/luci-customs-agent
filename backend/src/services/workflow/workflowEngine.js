/**
 * Workflow Engine
 * Motor principal de ejecucion de workflows
 * Fase 6.6 - LUCI Customs Agent
 *
 * Responsabilidades:
 * - Evaluar condiciones
 * - Ejecutar acciones en secuencia
 * - Gestionar errores y reintentos
 * - Registrar ejecuciones
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');
const { Workflow, WorkflowExecution } = require('../../models');

// ==================== Workflow Engine Class ====================

class WorkflowEngine extends EventEmitter {
  constructor() {
    super();
    this.actionHandlers = new Map();
    this.runningExecutions = new Map();
    this.maxConcurrent = 50;

    // Registrar handlers de acciones predefinidos
    this.registerDefaultHandlers();
  }

  /**
   * Registrar handler de accion
   */
  registerActionHandler(actionType, handler) {
    this.actionHandlers.set(actionType, handler);
    logger.info(`WorkflowEngine: Registered handler for action type: ${actionType}`);
  }

  /**
   * Registrar handlers predefinidos
   */
  registerDefaultHandlers() {
    // Se registran desde actionHandlers.js
  }

  /**
   * Evaluar si las condiciones se cumplen
   */
  evaluateConditions(conditionGroup, context) {
    if (!conditionGroup || !conditionGroup.conditions || conditionGroup.conditions.length === 0) {
      return true; // Sin condiciones = siempre ejecutar
    }

    const results = conditionGroup.conditions.map(condition => {
      return this.evaluateCondition(condition, context);
    });

    if (conditionGroup.logic === 'OR') {
      return results.some(r => r);
    }
    return results.every(r => r); // AND por defecto
  }

  /**
   * Evaluar una condicion individual
   */
  evaluateCondition(condition, context) {
    const { field, operator, value, caseSensitive } = condition;

    // Obtener valor del campo desde el contexto
    let fieldValue = this.getFieldValue(field, context);

    // Normalizar si no es case sensitive
    if (!caseSensitive && typeof fieldValue === 'string') {
      fieldValue = fieldValue.toLowerCase();
    }
    let compareValue = value;
    if (!caseSensitive && typeof compareValue === 'string') {
      compareValue = compareValue.toLowerCase();
    }

    switch (operator) {
      case 'equals':
        return fieldValue === compareValue;

      case 'not_equals':
        return fieldValue !== compareValue;

      case 'contains':
        return String(fieldValue).includes(String(compareValue));

      case 'not_contains':
        return !String(fieldValue).includes(String(compareValue));

      case 'starts_with':
        return String(fieldValue).startsWith(String(compareValue));

      case 'ends_with':
        return String(fieldValue).endsWith(String(compareValue));

      case 'greater_than':
        return Number(fieldValue) > Number(compareValue);

      case 'less_than':
        return Number(fieldValue) < Number(compareValue);

      case 'greater_or_equal':
        return Number(fieldValue) >= Number(compareValue);

      case 'less_or_equal':
        return Number(fieldValue) <= Number(compareValue);

      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);

      case 'not_in':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);

      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0);

      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '' &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0);

      case 'is_true':
        return fieldValue === true || fieldValue === 'true' || fieldValue === 1;

      case 'is_false':
        return fieldValue === false || fieldValue === 'false' || fieldValue === 0;

      case 'regex':
        try {
          const regex = new RegExp(compareValue, caseSensitive ? '' : 'i');
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }

      default:
        logger.warn(`WorkflowEngine: Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Obtener valor de un campo desde el contexto
   * Soporta notacion de punto: 'entity.client.email'
   */
  getFieldValue(fieldPath, context) {
    const parts = fieldPath.split('.');
    let value = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Reemplazar variables en un string
   * {{entity.client.name}} -> valor real
   */
  interpolateString(template, context) {
    if (typeof template !== 'string') return template;

    return template.replace(/\{\{([^}]+)\}\}/g, (match, fieldPath) => {
      const value = this.getFieldValue(fieldPath.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Interpolate en objeto completo
   */
  interpolateObject(obj, context) {
    if (typeof obj === 'string') {
      return this.interpolateString(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, context));
    }

    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Ejecutar un workflow
   */
  async executeWorkflow(workflow, triggerContext, entityContext) {
    const startTime = Date.now();

    // Crear registro de ejecucion
    const execution = new WorkflowExecution({
      workflowId: workflow._id,
      workflowName: workflow.name,
      workflowVersion: workflow.version,
      organizationId: workflow.organizationId,
      status: 'queued',
      triggerContext,
      entityContext,
      timing: { queuedAt: new Date() }
    });

    await execution.save();
    this.runningExecutions.set(execution.executionId, execution);

    logger.info(`WorkflowEngine: Starting execution ${execution.executionId} for workflow ${workflow.name}`);

    try {
      // Iniciar ejecucion
      await execution.start();

      // Construir contexto completo
      const context = {
        workflow: {
          id: workflow._id,
          name: workflow.name,
          version: workflow.version
        },
        trigger: triggerContext,
        entity: entityContext?.entityData || {},
        entityType: entityContext?.entityType,
        entityId: entityContext?.entityId,
        variables: {},
        execution: {
          id: execution.executionId,
          startedAt: execution.timing.startedAt
        }
      };

      // Evaluar condiciones del workflow
      if (workflow.conditions && !this.evaluateConditions(workflow.conditions, context)) {
        execution.addLog('info', 'Condiciones no cumplidas, workflow omitido');
        await execution.complete({ skipped: true, reason: 'conditions_not_met' });
        return { success: true, skipped: true, executionId: execution.executionId };
      }

      // Ordenar acciones por orden
      const sortedActions = [...workflow.actions].sort((a, b) => a.order - b.order);

      // Ejecutar acciones en secuencia
      for (const action of sortedActions) {
        const actionResult = await this.executeAction(action, context, execution);

        if (!actionResult.success && !action.continueOnError) {
          // Accion fallo y no debe continuar
          throw new Error(`Action ${action.name || action.type} failed: ${actionResult.error}`);
        }

        // Actualizar contexto con resultado de la accion
        context.variables[`action_${action._id}`] = actionResult.result;
      }

      // Completar ejecucion
      const executionTimeMs = Date.now() - startTime;
      await execution.complete({ success: true });
      await workflow.recordExecution(true, executionTimeMs);

      this.runningExecutions.delete(execution.executionId);

      logger.info(`WorkflowEngine: Execution ${execution.executionId} completed in ${executionTimeMs}ms`);

      return {
        success: true,
        executionId: execution.executionId,
        duration: executionTimeMs
      };

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      await execution.fail(error);
      await workflow.recordExecution(false, executionTimeMs);

      this.runningExecutions.delete(execution.executionId);

      logger.error(`WorkflowEngine: Execution ${execution.executionId} failed:`, error);

      return {
        success: false,
        executionId: execution.executionId,
        error: error.message,
        duration: executionTimeMs
      };
    }
  }

  /**
   * Ejecutar una accion individual
   */
  async executeAction(action, context, execution) {
    const handler = this.actionHandlers.get(action.type);

    if (!handler) {
      const error = `No handler registered for action type: ${action.type}`;
      logger.error(`WorkflowEngine: ${error}`);
      return { success: false, error };
    }

    // Registrar inicio de accion
    await execution.startAction(action._id, action.type, action.name, action.order);

    let lastError;
    const maxRetries = action.config?.retryOnFailure ? (action.config.maxRetries || 3) : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Interpolate configuracion con contexto
        const interpolatedConfig = this.interpolateObject(action.config || {}, context);

        // Ejecutar handler
        const result = await handler(interpolatedConfig, context, execution);

        // Registrar exito
        await execution.completeAction(action._id, result);

        return { success: true, result };

      } catch (error) {
        lastError = error;
        execution.addActionLog(action._id, 'error', `Attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          // Esperar antes de reintentar
          const delay = action.config?.retryDelayMs || 5000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Todas las tentativas fallaron
    await execution.failAction(action._id, lastError);

    // Manejar error segun configuracion
    if (action.errorHandler?.action === 'notify' && action.errorHandler.notifyUsers?.length > 0) {
      // Notificar a usuarios (se implementaria con notificationService)
      logger.warn(`WorkflowEngine: Action failed, would notify users: ${action.errorHandler.notifyUsers}`);
    }

    return { success: false, error: lastError.message };
  }

  /**
   * Cancelar ejecucion en progreso
   */
  async cancelExecution(executionId, reason) {
    const execution = this.runningExecutions.get(executionId);
    if (execution) {
      await execution.cancel(reason);
      this.runningExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Obtener ejecuciones en progreso
   */
  getRunningExecutions() {
    return Array.from(this.runningExecutions.values());
  }
}

// Instancia singleton
const workflowEngine = new WorkflowEngine();

module.exports = workflowEngine;
