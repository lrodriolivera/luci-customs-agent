import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FloatingAssistant from './FloatingAssistant'
import { chatAPI } from '../../services/api'

// Las traducciones llegan por red: al montar el componente `t` puede devolver
// todavia la clave. `traducciones` simula ese antes y despues.
let traducciones = {}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => traducciones[key] || key })
}))
vi.mock('../../services/api', () => ({ chatAPI: { send: vi.fn() } }))

const BIENVENIDA = 'Hola, soy LUCI. ¿En qué puedo ayudarte?'
const montar = () => render(<MemoryRouter initialEntries={['/expeditions']}><FloatingAssistant /></MemoryRouter>)
const abrir = () => fireEvent.click(screen.getByTitle(traducciones['floating.fabTitle'] || 'floating.fabTitle'))

describe('FloatingAssistant', () => {
  beforeEach(() => {
    traducciones = {}
    Element.prototype.scrollIntoView = vi.fn()
    chatAPI.send.mockReset()
  })

  test('la bienvenida sale traducida aunque las traducciones carguen despues de montar (UAT 11/Nov/2026)', () => {
    const { rerender } = montar()
    abrir()
    expect(screen.getByText('floating.welcomeMessage')).toBeInTheDocument()

    traducciones = { 'floating.welcomeMessage': BIENVENIDA }
    rerender(<MemoryRouter initialEntries={['/expeditions']}><FloatingAssistant /></MemoryRouter>)

    expect(screen.getByText(BIENVENIDA)).toBeInTheDocument()
    expect(screen.queryByText('floating.welcomeMessage')).not.toBeInTheDocument()
  })

  test('la conversacion se mantiene debajo de la bienvenida', async () => {
    traducciones = { 'floating.welcomeMessage': BIENVENIDA, 'floating.placeholder': 'Escribe tu consulta...' }
    chatAPI.send.mockResolvedValue({ data: { data: { message: 'El H1 es la declaración de importación.' } } })
    montar()
    abrir()

    fireEvent.change(screen.getByPlaceholderText('Escribe tu consulta...'), { target: { value: '¿Qué es el H1?' } })
    fireEvent.submit(screen.getByPlaceholderText('Escribe tu consulta...').closest('form'))

    await waitFor(() => expect(screen.getByText('El H1 es la declaración de importación.')).toBeInTheDocument())
    expect(screen.getByText(BIENVENIDA)).toBeInTheDocument()
    expect(screen.getByText('¿Qué es el H1?')).toBeInTheDocument()
    expect(chatAPI.send).toHaveBeenCalledWith({ message: '¿Qué es el H1?', context: 'agent' })
  })
})
