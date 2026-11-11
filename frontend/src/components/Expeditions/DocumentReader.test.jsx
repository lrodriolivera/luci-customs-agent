import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentReader from './DocumentReader'
import { documentsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({
  documentsAPI: { read: vi.fn(), proposal: vi.fn(), apply: vi.fn(), download: vi.fn(), remove: vi.fn() }
}))

const documento = { _id: 'doc1', type: 'packing_list', originalName: 'packing.pdf', mimeType: 'application/pdf' }
const extraccion = { legible: true, leido: true, confianza: 92, notas: ['La tabla detalla 1 bulto pero el total indica 12.'], leidoEn: '2026-11-10T20:00:00Z' }
const propuesta = [
  { clave: 'goods.0.netWeight', grupo: 'partida', campo: 'netWeight', partida: 1, actual: null, nuevo: 864 },
  { clave: 'goods.0.packages.quantity', grupo: 'partida', campo: 'packagesQuantity', partida: 1, actual: 90, nuevo: 12 },
  { clave: 'transport.loadType', grupo: 'transporte', campo: 'loadType', actual: null, nuevo: 'LCL' }
]
const respuestaLectura = { data: { data: { extraction: extraccion, proposal: propuesta } } }

const renderReader = (props = {}) => {
  const onApplied = vi.fn(); const onRead = vi.fn()
  render(<DocumentReader expeditionId="exp1" document={documento} onApplied={onApplied} onRead={onRead} {...props} />)
  return { onApplied, onRead }
}

describe('DocumentReader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsAPI.read.mockResolvedValue(respuestaLectura)
  })

  test('un documento sin leer ofrece leerlo y no llama a la IA por su cuenta', () => {
    renderReader()

    expect(screen.getByText('docReading.read')).toBeInTheDocument()
    expect(screen.queryByText('docReading.show')).not.toBeInTheDocument()
    expect(documentsAPI.read).not.toHaveBeenCalled()
  })

  test('el documento recién subido se lee solo y avisa al padre', async () => {
    const { onRead } = renderReader({ autoRead: true })

    await waitFor(() => expect(documentsAPI.read).toHaveBeenCalledWith('exp1', 'doc1'))
    expect(await screen.findByText('docReading.readOk:{"confidence":92}')).toBeInTheDocument()
    expect(onRead).toHaveBeenCalled()
  })

  test('muestra las notas y la propuesta: marca lo que rellena un hueco, no lo que cambia un dato', async () => {
    renderReader()
    fireEvent.click(screen.getByText('docReading.read'))

    expect(await screen.findByText('La tabla detalla 1 bulto pero el total indica 12.')).toBeInTheDocument()
    expect(screen.getByLabelText('docReading.item:{"number":1} · docReading.field.netWeight')).toBeChecked()
    expect(screen.getByLabelText('docReading.field.loadType')).toBeChecked()
    expect(screen.getByLabelText('docReading.item:{"number":1} · docReading.field.packagesQuantity')).not.toBeChecked()
    expect(screen.getByText('docReading.apply:{"count":2}')).toBeInTheDocument()
    expect(screen.getByText(/docReading\.changes/)).toBeInTheDocument()
  })

  test('aplica solo lo marcado y entrega el expediente actualizado al padre', async () => {
    const actualizado = { _id: 'exp1', goods: [{ netWeight: 864 }] }
    documentsAPI.apply.mockResolvedValue({ data: { data: { expedition: actualizado, applied: [{}, {}, {}], proposal: [] } } })
    const { onApplied } = renderReader()
    fireEvent.click(screen.getByText('docReading.read'))
    await screen.findByText('docReading.apply:{"count":2}')

    fireEvent.click(screen.getByLabelText('docReading.item:{"number":1} · docReading.field.packagesQuantity'))
    fireEvent.click(screen.getByText('docReading.apply:{"count":3}'))

    await waitFor(() => expect(documentsAPI.apply).toHaveBeenCalledWith('exp1', 'doc1', ['goods.0.netWeight', 'transport.loadType', 'goods.0.packages.quantity']))
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(actualizado))
    expect(toast.success).toHaveBeenCalledWith('docReading.applied:{"count":3}')
    expect(await screen.findByText('docReading.nothingToApply')).toBeInTheDocument()
  })

  test('sin nada marcado no se puede aplicar', async () => {
    renderReader()
    fireEvent.click(screen.getByText('docReading.read'))
    await screen.findByText('docReading.apply:{"count":2}')

    fireEvent.click(screen.getByLabelText('docReading.item:{"number":1} · docReading.field.netWeight'))
    fireEvent.click(screen.getByLabelText('docReading.field.loadType'))

    expect(screen.getByText('docReading.apply:{"count":0}')).toBeDisabled()
  })

  test('un documento que no se pudo leer lo dice, con el motivo, y no propone nada', async () => {
    documentsAPI.read.mockResolvedValue({ data: { data: { extraction: { legible: false, leido: false, notas: ['Formato no soportado'] }, proposal: [] } } })
    renderReader()
    fireEvent.click(screen.getByText('docReading.read'))

    expect(await screen.findByText('docReading.notReadable')).toBeInTheDocument()
    expect(screen.getByText('Formato no soportado')).toBeInTheDocument()
    expect(screen.queryByText(/docReading\.apply/)).not.toBeInTheDocument()
  })

  test('si la lectura falla muestra el error del backend', async () => {
    documentsAPI.read.mockRejectedValue({ response: { data: { error: 'Error al leer el documento' } } })
    renderReader()
    fireEvent.click(screen.getByText('docReading.read'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al leer el documento'))
  })

  test('un documento ya leído ofrece ver la propuesta sin volver a llamar a la IA', async () => {
    documentsAPI.proposal.mockResolvedValue({ data: { data: { proposal: propuesta } } })
    renderReader({ document: { ...documento, extractedData: extraccion } })

    expect(screen.getByText('docReading.readAgain')).toBeInTheDocument()
    fireEvent.click(screen.getByText('docReading.show'))

    expect(await screen.findByText('docReading.apply:{"count":2}')).toBeInTheDocument()
    expect(documentsAPI.proposal).toHaveBeenCalledWith('exp1', 'doc1')
    expect(documentsAPI.read).not.toHaveBeenCalled()
  })

  test('con la declaración presentada se ve lo leído pero no se puede aplicar', async () => {
    renderReader({ canApply: false })
    fireEvent.click(screen.getByText('docReading.read'))

    expect(await screen.findByText('docReading.locked')).toBeInTheDocument()
    expect(screen.queryByText(/docReading\.apply:/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('docReading.field.loadType')).toBeDisabled()
  })

  test('los importes y los pesos de la propuesta van con formato español', async () => {
    documentsAPI.read.mockResolvedValue({ data: { data: { extraction: extraccion, proposal: [
      { clave: 'goods.0.invoiceValue', campo: 'invoiceValue', partida: 1, actual: 184.8, nuevo: 184800 },
      { clave: 'goods.0.grossWeight', campo: 'grossWeight', partida: 1, actual: null, nuevo: 1050.5 }
    ] } } })
    renderReader()
    fireEvent.click(screen.getByText('docReading.read'))

    expect(await screen.findByText('184.800,00')).toBeInTheDocument()
    expect(screen.getByText('184,80', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('1050,5 kg')).toBeInTheDocument()
  })

  test('abrir el documento pide el fichero al backend', async () => {
    documentsAPI.download.mockResolvedValue({ data: new Blob(['%PDF']) })
    window.URL.createObjectURL = vi.fn(() => 'blob:x'); window.URL.revokeObjectURL = vi.fn()
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderReader()

    fireEvent.click(screen.getByText('docReading.open'))

    await waitFor(() => expect(documentsAPI.download).toHaveBeenCalledWith('exp1', 'doc1'))
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('blob:x', '_blank', 'noopener'))
    abrir.mockRestore()
  })
})

describe('DocumentReader — eliminar un documento', () => {
  beforeEach(() => vi.clearAllMocks())

  test('sin permiso no ofrece eliminar', () => {
    renderReader()
    expect(screen.queryByText('docReading.delete')).not.toBeInTheDocument()
  })

  test('pide confirmación antes de borrar y se puede cancelar', () => {
    renderReader({ canDelete: true, onDeleted: vi.fn() })

    fireEvent.click(screen.getByText('docReading.delete'))
    expect(screen.getByText('docReading.deleteConfirm')).toBeInTheDocument()
    expect(documentsAPI.remove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('common.cancel'))
    expect(screen.queryByText('docReading.deleteConfirm')).not.toBeInTheDocument()
    expect(documentsAPI.remove).not.toHaveBeenCalled()
  })

  test('al confirmar borra el documento y entrega el expediente actualizado', async () => {
    const actualizado = { _id: 'exp1', documents: [] }
    documentsAPI.remove.mockResolvedValueOnce({ data: { data: { expedition: actualizado } } })
    const onDeleted = vi.fn()
    renderReader({ canDelete: true, onDeleted })

    fireEvent.click(screen.getByText('docReading.delete'))
    fireEvent.click(screen.getByText('docReading.deleteYes'))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(actualizado))
    expect(documentsAPI.remove).toHaveBeenCalledWith('exp1', 'doc1')
    expect(toast.success).toHaveBeenCalledWith('docReading.deleted')
  })

  test('si el servidor lo rechaza, muestra el motivo y el documento sigue ahí', async () => {
    documentsAPI.remove.mockRejectedValueOnce({ response: { data: { error: 'La declaracion ya esta presentada: sus documentos no se pueden eliminar' } } })
    const onDeleted = vi.fn()
    renderReader({ canDelete: true, onDeleted })

    fireEvent.click(screen.getByText('docReading.delete'))
    fireEvent.click(screen.getByText('docReading.deleteYes'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La declaracion ya esta presentada: sus documentos no se pueden eliminar'))
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByText('docReading.delete')).toBeInTheDocument()
  })
})
