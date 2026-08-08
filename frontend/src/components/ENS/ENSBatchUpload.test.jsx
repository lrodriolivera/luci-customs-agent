import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ENSBatchUpload from './ENSBatchUpload'
import { ensAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('../../services/api', () => ({
  ensAPI: {
    processBatch: vi.fn()
  }
}))

describe('ENSBatchUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL for jsdom
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog visibility', () => {
    it('renders dialog content when open=true', () => {
      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
      expect(screen.getByText('ens.batchTitle')).toBeInTheDocument()
      expect(screen.getByText('ens.stepUpload')).toBeInTheDocument()
    })

    it('does not render dialog content when open=false', () => {
      const { container } = render(<ENSBatchUpload open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
      // MUI Dialog renders but hides content when closed
      expect(screen.queryByText('ens.dragOrClick')).not.toBeInTheDocument()
    })
  })

  describe('Step 0: Upload', () => {
    it('renders upload step with file input and template download button', () => {
      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('accept', '.csv,.txt')

      expect(screen.getByText('ens.downloadTemplate')).toBeInTheDocument()
      expect(screen.getByText('ens.dragOrClick')).toBeInTheDocument()
      expect(screen.getByText('ens.csvFormat')).toBeInTheDocument()
    })

    it('downloads CSV template when button clicked', async () => {
      // Mock document.createElement('a') and its click
      const originalCreateElement = document.createElement.bind(document)
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      }
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') return mockLink
        return originalCreateElement(tag)
      })

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const downloadButton = screen.getByText('ens.downloadTemplate')
      fireEvent.click(downloadButton)

      // Wait for async operations
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      })

      expect(mockLink.click).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')

      createElementSpy.mockRestore()
    })

    it('calls onClose when cancel button clicked', () => {
      const onClose = vi.fn()
      render(<ENSBatchUpload open={true} onClose={onClose} onSuccess={vi.fn()} />)

      const cancelButton = screen.getByText('common.cancel')
      fireEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('File parsing', () => {
    it('parses valid CSV file and moves to validation step', async () => {
      const csvContent = `transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName
ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;1234ABC;ES;BLEXAMPLE001;MSKU1234567;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })

      // Ensure File.prototype.text exists in jsdom
      if (!file.text) {
        file.text = () => Promise.resolve(csvContent)
      }

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      // Wait for parsing and validation
      await waitFor(() => {
        expect(screen.getByText('common.total')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Should be on step 1 (validate)
      // Use getAllByText since the text appears in both summary card and row chip
      const validElements = screen.getAllByText('ens.batchValid')
      expect(validElements.length).toBeGreaterThan(0)
      expect(screen.getByText('ens.mode')).toBeInTheDocument()
    })

    it('throws error when file has less than 2 lines (header only)', async () => {
      const csvContent = `transportMode;entryOfficeCode;expectedArrivalDate`
      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })

      if (!file.text) {
        file.text = () => Promise.resolve(csvContent)
      }

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled()
      })

      consoleError.mockRestore()
    })
  })

  describe('Validation - all branches', () => {
    const createCsvWithRow = (row) => {
      const headers = `transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName`
      return `${headers}\n${row}`
    }

    it('validates row with empty transportMode defaults to ROAD (valid)', async () => {
      // When transportMode is empty, transformRowToDeclaration sets it to 'ROAD' (line 118)
      // So the validation passes as valid
      const csvContent = createCsvWithRow(`;ES001101;2025-01-25;08:00;ESA12345678;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        // Should show valid count > 0
        const validCards = screen.getAllByText('ens.batchValid')
        expect(validCards.length).toBeGreaterThan(0)
      })

      // Check that the cell shows 'ROAD' (default)
      expect(screen.getByText('ROAD')).toBeInTheDocument()
    })

    it('validates row with invalid transportMode (error)', async () => {
      const csvContent = createCsvWithRow(`INVALID;ES001101;2025-01-25;08:00;ESA12345678;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const errorCards = screen.getAllByText('ens.batchErrors')
        expect(errorCards.length).toBeGreaterThan(0)
      })

      // Check that error icon is present (data-testid=ErrorIcon)
      const errorIcon = screen.getByTestId('ErrorIcon')
      expect(errorIcon).toBeInTheDocument()
    })

    it('validates row with missing entryOfficeCode (error)', async () => {
      const csvContent = createCsvWithRow(`ROAD;;2025-01-25;08:00;ESA12345678;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const errorCards = screen.getAllByText('ens.batchErrors')
        expect(errorCards.length).toBeGreaterThan(0)
      })
    })

    it('validates row with badly formatted entryOfficeCode (warning)', async () => {
      const csvContent = createCsvWithRow(`ROAD;BADCODE;2025-01-25;08:00;ESA12345678;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const warningCards = screen.getAllByText('ens.batchWarnings')
        expect(warningCards.length).toBeGreaterThan(0)
      })

      // Check that warning icon is present
      const warningIcon = screen.getByTestId('WarningIcon')
      expect(warningIcon).toBeInTheDocument()
    })

    it('validates row with missing expectedArrival (error)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;;;ESA12345678;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const errorCards = screen.getAllByText('ens.batchErrors')
        expect(errorCards.length).toBeGreaterThan(0)
      })
    })

    it('validates row with missing carrierEORI (error)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;2025-01-25;08:00;;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const errorCards = screen.getAllByText('ens.batchErrors')
        expect(errorCards.length).toBeGreaterThan(0)
      })
    })

    it('validates row with badly formatted carrierEORI (warning)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;2025-01-25;08:00;BADFORMAT;Carrier;;ES;BLEXAMPLE001;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const warningCards = screen.getAllByText('ens.batchWarnings')
        expect(warningCards.length).toBeGreaterThan(0)
      })
    })

    it('validates row with missing billOfLading (error)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;;ES;;;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const errorCards = screen.getAllByText('ens.batchErrors')
        expect(errorCards.length).toBeGreaterThan(0)
      })
    })

    it('validates row with zero grossMass (error)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;;ES;BLEXAMPLE001;;SEAL001;0;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const errorCards = screen.getAllByText('ens.batchErrors')
        expect(errorCards.length).toBeGreaterThan(0)
      })
    })

    it('validates row with badly formatted containerNumber (warning)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;;ES;BLEXAMPLE001;BADCONTAINER;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const warningCards = screen.getAllByText('ens.batchWarnings')
        expect(warningCards.length).toBeGreaterThan(0)
      })
    })

    it('validates completely valid row (status=valid)', async () => {
      const csvContent = createCsvWithRow(`ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;1234ABC;ES;BLEXAMPLE001;MSKU1234567;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`)

      const file = new File([csvContent], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csvContent)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        // Use getAllByText since appears in summary card and row chip
        const validElements = screen.getAllByText('ens.batchValid')
        expect(validElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Step 1: Validation interactions', () => {
    const validCsv = `transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName
ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;1234ABC;ES;BL001;MSKU1234567;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer
AIR;ES001102;2025-01-26;09:00;ESA22222222;Carrier2;5678DEF;ES;BL002;ABCD9876543;SEAL002;10000;50;Goods2;ESB77777777;Exporter2;ESC22222222;Importer2`

    it('toggles autoSubmit checkbox', async () => {
      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.autoSubmit')).toBeInTheDocument()
      })

      const autoSubmitCheckbox = screen.getByLabelText('ens.autoSubmit')
      expect(autoSubmitCheckbox).not.toBeChecked()

      fireEvent.click(autoSubmitCheckbox)
      expect(autoSubmitCheckbox).toBeChecked()

      fireEvent.click(autoSubmitCheckbox)
      expect(autoSubmitCheckbox).not.toBeChecked()
    })

    it('selects all rows when header checkbox clicked', async () => {
      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]')
        expect(checkboxes.length).toBeGreaterThan(2) // header + rows + autoSubmit
      })

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      const headerCheckbox = checkboxes[0] // First checkbox in table head

      // All rows are selected by default
      expect(headerCheckbox).toBeChecked()

      // Unselect all
      fireEvent.click(headerCheckbox)
      expect(headerCheckbox).not.toBeChecked()

      // Select all again
      fireEvent.click(headerCheckbox)
      expect(headerCheckbox).toBeChecked()
    })

    it('toggles individual row selection', async () => {
      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]')
        expect(checkboxes.length).toBeGreaterThan(2)
      })

      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      const firstRowCheckbox = checkboxes[1] // Second checkbox (first row)

      expect(firstRowCheckbox).toBeChecked()

      fireEvent.click(firstRowCheckbox)
      expect(firstRowCheckbox).not.toBeChecked()

      fireEvent.click(firstRowCheckbox)
      expect(firstRowCheckbox).toBeChecked()
    })

    it('shows process button with correct count', async () => {
      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        // t('ens.processDeclarations', { count: ... }) renders as the key with interpolation
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })
    })

    it('resets to upload step when load another file clicked', async () => {
      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.loadAnotherFile')).toBeInTheDocument()
      })

      const resetButton = screen.getByText('ens.loadAnotherFile')
      fireEvent.click(resetButton)

      // Should be back to step 0
      expect(screen.getByText('ens.dragOrClick')).toBeInTheDocument()
    })
  })

  describe('Step 2: Processing', () => {
    const validCsv = `transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName
ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;1234ABC;ES;BL001;MSKU1234567;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer`

    it('returns early when no rows are selected', async () => {
      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })

      // Deselect all rows
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      const headerCheckbox = checkboxes[0]
      fireEvent.click(headerCheckbox)

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      // Should not call API
      expect(ensAPI.processBatch).not.toHaveBeenCalled()
    })

    it('processes selected rows successfully', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            successful: 1,
            total: 1,
            failed: 0,
            results: [
              {
                success: true,
                reference: 'BL001',
                mrn: '25ES000001234567890',
                message: 'Declaration created successfully'
              }
            ]
          }
        }
      })

      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      // Should show processing state
      await waitFor(() => {
        expect(screen.getByText('ens.processingDeclarations')).toBeInTheDocument()
      })

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('ens.processingComplete')).toBeInTheDocument()
      })

      expect(ensAPI.processBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            transportMode: 'ROAD',
            entryOffice: expect.objectContaining({
              code: 'ES001101'
            })
          })
        ]),
        false // autoSubmit default
      )

      // Check success message with interpolated count
      expect(screen.getByText('ens.processedCount')).toBeInTheDocument()
    })

    it('processes with autoSubmit=true when checkbox checked', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            successful: 1,
            total: 1,
            failed: 0,
            results: [{ success: true, reference: 'BL001', mrn: '25ES000001234567890' }]
          }
        }
      })

      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByLabelText('ens.autoSubmit')).toBeInTheDocument()
      })

      const autoSubmitCheckbox = screen.getByLabelText('ens.autoSubmit')
      fireEvent.click(autoSubmitCheckbox)

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      await waitFor(() => {
        expect(ensAPI.processBatch).toHaveBeenCalledWith(
          expect.any(Array),
          true // autoSubmit=true
        )
      })
    })

    it('handles processing errors', async () => {
      const errorMessage = 'Network error'
      ensAPI.processBatch.mockRejectedValueOnce({
        response: { data: { message: errorMessage } }
      })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error processing batch:', expect.anything())
      })

      consoleError.mockRestore()
    })

    it('shows results with mixed success/failure', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            successful: 1,
            total: 2,
            failed: 1,
            results: [
              { success: true, reference: 'BL001', mrn: '25ES000001234567890' },
              { success: false, reference: 'BL002', error: 'Validation failed' }
            ]
          }
        }
      })

      const multiRowCsv = `transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName
ROAD;ES001101;2025-01-25;08:00;ESA12345678;Carrier;1234ABC;ES;BL001;MSKU1234567;SEAL001;15000;100;Goods;ESB87654321;Exporter;ESC11111111;Importer
AIR;ES001102;2025-01-26;09:00;ESA22222222;Carrier2;5678DEF;ES;BL002;ABCD9876543;SEAL002;10000;50;Goods2;ESB77777777;Exporter2;ESC22222222;Importer2`

      const file = new File([multiRowCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(multiRowCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      await waitFor(() => {
        expect(screen.getByText('ens.processingComplete')).toBeInTheDocument()
      })

      // Check failed count is shown
      expect(screen.getByText('ens.failedCount')).toBeInTheDocument()

      // Check results table
      expect(screen.getByText('ens.mrnLabel')).toBeInTheDocument()
      expect(screen.getByText('BL001')).toBeInTheDocument()
      expect(screen.getByText('25ES000001234567890')).toBeInTheDocument()
      expect(screen.getByText('BL002')).toBeInTheDocument()
      expect(screen.getByText('Validation failed')).toBeInTheDocument()
    })

    it('calls onClose and onSuccess after successful processing', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            successful: 1,
            total: 1,
            failed: 0,
            results: [{ success: true, reference: 'BL001', mrn: '25ES000001234567890' }]
          }
        }
      })

      const onClose = vi.fn()
      const onSuccess = vi.fn()

      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={onClose} onSuccess={onSuccess} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      await waitFor(() => {
        expect(screen.getByText('common.close')).toBeInTheDocument()
      })

      const closeButton = screen.getByText('common.close')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })

    it('resets to upload when new import clicked', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            successful: 1,
            total: 1,
            failed: 0,
            results: [{ success: true }]
          }
        }
      })

      const file = new File([validCsv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(validCsv)

      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

      const fileInput = document.querySelector('input[type="file"]')
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument()
      })

      const processButton = screen.getByRole('button', { name: /ens\.processDeclarations/i })
      fireEvent.click(processButton)

      await waitFor(() => {
        expect(screen.getByText('ens.newImport')).toBeInTheDocument()
      })

      const newImportButton = screen.getByText('ens.newImport')
      fireEvent.click(newImportButton)

      // Should be back to step 0
      expect(screen.getByText('ens.dragOrClick')).toBeInTheDocument()
    })
  })

  // Contrato REAL del backend (ensService.processBatch): devuelve data.declarations
  // con {sequence, reference, lrn, status:'created'|'submitted'|'failed'|'error'},
  // NO data.results con {success}. Verificado en produccion via navegador: la tabla
  // de resultados por fila no se pintaba nunca.
  describe('Step 2: contrato real de la respuesta de lote', () => {
    const csvConFilaInvalida = `transportMode;entryOfficeCode;expectedArrivalDate;expectedArrivalTime;carrierEORI;carrierName;transportIdentification;transportNationality;billOfLading;containerNumber;sealNumber;grossMass;numberOfPackages;goodsDescription;consignorEORI;consignorName;consigneeEORI;consigneeName
RAIL;ES009999;2026-11-20;09:00;ESB22477020;Renfe;VAG-1001;ES;LOTE-RAIL-001;;SEAL0001;7200;40;Tornillos;DE123456789012;Metallwerk;ESB22477020;STRIX
RAIL;ES009999;2026-11-21;11:30;ESB22477020;Renfe;VAG-1002;ES;LOTE-ERROR-002;;SEAL0002;0;12;Sin peso;DE123456789012;Metallwerk;ESB22477020;STRIX
RAIL;ES001101;2026-11-22;16:45;ESB22477020;Renfe;VAG-1003;ES;LOTE-RAIL-003;MSKU1234567;SEAL0003;3100;18;Perfiles;DE123456789012;Metallwerk;ESB22477020;STRIX`

    const procesar = async (csv) => {
      const file = new File([csv], 'batch.csv', { type: 'text/csv' })
      if (!file.text) file.text = () => Promise.resolve(csv)
      render(<ENSBatchUpload open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
      fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByText('ens.processDeclarations')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /ens\.processDeclarations/i }))
      await waitFor(() => expect(screen.getByText('ens.processingComplete')).toBeInTheDocument())
    }

    it('pinta la referencia y el MRN que devuelve el backend en data.declarations', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            batchId: 'ENSBATCH-1',
            total: 2,
            successful: 2,
            failed: 0,
            declarations: [
              { sequence: 1, reference: 'ENS-2026-000009', lrn: 'LUCIA', status: 'submitted', mrn: '26ES009999Z0000717' },
              { sequence: 2, reference: 'ENS-2026-000010', lrn: 'LUCIB', status: 'created' }
            ]
          }
        }
      })
      await procesar(csvConFilaInvalida)
      expect(screen.getByText('ENS-2026-000009')).toBeInTheDocument()
      expect(screen.getByText('26ES009999Z0000717')).toBeInTheDocument()
      expect(screen.getByText('ENS-2026-000010')).toBeInTheDocument()
    })

    it('marca como error la declaracion que el backend rechaza (status failed)', async () => {
      ensAPI.processBatch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            batchId: 'ENSBATCH-2',
            total: 2,
            successful: 1,
            failed: 1,
            declarations: [
              { sequence: 1, reference: 'ENS-2026-000011', status: 'created' },
              { sequence: 2, status: 'failed', errors: [{ message: 'ENS_GOODS_REQUIRED' }] }
            ]
          }
        }
      })
      await procesar(csvConFilaInvalida)
      expect(screen.getByText('common.error')).toBeInTheDocument()
      expect(screen.getByText('ens.success')).toBeInTheDocument()
    })
  })
})
