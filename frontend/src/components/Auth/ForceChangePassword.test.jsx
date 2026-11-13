import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ForceChangePassword from './ForceChangePassword'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

describe('ForceChangePassword', () => {
  let completeMandatoryPasswordChange
  let logout

  beforeEach(() => {
    vi.clearAllMocks()
    completeMandatoryPasswordChange = vi.fn().mockResolvedValue({ success: true })
    logout = vi.fn()
    useAuth.mockReturnValue({ completeMandatoryPasswordChange, logout })
  })

  const llenarFormulario = ({ actual = 'Temporal123!', nueva = 'NuevaSegura1!', confirmar = 'NuevaSegura1!' } = {}) => {
    fireEvent.change(screen.getByLabelText('auth.temporaryPasswordLabel'), { target: { value: actual } })
    fireEvent.change(screen.getByLabelText('auth.newPassword'), { target: { value: nueva } })
    fireEvent.change(screen.getByLabelText('auth.confirmPassword'), { target: { value: confirmar } })
  }

  it('pide la temporal, la nueva y su confirmacion', () => {
    render(<ForceChangePassword />)
    expect(screen.getByLabelText('auth.temporaryPasswordLabel')).toBeTruthy()
    expect(screen.getByLabelText('auth.newPassword')).toBeTruthy()
    expect(screen.getByLabelText('auth.confirmPassword')).toBeTruthy()
  })

  it('envia currentPassword y newPassword al confirmar', async () => {
    render(<ForceChangePassword />)
    llenarFormulario()
    fireEvent.click(screen.getByText('auth.savePassword'))

    await waitFor(() => {
      expect(completeMandatoryPasswordChange).toHaveBeenCalledWith('Temporal123!', 'NuevaSegura1!')
    })
  })

  it('si la nueva y la confirmacion no coinciden, no llama al backend', async () => {
    render(<ForceChangePassword />)
    llenarFormulario({ confirmar: 'OtraCosa1!' })
    fireEvent.click(screen.getByText('auth.savePassword'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('auth.passwordMismatch')
    })
    expect(completeMandatoryPasswordChange).not.toHaveBeenCalled()
  })

  it('si el backend rechaza el cambio, avisa con el error devuelto', async () => {
    completeMandatoryPasswordChange.mockResolvedValue({ success: false, error: 'Contrasena actual incorrecta' })
    render(<ForceChangePassword />)
    llenarFormulario()
    fireEvent.click(screen.getByText('auth.savePassword'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Contrasena actual incorrecta')
    })
  })

  // BAJO-E de la 2a revision de seguridad del 4.2: el minimo del cliente
  // tiene que ser el mismo que el del servidor (10, con letra y numero), no
  // los 8 sin mas requisitos de antes.
  it('rechaza una nueva de menos de 10 caracteres sin llamar al backend', async () => {
    render(<ForceChangePassword />)
    llenarFormulario({ nueva: 'Corta1!', confirmar: 'Corta1!' })
    fireEvent.click(screen.getByText('auth.savePassword'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('auth.passwordPolicyError')
    })
    expect(completeMandatoryPasswordChange).not.toHaveBeenCalled()
  })

  it('rechaza una nueva sin ningun numero sin llamar al backend', async () => {
    render(<ForceChangePassword />)
    llenarFormulario({ nueva: 'SoloLetrasSinNumeros', confirmar: 'SoloLetrasSinNumeros' })
    fireEvent.click(screen.getByText('auth.savePassword'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('auth.passwordPolicyError')
    })
    expect(completeMandatoryPasswordChange).not.toHaveBeenCalled()
  })

  it('rechaza una nueva sin ninguna letra sin llamar al backend', async () => {
    render(<ForceChangePassword />)
    llenarFormulario({ nueva: '1234567890123', confirmar: '1234567890123' })
    fireEvent.click(screen.getByText('auth.savePassword'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('auth.passwordPolicyError')
    })
    expect(completeMandatoryPasswordChange).not.toHaveBeenCalled()
  })

  it('permite cerrar sesion desde esta pantalla', () => {
    render(<ForceChangePassword />)
    fireEvent.click(screen.getByText('nav.logout'))
    expect(logout).toHaveBeenCalled()
  })
})
