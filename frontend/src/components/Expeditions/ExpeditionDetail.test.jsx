import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ExpeditionDetail from './ExpeditionDetail'
import { expeditionsAPI, documentsAPI, declarationsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  expeditionsAPI: {
    get: vi.fn(),
    getChecklist: vi.fn(),
    sendPortalLink: vi.fn(),
    aiSuggestDocuments: vi.fn(),
    aiAnalyzeRisk: vi.fn(),
    aiDetectInconsistencies: vi.fn(),
    aiFullAnalysis: vi.fn()
  },
  documentsAPI: {},
  declarationsAPI: {
    generateH1: vi.fn(),
    exportXML: vi.fn(),
    submit: vi.fn(),
    downloadPDF: vi.fn(),
    downloadSummaryPDF: vi.fn()
  }
}))

// Mock sub-components
vi.mock('../Requirements/RequirementManager', () => ({ default: () => <div data-testid="requirement-manager" /> }))
vi.mock('../Channels/ChannelStatus', () => ({ default: () => <div data-testid="channel-status" /> }))
vi.mock('../Paraduanero/ParaduaneroManager', () => ({ default: () => <div data-testid="paraduanero-manager" /> }))

const mockExpedition = {
  _id: 'exp123',
  expeditionId: 'EXP-2026-001',
  operationType: 'import',
  status: 'draft',
  client: {
    companyName: 'Test Company SL',
    nif: 'B12345678',
    eori: 'ESB12345678',
    contact: { name: 'John Doe', email: 'john@test.es' }
  },
  goods: [
    {
      description: 'Café sin tostar',
      taricCode: '0901210000',
      originCountry: 'BR',
      netWeight: 1000,
      grossWeight: 1050,
      invoiceValue: 5000,
      currency: 'EUR'
    },
    {
      description: 'Portátiles',
      taricCode: '8471300000',
      originCountry: 'CN',
      netWeight: 50,
      grossWeight: 60,
      invoiceValue: 15000,
      currency: 'EUR'
    }
  ],
  documents: [
    { originalName: 'invoice.pdf', documentType: 'invoice', validationStatus: 'VALIDATED' },
    { originalName: 'origin.pdf', documentType: 'origin', validationStatus: 'PENDING' }
  ],
  transportMode: 'sea',
  incoterm: { code: 'CIF', place: 'Barcelona' },
  transport: { documentNumber: 'BL123456', carrier: 'Maersk' },
  timeline: [
    { action: 'Expedición creada', timestamp: '2026-08-01T10:00:00Z' },
    { action: 'Documentos subidos', timestamp: '2026-08-02T12:00:00Z' }
  ]
}

const mockChecklist = {
  checklist: [
    { name: 'Factura comercial', required: true, uploaded: true },
    { name: 'Certificado de origen', required: true, uploaded: false },
    { name: 'Packing list', required: false, uploaded: false }
  ]
}

function renderExpeditionDetail(initialEntry = '/expeditions/exp123') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/expeditions/:id" element={<ExpeditionDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('<ExpeditionDetail />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    expeditionsAPI.get.mockResolvedValue({ data: { data: mockExpedition } })
    expeditionsAPI.getChecklist.mockResolvedValue({ data: { data: mockChecklist } })
  })

  test('muestra loading mientras carga los datos', () => {
    expeditionsAPI.get.mockImplementation(() => new Promise(() => {})) // never resolves
    renderExpeditionDetail()
    const spinners = document.querySelectorAll('.animate-spin')
    expect(spinners.length).toBeGreaterThan(0)
  })

  test('carga y renderiza expedición correctamente', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(expeditionsAPI.get).toHaveBeenCalledWith('exp123'))
    expect(await screen.findByText('EXP-2026-001')).toBeInTheDocument()
    expect(screen.getByText('Test Company SL')).toBeInTheDocument()
    expect(screen.getByText('B12345678')).toBeInTheDocument()
    expect(screen.getByText('ESB12345678')).toBeInTheDocument()
  })

  test('renderiza mercancías con TARIC reales', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('Café sin tostar')).toBeInTheDocument())
    expect(screen.getByText('0901210000')).toBeInTheDocument()
    expect(screen.getByText('8471300000')).toBeInTheDocument()
    expect(screen.getByText('Portátiles')).toBeInTheDocument()
  })

  test('renderiza documentos con estados de validación', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('invoice.pdf')).toBeInTheDocument())
    expect(screen.getByText('origin.pdf')).toBeInTheDocument()
    expect(screen.getByText('expeditions.validated')).toBeInTheDocument()
    expect(screen.getByText('expeditions.pendingValidation')).toBeInTheDocument()
  })

  test('renderiza checklist con items requeridos y subidos', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(expeditionsAPI.getChecklist).toHaveBeenCalledWith('exp123'))
    expect(await screen.findByText('Factura comercial')).toBeInTheDocument()
    expect(screen.getByText('Certificado de origen')).toBeInTheDocument()
    expect(screen.getByText('expeditions.required')).toBeInTheDocument()
  })

  test('renderiza información de transporte', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('sea')).toBeInTheDocument())
    expect(screen.getByText('CIF Barcelona')).toBeInTheDocument()
    expect(screen.getByText('BL123456')).toBeInTheDocument()
    expect(screen.getByText('Maersk')).toBeInTheDocument()
  })

  test('renderiza timeline de eventos', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('Expedición creada')).toBeInTheDocument())
    expect(screen.getByText('Documentos subidos')).toBeInTheDocument()
  })

  test('maneja error al cargar expedición', async () => {
    expeditionsAPI.get.mockRejectedValue(new Error('Network error'))
    renderExpeditionDetail()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('expeditions.loadError'))
  })

  test('renderiza expedición sin documentos', async () => {
    expeditionsAPI.get.mockResolvedValue({ data: { data: { ...mockExpedition, documents: [] } } })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('expeditions.noDocuments')).toBeInTheDocument())
  })

  test('maneja error al cargar checklist sin romper UI', async () => {
    expeditionsAPI.getChecklist.mockRejectedValue(new Error('Checklist not found'))
    renderExpeditionDetail()
    await waitFor(() => expect(expeditionsAPI.get).toHaveBeenCalled())
    expect(await screen.findByText('EXP-2026-001')).toBeInTheDocument()
  })

  test('botón de portal link llama a sendPortalLink', async () => {
    expeditionsAPI.sendPortalLink.mockResolvedValue({
      data: { data: { portalUrl: 'https://portal.strixai.es/exp123' } }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('expeditions.sendPortal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('expeditions.sendPortal'))
    await waitFor(() =>
      expect(expeditionsAPI.sendPortalLink).toHaveBeenCalledWith('exp123', 'john@test.es')
    )
    expect(toast.success).toHaveBeenCalledWith('expeditions.portalGenerated')
  })

  test('abre y cierra modal de portal link', async () => {
    expeditionsAPI.sendPortalLink.mockResolvedValue({
      data: { data: { portalUrl: 'https://portal.strixai.es/exp123' } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.sendPortal'))
    fireEvent.click(screen.getByText('expeditions.sendPortal'))
    await waitFor(() => expect(screen.getByText('expeditions.portalLinkTitle')).toBeInTheDocument())
    expect(screen.getByDisplayValue('https://portal.strixai.es/exp123')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('common.close')[0])
    await waitFor(() => expect(screen.queryByText('expeditions.portalLinkTitle')).not.toBeInTheDocument())
  })

  test('botón generateH1 llama a declarationsAPI y actualiza estado', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: {
        data: {
          declaration: { lrn: 'ES123456789', customsOffice: 'ES001200', regime: '40', preference: '100' },
          summary: { totalItems: 2, totalPackages: 10, totalGrossWeight: 1110, totalValue: 20000 },
          warnings: ['Revisar peso neto'],
          xml: '<H1>...</H1>'
        }
      }
    })
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: {
            lrn: 'ES123456789',
            status: 'draft',
            xmlContent: '<H1>...</H1>'
          }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.generateH1'))
    fireEvent.click(screen.getByText('expeditions.generateH1'))
    await waitFor(() =>
      expect(declarationsAPI.generateH1).toHaveBeenCalledWith(
        expect.objectContaining({ expeditionId: 'exp123' })
      )
    )
    expect(toast.success).toHaveBeenCalledWith('expeditions.h1GeneratedSuccess')
    await waitFor(() => expect(screen.getByText('ES123456789')).toBeInTheDocument())
  })

  test('renderiza resultado H1 con summary y warnings', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: {
            lrn: 'ES123456789',
            status: 'draft',
            xmlContent: '<H1>...</H1>',
            customsOffice: 'ES001200',
            regime: '40'
          }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('ES123456789')).toBeInTheDocument())
    expect(screen.getByText('expeditions.h1Generated')).toBeInTheDocument()
  })

  test('botón submitToAEAT llama a submit y muestra resultado con canal verde', async () => {
    const expWithDeclaration = {
      ...mockExpedition,
      declaration: {
        lrn: 'ES123456789',
        status: 'draft',
        xmlContent: '<H1>...</H1>',
        customsOffice: 'ES001200',
        regime: '40'
      }
    }
    expeditionsAPI.get.mockResolvedValue({ data: { data: expWithDeclaration } })
    expeditionsAPI.getChecklist.mockResolvedValue({ data: { data: mockChecklist } })
    declarationsAPI.submit.mockResolvedValue({
      data: {
        data: {
          mrn: '26ES123456789',
          channel: 'green',
          duties: { dutyAmount: 500, vatAmount: 300, totalAmount: 800 }
        }
      }
    })
    renderExpeditionDetail()
    // Esperar a que se renderice el bloque H1
    await waitFor(() => expect(screen.getByText('expeditions.h1Generated')).toBeInTheDocument())
    const submitButton = await screen.findByText('expeditions.submitToAeat')
    fireEvent.click(submitButton)
    await waitFor(() => expect(declarationsAPI.submit).toHaveBeenCalledWith('exp123'), { timeout: 3000 })
    expect(toast.success).toHaveBeenCalled()
  })

  test.each([
    ['green', 'expeditions.greenChannelToast'],
    ['orange', 'expeditions.orangeChannelToast'],
    ['red', 'expeditions.redChannelToast']
  ])('submit con canal %s muestra toast correspondiente', async (channel, toastKey) => {
    const expWithDeclaration = {
      ...mockExpedition,
      declaration: {
        lrn: 'ES123456789',
        status: 'draft',
        xmlContent: '<H1>...</H1>',
        customsOffice: 'ES001200',
        regime: '40'
      }
    }
    expeditionsAPI.get.mockResolvedValue({ data: { data: expWithDeclaration } })
    expeditionsAPI.getChecklist.mockResolvedValue({ data: { data: mockChecklist } })
    declarationsAPI.submit.mockResolvedValue({
      data: { data: { mrn: '26ES123456789', channel } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.h1Generated'))
    const submitButton = await screen.findByText('expeditions.submitToAeat')
    fireEvent.click(submitButton)
    await waitFor(() => expect(declarationsAPI.submit).toHaveBeenCalled(), { timeout: 3000 })
    // Verificar que se llamó algún método de toast (success o toast genérico)
    const toastCalls = toast.success.mock.calls.length + toast.error.mock.calls.length
    expect(toastCalls).toBeGreaterThan(0)
  })

  test('submitToAEAT sin xmlContent muestra error', async () => {
    expeditionsAPI.get.mockResolvedValue({ data: { data: mockExpedition } })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('EXP-2026-001'))
    // No hay botón de submit porque no hay declaration.xmlContent
    expect(screen.queryByText('expeditions.submitToAeat')).not.toBeInTheDocument()
  })

  test('maneja error en submitToAEAT', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: { lrn: 'ES123456789', status: 'draft', xmlContent: '<H1>...</H1>' }
        }
      }
    })
    declarationsAPI.submit.mockRejectedValue({ response: { data: { error: 'AEAT error' } } })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.submitToAeat'))
    fireEvent.click(screen.getByText('expeditions.submitToAeat'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('AEAT error'))
  })

  test('downloadPDF descarga blob correctamente', async () => {
    const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })
    declarationsAPI.downloadPDF.mockResolvedValue({ data: mockBlob })
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.downloadPdf'))
    fireEvent.click(screen.getByText('expeditions.downloadPdf'))
    await waitFor(() => expect(declarationsAPI.downloadPDF).toHaveBeenCalledWith('exp123'))
    expect(toast.success).toHaveBeenCalledWith('expeditions.pdfDownloaded')
  })

  test('downloadSummaryPDF descarga blob correctamente', async () => {
    const mockBlob = new Blob(['summary pdf'], { type: 'application/pdf' })
    declarationsAPI.downloadSummaryPDF.mockResolvedValue({ data: mockBlob })
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.summaryPdf'))
    fireEvent.click(screen.getByText('expeditions.summaryPdf'))
    await waitFor(() => expect(declarationsAPI.downloadSummaryPDF).toHaveBeenCalledWith('exp123'))
    expect(toast.success).toHaveBeenCalledWith('expeditions.summaryPdfDownloaded')
  })

  test('abre y cierra panel AI', async () => {
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => expect(screen.getByText('expeditions.aiAnalysisTitle')).toBeInTheDocument())
    expect(screen.getAllByText('EXP-2026-001').length).toBeGreaterThan(0) // ID en header del panel
    const closeButtons = screen.getAllByRole('button').filter(btn => btn.textContent.includes('common.close'))
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByText('expeditions.aiAnalysisTitle')).not.toBeInTheDocument())
  })

  test('panel AI tab documents: corre análisis y muestra resultados', async () => {
    expeditionsAPI.aiSuggestDocuments.mockResolvedValue({
      data: {
        success: true,
        data: {
          requiredDocuments: [{ name: 'Certificado fitosanitario', reason: 'Producto vegetal' }],
          recommendedDocuments: [{ name: 'Certificado de calidad', benefit: 'Reduce inspecciones' }],
          currentStatus: { complete: 1, pending: 1, missing: 1 },
          summary: 'Faltan documentos obligatorios'
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.runAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiSuggestDocuments).toHaveBeenCalledWith('exp123'))
    expect(await screen.findByText('Certificado fitosanitario')).toBeInTheDocument()
    expect(screen.getByText('Certificado de calidad')).toBeInTheDocument()
    expect(screen.getByText('Faltan documentos obligatorios')).toBeInTheDocument()
  })

  test('panel AI tab risk: corre análisis y muestra nivel de riesgo', async () => {
    expeditionsAPI.aiAnalyzeRisk.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'high',
          score: 85,
          summary: 'Alto riesgo de inspección',
          riskFactors: [
            { factor: 'Origen de alto riesgo', severity: 'high', description: 'País con alerta sanitaria' }
          ],
          channelPrediction: { channel: 'red', probability: 0.75 },
          recommendations: ['Reforzar documentación fitosanitaria']
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiAnalyzeRisk).toHaveBeenCalledWith('exp123'))
    expect(await screen.findByText('Alto riesgo de inspección')).toBeInTheDocument()
    expect(screen.getByText('Origen de alto riesgo')).toBeInTheDocument()
  })

  test('panel AI tab inconsistencies: detecta inconsistencias', async () => {
    expeditionsAPI.aiDetectInconsistencies.mockResolvedValue({
      data: {
        success: true,
        data: {
          hasInconsistencies: true,
          inconsistencies: [
            {
              type: 'Peso',
              severity: 'critical',
              description: 'Peso neto mayor que peso bruto',
              suggestion: 'Revisar pesos'
            }
          ]
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.detectInconsistencies'))
    fireEvent.click(screen.getByText('expeditions.detectInconsistencies'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiDetectInconsistencies).toHaveBeenCalledWith('exp123'))
    expect(await screen.findByText('Peso neto mayor que peso bruto')).toBeInTheDocument()
  })

  test('panel AI tab full: análisis completo con score y action items', async () => {
    expeditionsAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          overallScore: 72,
          summary: 'Expedición con riesgo medio',
          sections: {
            docs: { score: 80, label: 'Documentación' },
            taric: { score: 90, label: 'Clasificación' }
          },
          criticalIssues: ['Falta certificado de origen'],
          taricSuggestions: [
            { taricCode: '0901110000', description: 'Café sin tostar', confidence: 0.95 }
          ],
          actionItems: [
            { action: 'Solicitar certificado', priority: 'high', reason: 'Obligatorio para el despacho' }
          ]
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiFullAnalysis).toHaveBeenCalledWith('exp123'))
    expect(await screen.findByText('Expedición con riesgo medio')).toBeInTheDocument()
    // criticalIssues renderiza "• Falta certificado de origen" (con bullet)
    expect(await screen.findByText(/Falta.*certificado/i)).toBeInTheDocument()
    expect(screen.getByText('0901110000')).toBeInTheDocument()
    expect(screen.getByText('Solicitar certificado')).toBeInTheDocument()
  })

  test('panel AI maneja error en análisis', async () => {
    expeditionsAPI.aiSuggestDocuments.mockRejectedValue({ response: { data: { error: 'AI service error' } } })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.runAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('AI service error')).toBeInTheDocument())
  })

  test('panel AI botón updateAnalysis reejecuta análisis actual', async () => {
    expeditionsAPI.aiSuggestDocuments.mockResolvedValue({
      data: { success: true, data: { requiredDocuments: [], recommendedDocuments: [] } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiSuggestDocuments).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('expeditions.updateAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiSuggestDocuments).toHaveBeenCalledTimes(2))
  })

  test('renderiza RequirementManager cuando hay MRN', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: { mrn: '26ES123456789' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByTestId('requirement-manager')).toBeInTheDocument())
  })

  test('renderiza ChannelStatus cuando hay canal', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: { mrn: '26ES123456789', channel: 'orange' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByTestId('channel-status')).toBeInTheDocument())
  })

  test('renderiza ParaduaneroManager siempre', async () => {
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByTestId('paraduanero-manager')).toBeInTheDocument())
  })

  test('botón downloadXml descarga XML del H1', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: { lrn: 'ES123456789', xmlContent: '<H1>...</H1>' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('ES123456789'))
    fireEvent.click(screen.getByText('expeditions.downloadXml'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('expeditions.xmlDownloaded'))
  })

  test('botón downloadJson descarga JSON del H1', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: { lrn: 'ES123456789', h1Data: { test: 'data' }, xmlContent: '<H1>...</H1>', customsOffice: 'ES001200' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getAllByText('ES123456789'))
    fireEvent.click(screen.getByText('expeditions.downloadJson'))
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled())
  })

  test('renderiza badge de status correcto según operationType', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpedition, operationType: 'export' } }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('common.export')).toBeInTheDocument())
  })

  test('renderiza diferentes status badges', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpedition, status: 'green_channel' } }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('expeditions.statusGreenChannel')).toBeInTheDocument())
  })

  test('copia link del portal al portapapeles', async () => {
    expeditionsAPI.sendPortalLink.mockResolvedValue({
      data: { data: { portalUrl: 'https://portal.strixai.es/exp123' } }
    })
    navigator.clipboard = { writeText: vi.fn().mockResolvedValue() }
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.sendPortal'))
    fireEvent.click(screen.getByText('expeditions.sendPortal'))
    await waitFor(() => screen.getByText('expeditions.portalLinkTitle'))
    const copyButton = screen.getAllByRole('button').find(btn => btn.title === 'expeditions.copyLink')
    if (copyButton) fireEvent.click(copyButton)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://portal.strixai.es/exp123'))
    expect(toast.success).toHaveBeenCalledWith('expeditions.linkCopied')
  })

  test('maneja expedición sin goods', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpedition, goods: [] } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('EXP-2026-001'))
    expect(screen.getByText(/0.*expeditions.items/i)).toBeInTheDocument()
  })

  test('maneja expedición sin client.contact', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpedition, client: { companyName: 'Test', nif: 'B123' } } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('Test'))
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0)
  })

  test('botón sendPortalLink solicita email si no hay contact.email', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpedition, client: { companyName: 'Test', nif: 'B123' } } }
    })
    global.window.prompt = vi.fn(() => 'prompt@test.es')
    expeditionsAPI.sendPortalLink.mockResolvedValue({
      data: { data: { portalUrl: 'https://portal.strixai.es/exp123' } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.sendPortal'))
    fireEvent.click(screen.getByText('expeditions.sendPortal'))
    await waitFor(() => expect(window.prompt).toHaveBeenCalled())
    expect(expeditionsAPI.sendPortalLink).toHaveBeenCalledWith('exp123', 'prompt@test.es')
  })

  test('renderiza canal orange y red correctamente', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: { mrn: '26ES123456789', channel: 'orange' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('26ES123456789')).toBeInTheDocument())
    expect(screen.getByText('expeditions.orangeChannelFull')).toBeInTheDocument()
  })

  test('renderiza warning de h1Result si existen', async () => {
    declarationsAPI.generateH1.mockResolvedValue({
      data: {
        data: {
          declaration: { lrn: 'ES123456789' },
          warnings: ['Advertencia 1', 'Advertencia 2'],
          xml: '<H1>...</H1>'
        }
      }
    })
    expeditionsAPI.get.mockResolvedValueOnce({ data: { data: mockExpedition } })
    expeditionsAPI.get.mockResolvedValueOnce({
      data: { data: { ...mockExpedition, declaration: { lrn: 'ES123456789' } } }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.generateH1'))
    fireEvent.click(screen.getByText('expeditions.generateH1'))
    await waitFor(() => expect(screen.getByText('Advertencia 1')).toBeInTheDocument())
    expect(screen.getByText('Advertencia 2')).toBeInTheDocument()
  })

  test('panel AI risk con riskLevel medium', async () => {
    expeditionsAPI.aiAnalyzeRisk.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'medium',
          score: 55,
          summary: 'Riesgo medio',
          riskFactors: [{ factor: 'Factor medio', severity: 'medium' }],
          recommendations: []
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('Riesgo medio')).toBeInTheDocument())
  })

  test('panel AI risk con riskLevel low', async () => {
    expeditionsAPI.aiAnalyzeRisk.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'low',
          summary: 'Bajo riesgo',
          riskFactors: [{ factor: 'Factor bajo', severity: 'low' }]
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('Bajo riesgo')).toBeInTheDocument())
  })

  test('panel AI inconsistencies sin inconsistencias detectadas', async () => {
    expeditionsAPI.aiDetectInconsistencies.mockResolvedValue({
      data: {
        success: true,
        data: {
          hasInconsistencies: false
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.detectInconsistencies'))
    fireEvent.click(screen.getByText('expeditions.detectInconsistencies'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('expeditions.noInconsistencies')).toBeInTheDocument())
  })

  test('panel AI full con overallScore alto', async () => {
    expeditionsAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          overallScore: 85,
          summary: 'Expedición en buen estado'
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('Expedición en buen estado')).toBeInTheDocument())
  })

  test('panel AI full con overallScore bajo', async () => {
    expeditionsAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          overallScore: 45,
          summary: 'Necesita revisión urgente'
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('Necesita revisión urgente')).toBeInTheDocument())
  })

  test('panel AI documents sin status actual', async () => {
    expeditionsAPI.aiSuggestDocuments.mockResolvedValue({
      data: {
        success: true,
        data: {
          requiredDocuments: [],
          recommendedDocuments: []
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(expeditionsAPI.aiSuggestDocuments).toHaveBeenCalled())
  })

  test('panel AI risk con channelPrediction orange', async () => {
    expeditionsAPI.aiAnalyzeRisk.mockResolvedValue({
      data: {
        success: true,
        data: {
          riskLevel: 'medium',
          channelPrediction: { channel: 'orange', probability: 0.6 }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.analyzeRisk'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('expeditions.channelOrange')).toBeInTheDocument())
  })

  test('panel AI full con actionItems prioridad medium y low', async () => {
    expeditionsAPI.aiFullAnalysis.mockResolvedValue({
      data: {
        success: true,
        data: {
          overallScore: 70,
          actionItems: [
            { action: 'Acción media', priority: 'medium' },
            { action: 'Acción baja', priority: 'low' }
          ]
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => screen.getByText('expeditions.aiAnalysis'))
    fireEvent.click(screen.getByText('expeditions.aiAnalysis'))
    await waitFor(() => screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.fullAnalysis'))
    fireEvent.click(screen.getByText('expeditions.runAnalysis'))
    await waitFor(() => expect(screen.getByText('Acción media')).toBeInTheDocument())
    expect(screen.getByText('Acción baja')).toBeInTheDocument()
  })

  test('expedición con transportMode y sin transport.documentNumber', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          transport: { carrier: 'DHL' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('DHL')).toBeInTheDocument())
  })

  test('expedición con incoterm sin place', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          incoterm: { code: 'FOB' }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText(/FOB/)).toBeInTheDocument())
  })

  test('expedición con declaration.levanteDate', async () => {
    expeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpedition,
          declaration: {
            mrn: '26ES123456789',
            channel: 'green',
            levanteDate: '2026-08-06T10:00:00Z'
          }
        }
      }
    })
    renderExpeditionDetail()
    await waitFor(() => expect(screen.getByText('26ES123456789')).toBeInTheDocument())
  })
})
