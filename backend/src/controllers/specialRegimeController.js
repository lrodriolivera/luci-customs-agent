/**
 * Special Regime Controller
 * Endpoints para gestion de regimenes aduaneros especiales
 */

const specialRegimeService = require('../services/specialRegimeService');

const specialRegimeController = {
  /**
   * POST /api/special-regimes
   * Crear nuevo regimen especial
   */
  async create(req, res) {
    try {
      const regime = await specialRegimeService.create(req.body, req.user._id);
      res.status(201).json({
        success: true,
        data: regime,
        message: 'Regimen especial creado correctamente'
      });
    } catch (error) {
      console.error('Error creating special regime:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/special-regimes
   * Listar regimenes especiales
   */
  async list(req, res) {
    try {
      const filters = {
        regimeCode: req.query.regimeCode,
        status: req.query.status,
        search: req.query.search
      };

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await specialRegimeService.list(req.user._id, filters, options);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error listing special regimes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/special-regimes/stats
   * Obtener estadisticas
   */
  async getStats(req, res) {
    try {
      const filters = {
        regimeCode: req.query.regimeCode,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const stats = await specialRegimeService.getStats(req.user._id, filters);
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting special regime stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/special-regimes/expiring
   * Obtener regimenes por expirar
   */
  async getExpiring(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const regimes = await specialRegimeService.getExpiringRegimes(req.user._id, days);
      res.json({
        success: true,
        data: regimes
      });
    } catch (error) {
      console.error('Error getting expiring regimes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * GET /api/special-regimes/:id
   * Obtener detalle de regimen
   */
  async getById(req, res) {
    try {
      const regime = await specialRegimeService.getById(req.params.id, req.user._id);
      res.json({
        success: true,
        data: regime
      });
    } catch (error) {
      console.error('Error getting special regime:', error);
      const status = error.message === 'Regimen no encontrado' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * PUT /api/special-regimes/:id
   * Actualizar regimen
   */
  async update(req, res) {
    try {
      const regime = await specialRegimeService.update(req.params.id, req.body, req.user._id);
      res.json({
        success: true,
        data: regime,
        message: 'Regimen actualizado correctamente'
      });
    } catch (error) {
      console.error('Error updating special regime:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/special-regimes/:id
   * Eliminar regimen (solo borradores)
   */
  async delete(req, res) {
    try {
      await specialRegimeService.delete(req.params.id, req.user._id);
      res.json({
        success: true,
        message: 'Regimen eliminado correctamente'
      });
    } catch (error) {
      console.error('Error deleting special regime:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/authorize
   * Autorizar regimen
   */
  async authorize(req, res) {
    try {
      const regime = await specialRegimeService.authorize(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: regime,
        message: 'Regimen autorizado correctamente'
      });
    } catch (error) {
      console.error('Error authorizing special regime:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/activate
   * Activar regimen
   */
  async activate(req, res) {
    try {
      const regime = await specialRegimeService.activate(req.params.id, req.user._id);
      res.json({
        success: true,
        data: regime,
        message: 'Regimen activado correctamente'
      });
    } catch (error) {
      console.error('Error activating special regime:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/link-guarantee
   * Vincular garantia
   */
  async linkGuarantee(req, res) {
    try {
      const { guaranteeId } = req.body;
      if (!guaranteeId) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere guaranteeId'
        });
      }

      const result = await specialRegimeService.linkGuarantee(
        req.params.id,
        guaranteeId,
        req.user._id
      );
      res.json({
        success: true,
        data: result,
        message: 'Garantia vinculada correctamente'
      });
    } catch (error) {
      console.error('Error linking guarantee:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/extension
   * Solicitar prorroga
   */
  async requestExtension(req, res) {
    try {
      const regime = await specialRegimeService.requestExtension(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: regime,
        message: 'Prorroga concedida correctamente'
      });
    } catch (error) {
      console.error('Error requesting extension:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/discharge
   * Ultimar regimen
   */
  async discharge(req, res) {
    try {
      const result = await specialRegimeService.discharge(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: result,
        message: 'Regimen ultimado correctamente'
      });
    } catch (error) {
      console.error('Error discharging special regime:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/goods
   * Anadir mercancia
   */
  async addGoods(req, res) {
    try {
      const regime = await specialRegimeService.addGoods(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: regime,
        message: 'Mercancia anadida correctamente'
      });
    } catch (error) {
      console.error('Error adding goods:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/:id/partial-exit
   * Registrar salida parcial (solo deposito)
   */
  async partialExit(req, res) {
    try {
      const regime = await specialRegimeService.partialExit(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: regime,
        message: 'Salida parcial registrada correctamente'
      });
    } catch (error) {
      console.error('Error recording partial exit:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * PUT /api/special-regimes/:id/transit-status
   * Actualizar estado de transito
   */
  async updateTransitStatus(req, res) {
    try {
      const regime = await specialRegimeService.updateTransitStatus(
        req.params.id,
        req.body,
        req.user._id
      );
      res.json({
        success: true,
        data: regime,
        message: 'Estado de transito actualizado'
      });
    } catch (error) {
      console.error('Error updating transit status:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  /**
   * POST /api/special-regimes/calculate-duties
   * Calcular derechos suspendidos (simulacion)
   */
  async calculateDuties(req, res) {
    try {
      const { goods, regimeCode } = req.body;

      if (!goods || !Array.isArray(goods) || !regimeCode) {
        return res.status(400).json({
          success: false,
          error: 'Se requieren goods (array) y regimeCode'
        });
      }

      const results = goods.map(good => ({
        ...good,
        suspendedDuties: specialRegimeService.calculateSuspendedDuties(good, regimeCode)
      }));

      const totals = results.reduce((acc, g) => ({
        customsValue: acc.customsValue + (g.customsValue || 0),
        tariff: acc.tariff + g.suspendedDuties.tariff,
        vat: acc.vat + g.suspendedDuties.vat,
        excise: acc.excise + g.suspendedDuties.excise,
        total: acc.total + g.suspendedDuties.total
      }), { customsValue: 0, tariff: 0, vat: 0, excise: 0, total: 0 });

      res.json({
        success: true,
        data: {
          goods: results,
          totals
        }
      });
    } catch (error) {
      console.error('Error calculating duties:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = specialRegimeController;
