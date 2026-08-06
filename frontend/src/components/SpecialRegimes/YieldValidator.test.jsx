import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import YieldValidator from './YieldValidator'
import { specialRegimesAPI } from '../../services/api'
import toast from 'react-hot-toast'

// Mock de react-hot-toast
vi.mock('react-hot-toast', () => {
  const toastFn = vi.fn()
  toastFn.success = vi.fn()
  toastFn.error = vi.fn()
  return {
    default: toastFn
  }
})

// Mock de react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock de specialRegimesAPI
vi.mock('../../services/api', () => ({
  specialRegimesAPI: {
    aiValidateYield: vi.fn()
  }
}))

// Mock de heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  SparklesIcon: () => <span data-testid="sparkles-icon" />,
  CheckCircleIcon: () => <span data-testid="check-circle-icon" />,
  ExclamationTriangleIcon: () => <span data-testid="exclamation-icon" />,
  XMarkIcon: () => <span data-testid="x-mark-icon" />,
  PlusIcon: () => <span data-testid="plus-icon" />,
  TrashIcon: () => <span data-testid="trash-icon" />,
  BeakerIcon: () => <span data-testid="beaker-icon" />
}))

describe('YieldValidator', () => {
  let onCloseMock

  beforeEach(() => {
    vi.clearAllMocks()
    onCloseMock = vi.fn()
  })

  describe('Renderizado inicial', () => {
    it('debe renderizar el modal con el título y subtítulo', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      expect(screen.getByText('specialRegimes.yieldValidatorTitle')).toBeInTheDocument()
      expect(screen.getByText('specialRegimes.yieldValidatorSubtitle')).toBeInTheDocument()
    })

    it('debe renderizar el botón de cerrar', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const closeButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="x-mark-icon"]'))
      expect(closeButton).toBeInTheDocument()
    })

    it('debe renderizar con datos vacíos si no se proporciona regimeData', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      expect(screen.getByText('Materias Primas (Entrada)')).toBeInTheDocument()
      expect(screen.getByText('Productos Compensadores (Salida)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Descripcion')).toBeInTheDocument()
    })

    it('debe inicializar con datos de regimeData cuando se proporcionan', () => {
      const regimeData = {
        goods: [{
          description: 'Material A',
          taricCode: '12345678',
          quantity: 100,
          unitOfMeasure: 'KGM',
          netWeight: 50,
          customsValue: 1000
        }],
        inwardProcessing: {
          mainCompensatingProducts: [{
            description: 'Producto Final',
            taricCode: '87654321',
            expectedQuantity: 85
          }],
          authorizedOperations: ['assembly'],
          yieldRate: 90,
          yieldMethod: 'calculated',
          wasteLoss: {
            expectedPercent: 10
          }
        }
      }

      render(<YieldValidator onClose={onCloseMock} regimeData={regimeData} />)

      const descriptionInputs = screen.getAllByPlaceholderText('Descripcion')
      expect(descriptionInputs[0]).toHaveValue('Material A')
    })
  })

  describe('Interacción - Botón cerrar', () => {
    it('debe llamar a onClose cuando se hace clic en el botón X', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const closeButtons = screen.getAllByRole('button')
      const xButton = closeButtons.find(btn => btn.querySelector('[data-testid="x-mark-icon"]'))
      fireEvent.click(xButton)

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    it('debe llamar a onClose cuando se hace clic en el botón Cerrar del footer', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const closeButton = screen.getByRole('button', { name: /Cerrar/i })
      fireEvent.click(closeButton)

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Gestión de materias primas (input_goods)', () => {
    it('debe añadir una materia prima al hacer clic en Anadir', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const addButtons = screen.getAllByRole('button', { name: /Anadir/i })
      const addInputButton = addButtons[0]

      fireEvent.click(addInputButton)

      const descriptionInputs = screen.getAllByPlaceholderText('Descripcion')
      expect(descriptionInputs.length).toBeGreaterThan(1)
    })

    it('debe actualizar el campo description de una materia prima', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const descriptionInput = screen.getAllByPlaceholderText('Descripcion')[0]
      fireEvent.change(descriptionInput, { target: { value: 'Nueva descripción' } })

      expect(descriptionInput).toHaveValue('Nueva descripción')
    })

    it('debe actualizar el campo taric_code de una materia prima', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const taricInput = screen.getAllByPlaceholderText('TARIC')[0]
      fireEvent.change(taricInput, { target: { value: '12345678' } })

      expect(taricInput).toHaveValue('12345678')
    })

    it('debe actualizar el campo quantity de una materia prima', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const quantityInput = screen.getAllByPlaceholderText('Cantidad')[0]
      fireEvent.change(quantityInput, { target: { value: '100' } })

      expect(quantityInput).toHaveValue(100)
    })

    it('debe actualizar el campo weight de una materia prima', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const weightInput = screen.getAllByPlaceholderText('Peso kg')[0]
      fireEvent.change(weightInput, { target: { value: '50' } })

      expect(weightInput).toHaveValue(50)
    })

    it('debe eliminar una materia prima cuando hay más de una', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      // Añadir una materia prima adicional
      const addButtons = screen.getAllByRole('button', { name: /Anadir/i })
      fireEvent.click(addButtons[0])

      // Verificar que hay 2 materias primas
      let descriptionInputs = screen.getAllByPlaceholderText('Descripcion')
      expect(descriptionInputs.length).toBeGreaterThan(1)

      // Eliminar la segunda
      const trashButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('[data-testid="trash-icon"]') && !btn.disabled
      )
      fireEvent.click(trashButtons[0])

      // Verificar que queda una
      descriptionInputs = screen.getAllByPlaceholderText('Descripcion')
      expect(descriptionInputs.length).toBeGreaterThanOrEqual(1)
    })

    it('NO debe eliminar una materia prima cuando solo hay una', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const initialDescriptions = screen.getAllByPlaceholderText('Descripcion')
      const initialCount = initialDescriptions.length

      // Intentar eliminar (el botón debe estar deshabilitado)
      const trashButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('[data-testid="trash-icon"]')
      )
      const firstTrash = trashButtons[0]

      expect(firstTrash).toBeDisabled()
      fireEvent.click(firstTrash)

      const afterDescriptions = screen.getAllByPlaceholderText('Descripcion')
      expect(afterDescriptions.length).toBe(initialCount)
    })
  })

  describe('Gestión de productos compensadores (output_goods)', () => {
    it('debe añadir un producto compensador al hacer clic en Anadir', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const addButtons = screen.getAllByRole('button', { name: /Anadir/i })
      const addOutputButton = addButtons[1]

      fireEvent.click(addOutputButton)

      const productInputs = screen.getAllByPlaceholderText('Descripcion producto final')
      expect(productInputs.length).toBeGreaterThan(1)
    })

    it('debe actualizar el campo description de un producto compensador', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const descriptionInput = screen.getByPlaceholderText('Descripcion producto final')
      fireEvent.change(descriptionInput, { target: { value: 'Producto terminado' } })

      expect(descriptionInput).toHaveValue('Producto terminado')
    })

    it('debe actualizar el campo taric_code de un producto compensador', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const taricInputs = screen.getAllByPlaceholderText('TARIC')
      const outputTaric = taricInputs[1]
      fireEvent.change(outputTaric, { target: { value: '87654321' } })

      expect(outputTaric).toHaveValue('87654321')
    })

    it('debe actualizar el campo quantity de un producto compensador', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const quantityInputs = screen.getAllByPlaceholderText(/Cantidad/)
      const outputQuantity = quantityInputs[1]
      fireEvent.change(outputQuantity, { target: { value: '85' } })

      expect(outputQuantity).toHaveValue(85)
    })

    it('debe eliminar un producto compensador cuando hay más de uno', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      // Añadir un producto compensador adicional
      const addButtons = screen.getAllByRole('button', { name: /Anadir/i })
      fireEvent.click(addButtons[1])

      // Verificar que hay 2 productos compensadores
      let productInputs = screen.getAllByPlaceholderText('Descripcion producto final')
      expect(productInputs.length).toBeGreaterThan(1)

      // Eliminar uno
      const trashButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('[data-testid="trash-icon"]') && !btn.disabled
      )
      fireEvent.click(trashButtons[trashButtons.length - 1])

      productInputs = screen.getAllByPlaceholderText('Descripcion producto final')
      expect(productInputs.length).toBeGreaterThanOrEqual(1)
    })

    it('NO debe eliminar un producto compensador cuando solo hay uno', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const initialProducts = screen.getAllByPlaceholderText('Descripcion producto final')
      const initialCount = initialProducts.length

      const trashButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('[data-testid="trash-icon"]')
      )
      const lastTrash = trashButtons[trashButtons.length - 1]

      expect(lastTrash).toBeDisabled()
      fireEvent.click(lastTrash)

      const afterProducts = screen.getAllByPlaceholderText('Descripcion producto final')
      expect(afterProducts.length).toBe(initialCount)
    })
  })

  describe('Campos de proceso', () => {
    it('debe actualizar el tipo de proceso', () => {
      const { container } = render(<YieldValidator onClose={onCloseMock} />)

      const processTypeSelect = container.querySelectorAll('select')[0]
      fireEvent.change(processTypeSelect, { target: { value: 'manufacturing' } })

      expect(processTypeSelect).toHaveValue('manufacturing')
    })

    it('debe actualizar el sector industrial', () => {
      const { container } = render(<YieldValidator onClose={onCloseMock} />)

      const sectorSelect = container.querySelectorAll('select')[1]
      fireEvent.change(sectorSelect, { target: { value: 'electronics' } })

      expect(sectorSelect).toHaveValue('electronics')
    })

    it('debe actualizar la descripción del proceso', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const processDescription = screen.getByPlaceholderText('Describe el proceso de transformacion...')
      fireEvent.change(processDescription, { target: { value: 'Proceso de ensamblaje complejo' } })

      expect(processDescription).toHaveValue('Proceso de ensamblaje complejo')
    })

    it('debe actualizar la tasa de rendimiento propuesta', () => {
      const { container } = render(<YieldValidator onClose={onCloseMock} />)

      // Dentro de bg-blue-50, primer input type="number"
      const yieldRateInput = container.querySelector('.bg-blue-50 input[type="number"]')
      fireEvent.change(yieldRateInput, { target: { value: '92' } })

      expect(yieldRateInput).toHaveValue(92)
    })

    it('debe actualizar las pérdidas/desperdicios estimados', () => {
      const { container } = render(<YieldValidator onClose={onCloseMock} />)

      // Dentro de bg-blue-50, segundo input type="number"
      const wasteInput = container.querySelectorAll('.bg-blue-50 input[type="number"]')[1]
      fireEvent.change(wasteInput, { target: { value: '8' } })

      expect(wasteInput).toHaveValue(8)
    })

    it('debe actualizar el método de cálculo', () => {
      const { container } = render(<YieldValidator onClose={onCloseMock} />)

      // Dentro de bg-blue-50, select
      const methodSelect = container.querySelector('.bg-blue-50 select')
      fireEvent.change(methodSelect, { target: { value: 'actual' } })

      expect(methodSelect).toHaveValue('actual')
    })
  })

  describe('Validación con IA - Respuesta exitosa', () => {
    it('debe llamar a aiValidateYield con los datos del formulario', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 95,
            suggested_yield_rate: 90,
            analysis: 'Tasa de rendimiento razonable'
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      // Llenar algunos datos
      const descriptionInput = screen.getAllByPlaceholderText('Descripcion')[0]
      fireEvent.change(descriptionInput, { target: { value: 'Material Test' } })

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(specialRegimesAPI.aiValidateYield).toHaveBeenCalledTimes(1)
      })

      expect(specialRegimesAPI.aiValidateYield).toHaveBeenCalledWith(
        expect.objectContaining({
          input_goods: expect.any(Array),
          output_goods: expect.any(Array),
          process_type: expect.any(String),
          proposed_yield_rate: expect.any(Number),
          estimated_waste: expect.any(Number)
        })
      )
    })

    it('debe mostrar el resultado de validación exitosa', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 95,
            suggested_yield_rate: 90,
            analysis: 'Tasa de rendimiento razonable para el proceso'
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Tasa de rendimiento valida')).toBeInTheDocument()
      })

      expect(screen.getByText('Confianza: 95% | Tasa sugerida: 90%')).toBeInTheDocument()
      expect(screen.getByText('Tasa de rendimiento razonable para el proceso')).toBeInTheDocument()
    })

    it('debe mostrar el resultado de validación no válida', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: false,
            confidence: 85,
            suggested_yield_rate: 75,
            analysis: 'Tasa de rendimiento cuestionable, muy alta para el sector'
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Tasa de rendimiento cuestionable')).toBeInTheDocument()
      })

      expect(screen.getByText('Confianza: 85% | Tasa sugerida: 75%')).toBeInTheDocument()
    })

    it('debe mostrar información de waste_allowance cuando está presente', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 90,
            suggested_yield_rate: 85,
            analysis: 'Análisis completo',
            waste_allowance: {
              percentage: 12,
              justification: 'Pérdidas típicas en procesos de corte'
            }
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Perdidas permitidas:')).toBeInTheDocument()
      })

      expect(screen.getByText('12%')).toBeInTheDocument()
      expect(screen.getByText('Pérdidas típicas en procesos de corte')).toBeInTheDocument()
    })

    it('debe mostrar información de industry_benchmarks cuando está presente', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 88,
            suggested_yield_rate: 85,
            analysis: 'Análisis de sector',
            industry_benchmarks: {
              typical_range: '80-90%',
              source: 'Industria textil europea'
            }
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Referencia del sector:')).toBeInTheDocument()
      })

      expect(screen.getByText('80-90%')).toBeInTheDocument()
      expect(screen.getByText('Fuente: Industria textil europea')).toBeInTheDocument()
    })

    it('debe mostrar recomendaciones cuando están presentes', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: false,
            confidence: 80,
            suggested_yield_rate: 70,
            analysis: 'Requiere revisión',
            recommendations: [
              'Revisar los cálculos de rendimiento',
              'Considerar pérdidas adicionales en el proceso'
            ]
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Recomendaciones:')).toBeInTheDocument()
      })

      expect(screen.getByText('- Revisar los cálculos de rendimiento')).toBeInTheDocument()
      expect(screen.getByText('- Considerar pérdidas adicionales en el proceso')).toBeInTheDocument()
    })

    it('debe mostrar documentación requerida cuando está presente', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 92,
            suggested_yield_rate: 85,
            analysis: 'Validación completa',
            documentation_needed: [
              'Especificaciones técnicas del proceso',
              'Certificados de calidad ISO 9001'
            ]
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Documentacion requerida:')).toBeInTheDocument()
      })

      expect(screen.getByText('- Especificaciones técnicas del proceso')).toBeInTheDocument()
      expect(screen.getByText('- Certificados de calidad ISO 9001')).toBeInTheDocument()
    })

    it('debe deshabilitar el botón Validar durante la carga', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 90,
            suggested_yield_rate: 85,
            analysis: 'Análisis OK'
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
      )

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      expect(validateButton).toBeDisabled()
      expect(screen.getByText('Validando...')).toBeInTheDocument()

      await waitFor(() => {
        expect(validateButton).not.toBeDisabled()
      })
    })
  })

  describe('Validación con IA - Respuesta no exitosa', () => {
    it('debe mostrar toast de error cuando success es false', async () => {
      const mockResponse = {
        data: {
          success: false
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al validar la tasa de rendimiento')
      })
    })

    it('NO debe mostrar el resultado de validación cuando success es false', async () => {
      const mockResponse = {
        data: {
          success: false
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      expect(screen.queryByText('Tasa de rendimiento valida')).not.toBeInTheDocument()
      expect(screen.queryByText('Tasa de rendimiento cuestionable')).not.toBeInTheDocument()
    })
  })

  describe('Validación con IA - Errores de red', () => {
    it('debe mostrar toast de error cuando falla la conexión', async () => {
      specialRegimesAPI.aiValidateYield.mockRejectedValue(new Error('Network error'))

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al conectar con el servicio de IA')
      })
    })

    it('debe habilitar el botón después de un error', async () => {
      specialRegimesAPI.aiValidateYield.mockRejectedValue(new Error('Network error'))

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      expect(validateButton).not.toBeDisabled()
    })
  })

  describe('Cobertura de ramas - arrays vacíos', () => {
    it('debe manejar recommendations como array vacío', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 90,
            suggested_yield_rate: 85,
            analysis: 'Sin recomendaciones',
            recommendations: []
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Sin recomendaciones')).toBeInTheDocument()
      })

      expect(screen.queryByText('Recomendaciones:')).not.toBeInTheDocument()
    })

    it('debe manejar documentation_needed como array vacío', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 90,
            suggested_yield_rate: 85,
            analysis: 'Sin documentación requerida',
            documentation_needed: []
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Sin documentación requerida')).toBeInTheDocument()
      })

      expect(screen.queryByText('Documentacion requerida:')).not.toBeInTheDocument()
    })
  })

  describe('Cobertura de ramas - valores undefined', () => {
    it('debe manejar waste_allowance undefined', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 90,
            suggested_yield_rate: 85,
            analysis: 'Sin allowance'
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Sin allowance')).toBeInTheDocument()
      })

      expect(screen.queryByText('Perdidas permitidas:')).not.toBeInTheDocument()
    })

    it('debe manejar industry_benchmarks undefined', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            yield_rate_valid: true,
            confidence: 90,
            suggested_yield_rate: 85,
            analysis: 'Sin benchmarks'
          }
        }
      }

      specialRegimesAPI.aiValidateYield.mockResolvedValue(mockResponse)

      render(<YieldValidator onClose={onCloseMock} />)

      const validateButton = screen.getByRole('button', { name: /Validar con IA/i })
      fireEvent.click(validateButton)

      await waitFor(() => {
        expect(screen.getByText('Sin benchmarks')).toBeInTheDocument()
      })

      expect(screen.queryByText('Referencia del sector:')).not.toBeInTheDocument()
    })
  })

  describe('Parseado de números en inputs', () => {
    it('debe parsear correctamente quantity en input goods', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const quantityInput = screen.getAllByPlaceholderText('Cantidad')[0]
      fireEvent.change(quantityInput, { target: { value: '123.45' } })

      expect(quantityInput).toHaveValue(123.45)
    })

    it('debe parsear correctamente weight en input goods', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const weightInput = screen.getAllByPlaceholderText('Peso kg')[0]
      fireEvent.change(weightInput, { target: { value: '67.89' } })

      expect(weightInput).toHaveValue(67.89)
    })

    it('debe parsear correctamente quantity en output goods', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const quantityInputs = screen.getAllByPlaceholderText(/Cantidad/)
      const outputQuantity = quantityInputs[1]
      fireEvent.change(outputQuantity, { target: { value: '98.76' } })

      expect(outputQuantity).toHaveValue(98.76)
    })

    it('debe parsear correctamente weight en output goods', () => {
      render(<YieldValidator onClose={onCloseMock} />)

      const weightInputs = screen.getAllByPlaceholderText('Peso kg')
      const outputWeight = weightInputs[1]
      fireEvent.change(outputWeight, { target: { value: '54.32' } })

      expect(outputWeight).toHaveValue(54.32)
    })
  })

  describe('Inicialización desde regimeData con valores null/undefined', () => {
    it('debe manejar goods con valores null', () => {
      const regimeData = {
        goods: [{
          description: null,
          taricCode: null,
          quantity: null,
          unitOfMeasure: null,
          netWeight: null,
          customsValue: null
        }]
      }

      render(<YieldValidator onClose={onCloseMock} regimeData={regimeData} />)

      const descriptionInput = screen.getAllByPlaceholderText('Descripcion')[0]
      expect(descriptionInput).toHaveValue('')
    })

    it('debe manejar inwardProcessing parcialmente definido', () => {
      const regimeData = {
        inwardProcessing: {
          mainCompensatingProducts: null,
          authorizedOperations: null,
          yieldRate: null,
          wasteLoss: null
        }
      }

      render(<YieldValidator onClose={onCloseMock} regimeData={regimeData} />)

      const productInput = screen.getByPlaceholderText('Descripcion producto final')
      expect(productInput).toHaveValue('')
    })

    it('debe manejar regimeData sin goods ni inwardProcessing', () => {
      const regimeData = {}

      render(<YieldValidator onClose={onCloseMock} regimeData={regimeData} />)

      const descriptionInputs = screen.getAllByPlaceholderText('Descripcion')
      expect(descriptionInputs[0]).toHaveValue('')
    })
  })
})
