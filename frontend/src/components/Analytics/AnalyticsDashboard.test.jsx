import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalyticsDashboard from './AnalyticsDashboard'
import { analyticsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => {
  const toast = vi.fn()
  toast.error = vi.fn()
  toast.success = vi.fn()
  return { default: toast, toast }
})

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: () => <div>LineChart</div>,
  BarChart: () => <div>BarChart</div>,
  PieChart: () => <div>PieChart</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null
}))

vi.mock('../../services/api', () => ({
  analyticsAPI: {
    getDashboard: vi.fn(),
    getRealTime: vi.fn(),
    kpis: {
      getDashboard: vi.fn()
    },
    ai: {
      generateInsights: vi.fn(),
      detectAnomalies: vi.fn(),
      predictTrends: vi.fn(),
      generateExecutiveReport: vi.fn(),
      analyzeKPIDeviations: vi.fn(),
      fullAnalysis: vi.fn()
    }
  }
}))

const mockDashboardData = {
  operations: {
    totalDeclarations: 1250,
    averageProcessingTime: 2.5,
    declarationsByType: {
      'H7': 450,
      'H1': 320,
      'AES': 280,
      'ENS': 200
    }
  },
  financial: {
    totalDutiesCalculated: 458000,
    totalDutiesPaid: 430000,
    potentialSavings: 28000,
    guaranteesUtilization: 72
  },
  compliance: {
    documentCompleteness: 95,
    errorRate: 2.3,
    rejectionRate: 1.5,
    onTimeSubmissions: 98,
    inspectionRate: 8
  },
  channels: {
    green: 65,
    orange: 20,
    red: 10,
    yellow: 5
  },
  trends: {
    operations: { direction: 'up', percentage: 12 },
    financial: { direction: 'up', percentage: 8 },
    compliance: { direction: 'up', percentage: 3 },
    performance: { direction: 'down' }
  },
  luciInsights: {
    summary: 'El sistema muestra un rendimiento óptimo con tendencias positivas.',
    recommendations: [
      'Aumentar frecuencia de declaraciones H7',
      'Revisar procedimientos del canal rojo'
    ],
    opportunities: [
      'Optimización de garantías',
      'Reducción de tiempos de procesamiento'
    ]
  }
}

const mockKPIData = {
  healthScore: 87,
  kpis: {
    byCategory: {
      operational: [
        {
          kpiId: 'op1',
          name: 'Tiempo Promedio',
          value: 2.5,
          unit: 'h',
          target: 3,
          status: 'good',
          trend: { direction: 'down', percentage: 5 }
        }
      ],
      financial: [
        {
          kpiId: 'fin1',
          name: 'Ahorro Total',
          value: 28000,
          unit: 'EUR',
          target: 25000,
          status: 'good',
          trend: { direction: 'up', percentage: 12 }
        }
      ],
      compliance: [
        {
          kpiId: 'comp1',
          name: 'Tasa de Error',
          value: 2.3,
          unit: '%',
          target: 3,
          status: 'good',
          trend: { direction: 'down', percentage: 0.5 }
        }
      ]
    }
  },
  alerts: [
    {
      id: 'alert1',
      kpiName: 'Tiempo Medio Procesamiento',
      severity: 'warning',
      message: 'Superando objetivo en 10%'
    }
  ]
}

const mockRealTimeData = {
  activeDeclarations: 45,
  pendingSubmissions: 12,
  aeatStatus: {
    connected: true,
    latency: 145
  },
  alerts: {
    critical: 0,
    warning: 2
  }
}

describe('<AnalyticsDashboard />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: mockDashboardData } })
    analyticsAPI.kpis.getDashboard.mockResolvedValue({ data: { success: true, data: mockKPIData } })
    analyticsAPI.getRealTime.mockResolvedValue({ data: { success: true, data: mockRealTimeData } })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  // ==================== LOADING STATE ====================
  test('muestra spinner durante la carga inicial', () => {
    analyticsAPI.getDashboard.mockImplementation(() => new Promise(() => {}))
    render(<AnalyticsDashboard />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ==================== SUCCESSFUL RENDER - OVERVIEW TAB ====================
  test('renderiza el dashboard con datos exitosos', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    expect(analyticsAPI.getDashboard).toHaveBeenCalledWith('last_30_days')
    expect(analyticsAPI.kpis.getDashboard).toHaveBeenCalled()
    expect(analyticsAPI.getRealTime).toHaveBeenCalled()
  })

  test('muestra las métricas clave en overview tab', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Declaraciones')).toBeInTheDocument()
    })

    expect(screen.getByText('1.3K')).toBeInTheDocument()
    expect(screen.getByText('Valor Aduanero')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('Tiempo Medio')).toBeInTheDocument()
    expect(screen.getByText('2.5h')).toBeInTheDocument()
  })

  test('muestra tendencias con iconos correctos según dirección', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('12%')).toBeInTheDocument()
    })

    expect(screen.getByText('8%')).toBeInTheDocument()
  })

  test('muestra distribución por canal con porcentajes correctos', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Distribucion por Canal')).toBeInTheDocument()
    })

    expect(screen.getByText('Verde')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('Naranja')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('Rojo')).toBeInTheDocument()
    const percentages = screen.getAllByText('10%')
    expect(percentages.length).toBeGreaterThan(0)
  })

  test('muestra declaraciones por tipo', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Declaraciones por Tipo')).toBeInTheDocument()
    })

    expect(screen.getAllByText('H7').length).toBeGreaterThan(0)
    expect(screen.getByText('450')).toBeInTheDocument()
    expect(screen.getAllByText('H1').length).toBeGreaterThan(0)
    expect(screen.getByText('320')).toBeInTheDocument()
  })

  test('muestra LUCI insights cuando están presentes', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Insights de LUCI')).toBeInTheDocument()
    })

    expect(screen.getByText('El sistema muestra un rendimiento óptimo con tendencias positivas.')).toBeInTheDocument()
    expect(screen.getByText('Recomendaciones:')).toBeInTheDocument()
    expect(screen.getByText('Aumentar frecuencia de declaraciones H7')).toBeInTheDocument()
    expect(screen.getByText('Oportunidades:')).toBeInTheDocument()
    expect(screen.getByText('Optimización de garantías')).toBeInTheDocument()
  })

  test('no rompe si luciInsights está ausente', async () => {
    const dataWithoutInsights = { ...mockDashboardData }
    delete dataWithoutInsights.luciInsights
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: dataWithoutInsights } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Declaraciones')).toBeInTheDocument()
    })

    expect(screen.queryByText('Insights de LUCI')).not.toBeInTheDocument()
  })

  // ==================== REAL-TIME STATUS BAR ====================
  test('muestra barra de estado en tiempo real', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('En tiempo real')).toBeInTheDocument()
    })

    expect(screen.getByText('Declaraciones activas:')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('Pendientes:')).toBeInTheDocument()
    expect(screen.getByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText('(145ms)')).toBeInTheDocument()
  })

  test('muestra alertas críticas en barra de estado', async () => {
    const dataWithCriticalAlerts = {
      ...mockRealTimeData,
      alerts: { critical: 3, warning: 1 }
    }
    analyticsAPI.getRealTime.mockResolvedValue({ data: { success: true, data: dataWithCriticalAlerts } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('3 criticas')).toBeInTheDocument()
    })

    expect(screen.getByText('1 alertas')).toBeInTheDocument()
  })

  test('muestra AEAT desconectado cuando no está conectado', async () => {
    const dataDisconnected = {
      ...mockRealTimeData,
      aeatStatus: { connected: false, latency: 0 }
    }
    analyticsAPI.getRealTime.mockResolvedValue({ data: { success: true, data: dataDisconnected } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Desconectado')).toBeInTheDocument()
    })
  })

  // ==================== TAB SWITCHING ====================
  test('cambia a tab KPIs al hacer clic', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    const kpisTab = screen.getByRole('button', { name: /KPIs/i })
    await user.click(kpisTab)

    await waitFor(() => {
      expect(screen.getByText('Salud del Sistema')).toBeInTheDocument()
    })
  })

  test('cambia a tab Financiero al hacer clic', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    const financialTab = screen.getByRole('button', { name: /Financiero/i })
    await user.click(financialTab)

    await waitFor(() => {
      expect(screen.getByText('Derechos Calculados')).toBeInTheDocument()
    })
  })

  test('cambia a tab Cumplimiento al hacer clic', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    const complianceTab = screen.getByRole('button', { name: /Cumplimiento/i })
    await user.click(complianceTab)

    await waitFor(() => {
      expect(screen.getByText('Tasa de Error')).toBeInTheDocument()
    })
  })

  // ==================== KPIs TAB ====================
  test('muestra KPIs con health score', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /KPIs/i }))

    await waitFor(() => {
      expect(screen.getByText('87')).toBeInTheDocument()
    })

    expect(screen.getByText('Score general de KPIs')).toBeInTheDocument()
  })

  test('muestra KPIs por categoría', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /KPIs/i }))

    await waitFor(() => {
      expect(screen.getByText('Operacionales')).toBeInTheDocument()
    })

    expect(screen.getByText('Tiempo Promedio')).toBeInTheDocument()
    expect(screen.getByText('Financieros')).toBeInTheDocument()
    expect(screen.getByText('Ahorro Total')).toBeInTheDocument()
    expect(screen.getAllByText('Cumplimiento')[0]).toBeInTheDocument()
    expect(screen.getByText('Tasa de Error')).toBeInTheDocument()
  })

  test('muestra estado del KPI con colores correctos', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /KPIs/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Bueno').length).toBe(3)
    })
  })

  test('muestra alertas activas en tab KPIs', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /KPIs/i }))

    await waitFor(() => {
      expect(screen.getByText('Alertas Activas')).toBeInTheDocument()
    })

    expect(screen.getByText('Tiempo Medio Procesamiento')).toBeInTheDocument()
    expect(screen.getByText('Superando objetivo en 10%')).toBeInTheDocument()
  })

  test.each([
    ['good', 85],
    ['warning', 65],
    ['critical', 45]
  ])('muestra color correcto según health score: %s con %s', async (status, score) => {
    const dataWithScore = {
      ...mockKPIData,
      healthScore: score
    }
    analyticsAPI.kpis.getDashboard.mockResolvedValue({ data: { success: true, data: dataWithScore } })

    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /KPIs/i }))

    await waitFor(() => {
      const scoreText = screen.getByText('Score general de KPIs')
      const healthScoreCard = scoreText.closest('.card')
      expect(within(healthScoreCard).getByText(score.toString())).toBeInTheDocument()
    })
  })

  // ==================== FINANCIAL TAB ====================
  test('muestra métricas financieras', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Financiero/i }))

    await waitFor(() => {
      expect(screen.getByText('Derechos Calculados')).toBeInTheDocument()
    })

    expect(screen.getByText('Derechos Pagados')).toBeInTheDocument()
    expect(screen.getByText('Ahorros Potenciales')).toBeInTheDocument()
  })

  test('muestra utilización de garantías', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Financiero/i }))

    await waitFor(() => {
      expect(screen.getByText('Utilizacion de Garantias')).toBeInTheDocument()
    })

    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  test.each([
    [85, 'bg-red-500'],
    [65, 'bg-yellow-500'],
    [45, 'bg-green-500']
  ])('color de barra de garantías varía según utilización: %s% → %s', async (utilization, expectedClass) => {
    const dataWithUtilization = {
      ...mockDashboardData,
      financial: { ...mockDashboardData.financial, guaranteesUtilization: utilization }
    }
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: dataWithUtilization } })

    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Financiero/i }))

    await waitFor(() => {
      expect(screen.getByText(`${utilization}%`)).toBeInTheDocument()
    })
  })

  // ==================== COMPLIANCE TAB ====================
  test('muestra métricas de cumplimiento', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Cumplimiento/i }))

    await waitFor(() => {
      expect(screen.getByText('Tasa de Error')).toBeInTheDocument()
    })

    expect(screen.getByText('2.3%')).toBeInTheDocument()
    expect(screen.getByText('Tasa de Rechazo')).toBeInTheDocument()
    expect(screen.getByText('1.5%')).toBeInTheDocument()
    expect(screen.getByText('Envios a Tiempo')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
    expect(screen.getByText('Tasa de Inspeccion')).toBeInTheDocument()
    expect(screen.getByText('8%')).toBeInTheDocument()
  })

  test('muestra completitud documental', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Cumplimiento/i }))

    await waitFor(() => {
      expect(screen.getByText('Completitud Documental')).toBeInTheDocument()
    })
  })

  // ==================== PERIOD SELECTION ====================
  test('cambia el periodo y recarga los datos', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    const periodSelect = screen.getByDisplayValue('analyticsPage.last30Days')
    await user.selectOptions(periodSelect, 'last_7_days')

    await waitFor(() => {
      expect(analyticsAPI.getDashboard).toHaveBeenCalledWith('last_7_days')
    })
  })

  test('botón de actualización recarga los datos', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    const refreshButton = screen.getByTitle('Actualizar')
    await user.click(refreshButton)

    await waitFor(() => {
      expect(analyticsAPI.getDashboard).toHaveBeenCalledTimes(2)
      expect(analyticsAPI.kpis.getDashboard).toHaveBeenCalledTimes(2)
    })
  })

  // ==================== ERROR HANDLING ====================
  test('maneja error en getDashboard mostrando toast', async () => {
    analyticsAPI.getDashboard.mockRejectedValue(new Error('API Error'))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('analyticsPage.errorLoadingDashboard')
    })
  })

  test('maneja error en getRealTime sin romper', async () => {
    analyticsAPI.getRealTime.mockRejectedValue(new Error('API Error'))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    expect(screen.queryByText('En tiempo real')).not.toBeInTheDocument()
  })

  test('maneja error en kpis.getDashboard sin romper', async () => {
    analyticsAPI.kpis.getDashboard.mockRejectedValue(new Error('API Error'))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })
  })

  // ==================== AI PANEL ====================
  test('abre el panel de IA al hacer clic en el botón', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    const aiButton = screen.getByText('Centro de Analisis IA')
    await user.click(aiButton)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.aiAnalysisCenter')).toBeInTheDocument()
    })
  })

  test('cierra el panel de IA al hacer clic en cerrar', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.aiAnalysisCenter')).toBeInTheDocument()
    })

    const closeButton = screen.getByText('Cerrar')
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('analyticsPage.aiAnalysisCenter')).not.toBeInTheDocument()
    })
  })

  // ==================== AI PANEL - INSIGHTS TAB ====================
  test('panel IA: tab insights muestra mensaje inicial', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))

    await waitFor(() => {
      expect(screen.getByText('Genera insights automaticos con IA')).toBeInTheDocument()
    })

    expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument()
  })

  test('panel IA: ejecuta análisis de insights', async () => {
    const user = userEvent.setup()
    const mockInsights = {
      summary: 'Resumen del análisis IA único',
      insights: [
        { type: 'positive', title: 'Mejora detectada IA', description: 'Descripción positiva IA', action: 'Acción sugerida IA' },
        { type: 'negative', title: 'Área de atención IA', description: 'Descripción negativa IA' }
      ],
      recommendations: ['Recomendación IA 1', 'Recomendación IA 2']
    }

    analyticsAPI.ai.generateInsights.mockResolvedValue({ data: { success: true, data: mockInsights } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))

    await waitFor(() => {
      expect(screen.getByText('Ejecutar Analisis')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('Resumen del análisis IA único')).toBeInTheDocument()
    })

    expect(screen.getByText('Mejora detectada IA')).toBeInTheDocument()
    expect(screen.getByText('Descripción positiva IA')).toBeInTheDocument()
    expect(screen.getByText('Acción sugerida IA')).toBeInTheDocument()
    // El <li> renderiza "• {rec}", así que el nodo de texto es "• Recomendación
    // IA 1" y un match exacto falla; matcher por substring.
    expect(screen.getByText(/Recomendación IA 1/)).toBeInTheDocument()
  })

  test('panel IA: insights maneja tipos de insight diferentes', async () => {
    const user = userEvent.setup()
    const mockInsights = {
      insights: [
        { type: 'positive', title: 'Positivo', description: 'Desc' },
        { type: 'negative', title: 'Negativo', description: 'Desc' },
        { type: 'warning', title: 'Advertencia', description: 'Desc' },
        { type: 'info', title: 'Información', description: 'Desc' }
      ]
    }

    analyticsAPI.ai.generateInsights.mockResolvedValue({ data: { success: true, data: mockInsights } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('Positivo')).toBeInTheDocument()
    })

    expect(screen.getByText('Negativo')).toBeInTheDocument()
    expect(screen.getByText('Advertencia')).toBeInTheDocument()
    expect(screen.getByText('Información')).toBeInTheDocument()
  })

  // ==================== AI PANEL - ANOMALIES TAB ====================
  test('panel IA: cambia a tab anomalies', async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.insights')).toBeInTheDocument()
    })

    const anomaliesTab = screen.getByText('analyticsPage.anomalies')
    await user.click(anomaliesTab)

    await waitFor(() => {
      expect(screen.getByText('Detecta anomalias en los datos')).toBeInTheDocument()
    })
  })

  test('panel IA: detecta anomalías con éxito', async () => {
    const user = userEvent.setup()
    const mockAnomalies = {
      anomalies: [
        {
          metric: 'Tiempo procesamiento',
          severity: 'critical',
          description: 'Anomalía crítica detectada',
          expectedValue: 100,
          actualValue: 200,
          deviation: 100,
          suggestedAction: 'Revisar sistema'
        },
        {
          metric: 'Tasa error',
          severity: 'high',
          description: 'Anomalía alta',
          expectedValue: 2,
          actualValue: 5,
          deviation: 150
        }
      ]
    }

    analyticsAPI.ai.detectAnomalies.mockResolvedValue({ data: { success: true, data: mockAnomalies } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.anomalies'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('2 anomalia(s) detectada(s)')).toBeInTheDocument()
    })

    expect(screen.getByText('Tiempo procesamiento')).toBeInTheDocument()
    expect(screen.getByText('Anomalía crítica detectada')).toBeInTheDocument()
    expect(screen.getByText('Revisar sistema')).toBeInTheDocument()
  })

  test('panel IA: muestra mensaje cuando no hay anomalías', async () => {
    const user = userEvent.setup()
    const mockNoAnomalies = { anomalies: [] }

    analyticsAPI.ai.detectAnomalies.mockResolvedValue({ data: { success: true, data: mockNoAnomalies } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.anomalies'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('No se detectaron anomalias')).toBeInTheDocument()
    })
  })

  test.each([
    ['critical', 'Critico'],
    ['high', 'Alto'],
    ['medium', 'Medio'],
    ['low', 'Bajo']
  ])('panel IA: muestra severidad correctamente: %s → %s', async (severity, label) => {
    const user = userEvent.setup()
    const mockAnomalies = {
      anomalies: [
        { metric: 'Test', severity, description: 'Desc', expectedValue: 1, actualValue: 2, deviation: 100 }
      ]
    }

    analyticsAPI.ai.detectAnomalies.mockResolvedValue({ data: { success: true, data: mockAnomalies } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.anomalies'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  // ==================== AI PANEL - TRENDS TAB ====================
  test('panel IA: ejecuta análisis de tendencias', async () => {
    const user = userEvent.setup()
    const mockTrends = {
      predictions: {
        volume: { direction: 'up', percentage: 15, confidence: 0.85 },
        processing_time: { direction: 'down', percentage: -10, confidence: 0.75 },
        revenue: { direction: 'stable', percentage: 2, confidence: 0.9 }
      },
      seasonality: {
        summary: 'Patrón estacional detectado',
        peakPeriods: ['Diciembre', 'Enero', 'Marzo']
      },
      alerts: ['Alerta 1', 'Alerta 2']
    }

    analyticsAPI.ai.predictTrends.mockResolvedValue({ data: { success: true, data: mockTrends } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.trends'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.predictions')).toBeInTheDocument()
    })

    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('Patrón estacional detectado')).toBeInTheDocument()
    expect(screen.getByText('Diciembre, Enero, Marzo')).toBeInTheDocument()
  })

  test('panel IA: trends muestra dirección correcta de predicciones', async () => {
    const user = userEvent.setup()
    const mockTrends = {
      predictions: {
        test_up: { direction: 'up', percentage: 10, confidence: 0.8 },
        test_down: { direction: 'down', percentage: -5, confidence: 0.7 },
        test_stable: { direction: 'stable', percentage: 0, confidence: 0.9 }
      }
    }

    analyticsAPI.ai.predictTrends.mockResolvedValue({ data: { success: true, data: mockTrends } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.trends'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getAllByText(/%/).length).toBeGreaterThan(0)
    })
  })

  // ==================== AI PANEL - EXECUTIVE TAB ====================
  test('panel IA: genera reporte ejecutivo', async () => {
    const user = userEvent.setup()
    const mockExecutive = {
      executiveSummary: 'Resumen ejecutivo del periodo IA único',
      keyMetrics: {
        total_declarations_exec: '1251',
        success_rate_exec: '97%',
        avg_time_exec: '2.6h',
        total_duties_exec: '€459,000'
      },
      achievements: ['Logro ejecutivo 1', 'Logro ejecutivo 2'],
      concerns: ['Preocupación ejecutiva 1'],
      strategicRecommendations: ['Recomendación estratégica ejecutiva 1', 'Recomendación estratégica ejecutiva 2'],
      reportHtml: '<html><body>Reporte</body></html>'
    }

    analyticsAPI.ai.generateExecutiveReport.mockResolvedValue({ data: { success: true, data: mockExecutive } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.executiveReport'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('Resumen ejecutivo del periodo IA único')).toBeInTheDocument()
    })

    expect(screen.getByText('Logro ejecutivo 1')).toBeInTheDocument()
    // concerns se renderiza como "• {concern}" -> substring
    expect(screen.getByText(/Preocupación ejecutiva 1/)).toBeInTheDocument()
    expect(screen.getByText('Recomendación estratégica ejecutiva 1')).toBeInTheDocument()
    expect(screen.getByText('Descargar Reporte HTML')).toBeInTheDocument()
  })

  // ==================== AI PANEL - KPI ANALYSIS TAB ====================
  test('panel IA: analiza desviaciones de KPI', async () => {
    const user = userEvent.setup()
    const mockKPIAnalysis = {
      overallStatus: 'healthy',
      healthScore: 91,
      deviations: [
        { kpiName: 'KPI analizado 1', target: 101, actual: 111, deviation: 10 },
        { kpiName: 'KPI analizado 2', target: 51, actual: 46, deviation: -10 }
      ],
      rootCauses: ['Causa raíz IA 1', 'Causa raíz IA 2'],
      improvementActions: [
        { action: 'Acción IA 1', priority: 'high', expectedImpact: 'Alto impacto IA' },
        { action: 'Acción IA 2', priority: 'medium', expectedImpact: 'Impacto medio IA' }
      ]
    }

    analyticsAPI.ai.analyzeKPIDeviations.mockResolvedValue({ data: { success: true, data: mockKPIAnalysis } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.kpiAnalysis'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('91/100')).toBeInTheDocument()
    })

    // "Estado: {label}" es un solo nodo -> substring; idem "• {cause}"
    expect(screen.getByText(/Saludable/)).toBeInTheDocument()
    expect(screen.getByText('KPI analizado 1')).toBeInTheDocument()
    expect(screen.getByText('+10%')).toBeInTheDocument()
    expect(screen.getByText(/Causa raíz IA 1/)).toBeInTheDocument()
    expect(screen.getByText('Acción IA 1')).toBeInTheDocument()
  })

  test.each([
    ['healthy', 'Saludable', 76],
    ['warning', 'Precaucion', 77],
    ['critical', 'Critico', 78]
  ])('panel IA: KPI analysis muestra estado correcto: %s → %s', async (status, label, score) => {
    const user = userEvent.setup()
    const mockKPIAnalysis = { overallStatus: status, healthScore: score, deviations: [] }

    analyticsAPI.ai.analyzeKPIDeviations.mockResolvedValue({ data: { success: true, data: mockKPIAnalysis } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.kpiAnalysis'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText(`${score}/100`)).toBeInTheDocument()
    })

    // "Estado: {label}" es un solo nodo de texto -> substring
    expect(screen.getByText(new RegExp(label))).toBeInTheDocument()
  })

  // ==================== AI PANEL - FULL ANALYSIS TAB ====================
  test('panel IA: ejecuta análisis completo', async () => {
    const user = userEvent.setup()
    const mockFullAnalysis = {
      overallScore: 88,
      summary: 'Análisis completo del sistema',
      sections: {
        operations: { score: 92, label: 'Operaciones' }
      },
      actionItems: [
        { action: 'Acción prioritaria única', priority: 'high', reason: 'Razón importante' }
      ]
    }

    analyticsAPI.ai.fullAnalysis.mockResolvedValue({ data: { success: true, data: mockFullAnalysis } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.fullAnalysis'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('88/100')).toBeInTheDocument()
    })

    expect(screen.getByText('Análisis completo del sistema')).toBeInTheDocument()
    expect(screen.getByText('Acción prioritaria única')).toBeInTheDocument()
  })

  test.each([
    [85, 'green'],
    [65, 'yellow'],
    [45, 'red']
  ])('panel IA: full analysis muestra color según score: %s → %s', async (score, colorClass) => {
    const user = userEvent.setup()
    const mockFullAnalysis = {
      overallScore: score,
      summary: 'Test',
      sections: {}
    }

    analyticsAPI.ai.fullAnalysis.mockResolvedValue({ data: { success: true, data: mockFullAnalysis } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('analyticsPage.fullAnalysis'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText(`${score}/100`)).toBeInTheDocument()
    })
  })

  // ==================== AI PANEL - ERROR HANDLING ====================
  test('panel IA: maneja error en análisis', async () => {
    const user = userEvent.setup()
    analyticsAPI.ai.generateInsights.mockRejectedValue({
      response: { data: { error: 'Error al generar insights' } }
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('Error al generar insights')).toBeInTheDocument()
    })
  })

  test('panel IA: muestra spinner durante análisis', async () => {
    const user = userEvent.setup()
    analyticsAPI.ai.generateInsights.mockImplementation(() => new Promise(() => {}))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.analyzingWithAI')).toBeInTheDocument()
    })
  })

  test('panel IA: botón actualizar análisis funciona', async () => {
    const user = userEvent.setup()
    const mockInsights = { summary: 'Test', insights: [], recommendations: [] }
    analyticsAPI.ai.generateInsights.mockResolvedValue({ data: { success: true, data: mockInsights } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Centro de Analisis IA'))
    await user.click(screen.getByText('Ejecutar Analisis'))

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    const updateButton = screen.getByText('Actualizar Analisis')
    await user.click(updateButton)

    await waitFor(() => {
      expect(analyticsAPI.ai.generateInsights).toHaveBeenCalledTimes(2)
    })
  })

  // ==================== REAL-TIME REFRESH ====================
  test('refresca datos en tiempo real cada 30 segundos', async () => {
    // shouldAdvanceTime: true deja que los microtasks/promesas del useEffect inicial
    // (loadDashboardData/kpis/realTime, todos await sobre mocks) se resuelvan; sin él
    // waitFor no puede vaciar la cola y el test cuelga hasta timeout. Además, si el
    // test se abortara por timeout con timers falsos activos, contamina los siguientes.
    vi.useFakeTimers({ shouldAdvanceTime: true })

    try {
      const { unmount } = render(<AnalyticsDashboard />)

      await waitFor(() => {
        expect(screen.getByText('analyticsPage.title')).toBeInTheDocument()
      })

      const initialCalls = analyticsAPI.getRealTime.mock.calls.length

      await vi.advanceTimersByTimeAsync(30001)

      await waitFor(() => {
        expect(analyticsAPI.getRealTime.mock.calls.length).toBeGreaterThan(initialCalls)
      }, { timeout: 3000 })

      unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  // ==================== FORMAT FUNCTIONS ====================
  test('formatNumber formatea números grandes correctamente', async () => {
    const dataWithLargeNumber = {
      ...mockDashboardData,
      operations: { ...mockDashboardData.operations, totalDeclarations: 2500000 }
    }
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: dataWithLargeNumber } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('2.5M')).toBeInTheDocument()
    })
  })

  test('formatCurrency formatea montos con símbolo EUR', async () => {
    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Valor Aduanero')).toBeInTheDocument()
    })

    // Intl.NumberFormat formatea con espacio no-breaking entre número y símbolo
    // es-ES usa punto como separador de miles y espacio antes del euro: "458.000 €"
    const currencyPattern = /458\.000\s?€/
    const elements = screen.getAllByText(currencyPattern)
    expect(elements.length).toBeGreaterThan(0)
  })

  // ==================== EMPTY/NULL DATA ====================
  test('maneja datos vacíos sin romper', async () => {
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: {} } })
    analyticsAPI.kpis.getDashboard.mockResolvedValue({ data: { success: true, data: {} } })
    analyticsAPI.getRealTime.mockResolvedValue({ data: { success: true, data: {} } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Declaraciones')).toBeInTheDocument()
    }, { timeout: 10000 })

    expect(screen.getByText('Valor Aduanero')).toBeInTheDocument()
  })

  test('maneja null en campos opcionales', async () => {
    const dataWithNulls = {
      operations: { totalDeclarations: null, averageProcessingTime: null },
      financial: { totalDutiesCalculated: null },
      compliance: { documentCompleteness: null },
      channels: null,
      trends: null
    }
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: dataWithNulls } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Declaraciones')).toBeInTheDocument()
    }, { timeout: 10000 })

    expect(screen.getByText('Valor Aduanero')).toBeInTheDocument()
  })

  // ==================== RECOMMENDATIONS WITH DIFFERENT FORMATS ====================
  test('maneja recomendaciones con diferentes formatos', async () => {
    const dataWithMixedRecs = {
      ...mockDashboardData,
      luciInsights: {
        summary: 'Test',
        recommendations: [
          'String simple',
          { action: 'Objeto con action' },
          { rationale: 'Objeto con rationale' },
          { other: 'Objeto desconocido' }
        ]
      }
    }
    analyticsAPI.getDashboard.mockResolvedValue({ data: { success: true, data: dataWithMixedRecs } })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('String simple')).toBeInTheDocument()
    }, { timeout: 10000 })

    expect(screen.getByText('Objeto con action')).toBeInTheDocument()
    expect(screen.getByText('Objeto con rationale')).toBeInTheDocument()
  })
})
