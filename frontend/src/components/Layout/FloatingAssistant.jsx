import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { chatAPI } from '../../services/api'

export default function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hola, soy LUCI. Puedo ayudarte con normativa aduanera, clasificacion arancelaria, calculos de derechos y procedimientos. Preguntame lo que necesites.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const location = useLocation()

  // Don't show on the assistant page itself or landing
  if (location.pathname === '/assistant' || location.pathname === '/landing') return null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const response = await chatAPI.send({
        message: userMsg,
        context: 'agent'
      })
      const reply = response.data.data?.message || response.data.message || response.data?.response || 'No pude procesar tu consulta.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el servicio. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '480px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Asistente LUCI</p>
                <p className="text-slate-400 text-[10px]">IA experta en aduanas</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-br-md'
                    : 'bg-white text-gray-700 border border-gray-200 rounded-bl-md shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex-shrink-0 border-t border-gray-200 p-3 bg-white">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Escribe tu consulta..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-sky-500/25 transition-all disabled:opacity-40 disabled:shadow-none flex-shrink-0"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
          isOpen
            ? 'bg-slate-800 hover:bg-slate-700 rotate-0'
            : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-sky-500/40 hover:scale-105'
        }`}
        title="Asistente LUCI"
      >
        {isOpen ? (
          <XMarkIcon className="w-6 h-6 text-white" />
        ) : (
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  )
}
