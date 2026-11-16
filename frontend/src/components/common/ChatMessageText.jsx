import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Elementos Markdown con estilo propio. El reset de Tailwind (preflight) quita
 * list-style y márgenes a ul/ol/p, así que sin estas clases las listas salían
 * sin viñetas ni números.
 *
 * whitespace-pre-line solo en párrafos y elementos de lista: conserva los
 * saltos de línea simples del asistente sin convertir en huecos los saltos que
 * react-markdown deja ENTRE bloques (eso pasaba con pre-wrap en el contenedor).
 */
const COMPONENTES = {
  p: ({ node, ...props }) => <p className="whitespace-pre-line mb-2 last:mb-0" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
  li: ({ node, ...props }) => <li className="whitespace-pre-line" {...props} />,
  // react-markdown ya neutraliza esquemas peligrosos (javascript:) con su
  // urlTransform por defecto; aquí solo se abre fuera y sin window.opener.
  a: ({ node, ...props }) => (
    <a className="underline text-luci hover:text-luci-dark" target="_blank" rel="noopener noreferrer" {...props} />
  )
}

/**
 * Texto de un mensaje del asistente (ChatAssistant, FloatingAssistant y las
 * respuestas de LUCI en PortalChat), con formato Markdown: negrita, cursiva,
 * listas con viñetas y numeradas, y enlaces.
 *
 * Sin rehypeRaw: NO se interpreta HTML crudo, solo sintaxis Markdown. Por eso
 * no hace falta sanitizar aparte (nada de dangerouslySetInnerHTML): lo que no
 * es Markdown válido se pinta como texto plano.
 *
 * @param {{ content: string, className?: string }} props
 */
export default function ChatMessageText({ content, className = '' }) {
  return (
    <div className={`chat-message-text break-words ${className}`}>
      {/* Sin imágenes: un ![](https://externo/pixel.png) cargaría un recurso
          remoto y filtraría la IP de quien lee el chat. */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTES}
        disallowedElements={['img']}
        unwrapDisallowed
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}
