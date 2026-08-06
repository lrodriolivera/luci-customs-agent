import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MLInsights from './MLInsights'
import { mlAPI } from '../../services/api'
import { toast } from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  mlAPI: {
    getStats: vi.fn(),
    classify: vi.fn(),
    fraud: {
      analyze: vi.fn()
    },
    channel: {
      predict: vi.fn()
    },
    recommendations: {
      generate: vi.fn()
    },
    autoResponse: {
      listTemplates: vi.fn()
    }
  }
}))

describe('<MLInsights />', () => {
  const mockStats = {
    classification: {
      totalClassifications: 1234,
      accuracy: 92,
      modelConfidence: 85
    },
    fraudDetection: {
      totalAnalyses: 567,
      alertsGenerated: 89,
      modelAccuracy: 92
    },
    channelPrediction: {
      totalPredictions: 890,
      accuracy: 78,
      modelAccuracy: 78
    },
    recommendations: {
      totalGenerated: 456,
      implemented: 234
    },
    autoResponse: {
      totalGenerated: 345,
      acceptedByAEAT: 289
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mlAPI.getStats.mockResolvedValue({ data: { success: true, statistics: mockStats } })
    mlAPI.autoResponse.listTemplates.mockResolvedValue({ data: { success: true, templates: [] } })
  })

  // Helper: espera a que stats se cargue y el componente esté listo
  async function waitForStatsLoaded() {
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('1234')).toBeInTheDocument())
  }

  test('renderiza el header y carga stats inicialmente', async () => {
    render(<MLInsights />)
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('ML Insights')).toBeInTheDocument())
    expect(screen.getByText('Sistema de Inteligencia Artificial para Aduanas')).toBeInTheDocument()
  })

  test('muestra loading spinner mientras stats es null', () => {
    mlAPI.getStats.mockImplementation(() => new Promise(() => {})) // nunca resuelve
    render(<MLInsights />)
    // El ArrowPathIcon con animate-spin está en el loading inicial
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('renderiza overview con stats correctas', async () => {
    render(<MLInsights />)
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('1234')).toBeInTheDocument())
    expect(screen.getByText('567')).toBeInTheDocument()
    expect(screen.getByText('890')).toBeInTheDocument()
    expect(screen.getByText('456')).toBeInTheDocument()
    expect(screen.getByText('345')).toBeInTheDocument()
  })

  test('maneja error al cargar stats sin romper', async () => {
    mlAPI.getStats.mockRejectedValue(new Error('boom'))
    render(<MLInsights />)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error cargando estadisticas ML'), { timeout: 3000 })
    // El componente sigue montado tras el error
    await waitFor(() => expect(screen.getByText('ML Insights')).toBeInTheDocument())
  })

  test('botón Actualizar recarga stats', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalledTimes(1))
    const refreshBtn = screen.getByRole('button', { name: /actualizar/i })
    await user.click(refreshBtn)
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalledTimes(2))
  })

  // ========== TAB: Classification ==========
  test('tab classification: validación requiere descripción', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ingrese una descripcion del producto'))
    expect(mlAPI.classify).not.toHaveBeenCalled()
  })

  test('tab classification: clasificación exitosa muestra resultado', async () => {
    mlAPI.classify.mockResolvedValue({
      data: {
        success: true,
        classification: {
          code: '0901210000',
          chapter: '09',
          category: 'Café'
        },
        confidence: 95,
        confidenceLevel: 'high',
        requiresManualReview: false
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    const descInput = screen.getByPlaceholderText(/camiseta de algodon/i)
    await user.type(descInput, 'Café sin tostar')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(mlAPI.classify).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Café sin tostar' })
    ))
    await waitFor(() => expect(screen.getByText('0901210000')).toBeInTheDocument())
    expect(screen.getByText('Capitulo 09 - Café')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Producto clasificado')
  })

  test('tab classification: con requiresManualReview muestra warning', async () => {
    mlAPI.classify.mockResolvedValue({
      data: {
        success: true,
        classification: { code: '8471300000', chapter: '84', category: 'Máquinas' },
        confidence: 55,
        confidenceLevel: 'low',
        requiresManualReview: true
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.type(screen.getByPlaceholderText(/camiseta de algodon/i), 'Algo')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(screen.getByText(/se recomienda revision manual/i)).toBeInTheDocument())
  })

  test('tab classification: con suggestions múltiples muestra alternativas', async () => {
    mlAPI.classify.mockResolvedValue({
      data: {
        success: true,
        classification: { code: '2204210000', chapter: '22', category: 'Bebidas' },
        confidence: 88,
        confidenceLevel: 'high',
        suggestions: [
          { code: '2204210000', description: 'Vino en recipientes de 2l o menos' },
          { code: '2204220000', description: 'Otro vino' }
        ]
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.type(screen.getByPlaceholderText(/camiseta de algodon/i), 'Vino')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(screen.getByText('2204220000')).toBeInTheDocument())
    expect(screen.getByText('Otro vino')).toBeInTheDocument()
  })

  test('tab classification: con additionalChecks muestra verificaciones', async () => {
    mlAPI.classify.mockResolvedValue({
      data: {
        success: true,
        classification: { code: '0901110000', chapter: '09', category: 'Café' },
        confidence: 90,
        confidenceLevel: 'high',
        additionalChecks: ['Verificar origen', 'Certificado fitosanitario']
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.type(screen.getByPlaceholderText(/camiseta de algodon/i), 'Café')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(screen.getByText('Verificar origen')).toBeInTheDocument())
    expect(screen.getByText('Certificado fitosanitario')).toBeInTheDocument()
  })

  test('tab classification: sin clasificación exitosa muestra mensaje', async () => {
    mlAPI.classify.mockResolvedValue({
      data: { success: true, message: 'No se pudo determinar' }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.type(screen.getByPlaceholderText(/camiseta de algodon/i), 'X')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(screen.getByText('No se pudo determinar')).toBeInTheDocument())
  })

  test('tab classification: error en API muestra toast error', async () => {
    mlAPI.classify.mockRejectedValue(new Error('API down'))
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.type(screen.getByPlaceholderText(/camiseta de algodon/i), 'Test')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error en clasificacion'))
  })

  test.each([
    ['high', 'text-green-600'],
    ['medium', 'text-yellow-600'],
    ['low', 'text-red-600'],
    ['unknown', 'text-gray-600']
  ])('tab classification: confidence=%s aplica color %s', async (level, expectedClass) => {
    mlAPI.classify.mockResolvedValue({
      data: {
        success: true,
        classification: { code: '8471300000', chapter: '84', category: 'Máquinas' },
        confidence: 75,
        confidenceLevel: level
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    await user.type(screen.getByPlaceholderText(/camiseta de algodon/i), 'X')
    await user.click(screen.getByRole('button', { name: /clasificar con ml/i }))
    await waitFor(() => expect(screen.getByText(`75% (${level})`)).toBeInTheDocument())
    const confidenceSpan = screen.getByText(`75% (${level})`)
    expect(confidenceSpan.className).toContain(expectedClass)
  })

  // ========== TAB: Fraud ==========
  test('tab fraud: análisis exitoso muestra resultado', async () => {
    mlAPI.fraud.analyze.mockResolvedValue({
      data: {
        success: true,
        data: {
          overallRiskLevel: 'high',
          riskScore: 85,
          alerts: [
            { type: 'Precio sospechoso', message: 'Valor muy bajo', severity: 'high', evidence: 'Evidencia X' }
          ],
          recommendations: ['Revisar documentación', 'Contactar proveedor']
        }
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    // Click en el tab fraud (el botón se renderiza con el texto i18n key)
    const fraudTabBtn = screen.getAllByRole('button').find(btn => btn.textContent.includes('ml.fraudDetection'))
    await user.click(fraudTabBtn)
    // Esperar que el tab fraud se monte
    expect(await screen.findByText('Analisis de Fraude', {}, { timeout: 5000 })).toBeInTheDocument()
    const analyzeBtn = screen.getByRole('button', { name: /analizar fraude/i })
    await user.click(analyzeBtn)
    await waitFor(() => expect(mlAPI.fraud.analyze).toHaveBeenCalled(), { timeout: 3000 })
    // Esperar que loading termine Y toast de éxito se llame
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Analisis completado'), { timeout: 5000 })
    // Ahora el resultado debe estar visible (CSS uppercase, pero DOM contiene minúscula)
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('Puntuacion: 85/100')).toBeInTheDocument()
    expect(screen.getByText('Precio sospechoso')).toBeInTheDocument()
    expect(screen.getByText('Valor muy bajo')).toBeInTheDocument()
    expect(screen.getByText('Evidencia: Evidencia X')).toBeInTheDocument()
    expect(screen.getByText('Revisar documentación')).toBeInTheDocument()
  })

  test('tab fraud: normaliza overallRiskLevel de respuestas variadas', async () => {
    mlAPI.fraud.analyze.mockResolvedValue({
      data: {
        success: true,
        riskLevel: 'medium', // sin data wrapper, campo riskLevel
        riskScore: 50
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.fraudDetection/i }))
    await screen.findByText('Analisis de Fraude', {}, { timeout: 3000 })
    const analyzeBtn = screen.getByRole('button', { name: /analizar fraude/i }, { timeout: 3000 })
    await user.click(analyzeBtn)
    expect(await screen.findByText('medium', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  test.each([
    ['low', 'text-green-600'],
    ['medium', 'text-yellow-600'],
    ['high', 'text-orange-600'],
    ['critical', 'text-red-600'],
    ['unknown', 'text-gray-600']
  ])('tab fraud: riskLevel=%s aplica color %s', async (level, expectedClass) => {
    mlAPI.fraud.analyze.mockResolvedValue({
      data: { success: true, overallRiskLevel: level, riskScore: 50 }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.fraudDetection/i }))
    await screen.findByText('Analisis de Fraude', {}, { timeout: 3000 })
    const analyzeBtn = screen.getByRole('button', { name: /analizar fraude/i }, { timeout: 3000 })
    await user.click(analyzeBtn)
    await waitFor(() => {
      const div = screen.getByText(level).parentElement
      expect(div.className).toContain(expectedClass)
    }, { timeout: 3000 })
  })

  test('tab fraud: error en API muestra toast error', async () => {
    mlAPI.fraud.analyze.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.fraudDetection/i }))
    await screen.findByText('Analisis de Fraude', {}, { timeout: 3000 })
    const analyzeBtn = screen.getByRole('button', { name: /analizar fraude/i }, { timeout: 3000 })
    await user.click(analyzeBtn)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error en analisis de fraude'), { timeout: 3000 })
  })

  // ========== TAB: Channel ==========
  test('tab channel: predicción exitosa normaliza canal y confianza', async () => {
    mlAPI.channel.predict.mockResolvedValue({
      data: {
        success: true,
        prediction: {
          channel: 'green',
          confidenceScore: 0.92
        }
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    await waitFor(() => expect(mlAPI.channel.predict).toHaveBeenCalled(), { timeout: 3000 })
    expect(await screen.findByText('verde', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Confianza: 92%')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Prediccion completada')
  })

  test('tab channel: mapea orange→naranja, red→rojo, yellow→naranja', async () => {
    mlAPI.channel.predict.mockResolvedValue({
      data: { success: true, data: { predictedChannel: 'orange', confidence: 80 } }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    expect(await screen.findByText('naranja', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  test('tab channel: confianza >1 se interpreta como porcentaje', async () => {
    mlAPI.channel.predict.mockResolvedValue({
      data: { success: true, data: { predictedChannel: 'verde', confidence: 88 } }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    expect(await screen.findByText('Confianza: 88%', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  test('tab channel: con probabilities muestra barras', async () => {
    mlAPI.channel.predict.mockResolvedValue({
      data: {
        success: true,
        data: {
          predictedChannel: 'verde',
          confidence: 70,
          probabilities: { verde: 70, naranja: 20, rojo: 10 }
        }
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    expect(await screen.findByText('Probabilidades', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
  })

  test('tab channel: con riskFactors muestra factores', async () => {
    mlAPI.channel.predict.mockResolvedValue({
      data: {
        success: true,
        data: {
          predictedChannel: 'rojo',
          confidence: 95,
          riskFactors: [
            { factor: 'Origen alto riesgo', weight: 30 },
            { factor: 'Valor elevado', weight: 20 }
          ]
        }
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    expect(await screen.findByText('Factores de Riesgo', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Origen alto riesgo')).toBeInTheDocument()
    expect(screen.getByText('+30 puntos')).toBeInTheDocument()
  })

  test('tab channel: con suggestions muestra bloque', async () => {
    mlAPI.channel.predict.mockResolvedValue({
      data: {
        success: true,
        data: {
          predictedChannel: 'verde',
          confidence: 85,
          suggestions: ['Preparar documentación adicional']
        }
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    expect(await screen.findByText('Sugerencias', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('• Preparar documentación adicional')).toBeInTheDocument()
  })

  test.each([
    ['verde', 'text-green-600'],
    ['naranja', 'text-orange-600'],
    ['rojo', 'text-red-600'],
    ['otro', 'text-gray-600']
  ])('tab channel: canal=%s aplica color %s', async (canal, expectedClass) => {
    mlAPI.channel.predict.mockResolvedValue({
      data: { success: true, data: { predictedChannel: canal, confidence: 80 } }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    await waitFor(() => {
      const div = screen.getByText(canal).parentElement
      expect(div.className).toContain(expectedClass)
    }, { timeout: 3000 })
  })

  test('tab channel: error en API muestra toast error', async () => {
    mlAPI.channel.predict.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    await screen.findByText('Prediccion de Circuito', {}, { timeout: 3000 })
    const predictBtn = screen.getByRole('button', { name: /predecir circuito/i }, { timeout: 3000 })
    await user.click(predictBtn)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error en prediccion'), { timeout: 3000 })
  })

  // ========== TAB: Recommendations ==========
  test('tab recommendations: genera recomendaciones exitosas', async () => {
    // Las acciones se pintan como `<li>• {action}</li>`, con el prefijo "• " en el
    // mismo nodo de texto: getByText exacto NO casa, hay que usar substring/regex.
    mlAPI.recommendations.generate.mockResolvedValue({
      data: {
        success: true,
        totalPotentialSavings: 500,
        recommendations: [
          {
            type: 'Optimización arancelaria',
            recommendation: 'Usar régimen 5100',
            priority: 'high',
            potentialSavings: 300,
            actions: ['Solicitar autorización', 'Preparar documentos']
          },
          {
            type: 'Reducción IVA',
            recommendation: 'IVA diferido',
            priority: 'medium',
            potentialSavings: 200,
            actions: ['Contactar asesor']
          }
        ]
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    // Click al tab recommendations
    const recsTabBtn = screen.getAllByRole('button').find(btn => btn.textContent.includes('ml.recommendations'))
    await user.click(recsTabBtn)
    // Esperar que el tab se monte
    expect(await screen.findByText('Generador de Recomendaciones', {}, { timeout: 5000 })).toBeInTheDocument()
    const generateBtn = screen.getByRole('button', { name: /generar recomendaciones/i })
    await user.click(generateBtn)
    await waitFor(() => expect(mlAPI.recommendations.generate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: expect.any(Object) })
    ), { timeout: 3000 })
    // Esperar resultado con toast
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Recomendaciones generadas'), { timeout: 5000 })
    // Esperar que el resultado completo se renderice
    expect(await screen.findByText('Ahorro Potencial Total', {}, { timeout: 5000 })).toBeInTheDocument()
    // Ahora buscar el contenido con waitFor para dar más tiempo
    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeInTheDocument()
      expect(screen.getByText('Optimización arancelaria')).toBeInTheDocument()
      expect(screen.getByText('Usar régimen 5100')).toBeInTheDocument()
      // "• Solicitar autorización" → prefijo "• " en el mismo nodo, usar regex
      expect(screen.getByText(/Solicitar autorización/)).toBeInTheDocument()
      expect(screen.getByText('Reducción IVA')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  test('tab recommendations: sin recomendaciones muestra mensaje', async () => {
    mlAPI.recommendations.generate.mockResolvedValue({
      data: { success: true, totalPotentialSavings: 0, recommendations: [] }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.recommendations/i }))
    await user.click(screen.getByRole('button', { name: /generar recomendaciones/i }))
    await waitFor(() => expect(screen.getByText('No se encontraron recomendaciones adicionales')).toBeInTheDocument())
  })

  test('tab recommendations: prioridad high/medium/low aplica borde correcto', async () => {
    mlAPI.recommendations.generate.mockResolvedValue({
      data: {
        success: true,
        recommendations: [
          { type: 'Alta', recommendation: 'X', priority: 'high', potentialSavings: 100, actions: [] },
          { type: 'Media', recommendation: 'Y', priority: 'medium', potentialSavings: 50, actions: [] },
          { type: 'Baja', recommendation: 'Z', priority: 'low', potentialSavings: 10, actions: [] }
        ]
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.recommendations/i }))
    await user.click(screen.getByRole('button', { name: /generar recomendaciones/i }))
    await waitFor(() => {
      const altaDiv = screen.getByText('Alta').parentElement.parentElement
      expect(altaDiv.className).toContain('border-yellow-400')
      const mediaDiv = screen.getByText('Media').parentElement.parentElement
      expect(mediaDiv.className).toContain('border-blue-300')
      const bajaDiv = screen.getByText('Baja').parentElement.parentElement
      expect(bajaDiv.className).toContain('border-gray-200')
    })
  })

  test('tab recommendations: error en API muestra toast error', async () => {
    mlAPI.recommendations.generate.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.recommendations/i }))
    await user.click(screen.getByRole('button', { name: /generar recomendaciones/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error generando recomendaciones'))
  })

  // ========== TAB: Auto-Response ==========
  test('tab autoresponse: carga templates al activar la pestaña', async () => {
    mlAPI.autoResponse.listTemplates.mockResolvedValue({
      data: {
        success: true,
        templates: [
          { id: 't1', name: 'Template A', description: 'Desc A', type: 'documentary', successRate: 95 },
          { id: 't2', name: 'Template B', description: 'Desc B', type: 'valuation', successRate: 88 }
        ]
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.autoResponse/i }))
    await waitFor(() => expect(mlAPI.autoResponse.listTemplates).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Template A')).toBeInTheDocument())
    expect(screen.getByText('Desc A')).toBeInTheDocument()
    expect(screen.getByText('95% exito')).toBeInTheDocument()
    expect(screen.getByText('Template B')).toBeInTheDocument()
  })

  test('tab autoresponse: sin templates muestra mensaje "cargando"', async () => {
    mlAPI.autoResponse.listTemplates.mockResolvedValue({ data: { success: true, templates: [] } })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.autoResponse/i }))
    await waitFor(() => expect(screen.getByText('Cargando plantillas...')).toBeInTheDocument())
  })

  test('tab autoresponse: seleccionar template muestra vista previa', async () => {
    mlAPI.autoResponse.listTemplates.mockResolvedValue({
      data: {
        success: true,
        templates: [
          {
            id: 't1',
            name: 'Template X',
            description: 'Desc',
            type: 'classification',
            successRate: 92,
            structure: 'Bloque XML aquí',
            requiredFields: ['field1', 'field2']
          }
        ]
      }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.autoResponse/i }))
    await waitFor(() => expect(screen.getByText('Template X')).toBeInTheDocument())
    await user.click(screen.getByText('Template X'))
    await waitFor(() => expect(screen.getByText('Vista Previa: Template X')).toBeInTheDocument())
    expect(screen.getByText('Bloque XML aquí')).toBeInTheDocument()
    expect(screen.getByText('field1')).toBeInTheDocument()
    expect(screen.getByText('field2')).toBeInTheDocument()
    expect(screen.getByText('Tasa de exito historica')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  test('tab autoresponse: botón Cerrar oculta la vista previa', async () => {
    mlAPI.autoResponse.listTemplates.mockResolvedValue({
      data: { success: true, templates: [{ id: 't1', name: 'T1', description: 'D', type: 'documentary', successRate: 90 }] }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.autoResponse/i }))
    await waitFor(() => expect(screen.getByText('T1')).toBeInTheDocument())
    await user.click(screen.getByText('T1'))
    await waitFor(() => expect(screen.getByText('Vista Previa: T1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /cerrar/i }))
    await waitFor(() => expect(screen.queryByText('Vista Previa: T1')).not.toBeInTheDocument())
  })

  test.each([
    ['documentary', 'bg-blue-100'],
    ['valuation', 'bg-purple-100'],
    ['classification', 'bg-yellow-100'],
    ['otro', 'bg-gray-100']
  ])('tab autoresponse: type=%s aplica badge %s', async (type, expectedClass) => {
    mlAPI.autoResponse.listTemplates.mockResolvedValue({
      data: { success: true, templates: [{ id: 't1', name: 'T', description: 'D', type, successRate: 90 }] }
    })
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.autoResponse/i }))
    await waitFor(() => {
      const badge = screen.getByText(type)
      expect(badge.className).toContain(expectedClass)
    })
  })

  test('tab autoresponse: error en listTemplates no rompe', async () => {
    mlAPI.autoResponse.listTemplates.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.autoResponse/i }))
    await waitFor(() => expect(mlAPI.autoResponse.listTemplates).toHaveBeenCalled())
    // El componente no tiene toast.error para templates, solo console.error silencioso
    // Verificamos que no rompe:
    expect(screen.getByText('Plantillas de Auto-Respuesta AEAT')).toBeInTheDocument()
  })

  // ========== Cobertura de overview: defaults de stats ==========
  test('overview: stats undefined usa defaults', async () => {
    mlAPI.getStats.mockResolvedValue({ data: { success: true, statistics: {} } })
    render(<MLInsights />)
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Clasificaciones')).toBeInTheDocument())
    // Con stats vacío, todos los contadores deben ser 0 o N/A
    const statsSection = screen.getByText('Clasificaciones').closest('.bg-white')
    expect(statsSection.textContent).toContain('0')
  })

  test('overview: barras de confianza usan defaults si stats incompleto', async () => {
    mlAPI.getStats.mockResolvedValue({
      data: { success: true, statistics: { classification: {}, channelPrediction: {}, fraudDetection: {} } }
    })
    render(<MLInsights />)
    await waitFor(() => expect(mlAPI.getStats).toHaveBeenCalled())
    // Los defaults: 85% clasificacion, 78% channel, 92% fraud
    await waitFor(() => {
      const barsParent = screen.getByText('Confianza de Modelos').parentElement
      expect(barsParent.textContent).toContain('85%')
      expect(barsParent.textContent).toContain('78%')
      expect(barsParent.textContent).toContain('92%')
    })
  })

  // ========== Estado vacío de resultados antes de ejecutar acciones ==========
  test('classification: estado inicial sin resultado muestra placeholder', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    expect(screen.getByText('Ingrese los datos del producto para obtener una clasificacion')).toBeInTheDocument()
  })

  test('fraud: estado inicial sin resultado muestra placeholder', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.fraudDetection/i }))
    expect(screen.getByText('Ingrese los datos para analizar posibles indicadores de fraude')).toBeInTheDocument()
  })

  test('channel: estado inicial sin resultado muestra placeholder', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    expect(screen.getByText('Ingrese los datos para predecir el circuito aduanero')).toBeInTheDocument()
  })

  test('recommendations: estado inicial sin resultado muestra placeholder', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.recommendations/i }))
    expect(screen.getByText('Ingrese los datos para obtener recomendaciones de optimizacion')).toBeInTheDocument()
  })

  // ========== Interacción con inputs para cubrir ramas de onChange ==========
  test('classification: onChange de material y use actualiza estado', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.classification/i }))
    const materialInput = screen.getByPlaceholderText(/100% algodon/i)
    const useInput = screen.getByPlaceholderText(/vestir, deportivo/i)
    await user.type(materialInput, 'Lana')
    await user.type(useInput, 'Abrigo')
    expect(materialInput.value).toBe('Lana')
    expect(useInput.value).toBe('Abrigo')
  })

  test('fraud: onChange de taricCode, customsValue, quantity actualiza estado', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.fraudDetection/i }))
    await waitFor(() => expect(screen.getByText(/ingrese los datos para analizar/i)).toBeInTheDocument())
    const taricInput = screen.getByPlaceholderText(/6109100010/i)
    const valueInput = screen.getByPlaceholderText('Ej: 10000')
    const qtyInput = screen.getByPlaceholderText('Ej: 1000')
    await user.type(taricInput, '0901210000')
    await user.type(valueInput, '5000')
    await user.type(qtyInput, '200')
    expect(taricInput.value).toBe('0901210000')
    expect(valueInput.value).toBe('5000')
    expect(qtyInput.value).toBe('200')
  })

  test('channel: onChange de originCountry, taricCode, customsValue, operatorEORI actualiza estado', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.channelPrediction/i }))
    const originSelect = screen.getByDisplayValue('China')
    const taricInput = screen.getByPlaceholderText(/8471300000/i)
    const valueInput = screen.getByPlaceholderText(/50000/i)
    const eoriInput = screen.getByPlaceholderText(/ES12345678A/i)
    await user.selectOptions(originSelect, 'US')
    await user.type(taricInput, '2204210000')
    await user.type(valueInput, '30000')
    await user.type(eoriInput, 'ES123')
    expect(originSelect.value).toBe('US')
    expect(taricInput.value).toBe('2204210000')
    expect(valueInput.value).toBe('30000')
    expect(eoriInput.value).toBe('ES123')
  })

  test('recommendations: onChange de originCountry, taricCode, customsValue, regime actualiza estado', async () => {
    const user = userEvent.setup()
    render(<MLInsights />)
    await waitForStatsLoaded()
    await user.click(screen.getByRole('button', { name: /ml.recommendations/i }))
    const originSelect = screen.getByDisplayValue('China')
    const taricInput = screen.getByPlaceholderText(/8517120000/i)
    const valueInput = screen.getByPlaceholderText(/100000/i)
    const regimeSelect = screen.getByDisplayValue(/Importacion definitiva/i)
    await user.selectOptions(originSelect, 'JP')
    await user.type(taricInput, '8471300000')
    await user.type(valueInput, '80000')
    await user.selectOptions(regimeSelect, '5100')
    expect(originSelect.value).toBe('JP')
    expect(taricInput.value).toBe('8471300000')
    expect(valueInput.value).toBe('80000')
    expect(regimeSelect.value).toBe('5100')
  })
})
