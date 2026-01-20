/**
 * Rules Engine Routes
 * API endpoints para motor de reglas aduaneras
 */

const express = require('express');
const router = express.Router();
const rulesEngineController = require('../controllers/rulesEngineController');

/**
 * POST /api/rules/analyze
 * Analisis completo de operacion
 *
 * Body:
 * {
 *   type: 'import' | 'export',
 *   originCountry: 'US',
 *   destinationCountry: 'ES',
 *   goods: [{
 *     taricCode: '8517120000',
 *     description: 'Smartphones',
 *     quantity: 100,
 *     customsValue: 50000
 *   }]
 * }
 */
router.post('/analyze', rulesEngineController.analyzeOperation);

/**
 * POST /api/rules/check-sanctions
 * Verificar sanciones
 */
router.post('/check-sanctions', rulesEngineController.checkSanctions);

/**
 * POST /api/rules/check-preferences
 * Verificar preferencias arancelarias
 */
router.post('/check-preferences', rulesEngineController.checkPreferences);

/**
 * GET /api/rules/agreements/:countryCode
 * Obtener acuerdos comerciales de un pais
 */
router.get('/agreements/:countryCode', rulesEngineController.getAgreements);

/**
 * POST /api/rules/calculate-tariff
 * Calcular arancel
 */
router.post('/calculate-tariff', rulesEngineController.calculateTariff);

/**
 * POST /api/rules/calculate-taxes
 * Calcular todos los impuestos
 */
router.post('/calculate-taxes', rulesEngineController.calculateTaxes);

/**
 * POST /api/rules/check-restrictions
 * Verificar restricciones de producto
 */
router.post('/check-restrictions', rulesEngineController.checkRestrictions);

/**
 * POST /api/rules/check-dual-use
 * Verificar doble uso
 */
router.post('/check-dual-use', rulesEngineController.checkDualUse);

/**
 * POST /api/rules/validate-compliance
 * Validar cumplimiento de requisitos
 */
router.post('/validate-compliance', rulesEngineController.validateCompliance);

/**
 * GET /api/rules/info
 * Informacion del motor de reglas
 */
router.get('/info', rulesEngineController.getInfo);

module.exports = router;
