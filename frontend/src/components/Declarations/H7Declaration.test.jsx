import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import H7Declaration from './H7Declaration'
import { declarationsAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, defecto) => (typeof defecto === 'string' ? defecto : key) })
}))
vi.mock('../../services/api', () => ({
  declarationsAPI: { checkH7Eligibility: vi.fn(), generateH7: vi.fn(), submitH7: vi.fn() }
}))

describe('<H7Declaration /> sin EORI de declarante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    declarationsAPI.checkH7Eligibility.mockResolvedValue({ data: { data: { eligible: true } } })
  })

  test('muestra el 422 con el mensaje y el enlace a Ajustes > Aduanas', async () => {
    declarationsAPI.generateH7.mockRejectedValue({
      response: {
        status: 422,
        data: { success: false, code: 'EORI_FALTANTE', quien: 'representante',
          error: 'Falta el EORI del representante: configúralo en Ajustes > Aduanas' }
      }
    })
    render(<H7Declaration expedition={{ _id: 'e1' }} />)

    fireEvent.click(await screen.findByRole('button', { name: /generar h7/i }))

    expect(await screen.findByText(/Falta el EORI del representante/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ir a Ajustes > Aduanas' })).toHaveAttribute('href', '/settings'))
  })
})
