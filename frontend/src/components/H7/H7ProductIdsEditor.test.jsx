import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import H7ProductIdsEditor from './H7ProductIdsEditor'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../services/api', () => ({ h7API: { update: vi.fn() } }))

const item = (extra = {}) => ({
  _id: 'it1', description: 'Libro', taricCode: '4901990000', quantity: 1, unitValue: 12,
  totalValue: 12, netWeight: 0.3, countryOfOrigin: 'CN', ...extra
})
const decl = (extra = {}) => ({ _id: 'h7-1', status: 'draft', items: [item()], ...extra })

describe('H7ProductIdsEditor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('en borrador sin identificadores avisa de que la AEAT los exige', () => {
    render(<H7ProductIdsEditor declaration={decl()} onSaved={vi.fn()} />)
    expect(screen.getByText('h7.productIds.missingBanner')).toBeDefined()
    expect(screen.getByLabelText('h7.productIds.commercialId 1')).toBeDefined()
  })

  it('guarda los identificadores conservando el resto de la partida', async () => {
    const onSaved = vi.fn()
    h7API.update.mockResolvedValue({ data: { success: true, data: decl() } })
    render(<H7ProductIdsEditor declaration={decl()} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('h7.productIds.commercialId 1'), { target: { value: ' SKU-1 ' } })
    fireEvent.change(screen.getByLabelText('h7.productIds.manufacturerRef 1'), { target: { value: 'EDT-77' } })
    fireEvent.click(screen.getByRole('button', { name: 'h7.productIds.save' }))
    await waitFor(() => expect(h7API.update).toHaveBeenCalledTimes(1))
    const [id, body] = h7API.update.mock.calls[0]
    expect(id).toBe('h7-1')
    expect(body.items[0]).toMatchObject({
      _id: 'it1', description: 'Libro', taricCode: '4901990000', totalValue: 12,
      commercialId: 'SKU-1', manufacturerRef: 'EDT-77'
    })
    expect(body.items[0].gtin).toBeUndefined()
    expect(toast.success).toHaveBeenCalledWith('h7.productIds.saved')
    expect(onSaved).toHaveBeenCalled()
  })

  it('no guarda si falta un identificador obligatorio', async () => {
    render(<H7ProductIdsEditor declaration={decl()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('h7.productIds.commercialId 1'), { target: { value: 'SKU-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'h7.productIds.save' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('h7.productIds.errorMissingIds'))
    expect(h7API.update).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor si no se puede guardar', async () => {
    h7API.update.mockRejectedValue({ response: { data: { message: 'No se puede modificar' } } })
    render(<H7ProductIdsEditor declaration={decl({ items: [item({ commercialId: 'S', manufacturerRef: 'R' })] })} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'h7.productIds.save' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se puede modificar'))
  })

  it('fuera de borrador solo muestra los valores (sin inputs ni botón)', () => {
    render(<H7ProductIdsEditor declaration={decl({ status: 'submitted', items: [item({ commercialId: 'SKU-9', manufacturerRef: 'R-9' })] })} />)
    expect(screen.queryByRole('button', { name: 'h7.productIds.save' })).toBeNull()
    expect(screen.queryByLabelText('h7.productIds.commercialId 1')).toBeNull()
    expect(screen.getByText('SKU-9')).toBeDefined()
    expect(screen.getByText('h7.productIds.y081')).toBeDefined()
  })

  it('permite corregir un TARIC de 6 cifras de un borrador de manifiesto', async () => {
    h7API.update.mockResolvedValue({ data: { success: true } })
    render(<H7ProductIdsEditor declaration={decl({ items: [item({ taricCode: '490199' })] })} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('h7.productIds.taricCode 1'), { target: { value: '4901990000' } })
    fireEvent.change(screen.getByLabelText('h7.productIds.commercialId 1'), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText('h7.productIds.manufacturerRef 1'), { target: { value: 'R' } })
    fireEvent.click(screen.getByRole('button', { name: 'h7.productIds.save' }))
    await waitFor(() => expect(h7API.update).toHaveBeenCalledTimes(1))
    expect(h7API.update.mock.calls[0][1].items[0].taricCode).toBe('4901990000')
  })
})
