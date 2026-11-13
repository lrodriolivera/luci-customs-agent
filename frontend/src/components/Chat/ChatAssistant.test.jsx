import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatAssistant from './ChatAssistant'
import { chatAPI, knowledgeAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))
vi.mock('../../services/api', () => ({
  chatAPI: { send: vi.fn() },
  knowledgeAPI: { categories: vi.fn() }
}))

describe('<ChatAssistant />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    knowledgeAPI.categories.mockResolvedValue({ data: {} })
  })

  // El backend devuelve Markdown (**negrita**, listas con "-"); antes se
  // pintaba el texto tal cual, con los asteriscos literales sin formato.
  test('la negrita y las listas del asistente se renderizan con formato, no con asteriscos literales', async () => {
    chatAPI.send.mockResolvedValue({
      data: { message: 'Falta el **EORI** del declarante:\n- Revisa Ajustes\n- Guarda de nuevo' }
    })
    render(<ChatAssistant />)

    fireEvent.change(screen.getByPlaceholderText('chat.placeholder'), { target: { value: '¿Qué me falta?' } })
    fireEvent.submit(screen.getByPlaceholderText('chat.placeholder').closest('form'))

    const negrita = await screen.findByText('EORI')
    expect(negrita.tagName).toBe('STRONG')
    expect(screen.getByText('Revisa Ajustes').closest('li')).toBeInTheDocument()
    expect(screen.queryByText(/\*\*EORI\*\*/)).not.toBeInTheDocument()
  })
})
