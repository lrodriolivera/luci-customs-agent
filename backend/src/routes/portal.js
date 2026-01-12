const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const { upload, handleUploadError } = require('../middleware/upload');
const { portalValidators } = require('../middleware/validators');

// Rutas del portal del cliente (publicas, autenticadas por token)

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

module.exports = router;
