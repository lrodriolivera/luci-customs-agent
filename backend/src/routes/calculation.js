const express = require('express');
const router = express.Router();
const calculationController = require('../controllers/calculationController');
const { auth, optionalAuth } = require('../middleware/auth');
const { calculationValidators } = require('../middleware/validators');

// Ruta publica para tipo de cambio
router.get('/exchange-rate', calculationController.getExchangeRate);

// Rutas que requieren autenticacion
router.post('/duties', auth, calculationValidators.calculate, calculationController.calculateDuties);
router.post('/vat', auth, calculationController.calculateVat);
router.post('/total', auth, calculationController.calculateTotal);

// Nuevos endpoints con IA
router.get('/duty-info/:taricCode', auth, calculationController.getDutyInfo);
router.post('/validate-duty', auth, calculationController.validateDutyRate);
router.delete('/cache', auth, calculationController.clearCache);

module.exports = router;
