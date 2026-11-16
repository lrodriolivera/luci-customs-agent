import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render as renderRTL, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PortalPagoTributos from './PortalPagoTributos'
import { portalAPI } from '../../services/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('../../services/api', () => ({ portalAPI: { setPaymentMethod: vi.fn(), downloadH1Definitivo: vi.fn() } }))

// El enlace para subir el justificante es un <Link>: necesita router.
const render = (ui) => renderRTL(<MemoryRouter>{ui}</MemoryRouter>)

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
    expect(container.querySelector('section')).toBeNull()
  })

  describe('pago previo al levante con el H1 admitido (UAT 16/Nov/2026)', () => {
    const admitido = {
      paymentMethod: 'A', editable: false, mrn: '26ES00280110000011', totalAPagar: 1704.96, pendientePago: true, urlPago: URL,
      h1Definitivo: true, justificante: null,
      modelo031: { referencia: '26ES00280110000011', importe: 1704.96, nifImportador: 'B12345678', fechaAdmision: '2026-11-16T10:00:00.000Z', limiteDePago: '2026-11-26' }
    }

    test('muestra los datos para el modelo 031: MRN como referencia, importe, NIF y fecha límite', () => {
      render(<PortalPagoTributos token="tk" pago={admitido} />)
      const datos = screen.getByRole('group', { name: 'portal.taxPayment.form031' })
      expect(datos).toHaveTextContent('portal.taxPayment.reference')
      expect(datos).toHaveTextContent('26ES00280110000011')
      expect(datos).toHaveTextContent('1704,96')
      expect(datos).toHaveTextContent('B12345678')
      expect(datos).toHaveTextContent('portal.taxPayment.deadline')
    })

    test('descarga el H1 definitivo', async () => {
      portalAPI.downloadH1Definitivo.mockResolvedValue({ data: new Blob(['%PDF']) })
      window.URL.createObjectURL = vi.fn(() => 'blob:h1')
      window.URL.revokeObjectURL = vi.fn()
      render(<PortalPagoTributos token="tk" pago={admitido} />)

      fireEvent.click(screen.getByRole('button', { name: 'portal.taxPayment.downloadH1' }))

      await waitFor(() => expect(portalAPI.downloadH1Definitivo).toHaveBeenCalledWith('tk'))
      await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled())
    })

    test('si falla la descarga lo dice', async () => {
      portalAPI.downloadH1Definitivo.mockRejectedValue(new Error('x'))
      render(<PortalPagoTributos token="tk" pago={admitido} />)
      fireEvent.click(screen.getByRole('button', { name: 'portal.taxPayment.downloadH1' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('portal.taxPayment.downloadError')
    })

    test('sin justificante, enlaza a subirlo con el tipo ya elegido', () => {
      render(<PortalPagoTributos token="tk" pago={admitido} />)
      expect(screen.getByRole('link', { name: 'portal.taxPayment.uploadReceipt' }))
        .toHaveAttribute('href', '/portal/tk/documents?tipo=customs_payment_receipt')
    })

    test('con el justificante subido, avisa de que está recibido y a la espera del levante', () => {
      render(<PortalPagoTributos token="tk" pago={{ ...admitido, justificante: { subidoEn: '2026-11-17T08:00:00.000Z' } }} />)
      expect(screen.getByText(/portal.taxPayment.receiptReceived/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'portal.taxPayment.uploadReceipt' })).not.toBeInTheDocument()
    })

    test('con pago aplazado (R) ofrece el H1 definitivo pero no los datos del 031', () => {
      render(<PortalPagoTributos token="tk" pago={{ ...admitido, paymentMethod: 'R', pendientePago: false, modelo031: null }} />)
      expect(screen.getByRole('button', { name: 'portal.taxPayment.downloadH1' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'portal.taxPayment.form031' })).not.toBeInTheDocument()
    })
  })
})
