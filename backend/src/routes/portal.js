const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const clientPortalController = require('../controllers/clientPortalController');
const { upload, handleUploadError } = require('../middleware/upload');
const { portalValidators } = require('../middleware/validators');
const { authenticate, requireRole } = require('../middleware/auth');

// ==================== API Key Management (authenticated users) ====================
//
// Van ANTES de las rutas de portal porque estas empiezan por '/:token', que
// captura cualquier primer segmento: con '/api-keys' declarado despues, Express
// resolvia GET /api/portal/api-keys contra '/:token' y el validador rechazaba
// "api-keys" como token, dejando la ruta inalcanzable.

// Create API key
router.post('/api-keys', authenticate, requireRole('admin'), clientPortalController.createApiKey);

// List API keys
router.get('/api-keys', authenticate, requireRole('admin'), clientPortalController.listApiKeys);

// Revoke API key
router.delete('/api-keys/:keyId', authenticate, requireRole('admin'), clientPortalController.revokeApiKey);

// ==================== Public Portal Routes (token-based auth) ====================

// Obtener expediente
router.get('/:token', portalValidators.getByToken, portalController.getByToken);

// Chat
router.get('/:token/chat', portalValidators.getByToken, portalController.getChatHistory);
router.post('/:token/chat', portalValidators.sendMessage, portalController.sendMessage);

// Documentos
router.post(
  '/:token/documents',
  portalValidators.getByToken,
  upload.single('file'),
  handleUploadError,
  portalController.uploadDocument
);
router.get('/:token/documents/:docId', portalController.getDocument);

// Mensajes no leidos
router.get('/:token/unread', portalValidators.getByToken, portalController.getUnreadCount);

// ==================== AI Endpoints - LUCI Integration ====================

// Chat mejorado con IA contextual
router.post('/:token/ai/chat', portalValidators.getByToken, portalController.aiEnhancedChat);

// Detectar FAQ y responder automáticamente
router.post('/:token/ai/faq', portalValidators.getByToken, portalController.aiDetectFAQ);

// Generar resumen del expediente para cliente
router.get('/:token/ai/summary', portalValidators.getByToken, portalController.aiGetSummary);

// Generar notificación inteligente
router.post('/:token/ai/notification', portalValidators.getByToken, portalController.aiGenerateNotification);

// Análisis completo del portal para el cliente
router.get('/:token/ai/full-analysis', portalValidators.getByToken, portalController.aiFullAnalysis);

// ==================== Self-Service Routes ====================

// Create new expedition (self-service)
router.post('/self-service/expeditions', clientPortalController.createExpedition);

// Update expedition from portal
router.put('/:token/expedition', portalValidators.getByToken, clientPortalController.updateExpedition);

// Submit expedition for processing
router.post('/:token/submit', portalValidators.getByToken, clientPortalController.submitExpedition);

// ==================== Payment Routes ====================

// Get payments for expedition
router.get('/:token/payments', portalValidators.getByToken, clientPortalController.getPayments);

// Create payment
router.post('/:token/payments', portalValidators.getByToken, clientPortalController.createPayment);

// Create checkout session
router.post('/:token/payments/:paymentId/checkout', portalValidators.getByToken, clientPortalController.createCheckoutSession);

// Get payment status
router.get('/:token/payments/:paymentId', portalValidators.getByToken, clientPortalController.getPaymentStatus);

// ==================== Statistics Routes ====================

// Get client statistics
router.get('/:token/stats', portalValidators.getByToken, clientPortalController.getClientStats);

// Get client history
router.get('/:token/history', portalValidators.getByToken, clientPortalController.getClientHistory);

// ==================== Signed Documents Routes ====================

// List signed documents
router.get('/:token/signed-documents', portalValidators.getByToken, clientPortalController.getSignedDocuments);

// Download levante
router.get('/:token/signed-documents/levante', portalValidators.getByToken, clientPortalController.downloadLevante);

// Download declaration copy
router.get('/:token/signed-documents/declaration', portalValidators.getByToken, clientPortalController.downloadDeclaration);

// ==================== PDF Downloads (public via token) ====================

const pdfGenerator = require('../services/pdfGenerator');

// Download declaration PDF via portal
router.get('/:token/declaration-pdf', portalValidators.getByToken, async (req, res) => {
  try {
    const { Expedition } = require('../models');
    const expedition = await Expedition.findOne({ 'clientPortal.token': req.params.token }).lean();
    if (!expedition) return res.status(404).json({ success: false, error: 'Expediente no encontrado' });

    const isExport = expedition.operationType === 'export' || expedition.operationType === 'EXPORT';
    const pdfBuffer = isExport
      ? await pdfGenerator.generateAESPDF(expedition)
      : await pdfGenerator.generateH1PDF(expedition);

    const type = isExport ? 'AES' : 'H1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${type}_${expedition.expeditionId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download expedition summary PDF via portal
router.get('/:token/summary-pdf', portalValidators.getByToken, async (req, res) => {
  try {
    const { Expedition } = require('../models');
    const expedition = await Expedition.findOne({ 'clientPortal.token': req.params.token }).lean();
    if (!expedition) return res.status(404).json({ success: false, error: 'Expediente no encontrado' });

    const pdfBuffer = await pdfGenerator.generateExpeditionSummaryPDF(expedition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Resumen_${expedition.expeditionId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
