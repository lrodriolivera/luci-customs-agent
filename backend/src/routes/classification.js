const express = require('express');
const router = express.Router();
const classificationController = require('../controllers/classificationController');
const { auth, optionalAuth } = require('../middleware/auth');
const { classificationValidators } = require('../middleware/validators');

// Rutas publicas (con auth opcional para tracking)
router.get('/chapters', classificationController.getChapters);
router.get('/search', classificationController.searchTaric);
router.get('/taric/:code', classificationValidators.getByCode, classificationController.getTaricInfo);

// Rutas que requieren autenticacion
router.post('/suggest', auth, classificationValidators.suggest, classificationController.suggestTaricCode);
router.post('/validate', auth, classificationController.validateClassification);
router.post('/apply', auth, classificationController.applyClassification);

// Nuevas rutas para calculo de derechos y documentos
router.post('/calculate-duties', auth, classificationController.calculateDuties);
router.get('/required-documents/:code', auth, classificationController.getRequiredDocuments);
router.get('/preferences/:origin', auth, classificationController.getPreferences);
router.post('/seed', auth, classificationController.seedTaricDatabase);

module.exports = router;
