/**
 * Deadline Routes
 * Rutas para gestión de plazos y alertas
 */

const express = require('express');
const router = express.Router();
const deadlineController = require('../controllers/deadlineController');
const { auth, requireRole } = require('../middleware/auth');

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

// Acciones del sistema. Solo admin: no reciben ningun identificador, asi que
// actuan sobre los plazos de TODOS los tenants. processAlerts hace addAlert() y
// save() sobre cada plazo vencido del sistema. El propio service dice que en
// produccion irian como job programado, no lanzadas por un usuario.
router.post('/process-alerts', requireRole('admin'), deadlineController.processAlerts);
router.post('/sync', requireRole('admin'), deadlineController.sync);

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
