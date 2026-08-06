import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QueryDashboard from './QueryDashboard'
import { queryAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('../../services/api', () => ({
  queryAPI: {
    getHistory: vi.fn(),
    getStats: vi.fn(),
    get: vi.fn(),
    byBillOfLading: vi.fn(),
    byContainer: vi.fn(),
    byLocation: vi.fn(),
    documents: vi.fn(),
    byMRN: vi.fn(),
    byEORI: vi.fn()
  }
}))

describe('QueryDashboard', () => {
  const mockHistoryResponse = {
    data: {
      success: true,
      data: [
        {
          _id: 'q1',
          queryId: 'QID-001',
          queryType: 'QIntNuCono',
          searchParams: { billOfLading: 'BL123' },
          queryStatus: 'completed',
          resultsCount: 5,
          executedAt: '2026-08-04T10:00:00Z',
          executionTime: 1200
        },
        {
          _id: 'q2',
          queryId: 'QID-002',
          queryType: 'QIntMRN',
          searchParams: { mrn: '26ESMAD00001234' },
          queryStatus: 'failed',
          resultsCount: 0,
          executedAt: '2026-08-03T15:30:00Z',
          executionTime: 800
        }
      ],
      pagination: { total: 2 }
    }
  }

  const mockStatsResponse = {
    data: {
      success: true,
      data: {
        totals: {
          queries: 100,
          successful: 85,
          failed: 15
        },
        recentQueries: [1, 2, 3]
      }
    }
  }

  const mockSearchSuccessResponse = {
    data: {
      success: true,
      count: 2,
      executionTime: 950,
      results: [
        {
          mrn: '26ESMAD00001234',
          lrn: 'LRN-001',
          declarationType: 'H7',
          status: 'ACEPTADA',
          channel: 'GREEN',
          customsOffice: { code: 'ES004932', name: 'Aduana Madrid-Barajas' },
          submissionDate: '2026-08-04T08:00:00Z',
          declarant: { eori: 'ESB22477020', name: 'STRIX AI SL' },
          carrier: { eori: 'ESCARRIER01', name: 'Transport SA' },
          consignee: { eori: 'ESCONSIGN01', name: 'Customer SL' },
          containerNumber: 'TCNU1234567',
          transportReference: 'REF123',
          grossMass: 1000,
          numberOfPackages: 10,
          pendingActions: [
            {
              description: 'Presentar documentacion complementaria',
              deadline: '2026-08-10T23:59:59Z'
            }
          ]
        },
        {
          mrn: '26ESMAD00005678',
          declarationType: 'ENS',
          status: 'EN_CURSO',
          channel: 'ORANGE',
          customsOffice: { code: 'ES004932' },
          submissionDate: '2026-08-03T12:00:00Z',
          declarant: { eori: 'ESB22477020' }
        }
      ]
    }
  }

  const mockSearchErrorResponse = {
    data: {
      success: false,
      error: 'Error de conexion con AEAT'
    }
  }

  const mockGetQueryResponse = {
    data: {
      success: true,
      data: mockSearchSuccessResponse.data
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryAPI.getHistory.mockResolvedValue(mockHistoryResponse)
    queryAPI.getStats.mockResolvedValue(mockStatsResponse)
  })

  test('renders title and loads history and stats on mount', async () => {
    render(<QueryDashboard />)

    expect(screen.getByText('queries.title')).toBeInTheDocument()
    expect(queryAPI.getHistory).toHaveBeenCalledWith({ page: 1, limit: 10 })
    expect(queryAPI.getStats).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText('Total Consultas')).toBeInTheDocument()
    })

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('renders two tabs: Nueva Consulta and Historial', async () => {
    render(<QueryDashboard />)

    expect(screen.getByRole('tab', { name: /Nueva Consulta/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Historial/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalled()
    })
  })

  test('switches to Historial tab and displays history', async () => {
    const user = userEvent.setup()
    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText('QID-001')).toBeInTheDocument()
    })

    expect(screen.getByText('QID-002')).toBeInTheDocument()
    expect(screen.getByText('BL123')).toBeInTheDocument()
    expect(screen.getByText('26ESMAD00001234')).toBeInTheDocument()
    expect(screen.getByText(/1200/)).toBeInTheDocument()
    expect(screen.getByText(/800/)).toBeInTheDocument()
  })

  test('displays empty state when no history', async () => {
    queryAPI.getHistory.mockResolvedValueOnce({
      data: { success: true, data: [], pagination: { total: 0 } }
    })

    const user = userEvent.setup()
    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText(/No hay consultas en el historial/i)).toBeInTheDocument()
    })
  })

  test('renders query type buttons and switches queryType', async () => {
    const user = userEvent.setup()
    render(<QueryDashboard />)

    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalled()
    })

    const contButton = screen.getByRole('button', { name: /Contenedor/i })
    await user.click(contButton)

    const input = screen.getByLabelText(/Contenedor/i)
    expect(input).toBeInTheDocument()
  })

  test('QIntNuCono: calls byBillOfLading with correct params on search', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST-001' } })

    const dateFromInput = screen.getByLabelText(/Fecha Desde/i)
    fireEvent.change(dateFromInput, { target: { value: '2026-01-01' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.byBillOfLading).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'BL-TEST-001',
          dateFrom: '2026-01-01'
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/2 resultado\(s\) encontrado\(s\)/i)).toBeInTheDocument()
    })
  })

  test('QIntCont: calls byContainer when query type is container', async () => {
    queryAPI.byContainer.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const contButton = screen.getByRole('button', { name: /Contenedor/i })
    await user.click(contButton)

    const input = screen.getByLabelText(/Contenedor/i)
    fireEvent.change(input, { target: { value: 'TCNU1234567' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.byContainer).toHaveBeenCalledWith(
        expect.objectContaining({ containerNumber: 'TCNU1234567' })
      )
    })
  })

  test('QIntUbic: calls byLocation when query type is Ubicacion', async () => {
    queryAPI.byLocation.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const ubicButton = screen.getByRole('button', { name: /Ubicacion/i })
    await user.click(ubicButton)

    const input = screen.getByLabelText(/Ubicacion/i)
    fireEvent.change(input, { target: { value: 'MAD-DEPOT-01' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.byLocation).toHaveBeenCalledWith(
        expect.objectContaining({ locationCode: 'MAD-DEPOT-01' })
      )
    })
  })

  test('QIntDocAsoc: calls documents when query type is Documentos', async () => {
    queryAPI.documents.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const docButton = screen.getByRole('button', { name: /Documentos/i })
    await user.click(docButton)

    const input = screen.getByLabelText(/Documentos/i)
    fireEvent.change(input, { target: { value: 'DOC-001' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.documents).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'DOC-001' })
      )
    })
  })

  test('QIntMRN: calls byMRN when query type is MRN', async () => {
    queryAPI.byMRN.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const mrnButton = screen.getByRole('button', { name: /MRN/i })
    await user.click(mrnButton)

    const input = screen.getByLabelText(/MRN/i)
    fireEvent.change(input, { target: { value: '26ESMAD00001234' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.byMRN).toHaveBeenCalledWith(
        expect.objectContaining({ mrn: '26ESMAD00001234' })
      )
    })
  })

  test('QIntEORI: calls byEORI when query type is EORI', async () => {
    queryAPI.byEORI.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const eoirButton = screen.getByRole('button', { name: /EORI/i })
    await user.click(eoirButton)

    const input = screen.getByLabelText(/EORI/i)
    fireEvent.change(input, { target: { value: 'ESB22477020' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.byEORI).toHaveBeenCalledWith(
        expect.objectContaining({ eori: 'ESB22477020' })
      )
    })
  })

  test('does not search when searchValue is empty', async () => {
    render(<QueryDashboard />)

    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalled()
    })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    expect(queryAPI.byBillOfLading).not.toHaveBeenCalled()
    expect(queryAPI.byContainer).not.toHaveBeenCalled()
  })

  test('displays loading state during search', async () => {
    queryAPI.byBillOfLading.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSearchSuccessResponse), 100))
    )

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/Consultando AEAT\.\.\./i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/2 resultado\(s\) encontrado\(s\)/i)).toBeInTheDocument()
    })
  })

  test('displays error alert when search fails with error response', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchErrorResponse)

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-FAIL' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/Error de conexion con AEAT/i)).toBeInTheDocument()
    })
  })

  test('displays error alert when search throws exception', async () => {
    queryAPI.byBillOfLading.mockRejectedValueOnce(
      new Error('Network error')
    )

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-THROW' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })

  test('renders results table with declaration details', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00001234')).toBeInTheDocument()
    })

    expect(screen.getByText('LRN: LRN-001')).toBeInTheDocument()
    expect(screen.getByText('H7')).toBeInTheDocument()
    expect(screen.getByText('ENS')).toBeInTheDocument()
    expect(screen.getByText('ACEPTADA')).toBeInTheDocument()
    expect(screen.getByText('EN_CURSO')).toBeInTheDocument()
    expect(screen.getByText('GREEN')).toBeInTheDocument()
    expect(screen.getByText('ORANGE')).toBeInTheDocument()
  })

  test('opens detail dialog when info button clicked', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00001234')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver detalle')
    await user.click(infoButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Detalle de Declaracion: 26ESMAD00001234')).toBeInTheDocument()
    })
  })

  test('detail dialog displays carrier and consignee when present', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00001234')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver detalle')
    await user.click(infoButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/Transportista/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/ESCARRIER01 - Transport SA/i)).toBeInTheDocument()
    expect(screen.getByText(/Destinatario/i)).toBeInTheDocument()
    expect(screen.getByText(/ESCONSIGN01 - Customer SL/i)).toBeInTheDocument()
  })

  test('detail dialog displays pending actions when present', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00001234')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver detalle')
    await user.click(infoButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/Acciones Pendientes:/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Presentar documentacion complementaria/i)).toBeInTheDocument()
  })

  test('detail dialog does not show carrier/consignee when absent', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00005678')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver detalle')
    await user.click(infoButtons[1])

    await waitFor(() => {
      expect(screen.getByText('Detalle de Declaracion: 26ESMAD00005678')).toBeInTheDocument()
    })

    expect(screen.queryByText(/Transportista/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Destinatario/i)).not.toBeInTheDocument()
  })

  test('closes detail dialog when Cerrar button clicked', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00001234')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver detalle')
    await user.click(infoButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Detalle de Declaracion: 26ESMAD00001234')).toBeInTheDocument()
    })

    const closeButton = screen.getByRole('button', { name: /Cerrar/i })
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Detalle de Declaracion: 26ESMAD00001234')).not.toBeInTheDocument()
    })
  })

  test('TablePagination changes page and calls loadHistory', async () => {
    queryAPI.getHistory.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockHistoryResponse.data.data,
        pagination: { total: 25 }
      }
    })

    const user = userEvent.setup()
    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText('QID-001')).toBeInTheDocument()
    })

    queryAPI.getHistory.mockClear()
    queryAPI.getHistory.mockResolvedValueOnce(mockHistoryResponse)

    const nextPageButton = screen.getByLabelText(/Go to next page/i)
    await user.click(nextPageButton)

    // Debe recargar con la pagina NUEVA (page 1 en estado -> page:2 en API por
    // el +1), no con la anterior. Con el bug de stale closure recargaba page:1.
    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalledWith({ page: 2, limit: 10 })
    })
  })

  test('TablePagination changes rows per page and calls loadHistory', async () => {
    const user = userEvent.setup()
    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText('QID-001')).toBeInTheDocument()
    })

    queryAPI.getHistory.mockClear()
    queryAPI.getHistory.mockResolvedValueOnce(mockHistoryResponse)

    const rowsPerPageSelect = screen.getByLabelText(/Filas por pagina:/i)
    await user.click(rowsPerPageSelect)

    const option25 = screen.getByRole('option', { name: '25' })
    await user.click(option25)

    // Debe recargar con el limit NUEVO (25) y page reseteada a 0 -> page:1 en
    // API. Con el bug de stale closure recargaba con limit:10.
    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalledWith({ page: 1, limit: 25 })
    })
  })

  test('handles history query result view', async () => {
    queryAPI.get.mockResolvedValueOnce(mockGetQueryResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText('QID-001')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver resultados')
    await user.click(infoButtons[0])

    await waitFor(() => {
      expect(queryAPI.get).toHaveBeenCalledWith('QID-001')
    })
  })

  test('displays empty results message when results array is empty', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce({
      data: { success: true, count: 0, results: [] }
    })

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-EMPTY' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/No se encontraron resultados/i)).toBeInTheDocument()
    })
  })

  test('refreshes history after successful search', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)

    render(<QueryDashboard />)

    queryAPI.getHistory.mockClear()
    queryAPI.getHistory.mockResolvedValueOnce(mockHistoryResponse)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/2 resultado\(s\) encontrado\(s\)/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalledWith({ page: 1, limit: 10 })
    })
  })

  test('handles Enter key press to trigger search', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-ENTER' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 13, charCode: 13 })

    await waitFor(() => {
      expect(queryAPI.byBillOfLading).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'BL-ENTER' })
      )
    })
  })

  test('applies declarationType filter when selected', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce(mockSearchSuccessResponse)
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-FILTERED' } })

    const declTypeSelect = screen.getByLabelText(/Tipo Declaracion/i)
    await user.click(declTypeSelect)

    const h7Option = screen.getByRole('option', { name: /H7 \(Bajo Valor\)/i })
    await user.click(h7Option)

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(queryAPI.byBillOfLading).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'BL-FILTERED',
          declarationType: 'H7'
        })
      )
    })
  })

  test('clears searchValue when changing query type', async () => {
    const user = userEvent.setup()
    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-TEST' } })
    expect(input.value).toBe('BL-TEST')

    const contButton = screen.getByRole('button', { name: /Contenedor/i })
    await user.click(contButton)

    const newInput = screen.getByLabelText(/Contenedor/i)
    expect(newInput.value).toBe('')
  })

  test('handles network error in getHistory', async () => {
    queryAPI.getHistory.mockRejectedValueOnce(new Error('Network error'))

    render(<QueryDashboard />)

    await waitFor(() => {
      expect(queryAPI.getHistory).toHaveBeenCalled()
    })
  })

  test('handles network error in getStats', async () => {
    queryAPI.getStats.mockRejectedValueOnce(new Error('Stats error'))

    render(<QueryDashboard />)

    await waitFor(() => {
      expect(queryAPI.getStats).toHaveBeenCalled()
    })
  })

  test('handles network error in get query detail', async () => {
    queryAPI.get.mockRejectedValueOnce(new Error('Query detail error'))
    const user = userEvent.setup()

    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText('QID-001')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByLabelText('Ver resultados')
    await user.click(infoButtons[0])

    await waitFor(() => {
      expect(queryAPI.get).toHaveBeenCalledWith('QID-001')
    })
  })

  test('renders history table with all status chips', async () => {
    queryAPI.getHistory.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            _id: 'q1',
            queryId: 'Q1',
            queryType: 'QIntNuCono',
            searchParams: { billOfLading: 'BL1' },
            queryStatus: 'pending',
            resultsCount: 0,
            executedAt: '2026-08-04T10:00:00Z'
          },
          {
            _id: 'q2',
            queryId: 'Q2',
            queryType: 'QIntCont',
            searchParams: { containerNumber: 'TCNU123' },
            queryStatus: 'processing',
            resultsCount: 0,
            executedAt: '2026-08-04T11:00:00Z'
          },
          {
            _id: 'q3',
            queryId: 'Q3',
            queryType: 'QIntUbic',
            searchParams: { locationCode: 'LOC123' },
            queryStatus: 'timeout',
            resultsCount: 0,
            executedAt: '2026-08-04T12:00:00Z'
          }
        ],
        pagination: { total: 3 }
      }
    })

    const user = userEvent.setup()
    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText('Pendiente')).toBeInTheDocument()
    })

    expect(screen.getByText('Procesando')).toBeInTheDocument()
    expect(screen.getByText('Timeout')).toBeInTheDocument()
  })

  test('displays formatted dates in history and results', async () => {
    const user = userEvent.setup()
    render(<QueryDashboard />)

    const historialTab = screen.getByRole('tab', { name: /Historial/i })
    await user.click(historialTab)

    await waitFor(() => {
      expect(screen.getByText(/04\/08\/2026/)).toBeInTheDocument()
    })
  })

  test('handles results with missing optional fields', async () => {
    queryAPI.byBillOfLading.mockResolvedValueOnce({
      data: {
        success: true,
        count: 1,
        results: [
          {
            mrn: '26ESMAD00009999',
            declarationType: 'H1',
            status: 'DRAFT',
            customsOffice: {},
            declarant: {}
          }
        ]
      }
    })

    render(<QueryDashboard />)

    const input = screen.getByLabelText(/Conocimiento \(B\/L\)/i)
    fireEvent.change(input, { target: { value: 'BL-MINIMAL' } })

    const searchButton = screen.getByRole('button', { name: /Buscar/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('26ESMAD00009999')).toBeInTheDocument()
    })

    expect(screen.queryByText('LRN:')).not.toBeInTheDocument()
  })
})
