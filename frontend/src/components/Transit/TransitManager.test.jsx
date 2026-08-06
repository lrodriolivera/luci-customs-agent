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
          summary: 'Datos completados por LUCI',
          suggestions: ['Ruta validada'],
          warnings: [],
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
      expect(screen.getByText('Datos completados por LUCI')).toBeInTheDocument()
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
          isValid: true,
          summary: 'Ruta válida',
          routeAnalysis: { estimatedDuration: '24 horas', distance: 1200, transitCountries: ['ES', 'FR'] },
          checkpoints: [{ office: 'ES004801', country: 'ES', type: 'partida', required: true }],
          warnings: [],
          recommendations: ['Mantener precintos intactos']
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
          riskLevel: 'medium',
          probability: 0.3,
          predictedIncidents: [{ type: 'Retraso', severity: 'medium', probability: 0.25, description: 'Posible retraso en frontera', mitigation: 'Salir con margen' }],
          historicalData: { totalTransits: 150, incidentRate: 12, avgDelay: 4 },
          preventiveMeasures: ['Revisar precintos']
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
          overallScore: 85,
          summary: 'Tránsito bien preparado',
          sections: { route: { score: 90, label: 'Ruta' }, compliance: { score: 80, label: 'Cumplimiento' } },
          routeValidation: { isValid: true, summary: 'OK' },
          incidentPrediction: { riskLevel: 'low', mainRisks: ['Ninguno relevante'] },
          guaranteeSuggestion: { type: 'Global', amount: 3000, grn: 'GRN123' },
          criticalIssues: [],
          actionItems: [{ action: 'Revisar docs', priority: 'low', reason: 'Prevención' }]
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
      expect(screen.getByText(/Tránsito bien preparado/i)).toBeInTheDocument()
    })
  })

  test('modal AI: aplicar sugerencia desde garantía', async () => {
    transitAPI.aiSuggestGuarantee.mockResolvedValue({
      data: {
        success: true,
        data: {
          amount: 2000,
          availableGuarantees: [{ grn: 'GRN-APPLY', type: 'Global', available: 10000, canUse: true }]
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

    await waitFor(() => expect(screen.getByText('GRN-APPLY')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Usar'))

    await waitFor(() => {
      expect(transitAPI.aiApplySuggestion).toHaveBeenCalledWith('transit-1', { guaranteeGRN: 'GRN-APPLY' })
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
          isValid: false,
          summary: 'Ruta con problemas',
          warnings: ['Falta checkpoint intermedio'],
          recommendations: ['Añadir oficina de tránsito']
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
          riskLevel: 'high',
          probability: 0.8,
          predictedIncidents: [{ type: 'Control aduanero', severity: 'high', probability: 0.75, description: 'Alta probabilidad de inspección' }]
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
          overallScore: 55,
          summary: 'Requiere mejoras',
          sections: { route: { score: 60, label: 'Ruta' } },
          criticalIssues: ['Documentación incompleta', 'Garantía insuficiente']
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

    await waitFor(() => expect(screen.getByText(/Requiere mejoras/)).toBeInTheDocument())
  })

  test('modal AI: botón actualizar análisis', async () => {
    transitAPI.aiValidateRoute.mockResolvedValue({
      data: { success: true, data: { isValid: true, summary: 'OK' } }
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
          summary: 'Datos parciales',
          suggestions: ['Se completó el EORI'],
          warnings: ['Falta información de mercancía', 'Verificar garantía'],
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
      expect(screen.getByText('Datos parciales')).toBeInTheDocument()
    })
  })
})
