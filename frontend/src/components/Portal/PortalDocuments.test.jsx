import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

vi.mock('react-dropzone', () => ({
  useDropzone: () => ({ getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false })
}))

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../../services/api', () => ({
  portalAPI: { uploadDocument: vi.fn() }
}))

import PortalDocuments from './PortalDocuments'

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
})
