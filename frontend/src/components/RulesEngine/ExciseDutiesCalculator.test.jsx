import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExciseDutiesCalculator from './ExciseDutiesCalculator'
import { exciseAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() })
}))

vi.mock('../../services/api', () => ({
  exciseAPI: {
    detect: vi.fn(),
    calculate: vi.fn()
  }
}))

describe('<ExciseDutiesCalculator />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const getTaricInput = () => screen.getByPlaceholderText(/ej\. 2203000010 \(cerveza\)/i)
  const getDescriptionInput = () => screen.getByPlaceholderText(/Descripción del producto/i)
  const getQuantityInput = () => screen.getByPlaceholderText(/1000/i)
  const getAlcoholContentInput = () => screen.getByPlaceholderText(/5\.0/i)
  const getPriceInput = () => screen.getByPlaceholderText(/5000\.00/i)

  describe('Renderizado inicial', () => {
    test('renderiza el título y sección de detección', () => {
      render(<ExciseDutiesCalculator />)
      expect(screen.getByText('excise.title')).toBeInTheDocument()
      expect(screen.getByText('excise.subtitle')).toBeInTheDocument()
      expect(screen.getByText('1. Detectar Producto')).toBeInTheDocument()
      expect(screen.getByText('Código TARIC *')).toBeInTheDocument()
    })

    test('muestra placeholder sin resultados', () => {
      render(<ExciseDutiesCalculator />)
      expect(screen.getByText(/Ingrese un código TARIC para detectar/i)).toBeInTheDocument()
    })

    test('renderiza info SILICIE', () => {
      render(<ExciseDutiesCalculator />)
      expect(screen.getByText(/Sistema SILICIE:/i)).toBeInTheDocument()
      expect(screen.getByText(/Alcohol: Ley 38\/1992/i)).toBeInTheDocument()
    })
  })

  describe('handleDetect - Validación', () => {
    test('validación: taricCode vacío muestra toast error y no llama API', async () => {
      render(<ExciseDutiesCalculator />)
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ingrese un código TARIC'))
      expect(exciseAPI.detect).not.toHaveBeenCalled()
    })
  })

  describe('handleDetect - Detección exitosa sujeto', () => {
    test('detección: producto sujeto ALCOHOL muestra toast success con categoryName', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza con bajo contenido alcohólico',
            taricRange: '2203-2208'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalledWith({ taricCode: '2203000010' }))
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Producto sujeto a Impuestos Especiales: Bebidas Alcohólicas'))
      expect(screen.getByText('Resultado de Detección')).toBeInTheDocument()
      expect(screen.getByText('Bebidas Alcohólicas')).toBeInTheDocument()
      expect(screen.getByText('Cerveza con bajo contenido alcohólico')).toBeInTheDocument()
      expect(screen.getByText(/Rango TARIC: 2203-2208/i)).toBeInTheDocument()
    })

    test('detección: producto sujeto muestra formulario de cálculo', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Cigarrillos rubios',
            taricRange: '2402-2403'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402100000' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      expect(await screen.findByText('2. Calcular Impuesto')).toBeInTheDocument()
      expect(screen.getByText('Descripción')).toBeInTheDocument()
      expect(screen.getByText('Cantidad *')).toBeInTheDocument()
    })

    test('detección: producto ALCOHOL muestra campo alcoholContent', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Vino tinto',
            taricRange: '2204'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2204210000' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      expect(await screen.findByText('Grado Alcohólico (%) *')).toBeInTheDocument()
      expect(getAlcoholContentInput()).toBeInTheDocument()
    })

    test('detección: producto TOBACCO muestra campo price', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Cigarrillos',
            taricRange: '2402'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402100000' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      expect(await screen.findByText('Precio Venta al Público (EUR) *')).toBeInTheDocument()
      expect(getPriceInput()).toBeInTheDocument()
    })

    test('detección: producto HYDROCARBONS muestra campo productType con opciones', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'HYDROCARBONS',
            categoryName: 'Hidrocarburos',
            description: 'Gasolina sin plomo',
            taricRange: '2710'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710121100' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      expect(await screen.findByText('Tipo de Producto')).toBeInTheDocument()
      const select = screen.getByDisplayValue('-- Seleccione --')
      expect(select).toBeInTheDocument()
      fireEvent.change(select, { target: { value: 'GASOLINE' } })
      expect(screen.getByDisplayValue('Gasolina')).toBeInTheDocument()
    })

    test('detección: colores por categoría ALCOHOL', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Test',
            taricRange: '2203'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      const categoryElement = await screen.findByText('Bebidas Alcohólicas')
      expect(categoryElement.parentElement).toHaveClass('text-purple-600', 'bg-purple-50')
    })

    test('detección: colores por categoría TOBACCO', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Test',
            taricRange: '2402'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      const categoryElement = await screen.findByText('Labores del Tabaco')
      expect(categoryElement.parentElement).toHaveClass('text-orange-600', 'bg-orange-50')
    })

    test('detección: colores por categoría HYDROCARBONS', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'HYDROCARBONS',
            categoryName: 'Hidrocarburos',
            description: 'Test',
            taricRange: '2710'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      const categoryElement = await screen.findByText('Hidrocarburos')
      expect(categoryElement.parentElement).toHaveClass('text-blue-600', 'bg-blue-50')
    })

    test('detección: colores por categoría ELECTRICITY', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ELECTRICITY',
            categoryName: 'Electricidad',
            description: 'Test',
            taricRange: '2716'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2716' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      const categoryElement = await screen.findByText('Electricidad')
      expect(categoryElement.parentElement).toHaveClass('text-yellow-600', 'bg-yellow-50')
    })

    test('detección: colores por categoría desconocida (default)', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'UNKNOWN_CATEGORY',
            categoryName: 'Categoría Desconocida',
            description: 'Test',
            taricRange: '9999'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '9999' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      const categoryElement = await screen.findByText('Categoría Desconocida')
      expect(categoryElement.parentElement).toHaveClass('text-gray-600', 'bg-gray-50')
    })
  })

  describe('handleDetect - Detección no sujeto', () => {
    test('detección: producto NO sujeto muestra toast sin nivel', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: false,
            category: null,
            categoryName: null,
            description: null,
            taricRange: null
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '8517120000' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      await waitFor(() => expect(toast).toHaveBeenCalledWith('Producto no sujeto a Impuestos Especiales'))
      expect(screen.getByText('Producto NO sujeto a Impuestos Especiales')).toBeInTheDocument()
      expect(screen.getByText(/No se requieren declaraciones SILICIE/i)).toBeInTheDocument()
    })

    test('detección: producto NO sujeto no muestra formulario de cálculo', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: false
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '8517120000' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      expect(screen.queryByText('2. Calcular Impuesto')).not.toBeInTheDocument()
    })
  })

  describe('handleDetect - Errores', () => {
    test('error: success=false con error message muestra toast error', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: false,
          error: 'Código TARIC no válido'
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: 'INVALID' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Código TARIC no válido'))
    })

    test('error: success=false sin error message muestra error genérico', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: false
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '9999999999' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al detectar'))
    })

    test('error: excepción en API muestra toast error catch', async () => {
      exciseAPI.detect.mockRejectedValue(new Error('Network error'))

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al detectar producto'))
    })
  })

  describe('handleDetect - Estados y limpieza', () => {
    test('detecting=true durante llamada API', async () => {
      exciseAPI.detect.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        data: { success: true, data: { subject: false } }
      }), 100)))

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      expect(screen.getByText('Detectando...')).toBeInTheDocument()
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByText('Detectando...')).not.toBeInTheDocument())
    })

    test('detección limpia resultados previos de detection y calculation', async () => {
      exciseAPI.detect
        .mockResolvedValueOnce({
          data: { success: true, data: { subject: true, category: 'ALCOHOL', categoryName: 'Bebidas Alcohólicas', description: 'Test1', taricRange: '2203' } }
        })
        .mockResolvedValueOnce({
          data: { success: true, data: { subject: false } }
        })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const form = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(form)

      await waitFor(() => expect(screen.getByText('Bebidas Alcohólicas')).toBeInTheDocument())

      fireEvent.change(getTaricInput(), { target: { value: '8517120000' } })
      fireEvent.submit(form)

      await waitFor(() => expect(screen.getByText('Producto NO sujeto a Impuestos Especiales')).toBeInTheDocument())
      expect(screen.queryByText('Bebidas Alcohólicas')).not.toBeInTheDocument()
    })
  })

  describe('handleCalculate - Validación', () => {
    beforeEach(async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })
    })

    test('validación: taricCode vacío muestra toast error', async () => {
      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getTaricInput(), { target: { value: '' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Complete código TARIC y cantidad'))
      expect(exciseAPI.calculate).not.toHaveBeenCalled()
    })

    test('validación: quantity vacío muestra toast error', async () => {
      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Complete código TARIC y cantidad'))
      expect(exciseAPI.calculate).not.toHaveBeenCalled()
    })
  })

  describe('handleCalculate - Cálculo exitoso applicable', () => {
    beforeEach(async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })
    })

    test('cálculo: applicable=true muestra toast success con amount', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 125.50,
            subcategory: 'Cerveza con graduación ≤ 11°',
            rate: '12.40 EUR/hl/grado',
            unit: 'EUR/hl/grado',
            calculation: '1000 L * 5.0% * 12.40 / 100 = 125.50 EUR'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '1000' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '5.0' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith({
        taricCode: '2203000010',
        description: '',
        quantity: 1000,
        unit: 'L',
        alcoholContent: 5.0,
        price: undefined,
        productType: undefined
      }))
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Impuesto calculado: 125.5 EUR'))
      expect(screen.getByText('Impuesto Calculado')).toBeInTheDocument()
      expect(screen.getAllByText(/125\.50 EUR/i)[0]).toBeInTheDocument()
    })

    test('cálculo: muestra subcategoría, tarifa y cálculo', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 200.75,
            subcategory: 'Vino tranquilo',
            rate: '0 EUR/hl',
            unit: 'EUR/hl',
            calculation: '500 L * 0 = 0 EUR (producto exento)'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2204210000' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '500' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '12' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText('Vino tranquilo')).toBeInTheDocument()
      expect(screen.getByText(/0 EUR\/hl/i)).toBeInTheDocument()
      expect(screen.getByText(/producto exento/i)).toBeInTheDocument()
    })

    test('cálculo: campos opcionales description presentes', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 50,
            subcategory: 'Test',
            rate: '1 EUR/unit',
            unit: 'EUR/unit',
            calculation: '50 * 1 = 50 EUR'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getDescriptionInput(), { target: { value: 'Cerveza artesanal' } })
      fireEvent.change(getQuantityInput(), { target: { value: '50' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '5.5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith({
        taricCode: '2203000010',
        description: 'Cerveza artesanal',
        quantity: 50,
        unit: 'L',
        alcoholContent: 5.5,
        price: undefined,
        productType: undefined
      }))
    })

    test('cálculo: alcoholContent vacío envía undefined', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'HYDROCARBONS',
            categoryName: 'Hidrocarburos',
            description: 'Gasolina',
            taricRange: '2710'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 300,
            subcategory: 'Gasolina sin plomo',
            rate: '300 EUR/1000L',
            unit: 'EUR/1000L',
            calculation: '1000 L * 300 / 1000 = 300 EUR'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710121100' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '1000' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith({
        taricCode: '2710121100',
        description: '',
        quantity: 1000,
        unit: 'L',
        alcoholContent: undefined,
        price: undefined,
        productType: undefined
      }))
    })

    test('cálculo: price presente (TOBACCO) envía parseFloat', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Cigarrillos',
            taricRange: '2402'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 1250.00,
            subcategory: 'Cigarrillos',
            rate: 'Componente específico + proporcional',
            unit: 'EUR',
            calculation: 'Específico: 500 EUR + Proporcional: 750 EUR = 1250 EUR',
            specificComponent: 500,
            proportionalComponent: 750
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402100000' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '5000' } })
      fireEvent.change(getPriceInput(), { target: { value: '5000.00' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith({
        taricCode: '2402100000',
        description: '',
        quantity: 5000,
        unit: 'L',
        alcoholContent: undefined,
        price: 5000.00,
        productType: undefined
      }))
    })

    test('cálculo: price vacío envía undefined', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Cigarrillos',
            taricRange: '2402'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 500
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402100000' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '1000' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith({
        taricCode: '2402100000',
        description: '',
        quantity: 1000,
        unit: 'L',
        alcoholContent: undefined,
        price: undefined,
        productType: undefined
      }))
    })

    test('cálculo: productType presente envía value', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'HYDROCARBONS',
            categoryName: 'Hidrocarburos',
            description: 'Gasóleo',
            taricRange: '2710'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 456.78,
            subcategory: 'Gasóleo bonificado',
            rate: '456.78 EUR/1000L',
            unit: 'EUR/1000L',
            calculation: '1000 L * 456.78 / 1000 = 456.78 EUR'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710194600' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      const select = screen.getByDisplayValue('-- Seleccione --')
      fireEvent.change(select, { target: { value: 'DIESEL' } })
      fireEvent.change(getQuantityInput(), { target: { value: '1000' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith({
        taricCode: '2710194600',
        description: '',
        quantity: 1000,
        unit: 'L',
        alcoholContent: undefined,
        price: undefined,
        productType: 'DIESEL'
      }))
    })

    test('cálculo: productType vacío envía undefined', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'HYDROCARBONS',
            categoryName: 'Hidrocarburos',
            description: 'Hidrocarburo sin especificar',
            taricRange: '2710'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 100
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '500' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith(
        expect.objectContaining({
          productType: undefined
        })
      ))
    })

    test('cálculo: componentes de tabaco (specificComponent, proportionalComponent, minimumTax)', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Cigarrillos',
            taricRange: '2402'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 2100.00,
            subcategory: 'Cigarrillos',
            rate: 'Componente específico + proporcional',
            unit: 'EUR',
            calculation: 'Específico: 800 EUR + Proporcional: 1200 EUR = 2000 EUR, mínimo 2100 EUR',
            specificComponent: 800.00,
            proportionalComponent: 1200.00,
            minimumTax: 2100.00
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402100000' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '10000' } })
      fireEvent.change(getPriceInput(), { target: { value: '10000' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText(/800\.00 EUR/i)).toBeInTheDocument()
      expect(screen.getByText(/1200\.00 EUR/i)).toBeInTheDocument()
      expect(screen.getAllByText(/2100\.00 EUR/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/Componente específico:/i)).toBeInTheDocument()
      expect(screen.getByText(/Componente proporcional:/i)).toBeInTheDocument()
      expect(screen.getByText(/Impuesto mínimo:/i)).toBeInTheDocument()
    })

    test('cálculo: note presente se muestra', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 0,
            subcategory: 'Cerveza exenta',
            rate: '0 EUR/hl/grado',
            unit: 'EUR/hl/grado',
            calculation: '1000 L * 5% * 0 = 0 EUR',
            note: 'Producto exento por graduación inferior al límite establecido'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '1000' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '2' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText(/Producto exento por graduación inferior/i)).toBeInTheDocument()
    })

    test('cálculo: requisitos y documentación se muestran', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 150,
            subcategory: 'Cerveza estándar',
            rate: '12.40 EUR/hl/grado',
            unit: 'EUR/hl/grado',
            calculation: '1000 L * 5% * 12.40 / 100 = 150 EUR'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '1000' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText(/Requisitos y Documentación/i)).toBeInTheDocument()
      expect(screen.getByText(/Registro como operador SILICIE/i)).toBeInTheDocument()
      expect(screen.getByText(/Documento Administrativo Electrónico \(e-AD\)/i)).toBeInTheDocument()
    })

    test('cálculo: TOBACCO muestra marcas fiscales obligatorias', async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'TOBACCO',
            categoryName: 'Labores del Tabaco',
            description: 'Cigarrillos',
            taricRange: '2402'
          }
        }
      })

      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 1000,
            category: 'TOBACCO',
            subcategory: 'Cigarrillos',
            rate: 'Mixto',
            unit: 'EUR',
            calculation: '...'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2402100000' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '5000' } })
      fireEvent.change(getPriceInput(), { target: { value: '5000' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText(/Marcas fiscales obligatorias/i)).toBeInTheDocument()
    })
  })

  describe('handleCalculate - Cálculo no aplicable', () => {
    beforeEach(async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })
    })

    test('cálculo: applicable=false muestra toast sin nivel', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: false
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '100' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '1' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      await waitFor(() => expect(toast).toHaveBeenCalledWith('No aplican impuestos especiales'))
      expect(screen.getByText('No se pudo calcular el impuesto')).toBeInTheDocument()
    })

    test('cálculo: applicable=false con error muestra error message', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: false,
            error: 'Graduación fuera de rango imponible'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '100' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '0.5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText('Graduación fuera de rango imponible')).toBeInTheDocument()
    })

    test('cálculo: applicable=false con exemption muestra exemption message', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: false,
            exemption: 'Producto exento por destino a uso industrial'
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '5000' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '96' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      expect(await screen.findByText('Producto exento por destino a uso industrial')).toBeInTheDocument()
    })
  })

  describe('handleCalculate - Errores', () => {
    beforeEach(async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })
    })

    test('error: success=false con error message muestra toast error', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: false,
          error: 'Datos insuficientes para cálculo'
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '100' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Datos insuficientes para cálculo'))
    })

    test('error: success=false sin error message muestra error genérico', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: false
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '100' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al calcular'))
    })

    test('error: excepción en API muestra toast error catch', async () => {
      exciseAPI.calculate.mockRejectedValue(new Error('Service unavailable'))

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '100' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al calcular impuesto'))
    })
  })

  describe('handleCalculate - Estados', () => {
    beforeEach(async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'ALCOHOL',
            categoryName: 'Bebidas Alcohólicas',
            description: 'Cerveza',
            taricRange: '2203'
          }
        }
      })
    })

    test('calculating=true durante llamada API', async () => {
      exciseAPI.calculate.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        data: { success: true, data: { applicable: true, amount: 100 } }
      }), 100)))

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2203000010' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      fireEvent.change(getQuantityInput(), { target: { value: '100' } })
      fireEvent.change(getAlcoholContentInput(), { target: { value: '5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      expect(screen.getByText('Calculando...')).toBeInTheDocument()
      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByText('Calculando...')).not.toBeInTheDocument())
    })
  })

  describe('Unidades y cambio de unidad', () => {
    beforeEach(async () => {
      exciseAPI.detect.mockResolvedValue({
        data: {
          success: true,
          data: {
            subject: true,
            category: 'HYDROCARBONS',
            categoryName: 'Hidrocarburos',
            description: 'Gasolina',
            taricRange: '2710'
          }
        }
      })
    })

    test('unit default es L (Litros)', async () => {
      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710121100' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      const unitSelect = screen.getByDisplayValue('Litros (L)')
      expect(unitSelect).toBeInTheDocument()
    })

    test('unit puede cambiarse a kg, ton, units, kWh, MWh', async () => {
      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710121100' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      const unitSelect = screen.getByDisplayValue('Litros (L)')
      fireEvent.change(unitSelect, { target: { value: 'kg' } })
      expect(screen.getByDisplayValue('Kilogramos (kg)')).toBeInTheDocument()

      fireEvent.change(unitSelect, { target: { value: 'ton' } })
      expect(screen.getByDisplayValue('Toneladas (ton)')).toBeInTheDocument()

      fireEvent.change(unitSelect, { target: { value: 'units' } })
      expect(screen.getByDisplayValue('Unidades')).toBeInTheDocument()

      fireEvent.change(unitSelect, { target: { value: 'kWh' } })
      expect(screen.getByDisplayValue('Kilovatios-hora (kWh)')).toBeInTheDocument()

      fireEvent.change(unitSelect, { target: { value: 'MWh' } })
      expect(screen.getByDisplayValue('Megavatios-hora (MWh)')).toBeInTheDocument()
    })

    test('unit se envía correctamente en calculate', async () => {
      exciseAPI.calculate.mockResolvedValue({
        data: {
          success: true,
          data: {
            applicable: true,
            amount: 500
          }
        }
      })

      render(<ExciseDutiesCalculator />)
      fireEvent.change(getTaricInput(), { target: { value: '2710121100' } })
      const detectForm = screen.getByText('1. Detectar Producto').closest('form')
      fireEvent.submit(detectForm)
      await waitFor(() => expect(exciseAPI.detect).toHaveBeenCalled())

      const unitSelect = screen.getByDisplayValue('Litros (L)')
      fireEvent.change(unitSelect, { target: { value: 'ton' } })
      fireEvent.change(getQuantityInput(), { target: { value: '5' } })
      const calcForm = screen.getByText('2. Calcular Impuesto').closest('form')
      fireEvent.submit(calcForm)

      await waitFor(() => expect(exciseAPI.calculate).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: 'ton'
        })
      ))
    })
  })

  describe('Límites y validaciones del input', () => {
    test('taricCode tiene maxLength 10', () => {
      render(<ExciseDutiesCalculator />)
      const input = getTaricInput()
      expect(input).toHaveAttribute('maxLength', '10')
    })
  })
})
