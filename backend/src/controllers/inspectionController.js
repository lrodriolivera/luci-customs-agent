/**
 * Inspection Controller
 * Controlador para coordinación de inspecciones
 */

const inspectionService = require('../services/inspectionService');
const logger = require('../config/logger');

const inspectionController = {
  /**
   * Listar inspecciones con filtros
   * GET /api/inspections
   */
  async list(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        inspectionType,
        authorityType,
        assignedTo,
        sortBy = 'scheduling.scheduledDate',
        sortOrder = 'asc'
      } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (inspectionType) filters.inspectionType = inspectionType;
      if (authorityType) filters['authority.type'] = authorityType;
      if (assignedTo) filters.assignedTo = assignedTo;

      const result = await inspectionService.list(filters, {
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
      logger.error('Error listando inspecciones:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener inspección por ID
   * GET /api/inspections/:id
   */
  async getById(req, res) {
    try {
      const inspection = await inspectionService.getById(req.params.id);

      if (!inspection) {
        return res.status(404).json({
          success: false,
          error: 'Inspección no encontrada'
        });
      }

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error obteniendo inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Crear nueva inspección
   * POST /api/inspections
   */
  async create(req, res) {
    try {
      const userId = req.user?.id;
      const inspection = await inspectionService.create(req.body, userId);

      res.status(201).json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error creando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Programar inspección
   * POST /api/inspections/:id/schedule
   */
  async schedule(req, res) {
    try {
      const userId = req.user?.id;
      const inspection = await inspectionService.schedule(req.params.id, req.body, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error programando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Confirmar inspección
   * POST /api/inspections/:id/confirm
   */
  async confirm(req, res) {
    try {
      const userId = req.user?.id;
      const { confirmationNumber } = req.body;

      if (!confirmationNumber) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere número de confirmación'
        });
      }

      const inspection = await inspectionService.confirm(req.params.id, confirmationNumber, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error confirmando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Iniciar inspección
   * POST /api/inspections/:id/start
   */
  async start(req, res) {
    try {
      const userId = req.user?.id;
      const inspection = await inspectionService.start(req.params.id, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error iniciando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Completar inspección
   * POST /api/inspections/:id/complete
   */
  async complete(req, res) {
    try {
      const userId = req.user?.id;
      const inspection = await inspectionService.complete(req.params.id, req.body, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error completando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir participante
   * POST /api/inspections/:id/participants
   */
  async addParticipant(req, res) {
    try {
      const inspection = await inspectionService.addParticipant(req.params.id, req.body);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error añadiendo participante:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir evidencia
   * POST /api/inspections/:id/evidence
   */
  async addEvidence(req, res) {
    try {
      const inspection = await inspectionService.addEvidence(req.params.id, req.body);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error añadiendo evidencia:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir item inspeccionado
   * POST /api/inspections/:id/items
   */
  async addItem(req, res) {
    try {
      const inspection = await inspectionService.addInspectedItem(req.params.id, req.body);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error añadiendo item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Registrar hallazgo
   * POST /api/inspections/:id/findings
   */
  async registerFinding(req, res) {
    try {
      const userId = req.user?.id;
      const inspection = await inspectionService.registerFinding(req.params.id, req.body, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error registrando hallazgo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir muestra
   * POST /api/inspections/:id/samples
   */
  async addSample(req, res) {
    try {
      const inspection = await inspectionService.addSample(req.params.id, req.body);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error añadiendo muestra:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Actualizar resultado de muestra
   * PUT /api/inspections/:id/samples/:sampleId
   */
  async updateSampleResult(req, res) {
    try {
      const inspection = await inspectionService.updateSampleResult(
        req.params.id,
        req.params.sampleId,
        req.body
      );

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error actualizando muestra:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Generar acta de inspección
   * POST /api/inspections/:id/report
   */
  async generateReport(req, res) {
    try {
      const userId = req.user?.id;
      const inspection = await inspectionService.generateReport(req.params.id, req.body, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error generando acta:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Añadir acción resultante
   * POST /api/inspections/:id/actions
   */
  async addAction(req, res) {
    try {
      const inspection = await inspectionService.addResultingAction(req.params.id, req.body);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error añadiendo acción:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Cancelar inspección
   * POST /api/inspections/:id/cancel
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

      const inspection = await inspectionService.cancel(req.params.id, reason, userId);

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error cancelando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Reprogramar inspección
   * POST /api/inspections/:id/reschedule
   */
  async reschedule(req, res) {
    try {
      const userId = req.user?.id;
      const { reason, ...schedulingData } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere motivo de reprogramación'
        });
      }

      const inspection = await inspectionService.reschedule(
        req.params.id,
        schedulingData,
        reason,
        userId
      );

      res.json({
        success: true,
        data: inspection
      });
    } catch (error) {
      logger.error('Error reprogramando inspección:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener inspecciones programadas para hoy
   * GET /api/inspections/today
   */
  async getToday(req, res) {
    try {
      const inspections = await inspectionService.getToday();

      res.json({
        success: true,
        data: inspections
      });
    } catch (error) {
      logger.error('Error obteniendo inspecciones de hoy:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener inspecciones pendientes
   * GET /api/inspections/pending
   */
  async getPending(req, res) {
    try {
      const userId = req.query.userId || req.user?.id;
      const inspections = await inspectionService.getPending(userId);

      res.json({
        success: true,
        data: inspections
      });
    } catch (error) {
      logger.error('Error obteniendo inspecciones pendientes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener calendario de inspecciones
   * GET /api/inspections/calendar
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

      const result = await inspectionService.getCalendar(
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
   * Obtener dashboard
   * GET /api/inspections/dashboard
   */
  async getDashboard(req, res) {
    try {
      const userId = req.query.userId || req.user?.id;
      const dashboard = await inspectionService.getDashboard(userId);

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
   * GET /api/inspections/stats
   */
  async getStats(req, res) {
    try {
      const filters = {};
      if (req.query.inspectionType) filters.inspectionType = req.query.inspectionType;
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;

      const stats = await inspectionService.getStats(filters);

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
   * Obtener tipos de inspección
   * GET /api/inspections/types
   */
  async getTypes(req, res) {
    try {
      const types = inspectionService.getInspectionTypes();

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
   * Obtener ubicaciones
   * GET /api/inspections/locations
   */
  async getLocations(req, res) {
    try {
      const locations = inspectionService.getLocations();

      res.json({
        success: true,
        data: locations
      });
    } catch (error) {
      logger.error('Error obteniendo ubicaciones:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener resultados posibles
   * GET /api/inspections/results
   */
  async getResults(req, res) {
    try {
      const results = inspectionService.getInspectionResults();

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error obteniendo resultados:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener checklist de inspección
   * GET /api/inspections/checklist/:type
   */
  async getChecklist(req, res) {
    try {
      const checklist = inspectionService.getInspectionChecklist(req.params.type);

      res.json({
        success: true,
        data: checklist
      });
    } catch (error) {
      logger.error('Error obteniendo checklist:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * Obtener información del servicio
   * GET /api/inspections/info
   */
  async getInfo(req, res) {
    try {
      const info = inspectionService.getInfo();

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

module.exports = inspectionController;
