import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Texto de un mensaje del chat del asistente (ChatAssistant, FloatingAssistant),
 * con formato Markdown minimo: negrita, cursiva y listas. El backend devuelve
 * **negrita** y listas con guiones que antes se mostraban literales, con los
 * asteriscos sin interpretar.
 *
 * Sin rehypeRaw: NO se interpreta HTML crudo, solo sintaxis Markdown. Por eso
 * no hace falta sanitizar aparte (nada de dangerouslySetInnerHTML): lo que no
 * es Markdown valido se pinta como texto plano, igual que antes.
 *
 * @param {{ content: string, className?: string }} props
 */
export default function ChatMessageText({ content, className = '' }) {
  return (
    <div className={`chat-message-text whitespace-pre-wrap ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
    </div>
  )
}
