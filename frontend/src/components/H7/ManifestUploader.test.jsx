import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import ManifestUploader from './ManifestUploader'
import { manifestAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}))

vi.mock('../../services/api', () => ({
  manifestAPI: {
    downloadTemplate: vi.fn(),
    upload: vi.fn(),
    createBatch: vi.fn()
  }
}))

describe('ManifestUploader', () => {
  const mockOnClose = vi.fn()
  const mockOnCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    delete global.URL.createObjectURL
    delete global.URL.revokeObjectURL
  })

  it('renders step upload initially', () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    expect(screen.getByText(/Importar Manifiesto de Carga/i)).toBeInTheDocument()
    expect(screen.getByText(/Arrastra tu manifiesto CSV aqui/i)).toBeInTheDocument()
    expect(screen.getByText(/1\. Subir CSV/i)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'))
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('downloads template successfully', async () => {
    const user = userEvent.setup()
    const mockBlob = 'csv,data,here'
    manifestAPI.downloadTemplate.mockResolvedValue({ data: mockBlob })

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const downloadButton = screen.getByText(/Descargar/i)
    await user.click(downloadButton)

    await waitFor(() => {
      expect(manifestAPI.downloadTemplate).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Plantilla descargada')
    })
  })

  it('shows error when template download fails', async () => {
    const user = userEvent.setup()
    manifestAPI.downloadTemplate.mockRejectedValue(new Error('Network error'))

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const downloadButton = screen.getByText(/Descargar/i)
    await user.click(downloadButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error descargando plantilla')
    })
  })

  it('rejects non-CSV file extensions', () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const file = new File(['data'], 'test.pdf', { type: 'application/pdf' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    expect(toast.error).toHaveBeenCalledWith('Solo se aceptan archivos CSV, TXT o TSV')
  })

  it('accepts CSV file and transitions to preview', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking,name,description\n12345,John,Widget\n67890,Jane,Gadget'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.csv/)
    expect(screen.getByText(/2\. Vista previa/i)).toBeInTheDocument()
    expect(screen.getAllByText(/tracking/i).length).toBeGreaterThan(0)
  })

  it('parses preview with correct delimiter', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1;col2\nvalA;valB'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.csv/)

    // Change delimiter and re-parse
    const delimiterSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(delimiterSelect, { target: { value: ';' } })

    await waitFor(() => {
      expect(screen.getByText(/valA/i)).toBeInTheDocument()
      expect(screen.getByText(/valB/i)).toBeInTheDocument()
    })
  })

  it('shows advanced options when toggled', async () => {
    const user = userEvent.setup()
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const toggleButton = screen.getByText(/Opciones avanzadas/i)
    await user.click(toggleButton)

    expect(screen.getByText(/Delimitador/i)).toBeInTheDocument()
    expect(screen.getByText(/Transportista/i)).toBeInTheDocument()
  })

  it('changes carrier option', async () => {
    const user = userEvent.setup()
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const toggleButton = screen.getByText(/Opciones avanzadas/i)
    await user.click(toggleButton)

    const selects = screen.getAllByRole('combobox')
    const carrierSelect = selects[1]
    fireEvent.change(carrierSelect, { target: { value: 'DHL' } })

    expect(carrierSelect.value).toBe('DHL')
  })

  it('changes IOSS number', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const toggleButton = screen.getByText(/Opciones avanzadas/i)
    await userEvent.setup().click(toggleButton)

    const iossInput = screen.getByPlaceholderText(/IM0000000000/i)
    fireEvent.change(iossInput, { target: { value: 'IM1234567890' } })

    expect(iossInput.value).toBe('IM1234567890')
  })

  it('processes manifest successfully', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 2, h7Ready: 2, h1Required: 0, errors: 0 },
          h7Declarations: [
            {
              lineNumber: 1,
              trackingNumber: 'TRK001',
              recipient: { name: 'John Doe', taxId: '12345678A' },
              items: [{ description: 'Widget', taricCode: '12345678' }],
              totals: { intrinsicValue: 100, grossWeight: 1.5 }
            }
          ],
          h1Required: [],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking,name\nTRK001,Widget'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    expect(manifestAPI.upload).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('2 declaraciones H7 listas'))
  })

  it('shows error when upload fails', async () => {
    const user = userEvent.setup()
    manifestAPI.upload.mockRejectedValue({
      response: { data: { error: 'Invalid format' } }
    })

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'bad,data'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid format')
    })
  })

  it('shows h1Required entries in results', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 2, h7Ready: 1, h1Required: 1, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget', taricCode: '12345678' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [{
            lineNumber: 2,
            tracking: 'TRK002',
            description: 'Heavy item',
            value: 1500,
            reason: 'Valor supera 1000 EUR'
          }],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Requieren declaracion H1/)
    expect(screen.getByText(/Heavy item/i)).toBeInTheDocument()
    expect(screen.getByText(/Valor supera 1000 EUR/i)).toBeInTheDocument()
  })

  it('shows errors in results', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 0, h1Required: 0, errors: 1 },
          h7Declarations: [],
          h1Required: [],
          errors: [{
            lineNumber: 1,
            tracking: 'TRK999',
            errors: ['Missing recipient name', 'Invalid country code']
          }]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK999'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Errores de datos/)
    expect(screen.getByText(/Missing recipient name/i)).toBeInTheDocument()
  })

  it('creates H7 batch successfully', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    const createResponse = {
      data: {
        success: true,
        data: {
          created: 1,
          total: 1,
          failed: 0,
          results: [{ tracking: 'TRK001', reference: 'REF001', success: true }]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockResolvedValue(createResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await screen.findByText(/Declaraciones H7 creadas/)

    expect(manifestAPI.createBatch).toHaveBeenCalledWith({
      h7Declarations: uploadResponse.data.data.h7Declarations
    })
    expect(toast.success).toHaveBeenCalledWith('1 declaraciones H7 creadas')
    expect(mockOnCreated).toHaveBeenCalled()
  })

  it('shows failed declarations in creation results', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 2, h7Ready: 2, h1Required: 0, errors: 0 },
          h7Declarations: [
            {
              lineNumber: 1,
              trackingNumber: 'TRK001',
              recipient: { name: 'John' },
              items: [{ description: 'Widget' }],
              totals: { intrinsicValue: 50, grossWeight: 0.5 }
            },
            {
              lineNumber: 2,
              trackingNumber: 'TRK002',
              recipient: { name: 'Jane' },
              items: [{ description: 'Gadget' }],
              totals: { intrinsicValue: 75, grossWeight: 1.0 }
            }
          ],
          h1Required: [],
          errors: []
        }
      }
    }

    const createResponse = {
      data: {
        success: true,
        data: {
          created: 1,
          total: 2,
          failed: 1,
          results: [
            { tracking: 'TRK001', reference: 'REF001', success: true },
            { tracking: 'TRK002', success: false, error: 'Validation error' }
          ]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockResolvedValue(createResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001\nTRK002'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 2 declaraciones H7/)
    await user.click(createButton)

    await screen.findByText(/Declaraciones H7 creadas/)

    expect(screen.getByText(/1 declaracion\(es\) no pudieron crearse/i)).toBeInTheDocument()
    expect(screen.getByText(/Validation error/i)).toBeInTheDocument()
  })

  it('shows error when createBatch fails', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockRejectedValue({
      response: { data: { error: 'Server error' } }
    })

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error')
    })
  })

  it('resets to upload step from preview', async () => {
    const user = userEvent.setup()
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const resetButton = screen.getByText(/Volver/i)
    await user.click(resetButton)

    expect(screen.getByText(/Arrastra tu manifiesto CSV aqui/i)).toBeInTheDocument()
  })

  it('resets from results step', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const resetButton = screen.getByText(/Nuevo manifiesto/i)
    await user.click(resetButton)

    expect(screen.getByText(/Arrastra tu manifiesto CSV aqui/i)).toBeInTheDocument()
  })

  it('closes from creation results', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    const createResponse = {
      data: {
        success: true,
        data: {
          created: 1,
          total: 1,
          failed: 0,
          results: [{ tracking: 'TRK001', reference: 'REF001', success: true }]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockResolvedValue(createResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await screen.findByText(/Declaraciones H7 creadas/)

    const closeButton = screen.getByText(/Ir a declaraciones H7/i)
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles drag and drop', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const dropzone = screen.getByText(/Arrastra tu manifiesto CSV aqui/i).closest('div')

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

    fireEvent.dragOver(dropzone, { dataTransfer: { files: [file] } })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await screen.findByText(/test.csv/)
    expect(screen.getByText(/2\. Vista previa/i)).toBeInTheDocument()
  })

  it('changes delimiter in preview and re-parses', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1|col2\nvalA|valB'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const delimiterSelects = screen.getAllByRole('combobox')
    const previewDelimiterSelect = delimiterSelects.find(select =>
      select.closest('div.bg-gray-50')
    )

    fireEvent.change(previewDelimiterSelect, { target: { value: '|' } })

    await waitFor(() => {
      expect(screen.getByText(/valA/i)).toBeInTheDocument()
      expect(screen.getByText(/valB/i)).toBeInTheDocument()
    })
  })

  it('shows correct step indicator state', async () => {
    const user = userEvent.setup()
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    expect(screen.getByText(/1\. Subir CSV/i)).toBeInTheDocument()

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    expect(screen.getByText(/2\. Vista previa/i)).toBeInTheDocument()
  })

  it('shows processing state during upload', async () => {
    const user = userEvent.setup()

    let resolveUpload
    const uploadPromise = new Promise(resolve => { resolveUpload = resolve })
    manifestAPI.upload.mockReturnValue(uploadPromise)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    expect(await screen.findByText(/Clasificando con IA/i)).toBeInTheDocument()

    resolveUpload({
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    })
  })

  it('shows creating state during batch creation', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    let resolveCreate
    const createPromise = new Promise(resolve => { resolveCreate = resolve })

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockReturnValue(createPromise)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    expect(await screen.findByText(/Creando declaraciones/i)).toBeInTheDocument()

    resolveCreate({
      data: {
        success: true,
        data: {
          created: 1,
          total: 1,
          failed: 0,
          results: [{ tracking: 'TRK001', reference: 'REF001', success: true }]
        }
      }
    })
  })

  it('accepts txt file extension', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const txtContent = 'col1,col2\nval1,val2'
    const file = new File([txtContent], 'test.txt', { type: 'text/plain' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.txt/)
    expect(screen.getByText(/2\. Vista previa/i)).toBeInTheDocument()
  })

  it('accepts tsv file extension', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const tsvContent = 'col1\tcol2\nval1\tval2'
    const file = new File([tsvContent], 'test.tsv', { type: 'text/tab-separated-values' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.tsv/)
    expect(screen.getByText(/2\. Vista previa/i)).toBeInTheDocument()
  })

  it('handles upload response with success:false', async () => {
    const user = userEvent.setup()

    manifestAPI.upload.mockResolvedValue({
      data: { success: false, error: 'Invalid data format' }
    })

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid data format')
    })
  })

  it('handles createBatch response with success:false', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockResolvedValue({
      data: { success: false, error: 'Batch creation failed' }
    })

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Batch creation failed')
    })
  })

  it('shows preview with limited rows', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const rows = Array.from({ length: 10 }, (_, i) => `val${i + 1}`).join('\n')
    const csvContent = `col1\n${rows}`
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.csv/)
    expect(screen.getByText(/Mostrando 5 de 10 filas/i)).toBeInTheDocument()
  })

  it('displays summary cards with correct values', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 10, h7Ready: 5, h1Required: 3, errors: 2 },
          h7Declarations: Array(5).fill({
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }),
          h1Required: [],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    expect(screen.getByText(/Total filas/i)).toBeInTheDocument()
    expect(screen.getByText(/Listos para H7/i)).toBeInTheDocument()
    expect(screen.getByText(/Requieren H1/i)).toBeInTheDocument()
    expect(screen.getByText(/Con errores/i)).toBeInTheDocument()
  })

  it('handles drag leave', () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const dropzone = screen.getByText(/Arrastra tu manifiesto CSV aqui/i).closest('div')

    fireEvent.dragOver(dropzone)
    fireEvent.dragLeave(dropzone)

    expect(dropzone).toBeInTheDocument()
  })

  it('handles file input click', async () => {
    const user = userEvent.setup()
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const dropzone = screen.getByText(/Arrastra tu manifiesto CSV aqui/i).closest('div')
    await user.click(dropzone)

    const input = document.getElementById('manifest-file-input')
    expect(input).toBeInTheDocument()
  })

  it('resets from creating step', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    const createResponse = {
      data: {
        success: true,
        data: {
          created: 1,
          total: 1,
          failed: 0,
          results: [{ tracking: 'TRK001', reference: 'REF001', success: true }]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockResolvedValue(createResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await screen.findByText(/Declaraciones H7 creadas/)

    const resetButton = screen.getByText(/Importar otro manifiesto/i)
    await user.click(resetButton)

    expect(screen.getByText(/Arrastra tu manifiesto CSV aqui/i)).toBeInTheDocument()
  })

  it('handles upload error without response.data', async () => {
    const user = userEvent.setup()
    manifestAPI.upload.mockRejectedValue(new Error('Network error'))

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error procesando manifiesto')
    })
  })

  it('shows h1Required entry without tracking', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 0, h1Required: 1, errors: 0 },
          h7Declarations: [],
          h1Required: [{
            lineNumber: 1,
            tracking: null,
            description: 'Item',
            value: 500,
            reason: 'Test reason'
          }],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Requieren declaracion H1/)
    expect(screen.getByText(/-/i)).toBeInTheDocument()
  })

  it('shows error entry without tracking', async () => {
    const user = userEvent.setup()

    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 0, h1Required: 0, errors: 1 },
          h7Declarations: [],
          h1Required: [],
          errors: [{
            lineNumber: 1,
            tracking: null,
            errors: ['Error message']
          }]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(mockResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1\nval1'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Errores de datos/)
    expect(screen.getByText(/-/i)).toBeInTheDocument()
  })

  it('shows preview with empty cell value', async () => {
    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'col1,col2\nvalA,\n,valB'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByText(/test.csv/)
    expect(screen.getAllByText(/-/i).length).toBeGreaterThan(0)
  })

  it('shows failed creation result without error message', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    const createResponse = {
      data: {
        success: true,
        data: {
          created: 0,
          total: 1,
          failed: 1,
          results: [
            { tracking: 'TRK001', success: false, error: null }
          ]
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockResolvedValue(createResponse)

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await screen.findByText(/Declaraciones H7 creadas/)
    expect(screen.getAllByText(/Error/i).length).toBeGreaterThan(0)
  })

  it('handles createBatch error without response.data', async () => {
    const user = userEvent.setup()

    const uploadResponse = {
      data: {
        success: true,
        data: {
          summary: { totalRows: 1, h7Ready: 1, h1Required: 0, errors: 0 },
          h7Declarations: [{
            lineNumber: 1,
            trackingNumber: 'TRK001',
            recipient: { name: 'John' },
            items: [{ description: 'Widget' }],
            totals: { intrinsicValue: 50, grossWeight: 0.5 }
          }],
          h1Required: [],
          errors: []
        }
      }
    }

    manifestAPI.upload.mockResolvedValue(uploadResponse)
    manifestAPI.createBatch.mockRejectedValue(new Error('Network error'))

    render(<ManifestUploader onClose={mockOnClose} onCreated={mockOnCreated} />)

    const csvContent = 'tracking\nTRK001'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.getElementById('manifest-file-input')

    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/test.csv/)

    const processButton = await screen.findByText(/Clasificar con IA/)
    await user.click(processButton)

    await screen.findByText(/Listos para H7/)

    const createButton = await screen.findByText(/Crear 1 declaraciones H7/)
    await user.click(createButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error creando declaraciones H7')
    })
  })
})
