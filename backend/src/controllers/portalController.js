const { Expedition, ChatMessage } = require('../models');
const logger = require('../config/logger');
const aiService = require('../services/aiService');

/**
 * Obtener expediente por token del portal
 * GET /api/portal/:token
 */
const getByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const expedition = await Expedition.findByPortalToken(token);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado o link expirado'
      });
    }

    // Incrementar contador de visitas
    expedition.clientPortal.viewCount += 1;
    expedition.clientPortal.lastViewedAt = new Date();
    await expedition.save();

    // Devolver solo informacion necesaria para el cliente
    const clientView = {
      expeditionId: expedition.expeditionId,
      operationType: expedition.operationType,
      transportMode: expedition.transportMode,
      status: expedition.status,
      client: {
        companyName: expedition.client.companyName
      },
      documentChecklist: expedition.documentChecklist.map(item => ({
        documentType: item.documentType,
        documentName: item.documentName,
        required: item.required,
        received: item.received,
        validated: item.validated,
        notes: item.notes
      })),
      documentCompletion: expedition.documentCompletion,
      goods: expedition.goods.map(g => ({
        description: g.description,
        quantity: g.quantity,
        unit: g.unit
      })),
      transport: {
        documentNumber: expedition.transport?.documentNumber,
        arrivalDate: expedition.transport?.arrivalDate
      },
      incoterm: expedition.incoterm,
      clientNotes: expedition.clientNotes,
      createdAt: expedition.createdAt
    };

    res.json({
      success: true,
      data: clientView
    });

  } catch (error) {
    logger.error('Error en portal getByToken:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener expediente'
    });
  }
};

/**
 * Obtener historial de chat
 * GET /api/portal/:token/chat
 */
const getChatHistory = async (req, res) => {
  try {
    const { token } = req.params;
    const { limit = 50, before } = req.query;

    const expedition = await Expedition.findByPortalToken(token);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const messages = await ChatMessage.getConversation(
      expedition._id,
      parseInt(limit),
      before ? new Date(before) : null
    );

    // Marcar mensajes como leidos
    await ChatMessage.markAsRead(expedition._id, 'client');

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        expeditionId: expedition.expeditionId
      }
    });

  } catch (error) {
    logger.error('Error obteniendo chat:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener chat'
    });
  }
};

/**
 * Enviar mensaje al chat (cliente)
 * POST /api/portal/:token/chat
 */
const sendMessage = async (req, res) => {
  try {
    const { token } = req.params;
    const { content } = req.body;

    const expedition = await Expedition.findByPortalToken(token);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Guardar mensaje del cliente
    const clientMessage = new ChatMessage({
      expedition: expedition._id,
      sender: 'client',
      senderInfo: {
        name: expedition.client.companyName,
        email: expedition.client.contact?.email
      },
      content,
      messageType: 'text'
    });

    await clientMessage.save();

    // Generar respuesta de LUCI
    const startTime = Date.now();
    const luciResponse = await aiService.generateChatResponse(
      content,
      expedition,
      await ChatMessage.getConversation(expedition._id, 10)
    );
    const processingTime = Date.now() - startTime;

    // Guardar respuesta de LUCI
    const luciMessage = new ChatMessage({
      expedition: expedition._id,
      sender: 'luci',
      senderInfo: {
        name: 'LUCI',
        email: 'luci@stocklogistic.com'
      },
      content: luciResponse.message,
      messageType: 'text',
      metadata: {
        aiModel: luciResponse.model,
        tokensUsed: luciResponse.tokensUsed,
        processingTime
      },
      aiContext: {
        confidence: luciResponse.confidence,
        retrievedKnowledge: luciResponse.sources
      }
    });

    await luciMessage.save();

    // Timeline
    expedition.timeline.push({
      action: 'chat_message',
      description: 'Cliente envio mensaje en el portal',
      performedBy: 'client'
    });
    await expedition.save();

    res.json({
      success: true,
      data: {
        clientMessage: {
          _id: clientMessage._id,
          sender: 'client',
          content: clientMessage.content,
          createdAt: clientMessage.createdAt
        },
        luciResponse: {
          _id: luciMessage._id,
          sender: 'luci',
          content: luciMessage.content,
          createdAt: luciMessage.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensaje'
    });
  }
};

/**
 * Subir documento desde portal
 * POST /api/portal/:token/documents
 */
const uploadDocument = async (req, res) => {
  try {
    const { token } = req.params;
    const { documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha proporcionado archivo'
      });
    }

    const expedition = await Expedition.findByPortalToken(token);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Crear documento
    const document = {
      type: documentType,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
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
      description: `Documento ${documentType} subido por el cliente`,
      performedBy: 'client',
      metadata: { documentType, fileName: req.file.originalname }
    });

    // Actualizar status si corresponde
    const allRequiredReceived = expedition.documentChecklist
      .filter(item => item.required)
      .every(item => item.received);

    if (allRequiredReceived && expedition.status === 'pending_documents') {
      expedition.status = 'documents_received';
      expedition.timeline.push({
        action: 'status_change',
        description: 'Todos los documentos obligatorios recibidos',
        performedBy: 'system'
      });
    }

    await expedition.save();

    // Mensaje en el chat
    const chatMessage = new ChatMessage({
      expedition: expedition._id,
      sender: 'client',
      content: `He subido el documento: ${req.file.originalname}`,
      messageType: 'document_received',
      metadata: {
        documentId: expedition.documents[expedition.documents.length - 1]._id,
        documentType
      }
    });
    await chatMessage.save();

    logger.info(`Documento subido via portal: ${expedition.expeditionId} - ${documentType}`);

    res.json({
      success: true,
      data: {
        document,
        documentChecklist: expedition.documentChecklist,
        status: expedition.status
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
 * GET /api/portal/:token/documents/:docId
 */
const getDocument = async (req, res) => {
  try {
    const { token, docId } = req.params;

    const expedition = await Expedition.findByPortalToken(token);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const document = expedition.documents.id(docId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
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
 * Obtener conteo de mensajes no leidos
 * GET /api/portal/:token/unread
 */
const getUnreadCount = async (req, res) => {
  try {
    const { token } = req.params;

    const expedition = await Expedition.findByPortalToken(token);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const count = await ChatMessage.getUnreadCount(expedition._id, 'client');

    res.json({
      success: true,
      data: { unreadCount: count }
    });

  } catch (error) {
    logger.error('Error obteniendo no leidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mensajes no leidos'
    });
  }
};

module.exports = {
  getByToken,
  getChatHistory,
  sendMessage,
  uploadDocument,
  getDocument,
  getUnreadCount
};
