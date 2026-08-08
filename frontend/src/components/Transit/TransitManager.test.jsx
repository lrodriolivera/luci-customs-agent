import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TransitManager from './TransitManager'
import { transitAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  transitAPI: {
    list: vi.fn(),
    getStats: vi.fn(),
    getOverdue: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    submit: vi.fn(),
    releaseAtDeparture: vi.fn(),
    startTransit: vi.fn(),
    notifyArrival: vi.fn(),
    notifyUnloading: vi.fn(),
    releaseGoods: vi.fn(),
    complete: vi.fn(),
    aiAutoComplete: vi.fn(),
    aiValidateRoute: vi.fn(),
    aiPredictIncidents: vi.fn(),
    aiSuggestGuarantee: vi.fn(),
    aiFullAnalysis: vi.fn(),
    aiApplySuggestion: vi.fn()
  }
}))

describe('<TransitManager />', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mocks por defecto con datos ricos para ejercitar JSX condicional
    transitAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: {
          transits: [
            {
              _id: 'transit-1',
              mrn: '26ES000012345678901234',
              lrn: 'T1-2026-001',
              reference: 'REF-T1-001',
              transitType: 'T1',
              status: 'draft',
              principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
              departureOffice: { code: 'ES004801', name: 'Barcelona', country: 'ES' },
              destinationOffice: { code: 'FR001001', name: 'Paris', country: 'FR' },
              transport: { mode: '3', vehicleId: '1234ABC', nationality: 'ES', seals: [{ number: 'SEAL001', sealType: 'customs', affixedBy: 'Aduana', intactOnArrival: true }], sealCount: 1 },
              guarantee: { type: '1', grn: 'GRN123456' },
              totals: { itemCount: 5, grossWeight: 1500 },
              dates: { declaration: '2026-08-01T10:00:00Z', releaseAtDeparture: null, actualArrival: null, goodsRelease: null, completion: null },
              deadlines: { arrivalDeadline: '2026-08-15T23:59:59Z' },
              messages: [{ type: 'IE015', direction: 'outbound', timestamp: '2026-08-01T10:00:00Z' }]
            },
            {
              _id: 'transit-2',
              mrn: null,
              lrn: 'T2-2026-002',
              reference: 'REF-T2-002',
              transitType: 'T2',
              status: 'in_transit',
              principal: { name: 'Cliente Test' },
              departureOffice: { code: 'ES004801' },
              destinationOffice: { code: 'DE001001' },
              transport: { mode: '1', seals: [] },
              totals: { itemCount: 2, grossWeight: 500 },
              dates: { declaration: '2026-07-20T08:00:00Z', releaseAtDeparture: '2026-07-21T09:00:00Z', actualArrival: null },
              deadlines: { arrivalDeadline: '2026-07-25T23:59:59Z' },
              messages: []
            }
          ],
          pagination: { total: 2, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    transitAPI.getStats.mockResolvedValue({
      data: {
        success: true,
        data: { total: 2, byType: { T1: 1, T2: 1, T2F: 0, TIR: 0 } }
      }
    })

    transitAPI.getOverdue.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'overdue-1',
            mrn: '26ES111111111111111111',
            lrn: 'OVERDUE-001',
            transitType: 'T1',
            deadlines: { arrivalDeadline: '2026-07-01T23:59:59Z' }
          }
        ]
      }
    })
  })

  test('renderiza el título y botón de nuevo tránsito', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    expect(screen.getByText('transit.title')).toBeInTheDocument()
    expect(screen.getByText('transit.newTransit')).toBeInTheDocument()

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
    })
  })

  test('carga datos al montarse: lista, stats y overdue', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalled()
      expect(transitAPI.getStats).toHaveBeenCalled()
      expect(transitAPI.getOverdue).toHaveBeenCalled()
    })
  })

  test('muestra alerta de tránsitos vencidos', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('1 transito(s) vencido(s)')).toBeInTheDocument()
      expect(screen.getByText(/26ES111111111111111111/)).toBeInTheDocument()
    })
  })

  test('muestra stats con totales y por tipo', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // total
    })
  })

  test('renderiza lista de tránsitos con datos', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument()
      expect(screen.getByText(/T2-2026-002/)).toBeInTheDocument()
      expect(screen.getByText(/REF-T1-001/)).toBeInTheDocument()
    })
  })

  test('lista vacía muestra mensaje', async () => {
    transitAPI.list.mockResolvedValue({
      data: { success: true, data: { transits: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } } }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('transit.noTransits')).toBeInTheDocument()
    })
  })

  test('filtro por tipo de tránsito', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(transitAPI.list).toHaveBeenCalled())

    const select = screen.getAllByRole('combobox')[0]
    fireEvent.change(select, { target: { value: 'T1' } })

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledWith(expect.objectContaining({ transitType: 'T1' }))
    })
  })

  test('filtro por estado', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(transitAPI.list).toHaveBeenCalled())

    const select = screen.getAllByRole('combobox')[1]
    fireEvent.change(select, { target: { value: 'in_transit' } })

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_transit' }))
    })
  })

  test('búsqueda por texto', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(transitAPI.list).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('Buscar MRN, LRN, referencia...')
    fireEvent.change(input, { target: { value: 'REF-T1' } })

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'REF-T1' }))
    })
  })

  test('botón actualizar recarga datos', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(transitAPI.list).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('common.update'))

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledTimes(2)
    })
  })

  test('expandir/colapsar fila muestra detalles', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    // Click en la fila para expandir
    const row = screen.getByText(/26ES000012345678901234/).closest('.p-4')
    fireEvent.click(row)

    await waitFor(() => {
      expect(screen.getByText('Informacion')).toBeInTheDocument()
      expect(screen.getByText('Fechas')).toBeInTheDocument()
      expect(screen.getByText('Acciones')).toBeInTheDocument()
    })

    // Precintos
    expect(screen.getByText('Precintos (1)')).toBeInTheDocument()
    expect(screen.getByText('SEAL001')).toBeInTheDocument()
  })

  test('estados de tránsito muestran config correcta', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      // draft y in_transit
      expect(screen.getByText('Borrador')).toBeInTheDocument()
      expect(screen.getByText('En Transito')).toBeInTheDocument()
    })
  })

  test('tipos de tránsito T1 y T2 visibles', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('T1').length).toBeGreaterThan(0)
      expect(screen.getAllByText('T2').length).toBeGreaterThan(0)
    })
  })

  test.each([
    ['draft', 'submit', 'Enviar a NCTS'],
    ['accepted', 'release-departure', 'Liberar en Partida'],
    ['released', 'start', 'Iniciar Transito'],
    ['in_transit', 'arrival', 'Notificar Llegada'],
    ['arrived', 'release-goods', 'Liberar Mercancias'],
    ['goods_released', 'complete', 'Completar']
  ])('acciones por estado: %s muestra %s', async (status, actionKey, actionLabel) => {
    transitAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't1', mrn: 'MRN001', lrn: 'LRN001', status, transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('MRN001')).toBeInTheDocument())

    fireEvent.click(screen.getByText('MRN001'))

    await waitFor(() => {
      expect(screen.getByText(actionLabel)).toBeInTheDocument()
    })
  })

  test('acción submit ejecuta y recarga', async () => {
    transitAPI.submit.mockResolvedValue({ data: { success: true } })

    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't1', mrn: null, lrn: 'LRN-DRAFT', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('LRN-DRAFT')).toBeInTheDocument())

    fireEvent.click(screen.getByText('LRN-DRAFT'))

    await waitFor(() => expect(screen.getByText('Enviar a NCTS')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Enviar a NCTS'))

    await waitFor(() => {
      expect(transitAPI.submit).toHaveBeenCalledWith('t1')
      expect(transitAPI.list).toHaveBeenCalledTimes(2) // inicial + recarga
    })
  })

  test('acción delete ejecuta y recarga', async () => {
    transitAPI.delete.mockResolvedValue({ data: { success: true } })

    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't1', mrn: null, lrn: 'LRN-DEL', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('LRN-DEL')).toBeInTheDocument())

    fireEvent.click(screen.getByText('LRN-DEL'))

    await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Eliminar'))

    await waitFor(() => {
      expect(transitAPI.delete).toHaveBeenCalledWith('t1')
      expect(transitAPI.list).toHaveBeenCalledTimes(2)
    })
  })

  test('error de carga muestra mensaje', async () => {
    transitAPI.list.mockRejectedValue({ response: { data: { error: 'API error' } } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument()
    })
  })

  test('error sin response.data muestra fallback', async () => {
    transitAPI.list.mockRejectedValue(new Error('Network down'))

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Error cargando transitos')).toBeInTheDocument()
    })
  })

  test('loading muestra spinner', async () => {
    transitAPI.list.mockImplementation(() => new Promise(() => {})) // nunca resuelve

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  test('paginación: botón Siguiente cambia página', async () => {
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't1', mrn: 'PAGE1', lrn: 'P1', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 40, page: 1, limit: 20, pages: 2 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Mostrando 1 de 40')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Siguiente'))

    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    })
  })

  test('paginación: botón Anterior cambia página', async () => {
    // Primera carga: página 1 con paginación activa
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't1', mrn: 'PAGE1', lrn: 'P1', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 40, page: 1, limit: 20, pages: 2 }
        }
      }
    })

    // Segunda carga: página 2
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't2', mrn: 'PAGE2', lrn: 'P2', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 40, page: 2, limit: 20, pages: 2 }
        }
      }
    })

    // Tercera carga: volver a página 1
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't1', mrn: 'PAGE1-AGAIN', lrn: 'P1A', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 40, page: 1, limit: 20, pages: 2 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    // Esperar carga inicial (página 1)
    await waitFor(() => expect(screen.getByText(/PAGE1/)).toBeInTheDocument())

    // Ir a página 2
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(screen.getByText(/PAGE2/)).toBeInTheDocument())

    // Volver a página 1
    fireEvent.click(screen.getByText('Anterior'))
    await waitFor(() => {
      expect(transitAPI.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
    })
  })

  test('botón crear tránsito abre modal', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))

    await waitFor(() => {
      expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument()
    })
  })

  test('modal crear: renderiza formulario', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))

    await waitFor(() => {
      expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument()
    })

    expect(screen.getByText('Crear Transito')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  test('modal crear: autocompletar IA', async () => {
    transitAPI.aiAutoComplete.mockResolvedValue({
      data: {
        success: true,
        data: {
          fieldsCompleted: ['reference', 'principal.eori', 'principal.name'],
          fieldsRequiringConfirmation: [],
          warnings: [],
          confidence: 85,
          suggestedData: { reference: 'AI-REF-001', principal: { eori: 'ESAI001', name: 'AI Cliente' } }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))

    await waitFor(() => expect(screen.getByText('Autocompletar con IA')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Autocompletar con IA'))

    await waitFor(() => {
      expect(transitAPI.aiAutoComplete).toHaveBeenCalled()
      expect(screen.getByText(/3 campos completados/)).toBeInTheDocument()
    })
  })

  test('modal crear: aplicar sugerencia IA cierra el panel', async () => {
    transitAPI.aiAutoComplete.mockResolvedValue({
      data: {
        success: true,
        data: {
          summary: 'OK',
          suggestions: [],
          warnings: [],
          suggestedData: { reference: 'SUGGESTED', principal: { eori: 'ESAI', name: 'IA NAME' } }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))

    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Autocompletar con IA'))

    await waitFor(() => expect(screen.getByText('Aplicar Sugerencias')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Aplicar Sugerencias'))

    await waitFor(() => {
      // La sugerencia se aplicó y cerró el panel de sugerencias
      expect(screen.queryByText('Aplicar Sugerencias')).not.toBeInTheDocument()
    })
  })

  test('modal crear: submit crea tránsito y cierra modal', async () => {
    transitAPI.create.mockResolvedValue({ data: { success: true } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))

    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())

    // Rellenar formulario de manera confiable
    const allInputs = screen.getAllByRole('textbox')
    const codigoInputs = screen.getAllByPlaceholderText(/Codigo/)

    // Rellenar todos los campos requeridos
    for (let i = 0; i < allInputs.length; i++) {
      fireEvent.change(allInputs[i], { target: { value: `VALUE-${i}` } })
    }

    for (let i = 0; i < codigoInputs.length; i++) {
      fireEvent.change(codigoInputs[i], { target: { value: `CODE-${i}` } })
    }

    const form = screen.getByText('Crear Transito').closest('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(transitAPI.create).toHaveBeenCalled()
      expect(transitAPI.list).toHaveBeenCalledTimes(2) // inicial + recarga tras crear
    })
  })

  test('modal crear: error muestra mensaje', async () => {
    transitAPI.create.mockRejectedValue({ response: { data: { error: 'Duplicate reference' } } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))

    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[1], { target: { value: 'DUP' } })
    fireEvent.change(inputs[2], { target: { value: 'ES001' } })
    fireEvent.change(inputs[3], { target: { value: 'N' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Codigo/)[0], { target: { value: 'ES01' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Codigo/)[1], { target: { value: 'FR01' } })

    const form = screen.getByText('Crear Transito').closest('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Duplicate reference')).toBeInTheDocument()
    })
  })

  test('botón IA en fila principal abre modal AI', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('26ES000012345678901234')).toBeInTheDocument())

    // Botón IA antes de expandir
    const aiButtons = screen.getAllByTitle('Analisis IA')
    fireEvent.click(aiButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument()
    })
  })

  test('modal AI: tab validar ruta ejecuta y muestra resultado', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({
      data: {
        success: true,
        data: {
          routeValidation: { isValid: true, issues: [] },
          routeAnalysis: { totalDistance: '1200 km', estimatedTransitDays: 1, borderCrossings: ['ES-FR'], restrictions: [] },
          transitOfficesSuggestion: [{ code: 'ES004801', name: 'Barcelona', reason: 'Aduana de partida' }],
          recommendations: ['Mantener precintos intactos'],
          riskLevel: 'LOW'
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    const aiButtons = screen.getAllByTitle('Analisis IA')
    fireEvent.click(aiButtons[0])

    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(transitAPI.aiValidateRoute).toHaveBeenCalledWith('transit-1')
    })

    await waitFor(() => {
      expect(screen.getByText(/Ruta Valida/i)).toBeInTheDocument()
    })
  })

  test('modal AI: tab predecir incidencias', async () => {
    transitAPI.aiPredictIncidents.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'MEDIUM',
          overallRiskScore: 30,
          incidentPredictions: [{
            type: 'Retraso',
            impact: 'MEDIUM',
            probability: 25,
            description: 'Posible retraso en frontera',
            stage: 'Cruce fronterizo',
            potentialDelay: '4 horas',
            preventiveMeasures: ['Salir con margen']
          }],
          recommendations: [{ priority: 'MEDIUM', action: 'Revisar precintos', reason: 'Evitar control' }]
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('26ES000012345678901234')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])

    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Predecir Incidencias'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(transitAPI.aiPredictIncidents).toHaveBeenCalled()
      expect(screen.getByText(/Riesgo Medio/i)).toBeInTheDocument()
      expect(screen.getByText('Posible retraso en frontera')).toBeInTheDocument()
    })
  })

  test('modal AI: tab sugerir garantía', async () => {
    transitAPI.aiSuggestGuarantee.mockResolvedValue({
      data: {
        success: true,
        data: {
          recommendedType: { name: 'Global' },
          guaranteeType: '1',
          amount: 5000,
          justification: 'Importe calculado según riesgo',
          calculation: { baseAmount: 4500, riskFactor: 1.2, oeaReduction: 10 },
          alternatives: [{ type: 'Individual', description: 'Fianza', amount: 6000 }],
          availableGuarantees: [{ grn: 'GRN999', type: 'Global', available: 50000, canUse: true, reference: 'REF-GRN' }]
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    const aiButtons = screen.getAllByTitle('Analisis IA')
    fireEvent.click(aiButtons[0])

    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Sugerir Garantia'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(transitAPI.aiSuggestGuarantee).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('Garantia Recomendada')).toBeInTheDocument()
      expect(screen.getAllByText(/Global/).length).toBeGreaterThan(0)
    })
  })

  test('modal AI: tab análisis completo', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          summary: {
            readinessScore: 85,
            readinessLevel: 'READY',
            factors: ['Transito bien preparado'],
            overallRiskLevel: 'LOW',
            estimatedTransitDays: 1,
            guaranteeRequired: 3000
          },
          routeValidation: { routeValidation: { isValid: true, issues: [] } },
          incidentPrediction: { riskLevel: 'LOW', overallRiskScore: 10, incidentPredictions: [] },
          guaranteeSuggestion: { calculatedAmount: { finalAmount: 3000 }, recommendedType: { code: '1', name: 'Garantia global' } },
          nextSteps: [{ priority: 1, action: 'Revisar docs', details: 'Prevencion', category: 'documentacion' }]
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    const aiButtons = screen.getAllByTitle('Analisis IA')
    fireEvent.click(aiButtons[0])

    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Analisis Completo'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(transitAPI.aiFullAnalysis).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText(/Transito bien preparado/i)).toBeInTheDocument()
      expect(screen.getByText('85/100')).toBeInTheDocument()
    })
  })

  test('modal AI: aplicar sugerencia desde garantía', async () => {
    transitAPI.aiSuggestGuarantee.mockResolvedValue({
      data: {
        success: true,
        data: {
          calculatedAmount: { finalAmount: 2000 },
          recommendedType: { code: '1', name: 'Garantia global', reason: 'Operador recurrente' }
        }
      }
    })

    transitAPI.aiApplySuggestion.mockResolvedValue({ data: { success: true } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('26ES000012345678901234')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])

    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Sugerir Garantia'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Aplicar al Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Aplicar al Transito'))

    await waitFor(() => {
      expect(transitAPI.aiApplySuggestion).toHaveBeenCalledWith('transit-1', {
        guarantee: { type: '1', amount: 2000, currency: 'EUR' }
      })
      expect(transitAPI.list).toHaveBeenCalledTimes(2) // reload tras aplicar
    })
  })

  test('modal AI: error muestra mensaje', async () => {
    transitAPI.aiValidateRoute.mockRejectedValue({ response: { data: { error: 'AI timeout' } } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('26ES000012345678901234')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])

    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('AI timeout')).toBeInTheDocument()
    })
  })

  test('días restantes: vencido muestra negativo', async () => {
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{
            _id: 't-past',
            mrn: 'PAST',
            lrn: 'PAST',
            status: 'in_transit',
            transitType: 'T1',
            principal: {},
            departureOffice: {},
            destinationOffice: {},
            transport: { seals: [] },
            totals: {},
            dates: {},
            deadlines: { arrivalDeadline: '2026-07-01T23:59:59Z' } // pasado
          }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/\d+d vencido/)).toBeInTheDocument()
    })
  })

  test('precintos rotos se marcan en rojo', async () => {
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{
            _id: 't-broken',
            mrn: 'BROKEN',
            lrn: 'BROKEN',
            status: 'arrived',
            transitType: 'T1',
            principal: {},
            departureOffice: {},
            destinationOffice: {},
            transport: { seals: [{ number: 'BROKEN-SEAL', sealType: 'customs', intactOnArrival: false, affixedBy: 'Aduana' }], sealCount: 1 },
            totals: {},
            dates: {},
            deadlines: {}
          }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('BROKEN')).toBeInTheDocument())

    fireEvent.click(screen.getByText('BROKEN'))

    await waitFor(() => {
      expect(screen.getByText('ROTO')).toBeInTheDocument()
    })
  })

  test('acción con error muestra mensaje', async () => {
    transitAPI.submit.mockRejectedValue({ response: { data: { error: 'Validation failed' } } })

    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{ _id: 't-err', mrn: null, lrn: 'ERR', status: 'draft', transitType: 'T1', principal: {}, departureOffice: {}, destinationOffice: {}, transport: { seals: [] }, totals: {}, dates: {}, deadlines: {} }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('ERR')).toBeInTheDocument())

    fireEvent.click(screen.getByText('ERR'))

    await waitFor(() => expect(screen.getByText('Enviar a NCTS')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Enviar a NCTS'))

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument()
    })
  })

  test('renderiza sin stats cuando getStats falla', async () => {
    transitAPI.getStats.mockRejectedValue(new Error('boom'))

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      // No rompe, sigue mostrando título
      expect(screen.getByText('transit.title')).toBeInTheDocument()
    })
  })

  test('modal AI: validación de ruta inválida muestra problemas', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({
      data: {
        success: true,
        data: {
          routeValidation: { isValid: false, issues: ['Falta checkpoint intermedio'] },
          recommendations: ['Añadir oficina de tránsito'],
          riskLevel: 'MEDIUM'
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])
    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(transitAPI.aiValidateRoute).toHaveBeenCalled()
    })

    // El componente renderiza el resultado con isValid: false
    await waitFor(() => expect(screen.getByText(/Falta checkpoint intermedio/)).toBeInTheDocument())
  })

  test('modal AI: nivel de riesgo alto muestra advertencia', async () => {
    transitAPI.aiPredictIncidents.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'HIGH',
          overallRiskScore: 80,
          incidentPredictions: [{ type: 'Control aduanero', impact: 'HIGH', probability: 75, description: 'Alta probabilidad de inspección' }]
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])
    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Predecir Incidencias'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText(/Riesgo Alto/i)).toBeInTheDocument()
      expect(screen.getByText('Alta probabilidad de inspección')).toBeInTheDocument()
    })
  })

  test('modal AI: análisis completo con score bajo', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          summary: {
            readinessScore: 55,
            readinessLevel: 'NEEDS_WORK',
            factors: ['Documentación incompleta', 'Garantía insuficiente'],
            overallRiskLevel: 'HIGH'
          }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])
    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(transitAPI.aiFullAnalysis).toHaveBeenCalled()
    })

    await waitFor(() => expect(screen.getByText(/Requiere trabajo/)).toBeInTheDocument())
    expect(screen.getByText('Documentación incompleta')).toBeInTheDocument()
  })

  test('modal AI: botón actualizar análisis', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({
      data: { success: true, data: { routeValidation: { isValid: true, issues: [] } } }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])
    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Ejecutar Analisis'))
    await waitFor(() => expect(transitAPI.aiValidateRoute).toHaveBeenCalledTimes(1))

    // Actualizar análisis
    fireEvent.click(screen.getByText('Actualizar Analisis'))
    await waitFor(() => expect(transitAPI.aiValidateRoute).toHaveBeenCalledTimes(2))
  })

  test('tránsito sin MRN muestra LRN', async () => {
    transitAPI.list.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          transits: [{
            _id: 't-no-mrn',
            mrn: null,
            lrn: 'LOCAL-REF-001',
            status: 'draft',
            transitType: 'T2',
            principal: {},
            departureOffice: {},
            destinationOffice: {},
            transport: { seals: [] },
            totals: {},
            dates: {},
            deadlines: {}
          }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/LOCAL-REF-001/)).toBeInTheDocument()
    })
  })

  test('modal crear: error de autocompletar IA muestra mensaje', async () => {
    transitAPI.aiAutoComplete.mockRejectedValue({ response: { data: { error: 'IA no disponible' } } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))
    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Autocompletar con IA'))

    await waitFor(() => {
      expect(screen.getByText('IA no disponible')).toBeInTheDocument()
    })
  })

  test('modal AI: cerrar panel de error ejercita setError(null)', async () => {
    transitAPI.aiValidateRoute.mockRejectedValue({ response: { data: { error: 'TimeoutUnique' } } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/26ES000012345678901234/)).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])
    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/TimeoutUnique/)).toBeInTheDocument())

    // Cerrar el mensaje de error ejercita la rama setError(null)
    const closeButtons = screen.getAllByText('Cerrar')
    fireEvent.click(closeButtons[closeButtons.length - 1]) // El último es del error dentro del modal

    await waitFor(() => {
      expect(screen.queryByText(/TimeoutUnique/)).not.toBeInTheDocument()
    })
  })

  test('modal crear: sugerencia IA con warnings ejercita render condicional', async () => {
    transitAPI.aiAutoComplete.mockResolvedValue({
      data: {
        success: true,
        data: {
          fieldsCompleted: ['principal.eori'],
          fieldsRequiringConfirmation: [],
          warnings: ['Falta información de mercancía', 'Verificar garantía'],
          confidence: 40,
          suggestedData: { reference: 'PARTIAL' }
        }
      }
    })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())

    fireEvent.click(screen.getByText('transit.newTransit'))
    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Autocompletar con IA'))

    await waitFor(() => {
      expect(transitAPI.aiAutoComplete).toHaveBeenCalled()
      expect(screen.getByText('Falta información de mercancía', { exact: false })).toBeInTheDocument()
    })
  })
})

/**
 * E2E 8/Ago: el formulario de "Nuevo Transito" no pedia las partidas de mercancia.
 * `formData.goodsItems` arrancaba con `description:''`, `taricCode:''` y
 * `grossWeight:0`, y no habia ningun campo para rellenarlos: el transito se creaba
 * (201) y al pulsar "Enviar a NCTS" AEAT devolvia 400 con el patron de
 * <ent:grossMass>, un mensaje que no nombra ningun campo. Los precintos, ademas,
 * se enviaban en la raiz (`seals`) en vez de en `transport.seals`.
 */
describe('<TransitManager /> formulario: partidas de mercancia', () => {
  // Este describe es de primer nivel: sin limpiar los mocks aqui, `create.mock.calls[0]`
  // es la llamada de un test anterior y las aserciones miran el payload equivocado.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const abrirFormulario = async () => {
    render(<MemoryRouter><TransitManager /></MemoryRouter>)
    await waitFor(() => expect(transitAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('transit.newTransit'))
    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())
  }

  /** Rellena los campos `required` para que el submit no lo bloquee el navegador. */
  const rellenarObligatorios = () => {
    const v = (ph, val) => fireEvent.change(screen.getByPlaceholderText(ph), { target: { value: val } })
    v(/Codigo \(ej: ES002801\)/, 'ES002801')
    v(/Codigo \(ej: ES002901\)/, 'ES002901')
    v(/descripcion de la mercancia/i, 'Tubos de acero')
    v(/TARIC/i, '73041100')
    v(/peso bruto/i, '300')
  }

  test('el formulario expone descripcion, TARIC y peso bruto de la partida', async () => {
    await abrirFormulario()
    expect(screen.getByPlaceholderText(/descripcion de la mercancia/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/TARIC/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/peso bruto/i)).toBeInTheDocument()
  })

  test('los datos de la partida llegan a transitAPI.create', async () => {
    transitAPI.create.mockResolvedValue({ data: { success: true, data: { _id: 'nuevo' } } })
    await abrirFormulario()

    rellenarObligatorios()
    fireEvent.submit(screen.getByText('Crear Transito').closest('form'))
    await waitFor(() => expect(transitAPI.create).toHaveBeenCalled())

    const enviado = transitAPI.create.mock.calls[0][0]
    expect(enviado.goodsItems[0]).toMatchObject({
      description: 'Tubos de acero',
      taricCode: '73041100',
      grossWeight: 300
    })
  })

  test('los precintos viajan dentro de transport, no en la raiz', async () => {
    transitAPI.create.mockResolvedValue({ data: { success: true, data: { _id: 'nuevo' } } })
    await abrirFormulario()

    fireEvent.change(screen.getByPlaceholderText(/Precinto 1/i), { target: { value: 'PRE-001' } })
    rellenarObligatorios()
    fireEvent.submit(screen.getByText('Crear Transito').closest('form'))
    await waitFor(() => expect(transitAPI.create).toHaveBeenCalled())

    const enviado = transitAPI.create.mock.calls[0][0]
    expect(enviado.transport.seals).toEqual([
      expect.objectContaining({ number: 'PRE-001' })
    ])
    expect(enviado.seals).toBeUndefined()
  })

  /**
   * E2E 8/Ago: AEAT exige un documento previo por partida en un T1 ("No vienen
   * Previous Document...") y el formulario no tenia ese campo, asi que un
   * transito creado solo desde la UI era imposible de enviar. Los placeholders
   * tampoco servian: ES004801 y FR001001 los rechaza AEAT PRE (la aduana de
   * destino tiene que tener rol DES y la de partida casar con la ubicacion).
   */
  test('el formulario pide el documento previo de la partida', async () => {
    await abrirFormulario()
    expect(screen.getByPlaceholderText(/Tipo doc\. previo/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Referencia doc\. previo/i)).toBeInTheDocument()
  })

  test('el documento previo llega a transitAPI.create dentro de la partida', async () => {
    transitAPI.create.mockResolvedValue({ data: { success: true, data: { _id: 'nuevo' } } })
    await abrirFormulario()

    rellenarObligatorios()
    fireEvent.change(screen.getByPlaceholderText(/Tipo doc\. previo/i), { target: { value: 'N337' } })
    fireEvent.change(screen.getByPlaceholderText(/Referencia doc\. previo/i), { target: { value: '25ES00280180003993' } })
    fireEvent.submit(screen.getByText('Crear Transito').closest('form'))
    await waitFor(() => expect(transitAPI.create).toHaveBeenCalled())

    expect(transitAPI.create.mock.calls[0][0].goodsItems[0].previousDocuments).toEqual([
      { type: 'N337', reference: '25ES00280180003993', goodsItemNumber: '1' }
    ])
  })

  test('sin documento previo la partida no manda previousDocuments vacio', async () => {
    transitAPI.create.mockResolvedValue({ data: { success: true, data: { _id: 'nuevo' } } })
    await abrirFormulario()

    rellenarObligatorios()
    fireEvent.submit(screen.getByText('Crear Transito').closest('form'))
    await waitFor(() => expect(transitAPI.create).toHaveBeenCalled())

    expect(transitAPI.create.mock.calls[0][0].goodsItems[0].previousDocuments).toBeUndefined()
  })

  test('los placeholders de aduana usan codigos que AEAT PRE acepta', async () => {
    await abrirFormulario()
    // ES002801 casa con la ubicacion 2801AAAAAC de PRE; ES002901 tiene rol DES.
    expect(screen.getByPlaceholderText(/Codigo \(ej: ES002801\)/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Codigo \(ej: ES002901\)/)).toBeInTheDocument()
  })

  /**
   * La tabla arancelaria del NCTS de PRE no es el catalogo TARIC: 73043100 (el
   * ejemplo que sugeria el formulario) lo rechaza y 73041100 lo acepta. Sugerir
   * un codigo que falla manda al usuario directo a un rechazo de AEAT.
   */
  test('el placeholder de TARIC sugiere un codigo que el NCTS de PRE acepta', async () => {
    await abrirFormulario()
    expect(screen.getByPlaceholderText(/Codigo TARIC \(ej: 73041100\)/)).toBeInTheDocument()
  })
})

/**
 * E2E 8/Ago (bug #5 de /transit): tras "Notificar Llegada" el ciclo se cortaba.
 * En destino falta la notificacion de descarga (CC044) y el estado `unloaded`
 * que produce no aparecia en `getNextActions`, asi que un transito descargado
 * quedaba sin ninguna accion disponible: ni liberar mercancias ni completar.
 */
describe('<TransitManager /> ciclo en destino: descarga (CC044) y estado unloaded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transitAPI.getStats.mockResolvedValue({ data: { success: true, data: {} } })
    transitAPI.getOverdue.mockResolvedValue({ data: { success: true, data: [] } })
  })

  const unTransito = (status) => ({
    data: {
      success: true,
      data: {
        transits: [{
          _id: 't1', mrn: 'MRN001', lrn: 'LRN001', status, transitType: 'T1',
          principal: {}, departureOffice: {}, destinationOffice: {},
          transport: { seals: [] }, totals: {}, dates: {}, deadlines: {}
        }],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 }
      }
    }
  })

  const expandirFila = async (status) => {
    transitAPI.list.mockResolvedValue(unTransito(status))
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('MRN001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('MRN001'))
  }

  test('un transito llegado ofrece notificar la descarga', async () => {
    await expandirFila('arrived')
    await waitFor(() => expect(screen.getByText('Notificar Descarga')).toBeInTheDocument())
  })

  test('unloaded muestra la etiqueta "Descargado" y permite liberar mercancias', async () => {
    await expandirFila('unloaded')
    // "Descargado" sale dos veces: el chip de la fila y la opcion del filtro de
    // estado, que se genera desde el mismo STATUS_CONFIG.
    await waitFor(() => expect(screen.getAllByText('Descargado').length).toBeGreaterThan(1))
    expect(screen.getByText('Liberar Mercancias')).toBeInTheDocument()
  })

  test('el filtro de estado ofrece "Descargado" (el estado existia sin ser filtrable)', async () => {
    await expandirFila('arrived')
    const selectEstado = screen.getAllByRole('combobox')[1]
    expect([...selectEstado.options].map(o => o.value)).toContain('unloaded')
  })

  test('Notificar Descarga llama a la API y recarga la lista', async () => {
    transitAPI.notifyUnloading.mockResolvedValue({ data: { success: true, data: { status: 'unloaded' } } })
    await expandirFila('arrived')
    await waitFor(() => expect(screen.getByText('Notificar Descarga')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Notificar Descarga'))

    await waitFor(() => expect(transitAPI.notifyUnloading).toHaveBeenCalledWith('t1', expect.anything()))
    // list se llama al montar y otra vez tras la accion.
    expect(transitAPI.list.mock.calls.length).toBeGreaterThan(1)
  })

  test('si la API rechaza la descarga se muestra el error y NO se recarga', async () => {
    transitAPI.notifyUnloading.mockRejectedValue({ response: { data: { error: 'Rechazo CC044' } } })
    await expandirFila('arrived')
    await waitFor(() => expect(screen.getByText('Notificar Descarga')).toBeInTheDocument())
    const llamadasAntes = transitAPI.list.mock.calls.length

    fireEvent.click(screen.getByText('Notificar Descarga'))

    await waitFor(() => expect(screen.getByText('Rechazo CC044')).toBeInTheDocument())
    expect(transitAPI.list.mock.calls.length).toBe(llamadasAntes)
  })
})

// ============================================================================
// Panel "Analisis IA": el contrato que pinta el frontend NO es el que devuelve
// el backend en ninguna de las 4 pestanas.
//
// Los tests que ya existian mas arriba mockeaban el contrato inventado
// (`{ isValid, riskLevel: 'medium', amount, overallScore }`), asi que pasaban
// en verde mientras la pantalla real no mostraba nada. Estos usan las
// respuestas REALES capturadas contra https://aduanas.strixai.es el 8/Ago/2026.
//
// El fallo no es cosmetico: `riskLevel` viene en MAYUSCULAS ('MEDIUM', 'HIGH')
// y el JSX compara con 'high'/'medium' en minusculas, asi que un transito de
// riesgo alto cae al `else` y se pinta "Riesgo Bajo" sobre fondo verde.
// ============================================================================
describe('<TransitManager /> panel IA: contrato real del backend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transitAPI.getStats.mockResolvedValue({ data: { success: true, data: {} } })
    transitAPI.getOverdue.mockResolvedValue({ data: { success: true, data: [] } })
    transitAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: {
          transits: [{
            _id: 't1', mrn: 'MRN001', lrn: 'LRN001', status: 'in_transit', transitType: 'T1',
            principal: {}, departureOffice: {}, destinationOffice: {},
            transport: { seals: [] }, totals: {}, dates: {}, deadlines: {}
          }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 }
        }
      }
    })
  })

  const abrirPanel = async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('MRN001')).toBeInTheDocument())
    fireEvent.click(screen.getAllByTitle('Analisis IA')[0])
    await waitFor(() => expect(screen.getByText('Analisis IA - Transito')).toBeInTheDocument())
  }

  // --- Validar Ruta: el backend anida en routeValidation.{isValid,issues} ---
  const RESPUESTA_VALIDATE_ROUTE = {
    routeValidation: {
      isValid: false,
      issues: [
        { type: 'warning', description: 'El pais de la aduana de destino esta vacio', affectedSegment: 'cabecera', recommendation: 'Completar el pais ES' },
        { type: 'info', description: 'Transito domestico ES->ES', affectedSegment: 'ES->ES', recommendation: 'Confirmar el motivo del T1' }
      ]
    },
    routeAnalysis: { totalDistance: '80-150 km', estimatedTransitDays: 1, borderCrossings: [], restrictions: [] },
    recommendations: ['Verificar el codigo de pais de ES002901'],
    riskLevel: 'MEDIUM',
    model: 'sonnet-5'
  }

  test('Validar Ruta: pinta el veredicto que viene anidado en routeValidation', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({ data: { success: true, data: RESPUESTA_VALIDATE_ROUTE } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(transitAPI.aiValidateRoute).toHaveBeenCalledWith('t1'))
    // isValid: false -> debe avisar, no dar la ruta por buena.
    await waitFor(() => expect(screen.getByText(/Ruta con Problemas/i)).toBeInTheDocument())
  })

  test('Validar Ruta: tolera que issues venga como lista de cadenas', async () => {
    // El esquema del prompt pide objetos {type, description, ...}, pero el modelo
    // devuelve cadenas sueltas con cierta frecuencia. Con el JSX leyendo
    // `inc.description` a pelo, esas incidencias desaparecian sin aviso: ruta
    // marcada "con problemas" y ni un problema listado.
    transitAPI.aiValidateRoute.mockResolvedValue({
      data: {
        success: true,
        data: { routeValidation: { isValid: false, issues: ['Falta la aduana de transito intermedia'] } }
      }
    })
    await abrirPanel()
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/Falta la aduana de transito intermedia/)).toBeInTheDocument())
  })

  test('Validar Ruta: muestra las incidencias de routeValidation.issues', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({ data: { success: true, data: RESPUESTA_VALIDATE_ROUTE } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/El pais de la aduana de destino esta vacio/)).toBeInTheDocument())
    expect(screen.getByText(/Completar el pais ES/)).toBeInTheDocument()
  })

  test('Validar Ruta: los dias de transito estimados salen de estimatedTransitDays', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({ data: { success: true, data: RESPUESTA_VALIDATE_ROUTE } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/80-150 km/)).toBeInTheDocument())
  })

  // --- Predecir Incidencias: MAYUSCULAS y otros nombres de campo ---
  const RESPUESTA_INCIDENTS = {
    overallRiskScore: 68,
    riskLevel: 'HIGH',
    incidentPredictions: [
      { type: 'control', probability: 45, description: 'Probable control fisico en destino', stage: 'arrival', impact: 'HIGH', potentialDelay: '24-48 horas', preventiveMeasures: ['Documentacion completa'] }
    ],
    controlProbability: { departure: 20, transit: 10, arrival: 45, factors: [] },
    recommendations: [{ priority: 'HIGH', action: 'Revisar precintos', reason: 'Riesgo de manipulacion' }],
    model: 'sonnet-5'
  }

  test('Predecir Incidencias: un riesgo HIGH no puede pintarse como Riesgo Bajo', async () => {
    transitAPI.aiPredictIncidents.mockResolvedValue({ data: { success: true, data: RESPUESTA_INCIDENTS } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Predecir Incidencias'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(transitAPI.aiPredictIncidents).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/Riesgo Alto/i)).toBeInTheDocument())
    expect(screen.queryByText(/Riesgo Bajo/i)).not.toBeInTheDocument()
  })

  test('Predecir Incidencias: lista incidentPredictions con su probabilidad en %', async () => {
    transitAPI.aiPredictIncidents.mockResolvedValue({ data: { success: true, data: RESPUESTA_INCIDENTS } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Predecir Incidencias'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/Probable control fisico en destino/)).toBeInTheDocument())
    // probability llega 0-100, no 0-1: un 45 no puede mostrarse como 4500%.
    expect(screen.getByText(/45% probabilidad/)).toBeInTheDocument()
  })

  test('Predecir Incidencias: muestra el score global de riesgo', async () => {
    transitAPI.aiPredictIncidents.mockResolvedValue({ data: { success: true, data: RESPUESTA_INCIDENTS } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Predecir Incidencias'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/68/)).toBeInTheDocument())
  })

  // --- Sugerir Garantia: calculatedAmount.finalAmount, no `amount` ---
  const RESPUESTA_GUARANTEE = {
    calculatedAmount: {
      baseAmount: 811,
      reductionPercentage: 0,
      reductionReason: 'El operador no dispone de estatus OEA',
      finalAmount: 811,
      breakdown: { duties: 0, vat: 212.9, excise: 0, other: 202.75 }
    },
    recommendedType: { code: '2', name: 'Garantia individual por fianza', reason: 'Operacion puntual sin OEA' },
    alternatives: [{ code: '3', name: 'Garantia individual en efectivo', suitability: 60, estimatedCost: 20, processingTime: '1 dia', notes: 'Inmoviliza caja' }],
    globalGuaranteeAnalysis: { canUseExisting: false, availableAmount: 0, wouldBeConsumed: 811, remainingAfter: 0, recommendation: 'Constituir garantia individual' },
    recommendations: ['Constituir la garantia antes de enviar el IE015'],
    model: 'sonnet-5'
  }

  test('Sugerir Garantia: el importe sale de calculatedAmount.finalAmount, no de amount', async () => {
    transitAPI.aiSuggestGuarantee.mockResolvedValue({ data: { success: true, data: RESPUESTA_GUARANTEE } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Sugerir Garantia'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(transitAPI.aiSuggestGuarantee).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Garantia Recomendada')).toBeInTheDocument())
    // El importe exigible es 811 EUR. Antes se leia `data.amount` (inexistente)
    // y se pintaba "0 EUR" para una garantia obligatoria. Nota: el desglose si
    // muestra 0 EUR en derechos e impuestos especiales, que valen 0 de verdad.
    expect(screen.getAllByText('811 EUR').length).toBeGreaterThan(0)
    expect(screen.getByText(/Garantia individual por fianza/)).toBeInTheDocument()
  })

  test('Sugerir Garantia: desglosa el calculo desde calculatedAmount', async () => {
    transitAPI.aiSuggestGuarantee.mockResolvedValue({ data: { success: true, data: RESPUESTA_GUARANTEE } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Sugerir Garantia'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/Detalle del Calculo/i)).toBeInTheDocument())
    expect(screen.getByText(/El operador no dispone de estatus OEA/)).toBeInTheDocument()
  })

  test('Sugerir Garantia: aplicar la sugerencia manda el payload que el backend acepta', async () => {
    // El boton anterior colgaba de `availableGuarantees`, un campo que el backend
    // no devuelve nunca, asi que jamas se pintaba. Y mandaba `{guaranteeGRN}`, que
    // `aiApplySuggestion` descarta en silencio: solo aplica las claves del modelo
    // (guarantee, transitType, principal...). Ahora se manda `guarantee`.
    transitAPI.aiSuggestGuarantee.mockResolvedValue({ data: { success: true, data: RESPUESTA_GUARANTEE } })
    transitAPI.aiApplySuggestion.mockResolvedValue({ data: { success: true } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Sugerir Garantia'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Aplicar al Transito')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Aplicar al Transito'))

    await waitFor(() => expect(transitAPI.aiApplySuggestion).toHaveBeenCalledWith('t1', {
      guarantee: { type: '2', amount: 811, currency: 'EUR' }
    }))
  })

  test('Sugerir Garantia: sin codigo de tipo no se ofrece aplicar', async () => {
    // Sin `recommendedType.code` no hay valor valido para el enum del modelo:
    // aplicarlo daria un ValidationError de Mongoose.
    const sinCodigo = { ...RESPUESTA_GUARANTEE, recommendedType: { name: 'Algo', reason: '' } }
    transitAPI.aiSuggestGuarantee.mockResolvedValue({ data: { success: true, data: sinCodigo } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Sugerir Garantia'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Garantia Recomendada')).toBeInTheDocument())
    expect(screen.queryByText('Aplicar al Transito')).not.toBeInTheDocument()
  })

  test('Sugerir Garantia: las alternativas llevan nombre e importe estimado', async () => {
    transitAPI.aiSuggestGuarantee.mockResolvedValue({ data: { success: true, data: RESPUESTA_GUARANTEE } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Sugerir Garantia'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/Garantia individual en efectivo/)).toBeInTheDocument())
  })

  // --- Analisis Completo: summary es un OBJETO, no un texto ---
  const RESPUESTA_FULL = {
    routeValidation: RESPUESTA_VALIDATE_ROUTE,
    incidentPrediction: RESPUESTA_INCIDENTS,
    guaranteeSuggestion: RESPUESTA_GUARANTEE,
    summary: {
      readinessScore: 55,
      readinessLevel: 'NEEDS_WORK',
      factors: ['Principal obligado completo', 'Mercancias documentadas'],
      overallRiskLevel: 'HIGH',
      estimatedTransitDays: 1,
      guaranteeRequired: 811
    },
    nextSteps: [
      { priority: 1, action: 'Configurar garantia de transito', details: 'Se recomienda Garantia individual por fianza por 811 EUR', category: 'guarantee' }
    ],
    analyzedAt: '2026-08-08T16:13:20.488Z'
  }

  test('Analisis Completo: la puntuacion sale de summary.readinessScore', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({ data: { success: true, data: RESPUESTA_FULL } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(transitAPI.aiFullAnalysis).toHaveBeenCalled())
    // 0/100 sobre un transito con 55 puntos es un dato falso.
    await waitFor(() => expect(screen.getByText('55/100')).toBeInTheDocument())
  })

  test('Analisis Completo: summary es un objeto y no se puede renderizar como texto', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({ data: { success: true, data: RESPUESTA_FULL } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    // Los factores del resumen se listan; el objeto crudo nunca llega al DOM.
    await waitFor(() => expect(screen.getByText(/Principal obligado completo/)).toBeInTheDocument())
    expect(screen.getByText(/NEEDS_WORK|Requiere trabajo/i)).toBeInTheDocument()
  })

  test('Analisis Completo: los proximos pasos vienen de nextSteps', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({ data: { success: true, data: RESPUESTA_FULL } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/Configurar garantia de transito/)).toBeInTheDocument())
  })

  test('Analisis Completo: el riesgo global HIGH se muestra como Alto', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({ data: { success: true, data: RESPUESTA_FULL } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getAllByText(/Riesgo.*Alto/i).length).toBeGreaterThan(0))
  })

  test('Analisis Completo: la garantia requerida sale de calculatedAmount.finalAmount', async () => {
    transitAPI.aiFullAnalysis.mockResolvedValue({ data: { success: true, data: RESPUESTA_FULL } })
    await abrirPanel()
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Garantia Recomendada')).toBeInTheDocument())
    expect(screen.getAllByText(/811/).length).toBeGreaterThan(0)
  })
})

describe('<TransitManager /> filtros y paginacion', () => {
  const transitoEn = (id) => ({
    _id: id, mrn: `MRN-${id}`, lrn: `LRN-${id}`, status: 'draft', transitType: 'T1',
    principal: {}, departureOffice: {}, destinationOffice: {},
    transport: { seals: [] }, totals: {}, dates: {}, deadlines: {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
    transitAPI.getStats.mockResolvedValue({ data: { success: true, data: {} } })
    transitAPI.getOverdue.mockResolvedValue({ data: { success: true, data: [] } })
    // 35 transitos con limit 1 -> 35 paginas, para poder pasar de pagina.
    transitAPI.list.mockImplementation((params = {}) => Promise.resolve({
      data: {
        success: true,
        data: {
          transits: [transitoEn(`p${params.page || 1}`)],
          pagination: { total: 35, page: params.page || 1, limit: 1, pages: 35 }
        }
      }
    }))
  })

  test('cambiar de filtro vuelve a la pagina 1', async () => {
    // Filtrar desde la pagina 2 mantenia `page: 2`. Verificado contra la API
    // real: `status=draft&limit=1&page=99` devuelve 200 con lista vacia y
    // `pages: 31`, asi que la pantalla se quedaba en blanco. Y como el
    // paginador solo se pinta con `pages > 1`, si el filtro cabia en una
    // pagina el usuario no tenia ni boton para volver: pantalla vacia sin
    // salida, pareciendo que no hay transitos de ese tipo.
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('MRN-p1')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(screen.getByText('MRN-p2')).toBeInTheDocument())

    transitAPI.list.mockClear()
    fireEvent.change(screen.getByPlaceholderText('Buscar MRN, LRN, referencia...'), {
      target: { value: 'T1' }
    })

    await waitFor(() => expect(transitAPI.list).toHaveBeenCalled())
    const ultima = transitAPI.list.mock.calls.at(-1)[0]
    expect(ultima.page).toBe(1)
    expect(ultima.search).toBe('T1')
  })

  test('cambiar el tipo de transito tambien resetea la pagina', async () => {
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('MRN-p1')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(screen.getByText('MRN-p2')).toBeInTheDocument())

    transitAPI.list.mockClear()
    fireEvent.change(screen.getByDisplayValue('transit.allTypes'), { target: { value: 'T2' } })

    await waitFor(() => expect(transitAPI.list).toHaveBeenCalled())
    const ultima = transitAPI.list.mock.calls.at(-1)[0]
    expect(ultima.page).toBe(1)
    expect(ultima.transitType).toBe('T2')
  })

  test('pasar de pagina no resetea a 1', async () => {
    // El reset no debe dispararse al paginar, solo al cambiar filtros.
    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('MRN-p1')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(screen.getByText('MRN-p2')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(screen.getByText('MRN-p3')).toBeInTheDocument())
  })
})

/**
 * E2E 8/Ago: "Autocompletar con IA" del formulario de creacion leia otro contrato.
 *
 * Respuesta real de POST /api/transit/ai/auto-complete (verificada contra
 * https://aduanas.strixai.es, HTTP 200):
 *   suggestedData, fieldsCompleted, fieldsRequiringConfirmation,
 *   warnings, confidence, model, tokensUsed, generatedAt
 *
 * El JSX leia `summary` y `suggestions`, que NO existen: la mitad del panel
 * quedaba permanentemente en blanco y lo unico visible eran los avisos. Y lo
 * mas grave: `fieldsRequiringConfirmation` (los campos que la IA rellena "a
 * ojo" y avisa que hay que revisar) no se pintaba en ningun sitio, asi que
 * "Aplicar Sugerencias" metia esos valores en el formulario sin que el usuario
 * supiera que estaban sin confirmar.
 *
 * Ademas `applySuggestion` hacia un spread plano de `suggestedData`, y el
 * backend devuelve `null` en los campos que no puede inferir: sobrescribia
 * `principal.eori` con null y React lanza el aviso de input controlado ->
 * no controlado, dejando el campo requerido en blanco sin poder escribir.
 */
describe('<TransitManager /> autocompletar IA: contrato real del backend', () => {
  // Forma exacta que devuelve el backend con datos parciales.
  const RESPUESTA_REAL = {
    suggestedData: {
      transitType: 'T1',
      transitTypeReason: 'Mercancia no UE en libre circulacion',
      principal: { eori: null, name: null, address: {} },
      departureOffice: { code: 'ES002901', name: 'Madrid', country: 'ES' },
      destinationOffice: { code: null, name: null, country: null },
      route: { countries: [], itinerary: null, bindingItinerary: false },
      guarantee: { type: null, typeDescription: null, estimatedAmount: null, grn: null, reason: 'Sin valor en aduana' },
      goodsItems: [],
      estimatedDeadline: null,
      estimatedTransitDays: 0
    },
    fieldsCompleted: ['departureOffice'],
    fieldsRequiringConfirmation: [
      { field: 'transitType', suggestedValue: 'T1', reason: 'Sin expediente de origen no se puede verificar el estatuto aduanero' },
      { field: 'principal.eori', suggestedValue: null, reason: 'No hay historial que identifique al obligado principal' }
    ],
    warnings: ['No se ha proporcionado ningun dato del expediente origen'],
    confidence: 5,
    model: 'sonnet-5',
    tokensUsed: 4210,
    generatedAt: '2026-08-08T10:00:00.000Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    transitAPI.getStats.mockResolvedValue({ data: { success: true, data: {} } })
    transitAPI.getOverdue.mockResolvedValue({ data: { success: true, data: [] } })
    transitAPI.list.mockResolvedValue({
      data: { success: true, data: { transits: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } } }
    })
  })

  const abrirFormularioYAutocompletar = async (respuesta = RESPUESTA_REAL) => {
    transitAPI.aiAutoComplete.mockResolvedValue({ data: { success: true, data: respuesta } })

    render(
      <MemoryRouter>
        <TransitManager />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('transit.newTransit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('transit.newTransit'))
    await waitFor(() => expect(screen.getByText('Nuevo Transito NCTS')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Autocompletar con IA'))
    await waitFor(() => expect(screen.getByText('Sugerencia de LUCI')).toBeInTheDocument())
  }

  test('pinta los campos completados que devuelve el backend', async () => {
    await abrirFormularioYAutocompletar()

    expect(await screen.findByText(/1 campo completado/i)).toBeInTheDocument()
    expect(screen.getByText(/departureOffice/)).toBeInTheDocument()
  })

  test('pinta los campos que requieren confirmacion con su motivo', async () => {
    // Es la informacion mas importante del panel y no se mostraba en absoluto:
    // el usuario aplicaba valores inventados creyendolos verificados.
    await abrirFormularioYAutocompletar()

    expect(await screen.findByText(/transitType/)).toBeInTheDocument()
    expect(screen.getByText(/no se puede verificar el estatuto aduanero/i)).toBeInTheDocument()
    expect(screen.getByText(/principal\.eori/)).toBeInTheDocument()
  })

  test('muestra la confianza para que una sugerencia del 5% no parezca fiable', async () => {
    await abrirFormularioYAutocompletar()

    expect(await screen.findByText(/Confianza: 5%/i)).toBeInTheDocument()
  })

  test('sigue mostrando los avisos', async () => {
    await abrirFormularioYAutocompletar()

    expect(await screen.findByText(/No se ha proporcionado ningun dato del expediente origen/)).toBeInTheDocument()
  })

  test('aplicar la sugerencia no deja los campos requeridos en null', async () => {
    // `principal.eori` llega null: el spread plano lo metia tal cual en
    // formData y el input controlado se quedaba sin value.
    await abrirFormularioYAutocompletar()

    fireEvent.click(screen.getByText('Aplicar Sugerencias'))

    await waitFor(() => expect(screen.queryByText('Sugerencia de LUCI')).not.toBeInTheDocument())

    // La aduana que SI vino se aplica; el EORI que vino null se queda vacio,
    // no null, para que el input siga siendo controlado y escribible.
    expect(screen.getByDisplayValue('ES002901')).toBeInTheDocument()

    const eori = screen.getByLabelText('EORI *')
    expect(eori.value).toBe('')
    fireEvent.change(eori, { target: { value: 'ESB22477020' } })
    expect(eori.value).toBe('ESB22477020')
  })

  test('aplicar la sugerencia no vacia las partidas de mercancia ya escritas', async () => {
    // `goodsItems: []` es lo que devuelve el backend cuando no puede inferir
    // partidas. Aplicarlo borraba las que el usuario habia escrito a mano y,
    // sin partidas, AEAT rechaza el IE015 con el patron de <ent:grossMass>.
    await abrirFormularioYAutocompletar()

    fireEvent.click(screen.getByText('Aplicar Sugerencias'))
    await waitFor(() => expect(screen.queryByText('Sugerencia de LUCI')).not.toBeInTheDocument())

    expect(screen.getByPlaceholderText('Partida 1 - Descripcion de la mercancia')).toBeInTheDocument()
  })

  test('las etiquetas del formulario apuntan a su campo', async () => {
    // Las 5 <label> del formulario no tenian `htmlFor`: pulsar la etiqueta no
    // enfocaba el campo y un lector de pantalla anunciaba inputs sin nombre.
    await abrirFormularioYAutocompletar()

    for (const etiqueta of ['Referencia *', 'Tipo de Transito *', 'EORI *', 'Nombre *']) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument()
    }
  })

  test('no rompe cuando el backend no devuelve ni campos ni confianza', async () => {
    // Rama de error del backend: suggestedData {}, listas vacias, confidence 0.
    await abrirFormularioYAutocompletar({
      suggestedData: {},
      fieldsCompleted: [],
      fieldsRequiringConfirmation: [],
      warnings: ['Error en auto-completado IA'],
      confidence: 0
    })

    expect(await screen.findByText(/Error en auto-completado IA/)).toBeInTheDocument()
    expect(screen.queryByText(/campo completado/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Confianza: 0%/i)).toBeInTheDocument()
  })
})
