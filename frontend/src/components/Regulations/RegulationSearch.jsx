import React, { useState, useEffect, useRef } from 'react'
import { regulationsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BookOpenIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
  GlobeEuropeAfricaIcon,
  BuildingLibraryIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline'

const SOURCE_TABS = [
  { key: 'all', label: 'Todos', icon: GlobeEuropeAfricaIcon },
  { key: 'eurlex', label: 'EUR-Lex (CAU)', icon: GlobeEuropeAfricaIcon },
  { key: 'boe', label: 'BOE (Espana)', icon: BuildingLibraryIcon }
]

const SUGGESTED_QUESTIONS = [
  '¿Cuales son los requisitos principales de esta normativa?',
  '¿Que obligaciones establece para el importador/exportador?',
  '¿Cuales son las sanciones por incumplimiento?',
  '¿Como afecta esta normativa a las operaciones aduaneras?',
  '¿Que documentacion se requiere segun esta normativa?'
]

export default function RegulationSearch() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [selectedSource, setSelectedSource] = useState('all')
  const [cauCatalog, setCauCatalog] = useState([])
  const [boeCatalog, setBoeCatalog] = useState([])
  const [selectedRegulation, setSelectedRegulation] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisQuestion, setAnalysisQuestion] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [conversationHistory, setConversationHistory] = useState([])
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)
  const [showCatalog, setShowCatalog] = useState(true)
  const [showBoeCatalog, setShowBoeCatalog] = useState(true)
  const [articleSearch, setArticleSearch] = useState({ celex: '', article: '' })
  const [articleResult, setArticleResult] = useState(null)
  const [searchingArticle, setSearchingArticle] = useState(false)
  const analysisPanelRef = useRef(null)
  const questionInputRef = useRef(null)

  useEffect(() => {
    loadCAUCatalog()
    loadBOECatalog()
  }, [])

  const loadCAUCatalog = async () => {
    try {
      const res = await regulationsAPI.getCAUCatalog()
      if (res.data.success) {
        setCauCatalog(res.data.data.catalog || [])
      }
    } catch (error) {
      console.error('Error loading CAU catalog:', error)
    }
  }

  const loadBOECatalog = async () => {
    try {
      const res = await regulationsAPI.getBOECatalog()
      if (res.data.success) {
        setBoeCatalog(res.data.data.catalog || [])
      }
    } catch (error) {
      console.error('Error loading BOE catalog:', error)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) {
      toast.error('Introduzca un termino de busqueda')
      return
    }

    setLoading(true)
    setResults(null)
    setAnalysisResult(null)

    try {
      let res
      if (selectedSource === 'boe') {
        res = await regulationsAPI.searchBOE(query)
      } else if (selectedSource === 'eurlex') {
        res = await regulationsAPI.searchEURLex(query)
      } else {
        res = await regulationsAPI.search(query)
      }

      if (res.data.success) {
        setResults(res.data.data)
      } else {
        toast.error('Error en la busqueda')
      }
    } catch (error) {
      toast.error('Error buscando normativa')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }


  const handleSearchArticle = async () => {
    if (!articleSearch.celex || !articleSearch.article) {
      toast.error('Introduzca CELEX y numero de articulo')
      return
    }

    setSearchingArticle(true)
    setArticleResult(null)

    try {
      const res = await regulationsAPI.searchArticle(articleSearch.celex, articleSearch.article)

      if (res.data.success) {
        setArticleResult(res.data.data)
      } else {
        toast.error('Articulo no encontrado')
      }
    } catch (error) {
      toast.error('Error buscando articulo')
      console.error(error)
    } finally {
      setSearchingArticle(false)
    }
  }

  const selectFromCatalog = (reg) => {
    handleSelectRegulation({ ...reg, source: 'EUR-Lex' })
  }

  const selectFromBOECatalog = (reg) => {
    handleSelectRegulation({ ...reg, source: 'BOE' })
  }

  const handleSelectRegulation = (reg) => {
    setSelectedRegulation(reg)
    setArticleSearch({ ...articleSearch, celex: reg.celex || '' })
    setShowAnalysisPanel(true)
    setConversationHistory([])
    setAnalysisResult(null)
    setAnalysisQuestion('')

    // Scroll al panel de análisis y focus en el input
    setTimeout(() => {
      if (analysisPanelRef.current) {
        analysisPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      if (questionInputRef.current) {
        questionInputRef.current.focus()
      }
    }, 100)
  }

  const handleCloseAnalysis = () => {
    setShowAnalysisPanel(false)
    setSelectedRegulation(null)
    setConversationHistory([])
    setAnalysisResult(null)
  }

  const handleSuggestedQuestion = (question) => {
    setAnalysisQuestion(question)
    if (questionInputRef.current) {
      questionInputRef.current.focus()
    }
  }

  const handleSubmitQuestion = async (e) => {
    e?.preventDefault()
    if (!analysisQuestion.trim() || !selectedRegulation) return

    const currentQuestion = analysisQuestion
    setAnalysisQuestion('')
    setAnalyzing(true)

    // Añadir pregunta al historial
    setConversationHistory(prev => [...prev, {
      type: 'question',
      content: currentQuestion,
      timestamp: new Date()
    }])

    try {
      const res = await regulationsAPI.analyze({
        source: selectedRegulation.source,
        documentId: selectedRegulation.id || selectedRegulation.celex,
        question: currentQuestion,
        context: `Normativa: ${selectedRegulation.title}`
      })

      if (res.data.success) {
        const answer = res.data.data
        setConversationHistory(prev => [...prev, {
          type: 'answer',
          content: answer.analysis || answer.answer,
          confidence: answer.confidence,
          model: answer.model,
          timestamp: new Date()
        }])
        toast.success('Analisis completado')
      } else {
        setConversationHistory(prev => [...prev, {
          type: 'error',
          content: 'Error al analizar la normativa',
          timestamp: new Date()
        }])
        toast.error('Error en el analisis')
      }
    } catch (error) {
      setConversationHistory(prev => [...prev, {
        type: 'error',
        content: 'Error de conexion al analizar',
        timestamp: new Date()
      }])
      toast.error('Error analizando normativa')
      console.error(error)
    } finally {
      setAnalyzing(false)
    }
  }

  const renderResults = () => {
    if (!results) return null

    // Combined results
    if (results.boe || results.eurlex) {
      return (
        <div className="space-y-4">
          {results.eurlex && results.eurlex.results?.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                <GlobeEuropeAfricaIcon className="h-5 w-5 text-blue-600" />
                EUR-Lex ({results.eurlex.totalResults} resultados)
              </h3>
              <div className="space-y-2">
                {results.eurlex.results.map((item, idx) => (
                  <ResultCard key={`eurlex-${idx}`} item={item} onSelect={handleSelectRegulation} isSelected={selectedRegulation?.id === item.id} />
                ))}
              </div>
            </div>
          )}

          {results.boe && results.boe.results?.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                <BuildingLibraryIcon className="h-5 w-5 text-red-600" />
                BOE ({results.boe.totalResults} resultados)
              </h3>
              <div className="space-y-2">
                {results.boe.results.map((item, idx) => (
                  <ResultCard key={`boe-${idx}`} item={item} onSelect={handleSelectRegulation} isSelected={selectedRegulation?.id === item.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Single source results
    if (results.results?.length > 0) {
      return (
        <div className="space-y-2">
          {results.results.map((item, idx) => (
            <ResultCard key={idx} item={item} onSelect={handleSelectRegulation} isSelected={selectedRegulation?.id === item.id} />
          ))}
        </div>
      )
    }

    return <p className="text-gray-500 text-center py-4">No se encontraron resultados</p>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('regulations.title')}</h1>
        <p className="text-gray-500 mt-1">
          {t('regulations.subtitle')}
        </p>
      </div>

      {/* Prominent Analysis Panel - Shows when regulation is selected */}
      {showAnalysisPanel && selectedRegulation && (
        <div ref={analysisPanelRef} className="card border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Analisis con LUCI</h2>
                <p className="text-sm text-gray-500">Haga preguntas sobre la normativa seleccionada</p>
              </div>
            </div>
            <button
              onClick={handleCloseAnalysis}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Selected Regulation Info */}
          <div className="mb-4 p-4 bg-white border border-purple-100 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    selectedRegulation.source === 'BOE'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedRegulation.source || 'EUR-Lex'}
                  </span>
                  {selectedRegulation.shortName && (
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      {selectedRegulation.shortName}
                    </span>
                  )}
                </div>
                <p className="font-medium text-gray-900">{selectedRegulation.title || selectedRegulation.shortName}</p>
                {selectedRegulation.celex && (
                  <p className="text-xs text-gray-500 mt-1">CELEX: {selectedRegulation.celex}</p>
                )}
              </div>
              {selectedRegulation.url && (
                <a
                  href={selectedRegulation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 p-1"
                  title="Ver documento original"
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Suggested Questions */}
          {conversationHistory.length === 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                <LightBulbIcon className="h-4 w-4 text-yellow-500" />
                Preguntas sugeridas:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(q)}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <div className="mb-4 space-y-3 max-h-96 overflow-y-auto">
              {conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.type === 'question'
                      ? 'bg-gray-100 ml-8'
                      : msg.type === 'error'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-purple-50 mr-8'
                  }`}
                >
                  {msg.type === 'question' && (
                    <p className="text-xs text-gray-500 mb-1">Tu pregunta:</p>
                  )}
                  {msg.type === 'answer' && (
                    <p className="text-xs text-purple-600 font-medium mb-1 flex items-center gap-1">
                      <SparklesIcon className="h-3 w-3" />
                      LUCI
                    </p>
                  )}
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {msg.confidence && (
                    <p className="text-xs text-gray-400 mt-2">
                      Confianza: {msg.confidence}%
                    </p>
                  )}
                </div>
              ))}
              {analyzing && (
                <div className="bg-purple-50 p-3 rounded-lg mr-8">
                  <p className="text-xs text-purple-600 font-medium mb-1 flex items-center gap-1">
                    <SparklesIcon className="h-3 w-3" />
                    LUCI esta analizando...
                  </p>
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-purple-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-gray-500">Procesando consulta...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question Input */}
          <form onSubmit={handleSubmitQuestion} className="flex gap-2">
            <input
              ref={questionInputRef}
              type="text"
              value={analysisQuestion}
              onChange={(e) => setAnalysisQuestion(e.target.value)}
              className="input flex-1"
              placeholder="Escriba su pregunta sobre esta normativa..."
              disabled={analyzing}
            />
            <button
              type="submit"
              disabled={analyzing || !analysisQuestion.trim()}
              className="btn-primary px-4"
            >
              {analyzing ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Form */}
          <div className="card">
            <form onSubmit={handleSearch} className="space-y-4">
              {/* Source Tabs */}
              <div className="flex gap-2 border-b pb-4">
                {SOURCE_TABS.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedSource(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSource === tab.key
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="search"
                    aria-label="Buscar normativa"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="input pl-10"
                    placeholder="Buscar normativa... (ej: CAU, clasificacion arancelaria, valor en aduana)"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Buscando...
                    </span>
                  ) : 'Buscar'}
                </button>
              </div>
            </form>
          </div>

          {/* Results */}
          {results && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-2">Resultados de busqueda</h2>
              <p className="text-sm text-gray-500 mb-4">Seleccione una normativa para analizarla con LUCI</p>
              {renderResults()}
            </div>
          )}

          {/* CAU Catalog */}
          <div className="card">
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <BookOpenIcon className="h-5 w-5 text-blue-600" />
                Catalogo CAU - Codigo Aduanero de la Union
              </h2>
              {showCatalog ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {showCatalog && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-500 mb-2">Haga clic en una normativa para analizarla</p>
                {cauCatalog.map((reg, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectFromCatalog(reg)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedRegulation?.celex === reg.celex
                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {reg.shortName}
                          </span>
                          {selectedRegulation?.celex === reg.celex && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center gap-1">
                              <SparklesIcon className="h-3 w-3" />
                              Analizando
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 mt-1">{reg.title}</p>
                        <p className="text-xs text-gray-500 mt-1">CELEX: {reg.celex}</p>
                      </div>
                      <a
                        href={reg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOE Catalog */}
          <div className="card">
            <button
              onClick={() => setShowBoeCatalog(!showBoeCatalog)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <BuildingLibraryIcon className="h-5 w-5 text-red-600" />
                Catalogo BOE - Normativa Aduanera Espanola
              </h2>
              {showBoeCatalog ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {showBoeCatalog && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-500 mb-2">Haga clic en una normativa para analizarla</p>
                {boeCatalog.map((reg, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectFromBOECatalog(reg)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedRegulation?.id === reg.id
                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-red-100 px-2 py-0.5 rounded text-red-700">
                            {reg.shortName}
                          </span>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {reg.type}
                          </span>
                          {selectedRegulation?.id === reg.id && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center gap-1">
                              <SparklesIcon className="h-3 w-3" />
                              Analizando
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 mt-1">{reg.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{reg.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{reg.department} - {reg.date}</p>
                      </div>
                      <a
                        href={reg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side Panel - Article Search */}
        <div className="space-y-6">
          {/* Quick Start Guide */}
          {!showAnalysisPanel && (
            <div className="card bg-gradient-to-br from-purple-50 to-white border-purple-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <SparklesIcon className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="font-semibold text-gray-900">Como usar el analizador</h2>
              </div>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                  <span>Busque una normativa o seleccione del catalogo CAU</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                  <span>Haga clic en la normativa para activar el analizador</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                  <span>Escriba sus preguntas y LUCI las respondera</span>
                </li>
              </ol>
            </div>
          )}

          {/* Article Search */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-green-600" />
              Buscar Articulo Especifico
            </h2>

            <div className="space-y-4">
              <div>
                <label className="label">Numero CELEX</label>
                <input
                  type="text"
                  value={articleSearch.celex}
                  onChange={(e) => setArticleSearch({ ...articleSearch, celex: e.target.value })}
                  className="input"
                  placeholder="Ej: 32013R0952"
                />
              </div>

              <div>
                <label className="label">Numero de Articulo</label>
                <input
                  type="text"
                  value={articleSearch.article}
                  onChange={(e) => setArticleSearch({ ...articleSearch, article: e.target.value })}
                  className="input"
                  placeholder="Ej: 22"
                />
              </div>

              <button
                onClick={handleSearchArticle}
                disabled={searchingArticle || !articleSearch.celex || !articleSearch.article}
                className="btn-secondary w-full"
              >
                {searchingArticle ? 'Buscando...' : 'Buscar articulo'}
              </button>
            </div>

            {/* El "no encontrado" se pintaba sobre fondo VERDE y sin enlace, con el
                mismo aspecto que un resultado correcto. No encontrar un articulo no es
                un exito, y ademas casi nunca significa que no exista: significa que no
                se ha podido leer el texto (EUR-Lex responde 202 con cuerpo vacio a las
                peticiones automatizadas). Se distingue visualmente y se ofrece SIEMPRE
                el enlace a la fuente oficial, que es lo unico util en ese caso. */}
            {articleResult && (
              <div className={`mt-4 p-4 rounded-lg ${articleResult.found ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-medium ${articleResult.found ? 'text-green-900' : 'text-amber-900'}`}>
                    Articulo {articleResult.article}
                  </h3>
                  <a
                    href={articleResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={articleResult.found ? 'text-green-600 hover:text-green-800' : 'text-amber-700 hover:text-amber-900'}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                </div>
                {articleResult.found ? (
                  <div className="text-sm text-gray-700 max-h-60 overflow-y-auto">
                    {articleResult.excerpt}
                  </div>
                ) : (
                  <p className="text-sm text-amber-800">
                    No se ha podido recuperar el texto de este articulo. Consultelo en{' '}
                    <a
                      href={articleResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      la fuente oficial
                    </a>.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Result Card Component
function ResultCard({ item, onSelect, isSelected }) {
  return (
    <div
      onClick={() => onSelect(item)}
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              item.source === 'BOE'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {item.source}
            </span>
            {item.type && (
              <span className="text-xs text-gray-500">{item.type}</span>
            )}
            {item.shortName && (
              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                {item.shortName}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-900 mt-1 font-medium">{item.title}</p>
          {item.summary && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
          )}
          {item.date && (
            <p className="text-xs text-gray-400 mt-1">Fecha: {item.date}</p>
          )}
          {item.celex && (
            <p className="text-xs text-gray-400 mt-1">CELEX: {item.celex}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 ml-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800 p-1"
            title="Ver documento"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
          {item.pdfUrl && (
            <a
              href={item.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-red-600 hover:text-red-800 p-1"
              title="Descargar PDF"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
