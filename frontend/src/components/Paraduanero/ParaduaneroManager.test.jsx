import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ParaduaneroManager from './ParaduaneroManager'
import { paraduaneroAPI } from '../../services/api'

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('../../services/api', () => ({
  paraduaneroAPI: {
    getByExpedition: vi.fn(),
    analyze: vi.fn(),
    createControls: vi.fn(),
    provideDocument: vi.fn(),
    changeStatus: vi.fn()
  }
}))

const toast = await import('react-hot-toast').then(m => m.default)

describe('ParaduaneroManager', () => {
  const mockExpeditionId = 'exp-123'
  const mockOnControlsChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering and initial load', () => {
    it('renders loading state initially', () => {
      paraduaneroAPI.getByExpedition.mockReturnValue(new Promise(() => {}))
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('loads controls on mount when expeditionId is provided', async () => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await waitFor(() => {
        expect(paraduaneroAPI.getByExpedition).toHaveBeenCalledWith(mockExpeditionId)
      })
    })

    it('does not load controls when expeditionId is null', () => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
      render(<ParaduaneroManager expeditionId={null} onControlsChange={mockOnControlsChange} />)

      expect(paraduaneroAPI.getByExpedition).not.toHaveBeenCalled()
    })

    it('renders empty state when no controls exist', async () => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('No hay controles paraduaneros')
      expect(screen.getByText('Pulse "Analizar" para detectar si se requieren controles')).toBeInTheDocument()
    })

    it('handles API error gracefully during load', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      paraduaneroAPI.getByExpedition.mockRejectedValue(new Error('Network error'))
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error loading controls:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    it('renders control count badge when controls exist', async () => {
      const mockControls = [
        { _id: '1', controlType: 'SOIVRE', status: 'pending', controlNumber: 'C001' },
        { _id: '2', controlType: 'MAPA', status: 'approved', controlNumber: 'C002' }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('2')
    })
  })

  describe('Analysis flow', () => {
    beforeEach(() => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
    })

    it('shows analyzing state when analyze button is clicked', async () => {
      paraduaneroAPI.analyze.mockReturnValue(new Promise(() => {}))
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      const analyzeButton = screen.getByText('Analizar')
      fireEvent.click(analyzeButton)

      await waitFor(() => {
        expect(screen.getByText('Analizando...')).toBeInTheDocument()
      })
    })

    it('displays analysis result when controls required > 0', async () => {
      paraduaneroAPI.analyze.mockResolvedValue({
        data: {
          data: {
            controlsRequired: 2,
            controls: [
              { controlType: 'SOIVRE', reason: 'Juguetes requieren inspeccion' },
              { controlType: 'MAPA', reason: 'Productos veterinarios' }
            ]
          }
        }
      })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await screen.findByText(/Se requieren 2 control/)
      expect(screen.getByText('- Juguetes requieren inspeccion')).toBeInTheDocument()
      expect(screen.getByText('- Productos veterinarios')).toBeInTheDocument()
      expect(toast.success).toHaveBeenCalledWith('Se detectaron 2 controles necesarios')
    })

    it('shows success toast when no controls required', async () => {
      paraduaneroAPI.analyze.mockResolvedValue({
        data: { data: { controlsRequired: 0, controls: [] } }
      })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('No se requieren controles paraduaneros')
      })
    })

    it('handles analyze API error', async () => {
      paraduaneroAPI.analyze.mockRejectedValue(new Error('Analysis failed'))
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al analizar expediente')
      })
    })
  })

  describe('Create controls flow', () => {
    beforeEach(() => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
    })

    it('shows creating state when create controls button is clicked', async () => {
      paraduaneroAPI.analyze.mockResolvedValue({
        data: {
          data: {
            controlsRequired: 1,
            controls: [{ controlType: 'SOIVRE', reason: 'Test' }]
          }
        }
      })
      paraduaneroAPI.createControls.mockReturnValue(new Promise(() => {}))
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await screen.findByText('Crear Controles')
      fireEvent.click(screen.getByText('Crear Controles'))

      await waitFor(() => {
        expect(screen.getByText('Creando...')).toBeInTheDocument()
      })
    })

    it('creates controls successfully and reloads list', async () => {
      paraduaneroAPI.analyze.mockResolvedValue({
        data: {
          data: {
            controlsRequired: 1,
            controls: [{ controlType: 'SOIVRE', reason: 'Test' }]
          }
        }
      })
      const mockCreatedControls = [{ _id: '1', controlType: 'SOIVRE', status: 'pending' }]
      paraduaneroAPI.createControls.mockResolvedValue({ data: { data: mockCreatedControls } })
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: [] } })
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockCreatedControls } })

      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await screen.findByText('Crear Controles')
      fireEvent.click(screen.getByText('Crear Controles'))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('1 control(es) creado(s)')
        expect(mockOnControlsChange).toHaveBeenCalled()
        expect(paraduaneroAPI.getByExpedition).toHaveBeenCalledTimes(2)
      })
    })

    it('handles create controls API error', async () => {
      paraduaneroAPI.analyze.mockResolvedValue({
        data: {
          data: {
            controlsRequired: 1,
            controls: [{ controlType: 'SOIVRE', reason: 'Test' }]
          }
        }
      })
      paraduaneroAPI.createControls.mockRejectedValue({
        response: { data: { error: 'Creation failed' } }
      })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await screen.findByText('Crear Controles')
      fireEvent.click(screen.getByText('Crear Controles'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Creation failed')
      })
    })

    it('handles create controls API error without response.data.error', async () => {
      paraduaneroAPI.analyze.mockResolvedValue({
        data: {
          data: {
            controlsRequired: 1,
            controls: [{ controlType: 'SOIVRE', reason: 'Test' }]
          }
        }
      })
      paraduaneroAPI.createControls.mockRejectedValue(new Error('Network error'))
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      fireEvent.click(screen.getByText('Analizar'))

      await screen.findByText('Crear Controles')
      fireEvent.click(screen.getByText('Crear Controles'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al crear controles')
      })
    })
  })

  describe('Control list rendering', () => {
    it('renders control cards with correct type and status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          subType: 'INDUSTRIAL_PRODUCTS'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      expect(screen.getByText('INDUSTRIAL PRODUCTS')).toBeInTheDocument()
      expect(screen.getByText('Pendiente')).toBeInTheDocument()
    })

    it('renders progress bar for non-terminal statuses', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          progress: 25
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const progressBar = document.querySelector('[style*="width: 25%"]')
      expect(progressBar).toBeInTheDocument()
    })

    it('does not render progress bar for approved status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'approved',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const progressBar = document.querySelector('[style*="width"]')
      expect(progressBar).not.toBeInTheDocument()
    })

    it('does not render progress bar for rejected status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'rejected',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const progressBar = document.querySelector('[style*="width"]')
      expect(progressBar).not.toBeInTheDocument()
    })

    it('does not render progress bar for cancelled status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'cancelled',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const progressBar = document.querySelector('[style*="width"]')
      expect(progressBar).not.toBeInTheDocument()
    })

    it('toggles control expansion on click', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          affectedGoods: [
            { taricCode: '9503001000', description: 'Juguetes' }
          ]
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')

      // Not expanded initially
      expect(screen.queryByText('Juguetes')).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(header)
      await waitFor(() => {
        expect(screen.getByText('Juguetes')).toBeInTheDocument()
      })

      // Click to collapse
      fireEvent.click(header)
      await waitFor(() => {
        expect(screen.queryByText('Juguetes')).not.toBeInTheDocument()
      })
    })

    it('renders affected goods when expanded', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          affectedGoods: [
            { taricCode: '9503001000', description: 'Juguetes electricos' },
            { taricCode: '6109100010', description: 'Camisetas' }
          ]
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Mercancias afectadas:')
      expect(screen.getByText('9503001000')).toBeInTheDocument()
      expect(screen.getByText('Juguetes electricos')).toBeInTheDocument()
      expect(screen.getByText('6109100010')).toBeInTheDocument()
      expect(screen.getByText('Camisetas')).toBeInTheDocument()
    })

    it('does not render affected goods section when array is empty', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          affectedGoods: []
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText('Mercancias afectadas:')).not.toBeInTheDocument()
      })
    })
  })

  describe('Required documents', () => {
    it('renders required documents with provided status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'documents_required',
          controlNumber: 'C001',
          requiredDocuments: [
            { _id: 'd1', name: 'Certificado CE', code: 'CE-001', provided: true, mandatory: true },
            { _id: 'd2', name: 'Factura', code: 'INV-001', provided: false, mandatory: false }
          ]
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Documentos requeridos:')
      expect(screen.getByText('Certificado CE')).toBeInTheDocument()
      expect(screen.getByText('(CE-001)')).toBeInTheDocument()
      expect(screen.getByText('Factura')).toBeInTheDocument()
      expect(screen.getByText('(INV-001)')).toBeInTheDocument()
    })

    it('shows "Marcar proporcionado" button for unprovided documents', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'documents_required',
          controlNumber: 'C001',
          requiredDocuments: [
            { _id: 'd1', name: 'Certificado CE', code: 'CE-001', provided: false, mandatory: true }
          ]
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Marcar proporcionado')
    })

    it('marks document as provided when button is clicked', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'documents_required',
          controlNumber: 'C001',
          requiredDocuments: [
            { _id: 'd1', name: 'Certificado CE', code: 'CE-001', provided: false, mandatory: true }
          ]
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      paraduaneroAPI.provideDocument.mockResolvedValue({})
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockControls } })
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockControls } })

      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Marcar proporcionado')
      fireEvent.click(screen.getByText('Marcar proporcionado'))

      await waitFor(() => {
        expect(paraduaneroAPI.provideDocument).toHaveBeenCalledWith('1', 'CE-001', { documentId: null })
        expect(toast.success).toHaveBeenCalledWith('Documento marcado como proporcionado')
        expect(paraduaneroAPI.getByExpedition).toHaveBeenCalledTimes(2)
      })
    })

    it('handles provideDocument API error', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'documents_required',
          controlNumber: 'C001',
          requiredDocuments: [
            { _id: 'd1', name: 'Certificado CE', code: 'CE-001', provided: false, mandatory: true }
          ]
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      paraduaneroAPI.provideDocument.mockRejectedValue(new Error('Document error'))

      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Marcar proporcionado')
      fireEvent.click(screen.getByText('Marcar proporcionado'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al marcar documento')
      })
    })

    it('does not render required documents section when array is empty', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          requiredDocuments: []
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText('Documentos requeridos:')).not.toBeInTheDocument()
      })
    })
  })

  describe('Inspection details', () => {
    it('renders inspection required without schedule', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'MAPA',
          status: 'inspection_pending',
          controlNumber: 'C001',
          inspection: {
            required: true,
            scheduled: false
          }
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Inspeccion requerida')
      expect(screen.getByText('Pendiente de programar')).toBeInTheDocument()
    })

    it('renders scheduled inspection with details', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'MAPA',
          status: 'inspection_scheduled',
          controlNumber: 'C001',
          inspection: {
            required: true,
            scheduled: true,
            scheduledDate: '2026-08-10T10:00:00Z',
            scheduledTime: '10:00',
            location: { name: 'Puerto de Valencia' }
          }
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Inspeccion requerida')
      expect(screen.getByText(/Fecha:/)).toBeInTheDocument()
      expect(screen.getByText(/Hora: 10:00/)).toBeInTheDocument()
      expect(screen.getByText(/Lugar: Puerto de Valencia/)).toBeInTheDocument()
    })

    it('does not render inspection section when not required', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          inspection: { required: false }
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText('Inspeccion requerida')).not.toBeInTheDocument()
      })
    })
  })

  describe('Deadline display', () => {
    it('renders deadline for non-terminal statuses', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          deadline: '2026-09-01T00:00:00Z',
          daysUntilDeadline: 10,
          isOverdue: false
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText(/Vence:/)
      expect(screen.getByText(/\(10 dias\)/)).toBeInTheDocument()
    })

    it('renders overdue deadline in red', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          deadline: '2026-07-01T00:00:00Z',
          daysUntilDeadline: -5,
          isOverdue: true
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText(/Vence:/)
      const deadlineText = screen.getByText(/Vence:/).closest('div')
      expect(deadlineText).toHaveClass('text-red-600')
      expect(screen.getByText(/\(Vencido\)/)).toBeInTheDocument()
    })

    it('does not render deadline for approved status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'approved',
          controlNumber: 'C001',
          deadline: '2026-09-01T00:00:00Z'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText(/Vence:/)).not.toBeInTheDocument()
      })
    })

    it('does not render deadline for rejected status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'rejected',
          controlNumber: 'C001',
          deadline: '2026-09-01T00:00:00Z'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText(/Vence:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Certificate display', () => {
    it('renders issued certificate', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'approved',
          controlNumber: 'C001',
          certificate: {
            issued: true,
            certificateNumber: 'CERT-2026-001',
            validUntil: '2027-08-06T00:00:00Z'
          }
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText(/Certificado emitido: CERT-2026-001/)
      expect(screen.getByText(/Valido hasta:/)).toBeInTheDocument()
    })

    it('does not render certificate section when not issued', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'approved',
          controlNumber: 'C001',
          certificate: { issued: false }
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText(/Certificado emitido:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Status change actions', () => {
    it('renders approve and reject buttons for non-terminal statuses', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Aprobar')
      expect(screen.getByText('Rechazar')).toBeInTheDocument()
    })

    it('does not render action buttons for approved status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'approved',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText('Aprobar')).not.toBeInTheDocument()
        expect(screen.queryByText('Rechazar')).not.toBeInTheDocument()
      })
    })

    it('does not render action buttons for rejected status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'rejected',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText('Aprobar')).not.toBeInTheDocument()
        expect(screen.queryByText('Rechazar')).not.toBeInTheDocument()
      })
    })

    it('does not render action buttons for cancelled status', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'cancelled',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.queryByText('Aprobar')).not.toBeInTheDocument()
        expect(screen.queryByText('Rechazar')).not.toBeInTheDocument()
      })
    })

    it('approves control when approve button is clicked', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      paraduaneroAPI.changeStatus.mockResolvedValue({})
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockControls } })
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockControls } })

      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Aprobar')
      fireEvent.click(screen.getByText('Aprobar'))

      await waitFor(() => {
        expect(paraduaneroAPI.changeStatus).toHaveBeenCalledWith('1', { status: 'approved', reason: 'Aprobado manualmente' })
        expect(toast.success).toHaveBeenCalledWith('Estado actualizado')
        expect(mockOnControlsChange).toHaveBeenCalled()
        expect(paraduaneroAPI.getByExpedition).toHaveBeenCalledTimes(2)
      })
    })

    it('rejects control when reject button is clicked', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      paraduaneroAPI.changeStatus.mockResolvedValue({})
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockControls } })
      paraduaneroAPI.getByExpedition.mockResolvedValueOnce({ data: { data: mockControls } })

      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Rechazar')
      fireEvent.click(screen.getByText('Rechazar'))

      await waitFor(() => {
        expect(paraduaneroAPI.changeStatus).toHaveBeenCalledWith('1', { status: 'rejected', reason: 'Rechazado' })
        expect(toast.success).toHaveBeenCalledWith('Estado actualizado')
        expect(mockOnControlsChange).toHaveBeenCalled()
        expect(paraduaneroAPI.getByExpedition).toHaveBeenCalledTimes(2)
      })
    })

    it('handles changeStatus API error', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      paraduaneroAPI.changeStatus.mockRejectedValue(new Error('Status change failed'))

      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      const header = screen.getByText('C001').closest('.cursor-pointer')
      fireEvent.click(header)

      await screen.findByText('Aprobar')
      fireEvent.click(screen.getByText('Aprobar'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cambiar estado')
      })
    })
  })

  describe('Refresh functionality', () => {
    it('reloads controls when refresh button is clicked', async () => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Analizar')
      const refreshButton = screen.getByTitle('Actualizar')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(paraduaneroAPI.getByExpedition).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Legend', () => {
    it('renders control types legend', async () => {
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: [] } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('Tipos de control:')
      const legend = screen.getByText('Tipos de control:').closest('.bg-gray-50')
      expect(legend).toBeInTheDocument()
      expect(legend.textContent).toContain('SOIVRE')
      expect(legend.textContent).toContain('MAPA')
      expect(legend.textContent).toContain('SANIDAD')
      expect(legend.textContent).toContain('MITERD')
      expect(legend.textContent).toContain('AEMPS')
      expect(legend.textContent).toContain('AESAN')
    })
  })

  describe('Edge cases', () => {
    it('handles undefined onControlsChange gracefully', async () => {
      const mockControls = [{ _id: '1', controlType: 'SOIVRE', status: 'pending', controlNumber: 'C001' }]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      paraduaneroAPI.changeStatus.mockResolvedValue({})

      render(<ParaduaneroManager expeditionId={mockExpeditionId} />)

      await screen.findAllByText('SOIVRE')
      fireEvent.click(screen.getAllByText('SOIVRE')[0].closest('.cursor-pointer'))

      await screen.findByText('Aprobar')
      fireEvent.click(screen.getByText('Aprobar'))

      await waitFor(() => {
        expect(paraduaneroAPI.changeStatus).toHaveBeenCalled()
      })
    })

    it('handles unknown control type gracefully', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'UNKNOWN_TYPE',
          status: 'pending',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      // Should fall back to SOIVRE config
      await screen.findByText('C001')
    })

    it('handles unknown status gracefully', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'unknown_status',
          controlNumber: 'C001'
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      // Should fall back to pending config
      await screen.findAllByText('SOIVRE')
    })

    it('handles null daysUntilDeadline', async () => {
      const mockControls = [
        {
          _id: '1',
          controlType: 'SOIVRE',
          status: 'pending',
          controlNumber: 'C001',
          deadline: '2026-09-01T00:00:00Z',
          daysUntilDeadline: null,
          isOverdue: false
        }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findAllByText('SOIVRE')
      fireEvent.click(screen.getAllByText('SOIVRE')[0].closest('.cursor-pointer'))

      await screen.findByText(/Vence:/)
      // Should not render days until deadline
      expect(screen.queryByText(/\(\d+ dias\)/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\(Vencido\)/)).not.toBeInTheDocument()
    })

    it('renders multiple controls of different types', async () => {
      const mockControls = [
        { _id: '1', controlType: 'SOIVRE', status: 'pending', controlNumber: 'C001' },
        { _id: '2', controlType: 'MAPA', status: 'approved', controlNumber: 'C002' },
        { _id: '3', controlType: 'SANIDAD', status: 'rejected', controlNumber: 'C003' },
        { _id: '4', controlType: 'MITERD', status: 'documents_required', controlNumber: 'C004' },
        { _id: '5', controlType: 'AEMPS', status: 'inspection_pending', controlNumber: 'C005' },
        { _id: '6', controlType: 'AESAN', status: 'cancelled', controlNumber: 'C006' }
      ]
      paraduaneroAPI.getByExpedition.mockResolvedValue({ data: { data: mockControls } })
      render(<ParaduaneroManager expeditionId={mockExpeditionId} onControlsChange={mockOnControlsChange} />)

      await screen.findByText('C001')
      expect(screen.getByText('C002')).toBeInTheDocument()
      expect(screen.getByText('C003')).toBeInTheDocument()
      expect(screen.getByText('C004')).toBeInTheDocument()
      expect(screen.getByText('C005')).toBeInTheDocument()
      expect(screen.getByText('C006')).toBeInTheDocument()
      expect(screen.getByText('6')).toBeInTheDocument() // count badge
    })
  })
})
