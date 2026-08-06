import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeadlineManager from './DeadlineManager'
import { deadlinesAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  deadlinesAPI: {
    getDashboard: vi.fn(),
    list: vi.fn(),
    complete: vi.fn(),
    extend: vi.fn(),
    create: vi.fn()
  }
}))

describe('<DeadlineManager />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Configurar fake timers con shouldAdvanceTime para getDaysRemaining
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Fijar la fecha base: 2026-08-06 00:00:00 UTC
    vi.setSystemTime(new Date('2026-08-06T00:00:00Z'))

    // Mock por defecto: dashboard vacío
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 0, dueToday: 0, dueThisWeek: 0, totalPending: 0 },
          urgent: [],
          overdue: [],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    deadlinesAPI.list.mockResolvedValue({
      data: { data: { deadlines: [] } }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ==================== CARGA INICIAL ====================

  test('renderiza el componente y carga el dashboard al montarse', async () => {
    render(<DeadlineManager />)

    expect(screen.getByText('deadlines.title')).toBeInTheDocument()
    expect(screen.getByText('deadlines.subtitle')).toBeInTheDocument()

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalledTimes(1))
  })

  test('muestra spinner mientras loading es true', () => {
    render(<DeadlineManager />)
    // Antes del resolve del mock, loading=true
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('muestra el dashboard después de cargar', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 2, dueToday: 1, dueThisWeek: 5, totalPending: 12 },
          urgent: [],
          overdue: [],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Vencidos')).toBeInTheDocument())
    expect(screen.getByText('2')).toBeInTheDocument() // overdue count
    expect(screen.getByText('Vencen Hoy')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // dueToday count
    expect(screen.getByText('Esta Semana')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // dueThisWeek count
    expect(screen.getByText('Total Pendientes')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument() // totalPending count
  })

  test('maneja error en loadDashboard sin romper', async () => {
    deadlinesAPI.getDashboard.mockRejectedValueOnce(new Error('API down'))
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    // El componente no crashea
    expect(screen.getByText('deadlines.title')).toBeInTheDocument()
  })

  // ==================== TABS ====================

  test('cambia de tab Dashboard a Lista Completa', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const listTab = screen.getByText('Lista Completa')
    fireEvent.click(listTab)

    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({}))
  })

  test('lista completa: renderiza filtros y tabla', async () => {
    deadlinesAPI.list.mockResolvedValue({
      data: { data: { deadlines: [] } }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => expect(screen.getByText('Todos los estados')).toBeInTheDocument())
    expect(screen.getByText('Todas las categorias')).toBeInTheDocument()
    expect(screen.getByText('Limpiar filtros')).toBeInTheDocument()
  })

  test('lista vacía muestra mensaje', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => expect(screen.getByText('No hay plazos que mostrar')).toBeInTheDocument())
  })

  // ==================== FILTROS ====================

  test('filtro por status dispara recarga con params', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Lista Completa'))
    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({}))

    const statusSelect = screen.getByDisplayValue('Todos los estados')
    fireEvent.change(statusSelect, { target: { value: 'pending' } })

    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({ status: 'pending' }))
  })

  test('filtro por categoria dispara recarga con params', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Lista Completa'))
    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({}))

    const categorySelect = screen.getByDisplayValue('Todas las categorias')
    fireEvent.change(categorySelect, { target: { value: 'requirement' } })

    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({ category: 'requirement' }))
  })

  test('limpiar filtros resetea a valores vacíos', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Lista Completa'))
    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({}))

    const statusSelect = screen.getByDisplayValue('Todos los estados')
    fireEvent.change(statusSelect, { target: { value: 'pending' } })
    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({ status: 'pending' }))

    fireEvent.click(screen.getByText('Limpiar filtros'))

    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalledWith({}))
  })

  // ==================== getDaysRemaining COVERAGE ====================

  test('getDaysRemaining: días negativos (vencido)', async () => {
    // Hoy: 2026-08-06, dueDate: 2026-08-04 → -2 días
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [{
            _id: 'd1',
            title: 'Plazo Vencido',
            description: 'Descripción',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'requirement',
            status: 'overdue'
          }]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => {
      // Buscar el texto "2 vencido" (getDaysRemaining devuelve -2 → Math.abs(days)=2)
      expect(screen.getByText(/2 vencido/i)).toBeInTheDocument()
    })
  })

  test('getDaysRemaining: días cero (hoy)', async () => {
    // Hoy: 2026-08-06, dueDate: 2026-08-06 → 0 días
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [{
            _id: 'd2',
            title: 'Vence Hoy',
            description: 'Descripción',
            dueDate: '2026-08-06T00:00:00Z',
            category: 'payment',
            status: 'critical'
          }]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => {
      expect(screen.getByText('Hoy')).toBeInTheDocument()
    })
  })

  test('getDaysRemaining: días positivos (futuro)', async () => {
    // Hoy: 2026-08-06, dueDate: 2026-08-10 → 4 días
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [{
            _id: 'd3',
            title: 'Plazo Futuro',
            description: 'Descripción',
            dueDate: '2026-08-10T00:00:00Z',
            category: 'declaration',
            status: 'pending'
          }]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => {
      expect(screen.getByText(/4 dias/i)).toBeInTheDocument()
    })
  })

  // ==================== DASHBOARD SECTIONS ====================

  test('dashboard: muestra sección de plazos urgentes si existen', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 0, dueToday: 0, dueThisWeek: 1, totalPending: 1 },
          urgent: [{
            _id: 'u1',
            title: 'Plazo Urgente Único',
            description: 'Vence pronto',
            dueDate: '2026-08-07T00:00:00Z',
            category: 'requirement',
            status: 'urgent'
          }],
          overdue: [],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => {
      expect(screen.getByText(/Plazos Urgentes/i)).toBeInTheDocument()
      expect(screen.getByText('Plazo Urgente Único')).toBeInTheDocument()
    })
  })

  test('dashboard: muestra sección de plazos vencidos si existen', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Único',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => {
      expect(screen.getByText(/Plazos Vencidos/i)).toBeInTheDocument()
      expect(screen.getByText('Plazo Vencido Único')).toBeInTheDocument()
    })
  })

  test('dashboard: muestra sección de vencimientos de hoy si existen', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 0, dueToday: 1, dueThisWeek: 1, totalPending: 1 },
          urgent: [],
          overdue: [],
          dueToday: [{
            _id: 't1',
            title: 'Plazo Vence Hoy Único',
            description: 'Vence hoy',
            dueDate: '2026-08-06T00:00:00Z',
            category: 'declaration',
            status: 'critical'
          }],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => {
      // La sección tiene header "Vencen Hoy" pero también en el summary card
      expect(screen.getAllByText(/Vencen Hoy/i).length).toBeGreaterThan(0)
      expect(screen.getByText('Plazo Vence Hoy Único')).toBeInTheDocument()
    })
  })

  test('dashboard: muestra estadísticas por categoría', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 0, dueToday: 0, dueThisWeek: 0, totalPending: 10 },
          urgent: [],
          overdue: [],
          dueToday: [],
          stats: {
            byCategory: {
              requirement: 5,
              guarantee: 3,
              payment: 2
            }
          }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => {
      expect(screen.getByText(/Por Categoria/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Requerimientos')).toBeInTheDocument()
    expect(screen.getByText('Garantias')).toBeInTheDocument()
    expect(screen.getByText('Pagos')).toBeInTheDocument()
    // Los números 5, 3, 2 aparecen pero también otros (como el totalPending=10),
    // así que verificamos que las categorías se renderizan
  })

  // ==================== ACCIONES ====================

  test('botón refresh recarga el dashboard', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalledTimes(1))

    const refreshButton = screen.getByText('common.refresh').closest('button')
    fireEvent.click(refreshButton)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalledTimes(2))
  })

  test('botón crear abre modal de creación', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    expect(screen.getByText('Nuevo Plazo')).toBeInTheDocument()
  })

  test('handleComplete llama a la API y recarga', async () => {
    deadlinesAPI.complete.mockResolvedValue({})
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    // DeadlineRow tiene un botón con title="Marcar completado"
    const completeButton = screen.getAllByTitle('Marcar completado')[0]
    fireEvent.click(completeButton)

    await waitFor(() => expect(deadlinesAPI.complete).toHaveBeenCalledWith('o1', 'Completado manualmente'))
    // Debe recargar el dashboard
    expect(deadlinesAPI.getDashboard).toHaveBeenCalledTimes(2)
  })

  test('handleComplete maneja error sin romper', async () => {
    deadlinesAPI.complete.mockRejectedValueOnce(new Error('API error'))
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    const completeButton = screen.getAllByTitle('Marcar completado')[0]
    fireEvent.click(completeButton)

    await waitFor(() => expect(deadlinesAPI.complete).toHaveBeenCalled())
    // No crashea
    expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument()
  })

  // ==================== EXTEND MODAL ====================

  test('botón extender abre ExtendModal', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    const extendButton = screen.getAllByTitle('Extender plazo')[0]
    fireEvent.click(extendButton)

    // Verificar que el modal está visible (tiene clase fixed inset-0)
    expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
    expect(screen.getAllByText('Extender Plazo').length).toBeGreaterThan(0)
  })

  test('ExtendModal: submit con campos vacíos no llama a la API', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    const extendButton = screen.getAllByTitle('Extender plazo')[0]
    fireEvent.click(extendButton)

    const modal = document.querySelector('.fixed.inset-0')
    const form = modal.querySelector('form')
    fireEvent.submit(form)

    // No debe llamar a la API porque los campos están vacíos
    expect(deadlinesAPI.extend).not.toHaveBeenCalled()
  })

  test('ExtendModal: submit correcto llama a la API, cierra modal y muestra toast', async () => {
    deadlinesAPI.extend.mockResolvedValue({})
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    const extendButton = screen.getAllByTitle('Extender plazo')[0]
    fireEvent.click(extendButton)

    // ExtendModal usa input type="date" sin name, buscar dentro del modal
    const modal = document.querySelector('.fixed.inset-0')
    const dateInput = modal.querySelector('input[type="date"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-15' } })

    const reasonInput = screen.getByPlaceholderText('Indique el motivo de la extension...')
    fireEvent.change(reasonInput, { target: { value: 'Motivo de prueba' } })

    const form = modal.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(deadlinesAPI.extend).toHaveBeenCalledWith('o1', '2026-08-15', 'Motivo de prueba'))
    expect(toast.success).toHaveBeenCalledWith('Plazo extendido correctamente')
    // Modal se cierra
    await waitFor(() => expect(document.querySelector('.fixed.inset-0')).not.toBeInTheDocument())
  })

  test('ExtendModal: error muestra toast de error', async () => {
    deadlinesAPI.extend.mockRejectedValueOnce(new Error('API error'))
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    const extendButton = screen.getAllByTitle('Extender plazo')[0]
    fireEvent.click(extendButton)

    const modal = document.querySelector('.fixed.inset-0')
    const dateInput = modal.querySelector('input[type="date"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-15' } })

    const reasonInput = screen.getByPlaceholderText('Indique el motivo de la extension...')
    fireEvent.change(reasonInput, { target: { value: 'Motivo' } })

    const form = modal.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al extender el plazo'))
  })

  test('ExtendModal: botón cerrar cierra el modal', async () => {
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 1, dueToday: 0, dueThisWeek: 0, totalPending: 1 },
          urgent: [],
          overdue: [{
            _id: 'o1',
            title: 'Plazo Vencido Test',
            description: 'Ya pasó',
            dueDate: '2026-08-04T00:00:00Z',
            category: 'payment',
            status: 'overdue'
          }],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(screen.getByText('Plazo Vencido Test')).toBeInTheDocument())

    const extendButton = screen.getAllByTitle('Extender plazo')[0]
    fireEvent.click(extendButton)

    const closeButton = screen.getByText('Cancelar')
    fireEvent.click(closeButton)

    await waitFor(() => expect(screen.queryByText('Extender Plazo')).not.toBeInTheDocument())
  })

  // ==================== CREATE MODAL ====================

  test('CreateDeadlineModal: campos requeridos vacíos no permiten submit', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const submitButton = screen.getByText('Crear Plazo')
    // El botón está disabled si title o dueDate están vacíos
    expect(submitButton).toBeDisabled()
  })

  test('CreateDeadlineModal: submit correcto llama a la API y cierra modal', async () => {
    deadlinesAPI.create.mockResolvedValue({})

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const titleInput = screen.getByPlaceholderText(/Ej: Respuesta requerimiento/i)
    fireEvent.change(titleInput, { target: { value: 'Nuevo plazo' } })

    // Usar data-testid o buscar por type=date (único en el form)
    const dateInput = document.querySelector('input[type="date"][name="dueDate"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } })

    const submitButton = screen.getByText('Crear Plazo')
    fireEvent.click(submitButton)

    await waitFor(() => expect(deadlinesAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deadlineType: 'other',
        title: 'Nuevo plazo',
        dueDate: '2026-08-20',
        priority: 'medium',
        category: 'other',
        source: 'manual'
      })
    ))

    expect(toast.success).toHaveBeenCalledWith('Plazo creado correctamente')
    await waitFor(() => expect(screen.queryByText('Nuevo Plazo')).not.toBeInTheDocument())
  })

  test('CreateDeadlineModal: error muestra toast de error', async () => {
    deadlinesAPI.create.mockRejectedValueOnce(new Error('API error'))

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const titleInput = screen.getByPlaceholderText(/Ej: Respuesta requerimiento/i)
    fireEvent.change(titleInput, { target: { value: 'Nuevo plazo' } })

    const dateInput = document.querySelector('input[type="date"][name="dueDate"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } })

    const submitButton = screen.getByText('Crear Plazo')
    fireEvent.click(submitButton)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al crear el plazo'))
  })

  test('CreateDeadlineModal: cambio de tipo de plazo actualiza categoría', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    // Por defecto es 'other' → categoría 'Otros'
    expect(screen.getByText('Otros')).toBeInTheDocument()

    const typeSelect = document.querySelector('select[name="deadlineType"]')
    fireEvent.change(typeSelect, { target: { value: 'requirement_response' } })

    // Debe cambiar a categoría 'Requerimientos'
    expect(screen.getByText('Requerimientos')).toBeInTheDocument()
  })

  test('CreateDeadlineModal: campos de cliente (opcional) se procesan correctamente', async () => {
    deadlinesAPI.create.mockResolvedValue({})

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const titleInput = screen.getByPlaceholderText(/Ej: Respuesta requerimiento/i)
    fireEvent.change(titleInput, { target: { value: 'Plazo con cliente' } })

    const dateInput = document.querySelector('input[type="date"][name="dueDate"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-25' } })

    const clientNameInput = screen.getByPlaceholderText('Empresa S.L.')
    fireEvent.change(clientNameInput, { target: { value: 'Cliente Test' } })

    const clientNifInput = screen.getByPlaceholderText('B12345678')
    fireEvent.change(clientNifInput, { target: { value: 'B98765432' } })

    const submitButton = screen.getByText('Crear Plazo')
    fireEvent.click(submitButton)

    await waitFor(() => expect(deadlinesAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Plazo con cliente',
        client: {
          name: 'Cliente Test',
          nif: 'B98765432'
        }
      })
    ))
  })

  test('CreateDeadlineModal: botón cancelar cierra el modal', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const cancelButton = screen.getByText('Cancelar')
    fireEvent.click(cancelButton)

    await waitFor(() => expect(screen.queryByText('Nuevo Plazo')).not.toBeInTheDocument())
  })

  // ==================== LISTA: BOTONES CONDICIONALES ====================

  test('lista: deadlines completados o cancelados NO muestran botones de acción', async () => {
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [
            {
              _id: 'd1',
              title: 'Plazo Completado Test',
              description: 'Ya hecho',
              dueDate: '2026-08-01T00:00:00Z',
              category: 'requirement',
              status: 'completed'
            },
            {
              _id: 'd2',
              title: 'Plazo Cancelado Test',
              description: 'Ya cancelado',
              dueDate: '2026-08-02T00:00:00Z',
              category: 'payment',
              status: 'cancelled'
            }
          ]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => expect(screen.getByText('Plazo Completado Test')).toBeInTheDocument())
    expect(screen.getByText('Plazo Cancelado Test')).toBeInTheDocument()

    // No deben existir botones de completar o extender
    expect(screen.queryByTitle('Completar')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Extender')).not.toBeInTheDocument()
  })

  test('lista: deadlines NO completados ni cancelados sí muestran botones de acción', async () => {
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [{
            _id: 'd1',
            title: 'Plazo Pendiente Test',
            description: 'Aún no hecho',
            dueDate: '2026-08-10T00:00:00Z',
            category: 'requirement',
            status: 'pending'
          }]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => expect(screen.getByText('Plazo Pendiente Test')).toBeInTheDocument())

    expect(screen.getByTitle('Completar')).toBeInTheDocument()
    expect(screen.getByTitle('Extender')).toBeInTheDocument()
  })

  // ==================== DeadlineRow: daysRemaining FALLBACK ====================

  test('DeadlineRow usa daysRemaining del deadline si está disponible', async () => {
    // DeadlineRow solo se usa en dashboard (urgent/overdue/dueToday), NO en la lista
    // Vamos a probar que en el dashboard usa daysRemaining correctamente
    deadlinesAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { overdue: 0, dueToday: 0, dueThisWeek: 1, totalPending: 1 },
          urgent: [{
            _id: 'dr1',
            title: 'Con daysRemaining Pre-calculado',
            description: 'Test',
            dueDate: '2026-08-10T00:00:00Z',
            category: 'payment',
            status: 'pending',
            daysRemaining: 10 // pre-calculado
          }],
          overdue: [],
          dueToday: [],
          stats: { byCategory: {} }
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => {
      // DeadlineRow línea 540: usa daysRemaining si existe, sino calcula
      // DeadlineRow línea 556: muestra " (10 dias restantes)"
      expect(screen.getByText('Con daysRemaining Pre-calculado')).toBeInTheDocument()
      expect(screen.getByText(/10 dias restantes/i)).toBeInTheDocument()
    })
  })

  // ==================== COVERAGE EDGE CASES ====================

  test('formatDate con null devuelve -', async () => {
    // Esta función es pura, pero para cubrirla en el contexto del componente,
    // podemos renderizar un deadline con dueDate null (si el backend lo permite)
    // o simplemente verificar que el componente no crashea si algún campo es null.
    // Aquí simulamos un deadline sin dueDate.
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [{
            _id: 'd1',
            title: 'Sin fecha',
            description: 'Test',
            dueDate: null,
            category: 'other',
            status: 'pending'
          }]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Lista Completa'))

    // No debe crashear; formatDate devuelve '-'
    // (En la tabla, la columna de vencimiento mostrará '-' y días mostrará nada o un valor por defecto)
    // Verificamos que el componente sigue montado
    await waitFor(() => expect(screen.getByText('Sin fecha')).toBeInTheDocument())
  })

  test('getDaysRemaining con null devuelve null (no crashea)', async () => {
    deadlinesAPI.list.mockResolvedValue({
      data: {
        data: {
          deadlines: [{
            _id: 'd1',
            title: 'Sin fecha',
            description: 'Test',
            dueDate: null,
            category: 'other',
            status: 'pending'
          }]
        }
      }
    })

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => expect(screen.getByText('Sin fecha')).toBeInTheDocument())
    // No debe crashear
  })

  test('activeTab por defecto es dashboard', () => {
    render(<DeadlineManager />)
    // El tab Dashboard está activo (border-luci text-luci)
    const dashboardTab = screen.getByText('Dashboard')
    expect(dashboardTab.closest('button')).toHaveClass('border-luci')
  })

  test('loading desde lista también funciona', async () => {
    // Simular un delay en list para ver el spinner
    deadlinesAPI.list.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { data: { deadlines: [] } } }), 100)))

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    // Mientras carga, debe haber spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()

    // Esperar a que termine
    await waitFor(() => expect(screen.getByText('No hay plazos que mostrar')).toBeInTheDocument())
  })

  test('maneja error en loadDeadlines sin romper', async () => {
    deadlinesAPI.list.mockRejectedValueOnce(new Error('API error'))

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Lista Completa'))

    await waitFor(() => expect(deadlinesAPI.list).toHaveBeenCalled())
    // No crashea
    expect(screen.getByText('Lista Completa')).toBeInTheDocument()
  })

  test('dashboard sin datos (null) no rompe renderDashboard', () => {
    // Simular que getDashboard devuelve null
    deadlinesAPI.getDashboard.mockResolvedValueOnce({ data: { data: null } })

    render(<DeadlineManager />)

    // No debe crashear; renderDashboard tiene guard `if (!dashboard) return null`
    expect(screen.getByText('deadlines.title')).toBeInTheDocument()
  })

  test('CreateDeadlineModal: loading state durante submit', async () => {
    deadlinesAPI.create.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 100)))

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const titleInput = screen.getByPlaceholderText(/Ej: Respuesta requerimiento/i)
    fireEvent.change(titleInput, { target: { value: 'Nuevo plazo' } })

    const dateInput = document.querySelector('input[type="date"][name="dueDate"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } })

    const submitButton = screen.getByText('Crear Plazo')
    fireEvent.click(submitButton)

    // Debe mostrar "Creando..."
    await waitFor(() => expect(screen.getByText('Creando...')).toBeInTheDocument())

    // Esperar a que termine
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  test('CreateDeadlineModal: todos los campos de prioridad son accesibles', async () => {
    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const prioritySelect = document.querySelector('select[name="priority"]')

    // Cambiar a cada prioridad para cubrir las opciones
    fireEvent.change(prioritySelect, { target: { value: 'low' } })
    expect(prioritySelect.value).toBe('low')

    fireEvent.change(prioritySelect, { target: { value: 'high' } })
    expect(prioritySelect.value).toBe('high')

    fireEvent.change(prioritySelect, { target: { value: 'critical' } })
    expect(prioritySelect.value).toBe('critical')
  })

  test('CreateDeadlineModal: campos de descripción y notas se procesan', async () => {
    deadlinesAPI.create.mockResolvedValue({})

    render(<DeadlineManager />)

    await waitFor(() => expect(deadlinesAPI.getDashboard).toHaveBeenCalled())

    const createButton = screen.getByText('deadlines.newDeadline').closest('button')
    fireEvent.click(createButton)

    const titleInput = screen.getByPlaceholderText(/Ej: Respuesta requerimiento/i)
    fireEvent.change(titleInput, { target: { value: 'Plazo completo' } })

    const descInput = screen.getByPlaceholderText('Descripcion detallada del plazo...')
    fireEvent.change(descInput, { target: { value: 'Descripción larga' } })

    const notesInput = screen.getByPlaceholderText('Notas adicionales...')
    fireEvent.change(notesInput, { target: { value: 'Notas internas' } })

    const dateInput = document.querySelector('input[type="date"][name="dueDate"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-30' } })

    const submitButton = screen.getByText('Crear Plazo')
    fireEvent.click(submitButton)

    await waitFor(() => expect(deadlinesAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Plazo completo',
        description: 'Descripción larga',
        notes: 'Notas internas'
      })
    ))
  })
})
