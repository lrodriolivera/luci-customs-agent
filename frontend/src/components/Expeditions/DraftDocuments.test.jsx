import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DraftDocuments, { MAX_DRAFTS } from './DraftDocuments'
import { documentsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts && Object.keys(opts).some((k) => k !== 'defaultValue') ? `${key}:${JSON.stringify(opts)}` : key) })
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({ documentsAPI: { readDraft: vi.fn(), removeDraft: vi.fn() } }))

const archivo = (nombre = 'factura.pdf') => new File(['%PDF'], nombre, { type: 'application/pdf' })
const elegir = (files) => fireEvent.change(screen.getByLabelText('draftDocs.selectFiles'), { target: { files } })
const borrador = (extra = {}) => ({
  id: 'd1', type: 'commercial_invoice', originalName: 'factura.pdf',
  extraction: { legible: true, leido: true, confianza: 91, notas: [] },
  rellenados: [], avisos: [], ...extra
})
const props = (extra = {}) => ({ drafts: [], onRead: vi.fn(), onRemove: vi.fn(), onTypeChange: vi.fn(), ...extra })

describe('DraftDocuments', () => {
  beforeEach(() => vi.clearAllMocks())

  test('sube cada archivo, lo lee y entrega la lectura al alta, en orden', async () => {
    documentsAPI.readDraft
      .mockResolvedValueOnce({ data: { data: { draft: { id: 'a', type: 'commercial_invoice', originalName: 'factura.pdf' }, extraction: { legible: true } } } })
      .mockResolvedValueOnce({ data: { data: { draft: { id: 'b', type: 'packing_list', originalName: 'packing.pdf' }, extraction: { legible: true } } } })
    const p = props()
    render(<DraftDocuments {...p} />)
    const factura = archivo()
    const packing = archivo('packing.pdf')

    elegir([factura, packing])

    await waitFor(() => expect(p.onRead).toHaveBeenCalledTimes(2))
    expect(documentsAPI.readDraft).toHaveBeenNthCalledWith(1, factura, 'other')
    expect(documentsAPI.readDraft).toHaveBeenNthCalledWith(2, packing, 'other')
    expect(p.onRead.mock.calls.map((c) => c[0].id)).toEqual(['a', 'b'])
  })

  test('si un archivo falla, avisa con su nombre y sigue con el siguiente', async () => {
    documentsAPI.readDraft
      .mockRejectedValueOnce({ response: { data: { error: 'Tipo de archivo no permitido' } } })
      .mockResolvedValueOnce({ data: { data: { draft: { id: 'b' }, extraction: null } } })
    const p = props()
    render(<DraftDocuments {...p} />)

    elegir([archivo('raro.exe'), archivo()])

    await waitFor(() => expect(p.onRead).toHaveBeenCalledTimes(1))
    expect(toast.error).toHaveBeenCalledWith('raro.exe: Tipo de archivo no permitido')
  })

  test('no admite mas documentos de los que acepta el backend', () => {
    const drafts = Array.from({ length: MAX_DRAFTS }, (_, i) => borrador({ id: `d${i}` }))
    render(<DraftDocuments {...props({ drafts })} />)

    elegir([archivo()])

    expect(documentsAPI.readDraft).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  test('no sube un archivo que supera el limite de tamaño', async () => {
    const grande = archivo('grande.pdf')
    Object.defineProperty(grande, 'size', { value: 51 * 1024 * 1024 })
    render(<DraftDocuments {...props()} />)

    elegir([grande])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('grande.pdf: expeditions.uploadTooLarge'))
    expect(documentsAPI.readDraft).not.toHaveBeenCalled()
  })

  test('muestra cuantos datos ha rellenado cada documento y cuales', () => {
    const drafts = [borrador({ rellenados: [
      { campo: 'clientName', valor: 'Importadora SL', clave: 'clientName' },
      { campo: 'invoiceValue', valor: '184800', partida: 1, clave: 'invoiceValue|1' }
    ] })]
    render(<DraftDocuments {...props({ drafts })} />)

    expect(screen.getByText(/draftDocs.filledCount:\{"count":2\}/)).toBeInTheDocument()
    expect(screen.getByText('Importadora SL')).toBeInTheDocument()
    expect(screen.getByText('184800')).toBeInTheDocument()
    expect(screen.getByText('draftDocs.review')).toBeInTheDocument()
  })

  test('un documento ilegible lo dice y no anuncia datos rellenados', () => {
    const drafts = [borrador({ extraction: { legible: false, leido: true, notas: ['Pagina en blanco'] } })]
    render(<DraftDocuments {...props({ drafts })} />)

    expect(screen.getByText('draftDocs.notReadable')).toBeInTheDocument()
    expect(screen.getByText('Pagina en blanco')).toBeInTheDocument()
    expect(screen.queryByText('draftDocs.review')).not.toBeInTheDocument()
  })

  test('enseña los avisos cuando el documento contradice el formulario', () => {
    const drafts = [borrador({ avisos: [
      { campo: 'clientName', valor: 'Importadora SL', actual: 'Otra SA' },
      { campo: 'itemsMismatch', valor: 3, actual: 1 }
    ] })]
    render(<DraftDocuments {...props({ drafts })} />)

    expect(screen.getByText(/draftDocs.warn.differs:.*Importadora SL.*Otra SA/)).toBeInTheDocument()
    expect(screen.getByText(/draftDocs.warn.itemsMismatch:\{"value":3,"current":1\}/)).toBeInTheDocument()
  })

  test('el agente puede corregir el tipo del documento', () => {
    const p = props({ drafts: [borrador()] })
    render(<DraftDocuments {...p} />)

    fireEvent.change(screen.getByLabelText('expeditions.uploadDocumentType: factura.pdf'), { target: { value: 'packing_list' } })

    expect(p.onTypeChange).toHaveBeenCalledWith('d1', 'packing_list')
  })

  test('quitar un documento lo borra del servidor y del alta', async () => {
    documentsAPI.removeDraft.mockResolvedValueOnce({ data: { success: true } })
    const p = props({ drafts: [borrador()] })
    render(<DraftDocuments {...p} />)

    fireEvent.click(screen.getByLabelText('draftDocs.remove: factura.pdf'))

    await waitFor(() => expect(p.onRemove).toHaveBeenCalledWith('d1'))
    expect(documentsAPI.removeDraft).toHaveBeenCalledWith('d1')
  })

  test('si el servidor no puede borrarlo, el documento sigue en el alta', async () => {
    documentsAPI.removeDraft.mockRejectedValueOnce({ response: { status: 500, data: { error: 'Error al descartar el documento' } } })
    const p = props({ drafts: [borrador()] })
    render(<DraftDocuments {...p} />)

    fireEvent.click(screen.getByLabelText('draftDocs.remove: factura.pdf'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al descartar el documento'))
    expect(p.onRemove).not.toHaveBeenCalled()
  })

  test('si el borrador ya no existe en el servidor (caducado), se quita del alta', async () => {
    documentsAPI.removeDraft.mockRejectedValueOnce({ response: { status: 404 } })
    const p = props({ drafts: [borrador()] })
    render(<DraftDocuments {...p} />)

    fireEvent.click(screen.getByLabelText('draftDocs.remove: factura.pdf'))

    await waitFor(() => expect(p.onRemove).toHaveBeenCalledWith('d1'))
  })
})

describe('DraftDocuments compacto (pasos 2 y 3)', () => {
  test('resume documentos, datos rellenados y avisos en una linea', () => {
    const drafts = [
      borrador({ rellenados: [{ campo: 'clientName', valor: 'X', clave: 'clientName' }], avisos: [{ campo: 'itemsMismatch', valor: 2, actual: 1 }] }),
      borrador({ id: 'd2', rellenados: [{ campo: 'incotermCode', valor: 'FOB', clave: 'incotermCode' }] })
    ]
    render(<DraftDocuments {...props({ drafts, compact: true })} />)

    expect(screen.getByText('draftDocs.summary:{"documents":2,"count":2}')).toBeInTheDocument()
    expect(screen.getByText('draftDocs.summaryWarnings:{"count":1}')).toBeInTheDocument()
    expect(screen.queryByLabelText('draftDocs.selectFiles')).not.toBeInTheDocument()
  })

  test('sin documentos no ocupa nada', () => {
    const { container } = render(<DraftDocuments {...props({ compact: true })} />)
    expect(container).toBeEmptyDOMElement()
  })
})
