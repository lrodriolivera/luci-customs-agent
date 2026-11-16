import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PortalPagoTributos from './PortalPagoTributos'
import { portalAPI } from '../../services/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('../../services/api', () => ({ portalAPI: { setPaymentMethod: vi.fn() } }))

const URL = 'https://sede.agenciatributaria.gob.es/Sede/ayuda/pago.html'

describe('PortalPagoTributos', () => {
  beforeEach(() => vi.clearAllMocks())

  test('antes de presentar, el cliente elige pago aplazado con garantía (R)', async () => {
    portalAPI.setPaymentMethod.mockResolvedValue({ data: { data: { paymentMethod: 'R', editable: true, pendientePago: false, urlPago: URL } } })
    render(<PortalPagoTributos token="tk" pago={{ paymentMethod: null, editable: true, pendientePago: false, urlPago: URL }} />)

    fireEvent.click(screen.getByDisplayValue('R'))

    await waitFor(() => expect(portalAPI.setPaymentMethod).toHaveBeenCalledWith('tk', 'R'))
    expect(screen.getByDisplayValue('R')).toBeChecked()
  })

  test('admitido con pago previo: importe de la AEAT, enlace de pago y aviso de espera', () => {
    render(<PortalPagoTributos token="tk" pago={{ paymentMethod: 'A', editable: false, mrn: '26ES1', totalAPagar: 1704.96, pendientePago: true, urlPago: URL }} />)
    expect(screen.getByRole('status')).toHaveTextContent('portal.taxPayment.amountDue:{"importe":"1704,96"}')
    expect(screen.getByRole('link', { name: 'portal.taxPayment.payLink' })).toHaveAttribute('href', URL)
    expect(screen.getByText('portal.taxPayment.waiting')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  test('si falla al guardar lo dice', async () => {
    portalAPI.setPaymentMethod.mockRejectedValue({ response: { data: { error: 'La declaración ya está presentada' } } })
    render(<PortalPagoTributos token="tk" pago={{ paymentMethod: null, editable: true, pendientePago: false, urlPago: URL }} />)
    fireEvent.click(screen.getByDisplayValue('A'))
    expect(await screen.findByRole('alert')).toHaveTextContent('La declaración ya está presentada')
  })

  test('sin datos de pago (exportación) no pinta nada', () => {
    const { container } = render(<PortalPagoTributos token="tk" pago={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
