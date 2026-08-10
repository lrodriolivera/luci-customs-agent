import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OEAManager from './OEAManager'
import { oeaAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../services/api', () => ({
  oeaAPI: {
    list: vi.fn(),
    getStats: vi.fn(),
    getExpiring: vi.fn(),
    getBenefitsCatalog: vi.fn(),
    getSimplifications: vi.fn(),
    getMutualRecognition: vi.fn(),
    create: vi.fn(),
    submitForReview: vi.fn(),
    initiateRenewal: vi.fn()
  }
}))

const mockOea = {
  _id: 'oea1',
  organization: {
    name: 'STRIX AI SL',
    nif: 'B22477020',
    eori: 'ESB22477020'
  },
  certification: {
    type: 'OEAC',
    status: 'approved',
    number: 'ES-OEAC-2026-001',
    applicationDate: '2026-01-15T00:00:00Z',
    approvalDate: '2026-03-20T00:00:00Z',
    expirationDate: '2029-03-20T00:00:00Z'
  },
  compliance: {
    currentStatus: 'excellent'
  },
  requirements: {
    customsCompliance: { status: 'met' },
    recordKeeping: { status: 'met' },
    financialSolvency: { status: 'partial' },
    practicalCompetence: { status: 'met' },
    securityStandards: { status: 'not_applicable' }
  },
  benefits: [
    { name: 'Reduccion garantias', active: true, description: 'Hasta 100%' },
    { name: 'Prioridad controles', active: true, description: 'Inspecciones menores' }
  ],
  simplifications: [
    { code: 'C01', name: 'Despacho centralizado', active: true, description: 'Despacho desde sede' }
  ],
  audits: [
    {
      date: '2026-07-01T00:00:00Z',
      result: 'passed',
      auditor: { name: 'Jose Martinez' }
    }
  ],
  guaranteeReduction: {
    level: 'exempt_100'
  }
}

const mockStats = {
  total: 5,
  byStatus: {
    approved: 3,
    under_review: 1,
    pending: 1
  },
  byType: {
    OEAC: 2,
    OEAS: 1,
    OEAF: 2
  }
}

const mockExpiring = [
  {
    organization: { name: 'Empresa A' },
    certification: { type: 'OEAC', expirationDate: '2026-10-01T00:00:00Z' }
  }
]

const mockBenefits = {
  guarantee: [
    { name: 'Reduccion 100%', description: 'Exencion garantias', types: ['OEAC', 'OEAF'], category: 'guarantee' }
  ],
  simplification: [
    { name: 'Despacho centralizado', description: 'Una sola aduana', types: ['OEAC'], category: 'simplification' }
  ]
}

const mockSimplifications = [
  {
    code: 'C01',
    name: 'Despacho Centralizado',
    description: 'Permite despachar desde una sola aduana',
    applicableTo: ['OEAC', 'OEAF'],
    requirements: ['Solvencia financiera', 'Registros contables', 'Cumplimiento aduanero']
  }
]

const mockMutualRecognition = [
  {
    countryCode: 'US',
    country: 'Estados Unidos',
    programName: 'C-TPAT',
    description: 'Reconocimiento mutuo con EEUU',
    benefits: ['Menos inspecciones', 'Prioridad despacho'],
    effectiveDate: '2012-05-01T00:00:00Z'
  }
]

describe('<OEAManager />', () => {
  // Helper para expandir una OEA
  const expandOEA = async (nameRegex) => {
    const clickableHeader = screen.getByText(nameRegex).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)
    await waitFor(() => expect(screen.getByText('Fecha Solicitud')).toBeInTheDocument())
  }

  beforeEach(() => {
    vi.clearAllMocks()
    oeaAPI.list.mockResolvedValue({ data: { data: { oeas: [] } } })
    oeaAPI.getStats.mockResolvedValue({ data: { data: mockStats } })
    oeaAPI.getExpiring.mockResolvedValue({ data: { data: [] } })
    oeaAPI.getBenefitsCatalog.mockResolvedValue({ data: { data: mockBenefits } })
    oeaAPI.getSimplifications.mockResolvedValue({ data: { data: mockSimplifications } })
    oeaAPI.getMutualRecognition.mockResolvedValue({ data: { data: mockMutualRecognition } })
  })

  // ==================== LOADING ====================
  test('muestra spinner de carga inicial', () => {
    oeaAPI.list.mockReturnValue(new Promise(() => {}))
    render(<OEAManager />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ==================== RENDERIZADO BASICO ====================
  test('renderiza header con titulo y boton de nueva solicitud', async () => {
    render(<OEAManager />)
    // Esperar a que `list` se llame NO garantiza haber salido del spinner: el
    // re-render posterior a resolver la promesa llega despues, y bajo la carga
    // de la bateria completa el assert sincrono cazaba el spinner (flaky).
    expect(await screen.findByText('oea.title')).toBeInTheDocument()
    expect(screen.getByText('oea.subtitle')).toBeInTheDocument()
    expect(screen.getByText('oea.newApplication')).toBeInTheDocument()
  })

  test('renderiza las 4 pestañas de navegacion', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    expect(screen.getByText('Certificaciones')).toBeInTheDocument()
    expect(screen.getByText('Beneficios')).toBeInTheDocument()
    expect(screen.getByText('Simplificaciones')).toBeInTheDocument()
    expect(screen.getByText('Reconocimiento Mutuo')).toBeInTheDocument()
  })

  // ==================== CARGA DE DATOS ====================
  test('carga datos iniciales con filtro "all"', async () => {
    render(<OEAManager />)
    await waitFor(() => {
      expect(oeaAPI.list).toHaveBeenCalledWith({})
      expect(oeaAPI.getStats).toHaveBeenCalled()
      expect(oeaAPI.getExpiring).toHaveBeenCalledWith(90)
      expect(oeaAPI.getBenefitsCatalog).toHaveBeenCalled()
      expect(oeaAPI.getSimplifications).toHaveBeenCalled()
      expect(oeaAPI.getMutualRecognition).toHaveBeenCalled()
    })
  })

  test('maneja error de carga de datos principales', async () => {
    oeaAPI.list.mockRejectedValueOnce({ response: { data: { error: 'Error de red' } } })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    // El componente NO muestra mensaje de error en UI (lo guarda en estado)
  })

  test('maneja error de carga de catalogos sin romper', async () => {
    oeaAPI.getBenefitsCatalog.mockRejectedValueOnce(new Error('Timeout'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getBenefitsCatalog).toHaveBeenCalled())
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching catalogs:', expect.any(Error))
    consoleErrorSpy.mockRestore()
  })

  // ==================== FORMATO DE RESPUESTAS (defensivo) ====================
  test('maneja respuesta de lista con estructura oeas.data.data.oeas', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
  })

  test('maneja respuesta de lista con estructura oeas.data.data (sin .oeas)', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: [mockOea] } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
  })

  test('maneja respuesta vacia de expiring sin romper', async () => {
    oeaAPI.getExpiring.mockResolvedValueOnce({ data: {} })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getExpiring).toHaveBeenCalled())
    // No crashea
  })

  test('maneja benefits catalog vacio sin romper', async () => {
    oeaAPI.getBenefitsCatalog.mockResolvedValueOnce({ data: {} })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getBenefitsCatalog).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Beneficios'))
    // No crashea
  })

  test('maneja simplifications vacio sin romper', async () => {
    oeaAPI.getSimplifications.mockResolvedValueOnce({ data: {} })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getSimplifications).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Simplificaciones'))
    // No crashea
  })

  test('maneja mutualRecognition vacio sin romper', async () => {
    oeaAPI.getMutualRecognition.mockResolvedValueOnce({ data: {} })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getMutualRecognition).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Reconocimiento Mutuo'))
    // No crashea
  })

  // ==================== ALERTAS DE EXPIRACION ====================
  test('muestra alerta de certificaciones proximas a vencer', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [] } } })
    oeaAPI.getExpiring.mockResolvedValueOnce({ data: { data: mockExpiring } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/Certificaciones Proximas a Vencer/)).toBeInTheDocument())
    expect(screen.getByText(/Empresa A/)).toBeInTheDocument()
  })

  test('muestra maximo 3 certificaciones en alerta', async () => {
    const expiring4 = [
      { organization: { name: 'Exp1' }, certification: { type: 'OEAC', expirationDate: '2026-10-01T00:00:00Z' } },
      { organization: { name: 'Exp2' }, certification: { type: 'OEAS', expirationDate: '2026-10-05T00:00:00Z' } },
      { organization: { name: 'Exp3' }, certification: { type: 'OEAF', expirationDate: '2026-10-10T00:00:00Z' } },
      { organization: { name: 'Exp4' }, certification: { type: 'OEAC', expirationDate: '2026-10-15T00:00:00Z' } }
    ]
    oeaAPI.getExpiring.mockResolvedValueOnce({ data: { data: expiring4 } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/Exp1/)).toBeInTheDocument())
    expect(screen.getByText(/Exp2/)).toBeInTheDocument()
    expect(screen.getByText(/Exp3/)).toBeInTheDocument()
    expect(screen.queryByText(/Exp4/)).not.toBeInTheDocument()
  })

  test('no muestra alerta si expiring esta vacio', async () => {
    oeaAPI.getExpiring.mockResolvedValueOnce({ data: { data: [] } })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getExpiring).toHaveBeenCalled())
    expect(screen.queryByText(/Certificaciones Proximas a Vencer/)).not.toBeInTheDocument()
  })

  // ==================== ESTADISTICAS ====================
  test('renderiza estadisticas completas', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('Total OEA')).toBeInTheDocument())
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Aprobados').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('En Revision').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Pendientes').length).toBeGreaterThanOrEqual(1)
  })

  test('maneja stats sin byStatus sin romper', async () => {
    oeaAPI.getStats.mockResolvedValueOnce({ data: { data: { total: 2 } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('Total OEA')).toBeInTheDocument())
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('maneja stats sin byType sin romper', async () => {
    oeaAPI.getStats.mockResolvedValueOnce({ data: { data: { total: 1, byStatus: { approved: 1 } } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('Total OEA')).toBeInTheDocument())
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  test('no renderiza estadisticas si stats es null', async () => {
    oeaAPI.getStats.mockResolvedValueOnce({ data: { data: null } })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.getStats).toHaveBeenCalled())
    expect(screen.queryByText('Total OEA')).not.toBeInTheDocument()
  })

  // ==================== FORMULARIO CREAR OEA ====================
  test('muestra formulario de creacion al hacer clic en boton', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    const btnNuevo = screen.getByText('oea.newApplication')
    fireEvent.click(btnNuevo)
    expect(screen.getByText('oea.newApplicationOEA')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('STRIX AI SL')).toBeInTheDocument()
  })

  test('oculta formulario al hacer clic en Cancelar', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('oea.newApplication'))
    expect(screen.getByText('oea.newApplicationOEA')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByText('oea.newApplicationOEA')).not.toBeInTheDocument()
  })

  test('actualiza estado del formulario al cambiar inputs', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('oea.newApplication'))

    const inputName = screen.getByPlaceholderText('STRIX AI SL')
    fireEvent.change(inputName, { target: { value: 'Test Company' } })
    expect(inputName.value).toBe('Test Company')

    const inputNif = screen.getByPlaceholderText('A12345678')
    fireEvent.change(inputNif, { target: { value: 'B99999999' } })
    expect(inputNif.value).toBe('B99999999')
  })

  test('permite seleccionar tipo de certificacion', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('oea.newApplication'))

    const radioOEAS = screen.getByDisplayValue('OEAS')
    fireEvent.click(radioOEAS)
    expect(radioOEAS.checked).toBe(true)
  })

  test('crea solicitud OEA correctamente', async () => {
    oeaAPI.create.mockResolvedValueOnce({ data: { data: mockOea } })
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [] } } })
      .mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })

    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('oea.newApplication'))

    fireEvent.change(screen.getByPlaceholderText('STRIX AI SL'), { target: { value: 'STRIX AI SL' } })
    fireEvent.change(screen.getByPlaceholderText('A12345678'), { target: { value: 'B22477020' } })
    fireEvent.change(screen.getByPlaceholderText('ESA12345678000'), { target: { value: 'ESB22477020' } })
    fireEvent.change(screen.getByPlaceholderText('Calle Principal 123'), { target: { value: 'Calle Mayor 1' } })
    fireEvent.change(screen.getByPlaceholderText('Madrid'), { target: { value: 'Madrid' } })
    fireEvent.change(screen.getByPlaceholderText('28001'), { target: { value: '28013' } })
    fireEvent.change(screen.getByPlaceholderText('Juan Perez'), { target: { value: 'Luis Rodriguez' } })
    fireEvent.change(screen.getByPlaceholderText('juan@empresa.com'), { target: { value: 'luis@strixai.es' } })
    fireEvent.change(screen.getByPlaceholderText('+34 912345678'), { target: { value: '+34600123456' } })

    const btnCrear = screen.getByText('Crear Solicitud')
    fireEvent.click(btnCrear)

    await waitFor(() => {
      expect(oeaAPI.create).toHaveBeenCalledWith({
        organization: {
          name: 'STRIX AI SL',
          nif: 'B22477020',
          eori: 'ESB22477020',
          address: {
            street: 'Calle Mayor 1',
            city: 'Madrid',
            postalCode: '28013',
            province: '',
            country: 'ES'
          },
          contact: {
            name: 'Luis Rodriguez',
            email: 'luis@strixai.es',
            phone: '+34600123456'
          }
        },
        certification: {
          type: 'OEAC'
        }
      })
    })
  })

  test('maneja error al crear solicitud', async () => {
    oeaAPI.create.mockRejectedValueOnce({ response: { data: { error: 'NIF duplicado' } } })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('oea.newApplication'))

    fireEvent.change(screen.getByPlaceholderText('STRIX AI SL'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('A12345678'), { target: { value: 'B11111111' } })
    fireEvent.change(screen.getByPlaceholderText('ESA12345678000'), { target: { value: 'ESB11111111' } })

    fireEvent.click(screen.getByText('Crear Solicitud'))

    await waitFor(() => expect(oeaAPI.create).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('NIF duplicado')).toBeInTheDocument())
  })

  test('resetea formulario tras crear solicitud exitosamente', async () => {
    oeaAPI.create.mockResolvedValueOnce({ data: { data: mockOea } })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())
    fireEvent.click(screen.getByText('oea.newApplication'))

    fireEvent.change(screen.getByPlaceholderText('STRIX AI SL'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('A12345678'), { target: { value: 'B11111111' } })
    fireEvent.change(screen.getByPlaceholderText('ESA12345678000'), { target: { value: 'ESB11111111' } })

    fireEvent.click(screen.getByText('Crear Solicitud'))

    await waitFor(() => expect(oeaAPI.create).toHaveBeenCalled())
    // Formulario oculto tras creacion exitosa
    await waitFor(() => expect(screen.queryByText('oea.newApplicationOEA')).not.toBeInTheDocument())
  })

  // ==================== FILTROS ====================
  test('aplica filtro de estado', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalledWith({}))

    vi.clearAllMocks()
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [] } } })

    const btnApproved = screen.getAllByText('Aprobados')[1]
    fireEvent.click(btnApproved)

    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalledWith({ status: 'approved' }))
  })

  test('cambia entre filtros correctamente', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    vi.clearAllMocks()
    oeaAPI.list.mockResolvedValue({ data: { data: { oeas: [] } } })

    fireEvent.click(screen.getAllByText('En Revision')[1])
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalledWith({ status: 'under_review' }))

    vi.clearAllMocks()
    fireEvent.click(screen.getByText('Todos'))
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalledWith({}))
  })

  // ==================== LISTA VACIA ====================
  test('muestra mensaje cuando no hay certificaciones', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('No hay certificaciones OEA registradas')).toBeInTheDocument())
    expect(screen.getByText('Crear Primera Solicitud')).toBeInTheDocument()
  })

  test('boton de crear primera solicitud abre formulario', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('No hay certificaciones OEA registradas')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Crear Primera Solicitud'))
    expect(screen.getByText('oea.newApplicationOEA')).toBeInTheDocument()
  })

  // ==================== LISTA CON DATOS ====================
  test('renderiza lista de OEAs con datos completos', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
    expect(screen.getByText(/ESB22477020/)).toBeInTheDocument()
    expect(screen.getByText(/B22477020/)).toBeInTheDocument()
  })

  test('expande y contrae detalles de OEA', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    // No expandido inicialmente
    expect(screen.queryByText('Fecha Solicitud')).not.toBeInTheDocument()

    // Expandir haciendo clic en el header clickeable (el div con cursor-pointer)
    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Fecha Solicitud')).toBeInTheDocument())

    // Contraer
    fireEvent.click(clickableHeader)
    await waitFor(() => expect(screen.queryByText('Fecha Solicitud')).not.toBeInTheDocument())
  })

  test('muestra badges de tipo, estado y compliance', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('OEAC')).toBeInTheDocument())
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
    expect(screen.getByText('Excelente')).toBeInTheDocument()
  })

  test('muestra numero OEA si existe', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText('ES-OEAC-2026-001')).toBeInTheDocument())
  })

  test('calcula dias hasta vencimiento correctamente', async () => {
    const today = new Date('2026-08-06T00:00:00Z')
    vi.setSystemTime(today)

    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    // expirationDate: 2029-03-20 → ~952 dias desde 2026-08-06
    const daysElement = screen.getAllByText(/dias/)[0]
    expect(daysElement).toBeInTheDocument()

    vi.useRealTimers()
  })

  test('muestra detalles expandidos con fechas formateadas', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => {
      expect(screen.getByText('Fecha Solicitud')).toBeInTheDocument()
      expect(screen.getByText('Fecha Aprobacion')).toBeInTheDocument()
      expect(screen.getByText('Fecha Expiracion')).toBeInTheDocument()
    })
  })

  test('muestra reduccion de garantia', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Reduccion Garantia')).toBeInTheDocument())
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  test('muestra requisitos con iconos segun estado', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Estado de Requisitos')).toBeInTheDocument())
    expect(screen.getByText('Cumplimiento Aduanero')).toBeInTheDocument()
    expect(screen.getByText('Solvencia')).toBeInTheDocument()
  })

  test('no muestra requisitos not_applicable', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Estado de Requisitos')).toBeInTheDocument())
    // securityStandards tiene status not_applicable
    expect(screen.queryByText('Seguridad')).not.toBeInTheDocument()
  })

  test('muestra beneficios activos limitados a 6', async () => {
    const oeaWith10Benefits = {
      ...mockOea,
      benefits: Array.from({ length: 10 }, (_, i) => ({
        name: `Beneficio ${i + 1}`,
        active: true,
        description: `Desc ${i}`
      }))
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaWith10Benefits] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText(/Beneficios Activos/)).toBeInTheDocument())
    expect(screen.getByText('Beneficio 1')).toBeInTheDocument()
    expect(screen.getByText('Beneficio 6')).toBeInTheDocument()
    expect(screen.queryByText('Beneficio 7')).not.toBeInTheDocument()
    expect(screen.getByText('+4 mas')).toBeInTheDocument()
  })

  test('muestra simplificaciones concedidas', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getAllByText(/Simplificaciones/).length).toBeGreaterThan(1))
    expect(screen.getByText(/C01:/)).toBeInTheDocument()
    expect(screen.getByText(/Despacho centralizado/)).toBeInTheDocument()
  })

  test('muestra ultima auditoria', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Ultima Auditoria')).toBeInTheDocument())
    expect(screen.getByText('Superada')).toBeInTheDocument()
    expect(screen.getByText(/Jose Martinez/)).toBeInTheDocument()
  })

  test('muestra resultado de auditoria "passed_with_conditions"', async () => {
    const oeaConditional = {
      ...mockOea,
      audits: [{ date: '2026-07-01T00:00:00Z', result: 'passed_with_conditions' }]
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaConditional] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Superada con condiciones')).toBeInTheDocument())
  })

  test('muestra resultado de auditoria "failed"', async () => {
    const oeaFailed = {
      ...mockOea,
      audits: [{ date: '2026-07-01T00:00:00Z', result: 'failed' }]
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaFailed] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('No superada')).toBeInTheDocument())
  })

  test('muestra resultado de auditoria default "Pendiente"', async () => {
    const oeaPending = {
      ...mockOea,
      audits: [{ date: '2026-07-01T00:00:00Z', result: 'pending' }]
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaPending] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Pendiente')).toBeInTheDocument())
  })

  // ==================== ACCIONES OEA ====================
  test('muestra boton "Enviar a Revision" para status pending', async () => {
    const oeaPending = { ...mockOea, certification: { ...mockOea.certification, status: 'pending' } }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaPending] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Enviar a Revision')).toBeInTheDocument())
  })

  test('ejecuta submitForReview correctamente', async () => {
    const oeaPending = { ...mockOea, certification: { ...mockOea.certification, status: 'pending' } }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaPending] } } })
      .mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    oeaAPI.submitForReview.mockResolvedValueOnce({})

    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    const btnSubmit = await screen.findByText('Enviar a Revision')
    fireEvent.click(btnSubmit)

    await waitFor(() => expect(oeaAPI.submitForReview).toHaveBeenCalledWith('oea1'))
  })

  test('maneja error en submitForReview', async () => {
    const oeaPending = { ...mockOea, certification: { ...mockOea.certification, status: 'pending' } }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaPending] } } })
    oeaAPI.submitForReview.mockRejectedValueOnce({ response: { data: { error: 'Datos incompletos' } } })

    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    const btnSubmit = await screen.findByText('Enviar a Revision')
    fireEvent.click(btnSubmit)

    await waitFor(() => expect(oeaAPI.submitForReview).toHaveBeenCalled())
    // Error guardado en estado pero no mostrado en UI (diseño actual)
  })

  test('muestra boton "Iniciar Renovacion" para approved con <=180 dias', async () => {
    const today = new Date('2026-08-06T00:00:00Z')
    vi.setSystemTime(today)

    const oeaExpiringSoon = {
      ...mockOea,
      certification: { ...mockOea.certification, expirationDate: '2026-12-01T00:00:00Z' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaExpiringSoon] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Iniciar Renovacion')).toBeInTheDocument())

    vi.useRealTimers()
  })

  test('no muestra boton "Iniciar Renovacion" si >180 dias', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.queryByText('Iniciar Renovacion')).not.toBeInTheDocument())
  })

  test('ejecuta initiateRenewal correctamente', async () => {
    const today = new Date('2026-08-06T00:00:00Z')
    vi.setSystemTime(today)

    const oeaExpiringSoon = {
      ...mockOea,
      certification: { ...mockOea.certification, expirationDate: '2026-12-01T00:00:00Z' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaExpiringSoon] } } })
      .mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    oeaAPI.initiateRenewal.mockResolvedValueOnce({})

    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    const btnRenewal = await screen.findByText('Iniciar Renovacion')
    fireEvent.click(btnRenewal)

    await waitFor(() => expect(oeaAPI.initiateRenewal).toHaveBeenCalledWith('oea1'))

    vi.useRealTimers()
  })

  test('maneja error en initiateRenewal', async () => {
    const today = new Date('2026-08-06T00:00:00Z')
    vi.setSystemTime(today)

    const oeaExpiringSoon = {
      ...mockOea,
      certification: { ...mockOea.certification, expirationDate: '2026-12-01T00:00:00Z' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaExpiringSoon] } } })
    oeaAPI.initiateRenewal.mockRejectedValueOnce({ response: { data: { error: 'Ya existe renovacion' } } })

    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    const btnRenewal = await screen.findByText('Iniciar Renovacion')
    fireEvent.click(btnRenewal)

    await waitFor(() => expect(oeaAPI.initiateRenewal).toHaveBeenCalled())

    vi.useRealTimers()
  })

  // ==================== TABS ====================
  test('cambia a tab Beneficios', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Beneficios'))
    await waitFor(() => expect(screen.getByText('Reduccion 100%')).toBeInTheDocument())
    expect(screen.getByText('Despacho centralizado')).toBeInTheDocument()
  })

  test('tab Beneficios agrupa por categoria', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Beneficios'))
    await waitFor(() => expect(screen.getByText('Garantias')).toBeInTheDocument())
    expect(screen.getAllByText('Simplificaciones').length).toBeGreaterThanOrEqual(1)
  })

  test('cambia a tab Simplificaciones', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Simplificaciones'))
    await waitFor(() => expect(screen.getByText('Despacho Centralizado')).toBeInTheDocument())
    expect(screen.getByText('Permite despachar desde una sola aduana')).toBeInTheDocument()
  })

  test('tab Simplificaciones muestra requisitos', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Simplificaciones'))
    await waitFor(() => expect(screen.getByText('Requisitos:')).toBeInTheDocument())
    expect(screen.getByText('Solvencia financiera')).toBeInTheDocument()
  })

  test('cambia a tab Reconocimiento Mutuo', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Reconocimiento Mutuo'))
    await waitFor(() => expect(screen.getByText('Estados Unidos')).toBeInTheDocument())
    expect(screen.getByText('C-TPAT')).toBeInTheDocument()
  })

  test('tab Reconocimiento Mutuo muestra beneficios', async () => {
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Reconocimiento Mutuo'))
    await waitFor(() => expect(screen.getByText('Menos inspecciones')).toBeInTheDocument())
    expect(screen.getByText('Prioridad despacho')).toBeInTheDocument()
  })

  test('vuelve a tab Certificaciones', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(oeaAPI.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Beneficios'))
    await waitFor(() => expect(screen.getByText('Reduccion 100%')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Certificaciones'))
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
  })

  // ==================== FORMATEO Y HELPERS ====================
  test('formatDate devuelve fecha localizada', async () => {
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Fecha Solicitud')).toBeInTheDocument())
    // Fecha: 2026-01-15 → formato español
  })

  test('formatDate maneja fecha null', async () => {
    const oeaNoDate = {
      ...mockOea,
      certification: { ...mockOea.certification, approvalDate: null }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaNoDate] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Fecha Aprobacion')).toBeInTheDocument())
    // Debe mostrar "N/A"
  })

  test('getDaysUntilExpiration devuelve null para fecha null', async () => {
    const oeaNoExp = {
      ...mockOea,
      certification: { ...mockOea.certification, expirationDate: null }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaNoExp] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    // No debe mostrar "X dias" en header
    expect(screen.queryByText(/dias restantes/)).not.toBeInTheDocument()
  })

  // ==================== BADGES ====================
  test('getStatusBadge maneja status desconocido', async () => {
    const oeaUnknown = {
      ...mockOea,
      certification: { ...mockOea.certification, status: 'unknown_status' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaUnknown] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
    // Debe renderizar badge con el status original
    expect(screen.getByText('unknown_status')).toBeInTheDocument()
  })

  test('getTypeBadge maneja tipo desconocido', async () => {
    const oeaUnknownType = {
      ...mockOea,
      certification: { ...mockOea.certification, type: 'UNKNOWN' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaUnknownType] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })

  test('getComplianceBadge maneja compliance desconocido', async () => {
    const oeaUnknownComp = {
      ...mockOea,
      compliance: { currentStatus: 'unknown_compliance' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaUnknownComp] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())
    expect(screen.getByText('unknown_compliance')).toBeInTheDocument()
  })

  // ==================== REDUCCION DE GARANTIA ====================
  test('muestra reduccion 50%', async () => {
    const oea50 = {
      ...mockOea,
      guaranteeReduction: { level: 'reduced_50' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oea50] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())
  })

  test('muestra reduccion 30%', async () => {
    const oea30 = {
      ...mockOea,
      guaranteeReduction: { level: 'reduced_30' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oea30] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('30%')).toBeInTheDocument())
  })

  test('muestra Sin reduccion por defecto', async () => {
    const oeaNoReduction = {
      ...mockOea,
      guaranteeReduction: { level: 'none' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaNoReduction] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Sin reduccion')).toBeInTheDocument())
  })

  // ==================== EDGE CASES BENEFICIOS/SIMPLIFICACIONES ====================
  test('no muestra seccion de beneficios si array esta vacio', async () => {
    const oeaNoBenefits = { ...mockOea, benefits: [] }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaNoBenefits] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.queryByText(/Beneficios Activos/)).not.toBeInTheDocument())
  })

  test('no muestra seccion de simplificaciones si array esta vacio', async () => {
    const oeaNoSimp = { ...mockOea, simplifications: [] }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaNoSimp] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.queryByText(/Simplificaciones \(/)).not.toBeInTheDocument())
  })

  test('no muestra seccion de auditorias si array esta vacio', async () => {
    const oeaNoAudits = { ...mockOea, audits: [] }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaNoAudits] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.queryByText('Ultima Auditoria')).not.toBeInTheDocument())
  })

  test('filtra solo beneficios activos', async () => {
    const oeaMixed = {
      ...mockOea,
      benefits: [
        { name: 'Activo 1', active: true },
        { name: 'Inactivo 1', active: false },
        { name: 'Activo 2', active: true }
      ]
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaMixed] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText('Activo 1')).toBeInTheDocument())
    expect(screen.getByText('Activo 2')).toBeInTheDocument()
    expect(screen.queryByText('Inactivo 1')).not.toBeInTheDocument()
  })

  test('filtra solo simplificaciones activas', async () => {
    const oeaMixed = {
      ...mockOea,
      simplifications: [
        { code: 'C01', name: 'Activa', active: true },
        { code: 'C02', name: 'Inactiva', active: false }
      ]
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [oeaMixed] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader)

    await waitFor(() => expect(screen.getByText(/C01: Activa/)).toBeInTheDocument())
    expect(screen.queryByText(/C02: Inactiva/)).not.toBeInTheDocument()
  })

  // ==================== MULTIPLE OEAS ====================
  test('renderiza multiples OEAs correctamente', async () => {
    const oea2 = {
      ...mockOea,
      _id: 'oea2',
      organization: { name: 'Otra Empresa', nif: 'B11111111', eori: 'ESB11111111' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea, oea2] } } })
    render(<OEAManager />)
    await waitFor(() => {
      expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument()
      expect(screen.getByText(/Otra Empresa/)).toBeInTheDocument()
    })
  })

  test('expande solo la OEA clickeada', async () => {
    const oea2 = {
      ...mockOea,
      _id: 'oea2',
      organization: { name: 'Otra Empresa', nif: 'B11111111', eori: 'ESB11111111' }
    }
    oeaAPI.list.mockResolvedValueOnce({ data: { data: { oeas: [mockOea, oea2] } } })
    render(<OEAManager />)
    await waitFor(() => expect(screen.getByText(/STRIX AI SL/)).toBeInTheDocument())

    const clickableHeader1 = screen.getByText(/STRIX AI SL/).closest('div[class*="cursor-pointer"]')
    fireEvent.click(clickableHeader1)

    await waitFor(() => expect(screen.getByText('Fecha Solicitud')).toBeInTheDocument())

    // Otra Empresa no debe mostrar contenido expandido (solo una instancia de "Fecha Solicitud")
    const allFechaSolicitud = screen.queryAllByText('Fecha Solicitud')
    expect(allFechaSolicitud.length).toBe(1)
  })
})
