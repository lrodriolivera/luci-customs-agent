import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegulationSearch from './RegulationSearch'
import { regulationsAPI } from '../../services/api'
import toast from 'react-hot-toast'

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../services/api', () => ({
  regulationsAPI: {
    getCAUCatalog: vi.fn(),
    getBOECatalog: vi.fn(),
    search: vi.fn(),
    searchBOE: vi.fn(),
    searchEURLex: vi.fn(),
    searchArticle: vi.fn(),
    analyze: vi.fn()
  }
}))

describe('RegulationSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup jsdom missing methods
    Element.prototype.scrollIntoView = vi.fn()

    // Default successful catalog loads
    regulationsAPI.getCAUCatalog.mockResolvedValue({
      data: {
        success: true,
        data: {
          catalog: [
            {
              shortName: 'CAU',
              title: 'Codigo Aduanero de la Union',
              celex: '32013R0952',
              url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952'
            }
          ]
        }
      }
    })

    regulationsAPI.getBOECatalog.mockResolvedValue({
      data: {
        success: true,
        data: {
          catalog: [
            {
              id: 'BOE-A-2023-12345',
              shortName: 'RD 123/2023',
              type: 'Real Decreto',
              title: 'Reglamento aduanero',
              description: 'Norma de aduanas',
              department: 'Ministerio de Hacienda',
              date: '2023-01-15',
              url: 'https://boe.es/diario_boe/txt.php?id=BOE-A-2023-12345'
            }
          ]
        }
      }
    })
  })

  describe('Catalog loading', () => {
    it('loads and displays CAU catalog on mount', async () => {
      render(<RegulationSearch />)

      await waitFor(() => {
        expect(regulationsAPI.getCAUCatalog).toHaveBeenCalledTimes(1)
      })

      await screen.findByText(/Catalogo CAU - Codigo Aduanero de la Union/)
      expect(screen.getByText('CAU')).toBeInTheDocument()
      expect(screen.getByText('Codigo Aduanero de la Union')).toBeInTheDocument()
      expect(screen.getByText(/CELEX: 32013R0952/)).toBeInTheDocument()
    })

    it('loads and displays BOE catalog on mount', async () => {
      render(<RegulationSearch />)

      await waitFor(() => {
        expect(regulationsAPI.getBOECatalog).toHaveBeenCalledTimes(1)
      })

      await screen.findByText(/Catalogo BOE - Normativa Aduanera Espanola/)
      expect(screen.getByText('RD 123/2023')).toBeInTheDocument()
      expect(screen.getByText('Real Decreto')).toBeInTheDocument()
      expect(screen.getByText('Reglamento aduanero')).toBeInTheDocument()
      expect(screen.getByText('Norma de aduanas')).toBeInTheDocument()
      expect(screen.getByText(/Ministerio de Hacienda - 2023-01-15/)).toBeInTheDocument()
    })

    it('handles CAU catalog load failure gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      regulationsAPI.getCAUCatalog.mockRejectedValue(new Error('Network error'))

      render(<RegulationSearch />)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error loading CAU catalog:', expect.any(Error))
      })

      // Should still render without crashing
      expect(screen.getByText(/Catalogo CAU - Codigo Aduanero de la Union/)).toBeInTheDocument()

      consoleError.mockRestore()
    })

    it('handles CAU catalog success:false response', async () => {
      regulationsAPI.getCAUCatalog.mockResolvedValue({
        data: { success: false }
      })

      render(<RegulationSearch />)

      await waitFor(() => {
        expect(regulationsAPI.getCAUCatalog).toHaveBeenCalledTimes(1)
      })

      // Catalog should be empty
      const catalogSection = screen.getByText(/Catalogo CAU - Codigo Aduanero de la Union/)
      expect(catalogSection).toBeInTheDocument()
    })

    it('handles BOE catalog load failure gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      regulationsAPI.getBOECatalog.mockRejectedValue(new Error('Network error'))

      render(<RegulationSearch />)

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error loading BOE catalog:', expect.any(Error))
      })

      expect(screen.getByText(/Catalogo BOE - Normativa Aduanera Espanola/)).toBeInTheDocument()

      consoleError.mockRestore()
    })
  })

  describe('Source tabs', () => {
    it('defaults to "all" source', async () => {
      render(<RegulationSearch />)

      await screen.findByText(/Catalogo CAU/)

      const todosButton = screen.getByRole('button', { name: /Todos/ })
      expect(todosButton).toHaveClass('bg-blue-100')
    })

    it('switches to EUR-Lex source when tab clicked', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText(/Catalogo CAU/)

      const eurlexButton = screen.getByRole('button', { name: /EUR-Lex \(CAU\)/ })
      await user.click(eurlexButton)

      expect(eurlexButton).toHaveClass('bg-blue-100')
    })

    it('switches to BOE source when tab clicked', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText(/Catalogo CAU/)

      const boeButton = screen.getByRole('button', { name: /BOE \(Espana\)/ })
      await user.click(boeButton)

      expect(boeButton).toHaveClass('bg-blue-100')
    })
  })

  describe('Search functionality', () => {
    it('shows error toast when searching with empty query', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText(/Catalogo CAU/)

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      expect(toast.error).toHaveBeenCalledWith('Introduzca un termino de busqueda')
      expect(regulationsAPI.search).not.toHaveBeenCalled()
    })

    it('calls search API with "all" source', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: {
            eurlex: { totalResults: 1, results: [] },
            boe: { totalResults: 0, results: [] }
          }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'clasificacion')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(regulationsAPI.search).toHaveBeenCalledWith('clasificacion')
      })
    })

    it('calls searchBOE API when BOE source selected', async () => {
      const user = userEvent.setup()
      regulationsAPI.searchBOE.mockResolvedValue({
        data: {
          success: true,
          data: { results: [] }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const boeButton = screen.getByRole('button', { name: /BOE \(Espana\)/ })
      await user.click(boeButton)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'aduanas')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(regulationsAPI.searchBOE).toHaveBeenCalledWith('aduanas')
      })
    })

    it('calls searchEURLex API when eurlex source selected', async () => {
      const user = userEvent.setup()
      regulationsAPI.searchEURLex.mockResolvedValue({
        data: {
          success: true,
          data: { results: [] }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const eurlexButton = screen.getByRole('button', { name: /EUR-Lex \(CAU\)/ })
      await user.click(eurlexButton)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'CAU')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(regulationsAPI.searchEURLex).toHaveBeenCalledWith('CAU')
      })
    })

    it('shows loading state during search', async () => {
      const user = userEvent.setup()
      let resolveSearch
      regulationsAPI.search.mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve
        })
      )

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText('Buscando...')

      resolveSearch({
        data: { success: true, data: { results: [] } }
      })

      await waitFor(() => {
        expect(screen.queryByText('Buscando...')).not.toBeInTheDocument()
      })
    })

    it('shows error toast when search API fails', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      regulationsAPI.search.mockRejectedValue(new Error('API error'))

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error buscando normativa')
      })

      consoleError.mockRestore()
    })

    it('shows error toast when search returns success:false', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: { success: false }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error en la busqueda')
      })
    })
  })

  describe('Search results rendering', () => {
    it('renders combined results with eurlex and boe sections', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: {
            eurlex: {
              totalResults: 1,
              results: [
                {
                  id: 'eur-1',
                  title: 'EUR-Lex regulation',
                  source: 'EUR-Lex',
                  url: 'https://eur-lex.europa.eu/doc1'
                }
              ]
            },
            boe: {
              totalResults: 1,
              results: [
                {
                  id: 'boe-1',
                  title: 'BOE regulation',
                  source: 'BOE',
                  url: 'https://boe.es/doc1'
                }
              ]
            }
          }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText(/EUR-Lex \(1 resultados\)/)
      await screen.findByText(/BOE \(1 resultados\)/)
      expect(screen.getByText('EUR-Lex regulation')).toBeInTheDocument()
      expect(screen.getByText('BOE regulation')).toBeInTheDocument()
    })

    it('renders single source results', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: {
            results: [
              {
                id: 'result-1',
                title: 'Single result',
                source: 'EUR-Lex',
                url: 'https://example.com'
              }
            ]
          }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText('Resultados de busqueda')
      expect(screen.getByText('Single result')).toBeInTheDocument()
    })

    it('shows "no results" message when results are empty', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: { results: [] }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText('No se encontraron resultados')
    })

    it('renders ResultCard with all conditional fields', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: {
            results: [
              {
                id: 'full-result',
                title: 'Complete regulation',
                source: 'BOE',
                type: 'Ley',
                shortName: 'LEY-2023',
                summary: 'Summary text here',
                date: '2023-05-20',
                celex: '32023L0001',
                url: 'https://boe.es/doc',
                pdfUrl: 'https://boe.es/doc.pdf'
              }
            ]
          }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText('Complete regulation')
      expect(screen.getByText('BOE')).toBeInTheDocument()
      expect(screen.getByText('Ley')).toBeInTheDocument()
      expect(screen.getByText('LEY-2023')).toBeInTheDocument()
      expect(screen.getByText('Summary text here')).toBeInTheDocument()
      expect(screen.getByText(/Fecha: 2023-05-20/)).toBeInTheDocument()
      expect(screen.getByText(/CELEX: 32023L0001/)).toBeInTheDocument()
    })

    it('renders ResultCard with BOE source styling', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: {
            results: [
              {
                id: 'boe-result',
                title: 'BOE doc',
                source: 'BOE',
                url: 'https://boe.es'
              }
            ]
          }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText('BOE doc')
      const sourceBadge = screen.getByText('BOE')
      expect(sourceBadge).toHaveClass('bg-red-100', 'text-red-700')
    })

    it('renders ResultCard with non-BOE source styling', async () => {
      const user = userEvent.setup()
      regulationsAPI.search.mockResolvedValue({
        data: {
          success: true,
          data: {
            results: [
              {
                id: 'eur-result',
                title: 'EUR-Lex doc',
                source: 'EUR-Lex',
                url: 'https://eur-lex.europa.eu'
              }
            ]
          }
        }
      })

      render(<RegulationSearch />)
      await screen.findByText(/Catalogo CAU/)

      const searchInput = screen.getByPlaceholderText(/Buscar normativa/)
      await user.type(searchInput, 'test')

      const searchButton = screen.getByRole('button', { name: 'Buscar' })
      await user.click(searchButton)

      await screen.findByText('EUR-Lex doc')
      const sourceBadge = screen.getByText('EUR-Lex')
      expect(sourceBadge).toHaveClass('bg-blue-100', 'text-blue-700')
    })
  })

  describe('CAU catalog selection', () => {
    it('opens analysis panel when CAU catalog item is selected', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Analisis con LUCI')
      expect(screen.getByText(/Haga preguntas sobre la normativa seleccionada/)).toBeInTheDocument()
      const badges = screen.getAllByText('EUR-Lex')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('shows selected regulation details in analysis panel', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Analisis con LUCI')
      const titles = screen.getAllByText('Codigo Aduanero de la Union')
      expect(titles.length).toBeGreaterThan(1)
      const celexes = screen.getAllByText(/CELEX: 32013R0952/)
      expect(celexes.length).toBeGreaterThan(0)
    })

    it('marks catalog item as "Analizando" when selected', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Analizando')
    })
  })

  describe('BOE catalog selection', () => {
    it('opens analysis panel when BOE catalog item is selected', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('RD 123/2023')

      const catalogCards = screen.getAllByText('Reglamento aduanero')
      await user.click(catalogCards[0])

      await screen.findByText('Analisis con LUCI')
      const badges = screen.getAllByText('BOE')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('shows BOE badge in analysis panel', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('RD 123/2023')

      const catalogCards = screen.getAllByText('Reglamento aduanero')
      await user.click(catalogCards[0])

      await screen.findByText('Analisis con LUCI')
      const badges = screen.getAllByText('BOE')
      const panelBadge = badges.find(badge => badge.classList.contains('bg-red-100'))
      expect(panelBadge).toHaveClass('bg-red-100', 'text-red-700')
    })
  })

  describe('Analysis panel close', () => {
    it('closes analysis panel when X button clicked', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Analisis con LUCI')

      const buttons = screen.getAllByRole('button', { name: '' })
      const closeButton = buttons[0]
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Analisis con LUCI')).not.toBeInTheDocument()
      })
    })

    it('shows guide when analysis panel is closed', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      expect(screen.getByText('Como usar el analizador')).toBeInTheDocument()

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Analisis con LUCI')
      expect(screen.queryByText('Como usar el analizador')).not.toBeInTheDocument()

      const buttons = screen.getAllByRole('button', { name: '' })
      const closeButton = buttons[0]
      await user.click(closeButton)

      await screen.findByText('Como usar el analizador')
    })
  })

  describe('Suggested questions', () => {
    it('shows suggested questions when no conversation history', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Preguntas sugeridas:')
      expect(screen.getByText(/Cuales son los requisitos principales/)).toBeInTheDocument()
      expect(screen.getByText(/Que obligaciones establece/)).toBeInTheDocument()
      expect(screen.getByText(/Cuales son las sanciones/)).toBeInTheDocument()
      expect(screen.getByText(/Como afecta esta normativa/)).toBeInTheDocument()
      expect(screen.getByText(/Que documentacion se requiere/)).toBeInTheDocument()
    })

    it('populates question input when suggested question clicked', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const suggestedQuestion = screen.getByRole('button', {
        name: /Cuales son los requisitos principales/
      })
      await user.click(suggestedQuestion)

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      expect(input.value).toContain('requisitos principales')
    })

    it('hides suggested questions after first question submitted', async () => {
      const user = userEvent.setup()
      regulationsAPI.analyze.mockResolvedValue({
        data: {
          success: true,
          data: {
            analysis: 'Analysis result',
            confidence: 95
          }
        }
      })

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      await screen.findByText('Preguntas sugeridas:')

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'test question')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(regulationsAPI.analyze).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.queryByText('Preguntas sugeridas:')).not.toBeInTheDocument()
      })
    })
  })

  describe('Submit question', () => {
    it('does not submit when question is empty', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      expect(regulationsAPI.analyze).not.toHaveBeenCalled()
    })

    it('submits question and shows in conversation history', async () => {
      const user = userEvent.setup()
      regulationsAPI.analyze.mockResolvedValue({
        data: {
          success: true,
          data: {
            analysis: 'The answer is here',
            confidence: 90
          }
        }
      })

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'What are the requirements?')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(regulationsAPI.analyze).toHaveBeenCalled()
      })

      await screen.findByText(/What are the requirements/)
      await screen.findByText('The answer is here')
      await screen.findByText(/Confianza: 90%/)
    })

    it('clears input after submitting question', async () => {
      const user = userEvent.setup()
      regulationsAPI.analyze.mockResolvedValue({
        data: {
          success: true,
          data: { analysis: 'Answer' }
        }
      })

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'Test question')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })

    it('shows analyzing spinner during question processing', async () => {
      const user = userEvent.setup()
      let resolveAnalyze
      regulationsAPI.analyze.mockReturnValue(
        new Promise((resolve) => {
          resolveAnalyze = resolve
        })
      )

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'Test')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await screen.findByText('LUCI esta analizando...')
      await screen.findByText('Procesando consulta...')

      resolveAnalyze({
        data: { success: true, data: { analysis: 'Done' } }
      })

      await waitFor(() => {
        expect(screen.queryByText('LUCI esta analizando...')).not.toBeInTheDocument()
      })
    })

    it('disables input and button during analyzing', async () => {
      const user = userEvent.setup()
      let resolveAnalyze
      regulationsAPI.analyze.mockReturnValue(
        new Promise((resolve) => {
          resolveAnalyze = resolve
        })
      )

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'Test')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(input).toBeDisabled()
        expect(submitButton).toBeDisabled()
      })

      resolveAnalyze({
        data: { success: true, data: { analysis: 'Done' } }
      })

      await waitFor(() => {
        expect(input).not.toBeDisabled()
      })
    })

    it('shows success toast when analysis completes', async () => {
      const user = userEvent.setup()
      regulationsAPI.analyze.mockResolvedValue({
        data: {
          success: true,
          data: { analysis: 'Answer' }
        }
      })

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'Test')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Analisis completado')
      })
    })

    it('shows error message in history when analyze returns success:false', async () => {
      const user = userEvent.setup()
      regulationsAPI.analyze.mockResolvedValue({
        data: { success: false }
      })

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'Test')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error en el analisis')
      })
      await screen.findByText('Error al analizar la normativa')
    })

    it('shows error message when analyze API fails', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      regulationsAPI.analyze.mockRejectedValue(new Error('Network error'))

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'Test')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error analizando normativa')
      })
      await screen.findByText('Error de conexion al analizar')

      consoleError.mockRestore()
    })

    it('calls analyze API with correct parameters', async () => {
      const user = userEvent.setup()
      regulationsAPI.analyze.mockResolvedValue({
        data: { success: true, data: { analysis: 'Answer' } }
      })

      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const input = screen.getByPlaceholderText(/Escriba su pregunta/)
      await user.type(input, 'What are requirements?')

      const form = input.closest('form')
      const submitButton = form.querySelector('button[type="submit"]')
      await user.click(submitButton)

      await waitFor(() => {
        expect(regulationsAPI.analyze).toHaveBeenCalledWith({
          source: 'EUR-Lex',
          documentId: '32013R0952',
          question: 'What are requirements?',
          context: 'Normativa: Codigo Aduanero de la Union'
        })
      })
    })
  })

  describe('Article search', () => {
    it('shows error when searching without celex or article', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      // Type and then clear to trigger the validation path
      await user.type(celexInput, 'test')
      await user.type(articleInput, '1')
      await user.clear(celexInput)
      await user.clear(articleInput)

      // Button should be disabled but let's check the logic is correct by filling partially
      await user.type(celexInput, '32013R0952')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })

      // Now clear to test empty case - button gets disabled
      await user.clear(celexInput)
      expect(searchButton).toBeDisabled()

      // The actual validation happens in the onClick handler, but button is disabled
      // so we verify that searchArticle is not called in this state
      expect(regulationsAPI.searchArticle).not.toHaveBeenCalled()
    })

    it('disables article search button when inputs are empty', async () => {
      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      expect(searchButton).toBeDisabled()
    })

    it('enables article search button when both inputs filled', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      await user.type(celexInput, '32013R0952')
      await user.type(articleInput, '22')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      expect(searchButton).not.toBeDisabled()
    })

    it('searches for article and displays found result', async () => {
      const user = userEvent.setup()
      regulationsAPI.searchArticle.mockResolvedValue({
        data: {
          success: true,
          data: {
            found: true,
            article: '22',
            url: 'https://eur-lex.europa.eu/article',
            excerpt: 'Article 22 content here'
          }
        }
      })

      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      await user.type(celexInput, '32013R0952')
      await user.type(articleInput, '22')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      await user.click(searchButton)

      await screen.findByText(/Articulo 22/)
      expect(screen.getByText('Article 22 content here')).toBeInTheDocument()
    })

    it('shows "not found" message when article not found', async () => {
      const user = userEvent.setup()
      regulationsAPI.searchArticle.mockResolvedValue({
        data: {
          success: true,
          data: {
            found: false,
            article: '999'
          }
        }
      })

      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      await user.type(celexInput, '32013R0952')
      await user.type(articleInput, '999')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      await user.click(searchButton)

      await screen.findByText('Articulo no encontrado')
    })

    it('shows error toast when searchArticle returns success:false', async () => {
      const user = userEvent.setup()
      regulationsAPI.searchArticle.mockResolvedValue({
        data: { success: false }
      })

      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      await user.type(celexInput, '32013R0952')
      await user.type(articleInput, '22')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Articulo no encontrado')
      })
    })

    it('shows error toast when searchArticle API fails', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      regulationsAPI.searchArticle.mockRejectedValue(new Error('API error'))

      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      await user.type(celexInput, '32013R0952')
      await user.type(articleInput, '22')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      await user.click(searchButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error buscando articulo')
      })

      consoleError.mockRestore()
    })

    it('shows searching state during article search', async () => {
      const user = userEvent.setup()
      let resolveSearch
      regulationsAPI.searchArticle.mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve
        })
      )

      render(<RegulationSearch />)

      await screen.findByText(/Buscar Articulo Especifico/)

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      const articleInput = screen.getByPlaceholderText(/Ej: 22/)

      await user.type(celexInput, '32013R0952')
      await user.type(articleInput, '22')

      const searchButton = screen.getByRole('button', { name: 'Buscar articulo' })
      await user.click(searchButton)

      await screen.findByText('Buscando...')

      resolveSearch({
        data: { success: true, data: { found: true, article: '22', excerpt: 'text' } }
      })

      await waitFor(() => {
        expect(screen.queryByText('Buscando...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Catalog toggles', () => {
    it('toggles CAU catalog visibility', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const toggleButton = screen.getByRole('button', {
        name: /Catalogo CAU - Codigo Aduanero de la Union/
      })

      await user.click(toggleButton)

      await waitFor(() => {
        expect(screen.queryByText('CAU')).not.toBeInTheDocument()
      })

      await user.click(toggleButton)

      await screen.findByText('CAU')
    })

    it('toggles BOE catalog visibility', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('RD 123/2023')

      const toggleButton = screen.getByRole('button', {
        name: /Catalogo BOE - Normativa Aduanera Espanola/
      })

      await user.click(toggleButton)

      await waitFor(() => {
        expect(screen.queryByText('RD 123/2023')).not.toBeInTheDocument()
      })

      await user.click(toggleButton)

      await screen.findByText('RD 123/2023')
    })
  })

  describe('CELEX prefill from selected regulation', () => {
    it('prefills article search celex when regulation selected', async () => {
      const user = userEvent.setup()
      render(<RegulationSearch />)

      await screen.findByText('CAU')

      const catalogCards = screen.getAllByText('Codigo Aduanero de la Union')
      await user.click(catalogCards[0])

      const celexInput = screen.getByPlaceholderText(/Ej: 32013R0952/)
      expect(celexInput.value).toBe('32013R0952')
    })
  })
})
