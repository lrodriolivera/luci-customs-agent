const express = require('express');
const router = express.Router();
const declarationController = require('../controllers/declarationController');
const { auth, requirePermission } = require('../middleware/auth');
const { declarationValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

/**
 * @openapi
 * /api/declarations/supported-countries:
 *   get:
 *     tags: [declarations]
 *     summary: Países soportados por el factory multi-country (ES, NL)
 *
 * /api/declarations/h1/generate:
 *   post:
 *     tags: [declarations]
 *     summary: Generar declaración H1 (importación completa)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expeditionId]
 *             properties:
 *               expeditionId: { type: string }
 *               regime: { type: string, description: '40, 42, 44, 51, 53' }
 *               additionalProcedure: { type: string }
 *               preference: { type: string }
 *
 * /api/declarations/aes/generate:
 *   post:
 *     tags: [declarations]
 *     summary: Generar declaración AES (exportación)
 *
 * /api/declarations/h7/generate:
 *   post:
 *     tags: [declarations]
 *     summary: Generar H7 (bajo valor ≤150 EUR) desde expediente
 *
 * /api/declarations/h7/submit/{expeditionId}:
 *   post:
 *     tags: [declarations]
 *     summary: Enviar H7 a AEAT (ES) o DECO (NL)
 *     parameters:
 *       - { in: path, name: expeditionId, required: true, schema: { type: string } }
 *
 * /api/declarations/batch-submit-nl:
 *   post:
 *     tags: [declarations]
 *     summary: Batch DECO Netherlands (hasta 5.000 declaraciones)
 *
 * /api/declarations/{id}/submit-v2:
 *   post:
 *     tags: [declarations]
 *     summary: Envío multi-país (ES/NL) con routing automático por tenant.country
 */
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

// ===========================================
// NETHERLANDS - BATCH DECO SUBMISSION (static route, must be before /:expeditionId)
// ===========================================

/**
 * @route POST /api/declarations/batch-submit-nl
 * @desc Submit multiple H7 declarations via DECO batch (up to 5,000)
 */
router.post('/batch-submit-nl', requirePermission('canApproveDeclarations'), async (req, res) => {
  try {
    const { CustomsServiceFactory } = require('../services/customs');
    const { Expedition } = require('../models');

    const { expeditionIds } = req.body;
    if (!expeditionIds || !Array.isArray(expeditionIds)) {
      return res.status(400).json({ success: false, error: 'expeditionIds array requerido' });
    }

    if (expeditionIds.length > 5000) {
      return res.status(400).json({ success: false, error: 'Maximo 5,000 declaraciones por batch' });
    }

    const expeditions = await Expedition.find({
      _id: { $in: expeditionIds },
      tenantId: req.tenantId
    });

    const tenant = req.tenant || {};
    const customsService = CustomsServiceFactory.getServiceForTenant({ ...tenant, customsConfig: { ...tenant.customsConfig, country: 'NL' } });

    const result = await customsService.submitBatchDECO(expeditions);

    // Update expeditions with results
    if (result.success && result.results) {
      for (const r of result.results) {
        if (r.success && r.mrn) {
          await Expedition.findOneAndUpdate(
            { expeditionId: r.expeditionId, tenantId: req.tenantId },
            {
              'declaration.mrn': r.mrn,
              'declaration.status': 'accepted',
              'declaration.channel': 'green',
              'declaration.submittedAt': new Date(),
              'declaration.aeatResponse': {
                code: '0000', country: 'NL', system: 'DECO', simulated: r.simulated || false
              }
            }
          );
        }
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Batch submit NL error:', error);
    res.status(500).json({ success: false, error: 'Error en envio batch' });
  }
});

// ===========================================
// NETHERLANDS - CORRECTION WORKFLOW (static route, must be before /:expeditionId)
// ===========================================

/**
 * @route GET /api/declarations/corrections/pending
 * @desc List all pending NL corrections for the tenant
 */
router.get('/corrections/pending', async (req, res) => {
  try {
    const NLCorrectionWorkflow = require('../services/customs/netherlands/nlCorrectionWorkflow');
    const { Expedition } = require('../models');

    const corrections = await NLCorrectionWorkflow.getPendingCorrections(Expedition, req.tenantId);

    res.json({ success: true, data: corrections });
  } catch (error) {
    console.error('Corrections list error:', error);
    res.status(500).json({ success: false, error: 'Error obteniendo correcciones pendientes' });
  }
});

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

// ===========================================
// NETHERLANDS - CVB (Container Release Message)
// ===========================================

/**
 * @route POST /api/declarations/:expeditionId/cvb-request
 * @desc Request Container Release Message (CVB) for maritime imports
 */
router.post('/:expeditionId/cvb-request', requirePermission('canApproveDeclarations'), async (req, res) => {
  try {
    const CVBService = require('../services/customs/netherlands/cvbService');

    const expedition = await Expedition.findOne({
      _id: req.params.expeditionId,
      tenantId: req.tenantId
    });

    if (!expedition) {
      return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
    }

    const cvbService = new CVBService({
      apiKey: req.tenant?.customsConfig?.cvbApiKey || process.env.NL_CVB_API_KEY
    });

    const containerData = {
      containerNumber: req.body.containerNumber || expedition.transport?.containerNumber,
      billOfLading: req.body.billOfLading || expedition.transport?.billOfLading,
      carrierCode: req.body.carrierCode || expedition.transport?.carrierCode,
      portOfDischarge: req.body.portOfDischarge || expedition.transport?.entryCustomsOffice,
      consigneeEori: req.body.consigneeEori || expedition.consignee?.eori,
      customsStatus: req.body.customsStatus || 'T1',
      estimatedArrival: req.body.estimatedArrival || expedition.transport?.estimatedArrival,
      grossWeight: req.body.grossWeight || expedition.totalGrossMass,
      numberOfPackages: req.body.numberOfPackages || expedition.totalPackages,
    };

    const result = await cvbService.requestRelease(containerData);

    if (result.success) {
      expedition.cvbReleaseId = result.releaseId;
      expedition.cvbStatus = result.status;
      expedition.cvbRequestedAt = new Date();
      await expedition.save();
    }

    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('CVB request error:', error);
    res.status(500).json({ success: false, error: 'Error solicitando CVB' });
  }
});

/**
 * @route GET /api/declarations/:expeditionId/cvb-status
 * @desc Check CVB release status
 */
router.get('/:expeditionId/cvb-status', async (req, res) => {
  try {
    const CVBService = require('../services/customs/netherlands/cvbService');

    const expedition = await Expedition.findOne({
      _id: req.params.expeditionId,
      tenantId: req.tenantId
    });

    if (!expedition) {
      return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
    }

    if (!expedition.cvbReleaseId) {
      return res.status(400).json({ success: false, error: 'No hay solicitud CVB para este expediente' });
    }

    const cvbService = new CVBService({
      apiKey: req.tenant?.customsConfig?.cvbApiKey || process.env.NL_CVB_API_KEY
    });

    const result = await cvbService.checkReleaseStatus(expedition.cvbReleaseId);

    if (result.success && result.status) {
      expedition.cvbStatus = result.status;
      await expedition.save();
    }

    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('CVB status error:', error);
    res.status(500).json({ success: false, error: 'Error consultando estado CVB' });
  }
});

/**
 * @route POST /api/declarations/:expeditionId/corrections/:correctionId/submit
 * @desc Submit a correction for a specific error flagged by NL customs
 */
router.post('/:expeditionId/corrections/:correctionId/submit', requirePermission('canApproveDeclarations'), async (req, res) => {
  try {
    const NLCorrectionWorkflow = require('../services/customs/netherlands/nlCorrectionWorkflow');

    const expedition = await Expedition.findOne({
      _id: req.params.expeditionId,
      tenantId: req.tenantId
    });

    if (!expedition) {
      return res.status(404).json({ success: false, error: 'Expediente no encontrado' });
    }

    const { correctedData } = req.body;
    if (!correctedData || typeof correctedData !== 'object') {
      return res.status(400).json({ success: false, error: 'correctedData object requerido' });
    }

    const result = await NLCorrectionWorkflow.submitCorrection(
      expedition,
      req.params.correctionId,
      correctedData
    );

    if (result.success) {
      await expedition.save();
    }

    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('Correction submit error:', error);
    res.status(500).json({ success: false, error: 'Error enviando correccion' });
  }
});

// ===========================================
// NETHERLANDS - STATUS MONITOR
// ===========================================

/**
 * @route GET /api/declarations/nl/monitor/health
 * @desc Get DECO/DMS system health status
 */
router.get('/nl/monitor/health', async (req, res) => {
  try {
    const NLStatusMonitor = require('../services/customs/netherlands/nlStatusMonitor');
    const { NetherlandsCustomsService } = require('../services/customs');

    const tenant = req.tenant || {};
    const nlService = new NetherlandsCustomsService({
      certificatePath: tenant.customsConfig?.certificatePath,
      certificatePassword: tenant.customsConfig?.certificatePassword,
      eoriNumber: tenant.customsConfig?.eori || tenant.businessInfo?.eori,
      environment: tenant.customsConfig?.environment || 'test'
    });

    const monitor = new NLStatusMonitor(nlService);
    const health = await monitor.getSystemHealth();

    res.json({ success: true, data: health });
  } catch (error) {
    console.error('NL monitor health error:', error);
    res.status(500).json({ success: false, error: 'Error obteniendo estado del sistema NL' });
  }
});

/**
 * @route GET /api/declarations/nl/monitor/stats
 * @desc Get NL tracking stats
 */
router.get('/nl/monitor/stats', async (req, res) => {
  try {
    const NLStatusMonitor = require('../services/customs/netherlands/nlStatusMonitor');
    const monitor = new NLStatusMonitor(null);
    const stats = monitor.getStats();

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('NL monitor stats error:', error);
    res.status(500).json({ success: false, error: 'Error obteniendo estadisticas NL' });
  }
});

module.exports = router;
