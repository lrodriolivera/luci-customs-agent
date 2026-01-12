const express = require('express');
const router = express.Router();
const declarationController = require('../controllers/declarationController');
const { auth, requirePermission } = require('../middleware/auth');
const { declarationValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

// Generar declaraciones
router.post('/h1/generate', declarationValidators.generateH1, declarationController.generateH1);
router.post('/h1/generate-direct', declarationController.generateH1Direct);  // Modo demo sin validaciones
router.post('/aes/generate', declarationValidators.generateAES, declarationController.generateAES);

// Obtener/actualizar declaracion
router.get('/:expeditionId/summary', declarationController.getDeclarationSummary);
router.get('/:expeditionId/xml', declarationController.getXML);
router.put('/:expeditionId', declarationController.updateDeclaration);

// Enviar declaracion (requiere permiso especial)
router.post('/:expeditionId/submit', requirePermission('canApproveDeclarations'), declarationController.submitDeclaration);

module.exports = router;
