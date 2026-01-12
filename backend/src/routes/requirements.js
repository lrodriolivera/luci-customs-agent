/**
 * Requirements Routes
 * Rutas para gestion de requerimientos AEAT y paraduaneros
 */

const express = require('express');
const router = express.Router();
const requirementController = require('../controllers/requirementController');
const { auth, requireRole } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(auth);

// GET /api/requirements - Listar requerimientos con filtros
router.get('/', requirementController.getRequirements);

// GET /api/requirements/stats - Estadisticas de requerimientos
router.get('/stats', requirementController.getStats);

// GET /api/requirements/expedition/:expeditionId - Requerimientos de un expediente
router.get('/expedition/:expeditionId', requirementController.getByExpedition);

// GET /api/requirements/:id - Obtener requerimiento por ID
router.get('/:id', requirementController.getRequirementById);

// POST /api/requirements - Crear nuevo requerimiento
router.post('/', requireRole('admin', 'agent'), requirementController.createRequirement);

// PUT /api/requirements/:id - Actualizar requerimiento
router.put('/:id', requireRole('admin', 'agent'), requirementController.updateRequirement);

// POST /api/requirements/:id/response - Agregar respuesta
router.post('/:id/response', requireRole('admin', 'agent'), requirementController.addResponse);

// POST /api/requirements/:id/submit - Enviar respuesta a AEAT
router.post('/:id/submit', requireRole('admin', 'agent'), requirementController.submitToAEAT);

// PUT /api/requirements/:id/items/:itemId/provided - Marcar item como proporcionado
router.put('/:id/items/:itemId/provided', requireRole('admin', 'agent'), requirementController.markItemProvided);

// POST /api/requirements/:id/inspection/schedule - Programar inspeccion (canal rojo)
router.post('/:id/inspection/schedule', requireRole('admin', 'agent'), requirementController.scheduleInspection);

// POST /api/requirements/:id/inspection/result - Registrar resultado de inspeccion
router.post('/:id/inspection/result', requireRole('admin', 'agent'), requirementController.recordInspectionResult);

// POST /api/requirements/:id/resolve - Resolver requerimiento
router.post('/:id/resolve', requireRole('admin', 'agent'), requirementController.resolveRequirement);

// POST /api/requirements/:id/ai-response - Generar respuesta con IA
router.post('/:id/ai-response', requireRole('admin', 'agent'), requirementController.generateAIResponse);

module.exports = router;
