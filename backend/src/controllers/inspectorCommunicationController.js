/**
 * Inspector Communication Controller
 * Controlador para comunicaciones con inspectores y autoridades
 */

const inspectorCommunicationService = require('../services/inspectorCommunicationService');
const logger = require('../config/logger');

const inspectorCommunicationController = {
  /**
   * Listar comunicaciones con filtros
   * GET /api/communications
   */
  async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        communicationType,
        category,
        authorityType,
        assignedTo,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (communicationType) filters.communicationType = communicationType;
      if (category) filters.category = category;
      if (authorityType) filters['authority.type'] = authorityType;
      if (assignedTo) filters.assignedTo = assignedTo;

      const result = await inspectorCommunicationService.list(filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error listando comunicaciones:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener comunicación por ID
   * GET /api/communications/:id
   */
  async getById(req, res) {
    try {
      const communication = await inspectorCommunicationService.getById(req.params.id);

      if (!communication) {
        return res.status(404).json({
          success: false,
          error: 'Comunicación no encontrada'
        });
      }

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error obteniendo comunicación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Crear nueva comunicación
   * POST /api/communications
   */
  async create(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.create(req.body, userId);

      res.status(201).json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error creando comunicación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Crear alegación
   * POST /api/communications/allegation
   */
  async createAllegation(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.createAllegation(req.body, userId);

      res.status(201).json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error creando alegación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Crear recurso de reposición
   * POST /api/communications/administrative-appeal
   */
  async createAdministrativeAppeal(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.createAdministrativeAppeal(req.body, userId);

      res.status(201).json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error creando recurso de reposición:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Crear reclamación económico-administrativa
   * POST /api/communications/economic-appeal
   */
  async createEconomicAppeal(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.createEconomicAppeal(req.body, userId);

      res.status(201).json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error creando reclamación económico-administrativa:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir mensaje a comunicación
   * POST /api/communications/:id/messages
   */
  async addMessage(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.addMessage(
        req.params.id,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error añadiendo mensaje:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir argumento
   * POST /api/communications/:id/arguments
   */
  async addArgument(req, res) {
    try {
      const communication = await inspectorCommunicationService.addArgument(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error añadiendo argumento:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Aprobar comunicación para envío
   * POST /api/communications/:id/approve
   */
  async approve(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.approve(req.params.id, userId);

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error aprobando comunicación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Enviar comunicación
   * POST /api/communications/:id/submit
   */
  async submit(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.submit(req.params.id, userId);

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error enviando comunicación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Marcar como entregada
   * POST /api/communications/:id/delivered
   */
  async markDelivered(req, res) {
    try {
      const userId = req.user?.id;
      const { confirmationNumber } = req.body;

      if (!confirmationNumber) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere número de confirmación'
        });
      }

      const communication = await inspectorCommunicationService.markDelivered(
        req.params.id,
        confirmationNumber,
        userId
      );

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error marcando como entregada:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Registrar respuesta recibida
   * POST /api/communications/:id/response
   */
  async receiveResponse(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.receiveResponse(
        req.params.id,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error registrando respuesta:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Resolver comunicación
   * POST /api/communications/:id/resolve
   */
  async resolve(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.resolve(
        req.params.id,
        req.body,
        userId
      );

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error resolviendo comunicación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Actualizar estado
   * PUT /api/communications/:id/status
   */
  async updateStatus(req, res) {
    try {
      const userId = req.user?.id;
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere nuevo estado'
        });
      }

      const communication = await inspectorCommunicationService.updateStatus(
        req.params.id,
        status,
        notes,
        userId
      );

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error actualizando estado:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Archivar comunicación
   * POST /api/communications/:id/archive
   */
  async archive(req, res) {
    try {
      const userId = req.user?.id;
      const communication = await inspectorCommunicationService.archive(req.params.id, userId);

      res.json({
        success: true,
        data: communication
      });
    } catch (error) {
      logger.error('Error archivando comunicación:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener comunicaciones pendientes
   * GET /api/communications/pending
   */
  async getPending(req, res) {
    try {
      const userId = req.query.userId || req.user?.id;
      const communications = await inspectorCommunicationService.getPending(userId);

      res.json({
        success: true,
        data: communications
      });
    } catch (error) {
      logger.error('Error obteniendo comunicaciones pendientes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener alegaciones/recursos
   * GET /api/communications/appeals
   */
  async getAppeals(req, res) {
    try {
      const { status } = req.query;
      const communications = await inspectorCommunicationService.getAppeals(status);

      res.json({
        success: true,
        data: communications
      });
    } catch (error) {
      logger.error('Error obteniendo alegaciones:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener comunicaciones vencidas
   * GET /api/communications/overdue
   */
  async getOverdue(req, res) {
    try {
      const communications = await inspectorCommunicationService.getOverdue();

      res.json({
        success: true,
        data: communications
      });
    } catch (error) {
      logger.error('Error obteniendo comunicaciones vencidas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener dashboard
   * GET /api/communications/dashboard
   */
  async getDashboard(req, res) {
    try {
      const userId = req.query.userId || req.user?.id;
      const dashboard = await inspectorCommunicationService.getDashboard(userId);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error obteniendo dashboard:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener estadísticas
   * GET /api/communications/stats
   */
  async getStats(req, res) {
    try {
      const filters = {};
      if (req.query.category) filters.category = req.query.category;
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;

      const stats = await inspectorCommunicationService.getStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Generar borrador desde plantilla
   * POST /api/communications/draft
   */
  async generateDraft(req, res) {
    try {
      const { communicationType, ...data } = req.body;

      if (!communicationType) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere tipo de comunicación'
        });
      }

      const draft = inspectorCommunicationService.generateDraft(communicationType, data);

      res.json({
        success: true,
        data: draft
      });
    } catch (error) {
      logger.error('Error generando borrador:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Calcular plazo de recurso
   * POST /api/communications/calculate-deadline
   */
  async calculateDeadline(req, res) {
    try {
      const { notificationDate, communicationType } = req.body;

      if (!notificationDate || !communicationType) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere fecha de notificación y tipo de comunicación'
        });
      }

      const deadline = inspectorCommunicationService.calculateAppealDeadline(
        new Date(notificationDate),
        communicationType
      );

      const isWithinDeadline = inspectorCommunicationService.isWithinDeadline(
        new Date(notificationDate),
        communicationType
      );

      res.json({
        success: true,
        data: {
          deadline,
          isWithinDeadline,
          daysRemaining: deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null
        }
      });
    } catch (error) {
      logger.error('Error calculando plazo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener tipos de comunicación
   * GET /api/communications/types
   */
  async getTypes(req, res) {
    try {
      const types = inspectorCommunicationService.getCommunicationTypes();

      res.json({
        success: true,
        data: types
      });
    } catch (error) {
      logger.error('Error obteniendo tipos:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener autoridades
   * GET /api/communications/authorities
   */
  async getAuthorities(req, res) {
    try {
      const authorities = inspectorCommunicationService.getAuthorities();

      res.json({
        success: true,
        data: authorities
      });
    } catch (error) {
      logger.error('Error obteniendo autoridades:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener plantillas
   * GET /api/communications/templates
   */
  async getTemplates(req, res) {
    try {
      const templates = inspectorCommunicationService.getTemplates();

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error obteniendo plantillas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener información del servicio
   * GET /api/communications/info
   */
  async getInfo(req, res) {
    try {
      const info = inspectorCommunicationService.getInfo();

      res.json({
        success: true,
        data: info
      });
    } catch (error) {
      logger.error('Error obteniendo info:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = inspectorCommunicationController;
