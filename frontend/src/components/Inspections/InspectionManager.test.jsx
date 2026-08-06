import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InspectionManager from './InspectionManager'
import { inspectionsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  inspectionsAPI: {
    getDashboard: vi.fn(),
    getTypes: vi.fn(),
    list: vi.fn(),
    getCalendar: vi.fn(),
    getChecklist: vi.fn(),
    start: vi.fn(),
    create: vi.fn()
  }
}))

const Wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>

const mockDashboard = {
  data: {
    data: {
      summary: {
        scheduledToday: 5,
        totalPending: 12,
        inProgress: 3,
        completedThisWeek: 20
      },
      today: [],
      pending: [],
      stats: { byType: {}, byResult: {} }
    }
  }
}

const mockTypes = {
  data: {
    data: [
      { value: 'physical', label: 'Fisica', authority: 'AEAT', estimatedDuration: 120 },
      { value: 'documentary', label: 'Documental', authority: 'AEAT', estimatedDuration: 60 },
      { value: 'scanner', label: 'Scanner', authority: 'AEAT', estimatedDuration: 90 }
    ]
  }
}

describe('<InspectionManager />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inspectionsAPI.getDashboard.mockResolvedValue(mockDashboard)
    inspectionsAPI.getTypes.mockResolvedValue(mockTypes)
  })

  test('renderiza el título y carga datos iniciales', async () => {
    render(<InspectionManager />, { wrapper: Wrapper })
    expect(screen.getByText('inspections.title')).toBeInTheDocument()
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    await waitFor(() => expect(inspectionsAPI.getTypes).toHaveBeenCalled())
  })

  test('renderiza las 4 tarjetas de resumen con datos', async () => {
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  test('maneja error de dashboard sin romper', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    inspectionsAPI.getDashboard.mockRejectedValueOnce(new Error('boom'))
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    expect(screen.getByText('inspections.title')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  test('maneja error de getTypes sin romper', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    inspectionsAPI.getTypes.mockRejectedValueOnce(new Error('boom'))
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getTypes).toHaveBeenCalled())
    expect(screen.getByText('inspections.title')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  test('renderiza inspecciones de hoy cuando hay datos', async () => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status: 'confirmed',
            location: { name: 'Puerto BCN', city: 'Barcelona' },
            scheduling: { scheduledDate: '2026-08-06', scheduledTime: '09:00' }
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('Inspecciones de Hoy')).toBeInTheDocument())
    expect(screen.getByText('INS-001')).toBeInTheDocument()
  })

  test('renderiza inspecciones pendientes cuando hay datos', async () => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 0, totalPending: 1, inProgress: 0, completedThisWeek: 0 },
          today: [],
          pending: [{
            _id: 'i2',
            inspectionNumber: 'INS-002',
            inspectionType: 'documentary',
            status: 'scheduled',
            location: { name: 'Aduana' },
            scheduling: { scheduledDate: '2026-08-07' }
          }],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('Proximas Inspecciones')).toBeInTheDocument())
    expect(screen.getByText('INS-002')).toBeInTheDocument()
  })

  test('renderiza stats byType y byResult cuando existen', async () => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 0, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [],
          pending: [],
          stats: {
            byType: { physical: 15, documentary: 8 },
            byResult: { approved: 10, rejected: 2 }
          }
        }
      }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('Por Tipo de Inspeccion')).toBeInTheDocument())
    expect(screen.getByText('Fisica')).toBeInTheDocument()
    expect(screen.getByText('Resultados')).toBeInTheDocument()
    expect(screen.getByText('Aprobada')).toBeInTheDocument()
  })

  test.each([
    ['requested', 'Solicitada'],
    ['scheduled', 'Programada'],
    ['confirmed', 'Confirmada'],
    ['suspended', 'Suspendida'],
    ['completed', 'Completada'],
    ['cancelled', 'Cancelada'],
    ['pending_results', 'Pte. Resultados']
  ])('renderiza status=%s con badge correcto', async (status, label) => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status,
            location: { name: 'Test' },
            scheduling: {}
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument())
  })

  test('cambia a tab lista y carga inspecciones', async () => {
    inspectionsAPI.list.mockResolvedValue({ data: { data: { inspections: [] } } })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Lista/i }))
    await waitFor(() => expect(inspectionsAPI.list).toHaveBeenCalled())
  })

  test('cambia a tab calendario y carga datos', async () => {
    inspectionsAPI.getCalendar.mockResolvedValue({ data: { data: { inspections: [] } } })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Calendario/i }))
    await waitFor(() => expect(inspectionsAPI.getCalendar).toHaveBeenCalled())
  })

  test('aplica y limpia filtros en vista lista', async () => {
    inspectionsAPI.list.mockResolvedValue({ data: { data: { inspections: [] } } })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Lista/i }))
    await waitFor(() => expect(inspectionsAPI.list).toHaveBeenCalled())

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'confirmed' } })
    await waitFor(() => expect(inspectionsAPI.list).toHaveBeenCalledWith({ status: 'confirmed' }))

    fireEvent.click(screen.getByText(/Limpiar filtros/i))
    await waitFor(() => expect(inspectionsAPI.list).toHaveBeenCalledWith({}))
  })

  test('muestra mensaje cuando no hay inspecciones', async () => {
    inspectionsAPI.list.mockResolvedValue({ data: { data: { inspections: [] } } })
    render(<InspectionManager />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /Lista/i }))
    await waitFor(() => expect(screen.getByText('No hay inspecciones que mostrar')).toBeInTheDocument())
  })

  test('renderiza tabla con inspecciones', async () => {
    inspectionsAPI.list.mockResolvedValue({
      data: {
        data: {
          inspections: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            mrn: '26ES123456789012345',
            inspectionType: 'physical',
            status: 'confirmed',
            location: { name: 'Puerto', city: 'BCN' },
            scheduling: { scheduledDate: '2026-08-10', scheduledTime: '09:00' },
            result: 'approved'
          }]
        }
      }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /Lista/i }))
    await waitFor(() => expect(screen.getByText('26ES123456789012345')).toBeInTheDocument())
    expect(screen.getByText('Aprobada')).toBeInTheDocument()
  })

  test('abre y cierra modal de detalle', async () => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status: 'confirmed',
            location: { name: 'Puerto' },
            scheduling: {}
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    inspectionsAPI.getChecklist.mockResolvedValue({
      data: { data: { requirements: ['Check1'], generalItems: ['Gen1'] } }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('INS-001')).toBeInTheDocument())

    // Encontrar botón de ver (sin texto, solo icono DocumentTextIcon)
    const allButtons = document.querySelectorAll('button')
    const viewButton = Array.from(allButtons).find(btn => {
      const svg = btn.querySelector('svg')
      return svg && btn.textContent.trim() === '' && !btn.closest('.btn-primary')
    })
    fireEvent.click(viewButton)
    await waitFor(() => expect(screen.getByText('Check1')).toBeInTheDocument())

    const closeButtons = screen.getAllByRole('button', { name: /Cerrar/i })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByText('Check1')).not.toBeInTheDocument())
  })

  test('maneja error de getChecklist', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status: 'confirmed',
            location: { name: 'Puerto' },
            scheduling: {}
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    inspectionsAPI.getChecklist.mockRejectedValueOnce(new Error('boom'))
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('INS-001')).toBeInTheDocument())

    const allButtons = document.querySelectorAll('button')
    const viewButton = Array.from(allButtons).find(btn => {
      const svg = btn.querySelector('svg')
      return svg && btn.textContent.trim() === '' && !btn.closest('.btn-primary')
    })
    fireEvent.click(viewButton)
    await waitFor(() => expect(inspectionsAPI.getChecklist).toHaveBeenCalled())
    consoleError.mockRestore()
  })

  test('inicia inspección y muestra toast success', async () => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status: 'confirmed',
            location: { name: 'Puerto' },
            scheduling: {}
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    inspectionsAPI.start.mockResolvedValue({})
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('INS-001')).toBeInTheDocument())
    const startButton = screen.getByRole('button', { name: /Iniciar/i })
    fireEvent.click(startButton)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Inspeccion iniciada'))
  })

  test('maneja error al iniciar inspección', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status: 'confirmed',
            location: { name: 'Puerto' },
            scheduling: {}
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    inspectionsAPI.start.mockRejectedValueOnce(new Error('boom'))
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('INS-001')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Iniciar/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al iniciar la inspeccion'))
    consoleError.mockRestore()
  })

  test('abre modal de creación', async () => {
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    const buttons = screen.getAllByRole('button', { name: /Nueva Inspeccion/i })
    fireEvent.click(buttons[0]) // El del header
    await waitFor(() => expect(screen.getByText('Programar una nueva inspeccion fisica o documental')).toBeInTheDocument())
  })

  test('cierra modal de creación', async () => {
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    const buttons = screen.getAllByRole('button', { name: /Nueva Inspeccion/i })
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getByText('Programar una nueva inspeccion fisica o documental')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }))
    await waitFor(() => expect(screen.queryByText('Programar una nueva inspeccion fisica o documental')).not.toBeInTheDocument())
  })

  test('crea inspección con ubicación predefinida', async () => {
    inspectionsAPI.create.mockResolvedValue({})
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    const buttons = screen.getAllByRole('button', { name: /Nueva Inspeccion/i })
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getByText('Programar una nueva inspeccion fisica o documental')).toBeInTheDocument())

    const locationSelect = screen.getAllByRole('combobox').find(s => s.value === '')
    fireEvent.change(locationSelect, { target: { value: 'ESBCN' } })

    const createButtons = screen.getAllByRole('button', { name: /Crear Inspeccion/i })
    fireEvent.click(createButtons[0])
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Inspeccion creada correctamente'))
  })

  test('usa ubicación personalizada al desmarcar checkbox', async () => {
    inspectionsAPI.create.mockResolvedValue({})
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    const buttons = screen.getAllByRole('button', { name: /Nueva Inspeccion/i })
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getByText('Programar una nueva inspeccion fisica o documental')).toBeInTheDocument())

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const nameInput = screen.getByPlaceholderText('Nombre del recinto')
    fireEvent.change(nameInput, { target: { value: 'Almacen privado' } })

    const createButtons = screen.getAllByRole('button', { name: /Crear Inspeccion/i })
    fireEvent.click(createButtons[0])
    await waitFor(() => expect(inspectionsAPI.create).toHaveBeenCalled())
  })

  test('maneja error al crear inspección', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    inspectionsAPI.create.mockRejectedValueOnce(new Error('boom'))
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    const buttons = screen.getAllByRole('button', { name: /Nueva Inspeccion/i })
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getByText('Programar una nueva inspeccion fisica o documental')).toBeInTheDocument())

    const locationSelect = screen.getAllByRole('combobox').find(s => s.value === '')
    fireEvent.change(locationSelect, { target: { value: 'ESBCN' } })

    const createButtons = screen.getAllByRole('button', { name: /Crear Inspeccion/i })
    fireEvent.click(createButtons[0])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al crear la inspeccion'))
    consoleError.mockRestore()
  })

  test('InspectionDetail renderiza todos los bloques', async () => {
    inspectionsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { scheduledToday: 1, totalPending: 0, inProgress: 0, completedThisWeek: 0 },
          today: [{
            _id: 'i1',
            inspectionNumber: 'INS-001',
            inspectionType: 'physical',
            status: 'completed',
            mrn: '26ES123',
            result: 'approved',
            authority: { type: 'AEAT' },
            location: { name: 'Puerto', address: 'Dir', city: 'BCN' },
            scheduling: { scheduledDate: '2026-08-06', scheduledTime: '09:00', estimatedDuration: 120, confirmationNumber: 'CONF-001' },
            inspector: { name: 'Juan', phone: '666', email: 'j@a.es' },
            findings: { discrepanciesFound: true, discrepancySummary: 'Falta doc' },
            samples: [{ sampleId: 'S001', purpose: 'Test', result: 'OK' }],
            evidence: [{ fileName: 'foto.jpg', type: 'photo' }]
          }],
          pending: [],
          stats: { byType: {}, byResult: {} }
        }
      }
    })
    inspectionsAPI.getChecklist.mockResolvedValue({
      data: { data: { requirements: ['R1'], generalItems: ['G1'] } }
    })
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('INS-001')).toBeInTheDocument())

    const allButtons = document.querySelectorAll('button')
    const viewButton = Array.from(allButtons).find(btn => {
      const svg = btn.querySelector('svg')
      return svg && btn.textContent.trim() === '' && !btn.closest('.btn-primary')
    })
    fireEvent.click(viewButton)
    await waitFor(() => expect(screen.getByText('Ubicacion')).toBeInTheDocument())
    expect(screen.getByText('Programacion')).toBeInTheDocument()
    expect(screen.getByText('Inspector')).toBeInTheDocument()
    expect(screen.getByText('Hallazgos')).toBeInTheDocument()
    expect(screen.getByText('Muestras (1)')).toBeInTheDocument()
    expect(screen.getByText('Evidencias (1)')).toBeInTheDocument()
  })

  test('CreateInspectionModal: cambia tipo de inspección', async () => {
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalled())
    const buttons = screen.getAllByRole('button', { name: /Nueva Inspeccion/i })
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getByText('Programar una nueva inspeccion fisica o documental')).toBeInTheDocument())

    const selects = screen.getAllByRole('combobox')
    const typeSelect = selects.find(s => s.value === 'physical')
    fireEvent.change(typeSelect, { target: { value: 'scanner' } })
    expect(typeSelect.value).toBe('scanner')
  })

  test('recarga dashboard al hacer clic en Actualizar', async () => {
    render(<InspectionManager />, { wrapper: Wrapper })
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/i }))
    await waitFor(() => expect(inspectionsAPI.getDashboard).toHaveBeenCalledTimes(2))
  })
})
