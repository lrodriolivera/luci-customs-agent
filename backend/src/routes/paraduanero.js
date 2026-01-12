/**
 * Paraduanero Routes
 * Rutas para gestion de controles paraduaneros (SOIVRE, MAPA, Sanidad, MITERD)
 */

const express = require('express');
const router = express.Router();
const paraduaneroController = require('../controllers/paraduaneroController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Aplicar autenticacion a todas las rutas
router.use(requireAuth);

// GET /api/paraduanero/stats - Estadisticas
router.get('/stats', paraduaneroController.getStats);

// GET /api/paraduanero/analyze/:expeditionId - Analizar expediente
router.get('/analyze/:expeditionId', paraduaneroController.analyzeExpedition);

// POST /api/paraduanero/create/:expeditionId - Crear controles para expediente
router.post('/create/:expeditionId', requireRole('admin', 'agent'), paraduaneroController.createControls);

// GET /api/paraduanero/expedition/:expeditionId - Obtener controles de un expediente
router.get('/expedition/:expeditionId', paraduaneroController.getByExpedition);

// GET /api/paraduanero - Listar todos los controles
router.get('/', paraduaneroController.list);

// GET /api/paraduanero/:id - Obtener detalle de control
router.get('/:id', paraduaneroController.getById);

// PUT /api/paraduanero/:id - Actualizar control
router.put('/:id', requireRole('admin', 'agent'), paraduaneroController.update);

// POST /api/paraduanero/:id/document/:code/provide - Marcar documento proporcionado
router.post('/:id/document/:code/provide', requireRole('admin', 'agent'), paraduaneroController.provideDocument);

// POST /api/paraduanero/:id/inspection/schedule - Programar inspeccion
router.post('/:id/inspection/schedule', requireRole('admin', 'agent'), paraduaneroController.scheduleInspection);

// POST /api/paraduanero/:id/inspection/result - Registrar resultado inspeccion
router.post('/:id/inspection/result', requireRole('admin', 'agent'), paraduaneroController.recordInspectionResult);

// POST /api/paraduanero/:id/certificate - Emitir certificado
router.post('/:id/certificate', requireRole('admin', 'agent'), paraduaneroController.issueCertificate);

// POST /api/paraduanero/:id/status - Cambiar estado
router.post('/:id/status', requireRole('admin', 'agent'), paraduaneroController.changeStatus);

module.exports = router;
