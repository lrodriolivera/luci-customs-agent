const express = require('express');
const router = express.Router();
const declarationController = require('../controllers/declarationController');
const { auth, requirePermission } = require('../middleware/auth');
const { declarationValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

// GET /api/declarations/supported-countries
router.get('/supported-countries', (req, res) => {
  const { CustomsServiceFactory } = require('../services/customs');
  res.json({
    success: true,
    data: CustomsServiceFactory.getSupportedCountries()
  });
});

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

// Anular declaracion
router.post('/:expeditionId/cancel', requirePermission('canApproveDeclarations'), declarationController.cancelDeclaration);

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

// ===========================================
// MULTI-COUNTRY V2 SUBMISSION
// ===========================================

/**
 * @route POST /api/declarations/:expeditionId/submit-v2
 * @desc Multi-country aware submission - uses tenant's country config
 * Uses CustomsServiceFactory pattern to route to the correct country service
 */
router.post('/:expeditionId/submit-v2', requirePermission('canApproveDeclarations'), async (req, res) => {
  try {
    const { CustomsServiceFactory } = require('../services/customs');

    const expedition = await Expedition.findOne({
      _id: req.params.expeditionId,
      tenantId: req.tenantId  // Tenant isolation
    });

    if (!expedition) {
      return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
    }

    if (expedition.declaration?.status === 'accepted') {
      return res.status(400).json({ success: false, error: 'Declaracion ya aceptada' });
    }

    // Get country from tenant config or default to ES
    const tenant = req.tenant || {};
    const country = tenant.customsConfig?.country || 'ES';
    const declarationType = expedition.declaration?.type || 'H1';

    // Get the right customs service via factory
    const customsService = CustomsServiceFactory.getServiceForTenant(tenant);

    // Submit via the country-specific service
    const result = await customsService.submitDeclaration(expedition, declarationType);

    if (result.success) {
      // Update expedition with result
      expedition.declaration = expedition.declaration || {};
      expedition.declaration.mrn = result.mrn;
      expedition.declaration.status = 'accepted';
      expedition.declaration.channel = result.channel || 'green';
      expedition.declaration.submittedAt = new Date();
      expedition.declaration.aeatResponse = {
        code: result.code,
        csv: result.csv,
        timestamp: new Date(),
        country: country,
        system: country === 'NL' ? 'DECO' : 'AEAT',
        simulated: result.simulated || false
      };

      await expedition.save();
    }

    res.json({
      success: result.success,
      data: {
        mrn: result.mrn,
        lrn: result.lrn || expedition.expeditionId,
        channel: result.channel,
        country: country,
        system: country === 'NL' ? (declarationType === 'H7' ? 'DECO' : 'DMS 4.0') : 'AEAT',
        simulated: result.simulated || false,
      },
      error: result.error
    });

  } catch (error) {
    console.error('Multi-country submit error:', error);
    res.status(500).json({ success: false, error: 'Error enviando declaracion' });
  }
});

/**
 * @route POST /api/declarations/:expeditionId/validate-v2
 * @desc Multi-country validation - validates without submitting
 * Returns { valid, errors, warnings, country, system }
 */
router.post('/:expeditionId/validate-v2', async (req, res) => {
  try {
    const { CustomsServiceFactory } = require('../services/customs');

    const expedition = await Expedition.findOne({
      _id: req.params.expeditionId,
      tenantId: req.tenantId
    });

    if (!expedition) {
      return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
    }

    const tenant = req.tenant || {};
    const country = tenant.customsConfig?.country || 'ES';
    const declarationType = expedition.declaration?.type || req.body.declarationType || 'H1';

    const customsService = CustomsServiceFactory.getServiceForTenant(tenant);

    // Validate only - do not submit
    const validation = await customsService.validateDeclaration(expedition, declarationType);

    const systemName = country === 'NL'
      ? (declarationType === 'H7' ? 'DECO' : 'DMS 4.0')
      : 'AEAT';

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        country: country,
        system: systemName,
        declarationType: declarationType,
      }
    });

  } catch (error) {
    console.error('Multi-country validate error:', error);
    res.status(500).json({ success: false, error: 'Error validando declaracion' });
  }
});

module.exports = router;
