/**
 * Inspection Routes
 * Rutas para coordinación de inspecciones
 */

const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');
const { auth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion: exponian datos de clientes
// (NIF, EORI, MRN, expedientes, inspecciones) a cualquiera sin token.
router.use(auth);

// Rutas de consulta (antes de las rutas con parámetros)
router.get('/today', inspectionController.getToday);
router.get('/pending', inspectionController.getPending);
router.get('/calendar', inspectionController.getCalendar);
router.get('/dashboard', inspectionController.getDashboard);
router.get('/stats', inspectionController.getStats);
router.get('/types', inspectionController.getTypes);
router.get('/locations', inspectionController.getLocations);
router.get('/results', inspectionController.getResults);
router.get('/checklist/:type', inspectionController.getChecklist);
router.get('/info', inspectionController.getInfo);

// CRUD básico
router.get('/', inspectionController.list);
router.post('/', inspectionController.create);
router.get('/:id', inspectionController.getById);

// Flujo de inspección
router.post('/:id/schedule', inspectionController.schedule);
router.post('/:id/confirm', inspectionController.confirm);
router.post('/:id/start', inspectionController.start);
router.post('/:id/complete', inspectionController.complete);
router.post('/:id/cancel', inspectionController.cancel);
router.post('/:id/reschedule', inspectionController.reschedule);

// Gestión de datos de inspección
router.post('/:id/participants', inspectionController.addParticipant);
router.post('/:id/evidence', inspectionController.addEvidence);
router.post('/:id/items', inspectionController.addItem);
router.post('/:id/findings', inspectionController.registerFinding);
router.post('/:id/samples', inspectionController.addSample);
router.put('/:id/samples/:sampleId', inspectionController.updateSampleResult);
router.post('/:id/report', inspectionController.generateReport);
router.post('/:id/actions', inspectionController.addAction);

module.exports = router;
