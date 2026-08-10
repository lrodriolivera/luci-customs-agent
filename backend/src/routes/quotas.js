/**
 * Contingentes Arancelarios (TRQ) — rutas.
 *
 * Dos rutas cambian respecto a la version anterior:
 *  - `POST /reserve` -> `POST /claim-data`. No existia reserva: el cupo lo
 *    atribuye la aduana al admitir la declaracion, y devolver un
 *    `reservationId` con 30 dias de validez hacia creer lo contrario.
 *  - `GET /by-agreement/:codigo` se retira. La fuente oficial no clasifica los
 *    contingentes por acuerdo comercial y los que se devolvian estaban
 *    inventados (incluido EU-MERCOSUR, que no esta en vigor).
 */

const express = require('express');
const router = express.Router();
const quotaController = require('../controllers/quotaController');

/**
 * POST /api/quotas/check-availability
 * Body: { taricCode, originCountry, quantity, unit?, year? }
 */
router.post('/check-availability', quotaController.checkAvailability);

/**
 * POST /api/quotas/claim-data
 * Datos para consignar el contingente en la declaracion. NO reserva cupo.
 * Body: { orderNumber, quantity, year? }
 */
router.post('/claim-data', quotaController.getClaimData);

/**
 * POST /api/quotas/calculate-savings
 * Body: { taricCode, originCountry, quantity, customsValue, inQuotaDuty?, outQuotaDuty? }
 *
 * Los dos tipos los aporta el llamante: el sistema de contingentes no publica el
 * tipo dentro del contingente. Sin ellos la respuesta dice que no se puede
 * cuantificar el ahorro.
 */
router.post('/calculate-savings', quotaController.calculateSavings);

/**
 * POST /api/quotas/report
 * Body (opcional): { year?, orderNumber?, taricCode?, limit? }
 */
router.post('/report', quotaController.generateReport);

/**
 * GET /api/quotas/list?year=&page=&limit=
 * Paginado: la fuente publica ~1.125 contingentes por ano.
 */
router.get('/list', quotaController.listAll);

/**
 * GET /api/quotas/critical?year=
 * Contingentes que TARIC declara criticos (no un umbral de consumo).
 */
router.get('/critical', quotaController.getCritical);

/**
 * GET /api/quotas/info
 * Estado de la sincronizacion y limitaciones del dato.
 */
router.get('/info', quotaController.getInfo);

/**
 * GET /api/quotas/:orderNumber?year=
 * Va al final: si no, capturaria /list, /critical e /info.
 */
router.get('/:orderNumber', quotaController.getByOrderNumber);

module.exports = router;
