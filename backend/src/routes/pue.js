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

// ==========================================
// CATALOG / INFO ROUTES
// ==========================================

// GET /api/pue/stats - Estadisticas PUE
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
// VALIDATION ROUTES
// ==========================================

// POST /api/pue/validate - Validar datos sin crear
router.post('/validate', pueController.validate);

// POST /api/pue/check-taric - Verificar codigos TARIC
router.post('/check-taric', pueController.checkTaric);

// POST /api/pue/required-controls - Determinar controles requeridos
router.post('/required-controls', pueController.getRequiredControls);

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

// GET /api/pue - Listar solicitudes
router.get('/', pueController.list);

// POST /api/pue - Crear solicitud
router.post('/', pueController.create);

// GET /api/pue/:id - Obtener por ID
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

module.exports = router;
