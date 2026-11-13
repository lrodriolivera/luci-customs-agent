import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

/**
 * PortalDocuments — la pantalla donde el cliente final sube sus documentos.
 *
 * No tenia tests, y por eso paso desapercibido que comparaba operationType
 * contra 'IMPORT' en mayusculas cuando el backend lo guarda en minusculas
 * ('import' / 'export'). Toda importacion caia al else y se anunciaba al
 * cliente como expediente "de exportacion", que es justo lo contrario.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let outletContext = {}
vi.mock('react-router-dom', () => ({
  useOutletContext: () => outletContext
}))

// Capturamos el onDrop real que PortalDocuments pasa a useDropzone para
// poder disparar una subida de fichero en el test, sin depender del drag&drop
// del navegador (que jsdom no simula).
let capturedOnDrop
vi.mock('react-dropzone', () => ({
  useDropzone: (opts) => {
    capturedOnDrop = opts.onDrop
    return { getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false }
  }
}))

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../../services/api', () => ({
  portalAPI: { uploadDocument: vi.fn() }
}))

import PortalDocuments from './PortalDocuments'
import { portalAPI } from '../../services/api'

describe('PortalDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('anuncia una importacion como importacion', () => {
    // 'import' en minusculas es lo que devuelve /api/portal/:token,
    // verificado contra produccion el 6/Ago/2026.
    outletContext = { expedition: { operationType: 'import' }, token: 'tok-abc' }

    render(<PortalDocuments />)

    expect(screen.getByText('portal.uploadSubtitleImport')).toBeInTheDocument()
    expect(screen.queryByText('portal.uploadSubtitleExport')).not.toBeInTheDocument()
  })

  // UAT 11/Nov/2026: el portal pedia la autorizacion de despacho pero no ofrecia
  // ese tipo para subirla; y la poliza usaba un tipo que el modelo no admite.
  it('ofrece subir la autorizacion de despacho y la poliza de seguro', () => {
    outletContext = { expedition: { operationType: 'import' }, token: 'tok-abc' }

    render(<PortalDocuments />)

    expect(screen.getByRole('button', { name: 'portal.docDispatchAuthorization' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'portal.docInsurance' })).toBeInTheDocument()
  })

  it('al elegir la autorizacion de despacho pide su fecha; con otro tipo no', () => {
    outletContext = { expedition: { operationType: 'import' }, token: 'tok-abc' }
    render(<PortalDocuments />)
    expect(screen.queryByLabelText(/portal.authDate/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'portal.docDispatchAuthorization' }))
    expect(screen.getByLabelText(/portal.authDate/)).toBeInTheDocument()
    expect(screen.getByText('portal.authDateHint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'portal.docInsurance' }))
    expect(screen.queryByLabelText(/portal.authDate/)).not.toBeInTheDocument()
  })

  it('anuncia una exportacion como exportacion', () => {
    outletContext = { expedition: { operationType: 'export' }, token: 'tok-abc' }

    render(<PortalDocuments />)

    expect(screen.getByText('portal.uploadSubtitleExport')).toBeInTheDocument()
    expect(screen.queryByText('portal.uploadSubtitleImport')).not.toBeInTheDocument()
  })

  it('sigue reconociendo la importacion si llega en mayusculas', () => {
    // Defensivo: no todos los endpoints normalizan igual, y la pantalla no
    // deberia mentirle al cliente por una diferencia de caja.
    outletContext = { expedition: { operationType: 'IMPORT' }, token: 'tok-abc' }

    render(<PortalDocuments />)

    expect(screen.getByText('portal.uploadSubtitleImport')).toBeInTheDocument()
  })

  it('muestra el nombre real del documento y lo marca como subido, usando la forma que devuelve /api/portal/:token', () => {
    // portalController.js (clientView.documentChecklist) devuelve documentName/received,
    // no name/uploaded. Si el componente lee los campos equivocados, el nombre no
    // aparece y el item nunca se pinta como subido aunque received:true.
    outletContext = {
      expedition: {
        operationType: 'import',
        documentChecklist: [
          { documentType: 'commercial_invoice', documentName: 'Factura Comercial', required: true, received: true, validated: false }
        ]
      },
      token: 'tok-abc'
    }

    render(<PortalDocuments />)

    const nombre = screen.getByText('Factura Comercial')
    expect(nombre).toBeInTheDocument()
    expect(nombre.className).toContain('text-green-700')
  })

  // Bug 13/Nov/2026: el portal mandaba el fichero en el campo 'document', pero
  // el backend monta upload.single('file') en POST /api/portal/:token/documents
  // (src/routes/portal.js). Multer rechazaba el campo inesperado y la subida
  // fallaba siempre, aunque el cliente adjuntara un fichero valido.
  it('envia el fichero en el campo "file" que espera el backend, no en "document"', async () => {
    outletContext = { expedition: { operationType: 'import' }, token: 'tok-abc' }
    portalAPI.uploadDocument.mockResolvedValue({ data: { success: true } })

    render(<PortalDocuments />)
    fireEvent.click(screen.getByRole('button', { name: 'portal.docCommercialInvoice' }))

    const file = new File(['contenido factura'], 'factura.pdf', { type: 'application/pdf' })
    await act(async () => {
      await capturedOnDrop([file])
    })

    expect(portalAPI.uploadDocument).toHaveBeenCalledTimes(1)
    const [, formDataEnviado] = portalAPI.uploadDocument.mock.calls[0]
    expect(formDataEnviado.get('file')).toBe(file)
    expect(formDataEnviado.get('document')).toBeNull()
  })
})
