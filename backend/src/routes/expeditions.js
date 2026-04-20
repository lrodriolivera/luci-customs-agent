const express = require('express');
const router = express.Router();
const expeditionController = require('../controllers/expeditionController');
const { auth, requirePermission } = require('../middleware/auth');
const { expeditionValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

// Estadisticas (antes de :id para evitar conflicto)
router.get('/stats', expeditionController.getStats);

/**
 * @openapi
 * /api/expeditions:
 *   get:
 *     tags: [expeditions]
 *     summary: Listar expedientes (tenant-scoped, paginado)
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: country, schema: { type: string, enum: [ES, NL] } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     tags: [expeditions]
 *     summary: Crear expediente
 *     responses:
 *       201: { description: Creado }
 *
 * /api/expeditions/{id}:
 *   get:
 *     tags: [expeditions]
 *     summary: Obtener expediente (tenant-guarded)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Expediente }
 *       404: { description: No encontrado o pertenece a otro tenant }
 *   put:
 *     tags: [expeditions]
 *     summary: Actualizar expediente
 *   delete:
 *     tags: [expeditions]
 *     summary: Eliminar expediente (soft-delete)
 */
router.get('/', expeditionValidators.list, expeditionController.list);
router.post('/', requirePermission('canCreateExpeditions'), expeditionValidators.create, expeditionController.create);
router.get('/:id', expeditionValidators.getById, expeditionController.getById);
router.put('/:id', expeditionValidators.update, expeditionController.update);
router.delete('/:id', requirePermission('canDeleteExpeditions'), expeditionValidators.getById, expeditionController.remove);

// Acciones especiales
router.get('/:id/checklist', expeditionValidators.getById, expeditionController.getChecklist);
router.post('/:id/checklist', expeditionValidators.getById, expeditionController.regenerateChecklist);
router.post('/:id/send-portal-link', expeditionValidators.getById, expeditionController.sendPortalLink);

// ===========================================
// AI ENDPOINTS - LUCI Integration
// ===========================================

// Sugerir documentos faltantes
router.post('/:id/ai/suggest-documents', expeditionValidators.getById, expeditionController.aiSuggestDocuments);

// Análisis de riesgo
router.post('/:id/ai/analyze-risk', expeditionValidators.getById, expeditionController.aiAnalyzeRisk);

// Sugerir clasificación TARIC
router.post('/:id/ai/suggest-taric', expeditionValidators.getById, expeditionController.aiSuggestTaric);

// Detectar inconsistencias
router.post('/:id/ai/detect-inconsistencies', expeditionValidators.getById, expeditionController.aiDetectInconsistencies);

// Análisis completo (todos los anteriores combinados)
router.post('/:id/ai/full-analysis', expeditionValidators.getById, expeditionController.aiFullAnalysis);

// Obtener último análisis IA
router.get('/:id/ai/analysis', expeditionValidators.getById, expeditionController.getAiAnalysis);

// Aplicar sugerencia de clasificación TARIC a un item
router.post('/:id/ai/apply-taric/:itemIndex', expeditionValidators.getById, expeditionController.applyTaricSuggestion);

module.exports = router;
