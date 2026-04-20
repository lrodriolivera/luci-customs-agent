const express = require('express');
const router = express.Router();
const calculationController = require('../controllers/calculationController');
const { auth, optionalAuth } = require('../middleware/auth');
const { calculationValidators } = require('../middleware/validators');

/**
 * @openapi
 * /api/calculation/exchange-rate:
 *   get:
 *     tags: [calculation]
 *     summary: Tipo de cambio EUR contra divisa (ECB)
 *     security: []
 *     parameters:
 *       - { in: query, name: currency, required: true, schema: { type: string, example: USD } }
 *       - { in: query, name: date, schema: { type: string, format: date } }
 */
router.get('/exchange-rate', calculationController.getExchangeRate);

/**
 * @openapi
 * /api/calculation/duties:
 *   post:
 *     tags: [calculation]
 *     summary: Calcular derechos arancelarios de una mercancía
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taricCode, customsValue]
 *             properties:
 *               taricCode: { type: string }
 *               customsValue: { type: number }
 *               origin: { type: string }
 *               quantity: { type: number }
 */
router.post('/duties', auth, calculationValidators.calculate, calculationController.calculateDuties);

/**
 * @openapi
 * /api/calculation/vat:
 *   post:
 *     tags: [calculation]
 *     summary: Calcular IVA importación
 */
router.post('/vat', auth, calculationController.calculateVat);

/**
 * @openapi
 * /api/calculation/total:
 *   post:
 *     tags: [calculation]
 *     summary: Cálculo completo (arancel + IVA + tasas)
 */
router.post('/total', auth, calculationController.calculateTotal);

/**
 * @openapi
 * /api/calculation/duty-info/{taricCode}:
 *   get:
 *     tags: [calculation]
 *     summary: Info de arancel para un código TARIC (con cache multi-nivel)
 *     parameters:
 *       - { in: path, name: taricCode, required: true, schema: { type: string } }
 *       - { in: query, name: origin, schema: { type: string } }
 */
router.get('/duty-info/:taricCode', auth, calculationController.getDutyInfo);
router.post('/validate-duty', auth, calculationController.validateDutyRate);
router.delete('/cache', auth, calculationController.clearCache);

module.exports = router;
