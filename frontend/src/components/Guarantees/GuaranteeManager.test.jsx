import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GuaranteeManager from './GuaranteeManager'
import { guaranteesAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  guaranteesAPI: {
    list: vi.fn(),
    getStats: vi.fn(),
    getAlerts: vi.fn(),
    activate: vi.fn(),
    acknowledgeAlert: vi.fn(),
    create: vi.fn(),
    calculate: vi.fn(),
    getMovements: vi.fn(),
    aiAnalyzeNeeds: vi.fn(),
    aiRecommendType: vi.fn(),
    aiOptimize: vi.fn(),
    aiFullAnalysis: vi.fn(),
    aiSmartCalculate: vi.fn()
  }
}))

describe('<GuaranteeManager />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Configurar respuestas predeterminadas para el useEffect inicial
    guaranteesAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'g1',
            name: 'Garantía Global 2024',
            type: 'CGU',
            reference: 'GRN-001',
            grn: 'ES12345678',
            status: 'active',
            totalAmount: 100000,
            availableAmount: 75000,
            consumedAmount: 25000,
            validFrom: '2024-01-01',
            validUntil: '2024-12-31',
            usage: 'general'
          },
          {
            _id: 'g2',
            name: 'Garantía Individual',
            type: 'individual',
            reference: 'GRN-002',
            grn: null,
            status: 'draft',
            totalAmount: 50000,
            availableAmount: 50000,
            consumedAmount: 0,
            validFrom: '2024-06-01',
            validUntil: '2025-05-31',
            usage: 'transit'
          }
        ]
      }
    })
    guaranteesAPI.getStats.mockResolvedValue({
      data: {
        success: true,
        data: {
          active: 5,
          totalAmount: 500000,
          availableAmount: 400000,
          consumedAmount: 100000,
          lowBalance: 0,
          expiringIn30Days: 0
        }
      }
    })
    guaranteesAPI.getAlerts.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    })
  })

  // --- CASOS CORE: loading / éxito / lista vacía / error ---

  test('muestra spinner durante carga inicial', async () => {
    // Retrasar las respuestas para capturar el loading
    const delayedPromise = new Promise((resolve) => setTimeout(() => resolve({
      data: { success: true, data: [] }
    }), 100))
    guaranteesAPI.list.mockReturnValue(delayedPromise)
    guaranteesAPI.getStats.mockReturnValue(delayedPromise)
    guaranteesAPI.getAlerts.mockReturnValue(delayedPromise)

    render(<GuaranteeManager />)

    // Durante carga, el componente muestra el ArrowPathIcon con animate-spin en un div.flex
    const spinnerContainer = document.querySelector('.flex.justify-center.py-12')
    expect(spinnerContainer).toBeInTheDocument()

    await waitFor(() => expect(guaranteesAPI.list).toHaveBeenCalled())
  })

  test('renderiza garantías y estadísticas cuando hay datos', async () => {
    render(<GuaranteeManager />)

    // Esperar a que se carguen las garantías (el loading desaparece)
    await waitFor(() => {
      expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: '', type: '' })
      expect(guaranteesAPI.getStats).toHaveBeenCalled()
      expect(guaranteesAPI.getAlerts).toHaveBeenCalled()
    })

    // Esperar a que aparezca el contenido
    await waitFor(() => {
      expect(screen.getByText('Garantía Global 2024')).toBeInTheDocument()
    })

    // Título
    expect(screen.getByText('guarantees.title')).toBeInTheDocument()

    // Stats card
    const activeText = screen.getByText('Garantias Activas')
    expect(activeText).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()

    // Garantías en la lista
    expect(screen.getByText('Garantía Global 2024')).toBeInTheDocument()
    expect(screen.getByText('ES12345678')).toBeInTheDocument()
    expect(screen.getByText('Garantía Individual')).toBeInTheDocument()
  })

  test('muestra estado vacío cuando no hay garantías', async () => {
    guaranteesAPI.list.mockResolvedValue({ data: { success: true, data: [] } })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.noGuarantees')).toBeInTheDocument())
    expect(screen.getByText('guarantees.createFirstGuarantee')).toBeInTheDocument()
  })

  test('muestra toast de error cuando falla loadData', async () => {
    guaranteesAPI.list.mockRejectedValue(new Error('Network error'))

    render(<GuaranteeManager />)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('guarantees.errorLoading'))
  })

  // --- FILTROS: status y type ---

  test('cambia filtro de status y recarga datos', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(guaranteesAPI.list).toHaveBeenCalledTimes(1))

    const statusSelect = screen.getAllByRole('combobox')[0] // Primer select (Estado)
    fireEvent.change(statusSelect, { target: { value: 'active' } })

    await waitFor(() =>
      expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: 'active', type: '' })
    )
  })

  test('cambia filtro de type y recarga datos', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(guaranteesAPI.list).toHaveBeenCalledTimes(1))

    const typeSelect = screen.getAllByRole('combobox')[1] // Segundo select (Tipo)
    fireEvent.change(typeSelect, { target: { value: 'CGU' } })

    await waitFor(() =>
      expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: '', type: 'CGU' })
    )
  })

  test('botón refresh recarga los datos manualmente', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(guaranteesAPI.list).toHaveBeenCalledTimes(1))

    const refreshButton = screen.getByRole('button', { name: '' }) // ArrowPathIcon button
    fireEvent.click(refreshButton)

    await waitFor(() => expect(guaranteesAPI.list).toHaveBeenCalledTimes(2))
  })

  // --- ALERTAS: lista de alertas y reconocer ---

  test('muestra alertas pendientes cuando existen', async () => {
    guaranteesAPI.getAlerts.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'alert1',
            guaranteeId: 'g1',
            guaranteeReference: 'GRN-ALERT-01',
            message: 'Saldo bajo detectado'
          },
          {
            _id: 'alert2',
            guaranteeId: 'g2',
            guaranteeReference: 'GRN-ALERT-02',
            message: 'Expira en 15 días'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => {
      expect(screen.getByText('Alertas Pendientes (2)')).toBeInTheDocument()
      expect(screen.getByText('GRN-ALERT-01')).toBeInTheDocument()
      expect(screen.getByText('Saldo bajo detectado')).toBeInTheDocument()
      expect(screen.getByText('GRN-ALERT-02')).toBeInTheDocument()
      expect(screen.getByText('Expira en 15 días')).toBeInTheDocument()
    })
  })

  test('reconocer alerta llama a API y recarga datos', async () => {
    guaranteesAPI.getAlerts.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'alert1',
            guaranteeId: 'g1',
            guaranteeReference: 'GRN-001',
            message: 'Saldo bajo'
          }
        ]
      }
    })
    guaranteesAPI.acknowledgeAlert.mockResolvedValue({ data: { success: true } })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('Saldo bajo')).toBeInTheDocument())

    const reconocerButton = screen.getByText('Reconocer')
    fireEvent.click(reconocerButton)

    await waitFor(() => {
      expect(guaranteesAPI.acknowledgeAlert).toHaveBeenCalledWith('g1', 'alert1')
      expect(toast.success).toHaveBeenCalledWith('guarantees.alertAcknowledged')
    })
  })

  test('reconocer alerta muestra error si la API falla', async () => {
    guaranteesAPI.getAlerts.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'alert1',
            guaranteeId: 'g1',
            guaranteeReference: 'GRN-001',
            message: 'Saldo bajo'
          }
        ]
      }
    })
    guaranteesAPI.acknowledgeAlert.mockRejectedValue(new Error('API error'))

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('Saldo bajo')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Reconocer'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('guarantees.errorAcknowledging'))
  })

  // --- STATS: warnings de lowBalance y expiringIn30Days ---

  test('muestra advertencia de saldo bajo cuando stats.lowBalance > 0', async () => {
    guaranteesAPI.getStats.mockResolvedValue({
      data: {
        success: true,
        data: {
          active: 5,
          totalAmount: 500000,
          availableAmount: 400000,
          consumedAmount: 100000,
          lowBalance: 3,
          expiringIn30Days: 0
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() =>
      expect(screen.getByText('3 garantias con saldo bajo')).toBeInTheDocument()
    )
  })

  test('muestra advertencia de expiración cuando stats.expiringIn30Days > 0', async () => {
    guaranteesAPI.getStats.mockResolvedValue({
      data: {
        success: true,
        data: {
          active: 5,
          totalAmount: 500000,
          availableAmount: 400000,
          consumedAmount: 100000,
          lowBalance: 0,
          expiringIn30Days: 2
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() =>
      expect(screen.getByText('2 garantias expiran en 30 dias')).toBeInTheDocument()
    )
  })

  // --- STATUS BADGES: cubre todas las ramas de status ---

  test.each([
    ['draft', 'Borrador'],
    ['pending', 'Pendiente'],
    ['active', 'Activa'],
    ['suspended', 'Suspendida'],
    ['expired', 'Expirada'],
    ['cancelled', 'Cancelada'],
    ['exhausted', 'Agotada']
  ])('muestra badge correcto para status=%s', async (status, label) => {
    guaranteesAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'g1',
            name: `Garantía ${status}`,
            type: 'CGU',
            reference: 'GRN-001',
            status,
            totalAmount: 100000,
            availableAmount: 75000,
            consumedAmount: 25000,
            validFrom: '2024-01-01',
            validUntil: '2024-12-31'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument())
  })

  // --- TYPE BADGES: cubre todas las ramas de type ---

  test.each([
    ['CGU', 'Garantia Global (CGU)'],
    ['individual', 'Individual'],
    ['deposit', 'Deposito'],
    ['bank_guarantee', 'Aval Bancario'],
    ['insurance', 'Seguro Caucion'],
    ['surety', 'Fianza']
  ])('muestra badge correcto para type=%s', async (type, label) => {
    guaranteesAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'g1',
            name: `Garantía ${type}`,
            type,
            reference: 'GRN-001',
            status: 'active',
            totalAmount: 100000,
            availableAmount: 75000,
            consumedAmount: 25000,
            validFrom: '2024-01-01',
            validUntil: '2024-12-31'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument())
  })

  // --- BARRA DE DISPONIBILIDAD: porcentajes bajo/medio/alto ---

  test('barra de disponibilidad verde cuando disponible >= 50%', async () => {
    guaranteesAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'g1',
            name: 'Garantía Alta',
            type: 'CGU',
            reference: 'GRN-001',
            status: 'active',
            totalAmount: 100000,
            availableAmount: 80000, // 80%
            consumedAmount: 20000,
            validFrom: '2024-01-01',
            validUntil: '2024-12-31'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => {
      expect(screen.getByText('80%')).toBeInTheDocument()
      // La palabra "Disponible" aparece múltiples veces (stats + barra), usar within o getAllByText
      const disponibleLabels = screen.getAllByText('Disponible')
      expect(disponibleLabels.length).toBeGreaterThan(0)
    })
  })

  test('barra de disponibilidad amarilla cuando disponible entre 20% y 50%', async () => {
    guaranteesAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'g1',
            name: 'Garantía Media',
            type: 'CGU',
            reference: 'GRN-001',
            status: 'active',
            totalAmount: 100000,
            availableAmount: 35000, // 35%
            consumedAmount: 65000,
            validFrom: '2024-01-01',
            validUntil: '2024-12-31'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('35%')).toBeInTheDocument())
  })

  test('barra de disponibilidad roja cuando disponible < 20%', async () => {
    guaranteesAPI.list.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'g1',
            name: 'Garantía Baja',
            type: 'CGU',
            reference: 'GRN-001',
            status: 'active',
            totalAmount: 100000,
            availableAmount: 15000, // 15%
            consumedAmount: 85000,
            validFrom: '2024-01-01',
            validUntil: '2024-12-31'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('15%')).toBeInTheDocument())
  })

  // --- ACTIVAR GARANTÍA (draft → active) ---

  test('activar garantía solicita GRN y llama a API', async () => {
    // Simular prompt
    global.prompt = vi.fn(() => 'ES999999')
    guaranteesAPI.activate.mockResolvedValue({ data: { success: true } })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('Garantía Individual')).toBeInTheDocument())

    const activarButton = screen.getByRole('button', { name: 'Activar' })
    fireEvent.click(activarButton)

    expect(global.prompt).toHaveBeenCalledWith('Ingrese el GRN (Guarantee Reference Number):')

    await waitFor(() => {
      expect(guaranteesAPI.activate).toHaveBeenCalledWith('g2', { grn: 'ES999999' })
      expect(toast.success).toHaveBeenCalledWith('guarantees.activated')
    })
  })

  test('activar garantía sin GRN cancela la operación', async () => {
    global.prompt = vi.fn(() => null) // Usuario cancela

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('Garantía Individual')).toBeInTheDocument())

    const activarButton = screen.getByRole('button', { name: 'Activar' })
    fireEvent.click(activarButton)

    expect(guaranteesAPI.activate).not.toHaveBeenCalled()
  })

  test('activar garantía muestra error si la API falla', async () => {
    global.prompt = vi.fn(() => 'ES999999')
    guaranteesAPI.activate.mockRejectedValue(new Error('API error'))

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('Garantía Individual')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Activar' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('guarantees.errorActivating'))
  })

  // --- MODALES: abrir/cerrar ---

  test('abre modal de nueva garantía al hacer clic en el botón', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    const newButton = screen.getByRole('button', { name: /guarantees.newGuarantee/i })
    fireEvent.click(newButton)

    await waitFor(() => expect(screen.getByText('Nueva Garantia')).toBeInTheDocument())
  })

  test('abre modal de calculadora al hacer clic en el botón', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    const calcButton = screen.getByRole('button', { name: /guarantees.calculator/i })
    fireEvent.click(calcButton)

    await waitFor(() => expect(screen.getByText('Calculadora de Garantia')).toBeInTheDocument())
  })

  test('abre panel AI al hacer clic en el botón', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    const aiButton = screen.getByRole('button', { name: /guarantees.aiAnalysis/i })
    fireEvent.click(aiButton)

    await waitFor(() => expect(screen.getByText('Analisis IA de Garantias')).toBeInTheDocument())
  })

  test('abre modal de detalle al hacer clic en "Ver detalles"', async () => {
    guaranteesAPI.getMovements.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getAllByText('Garantía Global 2024')[0]).toBeInTheDocument())

    const detailButtons = screen.getAllByRole('button', { name: 'Ver detalles' })
    fireEvent.click(detailButtons[0])

    await waitFor(() => {
      // El modal también muestra el nombre, ahora hay duplicado
      expect(screen.getAllByText('Garantía Global 2024').length).toBeGreaterThan(1)
      expect(guaranteesAPI.getMovements).toHaveBeenCalledWith('g1')
    })
  })

  // --- GUARANTE FORM: crear nueva garantía ---

  test('formulario de nueva garantía: crea garantía con datos válidos', async () => {
    guaranteesAPI.create.mockResolvedValue({
      data: {
        success: true,
        data: { reference: 'GRN-NEW-001' }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.newGuarantee/i }))

    await waitFor(() => expect(screen.getByText('Nueva Garantia')).toBeInTheDocument())

    // Rellenar el formulario
    fireEvent.change(screen.getByPlaceholderText('Ej: Garantia Global 2024'), { target: { value: 'Garantía Test' } })
    fireEvent.change(screen.getByPlaceholderText('100000'), { target: { value: '150000' } })

    const form = screen.getByRole('button', { name: 'Crear Garantia' }).closest('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(guaranteesAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Garantía Test',
          totalAmount: 150000
        })
      )
      expect(toast.success).toHaveBeenCalledWith('Garantia GRN-NEW-001 creada')
    })
  })

  test('formulario de nueva garantía: muestra error si la API falla', async () => {
    guaranteesAPI.create.mockRejectedValue(new Error('API error'))

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.newGuarantee/i }))

    await waitFor(() => expect(screen.getByText('Nueva Garantia')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Ej: Garantia Global 2024'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('100000'), { target: { value: '50000' } })

    const form = screen.getByRole('button', { name: 'Crear Garantia' }).closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al crear garantia'))
  })

  // --- CALCULADORA: ambos tipos de cálculo ---

  test('calculadora: cálculo estándar exitoso muestra resultado', async () => {
    guaranteesAPI.calculate.mockResolvedValue({
      data: {
        success: true,
        data: {
          baseAmount: 10000,
          oeaReduction: 0,
          finalAmount: 10000
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.calculator/i }))

    await waitFor(() => expect(screen.getByText('Calculadora de Garantia')).toBeInTheDocument())

    // Rellenar campos
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '5000' } })
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '1000' } })

    fireEvent.click(screen.getByRole('button', { name: 'Calculo Estandar' }))

    await waitFor(() => {
      expect(guaranteesAPI.calculate).toHaveBeenCalled()
      expect(screen.getByText('Resultado Estandar')).toBeInTheDocument()
      expect(screen.getByText('Base de calculo:')).toBeInTheDocument()
    })
  })

  test('calculadora: cálculo inteligente exitoso muestra resultado', async () => {
    guaranteesAPI.aiSmartCalculate.mockResolvedValue({
      data: {
        success: true,
        data: {
          calculation: {
            baseAmount: 10000,
            adjustedAmount: 9000,
            reductions: ['Reducción OEA aplicada']
          },
          specialConsiderations: [
            { factor: 'OEA', impact: 'Reduce garantía en 10%' }
          ],
          alternatives: [
            { scenario: 'Sin OEA', amount: 10000, benefit: 'Sin reducción' }
          ]
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.calculator/i }))

    await waitFor(() => expect(screen.getByText('Calculadora de Garantia')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Calculo Inteligente/i }))

    await waitFor(() => {
      expect(guaranteesAPI.aiSmartCalculate).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Calculo inteligente completado')
      expect(screen.getByText('Resultado Inteligente')).toBeInTheDocument()
      expect(screen.getByText('Reducción OEA aplicada')).toBeInTheDocument()
    })
  })

  test('calculadora: muestra error si el cálculo falla', async () => {
    guaranteesAPI.calculate.mockRejectedValue(new Error('API error'))

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.calculator/i }))

    await waitFor(() => expect(screen.getByText('Calculadora de Garantia')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Calculo Estandar' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al calcular'))
  })

  test('calculadora: muestra reducción OEA cuando aplica', async () => {
    guaranteesAPI.calculate.mockResolvedValue({
      data: {
        success: true,
        data: {
          baseAmount: 10000,
          oeaReduction: 1000,
          oeaStatus: 'AEOC',
          finalAmount: 9000
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.calculator/i }))

    await waitFor(() => expect(screen.getByText('Calculadora de Garantia')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Calculo Estandar' }))

    await waitFor(() => {
      expect(guaranteesAPI.calculate).toHaveBeenCalled()
      expect(screen.getByText(/Reduccion OEA/i)).toBeInTheDocument()
      expect(screen.getByText(/AEOC/i)).toBeInTheDocument()
    })
  })

  // --- AI PANEL: 3 tabs con análisis ---

  test('AI panel tab analyze: analiza necesidades y muestra resultado', async () => {
    guaranteesAPI.aiAnalyzeNeeds.mockResolvedValue({
      data: {
        success: true,
        data: {
          requiredAmount: 15000,
          existingCoverage: {
            sufficient: false,
            shortfall: 5000
          },
          recommendation: 'Ampliar garantía existente',
          optimizations: [
            { action: 'Consolidar en CGU', impact: 'Ahorro de 500 EUR/año' }
          ],
          risks: [
            { description: 'Riesgo de incumplimiento', mitigation: 'Activar nueva garantía' }
          ]
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.aiAnalysis/i }))

    await waitFor(() => expect(screen.getByText('Analisis IA de Garantias')).toBeInTheDocument())

    // Rellenar campos
    fireEvent.change(screen.getByPlaceholderText('100000'), { target: { value: '15000' } })

    // Hay dos botones "Analizar Necesidades" (tab + botón dentro del tab). Usar getAllByRole
    const analyzeButtons = screen.getAllByRole('button', { name: 'Analizar Necesidades' })
    fireEvent.click(analyzeButtons[analyzeButtons.length - 1]) // El botón dentro del contenido

    await waitFor(() => {
      expect(guaranteesAPI.aiAnalyzeNeeds).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Analisis completado')
      expect(screen.getByText('Garantia Requerida')).toBeInTheDocument()
      expect(screen.getByText('Ampliar garantía existente')).toBeInTheDocument()
      expect(screen.getByText('Consolidar en CGU')).toBeInTheDocument()
      expect(screen.getByText('Riesgo de incumplimiento')).toBeInTheDocument()
    })
  })

  test('AI panel tab analyze: validación customsValue requerido', async () => {
    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.aiAnalysis/i }))

    await waitFor(() => expect(screen.getByText('Analisis IA de Garantias')).toBeInTheDocument())

    const analyzeButtons = screen.getAllByRole('button', { name: 'Analizar Necesidades' })
    fireEvent.click(analyzeButtons[analyzeButtons.length - 1])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ingrese el valor de la operacion'))
  })

  test('AI panel tab recommend: recomienda tipo de garantía', async () => {
    guaranteesAPI.aiRecommendType.mockResolvedValue({
      data: {
        success: true,
        data: {
          recommendedType: 'CGU',
          reasoning: 'Mayor flexibilidad y ahorro en operaciones frecuentes',
          alternatives: [
            {
              type: 'individual',
              estimatedCost: '200 EUR/operación',
              pros: ['Fácil de obtener'],
              cons: ['Mayor coste total']
            }
          ],
          implementationPlan: [
            { action: 'Solicitar CGU ante Aduanas', timeframe: '2-3 semanas' },
            { action: 'Aportar documentación financiera', timeframe: '1 semana' }
          ]
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.aiAnalysis/i }))

    await waitFor(() => expect(screen.getByText('Analisis IA de Garantias')).toBeInTheDocument())

    // Cambiar a tab recommend
    fireEvent.click(screen.getByText('Recomendar Tipo'))

    fireEvent.click(screen.getByRole('button', { name: 'Generar Recomendacion' }))

    await waitFor(() => {
      expect(guaranteesAPI.aiRecommendType).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Recomendacion generada')
      expect(screen.getByText('Tipo Recomendado')).toBeInTheDocument()
      expect(screen.getByText('Mayor flexibilidad y ahorro en operaciones frecuentes')).toBeInTheDocument()
      expect(screen.getByText('Fácil de obtener')).toBeInTheDocument()
      expect(screen.getByText('Solicitar CGU ante Aduanas')).toBeInTheDocument()
    })
  })

  test('AI panel tab optimize: optimiza uso de garantías', async () => {
    guaranteesAPI.aiOptimize.mockResolvedValue({
      data: {
        success: true,
        data: {
          currentStatus: {
            totalGuarantees: 5,
            totalAmount: 500000,
            totalUsed: 100000,
            totalAvailable: 400000
          },
          utilizationAnalysis: {
            averageUtilization: 45,
            underutilized: 2,
            nearLimit: 1
          },
          optimizations: [
            {
              type: 'Consolidación',
              description: 'Unificar garantías infrautilizadas',
              impact: 'Ahorro 800 EUR/año',
              action: 'Solicitar consolidación'
            }
          ],
          actionPlan: [
            { priority: 1, action: 'Aumentar garantía G1', benefit: 'Evitar sobrecostes' },
            { priority: 2, action: 'Cancelar garantía G5', benefit: 'Reducir costes' }
          ]
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.aiAnalysis/i }))

    await waitFor(() => expect(screen.getByText('Analisis IA de Garantias')).toBeInTheDocument())

    // Cambiar a tab optimize
    fireEvent.click(screen.getByText('Optimizar Uso'))

    fireEvent.click(screen.getByRole('button', { name: 'Analizar Optimizaciones' }))

    await waitFor(() => {
      expect(guaranteesAPI.aiOptimize).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Optimizacion analizada')
      expect(screen.getByText('Estado Actual')).toBeInTheDocument()
      expect(screen.getByText('Utilizacion media:')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
      expect(screen.getByText('Unificar garantías infrautilizadas')).toBeInTheDocument()
      expect(screen.getByText('Aumentar garantía G1')).toBeInTheDocument()
    })
  })

  test('AI panel: botón full analysis llama a aiFullAnalysis', async () => {
    guaranteesAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          requiredAmount: 20000,
          recommendation: 'Análisis completo completado'
        }
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('guarantees.title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /guarantees.aiAnalysis/i }))

    await waitFor(() => expect(screen.getByText('Analisis IA de Garantias')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('100000'), { target: { value: '20000' } })

    fireEvent.click(screen.getByRole('button', { name: 'Analisis Completo' }))

    await waitFor(() => {
      expect(guaranteesAPI.aiFullAnalysis).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Analisis completo finalizado')
    })
  })

  // --- DETALLE: movimientos ---

  test('detalle de garantía: carga y muestra movimientos', async () => {
    guaranteesAPI.getMovements.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            type: 'consumption',
            description: 'Operación ABC-123',
            amount: -5000,
            createdAt: '2024-07-01T10:00:00Z'
          },
          {
            type: 'release',
            description: 'Liberación operación XYZ',
            amount: 3000,
            createdAt: '2024-07-05T15:30:00Z'
          }
        ]
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getAllByText('Garantía Global 2024')[0]).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalles' })[0])

    await waitFor(() => {
      expect(guaranteesAPI.getMovements).toHaveBeenCalledWith('g1')
      expect(screen.getByText('Movimientos Recientes')).toBeInTheDocument()
      expect(screen.getByText('Consumo')).toBeInTheDocument()
      // La descripción se renderiza con "- Operación ABC-123", usar regex o includes
      expect(screen.getByText(/Operación ABC-123/i)).toBeInTheDocument()
      expect(screen.getByText('Liberacion')).toBeInTheDocument()
      expect(screen.getByText(/Liberación operación XYZ/i)).toBeInTheDocument()
    })
  })

  test('detalle de garantía: muestra "Sin movimientos" cuando la lista está vacía', async () => {
    guaranteesAPI.getMovements.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    })

    render(<GuaranteeManager />)

    await waitFor(() => expect(screen.getByText('Garantía Global 2024')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalles' })[0])

    await waitFor(() => expect(screen.getByText('Sin movimientos')).toBeInTheDocument())
  })
})
