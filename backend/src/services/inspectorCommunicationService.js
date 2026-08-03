/**
 * Inspector Communication Service
 * Servicio para gestión de comunicaciones con inspectores y autoridades
 *
 * Funcionalidades:
 * - Gestión de alegaciones y recursos
 * - Respuestas a requerimientos
 * - Seguimiento de comunicaciones
 * - Plantillas de documentos
 */

const InspectorCommunication = require('../models/InspectorCommunication');
const Deadline = require('../models/Deadline');
const deadlineService = require('./deadlineService');
const logger = require('../config/logger');

/**
 * Carga el documento comprobando que pertenece a quien lo pide.
 * Las escrituras pasaban el id directo al servicio sin mirar createdBy.
 * Mismo error que cuando no existe, para no confirmar ids de otra cuenta.
 * Sin userId (jobs) no se comprueba; los documentos legacy sin createdBy pasan.
 */
async function _loadOwnedComm(id, userId) {
  const doc = await InspectorCommunication.findById(id);
  if (!doc) {
    throw new Error('Comunicación no encontrada');
  }
  if (userId && doc.createdBy && String(doc.createdBy) !== String(userId)) {
    throw new Error('Comunicación no encontrada');
  }
  return doc;
}


// Tipos de comunicación y sus características
const COMMUNICATION_TYPES = {
  requirement_response: {
    category: 'response',
    defaultDeadlineDays: 10,
    legalBasis: 'Art. 22 RGPD, Art. 103 LGT',
    description: 'Respuesta a requerimiento de información'
  },
  allegation: {
    category: 'appeal',
    defaultDeadlineDays: 15,
    legalBasis: 'Art. 123 LGT',
    description: 'Alegaciones previas a resolución'
  },
  administrative_appeal: {
    category: 'appeal',
    defaultDeadlineDays: 30,
    legalBasis: 'Art. 223-225 LGT',
    description: 'Recurso de reposición ante AEAT'
  },
  economic_appeal: {
    category: 'appeal',
    defaultDeadlineDays: 30,
    legalBasis: 'Art. 226-248 LGT',
    description: 'Reclamación económico-administrativa ante TEAR/TEAC'
  },
  judicial_appeal: {
    category: 'appeal',
    defaultDeadlineDays: 60,
    legalBasis: 'Ley 29/1998 LJCA',
    description: 'Recurso contencioso-administrativo'
  },
  information_request: {
    category: 'request',
    defaultDeadlineDays: null,
    legalBasis: 'Art. 85-87 CAU',
    description: 'Solicitud de información a la autoridad'
  },
  clarification: {
    category: 'response',
    defaultDeadlineDays: 10,
    legalBasis: null,
    description: 'Aclaración de datos o información'
  },
  notification_response: {
    category: 'response',
    defaultDeadlineDays: 10,
    legalBasis: 'Art. 109-112 LGT',
    description: 'Respuesta a notificación administrativa'
  },
  inspection_coordination: {
    category: 'coordination',
    defaultDeadlineDays: 3,
    legalBasis: 'Art. 189 RGAT',
    description: 'Coordinación de inspección física'
  },
  voluntary_rectification: {
    category: 'request',
    defaultDeadlineDays: null,
    legalBasis: 'Art. 120 LGT',
    description: 'Rectificación voluntaria de declaración'
  },
  prior_consultation: {
    category: 'request',
    defaultDeadlineDays: null,
    legalBasis: 'Art. 88-89 LGT',
    description: 'Consulta tributaria vinculante'
  },
  complaint: {
    category: 'other',
    defaultDeadlineDays: null,
    legalBasis: 'Defensor del Contribuyente',
    description: 'Queja ante el Defensor del Contribuyente'
  }
};

// Autoridades y sus datos
const AUTHORITIES = {
  AEAT: {
    name: 'Agencia Estatal de Administración Tributaria',
    shortName: 'AEAT',
    offices: [
      { code: 'DGT', name: 'Dirección General de Tributos' },
      { code: 'DA', name: 'Departamento de Aduanas e IIEE' },
      { code: 'DI', name: 'Departamento de Inspección' }
    ]
  },
  TEAR: {
    name: 'Tribunal Económico-Administrativo Regional',
    shortName: 'TEAR',
    offices: []
  },
  TEAC: {
    name: 'Tribunal Económico-Administrativo Central',
    shortName: 'TEAC',
    offices: []
  },
  SOIVRE: {
    name: 'Servicio Oficial de Inspección, Vigilancia y Regulación de las Exportaciones',
    shortName: 'SOIVRE',
    offices: []
  },
  MAPA: {
    name: 'Ministerio de Agricultura, Pesca y Alimentación',
    shortName: 'MAPA',
    offices: []
  },
  SANIDAD: {
    name: 'Ministerio de Sanidad',
    shortName: 'SANIDAD',
    offices: []
  },
  MITERD: {
    name: 'Ministerio para la Transición Ecológica y el Reto Demográfico',
    shortName: 'MITERD',
    offices: []
  }
};

// Plantillas de comunicación
const TEMPLATES = {
  requirement_response: {
    subject: 'Respuesta a Requerimiento {requirementNumber}',
    opening: 'En respuesta al requerimiento de referencia, se adjunta la documentación solicitada y se realizan las siguientes manifestaciones:',
    closing: 'Por todo lo expuesto, SOLICITO que se tenga por cumplimentado el requerimiento y se proceda al levante de la mercancía.'
  },
  allegation: {
    subject: 'Alegaciones al expediente {expedientNumber}',
    opening: 'Al amparo del artículo 123 de la Ley General Tributaria, formulo las siguientes ALEGACIONES:',
    closing: 'En virtud de lo expuesto, SOLICITO que se estimen las presentes alegaciones y se archive el expediente.'
  },
  administrative_appeal: {
    subject: 'Recurso de Reposición contra {resolutionNumber}',
    opening: 'Que mediante el presente escrito interpongo RECURSO DE REPOSICIÓN contra la resolución de referencia, con base en los siguientes HECHOS y FUNDAMENTOS DE DERECHO:',
    closing: 'Por todo lo cual, SOLICITO que se estime el presente recurso de reposición y se anule la resolución impugnada.'
  },
  economic_appeal: {
    subject: 'Reclamación Económico-Administrativa contra {resolutionNumber}',
    opening: 'Que mediante el presente escrito formulo RECLAMACIÓN ECONÓMICO-ADMINISTRATIVA contra el acto administrativo de referencia, con base en los siguientes MOTIVOS:',
    closing: 'Por todo lo expuesto, SOLICITO la estimación de la presente reclamación y la anulación del acto impugnado.'
  }
};

class InspectorCommunicationService {
  /**
   * Obtener configuración de tipo de comunicación
   */
  getCommunicationTypeConfig(type) {
    return COMMUNICATION_TYPES[type] || null;
  }

  /**
   * Crear nueva comunicación
   */
  async create(data, userId = null) {
    try {
      const typeConfig = this.getCommunicationTypeConfig(data.communicationType);

      // Calcular deadline si no se proporciona
      let submissionDeadline = data.deadlines?.submissionDeadline;
      if (!submissionDeadline && typeConfig?.defaultDeadlineDays) {
        submissionDeadline = new Date();
        submissionDeadline.setDate(submissionDeadline.getDate() + typeConfig.defaultDeadlineDays);
      }

      const communicationData = {
        ...data,
        category: data.category || typeConfig?.category || 'other',
        deadlines: {
          ...data.deadlines,
          submissionDeadline
        },
        legalBasis: data.legalBasis || (typeConfig?.legalBasis ? [{
          law: typeConfig.legalBasis,
          description: typeConfig.description
        }] : []),
        createdBy: userId
      };

      const communication = new InspectorCommunication(communicationData);
      await communication.save();

      // Crear deadline si hay fecha límite
      if (submissionDeadline) {
        await deadlineService.create({
          deadlineType: 'appeal_deadline',
          title: `${typeConfig?.description || 'Comunicación'}: ${communication.communicationNumber}`,
          description: data.subject,
          dueDate: submissionDeadline,
          category: 'requirement',
          references: {
            expeditionId: data.references?.expeditionId,
            requirementId: data.references?.requirementId
          },
          source: 'automatic'
        }, userId);
      }

      logger.info(`Comunicación creada: ${communication.communicationNumber}`);
      return communication;
    } catch (error) {
      logger.error('Error creando comunicación:', error);
      throw error;
    }
  }

  /**
   * Crear respuesta a requerimiento
   */
  async createRequirementResponse(requirement, responseData, userId = null) {
    const communication = await this.create({
      communicationType: 'requirement_response',
      subject: `Respuesta a Requerimiento ${requirement.requirementNumber}`,
      description: responseData.description,
      references: {
        expeditionId: requirement.expeditionId,
        requirementId: requirement._id
      },
      externalReferences: {
        mrn: requirement.mrn,
        requirementNumber: requirement.requirementNumber
      },
      authority: {
        type: requirement.issuingAuthority || 'AEAT',
        office: requirement.customsOffice?.code,
        name: requirement.customsOffice?.name
      },
      inspector: requirement.inspector,
      deadlines: {
        submissionDeadline: requirement.deadline
      },
      client: requirement.client || {},
      assignedTo: requirement.assignedTo,
      ...responseData
    }, userId);

    return communication;
  }

  /**
   * Crear alegación
   */
  async createAllegation(data, userId = null) {
    const communication = await this.create({
      communicationType: 'allegation',
      ...data
    }, userId);

    return communication;
  }

  /**
   * Crear recurso de reposición
   */
  async createAdministrativeAppeal(data, userId = null) {
    const communication = await this.create({
      communicationType: 'administrative_appeal',
      ...data
    }, userId);

    return communication;
  }

  /**
   * Crear reclamación económico-administrativa
   */
  async createEconomicAppeal(data, userId = null) {
    const communication = await this.create({
      communicationType: 'economic_appeal',
      authority: {
        type: data.toTEAC ? 'TEAC' : 'TEAR',
        ...data.authority
      },
      ...data
    }, userId);

    return communication;
  }

  /**
   * Obtener comunicación por ID
   */
  async getById(id) {
    return InspectorCommunication.findById(id)
      .populate('references.expeditionId', 'reference clientName')
      .populate('references.requirementId', 'requirementNumber')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('approvedBy', 'name email');
  }

  /**
   * Obtener comunicación por número
   */
  async getByNumber(communicationNumber) {
    return InspectorCommunication.findOne({ communicationNumber })
      .populate('references.expeditionId', 'reference clientName')
      .populate('assignedTo', 'name email');
  }

  /**
   * Listar comunicaciones con filtros
   */
  async list(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = { active: true, ...filters };

    const [communications, total] = await Promise.all([
      InspectorCommunication.find(query)
        .populate('references.expeditionId', 'reference clientName')
        .populate('assignedTo', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      InspectorCommunication.countDocuments(query)
    ]);

    return {
      communications,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Obtener comunicaciones pendientes
   */
  async getPending(userId = null) {
    return InspectorCommunication.findPending(userId)
      .populate('references.expeditionId', 'reference clientName')
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener alegaciones/recursos
   */
  async getAppeals(status = null) {
    return InspectorCommunication.findAppeals(status)
      .populate('references.expeditionId', 'reference clientName')
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener comunicaciones vencidas
   */
  async getOverdue() {
    return InspectorCommunication.findOverdue()
      .populate('assignedTo', 'name email');
  }

  /**
   * Añadir mensaje a comunicación
   */
  async addMessage(id, messageData, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    await communication.addMessage(messageData, userId);

    logger.info(`Mensaje añadido a comunicación: ${communication.communicationNumber}`);
    return communication;
  }

  /**
   * Añadir argumento a alegación/recurso
   */
  async addArgument(id, argumentData, userId) {
    const communication = await _loadOwnedComm(id, userId);

    await communication.addArgument(argumentData);
    return communication;
  }

  /**
   * Enviar comunicación
   */
  async submit(id, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    if (communication.status !== 'approved' && communication.status !== 'draft') {
      throw new Error('La comunicación debe estar aprobada o en borrador para enviar');
    }

    await communication.submit(userId);

    logger.info(`Comunicación enviada: ${communication.communicationNumber}`);
    return communication;
  }

  /**
   * Marcar como entregada
   */
  async markDelivered(id, confirmationNumber, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    await communication.markDelivered(confirmationNumber, userId);

    logger.info(`Comunicación entregada: ${communication.communicationNumber}`);
    return communication;
  }

  /**
   * Registrar respuesta recibida
   */
  async receiveResponse(id, responseData, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    await communication.receiveResponse(responseData, userId);

    logger.info(`Respuesta recibida para: ${communication.communicationNumber}`);
    return communication;
  }

  /**
   * Resolver comunicación
   */
  async resolve(id, resolutionData, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    await communication.resolve(resolutionData, userId);

    // Completar deadline asociado si existe
    const deadline = await Deadline.findOne({
      $or: [
        { 'references.requirementId': communication.references.requirementId },
        { title: { $regex: communication.communicationNumber } }
      ],
      status: { $nin: ['completed', 'cancelled'] }
    });

    if (deadline) {
      await deadline.complete(userId, `Comunicación resuelta: ${resolutionData.status}`);
    }

    logger.info(`Comunicación resuelta: ${communication.communicationNumber} - ${resolutionData.status}`);
    return communication;
  }

  /**
   * Archivar comunicación
   */
  async archive(id, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    await communication.archive(userId);

    logger.info(`Comunicación archivada: ${communication.communicationNumber}`);
    return communication;
  }

  /**
   * Actualizar estado
   */
  async updateStatus(id, status, notes = '', userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    communication.status = status;

    communication.timeline.push({
      action: 'status_updated',
      description: `Estado actualizado a: ${status}${notes ? ` - ${notes}` : ''}`,
      performedBy: userId
    });

    await communication.save();
    return communication;
  }

  /**
   * Aprobar comunicación para envío
   */
  async approve(id, userId = null) {
    const communication = await _loadOwnedComm(id, userId);

    communication.status = 'approved';
    communication.approvedBy = userId;

    communication.timeline.push({
      action: 'approved',
      description: 'Comunicación aprobada para envío',
      performedBy: userId
    });

    await communication.save();

    logger.info(`Comunicación aprobada: ${communication.communicationNumber}`);
    return communication;
  }

  /**
   * Obtener estadísticas
   */
  async getStats(filters = {}) {
    return InspectorCommunication.getStats(filters);
  }

  /**
   * Obtener resumen del dashboard
   */
  async getDashboard(userId = null) {
    const filters = userId ? { assignedTo: userId } : {};

    const [stats, pending, overdue, recentResolved] = await Promise.all([
      this.getStats(filters),
      this.getPending(userId),
      this.getOverdue(),
      InspectorCommunication.find({
        ...filters,
        status: 'resolved',
        'dates.resolvedAt': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).sort({ 'dates.resolvedAt': -1 }).limit(10)
    ]);

    return {
      stats,
      pending: pending.slice(0, 10),
      overdue: overdue.slice(0, 10),
      recentResolved,
      summary: {
        totalPending: stats.byStatus.draft || 0 +
                      stats.byStatus.pending_review || 0 +
                      stats.byStatus.approved || 0 +
                      stats.byStatus.awaiting_response || 0,
        overdue: stats.overdue,
        pendingResponse: stats.pendingResponse,
        totalAppeals: (stats.byCategory.appeal || 0)
      }
    };
  }

  /**
   * Generar borrador desde plantilla
   */
  generateDraft(communicationType, data = {}) {
    const template = TEMPLATES[communicationType];
    if (!template) {
      return {
        subject: data.subject || '',
        content: ''
      };
    }

    let subject = template.subject;
    let content = '';

    // Reemplazar variables en subject
    Object.entries(data).forEach(([key, value]) => {
      subject = subject.replace(`{${key}}`, value || '');
    });

    // Construir contenido
    content = `${template.opening}\n\n`;
    content += '[CONTENIDO DE LA COMUNICACIÓN]\n\n';
    content += template.closing;

    return {
      subject,
      content,
      template: communicationType
    };
  }

  /**
   * Obtener tipos de comunicación disponibles
   */
  getCommunicationTypes() {
    return Object.entries(COMMUNICATION_TYPES).map(([key, value]) => ({
      value: key,
      label: value.description,
      ...value
    }));
  }

  /**
   * Obtener autoridades
   */
  getAuthorities() {
    return Object.entries(AUTHORITIES).map(([key, value]) => ({
      code: key,
      ...value
    }));
  }

  /**
   * Obtener plantillas disponibles
   */
  getTemplates() {
    return Object.entries(TEMPLATES).map(([key, value]) => ({
      type: key,
      ...value
    }));
  }

  /**
   * Calcular plazo de recurso
   */
  calculateAppealDeadline(notificationDate, communicationType) {
    const config = COMMUNICATION_TYPES[communicationType];
    if (!config?.defaultDeadlineDays) return null;

    const deadline = new Date(notificationDate);
    deadline.setDate(deadline.getDate() + config.defaultDeadlineDays);

    // Ajustar si cae en fin de semana (siguiente día hábil)
    while (deadline.getDay() === 0 || deadline.getDay() === 6) {
      deadline.setDate(deadline.getDate() + 1);
    }

    return deadline;
  }

  /**
   * Verificar si está en plazo
   */
  isWithinDeadline(notificationDate, communicationType) {
    const deadline = this.calculateAppealDeadline(notificationDate, communicationType);
    if (!deadline) return true; // Sin deadline = siempre en plazo

    return new Date() <= deadline;
  }

  /**
   * Obtener información del servicio
   */
  getInfo() {
    return {
      service: 'Inspector Communication Service',
      version: '1.0.0',
      communicationTypes: Object.keys(COMMUNICATION_TYPES).length,
      authorities: Object.keys(AUTHORITIES).length,
      templates: Object.keys(TEMPLATES).length
    };
  }
}

module.exports = new InspectorCommunicationService();
