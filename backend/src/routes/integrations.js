/**
 * Integration Routes
 * Rutas para gestión de integraciones con sistemas externos
 */

const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { auth } = require('../middleware/auth');

// Expone datos operativos y de clientes: exige sesion.
router.use(auth);

// ============================================
// General Integration Routes
// ============================================

// Estado y configuración
router.get('/status', integrationController.getStatus);
router.get('/list', integrationController.listIntegrations);
router.get('/info', integrationController.getInfo);
router.get('/config', integrationController.getEnvironmentConfig);
router.get('/stats', integrationController.getUsageStats);
router.get('/services', integrationController.getServicesInfo);

// Integración específica
router.get('/:code', integrationController.getIntegration);
router.get('/:code/test', integrationController.testConnectivity);

// Operaciones multi-integración
router.post('/controls', integrationController.getRequiredControls);

// ============================================
// VUA Routes
// ============================================

router.get('/vua/services', integrationController.vuaGetServices);
router.get('/vua/authorities', integrationController.vuaGetAuthorities);
router.post('/vua/submit', integrationController.vuaSubmitDocument);
router.get('/vua/status/:reference', integrationController.vuaQueryStatus);

// ============================================
// TRACES Routes
// ============================================

router.get('/traces/ched-types', integrationController.tracesGetCHEDTypes);
router.get('/traces/bcps', integrationController.tracesGetBCPs);
router.get('/traces/country/:country/:productType', integrationController.tracesCheckCountry);

router.post('/traces/ched', integrationController.tracesCreateCHED);
router.get('/traces/ched/:reference', integrationController.tracesGetCHED);
router.get('/traces/ched/:reference/status', integrationController.tracesGetCHEDStatus);
router.post('/traces/ched/:reference/submit', integrationController.tracesSubmitCHED);

// ============================================
// NCTS Routes
// ============================================

router.get('/ncts/transit-types', integrationController.nctsGetTransitTypes);
router.get('/ncts/guarantee-types', integrationController.nctsGetGuaranteeTypes);
router.get('/ncts/offices', integrationController.nctsGetOffices);
router.get('/ncts/search', integrationController.nctsSearch);

router.post('/ncts/declaration', integrationController.nctsCreateDeclaration);
router.get('/ncts/declaration/:mrn', integrationController.nctsGetDetail);
router.get('/ncts/declaration/:mrn/status', integrationController.nctsGetStatus);
router.post('/ncts/arrival', integrationController.nctsNotifyArrival);

router.get('/ncts/guarantee/:grn', integrationController.nctsQueryGuarantee);
router.post('/ncts/guarantee/calculate', integrationController.nctsCalculateGuarantee);

module.exports = router;
