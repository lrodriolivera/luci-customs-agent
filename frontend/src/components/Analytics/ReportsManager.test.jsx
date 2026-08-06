import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import ReportsManager from './ReportsManager'

// Mock API
vi.mock('../../services/api', () => ({
  analyticsAPI: {
    reports: {
      getTypes: vi.fn(),
      list: vi.fn(),
      generate: vi.fn(),
      schedule: vi.fn(),
      download: vi.fn(),
      delete: vi.fn()
    }
  }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

import { analyticsAPI } from '../../services/api'
import { toast } from 'react-hot-toast'

describe('ReportsManager', () => {
  const mockReportTypes = [
    { type: 'executive_summary', name: 'Resumen Ejecutivo', description: 'Resumen general de operaciones' },
    { type: 'operations_detail', name: 'Detalle de Operaciones', description: 'Análisis detallado de operaciones' },
    { type: 'financial_report', name: 'Informe Financiero', description: 'Estado financiero y costos' },
    { type: 'compliance_report', name: 'Cumplimiento Normativo', description: 'Cumplimiento de regulaciones' },
    { type: 'declaration_report', name: 'Declaraciones', description: 'Reporte de declaraciones' }
  ]

  const mockReports = [
    {
      id: 'report-1',
      title: 'Reporte Q1',
      type: 'executive_summary',
      period: 'last_30_days',
      format: 'pdf',
      generatedAt: '2026-08-01T10:30:00Z'
    },
    {
      id: 'report-2',
      title: null,
      type: 'financial_report',
      period: 'this_month',
      format: 'xlsx',
      generatedAt: '2026-08-02T14:20:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Default successful responses
    analyticsAPI.reports.getTypes.mockResolvedValue({
      data: { success: true, types: mockReportTypes }
    })
    analyticsAPI.reports.list.mockResolvedValue({
      data: { success: true, reports: [] }
    })
  })

  describe('Initial Render & Loading', () => {
    it('renders loading spinner when loading and reports are empty', () => {
      analyticsAPI.reports.list.mockImplementation(() => new Promise(() => {}))
      render(<ReportsManager />)
      const spinnerContainer = document.querySelector('.animate-spin')
      expect(spinnerContainer).toBeInTheDocument()
    })

    it('renders header with title after loading', async () => {
      render(<ReportsManager />)
      const heading = await screen.findByText('analyticsPage.reportsManager')
      expect(heading).toBeInTheDocument()
    })

    it('renders generate and schedule buttons', async () => {
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      expect(screen.getByText('analyticsPage.generateReport')).toBeInTheDocument()
      expect(screen.getByText('analyticsPage.schedule')).toBeInTheDocument()
    })

    it('calls loadReportTypes and loadReports on mount', async () => {
      render(<ReportsManager />)
      await waitFor(() => {
        expect(analyticsAPI.reports.getTypes).toHaveBeenCalledTimes(1)
        expect(analyticsAPI.reports.list).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Empty State', () => {
    it('renders empty state when no reports', async () => {
      render(<ReportsManager />)
      const emptyMessage = await screen.findByText('analyticsPage.noReports')
      expect(emptyMessage).toBeInTheDocument()
      expect(screen.getByText('analyticsPage.noReportsHint')).toBeInTheDocument()
    })
  })

  describe('Reports List', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: mockReports }
      })
    })

    it('renders reports in table', async () => {
      render(<ReportsManager />)
      const reportTitle = await screen.findByText('Reporte Q1')
      expect(reportTitle).toBeInTheDocument()
      expect(screen.getByText('report-1')).toBeInTheDocument()
    })

    it('renders report without custom title using type name', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const financialReports = screen.getAllByText('Informe Financiero')
      expect(financialReports.length).toBeGreaterThan(0)
    })

    it('renders report format with uppercase class', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      // Format values are 'pdf' and 'xlsx' in text, but rendered with uppercase CSS class
      const tableBody = document.querySelector('tbody')
      expect(tableBody.textContent).toMatch(/pdf|xlsx/)
      // Check that the span has uppercase class
      const formatSpans = document.querySelectorAll('.uppercase')
      expect(formatSpans.length).toBeGreaterThan(0)
    })

    it('renders report period label', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      expect(screen.getByText('Ultimos 30 dias')).toBeInTheDocument()
    })

    it('renders formatted date', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const dateCells = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/)
      expect(dateCells.length).toBeGreaterThanOrEqual(1)
    })

    it('renders download and delete buttons for each report', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const deleteButtons = screen.getAllByTitle('Eliminar')
      const downloadButtons = screen.getAllByTitle('Descargar')
      expect(deleteButtons).toHaveLength(2)
      expect(downloadButtons).toHaveLength(2)
    })
  })

  describe('Quick Generate Cards', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: [] }
      })
    })

    it('renders first 4 report types as quick cards', async () => {
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const resumenCards = screen.getAllByText('Resumen Ejecutivo')
      expect(resumenCards.length).toBeGreaterThan(0)
      const operationsCards = screen.getAllByText('Detalle de Operaciones')
      expect(operationsCards.length).toBeGreaterThan(0)
      const financialCards = screen.getAllByText('Informe Financiero')
      expect(financialCards.length).toBeGreaterThan(0)
      const complianceCards = screen.getAllByText('Cumplimiento Normativo')
      expect(complianceCards.length).toBeGreaterThan(0)
      // Declaraciones is the 5th type, should not appear in quick cards (first 4 only)
    })

    it('opens generate modal when quick card clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const cards = screen.getAllByText('Resumen Ejecutivo')
      const card = cards[0].closest('button')
      await user.click(card)
      expect(await screen.findByText('Generar Informe')).toBeInTheDocument()
    })

    it('pre-selects report type when quick card clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const cards = screen.getAllByText('Informe Financiero')
      const card = cards[0].closest('button')
      await user.click(card)
      await screen.findByText('Generar Informe')
      const selectedButtons = screen.getAllByText('Informe Financiero')
      const modalButton = selectedButtons.find(el => el.closest('.fixed'))
      expect(modalButton.closest('button')).toHaveClass('border-luci')
    })
  })

  describe('Filters', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: mockReports }
      })
    })

    it('filters reports by search term in title', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const searchInput = screen.getByPlaceholderText('analyticsPage.searchReports')
      fireEvent.change(searchInput, { target: { value: 'Q1' } })
      await waitFor(() => {
        expect(screen.getByText('Reporte Q1')).toBeInTheDocument()
        expect(screen.queryByText('report-2')).not.toBeInTheDocument()
      })
    })

    it('filters reports by search term in type', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const searchInput = screen.getByPlaceholderText('analyticsPage.searchReports')
      fireEvent.change(searchInput, { target: { value: 'financial' } })
      await waitFor(() => {
        expect(screen.queryByText('Reporte Q1')).not.toBeInTheDocument()
        expect(screen.getByText('report-2')).toBeInTheDocument()
      })
    })

    it('filters reports by type selector', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const typeSelect = screen.getByDisplayValue('common.allTypes')
      fireEvent.change(typeSelect, { target: { value: 'executive_summary' } })
      await waitFor(() => {
        expect(screen.getByText('Reporte Q1')).toBeInTheDocument()
        expect(screen.queryByText('report-2')).not.toBeInTheDocument()
      })
    })

    it('combines search and type filters', async () => {
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const searchInput = screen.getByPlaceholderText('analyticsPage.searchReports')
      const typeSelect = screen.getByDisplayValue('common.allTypes')
      fireEvent.change(searchInput, { target: { value: 'reporte' } })
      fireEvent.change(typeSelect, { target: { value: 'financial_report' } })
      await waitFor(() => {
        expect(screen.queryByText('Reporte Q1')).not.toBeInTheDocument()
        expect(screen.queryByText('report-2')).not.toBeInTheDocument()
        expect(screen.getByText('analyticsPage.noReports')).toBeInTheDocument()
      })
    })

    it('renders all types in filter selector', async () => {
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const typeSelect = screen.getByDisplayValue('common.allTypes')
      const options = Array.from(typeSelect.querySelectorAll('option'))
      expect(options).toHaveLength(6) // "All types" + 5 report types
    })

    it('calls loadReports when refresh button clicked', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.list.mockResolvedValue({ data: { success: true, reports: [] } })
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const refreshButton = screen.getByTitle('Actualizar')
      await user.click(refreshButton)
      await waitFor(() => {
        expect(analyticsAPI.reports.list).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Generate Modal', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: [] }
      })
    })

    it('opens modal when generate button clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const generateBtn = screen.getByText('analyticsPage.generateReport')
      await user.click(generateBtn)
      expect(await screen.findByText('Generar Informe')).toBeInTheDocument()
    })

    it('closes modal when X button clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const allButtons = screen.getAllByRole('button')
      const closeButton = allButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.closest('.fixed') && btn.classList.contains('p-2')
      })
      await user.click(closeButton)
      await waitFor(() => {
        expect(screen.queryByText('Generar Informe')).not.toBeInTheDocument()
      })
    })

    it('closes modal when Cancelar button clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      await user.click(screen.getByText('Cancelar'))
      await waitFor(() => {
        expect(screen.queryByText('Generar Informe')).not.toBeInTheDocument()
      })
    })

    it('renders all report type buttons in modal', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      // All 5 types should appear in the modal (not just first 4 like in quick cards)
      const allResumen = screen.getAllByText('Resumen Ejecutivo')
      expect(allResumen.length).toBeGreaterThan(0)
      const allDeclaraciones = screen.getAllByText('Declaraciones')
      expect(allDeclaraciones.length).toBeGreaterThan(0)
    })

    it('selects report type when clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)
      expect(modalButton.closest('button')).toHaveClass('border-luci')
    })

    it('allows entering custom title', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const titleInput = screen.getByPlaceholderText('Titulo personalizado...')
      fireEvent.change(titleInput, { target: { value: 'Mi Reporte Custom' } })
      expect(titleInput.value).toBe('Mi Reporte Custom')
    })

    it('allows selecting period', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const periodSelect = screen.getByDisplayValue('Ultimos 30 dias')
      fireEvent.change(periodSelect, { target: { value: 'this_month' } })
      expect(periodSelect.value).toBe('this_month')
    })

    it('renders all period options', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const periodSelect = screen.getByDisplayValue('Ultimos 30 dias')
      const options = Array.from(periodSelect.querySelectorAll('option'))
      expect(options).toHaveLength(8)
    })

    it('allows selecting format', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const xlsxButton = screen.getByText('Excel').closest('button')
      await user.click(xlsxButton)
      expect(xlsxButton).toHaveClass('border-luci')
    })

    it('renders all format options', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      expect(screen.getByText('PDF')).toBeInTheDocument()
      expect(screen.getByText('Excel')).toBeInTheDocument()
      expect(screen.getByText('CSV')).toBeInTheDocument()
      expect(screen.getByText('JSON')).toBeInTheDocument()
    })

    it('renders LUCI analysis checkbox checked by default', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const checkbox = screen.getByLabelText(/Incluir analisis de LUCI/)
      expect(checkbox).toBeChecked()
    })

    it('toggles LUCI analysis checkbox', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const checkbox = screen.getByLabelText(/Incluir analisis de LUCI/)
      await user.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })
  })

  describe('Generate Report Handler', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: [] }
      })
      analyticsAPI.reports.generate.mockResolvedValue({
        data: { success: true }
      })
    })

    it('disables generate button when no type selected', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')
      const generateButton = screen.getByText('Generar').closest('button')
      expect(generateButton).toBeDisabled()
    })

    it('calls generate with correct payload on success', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const titleInput = screen.getByPlaceholderText('Titulo personalizado...')
      fireEvent.change(titleInput, { target: { value: 'Test Report' } })

      const periodSelect = screen.getByDisplayValue('Ultimos 30 dias')
      fireEvent.change(periodSelect, { target: { value: 'this_month' } })

      const xlsxButton = screen.getByText('Excel').closest('button')
      await user.click(xlsxButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.generate).toHaveBeenCalledWith({
          type: 'executive_summary',
          period: 'this_month',
          format: 'xlsx',
          title: 'Test Report',
          includeLuciAnalysis: true
        })
      })
    })

    it('sends undefined title when empty', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.generate).toHaveBeenCalledWith({
          type: 'executive_summary',
          period: 'last_30_days',
          format: 'pdf',
          title: undefined,
          includeLuciAnalysis: true
        })
      })
    })

    it('includes LUCI analysis when checked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.generate.mock.calls[0][0].includeLuciAnalysis).toBe(true)
      })
    })

    it('excludes LUCI analysis when unchecked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const checkbox = screen.getByLabelText(/Incluir analisis de LUCI/)
      await user.click(checkbox)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.generate.mock.calls[0][0].includeLuciAnalysis).toBe(false)
      })
    })

    it('shows success toast and closes modal on successful generation', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('analyticsPage.reportGenerated')
        expect(screen.queryByText('Generar Informe')).not.toBeInTheDocument()
      })
    })

    it('reloads reports after successful generation', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')

      vi.clearAllMocks()

      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.list).toHaveBeenCalled()
      })
    })

    it('shows error when response.data.success is false', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.generate.mockResolvedValue({
        data: { success: false, error: 'Custom error message' }
      })
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Custom error message')
      })
    })

    it('shows generic error when response.data.success false without error message', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.generate.mockResolvedValue({
        data: { success: false }
      })
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error generando informe')
      })
    })

    it('handles API error with catch block', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.generate.mockRejectedValue(new Error('Network error'))
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('analyticsPage.errorGeneratingReport')
      })
    })

    it('shows loading state during generation', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.generate.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100)))
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const generateButton = screen.getByText('Generar').closest('button')
      await user.click(generateButton)

      expect(await screen.findByText('Generando...')).toBeInTheDocument()
    })

    it('resets form after closing modal', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const typeButtons = screen.getAllByText('Resumen Ejecutivo')
      const modalButton = typeButtons.find(el => el.closest('.fixed'))
      await user.click(modalButton)

      const titleInput = screen.getByPlaceholderText('Titulo personalizado...')
      fireEvent.change(titleInput, { target: { value: 'Test' } })

      await user.click(screen.getByText('Cancelar'))
      await waitFor(() => {
        expect(screen.queryByText('Generar Informe')).not.toBeInTheDocument()
      })

      await user.click(screen.getByText('analyticsPage.generateReport'))
      await screen.findByText('Generar Informe')

      const freshTitleInput = screen.getByPlaceholderText('Titulo personalizado...')
      expect(freshTitleInput.value).toBe('')
    })
  })

  describe('Schedule Modal', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: [] }
      })
      analyticsAPI.reports.schedule.mockResolvedValue({
        data: { success: true }
      })
    })

    it('opens schedule modal when schedule button clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      expect(await screen.findByText('Programar Informe')).toBeInTheDocument()
    })

    it('closes schedule modal when X clicked', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      const allButtons = screen.getAllByRole('button')
      const xButton = allButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.closest('.fixed') && btn.classList.contains('p-2')
      })
      await user.click(xButton)
      await waitFor(() => {
        expect(screen.queryByText('Programar Informe')).not.toBeInTheDocument()
      })
    })

    it('renders type selector with placeholder', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      expect(screen.getByDisplayValue('Seleccionar tipo...')).toBeInTheDocument()
    })

    it('renders frequency selector with default weekly', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      expect(screen.getByDisplayValue('Semanal')).toBeInTheDocument()
    })

    it('shows day of week selector when frequency is weekly', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      expect(screen.getByDisplayValue('Lunes')).toBeInTheDocument()
    })

    it('shows day of month selector when frequency is monthly', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      const freqSelect = screen.getByDisplayValue('Semanal')
      fireEvent.change(freqSelect, { target: { value: 'monthly' } })
      await waitFor(() => {
        const daySelect = screen.getByDisplayValue('1')
        expect(daySelect.querySelectorAll('option')).toHaveLength(28)
      })
    })

    it('hides day selector when frequency is daily', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      const freqSelect = screen.getByDisplayValue('Semanal')
      fireEvent.change(freqSelect, { target: { value: 'daily' } })
      await waitFor(() => {
        expect(screen.queryByDisplayValue('Lunes')).not.toBeInTheDocument()
      })
    })

    it('renders time input with default 08:00', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      const timeInput = screen.getByDisplayValue('08:00')
      expect(timeInput).toBeInTheDocument()
    })

    it('renders recipients input', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      expect(screen.getByPlaceholderText('email1@example.com, email2@example.com')).toBeInTheDocument()
    })

    it('renders format selector in schedule modal', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      const formatSelect = screen.getAllByDisplayValue(/PDF/)[0]
      expect(formatSelect).toBeInTheDocument()
    })
  })

  describe('Schedule Report Handler', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: [] }
      })
      analyticsAPI.reports.schedule.mockResolvedValue({
        data: { success: true }
      })
    })

    it('disables schedule button when no type selected', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')
      const programarButton = screen.getByText('Programar').closest('button')
      expect(programarButton).toBeDisabled()
    })

    it('calls schedule with weekly payload', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')

      const typeSelect = screen.getByDisplayValue('Seleccionar tipo...')
      fireEvent.change(typeSelect, { target: { value: 'financial_report' } })

      const recipientsInput = screen.getByPlaceholderText('email1@example.com, email2@example.com')
      fireEvent.change(recipientsInput, { target: { value: 'user@test.com, admin@test.com' } })

      const programarButton = screen.getByText('Programar').closest('button')
      await user.click(programarButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.schedule).toHaveBeenCalledWith({
          type: 'financial_report',
          frequency: 'weekly',
          dayOfWeek: 1,
          dayOfMonth: undefined,
          time: '08:00',
          format: 'pdf',
          recipients: ['user@test.com', 'admin@test.com'],
          options: { includeLuciAnalysis: true }
        })
      })
    })

    it('calls schedule with monthly payload', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')

      const typeSelect = screen.getByDisplayValue('Seleccionar tipo...')
      fireEvent.change(typeSelect, { target: { value: 'compliance_report' } })

      const freqSelect = screen.getByDisplayValue('Semanal')
      fireEvent.change(freqSelect, { target: { value: 'monthly' } })

      const daySelect = screen.getByDisplayValue('1')
      fireEvent.change(daySelect, { target: { value: '15' } })

      const recipientsInput = screen.getByPlaceholderText('email1@example.com, email2@example.com')
      fireEvent.change(recipientsInput, { target: { value: 'test@example.com' } })

      const programarButton = screen.getByText('Programar').closest('button')
      await user.click(programarButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.schedule).toHaveBeenCalledWith({
          type: 'compliance_report',
          frequency: 'monthly',
          dayOfWeek: undefined,
          dayOfMonth: 15,
          time: '08:00',
          format: 'pdf',
          recipients: ['test@example.com'],
          options: { includeLuciAnalysis: true }
        })
      })
    })

    it('filters empty recipients', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')

      const typeSelect = screen.getByDisplayValue('Seleccionar tipo...')
      fireEvent.change(typeSelect, { target: { value: 'executive_summary' } })

      const recipientsInput = screen.getByPlaceholderText('email1@example.com, email2@example.com')
      fireEvent.change(recipientsInput, { target: { value: 'user@test.com,  , , admin@test.com' } })

      const programarButton = screen.getByText('Programar').closest('button')
      await user.click(programarButton)

      await waitFor(() => {
        expect(analyticsAPI.reports.schedule.mock.calls[0][0].recipients).toEqual(['user@test.com', 'admin@test.com'])
      })
    })

    it('shows success toast and closes modal on successful schedule', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')

      const typeSelect = screen.getByDisplayValue('Seleccionar tipo...')
      fireEvent.change(typeSelect, { target: { value: 'executive_summary' } })

      const programarButton = screen.getByText('Programar').closest('button')
      await user.click(programarButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Informe programado correctamente')
        expect(screen.queryByText('Programar Informe')).not.toBeInTheDocument()
      })
    })

    it('shows error when response.data.success is false', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.schedule.mockResolvedValue({
        data: { success: false, error: 'Schedule error' }
      })
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')

      const typeSelect = screen.getByDisplayValue('Seleccionar tipo...')
      fireEvent.change(typeSelect, { target: { value: 'executive_summary' } })

      const programarButton = screen.getByText('Programar').closest('button')
      await user.click(programarButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Schedule error')
      })
    })

    it('handles API error with catch block', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.schedule.mockRejectedValue(new Error('Network'))
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      await user.click(screen.getByText('analyticsPage.schedule'))
      await screen.findByText('Programar Informe')

      const typeSelect = screen.getByDisplayValue('Seleccionar tipo...')
      fireEvent.change(typeSelect, { target: { value: 'executive_summary' } })

      const programarButton = screen.getByText('Programar').closest('button')
      await user.click(programarButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error programando informe')
      })
    })
  })

  describe('Download Report Handler', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: mockReports }
      })
      analyticsAPI.reports.download.mockResolvedValue({ data: {} })
    })

    it('calls download API with correct params', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const downloadButtons = screen.getAllByTitle('Descargar')
      await user.click(downloadButtons[0])
      await waitFor(() => {
        expect(analyticsAPI.reports.download).toHaveBeenCalledWith('report-1', 'pdf')
      })
    })

    it('shows success toast on download', async () => {
      const user = userEvent.setup()
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const downloadButtons = screen.getAllByTitle('Descargar')
      await user.click(downloadButtons[0])
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Descarga iniciada')
      })
    })

    it('handles download error', async () => {
      const user = userEvent.setup()
      analyticsAPI.reports.download.mockRejectedValue(new Error('Download failed'))
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const downloadButtons = screen.getAllByTitle('Descargar')
      await user.click(downloadButtons[0])
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error descargando informe')
      })
    })
  })

  describe('Delete Report Handler', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: mockReports }
      })
      analyticsAPI.reports.delete.mockResolvedValue({
        data: { success: true }
      })
    })

    it('does not delete when confirm returns false', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const deleteButtons = screen.getAllByTitle('Eliminar')
      await user.click(deleteButtons[0])
      expect(analyticsAPI.reports.delete).not.toHaveBeenCalled()
    })

    it('calls delete API when confirm returns true', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const deleteButtons = screen.getAllByTitle('Eliminar')
      await user.click(deleteButtons[0])
      await waitFor(() => {
        expect(analyticsAPI.reports.delete).toHaveBeenCalledWith('report-1')
      })
    })

    it('shows success toast and reloads reports on successful delete', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      vi.clearAllMocks()
      const deleteButtons = screen.getAllByTitle('Eliminar')
      await user.click(deleteButtons[0])
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Informe eliminado')
        expect(analyticsAPI.reports.list).toHaveBeenCalled()
      })
    })

    it('handles delete error', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      analyticsAPI.reports.delete.mockRejectedValue(new Error('Delete failed'))
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const deleteButtons = screen.getAllByTitle('Eliminar')
      await user.click(deleteButtons[0])
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error eliminando informe')
      })
    })

    it('shows confirm dialog with correct message', async () => {
      const user = userEvent.setup()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<ReportsManager />)
      await screen.findByText('Reporte Q1')
      const deleteButtons = screen.getAllByTitle('Eliminar')
      await user.click(deleteButtons[0])
      expect(confirmSpy).toHaveBeenCalledWith('¿Eliminar este informe?')
    })
  })

  describe('getReportTypeName', () => {
    beforeEach(() => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: {
          success: true,
          reports: [
            { id: 'r1', type: 'executive_summary', title: null, period: 'today', format: 'pdf', generatedAt: '2026-08-01T10:00:00Z' },
            { id: 'r2', type: 'unknown_type', title: null, period: 'today', format: 'pdf', generatedAt: '2026-08-01T10:00:00Z' }
          ]
        }
      })
    })

    it('returns type name when found in reportTypes', async () => {
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const matches = await screen.findAllByText('Resumen Ejecutivo')
      expect(matches.length).toBeGreaterThan(0)
    })

    it('returns type string when not found in reportTypes', async () => {
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const matches = await screen.findAllByText('unknown_type')
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  describe('loadReports error handling', () => {
    it('shows error toast when loadReports fails', async () => {
      analyticsAPI.reports.list.mockRejectedValue(new Error('Load failed'))
      render(<ReportsManager />)
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('analyticsPage.errorLoadingReports')
      })
    })

    it('sets loading to false after error', async () => {
      analyticsAPI.reports.list.mockRejectedValue(new Error('Load failed'))
      render(<ReportsManager />)
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin')
        expect(spinner).not.toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles empty reportTypes array', async () => {
      analyticsAPI.reports.getTypes.mockResolvedValue({
        data: { success: true, types: [] }
      })
      analyticsAPI.reports.list.mockResolvedValue({
        data: { success: true, reports: [] }
      })
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const quickCards = document.querySelectorAll('.card.hover\\:border-luci')
      expect(quickCards).toHaveLength(0)
    })

    it('handles search term with special characters', async () => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: {
          success: true,
          reports: [{ id: 'r1', title: 'Test (special)', type: 'executive_summary', period: 'today', format: 'pdf', generatedAt: '2026-08-01T10:00:00Z' }]
        }
      })
      render(<ReportsManager />)
      await screen.findByText('Test (special)')
      const searchInput = screen.getByPlaceholderText('analyticsPage.searchReports')
      fireEvent.change(searchInput, { target: { value: '(special)' } })
      await waitFor(() => {
        expect(screen.getByText('Test (special)')).toBeInTheDocument()
      })
    })

    it('handles reports with null title', async () => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: {
          success: true,
          reports: [{ id: 'r1', title: null, type: 'executive_summary', period: 'today', format: 'pdf', generatedAt: '2026-08-01T10:00:00Z' }]
        }
      })
      render(<ReportsManager />)
      await screen.findByText('analyticsPage.reportsManager')
      const matches = await screen.findAllByText('Resumen Ejecutivo')
      expect(matches.length).toBeGreaterThan(0)
    })

    it('handles period not in PERIOD_OPTIONS', async () => {
      analyticsAPI.reports.list.mockResolvedValue({
        data: {
          success: true,
          reports: [{ id: 'r1', title: 'Test', type: 'executive_summary', period: 'custom_period', format: 'pdf', generatedAt: '2026-08-01T10:00:00Z' }]
        }
      })
      render(<ReportsManager />)
      await screen.findByText('Test')
      expect(screen.getByText('custom_period')).toBeInTheDocument()
    })
  })
})
