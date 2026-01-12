/**
 * H7 Routes
 * Rutas para declaraciones H7 (e-commerce bajo valor <= 150 EUR)
 */
const express = require('express');
const router = express.Router();
const h7Controller = require('../controllers/h7Controller');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

// Estadisticas
router.get('/stats', h7Controller.getStats);

// Validaciones
router.post('/validate', h7Controller.validate);
router.get('/validate-ioss/:iossNumber', h7Controller.validateIOSS);

// Calcular derechos (sin guardar)
router.post('/calculate-duties', h7Controller.calculateDuties);

// Procesamiento masivo
router.post('/batch', h7Controller.processBatch);
router.post('/import-csv', h7Controller.importCSV);

// Crear desde expediente
router.post('/from-expedition/:expeditionId', h7Controller.createFromExpedition);

// CRUD
router.get('/', h7Controller.list);
router.post('/', h7Controller.create);
router.get('/:id', h7Controller.get);
router.put('/:id', h7Controller.update);

// Acciones
router.post('/:id/submit', h7Controller.submit);
router.post('/:id/cancel', h7Controller.cancel);
router.post('/:id/document', h7Controller.addDocument);

// Verificaciones
router.get('/:id/fraud-check', h7Controller.fraudCheck);

module.exports = router;
