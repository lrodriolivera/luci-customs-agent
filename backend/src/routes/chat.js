const express = require('express');
const router = express.Router();
const { ChatMessage, Expedition } = require('../models');
const { auth } = require('../middleware/auth');
const aiService = require('../services/aiService');
const logger = require('../config/logger');

// Todas las rutas requieren autenticacion
router.use(auth);

/**
 * Obtener historial de chat de un expediente
 * GET /api/chat/:expeditionId
 */
router.get('/:expeditionId', async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { limit = 50, before } = req.query;

    const expedition = await Expedition.findById(expeditionId);
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

    // Marcar como leidos para el agente
    await ChatMessage.markAsRead(expedition._id, 'agent');

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
});

/**
 * Enviar mensaje como agente
 * POST /api/chat/:expeditionId
 */
router.post('/:expeditionId', async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { content, useAI } = req.body;

    const expedition = await Expedition.findById(expeditionId);
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Guardar mensaje del agente
    const agentMessage = new ChatMessage({
      expedition: expedition._id,
      sender: 'agent',
      senderInfo: {
        name: req.user.name,
        email: req.user.email,
        userId: req.user._id
      },
      content,
      messageType: 'text'
    });

    await agentMessage.save();

    let luciMessage = null;

    // Si se solicita respuesta de LUCI
    if (useAI) {
      const startTime = Date.now();
      const luciResponse = await aiService.generateChatResponse(
        content,
        expedition,
        await ChatMessage.getConversation(expedition._id, 10),
        'agent' // Contexto de agente (mas tecnico)
      );
      const processingTime = Date.now() - startTime;

      luciMessage = new ChatMessage({
        expedition: expedition._id,
        sender: 'luci',
        senderInfo: {
          name: 'LUCI',
          email: 'luci@strixai.es'
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
    }

    res.json({
      success: true,
      data: {
        agentMessage,
        luciMessage
      }
    });

  } catch (error) {
    logger.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensaje'
    });
  }
});

/**
 * Obtener conteo de no leidos por expediente
 * GET /api/chat/:expeditionId/unread
 */
router.get('/:expeditionId/unread', async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const count = await ChatMessage.getUnreadCount(expedition._id, 'agent');

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
});

/**
 * Preguntar a LUCI (sin contexto de expediente)
 * POST /api/chat/ask-luci
 */
router.post('/ask-luci', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'La pregunta no puede estar vacia'
      });
    }

    const startTime = Date.now();
    const response = await aiService.askLuci(question);
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        question,
        answer: response.message,
        sources: response.sources,
        confidence: response.confidence,
        model: response.model,
        processingTime
      }
    });

  } catch (error) {
    logger.error('Error preguntando a LUCI:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar pregunta'
    });
  }
});

module.exports = router;
