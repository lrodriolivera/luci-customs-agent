import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatMessageText from './ChatMessageText'

/**
 * El asistente responde en Markdown. Se pintaban las negritas, pero las listas
 * salían sin viñetas ni números (el reset de Tailwind quita list-style a ul/ol)
 * y el contenedor con whitespace-pre-wrap convertía en huecos grandes los
 * saltos de línea que react-markdown deja entre bloques.
 */

const RESPUESTA = [
  'Para el **H1** necesitas:',
  '',
  '- Factura comercial',
  '- Documento de transporte',
  '',
  'Pasos:',
  '',
  '1. Crear el expediente',
  '2. Generar la declaración',
  '',
  'Cualquier duda, pregunta.'
].join('\n')

describe('ChatMessageText', () => {
  test('pinta las listas con viñetas como lista con viñetas', () => {
    render(<ChatMessageText content={RESPUESTA} />)

    const listas = screen.getAllByRole('list')
    const conVinetas = listas.find(l => l.tagName === 'UL')
    expect(conVinetas).toHaveClass('list-disc')
    expect(conVinetas.querySelectorAll('li')).toHaveLength(2)
    expect(screen.getByText('Factura comercial').closest('li')).toBeInTheDocument()
  })

  test('pinta las listas numeradas como lista numerada', () => {
    render(<ChatMessageText content={RESPUESTA} />)

    const numerada = screen.getAllByRole('list').find(l => l.tagName === 'OL')
    expect(numerada).toHaveClass('list-decimal')
    expect(numerada.querySelectorAll('li')).toHaveLength(2)
  })

  test('sigue pintando las negritas', () => {
    render(<ChatMessageText content={RESPUESTA} />)

    expect(screen.getByText('H1').tagName).toBe('STRONG')
  })

  test('sin whitespace-pre-wrap en el contenedor: no hay huecos entre bloques', () => {
    const { container } = render(<ChatMessageText content={RESPUESTA} />)

    expect(container.firstChild).not.toHaveClass('whitespace-pre-wrap')
  })

  test('respeta los saltos de línea simples dentro de un párrafo', () => {
    render(<ChatMessageText content={'Línea uno\nLínea dos'} />)

    expect(screen.getByText(/Línea uno/).tagName).toBe('P')
    expect(screen.getByText(/Línea uno/)).toHaveClass('whitespace-pre-line')
  })

  test('no interpreta HTML crudo', () => {
    const { container } = render(<ChatMessageText content={'<img src="x" onerror="alert(1)"> hola'} />)

    expect(container.querySelector('img')).toBeNull()
  })

  test('los enlaces abren en otra pestaña con rel seguro y sin javascript:', () => {
    const { container } = render(
      <ChatMessageText content={'[AEAT](https://sede.agenciatributaria.gob.es) y [mal](javascript:alert(1))'} />
    )

    const aeat = screen.getByRole('link', { name: 'AEAT' })
    expect(aeat).toHaveAttribute('target', '_blank')
    expect(aeat).toHaveAttribute('rel', 'noopener noreferrer')
    const enlaces = Array.from(container.querySelectorAll('a'))
    expect(enlaces.some(a => (a.getAttribute('href') || '').startsWith('javascript:'))).toBe(false)
  })

  test('no carga imágenes remotas (píxeles de seguimiento)', () => {
    const { container } = render(<ChatMessageText content={'Mira ![x](https://externo.example/pixel.png)'} />)

    expect(container.querySelector('img')).toBeNull()
  })
})
