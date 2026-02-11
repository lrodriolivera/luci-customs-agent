import React, { useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { portalAPI, chatAPI } from '../../services/api'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'

export default function PortalChat() {
  const { expedition, token } = useOutletContext()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await portalAPI.getMessages(token)
        setMessages(response.data.messages || [])
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || loading) return

    const userMessage = {
      id: Date.now(),
      sender: 'client',
      senderName: expedition?.client?.companyName,
      content: newMessage,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setNewMessage('')
    setLoading(true)

    try {
      // Send message and get AI response
      const response = await chatAPI.send({
        message: newMessage,
        expedition_context: expedition,
        context_type: 'client'
      })

      const aiMessage = {
        id: Date.now() + 1,
        sender: 'luci',
        senderName: 'LUCI',
        content: response.data.message,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, aiMessage])

      // Also save to portal messages
      await portalAPI.sendMessage(token, newMessage)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'luci',
        senderName: 'LUCI',
        content: 'Lo siento, ha ocurrido un error. Por favor, intente de nuevo.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const quickQuestions = [
    'Que documentos necesito para mi importacion?',
    'Como se calcula el arancel?',
    'Cuanto tiempo tarda el despacho?',
    'Que es el Incoterm CIF?'
  ]

  const handleQuickQuestion = (question) => {
    setNewMessage(question)
  }

  return (
    <div className="h-[calc(100vh-280px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat con LUCI</h1>
        <p className="text-gray-600">
          Haga sus consultas sobre comercio exterior y aduanas
        </p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 card p-0 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-luci-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Bienvenido al Chat de LUCI</h3>
              <p className="text-gray-600 mb-4">
                Soy su asistente virtual para consultas de aduanas
              </p>

              {/* Quick Questions */}
              <div className="max-w-md mx-auto">
                <p className="text-sm text-gray-500 mb-2">Preguntas frecuentes:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickQuestion(q)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Welcome message */}
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-luci rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">L</span>
                </div>
                <div className="flex-1 max-w-[80%]">
                  <div className="bg-luci-light rounded-2xl rounded-tl-none p-4">
                    <p className="text-gray-800">
                      Hola! Soy LUCI, su asistente de aduanas de STRIX AI.
                      Estoy aqui para ayudarle con su expediente {expedition?.expeditionId}.
                      Como puedo ayudarle?
                    </p>
                  </div>
                </div>
              </div>

              {messages.map((msg) => (
                <div
                  key={msg.id || msg._id}
                  className={`flex gap-3 ${msg.sender === 'client' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.sender === 'client' ? 'bg-gray-200' : 'bg-luci'
                  }`}>
                    <span className={`text-sm font-bold ${
                      msg.sender === 'client' ? 'text-gray-600' : 'text-white'
                    }`}>
                      {msg.sender === 'client' ? 'U' : 'L'}
                    </span>
                  </div>
                  <div className={`flex-1 max-w-[80%] ${msg.sender === 'client' ? 'flex justify-end' : ''}`}>
                    <div className={`rounded-2xl p-4 ${
                      msg.sender === 'client'
                        ? 'bg-luci text-white rounded-tr-none'
                        : 'bg-luci-light rounded-tl-none'
                    }`}>
                      <p className={msg.sender === 'client' ? 'text-white' : 'text-gray-800'}>
                        {msg.content}
                      </p>
                    </div>
                    <p className={`text-xs text-gray-400 mt-1 ${msg.sender === 'client' ? 'text-right' : ''}`}>
                      {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-luci rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">L</span>
                  </div>
                  <div className="bg-luci-light rounded-2xl rounded-tl-none p-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-luci rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-luci rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-luci rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escriba su mensaje..."
              className="input flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || loading}
              className="btn-primary px-4"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
