import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPassword from './ResetPassword'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({ authAPI: { resetPassword: vi.fn() } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '../../context/AuthContext'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/reset-password/tok']}>
      <Routes>
        <Route path="/" element={<div>DASHBOARD</div>} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>
  )

describe('ResetPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('con sesión iniciada redirige al dashboard y no pinta el formulario', () => {
    useAuth.mockReturnValue({ isAuthenticated: true })
    montar()
    expect(screen.getByText('DASHBOARD')).toBeTruthy()
    expect(screen.queryByText('auth.resetTitle')).toBeNull()
  })

  it('sin sesión muestra el formulario', () => {
    useAuth.mockReturnValue({ isAuthenticated: false })
    montar()
    expect(screen.getByText('auth.resetTitle')).toBeTruthy()
    expect(screen.queryByText('DASHBOARD')).toBeNull()
  })

  // Arreglo final del 4.2: misma politica que el servidor (10-128, letra y
  // numero), igual que ya exige ForceChangePassword.
  describe('misma politica de contrasena que el servidor', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isAuthenticated: false })
    })

    const llenar = (password) => {
      fireEvent.change(screen.getByLabelText('auth.newPassword'), { target: { value: password } })
      fireEvent.change(screen.getByLabelText('auth.confirmPassword'), { target: { value: password } })
    }

    it('rechaza una contrasena de menos de 10 caracteres sin llamar al backend', async () => {
      montar()
      llenar('Corta1!')
      fireEvent.click(screen.getByText('auth.resetButton'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('auth.passwordPolicyError')
      })
      expect(authAPI.resetPassword).not.toHaveBeenCalled()
    })

    it('rechaza una contrasena sin ningun numero sin llamar al backend', async () => {
      montar()
      llenar('SoloLetrasSinNumeros')
      fireEvent.click(screen.getByText('auth.resetButton'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('auth.passwordPolicyError')
      })
      expect(authAPI.resetPassword).not.toHaveBeenCalled()
    })

    it('rechaza una contrasena sin ninguna letra sin llamar al backend', async () => {
      montar()
      llenar('1234567890123')
      fireEvent.click(screen.getByText('auth.resetButton'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('auth.passwordPolicyError')
      })
      expect(authAPI.resetPassword).not.toHaveBeenCalled()
    })

    it('con una contrasena valida, llama al backend', async () => {
      authAPI.resetPassword.mockResolvedValue({ data: { success: true } })
      montar()
      llenar('ContrasenaValida1')
      fireEvent.click(screen.getByText('auth.resetButton'))

      await waitFor(() => {
        expect(authAPI.resetPassword).toHaveBeenCalledWith('tok', 'ContrasenaValida1')
      })
    })

    it('si el servidor responde 400 con details, muestra el mensaje especifico', async () => {
      authAPI.resetPassword.mockRejectedValue({
        response: {
          data: {
            success: false,
            error: 'Datos de entrada invalidos',
            details: [{ field: 'password', message: 'La contrasena debe ser texto, de 10 a 128 caracteres, con al menos una letra y un numero.' }]
          }
        }
      })
      montar()
      llenar('ContrasenaValida1')
      fireEvent.click(screen.getByText('auth.resetButton'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('La contrasena debe ser texto, de 10 a 128 caracteres, con al menos una letra y un numero.')
      })
    })
  })
})
