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

/**
 * @openapi
 * /api/channels/stats:
 *   get:
 *     tags: [expeditions]
 *     summary: Estadísticas de canales (verde/naranja/rojo) del tenant
 * /api/channels/expeditions:
 *   get:
 *     tags: [expeditions]
 *     summary: Expedientes con canal asignado (incluye H7)
 * /api/channels/{expeditionId}/status:
 *   get:
 *     tags: [expeditions]
 *     summary: Estado detallado del canal de un expediente
 *     parameters:
 *       - { in: path, name: expeditionId, required: true, schema: { type: string } }
 * /api/channels/{expeditionId}/levante:
 *   get:
 *     tags: [expeditions]
 *     summary: Documento de levante (canal verde)
 * /api/channels/{expeditionId}/reevaluate:
 *   post:
 *     tags: [expeditions]
 *     summary: Reevaluar canal amarillo (admin/agent)
 */
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
