import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import PreferencesCalculator from './PreferencesCalculator'
import { preferencesAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  preferencesAPI: {
    checkEligibility: vi.fn(),
    validateCertificate: vi.fn(),
    getRecommendations: vi.fn()
  }
}))

vi.mock('../../data/countries', () => ({
  countriesGrouped: [
    {
      group: 'Comunes',
      countries: [
        { code: 'CA', name: 'Canada', label: 'Canada', agreement: 'CETA' },
        { code: 'CN', name: 'China', label: 'China', agreement: 'None' },
        { code: 'BR', name: 'Brasil', label: 'Brasil', agreement: 'MERCOSUR' },
        { code: 'FR', name: 'Francia', label: 'Francia', agreement: 'EU' },
        { code: 'US', name: 'Estados Unidos', label: 'Estados Unidos', agreement: 'None' }
      ]
    }
  ]
}))

describe('<PreferencesCalculator />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preferencesAPI.getRecommendations.mockResolvedValue({ data: { success: true, data: { recommendations: [] } } })
  })

  // Helper para encontrar inputs por placeholder
  const getTaricInput = () => screen.getByPlaceholderText(/ej\. 8517120000/i)
  const getValueInput = () => screen.getByPlaceholderText(/50000\.00/i)
  const getRexNumberInput = () => screen.getByPlaceholderText(/ej\. REREG\/2026\/12345/i)
  const getAuthNumberInput = () => screen.getByPlaceholderText(/ej\. ES\/001\/2026/i)
  const getCertNumberInput = () => screen.getByPlaceholderText(/ej\. ES123456/i)
  const getExporterNameInput = () => screen.getByPlaceholderText(/Empresa exportadora/i)
  const getConsigneeNameInput = () => screen.getByPlaceholderText(/Empresa importadora/i)
  const getOriginCountryInputCert = () => screen.getByPlaceholderText(/ej\. CA, JP, GB/i)

  test('renderiza el título y la tab eligibility por defecto', () => {
    render(<PreferencesCalculator />)
    expect(screen.getByText('preferencesCalc.title')).toBeInTheDocument()
    expect(screen.getByText('Verificar Elegibilidad')).toBeInTheDocument()
  })

  test('cambio entre tabs muestra/oculta contenido correcto', () => {
    render(<PreferencesCalculator />)
    expect(screen.getByText('Datos del Producto')).toBeInTheDocument()
    expect(screen.queryByText(/Validar Certificado de Origen/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    expect(screen.getByText(/Validar Certificado de Origen/i)).toBeInTheDocument()
    expect(screen.queryByText('Datos del Producto')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Recomendaciones/i }))
    expect(screen.getByText(/Recomendaciones de Optimizacion/i)).toBeInTheDocument()
    expect(screen.queryByText('Datos del Producto')).not.toBeInTheDocument()
  })

  test('validación: taricCode vacío muestra toast y no llama API', async () => {
    render(<PreferencesCalculator />)
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Complete pais de origen y codigo TARIC'))
    expect(preferencesAPI.checkEligibility).not.toHaveBeenCalled()
  })

  test('verificación exitosa: preferencia disponible + ahorro', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: {
            name: 'CETA',
            certificate: 'EUR.1',
            conditions: [{ type: 'preferential', rate: 0 }]
          },
          agreements: [{ name: 'CETA', certificate: 'EUR.1', conditions: [] }],
          savings: 125,
          requirements: ['Certificado EUR.1'],
          warnings: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '8517120000' } })
    fireEvent.change(getValueInput(), { target: { value: '1000' } })

    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalledWith({
      originCountry: 'CA',
      goods: [{
        taricCode: '8517120000',
        customsValue: 1000,
        description: 'Producto a verificar'
      }]
    }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Preferencias verificadas'))
    expect(screen.getByText('Preferencia Disponible')).toBeInTheDocument()
    expect(screen.getByText('CETA')).toBeInTheDocument()
    expect(screen.getAllByText('EUR.1')[0]).toBeInTheDocument()
    expect(screen.getByText(/125\.00 EUR/i)).toBeInTheDocument()
  })

  test('verificación exitosa: preferencia NO disponible', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: false,
          agreements: [],
          savings: 0,
          requirements: [],
          warnings: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '2204210000' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('No Elegible')).toBeInTheDocument())
    expect(screen.getByText('No se encontraron preferencias para este producto')).toBeInTheDocument()
  })

  test('error de API en checkEligibility muestra toast', async () => {
    preferencesAPI.checkEligibility.mockRejectedValue(new Error('Network error'))

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al verificar preferencias'))
  })

  test('response.data.success=false muestra error', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: { success: false, error: 'País no soportado' }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '9999999999' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('País no soportado'))
  })

  test('cálculo de ahorro con tasa preferencial no-cero', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: {
            name: 'EU-MEXICO',
            certificate: 'EUR.1',
            conditions: [{ type: 'preferential', rate: 0.05 }]
          },
          agreements: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '5555555555' } })
    fireEvent.change(getValueInput(), { target: { value: '2000' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/150\.00 EUR/i)).toBeInTheDocument())
  })

  test('cálculo de ahorro con customsValue decimal', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: {
            name: 'CETA',
            certificate: 'Form A',
            conditions: [{ type: 'preferential', rate: 0 }]
          },
          agreements: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1111111111' } })
    fireEvent.change(getValueInput(), { target: { value: '1234.56' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/154\.32 EUR/i)).toBeInTheDocument())
  })

  test('reglas de origen con RVC', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'CETA', certificate: 'EUR.1', conditions: [] },
          agreements: [{
            name: 'CETA',
            certificate: 'EUR.1',
            conditions: [{ type: 'rvc', value: 0.50 }]
          }]
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/Contenido de Valor Regional/i)).toBeInTheDocument())
    expect(screen.getByText(/Mínimo 45% de valor agregado/i)).toBeInTheDocument()
    expect(screen.getByText(/10% de materiales no originarios permitido/i)).toBeInTheDocument()
  })

  test('reglas de origen sin RVC: regla general', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'GSP', certificate: 'Form A', conditions: [] },
          agreements: [{ name: 'GSP', certificate: 'Form A', conditions: [] }]
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '0000000000' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/Regla General/i)).toBeInTheDocument())
    expect(screen.getByText('Product-specific rules')).toBeInTheDocument()
  })

  test('exporterType=normal + customsValue>6000 muestra advertencia', async () => {
    render(<PreferencesCalculator />)
    fireEvent.change(getValueInput(), { target: { value: '7000' } })
    expect(screen.getByText(/Para envios superiores a 6.000 EUR/i)).toBeInTheDocument()
  })

  test('exporterType=rex muestra campo REX e info', async () => {
    render(<PreferencesCalculator />)
    const selects = screen.getAllByRole('combobox')
    const exporterTypeSelect = selects.find(s => s.value === 'normal')
    fireEvent.change(exporterTypeSelect, { target: { value: 'rex' } })
    expect(getRexNumberInput()).toBeInTheDocument()
    expect(screen.getByText(/Certificado valido: Declaracion de origen en factura/i)).toBeInTheDocument()
  })

  test('exporterType=authorized muestra campo auth e info', async () => {
    render(<PreferencesCalculator />)
    const selects = screen.getAllByRole('combobox')
    const exporterTypeSelect = selects.find(s => s.value === 'normal')
    fireEvent.change(exporterTypeSelect, { target: { value: 'authorized' } })
    expect(getAuthNumberInput()).toBeInTheDocument()
    expect(screen.getAllByText(/sin limite de valor/i).length).toBeGreaterThan(0)
  })

  test('documentación necesaria para exporterType=rex con rexNumber', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'CETA', certificate: 'EUR.1', conditions: [] },
          agreements: []
        }
      }
    })

    render(<PreferencesCalculator />)
    const selects = screen.getAllByRole('combobox')
    const exporterTypeSelect = selects.find(s => s.value === 'normal')
    fireEvent.change(exporterTypeSelect, { target: { value: 'rex' } })
    fireEvent.change(getRexNumberInput(), { target: { value: 'REREG/2026/12345' } })
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/Statement/i).length).toBeGreaterThan(0))
    expect(screen.getByText(/REREG\/2026\/12345/i)).toBeInTheDocument()
  })

  test('documentación necesaria para exporterType=authorized', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'GSP', certificate: 'Form A', conditions: [] },
          agreements: []
        }
      }
    })

    render(<PreferencesCalculator />)
    const selects = screen.getAllByRole('combobox')
    const exporterTypeSelect = selects.find(s => s.value === 'normal')
    fireEvent.change(exporterTypeSelect, { target: { value: 'authorized' } })
    fireEvent.change(getAuthNumberInput(), { target: { value: 'ES/001/2026' } })
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/Declaracion de origen/i).length).toBeGreaterThan(0))
    expect(screen.getByText(/ES\/001\/2026/i)).toBeInTheDocument()
  })

  test('documentación necesaria para exporterType=normal con valor>6000', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'JEFTA', certificate: 'EUR.1', conditions: [] },
          agreements: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    fireEvent.change(getValueInput(), { target: { value: '8000' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/EUR\.1/i).length).toBeGreaterThan(0))
    expect(screen.getByText(/emitido por autoridad aduanera/i)).toBeInTheDocument()
  })

  test('documentación necesaria para exporterType=normal con valor<=6000', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'EU-CHILE', certificate: 'EUR.1', conditions: [] },
          agreements: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    fireEvent.change(getValueInput(), { target: { value: '5000' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/hasta 6\.000 EUR/i).length).toBeGreaterThan(0))
  })

  test('tab validation: validación de campos requeridos', async () => {
    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Complete tipo y fecha de emision'))
    expect(preferencesAPI.validateCertificate).not.toHaveBeenCalled()
  })

  test('validación de certificado exitosa: certificado válido', async () => {
    preferencesAPI.validateCertificate.mockResolvedValue({
      data: {
        success: true,
        data: {
          valid: true,
          issues: [],
          warnings: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const dateInputs = screen.getAllByRole('textbox').filter(i => i.type === 'date' || i.value === '')
    // Busco el input de tipo date (HTML5)
    const allInputs = document.querySelectorAll('input[type="date"]')
    const dateInput = allInputs[0]
    fireEvent.change(dateInput, { target: { value: '2026-01-15' } })
    fireEvent.change(getCertNumberInput(), { target: { value: 'ES123456' } })
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.validateCertificate).toHaveBeenCalledWith({
      type: 'EUR.1',
      certificateNumber: 'ES123456',
      issuedDate: '2026-01-15',
      exporterName: '',
      consigneeName: '',
      originCountry: ''
    }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Certificado valido'))
    expect(screen.getByText('Certificado Valido')).toBeInTheDocument()
  })

  test('validación de certificado: certificado inválido con issues', async () => {
    preferencesAPI.validateCertificate.mockResolvedValue({
      data: {
        success: true,
        data: {
          valid: false,
          issues: [
            { field: 'Fecha', message: 'Certificado expirado' },
            { field: 'Exportador', message: 'Nombre no coincide' }
          ],
          warnings: []
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const dateInput = document.querySelectorAll('input[type="date"]')[0]
    fireEvent.change(dateInput, { target: { value: '2020-01-01' } })
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.validateCertificate).toHaveBeenCalled())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Certificado con problemas'))
    expect(screen.getByText('Certificado Invalido')).toBeInTheDocument()
    expect(screen.getByText('Certificado expirado')).toBeInTheDocument()
  })

  test('validación de certificado: con warnings', async () => {
    preferencesAPI.validateCertificate.mockResolvedValue({
      data: {
        success: true,
        data: {
          valid: true,
          issues: [],
          warnings: [
            { field: 'Consignatario', message: 'Dirección incompleta' }
          ]
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const dateInput = document.querySelectorAll('input[type="date"]')[0]
    fireEvent.change(dateInput, { target: { value: '2026-01-01' } })
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.validateCertificate).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/Advertencias:/i)).toBeInTheDocument())
    expect(screen.getByText('Dirección incompleta')).toBeInTheDocument()
  })

  test('error de API en validateCertificate muestra toast', async () => {
    preferencesAPI.validateCertificate.mockRejectedValue(new Error('Server error'))

    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const dateInput = document.querySelectorAll('input[type="date"]')[0]
    fireEvent.change(dateInput, { target: { value: '2026-01-01' } })
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.validateCertificate).toHaveBeenCalled())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al validar certificado'))
  })

  test('response.data.success=false en validateCertificate muestra error', async () => {
    preferencesAPI.validateCertificate.mockResolvedValue({
      data: { success: false, error: 'Certificado no encontrado en BD' }
    })

    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const dateInput = document.querySelectorAll('input[type="date"]')[0]
    fireEvent.change(dateInput, { target: { value: '2026-01-01' } })
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Certificado no encontrado en BD'))
  })

  test('tab optimize sin recomendaciones muestra mensaje vacío', () => {
    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Recomendaciones/i }))
    expect(screen.getByText(/Verifique la elegibilidad.*para obtener recomendaciones/i)).toBeInTheDocument()
  })

  test('tab optimize con recomendaciones high priority', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: {
        success: true,
        data: {
          eligible: true,
          recommended: { name: 'CETA', certificate: 'EUR.1', conditions: [] },
          agreements: []
        }
      }
    })
    preferencesAPI.getRecommendations.mockResolvedValue({
      data: {
        success: true,
        data: {
          recommendations: [
            {
              type: 'preference',
              priority: 'high',
              action: 'Usar acuerdo CETA en lugar de GSP',
              description: 'Mayor reducción arancelaria',
              requirements: ['Certificado EUR.1', 'Prueba de origen'],
              savings: 250.50
            }
          ]
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.getRecommendations).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /Recomendaciones/i }))
    expect(screen.getByText('Usar acuerdo CETA en lugar de GSP')).toBeInTheDocument()
    expect(screen.getByText('Mayor reducción arancelaria')).toBeInTheDocument()
    expect(screen.getByText(/250\.50 EUR/i)).toBeInTheDocument()
    expect(screen.getByText(/Preferencia/i)).toBeInTheDocument()
  })

  test('recomendaciones con priority medium', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: { success: true, data: { eligible: true, recommended: { name: 'GSP', certificate: 'Form A', conditions: [] }, agreements: [] } }
    })
    preferencesAPI.getRecommendations.mockResolvedValue({
      data: {
        success: true,
        data: {
          recommendations: [
            {
              type: 'cumulation',
              priority: 'medium',
              action: 'Considerar acumulación Pan-Euro-Med',
              description: 'Puede permitir cumplir reglas de origen',
              requirements: [],
              savings: 0
            }
          ]
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.getRecommendations).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Recomendaciones/i }))
    expect(screen.getByText(/acumulación Pan-Euro-Med/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Acumulacion/i).length).toBeGreaterThan(0)
  })

  test('recomendaciones con priority low', async () => {
    preferencesAPI.checkEligibility.mockResolvedValue({
      data: { success: true, data: { eligible: true, recommended: { name: 'EU-UK', certificate: 'Statement on Origin', conditions: [] }, agreements: [] } }
    })
    preferencesAPI.getRecommendations.mockResolvedValue({
      data: {
        success: true,
        data: {
          recommendations: [
            {
              type: 'documentation',
              priority: 'low',
              action: 'Revisar formato de declaración de origen',
              description: 'Asegurar texto exacto según acuerdo',
              requirements: [],
              savings: 0
            }
          ]
        }
      }
    })

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    await waitFor(() => expect(preferencesAPI.getRecommendations).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Recomendaciones/i }))
    expect(screen.getByText('Revisar formato de declaración de origen')).toBeInTheDocument()
    expect(screen.getByText(/Documentacion/i)).toBeInTheDocument()
  })

  test('muestra spinner durante checkEligibility', async () => {
    preferencesAPI.checkEligibility.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { success: true, data: { eligible: false, agreements: [] } } }), 100)))

    render(<PreferencesCalculator />)
    fireEvent.change(getTaricInput(), { target: { value: '1234567890' } })
    const form = screen.getByText('Datos del Producto').closest('form')
    fireEvent.submit(form)

    expect(screen.getByText('Verificando...')).toBeInTheDocument()
    await waitFor(() => expect(preferencesAPI.checkEligibility).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Verificando...')).not.toBeInTheDocument())
  })

  test('muestra spinner durante validateCertificate', async () => {
    preferencesAPI.validateCertificate.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { success: true, data: { valid: true, issues: [] } } }), 100)))

    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const dateInput = document.querySelectorAll('input[type="date"]')[0]
    fireEvent.change(dateInput, { target: { value: '2026-01-01' } })
    const form = screen.getByText(/Validar Certificado de Origen/i).closest('form')
    fireEvent.submit(form)

    expect(screen.getByText('Validando...')).toBeInTheDocument()
    await waitFor(() => expect(preferencesAPI.validateCertificate).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Validando...')).not.toBeInTheDocument())
  })

  test('sin resultado muestra placeholder en eligibility tab', () => {
    render(<PreferencesCalculator />)
    expect(screen.getByText(/Complete el formulario y verifique la elegibilidad/i)).toBeInTheDocument()
  })

  test('sin validación muestra placeholder en validation tab', () => {
    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    expect(screen.getByText(/Complete el formulario para validar un certificado/i)).toBeInTheDocument()
  })

  test('cambio de exporterType resetea rexNumber y authorizedExporterNumber', () => {
    render(<PreferencesCalculator />)
    const selects = screen.getAllByRole('combobox')
    const exporterTypeSelect = selects.find(s => s.value === 'normal')
    fireEvent.change(exporterTypeSelect, { target: { value: 'rex' } })
    fireEvent.change(getRexNumberInput(), { target: { value: 'REX123' } })
    fireEvent.change(exporterTypeSelect, { target: { value: 'authorized' } })
    expect(screen.queryByPlaceholderText(/ej\. REREG\/2026\/12345/i)).not.toBeInTheDocument()
    expect(getAuthNumberInput()).toBeInTheDocument()
  })

  test('uppercase automático en originCountry del certData', () => {
    render(<PreferencesCalculator />)
    fireEvent.click(screen.getByRole('button', { name: /Validar Certificado/i }))
    const input = getOriginCountryInputCert()
    fireEvent.change(input, { target: { value: 'ca' } })
    expect(input.value).toBe('CA')
  })

  test('uppercase automático en rexNumber y authorizedExporterNumber', () => {
    render(<PreferencesCalculator />)
    const selects = screen.getAllByRole('combobox')
    const exporterTypeSelect = selects.find(s => s.value === 'normal')
    fireEvent.change(exporterTypeSelect, { target: { value: 'rex' } })
    const inputRex = getRexNumberInput()
    fireEvent.change(inputRex, { target: { value: 'rereg/2026/test' } })
    expect(inputRex.value).toBe('REREG/2026/TEST')

    fireEvent.change(exporterTypeSelect, { target: { value: 'authorized' } })
    const inputAuth = getAuthNumberInput()
    fireEvent.change(inputAuth, { target: { value: 'es/001/test' } })
    expect(inputAuth.value).toBe('ES/001/TEST')
  })
})
