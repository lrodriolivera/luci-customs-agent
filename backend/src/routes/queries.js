/**
 * Query Routes
 * Rutas para servicios de consulta ADDS-JDIT de AEAT
 */
const express = require('express');
const router = express.Router();
const summaryQueryController = require('../controllers/summaryQueryController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

// Servicios y estadisticas
router.get('/services', summaryQueryController.getServices);
router.get('/stats', summaryQueryController.getStats);

// Historial
router.get('/history', summaryQueryController.getHistory);

// Consultas por tipo
router.post('/bill-of-lading', summaryQueryController.queryByBillOfLading);
router.post('/awb', summaryQueryController.queryByAWB);
router.post('/container', summaryQueryController.queryByContainer);
router.post('/location', summaryQueryController.queryByLocation);
router.post('/documents', summaryQueryController.queryDocuments);
router.post('/mrn', summaryQueryController.queryByMRN);
router.post('/eori', summaryQueryController.queryByEORI);

// Obtener resultado de consulta
router.get('/:id', summaryQueryController.getQuery);

module.exports = router;
