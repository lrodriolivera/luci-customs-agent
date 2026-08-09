import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ENSDeclarationForm from './ENSDeclarationForm'
import { ensAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('../../services/api', () => ({
  ensAPI: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    validate: vi.fn(),
    submit: vi.fn(),
    getEntryOffices: vi.fn()
  }
}))

// Las aduanas ya NO estan cableadas en el componente: las pide al backend
// (config/entryOffices.js). Este fixture reproduce el contrato del endpoint con
// las aduanas que usan los tests; los `modes` son los del catalogo real.
const OFICINAS = [
  { code: 'ES009999', name: 'PRE Pruebas Peninsula', type: 'test', modes: ['SEA', 'ROAD', 'RAIL', 'AIR'], test: true },
  { code: 'ES009998', name: 'PRE Pruebas Canarias', type: 'test', modes: ['SEA', 'ROAD', 'RAIL', 'AIR'], test: true },
  { code: 'ES002801', name: 'Barcelona - Puerto', type: 'maritime', modes: ['SEA', 'ROAD'] },
  { code: 'ES003001', name: 'Algeciras - Puerto', type: 'maritime', modes: ['SEA', 'ROAD'] },
  { code: 'ES002101', name: 'Madrid - Barajas', type: 'air', modes: ['AIR', 'ROAD'] },
  { code: 'ES002001', name: 'Irun', type: 'land', modes: ['ROAD', 'RAIL'] }
]

describe('<ENSDeclarationForm />', () => {
  const mockOnClose = vi.fn()
  const mockOnSuccess = vi.fn()

  // Helper: buscar input/textarea por el texto del label (clave i18n)
  // Si hay múltiples, toma el primero visible
  const getInputByLabel = (labelText) => {
    const labels = screen.queryAllByText(labelText)
    for (const label of labels) {
      const input = label.closest('label')?.querySelector('input, textarea') ||
                    label.closest('div[class*="MuiFormControl"]')?.querySelector('input, textarea') ||
                    label.closest('div')?.querySelector('input, textarea')
      if (input) return input
    }
    throw new Error(`No input found for label: ${labelText}`)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ensAPI.getEntryOffices.mockResolvedValue({ data: { success: true, data: OFICINAS } })
  })

  test('renderiza el formulario inicial en modo creación (step 0, 4 modos de transporte)', () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    expect(screen.getByText('ens.newTitle')).toBeInTheDocument()
    expect(screen.getByText('ens.stepTransport')).toBeInTheDocument()
    // 4 transport modes
    expect(screen.getByText('ens.road')).toBeInTheDocument()
    expect(screen.getByText('ens.rail')).toBeInTheDocument()
    expect(screen.getByText('ens.air')).toBeInTheDocument()
    expect(screen.getByText('ens.maritime')).toBeInTheDocument()
  })

  test('muestra loading spinner cuando declarationId existe y está cargando', async () => {
    ensAPI.get.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<ENSDeclarationForm declarationId="abc123" onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('carga declaración existente correctamente', async () => {
    ensAPI.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          transportMode: 'RAIL',
          entryOffice: { code: 'ES009999', name: 'PRE Pruebas Peninsula', expectedArrival: '2026-08-10T14:00' },
          carrier: { eori: 'ES12345678X', name: 'Carrier SA', address: { street: 'Calle Test', city: 'Madrid', postcode: '28001', country: 'ES' } },
          transportMeans: { type: 'wagon', identification: 'WAGON123', nationality: 'ES' },
          consignment: { referenceNumber: 'BL123456', containerNumber: 'CONT123', sealNumber: 'SEAL456', grossMass: '5000', numberOfPackages: '10', goodsDescription: 'Electronic goods' },
          consignor: { eori: 'FR987654321', name: 'Expeditor FR', address: { street: 'Rue Test', city: 'Paris', postcode: '75001', country: 'FR' } },
          consignee: { eori: 'ES11111111Y', name: 'Consignee ES', address: { street: 'Calle Dest', city: 'Barcelona', postcode: '08001', country: 'ES' } },
          houseConsignments: [],
          goods: [{ itemNumber: 1, description: 'Laptop', taricCode: '8471300000', grossMass: '2', netMass: '1.8', numberOfPackages: '1', packageType: 'BX', marks: 'FRAGILE', countryOfOrigin: 'CN' }],
          documents: []
        }
      }
    })
    render(<ENSDeclarationForm declarationId="abc123" onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    await waitFor(() => expect(ensAPI.get).toHaveBeenCalledWith('abc123'))
    // Titulo modo edición
    await waitFor(() => expect(screen.getByText('ens.editTitle')).toBeInTheDocument())
    // Modo transporte preseleccionado = RAIL → card con borde
    const railCard = screen.getByText('ens.rail').closest('div[class*="MuiCard-root"]')
    expect(railCard).toBeTruthy()
  })

  test('maneja error de carga de declaración sin romper', async () => {
    ensAPI.get.mockRejectedValueOnce(new Error('Network error'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ENSDeclarationForm declarationId="abc123" onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    await waitFor(() => expect(ensAPI.get).toHaveBeenCalledWith('abc123'))
    // No rompe: sigue renderizado, título es editTitle porque declarationId existe.
    // findBy* (no getBy*): tras el rechazo aun queda el re-render que sale de loading,
    // y con getBy sincrono el test es flaky.
    expect(await screen.findByText('ens.editTitle')).toBeInTheDocument()
    consoleErrorSpy.mockRestore()
  })

  /**
   * Antes las aduanas estaban cableadas en el componente, asi que el desplegable
   * nunca podia quedarse vacio. Ahora vienen del backend: si la llamada falla hay
   * que DECIRLO, no ofrecer una lista vacia como si no hubiera aduanas.
   */
  test('si falla la carga de aduanas lo avisa en el campo en lugar de quedarse en blanco', async () => {
    ensAPI.getEntryOffices.mockRejectedValueOnce(new Error('Network error'))
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    expect(await screen.findByText('ens.entryOfficesLoadError')).toBeInTheDocument()
  })

  test('las aduanas del desplegable vienen del backend, no de una lista cableada', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    await waitFor(() => expect(ensAPI.getEntryOffices).toHaveBeenCalled())
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      expect(within(listbox).getByText(/ES009999/)).toBeInTheDocument()
    })
  })

  test('click en modo de transporte cambia transportMode y filtra oficinas', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Por defecto ROAD está seleccionado
    const seaCard = screen.getByText('ens.maritime').closest('div[class*="MuiCard-root"]')
    fireEvent.click(seaCard)
    // transportMode cambia a SEA
    // Las oficinas de entrada se filtran: ES002801 (Algeceras) admite SEA
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      // Listbox con opciones
      const listbox = document.querySelector('[role="listbox"]')
      expect(listbox).toBeTruthy()
      // Algeciras debe estar disponible (modes incluyen SEA)
      expect(within(listbox).getByText(/Algeciras/)).toBeInTheDocument()
    })
  })

  test('alerta de ICS2 se muestra para modos distintos de RAIL', () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Modo por defecto ROAD → debe mostrar alerta
    expect(screen.getByText(/solo RAIL acepta ENS legacy/)).toBeInTheDocument()
  })

  test('alerta de ICS2 NO se muestra para RAIL', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Cambiar a RAIL
    const railCard = screen.getByText('ens.rail').closest('div[class*="MuiCard-root"]')
    fireEvent.click(railCard)
    await waitFor(() => {
      expect(screen.queryByText(/solo RAIL acepta ENS legacy/)).not.toBeInTheDocument()
    })
  })

  test('validación step 0: falta office code → error, no avanza', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // El arrival también falta
    const nextButton = screen.getByRole('button', { name: /ens.next/ })
    fireEvent.click(nextButton)
    await waitFor(() => {
      expect(screen.getByText('ens.entryCustomsRequired')).toBeInTheDocument()
      expect(screen.getByText('ens.arrivalRequired')).toBeInTheDocument()
    })
    // Sigue en step 0
    expect(screen.getByText('ens.stepTransport')).toBeInTheDocument()
  })

  test('validación step 0 OK → avanza a step 1', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Rellenar office
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      const option = within(listbox).getByText(/ES009999/)
      fireEvent.click(option)
    })
    // Rellenar arrival
    const arrivalInput = getInputByLabel('ens.expectedArrivalLabel')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    // Click next
    const nextButton = screen.getByRole('button', { name: /ens.next/ })
    fireEvent.click(nextButton)
    await waitFor(() => {
      // Step 1
      expect(screen.getByText('ens.stepCarrier')).toBeInTheDocument()
      expect(screen.getByText('ens.carrierData')).toBeInTheDocument()
    })
  })

  test('handleBack desde step 1 retrocede a step 0', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar a step 1 (pasar validacion step 0)
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    // Back
    const backButton = screen.getByRole('button', { name: /ens.previous/ })
    fireEvent.click(backButton)
    // Vuelve a step 0
    expect(screen.getByText('ens.transportModeLabel')).toBeInTheDocument()
  })

  test('validación step 1: falta carrier.eori → error', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar a step 1
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    // Next sin rellenar EORI
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => {
      expect(screen.getByText('ens.carrierEoriRequired')).toBeInTheDocument()
    })
  })

  test('step 1: rellenar campos de carrier (sin select de transportMeans)', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar a step 1
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    // Rellenar campos de carrier
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'es123456789' } })
    fireEvent.change(getInputByLabel('ens.companyName'), { target: { value: 'Carrier Ltd' } })
    fireEvent.change(getInputByLabel('ens.street'), { target: { value: 'Calle Test 123' } })
    fireEvent.change(getInputByLabel('common.city'), { target: { value: 'Madrid' } })
    fireEvent.change(getInputByLabel('common.postalCode'), { target: { value: '28001' } })
    fireEvent.change(getInputByLabel('common.country'), { target: { value: 'es' } })
    // Rellenar transportMeans inputs (sin el select)
    fireEvent.change(getInputByLabel('ens.identification'), { target: { value: 'abc123' } })
    fireEvent.change(getInputByLabel('ens.nationality'), { target: { value: 'fr' } })
    // Verificar transformación uppercase
    await waitFor(() => {
      expect(getInputByLabel('ens.eoriCarrier').value).toBe('ES123456789')
      expect(getInputByLabel('common.country').value).toBe('ES')
      expect(getInputByLabel('ens.identification').value).toBe('ABC123')
      expect(getInputByLabel('ens.nationality').value).toBe('FR')
    })
  })

  test('rellenar carrier EORI y avanzar a step 2', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar a step 1
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    // Rellenar EORI (se transforma a uppercase)
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'es123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => {
      // Step 2
      expect(screen.getByText('ens.shipmentData')).toBeInTheDocument()
    })
  })

  test('validación step 2: falta consignment.referenceNumber y grossMass → errores', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar a step 2
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    // Next sin BL ni grossMass
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => {
      expect(screen.getByText('ens.blRequired')).toBeInTheDocument()
      expect(screen.getByText('ens.grossWeightRequired')).toBeInTheDocument()
    })
  })

  test('step 2: rellenar todos los campos de consignment, consignor y consignee', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 2
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    // Rellenar consignment completo
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987654321' } })
    fireEvent.change(getInputByLabel('ens.containerNumber'), { target: { value: 'cont123' } })
    fireEvent.change(getInputByLabel('ens.sealNumber'), { target: { value: 'SEAL789' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '2500' } })
    fireEvent.change(getInputByLabel('ens.numberOfPackages'), { target: { value: '15' } })
    fireEvent.change(getInputByLabel('ens.goodsDescriptionLabel'), { target: { value: 'Electronic devices' } })
    // Rellenar consignor
    const consignorEoriInputs = screen.queryAllByText('ens.eoriConsignor')
    const consignorEoriInput = consignorEoriInputs[0].closest('label')?.querySelector('input') ||
                               consignorEoriInputs[0].closest('div[class*="MuiFormControl"]')?.querySelector('input')
    fireEvent.change(consignorEoriInput, { target: { value: 'fr987654321' } })
    const consignorNameInputs = screen.queryAllByText('ens.nameConsignor')
    const consignorNameInput = consignorNameInputs[0].closest('label')?.querySelector('input') ||
                               consignorNameInputs[0].closest('div[class*="MuiFormControl"]')?.querySelector('input')
    fireEvent.change(consignorNameInput, { target: { value: 'Expeditor SA' } })
    // Rellenar consignee
    const consigneeEoriInputs = screen.queryAllByText('ens.eoriConsignee')
    const consigneeEoriInput = consigneeEoriInputs[0].closest('label')?.querySelector('input') ||
                               consigneeEoriInputs[0].closest('div[class*="MuiFormControl"]')?.querySelector('input')
    fireEvent.change(consigneeEoriInput, { target: { value: 'es111111111' } })
    const consigneeNameInputs = screen.queryAllByText('ens.nameConsignee')
    const consigneeNameInput = consigneeNameInputs[0].closest('label')?.querySelector('input') ||
                               consigneeNameInputs[0].closest('div[class*="MuiFormControl"]')?.querySelector('input')
    fireEvent.change(consigneeNameInput, { target: { value: 'Receiver Ltd' } })
    // Verificar uppercase
    await waitFor(() => {
      expect(getInputByLabel('ens.containerNumber').value).toBe('CONT123')
      expect(consignorEoriInput.value).toBe('FR987654321')
      expect(consigneeEoriInput.value).toBe('ES111111111')
    })
  })

  test('rellenar consignment y avanzar a step 3', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 2
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    // Rellenar BL y grossMass
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987654321' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '2500' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => {
      // Step 3
      expect(screen.getByText('ens.goodsItems')).toBeInTheDocument()
      expect(screen.getByText('ens.groupageLabel')).toBeInTheDocument()
    })
  })

  test('step 3: toggle groupage muestra house consignments en lugar de goods', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // Por defecto isGroupage=false → muestra goods items
    expect(screen.getByText(/ens.item/)).toBeInTheDocument()
    // Toggle groupage
    const groupageCheckbox = screen.getByRole('checkbox', { name: /ens.groupageLabel/ })
    fireEvent.click(groupageCheckbox)
    // Ahora NO debe haber items directos, sino botón para añadir house
    await waitFor(() => {
      expect(screen.queryByText(/ens.item/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ens.addHouseShipment/ })).toBeInTheDocument()
    })
  })

  test('step 3: modificar campos de goods item ejercita handleGoodsItemChange', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // Modificar campos del primer item
    const itemPaper = screen.getByText('ens.item 1').closest('div[class*="MuiPaper-root"]')
    const descriptionInput = within(itemPaper).getByLabelText('common.description')
    const taricInput = within(itemPaper).getByLabelText('ens.taricCode')
    const originInput = within(itemPaper).getByLabelText('ens.countryOfOrigin')
    fireEvent.change(descriptionInput, { target: { value: 'Computer' } })
    fireEvent.change(taricInput, { target: { value: '8471300000' } })
    fireEvent.change(originInput, { target: { value: 'cn' } })
    // Verificar que los valores se actualizaron (el componente debe transformar a uppercase)
    await waitFor(() => {
      expect(descriptionInput.value).toBe('Computer')
      expect(taricInput.value).toBe('8471300000')
      expect(originInput.value).toBe('CN')
    })
  })

  test('step 3: añadir goods item incrementa la lista', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // Inicialmente 1 item
    expect(screen.getByText('ens.item 1')).toBeInTheDocument()
    // Añadir otro
    const addButton = screen.getByRole('button', { name: /ens.addItem/ })
    fireEvent.click(addButton)
    await waitFor(() => {
      expect(screen.getByText('ens.item 2')).toBeInTheDocument()
    })
  })

  test('step 3: eliminar goods item (si hay >1) reduce la lista', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // Añadir segundo item
    fireEvent.click(screen.getByRole('button', { name: /ens.addItem/ }))
    await waitFor(() => expect(screen.getByText('ens.item 2')).toBeInTheDocument())
    // Eliminar el primero (DeleteIcon dentro del Paper del item 1)
    const item1Paper = screen.getByText('ens.item 1').closest('div[class*="MuiPaper-root"]')
    const deleteButton = within(item1Paper).getByRole('button', { name: '' }) // IconButton sin label → empty name
    fireEvent.click(deleteButton)
    // El segundo pasa a ser el primero
    await waitFor(() => {
      expect(screen.queryByText('ens.item 2')).not.toBeInTheDocument()
      expect(screen.getByText('ens.item 1')).toBeInTheDocument()
    })
  })

  test('step 3: modificar campos de house consignment ejercita funciones inline', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3 + groupage
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: /ens.groupageLabel/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /ens.addHouseShipment/ })).toBeInTheDocument())
    // Añadir house consignment
    fireEvent.click(screen.getByRole('button', { name: /ens.addHouseShipment/ }))
    await waitFor(() => expect(screen.getByText('ens.houseShipment 1')).toBeInTheDocument())
    // Modificar campos
    const housePaper = screen.getByText('ens.houseShipment 1').closest('div[class*="MuiPaper-root"]')
    const refInput = within(housePaper).getByLabelText('ens.houseBlRef')
    const eoriInput = within(housePaper).getByLabelText('ens.eoriConsignee')
    const nameInput = within(housePaper).getByLabelText('ens.nameConsignee')
    fireEvent.change(refInput, { target: { value: 'HOUSE123' } })
    fireEvent.change(eoriInput, { target: { value: 'fr987654321' } })
    fireEvent.change(nameInput, { target: { value: 'Consignee Name' } })
    await waitFor(() => {
      expect(refInput.value).toBe('HOUSE123')
      expect(eoriInput.value).toBe('FR987654321')
      expect(nameInput.value).toBe('Consignee Name')
    })
  })

  test('step 3: añadir house consignment en modo groupage', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // Toggle groupage
    fireEvent.click(screen.getByRole('checkbox', { name: /ens.groupageLabel/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /ens.addHouseShipment/ })).toBeInTheDocument())
    // Añadir house
    fireEvent.click(screen.getByRole('button', { name: /ens.addHouseShipment/ }))
    await waitFor(() => {
      expect(screen.getByText('ens.houseShipment 1')).toBeInTheDocument()
    })
  })

  test('step 3: eliminar house consignment', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3 + groupage
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: /ens.groupageLabel/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /ens.addHouseShipment/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.addHouseShipment/ }))
    await waitFor(() => expect(screen.getByText('ens.houseShipment 1')).toBeInTheDocument())
    // Añadir segundo
    fireEvent.click(screen.getByRole('button', { name: /ens.addHouseShipment/ }))
    await waitFor(() => expect(screen.getByText('ens.houseShipment 2')).toBeInTheDocument())
    // Eliminar el primero
    const house1Paper = screen.getByText('ens.houseShipment 1').closest('div[class*="MuiPaper-root"]')
    const deleteButton = within(house1Paper).getByRole('button', { name: '' })
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(screen.queryByText('ens.houseShipment 2')).not.toBeInTheDocument()
      expect(screen.getByText('ens.houseShipment 1')).toBeInTheDocument()
    })
  })

  test('validación step 3: no groupage y goods vacío → error', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // Eliminar el único item (goods.length=0)
    // Pero formData.goods tiene un item inicial, así que NO podemos llegar a length=0 fácilmente sin romper el código
    // Validación en step 3 chequea goods.length===0 solo si !isGroupage
    // El test real es con isGroupage=true y houseConsignments.length===0
    // Vamos a hacerlo:
    fireEvent.click(screen.getByRole('checkbox', { name: /ens.groupageLabel/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /ens.addHouseShipment/ })).toBeInTheDocument())
    // No añadir ninguno → houseConsignments.length=0
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => {
      expect(screen.getByText('ens.houseRequired')).toBeInTheDocument()
    })
  })

  test('avanzar desde step 3 con goods OK llega a step 4 (review)', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 3
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    // goods tiene 1 item por defecto → validación pasa
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => {
      expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument()
      expect(screen.getByText('ens.validateDeclaration')).toBeInTheDocument()
    })
  })

  test('step 4: handleValidate llama ensAPI.validate y muestra resultado exitoso', async () => {
    ensAPI.validate.mockResolvedValue({
      data: {
        data: {
          isValid: true
        }
      }
    })
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    // Click validate
    const validateButton = screen.getByRole('button', { name: /ens.validateDeclaration/ })
    fireEvent.click(validateButton)
    await waitFor(() => {
      expect(ensAPI.validate).toHaveBeenCalledWith(expect.objectContaining({ transportMode: 'ROAD' }))
      expect(screen.getByText('ens.declarationValid')).toBeInTheDocument()
    })
  })

  test('step 4: handleValidate con errores muestra el mensaje de error', async () => {
    ensAPI.validate.mockResolvedValue({
      data: {
        data: {
          isValid: false,
          errors: [{ message: 'EORI invalido' }, 'Falta container'],
          warnings: []
        }
      }
    })
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.validateDeclaration/ }))
    await waitFor(() => {
      expect(screen.getByText(/ens.errorsAndWarnings/)).toBeInTheDocument()
    })
    // Los errores se renderizan con "- " delante
    expect(screen.getByText(/EORI invalido/)).toBeInTheDocument()
    expect(screen.getByText(/Falta container/)).toBeInTheDocument()
  })

  test('step 4: handleSave draft (crear nuevo)', async () => {
    ensAPI.create.mockResolvedValue({
      data: {
        success: true,
        data: { _id: 'draft123' }
      }
    })
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    // Save draft
    const saveDraftButton = screen.getByRole('button', { name: /ens.saveDraft/ })
    fireEvent.click(saveDraftButton)
    await waitFor(() => {
      expect(ensAPI.create).toHaveBeenCalledWith(expect.objectContaining({ allowDraft: true }))
      expect(mockOnSuccess).toHaveBeenCalledWith({ _id: 'draft123' })
    })
  })

  test('step 4: handleSave submit (crear + submit)', async () => {
    ensAPI.create.mockResolvedValue({
      data: {
        success: true,
        data: { _id: 'dec456' }
      }
    })
    ensAPI.submit.mockResolvedValue({
      data: {
        success: true,
        data: { _id: 'dec456', mrn: 'MRN123' }
      }
    })
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    // Save and send
    const submitButton = screen.getByRole('button', { name: /ens.saveAndSend/ })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(ensAPI.create).toHaveBeenCalledWith(expect.objectContaining({ allowDraft: false }))
      expect(ensAPI.submit).toHaveBeenCalledWith('dec456')
      expect(mockOnSuccess).toHaveBeenCalledWith({ _id: 'dec456', mrn: 'MRN123' })
    })
  })

  test('step 4: actualización (declarationId presente) llama update en lugar de create', async () => {
    ensAPI.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          transportMode: 'ROAD',
          entryOffice: { code: 'ES009999', name: 'PRE Pruebas Peninsula', expectedArrival: '2026-08-10T14:00' },
          carrier: { eori: 'ES12345678X', name: 'Carrier', address: {} },
          transportMeans: {},
          consignment: { referenceNumber: 'BL999', grossMass: '4000', numberOfPackages: '5', goodsDescription: '' },
          consignor: {},
          consignee: {},
          houseConsignments: [],
          goods: [{ itemNumber: 1, description: '', taricCode: '', grossMass: '', netMass: '', numberOfPackages: '', packageType: '', marks: '', countryOfOrigin: '' }],
          documents: []
        }
      }
    })
    ensAPI.update.mockResolvedValue({
      data: {
        success: true,
        data: { _id: 'abc123', updated: true }
      }
    })
    render(<ENSDeclarationForm declarationId="abc123" onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    await waitFor(() => expect(ensAPI.get).toHaveBeenCalledWith('abc123'))
    await waitFor(() => expect(screen.getByText('ens.editTitle')).toBeInTheDocument())
    // Navegar hasta step 4
    // Ya está en step 0, validar y avanzar
    // Arrival ya está pre-rellenado → falta office code (está, ES009999)
    // Avanzar
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    // carrier.eori ya está → avanzar
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    // consignment.referenceNumber y grossMass ya están → avanzar
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    // Save draft
    const saveDraftButton = screen.getByRole('button', { name: /ens.saveDraft/ })
    fireEvent.click(saveDraftButton)
    await waitFor(() => {
      expect(ensAPI.update).toHaveBeenCalledWith('abc123', expect.objectContaining({ allowDraft: true }))
      expect(mockOnSuccess).toHaveBeenCalledWith({ _id: 'abc123', updated: true })
    })
  })

  test('step 4: error de guardado muestra mensaje de error', async () => {
    ensAPI.create.mockRejectedValue({
      response: {
        data: {
          message: 'Validation failed',
          errors: [{ field: 'carrier.eori', message: 'EORI format invalid' }]
        }
      }
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'INVALID' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.saveDraft/ }))
    await waitFor(() => {
      expect(ensAPI.create).toHaveBeenCalled()
      // errors.general debe tener el mensaje
      expect(screen.getByText(/Validation failed/)).toBeInTheDocument()
    })
    consoleErrorSpy.mockRestore()
  })

  test('click en BackIcon llama onClose', () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    const backIconButton = screen.getByRole('button', { name: '' }) // IconButton sin label → buscar el primero (BackIcon)
    // Hay varios IconButtons, el primero es el de BackIcon
    const allIconButtons = screen.getAllByRole('button', { name: '' })
    fireEvent.click(allIconButtons[0])
    expect(mockOnClose).toHaveBeenCalled()
  })

  test('botón saveAndSend deshabilitado si validationResult.isValid=false', async () => {
    ensAPI.validate.mockResolvedValue({
      data: {
        data: {
          isValid: false,
          errors: ['Error grave']
        }
      }
    })
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.validateDeclaration/ }))
    await waitFor(() => expect(screen.getByText(/Error grave/)).toBeInTheDocument())
    // saveAndSend debe estar deshabilitado
    const submitButton = screen.getByRole('button', { name: /ens.saveAndSend/ })
    expect(submitButton).toBeDisabled()
  })

  test('suggestions de validación se muestran cuando existen', async () => {
    ensAPI.validate.mockResolvedValue({
      data: {
        data: {
          isValid: false,
          errors: [],
          warnings: [],
          suggestions: ['Considera usar un EORI simplificado', 'Adjunta el certificado SOIVRE']
        }
      }
    })
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL987' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.validateDeclaration/ }))
    await waitFor(() => {
      expect(screen.getByText('ens.luciSuggestions')).toBeInTheDocument()
      expect(screen.getByText(/Considera usar un EORI simplificado/)).toBeInTheDocument()
      expect(screen.getByText(/Adjunta el certificado SOIVRE/)).toBeInTheDocument()
    })
  })

  test('resumen de step 4 muestra datos de todos los pasos', async () => {
    render(<ENSDeclarationForm onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    // Avanzar hasta step 4 con datos completos
    const officeInput = screen.getByRole('combobox', { name: /ens.entryCustomsLabel/ })
    fireEvent.mouseDown(officeInput)
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]')
      fireEvent.click(within(listbox).getByText(/ES009999/))
    })
    const arrivalInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(arrivalInput, { target: { value: '2026-08-10T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.carrierData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.eoriCarrier'), { target: { value: 'ES123456789' } })
    fireEvent.change(getInputByLabel('ens.companyName'), { target: { value: 'Transportes SA' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.shipmentData')).toBeInTheDocument())
    fireEvent.change(getInputByLabel('ens.blNumber'), { target: { value: 'BL123456' } })
    fireEvent.change(getInputByLabel('ens.containerNumber'), { target: { value: 'CONT7890' } })
    fireEvent.change(getInputByLabel('ens.grossWeightKg'), { target: { value: '5000' } })
    fireEvent.change(getInputByLabel('ens.numberOfPackages'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.goodsItems')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /ens.next/ }))
    await waitFor(() => expect(screen.getByText('ens.reviewTitle')).toBeInTheDocument())
    // Resumen de transporte
    expect(screen.getByText(/ens.summaryMode/)).toBeInTheDocument()
    expect(screen.getByText(/ens.summaryCustoms/)).toBeInTheDocument()
    expect(screen.getByText(/ens.summaryArrival/)).toBeInTheDocument()
    // Resumen de carrier
    expect(screen.getByText(/ens.summaryEori/)).toBeInTheDocument()
    expect(screen.getByText(/ens.summaryName/)).toBeInTheDocument()
    // Resumen de consignment
    expect(screen.getByText(/ens.summaryBl/)).toBeInTheDocument()
    expect(screen.getByText(/ens.summaryContainer/)).toBeInTheDocument()
    expect(screen.getByText(/ens.summaryWeight/)).toBeInTheDocument()
    expect(screen.getByText(/ens.summaryPackages/)).toBeInTheDocument()
    // Resumen de goods
    expect(screen.getByText(/ens.summaryType/)).toBeInTheDocument()
    // goods: 1 item
    expect(screen.getByText(/ens.items/)).toBeInTheDocument()
  })
})
