/**
 * Workflow Event Emitter
 * Sistema central de eventos para triggers de workflows
 * Fase 6.6 - LUCI Customs Agent
 *
 * Centraliza la emision de eventos del sistema para que
 * los workflows puedan reaccionar automaticamente.
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');

// ==================== Workflow Event Emitter ====================

class WorkflowEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Aumentar limite para muchos workflows
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Emitir evento del sistema
   * @param {string} eventName - Nombre del evento (ej: 'expedition.created')
   * @param {Object} eventData - Datos del evento
   * @param {Object} options - Opciones adicionales
   */
  emitWorkflowEvent(eventName, eventData, options = {}) {
    const event = {
      name: eventName,
      data: eventData,
      timestamp: new Date(),
      organizationId: options.organizationId,
      entityType: options.entityType,
      entityId: options.entityId
    };

    // Guardar en historial
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    logger.debug(`WorkflowEventEmitter: Emitting event ${eventName}`, {
      entityType: options.entityType,
      entityId: options.entityId
    });

    // Emitir evento
    this.emit(eventName, event);

    // Emitir evento generico para logging/monitoring
    this.emit('workflow:event', event);

    return event;
  }

  /**
   * Obtener historial de eventos recientes
   */
  getEventHistory(filters = {}) {
    let history = [...this.eventHistory];

    if (filters.eventName) {
      history = history.filter(e => e.name === filters.eventName);
    }

    if (filters.organizationId) {
      history = history.filter(e => e.organizationId?.toString() === filters.organizationId.toString());
    }

    if (filters.entityType) {
      history = history.filter(e => e.entityType === filters.entityType);
    }

    if (filters.since) {
      history = history.filter(e => e.timestamp >= filters.since);
    }

    return history.slice(-filters.limit || -100);
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

// Instancia singleton
const workflowEvents = new WorkflowEventEmitter();

// ==================== Helper Functions ====================

/**
 * Helpers para emitir eventos comunes
 */
const eventHelpers = {
  // Expedientes
  expeditionCreated: (expedition, organizationId) => {
    workflowEvents.emitWorkflowEvent('expedition.created', expedition, {
      organizationId,
      entityType: 'expedition',
      entityId: expedition._id
    });
  },

  expeditionUpdated: (expedition, changes, organizationId) => {
    workflowEvents.emitWorkflowEvent('expedition.updated', { expedition, changes }, {
      organizationId,
      entityType: 'expedition',
      entityId: expedition._id
    });
  },

  expeditionStatusChanged: (expedition, previousStatus, newStatus, organizationId) => {
    workflowEvents.emitWorkflowEvent('expedition.status_changed', {
      expedition,
      previousStatus,
      newStatus
    }, {
      organizationId,
      entityType: 'expedition',
      entityId: expedition._id
    });
  },

  expeditionCompleted: (expedition, organizationId) => {
    workflowEvents.emitWorkflowEvent('expedition.completed', expedition, {
      organizationId,
      entityType: 'expedition',
      entityId: expedition._id
    });
  },

  // Documentos
  documentUploaded: (document, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('document.uploaded', { document, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  },

  documentValidated: (document, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('document.validated', { document, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  },

  documentRejected: (document, reason, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('document.rejected', { document, reason, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  },

  // Declaraciones
  declarationCreated: (declaration, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('declaration.created', { declaration, expeditionId }, {
      organizationId,
      entityType: 'declaration',
      entityId: declaration._id || declaration.id
    });
  },

  declarationSubmitted: (declaration, mrn, organizationId) => {
    workflowEvents.emitWorkflowEvent('declaration.submitted', { declaration, mrn }, {
      organizationId,
      entityType: 'declaration',
      entityId: declaration._id || declaration.id
    });
  },

  declarationAccepted: (declaration, mrn, organizationId) => {
    workflowEvents.emitWorkflowEvent('declaration.accepted', { declaration, mrn }, {
      organizationId,
      entityType: 'declaration',
      entityId: declaration._id || declaration.id
    });
  },

  // Canales
  channelAssigned: (expedition, channel, organizationId) => {
    const eventName = `channel.${channel.toLowerCase()}`;
    workflowEvents.emitWorkflowEvent('declaration.channel_assigned', { expedition, channel }, {
      organizationId,
      entityType: 'expedition',
      entityId: expedition._id
    });
    // Tambien emitir evento especifico del canal
    workflowEvents.emitWorkflowEvent(eventName, { expedition, channel }, {
      organizationId,
      entityType: 'expedition',
      entityId: expedition._id
    });
  },

  // Requerimientos
  requirementCreated: (requirement, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('requirement.created', { requirement, expeditionId }, {
      organizationId,
      entityType: 'requirement',
      entityId: requirement._id
    });
  },

  requirementResponded: (requirement, response, organizationId) => {
    workflowEvents.emitWorkflowEvent('requirement.responded', { requirement, response }, {
      organizationId,
      entityType: 'requirement',
      entityId: requirement._id
    });
  },

  requirementResolved: (requirement, resolution, organizationId) => {
    workflowEvents.emitWorkflowEvent('requirement.resolved', { requirement, resolution }, {
      organizationId,
      entityType: 'requirement',
      entityId: requirement._id
    });
  },

  requirementDeadlineApproaching: (requirement, daysRemaining, organizationId) => {
    workflowEvents.emitWorkflowEvent('requirement.deadline_approaching', {
      requirement,
      daysRemaining
    }, {
      organizationId,
      entityType: 'requirement',
      entityId: requirement._id
    });
  },

  // Garantias
  guaranteeLowBalance: (guarantee, currentBalance, threshold, organizationId) => {
    workflowEvents.emitWorkflowEvent('guarantee.low_balance', {
      guarantee,
      currentBalance,
      threshold
    }, {
      organizationId,
      entityType: 'guarantee',
      entityId: guarantee._id
    });
  },

  guaranteeExpired: (guarantee, organizationId) => {
    workflowEvents.emitWorkflowEvent('guarantee.expired', guarantee, {
      organizationId,
      entityType: 'guarantee',
      entityId: guarantee._id
    });
  },

  // Transitos
  transitInitiated: (transit, organizationId) => {
    workflowEvents.emitWorkflowEvent('transit.initiated', transit, {
      organizationId,
      entityType: 'transit',
      entityId: transit._id
    });
  },

  transitArrived: (transit, organizationId) => {
    workflowEvents.emitWorkflowEvent('transit.arrived', transit, {
      organizationId,
      entityType: 'transit',
      entityId: transit._id
    });
  },

  transitCompleted: (transit, organizationId) => {
    workflowEvents.emitWorkflowEvent('transit.completed', transit, {
      organizationId,
      entityType: 'transit',
      entityId: transit._id
    });
  },

  // Inspecciones
  inspectionScheduled: (inspection, organizationId) => {
    workflowEvents.emitWorkflowEvent('inspection.scheduled', inspection, {
      organizationId,
      entityType: 'inspection',
      entityId: inspection._id
    });
  },

  inspectionCompleted: (inspection, result, organizationId) => {
    workflowEvents.emitWorkflowEvent('inspection.completed', { inspection, result }, {
      organizationId,
      entityType: 'inspection',
      entityId: inspection._id
    });
    // Emitir evento especifico segun resultado
    if (result === 'passed' || result === 'approved') {
      workflowEvents.emitWorkflowEvent('inspection.passed', inspection, {
        organizationId,
        entityType: 'inspection',
        entityId: inspection._id
      });
    } else if (result === 'failed' || result === 'rejected') {
      workflowEvents.emitWorkflowEvent('inspection.failed', inspection, {
        organizationId,
        entityType: 'inspection',
        entityId: inspection._id
      });
    }
  },

  // ML/Alertas
  fraudDetected: (analysis, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('ml.fraud_detected', { analysis, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  },

  highRiskPredicted: (prediction, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('ml.high_risk_predicted', { prediction, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  },

  // Pagos
  paymentRequired: (payment, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('payment.required', { payment, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  },

  paymentCompleted: (payment, expeditionId, organizationId) => {
    workflowEvents.emitWorkflowEvent('payment.completed', { payment, expeditionId }, {
      organizationId,
      entityType: 'expedition',
      entityId: expeditionId
    });
  }
};

module.exports = {
  workflowEvents,
  eventHelpers
};
