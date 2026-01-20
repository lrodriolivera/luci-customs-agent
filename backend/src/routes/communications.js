/**
 * Inspector Communication Routes
 * Rutas para comunicaciones con inspectores y autoridades
 */

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/inspectorCommunicationController');

// Rutas de consulta (antes de las rutas con parámetros)
router.get('/pending', communicationController.getPending);
router.get('/appeals', communicationController.getAppeals);
router.get('/overdue', communicationController.getOverdue);
router.get('/dashboard', communicationController.getDashboard);
router.get('/stats', communicationController.getStats);
router.get('/types', communicationController.getTypes);
router.get('/authorities', communicationController.getAuthorities);
router.get('/templates', communicationController.getTemplates);
router.get('/info', communicationController.getInfo);

// Utilidades
router.post('/draft', communicationController.generateDraft);
router.post('/calculate-deadline', communicationController.calculateDeadline);

// Crear tipos específicos de comunicación
router.post('/allegation', communicationController.createAllegation);
router.post('/administrative-appeal', communicationController.createAdministrativeAppeal);
router.post('/economic-appeal', communicationController.createEconomicAppeal);

// CRUD básico
router.get('/', communicationController.list);
router.post('/', communicationController.create);
router.get('/:id', communicationController.getById);

// Flujo de comunicación
router.post('/:id/messages', communicationController.addMessage);
router.post('/:id/arguments', communicationController.addArgument);
router.post('/:id/approve', communicationController.approve);
router.post('/:id/submit', communicationController.submit);
router.post('/:id/delivered', communicationController.markDelivered);
router.post('/:id/response', communicationController.receiveResponse);
router.post('/:id/resolve', communicationController.resolve);
router.put('/:id/status', communicationController.updateStatus);
router.post('/:id/archive', communicationController.archive);

module.exports = router;
