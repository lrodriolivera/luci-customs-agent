import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import toast from 'react-hot-toast'
import { aeatRealAPI } from '../../services/api'
import AEATStatusMonitor from './AEATStatusMonitor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../services/api', () => ({
  aeatRealAPI: {
    getServiceStatus: vi.fn(),
    monitoring: {
      getTracked: vi.fn(),
      getAlerts: vi.fn(),
      refresh: vi.fn(),
      acknowledgeAlert: vi.fn(),
      predictChannel: vi.fn()
    }
  }
}))

describe('AEATStatusMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra spinner de carga inicial', async () => {
    aeatRealAPI.monitoring.getTracked.mockReturnValue(new Promise(() => {}))
    aeatRealAPI.monitoring.getAlerts.mockReturnValue(new Promise(() => {}))
    aeatRealAPI.getServiceStatus.mockReturnValue(new Promise(() => {}))

    render(<AEATStatusMonitor />)

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.getByText('Monitor de Estado AEAT')).toBeInTheDocument()
  })

  it('carga datos exitosamente con declaraciones, alertas y serviceStatus completo', async () => {
    const mockDeclarations = [
      {
        mrn: '26ES123456789012345',
        declarationType: 'H7',
        status: 'accepted',
        channel: 'green',
        lastChecked: new Date('2026-08-06T10:00:00Z').toISOString(),
        certificateAlias: 'cert1',
        luciAnalysis: {
          summary: 'Declaración procesada correctamente',
          recommendations: ['Validar documentos', 'Revisar aranceles']
        },
        history: [
          { timestamp: '2026-08-06T09:00:00Z', description: 'Enviada a AEAT' },
          { timestamp: '2026-08-06T09:30:00Z', description: 'Aceptada' }
        ]
      },
      {
        mrn: '26ES987654321098765',
        declarationType: 'H1',
        status: 'submitted',
        channel: 'orange',
        addedAt: new Date('2026-08-06T08:00:00Z').toISOString(),
        certificateAlias: 'cert2'
      }
    ]
    const mockAlerts = [
      { id: 'alert1', severity: 'critical', mrn: '26ES123456789012345', message: 'Error crítico' },
      { id: 'alert2', severity: 'high', mrn: '26ES987654321098765', message: 'Advertencia importante' }
    ]
    const mockServiceStatus = {
      status: {
        environment: 'production',
        certificatesLoaded: 5,
        activeMonitoring: 10,
        activeAlerts: 2
      },
      luciAnalysis: {
        summary: 'Todos los sistemas operativos'
      }
    }

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: mockAlerts } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: mockServiceStatus } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getAllByText('26ES123456789012345').length).toBeGreaterThan(0)
    expect(screen.getAllByText('26ES987654321098765').length).toBeGreaterThan(0)
    expect(screen.getByText('H7')).toBeInTheDocument()
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('Aceptada')).toBeInTheDocument()
    expect(screen.getByText('Enviada')).toBeInTheDocument()
    expect(screen.getByText('Verde (Levante)')).toBeInTheDocument()
    expect(screen.getByText('Naranja (Documental)')).toBeInTheDocument()
    expect(screen.getByText(/producción/i)).toBeInTheDocument()
    expect(screen.getByText(/5.*certificados.*10.*monitorizando/i)).toBeInTheDocument()
    expect(screen.getByText('2 alertas activas')).toBeInTheDocument()
    expect(screen.getByText('Todos los sistemas operativos')).toBeInTheDocument()
    expect(screen.getByText('Alertas Activas')).toBeInTheDocument()
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('Error crítico')).toBeInTheDocument()
    expect(screen.getByText('Advertencia importante')).toBeInTheDocument()
  })

  it('muestra mensaje de sin declaraciones cuando la lista está vacía', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    expect(screen.getByText('Las declaraciones enviadas a AEAT aparecerán aquí')).toBeInTheDocument()
    expect(screen.queryByText('Alertas Activas')).not.toBeInTheDocument()
  })

  it('maneja error en loadData y muestra toast error', async () => {
    aeatRealAPI.monitoring.getTracked.mockRejectedValue(new Error('Network error'))
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al cargar datos de monitoreo')
    })

    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
  })

  it('maneja respuestas con success: false sin setear estados', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: false } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: false } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: false } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    expect(screen.queryByText('Alertas Activas')).not.toBeInTheDocument()
    expect(screen.queryByText('Producción')).not.toBeInTheDocument()
  })

  it('muestra serviceStatus en modo sandbox', async () => {
    const mockServiceStatus = {
      status: {
        environment: 'sandbox',
        certificatesLoaded: 2,
        activeMonitoring: 3,
        activeAlerts: 0
      }
    }

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: mockServiceStatus } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText(/sandbox/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/2.*certificados.*3.*monitorizando/i)).toBeInTheDocument()
    expect(screen.queryByText('alertas activas')).not.toBeInTheDocument()
  })

  it('muestra todos los canales y estados posibles', async () => {
    const mockDeclarations = [
      { mrn: 'MRN1', declarationType: 'H7', status: 'pending', channel: null, lastChecked: null, addedAt: null, certificateAlias: 'c1' },
      { mrn: 'MRN2', declarationType: 'H1', status: 'submitted', channel: 'green', lastChecked: 0, certificateAlias: 'c2' },
      { mrn: 'MRN3', declarationType: 'AES', status: 'accepted', channel: 'orange', lastChecked: new Date().toISOString(), certificateAlias: 'c3' },
      { mrn: 'MRN4', declarationType: 'ENS', status: 'rejected', channel: 'red', lastChecked: new Date('2026-08-01T00:00:00Z').toISOString(), certificateAlias: 'c4' },
      { mrn: 'MRN5', declarationType: 'NCTS', status: 'released', channel: 'yellow', addedAt: new Date('2026-07-01T00:00:00Z').toISOString(), certificateAlias: 'c5' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('MRN1')).toBeInTheDocument()
    })

    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Enviada')).toBeInTheDocument()
    expect(screen.getByText('Aceptada')).toBeInTheDocument()
    expect(screen.getByText('Rechazada')).toBeInTheDocument()
    expect(screen.getByText('Levantada')).toBeInTheDocument()
    expect(screen.getByText('Verde (Levante)')).toBeInTheDocument()
    expect(screen.getByText('Naranja (Documental)')).toBeInTheDocument()
    expect(screen.getByText('Rojo (Físico)')).toBeInTheDocument()
    expect(screen.getByText('Amarillo (Certificados)')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('muestra todas las severidades de alerta', async () => {
    const mockAlerts = [
      { id: 'a1', severity: 'critical', mrn: 'M1', message: 'Crítica' },
      { id: 'a2', severity: 'high', mrn: 'M2', message: 'Alta' },
      { id: 'a3', severity: 'medium', mrn: 'M3', message: 'Media' },
      { id: 'a4', severity: 'low', mrn: 'M4', message: 'Baja' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: mockAlerts } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    })

    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
    expect(screen.getByText('LOW')).toBeInTheDocument()
    expect(screen.getByText('Crítica')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('Baja')).toBeInTheDocument()
  })

  it('handleRefreshStatus éxito actualiza estado y llama loadData', async () => {
    const mockDeclarations = [
      { mrn: '26ES111', declarationType: 'H7', status: 'submitted', channel: null, lastChecked: new Date().toISOString(), certificateAlias: 'cert1' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })
    aeatRealAPI.monitoring.refresh.mockResolvedValue({ data: { success: true } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('26ES111')).toBeInTheDocument()
    })

    const refreshButtons = screen.getAllByTitle('Actualizar')
    expect(refreshButtons.length).toBeGreaterThan(0)

    fireEvent.click(refreshButtons[0])

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.refresh).toHaveBeenCalledWith('26ES111', 'cert1')
    })

    expect(toast.success).toHaveBeenCalledWith('Estado actualizado')
    expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(2)
  })

  it('handleRefreshStatus error muestra toast error', async () => {
    const mockDeclarations = [
      { mrn: '26ES222', declarationType: 'H7', status: 'submitted', channel: null, lastChecked: new Date().toISOString(), certificateAlias: 'cert2' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })
    aeatRealAPI.monitoring.refresh.mockRejectedValue(new Error('Refresh failed'))

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('26ES222')).toBeInTheDocument()
    })

    const refreshButtons = screen.getAllByTitle('Actualizar')
    fireEvent.click(refreshButtons[0])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar estado')
    })
  })

  it('handleAcknowledgeAlert éxito confirma alerta y recarga datos', async () => {
    const mockAlerts = [
      { id: 'alert123', severity: 'high', mrn: 'M123', message: 'Alerta de prueba' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: mockAlerts } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })
    aeatRealAPI.monitoring.acknowledgeAlert.mockResolvedValue({})

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Alerta de prueba')).toBeInTheDocument()
    })

    const confirmButton = screen.getByText('Confirmar')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.acknowledgeAlert).toHaveBeenCalledWith('alert123')
    })

    expect(toast.success).toHaveBeenCalledWith('Alerta confirmada')
    expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(2)
  })

  it('handleAcknowledgeAlert error muestra toast error', async () => {
    const mockAlerts = [
      { id: 'alert456', severity: 'critical', mrn: 'M456', message: 'Error al confirmar' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: mockAlerts } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })
    aeatRealAPI.monitoring.acknowledgeAlert.mockRejectedValue(new Error('Acknowledge failed'))

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Error al confirmar')).toBeInTheDocument()
    })

    const confirmButton = screen.getByText('Confirmar')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al confirmar alerta')
    })
  })

  it('abre modal de detalles de declaración con luciAnalysis y history', async () => {
    const mockDeclarations = [
      {
        mrn: '26ES999',
        declarationType: 'H7',
        status: 'accepted',
        channel: 'green',
        lastChecked: new Date('2026-08-06T12:00:00Z').toISOString(),
        certificateAlias: 'cert9',
        luciAnalysis: {
          summary: 'Análisis completo de LUCI',
          recommendations: ['Rec 1', 'Rec 2', 'Rec 3']
        },
        history: [
          { timestamp: '2026-08-06T11:00:00Z', description: 'Evento 1' },
          { timestamp: '2026-08-06T11:30:00Z', description: 'Evento 2' }
        ]
      }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('26ES999')).toBeInTheDocument()
    })

    const detailsButton = screen.getByTitle('Ver detalles')
    fireEvent.click(detailsButton)

    await waitFor(() => {
      expect(screen.getByText('Detalles: 26ES999')).toBeInTheDocument()
    })

    expect(screen.getByText('Análisis completo de LUCI')).toBeInTheDocument()
    expect(screen.getByText('Rec 1')).toBeInTheDocument()
    expect(screen.getByText('Rec 2')).toBeInTheDocument()
    expect(screen.getByText('Rec 3')).toBeInTheDocument()
    expect(screen.getByText('Historial')).toBeInTheDocument()
    expect(screen.getByText('Evento 1')).toBeInTheDocument()
    expect(screen.getByText('Evento 2')).toBeInTheDocument()
  })

  it('cierra modal de detalles al clickear botón X', async () => {
    const mockDeclarations = [
      { mrn: '26ES888', declarationType: 'H7', status: 'accepted', channel: 'green', lastChecked: new Date().toISOString(), certificateAlias: 'cert8' }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('26ES888')).toBeInTheDocument()
    })

    const detailsButton = screen.getByTitle('Ver detalles')
    fireEvent.click(detailsButton)

    await waitFor(() => {
      expect(screen.getByText('Detalles: 26ES888')).toBeInTheDocument()
    })

    const closeButtons = screen.getAllByRole('button')
    const xButton = closeButtons.find(btn => btn.querySelector('svg[class*="h-6 w-6"]'))
    expect(xButton).toBeDefined()
    fireEvent.click(xButton)

    await waitFor(() => {
      expect(screen.queryByText('Detalles: 26ES888')).not.toBeInTheDocument()
    })
  })

  it('abre modal de predicción y muestra formulario', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    const predictionButton = screen.getByText('Predecir Canal')
    fireEvent.click(predictionButton)

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText(/CN, US, JP/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('8517120000')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('50000')).toBeInTheDocument()
    expect(screen.getByText(/tipo de operación/i)).toBeInTheDocument()
  })

  it('cierra modal de predicción al clickear botón X', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    const predictionButton = screen.getByText('Predecir Canal')
    fireEvent.click(predictionButton)

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    const closeButtons = screen.getAllByRole('button')
    const xButton = closeButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.classList.contains('h-6')
    })
    expect(xButton).toBeDefined()
    fireEvent.click(xButton)

    await waitFor(() => {
      expect(screen.queryByText('Predicción de Canal con LUCI')).not.toBeInTheDocument()
    })
  })

  it('handlePredictChannel éxito muestra resultado completo', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'orange',
      riskScore: 45,
      channelProbabilities: {
        green: 0.2,
        orange: 0.5,
        red: 0.2,
        yellow: 0.1
      },
      luciAnalysis: {
        summary: 'Control documental requerido',
        factors: ['Factor 1', 'Factor 2', 'Factor 3']
      }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    const originInput = screen.getByPlaceholderText(/CN, US, JP/i)
    const taricInput = screen.getByPlaceholderText('8517120000')
    const valueInput = screen.getByPlaceholderText('50000')
    const typeSelects = document.querySelectorAll('select')
    const typeSelect = typeSelects[0]

    fireEvent.change(originInput, { target: { value: 'cn' } })
    fireEvent.change(taricInput, { target: { value: '8517120000' } })
    fireEvent.change(valueInput, { target: { value: '50000' } })
    fireEvent.change(typeSelect, { target: { value: 'export' } })

    const submitButtons = screen.getAllByText('Predecir Canal')
    const submitButton = submitButtons[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.predictChannel).toHaveBeenCalledWith({
        operationData: {
          originCountry: 'CN',
          operationType: 'export',
          customsValue: 50000
        },
        goods: [{
          taricCode: '8517120000',
          customsValue: 50000
        }]
      })
    })

    expect(await screen.findByText('Resultado de Predicción')).toBeInTheDocument()
    expect(screen.getByText(/green:/i)).toBeInTheDocument()
    expect(screen.getByText(/orange:/i)).toBeInTheDocument()
    expect(screen.getByText(/red:/i)).toBeInTheDocument()
    expect(screen.getByText(/yellow:/i)).toBeInTheDocument()
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('10%').length).toBeGreaterThan(0)
    expect(screen.getByText('Canal más probable:')).toBeInTheDocument()
    expect(screen.getByText('Naranja (Documental)')).toBeInTheDocument()
    expect(screen.getByText('Puntuación de riesgo:')).toBeInTheDocument()
    expect(screen.getByText('45/100')).toBeInTheDocument()
    expect(screen.getByText('Control documental requerido')).toBeInTheDocument()
    expect(screen.getByText('• Factor 1')).toBeInTheDocument()
    expect(screen.getByText('• Factor 2')).toBeInTheDocument()
    expect(screen.getByText('• Factor 3')).toBeInTheDocument()
  })

  it('handlePredictChannel error muestra toast error', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })
    aeatRealAPI.monitoring.predictChannel.mockRejectedValue(new Error('Prediction failed'))

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'us' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '1234567890' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '10000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al predecir canal')
    })
  })

  it('maneja predictionResult con riskScore bajo (verde)', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'green',
      riskScore: 15,
      channelProbabilities: { green: 0.9, orange: 0.05, red: 0.03, yellow: 0.02 },
      luciAnalysis: { summary: 'Bajo riesgo' }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'es' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '1111111111' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '1000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('15/100')).toBeInTheDocument()
    })

    const riskScoreElement = screen.getByText('15/100')
    expect(riskScoreElement.className).toContain('text-green-600')
  })

  it('maneja predictionResult con riskScore medio (amarillo)', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'yellow',
      riskScore: 35,
      channelProbabilities: { green: 0.3, orange: 0.3, red: 0.1, yellow: 0.3 }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'fr' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '2222222222' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '5000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('35/100')).toBeInTheDocument()
    })

    const riskScoreElement = screen.getByText('35/100')
    expect(riskScoreElement.className).toContain('text-yellow-600')
  })

  it('maneja predictionResult con riskScore alto (rojo)', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'red',
      riskScore: 85,
      channelProbabilities: { green: 0.05, orange: 0.1, red: 0.8, yellow: 0.05 }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'cn' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '3333333333' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '100000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('85/100')).toBeInTheDocument()
    })

    const riskScoreElement = screen.getByText('85/100')
    expect(riskScoreElement.className).toContain('text-red-600')
  })

  it('botón Actualizar manual recarga datos', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(1)

    const updateButton = screen.getByText('Actualizar')
    fireEvent.click(updateButton)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(2)
    })
  })

  it('recarga datos automáticamente cada 60 segundos', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60000)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(2)
    })

    vi.advanceTimersByTime(60000)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(3)
    })
  })

  it('limpia el intervalo al desmontar', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const { unmount } = render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(1)

    unmount()

    vi.advanceTimersByTime(120000)

    expect(aeatRealAPI.monitoring.getTracked).toHaveBeenCalledTimes(1)
  })

  it('upperCase transforma originCountry en el formulario de predicción', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'green',
      riskScore: 10,
      channelProbabilities: { green: 0.9, orange: 0.05, red: 0.03, yellow: 0.02 }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    const originInput = screen.getByPlaceholderText(/CN, US, JP/i)
    fireEvent.change(originInput, { target: { value: 'mx' } })

    expect(originInput.value).toBe('MX')

    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '1234' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '2000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.predictChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          operationData: expect.objectContaining({
            originCountry: 'MX'
          })
        })
      )
    })
  })

  it('maneja customsValue vacío como 0 en handlePredictChannel', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'green',
      riskScore: 5,
      channelProbabilities: { green: 0.95, orange: 0.03, red: 0.01, yellow: 0.01 }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    const originInput = screen.getByPlaceholderText(/CN, US, JP/i)
    const taricInput = screen.getByPlaceholderText('8517120000')
    const valueInput = screen.getByPlaceholderText('50000')

    fireEvent.change(originInput, { target: { value: 'de' } })
    fireEvent.change(taricInput, { target: { value: '9999' } })
    fireEvent.change(valueInput, { target: { value: '' } })
    valueInput.removeAttribute('required')

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.predictChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          operationData: expect.objectContaining({
            customsValue: 0
          }),
          goods: expect.arrayContaining([
            expect.objectContaining({
              customsValue: 0
            })
          ])
        })
      )
    })
  })

  it('maneja predictionResult sin luciAnalysis.factors', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'orange',
      riskScore: 40,
      channelProbabilities: { green: 0.3, orange: 0.4, red: 0.2, yellow: 0.1 },
      luciAnalysis: { summary: 'Sin factores' }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'it' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '7777' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '3000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Sin factores')).toBeInTheDocument()
    })

    expect(screen.queryByText('• ')).not.toBeInTheDocument()
  })

  it('maneja declaración sin luciAnalysis.recommendations', async () => {
    const mockDeclarations = [
      {
        mrn: '26ES777',
        declarationType: 'H7',
        status: 'accepted',
        channel: 'green',
        lastChecked: new Date().toISOString(),
        certificateAlias: 'cert7',
        luciAnalysis: { summary: 'Sin recomendaciones' }
      }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('26ES777')).toBeInTheDocument()
    })

    const detailsButton = screen.getByTitle('Ver detalles')
    fireEvent.click(detailsButton)

    await waitFor(() => {
      expect(screen.getByText('Sin recomendaciones')).toBeInTheDocument()
    })

    const lis = screen.queryAllByRole('listitem')
    expect(lis.length).toBe(0)
  })

  it('maneja declaración sin history', async () => {
    const mockDeclarations = [
      {
        mrn: '26ES666',
        declarationType: 'H7',
        status: 'pending',
        channel: null,
        lastChecked: null,
        certificateAlias: 'cert6'
      }
    ]

    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: mockDeclarations } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('26ES666')).toBeInTheDocument()
    })

    const detailsButton = screen.getByTitle('Ver detalles')
    fireEvent.click(detailsButton)

    await waitFor(() => {
      expect(screen.getByText('Detalles: 26ES666')).toBeInTheDocument()
    })

    expect(screen.queryByText('Historial')).not.toBeInTheDocument()
  })

  it('muestra estado de predicting mientras se ejecuta handlePredictChannel', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    let resolvePrediction
    aeatRealAPI.monitoring.predictChannel.mockReturnValue(
      new Promise((resolve) => {
        resolvePrediction = resolve
      })
    )

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'gb' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '5555' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '8000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Analizando con LUCI...')).toBeInTheDocument()
    })

    resolvePrediction({
      data: {
        success: true,
        data: { predictedChannel: 'green', riskScore: 10, channelProbabilities: { green: 0.9, orange: 0.05, red: 0.03, yellow: 0.02 } }
      }
    })

    await waitFor(() => {
      expect(screen.queryByText('Analizando con LUCI...')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Resultado de Predicción')).toBeInTheDocument()
  })

  it('handlePredictChannel limpia predictionResult al inicio', async () => {
    aeatRealAPI.monitoring.getTracked.mockResolvedValue({ data: { success: true, data: { declarations: [] } } })
    aeatRealAPI.monitoring.getAlerts.mockResolvedValue({ data: { success: true, data: { alerts: [] } } })
    aeatRealAPI.getServiceStatus.mockResolvedValue({ data: { success: true, data: null } })

    const mockPrediction = {
      predictedChannel: 'green',
      riskScore: 10,
      channelProbabilities: { green: 0.9, orange: 0.05, red: 0.03, yellow: 0.02 }
    }

    aeatRealAPI.monitoring.predictChannel.mockResolvedValue({ data: { success: true, data: mockPrediction } })

    const user = userEvent.setup({ delay: null })
    render(<AEATStatusMonitor />)

    await waitFor(() => {
      expect(screen.getByText('Sin declaraciones monitorizadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Predecir Canal'))

    await waitFor(() => {
      expect(screen.getByText('Predicción de Canal con LUCI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'pt' } })
    fireEvent.change(screen.getByPlaceholderText('8517120000'), { target: { value: '4444' } })
    fireEvent.change(screen.getByPlaceholderText('50000'), { target: { value: '4000' } })

    const submitButton = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Resultado de Predicción')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/CN, US, JP/i), { target: { value: 'be' } })

    const submitButton2 = screen.getAllByText('Predecir Canal')[1]
    await user.click(submitButton2)

    await waitFor(() => {
      expect(aeatRealAPI.monitoring.predictChannel).toHaveBeenCalledTimes(2)
    })
  })
})
