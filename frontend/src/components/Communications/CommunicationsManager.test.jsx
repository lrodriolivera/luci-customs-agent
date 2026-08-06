import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommunicationsManager from './CommunicationsManager'
import { communicationsAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('../../services/api', () => ({
  communicationsAPI: {
    getDashboard: vi.fn(),
    list: vi.fn(),
    getAppeals: vi.fn(),
    getTypes: vi.fn(),
    getAuthorities: vi.fn(),
    approve: vi.fn(),
    submit: vi.fn(),
    create: vi.fn()
  }
}))

describe('<CommunicationsManager />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Defaults para el montaje inicial
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 0, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.getTypes.mockResolvedValue({ data: { data: [] } })
    communicationsAPI.getAuthorities.mockResolvedValue({ data: { data: [] } })
  })

  test('renderiza el título y subtítulo traducidos', async () => {
    render(<CommunicationsManager />)
    expect(screen.getByText('communications.title')).toBeInTheDocument()
    expect(screen.getByText('communications.subtitle')).toBeInTheDocument()
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())
  })

  test('carga dashboard y tipos al montarse', async () => {
    render(<CommunicationsManager />)
    await waitFor(() => {
      expect(communicationsAPI.getDashboard).toHaveBeenCalled()
      expect(communicationsAPI.getTypes).toHaveBeenCalled()
      expect(communicationsAPI.getAuthorities).toHaveBeenCalled()
    })
  })

  test('muestra spinner durante carga inicial', () => {
    render(<CommunicationsManager />)
    // El loading spinner tiene clase border-luci
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('dashboard con estadísticas vacías muestra ceros', async () => {
    render(<CommunicationsManager />)
    // findByText espera a que el dashboard termine de renderizar tras resolver
    // getDashboard; esperar solo a que la API "haya sido llamada" es frágil en
    // la bateria completa (el setState async puede no haberse vaciado aun).
    // Las cards de stats tienen texto "Pendientes" / "Vencidas" / etc.
    expect(await screen.findByText('Pendientes')).toBeInTheDocument()
    expect(screen.getByText('Vencidas')).toBeInTheDocument()
    expect(screen.getByText('Esperando Respuesta')).toBeInTheDocument()
    expect(screen.getByText('Recursos Activos')).toBeInTheDocument()
  })

  test('dashboard con comunicaciones vencidas muestra la sección', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 1, pendingResponse: 0, totalAppeals: 0 },
          overdue: [
            {
              _id: 'overdue-1',
              communicationNumber: 'COM-001',
              subject: 'Requerimiento vencido',
              communicationType: 'requirement_response',
              status: 'expired',
              authority: { type: 'AEAT' },
              deadlines: { submissionDeadline: '2025-01-01' }
            }
          ],
          pending: [],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('Comunicaciones Vencidas')).toBeInTheDocument())
    expect(screen.getByText('COM-001')).toBeInTheDocument()
    expect(screen.getByText('Requerimiento vencido')).toBeInTheDocument()
  })

  test('dashboard con comunicaciones pendientes muestra la sección', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'pending-1',
              communicationNumber: 'COM-002',
              subject: 'Pendiente de envío',
              communicationType: 'allegation',
              status: 'approved',
              authority: { type: 'Aduana BCN' },
              deadlines: { submissionDeadline: '2026-12-31' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('Comunicaciones Pendientes')).toBeInTheDocument())
    expect(screen.getByText('COM-002')).toBeInTheDocument()
  })

  test('dashboard con resueltas recientes muestra la sección', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 0, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [],
          recentResolved: [
            {
              _id: 'resolved-1',
              communicationNumber: 'COM-003',
              subject: 'Caso resuelto',
              communicationType: 'administrative_appeal',
              status: 'resolved',
              authority: { type: 'AEAT' }
            }
          ],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('Resueltas Recientemente')).toBeInTheDocument())
    expect(screen.getByText('COM-003')).toBeInTheDocument()
  })

  test('dashboard con stats por categoría muestra la sección', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 0, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [],
          recentResolved: [],
          stats: { byCategory: { response: 5, appeal: 3, request: 2 } }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('Por Categoria')).toBeInTheDocument())
    expect(screen.getByText('Respuestas')).toBeInTheDocument()
    expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0)
    expect(screen.getByText('Solicitudes')).toBeInTheDocument()
  })

  test('tab "Todas" carga listado de comunicaciones', async () => {
    communicationsAPI.list.mockResolvedValue({
      data: { data: { communications: [
        {
          _id: 'list-1',
          communicationNumber: 'COM-100',
          subject: 'Primera comunicación',
          communicationType: 'clarification',
          status: 'sent',
          authority: { type: 'AEAT' },
          deadlines: { submissionDeadline: '2026-09-01' }
        }
      ] } }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))

    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({}))
    expect(screen.getByText('COM-100')).toBeInTheDocument()
    expect(screen.getByText(/Primera comunicación/)).toBeInTheDocument()
  })

  test('tab "Recursos" carga getAppeals', async () => {
    communicationsAPI.getAppeals.mockResolvedValue({
      data: { data: [
        {
          _id: 'appeal-1',
          communicationNumber: 'REC-001',
          subject: 'Recurso económico',
          communicationType: 'economic_appeal',
          status: 'in_process',
          authority: { type: 'TEAC' }
        }
      ] }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Recursos'))

    await waitFor(() => expect(communicationsAPI.getAppeals).toHaveBeenCalledWith(null))
    expect(screen.getByText('REC-001')).toBeInTheDocument()
  })

  test('filtro de status en tab "Todas" llama a list con parámetros', async () => {
    communicationsAPI.list.mockResolvedValue({ data: { data: { communications: [] } } })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({}))

    const statusSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(statusSelect, { target: { value: 'sent' } })

    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({ status: 'sent' }))
  })

  test('filtro de categoría en tab "Todas" llama a list con parámetros', async () => {
    communicationsAPI.list.mockResolvedValue({ data: { data: { communications: [] } } })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({}))

    const categorySelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(categorySelect, { target: { value: 'appeal' } })

    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({ category: 'appeal' }))
  })

  test('filtro de tipo en tab "Todas" llama a list con parámetros', async () => {
    communicationsAPI.getTypes.mockResolvedValue({
      data: { data: [{ value: 'allegation', label: 'Alegación' }] }
    })
    communicationsAPI.list.mockResolvedValue({ data: { data: { communications: [] } } })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({}))

    const typeSelect = screen.getAllByRole('combobox')[2]
    fireEvent.change(typeSelect, { target: { value: 'allegation' } })

    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({ communicationType: 'allegation' }))
  })

  test('limpiar filtros resetea todos los filtros', async () => {
    communicationsAPI.list.mockResolvedValue({ data: { data: { communications: [] } } })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({}))

    const statusSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(statusSelect, { target: { value: 'sent' } })
    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({ status: 'sent' }))

    fireEvent.click(screen.getByText('Limpiar filtros'))

    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalledWith({}))
  })

  test('lista vacía muestra mensaje "No hay comunicaciones"', async () => {
    communicationsAPI.list.mockResolvedValue({ data: { data: { communications: [] } } })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))

    await waitFor(() => expect(screen.getByText('No hay comunicaciones que mostrar')).toBeInTheDocument())
  })

  test('botón "Aprobar" en comunicación draft llama a approve y recarga', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'draft-1',
              communicationNumber: 'COM-DRAFT',
              subject: 'Borrador',
              communicationType: 'clarification',
              status: 'draft',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.approve.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-DRAFT')).toBeInTheDocument())

    const approveButton = screen.getByText('Aprobar')
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(communicationsAPI.approve).toHaveBeenCalledWith('draft-1')
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
    })
  })

  test('botón "Enviar" en comunicación approved llama a submit y recarga', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'approved-1',
              communicationNumber: 'COM-APP',
              subject: 'Aprobada',
              communicationType: 'allegation',
              status: 'approved',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.submit.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-APP')).toBeInTheDocument())

    const submitButton = screen.getByText('Enviar')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(communicationsAPI.submit).toHaveBeenCalledWith('approved-1')
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
    })
  })

  test('clic en comunicación abre modal de detalle', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'view-1',
              communicationNumber: 'COM-VIEW',
              subject: 'Ver detalle',
              communicationType: 'clarification',
              status: 'sent',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getAllByText('COM-VIEW').length).toBe(1))

    // CommunicationRow tiene un botón con ChevronRightIcon para ver
    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      // El modal de detalle muestra el header sticky con el número
      const modals = screen.getAllByText('COM-VIEW')
      expect(modals.length).toBeGreaterThan(1)
    })
  })

  test('modal de detalle muestra información completa', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'detail-1',
              communicationNumber: 'COM-DETAIL',
              subject: 'Asunto detallado',
              description: 'Descripción larga',
              communicationType: 'administrative_appeal',
              status: 'in_process',
              category: 'appeal',
              authority: { type: 'TEAC' },
              priority: 'high',
              deadlines: {
                submissionDeadline: '2026-10-01',
                responseDeadline: '2026-11-01',
                appealDeadline: '2026-12-01'
              },
              arguments: [
                { title: 'Argumento 1', content: 'Contenido argumento 1' }
              ],
              messages: [
                { direction: 'outgoing', subject: 'Saliente', content: 'Contenido saliente', sentAt: '2026-08-01' }
              ],
              resolution: {
                status: 'favorable',
                summary: 'Resumen de resolución',
                date: '2026-08-05'
              },
              economicImpact: {
                totalAmount: 1000,
                claimedAmount: 500,
                recognizedAmount: 300,
                penaltyAmount: 100
              }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-DETAIL')).toBeInTheDocument())

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText('Asunto detallado').length).toBeGreaterThan(0)
      expect(screen.getByText('Descripción larga')).toBeInTheDocument()
      expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0)
      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('Plazos')).toBeInTheDocument()
      expect(screen.getByText('Argumentos')).toBeInTheDocument()
      expect(screen.getByText('Argumento 1')).toBeInTheDocument()
      expect(screen.getByText(/Mensajes/)).toBeInTheDocument()
      expect(screen.getByText('Saliente')).toBeInTheDocument()
      expect(screen.getByText('Resolucion')).toBeInTheDocument()
      expect(screen.getByText('Favorable')).toBeInTheDocument()
      expect(screen.getByText('Impacto Economico')).toBeInTheDocument()
      expect(screen.getByText('Reclamado')).toBeInTheDocument()
    })
  })

  test('modal de detalle cierra al hacer clic en cerrar', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'close-1',
              communicationNumber: 'COM-CLOSE',
              subject: 'Para cerrar',
              communicationType: 'clarification',
              status: 'sent',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getAllByText('COM-CLOSE').length).toBe(1))

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])
    await waitFor(() => expect(screen.getAllByText('COM-CLOSE').length).toBeGreaterThan(1))

    // El modal tiene botón "Cerrar" al final
    const closeButtons = screen.getAllByText('Cerrar')
    fireEvent.click(closeButtons[closeButtons.length - 1])

    await waitFor(() => {
      const remaining = screen.queryAllByText('COM-CLOSE')
      expect(remaining.length).toBe(1) // Solo el de la lista principal
    })
  })

  test('botón "Nueva Comunicación" abre modal de creación', async () => {
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('communications.newCommunication'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Comunicacion')).toBeInTheDocument()
    })
  })

  test('modal nueva comunicación permite crear', async () => {
    communicationsAPI.getTypes.mockResolvedValue({
      data: { data: [{ value: 'clarification', label: 'Aclaración' }] }
    })
    communicationsAPI.getAuthorities.mockResolvedValue({
      data: { data: [{ code: 'AEAT', shortName: 'AEAT', name: 'Agencia Tributaria' }] }
    })
    communicationsAPI.create.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('communications.newCommunication'))
    await waitFor(() => expect(screen.getByText('Nueva Comunicacion')).toBeInTheDocument())

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'clarification' } })

    const subjectInput = screen.getByPlaceholderText('Asunto de la comunicacion')
    fireEvent.change(subjectInput, { target: { value: 'Test subject' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(communicationsAPI.create).toHaveBeenCalledWith({
        communicationType: 'clarification',
        subject: 'Test subject',
        description: '',
        authorityType: 'AEAT',
        priority: 'normal',
        authority: { type: 'AEAT' }
      })
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
    })
  })

  test('botón "Actualizar" recarga el dashboard', async () => {
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('Actualizar'))

    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2))
  })

  test('error en getDashboard se maneja sin romper', async () => {
    communicationsAPI.getDashboard.mockRejectedValueOnce(new Error('API down'))
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())
    // El componente sigue montado
    expect(screen.getByText('communications.title')).toBeInTheDocument()
  })

  test('error en list se maneja sin romper', async () => {
    communicationsAPI.list.mockRejectedValueOnce(new Error('API down'))
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))

    await waitFor(() => expect(communicationsAPI.list).toHaveBeenCalled())
    expect(screen.getByText('communications.title')).toBeInTheDocument()
  })

  test('error en getAppeals se maneja sin romper', async () => {
    communicationsAPI.getAppeals.mockRejectedValueOnce(new Error('API down'))
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Recursos'))

    await waitFor(() => expect(communicationsAPI.getAppeals).toHaveBeenCalled())
    expect(screen.getByText('communications.title')).toBeInTheDocument()
  })

  test('error en approve se maneja sin romper', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'err-approve',
              communicationNumber: 'COM-ERR',
              subject: 'Error',
              communicationType: 'clarification',
              status: 'draft',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.approve.mockRejectedValueOnce(new Error('Approve failed'))
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-ERR')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Aprobar'))

    await waitFor(() => expect(communicationsAPI.approve).toHaveBeenCalled())
    expect(screen.getByText('COM-ERR')).toBeInTheDocument()
  })

  test('error en submit se maneja sin romper', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'err-submit',
              communicationNumber: 'COM-SUBMIT-ERR',
              subject: 'Error submit',
              communicationType: 'clarification',
              status: 'approved',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.submit.mockRejectedValueOnce(new Error('Submit failed'))
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-SUBMIT-ERR')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(communicationsAPI.submit).toHaveBeenCalled())
    expect(screen.getByText('COM-SUBMIT-ERR')).toBeInTheDocument()
  })

  test('CommunicationRow renderiza días vencidos en negativo', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 1, pendingResponse: 0, totalAppeals: 0 },
          overdue: [
            {
              _id: 'overdue-days',
              communicationNumber: 'COM-OVERDUE',
              subject: 'Vencido',
              communicationType: 'requirement_response',
              status: 'expired',
              authority: { type: 'AEAT' },
              deadlines: { submissionDeadline: '2020-01-01' }
            }
          ],
          pending: [],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-OVERDUE')).toBeInTheDocument())
    // Buscar texto "vencido" con substring
    expect(screen.getByText(/vencido/)).toBeInTheDocument()
  })

  test('CommunicationRow renderiza días restantes cuando vence hoy', async () => {
    const today = new Date()
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'today',
              communicationNumber: 'COM-TODAY',
              subject: 'Vence hoy',
              communicationType: 'clarification',
              status: 'approved',
              authority: { type: 'AEAT' },
              deadlines: { submissionDeadline: today.toISOString() }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-TODAY')).toBeInTheDocument())
    expect(screen.getAllByText(/Vence hoy|0d/).length).toBeGreaterThan(0)
  })

  test('lista en tabla muestra días restantes con colores según urgencia', async () => {
    communicationsAPI.list.mockResolvedValue({
      data: { data: { communications: [
        {
          _id: 'urgent',
          communicationNumber: 'COM-URGENT',
          subject: 'Urgente',
          communicationType: 'clarification',
          status: 'approved',
          authority: { type: 'AEAT' },
          deadlines: { submissionDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }
        }
      ] } }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))

    await waitFor(() => expect(screen.getByText('COM-URGENT')).toBeInTheDocument())
    // El componente muestra "2d" o similar
    const daysElements = screen.getAllByText(/\d+d$/)
    expect(daysElements.length).toBeGreaterThan(0)
  })

  test('filtro de status en tab recursos llama a getAppeals con status', async () => {
    communicationsAPI.getAppeals.mockResolvedValue({ data: { data: [] } })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Recursos'))
    await waitFor(() => expect(communicationsAPI.getAppeals).toHaveBeenCalledWith(null))

    const statusSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(statusSelect, { target: { value: 'in_process' } })

    await waitFor(() => expect(communicationsAPI.getAppeals).toHaveBeenCalledWith('in_process'))
  })

  test('approve en tab list recarga tanto dashboard como list', async () => {
    communicationsAPI.list.mockResolvedValue({
      data: { data: { communications: [
        {
          _id: 'list-draft',
          communicationNumber: 'COM-LIST-DRAFT',
          subject: 'Draft en lista',
          communicationType: 'clarification',
          status: 'draft',
          authority: { type: 'AEAT' }
        }
      ] } }
    })
    communicationsAPI.approve.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => expect(screen.getByText('COM-LIST-DRAFT')).toBeInTheDocument())

    // En la tabla, buscar el botón con CheckCircleIcon (aprobar)
    const approveIcon = document.querySelector('button[title="Aprobar"]')
    fireEvent.click(approveIcon)

    await waitFor(() => {
      expect(communicationsAPI.approve).toHaveBeenCalledWith('list-draft')
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
      expect(communicationsAPI.list).toHaveBeenCalledTimes(2)
    })
  })

  test('submit en tab list recarga tanto dashboard como list', async () => {
    communicationsAPI.list.mockResolvedValue({
      data: { data: { communications: [
        {
          _id: 'list-approved',
          communicationNumber: 'COM-LIST-APP',
          subject: 'Aprobada en lista',
          communicationType: 'clarification',
          status: 'approved',
          authority: { type: 'AEAT' }
        }
      ] } }
    })
    communicationsAPI.submit.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => expect(screen.getByText('COM-LIST-APP')).toBeInTheDocument())

    const submitIcon = document.querySelector('button[title="Enviar"]')
    fireEvent.click(submitIcon)

    await waitFor(() => {
      expect(communicationsAPI.submit).toHaveBeenCalledWith('list-approved')
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
      expect(communicationsAPI.list).toHaveBeenCalledTimes(2)
    })
  })

  test('modal nueva comunicación cierra al cancelar', async () => {
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('communications.newCommunication'))
    await waitFor(() => expect(screen.getByText('Nueva Comunicacion')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Cancelar'))

    await waitFor(() => {
      expect(screen.queryByText('Nueva Comunicacion')).not.toBeInTheDocument()
    })
  })

  test('modal nueva comunicación permite cambiar descripción y prioridad', async () => {
    communicationsAPI.getTypes.mockResolvedValue({
      data: { data: [{ value: 'clarification', label: 'Aclaración' }] }
    })
    communicationsAPI.getAuthorities.mockResolvedValue({
      data: { data: [{ code: 'AEAT', shortName: 'AEAT', name: 'Agencia Tributaria' }] }
    })
    communicationsAPI.create.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('communications.newCommunication'))
    await waitFor(() => expect(screen.getByText('Nueva Comunicacion')).toBeInTheDocument())

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'clarification' } })

    const subjectInput = screen.getByPlaceholderText('Asunto de la comunicacion')
    fireEvent.change(subjectInput, { target: { value: 'Subject' } })

    const descriptionTextarea = screen.getByPlaceholderText('Descripcion detallada...')
    fireEvent.change(descriptionTextarea, { target: { value: 'Long description' } })

    const prioritySelect = screen.getAllByRole('combobox')[2]
    fireEvent.change(prioritySelect, { target: { value: 'urgent' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(communicationsAPI.create).toHaveBeenCalledWith({
        communicationType: 'clarification',
        subject: 'Subject',
        description: 'Long description',
        authorityType: 'AEAT',
        priority: 'urgent',
        authority: { type: 'AEAT' }
      })
    })
  })

  test('modal detalle con resolución desfavorable muestra color rojo', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'unfavorable',
              communicationNumber: 'COM-UNFAV',
              subject: 'Desfavorable',
              communicationType: 'administrative_appeal',
              status: 'resolved',
              authority: { type: 'TEAC' },
              resolution: {
                status: 'unfavorable',
                summary: 'Desestimado'
              }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getAllByText('COM-UNFAV').length).toBe(1))

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText('Desfavorable').length).toBeGreaterThan(0)
      expect(screen.getByText('Desestimado')).toBeInTheDocument()
    })
  })

  test('modal detalle sin deadlines no muestra sección de plazos', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'no-deadlines',
              communicationNumber: 'COM-NO-DL',
              subject: 'Sin plazos',
              communicationType: 'clarification',
              status: 'draft',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getAllByText('COM-NO-DL').length).toBe(1))

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText('Sin plazos').length).toBeGreaterThan(0)
      expect(screen.queryByText('Plazos')).not.toBeInTheDocument()
    })
  })

  test('modal detalle con mensaje incoming muestra dirección correcta', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'incoming-msg',
              communicationNumber: 'COM-INC',
              subject: 'Con mensaje entrante',
              communicationType: 'clarification',
              status: 'read',
              authority: { type: 'AEAT' },
              messages: [
                { direction: 'incoming', subject: 'Entrante', content: 'Contenido entrante', sentAt: '2026-08-01' }
              ]
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-INC')).toBeInTheDocument())

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Entrante')).toBeInTheDocument()
      expect(screen.getByText('Recibido')).toBeInTheDocument()
    })
  })

  test('lista en tabla con deadline null muestra guion', async () => {
    communicationsAPI.list.mockResolvedValue({
      data: { data: { communications: [
        {
          _id: 'no-deadline',
          communicationNumber: 'COM-NO-DL',
          subject: 'Sin plazo',
          communicationType: 'clarification',
          status: 'draft',
          authority: { type: 'AEAT' }
        }
      ] } }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Todas'))

    await waitFor(() => {
      expect(screen.getByText('COM-NO-DL')).toBeInTheDocument()
      // La columna de plazo muestra "-"
      const cells = document.querySelectorAll('td')
      const deadlineCell = Array.from(cells).find(cell => cell.textContent === '-')
      expect(deadlineCell).toBeInTheDocument()
    })
  })

  test('CommunicationRow con daysUntilDeadline precomputado usa ese valor', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'precomputed',
              communicationNumber: 'COM-PRE',
              subject: 'Con días precomputados',
              communicationType: 'clarification',
              status: 'sent',
              authority: { type: 'AEAT' },
              daysUntilDeadline: 10
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-PRE')).toBeInTheDocument())
    expect(screen.getByText('10d restantes')).toBeInTheDocument()
  })

  test('approve desde modal de detalle recarga dashboard', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'modal-approve',
              communicationNumber: 'COM-MODAL-APP',
              subject: 'Aprobar desde modal',
              communicationType: 'clarification',
              status: 'draft',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.approve.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-MODAL-APP')).toBeInTheDocument())

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])
    await waitFor(() => expect(screen.getAllByText('COM-MODAL-APP').length).toBeGreaterThan(1))

    const approveButton = screen.getAllByText('Aprobar')[1] // El del modal
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(communicationsAPI.approve).toHaveBeenCalledWith('modal-approve')
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
    })
  })

  test('submit desde modal de detalle recarga dashboard', async () => {
    communicationsAPI.getDashboard.mockResolvedValue({
      data: {
        data: {
          summary: { totalPending: 1, overdue: 0, pendingResponse: 0, totalAppeals: 0 },
          overdue: [],
          pending: [
            {
              _id: 'modal-submit',
              communicationNumber: 'COM-MODAL-SUB',
              subject: 'Enviar desde modal',
              communicationType: 'clarification',
              status: 'approved',
              authority: { type: 'AEAT' }
            }
          ],
          recentResolved: [],
          stats: { byCategory: {} }
        }
      }
    })
    communicationsAPI.submit.mockResolvedValue({})
    render(<CommunicationsManager />)
    await waitFor(() => expect(screen.getByText('COM-MODAL-SUB')).toBeInTheDocument())

    const viewButtons = document.querySelectorAll('button[class*="text-gray-400"]')
    fireEvent.click(viewButtons[0])
    await waitFor(() => expect(screen.getAllByText('COM-MODAL-SUB').length).toBeGreaterThan(1))

    const submitButton = screen.getAllByText('Enviar')[1] // El del modal
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(communicationsAPI.submit).toHaveBeenCalledWith('modal-submit')
      expect(communicationsAPI.getDashboard).toHaveBeenCalledTimes(2)
    })
  })

  test('error en create muestra consola pero no rompe', async () => {
    communicationsAPI.getTypes.mockResolvedValue({
      data: { data: [{ value: 'clarification', label: 'Aclaración' }] }
    })
    communicationsAPI.getAuthorities.mockResolvedValue({
      data: { data: [{ code: 'AEAT', shortName: 'AEAT', name: 'Agencia Tributaria' }] }
    })
    communicationsAPI.create.mockRejectedValueOnce(new Error('Create failed'))
    render(<CommunicationsManager />)
    await waitFor(() => expect(communicationsAPI.getDashboard).toHaveBeenCalled())

    fireEvent.click(screen.getByText('communications.newCommunication'))
    await waitFor(() => expect(screen.getByText('Nueva Comunicacion')).toBeInTheDocument())

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'clarification' } })

    const subjectInput = screen.getByPlaceholderText('Asunto de la comunicacion')
    fireEvent.change(subjectInput, { target: { value: 'Test' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(communicationsAPI.create).toHaveBeenCalled())
    // El componente sigue montado
    expect(screen.getByText('Nueva Comunicacion')).toBeInTheDocument()
  })
})
