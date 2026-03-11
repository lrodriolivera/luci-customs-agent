/**
 * Channel Routes
 * Rutas para gestion de circuitos de control aduanero
 */

const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { auth, requireRole } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(auth);

// GET /api/channels/config - Obtener configuracion de canales
router.get('/config', channelController.getChannelConfigs);

// GET /api/channels/stats - Estadisticas de canales
router.get('/stats', channelController.getChannelStats);

// GET /api/channels/expeditions - Expedientes con canal asignado
router.get('/expeditions', channelController.getChannelExpeditions);

// GET /api/channels/:expeditionId/status - Estado del canal de un expediente
router.get('/:expeditionId/status', channelController.getChannelStatus);

// GET /api/channels/:expeditionId/levante - Obtener documento de levante
router.get('/:expeditionId/levante', channelController.getLevante);

// POST /api/channels/:expeditionId/reevaluate - Reevaluar canal amarillo
router.post('/:expeditionId/reevaluate', requireRole('admin', 'agent'), channelController.reevaluateChannel);

// POST /api/channels/:expeditionId/process - Procesar canal manualmente
router.post('/:expeditionId/process', requireRole('admin'), channelController.processChannelManually);

module.exports = router;
