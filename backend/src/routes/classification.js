const express = require('express');
const router = express.Router();
const classificationController = require('../controllers/classificationController');
const { auth, optionalAuth } = require('../middleware/auth');
const { classificationValidators } = require('../middleware/validators');

// Rutas publicas (con auth opcional para tracking)
router.get('/chapters', classificationController.getChapters);
router.get('/search', classificationController.searchTaric);
router.get('/taric/:code', classificationValidators.getByCode, classificationController.getTaricInfo);

// Rutas que requieren autenticacion
router.post('/suggest', auth, classificationValidators.suggest, classificationController.suggestTaricCode);
router.post('/validate', auth, classificationController.validateClassification);
router.post('/apply', auth, classificationController.applyClassification);

// Nuevas rutas para calculo de derechos y documentos
router.post('/calculate-duties', auth, classificationController.calculateDuties);
router.get('/required-documents/:code', auth, classificationController.getRequiredDocuments);
router.get('/preferences/:origin', auth, classificationController.getPreferences);
router.post('/seed', auth, classificationController.seedTaricDatabase);

// ==================== AI ENDPOINTS - LUCI Integration ====================

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
router.delete('/cache/clean', auth, classificationController.cleanOldCache);

module.exports = router;
