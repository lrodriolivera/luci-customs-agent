import React, { useState, useRef, useEffect } from 'react'
import { chatAPI, knowledgeAPI } from '../../services/api'
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { BookOpenIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

export default function ChatAssistant() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState({})
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await knowledgeAPI.categories()
        setCategories(response.data)
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || loading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: newMessage,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setNewMessage('')
    setLoading(true)

    try {
      const response = await chatAPI.send({
        message: newMessage,
        context_type: 'agent'
      })

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date().toISOString(),
        model: response.data.model,
        confidence: response.data.confidence
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lo siento, ha ocurrido un error al procesar su consulta. Por favor, intente de nuevo.',
        timestamp: new Date().toISOString(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const suggestedQuestions = [
    'Como se determina el origen preferencial de una mercancia?',
    'Cuales son los requisitos para el regimen 42?',
    'Que documentos necesito para importar productos alimenticios?',
    'Como se calcula el valor en aduana con Incoterm FOB?',
    'Que es el perfeccionamiento activo?',
    'Cuando es obligatorio el certificado EUR.1?'
  ]

  const handleSuggestedQuestion = (question) => {
    setNewMessage(question)
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistente LUCI</h1>
          <p className="text-gray-500">Consultas tecnicas sobre normativa aduanera</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <SparklesIcon className="w-5 h-5 text-luci" />
          Powered by Claude
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 card p-0 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-luci-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Hola! Soy LUCI
                </h2>
                <p className="text-gray-600 max-w-md mx-auto mb-6">
                  Su asistente experto en aduanas y comercio exterior.
                  Puedo ayudarle con normativa, clasificacion arancelaria,
                  requisitos de importacion/exportacion y mas.
                </p>

                {/* Suggested Questions */}
                <div className="max-w-xl mx-auto">
                  <p className="text-sm text-gray-500 mb-3">Preguntas sugeridas:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedQuestions.slice(0, 4).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(q)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user' ? 'bg-gray-200' : 'bg-luci'
                    }`}>
                      <span className={`font-bold ${
                        msg.role === 'user' ? 'text-gray-600' : 'text-white'
                      }`}>
                        {msg.role === 'user' ? 'U' : 'L'}
                      </span>
                    </div>
                    <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                      <div className={`rounded-2xl p-4 ${
                        msg.role === 'user'
                          ? 'bg-luci text-white rounded-tr-none'
                          : msg.isError
                          ? 'bg-red-50 text-red-800 rounded-tl-none'
                          : 'bg-gray-100 rounded-tl-none'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 text-xs text-gray-400 ${
                        msg.role === 'user' ? 'justify-end' : ''
                      }`}>
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {msg.model && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                            {msg.model}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-luci rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">L</span>
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                placeholder="Escriba su consulta sobre aduanas..."
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

        {/* Knowledge Sidebar */}
        <div className="w-80 hidden lg:block space-y-4 overflow-y-auto">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-luci" />
              Base de Conocimiento
            </h3>
            <div className="space-y-2">
              {Object.entries(categories).slice(0, 8).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => handleSuggestedQuestion(`Explicame sobre ${cat.name}`)}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <p className="font-medium text-gray-900">{cat.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{cat.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <QuestionMarkCircleIcon className="w-5 h-5 text-luci" />
              Mas Preguntas
            </h3>
            <div className="space-y-2">
              {suggestedQuestions.slice(4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(q)}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="card bg-luci-light">
            <p className="text-sm text-luci-dark">
              <strong>Tip:</strong> Para mejores respuestas, sea especifico
              en su consulta. Incluya codigos TARIC, paises, o tipos de producto
              cuando sea relevante.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
