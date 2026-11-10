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

// Leer el documento con IA y proponer cambios al expediente (no modifica nada)
router.post('/:expeditionId/:docId/extract', documentValidators.validate, documentController.extractDocument);

// Propuesta de cambios de un documento ya leido (sin volver a llamar a la IA)
router.get('/:expeditionId/:docId/proposal', documentController.getProposal);

// Aplicar al expediente los datos leidos que marque el agente
router.post('/:expeditionId/:docId/apply', documentValidators.validate, documentController.applyExtraction);

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
