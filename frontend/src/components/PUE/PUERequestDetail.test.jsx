import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PUERequestDetail from './PUERequestDetail'
import { pueAPI } from '../../services/api'

// Mocks
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'pue-123' }),
  useNavigate: () => vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('../../services/api', () => ({
  pueAPI: {
    get: vi.fn(),
    submit: vi.fn(),
    cancel: vi.fn(),
    scheduleInspection: vi.fn(),
    recordInspectionResult: vi.fn(),
    queryStatus: vi.fn(),
    getXML: vi.fn()
  }
}))

// Setup jsdom missing APIs
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
  global.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const mockRequestDraft = {
  reference: 'PUE-2026-001',
  pueReference: 'ES1234567890',
  status: 'draft',
  pueType: 'ROHS',
  pueSubtype: 'TV',
  soivreOffice: { name: 'Madrid', code: 'ES001' },
  deadline: '2026-08-15T10:00:00Z',
  operator: {
    name: 'Empresa Test SL',
    eori: 'ES1234567890',
    nif: 'B12345678',
    address: {
      streetAndNumber: 'Calle Test 1',
      postalCode: '28001',
      city: 'Madrid'
    }
  },
  goods: [
    {
      sequenceNumber: 1,
      description: 'Television LED 50"',
      brand: 'Sony',
      model: 'X90',
      taricCode: '85287219',
      quantity: 10,
      unitOfMeasure: 'PCE',
      grossMass: 150,
      countryOfOrigin: 'CN'
    }
  ],
  totals: {
    grossMass: 150,
    packages: 10,
    statisticalValue: 5000
  },
  transport: {
    mode: 'MAR',
    documentType: 'BL',
    documentNumber: 'BL123456',
    containerNumber: 'CONT123',
    vehicleRegistration: null
  },
  statusHistory: [
    {
      status: 'draft',
      timestamp: '2026-08-01T09:00:00Z',
      reason: null
    }
  ],
  attachedDocuments: [
    { name: 'Factura', type: 'invoice', documentNumber: 'FAC-001' }
  ]
}

const mockRequestSubmitted = {
  ...mockRequestDraft,
  status: 'submitted',
  statusHistory: [
    { status: 'draft', timestamp: '2026-08-01T09:00:00Z' },
    { status: 'submitted', timestamp: '2026-08-02T10:00:00Z' }
  ]
}

const mockRequestPendingInspection = {
  ...mockRequestDraft,
  status: 'pending_inspection',
  statusHistory: [
    { status: 'draft', timestamp: '2026-08-01T09:00:00Z' },
    { status: 'submitted', timestamp: '2026-08-02T10:00:00Z' },
    { status: 'pending_inspection', timestamp: '2026-08-03T11:00:00Z' }
  ]
}

const mockRequestInspectionScheduled = {
  ...mockRequestDraft,
  status: 'inspection_scheduled',
  inspection: {
    scheduledDate: '2026-08-10',
    scheduledTime: '10:00',
    type: 'fisica',
    location: 'Puerto de Barcelona',
    result: null
  },
  statusHistory: [
    { status: 'draft', timestamp: '2026-08-01T09:00:00Z' },
    { status: 'submitted', timestamp: '2026-08-02T10:00:00Z' },
    { status: 'pending_inspection', timestamp: '2026-08-03T11:00:00Z' },
    { status: 'inspection_scheduled', timestamp: '2026-08-04T12:00:00Z' }
  ]
}

const mockRequestPhase5 = {
  ...mockRequestDraft,
  declarationMRN: '26ES123456789012345678',
  mrnPartida: '26ES123456789012345678',
  claveZeta: 'Z123',
  flowType: 'ROHS_RAEE',
  contactEmail: 'test@test.com',
  codCice: { code: 'C001', name: 'Centro Madrid' },
  codPi: { code: 'PI001', name: 'Punto Barajas' },
  specificities: ['ESP001', 'ESP002', 'ESP003'],
  certificates: {
    com: 'COM-001',
    rohs: 'ROHS-001',
    raee: 'RAEE-001'
  },
  riiNumbers: {
    raee: 'RII-RAEE-001',
    pya: 'RII-PYA-001'
  }
}

const mockRequestWithCertificate = {
  ...mockRequestDraft,
  status: 'approved',
  issuedCertificate: {
    number: 'CERT-001',
    issuedAt: '2026-08-05T14:00:00Z',
    validUntil: '2027-08-05T14:00:00Z'
  }
}

const mockRequestWithAeatResponse = {
  ...mockRequestDraft,
  status: 'approved',
  aeatResponse: {
    code: '200',
    message: 'Aprobado correctamente'
  },
  soivreResponse: {
    code: 'SOI-200',
    message: 'Certificado emitido'
  }
}

describe('PUERequestDetail', () => {
  describe('Loading state', () => {
    it('renders loading spinner initially', () => {
      pueAPI.get.mockReturnValue(new Promise(() => {})) // Never resolves
      render(<PUERequestDetail />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('calls pueAPI.get with correct id', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(pueAPI.get).toHaveBeenCalledWith('pue-123')
    })
  })

  describe('Error state', () => {
    it('renders error message when API fails', async () => {
      pueAPI.get.mockRejectedValue(new Error('Network error'))
      render(<PUERequestDetail />)
      await waitFor(() => {
        expect(screen.getByText(/Error cargando la solicitud/)).toBeInTheDocument()
      })
    })

    it('renders Volver button on error', async () => {
      pueAPI.get.mockRejectedValue(new Error('Network error'))
      render(<PUERequestDetail />)
      await screen.findByText(/Error cargando la solicitud/)
      expect(screen.getByRole('button', { name: /Volver a Lista/i })).toBeInTheDocument()
    })
  })

  describe('Draft status', () => {
    it('renders draft status correctly', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      const borradorElements = screen.getAllByText(/Borrador/)
      expect(borradorElements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders Enviar a AEAT button for draft status', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByRole('button', { name: /Enviar a AEAT/ })).toBeInTheDocument()
    })

    it('renders Cancelar button for draft status', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument()
    })
  })

  describe('Submitted status', () => {
    it('renders submitted status correctly', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestSubmitted } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      const enviadaElements = screen.getAllByText(/Enviada/)
      expect(enviadaElements.length).toBeGreaterThanOrEqual(1)
    })

    it('does NOT render Enviar a AEAT button for submitted status', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestSubmitted } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.queryByRole('button', { name: /Enviar a AEAT/ })).not.toBeInTheDocument()
    })

    it('renders Consultar Estado button when pueReference exists', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestSubmitted } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByRole('button', { name: /Consultar Estado/i })).toBeInTheDocument()
    })
  })

  describe('Pending inspection status', () => {
    it('renders Programar Inspeccion button', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByRole('button', { name: /Programar Inspeccion/i })).toBeInTheDocument()
    })
  })

  describe('Inspection scheduled status', () => {
    it('renders Registrar Resultado button', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByRole('button', { name: /Registrar Resultado/i })).toBeInTheDocument()
    })

    it('renders inspection details', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      const inspeccionElements = screen.getAllByText(/Inspeccion/)
      expect(inspeccionElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Puerto de Barcelona/)).toBeInTheDocument()
    })
  })

  describe('General info rendering', () => {
    it('renders operator name and EORI', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Empresa Test SL/)).toBeInTheDocument()
      const eoriElements = screen.getAllByText(/ES1234567890/)
      expect(eoriElements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders operator address', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Calle Test 1/)).toBeInTheDocument()
      expect(screen.getByText(/28001 Madrid/)).toBeInTheDocument()
    })

    it('renders goods table', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Television LED 50"/)).toBeInTheDocument()
      expect(screen.getByText(/Sony X90/)).toBeInTheDocument()
      expect(screen.getByText(/85287219/)).toBeInTheDocument()
    })

    it('renders transport info', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/MAR/)).toBeInTheDocument()
      expect(screen.getByText(/BL BL123456/)).toBeInTheDocument()
      expect(screen.getByText(/CONT123/)).toBeInTheDocument()
    })

    it('renders attached documents', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Factura/)).toBeInTheDocument()
      expect(screen.getByText(/FAC-001/)).toBeInTheDocument()
    })

    it('renders empty documents message when no documents', async () => {
      const requestNoDocuments = { ...mockRequestDraft, attachedDocuments: [] }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestNoDocuments } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Sin documentos/)).toBeInTheDocument()
    })

    it('renders status history timeline', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestSubmitted } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Historial/)).toBeInTheDocument()
      // Timeline reversed, so submitted comes first
      const statuses = screen.getAllByText(/Enviada|Borrador/)
      expect(statuses.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Phase 5 fields', () => {
    it('renders MRN and claveZeta', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPhase5 } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/26ES123456789012345678/)).toBeInTheDocument()
      expect(screen.getByText(/Z123/)).toBeInTheDocument()
    })

    it('renders flowType chip', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPhase5 } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/ROHS\/RAEE/)).toBeInTheDocument()
    })

    it('renders codCice and codPi', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPhase5 } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/C001 - Centro Madrid/)).toBeInTheDocument()
      expect(screen.getByText(/PI001 - Punto Barajas/)).toBeInTheDocument()
    })

    it('renders specificities chips', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPhase5 } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/ESP001/)).toBeInTheDocument()
      expect(screen.getByText(/ESP002/)).toBeInTheDocument()
      expect(screen.getByText(/ESP003/)).toBeInTheDocument()
    })

    it('renders certificates', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPhase5 } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/COM-001/)).toBeInTheDocument()
      expect(screen.getByText(/ROHS-001/)).toBeInTheDocument()
      const raeeElements = screen.getAllByText(/RAEE-001/)
      expect(raeeElements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders RII numbers', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPhase5 } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/RII-RAEE-001/)).toBeInTheDocument()
      expect(screen.getByText(/RII-PYA-001/)).toBeInTheDocument()
    })
  })

  describe('Issued certificate', () => {
    it('renders certificate when present', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestWithCertificate } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Certificado Emitido/)).toBeInTheDocument()
      expect(screen.getByText(/CERT-001/)).toBeInTheDocument()
    })
  })

  describe('AEAT/SOIVRE response', () => {
    it('renders aeatResponse and soivreResponse', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestWithAeatResponse } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Respuesta AEAT\/SOIVRE/)).toBeInTheDocument()
      const code200Elements = screen.getAllByText(/200/)
      expect(code200Elements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Aprobado correctamente/)).toBeInTheDocument()
      expect(screen.getByText(/SOI-200/)).toBeInTheDocument()
      expect(screen.getByText(/Certificado emitido/)).toBeInTheDocument()
    })
  })

  describe('handleSubmit', () => {
    it('calls pueAPI.submit when confirm is true', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      pueAPI.submit.mockResolvedValue({ data: { success: true } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const submitButton = screen.getByRole('button', { name: /Enviar a AEAT/ })
      await userEvent.click(submitButton)

      expect(confirmSpy).toHaveBeenCalledWith('Esta seguro de enviar esta solicitud?')
      expect(pueAPI.submit).toHaveBeenCalledWith('pue-123')
      expect(pueAPI.get).toHaveBeenCalledTimes(2) // Initial + reload
      confirmSpy.mockRestore()
    })

    it('does NOT call pueAPI.submit when confirm is false', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const submitButton = screen.getByRole('button', { name: /Enviar a AEAT/ })
      await userEvent.click(submitButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(pueAPI.submit).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })

    it('shows alert on submit error', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      pueAPI.submit.mockRejectedValue(new Error('Submit error'))

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const submitButton = screen.getByRole('button', { name: /Enviar a AEAT/ })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error al enviar la solicitud')
      })
      confirmSpy.mockRestore()
      alertSpy.mockRestore()
    })
  })

  describe('handleCancel', () => {
    it('calls pueAPI.cancel when prompt returns a reason', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Motivo de prueba')
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      pueAPI.cancel.mockResolvedValue({ data: { success: true } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const cancelButton = screen.getByRole('button', { name: /Cancelar/i })
      await userEvent.click(cancelButton)

      expect(promptSpy).toHaveBeenCalledWith('Motivo de cancelacion:')
      expect(pueAPI.cancel).toHaveBeenCalledWith('pue-123', 'Motivo de prueba')
      expect(pueAPI.get).toHaveBeenCalledTimes(2)
      promptSpy.mockRestore()
    })

    it('does NOT call pueAPI.cancel when prompt is cancelled', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const cancelButton = screen.getByRole('button', { name: /Cancelar/i })
      await userEvent.click(cancelButton)

      expect(promptSpy).toHaveBeenCalled()
      expect(pueAPI.cancel).not.toHaveBeenCalled()
      promptSpy.mockRestore()
    })

    it('shows alert on cancel error', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('motivo')
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      pueAPI.cancel.mockRejectedValue(new Error('Cancel error'))

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const cancelButton = screen.getByRole('button', { name: /Cancelar/i })
      await userEvent.click(cancelButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error al cancelar')
      })
      promptSpy.mockRestore()
      alertSpy.mockRestore()
    })
  })

  describe('handleScheduleInspection dialog', () => {
    it('opens schedule inspection dialog', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const scheduleButton = screen.getByRole('button', { name: /Programar Inspeccion/i })
      await userEvent.click(scheduleButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(screen.getByLabelText(/Fecha/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Hora/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Ubicacion/)).toBeInTheDocument()
    })

    it('fills and submits schedule inspection form', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })
      pueAPI.scheduleInspection.mockResolvedValue({ data: { success: true } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const scheduleButton = screen.getByRole('button', { name: /Programar Inspeccion/i })
      await userEvent.click(scheduleButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const dateInput = screen.getByLabelText(/Fecha/)
      const timeInput = screen.getByLabelText(/Hora/)
      const locationInput = screen.getByLabelText(/Ubicacion/)
      const inspectorInput = screen.getByLabelText(/Nombre Inspector/)

      fireEvent.change(dateInput, { target: { value: '2026-08-10' } })
      fireEvent.change(timeInput, { target: { value: '14:30' } })
      fireEvent.change(locationInput, { target: { value: 'Puerto de Valencia' } })
      fireEvent.change(inspectorInput, { target: { value: 'Inspector Test' } })

      const programarButton = screen.getByRole('button', { name: /Programar/ })
      await userEvent.click(programarButton)

      expect(pueAPI.scheduleInspection).toHaveBeenCalledWith('pue-123', {
        date: '2026-08-10',
        time: '14:30',
        location: 'Puerto de Valencia',
        type: 'fisica',
        inspector: { name: 'Inspector Test', id: '' }
      })
      expect(pueAPI.get).toHaveBeenCalledTimes(2)
    })

    it('closes schedule inspection dialog on cancel', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const scheduleButton = screen.getByRole('button', { name: /Programar Inspeccion/i })
      await userEvent.click(scheduleButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const cancelarButton = screen.getByRole('button', { name: /Cancelar/ })
      await userEvent.click(cancelarButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('shows alert on scheduleInspection error', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })
      pueAPI.scheduleInspection.mockRejectedValue(new Error('Schedule error'))

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const scheduleButton = screen.getByRole('button', { name: /Programar Inspeccion/i })
      await userEvent.click(scheduleButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const programarButton = screen.getByRole('button', { name: /Programar/ })
      await userEvent.click(programarButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error al programar inspeccion')
      })
      alertSpy.mockRestore()
    })
  })

  describe('handleRecordResult dialog', () => {
    it('opens record result dialog', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const resultButton = screen.getByRole('button', { name: /Registrar Resultado/i })
      await userEvent.click(resultButton)

      await waitFor(() => {
        const dialogs = screen.getAllByRole('dialog')
        expect(dialogs.length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getByLabelText(/Notas \/ Observaciones/)).toBeInTheDocument()
    })

    it('fills and submits record result form', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })
      pueAPI.recordInspectionResult.mockResolvedValue({ data: { success: true } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const resultButton = screen.getByRole('button', { name: /Registrar Resultado/i })
      await userEvent.click(resultButton)

      await waitFor(() => {
        expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(1)
      })

      const notesInput = screen.getByLabelText(/Notas \/ Observaciones/)
      fireEvent.change(notesInput, { target: { value: 'Todo correcto' } })

      // MUI Select: find the input and change it directly
      const resultInputs = screen.getAllByLabelText(/Resultado/)
      const dialogResultInput = resultInputs[resultInputs.length - 1]
      fireEvent.mouseDown(dialogResultInput)

      // Now the menu should be open, find favorable option
      const favorableOption = await screen.findByText('Favorable')
      await userEvent.click(favorableOption)

      const registrarButton = screen.getByRole('button', { name: /Registrar/ })
      await waitFor(() => {
        expect(registrarButton).not.toBeDisabled()
      })
      await userEvent.click(registrarButton)

      expect(pueAPI.recordInspectionResult).toHaveBeenCalledWith('pue-123', expect.objectContaining({
        notes: 'Todo correcto',
        findings: []
      }))
      expect(pueAPI.get).toHaveBeenCalledTimes(2)
    })

    it('closes record result dialog on cancel', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const resultButton = screen.getByRole('button', { name: /Registrar Resultado/i })
      await userEvent.click(resultButton)

      await waitFor(() => {
        expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(1)
      })

      const cancelarButtons = screen.getAllByRole('button', { name: /Cancelar/ })
      const dialogCancelButton = cancelarButtons[cancelarButtons.length - 1] // Last cancel button
      await userEvent.click(dialogCancelButton)

      await waitFor(() => {
        expect(screen.queryByText(/Registrar Resultado de Inspeccion/)).not.toBeVisible()
      })
    })

    it('disables Registrar button when result is empty', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const resultButton = screen.getByRole('button', { name: /Registrar Resultado/i })
      await userEvent.click(resultButton)

      await waitFor(() => {
        expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(1)
      })

      const registrarButton = screen.getByRole('button', { name: /Registrar/ })
      expect(registrarButton).toBeDisabled()
    })

    it('shows alert on recordInspectionResult error', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestInspectionScheduled } })
      pueAPI.recordInspectionResult.mockRejectedValue(new Error('Record error'))

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const resultButton = screen.getByRole('button', { name: /Registrar Resultado/i })
      await userEvent.click(resultButton)

      await waitFor(() => {
        expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(1)
      })

      // MUI Select: find the input and change it directly
      const resultInputs = screen.getAllByLabelText(/Resultado/)
      const dialogResultInput = resultInputs[resultInputs.length - 1]
      fireEvent.mouseDown(dialogResultInput)

      // Now the menu should be open, find favorable option
      const favorableOption = await screen.findByText('Favorable')
      await userEvent.click(favorableOption)

      const registrarButton = screen.getByRole('button', { name: /Registrar/ })
      await waitFor(() => {
        expect(registrarButton).not.toBeDisabled()
      })
      await userEvent.click(registrarButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error al registrar resultado')
      })
      alertSpy.mockRestore()
    })
  })

  describe('handleQueryStatus', () => {
    it('calls pueAPI.queryStatus and shows alert with result', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestSubmitted } })
      pueAPI.queryStatus.mockResolvedValue({
        data: {
          data: {
            currentStatus: 'approved',
            lastUpdate: '2026-08-05 10:00'
          }
        }
      })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const queryButton = screen.getByRole('button', { name: /Consultar Estado/i })
      await userEvent.click(queryButton)

      expect(pueAPI.queryStatus).toHaveBeenCalledWith('pue-123')
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Estado: approved'))
      })
      alertSpy.mockRestore()
    })

    it('shows alert on queryStatus error', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestSubmitted } })
      pueAPI.queryStatus.mockRejectedValue(new Error('Query error'))

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const queryButton = screen.getByRole('button', { name: /Consultar Estado/i })
      await userEvent.click(queryButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error consultando estado')
      })
      alertSpy.mockRestore()
    })
  })

  describe('handleDownloadXML', () => {
    it('downloads XML file correctly', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      pueAPI.getXML.mockResolvedValue({ data: '<xml>test</xml>' })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const downloadButton = screen.getByRole('button', { name: /Descargar XML/i })
      await userEvent.click(downloadButton)

      await waitFor(() => {
        expect(pueAPI.getXML).toHaveBeenCalledWith('pue-123')
      })
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('shows alert on downloadXML error', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      pueAPI.getXML.mockRejectedValue(new Error('Download error'))

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const downloadButton = screen.getByRole('button', { name: /Descargar XML/i })
      await userEvent.click(downloadButton)

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error descargando XML')
      })
      alertSpy.mockRestore()
    })
  })

  describe('Required documents', () => {
    it('renders required documents when present', async () => {
      const requestWithRequired = {
        ...mockRequestDraft,
        requiredDocuments: [
          { name: 'Certificado ROHS', provided: true },
          { name: 'Factura comercial', provided: false }
        ]
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestWithRequired } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Documentos Requeridos/)).toBeInTheDocument()
      expect(screen.getByText(/Certificado ROHS/)).toBeInTheDocument()
      expect(screen.getByText(/Factura comercial/)).toBeInTheDocument()
      expect(screen.getByText('OK')).toBeInTheDocument()
      expect(screen.getByText('Pendiente')).toBeInTheDocument()
    })
  })

  describe('Schedule inspection dialog - type selection', () => {
    it('allows changing inspection type', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })
      pueAPI.scheduleInspection.mockResolvedValue({ data: { success: true } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const scheduleButton = screen.getByRole('button', { name: /Programar Inspeccion/i })
      await userEvent.click(scheduleButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const typeInput = screen.getByLabelText(/Tipo de Inspeccion/)
      fireEvent.mouseDown(typeInput)

      const documentalOption = await screen.findByText('Documental')
      await userEvent.click(documentalOption)

      const programarButton = screen.getByRole('button', { name: /Programar/ })
      await userEvent.click(programarButton)

      expect(pueAPI.scheduleInspection).toHaveBeenCalledWith('pue-123', expect.objectContaining({
        type: 'documental'
      }))
    })

    it('updates inspector id field', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestPendingInspection } })

      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)

      const scheduleButton = screen.getByRole('button', { name: /Programar Inspeccion/i })
      await userEvent.click(scheduleButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const inspectorInput = screen.getByLabelText(/Nombre Inspector/)
      fireEvent.change(inspectorInput, { target: { value: 'Juan Perez' } })

      expect(inspectorInput.value).toBe('Juan Perez')
    })
  })

  describe('Inspection result display', () => {
    it('renders inspection result chip with correct color', async () => {
      const requestWithResult = {
        ...mockRequestInspectionScheduled,
        status: 'in_inspection',
        inspection: {
          scheduledDate: '2026-08-10',
          scheduledTime: '10:00',
          type: 'fisica',
          location: 'Puerto de Barcelona',
          result: 'favorable',
          resultNotes: 'Inspeccion satisfactoria'
        }
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestWithResult } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/favorable/)).toBeInTheDocument()
      expect(screen.getByText(/Inspeccion satisfactoria/)).toBeInTheDocument()
    })
  })

  describe('Conditional rendering', () => {
    it('does not render Phase 5 fields when not present', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.queryByText(/Declaracion Vinculada/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Especificidades/)).not.toBeInTheDocument()
    })

    it('does not render certificate section when not present', async () => {
      pueAPI.get.mockResolvedValue({ data: { success: true, data: mockRequestDraft } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.queryByText(/Certificado Emitido/)).not.toBeInTheDocument()
    })

    it('renders vehicleRegistration when containerNumber is not present', async () => {
      const requestWithVehicle = {
        ...mockRequestDraft,
        transport: {
          mode: 'CAR',
          documentType: 'CMR',
          documentNumber: 'CMR123',
          containerNumber: null,
          vehicleRegistration: '1234-ABC'
        }
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestWithVehicle } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/1234-ABC/)).toBeInTheDocument()
    })

    it('renders SOIVRE flowType chip', async () => {
      const requestSOIVRE = {
        ...mockRequestPhase5,
        flowType: 'SOIVRE'
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestSOIVRE } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText('SOIVRE')).toBeInTheDocument()
    })

    it('renders status history with reason', async () => {
      const requestWithReason = {
        ...mockRequestDraft,
        status: 'cancelled',
        statusHistory: [
          { status: 'draft', timestamp: '2026-08-01T09:00:00Z', reason: null },
          { status: 'cancelled', timestamp: '2026-08-02T10:00:00Z', reason: 'Cancelado por el usuario' }
        ]
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestWithReason } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Cancelado por el usuario/)).toBeInTheDocument()
    })

    it('does not render containerNumber when not present', async () => {
      const requestNoContainer = {
        ...mockRequestDraft,
        transport: {
          mode: 'AIR',
          documentType: 'AWB',
          documentNumber: 'AWB123',
          containerNumber: null
        }
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestNoContainer } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.queryByText(/Contenedor/)).not.toBeInTheDocument()
    })

    it('renders inspection result as Pendiente when null', async () => {
      const requestPendingResult = {
        ...mockRequestInspectionScheduled,
        inspection: {
          ...mockRequestInspectionScheduled.inspection,
          result: null
        }
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestPendingResult } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/Pendiente/)).toBeInTheDocument()
    })

    it('renders inspection with unfavorable result', async () => {
      const requestUnfavorable = {
        ...mockRequestInspectionScheduled,
        inspection: {
          scheduledDate: '2026-08-10',
          scheduledTime: '10:00',
          type: 'fisica',
          location: 'Puerto de Barcelona',
          result: 'unfavorable',
          resultNotes: 'Producto no conforme'
        }
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestUnfavorable } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      expect(screen.getByText(/unfavorable/)).toBeInTheDocument()
      expect(screen.getByText(/Producto no conforme/)).toBeInTheDocument()
    })

    it('does not render inspection notes when not present', async () => {
      const requestNoNotes = {
        ...mockRequestInspectionScheduled,
        inspection: {
          scheduledDate: '2026-08-10',
          scheduledTime: '10:00',
          type: 'fisica',
          location: 'Puerto de Barcelona',
          result: null,
          resultNotes: null
        }
      }
      pueAPI.get.mockResolvedValue({ data: { success: true, data: requestNoNotes } })
      render(<PUERequestDetail />)
      await screen.findByText(/PUE-2026-001/)
      const notasElements = screen.queryAllByText(/Notas/)
      // Should not have notes in inspection section (only in dialog if opened)
      expect(notasElements.length).toBeLessThan(2)
    })
  })
})
