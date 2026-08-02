/**
 * Deadline Routes
 * Rutas para gestión de plazos y alertas
 */

const express = require('express');
const router = express.Router();
const deadlineController = require('../controllers/deadlineController');
const { auth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion: exponian datos de clientes
// (NIF, EORI, MRN, expedientes, inspecciones) a cualquiera sin token.
router.use(auth);

// Rutas de consulta (antes de las rutas con parámetros)
router.get('/pending', deadlineController.getPending);
router.get('/overdue', deadlineController.getOverdue);
router.get('/urgent', deadlineController.getUrgent);
router.get('/calendar', deadlineController.getCalendar);
router.get('/dashboard', deadlineController.getDashboard);
router.get('/stats', deadlineController.getStats);
router.get('/types', deadlineController.getTypes);
router.get('/categories', deadlineController.getCategories);
router.get('/info', deadlineController.getInfo);

// Acciones del sistema
router.post('/process-alerts', deadlineController.processAlerts);
router.post('/sync', deadlineController.sync);

// CRUD básico
router.get('/', deadlineController.list);
router.post('/', deadlineController.create);
router.get('/:id', deadlineController.getById);
router.put('/:id', deadlineController.update);
router.delete('/:id', deadlineController.delete);

// Acciones sobre deadline específico
router.post('/:id/complete', deadlineController.complete);
router.post('/:id/extend', deadlineController.extend);
router.post('/:id/cancel', deadlineController.cancel);

module.exports = router;
