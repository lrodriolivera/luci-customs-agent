/**
 * ENS Routes
 * Rutas para Declaraciones Sumarias de Entrada (ENS/ICS2)
 */
const express = require('express');
const router = express.Router();
const ensController = require('../controllers/ensController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

/**
 * @openapi
 * /api/ens/stats:
 *   get:
 *     tags: [declarations]
 *     summary: KPIs ENS (Declaraciones Sumarias de Entrada, ICS2)
 */
router.get('/stats', ensController.getStats);
router.get('/entry-offices', ensController.getEntryOffices);
router.get('/deadlines', ensController.getDeadlines);

// Validacion
router.post('/validate', ensController.validate);

// AI-Powered Endpoints
router.post('/ai/analyze-expedition', ensController.aiAnalyzeExpedition);
router.post('/ai/validate', ensController.aiValidate);
router.post('/ai/predict-rejection', ensController.aiPredictRejection);

// Procesamiento masivo
router.post('/batch', ensController.processBatch);

/**
 * @openapi
 * /api/ens/risk-message:
 *   post:
 *     tags: [declarations]
 *     summary: Registrar un mensaje de riesgo de AEAT (CC351A/CC324A) sobre una ENS
 *     description: >
 *       El CC328A de la presentacion solo acusa el registro; el circuito
 *       (ACK/HOLD/DNL) llega despues en un mensaje aparte que se ingiere por aqui.
 *       Solo admin. Debe declararse ANTES de /:id o el router la tomaria por un id.
 */
router.post('/risk-message', ensController.ingestRiskMessage);

// Busquedas
router.get('/search/container/:container', ensController.searchByContainer);
router.get('/search/bol/:bol', ensController.searchByBOL);

/**
 * @openapi
 * /api/ens:
 *   get:
 *     tags: [declarations]
 *     summary: Listar declaraciones ENS/ICS2 del tenant
 *   post:
 *     tags: [declarations]
 *     summary: Crear ENS
 * /api/ens/{id}:
 *   get:
 *     tags: [declarations]
 *     summary: Detalle ENS (tenant-guarded)
 *   put:
 *     tags: [declarations]
 *     summary: Actualizar ENS
 */
// CRUD
router.get('/', ensController.list);
router.post('/', ensController.create);
router.get('/:id', ensController.get);
router.put('/:id', ensController.update);

// Acciones sobre declaracion
router.post('/:id/submit', ensController.submit);
router.post('/:id/amend', ensController.amend);
router.post('/:id/cancel', ensController.cancel);
router.post('/:id/arrival', ensController.notifyArrival);
router.post('/:id/document', ensController.addDocument);

// XML generado
router.get('/:id/xml', ensController.getXML);

// AI suggestions for specific declaration
router.get('/:id/ai/suggestions', ensController.aiGetSuggestions);

module.exports = router;
