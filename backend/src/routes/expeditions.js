const express = require('express');
const router = express.Router();
const expeditionController = require('../controllers/expeditionController');
const { auth, requirePermission } = require('../middleware/auth');
const { expeditionValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

// Estadisticas (antes de :id para evitar conflicto)
router.get('/stats', expeditionController.getStats);

// CRUD de expedientes
router.get('/', expeditionValidators.list, expeditionController.list);
router.post('/', requirePermission('canCreateExpeditions'), expeditionValidators.create, expeditionController.create);
router.get('/:id', expeditionValidators.getById, expeditionController.getById);
router.put('/:id', expeditionValidators.update, expeditionController.update);
router.delete('/:id', requirePermission('canDeleteExpeditions'), expeditionValidators.getById, expeditionController.remove);

// Acciones especiales
router.get('/:id/checklist', expeditionValidators.getById, expeditionController.getChecklist);
router.post('/:id/checklist', expeditionValidators.getById, expeditionController.regenerateChecklist);
router.post('/:id/send-portal-link', expeditionValidators.getById, expeditionController.sendPortalLink);

module.exports = router;
