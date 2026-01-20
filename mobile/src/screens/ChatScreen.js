/**
 * Chat Screen
 * AI Assistant chat interface for LUCI
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const COLORS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  white: '#ffffff',
  gray: '#64748b',
  grayLight: '#f1f5f9',
  text: '#1e293b',
  background: '#f8fafc',
};

// Quick suggestions
const QUICK_SUGGESTIONS = [
  'Clasificar producto',
  'Estado del expediente',
  'Calcular aranceles',
  'Requisitos de importacion',
];

// Message Bubble Component
function MessageBubble({ message, isUser }) {
  return (
    <View style={[styles.messageBubble, isUser ? styles.userMessage : styles.aiMessage]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>L</Text>
        </View>
      )}
      <View style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}>
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {message.text}
        </Text>
        {message.actions && message.actions.length > 0 && (
          <View style={styles.messageActions}>
            {message.actions.map((action, index) => (
              <TouchableOpacity key={index} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>{action}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
          {message.time}
        </Text>
      </View>
    </View>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <View style={styles.typingContainer}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarText}>L</Text>
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDot} />
        <View style={[styles.typingDot, styles.typingDotDelay1]} />
        <View style={[styles.typingDot, styles.typingDotDelay2]} />
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: 'Hola! Soy LUCI, tu asistente aduanero inteligente. Puedo ayudarte con clasificacion arancelaria, calculos de aranceles, requisitos de importacion y mas. ¿En que puedo ayudarte?',
      isUser: false,
      time: 'Ahora',
      actions: ['Clasificar producto', 'Calcular aranceles'],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      // In real app, call API
      // const response = await api.chat.send(text);

      // Simulate AI response
      await new Promise((resolve) => setTimeout(resolve, 1500));

      let aiResponse;

      // Mock responses based on keywords
      if (text.toLowerCase().includes('clasificar') || text.toLowerCase().includes('taric')) {
        aiResponse = {
          text: 'Para clasificar un producto, necesito que me proporciones:\n\n1. Descripcion detallada del producto\n2. Material de fabricacion\n3. Uso principal\n4. Pais de origen\n\n¿Cual es el producto que deseas clasificar?',
          actions: ['Ver codigos frecuentes', 'Buscar en TARIC'],
        };
      } else if (text.toLowerCase().includes('arancel') || text.toLowerCase().includes('calcular')) {
        aiResponse = {
          text: 'Para calcular los aranceles de importacion, necesito:\n\n- Codigo TARIC del producto\n- Valor de la mercancia (CIF)\n- Pais de origen\n\nTambien puedo verificar si hay preferencias arancelarias aplicables (EUR.1, Form A, etc.).\n\n¿Tienes el codigo TARIC?',
          actions: ['Calcular con preferencia', 'Ver tipos arancelarios'],
        };
      } else if (text.toLowerCase().includes('expediente') || text.toLowerCase().includes('estado')) {
        aiResponse = {
          text: 'Tengo informacion de tus expedientes activos:\n\n📦 EXP-2024-0089 - Canal Naranja\n   Requerimiento pendiente\n\n📦 EXP-2024-0088 - Canal Verde\n   Levante aprobado\n\n📦 EXP-2024-0087 - Pendiente de envio\n\n¿Sobre cual expediente quieres mas detalles?',
          actions: ['Ver EXP-0089', 'Ver todos'],
        };
      } else if (text.toLowerCase().includes('requisito') || text.toLowerCase().includes('importar')) {
        aiResponse = {
          text: 'Los requisitos de importacion dependen del tipo de producto. Los mas comunes son:\n\n📋 Documentos basicos:\n- Factura comercial\n- B/L o AWB\n- Packing list\n\n📋 Certificados especiales:\n- Sanitario (alimentos)\n- SOIVRE (industriales)\n- CITES (especies protegidas)\n\n¿Que tipo de producto vas a importar?',
          actions: ['Alimentos', 'Textiles', 'Electronica'],
        };
      } else {
        aiResponse = {
          text: 'Entiendo tu consulta. Para darte una respuesta mas precisa, ¿podrias especificar un poco mas? Puedo ayudarte con:\n\n- Clasificacion de productos (TARIC)\n- Calculo de aranceles e IVA\n- Requisitos de importacion\n- Estado de expedientes\n- Preferencias arancelarias\n- Regimenes especiales',
          actions: [],
        };
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.text,
        isUser: false,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        actions: aiResponse.actions,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
          isUser: false,
          time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    sendMessage(suggestion);
  };

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, isTyping]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble message={item} isUser={item.isUser} />
        )}
        contentContainerStyle={styles.messagesList}
        ListFooterComponent={isTyping ? <TypingIndicator /> : null}
      />

      {/* Quick Suggestions */}
      {messages.length <= 2 && (
        <View style={styles.suggestionsContainer}>
          {QUICK_SUGGESTIONS.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => handleSuggestion(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="attach" size={24} color={COLORS.gray} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Escribe tu mensaje..."
          placeholderTextColor={COLORS.gray}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() ? COLORS.white : COLORS.gray}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  aiAvatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContent: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  userContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiContent: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.white,
  },
  messageTime: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 6,
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
  },
  actionButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gray,
    marginHorizontal: 2,
    opacity: 0.4,
  },
  typingDotDelay1: {
    opacity: 0.6,
  },
  typingDotDelay2: {
    opacity: 0.8,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  suggestionText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.grayLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.grayLight,
  },
});
