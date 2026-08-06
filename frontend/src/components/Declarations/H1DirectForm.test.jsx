import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import H1DirectForm from './H1DirectForm'
import { declarationsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  declarationsAPI: { generateH1: vi.fn() }
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('<H1DirectForm />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderForm = () => render(
    <MemoryRouter>
      <H1DirectForm />
    </MemoryRouter>
  )

  test('renderiza el formulario con valores por defecto', () => {
    renderForm()
    expect(screen.getByText(/Nueva Declaracion H1 - DUA Importacion/i)).toBeInTheDocument()

    // Verificar algunos valores iniciales
    const typeSelect = screen.getByDisplayValue('IM - Importacion')
    expect(typeSelect).toBeInTheDocument()

    const currencyInput = screen.getAllByDisplayValue('EUR')[0]
    expect(currencyInput).toBeInTheDocument()
  })

  test('cambia el valor de un campo del form', () => {
    renderForm()
    const referenceInput = screen.getByPlaceholderText('Ref. interna')
    fireEvent.change(referenceInput, { target: { value: 'REF123' } })
    expect(referenceInput.value).toBe('REF123')
  })

  test('agrega una partida adicional', () => {
    renderForm()
    // Inicialmente hay 1 partida
    expect(screen.getByText(/Partida 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Partida 2/)).not.toBeInTheDocument()

    const addButton = screen.getByText(/Agregar partida/)
    fireEvent.click(addButton)

    expect(screen.getByText(/Partida 1/)).toBeInTheDocument()
    expect(screen.getByText(/Partida 2/)).toBeInTheDocument()
  })

  test('elimina una partida cuando hay mas de una', () => {
    renderForm()

    // Agregar segunda partida
    const addButton = screen.getByText(/Agregar partida/)
    fireEvent.click(addButton)
    expect(screen.getByText(/Partida 2/)).toBeInTheDocument()

    // Eliminar primera partida (buscar botones con icono de basura en partidas)
    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('text-red') && btn.closest('.border.border-gray-200.rounded-lg.p-4')
    )
    if (deleteButtons[0]) fireEvent.click(deleteButtons[0])

    // Ahora solo hay una partida y debe ser la original "Partida 1" (re-indexed)
    expect(screen.getByText(/Partida 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Partida 2/)).not.toBeInTheDocument()
  })

  test('no elimina la ultima partida', () => {
    renderForm()
    // Inicialmente hay 1 partida y no debe haber boton de eliminar
    const deleteButtons = screen.queryAllByRole('button').filter(btn =>
      btn.querySelector('svg') && btn.className.includes('text-red')
    )
    // Con una sola partida, el boton de eliminar no se renderiza (items.length > 1)
    expect(deleteButtons.length).toBe(0)
  })

  test('agrega un documento a una partida', () => {
    renderForm()
    const addDocButton = screen.getByText(/Agregar documento/)
    fireEvent.click(addDocButton)

    // Debe haber 2 conjuntos de inputs para documentos
    const codeInputs = screen.getAllByPlaceholderText(/N380, C514, N740.../)
    expect(codeInputs.length).toBe(2)
  })

  test('elimina un documento cuando hay mas de uno', () => {
    renderForm()

    // Agregar segundo documento
    const addDocButton = screen.getByText(/Agregar documento/)
    fireEvent.click(addDocButton)
    let codeInputs = screen.getAllByPlaceholderText(/N380, C514, N740.../)
    expect(codeInputs.length).toBe(2)

    // Eliminar uno
    const deleteButtons = screen.getAllByRole('button')
    const docTrashButton = deleteButtons.find(btn =>
      btn.className.includes('text-red-400') && btn.closest('.grid.grid-cols-12')
    )
    if (docTrashButton) fireEvent.click(docTrashButton)

    codeInputs = screen.getAllByPlaceholderText(/N380, C514, N740.../)
    expect(codeInputs.length).toBe(1)
  })

  test('agrega una linea de tributo', () => {
    renderForm()
    const addTaxButton = screen.getByText(/Agregar linea/)
    fireEvent.click(addTaxButton)

    // Debe haber 2 selects de clase de tributo
    const taxSelects = screen.getAllByDisplayValue(/A00 - Arancel/)
    expect(taxSelects.length).toBe(2)
  })

  test('elimina una linea de tributo cuando hay mas de una', () => {
    renderForm()

    // Agregar segunda linea
    const addTaxButton = screen.getByText(/Agregar linea/)
    fireEvent.click(addTaxButton)
    let taxSelects = screen.getAllByDisplayValue(/A00 - Arancel/)
    expect(taxSelects.length).toBe(2)

    // Eliminar una (buscar boton trash en la fila de taxes)
    const deleteButtons = screen.getAllByRole('button')
    const taxTrashButton = deleteButtons.find(btn =>
      btn.className.includes('text-red-400') && btn.parentElement?.className?.includes('col-span-1')
    )
    if (taxTrashButton) fireEvent.click(taxTrashButton)

    taxSelects = screen.getAllByDisplayValue(/A00 - Arancel/)
    expect(taxSelects.length).toBe(1)
  })

  test('calcula automaticamente el amount del tributo cuando cambia base o rate', () => {
    renderForm()

    // Buscar inputs de base y rate (primera linea de tributo)
    const baseInput = screen.getByPlaceholderText('0.00')
    const rateInput = screen.getByPlaceholderText('21')

    fireEvent.change(baseInput, { target: { value: '1000' } })
    fireEvent.change(rateInput, { target: { value: '21' } })

    // El amount deberia ser 1000 * 21 / 100 = 210.00
    // Buscar el input readonly de amount
    const amountInputs = document.querySelectorAll('input[readonly][type="number"]')
    const taxAmountInput = Array.from(amountInputs).find(inp => inp.closest('.grid.grid-cols-12'))

    expect(taxAmountInput?.value).toBe('210.00')
  })

  test('calcula totales automaticamente', () => {
    renderForm()

    // Agregar segunda partida
    const addButton = screen.getByText(/Agregar partida/)
    fireEvent.click(addButton)

    // Rellenar datos de partidas - buscar inputs dentro de cada partida
    const partidas = document.querySelectorAll('.border.border-gray-200.rounded-lg.p-4.mb-4.bg-gray-50')
    const packageInput1 = partidas[0]?.querySelector('input[type="number"][min="0"]')
    const packageInput2 = partidas[1]?.querySelector('input[type="number"][min="0"]')

    if (packageInput1) fireEvent.change(packageInput1, { target: { value: '10' } })
    if (packageInput2) fireEvent.change(packageInput2, { target: { value: '5' } })

    // Total bultos deberia ser 15 (buscar en el resumen)
    const resumenSection = document.querySelector('.bg-blue-50.rounded-xl')
    const displayValues = resumenSection?.querySelectorAll('p.font-bold.text-lg.text-gray-900')
    const totalBultosDisplay = displayValues?.[1] // Segunda posicion: Total bultos
    expect(totalBultosDisplay?.textContent).toBe('15')
  })

  test('valida destinatario requerido en submit', async () => {
    renderForm()

    // Dejar recipientName vacio y disparar handleSubmit
    const form = document.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Destinatario (casilla 8) requerido')
    })
    expect(declarationsAPI.generateH1).not.toHaveBeenCalled()
  })

  test('valida EORI declarante requerido en submit', async () => {
    renderForm()

    // Rellenar destinatario pero no declarantEori
    const form = document.querySelector('form')
    const recInput = form?.querySelector('input[name="recipientName"]')
    if (recInput) fireEvent.change(recInput, { target: { value: 'Test Company' } })

    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('EORI declarante (casilla 14) requerido')
    })
    expect(declarationsAPI.generateH1).not.toHaveBeenCalled()
  })

  test('valida descripcion y TARIC de partidas en submit', async () => {
    renderForm()

    // Rellenar campos requeridos basicos
    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Test Company' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    // Dejar items sin descripcion/TARIC
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Complete descripcion y TARIC de todas las partidas')
    })
    expect(declarationsAPI.generateH1).not.toHaveBeenCalled()
  })

  test('envia el formulario correctamente y navega a /expeditions/:id en exito', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: {
        success: true,
        data: { _id: 'h1-123' }
      }
    })

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Acme Corp' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    // Rellenar descripcion y TARIC de la primera partida
    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Test goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'H1',
          country: 'ES',
          customsSystem: 'AEAT',
          recipient: expect.objectContaining({ name: 'Acme Corp' }),
          declarant: expect.objectContaining({ eori: 'ESB22477020' })
        })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Declaracion H1 creada correctamente')
    expect(mockNavigate).toHaveBeenCalledWith('/expeditions/h1-123')
  })

  test('navega a /declarations cuando response.data.data no tiene id', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: {
        success: true,
        data: {}
      }
    })

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Acme Corp' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Test goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalled()
    })

    expect(toast.success).toHaveBeenCalledWith('Declaracion H1 creada correctamente')
    expect(mockNavigate).toHaveBeenCalledWith('/declarations')
  })

  test('maneja respuesta de API con success: false', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: {
        success: false,
        message: 'Validation failed',
        errors: [{ message: 'Invalid TARIC code' }]
      }
    })

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Acme Corp' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Test goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Validation failed')
    })

    expect(toast.error).toHaveBeenCalledWith('Invalid TARIC code')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('maneja error de red en submit', async () => {
    declarationsAPI.generateH1.mockRejectedValue(new Error('Network error'))

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Acme Corp' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Test goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al crear declaracion H1')
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('maneja error de API con response.data.message y errors', async () => {
    declarationsAPI.generateH1.mockRejectedValue({
      response: {
        data: {
          message: 'Server error',
          errors: [{ message: 'Field A is invalid' }, 'Field B missing']
        }
      }
    })

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Acme Corp' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Test goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error')
    })

    expect(toast.error).toHaveBeenCalledWith('Field A is invalid')
    expect(toast.error).toHaveBeenCalledWith('"Field B missing"')
  })

  test('deshabilita el boton submit mientras esta submitting', async () => {
    declarationsAPI.generateH1.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Acme Corp' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB22477020' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Test goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    // Inmediatamente despues del clic, el boton debe estar deshabilitado
    expect(submitButton).toBeDisabled()

    // Esperar a que termine
    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalled()
    })
  })

  test('calcula correctamente computeStatValue con exchangeRate', () => {
    renderForm()

    // Cambiar exchangeRate
    const form = document.querySelector('form')
    const exchangeRateInput = form?.querySelector('input[name="exchangeRate"]')
    if (exchangeRateInput) fireEvent.change(exchangeRateInput, { target: { value: '2' } })

    // Cambiar itemPrice de la primera partida (buscar dentro de la partida)
    const partida = document.querySelector('.border.border-gray-200.rounded-lg.p-4.mb-4.bg-gray-50')
    const itemPriceInputs = partida?.querySelectorAll('input[type="number"][step="0.01"]')
    const itemPriceInput = itemPriceInputs?.[0] // Primer input step=0.01 en la partida

    if (itemPriceInput) fireEvent.change(itemPriceInput, { target: { value: '1000' } })

    // El valor estadistico deberia ser 1000 / 2 = 500.00
    // Es el ultimo input de step=0.01 readonly en la partida
    const statValueInput = partida?.querySelector('input[readonly][type="number"][step="0.01"]')

    expect(statValueInput?.value).toBe('500.00')
  })

  test('calcula totalGrossWeight y totalNetWeight correctamente', () => {
    renderForm()

    // Agregar segunda partida
    const addButton = screen.getByText(/Agregar partida/)
    fireEvent.click(addButton)

    // Rellenar grossWeight y netWeight de ambas partidas
    const partidas = document.querySelectorAll('.border.border-gray-200.rounded-lg.p-4.mb-4.bg-gray-50')

    // Primera partida
    const grossInput1 = partidas[0]?.querySelector('input[step="0.001"]')
    const netInput1 = Array.from(partidas[0]?.querySelectorAll('input[step="0.001"]') || [])[1]

    if (grossInput1) fireEvent.change(grossInput1, { target: { value: '100.5' } })
    if (netInput1) fireEvent.change(netInput1, { target: { value: '90' } })

    // Segunda partida
    const grossInput2 = partidas[1]?.querySelector('input[step="0.001"]')
    const netInput2 = Array.from(partidas[1]?.querySelectorAll('input[step="0.001"]') || [])[1]

    if (grossInput2) fireEvent.change(grossInput2, { target: { value: '200.3' } })
    if (netInput2) fireEvent.change(netInput2, { target: { value: '180' } })

    // Verificar totales en el resumen
    const resumenSection = document.querySelector('.bg-blue-50.rounded-xl')
    const allDisplayValues = resumenSection?.querySelectorAll('p.font-bold.text-lg.text-gray-900')
    const grossWeightDisplay = allDisplayValues?.[2] // Tercera posicion: masa bruta
    const netWeightDisplay = allDisplayValues?.[3]   // Cuarta posicion: masa neta

    expect(grossWeightDisplay?.textContent).toMatch(/300\.800.*kg/)
    expect(netWeightDisplay?.textContent).toMatch(/270\.000.*kg/)
  })

  test('calcula totalTaxAmount correctamente', () => {
    renderForm()

    // Rellenar el primer tax que ya existe
    let baseInput1 = screen.getByPlaceholderText('0.00')
    let rateInput1 = screen.getByPlaceholderText('21')

    fireEvent.change(baseInput1, { target: { value: '1000' } })
    fireEvent.change(rateInput1, { target: { value: '10' } })

    // El total inicial deberia ser 100.00
    let totalTaxDisplay = screen.getByText(/Total tributos:/).parentElement
    expect(totalTaxDisplay?.textContent).toMatch(/100\.00.*EUR/)

    // Agregar segunda linea de tributo
    const addTaxButton = screen.getByText(/Agregar linea/)
    fireEvent.click(addTaxButton)

    // Ahora hay dos conjuntos de inputs base/rate
    const allBaseInputs = screen.getAllByPlaceholderText('0.00')
    const allRateInputs = screen.getAllByPlaceholderText('21')

    // El segundo conjunto son los nuevos
    fireEvent.change(allBaseInputs[1], { target: { value: '1000' } })
    fireEvent.change(allRateInputs[1], { target: { value: '21' } })

    // Total tributos deberia ser 100 + 210 = 310.00
    totalTaxDisplay = screen.getByText(/Total tributos:/).parentElement
    expect(totalTaxDisplay?.textContent).toMatch(/310\.00.*EUR/)
  })

  test('boton Cancelar navega a /declarations', () => {
    renderForm()

    const cancelButton = screen.getByText('Cancelar')
    fireEvent.click(cancelButton)

    expect(mockNavigate).toHaveBeenCalledWith('/declarations')
  })

  test('payload de submit incluye todos los campos correctamente', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: { success: true, data: { _id: 'h1-456' } }
    })

    renderForm()

    const form = document.querySelector('form')

    // Rellenar campos de form
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')
    const totalInvoiceAmountInput = form?.querySelector('input[name="totalInvoiceAmount"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Test Co' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB12345678' } })
    if (totalInvoiceAmountInput) fireEvent.change(totalInvoiceAmountInput, { target: { value: '5000' } })

    // Rellenar item
    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Electronics' } })
    fireEvent.change(taricInput, { target: { value: '84713000' } })

    // Rellenar tax
    const baseInput = screen.getByPlaceholderText('0.00')
    const rateInput = screen.getByPlaceholderText('21')

    fireEvent.change(baseInput, { target: { value: '5000' } })
    fireEvent.change(rateInput, { target: { value: '21' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'H1',
          country: 'ES',
          customsSystem: 'AEAT',
          declarationType: 'IM',
          declarationAdditional: 'A',
          recipient: expect.objectContaining({ name: 'Test Co' }),
          declarant: expect.objectContaining({ eori: 'ESB12345678' }),
          totalInvoiceAmount: 5000,
          exchangeRate: 1,
          items: expect.arrayContaining([
            expect.objectContaining({
              description: 'Electronics',
              taricCode: '84713000',
              sequenceNumber: 1
            })
          ]),
          taxes: expect.arrayContaining([
            expect.objectContaining({
              base: 5000,
              rate: 21,
              amount: 1050
            })
          ])
        })
      )
    })
  })

  test('filtra documentos sin code al generar payload', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: { success: true, data: { _id: 'h1-789' } }
    })

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Test Co' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB12345678' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    // El documento inicial tiene code vacio, no deberia incluirse
    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              documents: []
            })
          ])
        })
      )
    })
  })

  test('filtra taxes sin base al generar payload', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: { success: true, data: { _id: 'h1-999' } }
    })

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Test Co' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB12345678' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    // El tax inicial tiene base vacia, no deberia incluirse
    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalledWith(
        expect.objectContaining({
          taxes: []
        })
      )
    })
  })

  test('cambia campo de item correctamente', () => {
    renderForm()

    const marksInput = screen.getByPlaceholderText('N/M')
    fireEvent.change(marksInput, { target: { value: 'MARK123' } })

    expect(marksInput.value).toBe('MARK123')
  })

  test('cambia campo de documento correctamente', () => {
    renderForm()

    const docCodeInput = screen.getByPlaceholderText(/N380, C514, N740.../)
    fireEvent.change(docCodeInput, { target: { value: 'N380' } })

    expect(docCodeInput.value).toBe('N380')
  })

  test('muestra texto de loading en boton submit mientras submitting', async () => {
    declarationsAPI.generateH1.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
      data: { success: true, data: { _id: 'h1-test' } }
    }), 50)))

    renderForm()

    const form = document.querySelector('form')
    const recipientNameInput = form?.querySelector('input[name="recipientName"]')
    const declarantEoriInput = form?.querySelector('input[name="declarantEori"]')

    if (recipientNameInput) fireEvent.change(recipientNameInput, { target: { value: 'Test' } })
    if (declarantEoriInput) fireEvent.change(declarantEoriInput, { target: { value: 'ESB12345678' } })

    const descInput = screen.getByPlaceholderText('Mercancias...')
    const taricInput = screen.getByPlaceholderText('84713000')

    fireEvent.change(descInput, { target: { value: 'Goods' } })
    fireEvent.change(taricInput, { target: { value: '12345678' } })

    const submitButton = screen.getByText(/Crear declaracion H1/)
    fireEvent.click(submitButton)

    // Debe mostrar "Creando..."
    expect(await screen.findByText(/Creando.../)).toBeInTheDocument()

    await waitFor(() => {
      expect(declarationsAPI.generateH1).toHaveBeenCalled()
    })
  })
})
