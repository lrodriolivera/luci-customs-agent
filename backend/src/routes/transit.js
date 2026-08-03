/**
 * Transit Routes (NCTS)
 * Rutas para gestion de operaciones de transito T1/T2/TIR
 */

const express = require('express');
const router = express.Router();
const transitController = require('../controllers/transitController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

// === RUTAS PRINCIPALES ===

/**
 * @openapi
 * /api/transit:
 *   get:
 *     tags: [declarations]
 *     summary: Listar operaciones de tránsito T1/T2/TIR (NCTS)
 *   post:
 *     tags: [declarations]
 *     summary: Crear operación de tránsito
 */
// Listar transitos
router.get('/', transitController.list);

/**
 * @openapi
 * /api/transit/stats:
 *   get:
 *     tags: [declarations]
 *     summary: KPIs tránsitos (activos, vencidos)
 */
router.get('/stats', transitController.getStats);

/**
 * @openapi
 * /api/transit/overdue:
 *   get:
 *     tags: [declarations]
 *     summary: Tránsitos con plazo vencido
 */
router.get('/overdue', transitController.getOverdue);

router.post('/', transitController.create);

/**
 * @openapi
 * /api/transit/{id}:
 *   get:
 *     tags: [declarations]
 *     summary: Detalle de tránsito (tenant-guarded)
 */
router.get('/:id', transitController.getById);

// Actualizar transito
router.put('/:id', transitController.update);

// Eliminar transito
router.delete('/:id', transitController.delete);

// === FLUJO NCTS ===

// Enviar declaracion a NCTS (IE015)
router.post('/:id/submit', transitController.submit);

// Liberar mercancias en partida (IE029)
router.post('/:id/release-departure', transitController.releaseAtDeparture);

// Iniciar transito
router.post('/:id/start', transitController.startTransit);

// Registrar paso por aduana de transito
router.post('/:id/transit-office', transitController.recordTransitOfficePassage);

// Notificar llegada a destino (IE160)
router.post('/:id/arrival', transitController.notifyArrival);

// Registrar resultado de control (IE143)
router.post('/:id/control', transitController.recordControlResult);

// Liberar mercancias en destino
router.post('/:id/release-goods', transitController.releaseGoods);

// Completar transito
router.post('/:id/complete', transitController.complete);

// === PROCEDIMIENTOS ESPECIALES ===

// Iniciar procedimiento de busqueda (IE118)
router.post('/:id/enquiry', transitController.initiateEnquiry);

// ===========================================
// AI ENDPOINTS - LUCI Integration
// ===========================================

// Auto-completar datos de tránsito desde expediente
router.post('/ai/auto-complete', transitController.aiAutoComplete);

// Validar y optimizar ruta de tránsito
router.post('/:id/ai/validate-route', transitController.aiValidateRoute);

// Predecir incidencias potenciales
router.post('/:id/ai/predict-incidents', transitController.aiPredictIncidents);

// Sugerir garantía óptima para tránsito
router.post('/:id/ai/suggest-guarantee', transitController.aiSuggestGuarantee);

// Análisis completo de tránsito
router.post('/:id/ai/full-analysis', transitController.aiFullAnalysis);

// Aplicar sugerencia de auto-completado
router.post('/:id/ai/apply-suggestion', transitController.aiApplySuggestion);

// === PDF ===
const pdfGenerator = require('../services/pdfGenerator');
const { Transit } = require('../models');
const { ensureSameTenant } = require('../utils/tenantGuard');

router.get('/:id/pdf', async (req, res) => {
  try {
    const transit = await Transit.findById(req.params.id).lean();
    if (!ensureSameTenant(transit, req, res)) return;
    const isDraft = req.query.preview === 'true';
    const pdfBuffer = await pdfGenerator.generateNCTSPDF(transit, { draft: isDraft });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="NCTS_${transit.reference || transit._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === NCTS LIFECYCLE ===

// Notificacion de llegada (CC007)
router.post('/:id/arrival', transitController.notifyArrival);

// Observaciones de descarga (CC044)
router.post('/:id/unloading', transitController.notifyUnloading);

module.exports = router;
