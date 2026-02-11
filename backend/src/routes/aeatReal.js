/**
 * AEAT Real Routes
 * Rutas para integración real con servicios web AEAT
 * STRIX AI - LUCI Customs Agent
 *
 * Fase 6.1: Integración Real AEAT
 */

const express = require('express');
const router = express.Router();
const aeatRealController = require('../controllers/aeatRealController');
const { auth, requirePermission } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(auth);

// ============================================
// GESTIÓN DE CERTIFICADOS DIGITALES
// ============================================

// Importar certificado digital (solo admin)
router.post('/certificates/import',
  requirePermission('canManageCertificates'),
  aeatRealController.importCertificate
);

// Listar certificados disponibles
router.get('/certificates',
  aeatRealController.listCertificates
);

// Obtener información de un certificado
router.get('/certificates/:alias',
  aeatRealController.getCertificateInfo
);

// Verificar estado de certificado
router.get('/certificates/:alias/verify',
  aeatRealController.verifyCertificate
);

// Eliminar certificado (solo admin)
router.delete('/certificates/:alias',
  requirePermission('canManageCertificates'),
  aeatRealController.deleteCertificate
);

// Validar certificado para operación específica
router.post('/certificates/validate-for-operation',
  aeatRealController.validateCertificateForOperation
);

// ============================================
// FIRMA ELECTRÓNICA XAdES
// ============================================

// Firmar documento XML para AEAT
router.post('/signature/sign',
  requirePermission('canSignDeclarations'),
  aeatRealController.signDocument
);

// Verificar firma de respuesta AEAT
router.post('/signature/verify',
  aeatRealController.verifySignature
);

// ============================================
// ENVÍO DE DECLARACIONES
// ============================================

// Enviar declaración H1 (importación)
router.post('/declarations/h1/submit',
  requirePermission('canApproveDeclarations'),
  aeatRealController.submitH1Declaration
);

// Enviar declaración H7 (bajo valor)
router.post('/declarations/h7/submit',
  requirePermission('canApproveDeclarations'),
  aeatRealController.submitH7Declaration
);

// Enviar declaración AES (exportación)
router.post('/declarations/aes/submit',
  requirePermission('canApproveDeclarations'),
  aeatRealController.submitAESDeclaration
);

// Enviar declaración NCTS (tránsito)
router.post('/declarations/ncts/submit',
  requirePermission('canApproveDeclarations'),
  aeatRealController.submitNCTSDeclaration
);

// Enviar declaración ICS2 (seguridad)
router.post('/declarations/ics2/submit',
  requirePermission('canApproveDeclarations'),
  aeatRealController.submitICS2Declaration
);

// Consultar estado de declaración
router.get('/declarations/:mrn/status',
  aeatRealController.getDeclarationStatus
);

// Obtener bandeja de entrada de AEAT
router.get('/inbox',
  aeatRealController.getInbox
);

// ============================================
// MONITOREO DE ESTADO CON LUCI
// ============================================

// Iniciar tracking de declaración
router.post('/monitoring/track',
  aeatRealController.trackDeclaration
);

// Obtener declaraciones monitoreadas
router.get('/monitoring/tracked',
  aeatRealController.getTrackedDeclarations
);

// Refrescar estado de declaración
router.post('/monitoring/:mrn/refresh',
  aeatRealController.refreshDeclarationStatus
);

// Obtener alertas activas
router.get('/monitoring/alerts',
  aeatRealController.getActiveAlerts
);

// Confirmar alerta
router.post('/monitoring/alerts/:alertId/acknowledge',
  aeatRealController.acknowledgeAlert
);

// Predecir canal de inspección con LUCI
router.post('/monitoring/predict-channel',
  aeatRealController.predictInspectionChannel
);

// ============================================
// DOCUMENTOS DIGITALES
// ============================================

// Enviar documentos digitales a AEAT
router.post('/documents/submit',
  requirePermission('canUploadDocuments'),
  aeatRealController.submitDigitalDocuments
);

// ============================================
// CONECTIVIDAD Y DIAGNÓSTICO
// ============================================

// Probar conectividad con AEAT
router.post('/connectivity/test',
  aeatRealController.testConnectivity
);

// Obtener estado general del servicio
router.get('/service-status',
  aeatRealController.getServiceStatus
);

// Cambiar entorno (sandbox/producción) - solo admin
router.post('/environment',
  requirePermission('canConfigureSystem'),
  aeatRealController.setEnvironment
);

// Recargar certificado SSL - solo admin
router.post('/reload-certificate',
  requirePermission('canManageCertificates'),
  aeatRealController.reloadSSLCertificate
);

// ============================================
// IMPUESTOS ESPECIALES (SILICIE/EMCS)
// ============================================

// Enviar movimiento EMCS
router.post('/emcs/movement',
  requirePermission('canApproveDeclarations'),
  aeatRealController.submitEMCSMovement
);

// Consultar SILICIE
router.post('/silicie/query',
  aeatRealController.querySILICIE
);

module.exports = router;
