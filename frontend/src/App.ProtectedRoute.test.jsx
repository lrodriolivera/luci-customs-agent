import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from './App'

/**
 * ProtectedRoute decide ademas si se muestra ForceChangePassword cuando el
 * usuario entro con la contrasena temporal de una invitacion (admin/invite) y
 * aun no la ha cambiado. Mientras eso no ocurra, no hay otra pantalla
 * disponible: el backend rechaza el resto de rutas (MUST_CHANGE_PASSWORD).
 */
vi.mock('./context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('./components/Auth/ForceChangePassword', () => ({
  default: () => <div>FORCE_CHANGE_PASSWORD_SCREEN</div>
}))

import { useAuth } from './context/AuthContext'

const montar = () =>
  render(
    <MemoryRouter>
      <ProtectedRoute>
        <div>APP_PROTEGIDA</div>
      </ProtectedRoute>
    </MemoryRouter>
  )

describe('ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin sesion redirige a /login (no pinta ni la app ni el cambio de contrasena)', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false, user: null })
    montar()
    expect(screen.queryByText('APP_PROTEGIDA')).toBeNull()
    expect(screen.queryByText('FORCE_CHANGE_PASSWORD_SCREEN')).toBeNull()
  })

  it('con sesion y sin password temporal pendiente, pinta la app', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false, user: { mustChangePassword: false } })
    montar()
    expect(screen.getByText('APP_PROTEGIDA')).toBeTruthy()
  })

  it('con mustChangePassword, bloquea la app y muestra la pantalla de cambio obligatorio', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false, user: { mustChangePassword: true } })
    montar()
    expect(screen.queryByText('APP_PROTEGIDA')).toBeNull()
    expect(screen.getByText('FORCE_CHANGE_PASSWORD_SCREEN')).toBeTruthy()
  })
})
