import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import H7DirectForm from './H7DirectForm'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'

// Mocks
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('./EU2026382Banner', () => ({
  default: () => null
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k) => k
  })
}))

vi.mock('../../services/api', () => ({
  h7API: {
    create: vi.fn()
  }
}))

// Helper para rellenar un formulario mínimo válido
function fillMinimalValidForm(container) {
  const trackingInput = container.querySelector('input[name="trackingNumber"]')
  fireEvent.change(trackingInput, { target: { value: 'TRACK123' } })

  const senderNameInput = container.querySelector('input[name="senderName"]')
  fireEvent.change(senderNameInput, { target: { value: 'Sender Company' } })

  const recipientNameInput = container.querySelector('input[name="recipientName"]')
  fireEvent.change(recipientNameInput, { target: { value: 'Recipient Name' } })

  const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
  fireEvent.change(recipientStreetInput, { target: { value: 'Main St 123' } })

  // Rellenar item mínimo: description, taricCode, netWeight, quantity, unitValue
  const itemDescription = screen.getByPlaceholderText('Ej: Funda movil silicona')
  fireEvent.change(itemDescription, { target: { value: 'Product description' } })

  const itemTaric = screen.getByPlaceholderText('392690')
  fireEvent.change(itemTaric, { target: { value: '392690' } })

  // netWeight (step="0.001")
  const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
  fireEvent.change(itemNetWeight, { target: { value: '0.5' } })

  // quantity (min="1")
  const itemQuantity = container.querySelector('input[type="number"][min="1"]')
  fireEvent.change(itemQuantity, { target: { value: '2' } })

  // unitValue (step="0.01" min="0")
  const itemUnitValue = container.querySelector('input[type="number"][step="0.01"][min="0"]')
  fireEvent.change(itemUnitValue, { target: { value: '50' } })
  // Esto da intrinsicValue = 2 * 50 = 100 (válido: 0 < 100 <= 150)
}

describe('H7DirectForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('Renderizado inicial', () => {
    it('renderiza el título y descripción', () => {
      render(<H7DirectForm />)
      expect(screen.getByText('Nueva Declaracion H7')).toBeDefined()
      expect(screen.getByText(/Declaracion simplificada para envios de bajo valor/i)).toBeDefined()
    })

    it('renderiza todas las secciones principales', () => {
      render(<H7DirectForm />)
      expect(screen.getByText('Datos del envio')).toBeDefined()
      expect(screen.getByText(/Remitente \(Vendedor\/Expedidor\)/i)).toBeDefined()
      expect(screen.getByText(/Destinatario \(Comprador\)/i)).toBeDefined()
      expect(screen.getByText(/Articulos \(1\)/i)).toBeDefined()
      expect(screen.getByText('Totales y costes')).toBeDefined()
    })

    it('inicializa con valores por defecto correctos', () => {
      const { container } = render(<H7DirectForm />)
      const carrierSelect = container.querySelector('select[name="carrierCode"]')
      expect(carrierSelect.value).toBe('DHL')

      const customsOfficeSelect = container.querySelector('select[name="customsOffice"]')
      expect(customsOfficeSelect.value).toBe('ES002801')

      const operationTypeSelect = container.querySelector('select[name="operationType"]')
      expect(operationTypeSelect.value).toBe('B2C')
    })

    it('renderiza un item inicial vacío', () => {
      render(<H7DirectForm />)
      expect(screen.getByText('Articulo 1')).toBeDefined()
      expect(screen.getByPlaceholderText('Ej: Funda movil silicona')).toBeDefined()
    })

    it('inicializa shippingCost e insuranceCost en 0', () => {
      const { container } = render(<H7DirectForm />)
      const shippingInput = container.querySelector('input[name="shippingCost"]')
      expect(shippingInput.value).toBe('0')

      const insuranceInput = container.querySelector('input[name="insuranceCost"]')
      expect(insuranceInput.value).toBe('0')
    })
  })

  describe('Cambios en campos del formulario', () => {
    it('actualiza trackingNumber correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(input, { target: { value: 'TRACK12345' } })
      expect(input.value).toBe('TRACK12345')
    })

    it('actualiza carrierCode correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const select = container.querySelector('select[name="carrierCode"]')
      fireEvent.change(select, { target: { value: 'FEDEX' } })
      expect(select.value).toBe('FEDEX')
    })

    it('actualiza customsOffice correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const select = container.querySelector('select[name="customsOffice"]')
      fireEvent.change(select, { target: { value: 'ES000101' } })
      expect(select.value).toBe('ES000101')
    })

    it('actualiza iossNumber correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="iossNumber"]')
      fireEvent.change(input, { target: { value: 'IM9999999999' } })
      expect(input.value).toBe('IM9999999999')
    })

    it('actualiza ecommercePlatform correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const select = container.querySelector('select[name="ecommercePlatform"]')
      fireEvent.change(select, { target: { value: 'AMAZON' } })
      expect(select.value).toBe('AMAZON')
    })

    it('actualiza senderName correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="senderName"]')
      fireEvent.change(input, { target: { value: 'Sender Inc' } })
      expect(input.value).toBe('Sender Inc')
    })

    it('actualiza recipientName correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="recipientName"]')
      fireEvent.change(input, { target: { value: 'Recipient LLC' } })
      expect(input.value).toBe('Recipient LLC')
    })

    it('actualiza recipientStreet correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(input, { target: { value: 'Fake St 123' } })
      expect(input.value).toBe('Fake St 123')
    })

    it('actualiza shippingCost correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="shippingCost"]')
      fireEvent.change(input, { target: { value: '15.50' } })
      expect(input.value).toBe('15.50')
    })

    it('actualiza grossWeight correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="grossWeight"]')
      fireEvent.change(input, { target: { value: '2.5' } })
      expect(input.value).toBe('2.5')
    })

    it('actualiza packages correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[name="packages"]')
      fireEvent.change(input, { target: { value: '3' } })
      expect(input.value).toBe('3')
    })
  })

  describe('Items - gestión y auto-cálculo', () => {
    it('agrega un nuevo item al hacer clic en Agregar articulo', () => {
      render(<H7DirectForm />)
      expect(screen.getByText('Articulo 1')).toBeDefined()

      const addButton = screen.getByRole('button', { name: /Agregar articulo/i })
      fireEvent.click(addButton)

      expect(screen.getByText('Articulo 2')).toBeDefined()
      expect(screen.getByText(/Articulos \(2\)/i)).toBeDefined()
    })

    it('elimina un item si hay más de uno', () => {
      render(<H7DirectForm />)
      const addButton = screen.getByRole('button', { name: /Agregar articulo/i })
      fireEvent.click(addButton)

      expect(screen.getByText('Articulo 2')).toBeDefined()

      const trashButtons = screen.getAllByRole('button').filter(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.closest('.border-gray-100')
      })
      fireEvent.click(trashButtons[0])

      expect(screen.queryByText('Articulo 2')).toBeNull()
      expect(screen.getByText(/Articulos \(1\)/i)).toBeDefined()
    })

    it('NO elimina el item si solo hay uno', () => {
      render(<H7DirectForm />)
      expect(screen.getByText('Articulo 1')).toBeDefined()

      const trashButtons = screen.queryAllByRole('button').filter(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.closest('.border-gray-100')
      })
      expect(trashButtons.length).toBe(0)
    })

    it('auto-calcula totalValue cuando cambia quantity', () => {
      const { container } = render(<H7DirectForm />)

      const quantityInput = container.querySelector('input[type="number"][min="1"]')
      const unitValueInput = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      const totalValueInput = container.querySelector('input[type="number"][step="0.01"][readonly]')

      fireEvent.change(unitValueInput, { target: { value: '25.00' } })
      fireEvent.change(quantityInput, { target: { value: '3' } })

      expect(totalValueInput.value).toBe('75.00')
    })

    it('auto-calcula totalValue cuando cambia unitValue', () => {
      const { container } = render(<H7DirectForm />)

      const quantityInput = container.querySelector('input[type="number"][min="1"]')
      const unitValueInput = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      const totalValueInput = container.querySelector('input[type="number"][step="0.01"][readonly]')

      fireEvent.change(quantityInput, { target: { value: '2' } })
      fireEvent.change(unitValueInput, { target: { value: '12.50' } })

      expect(totalValueInput.value).toBe('25.00')
    })

    it('actualiza description de un item correctamente', () => {
      render(<H7DirectForm />)
      const input = screen.getByPlaceholderText('Ej: Funda movil silicona')
      fireEvent.change(input, { target: { value: 'Test product' } })
      expect(input.value).toBe('Test product')
    })

    it('actualiza taricCode de un item correctamente', () => {
      render(<H7DirectForm />)
      const input = screen.getByPlaceholderText('392690')
      fireEvent.change(input, { target: { value: '123456' } })
      expect(input.value).toBe('123456')
    })

    it('actualiza netWeight de un item correctamente', () => {
      const { container } = render(<H7DirectForm />)
      const input = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(input, { target: { value: '1.234' } })
      expect(input.value).toBe('1.234')
    })
  })

  describe('Cálculos de totales', () => {
    it('calcula intrinsicValue como suma de totalValue de items', () => {
      const { container } = render(<H7DirectForm />)

      // Item 1: quantity=2, unitValue=10 => totalValue=20
      const quantityInput = container.querySelector('input[type="number"][min="1"]')
      const unitValueInput = container.querySelector('input[type="number"][step="0.01"][min="0"]')

      fireEvent.change(quantityInput, { target: { value: '2' } })
      fireEvent.change(unitValueInput, { target: { value: '10' } })

      // Agregar segundo item
      const addButton = screen.getByRole('button', { name: /Agregar articulo/i })
      fireEvent.click(addButton)

      const allQuantity = container.querySelectorAll('input[type="number"][min="1"]')
      const allUnitValue = container.querySelectorAll('input[type="number"][step="0.01"][min="0"]')

      fireEvent.change(allQuantity[1], { target: { value: '1' } })
      fireEvent.change(allUnitValue[1], { target: { value: '15' } })

      // intrinsicValue = 20 + 15 = 35
      // Buscar en el contenedor de resumen que tiene "Valor intrinseco"
      const summarySection = screen.getByText('Valor intrinseco').closest('div')
      expect(within(summarySection).getByText(/35\.00 EUR/)).toBeDefined()
    })

    it('calcula customsValue como intrinsicValue + shippingCost + insuranceCost', () => {
      const { container } = render(<H7DirectForm />)

      const quantityInput = container.querySelector('input[type="number"][min="1"]')
      const unitValueInput = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      const shippingInput = container.querySelector('input[name="shippingCost"]')
      const insuranceInput = container.querySelector('input[name="insuranceCost"]')

      fireEvent.change(quantityInput, { target: { value: '1' } })
      fireEvent.change(unitValueInput, { target: { value: '50' } })
      fireEvent.change(shippingInput, { target: { value: '10' } })
      fireEvent.change(insuranceInput, { target: { value: '5' } })

      // customsValue = 50 + 10 + 5 = 65
      const summarySection = screen.getByText('Valor en aduana (CIF)').closest('div')
      expect(within(summarySection).getByText(/65\.00 EUR/)).toBeDefined()
    })

    it('calcula totalNetWeight como suma de netWeight de items', () => {
      const { container } = render(<H7DirectForm />)

      const netWeightInput = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(netWeightInput, { target: { value: '1.5' } })

      const addButton = screen.getByRole('button', { name: /Agregar articulo/i })
      fireEvent.click(addButton)

      const allNetWeight = container.querySelectorAll('input[type="number"][step="0.001"]')
      fireEvent.change(allNetWeight[1], { target: { value: '0.5' } })

      // totalNetWeight = 1.5 + 0.5 = 2.000
      expect(screen.getByText('2.000 kg')).toBeDefined()
    })

    it('muestra advertencia cuando intrinsicValue > 150', () => {
      const { container } = render(<H7DirectForm />)

      const quantityInput = container.querySelector('input[type="number"][min="1"]')
      const unitValueInput = container.querySelector('input[type="number"][step="0.01"][min="0"]')

      fireEvent.change(quantityInput, { target: { value: '1' } })
      fireEvent.change(unitValueInput, { target: { value: '160' } })

      expect(screen.getByText('Excede limite H7')).toBeDefined()
    })
  })

  describe('Validaciones de submit', () => {
    it('valida que trackingNumber sea requerido', async () => {
      const { container } = render(<H7DirectForm />)
      // Rellenar todo EXCEPTO trackingNumber
      const senderNameInput = container.querySelector('input[name="senderName"]')
      fireEvent.change(senderNameInput, { target: { value: 'Sender' } })

      const recipientNameInput = container.querySelector('input[name="recipientName"]')
      fireEvent.change(recipientNameInput, { target: { value: 'Recipient' } })

      const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(recipientStreetInput, { target: { value: 'Street' } })

      const itemDescription = screen.getByPlaceholderText('Ej: Funda movil silicona')
      fireEvent.change(itemDescription, { target: { value: 'Item' } })

      const itemTaric = screen.getByPlaceholderText('392690')
      fireEvent.change(itemTaric, { target: { value: '123456' } })

      const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(itemNetWeight, { target: { value: '1' } })

      const itemQuantity = container.querySelector('input[type="number"][min="1"]')
      fireEvent.change(itemQuantity, { target: { value: '1' } })

      const itemUnitValue = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      fireEvent.change(itemUnitValue, { target: { value: '10' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Numero de tracking requerido')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })

    it('valida que senderName sea requerido', async () => {
      const { container } = render(<H7DirectForm />)
      // Rellenar todo EXCEPTO senderName
      const trackingInput = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(trackingInput, { target: { value: 'TRACK' } })

      const recipientNameInput = container.querySelector('input[name="recipientName"]')
      fireEvent.change(recipientNameInput, { target: { value: 'Recipient' } })

      const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(recipientStreetInput, { target: { value: 'Street' } })

      const itemDescription = screen.getByPlaceholderText('Ej: Funda movil silicona')
      fireEvent.change(itemDescription, { target: { value: 'Item' } })

      const itemTaric = screen.getByPlaceholderText('392690')
      fireEvent.change(itemTaric, { target: { value: '123456' } })

      const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(itemNetWeight, { target: { value: '1' } })

      const itemQuantity = container.querySelector('input[type="number"][min="1"]')
      fireEvent.change(itemQuantity, { target: { value: '1' } })

      const itemUnitValue = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      fireEvent.change(itemUnitValue, { target: { value: '10' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Nombre del remitente requerido')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })

    it('valida que recipientName sea requerido', async () => {
      const { container } = render(<H7DirectForm />)
      const trackingInput = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(trackingInput, { target: { value: 'TRACK' } })

      const senderNameInput = container.querySelector('input[name="senderName"]')
      fireEvent.change(senderNameInput, { target: { value: 'Sender' } })

      const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(recipientStreetInput, { target: { value: 'Street' } })

      const itemDescription = screen.getByPlaceholderText('Ej: Funda movil silicona')
      fireEvent.change(itemDescription, { target: { value: 'Item' } })

      const itemTaric = screen.getByPlaceholderText('392690')
      fireEvent.change(itemTaric, { target: { value: '123456' } })

      const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(itemNetWeight, { target: { value: '1' } })

      const itemQuantity = container.querySelector('input[type="number"][min="1"]')
      fireEvent.change(itemQuantity, { target: { value: '1' } })

      const itemUnitValue = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      fireEvent.change(itemUnitValue, { target: { value: '10' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Nombre del destinatario requerido')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })

    it('valida que recipientStreet sea requerido', async () => {
      const { container } = render(<H7DirectForm />)
      const trackingInput = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(trackingInput, { target: { value: 'TRACK' } })

      const senderNameInput = container.querySelector('input[name="senderName"]')
      fireEvent.change(senderNameInput, { target: { value: 'Sender' } })

      const recipientNameInput = container.querySelector('input[name="recipientName"]')
      fireEvent.change(recipientNameInput, { target: { value: 'Recipient' } })

      const itemDescription = screen.getByPlaceholderText('Ej: Funda movil silicona')
      fireEvent.change(itemDescription, { target: { value: 'Item' } })

      const itemTaric = screen.getByPlaceholderText('392690')
      fireEvent.change(itemTaric, { target: { value: '123456' } })

      const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(itemNetWeight, { target: { value: '1' } })

      const itemQuantity = container.querySelector('input[type="number"][min="1"]')
      fireEvent.change(itemQuantity, { target: { value: '1' } })

      const itemUnitValue = container.querySelector('input[type="number"][step="0.01"][min="0"]')
      fireEvent.change(itemUnitValue, { target: { value: '10' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Direccion del destinatario requerida')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })

    it('valida que todos los campos de items sean completos - sin description', async () => {
      const { container } = render(<H7DirectForm />)
      const trackingInput = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(trackingInput, { target: { value: 'TRACK' } })

      const senderNameInput = container.querySelector('input[name="senderName"]')
      fireEvent.change(senderNameInput, { target: { value: 'Sender' } })

      const recipientNameInput = container.querySelector('input[name="recipientName"]')
      fireEvent.change(recipientNameInput, { target: { value: 'Recipient' } })

      const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(recipientStreetInput, { target: { value: 'Street' } })

      // Item sin description
      const itemTaric = screen.getByPlaceholderText('392690')
      fireEvent.change(itemTaric, { target: { value: '123456' } })

      const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(itemNetWeight, { target: { value: '1' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Complete todos los campos de los articulos')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })

    it('valida que intrinsicValue no exceda 150 EUR', async () => {
      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      // Cambiar para que intrinsicValue > 150: quantity=2, unitValue=100 => 200
      const itemQuantity = container.querySelector('input[type="number"][min="1"]')
      const itemUnitValue = container.querySelector('input[type="number"][step="0.01"][min="0"]')

      fireEvent.change(itemQuantity, { target: { value: '2' } })
      fireEvent.change(itemUnitValue, { target: { value: '100' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Valor intrinseco excede 150 EUR (usar H1)')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })

    it('valida que intrinsicValue sea mayor que 0', async () => {
      const { container } = render(<H7DirectForm />)
      const trackingInput = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(trackingInput, { target: { value: 'TRACK' } })

      const senderNameInput = container.querySelector('input[name="senderName"]')
      fireEvent.change(senderNameInput, { target: { value: 'Sender' } })

      const recipientNameInput = container.querySelector('input[name="recipientName"]')
      fireEvent.change(recipientNameInput, { target: { value: 'Recipient' } })

      const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(recipientStreetInput, { target: { value: 'Street' } })

      const itemDescription = screen.getByPlaceholderText('Ej: Funda movil silicona')
      fireEvent.change(itemDescription, { target: { value: 'Item' } })

      const itemTaric = screen.getByPlaceholderText('392690')
      fireEvent.change(itemTaric, { target: { value: '123456' } })

      const itemNetWeight = container.querySelector('input[type="number"][step="0.001"]')
      fireEvent.change(itemNetWeight, { target: { value: '1' } })

      // NO llenar quantity ni unitValue => totalValue queda vacío => intrinsicValue = 0

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('El valor debe ser mayor que 0')
      })
      expect(h7API.create).not.toHaveBeenCalled()
    })
  })

  describe('Submit exitoso', () => {
    it('llama a h7API.create con payload correcto y navega al detalle', async () => {
      h7API.create.mockResolvedValue({
        data: {
          success: true,
          data: { _id: 'h7-123' }
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(h7API.create).toHaveBeenCalledTimes(1)
      })

      const payload = h7API.create.mock.calls[0][0]
      expect(payload.trackingNumber).toBe('TRACK123')
      expect(payload.sender.name).toBe('Sender Company')
      expect(payload.recipient.name).toBe('Recipient Name')
      expect(payload.recipient.address.street).toBe('Main St 123')
      expect(payload.items.length).toBe(1)
      expect(payload.items[0].description).toBe('Product description')
      expect(payload.items[0].taricCode).toBe('392690')

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('H7 creada correctamente')
      })

      expect(mockNavigate).toHaveBeenCalledWith('/h7/h7-123')
    })

    it('incluye carrier.name del CARRIERS si carrierName está vacío', async () => {
      h7API.create.mockResolvedValue({
        data: {
          success: true,
          data: { _id: 'h7-456' }
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(h7API.create).toHaveBeenCalledTimes(1)
      })

      const payload = h7API.create.mock.calls[0][0]
      expect(payload.carrier.code).toBe('DHL')
      expect(payload.carrier.name).toBe('DHL')
    })

    it('incluye iossNumber y vatPrepaid:true cuando iossNumber está presente', async () => {
      h7API.create.mockResolvedValue({
        data: {
          success: true,
          data: { _id: 'h7-ioss' }
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const iossInput = container.querySelector('input[name="iossNumber"]')
      fireEvent.change(iossInput, { target: { value: 'IM1111111111' } })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(h7API.create).toHaveBeenCalledTimes(1)
      })

      const payload = h7API.create.mock.calls[0][0]
      expect(payload.iossNumber).toBe('IM1111111111')
      expect(payload.vatPrepaid).toBe(true)
    })

    it('incluye totals.grossWeight auto-calculado si no se especifica', async () => {
      h7API.create.mockResolvedValue({
        data: {
          success: true,
          data: { _id: 'h7-weight' }
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      // netWeight=0.5, grossWeight vacío => auto: 0.5 * 1.1 = 0.55
      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(h7API.create).toHaveBeenCalledTimes(1)
      })

      const payload = h7API.create.mock.calls[0][0]
      expect(payload.totals.grossWeight).toBe(0.55)
    })
  })

  describe('Submit con errores', () => {
    it('muestra error cuando success:false en respuesta', async () => {
      h7API.create.mockResolvedValue({
        data: {
          success: false,
          message: 'Error de validacion'
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error de validacion')
      })

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('muestra múltiples errores cuando success:false y hay data.errors', async () => {
      h7API.create.mockResolvedValue({
        data: {
          success: false,
          message: 'Error de validacion',
          errors: [
            { message: 'Error en campo 1' },
            { message: 'Error en campo 2' }
          ]
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error de validacion')
        expect(toast.error).toHaveBeenCalledWith('Error en campo 1')
        expect(toast.error).toHaveBeenCalledWith('Error en campo 2')
      })
    })

    it('muestra error cuando el servidor lanza excepción', async () => {
      h7API.create.mockRejectedValue({
        response: {
          data: {
            message: 'Error de servidor'
          }
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error de servidor')
      })
    })

    it('muestra error por defecto cuando la excepción no tiene response.data.message', async () => {
      h7API.create.mockRejectedValue(new Error('Network error'))

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al crear H7')
      })
    })

    it('muestra errores con JSON.stringify cuando error sin message en el array', async () => {
      h7API.create.mockRejectedValue({
        response: {
          data: {
            message: 'Error de servidor',
            errors: [
              { field: 'email', code: 'invalid' }
            ]
          }
        }
      })

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error de servidor')
        expect(toast.error).toHaveBeenCalledWith('{"field":"email","code":"invalid"}')
      })
    })
  })

  describe('Botón Cancelar', () => {
    it('navega a /h7 cuando se hace clic en Cancelar', () => {
      render(<H7DirectForm />)

      const cancelButton = screen.getByRole('button', { name: /Cancelar/i })
      fireEvent.click(cancelButton)

      expect(mockNavigate).toHaveBeenCalledWith('/h7')
    })
  })

  describe('Estado de submitting', () => {
    it('deshabilita el botón de submit mientras se envía', async () => {
      h7API.create.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        data: {
          success: true,
          data: { _id: 'h7-slow' }
        }
      }), 100)))

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const submitButton = screen.getByRole('button', { name: /Crear declaracion H7/i })

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(submitButton.disabled).toBe(true)
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('H7 creada correctamente')
      }, { timeout: 3000 })
    })

    it('muestra texto "Creando..." mientras se envía', async () => {
      h7API.create.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        data: {
          success: true,
          data: { _id: 'h7-slow2' }
        }
      }), 100)))

      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const form = container.querySelector('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Creando...')).toBeDefined()
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('H7 creada correctamente')
      }, { timeout: 3000 })
    })
  })

  describe('Botón submit deshabilitado por valores inválidos', () => {
    it('deshabilita el botón cuando intrinsicValue > 150', () => {
      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const quantityInput = container.querySelector('input[type="number"][min="1"]')
      const unitValueInput = container.querySelector('input[type="number"][step="0.01"][min="0"]')

      fireEvent.change(quantityInput, { target: { value: '1' } })
      fireEvent.change(unitValueInput, { target: { value: '160' } })

      const submitButton = screen.getByRole('button', { name: /Crear declaracion H7/i })
      expect(submitButton.disabled).toBe(true)
    })

    it('deshabilita el botón cuando intrinsicValue <= 0', () => {
      const { container } = render(<H7DirectForm />)
      const trackingInput = container.querySelector('input[name="trackingNumber"]')
      fireEvent.change(trackingInput, { target: { value: 'TRACK' } })

      const senderNameInput = container.querySelector('input[name="senderName"]')
      fireEvent.change(senderNameInput, { target: { value: 'Sender' } })

      const recipientNameInput = container.querySelector('input[name="recipientName"]')
      fireEvent.change(recipientNameInput, { target: { value: 'Recipient' } })

      const recipientStreetInput = container.querySelector('input[name="recipientStreet"]')
      fireEvent.change(recipientStreetInput, { target: { value: 'Street' } })

      // intrinsicValue = 0 (no items con valor)
      const submitButton = screen.getByRole('button', { name: /Crear declaracion H7/i })
      expect(submitButton.disabled).toBe(true)
    })

    it('habilita el botón cuando 0 < intrinsicValue <= 150', () => {
      const { container } = render(<H7DirectForm />)
      fillMinimalValidForm(container)

      const submitButton = screen.getByRole('button', { name: /Crear declaracion H7/i })
      expect(submitButton.disabled).toBe(false)
    })
  })
})
