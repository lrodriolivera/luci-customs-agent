import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GuaranteesManager from './GuaranteesManager'
import { guaranteesAPI } from '../../services/api'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k })
}))

vi.mock('../../services/api', () => ({
  guaranteesAPI: {
    list: vi.fn(),
    getStats: vi.fn(),
    getAlerts: vi.fn(),
    create: vi.fn()
  }
}))

describe('GuaranteesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Loading', () => {
    it('muestra spinner mientras carga', () => {
      guaranteesAPI.list.mockReturnValue(new Promise(() => {}))
      guaranteesAPI.getStats.mockReturnValue(new Promise(() => {}))
      guaranteesAPI.getAlerts.mockReturnValue(new Promise(() => {}))

      render(<GuaranteesManager />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('carga datos iniciales al montar', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await waitFor(() => {
        expect(guaranteesAPI.list).toHaveBeenCalledWith({})
        expect(guaranteesAPI.getStats).toHaveBeenCalled()
        expect(guaranteesAPI.getAlerts).toHaveBeenCalled()
      })
    })

    it('maneja error al cargar datos', async () => {
      guaranteesAPI.list.mockRejectedValue({ response: { data: { error: 'Error de red' } } })
      guaranteesAPI.getStats.mockRejectedValue({ response: { data: { error: 'Error de red' } } })
      guaranteesAPI.getAlerts.mockRejectedValue({ response: { data: { error: 'Error de red' } } })

      render(<GuaranteesManager />)

      await waitFor(() => {
        expect(screen.queryByText('guarantees.title')).toBeInTheDocument()
      })
    })

    it('usa mensaje i18n cuando error no tiene response', async () => {
      guaranteesAPI.list.mockRejectedValue(new Error('Network error'))
      guaranteesAPI.getStats.mockRejectedValue(new Error('Network error'))
      guaranteesAPI.getAlerts.mockRejectedValue(new Error('Network error'))

      render(<GuaranteesManager />)

      await waitFor(() => {
        expect(screen.queryByText('guarantees.title')).toBeInTheDocument()
      })
    })
  })

  describe('Stats Display', () => {
    it('muestra estadisticas cuando stats existe', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({
        data: {
          data: {
            active: 5,
            totalAmount: 100000,
            availableAmount: 75000
          }
        }
      })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.activeGuarantees')
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('guarantees.totalAmount')).toBeInTheDocument()
      expect(screen.getByText('guarantees.available')).toBeInTheDocument()
      expect(screen.getByText('guarantees.used')).toBeInTheDocument()
    })

    it('no muestra seccion de stats cuando stats es null', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.title')
      expect(screen.queryByText('guarantees.activeGuarantees')).not.toBeInTheDocument()
    })

    it('maneja stats con valores 0', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({
        data: {
          data: {
            active: 0,
            totalAmount: 0,
            availableAmount: 0
          }
        }
      })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('0')
    })
  })

  describe('Alerts Display', () => {
    it('muestra alertas cuando hay datos', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({
        data: {
          data: [
            { message: 'Alerta 1' },
            { description: 'Alerta 2 desde description' },
            { message: 'Alerta 3', description: 'descripcion ignorada' }
          ]
        }
      })

      render(<GuaranteesManager />)

      await screen.findByText('Alerta 1')
      expect(screen.getByText('Alerta 1')).toBeInTheDocument()
      expect(screen.getByText('Alerta 2 desde description')).toBeInTheDocument()
      expect(screen.getByText('Alerta 3')).toBeInTheDocument()
    })

    it('no muestra seccion de alertas cuando array vacio', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.title')
      expect(screen.queryByText('guarantees.alerts')).not.toBeInTheDocument()
    })

    it('muestra maximo 3 alertas aunque haya mas', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({
        data: {
          data: [
            { message: 'Alerta 1' },
            { message: 'Alerta 2' },
            { message: 'Alerta 3' },
            { message: 'Alerta 4' },
            { message: 'Alerta 5' }
          ]
        }
      })

      render(<GuaranteesManager />)

      await screen.findByText('Alerta 1')
      expect(screen.getByText('Alerta 1')).toBeInTheDocument()
      expect(screen.getByText('Alerta 2')).toBeInTheDocument()
      expect(screen.getByText('Alerta 3')).toBeInTheDocument()
      expect(screen.queryByText('Alerta 4')).not.toBeInTheDocument()
    })
  })

  describe('Filter Changes', () => {
    it('aplica filtro all sin parametros', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.title')
      expect(guaranteesAPI.list).toHaveBeenCalledWith({})
    })

    it('aplica filtro active con parametro status', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.statusActive')
      vi.clearAllMocks()

      fireEvent.click(screen.getByText('guarantees.statusActive'))

      await waitFor(() => {
        expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: 'active' })
      })
    })

    it('aplica filtro pending', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.statusPending')
      vi.clearAllMocks()

      fireEvent.click(screen.getByText('guarantees.statusPending'))

      await waitFor(() => {
        expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: 'pending' })
      })
    })

    it('aplica filtro expired', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.statusExpired')
      vi.clearAllMocks()

      fireEvent.click(screen.getByText('guarantees.statusExpired'))

      await waitFor(() => {
        expect(guaranteesAPI.list).toHaveBeenCalledWith({ status: 'expired' })
      })
    })
  })

  describe('Create Form Toggle', () => {
    it('muestra formulario al hacer click en nuevo', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await waitFor(() => {
        expect(screen.getByText('guarantees.guaranteeType')).toBeInTheDocument()
      })
    })

    it('oculta formulario al hacer click en cancelar', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await screen.findByText('common.cancel')
      fireEvent.click(screen.getByText('common.cancel'))

      await waitFor(() => {
        expect(screen.queryByText('guarantees.guaranteeType')).not.toBeInTheDocument()
      })
    })

    it('puede alternar formulario multiples veces', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      const toggleBtn = screen.getAllByText('guarantees.newGuarantee')[0]

      fireEvent.click(toggleBtn)
      await screen.findByText('guarantees.guaranteeType')

      fireEvent.click(toggleBtn)
      await waitFor(() => {
        expect(screen.queryByText('guarantees.guaranteeType')).not.toBeInTheDocument()
      })

      fireEvent.click(toggleBtn)
      await screen.findByText('guarantees.guaranteeType')
    })
  })

  describe('Form Input Changes', () => {
    it('actualiza todos los campos del formulario', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await screen.findByPlaceholderText('Banco Santander')

      const typeSelect = document.querySelector('select[name="type"]')
      const amountInput = screen.getByPlaceholderText('10000')
      const currencySelect = document.querySelector('select[name="currency"]')
      const guarantorNameInput = screen.getByPlaceholderText('Banco Santander')
      const guarantorNifInput = screen.getByPlaceholderText('A28000000')
      const grnInput = screen.getByPlaceholderText('26ESxxxxxxxxx')
      const notesInput = screen.getByPlaceholderText('Notas adicionales...')

      fireEvent.change(typeSelect, { target: { name: 'type', value: 'deposit' } })
      fireEvent.change(amountInput, { target: { name: 'amount', value: '50000' } })
      fireEvent.change(currencySelect, { target: { name: 'currency', value: 'USD' } })
      fireEvent.change(guarantorNameInput, { target: { name: 'guarantorName', value: 'BBVA' } })
      fireEvent.change(guarantorNifInput, { target: { name: 'guarantorNif', value: 'B12345678' } })
      fireEvent.change(grnInput, { target: { name: 'grn', value: '26ES123456789' } })
      fireEvent.change(notesInput, { target: { name: 'notes', value: 'Test note' } })

      expect(typeSelect.value).toBe('deposit')
      expect(amountInput.value).toBe('50000')
      expect(currencySelect.value).toBe('USD')
      expect(guarantorNameInput.value).toBe('BBVA')
      expect(guarantorNifInput.value).toBe('B12345678')
      expect(grnInput.value).toBe('26ES123456789')
      expect(notesInput.value).toBe('Test note')
    })
  })

  describe('Create Guarantee', () => {
    it('crea garantia con exito y resetea formulario', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.create.mockResolvedValue({ data: { success: true } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await screen.findByPlaceholderText('10000')

      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { name: 'amount', value: '25000' } })
      fireEvent.change(screen.getByPlaceholderText('Banco Santander'), { target: { name: 'guarantorName', value: 'Test Bank' } })

      const dateInput = document.querySelector('input[type="date"]')
      fireEvent.change(dateInput, { target: { name: 'expirationDate', value: '2027-12-31' } })

      vi.clearAllMocks()

      const form = screen.getByPlaceholderText('10000').closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(guaranteesAPI.create).toHaveBeenCalledWith({
          type: 'CGU',
          guarantorName: 'Test Bank',
          guarantorNif: '',
          amount: 25000,
          currency: 'EUR',
          grn: '',
          expirationDate: '2027-12-31',
          notes: ''
        })
      })

      await waitFor(() => {
        expect(guaranteesAPI.list).toHaveBeenCalled()
      })
    })

    it('muestra error al crear garantia', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.create.mockRejectedValue({ response: { data: { error: 'Error de validacion' } } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await screen.findByPlaceholderText('10000')

      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { name: 'amount', value: '10000' } })
      fireEvent.change(screen.getByPlaceholderText('Banco Santander'), { target: { name: 'guarantorName', value: 'Test' } })

      const dateInput = document.querySelector('input[type="date"]')
      fireEvent.change(dateInput, { target: { name: 'expirationDate', value: '2027-12-31' } })

      const form = screen.getByPlaceholderText('10000').closest('form')
      fireEvent.submit(form)

      await screen.findByText('Error de validacion')
    })

    it('usa mensaje i18n cuando error no tiene response', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.create.mockRejectedValue(new Error('Network error'))

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await screen.findByPlaceholderText('10000')

      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { name: 'amount', value: '10000' } })
      fireEvent.change(screen.getByPlaceholderText('Banco Santander'), { target: { name: 'guarantorName', value: 'Test' } })

      const dateInput = document.querySelector('input[type="date"]')
      fireEvent.change(dateInput, { target: { name: 'expirationDate', value: '2027-12-31' } })

      const form = screen.getByPlaceholderText('10000').closest('form')
      fireEvent.submit(form)

      await screen.findByText('guarantees.errorCreating')
    })

    it('muestra spinner durante creacion', async () => {
      let resolveCreate
      const createPromise = new Promise((resolve) => { resolveCreate = resolve })

      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.create.mockReturnValue(createPromise)

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.newGuarantee')
      fireEvent.click(screen.getAllByText('guarantees.newGuarantee')[0])

      await screen.findByPlaceholderText('10000')

      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { name: 'amount', value: '10000' } })
      fireEvent.change(screen.getByPlaceholderText('Banco Santander'), { target: { name: 'guarantorName', value: 'Test' } })

      const dateInput = document.querySelector('input[type="date"]')
      fireEvent.change(dateInput, { target: { name: 'expirationDate', value: '2027-12-31' } })

      const form = screen.getByPlaceholderText('10000').closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        const spinners = document.querySelectorAll('.animate-spin')
        expect(spinners.length).toBeGreaterThan(0)
      })

      resolveCreate({ data: { success: true } })

      await waitFor(() => {
        expect(guaranteesAPI.list).toHaveBeenCalled()
      })
    })
  })

  describe('Guarantee List - Empty State', () => {
    it('muestra mensaje cuando no hay garantias', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.noGuarantees')
      expect(screen.getByText('guarantees.createFirstGuarantee')).toBeInTheDocument()
    })

    it('abre formulario desde el boton del estado vacio', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: [] } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.createFirstGuarantee')
      fireEvent.click(screen.getByText('guarantees.createFirstGuarantee'))

      await screen.findByText('guarantees.guaranteeType')
    })
  })

  describe('Guarantee List - With Data', () => {
    const mockGuarantees = [
      {
        _id: '1',
        guaranteeNumber: 'G001',
        type: 'CGU',
        status: 'active',
        amount: 100000,
        balance: { available: 75000 },
        guarantor: { name: 'Banco Santander', nif: 'A12345678' },
        grn: '26ES123456789',
        activationDate: '2026-01-01',
        expirationDate: '2027-12-31'
      }
    ]

    it('muestra lista de garantias', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: mockGuarantees } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      expect(screen.getByText('Banco Santander')).toBeInTheDocument()
    })

    it('maneja lista en data.guarantees', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: { guarantees: mockGuarantees } } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
    })

    it('expande y colapsa detalles de garantia', async () => {
      guaranteesAPI.list.mockResolvedValue({ data: { data: mockGuarantees } })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')

      expect(screen.queryByText('26ES123456789')).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('26ES123456789')
      expect(screen.getByText('A12345678')).toBeInTheDocument()

      fireEvent.click(screen.getByText('G001'))

      await waitFor(() => {
        expect(screen.queryByText('26ES123456789')).not.toBeInTheDocument()
      })
    })
  })

  describe('Status Badge', () => {
    it('renderiza badge pending', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'pending',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('Pendiente')
    })

    it('renderiza badge active', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('Activa')
    })

    it('renderiza badge suspended', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'suspended',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('Suspendida')
    })

    it('renderiza badge expired', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'expired',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('Vencida')
    })

    it('renderiza badge cancelled', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'cancelled',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('Cancelada')
    })

    it('renderiza status desconocido sin romper', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'unknown_status',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('unknown_status')
    })
  })

  describe('Type Badge', () => {
    it('renderiza badge CGU', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const badge = screen.getByText('CGU')
      expect(badge.title).toBe('Garantia Global Unica')
    })

    it('renderiza badge deposit', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'deposit',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const badge = screen.getByText('Deposito')
      expect(badge.title).toBe('Deposito en efectivo')
    })

    it('renderiza badge bank_guarantee', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'bank_guarantee',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const badge = screen.getByText('Aval')
      expect(badge.title).toBe('Aval bancario')
    })

    it('renderiza badge insurance', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'insurance',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const badge = screen.getByText('Seguro')
      expect(badge.title).toBe('Seguro de caucion')
    })

    it('renderiza type desconocido sin romper', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'unknown_type',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const badge = screen.getByText('unknown_type')
      expect(badge.title).toBe('')
    })
  })

  describe('FormatCurrency', () => {
    it('formatea cantidades en EUR', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 100000,
            balance: { available: 75000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const container = screen.getByText('G001').closest('.card')
      expect(container.textContent).toContain('75')
      expect(container.textContent).toContain('100')
    })

    it('formatea 0 cuando amount es null', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: null,
            balance: { available: 0 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
    })
  })

  describe('CalculateUsagePercent', () => {
    it('calcula porcentaje correcto', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 100000,
            balance: { available: 40000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      expect(screen.getByText(/60%/)).toBeInTheDocument()
    })

    it('retorna 0 cuando amount es 0', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 0,
            balance: { available: 0 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      expect(screen.getByText(/0%/)).toBeInTheDocument()
    })

    it('retorna 0 cuando amount es null', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: null,
            balance: { available: 0 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      expect(screen.getByText(/0%/)).toBeInTheDocument()
    })

    it('maneja balance undefined', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 100000
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      expect(screen.getByText(/100%/)).toBeInTheDocument()
    })
  })

  describe('Usage Bar Color', () => {
    it('usa color verde cuando uso es bajo', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 100000,
            balance: { available: 80000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const bar = document.querySelector('.bg-green-500')
      expect(bar).toBeInTheDocument()
    })

    it('usa color amarillo cuando uso es medio', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 100000,
            balance: { available: 40000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const bar = document.querySelector('.bg-yellow-500')
      expect(bar).toBeInTheDocument()
    })

    it('usa color rojo cuando uso es alto', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 100000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      const bar = document.querySelector('.bg-red-500')
      expect(bar).toBeInTheDocument()
    })
  })

  describe('Expanded Details', () => {
    it('muestra N/A cuando grn no existe', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 },
            guarantor: { name: 'Test', nif: 'A12345678' }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A')
        expect(naElements.length).toBeGreaterThan(0)
      })
    })

    it('muestra guarantees.noGuarantor cuando no hay guarantor', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('guarantees.noGuarantor')
    })

    it('muestra fecha de expiracion en rojo cuando vencida', async () => {
      const pastDate = '2020-01-01'
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'expired',
            amount: 10000,
            balance: { available: 10000 },
            expirationDate: pastDate
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await waitFor(() => {
        const element = document.querySelector('.text-red-600')
        expect(element).toBeInTheDocument()
      })
    })

    it('muestra guarantees.noDate cuando no hay expirationDate', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('guarantees.noDate')
    })
  })

  describe('Linked Expeditions', () => {
    it('muestra expediciones vinculadas cuando existen', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 },
            linkedExpeditions: [
              { expeditionId: 'exp1', expeditionNumber: 'EXP-001' },
              { expeditionId: 'exp2', expeditionNumber: 'EXP-002' }
            ]
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('EXP-001')
      expect(screen.getByText('EXP-002')).toBeInTheDocument()
    })

    it('muestra expeditionId cuando no hay expeditionNumber', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 },
            linkedExpeditions: [
              { expeditionId: 'exp1' }
            ]
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('exp1')
    })

    it('muestra solo 5 expediciones y contador de mas', async () => {
      const expeditions = Array.from({ length: 10 }, (_, i) => ({
        expeditionId: `exp${i}`,
        expeditionNumber: `EXP-${String(i).padStart(3, '0')}`
      }))

      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 },
            linkedExpeditions: expeditions
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('+5 mas')
      expect(screen.getByText('EXP-000')).toBeInTheDocument()
      expect(screen.getByText('EXP-004')).toBeInTheDocument()
      expect(screen.queryByText('EXP-005')).not.toBeInTheDocument()
    })

    it('no muestra seccion cuando linkedExpeditions esta vacio', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 },
            linkedExpeditions: []
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await waitFor(() => {
        expect(screen.queryByText('guarantees.linkedExpeditions')).not.toBeInTheDocument()
      })
    })

    it('no muestra seccion cuando linkedExpeditions no existe', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await waitFor(() => {
        expect(screen.queryByText('guarantees.linkedExpeditions')).not.toBeInTheDocument()
      })
    })
  })

  describe('Action Buttons', () => {
    it('muestra boton viewMovements siempre', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('guarantees.viewMovements')
    })

    it('muestra boton renew solo cuando status es active', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'active',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('guarantees.renew')
    })

    it('no muestra boton renew cuando status no es active', async () => {
      guaranteesAPI.list.mockResolvedValue({
        data: {
          data: [{
            _id: '1',
            guaranteeNumber: 'G001',
            type: 'CGU',
            status: 'expired',
            amount: 10000,
            balance: { available: 10000 }
          }]
        }
      })
      guaranteesAPI.getStats.mockResolvedValue({ data: { data: null } })
      guaranteesAPI.getAlerts.mockResolvedValue({ data: { data: [] } })

      render(<GuaranteesManager />)

      await screen.findByText('G001')
      fireEvent.click(screen.getByText('G001'))

      await screen.findByText('guarantees.viewMovements')
      expect(screen.queryByText('guarantees.renew')).not.toBeInTheDocument()
    })
  })
})
