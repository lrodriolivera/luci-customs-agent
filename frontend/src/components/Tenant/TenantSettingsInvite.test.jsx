import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TenantSettings from './TenantSettings'
import api from '../../services/api'

/**
 * Invitar usuario al tenant (POST /api/auth/admin/invite) desde la pestaña
 * «Roles y Permisos» de Ajustes. Suite separada de TenantSettings.test.jsx
 * (que ya cubre el resto de la pantalla) para no tocar sus 1000+ líneas.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))
vi.mock('./H1PresentationSettings', () => ({ default: () => null }))
vi.mock('../Admin/AdminPanel', () => ({
  // Mock liviano: solo lo que InviteUserModal/TenantSettings necesitan de PasswordModal.
  PasswordModal: ({ email, password, onClose }) => (
    <div data-testid="password-modal">
      <span>{email}</span>
      <span>{password}</span>
      <button onClick={onClose}>{'common.close'}</button>
    </div>
  )
}))
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  tenantEoriAPI: { get: vi.fn(), update: vi.fn() }
}))

const mockTenantData = { data: { _id: 't1', name: 'Demo Org', slug: 'demo-org' } }

async function irAPestanaUsuarios() {
  render(<TenantSettings />)
  const pestanaRoles = await screen.findByText('settings.roles')
  fireEvent.click(pestanaRoles)
  await screen.findByText('settings.rolesPermissions')
}

describe('Invitar usuario (pestaña Roles y Permisos)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(mockTenantData)
  })

  test('el botón abre el formulario con correo, nombre y rol', async () => {
    await irAPestanaUsuarios()
    fireEvent.click(screen.getByText('settings.inviteUser'))

    expect(screen.getByText('settings.inviteUserTitle')).toBeTruthy()
    expect(screen.getByLabelText('common.email')).toBeTruthy()
    expect(screen.getByLabelText('settings.inviteNameLabel')).toBeTruthy()
    expect(screen.getByLabelText('settings.role')).toBeTruthy()
  })

  test('al enviar, llama a POST /api/auth/admin/invite y muestra la temporal una sola vez', async () => {
    api.post.mockResolvedValue({
      data: { success: true, data: { user: { email: 'nuevo@demo.es' }, temporaryPassword: 'Xx7!aB2cD9eF' } }
    })
    await irAPestanaUsuarios()
    fireEvent.click(screen.getByText('settings.inviteUser'))

    fireEvent.change(screen.getByLabelText('common.email'), { target: { value: 'nuevo@demo.es' } })
    fireEvent.change(screen.getByLabelText('settings.inviteNameLabel'), { target: { value: 'Nuevo Usuario' } })
    fireEvent.click(screen.getByText('settings.inviteSubmit'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/admin/invite', {
        email: 'nuevo@demo.es',
        name: 'Nuevo Usuario',
        role: 'agent'
      })
    })

    const modal = await screen.findByTestId('password-modal')
    expect(modal.textContent).toContain('nuevo@demo.es')
    expect(modal.textContent).toContain('Xx7!aB2cD9eF')
    // El formulario de invitación se cierra al mostrarse la temporal.
    expect(screen.queryByText('settings.inviteUserTitle')).toBeNull()
  })

  test('si el backend rechaza la invitación, muestra el error sin romper la pantalla', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'No se puede invitar: el correo ya esta en uso.' } } })
    await irAPestanaUsuarios()
    fireEvent.click(screen.getByText('settings.inviteUser'))

    fireEvent.change(screen.getByLabelText('common.email'), { target: { value: 'repetido@demo.es' } })
    fireEvent.change(screen.getByLabelText('settings.inviteNameLabel'), { target: { value: 'Repetido' } })
    fireEvent.click(screen.getByText('settings.inviteSubmit'))

    await waitFor(() => {
      expect(screen.getByText('No se puede invitar: el correo ya esta en uso.')).toBeTruthy()
    })
    // Sigue el formulario abierto para reintentar, no la ventana de la temporal.
    expect(screen.queryByTestId('password-modal')).toBeNull()
  })
})
