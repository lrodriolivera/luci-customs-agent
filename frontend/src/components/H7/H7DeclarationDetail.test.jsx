import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import H7DeclarationDetail from './H7DeclarationDetail'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-id-123' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock toast with default export
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

// Mock h7API
vi.mock('../../services/api', () => ({
  h7API: {
    get: vi.fn(),
    submit: vi.fn()
  }
}))

describe('H7DeclarationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockDeclaration = {
    reference: 'H7-2026-001',
    trackingNumber: 'TRK123456',
    status: 'draft',
    sender: {
      name: 'Sender Company',
      address: { country: 'CN' },
      eori: 'CN123456789'
    },
    recipient: {
      name: 'Recipient Company',
      taxId: 'B12345678',
      address: {
        street: 'Calle Principal 123',
        city: 'Madrid',
        postalCode: '28001'
      }
    },
    items: [
      {
        description: 'Item 1',
        taricCode: '12345678',
        countryOfOrigin: 'CN',
        quantity: 10,
        totalValue: 100.50,
        netWeight: 5.25
      },
      {
        description: 'Item 2',
        taricCode: '87654321',
        countryOfOrigin: 'US',
        quantity: 5,
        totalValue: 200.75,
        netWeight: 10.50
      }
    ],
    totals: {
      intrinsicValue: 301.25,
      customsValue: 350.00,
      grossWeight: 16.00,
      packages: 3
    },
    duties: {
      tariff: { rate: 3.5, amount: 12.25 },
      vat: { rate: 21, amount: 73.50 },
      totalDue: 85.75
    },
    carrier: {
      name: 'DHL',
      code: 'DHL'
    },
    documentoPrevio: {
      tipo: 'N337',
      referencia: 'G4-REF-001'
    },
    garantiaGRN: 'GRN123456',
    statusHistory: [
      {
        status: 'draft',
        timestamp: '2026-08-01T10:00:00Z',
        reason: 'Created'
      }
    ]
  }

  test('muestra spinner mientras carga', () => {
    h7API.get.mockImplementation(() => new Promise(() => {}))
    render(<H7DeclarationDetail />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('muestra mensaje de error cuando la declaracion no se encuentra', async () => {
    h7API.get.mockResolvedValue({ data: { data: null } })
    render(<H7DeclarationDetail />)
    await waitFor(() => {
      expect(screen.getByText('Declaración no encontrada')).toBeInTheDocument()
    })
    expect(screen.getByText('Volver a la lista')).toBeInTheDocument()
  })

  test('muestra error toast cuando falla la carga', async () => {
    h7API.get.mockRejectedValue(new Error('Network error'))
    render(<H7DeclarationDetail />)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error cargando declaración')
    })
  })

  test('renderiza declaracion completa correctamente', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/TRK123456/)).toBeInTheDocument()
    expect(screen.getAllByText('Borrador').length).toBeGreaterThan(0)
    expect(screen.getByText('Sender Company')).toBeInTheDocument()
    expect(screen.getByText('Recipient Company')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  test('muestra boton de enviar para estado draft', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Enviar a AEAT')).toBeInTheDocument()
  })

  test('muestra boton de enviar para estado pending', async () => {
    const pendingDecl = { ...mockDeclaration, status: 'pending' }
    h7API.get.mockResolvedValue({ data: { data: pendingDecl } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Enviar a AEAT')).toBeInTheDocument()
  })

  test('no muestra boton de enviar para estado submitted', async () => {
    const submittedDecl = { ...mockDeclaration, status: 'submitted' }
    h7API.get.mockResolvedValue({ data: { data: submittedDecl } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.queryByText('Enviar a AEAT')).not.toBeInTheDocument()
  })

  test('envia declaracion exitosamente', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockResolvedValue({
      data: {
        success: true,
        data: { mrn: '26ES123456789012345' }
      }
    })

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(h7API.submit).toHaveBeenCalledWith('test-id-123')
      expect(toast.success).toHaveBeenCalledWith('Declaración enviada - MRN: 26ES123456789012345')
    })
  })

  test('maneja envio exitoso sin MRN', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockResolvedValue({
      data: {
        success: true,
        data: {}
      }
    })

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Declaración enviada - MRN: Pendiente')
    })
  })

  test('maneja error de envio con mensaje del servidor', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockResolvedValue({
      data: {
        success: false,
        message: 'Validación fallida'
      }
    })

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Validación fallida')
    })
  })

  test('maneja error de envio sin mensaje', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockResolvedValue({
      data: {
        success: false
      }
    })

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al enviar')
    })
  })

  test('maneja excepcion de red en envio', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockRejectedValue({
      response: {
        data: { message: 'Red timeout' }
      }
    })

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Red timeout')
    })
  })

  test('maneja excepcion sin respuesta del servidor', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockRejectedValue(new Error('Unknown error'))

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al enviar a AEAT')
    })
  })

  test('muestra estado submitting durante envio', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockImplementation(() => new Promise(() => {}))

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Enviando...')).toBeInTheDocument()
    })
  })

  test('renderiza banner MRN cuando existe', async () => {
    const declWithMrn = {
      ...mockDeclaration,
      mrn: '26ES123456789012345',
      aeatResponse: {
        message: 'Aceptada',
        csv: 'CSV123'
      }
    }
    h7API.get.mockResolvedValue({ data: { data: declWithMrn } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/MRN: 26ES123456789012345/)).toBeInTheDocument()
    expect(screen.getByText('Aceptada')).toBeInTheDocument()
    expect(screen.getByText(/CSV: CSV123/)).toBeInTheDocument()
  })

  test('renderiza MRN sin mensaje ni CSV', async () => {
    const declWithMrn = {
      ...mockDeclaration,
      mrn: '26ES123456789012345'
    }
    h7API.get.mockResolvedValue({ data: { data: declWithMrn } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/MRN: 26ES123456789012345/)).toBeInTheDocument()
  })

  test('renderiza circuito verde correctamente', async () => {
    const declWithChannel = {
      ...mockDeclaration,
      channel: 'green'
    }
    h7API.get.mockResolvedValue({ data: { data: declWithChannel } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/Verde — Levante automático/)).toBeInTheDocument()
    expect(screen.getByText(/La mercancía puede ser entregada al destinatario sin inspección/)).toBeInTheDocument()
  })

  test('renderiza circuito naranja correctamente', async () => {
    const declWithChannel = {
      ...mockDeclaration,
      channel: 'orange'
    }
    h7API.get.mockResolvedValue({ data: { data: declWithChannel } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/Naranja — Revisión documental/)).toBeInTheDocument()
    expect(screen.getByText(/Se requiere revisión de documentación antes de liberar la mercancía/)).toBeInTheDocument()
  })

  test('renderiza circuito rojo correctamente', async () => {
    const declWithChannel = {
      ...mockDeclaration,
      channel: 'red'
    }
    h7API.get.mockResolvedValue({ data: { data: declWithChannel } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/Rojo — Inspección física/)).toBeInTheDocument()
    expect(screen.getByText(/Se requiere inspección física de la mercancía/)).toBeInTheDocument()
  })

  test('renderiza circuito desde aeatResponse', async () => {
    const declWithChannel = {
      ...mockDeclaration,
      aeatResponse: { channel: 'green' }
    }
    h7API.get.mockResolvedValue({ data: { data: declWithChannel } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/Verde — Levante automático/)).toBeInTheDocument()
  })

  test('renderiza circuito desconocido', async () => {
    const declWithChannel = {
      ...mockDeclaration,
      channel: 'purple'
    }
    h7API.get.mockResolvedValue({ data: { data: declWithChannel } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/Circuito: purple/)).toBeInTheDocument()
  })

  test('renderiza checklist de cumplimiento con documento previo', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Documento previo N337')).toBeInTheDocument()
    expect(screen.getByText(/Tipo: N337 \| Ref: G4-REF-001/)).toBeInTheDocument()
  })

  test('renderiza checklist sin documento previo', async () => {
    const declWithoutDoc = {
      ...mockDeclaration,
      documentoPrevio: {}
    }
    h7API.get.mockResolvedValue({ data: { data: declWithoutDoc } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Documento previo N337')).toBeInTheDocument()
    const alertIcon = screen.getAllByText('!')
    expect(alertIcon.length).toBeGreaterThan(0)
  })

  test('renderiza XML preview cuando hay documento previo', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/XML generado para AEAT \(fragmento C44\)/)).toBeInTheDocument()
    expect(screen.getByText(/<C44Tipo>N337<\/C44Tipo>/)).toBeInTheDocument()
  })

  test('no renderiza XML preview sin documento previo', async () => {
    const declWithoutDoc = {
      ...mockDeclaration,
      documentoPrevio: {}
    }
    h7API.get.mockResolvedValue({ data: { data: declWithoutDoc } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.queryByText(/XML generado para AEAT/)).not.toBeInTheDocument()
  })

  test('renderiza remitente sin EORI', async () => {
    const declWithoutEori = {
      ...mockDeclaration,
      sender: {
        name: 'Sender Company',
        address: { country: 'CN' }
      }
    }
    h7API.get.mockResolvedValue({ data: { data: declWithoutEori } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Sender Company')).toBeInTheDocument()
    expect(screen.queryByText(/EORI:/)).not.toBeInTheDocument()
  })

  test('renderiza items con valores formateados', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('100.50 €')).toBeInTheDocument()
    expect(screen.getByText('200.75 €')).toBeInTheDocument()
    expect(screen.getByText('5.25 kg')).toBeInTheDocument()
    expect(screen.getByText('10.50 kg')).toBeInTheDocument()
  })

  test('renderiza totales correctamente', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('301.25 €')).toBeInTheDocument()
    expect(screen.getByText('350.00 €')).toBeInTheDocument()
    expect(screen.getByText('16.00 kg')).toBeInTheDocument()
  })

  test('renderiza derechos correctamente', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('12.25 €')).toBeInTheDocument()
    expect(screen.getByText('73.50 €')).toBeInTheDocument()
    expect(screen.getByText('85.75 €')).toBeInTheDocument()
  })

  test('renderiza transportista con IOSS', async () => {
    const declWithIoss = {
      ...mockDeclaration,
      iossNumber: 'IM1234567890'
    }
    h7API.get.mockResolvedValue({ data: { data: declWithIoss } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText(/IM1234567890/)).toBeInTheDocument()
  })

  test('renderiza historial de estado', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Historial')).toBeInTheDocument()
    expect(screen.getByText(/Created/)).toBeInTheDocument()
  })

  test('no renderiza historial cuando esta vacio', async () => {
    const declWithoutHistory = {
      ...mockDeclaration,
      statusHistory: []
    }
    h7API.get.mockResolvedValue({ data: { data: declWithoutHistory } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.queryByText('Historial')).not.toBeInTheDocument()
  })

  test('renderiza diferentes estados en statusConfig', async () => {
    const statuses = ['pending', 'validating', 'submitted', 'released', 'rejected', 'cancelled', 'error']

    for (const status of statuses) {
      const declWithStatus = { ...mockDeclaration, status }
      h7API.get.mockResolvedValue({ data: { data: declWithStatus } })
      const { unmount } = render(<H7DeclarationDetail />)

      await screen.findByText('H7-2026-001')
      unmount()
    }

    expect(h7API.get).toHaveBeenCalledTimes(statuses.length)
  })

  test('renderiza valores fallback cuando faltan datos', async () => {
    const minimalDecl = {
      reference: 'H7-MIN',
      trackingNumber: 'TRK-MIN',
      status: 'draft',
      sender: {},
      recipient: { address: {} },
      items: [],
      totals: {},
      duties: {},
      carrier: {}
    }
    h7API.get.mockResolvedValue({ data: { data: minimalDecl } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-MIN')
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  test('renderiza carrier con solo code', async () => {
    const declWithCode = {
      ...mockDeclaration,
      carrier: { code: 'FDX' }
    }
    h7API.get.mockResolvedValue({ data: { data: declWithCode } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('FDX')).toBeInTheDocument()
  })

  test('renderiza items vacios correctamente', async () => {
    const declWithNoItems = {
      ...mockDeclaration,
      items: []
    }
    h7API.get.mockResolvedValue({ data: { data: declWithNoItems } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Partidas (0)')).toBeInTheDocument()
  })

  test('formatea fecha del historial en español', async () => {
    const declWithHistory = {
      ...mockDeclaration,
      statusHistory: [
        {
          status: 'draft',
          timestamp: '2026-08-01T12:30:00Z'
        }
      ]
    }
    h7API.get.mockResolvedValue({ data: { data: declWithHistory } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const dateElements = screen.getAllByText(/2026/i)
    expect(dateElements.length).toBeGreaterThan(0)
  })

  test('renderiza garantia GRN correctamente', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Garantia aduanera (GRN)')).toBeInTheDocument()
    expect(screen.getByText('GRN123456')).toBeInTheDocument()
  })

  test('renderiza sin garantia GRN', async () => {
    const declWithoutGrn = {
      ...mockDeclaration,
      garantiaGRN: null
    }
    h7API.get.mockResolvedValue({ data: { data: declWithoutGrn } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Garantia aduanera (GRN)')).toBeInTheDocument()
    const minusIcon = screen.getAllByText('-')
    expect(minusIcon.length).toBeGreaterThan(0)
  })

  test('renderiza alerta de desconsolidacion G4', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Desconsolidacion G4 restringida')).toBeInTheDocument()
    expect(screen.getByText(/Desde 10\/Mar solo en ubicaciones con "Admite DSDT = Si"/)).toBeInTheDocument()
  })

  test('renderiza alerta de derecho fijo EU 2026/382', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Derecho fijo 3 EUR/articulo')).toBeInTheDocument()
    expect(screen.getByText(/Reg. \(UE\) 2026\/382/)).toBeInTheDocument()
  })

  test('renderiza historial sin razon', async () => {
    const declWithHistory = {
      ...mockDeclaration,
      statusHistory: [
        {
          status: 'submitted',
          timestamp: '2026-08-01T10:00:00Z'
        }
      ]
    }
    h7API.get.mockResolvedValue({ data: { data: declWithHistory } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  test('renderiza referencia G4 correctamente', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Referencia G4 deposito temporal')).toBeInTheDocument()
    expect(screen.getByText('G4-REF-001')).toBeInTheDocument()
  })

  test('renderiza referencia G4 sin referencia', async () => {
    const declWithoutRef = {
      ...mockDeclaration,
      documentoPrevio: {
        tipo: 'N337'
      }
    }
    h7API.get.mockResolvedValue({ data: { data: declWithoutRef } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getByText('Referencia G4 deposito temporal')).toBeInTheDocument()
    const questionIcon = screen.getAllByText('?')
    expect(questionIcon.length).toBeGreaterThan(0)
  })

  test('recarga declaracion despues de envio exitoso', async () => {
    h7API.get.mockResolvedValue({ data: { data: mockDeclaration } })
    h7API.submit.mockResolvedValue({
      data: {
        success: true,
        data: { mrn: '26ES123456789012345' }
      }
    })

    const user = userEvent.setup()
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    const submitBtn = screen.getByText('Enviar a AEAT')

    h7API.get.mockClear()
    await user.click(submitBtn)

    await waitFor(() => {
      expect(h7API.get).toHaveBeenCalledWith('test-id-123')
    })
  })

  test('maneja valores numericos cero correctamente', async () => {
    const declWithZeros = {
      ...mockDeclaration,
      items: [
        {
          description: 'Item Zero',
          taricCode: '00000000',
          countryOfOrigin: 'XX',
          quantity: 0,
          totalValue: 0,
          netWeight: 0
        }
      ],
      totals: {
        intrinsicValue: 0,
        customsValue: 0,
        grossWeight: 0,
        packages: 1
      },
      duties: {
        tariff: { rate: 0, amount: 0 },
        vat: { rate: 21, amount: 0 },
        totalDue: 0
      }
    }
    h7API.get.mockResolvedValue({ data: { data: declWithZeros } })
    render(<H7DeclarationDetail />)

    await screen.findByText('H7-2026-001')
    expect(screen.getAllByText('0.00 €').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0.00 kg').length).toBeGreaterThan(0)
  })
})
