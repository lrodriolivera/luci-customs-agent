/**
 * Deadline Service
 * Servicio para gestión de plazos y alertas de vencimientos
 *
 * Funcionalidades:
 * - Creación automática de deadlines desde otras entidades
 * - Sistema de alertas configurables
 * - Dashboard de plazos urgentes
 * - Sincronización con garantías, OEA, regímenes, etc.
 */

const Deadline = require('../models/Deadline');
const User = require('../models/User');
const Expedition = require('../models/Expedition');
const logger = require('../config/logger');

/**
 * Carga el documento comprobando que es del tenant de quien lo pide.
 * El tenantId se anadio al schema y se derivo de la expedicion, que es su
 * unico dueno posible. Mismo error que cuando no existe, para no confirmar
 * ids de otro tenant. Sin userId (jobs) no se comprueba; los documentos
 * legacy sin tenantId siguen pasando.
 */
async function _loadOwnedDeadline(id, userId) {
  const doc = await Deadline.findById(id);
  if (!doc) {
    throw new Error('Deadline no encontrado');
  }
  // El tenant se resuelve desde el usuario en vez de exigirlo en las 19 firmas
  // y sus 47 llamadores. Una consulta extra por operacion de escritura, que es
  // asumible frente a propagar el parametro por toda la cadena.
  if (userId && doc.tenantId) {
    const user = await User.findById(userId).select('tenantId').lean();
    if (user?.tenantId && String(doc.tenantId) !== String(user.tenantId)) {
      throw new Error('Deadline no encontrado');
    }
  }
  return doc;
}


// Configuración de tipos de deadline
const DEADLINE_CONFIG = {
  requirement_response: {
    category: 'requirement',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 5, alertType: 'system' },
      { daysBeforeDeadline: 2, alertType: 'email' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'Incumplimiento puede resultar en rechazo de la declaración o sanción'
  },
  guarantee_expiration: {
    category: 'guarantee',
    defaultPriority: 'critical',
    defaultImpact: 'critical',
    defaultAlerts: [
      { daysBeforeDeadline: 30, alertType: 'system' },
      { daysBeforeDeadline: 15, alertType: 'email' },
      { daysBeforeDeadline: 7, alertType: 'all' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'Sin garantía válida no se pueden realizar operaciones aduaneras'
  },
  guarantee_renewal: {
    category: 'guarantee',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 60, alertType: 'system' },
      { daysBeforeDeadline: 30, alertType: 'email' },
      { daysBeforeDeadline: 14, alertType: 'all' }
    ],
    impactDescription: 'Renovación tardía puede causar interrupción de operaciones'
  },
  regime_ultimation: {
    category: 'regime',
    defaultPriority: 'high',
    defaultImpact: 'critical',
    defaultAlerts: [
      { daysBeforeDeadline: 30, alertType: 'system' },
      { daysBeforeDeadline: 14, alertType: 'email' },
      { daysBeforeDeadline: 7, alertType: 'all' },
      { daysBeforeDeadline: 3, alertType: 'all' }
    ],
    impactDescription: 'Incumplimiento genera deuda aduanera y posibles sanciones'
  },
  regime_account: {
    category: 'regime',
    defaultPriority: 'medium',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 14, alertType: 'system' },
      { daysBeforeDeadline: 7, alertType: 'email' },
      { daysBeforeDeadline: 3, alertType: 'all' }
    ],
    impactDescription: 'Presentación tardía puede generar sanción'
  },
  oea_renewal: {
    category: 'oea',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 90, alertType: 'system' },
      { daysBeforeDeadline: 60, alertType: 'email' },
      { daysBeforeDeadline: 30, alertType: 'all' }
    ],
    impactDescription: 'Pérdida de certificación OEA elimina beneficios y simplificaciones'
  },
  oea_audit: {
    category: 'oea',
    defaultPriority: 'medium',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 14, alertType: 'system' },
      { daysBeforeDeadline: 7, alertType: 'email' },
      { daysBeforeDeadline: 2, alertType: 'all' }
    ],
    impactDescription: 'Auditoría requerida para mantener certificación OEA'
  },
  transit_arrival: {
    category: 'transit',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 3, alertType: 'system' },
      { daysBeforeDeadline: 1, alertType: 'email' }
    ],
    impactDescription: 'Retraso en llegada puede generar incidente en NCTS'
  },
  transit_discharge: {
    category: 'transit',
    defaultPriority: 'high',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 2, alertType: 'system' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'Descarga fuera de plazo puede generar retención'
  },
  certificate_expiration: {
    category: 'certificate',
    defaultPriority: 'medium',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 30, alertType: 'system' },
      { daysBeforeDeadline: 14, alertType: 'email' },
      { daysBeforeDeadline: 7, alertType: 'all' }
    ],
    impactDescription: 'Certificado vencido invalida preferencias arancelarias'
  },
  license_expiration: {
    category: 'certificate',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 60, alertType: 'system' },
      { daysBeforeDeadline: 30, alertType: 'email' },
      { daysBeforeDeadline: 14, alertType: 'all' }
    ],
    impactDescription: 'Sin licencia válida no se pueden realizar importaciones reguladas'
  },
  declaration_submission: {
    category: 'declaration',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 3, alertType: 'system' },
      { daysBeforeDeadline: 1, alertType: 'email' }
    ],
    impactDescription: 'Declaración fuera de plazo genera sanciones e intereses'
  },
  h7_completion: {
    category: 'declaration',
    defaultPriority: 'medium',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 7, alertType: 'system' },
      { daysBeforeDeadline: 3, alertType: 'email' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'H7 incompleta puede bloquear el envío'
  },
  inspection_appointment: {
    category: 'inspection',
    defaultPriority: 'high',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 2, alertType: 'system' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'No presentarse a inspección genera retraso y posible reprogramación'
  },
  paraduanero_response: {
    category: 'requirement',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 5, alertType: 'system' },
      { daysBeforeDeadline: 2, alertType: 'email' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'Incumplimiento puede resultar en rechazo del control paraduanero'
  },
  appeal_deadline: {
    category: 'requirement',
    defaultPriority: 'critical',
    defaultImpact: 'critical',
    defaultAlerts: [
      { daysBeforeDeadline: 10, alertType: 'system' },
      { daysBeforeDeadline: 5, alertType: 'email' },
      { daysBeforeDeadline: 2, alertType: 'all' }
    ],
    impactDescription: 'Plazo de alegación/recurso es preclusivo - no se puede recuperar'
  },
  payment_deadline: {
    category: 'payment',
    defaultPriority: 'high',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 7, alertType: 'system' },
      { daysBeforeDeadline: 3, alertType: 'email' },
      { daysBeforeDeadline: 1, alertType: 'all' }
    ],
    impactDescription: 'Pago tardío genera intereses de demora y posible ejecución de garantía'
  },
  document_presentation: {
    category: 'requirement',
    defaultPriority: 'medium',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 5, alertType: 'system' },
      { daysBeforeDeadline: 2, alertType: 'email' }
    ],
    impactDescription: 'Documento no presentado puede bloquear despacho'
  },
  customs_storage: {
    category: 'other',
    defaultPriority: 'medium',
    defaultImpact: 'high',
    defaultAlerts: [
      { daysBeforeDeadline: 30, alertType: 'system' },
      { daysBeforeDeadline: 14, alertType: 'email' },
      { daysBeforeDeadline: 7, alertType: 'all' }
    ],
    impactDescription: 'Exceder plazo de almacenamiento temporal genera abandono de mercancía'
  },
  other: {
    category: 'other',
    defaultPriority: 'medium',
    defaultImpact: 'medium',
    defaultAlerts: [
      { daysBeforeDeadline: 7, alertType: 'system' },
      { daysBeforeDeadline: 3, alertType: 'email' }
    ],
    impactDescription: ''
  }
};

// Niveles de alerta
const ALERT_LEVELS = {
  info: { daysThreshold: Infinity, color: 'blue' },
  warning: { daysThreshold: 7, color: 'yellow' },
  urgent: { daysThreshold: 3, color: 'orange' },
  critical: { daysThreshold: 1, color: 'red' }
};

class DeadlineService {
  /**
   * Obtener configuración de tipo de deadline
   */
  getDeadlineConfig(deadlineType) {
    return DEADLINE_CONFIG[deadlineType] || DEADLINE_CONFIG.other;
  }

  /**
   * Crear un nuevo deadline
   */
  async create(data, userId = null) {
    try {
      const config = this.getDeadlineConfig(data.deadlineType);

      const deadlineData = {
        ...data,
        category: data.category || config.category,
        priority: data.priority || config.defaultPriority,
        impact: data.impact || config.defaultImpact,
        impactDescription: data.impactDescription || config.impactDescription,
        alertConfig: {
          enabled: true,
          alerts: data.alertConfig?.alerts || config.defaultAlerts.map(a => ({
            ...a,
            enabled: true,
            recipients: []
          }))
        },
        createdBy: userId,
        source: data.source || 'manual'
      };

      // El tenant se hereda de la expedicion de references, nunca del payload.
      if (!deadlineData.tenantId && deadlineData.references?.expeditionId) {
        const exp = await Expedition.findById(deadlineData.references.expeditionId).select('tenantId').lean();
        if (exp?.tenantId) deadlineData.tenantId = exp.tenantId;
      }

      const deadline = new Deadline(deadlineData);
      deadline.calculateNextAlert();
      await deadline.save();

      logger.info(`Deadline creado: ${deadline._id} - ${deadline.title}`);
      return deadline;
    } catch (error) {
      logger.error('Error creando deadline:', error);
      throw error;
    }
  }

  /**
   * Crear deadline desde un requerimiento
   */
  async createFromRequirement(requirement, userId = null) {
    const deadline = await this.create({
      deadlineType: 'requirement_response',
      title: `Respuesta a requerimiento ${requirement.requirementNumber}`,
      description: requirement.subject || requirement.description,
      dueDate: requirement.deadline,
      references: {
        expeditionId: requirement.expeditionId,
        requirementId: requirement._id
      },
      externalReferences: {
        mrn: requirement.mrn,
        lrn: requirement.lrn,
        requirementNumber: requirement.requirementNumber
      },
      assignedTo: requirement.assignedTo,
      client: requirement.client || {},
      source: 'automatic'
    }, userId);

    return deadline;
  }

  /**
   * Crear deadline desde una garantía
   */
  async createFromGuarantee(guarantee, userId = null) {
    const deadlines = [];

    // Deadline de vencimiento
    if (guarantee.validity?.endDate) {
      const expiration = await this.create({
        deadlineType: 'guarantee_expiration',
        title: `Vencimiento garantía ${guarantee.guaranteeNumber}`,
        description: `Garantía ${guarantee.guaranteeType} - ${guarantee.bankEntity}`,
        dueDate: guarantee.validity.endDate,
        references: {
          guaranteeId: guarantee._id
        },
        externalReferences: {
          guaranteeNumber: guarantee.guaranteeNumber
        },
        client: {
          name: guarantee.holder?.name,
          nif: guarantee.holder?.nif,
          eori: guarantee.holder?.eori
        },
        source: 'automatic'
      }, userId);
      deadlines.push(expiration);
    }

    // Deadline de renovación (30 días antes del vencimiento)
    if (guarantee.validity?.endDate) {
      const renewalDate = new Date(guarantee.validity.endDate);
      renewalDate.setDate(renewalDate.getDate() - 30);

      const renewal = await this.create({
        deadlineType: 'guarantee_renewal',
        title: `Renovación garantía ${guarantee.guaranteeNumber}`,
        description: `Iniciar proceso de renovación de garantía`,
        dueDate: renewalDate,
        references: {
          guaranteeId: guarantee._id
        },
        externalReferences: {
          guaranteeNumber: guarantee.guaranteeNumber
        },
        client: {
          name: guarantee.holder?.name,
          nif: guarantee.holder?.nif,
          eori: guarantee.holder?.eori
        },
        source: 'automatic'
      }, userId);
      deadlines.push(renewal);
    }

    return deadlines;
  }

  /**
   * Crear deadline desde OEA
   */
  async createFromOEA(oea, userId = null) {
    const deadlines = [];

    // Deadline de renovación
    if (oea.certification?.expirationDate) {
      const renewal = await this.create({
        deadlineType: 'oea_renewal',
        title: `Renovación OEA ${oea.oeaNumber}`,
        description: `Renovación certificación ${oea.certification.type}`,
        dueDate: oea.certification.expirationDate,
        references: {
          oeaId: oea._id
        },
        externalReferences: {
          oeaNumber: oea.oeaNumber
        },
        client: {
          name: oea.organization?.name,
          nif: oea.organization?.nif,
          eori: oea.organization?.eori
        },
        source: 'automatic'
      }, userId);
      deadlines.push(renewal);
    }

    return deadlines;
  }

  /**
   * Crear deadline desde régimen especial
   */
  async createFromSpecialRegime(regime, userId = null) {
    const deadlines = [];

    // Deadline de ultimación
    if (regime.ultimationDeadline) {
      const ultimation = await this.create({
        deadlineType: 'regime_ultimation',
        title: `Ultimación régimen ${regime.regimeNumber}`,
        description: `${regime.regimeType} - ${regime.description}`,
        dueDate: regime.ultimationDeadline,
        references: {
          specialRegimeId: regime._id,
          expeditionId: regime.expeditionId
        },
        externalReferences: {
          regimeNumber: regime.regimeNumber,
          mrn: regime.mrn
        },
        source: 'automatic'
      }, userId);
      deadlines.push(ultimation);
    }

    // Deadline de presentación de cuentas
    if (regime.accountDeadline) {
      const account = await this.create({
        deadlineType: 'regime_account',
        title: `Cuenta ultimación ${regime.regimeNumber}`,
        description: `Presentación cuenta de ultimación`,
        dueDate: regime.accountDeadline,
        references: {
          specialRegimeId: regime._id
        },
        externalReferences: {
          regimeNumber: regime.regimeNumber
        },
        source: 'automatic'
      }, userId);
      deadlines.push(account);
    }

    return deadlines;
  }

  /**
   * Crear deadline desde tránsito
   */
  async createFromTransit(transit, userId = null) {
    const deadlines = [];

    // Deadline de llegada
    if (transit.expectedArrival) {
      const arrival = await this.create({
        deadlineType: 'transit_arrival',
        title: `Llegada tránsito ${transit.transitNumber || transit.mrn}`,
        description: `${transit.departureOffice} → ${transit.destinationOffice}`,
        dueDate: transit.expectedArrival,
        references: {
          transitId: transit._id,
          expeditionId: transit.expeditionId
        },
        externalReferences: {
          transitNumber: transit.transitNumber,
          mrn: transit.mrn
        },
        source: 'automatic'
      }, userId);
      deadlines.push(arrival);
    }

    return deadlines;
  }

  /**
   * Crear deadline desde inspección
   */
  async createFromInspection(inspection, userId = null) {
    if (!inspection.scheduling?.scheduledDate) return null;

    const deadline = await this.create({
      deadlineType: 'inspection_appointment',
      title: `Inspección ${inspection.inspectionNumber}`,
      description: `${inspection.inspectionType} en ${inspection.location?.name}`,
      dueDate: inspection.scheduling.scheduledDate,
      references: {
        inspectionId: inspection._id,
        expeditionId: inspection.expeditionId,
        requirementId: inspection.requirementId
      },
      externalReferences: {
        mrn: inspection.mrn
      },
      assignedTo: inspection.assignedTo,
      source: 'automatic'
    }, userId);

    return deadline;
  }

  /**
   * Obtener deadline por ID
   */
  async getById(id) {
    return Deadline.findById(id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email');
  }

  /**
   * Listar deadlines con filtros
   */
  async list(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'dueDate',
      sortOrder = 'asc'
    } = options;

    const query = { active: true, ...filters };

    const [deadlines, total] = await Promise.all([
      Deadline.find(query)
        .populate('assignedTo', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Deadline.countDocuments(query)
    ]);

    return {
      deadlines,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Obtener deadlines pendientes
   */
  async getPending(filters = {}) {
    return Deadline.findPending(filters)
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener deadlines vencidos
   */
  async getOverdue(filters = {}) {
    return Deadline.findOverdue(filters)
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener deadlines urgentes (próximas 48h)
   */
  async getUrgent(hoursThreshold = 48) {
    return Deadline.findUrgent(hoursThreshold)
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener deadlines por categoría
   */
  async getByCategory(category, status = null) {
    return Deadline.findByCategory(category, status)
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener deadlines por tipo
   */
  async getByType(deadlineType, status = null) {
    return Deadline.findByType(deadlineType, status)
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener deadlines asignados a un usuario
   */
  async getByAssignee(userId, includeCompleted = false) {
    return Deadline.findByAssignee(userId, includeCompleted)
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener vista de calendario
   */
  async getCalendarView(startDate, endDate, filters = {}) {
    const deadlines = await Deadline.getCalendarView(startDate, endDate, filters);

    // Agrupar por fecha
    const grouped = {};
    deadlines.forEach(d => {
      const dateKey = d.dueDate.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(d);
    });

    return {
      deadlines,
      grouped,
      startDate,
      endDate
    };
  }

  /**
   * Obtener estadísticas
   */
  async getStats(filters = {}) {
    return Deadline.getStats(filters);
  }

  /**
   * Obtener resumen del dashboard
   */
  async getDashboard(userId = null) {
    const filters = userId ? { assignedTo: userId } : {};

    const [stats, urgent, overdue, dueToday] = await Promise.all([
      this.getStats(filters),
      this.getUrgent(48),
      this.getOverdue(filters),
      Deadline.find({
        ...filters,
        active: true,
        dueDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        },
        status: { $nin: ['completed', 'cancelled'] }
      }).populate('assignedTo', 'name email')
    ]);

    return {
      stats,
      urgent: urgent.slice(0, 10),
      overdue: overdue.slice(0, 10),
      dueToday,
      summary: {
        totalPending: stats.byStatus.pending || 0 +
                      stats.byStatus.approaching || 0 +
                      stats.byStatus.urgent || 0 +
                      stats.byStatus.critical || 0,
        overdue: stats.overdue,
        dueToday: stats.dueToday,
        dueThisWeek: stats.dueThisWeek
      }
    };
  }

  /**
   * Actualizar deadline
   */
  async update(id, data, userId = null) {
    const deadline = await _loadOwnedDeadline(id, userId);

    Object.assign(deadline, data);
    deadline.calculateNextAlert();
    await deadline.save();

    logger.info(`Deadline actualizado: ${id}`);
    return deadline;
  }

  /**
   * Completar deadline
   */
  async complete(id, notes = '', userId = null) {
    const deadline = await _loadOwnedDeadline(id, userId);

    await deadline.complete(userId, notes);
    logger.info(`Deadline completado: ${id}`);
    return deadline;
  }

  /**
   * Extender plazo
   */
  async extend(id, newDate, reason, userId = null) {
    const deadline = await _loadOwnedDeadline(id, userId);

    await deadline.extend(new Date(newDate), reason, userId);
    deadline.calculateNextAlert();
    await deadline.save();

    logger.info(`Deadline extendido: ${id} hasta ${newDate}`);
    return deadline;
  }

  /**
   * Cancelar deadline
   */
  async cancel(id, reason, userId = null) {
    const deadline = await _loadOwnedDeadline(id, userId);

    await deadline.cancel(reason, userId);
    logger.info(`Deadline cancelado: ${id}`);
    return deadline;
  }

  /**
   * Eliminar deadline (soft delete)
   */
  async delete(id, userId) {
    const deadline = await _loadOwnedDeadline(id, userId);

    deadline.active = false;
    await deadline.save();

    logger.info(`Deadline eliminado: ${id}`);
    return deadline;
  }

  /**
   * Procesar alertas pendientes
   */
  async processAlerts() {
    const deadlinesDueForAlert = await Deadline.findDueForAlerts();
    const processedAlerts = [];

    for (const deadline of deadlinesDueForAlert) {
      try {
        const alert = await this.sendAlert(deadline);
        if (alert) {
          processedAlerts.push(alert);
        }
      } catch (error) {
        logger.error(`Error procesando alerta para deadline ${deadline._id}:`, error);
      }
    }

    logger.info(`Procesadas ${processedAlerts.length} alertas de deadline`);
    return processedAlerts;
  }

  /**
   * Enviar alerta para un deadline
   */
  async sendAlert(deadline) {
    const days = deadline.daysRemaining;
    let alertLevel = 'info';

    if (days < 0) alertLevel = 'critical';
    else if (days === 0) alertLevel = 'critical';
    else if (days <= 1) alertLevel = 'urgent';
    else if (days <= 3) alertLevel = 'warning';

    const alertData = {
      alertLevel,
      daysRemaining: days,
      message: this.generateAlertMessage(deadline, days),
      sentTo: []
    };

    // Simular envío de alertas (en producción integrar con servicio de notificaciones)
    const alertConfig = deadline.alertConfig.alerts.find(a =>
      a.enabled && a.daysBeforeDeadline >= days
    );

    if (alertConfig) {
      // Marcar como enviado
      alertData.sentTo.push({
        recipient: deadline.assignedTo?.email || 'system',
        channel: alertConfig.alertType,
        status: 'sent'
      });
    }

    await deadline.addAlert(alertData);
    deadline.calculateNextAlert();
    await deadline.save();

    return alertData;
  }

  /**
   * Generar mensaje de alerta
   */
  generateAlertMessage(deadline, daysRemaining) {
    if (daysRemaining < 0) {
      return `VENCIDO: ${deadline.title} venció hace ${Math.abs(daysRemaining)} días`;
    } else if (daysRemaining === 0) {
      return `URGENTE: ${deadline.title} vence HOY`;
    } else if (daysRemaining === 1) {
      return `URGENTE: ${deadline.title} vence MAÑANA`;
    } else {
      return `Recordatorio: ${deadline.title} vence en ${daysRemaining} días`;
    }
  }

  /**
   * Sincronizar deadlines desde todas las fuentes
   */
  async syncAll() {
    // Esta función sincronizaría deadlines desde:
    // - Requirements
    // - Guarantees
    // - OEAs
    // - SpecialRegimes
    // - Transits
    // - Inspections
    // En producción, se ejecutaría como job programado

    logger.info('Sincronización de deadlines iniciada');
    // Implementar lógica de sincronización según necesidades
    return { status: 'completed' };
  }

  /**
   * Obtener tipos de deadline disponibles
   */
  getDeadlineTypes() {
    return Object.keys(DEADLINE_CONFIG).map(key => ({
      value: key,
      label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      config: DEADLINE_CONFIG[key]
    }));
  }

  /**
   * Obtener categorías de deadline
   */
  getCategories() {
    const categories = new Set(Object.values(DEADLINE_CONFIG).map(c => c.category));
    return Array.from(categories);
  }

  /**
   * Obtener información del servicio
   */
  getInfo() {
    return {
      service: 'Deadline Service',
      version: '1.0.0',
      deadlineTypes: Object.keys(DEADLINE_CONFIG).length,
      categories: this.getCategories(),
      alertLevels: Object.keys(ALERT_LEVELS)
    };
  }
}

module.exports = new DeadlineService();
