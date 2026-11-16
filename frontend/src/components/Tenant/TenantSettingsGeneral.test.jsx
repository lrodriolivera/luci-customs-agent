import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TenantSettings from './TenantSettings'
import api, { tenantEoriAPI } from '../../services/api'

/**
 * Ajustes › General guarda de verdad (PUT /api/tenant/general). Antes el botón
 * «Guardar cambios» era un setTimeout que solo enseñaba «guardado».
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))
vi.mock('./H1PresentationSettings', () => ({ default: () => null }))
vi.mock('../Admin/AdminPanel', () => ({ PasswordModal: () => null }))
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  tenantEoriAPI: { get: vi.fn(), update: vi.fn() }
}))
const usuarioActual = { current: { role: 'admin' } }
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: usuarioActual.current })
}))

const tenant = {
  id: 't1',
  name: 'Aduanas Demo',
  slug: 'aduanas-demo',
  status: 'active',
  businessInfo: {
    type: 'customs_agent',
    nif: 'B12345678',
    eori: 'ESB12345678',
    rea: 'REA-1',
    address: { street: 'Calle Vieja 1', city: 'Zaragoza', province: 'Zaragoza', postalCode: '50001', country: 'ES' }
  },
  subscription: { plan: 'pro' }
}

function getPorUrl(url) {
  if (url === '/api/tenant/me') return Promise.resolve({ data: { success: true, data: tenant } })
  return Promise.resolve({ data: { success: true, data: {} } })
}

async function abrir() {
  render(<TenantSettings />)
  await screen.findByText('settings.generalInfo')
}

describe('Ajustes › General', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usuarioActual.current = { role: 'admin' }
    api.get.mockImplementation(getPorUrl)
    tenantEoriAPI.get.mockResolvedValue({ data: { success: true, data: { eoriNumbers: {}, defaultEori: '', country: 'ES' } } })
  })

  test('un admin guarda nombre, REA y dirección con PUT /api/tenant/general', async () => {
    api.put.mockResolvedValue({
      data: { success: true, data: { ...tenant, name: 'Aduanas Nuevo' } }
    })
    await abrir()

    fireEvent.change(screen.getByLabelText('settings.orgName'), { target: { value: 'Aduanas Nuevo' } })
    fireEvent.change(screen.getByLabelText('common.city'), { target: { value: 'Madrid' } })
    fireEvent.click(screen.getByRole('button', { name: /settings\.saveChanges/ }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/tenant/general', {
        name: 'Aduanas Nuevo',
        rea: 'REA-1',
        address: { street: 'Calle Vieja 1', city: 'Madrid', province: 'Zaragoza', postalCode: '50001', country: 'ES' }
      })
    })
    expect(await screen.findByText('settings.saved')).toBeInTheDocument()
    // El subtítulo refleja lo que devolvió el servidor
    expect(screen.getByText(/Aduanas Nuevo/)).toBeInTheDocument()
  })

  test('si el servidor rechaza los datos, muestra su motivo y no dice «guardado»', async () => {
    api.put.mockRejectedValue({ response: { data: { error: 'El nombre de la organización es obligatorio' } } })
    await abrir()

    fireEvent.click(screen.getByRole('button', { name: /settings\.saveChanges/ }))

    expect(await screen.findByText('El nombre de la organización es obligatorio')).toBeInTheDocument()
    expect(screen.queryByText('settings.saved')).not.toBeInTheDocument()
  })

  test('NIF, EORI y tipo de organización son de solo lectura y el EORI enlaza con Aduanas', async () => {
    await abrir()

    expect(screen.getByLabelText('settings.nifCif')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('settings.eori')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('settings.orgType')).toHaveAttribute('readonly')

    fireEvent.click(screen.getByRole('button', { name: 'settings.manageInCustoms' }))
    expect(await screen.findByText('Configuracion de Paises y Aduanas')).toBeInTheDocument()
  })

  test.each(['supervisor', 'agent'])('un %s ve los datos en solo lectura y sin botón de guardar', async (role) => {
    usuarioActual.current = { role }
    await abrir()

    expect(screen.getByLabelText('settings.orgName')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('common.city')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: /settings\.saveChanges/ })).not.toBeInTheDocument()
    expect(screen.getByText('settings.generalReadOnly')).toBeInTheDocument()
  })
})
