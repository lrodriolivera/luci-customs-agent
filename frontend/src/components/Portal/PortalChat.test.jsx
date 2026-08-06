import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * PortalChat — el chat que ve el cliente final.
 *
 * No tenia tests, y por eso paso desapercibido que llamaba a chatAPI.send()
 * (ruta /ai/chat, inexistente en el backend: 405). El chat respondia "ha
 * ocurrido un error" a cualquier pregunta.
 *
 * Lo que se fija aqui es el contrato con el backend, que es donde estaba el
 * fallo: se llama al endpoint del portal, y del payload se extrae el TEXTO
 * —data.response.message— y no el objeto, que al renderizarse tumbaba la
 * pagina entera con "Algo salio mal".
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const outletContext = {
  expedition: { expeditionId: 'EXP-2026-0117', client: { companyName: 'Aceites del Sur SL' } },
  token: 'tok-abc'
}

vi.mock('react-router-dom', () => ({
  useOutletContext: () => outletContext
}))

vi.mock('../../services/api', () => ({
  portalAPI: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    aiEnhancedChat: vi.fn()
  }
}))

import { portalAPI } from '../../services/api'
import PortalChat from './PortalChat'

describe('PortalChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom no implementa scrollIntoView, que el componente usa al pintar.
    Element.prototype.scrollIntoView = vi.fn()
    portalAPI.getMessages.mockResolvedValue({ data: { messages: [] } })
    portalAPI.sendMessage.mockResolvedValue({ data: { success: true } })
    // Forma real de la respuesta, verificada contra produccion el 6/Ago/2026.
    portalAPI.aiEnhancedChat.mockResolvedValue({
      data: {
        success: true,
        data: {
          response: { message: 'Tu mercancia esta en el puerto de Valencia.', tone: 'friendly', language: 'es' },
          intent: 'status_query'
        }
      }
    })
  })

  const escribirYEnviar = async (texto) => {
    const user = userEvent.setup()
    render(<PortalChat />)
    const campo = await screen.findByPlaceholderText('portal.chatPlaceholder')
    await user.type(campo, texto)
    await user.click(screen.getByRole('button', { name: '' }))
    return user
  }

  it('consulta al asistente por el endpoint del portal', async () => {
    await escribirYEnviar('Cuando llega mi mercancia?')

    await waitFor(() => {
      expect(portalAPI.aiEnhancedChat).toHaveBeenCalledWith('tok-abc', 'Cuando llega mi mercancia?')
    })
  })

  it('muestra el texto de la respuesta, no el objeto que lo envuelve', async () => {
    await escribirYEnviar('Cuando llega mi mercancia?')

    expect(await screen.findByText('Tu mercancia esta en el puerto de Valencia.')).toBeInTheDocument()
  })

  it('avisa del fallo en lugar de tumbar la pagina si la respuesta no trae texto', async () => {
    // Un objeto pasado a content hacia reventar el render entero.
    portalAPI.aiEnhancedChat.mockResolvedValue({
      data: { success: true, data: { intent: 'unknown' } }
    })

    await escribirYEnviar('Hola?')

    expect(await screen.findByText('portal.chatError')).toBeInTheDocument()
  })

  it('avisa del fallo cuando el asistente no responde', async () => {
    portalAPI.aiEnhancedChat.mockRejectedValue(new Error('timeout'))

    await escribirYEnviar('Hola?')

    expect(await screen.findByText('portal.chatError')).toBeInTheDocument()
  })
})
