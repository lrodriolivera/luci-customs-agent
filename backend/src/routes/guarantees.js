/**
 * Guarantee Routes
 * Rutas para gestion de garantias aduaneras
 */
const express = require('express');
const router = express.Router();
const guaranteeController = require('../controllers/guaranteeController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

// Estadisticas y alertas
router.get('/stats', guaranteeController.getStats);
router.get('/alerts', guaranteeController.getAlerts);
router.get('/report', guaranteeController.generateReport);

// Calcular garantia requerida
router.post('/calculate', guaranteeController.calculate);

// Buscar garantia adecuada
router.get('/find-suitable', guaranteeController.findSuitable);

// CRUD
router.get('/', guaranteeController.list);
router.post('/', guaranteeController.create);
router.get('/:id', guaranteeController.get);
router.put('/:id', guaranteeController.update);

// Movimientos
router.get('/:id/movements', guaranteeController.getMovements);

// Acciones de estado
router.post('/:id/activate', guaranteeController.activate);
router.post('/:id/renew', guaranteeController.renew);
router.post('/:id/suspend', guaranteeController.suspend);
router.post('/:id/cancel', guaranteeController.cancel);

// Consumo y liberacion
router.post('/:id/consume', guaranteeController.consume);
router.post('/:id/release', guaranteeController.release);

// Vinculacion con expedientes
router.post('/:id/link-expedition', guaranteeController.linkExpedition);
router.post('/:id/release-expedition', guaranteeController.releaseExpedition);

// Documentos
router.post('/:id/document', guaranteeController.addDocument);

// Alertas
router.post('/:id/alerts/:alertId/acknowledge', guaranteeController.acknowledgeAlert);

module.exports = router;
