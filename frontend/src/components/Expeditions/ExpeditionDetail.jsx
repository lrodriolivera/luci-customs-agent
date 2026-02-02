import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { expeditionsAPI, documentsAPI, declarationsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CloudArrowUpIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  SparklesIcon,
  XMarkIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import RequirementManager from '../Requirements/RequirementManager'
import ChannelStatus from '../Channels/ChannelStatus'
import ParaduaneroManager from '../Paraduanero/ParaduaneroManager'

// ==================== Expedition AI Panel Component ====================
function ExpeditionAIPanel({ expedition, onClose, onRefresh }) {
  const [activeTab, setActiveTab] = useState('documents')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState({
    documents: null,
    risk: null,
    inconsistencies: null,
    full: null
  })

  const tabs = [
    { id: 'documents', label: 'Sugerir Documentos', icon: DocumentTextIcon },
    { id: 'risk', label: 'Analizar Riesgo', icon: ShieldExclamationIcon },
    { id: 'inconsistencies', label: 'Detectar Inconsistencias', icon: MagnifyingGlassIcon },
    { id: 'full', label: 'Analisis Completo', icon: SparklesIcon }
  ]

  const runAnalysis = async (type) => {
    try {
      setLoading(true)
      setError(null)
      let res

      switch (type) {
        case 'documents':
          res = await expeditionsAPI.aiSuggestDocuments(expedition._id)
          break
        case 'risk':
          res = await expeditionsAPI.aiAnalyzeRisk(expedition._id)
          break
        case 'inconsistencies':
          res = await expeditionsAPI.aiDetectInconsistencies(expedition._id)
          break
        case 'full':
          res = await expeditionsAPI.aiFullAnalysis(expedition._id)
          break
      }

      if (res.data.success) {
        setResults(prev => ({ ...prev, [type]: res.data.data }))
      }
    } catch (err) {
      setError(err.response?.data?.error || `Error en analisis ${type}`)
    } finally {
      setLoading(false)
    }
  }

  const renderDocumentSuggestions = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Required Documents */}
        {data.requiredDocuments && data.requiredDocuments.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Documentos Obligatorios Faltantes
            </h4>
            <ul className="space-y-2">
              {data.requiredDocuments.map((doc, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-red-600">•</span>
                  <div>
                    <p className="font-medium text-red-700">{doc.name || doc.type}</p>
                    {doc.reason && <p className="text-red-600 text-xs">{doc.reason}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Documents */}
        {data.recommendedDocuments && data.recommendedDocuments.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
              <LightBulbIcon className="w-5 h-5" />
              Documentos Recomendados
            </h4>
            <ul className="space-y-2">
              {data.recommendedDocuments.map((doc, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-600">•</span>
                  <div>
                    <p className="font-medium text-yellow-700">{doc.name || doc.type}</p>
                    {doc.benefit && <p className="text-yellow-600 text-xs">{doc.benefit}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Current Documents Status */}
        {data.currentStatus && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Estado Actual</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{data.currentStatus.complete || 0}</p>
                <p className="text-xs text-gray-500">Completos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{data.currentStatus.pending || 0}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{data.currentStatus.missing || 0}</p>
                <p className="text-xs text-gray-500">Faltantes</p>
              </div>
            </div>
          </div>
        )}

        {data.summary && <p className="text-sm text-gray-600">{data.summary}</p>}
      </div>
    )
  }

  const renderRiskAnalysis = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Overall Risk Level */}
        <div className={`p-4 rounded-lg ${
          data.riskLevel === 'high' ? 'bg-red-50 border border-red-200' :
          data.riskLevel === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldExclamationIcon className={`w-6 h-6 ${
                data.riskLevel === 'high' ? 'text-red-600' :
                data.riskLevel === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              <span className={`font-medium ${
                data.riskLevel === 'high' ? 'text-red-800' :
                data.riskLevel === 'medium' ? 'text-yellow-800' :
                'text-green-800'
              }`}>
                Riesgo {data.riskLevel === 'high' ? 'Alto' : data.riskLevel === 'medium' ? 'Medio' : 'Bajo'}
              </span>
            </div>
            {data.score && (
              <span className="text-2xl font-bold">{data.score}/100</span>
            )}
          </div>
          {data.summary && <p className="mt-2 text-sm text-gray-600">{data.summary}</p>}
        </div>

        {/* Risk Factors */}
        {data.riskFactors && data.riskFactors.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Factores de Riesgo</h4>
            <div className="space-y-2">
              {data.riskFactors.map((factor, idx) => (
                <div key={idx} className={`p-2 rounded ${
                  factor.severity === 'high' ? 'bg-red-50' :
                  factor.severity === 'medium' ? 'bg-yellow-50' :
                  'bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{factor.factor || factor.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      factor.severity === 'high' ? 'bg-red-200 text-red-800' :
                      factor.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {factor.severity === 'high' ? 'Alto' : factor.severity === 'medium' ? 'Medio' : 'Bajo'}
                    </span>
                  </div>
                  {factor.description && <p className="text-xs text-gray-600 mt-1">{factor.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channel Prediction */}
        {data.channelPrediction && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Prediccion de Canal</h4>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                data.channelPrediction.channel === 'green' ? 'bg-green-200 text-green-800' :
                data.channelPrediction.channel === 'orange' ? 'bg-orange-200 text-orange-800' :
                'bg-red-200 text-red-800'
              }`}>
                {data.channelPrediction.channel === 'green' ? 'VERDE' :
                 data.channelPrediction.channel === 'orange' ? 'NARANJA' : 'ROJO'}
              </span>
              {data.channelPrediction.probability && (
                <span className="text-sm text-gray-600">
                  {(data.channelPrediction.probability * 100).toFixed(0)}% probabilidad
                </span>
              )}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-2">Recomendaciones</h4>
            <ul className="space-y-1 text-sm text-indigo-700">
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const renderInconsistencies = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className={`p-4 rounded-lg ${
          data.hasInconsistencies ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center gap-2">
            {data.hasInconsistencies ? (
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
            ) : (
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            )}
            <span className={`font-medium ${data.hasInconsistencies ? 'text-yellow-800' : 'text-green-800'}`}>
              {data.hasInconsistencies
                ? `${data.inconsistencies?.length || 0} inconsistencia(s) detectada(s)`
                : 'No se detectaron inconsistencias'}
            </span>
          </div>
        </div>

        {/* Inconsistencies List */}
        {data.inconsistencies && data.inconsistencies.length > 0 && (
          <div className="space-y-3">
            {data.inconsistencies.map((inc, idx) => (
              <div key={idx} className={`border rounded-lg p-4 ${
                inc.severity === 'critical' ? 'border-red-300 bg-red-50' :
                inc.severity === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                'border-gray-300 bg-gray-50'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-sm">{inc.type || inc.field}</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    inc.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    inc.severity === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {inc.severity === 'critical' ? 'Critico' : inc.severity === 'warning' ? 'Advertencia' : 'Info'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{inc.description || inc.message}</p>
                {inc.suggestion && (
                  <p className="text-xs text-blue-600 mt-2">
                    <span className="font-medium">Sugerencia:</span> {inc.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderFullAnalysis = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Overall Score */}
        <div className={`p-4 rounded-lg ${
          data.overallScore >= 80 ? 'bg-green-50 border border-green-200' :
          data.overallScore >= 60 ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-6 h-6 text-luci" />
              <span className="font-medium">Analisis Integral LUCI</span>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${
                data.overallScore >= 80 ? 'text-green-600' :
                data.overallScore >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {data.overallScore || 0}/100
              </span>
              <p className="text-xs text-gray-500">Puntuacion</p>
            </div>
          </div>
          {data.summary && <p className="mt-3 text-sm text-gray-600">{data.summary}</p>}
        </div>

        {/* Section Scores */}
        {data.sections && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.sections).map(([key, section]) => (
              <div key={key} className="bg-white border rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${
                  section.score >= 80 ? 'text-green-600' :
                  section.score >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {section.score || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">{section.label || key}</p>
              </div>
            ))}
          </div>
        )}

        {/* Critical Issues */}
        {data.criticalIssues && data.criticalIssues.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Problemas Criticos</h4>
            <ul className="space-y-1 text-sm text-red-700">
              {data.criticalIssues.map((issue, idx) => (
                <li key={idx}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* TARIC Suggestions */}
        {data.taricSuggestions && data.taricSuggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Sugerencias TARIC</h4>
            <div className="space-y-2">
              {data.taricSuggestions.map((sug, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="font-mono text-sm font-medium">{sug.taricCode}</p>
                    <p className="text-xs text-gray-500">{sug.description}</p>
                  </div>
                  <span className="text-sm font-medium text-blue-600">{(sug.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {data.actionItems && data.actionItems.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-3">Acciones Recomendadas</h4>
            <div className="space-y-2">
              {data.actionItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    item.priority === 'high' ? 'bg-red-200 text-red-800' :
                    item.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.action}</p>
                    {item.reason && <p className="text-xs text-gray-500">{item.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    const currentResult = results[activeTab]

    if (!currentResult) {
      return (
        <div className="text-center py-8">
          <SparklesIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {activeTab === 'documents' && 'Obtiene sugerencias de documentos necesarios'}
            {activeTab === 'risk' && 'Analiza el nivel de riesgo del expediente'}
            {activeTab === 'inconsistencies' && 'Detecta inconsistencias en los datos'}
            {activeTab === 'full' && 'Ejecuta un analisis completo con LUCI'}
          </p>
          <button
            onClick={() => runAnalysis(activeTab)}
            disabled={loading}
            className="px-6 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark disabled:opacity-50"
          >
            {loading ? 'Analizando...' : 'Ejecutar Analisis'}
          </button>
        </div>
      )
    }

    switch (activeTab) {
      case 'documents':
        return renderDocumentSuggestions(currentResult)
      case 'risk':
        return renderRiskAnalysis(currentResult)
      case 'inconsistencies':
        return renderInconsistencies(currentResult)
      case 'full':
        return renderFullAnalysis(currentResult)
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-luci to-luci-dark text-white">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-6 h-6" />
            <div>
              <h2 className="font-bold">Analisis IA - Expediente</h2>
              <p className="text-sm text-white/80">{expedition.expeditionId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-luci text-luci bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {results[tab.id] && (
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-luci" />
              <span className="ml-2 text-gray-500">Analizando con IA...</span>
            </div>
          ) : (
            renderContent()
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Cerrar
          </button>
          {results[activeTab] && (
            <button
              onClick={() => runAnalysis(activeTab)}
              disabled={loading}
              className="px-4 py-2 text-luci border border-luci rounded-lg hover:bg-luci hover:text-white disabled:opacity-50"
            >
              Actualizar Analisis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExpeditionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [expedition, setExpedition] = useState(null)
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generatingH1, setGeneratingH1] = useState(false)
  const [h1Result, setH1Result] = useState(null)
  const [submittingToAEAT, setSubmittingToAEAT] = useState(false)
  const [aeatResult, setAeatResult] = useState(null)
  const [portalLink, setPortalLink] = useState(null)
  const [showPortalModal, setShowPortalModal] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const expResponse = await expeditionsAPI.get(id)
        // Handle backend response format: { success, data: {...} }
        const expeditionData = expResponse.data?.data || expResponse.data
        setExpedition(expeditionData)

        // Try to get checklist, but don't fail if it doesn't exist
        try {
          const checklistResponse = await expeditionsAPI.getChecklist(id)
          const checklistData = checklistResponse.data?.data || checklistResponse.data
          setChecklist(checklistData)
        } catch (checklistError) {
          console.log('Checklist not available')
          setChecklist(null)
        }
      } catch (error) {
        console.error('Error loading expedition:', error)
        toast.error('Error al cargar expediente')
        navigate('/expeditions')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, navigate])

  const handleSendPortalLink = async () => {
    try {
      const response = await expeditionsAPI.sendPortalLink(id)
      const data = response.data?.data || response.data
      const url = data?.portalUrl || response.data?.portalUrl
      setPortalLink(url)
      setShowPortalModal(true)
      toast.success('Enlace de portal generado')
    } catch (error) {
      toast.error('Error al enviar enlace')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Link copiado al portapapeles')
  }

  const handleGenerateH1 = async () => {
    setGeneratingH1(true)
    setH1Result(null)
    try {
      const response = await declarationsAPI.generateH1({
        expeditionId: id,
        regime: expedition.declaration?.regime || '40',
        preference: expedition.declaration?.preference || '100'
      })
      // Handle backend response format
      const resultData = response.data?.data || response.data
      setH1Result(resultData)

      // Refresh expedition to get updated declaration
      const expResponse = await expeditionsAPI.get(id)
      const expeditionData = expResponse.data?.data || expResponse.data
      setExpedition(expeditionData)

      toast.success('Declaracion H1 generada correctamente')
    } catch (error) {
      console.error('H1 generation error:', error)
      toast.error(error.response?.data?.error || 'Error al generar H1')
    } finally {
      setGeneratingH1(false)
    }
  }

  const handleExportXML = async () => {
    try {
      const response = await declarationsAPI.exportXML(id, 'H1')
      const blob = new Blob([response.data], { type: 'application/xml' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `H1_${expedition.expeditionId}.xml`
      a.click()
      toast.success('XML descargado')
    } catch (error) {
      toast.error('Error al exportar XML')
    }
  }

  const handleSubmitToAEAT = async () => {
    if (!expedition.declaration?.xmlContent) {
      toast.error('Primero debe generar la declaracion H1')
      return
    }

    setSubmittingToAEAT(true)
    setAeatResult(null)
    try {
      const response = await declarationsAPI.submit(id)
      const resultData = response.data?.data || response.data
      setAeatResult(resultData)

      // Refresh expedition
      const expResponse = await expeditionsAPI.get(id)
      const expeditionData = expResponse.data?.data || expResponse.data
      setExpedition(expeditionData)

      // Show toast based on channel
      if (resultData.channel === 'green') {
        toast.success(`Canal VERDE - MRN: ${resultData.mrn}`)
      } else if (resultData.channel === 'orange') {
        toast('Canal NARANJA - Revision documental', { icon: '🟠' })
      } else {
        toast('Canal ROJO - Inspeccion fisica', { icon: '🔴' })
      }
    } catch (error) {
      console.error('AEAT submission error:', error)
      toast.error(error.response?.data?.error || 'Error al enviar a AEAT')
    } finally {
      setSubmittingToAEAT(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { label: 'Borrador', class: 'bg-gray-100 text-gray-800', icon: ClockIcon },
      'pending_documents': { label: 'Pendiente Docs', class: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
      'documents_received': { label: 'Docs Recibidos', class: 'bg-blue-100 text-blue-800', icon: DocumentTextIcon },
      'validating_documents': { label: 'Validando', class: 'bg-purple-100 text-purple-800', icon: ExclamationCircleIcon },
      'documents_validated': { label: 'Docs Validados', class: 'bg-indigo-100 text-indigo-800', icon: CheckCircleIcon },
      'ready_for_declaration': { label: 'Listo Declaracion', class: 'bg-cyan-100 text-cyan-800', icon: DocumentTextIcon },
      'declaration_submitted': { label: 'Presentada', class: 'bg-orange-100 text-orange-800', icon: CheckCircleIcon },
      'green_channel': { label: 'Canal Verde', class: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      'completed': { label: 'Completado', class: 'bg-green-100 text-green-800', icon: CheckCircleIcon }
    }
    const config = statusMap[status] || { label: status, class: 'bg-gray-100 text-gray-800', icon: ClockIcon }
    const Icon = config.icon
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class} flex items-center gap-1`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
      </div>
    )
  }

  if (!expedition) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/expeditions')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{expedition.expeditionId}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${expedition.operationType === 'import' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                {expedition.operationType === 'import' ? 'Importacion' : 'Exportacion'}
              </span>
              {getStatusBadge(expedition.status)}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAIPanel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-luci to-luci-dark text-white rounded-lg hover:opacity-90"
          >
            <SparklesIcon className="w-5 h-5" />
            Analisis IA
          </button>
          <button
            onClick={handleSendPortalLink}
            className="btn-secondary flex items-center gap-2"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
            Enviar Portal
          </button>
          {expedition.operationType === 'import' && (
            <button
              onClick={handleGenerateH1}
              disabled={generatingH1}
              className="btn-primary flex items-center gap-2"
            >
              <DocumentTextIcon className="w-5 h-5" />
              {generatingH1 ? 'Generando...' : 'Generar H1'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">
              {expedition.operationType === 'import' ? 'Importador' : 'Exportador'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Razon Social</p>
                <p className="font-medium">{expedition.client?.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">NIF/CIF</p>
                <p className="font-medium">{expedition.client?.nif}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">EORI</p>
                <p className="font-medium">{expedition.client?.eori || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contacto</p>
                <p className="font-medium">{expedition.client?.contact?.name || 'N/A'}</p>
                <p className="text-xs text-gray-500">{expedition.client?.contact?.email || ''}</p>
              </div>
            </div>
          </div>

          {/* Goods */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Mercancias ({expedition.goods?.length || 0} partidas)</h2>
            <div className="space-y-4">
              {expedition.goods?.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium">Partida {index + 1}</h3>
                    <span className="text-sm text-gray-500">
                      {item.taricCode || 'Sin TARIC'}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{item.description}</p>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Origen</p>
                      <p className="font-medium">{item.originCountry}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Peso Neto</p>
                      <p className="font-medium">{item.netWeight || '-'} kg</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Peso Bruto</p>
                      <p className="font-medium">{item.grossWeight || '-'} kg</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Valor</p>
                      <p className="font-medium">{item.invoiceValue} {item.currency}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Documentos</h2>
              <span className="text-sm text-gray-500">
                {expedition.documents?.length || 0} subidos
              </span>
            </div>

            {expedition.documents?.length > 0 ? (
              <div className="space-y-2">
                {expedition.documents.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">{doc.originalName}</p>
                        <p className="text-xs text-gray-500">{doc.documentType}</p>
                      </div>
                    </div>
                    <span className={`badge ${doc.validationStatus === 'VALIDATED' ? 'badge-completed' : 'badge-pending'}`}>
                      {doc.validationStatus === 'VALIDATED' ? 'Validado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DocumentArrowUpIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay documentos subidos</p>
                <p className="text-sm">El cliente puede subirlos desde el portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Checklist */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Checklist de Documentos</h2>
            {checklist?.checklist ? (
              <div className="space-y-2">
                {checklist.checklist.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      item.uploaded ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {item.uploaded ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span>{item.name}</span>
                    {item.required && !item.uploaded && (
                      <span className="text-xs text-red-500 ml-auto">Requerido</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Cargando checklist...</p>
            )}
          </div>

          {/* Transport Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Transporte</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Modo</p>
                <p className="font-medium capitalize">{expedition.transportMode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Incoterm</p>
                <p className="font-medium">{expedition.incoterm?.code} {expedition.incoterm?.place}</p>
              </div>
              {expedition.transport?.documentNumber && (
                <div>
                  <p className="text-sm text-gray-500">Doc. Transporte</p>
                  <p className="font-medium">{expedition.transport.documentNumber}</p>
                </div>
              )}
              {expedition.transport?.carrier && (
                <div>
                  <p className="text-sm text-gray-500">Transportista</p>
                  <p className="font-medium">{expedition.transport.carrier}</p>
                </div>
              )}
            </div>
          </div>

          {/* H1 Generation Result */}
          {(h1Result || expedition.declaration?.xmlContent) && (
            <div className="card border-2 border-green-200 bg-green-50">
              <h2 className="text-lg font-semibold mb-4 text-green-800">Declaracion H1 Generada</h2>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">LRN (Referencia Local)</p>
                  <p className="font-medium font-mono text-xs">{h1Result?.declaration?.lrn || expedition.declaration?.lrn}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tipo Declaracion</p>
                  <p className="font-medium">H1 - Importacion</p>
                </div>
                <div>
                  <p className="text-gray-500">Aduana</p>
                  <p className="font-medium">{h1Result?.declaration?.customsOffice || expedition.declaration?.customsOffice}</p>
                </div>
                <div>
                  <p className="text-gray-500">Regimen</p>
                  <p className="font-medium">{h1Result?.declaration?.regime || expedition.declaration?.regime || '40'} - Despacho libre practica</p>
                </div>
                <div>
                  <p className="text-gray-500">Preferencia</p>
                  <p className="font-medium">{h1Result?.declaration?.preference || expedition.declaration?.preference || '100'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Estado</p>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {expedition.declaration?.status === 'draft' ? 'Borrador' : expedition.declaration?.status}
                  </span>
                </div>
              </div>

              {h1Result?.summary && (
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <p className="text-gray-700 font-medium text-sm mb-2">Resumen:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Partidas:</span>
                      <span className="ml-1 font-medium">{h1Result.summary.totalItems}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bultos:</span>
                      <span className="ml-1 font-medium">{h1Result.summary.totalPackages}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Peso Bruto:</span>
                      <span className="ml-1 font-medium">{h1Result.summary.totalGrossWeight?.toLocaleString('es-ES')} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Valor:</span>
                      <span className="ml-1 font-medium">{h1Result.summary.totalValue?.toLocaleString('es-ES')} EUR</span>
                    </div>
                  </div>
                </div>
              )}

              {h1Result?.warnings && h1Result.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                  <p className="text-yellow-800 font-medium text-sm mb-1">Advertencias:</p>
                  <ul className="text-yellow-700 text-xs list-disc list-inside">
                    {h1Result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* XML Preview */}
              {(h1Result?.xml || expedition.declaration?.xmlContent) && (
                <div className="mt-4">
                  <p className="text-gray-600 font-medium text-sm mb-2">XML para AEAT (CC515C):</p>
                  <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64 font-mono">
                    {(h1Result?.xml || expedition.declaration?.xmlContent)?.substring(0, 2000)}
                    {(h1Result?.xml || expedition.declaration?.xmlContent)?.length > 2000 && '\n\n... (XML truncado para visualizacion)'}
                  </pre>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const xml = h1Result?.xml || expedition.declaration?.xmlContent
                    const blob = new Blob([xml], { type: 'application/xml' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `H1_${expedition.expeditionId}_${expedition.declaration?.lrn || 'draft'}.xml`
                    a.click()
                    window.URL.revokeObjectURL(url)
                    toast.success('XML descargado')
                  }}
                  className="btn-success text-sm flex items-center gap-1"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Descargar XML
                </button>
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(h1Result?.h1Data || expedition.declaration?.h1Data, null, 2)
                    const blob = new Blob([dataStr], { type: 'application/json' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `H1_${expedition.expeditionId}_data.json`
                    a.click()
                    window.URL.revokeObjectURL(url)
                  }}
                  className="btn-secondary text-sm"
                >
                  Descargar JSON
                </button>
              </div>

              {/* Boton Enviar a AEAT */}
              {expedition.declaration?.status === 'draft' && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <button
                    onClick={handleSubmitToAEAT}
                    disabled={submittingToAEAT}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <CloudArrowUpIcon className="w-5 h-5" />
                    {submittingToAEAT ? 'Enviando a AEAT...' : 'Enviar a AEAT'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Modo demo: simula el envio a los Web Services de AEAT
                  </p>
                </div>
              )}
            </div>
          )}

          {/* AEAT Submission Result */}
          {(aeatResult || expedition.declaration?.mrn) && (
            <div className={`card border-2 ${
              expedition.declaration?.channel === 'green' ? 'border-green-400 bg-green-50' :
              expedition.declaration?.channel === 'orange' ? 'border-orange-400 bg-orange-50' :
              expedition.declaration?.channel === 'red' ? 'border-red-400 bg-red-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 ${
                expedition.declaration?.channel === 'green' ? 'text-green-800' :
                expedition.declaration?.channel === 'orange' ? 'text-orange-800' :
                expedition.declaration?.channel === 'red' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                Respuesta AEAT
              </h2>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">MRN (Movement Reference Number)</p>
                  <p className="font-mono font-bold text-lg">{aeatResult?.mrn || expedition.declaration?.mrn}</p>
                </div>

                <div>
                  <p className="text-gray-500">Canal de Inspeccion</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                    expedition.declaration?.channel === 'green' ? 'bg-green-200 text-green-800' :
                    expedition.declaration?.channel === 'orange' ? 'bg-orange-200 text-orange-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {expedition.declaration?.channel === 'green' ? '🟢 CANAL VERDE' :
                     expedition.declaration?.channel === 'orange' ? '🟠 CANAL NARANJA' :
                     '🔴 CANAL ROJO'}
                  </span>
                </div>

                <div>
                  <p className="text-gray-500">Estado</p>
                  <p className="font-medium">
                    {expedition.declaration?.channel === 'green' ? 'Levante autorizado - Mercancia puede retirarse' :
                     expedition.declaration?.channel === 'orange' ? 'Pendiente revision documental' :
                     'Pendiente inspeccion fisica'}
                  </p>
                </div>

                {expedition.declaration?.levanteDate && (
                  <div>
                    <p className="text-gray-500">Fecha Levante</p>
                    <p className="font-medium">{new Date(expedition.declaration.levanteDate).toLocaleString('es-ES')}</p>
                  </div>
                )}

                {aeatResult?.duties && (
                  <div className="mt-3 p-3 bg-white rounded-lg border">
                    <p className="font-medium text-gray-700 mb-2">Liquidacion Estimada:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Derechos:</span>
                        <span className="ml-1 font-medium">{aeatResult.duties.dutyAmount?.toLocaleString('es-ES')} EUR</span>
                      </div>
                      <div>
                        <span className="text-gray-500">IVA:</span>
                        <span className="ml-1 font-medium">{aeatResult.duties.vatAmount?.toLocaleString('es-ES')} EUR</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t">
                        <span className="text-gray-700 font-medium">Total:</span>
                        <span className="ml-1 font-bold">{aeatResult.duties.totalAmount?.toLocaleString('es-ES')} EUR</span>
                      </div>
                    </div>
                  </div>
                )}

                {aeatResult?.simulated && (
                  <p className="text-xs text-gray-500 italic mt-2">
                    * Respuesta simulada (modo demo)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Channel Status - Shown when declaration has channel */}
          {expedition.declaration?.channel && (
            <ChannelStatus
              expeditionId={id}
              channel={expedition.declaration.channel}
              onStatusChange={() => {
                expeditionsAPI.get(id).then(resp => {
                  const data = resp.data?.data || resp.data
                  setExpedition(data)
                })
              }}
            />
          )}

          {/* Requirements AEAT - Shown when declaration is submitted */}
          {expedition.declaration?.mrn && (
            <div className="card">
              <RequirementManager
                expeditionId={id}
                onRequirementChange={() => {
                  // Refresh expedition data when requirements change
                  expeditionsAPI.get(id).then(resp => {
                    const data = resp.data?.data || resp.data
                    setExpedition(data)
                  })
                }}
              />
            </div>
          )}

          {/* Paraduanero Controls - SOIVRE, MAPA, Sanidad, MITERD */}
          <div className="card">
            <ParaduaneroManager
              expeditionId={id}
              onControlsChange={() => {
                expeditionsAPI.get(id).then(resp => {
                  const data = resp.data?.data || resp.data
                  setExpedition(data)
                })
              }}
            />
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Acciones</h2>
            <div className="space-y-2">
              <Link
                to={`/classification?expedition=${id}`}
                className="w-full btn-secondary text-center block"
              >
                Clasificar TARIC
              </Link>
              <Link
                to={`/calculator?expedition=${id}`}
                className="w-full btn-secondary text-center block"
              >
                Calcular Derechos
              </Link>
              {expedition.declaration?.h1Data && (
                <button
                  onClick={handleExportXML}
                  className="w-full btn-success"
                >
                  Descargar XML H1
                </button>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Historial</h2>
            <div className="space-y-3">
              {expedition.timeline?.slice(-5).reverse().map((event, index) => (
                <div key={index} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-luci" />
                  <div>
                    <p className="font-medium">{event.action}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(event.timestamp).toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Portal Link Modal */}
      {showPortalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <LinkIcon className="h-8 w-8 text-luci" />
              <h3 className="text-xl font-bold">Link del Portal del Cliente</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Comparte este enlace con tu cliente para que pueda subir los documentos requeridos:
            </p>

            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={portalLink || ''}
                  className="flex-1 bg-transparent text-sm font-mono border-none focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(portalLink)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Copiar al portapapeles"
                >
                  <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(portalLink)}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <ClipboardDocumentIcon className="h-5 w-5" />
                Copiar Link
              </button>
              <a
                href={portalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <LinkIcon className="h-5 w-5" />
                Abrir Portal
              </a>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Nota:</strong> El cliente no necesita crear cuenta.
                El link es unico para este expediente y expira en 30 dias.
              </p>
            </div>

            <button
              onClick={() => setShowPortalModal(false)}
              className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* AI Panel Modal */}
      {showAIPanel && (
        <ExpeditionAIPanel
          expedition={expedition}
          onClose={() => setShowAIPanel(false)}
          onRefresh={() => {
            expeditionsAPI.get(id).then(resp => {
              const data = resp.data?.data || resp.data
              setExpedition(data)
            })
          }}
        />
      )}
    </div>
  )
}
