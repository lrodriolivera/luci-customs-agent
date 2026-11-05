import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPassword from './ResetPassword'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({ authAPI: { resetPassword: vi.fn() } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '../../context/AuthContext'

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
})
