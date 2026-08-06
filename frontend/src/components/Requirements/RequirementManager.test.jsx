import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RequirementManager from './RequirementManager'
import { requirementsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  requirementsAPI: {
    getByExpedition: vi.fn(),
    create: vi.fn(),
    addResponse: vi.fn(),
    submitToAEAT: vi.fn(),
    generateAIResponse: vi.fn(),
    resolve: vi.fn(),
    aiAnalyzeDocuments: vi.fn(),
    aiSuggestArguments: vi.fn(),
    aiAnalyzeRisk: vi.fn(),
    aiDraftResponse: vi.fn(),
    aiFullAnalysis: vi.fn()
  }
}))

describe('<RequirementManager />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
  })

  test('renderiza el componente con título y cuenta de requerimientos', async () => {
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())
    expect(screen.getByText('requirements.noPendingRequirements')).toBeInTheDocument()
  })

  test('loading state muestra spinner al cargar', () => {
    render(<RequirementManager expeditionId="exp123" />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  test('carga requerimientos al montar con expeditionId', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test req', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp456" />)
    await waitFor(() => expect(requirementsAPI.getByExpedition).toHaveBeenCalledWith('exp456'))
    expect(await screen.findByText('REQ-001')).toBeInTheDocument()
  })

  test('maneja error al cargar requerimientos', async () => {
    requirementsAPI.getByExpedition.mockRejectedValue(new Error('Network error'))
    render(<RequirementManager expeditionId="exp999" />)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('requirements.errorLoading'))
  })

  test('muestra formulario de creación al hacer clic en botón nuevo', async () => {
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())
    fireEvent.click(screen.getByText('requirements.newRequirement'))
    expect(screen.getAllByText('requirements.createRequirement')[0]).toBeInTheDocument()
  })

  test('validación: crear sin subject ni description muestra toast error', async () => {
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())
    fireEvent.click(screen.getByText('requirements.newRequirement'))
    const form = document.querySelector('form')
    fireEvent.submit(form)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('requirements.fillRequired'))
    expect(requirementsAPI.create).not.toHaveBeenCalled()
  })

  test('crear requerimiento con datos válidos llama a la API y recarga', async () => {
    requirementsAPI.create.mockResolvedValue({ data: { _id: 'newReq' } })
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())
    fireEvent.click(screen.getByText('requirements.newRequirement'))

    fireEvent.change(screen.getByPlaceholderText('Ej: Solicitud de factura comercial'), { target: { value: 'Test subject' } })
    fireEvent.change(screen.getByPlaceholderText('Detalle del requerimiento...'), { target: { value: 'Test desc' } })

    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(requirementsAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({ expeditionId: 'exp123', subject: 'Test subject', description: 'Test desc' })
    ))
    expect(toast.success).toHaveBeenCalledWith('requirements.created')
    expect(requirementsAPI.getByExpedition).toHaveBeenCalledTimes(2)
  })

  test('crear requerimiento con error de API muestra toast error', async () => {
    requirementsAPI.create.mockRejectedValue({ response: { data: { message: 'Validation error' } } })
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())
    fireEvent.click(screen.getByText('requirements.newRequirement'))

    fireEvent.change(screen.getByPlaceholderText('Ej: Solicitud de factura comercial'), { target: { value: 'Subj' } })
    fireEvent.change(screen.getByPlaceholderText('Detalle del requerimiento...'), { target: { value: 'Desc' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Validation error'))
  })

  test('expandir requerimiento muestra su contenido detallado', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Factura', description: 'Desc detallada', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    expect(await screen.findByText('Desc detallada')).toBeInTheDocument()
  })

  test('getDaysRemaining: vencido muestra "Vencido hace N dias"', async () => {
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', deadline: yesterday }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText(/Vencido hace/)).toBeInTheDocument())
  })

  test('getDaysRemaining: hoy muestra "Vence hoy"', async () => {
    const today = new Date().toISOString()
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-002', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', deadline: today }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('Vence hoy')).toBeInTheDocument())
  })

  test('getDaysRemaining: futuro muestra "N dias restantes"', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-003', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', deadline: future }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText(/dias restantes/)).toBeInTheDocument())
  })

  test('agregar respuesta sin notes muestra toast error', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Agregar Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Agregar Respuesta'))

    const textarea = document.querySelector('textarea[placeholder="Escribe tu respuesta..."]')
    expect(textarea).toBeInTheDocument()

    fireEvent.click(screen.getByText('Guardar Respuesta'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('requirements.writeResponse'))
    expect(requirementsAPI.addResponse).not.toHaveBeenCalled()
  })

  test('agregar respuesta con notes llama a la API', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.addResponse.mockResolvedValue({ data: { success: true } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Agregar Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Agregar Respuesta'))

    const textarea = document.querySelector('textarea[placeholder="Escribe tu respuesta..."]')
    fireEvent.change(textarea, { target: { value: 'Mi respuesta' } })
    fireEvent.click(screen.getByText('Guardar Respuesta'))

    await waitFor(() => expect(requirementsAPI.addResponse).toHaveBeenCalledWith('r1', expect.objectContaining({ notes: 'Mi respuesta' })))
    expect(toast.success).toHaveBeenCalledWith('requirements.responseAdded')
  })

  test('agregar respuesta con error de API muestra toast error', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.addResponse.mockRejectedValue({ response: { data: { message: 'API error' } } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Agregar Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Agregar Respuesta'))

    const textarea = document.querySelector('textarea[placeholder="Escribe tu respuesta..."]')
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.click(screen.getByText('Guardar Respuesta'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('API error'))
  })

  test('enviar a AEAT llama a submitToAEAT y recarga', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', responses: [{ responseNumber: 1, notes: 'Resp1', submittedAt: new Date().toISOString() }] }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.submitToAEAT.mockResolvedValue({ data: { data: { message: 'Enviado OK' } } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Enviar a AEAT')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Enviar a AEAT'))

    await waitFor(() => expect(requirementsAPI.submitToAEAT).toHaveBeenCalledWith('r1', 0))
    expect(toast.success).toHaveBeenCalledWith('Enviado OK')
  })

  test('enviar a AEAT con error muestra toast error', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', responses: [{ responseNumber: 1, notes: 'Resp1', submittedAt: new Date().toISOString() }] }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.submitToAEAT.mockRejectedValue({ response: { data: { message: 'AEAT error' } } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Enviar a AEAT')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Enviar a AEAT'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('AEAT error'))
  })

  test('generar respuesta IA llama a generateAIResponse y popula el form', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.generateAIResponse.mockResolvedValue({ data: { data: { suggestedResponse: 'Respuesta generada por IA' } } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Generar con IA')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Generar con IA'))

    await waitFor(() => expect(requirementsAPI.generateAIResponse).toHaveBeenCalledWith('r1'))
    expect(toast.success).toHaveBeenCalledWith('requirements.aiResponseGenerated')
    expect(await screen.findByDisplayValue('Respuesta generada por IA')).toBeInTheDocument()
  })

  test('generar respuesta IA con error muestra toast error', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.generateAIResponse.mockRejectedValue(new Error('IA error'))

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Generar con IA')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Generar con IA'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('requirements.errorAiResponse'))
  })

  test('resolver requerimiento llama a resolve y recarga', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.resolve.mockResolvedValue({ data: { success: true } })

    render(<RequirementManager expeditionId="exp123" onRequirementChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Marcar Levante')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Marcar Levante'))

    await waitFor(() => expect(requirementsAPI.resolve).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'levante' })))
    expect(toast.success).toHaveBeenCalledWith('requirements.resolved')
  })

  test('resolver con error muestra toast error', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.resolve.mockRejectedValue(new Error('Resolve error'))

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Marcar Levante')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Marcar Levante'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al resolver requerimiento'))
  })

  test('mostrar items solicitados con provided y mandatory', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'pending',
        channel: 'orange',
        requirementType: 'documentary',
        requestedItems: [
          { description: 'Item 1', provided: true },
          { description: 'Item 2', provided: false, mandatory: true }
        ]
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    expect(await screen.findByText('Item 1')).toBeInTheDocument()
    expect(await screen.findByText('Item 2')).toBeInTheDocument()
  })

  test('mostrar respuesta con aeatSubmission.submitted true', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'pending',
        channel: 'orange',
        requirementType: 'documentary',
        responses: [
          {
            responseNumber: 1,
            notes: 'Resp',
            submittedAt: new Date().toISOString(),
            aeatSubmission: { submitted: true, confirmationNumber: 'CONF-123' }
          }
        ]
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    expect(await screen.findByText(/CONF-123/)).toBeInTheDocument()
  })

  test('mostrar inspección física canal rojo scheduled', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'pending',
        channel: 'red',
        requirementType: 'physical',
        physicalInspection: {
          scheduled: true,
          scheduledDate: new Date(2026, 7, 10).toISOString(),
          scheduledTime: '10:00',
          location: { name: 'Puerto Barcelona' },
          completed: true,
          result: 'Favorable'
        }
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    expect(await screen.findByText(/Puerto Barcelona/)).toBeInTheDocument()
    expect(await screen.findByText(/Favorable/)).toBeInTheDocument()
  })

  test('mostrar inspección física canal rojo no scheduled', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'pending',
        channel: 'red',
        requirementType: 'physical',
        physicalInspection: { scheduled: false }
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    expect(await screen.findByText('Pendiente de programar')).toBeInTheDocument()
  })

  test('mostrar resolución cuando existe', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'resolved',
        channel: 'orange',
        requirementType: 'documentary',
        resolution: {
          status: 'levante',
          date: new Date(2026, 7, 5).toISOString(),
          notes: 'Resuelto satisfactoriamente'
        }
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    expect(await screen.findByText(/Resuelto satisfactoriamente/)).toBeInTheDocument()
  })

  test('abrir AI panel al hacer clic en Analisis IA Completo', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Analisis IA Completo')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    expect(await screen.findByText('Analisis IA - Requerimiento')).toBeInTheDocument()
  })

  test('cerrar AI panel con botón X', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Analisis IA Completo')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    const closeBtn = document.querySelector('[aria-label="close"], .hover\\:bg-white\\/20')
    fireEvent.click(closeBtn)

    await waitFor(() => expect(screen.queryByText('Analisis IA - Requerimiento')).not.toBeInTheDocument())
  })

  test('AI panel tab analyze: ejecutar y mostrar resultado', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiAnalyzeDocuments.mockResolvedValue({
      data: {
        success: true,
        data: {
          isComplete: false,
          summary: 'Falta factura',
          missingDocuments: [{ name: 'Factura comercial' }],
          issues: [{ document: 'Certificado', problem: 'Expirado' }],
          recommendations: ['Solicitar factura actualizada']
        }
      }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Analisis IA Completo')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(requirementsAPI.aiAnalyzeDocuments).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('Documentacion Incompleta')).toBeInTheDocument()
    expect(await screen.findByText('Documentos Faltantes')).toBeInTheDocument()
    expect(await screen.findByText(/Factura comercial/)).toBeInTheDocument()
    expect(await screen.findByText('Problemas Detectados')).toBeInTheDocument()
    expect(await screen.findByText(/Expirado/)).toBeInTheDocument()
    expect(await screen.findByText('Recomendaciones')).toBeInTheDocument()
  })

  test('AI panel tab analyze: isComplete true', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiAnalyzeDocuments.mockResolvedValue({
      data: { success: true, data: { isComplete: true, summary: 'Todo OK' } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Documentacion Completa')).toBeInTheDocument())
  })

  test('AI panel tab arguments: ejecutar y mostrar argumentos legales y técnicos', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiSuggestArguments.mockResolvedValue({
      data: {
        success: true,
        data: {
          legalArguments: [{ title: 'Arg legal 1', basis: 'Base legal', reference: 'Art 123' }],
          technicalArguments: [{ title: 'Arg técnico 1', evidence: 'Evidencia técnica' }],
          precedents: [{ reference: 'Caso 1', summary: 'Resumen del caso' }],
          strategy: 'Estrategia sugerida'
        }
      }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    await waitFor(() => expect(screen.getByText('Sugerir Argumentos')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Sugerir Argumentos'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(requirementsAPI.aiSuggestArguments).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('Argumentos Legales')).toBeInTheDocument()
    expect(await screen.findByText('Arg legal 1')).toBeInTheDocument()
    expect(await screen.findByText(/Base:/)).toBeInTheDocument()
    expect(await screen.findByText(/Ref:/)).toBeInTheDocument()
    expect(await screen.findByText('Argumentos Tecnicos')).toBeInTheDocument()
    expect(await screen.findByText('Arg técnico 1')).toBeInTheDocument()
    expect(await screen.findByText(/Evidencia:/)).toBeInTheDocument()
    expect(await screen.findByText('Precedentes Relevantes')).toBeInTheDocument()
    expect(await screen.findByText('Estrategia Sugerida')).toBeInTheDocument()
  })

  test('AI panel tab risk: ejecutar y mostrar análisis de riesgo alto', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiAnalyzeRisk.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'high',
          probability: 0.75,
          summary: 'Riesgo elevado',
          potentialOutcomes: [
            { result: 'Rechazo', likelihood: 'high', probability: 0.6 }
          ],
          mitigationSteps: ['Paso 1', 'Paso 2']
        }
      }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    await waitFor(() => expect(screen.getByText('Analizar Riesgo')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Analizar Riesgo'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(requirementsAPI.aiAnalyzeRisk).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('Riesgo Alto')).toBeInTheDocument()
    expect(await screen.findByText(/75% probabilidad resolucion negativa/)).toBeInTheDocument()
    expect(await screen.findByText('Posibles Resultados')).toBeInTheDocument()
    expect(await screen.findByText('Pasos de Mitigacion')).toBeInTheDocument()
  })

  test('AI panel tab risk: niveles medio y bajo', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })

    // Primero medio
    requirementsAPI.aiAnalyzeRisk.mockResolvedValue({
      data: { success: true, data: { riskLevel: 'medium', probability: 0.4, summary: 'Medio' } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    fireEvent.click(screen.getByText('Analizar Riesgo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Riesgo Medio')).toBeInTheDocument())
  })

  test('AI panel tab draft: ejecutar y mostrar respuesta sugerida', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiDraftResponse.mockResolvedValue({
      data: {
        success: true,
        data: {
          draftResponse: 'Respuesta completa sugerida',
          keyPoints: ['Punto 1', 'Punto 2'],
          suggestedAttachments: ['Doc1', 'Doc2']
        }
      }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    await waitFor(() => expect(screen.getByText('Redactar Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Redactar Respuesta'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(requirementsAPI.aiDraftResponse).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('Respuesta Sugerida')).toBeInTheDocument()
    expect(await screen.findByText('Respuesta completa sugerida')).toBeInTheDocument()
    expect(await screen.findByText('Puntos Clave')).toBeInTheDocument()
    expect(await screen.findByText('Documentos a Adjuntar')).toBeInTheDocument()
  })

  test('AI panel tab draft: usar respuesta llena el form y cierra panel', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiDraftResponse.mockResolvedValue({
      data: { success: true, data: { draftResponse: 'Texto sugerido' } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    fireEvent.click(screen.getByText('Redactar Respuesta'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Usar Esta Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Usar Esta Respuesta'))

    await waitFor(() => expect(screen.queryByText('Analisis IA - Requerimiento')).not.toBeInTheDocument())
    expect(screen.getByDisplayValue('Texto sugerido')).toBeInTheDocument()
  })

  test('AI panel tab full: ejecutar y mostrar análisis completo', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          overallScore: 85,
          summary: 'Análisis completo LUCI',
          documentAnalysis: { isComplete: true },
          riskAssessment: { level: 'low' },
          recommendedResponse: 'Respuesta recomendada',
          actionItems: [
            { action: 'Acción 1', priority: 'high' },
            { action: 'Acción 2', priority: 'medium' }
          ]
        }
      }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    await waitFor(() => expect(screen.getByText('Analisis Completo')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Analisis Completo'))

    await waitFor(() => expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(requirementsAPI.aiFullAnalysis).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('Analisis Integral LUCI')).toBeInTheDocument()
    expect(await screen.findByText('85/100')).toBeInTheDocument()
    expect(await screen.findByText('Analisis Documental')).toBeInTheDocument()
    expect(await screen.findByText('Evaluacion de Riesgo')).toBeInTheDocument()
    expect(await screen.findByText('Respuesta Recomendada')).toBeInTheDocument()
    expect(await screen.findByText('Acciones Recomendadas')).toBeInTheDocument()
  })

  test('AI panel tab full: overallScore bajo muestra rojo', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiFullAnalysis.mockResolvedValue({
      data: { success: true, data: { overallScore: 50 } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('50/100')).toBeInTheDocument())
  })

  test('AI panel: manejo de error en cualquier análisis', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiAnalyzeDocuments.mockRejectedValue({ response: { data: { error: 'API down' } } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/API down/)).toBeInTheDocument())
  })

  test('AI panel: cerrar error con botón Cerrar', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiAnalyzeDocuments.mockRejectedValue({ response: { data: { error: 'Test error' } } })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText(/Test error/)).toBeInTheDocument())

    const closeErrorBtn = screen.getByText(/Test error/).closest('div').querySelector('button')
    fireEvent.click(closeErrorBtn)

    await waitFor(() => expect(screen.queryByText(/Test error/)).not.toBeInTheDocument())
  })

  test('AI panel: actualizar análisis existente', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiAnalyzeDocuments.mockResolvedValue({
      data: { success: true, data: { isComplete: true } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Documentacion Completa')).toBeInTheDocument())

    expect(screen.getByText('Actualizar Analisis')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Actualizar Analisis'))

    await waitFor(() => expect(requirementsAPI.aiAnalyzeDocuments).toHaveBeenCalledTimes(2))
  })

  test('onRequirementChange se llama al crear y resolver', async () => {
    const onChange = vi.fn()
    requirementsAPI.create.mockResolvedValue({ data: { _id: 'new' } })

    render(<RequirementManager expeditionId="exp123" onRequirementChange={onChange} />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())

    fireEvent.click(screen.getByText('requirements.newRequirement'))
    fireEvent.change(screen.getByPlaceholderText('Ej: Solicitud de factura comercial'), { target: { value: 'Subj' } })
    fireEvent.change(screen.getByPlaceholderText('Detalle del requerimiento...'), { target: { value: 'Desc' } })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })

  test('sin expeditionId no carga requerimientos', () => {
    render(<RequirementManager />)
    expect(requirementsAPI.getByExpedition).not.toHaveBeenCalled()
  })

  test('status config para todos los estados', async () => {
    const statuses = ['pending', 'in_progress', 'awaiting_client', 'response_ready', 'submitted', 'under_review', 'resolved', 'rejected', 'closed']

    for (const status of statuses) {
      const mockReqs = [
        { _id: `r-${status}`, requirementNumber: `REQ-${status}`, subject: 'Test', status, channel: 'orange', requirementType: 'documentary' }
      ]
      requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
      const { unmount } = render(<RequirementManager expeditionId="exp123" />)
      await waitFor(() => expect(screen.getByText(`REQ-${status}`)).toBeInTheDocument())
      unmount()
    }
  })

  test('channel config para todos los canales', async () => {
    const channels = ['green', 'yellow', 'orange', 'red']

    for (const channel of channels) {
      const mockReqs = [
        { _id: `r-${channel}`, requirementNumber: `REQ-${channel}`, subject: 'Test', status: 'pending', channel, requirementType: 'documentary' }
      ]
      requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
      const { unmount } = render(<RequirementManager expeditionId="exp123" />)
      await waitFor(() => expect(screen.getByText(`REQ-${channel}`)).toBeInTheDocument())
      unmount()
    }
  })

  test('type labels para todos los tipos', async () => {
    const types = ['documentary', 'physical', 'valuation', 'classification', 'origin', 'license', 'certificate', 'paraduanero', 'other']

    for (const type of types) {
      const mockReqs = [
        { _id: `r-${type}`, requirementNumber: `REQ-${type}`, subject: 'Test', status: 'pending', channel: 'orange', requirementType: type }
      ]
      requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
      const { unmount } = render(<RequirementManager expeditionId="exp123" />)
      await waitFor(() => expect(screen.getByText(`REQ-${type}`)).toBeInTheDocument())
      fireEvent.click(screen.getByText(`REQ-${type}`))
      await waitFor(() => expect(screen.getByText(/Descripcion/)).toBeInTheDocument())
      unmount()
    }
  })

  test('cancelar formulario de nueva respuesta', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Agregar Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Agregar Respuesta'))

    expect(screen.getByText('Cancelar')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancelar'))

    await waitFor(() => expect(screen.queryByPlaceholderText('Escribe tu respuesta...')).not.toBeInTheDocument())
  })

  test('requerimiento resuelto o cerrado no muestra acciones', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'resolved', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.queryByText('Agregar Respuesta')).not.toBeInTheDocument())
  })

  test('respuesta ya enviada a AEAT no muestra botón enviar', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'submitted',
        channel: 'orange',
        requirementType: 'documentary',
        responses: [
          {
            responseNumber: 1,
            notes: 'Resp',
            submittedAt: new Date().toISOString(),
            aeatSubmission: { submitted: true, confirmationNumber: 'CONF-123' }
          }
        ]
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText(/CONF-123/)).toBeInTheDocument())
    expect(screen.queryByText('Enviar a AEAT')).not.toBeInTheDocument()
  })

  test('AI panel loading state muestra spinner', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })

    let resolveAnalyze
    requirementsAPI.aiAnalyzeDocuments.mockReturnValue(new Promise(resolve => { resolveAnalyze = resolve }))

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Analizando con IA...')).toBeInTheDocument())

    resolveAnalyze({ data: { success: true, data: { isComplete: true } } })
    await waitFor(() => expect(screen.getByText('Documentacion Completa')).toBeInTheDocument())
  })

  test('AI panel cerrar con botón footer', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))

    const footerCloseBtn = screen.getAllByText('Cerrar').find(btn => btn.closest('.border-t'))
    fireEvent.click(footerCloseBtn)

    await waitFor(() => expect(screen.queryByText('Analisis IA - Requerimiento')).not.toBeInTheDocument())
  })

  test('cancelar formulario de nuevo requerimiento', async () => {
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())

    fireEvent.click(screen.getByText('requirements.newRequirement'))
    expect(screen.getAllByText('requirements.createRequirement')[0]).toBeInTheDocument()

    fireEvent.click(screen.getByText('common.cancel'))

    await waitFor(() => expect(screen.queryByText('requirements.createRequirement')).not.toBeInTheDocument())
  })

  test('border color rojo para requerimiento vencido', async () => {
    const expired = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', deadline: expired }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())

    const reqCard = screen.getByText('REQ-001').closest('.border-red-300')
    expect(reqCard).toBeInTheDocument()
  })

  test('border color naranja para requerimiento próximo a vencer', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', deadline: soon }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())

    const reqCard = screen.getByText('REQ-001').closest('.border-orange-300')
    expect(reqCard).toBeInTheDocument()
  })

  test('icon de alerta para requerimiento próximo a vencer', async () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary', deadline: soon }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())

    const alertIcon = document.querySelector('.text-orange-500')
    expect(alertIcon).toBeInTheDocument()
  })

  test('count de respuestas se muestra correctamente', async () => {
    const mockReqs = [
      {
        _id: 'r1',
        requirementNumber: 'REQ-001',
        subject: 'Test',
        status: 'pending',
        channel: 'orange',
        requirementType: 'documentary',
        responses: [
          { responseNumber: 1, notes: 'R1', submittedAt: new Date().toISOString() },
          { responseNumber: 2, notes: 'R2', submittedAt: new Date().toISOString() }
        ]
      }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    expect(screen.getByText(/2 respuesta\(s\)/)).toBeInTheDocument()
  })

  test('cambiar tipo de requerimiento en formulario de creación', async () => {
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())

    fireEvent.click(screen.getByText('requirements.newRequirement'))

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'physical' } })

    expect(typeSelect.value).toBe('physical')
  })

  test('cambiar canal en formulario de creación', async () => {
    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('requirements.title')).toBeInTheDocument())

    fireEvent.click(screen.getByText('requirements.newRequirement'))

    const channelSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(channelSelect, { target: { value: 'red' } })

    expect(channelSelect.value).toBe('red')
  })

  test('cambiar tipo de respuesta en formulario de respuesta', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    render(<RequirementManager expeditionId="exp123" />)

    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))

    await waitFor(() => expect(screen.getByText('Agregar Respuesta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Agregar Respuesta'))

    const typeSelect = screen.getByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'clarification' } })

    expect(typeSelect.value).toBe('clarification')
  })

  test('AI panel tab full con riskAssessment medium', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiFullAnalysis.mockResolvedValue({
      data: { success: true, data: { overallScore: 70, riskAssessment: { level: 'medium' } } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Riesgo: Medio')).toBeInTheDocument())
  })

  test('AI panel tab full: usar respuesta recomendada', async () => {
    const mockReqs = [
      { _id: 'r1', requirementNumber: 'REQ-001', subject: 'Test', status: 'pending', channel: 'orange', requirementType: 'documentary' }
    ]
    requirementsAPI.getByExpedition.mockResolvedValue({ data: { data: mockReqs } })
    requirementsAPI.aiFullAnalysis.mockResolvedValue({
      data: { success: true, data: { overallScore: 75, recommendedResponse: 'Recomendada' } }
    })

    render(<RequirementManager expeditionId="exp123" />)
    await waitFor(() => expect(screen.getByText('REQ-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('REQ-001'))
    fireEvent.click(screen.getByText('Analisis IA Completo'))
    fireEvent.click(screen.getByText('Analisis Completo'))
    fireEvent.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => expect(screen.getByText('Respuesta Recomendada')).toBeInTheDocument())

    const useBtn = screen.getAllByText('Usar Esta Respuesta').find(btn => btn.closest('.bg-indigo-600'))
    fireEvent.click(useBtn)

    await waitFor(() => expect(screen.queryByText('Analisis IA - Requerimiento')).not.toBeInTheDocument())
    expect(screen.getByDisplayValue('Recomendada')).toBeInTheDocument()
  })
})
