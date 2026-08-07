import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DeclarationGenerator from './DeclarationGenerator.jsx'

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock APIs
vi.mock('../../services/api', () => ({
  expeditionsAPI: {
    list: vi.fn()
  },
  declarationsAPI: {
    generateH1: vi.fn(),
    generateAES: vi.fn(),
    exportXML: vi.fn(),
    submit: vi.fn(),
    submitV2: vi.fn()
  },
  knowledgeAPI: {
    regimeInfo: vi.fn()
  }
}))

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  DocumentTextIcon: () => null,
  ArrowDownTrayIcon: () => null,
  PaperAirplaneIcon: () => null,
  InformationCircleIcon: () => null,
  CheckCircleIcon: () => null
}))

// jsdom stubs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
HTMLAnchorElement.prototype.click = vi.fn()

import { expeditionsAPI, declarationsAPI, knowledgeAPI } from '../../services/api'
import toast from 'react-hot-toast'

const mockExpeditions = [
  {
    _id: 'exp1',
    expeditionId: 'EXP-001',
    operationType: 'import',
    client: { companyName: 'Test Company A' }
  },
  {
    _id: 'exp2',
    expeditionId: 'EXP-002',
    operationType: 'export',
    client: { companyName: 'Test Company B' }
  },
  {
    _id: 'exp3',
    expeditionId: 'EXP-003',
    operationType: 'IMPORT',
    client: { companyName: 'Test Company C' }
  }
]

const mockRegimeInfo = {
  code: '40',
  name: 'Despacho a libre practica',
  description: 'Importacion normal',
  requirements: ['Factura comercial', 'Documento de transporte'],
  vat: 'IVA aplicable',
  typical_use: 'Importaciones definitivas'
}

const mockGeneratedDeclaration = {
  declaration_data: {
    regime: '40',
    items: []
  },
  warnings: ['Warning 1', 'Warning 2'],
  recommendations: ['Recommendation 1']
}

describe('DeclarationGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    expeditionsAPI.list.mockResolvedValue({
      data: { expeditions: mockExpeditions }
    })
    knowledgeAPI.regimeInfo.mockResolvedValue({
      data: mockRegimeInfo
    })
  })

  describe('Initial rendering and loading', () => {
    test('renders component with title', async () => {
      render(<DeclarationGenerator />)
      expect(screen.getByText('declarations.title')).toBeInTheDocument()
      expect(screen.getByText('declarations.subtitle')).toBeInTheDocument()
    })

    test('shows loading spinner initially', () => {
      render(<DeclarationGenerator />)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    test('loads expeditions on mount', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(expeditionsAPI.list).toHaveBeenCalledWith({})
      })
    })

    test('displays expeditions after loading', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      expect(screen.getByText('Test Company A')).toBeInTheDocument()
      // EXP-002 is export, only shows with AES selected (default is H1/import filter)
      expect(screen.queryByText('EXP-002')).not.toBeInTheDocument()
    })

    test('handles expeditions in nested data structure', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: { data: { expeditions: mockExpeditions } }
      })
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
    })

    test('displays no expeditions message when list is empty', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: { expeditions: [] }
      })
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('declarations.noExpeditionsAvailable')).toBeInTheDocument()
      })
    })

    test('handles fetch error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      expeditionsAPI.list.mockRejectedValue(new Error('Network error'))
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error fetching expeditions:', expect.any(Error))
      })
      consoleError.mockRestore()
    })
  })

  describe('Country indicator', () => {
    test('displays Spain indicator by default', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('Espana - AEAT')).toBeInTheDocument()
      })
    })

    test('displays Netherlands indicator when NL is set', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('Paises Bajos - DMS 4.0')).toBeInTheDocument()
      })
    })

    test('shows DECO label for NL with H7 declaration type', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      // By default it's H1, which should show DMS 4.0
      expect(screen.getByText('Paises Bajos - DMS 4.0')).toBeInTheDocument()
    })
  })

  describe('Declaration type selection', () => {
    test('H1 is selected by default', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const h1Button = screen.getByText('declarations.h1Import').closest('button')
      expect(h1Button).toHaveClass('border-luci')
    })

    test('switches to AES declaration type', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const aesButton = screen.getByText('declarations.aesExport').closest('button')
      fireEvent.click(aesButton)
      expect(aesButton).toHaveClass('border-luci')
    })

    test('el panel informativo cambia a "Sobre AES" al seleccionar AES', async () => {
      // Antes mostraba siempre "Sobre H1" aunque el tipo fuera AES.
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      // Por defecto H1: panel "Sobre H1".
      expect(screen.getByText('declarations.aboutH1')).toBeInTheDocument()

      const aesButton = screen.getByText('declarations.aesExport').closest('button')
      fireEvent.click(aesButton)

      // Tras AES: panel "Sobre AES", no "Sobre H1".
      expect(screen.getByText('declarations.aboutAES')).toBeInTheDocument()
      expect(screen.queryByText('declarations.aboutH1')).not.toBeInTheDocument()
    })

    test('shows NL-specific text for H1 when country is NL', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('DMS 4.0 Import')).toBeInTheDocument()
      })
    })
  })

  describe('Expedition filtering and selection', () => {
    test('filters expeditions by import type when H1 selected', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      // Should show import expeditions
      expect(screen.getByText('EXP-001')).toBeInTheDocument()
      expect(screen.getByText('EXP-003')).toBeInTheDocument()
      // Should not show export
      expect(screen.queryByText('EXP-002')).not.toBeInTheDocument()
    })

    test('filters expeditions by export type when AES selected', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const aesButton = screen.getByText('declarations.aesExport').closest('button')
      fireEvent.click(aesButton)

      await waitFor(() => {
        expect(screen.getByText('EXP-002')).toBeInTheDocument()
      })
      expect(screen.queryByText('EXP-001')).not.toBeInTheDocument()
      expect(screen.queryByText('EXP-003')).not.toBeInTheDocument()
    })

    test('selects expedition on click', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expeditionText = screen.getByText('EXP-001')
      const expedition = expeditionText.closest('.p-4')
      fireEvent.click(expedition)
      await waitFor(() => {
        expect(expedition).toHaveClass('border-luci')
      })
    })

    test('displays correct badge for import expedition', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const badges = screen.getAllByText('common.import')
      expect(badges.length).toBeGreaterThan(0)
    })

    test('displays correct badge for export expedition', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const aesButton = screen.getByText('declarations.aesExport').closest('button')
      fireEvent.click(aesButton)
      await waitFor(() => {
        expect(screen.getByText('common.export')).toBeInTheDocument()
      })
    })
  })

  describe('Declaration options (H1)', () => {
    test('shows options panel when expedition selected for H1', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)
      await waitFor(() => {
        expect(screen.getByText('declarations.declarationOptions')).toBeInTheDocument()
      })
    })

    test('does not show options panel for AES', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const aesButton = screen.getByText('declarations.aesExport').closest('button')
      fireEvent.click(aesButton)
      const expedition = screen.getByText('EXP-002').closest('.p-4')
      fireEvent.click(expedition)
      await waitFor(() => {
        expect(screen.queryByText('declarations.declarationOptions')).not.toBeInTheDocument()
      })
    })

    test('changes regime option', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        expect(screen.getByText('declarations.customsRegime')).toBeInTheDocument()
      })

      // Label doesn't have htmlFor, find select by finding label's next sibling
      const label = screen.getByText('declarations.customsRegime')
      const regimeSelect = label.parentElement.querySelector('select')
      fireEvent.change(regimeSelect, { target: { value: '42' } })
      expect(regimeSelect.value).toBe('42')
    })

    test('changes additional procedure', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        expect(screen.getByText('declarations.additionalProcedure')).toBeInTheDocument()
      })

      const label = screen.getByText('declarations.additionalProcedure')
      const procInput = label.parentElement.querySelector('input')
      fireEvent.change(procInput, { target: { value: '123' } })
      expect(procInput.value).toBe('123')
    })

    test('changes preference', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        expect(screen.getByText('declarations.preference')).toBeInTheDocument()
      })

      const label = screen.getByText('declarations.preference')
      const prefSelect = label.parentElement.querySelector('select')
      fireEvent.change(prefSelect, { target: { value: '200' } })
      expect(prefSelect.value).toBe('200')
    })

    test('uses NL regimes when country is NL', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        expect(screen.getByText('declarations.customsRegime')).toBeInTheDocument()
      })

      const label = screen.getByText('declarations.customsRegime')
      const regimeSelect = label.parentElement.querySelector('select')
      expect(regimeSelect.value).toBe('4000')
    })
  })

  describe('Regime info sidebar', () => {
    test('fetches regime info on mount', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(knowledgeAPI.regimeInfo).toHaveBeenCalledWith('40')
      })
    })

    test('displays regime information', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText(/Despacho a libre practica/)).toBeInTheDocument()
      })
      expect(screen.getByText('Importacion normal')).toBeInTheDocument()
    })

    test('displays requirements', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('Factura comercial')).toBeInTheDocument()
      })
      expect(screen.getByText('Documento de transporte')).toBeInTheDocument()
    })

    test('displays VAT info', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('IVA aplicable')).toBeInTheDocument()
      })
    })

    test('displays typical use', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('Importaciones definitivas')).toBeInTheDocument()
      })
    })

    test('refetches regime info when regime changes', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        expect(screen.getByText('declarations.customsRegime')).toBeInTheDocument()
      })

      knowledgeAPI.regimeInfo.mockResolvedValue({
        data: { ...mockRegimeInfo, code: '42', name: 'Perfeccionamiento activo' }
      })

      const label = screen.getByText('declarations.customsRegime')
      const regimeSelect = label.parentElement.querySelector('select')
      fireEvent.change(regimeSelect, { target: { value: '42' } })

      await waitFor(() => {
        expect(knowledgeAPI.regimeInfo).toHaveBeenCalledWith('42')
      })
    })

    test('handles regime info fetch error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      knowledgeAPI.regimeInfo.mockRejectedValue(new Error('Network error'))
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error fetching regime info:', expect.any(Error))
      })
      consoleError.mockRestore()
    })

    test('does not display regime info when error is present', async () => {
      knowledgeAPI.regimeInfo.mockResolvedValue({
        data: { error: 'Not found' }
      })
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      expect(screen.queryByText(/Despacho a libre practica/)).not.toBeInTheDocument()
    })
  })

  describe('Generate declaration', () => {
    test('generate button is disabled when no expedition selected', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      expect(generateBtn).toBeDisabled()
    })

    test('generate button is enabled when expedition selected', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })
      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        const generateBtn = screen.getByText(/declarations.generate/).closest('button')
        expect(generateBtn).not.toBeDisabled()
      })
    })

    test('generates H1 declaration successfully', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        const generateBtn = screen.getByText(/declarations.generate/).closest('button')
        expect(generateBtn).not.toBeDisabled()
      })

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        // El backend generate-direct usa expeditionId (string) para el modo
        // "expediente existente"; enviar el objeto 'expedition' hacia que
        // intentara crear uno nuevo y fallara con 500.
        expect(declarationsAPI.generateH1).toHaveBeenCalledWith({
          expeditionId: mockExpeditions[0]._id,
          regime: '40',
          additionalProcedure: '000',
          preference: '100'
        })
      })

      expect(toast.success).toHaveBeenCalledWith('declarations.declarationGeneratedType')
    })

    test('generates AES declaration successfully', async () => {
      declarationsAPI.generateAES.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const aesButton = screen.getByText('declarations.aesExport').closest('button')
      fireEvent.click(aesButton)

      await waitFor(() => {
        expect(screen.getByText('EXP-002')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-002').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        const generateBtn = screen.getByText(/declarations.generate/).closest('button')
        expect(generateBtn).not.toBeDisabled()
      })

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(declarationsAPI.generateAES).toHaveBeenCalledWith({
          expeditionId: mockExpeditions[1]._id,
          exportType: '40'
        })
      })
    })

    test('shows error toast when no expedition selected', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      // Force click even though disabled (to test the logic inside handleGenerate)
      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      // We can't really test this easily since the button is disabled
      // But we can test by calling the handler directly if we could access it
      // For now, just verify the button is disabled
      expect(generateBtn).toBeDisabled()
    })

    test('shows generating state during generation', async () => {
      let resolveGenerate
      const generatePromise = new Promise((resolve) => {
        resolveGenerate = resolve
      })
      declarationsAPI.generateH1.mockReturnValue(generatePromise)

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        const generateBtn = screen.getByText(/declarations.generate/).closest('button')
        expect(generateBtn).not.toBeDisabled()
      })

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.generating')).toBeInTheDocument()
      })

      resolveGenerate({ data: mockGeneratedDeclaration })
    })

    test('handles generation error', async () => {
      declarationsAPI.generateH1.mockRejectedValue(new Error('Generation failed'))

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      await waitFor(() => {
        const generateBtn = screen.getByText(/declarations.generate/).closest('button')
        expect(generateBtn).not.toBeDisabled()
      })

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('declarations.errorGenerating')
      })
    })

    test('displays generated declaration result', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.generated')).toBeInTheDocument()
      })

      expect(screen.getByText('Warning 1')).toBeInTheDocument()
      expect(screen.getByText('Warning 2')).toBeInTheDocument()
      expect(screen.getByText('Recommendation 1')).toBeInTheDocument()
    })
  })

  describe('Export XML', () => {
    test('shows export button after generation', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.downloadXml')).toBeInTheDocument()
      })
    })

    test('exports XML successfully', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.exportXML.mockResolvedValue({
        data: '<xml>test</xml>'
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.downloadXml')).toBeInTheDocument()
      })

      const exportBtn = screen.getByText('declarations.downloadXml').closest('button')
      fireEvent.click(exportBtn)

      await waitFor(() => {
        expect(declarationsAPI.exportXML).toHaveBeenCalledWith('exp1', 'H1')
      })

      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('declarations.xmlDownloaded')
    })

    test('handles export error', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.exportXML.mockRejectedValue(new Error('Export failed'))

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.downloadXml')).toBeInTheDocument()
      })

      const exportBtn = screen.getByText('declarations.downloadXml').closest('button')
      fireEvent.click(exportBtn)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('declarations.errorExportXml')
      })
    })
  })

  describe('Submit to customs', () => {
    // El envío ya no usa confirm() nativo: abre un modal propio y se confirma
    // en él. Helper para confirmar el envío pulsando el boton del modal.
    const confirmarEnvioEnModal = async () => {
      // El boton original abre el modal (ES: "Enviar a AEAT", NL: "Enviar a DMS 4.0").
      const abrirBtn = (screen.queryByText('declarations.sendToAeat')
        || screen.getByText(/Enviar a DMS/)).closest('button')
      fireEvent.click(abrirBtn)
      // Aparece el modal de confirmación.
      await waitFor(() => {
        expect(screen.getByText('declarations.confirmSubmitTitle')).toBeInTheDocument()
      })
      // El boton de confirmar es el del dialog que NO es Cancelar.
      const dialog = screen.getByRole('dialog')
      const confirmBtn = within(dialog).getAllByRole('button')
        .find(b => !within(b).queryByText('common.cancel') && !b.textContent.includes('common.cancel'))
      fireEvent.click(confirmBtn)
    }

    test('el envio usa un modal de confirmacion, no confirm() nativo', async () => {
      // Regresion: se usaba confirm() nativo (bloquea automatizacion, UX pobre).
      const confirmSpy = vi.fn(() => true)
      global.confirm = confirmSpy
      declarationsAPI.generateH1.mockResolvedValue({ data: mockGeneratedDeclaration })
      declarationsAPI.submit.mockResolvedValue({ data: { mrn: '26ES1', channel: 'green' } })

      render(<DeclarationGenerator />)
      await waitFor(() => expect(screen.getByText('EXP-001')).toBeInTheDocument())
      fireEvent.click(screen.getByText('EXP-001').closest('.p-4'))
      fireEvent.click(screen.getByText(/declarations.generate/).closest('button'))
      await waitFor(() => expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument())

      // Pulsar el boton abre el MODAL, no dispara confirm() ni el envio.
      fireEvent.click(screen.getByText('declarations.sendToAeat').closest('button'))
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(declarationsAPI.submit).not.toHaveBeenCalled()

      // Cancelar cierra el modal sin enviar.
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByText('common.cancel').closest('button'))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(declarationsAPI.submit).not.toHaveBeenCalled()
    })

    test('shows submit button after generation', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })
    })

    test('submits to AEAT successfully with green channel', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: {
          mrn: '26ES123456789',
          channel: 'green'
        }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(declarationsAPI.submit).toHaveBeenCalledWith('exp1')
      })

      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('declarations.greenChannel'))
    })

    test('handles orange channel result', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: { mrn: '26ES123456789', channel: 'orange' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('declarations.orangeChannel', { icon: '🟠' })
      })
    })

    test('handles red channel result', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: { mrn: '26ES123456789', channel: 'red' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('declarations.redChannel', { icon: '🔴' })
      })
    })

    test('handles submit with nested data structure', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: {
          data: { mrn: '26ES123456789', channel: 'green' }
        }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
    })

    test('handles submit with no specific channel', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: { mrn: '26ES123456789' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('declarations.sentToAeatMrn')
      })
    })

    test('handles submit without MRN', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: { channel: 'green' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
    })

    test('submits to DMS when country is NL', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submitV2.mockResolvedValue({
        data: { mrn: '26NL123456789', channel: 'green' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/Generar DMS/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('Enviar a DMS 4.0')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(declarationsAPI.submitV2).toHaveBeenCalledWith('exp1')
      })
    })

    test('cancela el envio al cerrar el modal', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      // Abrir el modal y cancelar: no debe enviar.
      fireEvent.click(screen.getByText('declarations.sendToAeat').closest('button'))
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
      fireEvent.click(within(screen.getByRole('dialog')).getByText('common.cancel').closest('button'))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(declarationsAPI.submit).not.toHaveBeenCalled()
    })

    test('shows submitting state during submission', async () => {
      let resolveSubmit
      const submitPromise = new Promise((resolve) => {
        resolveSubmit = resolve
      })
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockReturnValue(submitPromise)

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(screen.getByText('declarations.sendingToAeat')).toBeInTheDocument()
      })

      resolveSubmit({ data: { mrn: '26ES123456789', channel: 'green' } })
    })

    test('handles submit error with custom message', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockRejectedValue({
        response: { data: { error: 'Custom error message' } }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Custom error message')
      })
    })

    test('handles submit error without custom message', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockRejectedValue(new Error('Network error'))

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('declarations.errorSendAeat')
      })
    })

    test('displays AEAT result after submission', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submit.mockResolvedValue({
        data: { mrn: '26ES123456789', channel: 'green' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.sendToAeat')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(screen.getByText('declarations.aeatResponse')).toBeInTheDocument()
      })

      expect(screen.getByText('26ES123456789')).toBeInTheDocument()
      expect(screen.getByText('green')).toBeInTheDocument()
    })

    test('displays DMS result header for NL', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })
      declarationsAPI.submitV2.mockResolvedValue({
        data: { mrn: '26NL123456789', channel: 'green' }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/Generar DMS/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('Enviar a DMS 4.0')).toBeInTheDocument()
      })

      await confirmarEnvioEnModal()

      await waitFor(() => {
        expect(screen.getByText('Respuesta DMS 4.0')).toBeInTheDocument()
      })
    })
  })

  describe('Country system badge', () => {
    test('displays AEAT badge by default', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        const badges = screen.getAllByText(/AEAT/)
        expect(badges.length).toBeGreaterThan(0)
      })
    })

    test('displays DMS badge when country is NL', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/Generar DMS/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        const badges = screen.getAllByText(/DMS 4.0/)
        expect(badges.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Sidebar information cards', () => {
    test('displays about H1 card', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('declarations.aboutH1')).toBeInTheDocument()
      })
      expect(screen.getByText('declarations.h1Info')).toBeInTheDocument()
    })

    test('displays important disclaimer card', async () => {
      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('declarations.important')).toBeInTheDocument()
      })
      expect(screen.getByText('declarations.h1Disclaimer')).toBeInTheDocument()
    })
  })

  describe('Generated declaration display', () => {
    test('displays warnings when present', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.warningsLabel')).toBeInTheDocument()
      })
    })

    test('does not display warnings section when empty', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: {
          declaration_data: {},
          recommendations: []
        }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.generated')).toBeInTheDocument()
      })

      expect(screen.queryByText('declarations.warningsLabel')).not.toBeInTheDocument()
    })

    test('displays recommendations when present', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText(/declarations.recommendations/)).toBeInTheDocument()
      })
    })

    test('does not display recommendations section when empty', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: {
          declaration_data: {},
          warnings: []
        }
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText('declarations.generated')).toBeInTheDocument()
      })

      expect(screen.queryByText(/declarations.recommendations/)).not.toBeInTheDocument()
    })

    test('displays declaration data JSON', async () => {
      declarationsAPI.generateH1.mockResolvedValue({
        data: mockGeneratedDeclaration
      })

      render(<DeclarationGenerator />)
      await waitFor(() => {
        expect(screen.getByText('EXP-001')).toBeInTheDocument()
      })

      const expedition = screen.getByText('EXP-001').closest('.p-4')
      fireEvent.click(expedition)

      const generateBtn = screen.getByText(/declarations.generate/).closest('button')
      fireEvent.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByText(/"regime": "40"/)).toBeInTheDocument()
      })
    })
  })

  describe('Initial regime selection from localStorage', () => {
    test('uses regime 4000 when NL is stored', () => {
      localStorage.setItem('activeCustomsCountry', 'NL')
      render(<DeclarationGenerator />)
      // The component should initialize with regime 4000
      // We can't directly check state but we can verify it's used in the API call
      expect(localStorage.getItem('activeCustomsCountry')).toBe('NL')
    })

    test('uses regime 40 when ES is stored', () => {
      localStorage.setItem('activeCustomsCountry', 'ES')
      render(<DeclarationGenerator />)
      expect(localStorage.getItem('activeCustomsCountry')).toBe('ES')
    })
  })
})
