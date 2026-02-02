/**
 * Workflow Routes
 * Endpoints para gestion de workflows automatizados
 * Fase 6.6 - LUCI Customs Agent
 */

const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authenticate, requireRole } = require('../middleware/auth');

// Aplicar autenticacion a todas las rutas
router.use(authenticate);

// ==================== Metadata Endpoints ====================

/**
 * @route GET /api/workflows/stats
 * @desc Obtener estadisticas de workflows
 * @access Private
 */
router.get('/stats', workflowController.getStats);

/**
 * @route GET /api/workflows/top
 * @desc Obtener workflows mas activos
 * @access Private
 */
router.get('/top', workflowController.getTopWorkflows);

/**
 * @route GET /api/workflows/templates
 * @desc Obtener plantillas de workflows predefinidas
 * @access Private
 */
router.get('/templates', workflowController.getTemplates);

/**
 * @route GET /api/workflows/events
 * @desc Obtener lista de eventos disponibles
 * @access Private
 */
router.get('/events', workflowController.getAvailableEvents);

/**
 * @route GET /api/workflows/actions
 * @desc Obtener lista de acciones disponibles
 * @access Private
 */
router.get('/actions', workflowController.getAvailableActions);

// ==================== Execution Endpoints ====================

/**
 * @route GET /api/workflows/executions/:executionId
 * @desc Obtener detalle de una ejecucion
 * @access Private
 */
router.get('/executions/:executionId', workflowController.getExecution);

/**
 * @route POST /api/workflows/executions/:executionId/cancel
 * @desc Cancelar ejecucion en progreso
 * @access Private (Admin)
 */
router.post('/executions/:executionId/cancel', requireRole('admin'), workflowController.cancelExecution);

// ==================== CRUD Endpoints ====================

/**
 * @route GET /api/workflows
 * @desc Listar workflows de la organizacion
 * @access Private
 */
router.get('/', workflowController.listWorkflows);

/**
 * @route POST /api/workflows
 * @desc Crear nuevo workflow
 * @access Private (Admin)
 */
router.post('/', requireRole('admin'), workflowController.createWorkflow);

/**
 * @route GET /api/workflows/:id
 * @desc Obtener workflow por ID
 * @access Private
 */
router.get('/:id', workflowController.getWorkflow);

/**
 * @route PUT /api/workflows/:id
 * @desc Actualizar workflow
 * @access Private (Admin)
 */
router.put('/:id', requireRole('admin'), workflowController.updateWorkflow);

/**
 * @route DELETE /api/workflows/:id
 * @desc Eliminar workflow
 * @access Private (Admin)
 */
router.delete('/:id', requireRole('admin'), workflowController.deleteWorkflow);

// ==================== Status Endpoints ====================

/**
 * @route PATCH /api/workflows/:id/toggle
 * @desc Activar/desactivar workflow
 * @access Private (Admin)
 */
router.patch('/:id/toggle', requireRole('admin'), workflowController.toggleWorkflow);

/**
 * @route POST /api/workflows/:id/publish
 * @desc Publicar workflow (de draft a active)
 * @access Private (Admin)
 */
router.post('/:id/publish', requireRole('admin'), workflowController.publishWorkflow);

/**
 * @route POST /api/workflows/:id/clone
 * @desc Clonar workflow existente
 * @access Private (Admin)
 */
router.post('/:id/clone', requireRole('admin'), workflowController.cloneWorkflow);

// ==================== Execution Endpoints (per workflow) ====================

/**
 * @route POST /api/workflows/:id/execute
 * @desc Ejecutar workflow manualmente
 * @access Private (Admin)
 */
router.post('/:id/execute', requireRole('admin'), workflowController.executeWorkflow);

/**
 * @route GET /api/workflows/:id/executions
 * @desc Obtener historial de ejecuciones de un workflow
 * @access Private
 */
router.get('/:id/executions', workflowController.getExecutionHistory);

module.exports = router;
