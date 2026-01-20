import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook for managing chat with LUCI AI assistant
 */
const useChat = (options = {}) => {
  const {
    expeditionId = null,
    sessionId = null,
    autoScroll = true
  } = options;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [chatSession, setChatSession] = useState(sessionId);
  const scrollRef = useRef(null);

  // System welcome message
  const welcomeMessage = {
    id: 'welcome',
    role: 'assistant',
    content: 'Hola! Soy LUCI, tu asistente aduanero virtual. Puedo ayudarte con:\n\n' +
      '- Clasificacion arancelaria TARIC\n' +
      '- Documentacion de importacion/exportacion\n' +
      '- Calculo de aranceles e IVA\n' +
      '- Normativa aduanera UE/Espana\n\n' +
      'Como puedo ayudarte hoy?',
    timestamp: new Date().toISOString()
  };

  // Load chat history
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (expeditionId) {
        response = await api.getExpeditionChat(expeditionId);
      } else if (chatSession) {
        response = await api.getChatSession(chatSession);
      } else {
        // New chat, just show welcome
        setMessages([welcomeMessage]);
        return;
      }

      const history = response.data?.messages || [];
      setMessages(history.length > 0 ? history : [welcomeMessage]);
      if (response.data?.sessionId) {
        setChatSession(response.data.sessionId);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar el chat');
      setMessages([welcomeMessage]);
      console.error('Error loading chat history:', err);
    } finally {
      setLoading(false);
    }
  }, [expeditionId, chatSession]);

  // Send message
  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || sending) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    };

    // Optimistically add user message
    setMessages(prev => [...prev, userMessage]);
    setSending(true);
    setError(null);

    try {
      const response = await api.sendChatMessage({
        message: content.trim(),
        expeditionId,
        sessionId: chatSession
      });

      const assistantMessage = {
        id: response.data?.messageId || `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.data?.response || 'Lo siento, no pude procesar tu mensaje.',
        timestamp: new Date().toISOString(),
        metadata: response.data?.metadata
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.data?.sessionId) {
        setChatSession(response.data.sessionId);
      }

      return assistantMessage;
    } catch (err) {
      const errorMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        timestamp: new Date().toISOString(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
      setError(err.message || 'Error al enviar mensaje');
      console.error('Error sending message:', err);
      throw err;
    } finally {
      setSending(false);
    }
  }, [expeditionId, chatSession, sending]);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([welcomeMessage]);
    setChatSession(null);
    setError(null);
  }, []);

  // Add quick action message
  const sendQuickAction = useCallback(async (action) => {
    const quickActions = {
      clasificacion: 'Necesito ayuda con clasificacion arancelaria',
      documentos: 'Que documentos necesito para una importacion?',
      aranceles: 'Como calculo los aranceles de una importacion?',
      iva: 'Cual es el IVA aplicable a mi importacion?',
      preferencias: 'Tengo derecho a alguna preferencia arancelaria?'
    };

    const message = quickActions[action];
    if (message) {
      await sendMessage(message);
    }
  }, [sendMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, autoScroll]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    messages,
    loading,
    sending,
    error,
    chatSession,
    scrollRef,
    sendMessage,
    sendQuickAction,
    clearChat,
    reload: loadHistory
  };
};

export default useChat;
