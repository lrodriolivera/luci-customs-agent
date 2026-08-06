import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * PortalLayout — la envoltura del portal del cliente.
 *
 * Leia response.data.expedition, pero GET /api/portal/:token responde
 * { success: true, data: {...} }: el expediente esta en response.data.data.
 * El resultado era que expedition quedaba undefined, la cabecera mostraba
 * "Expediente:" sin numero, y las pestañas hijas —que reciben el expediente
 * por el contexto del Outlet— se quedaban sin datos.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { changeLanguage: vi.fn(), language: 'es' } })
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'tok-abc' }),
  Outlet: () => null,
  NavLink: ({ children }) => <span>{children}</span>,
  Link: ({ children }) => <span>{children}</span>
}))

vi.mock('../../services/api', () => ({
  portalAPI: { access: vi.fn() }
}))

import { portalAPI } from '../../services/api'
import PortalLayout from './PortalLayout'

describe('PortalLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el numero de expediente que devuelve la API', async () => {
    // Forma real de la respuesta, verificada contra produccion el 6/Ago/2026.
    portalAPI.access.mockResolvedValue({
      data: {
        success: true,
        data: { expeditionId: 'EXP-2026-C5004700', operationType: 'import', status: 'declaration_draft' }
      }
    })

    render(<PortalLayout />)

    expect(await screen.findByText(/EXP-2026-C5004700/)).toBeInTheDocument()
  })

  it('avisa cuando el enlace no es valido', async () => {
    portalAPI.access.mockRejectedValue({ response: { data: { message: 'Enlace caducado' } } })

    render(<PortalLayout />)

    expect(await screen.findByText(/Enlace caducado/)).toBeInTheDocument()
  })
})
