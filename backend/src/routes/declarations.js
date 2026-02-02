const express = require('express');
const router = express.Router();
const declarationController = require('../controllers/declarationController');
const { auth, requirePermission } = require('../middleware/auth');
const { declarationValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

// Generar declaraciones H1 (Importacion estandar)
router.post('/h1/generate', declarationValidators.generateH1, declarationController.generateH1);
router.post('/h1/generate-direct', declarationController.generateH1Direct);  // Modo demo sin validaciones

// Generar declaraciones AES (Exportacion)
router.post('/aes/generate', declarationValidators.generateAES, declarationController.generateAES);

// Declaraciones H7 (Bajo valor <= 150 EUR)
router.get('/h7/check-eligibility/:expeditionId', declarationController.checkH7Eligibility);
router.get('/h7/stats', declarationController.getH7Stats);
router.post('/h7/generate', declarationController.generateH7);
router.post('/h7/submit/:expeditionId', requirePermission('canApproveDeclarations'), declarationController.submitH7);

// Obtener/actualizar declaracion
router.get('/:expeditionId/summary', declarationController.getDeclarationSummary);
router.get('/:expeditionId/xml', declarationController.getXML);
router.put('/:expeditionId', declarationController.updateDeclaration);

// Enviar declaracion (requiere permiso especial)
router.post('/:expeditionId/submit', requirePermission('canApproveDeclarations'), declarationController.submitDeclaration);

// ===========================================
// AI ENDPOINTS - LUCI Integration
// ===========================================

// Validar declaración antes de envío
router.post('/:expeditionId/ai/validate', declarationController.aiValidateDeclaration);

// Detectar errores comunes
router.post('/:expeditionId/ai/detect-errors', declarationController.aiDetectErrors);

// Sugerir régimen y preferencia óptimos
router.post('/:expeditionId/ai/suggest-regime', declarationController.aiSuggestRegime);

// Predecir canal de despacho
router.post('/:expeditionId/ai/predict-channel', declarationController.aiPredictChannel);

// Análisis completo de declaración
router.post('/:expeditionId/ai/full-analysis', declarationController.aiFullDeclarationAnalysis);

// Obtener último análisis IA
router.get('/:expeditionId/ai/analysis', declarationController.getAiDeclarationAnalysis);

// Aplicar sugerencia de régimen/preferencia
router.post('/:expeditionId/ai/apply-regime', declarationController.applyRegimeSuggestion);

module.exports = router;
