/**
 * Deadline Controller
 * Controlador para gestión de plazos y alertas
 */

const deadlineService = require('../services/deadlineService');
const logger = require('../config/logger');

const deadlineController = {
  /**
   * Listar deadlines con filtros
   * GET /api/deadlines
   */
  async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        deadlineType,
        assignedTo,
        sortBy = 'dueDate',
        sortOrder = 'asc'
      } = req.query;

      const filters = {};
      // El tenant sale SIEMPRE del token, nunca de req.query: el resto de este
      // filtro lo construye el cliente y seria trivial de suplantar.
      if (req.user?.tenantId) filters.tenantId = req.user.tenantId;
      if (status) filters.status = status;
      if (category) filters.category = category;
      if (deadlineType) filters.deadlineType = deadlineType;
      if (assignedTo) filters.assignedTo = assignedTo;

      const result = await deadlineService.list(filters, {
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
      logger.error('Error listando deadlines:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener deadline por ID
   * GET /api/deadlines/:id
   */
  async getById(req, res) {
    try {
      const deadline = await deadlineService.getById(req.params.id);

      if (!deadline) {
        return res.status(404).json({
          success: false,
          error: 'Deadline no encontrado'
        });
      }

      res.json({
        success: true,
        data: deadline
      });
    } catch (error) {
      logger.error('Error obteniendo deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Crear nuevo deadline
   * POST /api/deadlines
   */
  async create(req, res) {
    try {
      const userId = req.user?.id;
      const deadline = await deadlineService.create(req.body, userId);

      res.status(201).json({
        success: true,
        data: deadline
      });
    } catch (error) {
      logger.error('Error creando deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Actualizar deadline
   * PUT /api/deadlines/:id
   */
  async update(req, res) {
    try {
      const userId = req.user?.id;
      const deadline = await deadlineService.update(req.params.id, req.body, userId);

      res.json({
        success: true,
        data: deadline
      });
    } catch (error) {
      logger.error('Error actualizando deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Completar deadline
   * POST /api/deadlines/:id/complete
   */
  async complete(req, res) {
    try {
      const userId = req.user?.id;
      const { notes } = req.body;
      const deadline = await deadlineService.complete(req.params.id, notes, userId);

      res.json({
        success: true,
        data: deadline
      });
    } catch (error) {
      logger.error('Error completando deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Extender plazo
   * POST /api/deadlines/:id/extend
   */
  async extend(req, res) {
    try {
      const userId = req.user?.id;
      const { newDate, reason } = req.body;

      if (!newDate || !reason) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere nueva fecha y motivo'
        });
      }

      const deadline = await deadlineService.extend(req.params.id, newDate, reason, userId);

      res.json({
        success: true,
        data: deadline
      });
    } catch (error) {
      logger.error('Error extendiendo deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Cancelar deadline
   * POST /api/deadlines/:id/cancel
   */
  async cancel(req, res) {
    try {
      const userId = req.user?.id;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere motivo de cancelación'
        });
      }

      const deadline = await deadlineService.cancel(req.params.id, reason, userId);

      res.json({
        success: true,
        data: deadline
      });
    } catch (error) {
      logger.error('Error cancelando deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Eliminar deadline
   * DELETE /api/deadlines/:id
   */
  async delete(req, res) {
    try {
      await deadlineService.delete(req.params.id);

      res.json({
        success: true,
        message: 'Deadline eliminado'
      });
    } catch (error) {
      logger.error('Error eliminando deadline:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener deadlines pendientes
   * GET /api/deadlines/pending
   */
  async getPending(req, res) {
    try {
      const filters = {};
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;

      const deadlines = await deadlineService.getPending(filters);

      res.json({
        success: true,
        data: deadlines
      });
    } catch (error) {
      logger.error('Error obteniendo deadlines pendientes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener deadlines vencidos
   * GET /api/deadlines/overdue
   */
  async getOverdue(req, res) {
    try {
      const deadlines = await deadlineService.getOverdue();

      res.json({
        success: true,
        data: deadlines
      });
    } catch (error) {
      logger.error('Error obteniendo deadlines vencidos:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener deadlines urgentes
   * GET /api/deadlines/urgent
   */
  async getUrgent(req, res) {
    try {
      const hoursThreshold = parseInt(req.query.hours) || 48;
      const deadlines = await deadlineService.getUrgent(hoursThreshold);

      res.json({
        success: true,
        data: deadlines
      });
    } catch (error) {
      logger.error('Error obteniendo deadlines urgentes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener vista de calendario
   * GET /api/deadlines/calendar
   */
  async getCalendar(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere startDate y endDate'
        });
      }

      const result = await deadlineService.getCalendarView(
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error obteniendo calendario:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener dashboard de deadlines
   * GET /api/deadlines/dashboard
   */
  async getDashboard(req, res) {
    try {
      const userId = req.query.userId || req.user?.id;
      const dashboard = await deadlineService.getDashboard(userId);

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
   * GET /api/deadlines/stats
   */
  async getStats(req, res) {
    try {
      const filters = {};
      if (req.query.category) filters.category = req.query.category;
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;

      const stats = await deadlineService.getStats(filters);

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
   * Obtener tipos de deadline
   * GET /api/deadlines/types
   */
  async getTypes(req, res) {
    try {
      const types = deadlineService.getDeadlineTypes();

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
   * Obtener categorías
   * GET /api/deadlines/categories
   */
  async getCategories(req, res) {
    try {
      const categories = deadlineService.getCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Error obteniendo categorías:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Procesar alertas pendientes
   * POST /api/deadlines/process-alerts
   */
  async processAlerts(req, res) {
    try {
      const result = await deadlineService.processAlerts();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error procesando alertas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Sincronizar deadlines
   * POST /api/deadlines/sync
   */
  async sync(req, res) {
    try {
      const result = await deadlineService.syncAll();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error sincronizando deadlines:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener información del servicio
   * GET /api/deadlines/info
   */
  async getInfo(req, res) {
    try {
      const info = deadlineService.getInfo();

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

module.exports = deadlineController;
