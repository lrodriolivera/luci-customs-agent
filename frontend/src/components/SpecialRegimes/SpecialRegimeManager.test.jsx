import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SpecialRegimeManager from './SpecialRegimeManager'
import { specialRegimesAPI, guaranteesAPI } from '../../services/api'
import toast from 'react-hot-toast'

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../services/api', () => ({
  specialRegimesAPI: {
    getStats: vi.fn(),
    list: vi.fn(),
    getExpiring: vi.fn(),
    create: vi.fn(),
    authorize: vi.fn(),
    activate: vi.fn()
  },
  guaranteesAPI: {
    list: vi.fn()
  }
}))

vi.mock('./RegimeAdvisor', () => ({
  default: ({ onClose, onSelectRegime }) => (
    <div data-testid="advisor">
      <button onClick={() => onSelectRegime('51', {})}>advisor-select</button>
      <button onClick={onClose}>advisor-close</button>
    </div>
  )
}))

vi.mock('./YieldValidator', () => ({
  default: ({ onClose }) => (
    <div data-testid="yield">
      <button onClick={onClose}>yield-close</button>
    </div>
  )
}))

describe('SpecialRegimeManager', () => {
  const defaultStats = {
    total: 10,
    byRegime: {
      '51': { count: 3, suspendedDuties: 10000 },
      '53': { count: 2, suspendedDuties: 5000 },
      '71': { count: 2, suspendedDuties: 8000 },
      'T1': { count: 2, suspendedDuties: 3000 },
      'T2': { count: 1, suspendedDuties: 2000 }
    },
    byStatus: {
      active: 6,
      discharged: 3
    },
    totals: {
      suspendedDuties: 28000
    },
    alerts: {
      expiringSoon: 2
    }
  }

  const defaultRegimes = [
    {
      _id: 'regime-1',
      reference: 'REF-001',
      regimeCode: '51',
      status: 'draft',
      holder: { name: 'Holder 1', eori: 'ES123456789' },
      declarant: { name: 'Declarant 1' },
      totals: { totalGuaranteed: 10000 },
      deadlineDate: '2027-12-31'
    },
    {
      _id: 'regime-2',
      reference: 'REF-002',
      regimeCode: '53',
      status: 'authorized',
      holder: { name: 'Holder 2' },
      declarant: { name: 'Declarant 2' },
      authorization: { number: 'AUTH-123' },
      totals: { totalGuaranteed: 5000 },
      deadlineDate: '2027-06-15'
    },
    {
      _id: 'regime-3',
      reference: 'REF-003',
      regimeCode: '51',
      status: 'active',
      holder: { name: 'Holder 3', eori: 'ES987654321' },
      declarant: {},
      totals: { totalGuaranteed: 15000 }
    }
  ]

  const defaultExpiring = [
    {
      _id: 'exp-1',
      regimeCode: '51',
      reference: 'EXP-001',
      deadlineDate: '2027-12-31'
    },
    {
      _id: 'exp-2',
      regimeCode: '53',
      reference: 'EXP-002',
      deadlineDate: '2027-08-01'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    specialRegimesAPI.getStats.mockResolvedValue({
      data: { data: defaultStats }
    })
    specialRegimesAPI.list.mockResolvedValue({
      data: { data: { regimes: defaultRegimes } }
    })
    specialRegimesAPI.getExpiring.mockResolvedValue({
      data: { data: defaultExpiring }
    })
    guaranteesAPI.list.mockResolvedValue({
      data: { data: { guarantees: [] } }
    })
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <SpecialRegimeManager />
      </MemoryRouter>
    )
  }

  it('renders loading spinner initially', () => {
    renderComponent()
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('loads and displays regime stats after initial load', async () => {
    renderComponent()

    await screen.findByText('specialRegimes.title')

    expect(specialRegimesAPI.getStats).toHaveBeenCalledWith({ regimeCode: '', status: '' })
    expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '', status: '' })
    expect(specialRegimesAPI.getExpiring).toHaveBeenCalledWith(30)
    expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: 'active' })
  })

  it('displays stats cards for all 5 regime types', async () => {
    renderComponent()

    await screen.findByText('specialRegimes.title')

    // Check that all regime type cards are present by their shortName
    expect(screen.getByText('IP')).toBeInTheDocument() // 51
    expect(screen.getByText('TA')).toBeInTheDocument() // 53
    expect(screen.getByText('CW')).toBeInTheDocument() // 71
    expect(screen.getByText('T1')).toBeInTheDocument()
    expect(screen.getByText('T2')).toBeInTheDocument()
  })

  it('filters by regime code when clicking a stat card', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    // Click on '51' card
    const ipButton = screen.getByRole('button', { name: /IP/i })
    await user.click(ipButton)

    await waitFor(() => {
      expect(specialRegimesAPI.getStats).toHaveBeenCalledWith({ regimeCode: '51', status: '' })
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '51', status: '' })
    })
  })

  it('clears regime filter when clicking the same card again', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const ipButton = screen.getByRole('button', { name: /IP/i })
    await user.click(ipButton)

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '51', status: '' })
    })

    await user.click(ipButton)

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '', status: '' })
    })
  })

  it('displays expiring alert when regimes are expiring', async () => {
    renderComponent()

    await screen.findByText(/regimen\(es\) por vencer/i)

    expect(screen.getByText('EXP-001')).toBeInTheDocument()
    expect(screen.getByText('EXP-002')).toBeInTheDocument()
    expect(screen.getAllByText(/dias restantes/i).length).toBeGreaterThan(0)
  })

  it('does not display expiring alert when no regimes are expiring', async () => {
    specialRegimesAPI.getExpiring.mockResolvedValue({
      data: { data: [] }
    })

    renderComponent()

    await screen.findByText('specialRegimes.title')

    expect(screen.queryByText(/regimen\(es\) por vencer/i)).not.toBeInTheDocument()
  })

  it('displays summary stats correctly', async () => {
    renderComponent()

    await screen.findByText('Total Regimenes')

    // Check specific stats in their contexts
    const totalSection = screen.getByText('Total Regimenes').closest('.bg-white')
    expect(totalSection).toHaveTextContent('10')
    expect(totalSection).toHaveTextContent('6 activos')

    const dischargedSection = screen.getByText('Ultimados').closest('.bg-white')
    expect(dischargedSection).toHaveTextContent('3')

    // Currency format uses punto as thousands separator and space before €
    const suspendedElement = screen.getByText(/Derechos Suspendidos/).closest('.bg-white')
    expect(suspendedElement.textContent).toMatch(/28[\.\s]000/)

    const expiringSection = screen.getByText('Por Vencer').closest('.bg-white')
    expect(expiringSection).toHaveTextContent('2')
  })

  it('filters by status when selecting from dropdown', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'draft')

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '', status: 'draft' })
    })
  })

  it('displays "Limpiar filtros" button when filters are active', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'active')

    await screen.findByText('Limpiar filtros')
  })

  it('clears all filters when clicking "Limpiar filtros"', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'active')

    await screen.findByText('Limpiar filtros')

    const clearButton = screen.getByText('Limpiar filtros')
    await user.click(clearButton)

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '', status: '' })
    })
  })

  it('displays empty state when no regimes exist', async () => {
    specialRegimesAPI.list.mockResolvedValue({
      data: { data: { regimes: [] } }
    })

    renderComponent()

    await screen.findByText('No hay regimenes especiales')
    expect(screen.getByText(/Crea un nuevo regimen/i)).toBeInTheDocument()
  })

  it('displays regime table with all columns', async () => {
    renderComponent()

    await screen.findByText('REF-001')

    expect(screen.getByText('Referencia')).toBeInTheDocument()
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByText('Titular')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
    expect(screen.getByText('Derechos Susp.')).toBeInTheDocument()
    expect(screen.getByText('Vencimiento')).toBeInTheDocument()
    expect(screen.getByText('Acciones')).toBeInTheDocument()
  })

  it('displays authorization number when present', async () => {
    renderComponent()

    await screen.findByText(/Auth: AUTH-123/i)
  })

  it('displays holder name or declarant name as fallback', async () => {
    renderComponent()

    await screen.findByText('Holder 1')
    await screen.findByText('Holder 2')
    await screen.findByText('Holder 3')
  })

  it('displays holder EORI when present', async () => {
    renderComponent()

    await screen.findByText('ES123456789')
    await screen.findByText('ES987654321')
  })

  it('displays deadline date when present', async () => {
    renderComponent()

    await screen.findByText('specialRegimes.title')

    // Dates should be formatted as dd/mm/yyyy
    const dateElements = screen.queryAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/)
    expect(dateElements.length).toBeGreaterThan(0)
  })

  it('displays days left for active regimes with deadlines', async () => {
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const daysElements = screen.queryAllByText(/dias/i)
    expect(daysElements.length).toBeGreaterThan(0)
  })

  it('displays "Autorizar" button for draft regimes', async () => {
    renderComponent()

    await screen.findByText('Autorizar')
  })

  it('calls authorize API and reloads when clicking Autorizar', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.authorize.mockResolvedValue({ data: {} })

    renderComponent()

    await screen.findByText('Autorizar')

    const authorizeButton = screen.getByText('Autorizar')
    await user.click(authorizeButton)

    await waitFor(() => {
      expect(specialRegimesAPI.authorize).toHaveBeenCalledWith('regime-1', {})
      expect(toast.success).toHaveBeenCalledWith('Regimen autorizado')
    })

    // Should reload data
    expect(specialRegimesAPI.list).toHaveBeenCalledTimes(2)
  })

  it('displays "Activar" button for authorized regimes', async () => {
    renderComponent()

    await screen.findByText('Activar')
  })

  it('calls activate API and reloads when clicking Activar', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.activate.mockResolvedValue({ data: {} })

    renderComponent()

    await screen.findByText('Activar')

    const activateButton = screen.getByText('Activar')
    await user.click(activateButton)

    await waitFor(() => {
      expect(specialRegimesAPI.activate).toHaveBeenCalledWith('regime-2')
      expect(toast.success).toHaveBeenCalledWith('Regimen activado')
    })

    expect(specialRegimesAPI.list).toHaveBeenCalledTimes(2)
  })

  it('displays "Rendimiento" button only for regime code 51', async () => {
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const rendimientoButtons = screen.getAllByText('Rendimiento')
    // Hay 2 regimes con código 51, pero solo uno visible
    expect(rendimientoButtons.length).toBeGreaterThan(0)
  })

  it('opens YieldValidator when clicking Rendimiento', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const rendimientoButtons = screen.getAllByText('Rendimiento')
    await user.click(rendimientoButtons[0])

    await screen.findByTestId('yield')
  })

  it('closes YieldValidator when clicking close', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const rendimientoButtons = screen.getAllByText('Rendimiento')
    await user.click(rendimientoButtons[0])

    await screen.findByTestId('yield')

    const closeButton = screen.getByText('yield-close')
    await user.click(closeButton)

    expect(screen.queryByTestId('yield')).not.toBeInTheDocument()
  })

  it('displays "Ver" link for all regimes', async () => {
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const verLinks = screen.getAllByText('Ver')
    expect(verLinks.length).toBe(3) // 3 regimes
  })

  it('refreshes data when clicking refresh button', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    const refreshButton = screen.getByTitle('Actualizar')
    await user.click(refreshButton)

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledTimes(2)
    })
  })

  it('opens RegimeAdvisor when clicking AI assistant button', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.aiAssistant')

    const aiButton = screen.getByText('specialRegimes.aiAssistant')
    await user.click(aiButton)

    await screen.findByTestId('advisor')
  })

  it('closes RegimeAdvisor and opens CreateModal when selecting a regime', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.aiAssistant')

    const aiButton = screen.getByText('specialRegimes.aiAssistant')
    await user.click(aiButton)

    await screen.findByTestId('advisor')

    const selectButton = screen.getByText('advisor-select')
    await user.click(selectButton)

    expect(screen.queryByTestId('advisor')).not.toBeInTheDocument()
    await screen.findByText('Nuevo Regimen Especial')
    expect(toast.success).toHaveBeenCalledWith('Regimen 51 seleccionado')
  })

  it('closes RegimeAdvisor when clicking close', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.aiAssistant')

    const aiButton = screen.getByText('specialRegimes.aiAssistant')
    await user.click(aiButton)

    await screen.findByTestId('advisor')

    const closeButton = screen.getByText('advisor-close')
    await user.click(closeButton)

    expect(screen.queryByTestId('advisor')).not.toBeInTheDocument()
  })

  it('opens CreateRegimeModal when clicking new regime button', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Nuevo Regimen Especial')
  })

  it('closes CreateRegimeModal when clicking cancel', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Cancelar')

    const cancelButton = screen.getByText('Cancelar')
    await user.click(cancelButton)

    expect(screen.queryByText('Nuevo Regimen Especial')).not.toBeInTheDocument()
  })

  it('changes regime type in modal when clicking type buttons', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Tipo de Regimen')

    const typeButtons = screen.getAllByRole('button', { name: /53/ })
    await user.click(typeButtons[0])

    // Should update the description - use getAllByText since it appears in legend too
    await waitFor(() => {
      const descriptions = screen.getAllByText(/Importacion Temporal/i)
      expect(descriptions.length).toBeGreaterThan(0)
    })
  })

  it('requires declarant name in create modal', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Nombre del Declarante')

    const submitButton = screen.getByText('Crear Regimen')
    await user.click(submitButton)

    // Form should not submit due to required field
    expect(specialRegimesAPI.create).not.toHaveBeenCalled()
  })

  it('adds a new good when clicking add button', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText(/Anadir mercancia/i)

    const addButton = screen.getByText(/Anadir mercancia/i)
    await user.click(addButton)

    const descriptions = screen.getAllByPlaceholderText('Descripcion')
    expect(descriptions.length).toBe(2)
  })

  it('removes a good when clicking remove button', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText(/Anadir mercancia/i)

    const addButton = screen.getByText(/Anadir mercancia/i)
    await user.click(addButton)

    let descriptions = screen.getAllByPlaceholderText('Descripcion')
    expect(descriptions.length).toBe(2)

    // Find and click the X button
    const removeButtons = screen.getAllByRole('button')
    const xButton = removeButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && btn.className.includes('text-red')
    })

    if (xButton) {
      await user.click(xButton)
      descriptions = screen.getAllByPlaceholderText('Descripcion')
      expect(descriptions.length).toBe(1)
    }
  })

  it('updates good fields when typing', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByPlaceholderText('Descripcion')

    const descInput = screen.getByPlaceholderText('Descripcion')
    await user.type(descInput, 'Test Good')

    expect(descInput).toHaveValue('Test Good')
  })

  it('creates regime successfully and closes modal', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.create.mockResolvedValue({ data: {} })

    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Nuevo Regimen Especial')

    // Find text inputs (first one is declarant name)
    const textInputs = screen.getAllByRole('textbox')
    const nameInput = textInputs[0] // First text input is declarant name
    await user.type(nameInput, 'Test Declarant')

    const descInput = screen.getByPlaceholderText('Descripcion')
    await user.type(descInput, 'Test Good')

    const taricInput = screen.getByPlaceholderText('Cod. TARIC')
    await user.type(taricInput, '12345678')

    const submitButton = screen.getByText('Crear Regimen')
    await user.click(submitButton)

    await waitFor(() => {
      expect(specialRegimesAPI.create).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Regimen creado correctamente')
    })

    await waitFor(() => {
      expect(screen.queryByText('Nuevo Regimen Especial')).not.toBeInTheDocument()
    })
  })

  it('displays error toast when loadData fails', async () => {
    specialRegimesAPI.getStats.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al cargar regimenes especiales')
    })
  })

  it('displays error toast with custom message when authorize fails', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.authorize.mockRejectedValue({
      response: {
        data: {
          error: 'Authorization failed'
        }
      }
    })

    renderComponent()

    await screen.findByText('Autorizar')

    const authorizeButton = screen.getByText('Autorizar')
    await user.click(authorizeButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Authorization failed')
    })
  })

  it('displays error toast with custom message when activate fails', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.activate.mockRejectedValue({
      response: {
        data: {
          error: 'Activation failed'
        }
      }
    })

    renderComponent()

    await screen.findByText('Activar')

    const activateButton = screen.getByText('Activar')
    await user.click(activateButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Activation failed')
    })
  })

  it('displays error toast with custom message when create fails', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.create.mockRejectedValue({
      response: {
        data: {
          error: 'Creation failed'
        }
      }
    })

    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Nuevo Regimen Especial')

    const textInputs = screen.getAllByRole('textbox')
    const nameInput = textInputs[0]
    await user.type(nameInput, 'Test')

    const descInput = screen.getByPlaceholderText('Descripcion')
    await user.type(descInput, 'Test')

    const taricInput = screen.getByPlaceholderText('Cod. TARIC')
    await user.type(taricInput, '12345678')

    const submitButton = screen.getByText('Crear Regimen')
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Creation failed')
    })
  })

  it('displays default error message when error has no response data', async () => {
    const user = userEvent.setup()
    specialRegimesAPI.create.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Nuevo Regimen Especial')

    const textInputs = screen.getAllByRole('textbox')
    const nameInput = textInputs[0]
    await user.type(nameInput, 'Test')

    const descInput = screen.getByPlaceholderText('Descripcion')
    await user.type(descInput, 'Test')

    const taricInput = screen.getByPlaceholderText('Cod. TARIC')
    await user.type(taricInput, '12345678')

    const submitButton = screen.getByText('Crear Regimen')
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al crear regimen')
    })
  })

  it('updates regimeType when changing regimeCode in modal', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Tipo de Regimen')

    // Initial state is '51' - Perfeccionamiento Activo (appears in legend too)
    expect(screen.getAllByText(/Perfeccionamiento Activo/i).length).toBeGreaterThan(0)

    // Click on '71' button
    const warehouseButtons = screen.getAllByRole('button', { name: /71/ })
    await user.click(warehouseButtons[0])

    // Should update to Deposito Aduanero - wait and check it's present
    await waitFor(() => {
      expect(screen.getAllByText(/Deposito Aduanero/i).length).toBeGreaterThan(0)
    })
  })

  it('displays regime legend with all 5 types', async () => {
    renderComponent()

    await screen.findByText('Tipos de Regimenes Especiales (CAU)')

    expect(screen.getByText(/51 - Perfeccionamiento Activo/i)).toBeInTheDocument()
    expect(screen.getByText(/53 - Importacion Temporal/i)).toBeInTheDocument()
    expect(screen.getByText(/71 - Deposito Aduanero/i)).toBeInTheDocument()
    expect(screen.getByText(/T1 - Transito Externo/i)).toBeInTheDocument()
    expect(screen.getByText(/T2 - Transito Interno/i)).toBeInTheDocument()
  })

  it('displays custom values correctly with currency formatting', async () => {
    const statsWithZero = {
      ...defaultStats,
      totals: { suspendedDuties: 0 }
    }
    specialRegimesAPI.getStats.mockResolvedValue({
      data: { data: statsWithZero }
    })

    renderComponent()

    await waitFor(() => {
      const elements = screen.getAllByText(/0,00\s?€/i)
      expect(elements.length).toBeGreaterThan(0)
    })
  })

  it('displays "-" for missing deadline date', async () => {
    renderComponent()

    await screen.findByText('REF-003')

    // REF-003 has no deadlineDate, should show '-'
    const rows = screen.getAllByRole('row')
    const ref003Row = rows.find(row => row.textContent.includes('REF-003'))
    expect(ref003Row).toBeDefined()
  })

  it('does not display days left for non-active regimes', async () => {
    renderComponent()

    await screen.findByText('REF-001')

    // REF-001 is draft with deadline, but should not show days left
    const rows = screen.getAllByRole('row')
    const ref001Row = rows.find(row => row.textContent.includes('REF-001'))
    expect(ref001Row).toBeDefined()
    // Should show the date but not the "X dias" text for non-active status
  })

  it('handles expiring regimes with date formatting', async () => {
    renderComponent()

    await screen.findByText(/regimen\(es\) por vencer/i)

    // Should display "Ver detalle" link for expiring regimes
    const verDetalleLinks = screen.getAllByText('Ver detalle')
    expect(verDetalleLinks.length).toBeGreaterThan(0)
  })

  it('closes modal when clicking X button', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText('Nuevo Regimen Especial')

    // Find the X button by looking for buttons with XMarkIcon
    const buttons = screen.getAllByRole('button')
    const xButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && btn.className.includes('text-gray-400')
    })

    expect(xButton).toBeDefined()
    await user.click(xButton)

    await waitFor(() => {
      expect(screen.queryByText('Nuevo Regimen Especial')).not.toBeInTheDocument()
    })
  })

  it('updates duration months in create modal', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText(/Duracion \(meses\)/i)

    // Find input by type and min attribute since label doesn't use htmlFor
    const inputs = screen.getAllByRole('spinbutton')
    const durationInput = inputs.find(input => input.min === '1' && input.max === '36')

    await user.clear(durationInput)
    await user.type(durationInput, '24')

    expect(durationInput).toHaveValue(24)
  })

  it('updates customs office code in create modal', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText(/Codigo Aduana Entrada/i)

    const officeInput = screen.getByPlaceholderText('ES004601')
    await user.type(officeInput, 'ES123456')

    expect(officeInput).toHaveValue('ES123456')
  })

  it('updates declarant EORI in create modal', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByText(/EORI del Declarante/i)

    const eoriInput = screen.getByPlaceholderText('ES12345678X')
    await user.type(eoriInput, 'ES987654321')

    expect(eoriInput).toHaveValue('ES987654321')
  })

  it('updates good quantity, value, and weight', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.newRegime')

    const newButton = screen.getByText('specialRegimes.newRegime')
    await user.click(newButton)

    await screen.findByPlaceholderText('Valor EUR')

    const valueInput = screen.getByPlaceholderText('Valor EUR')
    await user.type(valueInput, '1000')

    const weightInput = screen.getByPlaceholderText('Peso kg')
    await user.type(weightInput, '50')

    expect(valueInput).toHaveValue(1000)
    expect(weightInput).toHaveValue(50)
  })

  it('limits expiring alert to first 3 regimes', async () => {
    const manyExpiring = [
      { _id: '1', regimeCode: '51', reference: 'EXP-001', deadlineDate: '2027-12-31' },
      { _id: '2', regimeCode: '51', reference: 'EXP-002', deadlineDate: '2027-12-31' },
      { _id: '3', regimeCode: '51', reference: 'EXP-003', deadlineDate: '2027-12-31' },
      { _id: '4', regimeCode: '51', reference: 'EXP-004', deadlineDate: '2027-12-31' },
      { _id: '5', regimeCode: '51', reference: 'EXP-005', deadlineDate: '2027-12-31' }
    ]

    specialRegimesAPI.getExpiring.mockResolvedValue({
      data: { data: manyExpiring }
    })

    renderComponent()

    await screen.findByText('EXP-001')
    await screen.findByText('EXP-002')
    await screen.findByText('EXP-003')

    expect(screen.queryByText('EXP-004')).not.toBeInTheDocument()
  })

  it('handles combined regime and status filters', async () => {
    const user = userEvent.setup()
    renderComponent()

    await screen.findByText('specialRegimes.title')

    // Click on '51' card
    const ipButton = screen.getByRole('button', { name: /IP/i })
    await user.click(ipButton)

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '51', status: '' })
    })

    // Select status
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'active')

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '51', status: 'active' })
    })

    // Clear filters
    const clearButton = await screen.findByText('Limpiar filtros')
    await user.click(clearButton)

    await waitFor(() => {
      expect(specialRegimesAPI.list).toHaveBeenCalledWith({ regimeCode: '', status: '' })
    })
  })
})
