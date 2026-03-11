import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { classificationAPI } from '../../services/api'
import toast from 'react-hot-toast'
import TaricTreeBrowser from './TaricTreeBrowser'
import TARIC_CHAPTERS from '../../data/taricChapters'
import {
  MagnifyingGlassIcon,
  TagIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ClockIcon,
  ScaleIcon,
  DocumentCheckIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
  QueueListIcon
} from '@heroicons/react/24/outline'

// Helper: extraer descripcion como string (puede venir como {es, en} o string)
const getDesc = (d) => {
  if (!d) return ''
  if (typeof d === 'string') return d
  return d.es || d.en || ''
}

export default function ClassificationTool() {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState({
    material: '',
    use: '',
    origin: '',
    composition: ''
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [selectedCode, setSelectedCode] = useState(null)
  const [validating, setValidating] = useState(false)

  // New AI features state
  const [activeTab, setActiveTab] = useState('basic') // 'basic' | 'advanced' | 'lookup'
  const [fullAnalysisLoading, setFullAnalysisLoading] = useState(false)
  const [fullAnalysisResult, setFullAnalysisResult] = useState(null)
  const [crossValidationResult, setCrossValidationResult] = useState(null)
  const [crossValidating, setCrossValidating] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    rgi: false,
    chapterNotes: false,
    specialMeasures: false,
    alternatives: false
  })

  // TARIC code lookup state
  const [taricCode, setTaricCode] = useState('')
  const [taricLookupLoading, setTaricLookupLoading] = useState(false)
  const [taricLookupResult, setTaricLookupResult] = useState(null)
  const [chapterResults, setChapterResults] = useState(null) // For 2-3 digit code searches

  // Search history state
  const [searchHistory, setSearchHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [mostSearched, setMostSearched] = useState([])
  const [cacheStats, setCacheStats] = useState(null)

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory()
    loadMostSearched()
    loadCacheStats()
  }, [])

  const loadSearchHistory = async () => {
    try {
      setHistoryLoading(true)
      const response = await classificationAPI.getSearchHistory(10)
      setSearchHistory(response.data.data?.history || [])
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadMostSearched = async () => {
    try {
      const response = await classificationAPI.getMostSearched(30, 5)
      setMostSearched(response.data.data?.codes || [])
    } catch (error) {
      console.error('Error loading most searched:', error)
    }
  }

  const loadCacheStats = async () => {
    try {
      const response = await classificationAPI.getCacheStats()
      setCacheStats(response.data.data || null)
    } catch (error) {
      console.error('Error loading cache stats:', error)
    }
  }

  const handleHistoryItemClick = (code) => {
    setTaricCode(code)
    setActiveTab('lookup')
  }

  const handleClassify = async (e) => {
    e.preventDefault()
    if (!description.trim()) {
      toast.error(t('classification.enterDescription'))
      return
    }

    setLoading(true)
    setResults(null)
    setSelectedCode(null)
    setFullAnalysisResult(null)
    setCrossValidationResult(null)

    try {
      const response = await classificationAPI.classify({
        description,
        additional_info: Object.fromEntries(
          Object.entries(additionalInfo).filter(([_, v]) => v)
        ),
        language: 'es'
      })

      setResults(response.data)
    } catch (error) {
      toast.error(t('classification.classifyError'))
    } finally {
      setLoading(false)
    }
  }

  const handleFullAnalysis = async () => {
    if (!description.trim()) {
      toast.error(t('classification.enterDescription'))
      return
    }

    setFullAnalysisLoading(true)
    setFullAnalysisResult(null)

    try {
      const response = await classificationAPI.aiFullAnalysis(
        {
          description,
          material: additionalInfo.material,
          use: additionalInfo.use,
          origin: additionalInfo.origin,
          composition: additionalInfo.composition
        },
        {
          validateWithRegulations: true,
          historicalClassifications: [],
          feedbackHistory: [],
          clientProfile: {}
        }
      )

      setFullAnalysisResult(response.data.data)
      toast.success(t('classification.fullAnalysisComplete'))
    } catch (error) {
      toast.error(t('classification.fullAnalysisError'))
      console.error(error)
    } finally {
      setFullAnalysisLoading(false)
    }
  }

  const handleCrossValidate = async (suggestion) => {
    setCrossValidating(true)
    setSelectedCode(suggestion.taricCode || suggestion.code)

    try {
      const response = await classificationAPI.aiCrossValidate(
        {
          taricCode: suggestion.taricCode || suggestion.code,
          confidence: suggestion.confidence
        },
        {
          description,
          material: additionalInfo.material,
          use: additionalInfo.use,
          origin: additionalInfo.origin,
          composition: additionalInfo.composition
        }
      )

      setCrossValidationResult(response.data.data)

      if (response.data.data.validationResult?.isValid) {
        toast.success(t('classification.classificationValidated'))
      } else {
        toast.error(t('classification.classificationReviewRecommended'))
      }
    } catch (error) {
      toast.error(t('classification.regulationValidationError'))
    } finally {
      setCrossValidating(false)
    }
  }

  const handleValidate = async (code) => {
    setValidating(true)
    setSelectedCode(code)

    try {
      const response = await classificationAPI.validate(
        code,
        description,
        additionalInfo.origin
      )

      setResults(prev => ({
        ...prev,
        validationResult: response.data
      }))

      if (response.data.is_valid) {
        toast.success(t('classification.codeValidatedOk'))
      } else {
        toast.error(t('classification.codeMayNotBeCorrect'))
      }
    } catch (error) {
      toast.error(t('classification.codeValidationError'))
    } finally {
      setValidating(false)
    }
  }

  const handleFeedback = async (suggestion, wasCorrect, correctCode = null) => {
    setFeedbackSubmitting(true)

    try {
      await classificationAPI.aiRecordFeedback(
        {
          suggestedCode: suggestion.taricCode || suggestion.code,
          description,
          confidence: suggestion.confidence
        },
        {
          wasCorrect,
          correctCode: wasCorrect ? null : correctCode,
          notes: ''
        }
      )

      toast.success(wasCorrect ? t('classification.feedbackConfirmThanks') : t('classification.feedbackRecorded'))
    } catch (error) {
      toast.error(t('classification.feedbackError'))
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleTaricLookup = async (e) => {
    e.preventDefault()
    const cleanCode = taricCode.trim().replace(/\s+/g, '')
    if (!cleanCode) {
      toast.error(t('classification.enterTaricCode'))
      return
    }

    if (!/^\d+$/.test(cleanCode)) {
      toast.error(t('classification.codeDigitsOnly'))
      return
    }

    setTaricLookupLoading(true)
    setTaricLookupResult(null)
    setChapterResults(null)

    try {
      // For 2-3 digit codes, search by chapter using tree endpoint
      if (cleanCode.length <= 3) {
        const chapter = cleanCode.padStart(2, '0')
        const chapterName = TARIC_CHAPTERS[chapter]
        const response = await classificationAPI.getTreeData(chapter)
        const data = response.data.data
        const results = data?.results || []

        if (results.length > 0) {
          setChapterResults({
            chapter,
            chapterName: chapterName || `${t('classification.chapter')} ${chapter}`,
            level: data.level,
            results
          })
          toast.success(t('classification.foundInChapter', { count: results.length, chapter }))
        } else if (chapterName) {
          // Chapter exists in reference but no codes in DB
          setChapterResults({
            chapter,
            chapterName,
            level: 'headings',
            results: [],
            empty: true
          })
          toast(t('classification.chapterNoCodesLocal'), { icon: 'i' })
        } else {
          toast.error(`${t('classification.chapter')} ${chapter} ${t('classification.chapterNotValid')}`)
        }
      } else {
        // For 4+ digit codes, use existing getTaricInfo
        const response = await classificationAPI.getTaricInfo(cleanCode)
        const result = response.data.data || response.data
        setTaricLookupResult(result)
        if (result.found === false) {
          toast.error(result.message || t('classification.codeNotFound'))
        } else {
          toast.success(t('classification.infoFoundSource', { source: result.source || 'local' }))
        }
      }
      // Reload history after search
      loadSearchHistory()
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error(t('classification.codeNotFoundTaric'))
      } else {
        toast.error(t('classification.errorSearchingCode'))
      }
      console.error(error)
    } finally {
      setTaricLookupLoading(false)
    }
  }

  // Handle drilling into a chapter result
  const handleChapterDrillDown = async (code) => {
    setTaricLookupLoading(true)
    try {
      if (code.length < 10) {
        // Not a leaf code, drill deeper
        const response = await classificationAPI.getTreeData(code)
        const data = response.data.data
        const results = data?.results || []
        if (results.length > 0) {
          setChapterResults(prev => ({
            ...prev,
            parentCode: code,
            level: data.level,
            results,
            breadcrumb: [...(prev?.breadcrumb || [{ code: prev?.chapter, label: prev?.chapterName }]), { code, label: code }]
          }))
        } else {
          toast(t('classification.noSubdivisions'), { icon: 'i' })
        }
      } else {
        // Leaf code - switch to detail view
        setChapterResults(null)
        setTaricCode(code)
        const response = await classificationAPI.getTaricInfo(code)
        const result = response.data.data || response.data
        setTaricLookupResult(result)
        if (result.found === false) {
          toast.error(result.message || t('classification.codeNotFound'))
        } else {
          toast.success(t('classification.infoFoundSource', { source: result.source || 'local' }))
        }
      }
    } catch {
      toast.error(t('classification.errorLoadingData'))
    } finally {
      setTaricLookupLoading(false)
    }
  }

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100'
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getAssessmentColor = (assessment) => {
    switch (assessment) {
      case 'CONFIRMED': return 'text-green-600 bg-green-100'
      case 'LIKELY_CORRECT': return 'text-blue-600 bg-blue-100'
      case 'NEEDS_REVIEW': return 'text-yellow-600 bg-yellow-100'
      case 'LIKELY_INCORRECT': return 'text-orange-600 bg-orange-100'
      case 'INVALID': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getAssessmentLabel = (assessment) => {
    switch (assessment) {
      case 'CONFIRMED': return t('classification.confirmed')
      case 'LIKELY_CORRECT': return t('classification.likelyCorrect')
      case 'NEEDS_REVIEW': return t('classification.needsReviewAssessment')
      case 'LIKELY_INCORRECT': return t('classification.likelyIncorrect')
      case 'INVALID': return t('classification.invalid')
      default: return assessment
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('classification.title')}</h1>
          <p className="text-gray-500 mt-1">
            {t('classification.subtitle')}
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1 flex-wrap gap-0.5">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'basic'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('classification.basic')}
          </button>
          <button
            onClick={() => setActiveTab('lookup')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'lookup'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TagIcon className="w-4 h-4" />
            {t('classification.lookupCode')}
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'tree'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <QueueListIcon className="w-4 h-4" />
            {t('classification.exploreTree')}
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'advanced'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <SparklesIcon className="w-4 h-4" />
            {t('classification.advanced')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-2">
          {/* Description-based Classification Form - only show for basic and advanced tabs */}
          {(activeTab === 'basic' || activeTab === 'advanced') && (
          <form onSubmit={handleClassify} className="card space-y-4">
            <div>
              <label className="label">{t('classification.productDescription')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={4}
                placeholder={t('classification.productPlaceholder')}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('classification.mainMaterial')}</label>
                <input
                  type="text"
                  value={additionalInfo.material}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, material: e.target.value })}
                  className="input"
                  placeholder={t('classification.materialPlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('classification.useFunction')}</label>
                <input
                  type="text"
                  value={additionalInfo.use}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, use: e.target.value })}
                  className="input"
                  placeholder={t('classification.usePlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('classification.composition')}</label>
                <input
                  type="text"
                  value={additionalInfo.composition}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, composition: e.target.value })}
                  className="input"
                  placeholder={t('classification.compositionPlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('classification.originCountryLabel')}</label>
                <input
                  type="text"
                  value={additionalInfo.origin}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, origin: e.target.value })}
                  className="input"
                  placeholder={t('classification.originPlaceholder')}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t('classification.analyzing')}
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="w-5 h-5" />
                    {t('classification.classify')}
                  </>
                )}
              </button>

              {activeTab === 'advanced' && (
                <button
                  type="button"
                  onClick={handleFullAnalysis}
                  disabled={fullAnalysisLoading || !description.trim()}
                  className="btn-secondary flex items-center justify-center gap-2"
                >
                  {fullAnalysisLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-luci"></div>
                      {t('classification.analyzing')}
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5 text-luci" />
                      {t('classification.fullAnalysisAI')}
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
          )}

          {/* TARIC Code Lookup Form */}
          {activeTab === 'lookup' && (
            <div className="card mt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-luci" />
                {t('classification.searchByCode')}
              </h2>
              <form onSubmit={handleTaricLookup} className="space-y-4">
                <div>
                  <label className="label">{t('classification.taricOrHsCode')}</label>
                  <input
                    type="text"
                    value={taricCode}
                    onChange={(e) => setTaricCode(e.target.value.replace(/[^\d]/g, ''))}
                    className="input font-mono text-lg"
                    placeholder={t('classification.codePlaceholder')}
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('classification.codeDigitsHelp')}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={taricLookupLoading}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {taricLookupLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      {t('classification.searching')}
                    </>
                  ) : (
                    <>
                      <MagnifyingGlassIcon className="w-5 h-5" />
                      {t('classification.searchCode')}
                    </>
                  )}
                </button>
              </form>

              {/* Loading skeleton */}
              {taricLookupLoading && (
                <div className="mt-6 space-y-3 animate-pulse">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                    <div className="h-8 bg-gray-200 rounded w-40" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-full mb-1" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-32" />
                      <div className="h-3 bg-gray-100 rounded w-28" />
                      <div className="h-3 bg-gray-100 rounded w-36" />
                    </div>
                  </div>
                </div>
              )}

              {/* Chapter Search Results (for 2-3 digit codes) */}
              {chapterResults && !taricLookupLoading && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-gradient-to-r from-luci-light to-blue-50 rounded-xl border border-luci/30">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm text-gray-600">{t('classification.chapter')}</p>
                        <p className="font-mono text-2xl font-bold text-gray-900">
                          {chapterResults.chapter}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-700 font-medium">{chapterResults.chapterName}</p>
                        <p className="text-xs text-gray-500">
                          {chapterResults.results.length} {chapterResults.level === 'headings' ? t('classification.headings') : t('classification.codes')} {chapterResults.results.length !== 1 ? t('classification.foundPlural') : t('classification.found')}
                        </p>
                      </div>
                    </div>
                    {/* Breadcrumb for drill-down */}
                    {chapterResults.breadcrumb?.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-sm">
                        <button
                          onClick={() => {
                            setTaricCode(chapterResults.chapter)
                            handleTaricLookup({ preventDefault: () => {} })
                          }}
                          className="text-luci hover:underline font-mono"
                        >
                          Cap. {chapterResults.chapter}
                        </button>
                        {chapterResults.breadcrumb.slice(1).map((bc, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="text-gray-400">&rsaquo;</span>
                            <span className="font-mono text-gray-700">{bc.code}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {chapterResults.empty ? (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">{t('classification.noCodesLoaded')}</p>
                      <p className="text-xs mt-1">{t('classification.useTreeTab')}</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {chapterResults.results.map((item, i) => (
                        <button
                          key={item.code || i}
                          onClick={() => handleChapterDrillDown(item.code)}
                          className="w-full text-left p-3 rounded-lg hover:bg-luci-light border border-transparent hover:border-luci/20 transition-colors flex items-center gap-3"
                        >
                          <span className="font-mono text-sm font-bold text-gray-900 w-24 flex-shrink-0">
                            {item.code}
                          </span>
                          <span className="text-sm text-gray-600 flex-1 truncate">
                            {getDesc(item.description)}
                          </span>
                          {item.count > 0 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
                              {item.count}
                            </span>
                          )}
                          <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0 -rotate-90" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TARIC Lookup Results */}
              {taricLookupResult && !taricLookupLoading && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-gradient-to-r from-luci-light to-blue-50 rounded-xl border border-luci/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-600">{t('classification.code')}</p>
                        <p className="font-mono text-2xl font-bold text-gray-900">
                          {taricLookupResult.code || taricLookupResult.taricCode || taricCode}
                        </p>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(taricLookupResult.code || taricLookupResult.taricCode || taricCode)}
                        className="btn-secondary text-sm"
                      >
                        {t('classification.copy')}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="card bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-2">{t('classification.description')}</h3>
                    <p className="text-gray-700">
                      {getDesc(taricLookupResult.description) || taricLookupResult.descripcion || t('classification.noDescription')}
                    </p>
                    {taricLookupResult.description_es && taricLookupResult.description_es !== getDesc(taricLookupResult.description) && (
                      <p className="text-gray-600 mt-2 text-sm">
                        <span className="font-medium">ES:</span> {taricLookupResult.description_es}
                      </p>
                    )}
                  </div>

                  {/* Hierarchy */}
                  {(taricLookupResult.hierarchy || taricLookupResult.chapter || taricLookupResult.heading) && (
                    <div className="card">
                      <h3 className="font-semibold text-gray-900 mb-3">{t('classification.hierarchy')}</h3>
                      <div className="space-y-2 text-sm">
                        {taricLookupResult.chapter && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{taricLookupResult.chapter}</span>
                            <span className="text-gray-600">{t('classification.chapterLabel')}</span>
                          </div>
                        )}
                        {taricLookupResult.heading && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{taricLookupResult.heading}</span>
                            <span className="text-gray-600">{t('classification.headingLabel')}</span>
                          </div>
                        )}
                        {taricLookupResult.subheading && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{taricLookupResult.subheading}</span>
                            <span className="text-gray-600">{t('classification.subheadingLabel')}</span>
                          </div>
                        )}
                        {taricLookupResult.hierarchy?.map((level, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{level.code}</span>
                            <span className="text-gray-600">{level.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duty Rates */}
                  {(taricLookupResult.dutyRate || taricLookupResult.duties || taricLookupResult.measures) && (
                    <div className="card">
                      <h3 className="font-semibold text-gray-900 mb-3">{t('classification.tariffsAndMeasures')}</h3>
                      {taricLookupResult.dutyRate && (
                        <div className="p-3 bg-blue-50 rounded-lg mb-2">
                          <span className="text-sm text-blue-700">{t('classification.baseTariff')}</span>
                          <span className="font-bold text-blue-800">{taricLookupResult.dutyRate}</span>
                        </div>
                      )}
                      {taricLookupResult.duties && (
                        <div className="space-y-2">
                          {Object.entries(taricLookupResult.duties).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-gray-600">{key}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {taricLookupResult.measures?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-600 mb-2">{t('classification.applicableMeasures')}</p>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                            {taricLookupResult.measures.map((m, i) => (
                              <li key={i}>{typeof m === 'string' ? m : m.description || m.type}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Info */}
                  {taricLookupResult.notes && (
                    <div className="card bg-yellow-50 border-yellow-200">
                      <h3 className="font-semibold text-yellow-800 mb-2">{t('classification.notes')}</h3>
                      <p className="text-sm text-yellow-700">{taricLookupResult.notes}</p>
                    </div>
                  )}

                  {/* Use for classification */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setDescription(getDesc(taricLookupResult.description) || taricLookupResult.descripcion || '')
                        setActiveTab('basic')
                        toast.success(t('classification.descCopiedBasic'))
                      }}
                      className="btn-secondary text-sm"
                    >
                      {t('classification.useInBasicClassifier')}
                    </button>
                    <button
                      onClick={() => {
                        setDescription(getDesc(taricLookupResult.description) || taricLookupResult.descripcion || '')
                        setActiveTab('advanced')
                        toast.success(t('classification.descCopiedAdvanced'))
                      }}
                      className="btn-secondary text-sm flex items-center gap-1"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      {t('classification.useInAIAnalysis')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TARIC Tree Browser */}
          {activeTab === 'tree' && (
            <div className="card mt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <QueueListIcon className="w-5 h-5 text-luci" />
                {t('classification.exploreArbolArancelario')}
              </h2>
              <TaricTreeBrowser
                onCodeSelect={(code) => {
                  setTaricCode(code)
                  setActiveTab('lookup')
                  // Trigger lookup for this code
                  setTimeout(() => {
                    setTaricLookupLoading(true)
                    setTaricLookupResult(null)
                    setChapterResults(null)
                    classificationAPI.getTaricInfo(code).then(response => {
                      const result = response.data.data || response.data
                      setTaricLookupResult(result)
                      if (result.found !== false) {
                        toast.success(`${t('classification.infoOf')} ${code}`)
                      }
                    }).catch(() => {
                      toast.error(t('classification.codeDetailNotFound'))
                    }).finally(() => {
                      setTaricLookupLoading(false)
                    })
                  }, 100)
                }}
              />
            </div>
          )}

          {/* Basic Results */}
          {results && activeTab === 'basic' && (
            <div className="card mt-6">
              <h2 className="text-lg font-semibold mb-4">{t('classification.classificationSuggestions')}</h2>

              {results.warnings?.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">{t('classification.warnings')}</p>
                      <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                        {results.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {results.suggestions?.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-4 border-2 rounded-xl transition-colors ${
                      selectedCode === suggestion.code
                        ? 'border-luci bg-luci-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <TagIcon className="w-6 h-6 text-gray-400" />
                        <div>
                          <p className="font-mono text-lg font-bold text-gray-900">
                            {suggestion.code}
                          </p>
                          <p className="text-gray-600">{suggestion.description}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                        {suggestion.confidence}%
                      </span>
                    </div>

                    {suggestion.reasoning && (
                      <p className="mt-2 text-sm text-gray-500 pl-9">
                        {suggestion.reasoning}
                      </p>
                    )}

                    <div className="mt-3 pl-9 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleValidate(suggestion.code)}
                        disabled={validating}
                        className="btn-secondary text-sm"
                      >
                        {validating && selectedCode === suggestion.code ? t('classification.validating') : t('classification.validate')}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(suggestion.code)}
                        className="btn-secondary text-sm"
                      >
                        {t('classification.copy')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {results.validationResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  results.validationResult.is_valid
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {results.validationResult.is_valid ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        results.validationResult.is_valid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {results.validationResult.is_valid ? t('classification.codeValidated') : t('classification.reviewRequired')}
                      </p>
                      <p className={`text-sm mt-1 ${
                        results.validationResult.is_valid ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {results.validationResult.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Advanced AI Analysis Results */}
          {fullAnalysisResult && activeTab === 'advanced' && (
            <div className="space-y-4 mt-6">
              {/* Final Assessment Card */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5 text-luci" />
                    {t('classification.finalAssessment')}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    getConfidenceColor(fullAnalysisResult.finalAssessment?.confidence || 0)
                  }`}>
                    {fullAnalysisResult.finalAssessment?.confidence || 0}% {t('classification.confidence')}
                  </span>
                </div>

                {fullAnalysisResult.finalAssessment?.recommendedCode && (
                  <div className="p-4 bg-gradient-to-r from-luci-light to-blue-50 rounded-xl border border-luci/30">
                    <div className="flex items-center gap-3">
                      <TagIcon className="w-8 h-8 text-luci" />
                      <div>
                        <p className="text-sm text-gray-600">{t('classification.recommendedCode')}</p>
                        <p className="font-mono text-2xl font-bold text-gray-900">
                          {fullAnalysisResult.finalAssessment.recommendedCode}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        fullAnalysisResult.finalAssessment.readyToUse
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {fullAnalysisResult.finalAssessment.readyToUse
                          ? t('classification.readyToUse')
                          : t('classification.needsReview')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        getConfidenceColor(fullAnalysisResult.finalAssessment.confidence)
                      }`}>
                        {t('classification.level')}: {fullAnalysisResult.finalAssessment.confidenceLevel}
                      </span>
                    </div>

                    {fullAnalysisResult.finalAssessment.factors?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-luci/20">
                        <p className="text-xs text-gray-500 mb-1">{t('classification.confidenceFactors')}</p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {fullAnalysisResult.finalAssessment.factors.map((f, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className={f.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                                {f.startsWith('+') ? '↑' : '↓'}
                              </span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback buttons */}
                <div className="mt-4 flex items-center gap-3 pt-4 border-t">
                  <span className="text-sm text-gray-600">{t('classification.isCorrect')}</span>
                  <button
                    onClick={() => handleFeedback(
                      { taricCode: fullAnalysisResult.finalAssessment?.recommendedCode, confidence: fullAnalysisResult.finalAssessment?.confidence },
                      true
                    )}
                    disabled={feedbackSubmitting}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-sm"
                  >
                    <HandThumbUpIcon className="w-4 h-4" />
                    {t('common.yes')}
                  </button>
                  <button
                    onClick={() => {
                      const correctCode = prompt(t('classification.whatIsCorrectCode'))
                      if (correctCode) {
                        handleFeedback(
                          { taricCode: fullAnalysisResult.finalAssessment?.recommendedCode, confidence: fullAnalysisResult.finalAssessment?.confidence },
                          false,
                          correctCode
                        )
                      }
                    }}
                    disabled={feedbackSubmitting}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm"
                  >
                    <HandThumbDownIcon className="w-4 h-4" />
                    {t('common.no')}
                  </button>
                </div>
              </div>

              {/* Suggestions List */}
              {fullAnalysisResult.suggestions?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <LightBulbIcon className="w-5 h-5 text-yellow-500" />
                    {t('classification.consolidatedSuggestions')}
                  </h3>
                  <div className="space-y-2">
                    {fullAnalysisResult.suggestions.map((s, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${
                        i === 0 ? 'border-luci bg-luci-light' : 'border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{s.taricCode}</span>
                            {s.sources && (
                              <div className="flex gap-1">
                                {s.sources.map((src, j) => (
                                  <span key={j} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                    {src}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-sm font-medium ${getConfidenceColor(s.confidence)}`}>
                            {s.confidence}%
                          </span>
                        </div>
                        {s.reasoning && (
                          <p className="text-sm text-gray-600 mt-1">{s.reasoning}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => handleCrossValidate(s)}
                            disabled={crossValidating}
                            className="text-xs text-luci hover:underline flex items-center gap-1"
                          >
                            <ScaleIcon className="w-3 h-3" />
                            {t('classification.validateWithRegulation')}
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(s.taricCode)}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            {t('classification.copy')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerts */}
              {fullAnalysisResult.alerts?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3">{t('classification.alerts')}</h3>
                  <div className="space-y-2">
                    {fullAnalysisResult.alerts.map((alert, i) => (
                      <div key={i} className={`p-3 rounded-lg ${
                        alert.type === 'ERROR' ? 'bg-red-50 border border-red-200' :
                        alert.type === 'WARNING' ? 'bg-yellow-50 border border-yellow-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}>
                        <p className={`font-medium text-sm ${
                          alert.type === 'ERROR' ? 'text-red-800' :
                          alert.type === 'WARNING' ? 'text-yellow-800' :
                          'text-blue-800'
                        }`}>{alert.message}</p>
                        {alert.action && (
                          <p className={`text-xs mt-1 ${
                            alert.type === 'ERROR' ? 'text-red-600' :
                            alert.type === 'WARNING' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`}>{t('classification.actionLabel')}: {alert.action}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {fullAnalysisResult.nextSteps?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ArrowPathIcon className="w-5 h-5 text-gray-400" />
                    {t('classification.nextSteps')}
                  </h3>
                  <ol className="space-y-2">
                    {fullAnalysisResult.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 p-2 rounded bg-gray-50">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          step.priority === 1 ? 'bg-red-100 text-red-700' :
                          step.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {step.priority}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{step.action}</p>
                          <p className="text-xs text-gray-500">{step.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Cross Validation Result */}
          {crossValidationResult && activeTab === 'advanced' && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ScaleIcon className="w-5 h-5 text-luci" />
                  {t('classification.regulatoryValidation')}
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  getAssessmentColor(crossValidationResult.validationResult?.overallAssessment)
                }`}>
                  {getAssessmentLabel(crossValidationResult.validationResult?.overallAssessment)}
                </span>
              </div>

              {/* Validation Score */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{t('classification.validationScore')}</span>
                  <span className="font-medium">{crossValidationResult.validationResult?.validationScore || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      crossValidationResult.validationResult?.validationScore >= 80 ? 'bg-green-500' :
                      crossValidationResult.validationResult?.validationScore >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${crossValidationResult.validationResult?.validationScore || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* RGI Analysis */}
              {crossValidationResult.rgiAnalysis && (
                <div className="border rounded-lg mb-3">
                  <button
                    onClick={() => toggleSection('rgi')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <BookOpenIcon className="w-4 h-4" />
                      {t('classification.rgiAnalysis')}
                    </span>
                    {expandedSections.rgi ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                  {expandedSections.rgi && (
                    <div className="p-3 pt-0 border-t space-y-2">
                      {crossValidationResult.rgiAnalysis.rgi1_description?.applies && (
                        <div className="text-sm p-2 bg-gray-50 rounded">
                          <span className="font-medium">{t('classification.rgi1Text')}</span>
                          <p className="text-gray-600">{crossValidationResult.rgiAnalysis.rgi1_description.assessment}</p>
                        </div>
                      )}
                      {crossValidationResult.rgiAnalysis.rgi3_specific?.applies && (
                        <div className="text-sm p-2 bg-gray-50 rounded">
                          <span className="font-medium">{t('classification.rgi3Text')}</span>
                          <p className="text-gray-600">{crossValidationResult.rgiAnalysis.rgi3_specific.assessment}</p>
                        </div>
                      )}
                      {crossValidationResult.rgiAnalysis.rgi6_subheading?.applies && (
                        <div className="text-sm p-2 bg-gray-50 rounded">
                          <span className="font-medium">{t('classification.rgi6Text')}</span>
                          <p className="text-gray-600">{crossValidationResult.rgiAnalysis.rgi6_subheading.assessment}</p>
                        </div>
                      )}
                      {crossValidationResult.rgiAnalysis.conclusionRGI && (
                        <div className="text-sm p-2 bg-luci-light rounded border border-luci/20">
                          <span className="font-medium text-luci">{t('classification.conclusion')}</span>
                          <p className="text-gray-700">{crossValidationResult.rgiAnalysis.conclusionRGI}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Chapter Notes */}
              {crossValidationResult.chapterNotes && (
                <div className="border rounded-lg mb-3">
                  <button
                    onClick={() => toggleSection('chapterNotes')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <DocumentCheckIcon className="w-4 h-4" />
                      {t('classification.sectionChapterNotes')}
                    </span>
                    {expandedSections.chapterNotes ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                  {expandedSections.chapterNotes && (
                    <div className="p-3 pt-0 border-t space-y-2 text-sm">
                      {crossValidationResult.chapterNotes.sectionNotes?.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-700">{t('classification.sectionNotes')}</p>
                          <ul className="list-disc list-inside text-gray-600">
                            {crossValidationResult.chapterNotes.sectionNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {crossValidationResult.chapterNotes.chapterNotes?.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-700">{t('classification.chapterNotes')}</p>
                          <ul className="list-disc list-inside text-gray-600">
                            {crossValidationResult.chapterNotes.chapterNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {crossValidationResult.chapterNotes.inclusions?.length > 0 && (
                        <div className="p-2 bg-green-50 rounded">
                          <p className="font-medium text-green-700">{t('classification.inclusionsConfirm')}</p>
                          <ul className="list-disc list-inside text-green-600">
                            {crossValidationResult.chapterNotes.inclusions.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {crossValidationResult.chapterNotes.exclusions?.length > 0 && (
                        <div className="p-2 bg-red-50 rounded">
                          <p className="font-medium text-red-700">{t('classification.possibleExclusions')}</p>
                          <ul className="list-disc list-inside text-red-600">
                            {crossValidationResult.chapterNotes.exclusions.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Special Measures */}
              {crossValidationResult.specialMeasures && (
                <div className="border rounded-lg mb-3">
                  <button
                    onClick={() => toggleSection('specialMeasures')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      {t('classification.specialMeasures')}
                    </span>
                    {expandedSections.specialMeasures ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                  {expandedSections.specialMeasures && (
                    <div className="p-3 pt-0 border-t grid grid-cols-2 gap-2 text-sm">
                      <div className={`p-2 rounded ${crossValidationResult.specialMeasures.antidumping?.applies ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <span className="font-medium">{t('classification.antidumping')}</span>
                        <span className={crossValidationResult.specialMeasures.antidumping?.applies ? 'text-red-600 ml-2' : 'text-gray-500 ml-2'}>
                          {crossValidationResult.specialMeasures.antidumping?.applies ? t('common.yes').toUpperCase() : t('common.no')}
                        </span>
                      </div>
                      <div className={`p-2 rounded ${crossValidationResult.specialMeasures.quota?.applies ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                        <span className="font-medium">{t('classification.quota')}</span>
                        <span className={crossValidationResult.specialMeasures.quota?.applies ? 'text-yellow-600 ml-2' : 'text-gray-500 ml-2'}>
                          {crossValidationResult.specialMeasures.quota?.applies ? t('common.yes').toUpperCase() : t('common.no')}
                        </span>
                      </div>
                      <div className={`p-2 rounded ${crossValidationResult.specialMeasures.suspension?.applies ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <span className="font-medium">{t('classification.suspensionLabel')}</span>
                        <span className={crossValidationResult.specialMeasures.suspension?.applies ? 'text-green-600 ml-2' : 'text-gray-500 ml-2'}>
                          {crossValidationResult.specialMeasures.suspension?.applies ? t('common.yes').toUpperCase() : t('common.no')}
                        </span>
                      </div>
                      <div className={`p-2 rounded ${crossValidationResult.specialMeasures.safeguard?.applies ? 'bg-orange-50' : 'bg-gray-50'}`}>
                        <span className="font-medium">{t('classification.safeguard')}</span>
                        <span className={crossValidationResult.specialMeasures.safeguard?.applies ? 'text-orange-600 ml-2' : 'text-gray-500 ml-2'}>
                          {crossValidationResult.specialMeasures.safeguard?.applies ? t('common.yes').toUpperCase() : t('common.no')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Alternative Classifications */}
              {crossValidationResult.alternativeClassifications?.length > 0 && (
                <div className="border rounded-lg mb-3">
                  <button
                    onClick={() => toggleSection('alternatives')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <TagIcon className="w-4 h-4" />
                      {t('classification.alternativeClassifications')} ({crossValidationResult.alternativeClassifications.length})
                    </span>
                    {expandedSections.alternatives ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                  {expandedSections.alternatives && (
                    <div className="p-3 pt-0 border-t space-y-2">
                      {crossValidationResult.alternativeClassifications.map((alt, i) => (
                        <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-medium">{alt.taricCode}</span>
                            <span className="text-gray-500">{alt.probability}% {t('classification.probable')}</span>
                          </div>
                          <p className="text-gray-600 mt-1">{alt.reasoning}</p>
                          <p className="text-xs text-gray-500 mt-1">{t('classification.differentiatingFactor')} {alt.differentiatingFactor}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documentation Requirements */}
              {crossValidationResult.documentationRequirements?.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">{t('classification.documentationRequired')}</h4>
                  <ul className="space-y-1">
                    {crossValidationResult.documentationRequirements.map((doc, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${doc.mandatory ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                        <span className="font-mono text-xs bg-white px-1 rounded">{doc.code}</span>
                        <span className="text-blue-700">{doc.document}</span>
                        {doc.mandatory && <span className="text-xs text-red-600">({t('classification.mandatory')})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Final Recommendation */}
              {crossValidationResult.finalRecommendation && (
                <div className={`mt-4 p-4 rounded-lg ${
                  crossValidationResult.finalRecommendation.proceed
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <p className={`font-medium ${
                    crossValidationResult.finalRecommendation.proceed ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {crossValidationResult.finalRecommendation.proceed
                      ? t('classification.recommendProceed')
                      : t('classification.recommendReview')}
                  </p>
                  <p className={`text-sm mt-1 ${
                    crossValidationResult.finalRecommendation.proceed ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {crossValidationResult.finalRecommendation.summary}
                  </p>
                  {crossValidationResult.finalRecommendation.actions?.length > 0 && (
                    <ul className="mt-2 text-sm list-disc list-inside text-gray-600">
                      {crossValidationResult.finalRecommendation.actions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Help */}
        <div className="space-y-6">
          {/* Search History */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-gray-500" />
              {t('classification.searchHistory')}
            </h3>
            {historyLoading ? (
              <div className="text-sm text-gray-500">{t('classification.loadingHistory')}</div>
            ) : searchHistory.length > 0 ? (
              <div className="space-y-2">
                {searchHistory.slice(0, 5).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleHistoryItemClick(item.code || item.normalizedCode)}
                    className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium text-gray-900">{item.code || item.normalizedCode}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.source === 'local_db' ? 'bg-green-100 text-green-700' :
                        item.source === 'ai' ? 'bg-purple-100 text-purple-700' :
                        item.source === 'cache' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {item.source === 'local_db' ? 'BD' :
                         item.source === 'ai' ? 'IA' :
                         item.source === 'cache' ? 'Cache' :
                         item.source === 'eu_api' ? 'API UE' : item.source}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{getDesc(item.description)}</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('classification.noRecentSearches')}</p>
            )}
          </div>

          {/* Most Searched Codes */}
          {mostSearched.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-gray-500" />
                {t('classification.mostSearchedCodes')}
              </h3>
              <div className="space-y-2">
                {mostSearched.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleHistoryItemClick(item._id)}
                    className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{item._id}</span>
                      <span className="text-xs bg-luci-light text-luci px-2 py-0.5 rounded-full">
                        {item.count}x
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{getDesc(item.description)}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cache Stats */}
          {cacheStats && (
            <div className="card bg-gradient-to-br from-gray-50 to-blue-50">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ArchiveBoxIcon className="w-4 h-4 text-gray-500" />
                {t('classification.cacheStatsTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-white rounded shadow-sm">
                  <p className="text-gray-500 text-xs">{t('classification.entries')}</p>
                  <p className="font-bold text-lg">{cacheStats.totalEntries || 0}</p>
                </div>
                <div className="p-2 bg-white rounded shadow-sm">
                  <p className="text-gray-500 text-xs">{t('classification.totalHits')}</p>
                  <p className="font-bold text-lg">{cacheStats.totalHits || 0}</p>
                </div>
                <div className="p-2 bg-white rounded shadow-sm">
                  <p className="text-gray-500 text-xs">{t('classification.validated')}</p>
                  <p className="font-bold text-lg">{cacheStats.validatedCount || 0}</p>
                </div>
                <div className="p-2 bg-white rounded shadow-sm">
                  <p className="text-gray-500 text-xs">{t('classification.avgQuality')}</p>
                  <p className="font-bold text-lg">{cacheStats.avgQuality?.toFixed(1) || '-'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">{t('classification.classificationTips')}</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-luci">1.</span>
                {t('classification.tip1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-luci">2.</span>
                {t('classification.tip2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-luci">3.</span>
                {t('classification.tip3')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-luci">4.</span>
                {t('classification.tip4')}
              </li>
            </ul>
          </div>

          {activeTab === 'advanced' && (
            <div className="card bg-luci-light border-luci/30">
              <h3 className="font-semibold text-luci mb-2 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                {t('classification.advancedAIFeatures')}
              </h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  {t('classification.rgiValidation')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  {t('classification.chapterNotesAnalysis')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  {t('classification.specialMeasuresDetection')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  {t('classification.feedbackLearning')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  {t('classification.historyBasedSuggestions')}
                </li>
              </ul>
            </div>
          )}

          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-2">{t('classification.legalNotice')}</h3>
            <p className="text-sm text-yellow-700">
              {t('classification.legalNoticeText')}
            </p>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">{t('classification.taricStructure')}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-mono">XX</span> - {t('classification.chapterDigits')}</p>
              <p><span className="font-mono">XXXX</span> - {t('classification.headingDigits')}</p>
              <p><span className="font-mono">XXXXXX</span> - {t('classification.subheadingSADigits')}</p>
              <p><span className="font-mono">XXXXXXXX</span> - {t('classification.ncDigits')}</p>
              <p><span className="font-mono">XXXXXXXXXX</span> - {t('classification.taricDigits')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
