import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EnviarPago031 from './EnviarPago031'
import { expeditionsAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, o) => (o && typeof o === 'object' ? `${k}:${JSON.stringify(o)}` : k) }),
  initReactI18next: { type: '3rdParty', init: () => {} }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../services/api', () => ({ expeditionsAPI: { sendPago031: vi.fn() } }))

const exp = (declaration, extra = {}) => ({
  _id: 'e1', operationType: 'import',
  client: { contact: { email: 'pagos@cliente.es' } },
  declaration, timeline: [], ...extra
})

describe('EnviarPago031', () => {
  beforeEach(() => vi.clearAllMocks())

  test('con pago previo y H1 presentado: pide confirmación, envía y avisa', async () => {
    expeditionsAPI.sendPago031.mockResolvedValue({ data: { success: true } })
    const onSent = vi.fn()
    render(<EnviarPago031 expedition={exp({ paymentMethod: 'A', mrn: '26ES1' })} onSent={onSent} />)

    fireEvent.click(screen.getByRole('button', { name: /expeditions.pago031.button/ }))
    expect(screen.getByText(/pagos@cliente.es/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.pago031.send' }))

    await waitFor(() => expect(expeditionsAPI.sendPago031).toHaveBeenCalledWith('e1'))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
  })

  test('si se cancela no envía nada', async () => {
    render(<EnviarPago031 expedition={exp({ paymentMethod: 'A', mrn: '26ES1' })} />)
    fireEvent.click(screen.getByRole('button', { name: /expeditions.pago031.button/ }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByText(/pagos@cliente.es/)).not.toBeInTheDocument())
    expect(expeditionsAPI.sendPago031).not.toHaveBeenCalled()
  })

  test('no aparece con pago aplazado (R), sin MRN ni en exportación', () => {
    const { container: a } = render(<EnviarPago031 expedition={exp({ paymentMethod: 'R', mrn: '26ES1' })} />)
    const { container: b } = render(<EnviarPago031 expedition={exp({ paymentMethod: 'A' })} />)
    const { container: c } = render(<EnviarPago031 expedition={exp({ paymentMethod: 'A', mrn: '26ES1' }, { operationType: 'export' })} />)
    expect(a).toBeEmptyDOMElement()
    expect(b).toBeEmptyDOMElement()
    expect(c).toBeEmptyDOMElement()
  })

  test('sin correo del cliente avisa y no abre la confirmación ni envía', async () => {
    const toast = (await import('react-hot-toast')).default
    render(<EnviarPago031 expedition={exp({ paymentMethod: 'A', mrn: '26ES1' }, { client: {} })} />)
    fireEvent.click(screen.getByRole('button', { name: /expeditions.pago031.button/ }))
    expect(toast.error).toHaveBeenCalledWith('expeditions.pago031.noEmail')
    expect(screen.queryByRole('button', { name: 'expeditions.pago031.send' })).not.toBeInTheDocument()
    expect(expeditionsAPI.sendPago031).not.toHaveBeenCalled()
  })

  test('muestra cuándo se envió por última vez', () => {
    render(<EnviarPago031 expedition={exp({ paymentMethod: 'A', mrn: '26ES1' }, { timeline: [{ action: 'payment_031_sent', timestamp: '2026-11-17T09:00:00Z' }] })} />)
    expect(screen.getByText(/expeditions.pago031.lastSent/)).toBeInTheDocument()
  })
})
