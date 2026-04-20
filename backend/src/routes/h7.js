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

/**
 * @openapi
 * /api/h7:
 *   get:
 *     tags: [h7]
 *     summary: Listar declaraciones H7 (DECO/bajo valor <=150 EUR) del tenant
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: channel, schema: { type: string, enum: [green, orange, red] } }
 *   post:
 *     tags: [h7]
 *     summary: Crear declaración H7
 *
 * /api/h7/stats:
 *   get:
 *     tags: [h7]
 *     summary: Estadísticas H7 del tenant (total, por canal, por estado)
 *
 * /api/h7/batch:
 *   post:
 *     tags: [h7]
 *     summary: Procesamiento masivo de H7 (manifiesto CSV)
 *
 * /api/h7/{id}:
 *   get:
 *     tags: [h7]
 *     summary: Detalle H7 (tenant-scoped)
 *   put:
 *     tags: [h7]
 *     summary: Actualizar H7
 *   delete:
 *     tags: [h7]
 *     summary: Eliminar H7 (soft-delete)
 *
 * /api/h7/{id}/submit:
 *   post:
 *     tags: [h7]
 *     summary: Enviar H7 a AEAT (ES) o DECO (NL)
 */

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
