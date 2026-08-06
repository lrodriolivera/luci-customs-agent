import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import H7DeclarationList from './H7DeclarationList'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>
  }
})

vi.mock('../../services/api', () => ({
  h7API: {
    list: vi.fn(),
    getStats: vi.fn(),
    submit: vi.fn(),
    validate: vi.fn(),
    create: vi.fn()
  }
}))

vi.mock('./ManifestUploader', () => ({
  default: ({ onClose, onCreated }) => (
    <div data-testid="manifest-uploader">
      <button onClick={onClose}>Close</button>
      <button onClick={onCreated}>Created</button>
    </div>
  )
}))

vi.mock('./EU2026382Banner', () => ({
  default: () => <div data-testid="eu-banner">EU2026/382 Banner</div>
}))

const mockDeclarations = [
  {
    _id: 'h7-001',
    reference: 'H7-2026-001',
    trackingNumber: 'TRK123456',
    carrier: { code: 'DHL', name: 'DHL Express' },
    recipient: { name: 'Juan Pérez', taxId: '12345678A' },
    totals: { customsValue: 120.5 },
    duties: { totalDue: 25.3 },
    status: 'draft',
    mrn: null,
    vatPrepaid: false
  },
  {
    _id: 'h7-002',
    reference: 'H7-2026-002',
    trackingNumber: 'TRK789012',
    carrier: { code: 'UPS', name: 'UPS' },
    recipient: { name: 'María García', taxId: '87654321B' },
    totals: { customsValue: 95.0 },
    duties: { totalDue: 19.95 },
    status: 'submitted',
    mrn: '26ES00001234567890123456',
    vatPrepaid: false
  },
  {
    _id: 'h7-003',
    reference: 'H7-2026-003',
    trackingNumber: 'TRK345678',
    carrier: { code: 'CORREOS', name: 'Correos' },
    recipient: { name: 'Pedro López', taxId: '11223344C' },
    totals: { customsValue: 145.0 },
    status: 'accepted',
    mrn: '26ES00001234567890123457',
    vatPrepaid: true
  }
]

const mockStats = {
  totals: {
    declarations: 42,
    value: 3456.78,
    duties: 987.65
  },
  byCarrier: ['DHL', 'UPS', 'CORREOS']
}

describe('<H7DeclarationList />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('activeCustomsCountry', 'ES')

    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: mockDeclarations,
        pagination: {
          total: 3,
          pages: 1,
          page: 1,
          limit: 20
        }
      }
    })

    h7API.getStats.mockResolvedValue({
      data: {
        success: true,
        data: mockStats
      }
    })
  })

  test('renderiza título, subtítulo y banner EU 2026/382', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    expect(screen.getByText('h7.title')).toBeInTheDocument()
    expect(screen.getByText('h7.subtitle')).toBeInTheDocument()
    expect(screen.getByTestId('eu-banner')).toBeInTheDocument()
  })

  test('carga declaraciones y stats al montar', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(h7API.list).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: '',
        carrier: '',
        search: ''
      })
      expect(h7API.getStats).toHaveBeenCalled()
    })
  })

  test('muestra loading spinner durante la carga', () => {
    h7API.list.mockImplementation(() => new Promise(() => {}))

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('muestra error toast cuando list falla', async () => {
    h7API.list.mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('h7.loadingH7Error'))
  })

  test('muestra mensaje de vacío cuando no hay declaraciones', async () => {
    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: [],
        pagination: { total: 0, pages: 0, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('h7.noDeclarations')).toBeInTheDocument())
    expect(screen.getByText('h7.createFirst')).toBeInTheDocument()
  })

  test('renderiza tabla con declaraciones correctamente', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('H7-2026-001')).toBeInTheDocument())

    expect(screen.getByText('TRK123456')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('12345678A')).toBeInTheDocument()
    expect(screen.getByText('DHL')).toBeInTheDocument()
  })

  test.each([
    ['draft', 'h7.statusDraft'],
    ['validating', 'h7.statusValidating'],
    ['pending', 'h7.statusPending'],
    ['submitted', 'h7.statusSent'],
    ['accepted', 'h7.statusAccepted'],
    ['held', 'h7.statusHeld'],
    ['rejected', 'h7.statusRejected'],
    ['released', 'h7.statusRelease'],
    ['delivered', 'h7.statusDelivered'],
    ['returned', 'h7.statusReturned'],
    ['cancelled', 'h7.statusCancelled']
  ])('renderiza status badge correcto: %s', async (status, expectedLabel) => {
    const declWithStatus = [{
      ...mockDeclarations[0],
      _id: 'test-status',
      reference: 'TEST-STATUS',
      status
    }]

    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: declWithStatus,
        pagination: { total: 1, pages: 1, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(expectedLabel)).toBeInTheDocument())
  })

  test('muestra stats en las tarjetas superiores', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())

    expect(screen.getByText('h7.totalDeclarations')).toBeInTheDocument()
    expect(screen.getByText('h7.totalValue')).toBeInTheDocument()
    expect(screen.getByText('h7.dutiesCollected')).toBeInTheDocument()
    expect(screen.getByText('h7.carriers')).toBeInTheDocument()
  })

  test('toggle de filtros muestra/oculta el formulario de filtros', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    expect(screen.queryByText('h7.searchLabel')).not.toBeInTheDocument()

    const filterButton = screen.getByText('h7.filters')
    fireEvent.click(filterButton)

    expect(screen.getByText('h7.searchLabel')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('h7.searchPlaceholder')).toBeInTheDocument()
  })

  test('filtro por status recarga declaraciones con el filtro aplicado', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('h7.filters'))

    const selects = screen.getAllByRole('combobox')
    const statusSelect = selects[0]
    fireEvent.change(statusSelect, { target: { value: 'accepted' } })

    await waitFor(() => {
      expect(h7API.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'accepted' })
      )
    })
  })

  test('filtro por carrier recarga declaraciones', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('h7.filters'))

    const selects = screen.getAllByRole('combobox')
    const carrierSelect = selects[1]
    fireEvent.change(carrierSelect, { target: { value: 'DHL' } })

    await waitFor(() => {
      expect(h7API.list).toHaveBeenCalledWith(
        expect.objectContaining({ carrier: 'DHL' })
      )
    })
  })

  test('búsqueda por tracking/ref resetea paginación y recarga', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('h7.filters'))

    const searchInput = screen.getByPlaceholderText('h7.searchPlaceholder')
    fireEvent.change(searchInput, { target: { value: 'TRK123' } })

    const form = searchInput.closest('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(h7API.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'TRK123', page: 1 })
      )
    })
  })

  test('botón submit de draft llama a h7API.submit y recarga', async () => {
    h7API.submit.mockResolvedValue({
      data: {
        success: true,
        data: { mrn: '26ES00001234567890999999' }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('h7.sendLabel')).toBeInTheDocument())

    const submitButton = screen.getByText('h7.sendLabel')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(h7API.submit).toHaveBeenCalledWith('h7-001')
      expect(toast.success).toHaveBeenCalledWith('h7.declarationSent')
      expect(h7API.list).toHaveBeenCalledTimes(2)
      expect(h7API.getStats).toHaveBeenCalledTimes(2)
    })
  })

  test('botón submit con error muestra toast de error', async () => {
    h7API.submit.mockRejectedValue(new Error('AEAT down'))

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('h7.sendLabel')).toBeInTheDocument())

    fireEvent.click(screen.getByText('h7.sendLabel'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('h7.errorSendingDecl'))
  })

  test('declaraciones no-draft no muestran botón de submit', async () => {
    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: [mockDeclarations[1]],
        pagination: { total: 1, pages: 1, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('H7-2026-002')).toBeInTheDocument())

    expect(screen.queryByText('h7.sendLabel')).not.toBeInTheDocument()
  })

  test('botón Ver enlaza al detalle correcto', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('H7-2026-001')).toBeInTheDocument())

    const viewLinks = screen.getAllByText('h7.viewLabel')
    expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/h7/h7-001')
  })

  test('declaración con IOSS muestra texto IOSS en vez de duties', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('H7-2026-003')).toBeInTheDocument())

    expect(screen.getByText('h7.iossPaidLabel')).toBeInTheDocument()
  })

  test('paginación se renderiza solo cuando hay más de 1 página', async () => {
    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: mockDeclarations,
        pagination: { total: 40, pages: 2, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    expect(screen.getByText('common.previous')).toBeInTheDocument()
    expect(screen.getByText('common.next')).toBeInTheDocument()
  })

  test('paginación: botón anterior deshabilitado en página 1', async () => {
    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: mockDeclarations,
        pagination: { total: 40, pages: 2, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    const prevButton = screen.getByText('common.previous')
    expect(prevButton).toBeDisabled()
  })

  test('paginación: botón siguiente cambia de página', async () => {
    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: mockDeclarations,
        pagination: { total: 40, pages: 2, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    const nextButton = screen.getByText('common.next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(h7API.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      )
    })
  })

  test('paginación: botón siguiente deshabilitado cuando se alcanza última página', async () => {
    h7API.list
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: mockDeclarations,
          pagination: { total: 40, pages: 2, page: 1, limit: 20 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: mockDeclarations,
          pagination: { total: 40, pages: 2, page: 2, limit: 20 }
        }
      })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    const nextButton = screen.getByText('common.next')
    expect(nextButton).not.toBeDisabled()

    fireEvent.click(nextButton)

    await waitFor(() => expect(nextButton).toBeDisabled())
  })

  test('modal ManifestUploader se abre y cierra correctamente', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    expect(screen.queryByTestId('manifest-uploader')).not.toBeInTheDocument()

    const importButton = screen.getByText('Importar Manifiesto')
    fireEvent.click(importButton)

    expect(screen.getByTestId('manifest-uploader')).toBeInTheDocument()

    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    await waitFor(() => expect(screen.queryByTestId('manifest-uploader')).not.toBeInTheDocument())
  })

  test('modal ManifestUploader recarga datos cuando se completa la creación', async () => {
    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Importar Manifiesto'))

    const createdButton = screen.getByText('Created')
    fireEvent.click(createdButton)

    await waitFor(() => {
      expect(h7API.list).toHaveBeenCalledTimes(2)
      expect(h7API.getStats).toHaveBeenCalledTimes(2)
    })
  })

  test('botón Nueva DECO (NL) aparece cuando activeCustomsCountry=NL', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    expect(screen.getByText('Nueva DECO')).toBeInTheDocument()
  })

  test('botón Batch DECO (NL) aparece solo cuando activeCustomsCountry=NL', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    expect(screen.getByText('Batch DECO')).toBeInTheDocument()
  })

  test('modal Batch DECO se abre y cierra correctamente', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    expect(screen.getByText(/Selecciona declaraciones H7/)).toBeInTheDocument()

    const cancelButton = screen.getByText('common.cancel')
    fireEvent.click(cancelButton)

    await waitFor(() => expect(screen.queryByText(/Selecciona declaraciones H7/)).not.toBeInTheDocument())
  })

  test('modal Batch DECO muestra mensaje cuando no hay drafts', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')
    h7API.list.mockResolvedValue({
      data: {
        success: true,
        data: [mockDeclarations[1]],
        pagination: { total: 1, pages: 1, page: 1, limit: 20 }
      }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    expect(screen.getByText('No hay declaraciones en borrador para enviar')).toBeInTheDocument()
  })

  test('modal Batch DECO permite seleccionar drafts', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    const checkbox = document.querySelector('input[type="checkbox"]')
    fireEvent.click(checkbox)

    expect(screen.getByText('1 declaracion(es) seleccionada(s)')).toBeInTheDocument()
  })

  test('modal Batch DECO submit sin selección está deshabilitado', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    await waitFor(() => expect(screen.getByText(/Selecciona declaraciones H7/)).toBeInTheDocument())

    const submitButton = screen.getByText(/Enviar Batch DECO/)
    expect(submitButton).toBeDisabled()
  })

  test('modal Batch DECO submit exitoso recarga datos', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')
    h7API.submit.mockResolvedValue({
      data: { success: true, data: { mrn: '26NL00001234567890123456' } }
    })

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    await waitFor(() => expect(screen.getByText(/Selecciona declaraciones H7/)).toBeInTheDocument())

    const checkbox = document.querySelector('input[type="checkbox"]')
    fireEvent.click(checkbox)

    await waitFor(() => expect(screen.getByText('1 declaracion(es) seleccionada(s)')).toBeInTheDocument())

    const submitButton = screen.getByText(/Enviar Batch DECO \(1\)/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(h7API.submit).toHaveBeenCalledWith('h7-001')
      expect(toast.success).toHaveBeenCalledWith('1 declaracion(es) enviada(s) a DECO')
      expect(h7API.list).toHaveBeenCalledTimes(2)
    }, { timeout: 5000 })
  })

  test('modal Batch DECO submit con error muestra toast error', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')
    h7API.submit.mockRejectedValue(new Error('DECO error'))

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    await waitFor(() => expect(screen.getByText(/Selecciona declaraciones H7/)).toBeInTheDocument())

    const checkbox = document.querySelector('input[type="checkbox"]')
    fireEvent.click(checkbox)

    await waitFor(() => expect(screen.getByText('1 declaracion(es) seleccionada(s)')).toBeInTheDocument())

    const submitButton = screen.getByText(/Enviar Batch DECO \(1\)/)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error enviando lote DECO')
    }, { timeout: 5000 })
  })

  test('CSV upload en modal Batch DECO muestra toast de confirmación', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')

    render(
      <MemoryRouter>
        <H7DeclarationList />
      </MemoryRouter>
    )

    await waitFor(() => expect(h7API.list).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Batch DECO'))

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['tracking,sender,recipient'], 'test.csv', { type: 'text/csv' })

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })

    fireEvent.change(fileInput)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('test.csv')))
  })

})
