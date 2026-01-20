/**
 * Transit Routes (NCTS)
 * Rutas para gestion de operaciones de transito T1/T2/TIR
 */

const express = require('express');
const router = express.Router();
const transitController = require('../controllers/transitController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

// === RUTAS PRINCIPALES ===

// Listar transitos
router.get('/', transitController.list);

// Estadisticas
router.get('/stats', transitController.getStats);

// Transitos vencidos
router.get('/overdue', transitController.getOverdue);

// Crear nuevo transito
router.post('/', transitController.create);

// Obtener detalle
router.get('/:id', transitController.getById);

// Actualizar transito
router.put('/:id', transitController.update);

// Eliminar transito
router.delete('/:id', transitController.delete);

// === FLUJO NCTS ===

// Enviar declaracion a NCTS (IE015)
router.post('/:id/submit', transitController.submit);

// Liberar mercancias en partida (IE029)
router.post('/:id/release-departure', transitController.releaseAtDeparture);

// Iniciar transito
router.post('/:id/start', transitController.startTransit);

// Registrar paso por aduana de transito
router.post('/:id/transit-office', transitController.recordTransitOfficePassage);

// Notificar llegada a destino (IE160)
router.post('/:id/arrival', transitController.notifyArrival);

// Registrar resultado de control (IE143)
router.post('/:id/control', transitController.recordControlResult);

// Liberar mercancias en destino
router.post('/:id/release-goods', transitController.releaseGoods);

// Completar transito
router.post('/:id/complete', transitController.complete);

// === PROCEDIMIENTOS ESPECIALES ===

// Iniciar procedimiento de busqueda (IE118)
router.post('/:id/enquiry', transitController.initiateEnquiry);

module.exports = router;
