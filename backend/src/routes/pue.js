/**
 * PUE Routes
 * Rutas para gestion de solicitudes PUE (ROHS, COM, ECO, CAL)
 */

const express = require('express');
const router = express.Router();
const pueController = require('../controllers/pueController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

/**
 * @openapi
 * /api/pue/stats:
 *   get:
 *     tags: [declarations]
 *     summary: Estadísticas PUE (Punto Único de Entrada)
 */
router.get('/stats', pueController.getStats);

// GET /api/pue/types - Tipos de PUE disponibles
router.get('/types', pueController.getTypes);

// GET /api/pue/soivre-offices - Oficinas SOIVRE
router.get('/soivre-offices', pueController.getSoivreOffices);

// GET /api/pue/required-documents/:type - Documentos requeridos por tipo
router.get('/required-documents/:type', pueController.getRequiredDocuments);

// GET /api/pue/info - Informacion del servicio
router.get('/info', pueController.getInfo);

// GET /api/pue/deadlines - Proximos vencimientos
router.get('/deadlines', pueController.getUpcomingDeadlines);

// ==========================================
// PHASE 5: SOIVRE OVERHAUL - CATALOGS
// ==========================================

// GET /api/pue/catalogs/all - Todos los catalogos (carga inicial)
router.get('/catalogs/all', pueController.getAllCatalogs);

// GET /api/pue/catalogs/specificities/:flowType - Especificidades por flujo
router.get('/catalogs/specificities/:flowType', pueController.getSpecificities);

// GET /api/pue/catalogs/centers - Centros SOIVRE (CodCice)
router.get('/catalogs/centers', pueController.getCenters);

// GET /api/pue/catalogs/inspection-points/:code - Puntos inspeccion por centro
router.get('/catalogs/inspection-points/:code', pueController.getInspectionPoints);

// GET /api/pue/catalogs/units - Unidades de mercancia
router.get('/catalogs/units', pueController.getUnits);

// GET /api/pue/catalogs/certificate-types - Tipos de certificado
router.get('/catalogs/certificate-types', pueController.getCertificateTypes);

// POST /api/pue/lookup-mrn - Buscar declaracion por MRN + Clave Zeta
router.post('/lookup-mrn', pueController.lookupMRN);

// POST /api/pue/validate-rii - Validar RII por NIF
router.post('/validate-rii', pueController.validateRII);

// ==========================================
// VALIDATION ROUTES
// ==========================================

// POST /api/pue/validate - Validar datos sin crear
router.post('/validate', pueController.validate);

// POST /api/pue/check-taric - Verificar codigos TARIC
router.post('/check-taric', pueController.checkTaric);

// POST /api/pue/required-controls - Determinar controles requeridos
router.post('/required-controls', pueController.getRequiredControls);

// ==========================================
// AI-POWERED ROUTES
// ==========================================

// POST /api/pue/ai/determine-type - Determinar tipo PUE con IA
router.post('/ai/determine-type', pueController.aiDetermineType);

// POST /api/pue/ai/analyze-goods - Analizar mercancia con IA
router.post('/ai/analyze-goods', pueController.aiAnalyzeGoods);

// ==========================================
// BATCH OPERATIONS
// ==========================================

// POST /api/pue/batch - Procesamiento masivo
router.post('/batch', pueController.processBatch);

// ==========================================
// QUERY BY RELATED ENTITIES
// ==========================================

// GET /api/pue/expedition/:id - Por expedicion
router.get('/expedition/:id', pueController.getByExpedition);

// GET /api/pue/declaration/:mrn - Por declaracion
router.get('/declaration/:mrn', pueController.getByDeclaration);

// ==========================================
// CRUD OPERATIONS
// ==========================================

/**
 * @openapi
 * /api/pue:
 *   get:
 *     tags: [declarations]
 *     summary: Listar solicitudes PUE (ROHS, COM, ECO, CAL) del tenant
 *   post:
 *     tags: [declarations]
 *     summary: Crear solicitud PUE
 * /api/pue/{id}:
 *   get:
 *     tags: [declarations]
 *     summary: Detalle PUE (tenant-guarded)
 */
router.get('/', pueController.list);
router.post('/', pueController.create);
router.get('/:id', pueController.getById);

// PUT /api/pue/:id - Actualizar solicitud
router.put('/:id', pueController.update);

// ==========================================
// WORKFLOW OPERATIONS
// ==========================================

// POST /api/pue/:id/submit - Enviar a AEAT
router.post('/:id/submit', pueController.submit);

// POST /api/pue/:id/cancel - Cancelar solicitud
router.post('/:id/cancel', pueController.cancel);

// ==========================================
// DOCUMENT OPERATIONS
// ==========================================

// POST /api/pue/:id/document - Agregar documento
router.post('/:id/document', pueController.addDocument);

// ==========================================
// INSPECTION OPERATIONS
// ==========================================

// POST /api/pue/:id/inspection/schedule - Programar inspeccion
router.post('/:id/inspection/schedule', pueController.scheduleInspection);

// POST /api/pue/:id/inspection/result - Registrar resultado
router.post('/:id/inspection/result', pueController.recordInspectionResult);

// ==========================================
// CERTIFICATE OPERATIONS
// ==========================================

// POST /api/pue/:id/certificate - Emitir certificado
router.post('/:id/certificate', pueController.issueCertificate);

// ==========================================
// INTEGRATION OPERATIONS
// ==========================================

// POST /api/pue/:id/link-declaration - Vincular a declaracion
router.post('/:id/link-declaration', pueController.linkToDeclaration);

// GET /api/pue/:id/status - Consultar estado AEAT
router.get('/:id/status', pueController.queryStatus);

// GET /api/pue/:id/xml - Obtener XML
router.get('/:id/xml', pueController.getXML);

// ==========================================
// AI ANALYSIS FOR SPECIFIC REQUEST
// ==========================================

// POST /api/pue/:id/ai/predict-inspection - Predecir resultado inspeccion
router.post('/:id/ai/predict-inspection', pueController.aiPredictInspection);

// POST /api/pue/:id/ai/suggest-documents - Sugerir documentos
router.post('/:id/ai/suggest-documents', pueController.aiSuggestDocuments);

// POST /api/pue/:id/ai/recommendations - Recomendaciones para inspeccion
router.post('/:id/ai/recommendations', pueController.aiGetRecommendations);

// POST /api/pue/:id/ai/full-analysis - Analisis completo IA
router.post('/:id/ai/full-analysis', pueController.aiFullAnalysis);

// === PDF ===
const pdfGenerator = require('../services/pdfGenerator');
const { PUERequest } = require('../models');

router.get('/:id/pdf', async (req, res) => {
  try {
    const pue = await PUERequest.findById(req.params.id).lean();
    if (!pue) return res.status(404).json({ success: false, error: 'Solicitud PUE no encontrada' });
    const isDraft = req.query.preview === 'true';
    const pdfBuffer = await pdfGenerator.generatePUESOIVREPDF(pue, { draft: isDraft });
    const flowType = pue.flowType === 'ROHS_RAEE' ? 'ROHS' : 'SOIVRE';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PUE_${flowType}_${pue.reference || pue._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
