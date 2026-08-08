/**
 * Transit Controller (NCTS)
 * Endpoints para gestion de operaciones de transito T1/T2/TIR
 */

const transitService = require('../services/transitService');
const aiService = require('../services/aiService');
const { Transit, Expedition } = require('../models');
const { ensureSameTenant } = require('../utils/tenantGuard');

const transitController = {
  /**
   * POST /api/transit
   * Crear nuevo transito
   */
  async create(req, res) {
    try {
      const transit = await transitService.create(req.body, req.user._id);
      res.status(201).json({
        success: true,
        data: transit,
        message: 'Transito creado correctamente'
      });
    } catch (error) {
      console.error('Error creating transit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/transit
   * Listar transitos
   */
  async list(req, res) {
    try {
      const filters = {
        transitType: req.query.transitType,
        status: req.query.status,
        search: req.query.search
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await transitService.list(req.user._id, filters, options);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error listing transits:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/transit/stats
   * Obtener estadisticas
   */
  async getStats(req, res) {
    try {
      const filters = {
        transitType: req.query.transitType,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const stats = await transitService.getStats(req.user._id, filters);
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting transit stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/transit/overdue
   * Obtener transitos vencidos
   */
  async getOverdue(req, res) {
    try {
      const transits = await transitService.getOverdue(req.user._id);
      res.json({
        success: true,
        data: transits
      });
    } catch (error) {
      console.error('Error getting overdue transits:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/transit/:id
   * Obtener detalle de transito
   */
  async getById(req, res) {
    try {
      const transit = await transitService.getById(req.params.id, req.user._id);
      res.json({
        success: true,
        data: transit
      });
    } catch (error) {
      console.error('Error getting transit:', error);
      const status = error.message === 'Transito no encontrado' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * PUT /api/transit/:id
   * Actualizar transito
   */
  async update(req, res) {
    try {
      const transit = await transitService.update(req.params.id, req.body, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Transito actualizado correctamente'
      });
    } catch (error) {
      console.error('Error updating transit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/transit/:id
   * Eliminar transito (solo borradores)
   */
  async delete(req, res) {
    try {
      await transitService.delete(req.params.id, req.user._id);
      res.json({
        success: true,
        message: 'Transito eliminado correctamente'
      });
    } catch (error) {
      console.error('Error deleting transit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/submit
   * Enviar declaracion a NCTS
   */
  async submit(req, res) {
    try {
      const transit = await transitService.submit(req.params.id, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: `Declaracion enviada. MRN asignado: ${transit.mrn}`
      });
    } catch (error) {
      console.error('Error submitting transit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/release-departure
   * Liberar mercancias en aduana de partida
   */
  async releaseAtDeparture(req, res) {
    try {
      const transit = await transitService.releaseAtDeparture(req.params.id, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Mercancias liberadas en aduana de partida'
      });
    } catch (error) {
      console.error('Error releasing at departure:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/start
   * Iniciar transito
   */
  async startTransit(req, res) {
    try {
      const transit = await transitService.startTransit(req.params.id, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Transito iniciado'
      });
    } catch (error) {
      console.error('Error starting transit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/arrival
   * Notificar llegada a destino (CC007). El servicio envia el mensaje a AEAT y
   * solo cambia el estado si lo acepta, asi que un rechazo llega aqui como error.
   */
  async notifyArrival(req, res) {
    try {
      const transit = await transitService.notifyArrival(req.params.id, req.body, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Llegada notificada correctamente'
      });
    } catch (error) {
      console.error('Error notifying arrival:', error);
      const status = error.message === 'Transito no encontrado' ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/unloading
   * Notificar resultado de la descarga en destino (CC044).
   */
  async notifyUnloading(req, res) {
    try {
      const transit = await transitService.notifyUnloading(req.params.id, req.body, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Descarga notificada correctamente'
      });
    } catch (error) {
      console.error('Error notifying unloading:', error);
      const status = error.message === 'Transito no encontrado' ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/control
   * Registrar resultado de control
   */
  async recordControlResult(req, res) {
    try {
      const transit = await transitService.recordControlResult(req.params.id, req.body, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Resultado de control registrado'
      });
    } catch (error) {
      console.error('Error recording control result:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/release-goods
   * Liberar mercancias en destino
   */
  async releaseGoods(req, res) {
    try {
      const transit = await transitService.releaseGoods(req.params.id, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Mercancias liberadas en destino'
      });
    } catch (error) {
      console.error('Error releasing goods:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/complete
   * Completar transito
   */
  async complete(req, res) {
    try {
      const transit = await transitService.complete(req.params.id, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Transito completado'
      });
    } catch (error) {
      console.error('Error completing transit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/enquiry
   * Iniciar procedimiento de busqueda
   */
  async initiateEnquiry(req, res) {
    try {
      const transit = await transitService.initiateEnquiry(req.params.id, req.body, req.user._id);
      res.json({
        success: true,
        data: transit,
        message: 'Procedimiento de busqueda iniciado'
      });
    } catch (error) {
      console.error('Error initiating enquiry:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/transit-office
   * Registrar paso por aduana de transito
   */
  async recordTransitOfficePassage(req, res) {
    try {
      const transit = await transitService.recordTransitOfficePassage(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: transit,
        message: 'Paso por aduana registrado'
      });
    } catch (error) {
      console.error('Error recording transit office passage:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  // ===========================================
  // AI ENDPOINTS - LUCI Integration
  // ===========================================

  /**
   * POST /api/transit/ai/auto-complete
   * Auto-completar datos de tránsito desde expediente
   */
  async aiAutoComplete(req, res) {
    try {
      const { transitDraft, expeditionId } = req.body;

      // Obtener expediente si se proporciona
      let expedition = null;
      if (expeditionId) {
        expedition = await Expedition.findOne({
          _id: expeditionId,
          owner: req.user._id
        });
      }

      // Obtener tránsitos anteriores similares
      const previousTransits = await Transit.find({
        owner: req.user._id,
        status: 'completed'
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('transitType route departureOffice destinationOffice transitOffices guarantee');

      const result = await aiService.autoCompleteTransitData(
        transitDraft || {},
        expedition,
        previousTransits
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in AI auto-complete:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/ai/validate-route
   * Validar y optimizar ruta de tránsito
   */
  async aiValidateRoute(req, res) {
    try {
      const transit = await Transit.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!ensureSameTenant(transit, req, res, { resource: 'Tránsito' })) return;

      const result = await aiService.validateTransitRoute(transit);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in AI route validation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/ai/predict-incidents
   * Predecir incidencias potenciales
   */
  async aiPredictIncidents(req, res) {
    try {
      const transit = await Transit.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!ensureSameTenant(transit, req, res, { resource: 'Tránsito' })) return;

      // Obtener datos históricos
      const completedTransits = await Transit.find({
        owner: req.user._id,
        status: 'completed',
        'route.countries': { $in: transit.route?.countries || [] }
      }).select('controlResult enquiry status');

      const historicalData = {
        similarTransits: completedTransits.length,
        incidentRate: completedTransits.filter(t =>
          t.controlResult?.discrepancies?.length > 0 || t.enquiry?.initiated
        ).length / Math.max(completedTransits.length, 1) * 100,
        commonIncidents: []
      };

      const result = await aiService.predictTransitIncidents(transit, historicalData);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in AI incident prediction:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/ai/suggest-guarantee
   * Sugerir garantía óptima para tránsito
   */
  async aiSuggestGuarantee(req, res) {
    try {
      const transit = await Transit.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!ensureSameTenant(transit, req, res, { resource: 'Tránsito' })) return;

      // Construir perfil del operador
      const operatorProfile = {
        eori: req.user.eori || transit.principal?.eori,
        oeaStatus: req.user.oeaStatus || 'none',
        oeaType: req.user.oeaType,
        hasGlobalGuarantee: req.user.hasGlobalGuarantee || false,
        grn: req.user.grn,
        availableAmount: req.user.guaranteeAvailable
      };

      const result = await aiService.suggestTransitGuarantee(transit, operatorProfile);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in AI guarantee suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/ai/full-analysis
   * Análisis completo de tránsito
   */
  async aiFullAnalysis(req, res) {
    try {
      const transit = await Transit.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!ensureSameTenant(transit, req, res, { resource: 'Tránsito' })) return;

      // Obtener expediente relacionado
      let expedition = null;
      if (transit.expeditionId) {
        expedition = await Expedition.findById(transit.expeditionId);
      }

      // Perfil del operador
      const operatorProfile = {
        eori: req.user.eori || transit.principal?.eori,
        oeaStatus: req.user.oeaStatus || 'none',
        oeaType: req.user.oeaType,
        hasGlobalGuarantee: req.user.hasGlobalGuarantee || false,
        grn: req.user.grn,
        availableAmount: req.user.guaranteeAvailable
      };

      // Datos históricos
      const completedTransits = await Transit.find({
        owner: req.user._id,
        status: 'completed'
      }).select('controlResult enquiry');

      const historicalData = {
        similarTransits: completedTransits.length,
        incidentRate: completedTransits.filter(t =>
          t.controlResult?.discrepancies?.length > 0 || t.enquiry?.initiated
        ).length / Math.max(completedTransits.length, 1) * 100
      };

      const result = await aiService.fullTransitAnalysis(
        transit,
        expedition,
        operatorProfile,
        historicalData
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in AI full transit analysis:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/transit/:id/ai/apply-suggestion
   * Aplicar sugerencia de auto-completado
   */
  async aiApplySuggestion(req, res) {
    try {
      const { suggestedData } = req.body;

      if (!suggestedData) {
        return res.status(400).json({
          success: false,
          error: 'suggestedData es requerido'
        });
      }

      const transit = await Transit.findOne({
        _id: req.params.id,
        owner: req.user._id
      });

      if (!ensureSameTenant(transit, req, res, { resource: 'Tránsito' })) return;

      if (transit.status !== 'draft') {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden aplicar sugerencias a tránsitos en borrador'
        });
      }

      // Aplicar datos sugeridos
      const fieldsToApply = [
        'transitType', 'principal', 'departureOffice', 'destinationOffice',
        'transitOffices', 'route', 'guarantee', 'goodsItems'
      ];

      for (const field of fieldsToApply) {
        if (suggestedData[field] !== undefined) {
          transit[field] = suggestedData[field];
        }
      }

      // Aplicar deadline si se sugirió
      if (suggestedData.estimatedDeadline) {
        transit.deadlines = transit.deadlines || {};
        transit.deadlines.arrivalDeadline = new Date(suggestedData.estimatedDeadline);
      }

      await transit.save();

      res.json({
        success: true,
        data: transit,
        message: 'Sugerencias aplicadas correctamente'
      });

    } catch (error) {
      console.error('Error applying AI suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = transitController;
