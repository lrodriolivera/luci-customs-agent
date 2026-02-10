import React, { useState, useEffect } from 'react'
import { classificationAPI } from '../../services/api'
import TARIC_CHAPTERS, { TARIC_SECTIONS, LEVEL_NAMES, getChapterName } from '../../data/taricChapters'
import toast from 'react-hot-toast'
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  HomeIcon,
  TagIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

// Skeleton loader for tree items
function TreeSkeleton({ count = 4 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-20 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-48" />
          </div>
          <div className="h-5 w-8 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// Helper: extraer descripcion como string (puede venir como {es, en} o string)
const getDesc = (d) => {
  if (!d) return ''
  if (typeof d === 'string') return d
  return d.es || d.en || ''
}

export default function TaricTreeBrowser({ onCodeSelect }) {
  const [loading, setLoading] = useState(false)
  const [breadcrumb, setBreadcrumb] = useState([]) // [{code, label, level}]
  const [items, setItems] = useState([])
  const [currentLevel, setCurrentLevel] = useState('chapters')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dataSource, setDataSource] = useState(null) // 'database' | 'ai' | null

  // Load initial chapters on mount
  useEffect(() => {
    loadChapters()
  }, [])

  const loadChapters = () => {
    // Show all 98 chapters from local data (even if not all are in DB)
    const allChapters = Object.entries(TARIC_CHAPTERS).map(([code, name]) => ({
      code,
      description: name,
      count: 0, // Will be enriched from API
      isLocal: true
    }))
    setItems(allChapters)
    setBreadcrumb([])
    setCurrentLevel('chapters')
    setSearchResults(null)
    setDataSource(null)

    // Enrich with counts from API
    classificationAPI.getTreeData().then(response => {
      const apiChapters = response.data.data?.results || []
      const countMap = {}
      apiChapters.forEach(c => { countMap[c.code] = c.count })
      setItems(prev => prev.map(ch => ({
        ...ch,
        count: countMap[ch.code] || 0
      })))
    }).catch(() => {})
  }

  const handleNavigate = async (code, label) => {
    setLoading(true)
    setSearchResults(null)
    setDataSource(null)
    try {
      const response = await classificationAPI.getTreeData(code)
      const data = response.data.data
      const results = data?.results || []
      const source = data?.source || 'database'

      if (results.length === 0) {
        toast('No hay subdivisiones disponibles para este codigo', { icon: 'ℹ️' })
        setLoading(false)
        return
      }

      if (source === 'ai') {
        toast.success('Arbol generado con IA y cacheado para futuras consultas', { icon: '✨', duration: 3000 })
      }

      // Determine new level
      const levelName = data.level === 'headings' ? 'Partidas'
        : data.level === 'subheadings' ? 'Subpartidas'
        : data.level === 'cnCodes' ? 'Codigos NC'
        : 'Codigos TARIC'

      setBreadcrumb(prev => [...prev, { code, label, level: levelName }])
      setItems(results)
      setCurrentLevel(data.level)
      setDataSource(source)
    } catch (error) {
      toast.error('Error al cargar datos del arbol')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleBreadcrumbClick = async (index) => {
    if (index === -1) {
      // Go to root
      loadChapters()
      return
    }

    // Navigate to specific breadcrumb level
    const target = breadcrumb[index]
    const newBreadcrumb = breadcrumb.slice(0, index)
    setBreadcrumb(newBreadcrumb)
    setLoading(true)
    setDataSource(null)

    try {
      const parentCode = index === 0 ? null : breadcrumb[index - 1]?.code
      if (!parentCode && index === 0) {
        // Going back to chapters
        loadChapters()
        return
      }
      const response = await classificationAPI.getTreeData(parentCode)
      const data = response.data.data
      setItems(data?.results || [])
      setCurrentLevel(data?.level || 'chapters')
      setDataSource(data?.source || 'database')
    } catch {
      loadChapters()
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const response = await classificationAPI.search(searchQuery.trim())
      const results = response.data.data?.results || []
      setSearchResults(results)
      if (results.length === 0) {
        toast.error('No se encontraron resultados')
      }
    } catch {
      toast.error('Error en la busqueda')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSelectCode = (code) => {
    if (onCodeSelect) {
      onCodeSelect(code)
    }
  }

  const isLeafLevel = currentLevel === 'taricCodes'
  const getLevelIcon = (item) => {
    if (isLeafLevel) return DocumentTextIcon
    if (item.count === 0 && dataSource !== 'ai') return DocumentTextIcon
    return FolderIcon
  }

  return (
    <div className="space-y-4">
      {/* Search within tree */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por descripcion o codigo..."
            className="input pl-9 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          className="btn-primary text-sm px-4"
        >
          {searchLoading ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            'Buscar'
          )}
        </button>
      </form>

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{searchQuery}"
            </p>
            <button
              onClick={() => { setSearchResults(null); setSearchQuery('') }}
              className="text-xs text-luci hover:underline"
            >
              Limpiar busqueda
            </button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {searchResults.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelectCode(item.code)}
                className="w-full text-left p-3 rounded-lg hover:bg-luci-light border border-transparent hover:border-luci/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TagIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-bold text-gray-900">{item.code}</span>
                    <p className="text-xs text-gray-600 truncate">
                      {getDesc(item.description)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {!searchResults && (
        <>
          <div className="flex items-center gap-1 text-sm flex-wrap">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className="flex items-center gap-1 text-luci hover:text-luci-dark font-medium"
            >
              <HomeIcon className="w-4 h-4" />
              Arancel
            </button>
            {breadcrumb.map((bc, i) => (
              <React.Fragment key={i}>
                <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                <button
                  onClick={() => handleBreadcrumbClick(i)}
                  className={`font-mono ${
                    i === breadcrumb.length - 1
                      ? 'text-gray-900 font-semibold'
                      : 'text-luci hover:text-luci-dark'
                  }`}
                >
                  {bc.code}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Level indicator */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {breadcrumb.length === 0 ? 'Capitulos del Arancel (98)' :
                `${breadcrumb[breadcrumb.length - 1]?.level || ''} - ${items.length} resultado${items.length !== 1 ? 's' : ''}`}
            </p>
            {breadcrumb.length > 0 && (
              <button
                onClick={() => handleBreadcrumbClick(breadcrumb.length - 2 >= 0 ? breadcrumb.length - 2 : -1)}
                className="text-xs text-luci hover:underline"
              >
                Volver atras
              </button>
            )}
          </div>

          {/* AI source badge */}
          {dataSource === 'ai' && !loading && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Generado con IA - Los datos se han cacheado para futuras consultas</span>
            </div>
          )}

          {/* Tree Items */}
          {loading ? (
            <div>
              {breadcrumb.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-luci mb-3 animate-pulse">
                  <SparklesIcon className="w-4 h-4" />
                  <span>Generando arbol con IA...</span>
                </div>
              )}
              <TreeSkeleton count={6} />
            </div>
          ) : (
            <div className={`space-y-1 max-h-[500px] overflow-y-auto ${
              breadcrumb.length === 0 ? 'grid grid-cols-1 gap-1' : ''
            }`}>
              {items.map((item, i) => {
                const Icon = getLevelIcon(item)
                const isClickable = !isLeafLevel && (item.count > 0 || dataSource === 'ai')
                const chapterName = breadcrumb.length === 0 ? TARIC_CHAPTERS[item.code] : null

                return (
                  <div
                    key={item.code || i}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-transparent transition-all ${
                      isClickable
                        ? 'hover:bg-luci-light hover:border-luci/20 cursor-pointer'
                        : item.count === 0 && breadcrumb.length === 0
                          ? 'opacity-50'
                          : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (isClickable) {
                        handleNavigate(item.code, chapterName || getDesc(item.description) || item.code)
                      } else if (isLeafLevel) {
                        handleSelectCode(item.code)
                      }
                    }}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${
                      isClickable ? 'text-luci' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-900">
                          {item.code}
                        </span>
                        {isLeafLevel && item.duties?.thirdCountry != null && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {item.duties.thirdCountry}%
                          </span>
                        )}
                        {isLeafLevel && item.hasMeasures && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                            Medidas
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {chapterName || getDesc(item.description)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.count > 0 && !isLeafLevel && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {item.count}
                        </span>
                      )}
                      {isClickable && (
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      )}
                      {isLeafLevel && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectCode(item.code)
                          }}
                          className="text-xs text-luci hover:text-luci-dark font-medium"
                        >
                          Seleccionar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {items.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpenIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay datos disponibles para este nivel</p>
                  <p className="text-xs mt-1">Los datos se cargan progresivamente desde la base de datos TARIC</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
