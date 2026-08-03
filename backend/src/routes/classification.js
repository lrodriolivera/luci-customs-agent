const express = require('express');
const router = express.Router();
const classificationController = require('../controllers/classificationController');
const { auth, requireRole } = require('../middleware/auth');
const { classificationValidators } = require('../middleware/validators');

/**
 * @openapi
 * /api/classification/search:
 *   get:
 *     tags: [classification]
 *     summary: Buscar códigos TARIC por texto libre
 *     security: []
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *       - { in: query, name: lang, schema: { type: string, enum: [es, en] } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 */
router.get('/chapters', classificationController.getChapters);
router.get('/search', classificationController.searchTaric);

/**
 * @openapi
 * /api/classification/tree:
 *   get:
 *     tags: [classification]
 *     summary: Árbol jerárquico de capítulos/partidas/CN/TARIC
 *     security: []
 */
router.get('/tree', classificationController.getTreeData);

/**
 * @openapi
 * /api/classification/taric/{code}:
 *   get:
 *     tags: [classification]
 *     summary: Detalle de un código TARIC (descripción, arancel MFN, VAT, medidas)
 *     security: []
 *     parameters:
 *       - { in: path, name: code, required: true, schema: { type: string, pattern: '^[0-9]{8,10}$' } }
 */
router.get('/taric/:code', classificationValidators.getByCode, classificationController.getTaricInfo);

/**
 * @openapi
 * /api/classification/suggest:
 *   post:
 *     tags: [classification]
 *     summary: Sugerir código TARIC usando IA a partir de descripción de producto
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description]
 *             properties:
 *               description: { type: string }
 *               expeditionId: { type: string }
 *               language: { type: string }
 */
// Rutas que requieren autenticacion
router.post('/suggest', auth, classificationValidators.suggest, classificationController.suggestTaricCode);
router.post('/validate', auth, classificationController.validateClassification);
router.post('/apply', auth, classificationController.applyClassification);

// Nuevas rutas para calculo de derechos y documentos
router.post('/calculate-duties', auth, classificationController.calculateDuties);
router.get('/required-documents/:code', auth, classificationController.getRequiredDocuments);
router.get('/preferences/:origin', auth, classificationController.getPreferences);
// Operacion global sobre el catalogo TARIC (21.946 codigos): rol admin, no
// basta con estar autenticado. Es upsert, no borra, pero afecta a todos los
// tenants por igual.
router.post('/seed', auth, requireRole('admin'), classificationController.seedTaricDatabase);

// ==================== AI ENDPOINTS - LUCI Integration ====================

/**
 * @openapi
 * /api/classification/ai/full-analysis:
 *   post:
 *     tags: [classification]
 *     summary: Análisis completo IA (clasificación + arancel + docs + validación)
 */

// POST /api/classification/ai/improve-with-feedback - Mejorar con feedback histórico
router.post('/ai/improve-with-feedback', auth, classificationController.aiImproveWithFeedback);

// POST /api/classification/ai/suggest-from-history - Sugerir desde historial
router.post('/ai/suggest-from-history', auth, classificationController.aiSuggestFromHistory);

// POST /api/classification/ai/cross-validate - Validar con normativa
router.post('/ai/cross-validate', auth, classificationController.aiCrossValidate);

// POST /api/classification/ai/full-analysis - Análisis completo de clasificación
router.post('/ai/full-analysis', auth, classificationController.aiFullAnalysis);

// POST /api/classification/ai/record-feedback - Registrar feedback para aprendizaje
router.post('/ai/record-feedback', auth, classificationController.aiRecordFeedback);

// ==================== HISTORIAL Y CACHE ENDPOINTS ====================

// GET /api/classification/history - Historial de busquedas del usuario
router.get('/history', auth, classificationController.getSearchHistory);

// GET /api/classification/most-searched - Codigos mas buscados
router.get('/most-searched', auth, classificationController.getMostSearched);

// GET /api/classification/search-stats - Estadisticas de busquedas
router.get('/search-stats', auth, classificationController.getSearchStats);

// GET /api/classification/cache-stats - Estadisticas del cache de IA
router.get('/cache-stats', auth, classificationController.getCacheStats);

// PUT /api/classification/history/:searchId/mark-used - Marcar busqueda como usada
router.put('/history/:searchId/mark-used', auth, classificationController.markSearchAsUsed);

// DELETE /api/classification/cache/clean - Limpiar cache antiguo
// Purga la cache de IA de TODOS los tenants: rol admin.
router.delete('/cache/clean', auth, requireRole('admin'), classificationController.cleanOldCache);

module.exports = router;
