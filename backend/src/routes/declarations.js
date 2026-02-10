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
// PDF GENERATION
// ===========================================

const pdfGenerator = require('../services/pdfGenerator');
const { Expedition, H7Declaration, ENSDeclaration } = require('../models');

/**
 * @route GET /api/declarations/:expeditionId/pdf
 * @desc Generate and download declaration PDF (H1 or AES)
 */
router.get('/:expeditionId/pdf', async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.expeditionId).lean();
    if (!expedition) return res.status(404).json({ success: false, error: 'Expediente no encontrado' });

    const isDraft = req.query.preview === 'true';
    const isExport = expedition.operationType === 'export' || expedition.operationType === 'EXPORT';

    const pdfBuffer = isExport
      ? await pdfGenerator.generateAESPDF(expedition, { draft: isDraft })
      : await pdfGenerator.generateH1PDF(expedition, { draft: isDraft });

    const type = isExport ? 'AES' : 'H1';
    const filename = `${type}_${expedition.expeditionId}_${isDraft ? 'BORRADOR_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/declarations/h7/:id/pdf
 * @desc Generate and download H7 declaration PDF
 */
router.get('/h7/:id/pdf', async (req, res) => {
  try {
    const h7 = await H7Declaration.findById(req.params.id).lean();
    if (!h7) return res.status(404).json({ success: false, error: 'Declaracion H7 no encontrada' });

    const isDraft = req.query.preview === 'true';
    const pdfBuffer = await pdfGenerator.generateH7PDF(h7, { draft: isDraft });

    const filename = `H7_${h7.declarationNumber || h7._id}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/declarations/ens/:id/pdf
 * @desc Generate and download ENS declaration PDF
 */
router.get('/ens/:id/pdf', async (req, res) => {
  try {
    const ens = await ENSDeclaration.findById(req.params.id).lean();
    if (!ens) return res.status(404).json({ success: false, error: 'Declaracion ENS no encontrada' });

    const isDraft = req.query.preview === 'true';
    const pdfBuffer = await pdfGenerator.generateENSPDF(ens, { draft: isDraft });

    const filename = `ENS_${ens.lrn || ens._id}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/declarations/:expeditionId/summary-pdf
 * @desc Generate expedition summary PDF (for client portal)
 */
router.get('/:expeditionId/summary-pdf', async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.expeditionId).lean();
    if (!expedition) return res.status(404).json({ success: false, error: 'Expediente no encontrado' });

    const pdfBuffer = await pdfGenerator.generateExpeditionSummaryPDF(expedition);

    const filename = `Resumen_${expedition.expeditionId}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
