/**
 * Preferences Routes
 * API endpoints para gestion de Preferencias Arancelarias
 *
 * Stock Logistic - LUCI Customs Agent
 */

const express = require('express');
const router = express.Router();
const preferencesController = require('../controllers/preferencesController');

/**
 * POST /api/preferences/eligibility
 * Verificar elegibilidad para preferencias arancelarias
 *
 * Body:
 * {
 *   originCountry: 'CA',
 *   goods: [
 *     { taricCode: '8517120000', customsValue: 50000, description: 'Smartphones' }
 *   ]
 * }
 */
router.post('/eligibility', preferencesController.checkEligibility);

/**
 * GET /api/preferences/agreements
 * Listar todos los acuerdos preferenciales disponibles
 */
router.get('/agreements', preferencesController.listAgreements);

/**
 * GET /api/preferences/agreements/:key
 * Obtener informacion de un acuerdo especifico
 *
 * Params:
 *   key - Clave del acuerdo (ej: 'CETA', 'JEFTA', 'EU-UK')
 */
router.get('/agreements/:key', preferencesController.getAgreement);

/**
 * GET /api/preferences/country/:code
 * Obtener acuerdos aplicables para un pais especifico
 *
 * Params:
 *   code - Codigo ISO-2 del pais (ej: 'CA', 'JP', 'GB')
 */
router.get('/country/:code', preferencesController.getByCountry);

/**
 * POST /api/preferences/validate-certificate
 * Validar un certificado de origen
 *
 * Body:
 * {
 *   type: 'EUR.1',
 *   certificateNumber: 'ES123456',
 *   issuedDate: '2024-01-15',
 *   exporterName: 'Company X',
 *   consigneeName: 'Company Y',
 *   originCountry: 'CA'
 * }
 */
router.post('/validate-certificate', preferencesController.validateCertificate);

/**
 * POST /api/preferences/optimize
 * Obtener recomendaciones de optimizacion para una operacion
 *
 * Body:
 * {
 *   originCountry: 'CA',
 *   goods: [
 *     { taricCode: '8517120000', customsValue: 50000 }
 *   ],
 *   materials: [] // opcional, para verificar acumulacion
 * }
 */
router.post('/optimize', preferencesController.getRecommendations);

/**
 * GET /api/preferences/origin-rules/:chapter
 * Obtener reglas de origen para un capitulo TARIC
 *
 * Params:
 *   chapter - Capitulo TARIC (2 digitos, ej: '84', '85')
 */
router.get('/origin-rules/:chapter', preferencesController.getOriginRules);

/**
 * GET /api/preferences/info
 * Informacion general sobre el sistema de preferencias
 */
router.get('/info', preferencesController.getInfo);

module.exports = router;
