const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { auth } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { documentValidators } = require('../middleware/validators');

// Todas las rutas requieren autenticacion
router.use(auth);

// Subir documento
router.post(
  '/upload',
  upload.single('file'),
  handleUploadError,
  documentValidators.upload,
  documentController.upload
);

// Obtener documento
router.get('/:expeditionId/:docId', documentController.getDocument);

// Validar documento con IA
router.post('/:expeditionId/:docId/validate', documentValidators.validate, documentController.validateDocument);

// Obtener datos extraidos
router.get('/:expeditionId/:docId/extracted', documentController.getExtractedData);

// Eliminar documento
router.delete('/:expeditionId/:docId', documentController.deleteDocument);

// Validar todos los documentos pendientes
router.post('/:expeditionId/validate-all', documentController.validateAll);

module.exports = router;
