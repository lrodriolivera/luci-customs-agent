import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import { MODULOS_VISIBLES } from './modulosVisibles'
import ENSDeclarationList from '../components/ENS/ENSDeclarationList'
import H7DeclarationList from '../components/H7/H7DeclarationList'
import { ensAPI, h7API } from '../services/api'

/**
 * Con la configuracion real (sin simular), la interfaz no ofrece el alta
 * directa de H7 ni la generacion de ENS. Reunion del 10/Nov/2026 y UAT del
 * 11/Nov/2026 con las agentes de aduanas.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../services/api', () => ({
  ensAPI: { list: vi.fn(), getStats: vi.fn(), get: vi.fn(), submit: vi.fn() },
  h7API: { list: vi.fn(), getStats: vi.fn(), submit: vi.fn(), validate: vi.fn(), create: vi.fn() }
}))
vi.mock('../components/ENS/ENSDeclarationForm', () => ({ default: () => null }))
vi.mock('../components/ENS/ENSBatchUpload', () => ({ default: () => null }))
vi.mock('../components/H7/ManifestUploader', () => ({ default: () => null }))
vi.mock('../components/H7/EU2026382Banner', () => ({ default: () => null }))

const vacio = { data: { success: true, data: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } } }
const sinEstadisticas = { data: { success: true, data: {} } }

describe('modulos ocultos en la interfaz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensAPI.list.mockResolvedValue(vacio)
    ensAPI.getStats.mockResolvedValue(sinEstadisticas)
    h7API.list.mockResolvedValue(vacio)
    h7API.getStats.mockResolvedValue(sinEstadisticas)
  })

  test('la configuracion oculta Nueva H1, Nueva H7 y la generacion de ENS', () => {
    expect(MODULOS_VISIBLES).toEqual({ nuevaH1: false, nuevaH7: false, crearEns: false })
  })

  test('la lista de ENS se ve, sin los botones de nueva ENS ni de importar por lotes', async () => {
    render(<MemoryRouter><ENSDeclarationList /></MemoryRouter>)

    expect(screen.getByText('ens.title')).toBeInTheDocument()
    await waitFor(() => expect(ensAPI.list).toHaveBeenCalled())
    expect(screen.queryByText('ens.new')).not.toBeInTheDocument()
    expect(screen.queryByText('ens.importBatch')).not.toBeInTheDocument()
  })

  test('la lista de H7 se ve, sin enlaces a /h7/new ni siquiera cuando esta vacia', async () => {
    const { container } = render(<MemoryRouter><H7DeclarationList /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('h7.noDeclarations')).toBeInTheDocument())
    expect(screen.queryByText('h7.new')).not.toBeInTheDocument()
    expect(screen.queryByText('h7.createFirst')).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/h7/new"]')).toBeNull()
  })
})
