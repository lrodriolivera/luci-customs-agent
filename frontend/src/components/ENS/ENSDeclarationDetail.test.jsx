import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ENSDeclarationDetail from './ENSDeclarationDetail'

// Mock modules
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'ens-123' }),
  useNavigate: () => mockNavigate
}))

vi.mock('../../services/api', () => ({
  ensAPI: {
    get: vi.fn(),
    submit: vi.fn(),
    cancel: vi.fn(),
    notifyArrival: vi.fn(),
    getXML: vi.fn()
  }
}))

const mockNavigate = vi.fn()

import { ensAPI } from '../../services/api'

const createMockDeclaration = (overrides = {}) => ({
  reference: 'ENS-2026-001',
  lrn: 'ES12345678',
  mrn: '20ES12345678901234567890123456',
  declarationType: 'ENS',
  status: 'draft',
  transportMode: 'SEA',
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-02T11:00:00Z',
  entryOffice: {
    code: 'ES000110',
    name: 'Valencia Puerto',
    expectedArrival: '2026-08-10T14:00:00Z'
  },
  carrier: {
    eori: 'ESB22477020',
    name: 'STRIX AI Transport SL',
    address: {
      street: 'Calle Test 123',
      city: 'Valencia',
      postcode: '46000',
      country: 'ES'
    }
  },
  transportMeans: {
    type: 'Barco',
    identification: 'IMO1234567',
    nationality: 'ES'
  },
  consignment: {
    referenceNumber: 'BL123456',
    containerNumber: 'MSCU1234567',
    sealNumber: 'SEAL001',
    grossMass: 15000,
    numberOfPackages: 100,
    goodsDescription: 'Textiles y accesorios'
  },
  consignor: {
    eori: 'CN123456789',
    name: 'Shanghai Exports Ltd'
  },
  consignee: {
    eori: 'ESB22477020',
    name: 'STRIX AI SL'
  },
  goods: [
    {
      itemNumber: 1,
      description: 'Camisetas de algodón',
      taricCode: '61091000',
      countryOfOrigin: 'CN',
      grossMass: 500,
      numberOfPackages: 10
    },
    {
      itemNumber: 2,
      description: 'Pantalones vaqueros',
      taricCode: '62034231',
      countryOfOrigin: 'CN',
      grossMass: 800,
      numberOfPackages: 15
    }
  ],
  houseConsignments: [
    {
      referenceNumber: 'HOUSE001',
      consignee: {
        name: 'Cliente A',
        eori: 'ES111111111'
      },
      goods: [
        { itemNumber: 1, description: 'Item 1' }
      ]
    },
    {
      referenceNumber: 'HOUSE002',
      consignee: {
        name: 'Cliente B',
        eori: 'ES222222222'
      },
      goods: [
        { itemNumber: 2, description: 'Item 2' },
        { itemNumber: 3, description: 'Item 3' }
      ]
    }
  ],
  documents: [
    {
      type: 'Bill of Lading',
      documentNumber: 'BL123456',
      name: 'BL-Valencia-001.pdf',
      uploadedAt: '2026-08-01T09:00:00Z',
      url: 'https://strixai.es/docs/bl123456.pdf'
    },
    {
      type: 'Commercial Invoice',
      documentNumber: 'INV001',
      name: 'invoice.pdf',
      uploadedAt: '2026-08-01T09:30:00Z'
    }
  ],
  statusHistory: [
    {
      status: 'draft',
      timestamp: '2026-08-01T10:00:00Z',
      reason: 'Declaración creada',
      performedBy: 'luis.rodriguez@strixai.es'
    },
    {
      status: 'submitted',
      timestamp: '2026-08-02T11:00:00Z',
      performedBy: 'system'
    }
  ],
  totals: {
    grossMass: 15000,
    numberOfPackages: 100,
    numberOfItems: 2
  },
  riskAssessment: {
    status: 'PENDING',
    riskScore: undefined,
    doNotLoadList: false,
    evaluatedAt: undefined
  },
  generatedXML: false,
  ...overrides
})

describe('ENSDeclarationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensAPI.get.mockResolvedValue({
      data: { success: true, data: createMockDeclaration() }
    })

    // Stubs para download XML
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Loading and error states', () => {
    it('shows loading spinner while fetching declaration', () => {
      ensAPI.get.mockReturnValue(new Promise(() => {})) // never resolves
      render(<ENSDeclarationDetail />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('shows error alert when declaration not found', async () => {
      ensAPI.get.mockResolvedValue({ data: { success: false } })
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.declarationNotFound')).toBeInTheDocument()
      })
      const backButton = screen.getByRole('button', { name: /ens.backToList/ })
      expect(backButton).toBeInTheDocument()
    })

    it('navigates back when clicking back button on error', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({ data: { success: false } })
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.declarationNotFound')).toBeInTheDocument()
      })
      const backButton = screen.getByRole('button', { name: /ens.backToList/ })
      await user.click(backButton)
      expect(mockNavigate).toHaveBeenCalledWith('/ens')
    })

    it('shows error alert when API throws', async () => {
      ensAPI.get.mockRejectedValue(new Error('Network error'))
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.declarationNotFound')).toBeInTheDocument()
      })
    })
  })

  describe('Header rendering', () => {
    it('renders header with reference and transport mode icon', async () => {
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.maritime')).toBeInTheDocument()
    })

    it('renders ROAD transport icon', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ transportMode: 'ROAD', reference: 'ENS-ROAD-001' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-ROAD-001' })
      expect(screen.getByText('ens.road')).toBeInTheDocument()
    })

    it('renders RAIL transport icon', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ transportMode: 'RAIL', reference: 'ENS-RAIL-001' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-RAIL-001' })
      expect(screen.getByText('ens.rail')).toBeInTheDocument()
    })

    it('renders AIR transport icon', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ transportMode: 'AIR', reference: 'ENS-AIR-001' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-AIR-001' })
      expect(screen.getByText('ens.air')).toBeInTheDocument()
    })

    it('renders MRN chip when MRN exists', async () => {
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText(/MRN: 20ES12345678901234567890123456/)).toBeInTheDocument()
    })

    it('does not render MRN chip when MRN is missing', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ mrn: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.queryByText(/MRN:/)).not.toBeInTheDocument()
    })

    it('renders status chip for draft', async () => {
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.statusDraft')).toBeInTheDocument()
    })

    it('renders status chip for accepted', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.statusAccepted')).toBeInTheDocument()
    })

    it('renders all status types', async () => {
      const statuses = [
        'validated', 'submitted', 'rejected', 'amendment_pending',
        'amended', 'arrived', 'released', 'dnl', 'cancelled'
      ]
      for (const status of statuses) {
        ensAPI.get.mockResolvedValue({
          data: { success: true, data: createMockDeclaration({ status, reference: `ENS-${status}` }) }
        })
        const { unmount } = render(<ENSDeclarationDetail />)
        await screen.findByRole('heading', { name: `ENS-${status}` })
        unmount()
      }
    })
  })

  describe('Action buttons by status', () => {
    it('shows Edit and Send buttons when status is draft', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const editButton = screen.getByRole('button', { name: /common.edit/ })
      const sendButton = screen.getByRole('button', { name: /ens.sendToAeat/ })
      expect(editButton).toBeInTheDocument()
      expect(sendButton).toBeInTheDocument()

      await user.click(editButton)
      expect(mockNavigate).toHaveBeenCalledWith('/ens/ens-123/edit')
    })

    it('submits declaration with window.confirm true', async () => {
      const user = userEvent.setup()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      ensAPI.submit.mockResolvedValue({ data: { success: true } })
      const reloadDeclaration = createMockDeclaration({ status: 'submitted' })
      ensAPI.get.mockResolvedValueOnce({
        data: { success: true, data: createMockDeclaration({ status: 'draft' }) }
      }).mockResolvedValueOnce({
        data: { success: true, data: reloadDeclaration }
      })

      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })

      const sendButton = screen.getByRole('button', { name: /ens.sendToAeat/ })
      await user.click(sendButton)

      expect(confirmSpy).toHaveBeenCalledWith('ens.confirmSend')
      await waitFor(() => {
        expect(ensAPI.submit).toHaveBeenCalledWith('ens-123')
      })

      confirmSpy.mockRestore()
    })

    it('does not submit when window.confirm returns false', async () => {
      const user = userEvent.setup()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })

      const sendButton = screen.getByRole('button', { name: /ens.sendToAeat/ })
      await user.click(sendButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(ensAPI.submit).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })

    it('shows Notify Arrival and Cancel buttons when status is accepted', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByRole('button', { name: /ens.notifyArrival/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ens.cancel/ })).toBeInTheDocument()
    })

    it('shows Notify Arrival and Cancel buttons when status is released', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'released' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByRole('button', { name: /ens.notifyArrival/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ens.cancel/ })).toBeInTheDocument()
    })

    it('shows Download XML button when generatedXML is true', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ generatedXML: true }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByRole('button', { name: /ens.downloadXml/ })).toBeInTheDocument()
    })

    it('downloads XML when clicking Download XML button', async () => {
      const user = userEvent.setup()
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      ensAPI.getXML.mockResolvedValue({ data: '<xml>test</xml>' })
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ generatedXML: true }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })

      const downloadButton = screen.getByRole('button', { name: /ens.downloadXml/ })
      await user.click(downloadButton)

      await waitFor(() => {
        expect(ensAPI.getXML).toHaveBeenCalledWith('ens-123')
      })
      expect(window.URL.createObjectURL).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

      clickSpy.mockRestore()
    })
  })

  describe('Risk Alert', () => {
    it('does not show risk alert when status is PENDING', async () => {
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.queryByText(/ens.riskAnalysisLabel/)).not.toBeInTheDocument()
    })

    it('shows HOLD risk alert', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'HOLD',
              riskScore: 75,
              doNotLoadList: false,
              evaluatedAt: '2026-08-02T12:00:00Z'
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText(/ens.riskAnalysisLabel/)).toBeInTheDocument()
      expect(screen.getByText('ens.riskHeld')).toBeInTheDocument()
    })

    it('shows DNL alert with reason', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'DNL',
              riskScore: 95,
              doNotLoadList: true,
              dnlReason: 'Empresa en lista negra OFAC',
              evaluatedAt: '2026-08-02T13:00:00Z'
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.riskDoNotLoad')).toBeInTheDocument()
      expect(screen.getByText(/Empresa en lista negra OFAC/)).toBeInTheDocument()
    })

    it('shows DNL alert without custom reason (fallback message)', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'DNL',
              doNotLoadList: true,
              dnlReason: undefined
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.dnlDefaultMsg')).toBeInTheDocument()
    })

    it('shows control decisions when present', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'HOLD',
              controlDecisions: [
                { code: 'A3' },
                { code: 'D1' }
              ]
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText(/A3, D1/)).toBeInTheDocument()
    })
  })

  describe('Tabs navigation', () => {
    it('starts on tab 0 (General) by default', async () => {
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.generalInfo')).toBeInTheDocument()
    })

    it('switches to Carrier tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const carrierTab = screen.getByRole('tab', { name: 'ens.tabCarrier' })
      await user.click(carrierTab)
      await waitFor(() => {
        expect(screen.getByText('ens.carrierData')).toBeInTheDocument()
      })
    })

    it('switches to Consignment tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const consignmentTab = screen.getByRole('tab', { name: 'ens.tabShipment' })
      await user.click(consignmentTab)
      await waitFor(() => {
        expect(screen.getByText('ens.shipmentData')).toBeInTheDocument()
      })
    })

    it('switches to Goods tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.houseGroupage')).toBeInTheDocument()
      })
    })

    it('switches to Documents tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const documentsTab = screen.getByRole('tab', { name: 'ens.tabDocuments' })
      await user.click(documentsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.attachedDocuments')).toBeInTheDocument()
      })
    })

    it('switches to History tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const historyTab = screen.getByRole('tab', { name: 'ens.tabHistory' })
      await user.click(historyTab)
      await waitFor(() => {
        expect(screen.getByText('ens.statusHistory')).toBeInTheDocument()
      })
    })
  })

  describe('Tab 0: General', () => {
    it('renders general info with all fields', async () => {
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.generalInfo')).toBeInTheDocument()
      })
      const references = screen.getAllByText('ENS-2026-001')
      expect(references.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('ES12345678')).toBeInTheDocument()
      const mrns = screen.getAllByText(/20ES12345678901234567890123456/)
      expect(mrns.length).toBeGreaterThanOrEqual(1)
    })

    it('renders entry office', async () => {
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.entryCustomsLabel')).toBeInTheDocument()
      })
      expect(screen.getByText('ES000110')).toBeInTheDocument()
      expect(screen.getByText('Valencia Puerto')).toBeInTheDocument()
    })

    it('renders risk assessment card with score', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'ACK',
              riskScore: 25,
              doNotLoadList: false,
              evaluatedAt: '2026-08-02T12:00:00Z'
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.riskAnalysis')).toBeInTheDocument()
      })
      expect(screen.getByText('25/100')).toBeInTheDocument()
      expect(screen.getByText('NO')).toBeInTheDocument()
    })

    it('renders risk assessment with DNL=true showing SI', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'DNL',
              doNotLoadList: true
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.riskAnalysis')).toBeInTheDocument()
      })
      expect(screen.getByText('SI')).toBeInTheDocument()
    })

    it('renders AEAT response with errors', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            aeatResponse: {
              code: 'ERR001',
              timestamp: '2026-08-02T12:30:00Z',
              message: 'Error en validación',
              errors: [
                { code: '1180', message: 'Puerto de destino no válido' },
                { code: '2004', message: 'EORI no registrado' }
              ]
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await waitFor(() => {
        expect(screen.getByText('ens.aeatResponse')).toBeInTheDocument()
      })
      expect(screen.getByText('ERR001')).toBeInTheDocument()
      expect(screen.getByText(/1180: Puerto de destino no válido/)).toBeInTheDocument()
      expect(screen.getByText(/2004: EORI no registrado/)).toBeInTheDocument()
    })
  })

  describe('Tab 1: Carrier', () => {
    it('renders carrier data with address', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const carrierTab = screen.getByRole('tab', { name: 'ens.tabCarrier' })
      await user.click(carrierTab)
      await waitFor(() => {
        expect(screen.getByText('ens.carrierData')).toBeInTheDocument()
      })
      expect(screen.getByText('ESB22477020')).toBeInTheDocument()
      expect(screen.getByText('STRIX AI Transport SL')).toBeInTheDocument()
      expect(screen.getByText(/Calle Test 123, Valencia, 46000, ES/)).toBeInTheDocument()
    })

    it('renders carrier without address (fallback)', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            carrier: {
              eori: 'ESB22477020',
              name: 'STRIX AI Transport SL',
              address: null
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const carrierTab = screen.getByRole('tab', { name: 'ens.tabCarrier' })
      await user.click(carrierTab)
      await waitFor(() => {
        expect(screen.getByText('ens.carrierData')).toBeInTheDocument()
      })
      // address section not rendered when null
      expect(screen.queryByText('common.address')).not.toBeInTheDocument()
    })

    it('renders transport means', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const carrierTab = screen.getByRole('tab', { name: 'ens.tabCarrier' })
      await user.click(carrierTab)
      await waitFor(() => {
        expect(screen.getByText('ens.transportMeans')).toBeInTheDocument()
      })
      expect(screen.getByText('Barco')).toBeInTheDocument()
      expect(screen.getByText('IMO1234567')).toBeInTheDocument()
    })
  })

  describe('Tab 2: Consignment', () => {
    it('renders consignment data with all fields', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const consignmentTab = screen.getByRole('tab', { name: 'ens.tabShipment' })
      await user.click(consignmentTab)
      await waitFor(() => {
        expect(screen.getByText('ens.shipmentData')).toBeInTheDocument()
      })
      expect(screen.getByText('BL123456')).toBeInTheDocument()
      expect(screen.getByText('MSCU1234567')).toBeInTheDocument()
      expect(screen.getByText('SEAL001')).toBeInTheDocument()
      expect(screen.getByText('15000 kg')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('renders consignor and consignee', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const consignmentTab = screen.getByRole('tab', { name: 'ens.tabShipment' })
      await user.click(consignmentTab)
      await waitFor(() => {
        expect(screen.getByText('ens.consignorLabel')).toBeInTheDocument()
      })
      expect(screen.getByText('CN123456789')).toBeInTheDocument()
      expect(screen.getByText('Shanghai Exports Ltd')).toBeInTheDocument()
      expect(screen.getByText('ens.consigneeLabel')).toBeInTheDocument()
      expect(screen.getByText('STRIX AI SL')).toBeInTheDocument()
    })
  })

  describe('Tab 3: Goods', () => {
    it('renders house consignments table', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.houseGroupage')).toBeInTheDocument()
      })
      expect(screen.getByText('HOUSE001')).toBeInTheDocument()
      expect(screen.getByText('Cliente A')).toBeInTheDocument()
      expect(screen.getByText('ES111111111')).toBeInTheDocument()
      expect(screen.getByText('HOUSE002')).toBeInTheDocument()
      expect(screen.getByText('Cliente B')).toBeInTheDocument()
      // Verifica el conteo de items por house: 1 y 2 respectivamente
      const itemsCells = screen.getAllByRole('cell')
      const itemsCell1 = itemsCells.find(cell => cell.textContent === '1')
      const itemsCell2 = itemsCells.find(cell => cell.textContent === '2')
      expect(itemsCell1).toBeInTheDocument()
      expect(itemsCell2).toBeInTheDocument()
    })

    it('renders goods items table with TARIC codes', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.goodsItems')).toBeInTheDocument()
      })
      expect(screen.getByText('Camisetas de algodón')).toBeInTheDocument()
      expect(screen.getByText('61091000')).toBeInTheDocument()
      expect(screen.getByText('Pantalones vaqueros')).toBeInTheDocument()
      expect(screen.getByText('62034231')).toBeInTheDocument()
    })

    it('renders totals with fallbacks', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.totals')).toBeInTheDocument()
      })
      expect(screen.getByText('15000 kg')).toBeInTheDocument()
      // "100" y "2" aparecen en múltiples lugares (houseConsignments table y totals)
      const hundreds = screen.getAllByText('100')
      expect(hundreds.length).toBeGreaterThanOrEqual(1)
      const twos = screen.getAllByText('2')
      expect(twos.length).toBeGreaterThanOrEqual(1)
    })

    it('renders totals with fallback from consignment when totals missing', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            totals: null,
            consignment: {
              grossMass: 8000,
              numberOfPackages: 50
            },
            goods: [
              { itemNumber: 1, description: 'Item 1' },
              { itemNumber: 2, description: 'Item 2' },
              { itemNumber: 3, description: 'Item 3' }
            ],
            houseConsignments: []
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.totals')).toBeInTheDocument()
      })
      expect(screen.getByText('8000 kg')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      const threes = screen.getAllByText('3')
      expect(threes.length).toBeGreaterThanOrEqual(1)
    })

    it('renders totals as 0 when all fallbacks missing', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            totals: null,
            consignment: {},
            goods: []
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.totals')).toBeInTheDocument()
      })
      expect(screen.getByText('0 kg')).toBeInTheDocument()
      const zeroCells = screen.getAllByText('0')
      expect(zeroCells.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Tab 4: Documents', () => {
    it('renders documents table with URL', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const documentsTab = screen.getByRole('tab', { name: 'ens.tabDocuments' })
      await user.click(documentsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.attachedDocuments')).toBeInTheDocument()
      })
      expect(screen.getByText('Bill of Lading')).toBeInTheDocument()
      expect(screen.getByText('BL123456')).toBeInTheDocument()
      expect(screen.getByText('BL-Valencia-001.pdf')).toBeInTheDocument()
      expect(screen.getByText('Commercial Invoice')).toBeInTheDocument()
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThanOrEqual(1)
      expect(links[0]).toHaveAttribute('href', 'https://strixai.es/docs/bl123456.pdf')
    })

    it('renders no documents message when empty', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({ documents: [] })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const documentsTab = screen.getByRole('tab', { name: 'ens.tabDocuments' })
      await user.click(documentsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.noDocuments')).toBeInTheDocument()
      })
    })
  })

  describe('Tab 5: History', () => {
    it('renders status history with reason and performedBy', async () => {
      const user = userEvent.setup()
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const historyTab = screen.getByRole('tab', { name: 'ens.tabHistory' })
      await user.click(historyTab)
      await waitFor(() => {
        expect(screen.getByText('ens.statusHistory')).toBeInTheDocument()
      })
      const statusDraftLabels = screen.getAllByText('ens.statusDraft')
      expect(statusDraftLabels.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Declaración creada')).toBeInTheDocument()
      expect(screen.getByText(/ens.performedBy: luis.rodriguez@strixai.es/)).toBeInTheDocument()
      expect(screen.getByText('ens.statusSent')).toBeInTheDocument()
      expect(screen.getByText(/ens.performedBy: system/)).toBeInTheDocument()
    })

    it('renders no history message when empty', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({ statusHistory: [] })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const historyTab = screen.getByRole('tab', { name: 'ens.tabHistory' })
      await user.click(historyTab)
      await waitFor(() => {
        expect(screen.getByText('ens.noHistory')).toBeInTheDocument()
      })
    })
  })

  describe('Cancel Dialog', () => {
    it('opens cancel dialog when clicking Cancel button', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const cancelButton = screen.getByRole('button', { name: /ens.cancel/ })
      await user.click(cancelButton)
      await waitFor(() => {
        expect(screen.getByText('ens.cancelDeclaration')).toBeInTheDocument()
      })
    })

    it('disables cancel button when reason is empty', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const cancelButton = screen.getByRole('button', { name: /ens.cancel/ })
      await user.click(cancelButton)
      await waitFor(() => {
        expect(screen.getByText('ens.cancelDeclaration')).toBeInTheDocument()
      })
      const confirmCancelButton = screen.getByRole('button', { name: /ens.cancelButton/ })
      expect(confirmCancelButton).toBeDisabled()
    })

    it('enables cancel button and submits when reason is provided', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      ensAPI.cancel.mockResolvedValue({ data: { success: true } })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const cancelButton = screen.getByRole('button', { name: /ens.cancel/ })
      await user.click(cancelButton)
      await waitFor(() => {
        expect(screen.getByText('ens.cancelDeclaration')).toBeInTheDocument()
      })
      const reasonField = screen.getByLabelText('ens.cancelReasonLabel')
      await user.type(reasonField, 'Cliente canceló el pedido')

      const confirmCancelButton = screen.getByRole('button', { name: /ens.cancelButton/ })
      expect(confirmCancelButton).not.toBeDisabled()
      await user.click(confirmCancelButton)

      await waitFor(() => {
        expect(ensAPI.cancel).toHaveBeenCalledWith('ens-123', 'Cliente canceló el pedido')
      })
    })

    it('closes cancel dialog when clicking Cancel (common.cancel)', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const cancelButton = screen.getByRole('button', { name: /ens.cancel/ })
      await user.click(cancelButton)
      await waitFor(() => {
        expect(screen.getByText('ens.cancelDeclaration')).toBeInTheDocument()
      })
      const closeButton = screen.getAllByRole('button', { name: /common.cancel/ })[0]
      await user.click(closeButton)
      await waitFor(() => {
        expect(screen.queryByText('ens.cancelDeclaration')).not.toBeInTheDocument()
      })
    })
  })

  describe('Risk status coverage', () => {
    it('renders all risk statuses', async () => {
      const riskStatuses = ['PENDING', 'ACK', 'HOLD', 'DNL', 'CLEARED']
      for (const status of riskStatuses) {
        ensAPI.get.mockResolvedValue({
          data: {
            success: true,
            data: createMockDeclaration({
              reference: `ENS-RISK-${status}`,
              riskAssessment: { status }
            })
          }
        })
        const { unmount } = render(<ENSDeclarationDetail />)
        await screen.findByRole('heading', { name: `ENS-RISK-${status}` })
        unmount()
      }
    })
  })

  describe('Edge cases and fallbacks', () => {
    it('renders with unknown transport mode gracefully', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ transportMode: 'UNKNOWN' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      // Should not crash, icon simply not rendered
      expect(screen.queryByTestId('DirectionsBoatIcon')).not.toBeInTheDocument()
    })

    it('renders with unknown status gracefully', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'unknown_status' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      // Fallback to showing the status as-is
      expect(screen.getByText('unknown_status')).toBeInTheDocument()
    })

    it('renders without LRN (null)', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ lrn: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.generalInfo')).toBeInTheDocument()
    })

    it('renders without riskAssessment', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ riskAssessment: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.queryByText('ens.riskAnalysis')).not.toBeInTheDocument()
    })

    it('renders without aeatResponse', async () => {
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ aeatResponse: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.queryByText('ens.aeatResponse')).not.toBeInTheDocument()
    })

    it('renders without transportMeans', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ transportMeans: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const carrierTab = screen.getByRole('tab', { name: 'ens.tabCarrier' })
      await user.click(carrierTab)
      await waitFor(() => {
        expect(screen.getByText('ens.transportMeans')).toBeInTheDocument()
      })
    })

    it('renders without consignor/consignee', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ consignor: null, consignee: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const consignmentTab = screen.getByRole('tab', { name: 'ens.tabShipment' })
      await user.click(consignmentTab)
      await waitFor(() => {
        expect(screen.getByText('ens.consignorLabel')).toBeInTheDocument()
      })
    })

    it('renders without goods array', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ goods: null, houseConsignments: null }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.totals')).toBeInTheDocument()
      })
      expect(screen.queryByText('ens.goodsItems')).not.toBeInTheDocument()
      expect(screen.queryByText('ens.houseGroupage')).not.toBeInTheDocument()
    })

    it('renders consignment without optional fields', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            consignment: {
              referenceNumber: 'BL123',
              containerNumber: null,
              sealNumber: null,
              grossMass: null,
              numberOfPackages: null,
              goodsDescription: null
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const consignmentTab = screen.getByRole('tab', { name: 'ens.tabShipment' })
      await user.click(consignmentTab)
      await waitFor(() => {
        expect(screen.getByText('BL123')).toBeInTheDocument()
      })
    })

    it('handles submit error gracefully', async () => {
      const user = userEvent.setup()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      ensAPI.submit.mockRejectedValue(new Error('Network error'))
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const sendButton = screen.getByRole('button', { name: /ens.sendToAeat/ })
      await user.click(sendButton)
      await waitFor(() => {
        expect(ensAPI.submit).toHaveBeenCalled()
      })
      confirmSpy.mockRestore()
    })

    it('handles cancel error gracefully', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      ensAPI.cancel.mockRejectedValue(new Error('Network error'))
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const cancelButton = screen.getByRole('button', { name: /ens.cancel/ })
      await user.click(cancelButton)
      await waitFor(() => {
        expect(screen.getByText('ens.cancelDeclaration')).toBeInTheDocument()
      })
      const reasonField = screen.getByLabelText('ens.cancelReasonLabel')
      await user.type(reasonField, 'Test reason')
      const confirmCancelButton = screen.getByRole('button', { name: /ens.cancelButton/ })
      await user.click(confirmCancelButton)
      await waitFor(() => {
        expect(ensAPI.cancel).toHaveBeenCalled()
      })
    })

    it('handles notifyArrival error gracefully', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      ensAPI.notifyArrival.mockRejectedValue(new Error('Network error'))
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const arrivalButton = screen.getByRole('button', { name: /ens.notifyArrival/ })
      await user.click(arrivalButton)
      await waitFor(() => {
        expect(screen.getByText('ens.arrivalDialogTitle')).toBeInTheDocument()
      })
      const dateField = screen.getByLabelText('ens.arrivalDate')
      await user.type(dateField, '2026-08-10')
      const notifyButtons = screen.getAllByRole('button', { name: /ens.notifyArrival/ })
      const dialogNotifyButton = notifyButtons[notifyButtons.length - 1]
      await user.click(dialogNotifyButton)
      await waitFor(() => {
        expect(ensAPI.notifyArrival).toHaveBeenCalled()
      })
    })

    it('handles downloadXML error gracefully', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ generatedXML: true }) }
      })
      ensAPI.getXML.mockRejectedValue(new Error('Download failed'))
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const downloadButton = screen.getByRole('button', { name: /ens.downloadXml/ })
      await user.click(downloadButton)
      await waitFor(() => {
        expect(ensAPI.getXML).toHaveBeenCalled()
      })
    })

    it('renders risk assessment without riskScore', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'ACK',
              riskScore: undefined,
              doNotLoadList: false
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.queryByText(/\/100/)).not.toBeInTheDocument()
    })

    it('renders risk assessment without evaluatedAt', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            riskAssessment: {
              status: 'HOLD',
              evaluatedAt: undefined
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText(/ens.riskAnalysisLabel/)).toBeInTheDocument()
    })

    it('renders aeatResponse without errors array', async () => {
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            aeatResponse: {
              code: 'ACK',
              timestamp: '2026-08-02T12:30:00Z',
              message: 'Aceptada',
              errors: []
            }
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      expect(screen.getByText('ens.aeatResponse')).toBeInTheDocument()
      expect(screen.getByText('ACK')).toBeInTheDocument()
    })

    it('renders goods items without optional fields', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            goods: [
              {
                itemNumber: null,
                description: null,
                taricCode: null,
                countryOfOrigin: null,
                grossMass: null,
                numberOfPackages: null
              }
            ]
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const goodsTab = screen.getByRole('tab', { name: 'ens.tabGoods' })
      await user.click(goodsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.goodsItems')).toBeInTheDocument()
      })
    })

    it('renders documents without documentNumber and name', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            documents: [
              {
                type: 'Invoice',
                documentNumber: null,
                name: null,
                uploadedAt: '2026-08-01T10:00:00Z',
                url: null
              }
            ]
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const documentsTab = screen.getByRole('tab', { name: 'ens.tabDocuments' })
      await user.click(documentsTab)
      await waitFor(() => {
        expect(screen.getByText('ens.attachedDocuments')).toBeInTheDocument()
      })
      expect(screen.getByText('Invoice')).toBeInTheDocument()
    })

    it('renders history without reason and performedBy', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: {
          success: true,
          data: createMockDeclaration({
            statusHistory: [
              {
                status: 'draft',
                timestamp: '2026-08-01T10:00:00Z',
                reason: null,
                performedBy: null
              }
            ]
          })
        }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const historyTab = screen.getByRole('tab', { name: 'ens.tabHistory' })
      await user.click(historyTab)
      await waitFor(() => {
        expect(screen.getByText('ens.statusHistory')).toBeInTheDocument()
      })
    })
  })

  describe('Arrival Dialog', () => {
    it('opens arrival dialog when clicking Notify Arrival button', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const arrivalButton = screen.getByRole('button', { name: /ens.notifyArrival/ })
      await user.click(arrivalButton)
      await waitFor(() => {
        expect(screen.getByText('ens.arrivalDialogTitle')).toBeInTheDocument()
      })
    })

    it('disables notify button when arrivalDate is empty', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const arrivalButton = screen.getByRole('button', { name: /ens.notifyArrival/ })
      await user.click(arrivalButton)
      await waitFor(() => {
        expect(screen.getByText('ens.arrivalDialogTitle')).toBeInTheDocument()
      })
      const notifyButtons = screen.getAllByRole('button', { name: /ens.notifyArrival/ })
      const dialogNotifyButton = notifyButtons[notifyButtons.length - 1]
      expect(dialogNotifyButton).toBeDisabled()
    })

    it('enables notify button and submits when arrivalDate is filled', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      ensAPI.notifyArrival.mockResolvedValue({ data: { success: true } })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const arrivalButton = screen.getByRole('button', { name: /ens.notifyArrival/ })
      await user.click(arrivalButton)
      await waitFor(() => {
        expect(screen.getByText('ens.arrivalDialogTitle')).toBeInTheDocument()
      })

      // fireEvent.change (un evento por campo) en lugar de user.type
      // (secuencia de teclas por carácter) para evitar que el test supere el
      // timeout bajo la carga de la batería completa. El resultado observable
      // es idéntico en inputs controlados.
      const dateField = screen.getByLabelText('ens.arrivalDate')
      fireEvent.change(dateField, { target: { value: '2026-08-10' } })

      const timeField = screen.getByLabelText('ens.arrivalTime')
      fireEvent.change(timeField, { target: { value: '14:30' } })

      const remarksField = screen.getByLabelText('ens.remarks')
      fireEvent.change(remarksField, { target: { value: 'Llegada sin incidencias' } })

      const notifyButtons = screen.getAllByRole('button', { name: /ens.notifyArrival/ })
      const dialogNotifyButton = notifyButtons[notifyButtons.length - 1]
      expect(dialogNotifyButton).not.toBeDisabled()
      await user.click(dialogNotifyButton)

      await waitFor(() => {
        expect(ensAPI.notifyArrival).toHaveBeenCalledWith('ens-123', {
          arrivalDate: '2026-08-10',
          actualArrivalTime: '14:30',
          remarks: 'Llegada sin incidencias'
        })
      })
    })

    it('closes arrival dialog when clicking Cancel', async () => {
      const user = userEvent.setup()
      ensAPI.get.mockResolvedValue({
        data: { success: true, data: createMockDeclaration({ status: 'accepted' }) }
      })
      render(<ENSDeclarationDetail />)
      await screen.findByRole('heading', { name: 'ENS-2026-001' })
      const arrivalButton = screen.getByRole('button', { name: /ens.notifyArrival/ })
      await user.click(arrivalButton)
      await waitFor(() => {
        expect(screen.getByText('ens.arrivalDialogTitle')).toBeInTheDocument()
      })
      const closeButton = screen.getAllByRole('button', { name: /common.cancel/ })[0]
      await user.click(closeButton)
      await waitFor(() => {
        expect(screen.queryByText('ens.arrivalDialogTitle')).not.toBeInTheDocument()
      })
    })
  })
})
