/**
 * Quota Routes
 * API endpoints para gestión de Contingentes Arancelarios (TRQ)
 */

const express = require('express');
const router = express.Router();
const quotaController = require('../controllers/quotaController');

/**
 * POST /api/quotas/check-availability
 * Verificar disponibilidad de contingente
 *
 * Body:
 * {
 *   taricCode: '02011000',
 *   originCountry: 'AR',
 *   quantity: 10000,
 *   unit: 'kg'
 * }
 */
router.post('/check-availability', quotaController.checkAvailability);

/**
 * POST /api/quotas/reserve
 * Reservar contingente
 *
 * Body:
 * {
 *   quotaId: 'Q090001',
 *   quantity: 5000,
 *   operation: { ... }
 * }
 */
router.post('/reserve', quotaController.reserveQuota);

/**
 * POST /api/quotas/calculate-savings
 * Calcular ahorro potencial usando contingente
 *
 * Body:
 * {
 *   taricCode: '02011000',
 *   originCountry: 'AR',
 *   quantity: 10000,
 *   customsValue: 50000
 * }
 */
router.post('/calculate-savings', quotaController.calculateSavings);

/**
 * POST /api/quotas/report
 * Generar reporte de contingentes con filtros opcionales
 *
 * Body (opcional):
 * {
 *   type: 'fta',
 *   agreement: 'CETA',
 *   originCountry: 'CA'
 * }
 */
router.post('/report', quotaController.generateReport);

/**
 * GET /api/quotas/list
 * Listar todos los contingentes activos
 */
router.get('/list', quotaController.listAll);

/**
 * GET /api/quotas/critical
 * Obtener contingentes críticos (>90% utilización)
 */
router.get('/critical', quotaController.getCritical);

/**
 * GET /api/quotas/by-agreement/:agreementCode
 * Obtener contingentes por acuerdo comercial
 *
 * Ejemplos:
 * - /api/quotas/by-agreement/CETA
 * - /api/quotas/by-agreement/JEFTA
 * - /api/quotas/by-agreement/EU-MERCOSUR
 */
router.get('/by-agreement/:agreementCode', quotaController.getByAgreement);

/**
 * GET /api/quotas/:orderNumber
 * Obtener detalles de un contingente específico por número de orden
 *
 * Ejemplo: /api/quotas/090001
 */
router.get('/info', quotaController.getInfo);
router.get('/:orderNumber', quotaController.getByOrderNumber);

module.exports = router;
