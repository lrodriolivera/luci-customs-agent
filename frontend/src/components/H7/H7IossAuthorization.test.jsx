import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import H7IossAuthorization from './H7IossAuthorization'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../services/api', () => ({ h7API: { update: vi.fn() } }))

const decl = (extra = {}) => ({ _id: 'h7-1', status: 'draft', iossNumber: 'IM1234567890', ...extra })

describe('H7IossAuthorization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin IOSS no pinta nada', () => {
    const { container } = render(<H7IossAuthorization declaration={decl({ iossNumber: '' })} />)
    expect(container.innerHTML).toBe('')
  })

  it('con IOSS y sin 1014 avisa', () => {
    render(<H7IossAuthorization declaration={decl()} />)
    expect(screen.getByText('h7.ioss.authWarning')).toBeDefined()
  })

  it('en borrador guarda la referencia del 1014', async () => {
    const onSaved = vi.fn()
    h7API.update.mockResolvedValue({ data: { success: true } })
    render(<H7IossAuthorization declaration={decl()} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('h7.ioss.authRef'), { target: { value: ' ESIOSS2026000001 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'h7.ioss.save' }))
    await waitFor(() => expect(h7API.update).toHaveBeenCalledWith('h7-1', { iossAuthorizationRef: 'ESIOSS2026000001' }))
    expect(toast.success).toHaveBeenCalledWith('h7.ioss.saved')
    expect(onSaved).toHaveBeenCalled()
  })

  it('muestra el error del servidor', async () => {
    h7API.update.mockRejectedValue({ response: { data: { message: 'No se puede modificar' } } })
    render(<H7IossAuthorization declaration={decl()} />)
    fireEvent.click(screen.getByRole('button', { name: 'h7.ioss.save' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se puede modificar'))
  })

  it('fuera de borrador muestra la referencia sin editar', () => {
    render(<H7IossAuthorization declaration={decl({ status: 'released', iossAuthorizationRef: 'ESIOSS2026000001' })} />)
    expect(screen.getByText('ESIOSS2026000001')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'h7.ioss.save' })).toBeNull()
    expect(screen.queryByText('h7.ioss.authWarning')).toBeNull()
  })
})
