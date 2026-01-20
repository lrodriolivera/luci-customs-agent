/**
 * Excise Duties Routes
 * API endpoints para gestión de Impuestos Especiales (SILICIE)
 */

const express = require('express');
const router = express.Router();
const exciseDutiesController = require('../controllers/exciseDutiesController');

/**
 * POST /api/excise/detect
 * Detectar si producto está sujeto a impuestos especiales
 *
 * Body:
 * {
 *   taricCode: '2203000010'
 * }
 */
router.post('/detect', exciseDutiesController.detectExciseProduct);

/**
 * POST /api/excise/calculate
 * Calcular impuesto especial para un producto
 *
 * Body:
 * {
 *   taricCode: '2203000010',
 *   description: 'Cerveza',
 *   quantity: 1000,
 *   unit: 'L',
 *   alcoholContent: 5.0,
 *   price: 2000
 * }
 */
router.post('/calculate', exciseDutiesController.calculateExciseDuty);

/**
 * POST /api/excise/calculate-total
 * Calcular impuestos especiales totales para múltiples productos
 *
 * Body:
 * {
 *   goods: [
 *     { taricCode: '2203000010', description: 'Cerveza', quantity: 1000, alcoholContent: 5.0 },
 *     { taricCode: '2402200000', description: 'Cigarrillos', quantity: 10000, price: 5000 }
 *   ]
 * }
 */
router.post('/calculate-total', exciseDutiesController.calculateTotalExciseDuties);

/**
 * POST /api/excise/generate-document
 * Generar documento DUA-SILICIE
 *
 * Body:
 * {
 *   operation: {
 *     type: 'import',
 *     originCountry: 'FR',
 *     destinationCountry: 'ES'
 *   },
 *   goods: [...]
 * }
 */
router.post('/generate-document', exciseDutiesController.generateSILICIEDocument);

/**
 * POST /api/excise/check-exemptions
 * Verificar exenciones aplicables
 *
 * Body:
 * {
 *   product: { taricCode: '2207100000', description: 'Alcohol etílico' },
 *   usage: 'medical use in hospital'
 * }
 */
router.post('/check-exemptions', exciseDutiesController.checkExemptions);

/**
 * GET /api/excise/categories
 * Obtener categorías de productos sujetos a impuestos especiales
 */
router.get('/categories', exciseDutiesController.getCategories);

/**
 * GET /api/excise/rates
 * Obtener tarifas actuales de impuestos especiales
 */
router.get('/rates', exciseDutiesController.getRates);

/**
 * GET /api/excise/exemptions
 * Obtener lista de exenciones disponibles
 */
router.get('/exemptions', exciseDutiesController.getExemptions);

/**
 * GET /api/excise/info
 * Información sobre el sistema SILICIE
 */
router.get('/info', exciseDutiesController.getInfo);

module.exports = router;
