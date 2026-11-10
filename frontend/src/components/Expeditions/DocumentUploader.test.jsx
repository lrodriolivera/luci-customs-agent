import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentUploader, { DOCUMENT_TYPES } from './DocumentUploader'
import { documentsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  documentsAPI: { upload: vi.fn() }
}))

const pdf = () => new File(['%PDF'], 'factura.pdf', { type: 'application/pdf' })

const selectFile = (file) =>
  fireEvent.change(screen.getByLabelText('expeditions.uploadFile'), { target: { files: [file] } })

describe('DocumentUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('ofrece los 22 tipos de documento que acepta el backend', () => {
    render(<DocumentUploader expeditionId="exp123" onUploaded={vi.fn()} />)

    expect(DOCUMENT_TYPES).toHaveLength(22)
    expect(screen.getByLabelText('expeditions.uploadDocumentType').querySelectorAll('option')).toHaveLength(22)
  })

  test('sube el fichero con el expediente y el tipo elegidos y avisa al padre', async () => {
    documentsAPI.upload.mockResolvedValueOnce({ data: { success: true } })
    const onUploaded = vi.fn()
    render(<DocumentUploader expeditionId="exp123" onUploaded={onUploaded} />)

    const file = pdf()
    fireEvent.change(screen.getByLabelText('expeditions.uploadDocumentType'), { target: { value: 'packing_list' } })
    selectFile(file)
    fireEvent.click(screen.getByText('expeditions.uploadButton'))

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    // Por defecto pide leer el documento recién subido (sin documento en la respuesta: null).
    expect(onUploaded).toHaveBeenCalledWith(null, true)
    expect(documentsAPI.upload).toHaveBeenCalledWith('exp123', file, 'packing_list')
    expect(toast.success).toHaveBeenCalledWith('expeditions.uploadSuccess')
  })

  test('entrega al padre el documento creado y respeta la casilla de leer con IA', async () => {
    const creado = { _id: 'doc1', type: 'commercial_invoice' }
    documentsAPI.upload.mockResolvedValue({ data: { success: true, data: { document: creado } } })
    const onUploaded = vi.fn()
    render(<DocumentUploader expeditionId="exp123" onUploaded={onUploaded} />)

    expect(screen.getByLabelText('docReading.readOnUpload')).toBeChecked()
    fireEvent.click(screen.getByLabelText('docReading.readOnUpload'))
    selectFile(pdf())
    fireEvent.click(screen.getByText('expeditions.uploadButton'))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(creado, false))
  })

  test('sin fichero no llama a la API', () => {
    render(<DocumentUploader expeditionId="exp123" onUploaded={vi.fn()} />)

    fireEvent.click(screen.getByText('expeditions.uploadButton'))

    expect(documentsAPI.upload).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('expeditions.uploadSelectFile')
  })

  test('rechaza un fichero de más de 50 MB sin subirlo', () => {
    render(<DocumentUploader expeditionId="exp123" onUploaded={vi.fn()} />)

    const grande = pdf()
    Object.defineProperty(grande, 'size', { value: 50 * 1024 * 1024 + 1 })
    selectFile(grande)
    fireEvent.click(screen.getByText('expeditions.uploadButton'))

    expect(toast.error).toHaveBeenCalledWith('expeditions.uploadTooLarge')
    expect(documentsAPI.upload).not.toHaveBeenCalled()
  })

  test('muestra el error del backend y no avisa al padre', async () => {
    documentsAPI.upload.mockRejectedValueOnce({ response: { data: { error: 'Tipo de archivo no permitido' } } })
    const onUploaded = vi.fn()
    render(<DocumentUploader expeditionId="exp123" onUploaded={onUploaded} />)

    selectFile(pdf())
    fireEvent.click(screen.getByText('expeditions.uploadButton'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tipo de archivo no permitido'))
    expect(onUploaded).not.toHaveBeenCalled()
  })

  test('sin respuesta del servidor muestra el error genérico', async () => {
    documentsAPI.upload.mockRejectedValueOnce(new Error('Network Error'))
    render(<DocumentUploader expeditionId="exp123" onUploaded={vi.fn()} />)

    selectFile(pdf())
    fireEvent.click(screen.getByText('expeditions.uploadButton'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('expeditions.uploadError'))
  })
})
