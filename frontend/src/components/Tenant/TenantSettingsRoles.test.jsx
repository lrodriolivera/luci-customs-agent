import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TenantSettings from './TenantSettings'
import api from '../../services/api'

/**
 * Ajustes › Roles: los recuentos de usuarios por rol salen del servidor
 * (GET /api/tenant/users/role-counts). Antes eran de demostración (2/5/12/8/3).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && opts.count !== undefined ? `${key}:${opts.count}` : key)
  })
}))
vi.mock('./H1PresentationSettings', () => ({ default: () => null }))
vi.mock('../Admin/AdminPanel', () => ({ PasswordModal: () => null }))
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  tenantEoriAPI: { get: vi.fn(), update: vi.fn() }
}))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'supervisor' } })
}))

const recuentos = { counts: { admin: 4, supervisor: 1, agent: 1, viewer: 0 }, total: 6 }

function getCon(respuestaRecuentos) {
  return (url) => {
    if (url === '/api/tenant/me') return Promise.resolve({ data: { success: true, data: { name: 'Demo' } } })
    if (url === '/api/tenant/users/role-counts') return respuestaRecuentos()
    return Promise.resolve({ data: { success: true, data: {} } })
  }
}

async function abrirRoles() {
  render(<TenantSettings />)
  fireEvent.click(await screen.findByRole('button', { name: /settings\.roles/ }))
  await screen.findByText('settings.rolesPermissions')
}

const fila = (etiqueta) => screen.getByText(etiqueta).closest('tr')

describe('Ajustes › Roles: recuentos reales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('muestra los roles de LUCI con los usuarios que devuelve el servidor', async () => {
    api.get.mockImplementation(getCon(() => Promise.resolve({ data: { success: true, data: recuentos } })))
    await abrirRoles()

    expect(await within(fila('settings.roleAdmin')).findByText('settings.usersCount:4')).toBeInTheDocument()
    expect(within(fila('settings.roleSupervisor')).getByText('settings.usersCount:1')).toBeInTheDocument()
    expect(within(fila('settings.roleAgent')).getByText('settings.usersCount:1')).toBeInTheDocument()
    expect(within(fila('settings.roleViewer')).getByText('settings.usersCount:0')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/api/tenant/users/role-counts')
    // Nada de los recuentos de demostración ni de roles que LUCI no tiene
    expect(screen.queryByText('Gestor')).not.toBeInTheDocument()
    expect(screen.queryByText(/12 usuarios/)).not.toBeInTheDocument()
  })

  test('si el servidor no da los recuentos, no se inventa ninguno', async () => {
    api.get.mockImplementation(getCon(() => Promise.reject(new Error('403'))))
    await abrirRoles()

    expect(await screen.findByText('settings.usersCountUnavailable')).toBeInTheDocument()
    expect(screen.queryByText(/settings\.usersCount:/)).not.toBeInTheDocument()
  })
})
