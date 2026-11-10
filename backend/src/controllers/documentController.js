const { Expedition } = require('../models');
const logger = require('../config/logger');
const aiService = require('../services/aiService');
const { fileUtils } = require('../middleware/upload');
const { ensureSameTenant } = require('../utils/tenantGuard');
const { proponerCambios, aplicarCambios } = require('../services/documentos/extraccionDocumento');
const borradores = require('../services/documentos/borradoresDocumento');

/**
 * Subir documento a un expediente
 * POST /api/documents/upload
 */
const upload = async (req, res) => {
  try {
    const { expeditionId, documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha proporcionado archivo'
      });
    }

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    // Crear documento
    const document = {
      type: documentType,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user._id,
      status: 'pending'
    };

    expedition.documents.push(document);

    // Actualizar checklist
    const checklistItem = expedition.documentChecklist.find(
      item => item.documentType === documentType
    );
    if (checklistItem) {
      checklistItem.received = true;
      checklistItem.documentId = expedition.documents[expedition.documents.length - 1]._id;
    }

    // Timeline
    expedition.timeline.push({
      action: 'document_uploaded',
      description: `Documento ${documentType} subido`,
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { documentType, fileName: req.file.originalname }
    });

    await expedition.save();

    logger.info(`Documento subido: ${expedition.expeditionId} - ${documentType}`);

    res.json({
      success: true,
      data: {
        document: expedition.documents[expedition.documents.length - 1],
        checklist: expedition.documentChecklist
      }
    });

  } catch (error) {
    logger.error('Error subiendo documento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al subir documento'
    });
  }
};

/**
 * Obtener documento
 * GET /api/documents/:expeditionId/:docId
 */
const getDocument = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Verificar que el archivo existe
    if (!fileUtils.fileExists(document.fileName)) {
      return res.status(404).json({
        success: false,
        error: 'Archivo no encontrado en el servidor'
      });
    }

    res.download(document.filePath, document.originalName);

  } catch (error) {
    logger.error('Error descargando documento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al descargar documento'
    });
  }
};

/**
 * Validar documento con IA
 * POST /api/documents/:expeditionId/:docId/validate
 */
const validateDocument = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Actualizar estado
    document.status = 'validating';
    await expedition.save();

    // Llamar al servicio de IA para validar
    const validationResult = await aiService.validateDocument(
      document,
      expedition
    );

    // Actualizar documento con resultados
    document.status = validationResult.isValid ? 'validated' : 'needs_revision';
    document.validationNotes = validationResult.notes;
    document.validatedAt = new Date();
    document.validatedBy = req.user._id;
    document.extractedData = validationResult.extractedData;
    document.aiConfidence = validationResult.confidence;

    // Actualizar checklist
    const checklistItem = expedition.documentChecklist.find(
      item => item.documentId?.toString() === docId
    );
    if (checklistItem) {
      checklistItem.validated = validationResult.isValid;
      checklistItem.notes = validationResult.notes;
    }

    // Timeline
    expedition.timeline.push({
      action: 'document_validated',
      description: `Documento ${document.type} ${validationResult.isValid ? 'validado' : 'requiere revision'}`,
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: {
        documentType: document.type,
        isValid: validationResult.isValid,
        confidence: validationResult.confidence
      }
    });

    // Si hay datos extraidos, actualizar expediente
    if (validationResult.extractedData && validationResult.autoFillSuggestions) {
      expedition.aiAnalysis = expedition.aiAnalysis || {};
      expedition.aiAnalysis.documentValidation = expedition.aiAnalysis.documentValidation || {};
      expedition.aiAnalysis.documentValidation[document.type] = validationResult.extractedData;
      expedition.aiAnalysis.lastAnalysisAt = new Date();
    }

    await expedition.save();

    logger.info(`Documento validado: ${expedition.expeditionId} - ${document.type}`);

    res.json({
      success: true,
      data: {
        document,
        validation: validationResult,
        autoFillSuggestions: validationResult.autoFillSuggestions
      }
    });

  } catch (error) {
    logger.error('Error validando documento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar documento'
    });
  }
};

/**
 * Obtener datos extraidos de un documento
 * GET /api/documents/:expeditionId/:docId/extracted
 */
const getExtractedData = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    if (!document.extractedData) {
      return res.status(404).json({
        success: false,
        error: 'No hay datos extraidos para este documento. Ejecute la validacion primero.'
      });
    }

    res.json({
      success: true,
      data: {
        extractedData: document.extractedData,
        confidence: document.aiConfidence,
        validatedAt: document.validatedAt
      }
    });

  } catch (error) {
    logger.error('Error obteniendo datos extraidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos extraidos'
    });
  }
};

/**
 * Eliminar documento
 * DELETE /api/documents/:expeditionId/:docId
 */
const deleteDocument = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Eliminar archivo fisico
    fileUtils.deleteFile(document.fileName);

    // Eliminar de la lista de documentos
    document.deleteOne();

    // Actualizar checklist
    const checklistItem = expedition.documentChecklist.find(
      item => item.documentId?.toString() === docId
    );
    if (checklistItem) {
      checklistItem.received = false;
      checklistItem.validated = false;
      checklistItem.documentId = null;
    }

    // Timeline
    expedition.timeline.push({
      action: 'document_deleted',
      description: `Documento ${document.type} eliminado`,
      userId: req.user._id,
      performedBy: req.user.name
    });

    await expedition.save();

    logger.info(`Documento eliminado: ${expedition.expeditionId} - ${document.type}`);

    res.json({
      success: true,
      message: 'Documento eliminado correctamente'
    });

  } catch (error) {
    logger.error('Error eliminando documento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar documento'
    });
  }
};

/**
 * Validar todos los documentos pendientes
 * POST /api/documents/:expeditionId/validate-all
 */
const validateAll = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const pendingDocs = expedition.documents.filter(d => d.status === 'pending');

    if (pendingDocs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay documentos pendientes de validacion'
      });
    }

    // Validar cada documento
    const results = [];
    for (const doc of pendingDocs) {
      try {
        doc.status = 'validating';
        const validationResult = await aiService.validateDocument(doc, expedition);

        doc.status = validationResult.isValid ? 'validated' : 'needs_revision';
        doc.validationNotes = validationResult.notes;
        doc.validatedAt = new Date();
        doc.validatedBy = req.user._id;
        doc.extractedData = validationResult.extractedData;
        doc.aiConfidence = validationResult.confidence;

        results.push({
          documentId: doc._id,
          type: doc.type,
          isValid: validationResult.isValid,
          confidence: validationResult.confidence
        });
      } catch (err) {
        doc.status = 'needs_revision';
        doc.validationNotes = 'Error durante la validacion automatica';
        results.push({
          documentId: doc._id,
          type: doc.type,
          isValid: false,
          error: err.message
        });
      }
    }

    // Actualizar status del expediente. Recorrer el checklist (no los documentos
    // ya subidos): un item requerido sin documentId (nunca subido) debe impedir
    // marcar el expediente como validado, no quedar fuera del calculo en silencio.
    const allValidated = expedition.documentChecklist
      .filter(item => item.required)
      .every(item => {
        if (!item.documentId) return false;
        const doc = expedition.documents.find(d => d._id.toString() === item.documentId.toString());
        return doc?.status === 'validated';
      });

    if (allValidated) {
      expedition.status = 'documents_validated';
    } else {
      expedition.status = 'documents_incomplete';
    }

    await expedition.save();

    res.json({
      success: true,
      data: {
        results,
        expeditionStatus: expedition.status
      }
    });

  } catch (error) {
    logger.error('Error validando todos los documentos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar documentos'
    });
  }
};

// Con la declaracion presentada, los datos del expediente son los que constan
// ante la AEAT: la lectura de un documento ya no puede cambiarlos.
const ESTADOS_SIN_CAMBIOS = [
  'declaration_submitted', 'green_channel', 'orange_channel', 'red_channel', 'levante', 'completed', 'cancelled'
];

/**
 * Subir y leer un documento en el alta, antes de que exista el expediente
 * POST /api/documents/drafts   (multipart: documentType, file)
 *
 * Devuelve lo leido para que la pantalla de alta rellene el formulario. El
 * documento queda como borrador del usuario y se adjunta al crear el expediente.
 */
const createDraft = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha proporcionado archivo' });
    }
    const data = await borradores.crearBorrador({ user: req.user, file: req.file, tipo: req.body.documentType });
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error('Error leyendo documento del alta:', error);
    res.status(500).json({ success: false, error: 'Error al leer el documento' });
  }
};

/**
 * Descartar un documento subido en el alta
 * DELETE /api/documents/drafts/:draftId
 */
const deleteDraft = async (req, res) => {
  try {
    const eliminado = await borradores.eliminarBorrador(req.params.draftId, req.user);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error descartando documento del alta:', error);
    res.status(500).json({ success: false, error: 'Error al descartar el documento' });
  }
};

/**
 * Leer un documento con IA y proponer cambios al expediente
 * POST /api/documents/:expeditionId/:docId/extract
 *
 * Guarda lo leido en el documento y devuelve la propuesta. No modifica ningun
 * dato del expediente: eso solo ocurre en /apply, con lo que marque el agente.
 */
const extractDocument = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;
    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }

    const lectura = await aiService.extractDocumentData(document);
    const { leido, modelo, ...datos } = lectura;

    document.extractedData = { ...datos, leido, modelo: modelo || null, leidoEn: new Date() };
    document.aiConfidence = datos.confianza;
    expedition.markModified('documents');
    expedition.timeline.push({
      action: 'document_read',
      description: `Documento ${document.originalName} ${leido && datos.legible ? 'leido' : 'no se pudo leer'}`,
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { documentType: document.type, confidence: datos.confianza }
    });
    await expedition.save();

    res.json({
      success: true,
      data: {
        document,
        extraction: document.extractedData,
        proposal: proponerCambios(expedition, datos, document.type)
      }
    });
  } catch (error) {
    logger.error('Error leyendo documento:', error);
    res.status(500).json({ success: false, error: 'Error al leer el documento' });
  }
};

/**
 * Propuesta de cambios de un documento ya leido (no vuelve a llamar a la IA)
 * GET /api/documents/:expeditionId/:docId/proposal
 */
const getProposal = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;
    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }

    const extraction = document.extractedData || null;
    res.json({
      success: true,
      data: {
        extraction,
        proposal: extraction ? proponerCambios(expedition, extraction, document.type) : []
      }
    });
  } catch (error) {
    logger.error('Error calculando la propuesta del documento:', error);
    res.status(500).json({ success: false, error: 'Error al obtener la propuesta del documento' });
  }
};

/**
 * Aplicar al expediente los datos leidos que el agente ha marcado
 * POST /api/documents/:expeditionId/:docId/apply   { fields: string[] }
 */
const applyExtraction = async (req, res) => {
  try {
    const { expeditionId, docId } = req.params;
    const fields = Array.isArray(req.body?.fields) ? req.body.fields.filter(f => typeof f === 'string').slice(0, 500) : [];
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No se ha indicado ningun dato para aplicar' });
    }

    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const document = expedition.documents.id(docId);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }
    if (!document.extractedData || document.extractedData.legible === false) {
      return res.status(400).json({ success: false, error: 'El documento no tiene datos leidos que aplicar' });
    }
    if (ESTADOS_SIN_CAMBIOS.includes(expedition.status)) {
      return res.status(409).json({
        success: false,
        error: 'La declaracion ya esta presentada: los datos del expediente no se pueden cambiar desde un documento'
      });
    }

    const aplicados = aplicarCambios(expedition, document.extractedData, document.type, fields);
    if (aplicados.length === 0) {
      return res.status(400).json({ success: false, error: 'Ninguno de los datos indicados se puede aplicar ya' });
    }

    expedition.timeline.push({
      action: 'document_data_applied',
      description: `Aplicados ${aplicados.length} dato(s) de ${document.originalName}`,
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { documentType: document.type, fields: aplicados.map(c => c.clave) }
    });
    await expedition.save();

    res.json({
      success: true,
      data: {
        expedition,
        applied: aplicados,
        proposal: proponerCambios(expedition, document.extractedData, document.type)
      }
    });
  } catch (error) {
    logger.error('Error aplicando datos del documento:', error);
    res.status(500).json({ success: false, error: 'Error al aplicar los datos del documento' });
  }
};

module.exports = {
  createDraft,
  deleteDraft,
  extractDocument,
  getProposal,
  applyExtraction,
  upload,
  getDocument,
  validateDocument,
  getExtractedData,
  deleteDocument,
  validateAll
};
