import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClassificationTool from './ClassificationTool'
import { classificationAPI, expeditionsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => {
      if (params) return `${key}:${JSON.stringify(params)}`
      return key
    }
  })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('../../services/api', () => ({
  classificationAPI: {
    classify: vi.fn(),
    validate: vi.fn(),
    aiFullAnalysis: vi.fn(),
    aiCrossValidate: vi.fn(),
    aiRecordFeedback: vi.fn(),
    getTaricInfo: vi.fn(),
    getTreeData: vi.fn(),
    getSearchHistory: vi.fn(),
    getMostSearched: vi.fn(),
    getCacheStats: vi.fn()
  },
  expeditionsAPI: { get: vi.fn() }
}))

vi.mock('./TaricTreeBrowser', () => ({
  default: ({ onCodeSelect }) => (
    <div data-testid="taric-tree-browser">
      <button onClick={() => onCodeSelect('0901210000')}>Select Code</button>
    </div>
  )
}))

vi.mock('../../data/taricChapters', () => ({
  default: {
    '09': 'Coffee, tea, mate and spices',
    '84': 'Machinery and mechanical appliances',
    '22': 'Beverages, spirits and vinegar'
  }
}))

describe('<ClassificationTool />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    classificationAPI.getSearchHistory.mockResolvedValue({ data: { data: { history: [] } } })
    classificationAPI.getMostSearched.mockResolvedValue({ data: { data: { codes: [] } } })
    classificationAPI.getCacheStats.mockResolvedValue({ data: { data: null } })
  })

  const renderComponent = (initialEntry = '/classification') => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ClassificationTool />
      </MemoryRouter>
    )
  }

  // ==================== PRECARGA DESDE EXPEDIENTE ====================
  describe('precarga desde un expediente (?expedition=<id>)', () => {
    // BUG UX: "Clasificar TARIC" abre /classification?expedition=<id> pero el
    // formulario salia vacio porque nadie leia el query param. Ahora se
    // precargan descripcion, material y origen de la primera partida.
    test('rellena descripcion, material y origen del expediente', async () => {
      expeditionsAPI.get.mockResolvedValue({
        data: {
          data: {
            goods: [
              { description: 'Juguetes plastico', material: 'plastico', originCountry: 'CN' }
            ]
          }
        }
      })

      renderComponent('/classification?expedition=exp-1')

      await waitFor(() => expect(expeditionsAPI.get).toHaveBeenCalledWith('exp-1'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('classification.productPlaceholder').value).toBe('Juguetes plastico')
      })
      expect(screen.getByPlaceholderText('classification.materialPlaceholder').value).toBe('plastico')
      expect(screen.getByPlaceholderText('classification.originPlaceholder').value).toBe('CN')
    })

    test('sin query param no consulta el expediente', async () => {
      renderComponent()
      await waitFor(() => expect(screen.getByPlaceholderText('classification.productPlaceholder')).toBeInTheDocument())
      expect(expeditionsAPI.get).not.toHaveBeenCalled()
    })
  })

  // ==================== INITIAL RENDER ====================
  test('renderiza el header con título y pestañas', async () => {
    renderComponent()
    expect(screen.getByText('classification.title')).toBeInTheDocument()
    expect(screen.getByText('classification.subtitle')).toBeInTheDocument()
    expect(screen.getByText('classification.basic')).toBeInTheDocument()
    expect(screen.getByText('classification.lookupCode')).toBeInTheDocument()
    expect(screen.getByText('classification.exploreTree')).toBeInTheDocument()
    expect(screen.getByText('classification.advanced')).toBeInTheDocument()

    await waitFor(() => {
      expect(classificationAPI.getSearchHistory).toHaveBeenCalled()
      expect(classificationAPI.getMostSearched).toHaveBeenCalled()
      expect(classificationAPI.getCacheStats).toHaveBeenCalled()
    })
  })

  test('carga el historial de búsquedas al montar', async () => {
    const mockHistory = [
      { code: '0901210000', source: 'local_db', description: 'Coffee' },
      { normalizedCode: '8471300000', source: 'ai', description: 'Computers' }
    ]
    classificationAPI.getSearchHistory.mockResolvedValue({ data: { data: { history: mockHistory } } })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('0901210000')).toBeInTheDocument()
      expect(screen.getByText('8471300000')).toBeInTheDocument()
    })
  })

  test('muestra badges de fuente correctos en historial (cache y eu_api)', async () => {
    const mockHistory = [
      { code: '2204210000', source: 'cache', description: 'Wine' },
      { code: '6109100010', source: 'eu_api', description: 'T-shirts' }
    ]
    classificationAPI.getSearchHistory.mockResolvedValue({ data: { data: { history: mockHistory } } })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Cache')).toBeInTheDocument()
      expect(screen.getByText('API UE')).toBeInTheDocument()
    })
  })

  test('maneja error al cargar historial sin romper', async () => {
    classificationAPI.getSearchHistory.mockRejectedValue(new Error('boom'))
    renderComponent()
    await waitFor(() => expect(classificationAPI.getSearchHistory).toHaveBeenCalled())
    expect(screen.getByText('classification.title')).toBeInTheDocument()
  })

  test('carga códigos más buscados', async () => {
    classificationAPI.getMostSearched.mockResolvedValue({
      data: { data: { codes: [{ _id: '2204210000', count: 15, description: 'Wine' }] } }
    })
    renderComponent()
    await waitFor(() => expect(screen.getByText('2204210000')).toBeInTheDocument())
    expect(screen.getByText('15x')).toBeInTheDocument()
  })

  test('carga estadísticas de caché', async () => {
    classificationAPI.getCacheStats.mockResolvedValue({
      data: { data: { totalEntries: 42, totalHits: 150, validatedCount: 20, avgQuality: 8.5 } }
    })
    renderComponent()
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('8.5')).toBeInTheDocument()
  })

  // ==================== TAB SWITCHING ====================
  test('cambio entre pestañas: basic -> lookup -> tree -> advanced', async () => {
    renderComponent()

    // Default: basic tab activa
    expect(screen.getByRole('button', { name: /classification.basic/i })).toHaveClass('bg-white')

    // Click lookup tab
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))
    await waitFor(() => {
      expect(screen.getByText('classification.searchByCode')).toBeInTheDocument()
      expect(screen.getByText('classification.taricOrHsCode')).toBeInTheDocument()
    })

    // Click tree tab
    fireEvent.click(screen.getByRole('button', { name: /classification.exploreTree/i }))
    await waitFor(() => {
      expect(screen.getByTestId('taric-tree-browser')).toBeInTheDocument()
    })

    // Click advanced tab
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))
    await waitFor(() => {
      expect(screen.getByText('classification.fullAnalysisAI')).toBeInTheDocument()
    })
  })

  // ==================== BASIC CLASSIFICATION ====================
  test('validación: descripción vacía en basic tab muestra toast', async () => {
    renderComponent()
    const form = document.querySelector('form')
    fireEvent.submit(form)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('classification.enterDescription'))
    expect(classificationAPI.classify).not.toHaveBeenCalled()
  })

  test('clasificación básica: envía campos y recibe sugerencias', async () => {
    classificationAPI.classify.mockResolvedValue({
      data: {
        suggestions: [
          { code: '0901210000', description: 'Coffee, not roasted', confidence: 95, reasoning: 'Based on material' },
          { code: '0901110000', description: 'Coffee, roasted', confidence: 60 }
        ]
      }
    })

    renderComponent()

    const textarea = screen.getByPlaceholderText('classification.productPlaceholder')
    fireEvent.change(textarea, { target: { value: 'Coffee beans imported from Brazil' } })

    const materialInput = screen.getByPlaceholderText('classification.materialPlaceholder')
    fireEvent.change(materialInput, { target: { value: 'Arabica beans' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => {
      expect(classificationAPI.classify).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Coffee beans imported from Brazil',
          additional_info: { material: 'Arabica beans' },
          language: 'es'
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('0901210000')).toBeInTheDocument()
      expect(screen.getByText('Coffee, not roasted')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('Based on material')).toBeInTheDocument()
    })
  })

  test('clasificación básica: envía todos los campos adicionales', async () => {
    classificationAPI.classify.mockResolvedValue({ data: { suggestions: [] } })
    renderComponent()

    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Laptop computer' }
    })
    fireEvent.change(screen.getByPlaceholderText('classification.materialPlaceholder'), {
      target: { value: 'Aluminum' }
    })
    fireEvent.change(screen.getByPlaceholderText('classification.usePlaceholder'), {
      target: { value: 'Computing' }
    })
    fireEvent.change(screen.getByPlaceholderText('classification.compositionPlaceholder'), {
      target: { value: '80% metal, 20% plastic' }
    })
    fireEvent.change(screen.getByPlaceholderText('classification.originPlaceholder'), {
      target: { value: 'China' }
    })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => {
      expect(classificationAPI.classify).toHaveBeenCalledWith(
        expect.objectContaining({
          additional_info: {
            material: 'Aluminum',
            use: 'Computing',
            composition: '80% metal, 20% plastic',
            origin: 'China'
          }
        })
      )
    })
  })

  test('clasificación básica con error de API muestra toast', async () => {
    classificationAPI.classify.mockRejectedValue(new Error('API down'))
    renderComponent()

    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Test product' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('classification.classifyError'))
  })

  test('muestra warnings en los resultados', async () => {
    classificationAPI.classify.mockResolvedValue({
      data: {
        suggestions: [{ code: '0901210000', description: 'Coffee', confidence: 85 }],
        warnings: ['Additional documentation may be required', 'Check origin restrictions']
      }
    })

    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Coffee' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => {
      expect(screen.getByText('Additional documentation may be required')).toBeInTheDocument()
      expect(screen.getByText('Check origin restrictions')).toBeInTheDocument()
    })
  })

  test('validación de código: llama a validate y muestra resultado positivo', async () => {
    classificationAPI.classify.mockResolvedValue({
      data: { suggestions: [{ code: '0901210000', description: 'Coffee', confidence: 90 }] }
    })
    classificationAPI.validate.mockResolvedValue({
      data: { is_valid: true, reasoning: 'Code matches product characteristics' }
    })

    renderComponent()
    const textarea = screen.getByPlaceholderText('classification.productPlaceholder')
    fireEvent.change(textarea, { target: { value: 'Coffee beans' } })

    const originInput = screen.getByPlaceholderText('classification.originPlaceholder')
    fireEvent.change(originInput, { target: { value: 'BR' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText('0901210000')).toBeInTheDocument())

    const validateButton = screen.getAllByText('classification.validate')[0]
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(classificationAPI.validate).toHaveBeenCalledWith('0901210000', 'Coffee beans', 'BR')
      expect(toast.success).toHaveBeenCalledWith('classification.codeValidatedOk')
    })

    await waitFor(() => {
      expect(screen.getByText('classification.codeValidated')).toBeInTheDocument()
      expect(screen.getByText('Code matches product characteristics')).toBeInTheDocument()
    })
  })

  test('validación de código: resultado negativo muestra error', async () => {
    classificationAPI.classify.mockResolvedValue({
      data: { suggestions: [{ code: '0901110000', description: 'Coffee', confidence: 70 }] }
    })
    classificationAPI.validate.mockResolvedValue({
      data: { is_valid: false, reasoning: 'Code does not match characteristics' }
    })

    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Tea leaves' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText('0901110000')).toBeInTheDocument())

    const validateButton = screen.getAllByText('classification.validate')[0]
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classification.codeMayNotBeCorrect')
      expect(screen.getByText('classification.reviewRequired')).toBeInTheDocument()
    })
  })

  test('validación con error de API muestra toast', async () => {
    classificationAPI.classify.mockResolvedValue({
      data: { suggestions: [{ code: '0901210000', description: 'Coffee', confidence: 90 }] }
    })
    classificationAPI.validate.mockRejectedValue(new Error('Validation failed'))

    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Coffee' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText('0901210000')).toBeInTheDocument())

    const validateButton = screen.getAllByText('classification.validate')[0]
    fireEvent.click(validateButton)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('classification.codeValidationError'))
  })

  test('copiar código al portapapeles', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })

    classificationAPI.classify.mockResolvedValue({
      data: { suggestions: [{ code: '0901210000', description: 'Coffee', confidence: 90 }] }
    })

    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Coffee' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText('0901210000')).toBeInTheDocument())

    const copyButton = screen.getAllByText('classification.copy')[0]
    fireEvent.click(copyButton)

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0901210000'))
  })

  // ==================== ADVANCED TAB ====================
  test('análisis completo IA: botón deshabilitado cuando no hay descripción', async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      expect(screen.getByText('classification.fullAnalysisAI')).toBeInTheDocument()
    })

    const fullAnalysisBtn = screen.getByText('classification.fullAnalysisAI')
    // El botón debe estar deshabilitado
    expect(fullAnalysisBtn.closest('button')).toBeDisabled()

    // No se debe haber llamado a la API
    expect(classificationAPI.aiFullAnalysis).not.toHaveBeenCalled()
  })

  test('análisis completo IA: envía petición y muestra resultado', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: {
            recommendedCode: '0901210000',
            confidence: 92,
            confidenceLevel: 'HIGH',
            readyToUse: true,
            factors: ['+Material match', '+Origin confirmed', '-Minor composition uncertainty']
          },
          suggestions: [
            { taricCode: '0901210000', confidence: 92, reasoning: 'Best match', sources: ['AI', 'DB'] }
          ],
          alerts: [
            { type: 'INFO', message: 'Check certificate requirements', action: 'Verify phytosanitary docs' }
          ],
          nextSteps: [
            { priority: 1, action: 'Submit declaration', reason: 'High confidence' }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee beans from Ethiopia' }
      })
    })

    const fullAnalysisBtn = screen.getByText('classification.fullAnalysisAI')
    fireEvent.click(fullAnalysisBtn)

    await waitFor(() => {
      expect(classificationAPI.aiFullAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Coffee beans from Ethiopia' }),
        expect.any(Object)
      )
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('classification.fullAnalysisComplete')
      expect(screen.getByText('classification.finalAssessment')).toBeInTheDocument()
      // Use getAllByText since code appears multiple times
      expect(screen.getAllByText('0901210000')[0]).toBeInTheDocument()
      expect(screen.getByText('92% classification.confidence')).toBeInTheDocument()
      expect(screen.getByText('classification.readyToUse')).toBeInTheDocument()
    })
  })

  test('análisis completo IA con error muestra toast', async () => {
    classificationAPI.aiFullAnalysis.mockRejectedValue(new Error('AI service unavailable'))

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Test product' }
      })
    })

    const fullAnalysisBtn = screen.getByText('classification.fullAnalysisAI')
    fireEvent.click(fullAnalysisBtn)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('classification.fullAnalysisError'))
  })

  test('análisis completo: muestra factores de confianza', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: {
            recommendedCode: '2204210000',
            confidence: 88,
            confidenceLevel: 'HIGH',
            readyToUse: true,
            factors: [
              '+Origin match: France',
              '+Material: grapes',
              '-Alcohol content not specified'
            ]
          }
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Red wine' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => {
      expect(screen.getByText('+Origin match: France')).toBeInTheDocument()
      expect(screen.getByText('+Material: grapes')).toBeInTheDocument()
      expect(screen.getByText('-Alcohol content not specified')).toBeInTheDocument()
    })
  })

  test('análisis completo: muestra sugerencias consolidadas', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '8471300000', confidence: 85 },
          suggestions: [
            { taricCode: '8471300000', confidence: 85, reasoning: 'Portable digital computers', sources: ['AI', 'DB'] },
            { taricCode: '8471410000', confidence: 70, reasoning: 'Alternative classification', sources: ['AI'] }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Laptop computer' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => {
      expect(screen.getByText('classification.consolidatedSuggestions')).toBeInTheDocument()
      expect(screen.getAllByText('8471300000')[0]).toBeInTheDocument()
      expect(screen.getByText('Portable digital computers')).toBeInTheDocument()
      expect(screen.getByText('8471410000')).toBeInTheDocument()
    })
  })

  test('análisis completo: muestra alertas por tipo', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 80 },
          alerts: [
            { type: 'ERROR', message: 'Missing required field', action: 'Add composition data' },
            { type: 'WARNING', message: 'Low confidence on material', action: 'Verify material type' },
            { type: 'INFO', message: 'Alternative codes available' }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Product' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => {
      expect(screen.getByText('Missing required field')).toBeInTheDocument()
      expect(screen.getByText('Low confidence on material')).toBeInTheDocument()
      expect(screen.getByText('Alternative codes available')).toBeInTheDocument()
    })
  })

  test('análisis completo: muestra pasos siguientes con prioridades', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 75 },
          nextSteps: [
            { priority: 1, action: 'Verify material composition', reason: 'Required for accurate classification' },
            { priority: 2, action: 'Check origin certificates', reason: 'Origin-dependent duties apply' },
            { priority: 3, action: 'Review similar cases', reason: 'Learn from historical data' }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Product' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => {
      expect(screen.getByText('Verify material composition')).toBeInTheDocument()
      expect(screen.getByText('Check origin certificates')).toBeInTheDocument()
      expect(screen.getByText('Review similar cases')).toBeInTheDocument()
    })
  })

  test('validación cruzada: ejecuta y muestra resultado', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 88 },
          suggestions: [{ taricCode: '0901210000', confidence: 88 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: {
            isValid: true,
            overallAssessment: 'CONFIRMED',
            validationScore: 95
          }
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee beans' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())

    const validateBtn = screen.getByText('classification.validateWithRegulation')
    fireEvent.click(validateBtn)

    await waitFor(() => {
      expect(classificationAPI.aiCrossValidate).toHaveBeenCalledWith(
        expect.objectContaining({ taricCode: '0901210000', confidence: 88 }),
        expect.objectContaining({ description: 'Coffee beans' })
      )
      expect(toast.success).toHaveBeenCalledWith('classification.classificationValidated')
    })

    await waitFor(() => {
      expect(screen.getByText('classification.regulatoryValidation')).toBeInTheDocument()
      expect(screen.getByText('classification.confirmed')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
    })
  })

  test('validación cruzada con resultado inválido muestra error', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 60 },
          suggestions: [{ taricCode: '0901210000', confidence: 60 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: {
            isValid: false,
            overallAssessment: 'NEEDS_REVIEW',
            validationScore: 55
          }
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Product' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())

    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classification.classificationReviewRecommended')
    })
  })

  test('validación cruzada con error de API muestra toast', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 85 },
          suggestions: [{ taricCode: '0901210000', confidence: 85 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockRejectedValue(new Error('Validation service down'))

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Product' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())

    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classification.regulationValidationError')
    })
  })

  test('validación cruzada: expande/colapsa secciones RGI', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 85 },
          suggestions: [{ taricCode: '0901210000', confidence: 85 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: { overallAssessment: 'CONFIRMED', validationScore: 90 },
          rgiAnalysis: {
            rgi1_description: { applies: true, assessment: 'Product matches heading description' },
            conclusionRGI: 'Code is correct per RGI 1'
          }
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => expect(screen.getByText('classification.rgiAnalysis')).toBeInTheDocument())

    // Section collapsed by default
    expect(screen.queryByText('Product matches heading description')).not.toBeInTheDocument()

    // Expand
    fireEvent.click(screen.getByText('classification.rgiAnalysis'))
    await waitFor(() => {
      expect(screen.getByText('Product matches heading description')).toBeInTheDocument()
      expect(screen.getByText('Code is correct per RGI 1')).toBeInTheDocument()
    })

    // Collapse
    fireEvent.click(screen.getByText('classification.rgiAnalysis'))
    await waitFor(() => {
      expect(screen.queryByText('Product matches heading description')).not.toBeInTheDocument()
    })
  })

  test('feedback positivo: registra y muestra toast', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 90 }
        }
      }
    })

    classificationAPI.aiRecordFeedback.mockResolvedValue({ data: { success: true } })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => expect(screen.getByText('classification.isCorrect')).toBeInTheDocument())

    const yesButton = screen.getByText('common.yes')
    fireEvent.click(yesButton)

    await waitFor(() => {
      expect(classificationAPI.aiRecordFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ suggestedCode: '0901210000', confidence: 90 }),
        expect.objectContaining({ wasCorrect: true, correctCode: null })
      )
      expect(toast.success).toHaveBeenCalledWith('classification.feedbackConfirmThanks')
    })
  })

  test('feedback negativo: solicita código correcto y registra', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 70 }
        }
      }
    })

    classificationAPI.aiRecordFeedback.mockResolvedValue({ data: { success: true } })

    window.prompt = vi.fn(() => '0901110000')

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))

    await waitFor(() => expect(screen.getByText('classification.isCorrect')).toBeInTheDocument())

    const noButton = screen.getByText('common.no')
    fireEvent.click(noButton)

    await waitFor(() => {
      expect(window.prompt).toHaveBeenCalledWith('classification.whatIsCorrectCode')
      expect(classificationAPI.aiRecordFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ suggestedCode: '0901210000' }),
        expect.objectContaining({ wasCorrect: false, correctCode: '0901110000' })
      )
      expect(toast.success).toHaveBeenCalledWith('classification.feedbackRecorded')
    })
  })

  test('feedback con error de API muestra toast', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 85 }
        }
      }
    })

    classificationAPI.aiRecordFeedback.mockRejectedValue(new Error('Feedback service error'))

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.isCorrect')).toBeInTheDocument())

    fireEvent.click(screen.getByText('common.yes'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classification.feedbackError')
    })
  })

  // ==================== LOOKUP TAB ====================
  test('búsqueda TARIC: validación código vacío', async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
      fireEvent.submit(form)
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('classification.enterTaricCode'))
    expect(classificationAPI.getTaricInfo).not.toHaveBeenCalled()
  })

  test('búsqueda TARIC: validación solo dígitos', async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      expect(screen.getByText('classification.searchByCode')).toBeInTheDocument()
    })

    // El input filtra solo dígitos en onChange, entonces ABC123 se convierte en 123
    // Para probar validación de solo dígitos, necesitamos que el input tenga un valor inválido
    // pero el componente filtra en onChange. Probemos con espacio o algo que no sea dígito
    const input = screen.getByPlaceholderText('classification.codePlaceholder')

    // Cambiar directamente el valor para bypassear el filtro onChange
    Object.defineProperty(input, 'value', { writable: true, value: 'ABC' })
    fireEvent.change(input, { target: { value: 'ABC' } })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  test('búsqueda TARIC: código 2-3 dígitos usa getTreeData', async () => {
    classificationAPI.getTreeData.mockResolvedValue({
      data: {
        data: {
          level: 'headings',
          results: [
            { code: '0901', description: 'Coffee, whether or not roasted', count: 10 },
            { code: '0902', description: 'Tea', count: 8 }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '09' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(classificationAPI.getTreeData).toHaveBeenCalledWith('09')
      expect(screen.getByText('Coffee, whether or not roasted')).toBeInTheDocument()
      expect(screen.getByText('Tea')).toBeInTheDocument()
    })
  })

  test('búsqueda TARIC: capítulo sin códigos locales muestra mensaje', async () => {
    classificationAPI.getTreeData.mockResolvedValue({
      data: { data: { level: 'headings', results: [] } }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '84' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      // toast() sin error/success, es toast.default que no está mockeado
      // Verificar que se llamó getTreeData
      expect(classificationAPI.getTreeData).toHaveBeenCalledWith('84')
    })
  })

  test('búsqueda TARIC: capítulo inválido muestra error', async () => {
    classificationAPI.getTreeData.mockResolvedValue({
      data: { data: { level: 'headings', results: [] } }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '99' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  test('búsqueda TARIC: código 4+ dígitos usa getTaricInfo', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '0901210000',
          description: 'Coffee, not roasted, not decaffeinated',
          chapter: '09',
          heading: '0901',
          dutyRate: '7.5%',
          found: true,
          source: 'local'
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '0901210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(classificationAPI.getTaricInfo).toHaveBeenCalledWith('0901210000')
      expect(screen.getByText('0901210000')).toBeInTheDocument()
      expect(screen.getByText('Coffee, not roasted, not decaffeinated')).toBeInTheDocument()
      expect(screen.getByText('7.5%')).toBeInTheDocument()
    })
  })

  test('búsqueda TARIC: código no encontrado muestra error', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: { data: { found: false, message: 'Code not found in database' } }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '9999999999' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Code not found in database')
    })
  })

  test('búsqueda TARIC con error 404 muestra mensaje específico', async () => {
    classificationAPI.getTaricInfo.mockRejectedValue({
      response: { status: 404 }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '1234567890' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classification.codeNotFoundTaric')
    })
  })

  test('búsqueda TARIC con error de red muestra mensaje genérico', async () => {
    classificationAPI.getTaricInfo.mockRejectedValue(new Error('Network error'))

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '0901210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classification.errorSearchingCode')
    })
  })

  test('drill-down en resultados de capítulo: código intermedio', async () => {
    classificationAPI.getTreeData
      .mockResolvedValueOnce({
        data: {
          data: {
            level: 'headings',
            results: [{ code: '0901', description: 'Coffee', count: 5 }]
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            level: 'subheadings',
            results: [
              { code: '090121', description: 'Not decaffeinated', count: 2 },
              { code: '090122', description: 'Decaffeinated', count: 1 }
            ]
          }
        }
      })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '09' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('Coffee')).toBeInTheDocument())

    // Click drill-down
    const drillButton = screen.getByText('Coffee').closest('button')
    fireEvent.click(drillButton)

    await waitFor(() => {
      expect(classificationAPI.getTreeData).toHaveBeenCalledWith('0901')
      expect(screen.getByText('Not decaffeinated')).toBeInTheDocument()
      expect(screen.getByText('Decaffeinated')).toBeInTheDocument()
    })
  })

  test('drill-down en código hoja (10 dígitos) cambia a vista de detalle', async () => {
    classificationAPI.getTreeData.mockResolvedValue({
      data: {
        data: {
          level: 'headings',
          results: [{ code: '0901210000', description: 'Coffee, not roasted', count: 0 }]
        }
      }
    })

    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '0901210000',
          description: 'Coffee, not roasted, not decaffeinated',
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '09' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('Coffee, not roasted')).toBeInTheDocument())

    // Click en código hoja
    const leafButton = screen.getByText('Coffee, not roasted').closest('button')
    fireEvent.click(leafButton)

    await waitFor(() => {
      expect(classificationAPI.getTaricInfo).toHaveBeenCalledWith('0901210000')
      expect(screen.getByText('Coffee, not roasted, not decaffeinated')).toBeInTheDocument()
    })
  })

  test('usar código de lookup en clasificador básico', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '2204210000',
          description: 'Wine of fresh grapes',
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '2204210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('Wine of fresh grapes')).toBeInTheDocument())

    const useBasicBtn = screen.getByText('classification.useInBasicClassifier')
    fireEvent.click(useBasicBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('classification.descCopiedBasic')
      // Check that we switched to basic tab
      const basicTab = screen.getByRole('button', { name: /classification.basic/i })
      expect(basicTab).toHaveClass('bg-white')
    })
  })

  test('usar código de lookup en análisis IA avanzado', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '8471300000',
          description: 'Portable digital computers',
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '8471300000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByText('Portable digital computers')).toBeInTheDocument())

    const useAdvancedBtn = screen.getByText('classification.useInAIAnalysis')
    fireEvent.click(useAdvancedBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('classification.descCopiedAdvanced')
      const advancedTab = screen.getByRole('button', { name: /classification.advanced/i })
      expect(advancedTab).toHaveClass('bg-white')
    })
  })

  // ==================== TREE TAB ====================
  test('tree tab: renderiza TaricTreeBrowser y maneja selección', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '0901210000',
          description: 'Coffee, not roasted',
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.exploreTree/i }))

    await waitFor(() => {
      expect(screen.getByTestId('taric-tree-browser')).toBeInTheDocument()
    })

    const selectButton = screen.getByText('Select Code')
    fireEvent.click(selectButton)

    await waitFor(() => {
      // Should switch to lookup tab
      expect(screen.getByText('classification.searchByCode')).toBeInTheDocument()
    })

    // Wait for automatic lookup
    await waitFor(() => {
      expect(classificationAPI.getTaricInfo).toHaveBeenCalledWith('0901210000')
    }, { timeout: 3000 })
  })

  // ==================== HISTORY & MOST SEARCHED ====================
  test('click en item del historial activa lookup tab y ejecuta búsqueda', async () => {
    classificationAPI.getSearchHistory.mockResolvedValue({
      data: {
        data: {
          history: [{ code: '6109100010', source: 'local_db', description: 'T-shirts' }]
        }
      }
    })

    classificationAPI.getTaricInfo.mockResolvedValue({
      data: { data: { code: '6109100010', description: 'T-shirts of cotton', found: true } }
    })

    renderComponent()

    await waitFor(() => expect(screen.getByText('6109100010')).toBeInTheDocument())

    const historyButton = screen.getByText('6109100010').closest('button')
    fireEvent.click(historyButton)

    await waitFor(() => {
      // Should be in lookup tab now
      expect(screen.getByText('classification.searchByCode')).toBeInTheDocument()
    })
  })

  test('click en código más buscado activa lookup tab', async () => {
    classificationAPI.getMostSearched.mockResolvedValue({
      data: {
        data: {
          codes: [{ _id: '9503007000', count: 25, description: 'Toys' }]
        }
      }
    })

    renderComponent()

    await waitFor(() => expect(screen.getByText('9503007000')).toBeInTheDocument())

    const mostSearchedButton = screen.getByText('9503007000').closest('button')
    fireEvent.click(mostSearchedButton)

    await waitFor(() => {
      expect(screen.getByText('classification.searchByCode')).toBeInTheDocument()
    })
  })

  // ==================== CONFIDENCE & ASSESSMENT COLORS ====================
  test.each([
    [95, 'text-green-600 bg-green-100'],
    [75, 'text-yellow-600 bg-yellow-100'],
    [45, 'text-red-600 bg-red-100']
  ])('getConfidenceColor con confidence=%s aplica clase %s', async (confidence, expectedClass) => {
    classificationAPI.classify.mockResolvedValue({
      data: {
        suggestions: [{ code: '0901210000', description: 'Coffee', confidence }]
      }
    })

    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Test' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => {
      const badge = screen.getByText(`${confidence}%`)
      expect(badge.className).toContain(expectedClass.split(' ')[0])
    })
  })

  test.each([
    ['CONFIRMED', 'text-green-600 bg-green-100', 'confirmed'],
    ['LIKELY_CORRECT', 'text-blue-600 bg-blue-100', 'likelyCorrect'],
    ['NEEDS_REVIEW', 'text-yellow-600 bg-yellow-100', 'needsReviewAssessment'],
    ['LIKELY_INCORRECT', 'text-orange-600 bg-orange-100', 'likelyIncorrect'],
    ['INVALID', 'text-red-600 bg-red-100', 'invalid']
  ])('getAssessmentColor con assessment=%s aplica clase %s', async (assessment, expectedClass, translationKey) => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 85 },
          suggestions: [{ taricCode: '0901210000', confidence: 85 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: { overallAssessment: assessment, validationScore: 80 }
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Product' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => {
      const assessmentBadge = screen.getByText(`classification.${translationKey}`)
      expect(assessmentBadge.closest('span').className).toContain(expectedClass.split(' ')[0])
    })
  })

  // ==================== EDGE CASES ====================
  test('resultado de lookup con jerarquía completa', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '0901210000',
          description: 'Coffee, not roasted',
          chapter: '09',
          heading: '0901',
          subheading: '090121',
          hierarchy: [
            { code: '09', description: 'Coffee, tea, mate and spices' },
            { code: '0901', description: 'Coffee' }
          ],
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '0901210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('classification.hierarchy')).toBeInTheDocument()
      // Use getAllByText for repeated codes
      expect(screen.getAllByText('09')[0]).toBeInTheDocument()
      expect(screen.getAllByText('0901')[0]).toBeInTheDocument()
      expect(screen.getByText('090121')).toBeInTheDocument()
    })
  })

  test('resultado de lookup con medidas aduaneras', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '2204210000',
          description: 'Wine',
          dutyRate: '15%',
          duties: { MFN: '15%', GSP: '0%' },
          measures: [
            { description: 'Certificate of origin required' },
            'Sanitary inspection mandatory'
          ],
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '2204210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('classification.tariffsAndMeasures')).toBeInTheDocument()
      // Use getAllByText since 15% appears multiple times
      expect(screen.getAllByText('15%')[0]).toBeInTheDocument()
      expect(screen.getByText('Certificate of origin required')).toBeInTheDocument()
      expect(screen.getByText('Sanitary inspection mandatory')).toBeInTheDocument()
    })
  })

  test('resultado de lookup con notas', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '0901210000',
          description: 'Coffee',
          notes: 'This classification requires additional documentation for some origins',
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '0901210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('classification.notes')).toBeInTheDocument()
      expect(screen.getByText('This classification requires additional documentation for some origins')).toBeInTheDocument()
    })
  })

  test('validación cruzada: secciones expandibles (chapter notes, special measures, alternatives)', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 85 },
          suggestions: [{ taricCode: '0901210000', confidence: 85 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: { overallAssessment: 'CONFIRMED', validationScore: 90 },
          chapterNotes: {
            sectionNotes: ['Section note 1'],
            chapterNotes: ['Chapter note 1'],
            inclusions: ['Coffee beans'],
            exclusions: ['Tea']
          },
          specialMeasures: {
            antidumping: { applies: true },
            quota: { applies: false },
            suspension: { applies: false },
            safeguard: { applies: false }
          },
          alternativeClassifications: [
            { taricCode: '0901110000', probability: 30, reasoning: 'If roasted', differentiatingFactor: 'Processing state' }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => {
      expect(screen.getByText('classification.sectionChapterNotes')).toBeInTheDocument()
      expect(screen.getByText('classification.specialMeasures')).toBeInTheDocument()
      expect(screen.getByText(/classification.alternativeClassifications/)).toBeInTheDocument()
    })

    // Expand chapter notes
    fireEvent.click(screen.getByText('classification.sectionChapterNotes'))
    await waitFor(() => {
      expect(screen.getByText('Section note 1')).toBeInTheDocument()
      expect(screen.getByText('Coffee beans')).toBeInTheDocument()
    })

    // Expand special measures
    fireEvent.click(screen.getByText('classification.specialMeasures'))
    await waitFor(() => {
      expect(screen.getByText('classification.antidumping')).toBeInTheDocument()
    })

    // Expand alternatives
    fireEvent.click(screen.getByText(/classification.alternativeClassifications/))
    await waitFor(() => {
      expect(screen.getByText('0901110000')).toBeInTheDocument()
      expect(screen.getByText('If roasted')).toBeInTheDocument()
    })
  })

  test('validación cruzada: requerimientos de documentación', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 85 },
          suggestions: [{ taricCode: '0901210000', confidence: 85 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: { overallAssessment: 'CONFIRMED', validationScore: 88 },
          documentationRequirements: [
            { code: 'CERT001', document: 'Certificate of origin', mandatory: true },
            { code: 'CERT002', document: 'Quality certificate', mandatory: false }
          ]
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => {
      expect(screen.getByText('classification.documentationRequired')).toBeInTheDocument()
      expect(screen.getByText('Certificate of origin')).toBeInTheDocument()
      expect(screen.getByText('Quality certificate')).toBeInTheDocument()
      expect(screen.getByText('(classification.mandatory)')).toBeInTheDocument()
    })
  })

  test('validación cruzada: recomendación final positiva y negativa', async () => {
    classificationAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        data: {
          finalAssessment: { recommendedCode: '0901210000', confidence: 92 },
          suggestions: [{ taricCode: '0901210000', confidence: 92 }]
        }
      }
    })

    classificationAPI.aiCrossValidate.mockResolvedValue({
      data: {
        data: {
          validationResult: { overallAssessment: 'CONFIRMED', validationScore: 95 },
          finalRecommendation: {
            proceed: true,
            summary: 'Classification is highly reliable',
            actions: ['Submit declaration', 'Archive documentation']
          }
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.advanced/i }))

    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
        target: { value: 'Coffee' }
      })
    })

    fireEvent.click(screen.getByText('classification.fullAnalysisAI'))
    await waitFor(() => expect(screen.getByText('classification.validateWithRegulation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('classification.validateWithRegulation'))

    await waitFor(() => {
      expect(screen.getByText('classification.recommendProceed')).toBeInTheDocument()
      expect(screen.getByText('Classification is highly reliable')).toBeInTheDocument()
      expect(screen.getByText('Submit declaration')).toBeInTheDocument()
    })
  })

  test('descripción como objeto {es, en} se extrae correctamente', async () => {
    classificationAPI.getTaricInfo.mockResolvedValue({
      data: {
        data: {
          code: '0901210000',
          description: { es: 'Café sin tostar', en: 'Coffee, not roasted' },
          found: true
        }
      }
    })

    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /classification.lookupCode/i }))

    await waitFor(() => {
      const input = screen.getByPlaceholderText('classification.codePlaceholder')
      fireEvent.change(input, { target: { value: '0901210000' } })
    })

    const form = screen.getByText('classification.searchByCode').closest('div').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Café sin tostar')).toBeInTheDocument()
    })
  })

  test('no muestra sección si está vacía', async () => {
    classificationAPI.classify.mockResolvedValue({
      data: {
        suggestions: [{ code: '0901210000', description: 'Coffee', confidence: 90 }]
      }
    })

    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('classification.productPlaceholder'), {
      target: { value: 'Coffee' }
    })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText('0901210000')).toBeInTheDocument())

    // No debe haber warnings ya que no se enviaron
    expect(screen.queryByText('classification.warnings')).not.toBeInTheDocument()
  })
})
