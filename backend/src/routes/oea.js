/**
 * OEA Routes - Operador Economico Autorizado
 * Authorized Economic Operator Routes
 *
 * STRIX AI - LUCI Customs Agent
 */

const express = require('express');
const router = express.Router();
const oeaController = require('../controllers/oeaController');
const { auth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion: exponian datos de clientes
// (NIF, EORI, MRN, expedientes, inspecciones) a cualquiera sin token.
router.use(auth);

// ============================================
// Information & Catalog Routes
// ============================================

// GET /api/oea/info - System information
router.get('/info', oeaController.getInfo);

// GET /api/oea/stats - Statistics
router.get('/stats', oeaController.getStats);

// GET /api/oea/expiring - Expiring certifications
router.get('/expiring', oeaController.getExpiring);

// GET /api/oea/benefits - Benefits catalog
router.get('/benefits', oeaController.getBenefitsCatalog);

// GET /api/oea/simplifications - Available simplifications
router.get('/simplifications', oeaController.getSimplifications);

// GET /api/oea/mutual-recognition - Mutual recognition partners
router.get('/mutual-recognition', oeaController.getMutualRecognition);

// ============================================
// CRUD Operations
// ============================================

// POST /api/oea - Create new OEA application
router.post('/', oeaController.create);

// GET /api/oea - List all OEA records
router.get('/', oeaController.list);

// GET /api/oea/eori/:eori - Get by EORI
router.get('/eori/:eori', oeaController.getByEORI);

// GET /api/oea/nif/:nif - Get by NIF
router.get('/nif/:nif', oeaController.getByNIF);

// GET /api/oea/:id - Get specific OEA record
router.get('/:id', oeaController.getById);

// PUT /api/oea/:id - Update OEA record
router.put('/:id', oeaController.update);

// ============================================
// Certification Lifecycle
// ============================================

// POST /api/oea/:id/submit - Submit for review
router.post('/:id/submit', oeaController.submitForReview);

// POST /api/oea/:id/approve - Approve certification
router.post('/:id/approve', oeaController.approve);

// POST /api/oea/:id/suspend - Suspend certification
router.post('/:id/suspend', oeaController.suspend);

// POST /api/oea/:id/revoke - Revoke certification
router.post('/:id/revoke', oeaController.revoke);

// POST /api/oea/:id/renewal/initiate - Initiate renewal
router.post('/:id/renewal/initiate', oeaController.initiateRenewal);

// POST /api/oea/:id/renewal/complete - Complete renewal
router.post('/:id/renewal/complete', oeaController.completeRenewal);

// ============================================
// Audits & Compliance
// ============================================

// POST /api/oea/:id/audits - Add audit
router.post('/:id/audits', oeaController.addAudit);

// PUT /api/oea/:id/requirements/:requirement - Update requirement
router.put('/:id/requirements/:requirement', oeaController.updateRequirement);

// POST /api/oea/:id/compliance - Add compliance record
router.post('/:id/compliance', oeaController.addComplianceRecord);

// ============================================
// Benefits & Simplifications
// ============================================

// POST /api/oea/:id/simplifications - Grant simplification
router.post('/:id/simplifications', oeaController.grantSimplification);

// POST /api/oea/:id/guarantee-reduction - Calculate guarantee reduction
router.post('/:id/guarantee-reduction', oeaController.calculateGuaranteeReduction);

// ============================================
// Alerts
// ============================================

// POST /api/oea/:id/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/:id/alerts/:alertId/acknowledge', oeaController.acknowledgeAlert);

// POST /api/oea/:id/alerts/:alertId/resolve - Resolve alert
router.post('/:id/alerts/:alertId/resolve', oeaController.resolveAlert);

module.exports = router;
