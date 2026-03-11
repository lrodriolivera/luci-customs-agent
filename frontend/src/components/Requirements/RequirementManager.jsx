import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { requirementsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  CalendarIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  EyeIcon,
  XMarkIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline'

// Mapeo de estados a colores y textos
const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente', icon: ClockIcon },
  in_progress: { color: 'bg-blue-100 text-blue-800', label: 'En Proceso', icon: ClockIcon },
  awaiting_client: { color: 'bg-purple-100 text-purple-800', label: 'Esperando Cliente', icon: ClockIcon },
  response_ready: { color: 'bg-indigo-100 text-indigo-800', label: 'Respuesta Lista', icon: DocumentTextIcon },
  submitted: { color: 'bg-cyan-100 text-cyan-800', label: 'Enviado', icon: PaperAirplaneIcon },
  under_review: { color: 'bg-orange-100 text-orange-800', label: 'En Revision', icon: EyeIcon },
  resolved: { color: 'bg-green-100 text-green-800', label: 'Resuelto', icon: CheckCircleIcon },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rechazado', icon: XCircleIcon },
  closed: { color: 'bg-gray-100 text-gray-800', label: 'Cerrado', icon: CheckCircleIcon }
}

// Mapeo de canales a colores
const CHANNEL_CONFIG = {
  green: { color: 'bg-green-500', label: 'Verde', description: 'Levante automatico' },
  yellow: { color: 'bg-yellow-500', label: 'Amarillo', description: 'Certificados pendientes' },
  orange: { color: 'bg-orange-500', label: 'Naranja', description: 'Revision documental' },
  red: { color: 'bg-red-500', label: 'Rojo', description: 'Inspeccion fisica' }
}

// Mapeo de tipos de requerimiento
const TYPE_LABELS = {
  documentary: 'Revision Documental',
  physical: 'Inspeccion Fisica',
  valuation: 'Valoracion',
  classification: 'Clasificacion',
  origin: 'Origen',
  license: 'Licencia',
  certificate: 'Certificado',
  paraduanero: 'Paraduanero',
  other: 'Otro'
}

// ==================== Requirement AI Panel Component ====================
function RequirementAIPanel({ requirement, onClose, onApplySuggestion }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('analyze')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState({
    analyze: null,
    arguments: null,
    risk: null,
    draft: null,
    full: null
  })

  const tabs = [
    { id: 'analyze', label: 'Analizar Docs', icon: DocumentMagnifyingGlassIcon },
    { id: 'arguments', label: 'Sugerir Argumentos', icon: LightBulbIcon },
    { id: 'risk', label: 'Analizar Riesgo', icon: ShieldExclamationIcon },
    { id: 'draft', label: 'Redactar Respuesta', icon: ChatBubbleLeftRightIcon },
    { id: 'full', label: 'Analisis Completo', icon: SparklesIcon }
  ]

  const runAnalysis = async (type) => {
    try {
      setLoading(true)
      setError(null)
      let res

      switch (type) {
        case 'analyze':
          res = await requirementsAPI.aiAnalyzeDocuments(requirement._id)
          break
        case 'arguments':
          res = await requirementsAPI.aiSuggestArguments(requirement._id)
          break
        case 'risk':
          res = await requirementsAPI.aiAnalyzeRisk(requirement._id)
          break
        case 'draft':
          res = await requirementsAPI.aiDraftResponse(requirement._id)
          break
        case 'full':
          res = await requirementsAPI.aiFullAnalysis(requirement._id)
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

  const renderDocumentAnalysis = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className={`p-4 rounded-lg ${
          data.isComplete ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {data.isComplete ? (
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            ) : (
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
            )}
            <span className={`font-medium ${data.isComplete ? 'text-green-800' : 'text-yellow-800'}`}>
              {data.isComplete ? 'Documentacion Completa' : 'Documentacion Incompleta'}
            </span>
          </div>
          {data.summary && <p className="mt-2 text-sm text-gray-600">{data.summary}</p>}
        </div>

        {/* Missing Documents */}
        {data.missingDocuments && data.missingDocuments.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Documentos Faltantes</h4>
            <ul className="space-y-1 text-sm text-red-700">
              {data.missingDocuments.map((doc, idx) => (
                <li key={idx}>• {doc.name || doc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Document Issues */}
        {data.issues && data.issues.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Problemas Detectados</h4>
            <ul className="space-y-2">
              {data.issues.map((issue, idx) => (
                <li key={idx} className="text-sm">
                  <p className="font-medium text-yellow-700">{issue.document}</p>
                  <p className="text-yellow-600">{issue.problem}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Recomendaciones</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const renderArguments = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Legal Arguments */}
        {data.legalArguments && data.legalArguments.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-3">Argumentos Legales</h4>
            <div className="space-y-3">
              {data.legalArguments.map((arg, idx) => (
                <div key={idx} className="bg-white p-3 rounded border">
                  <p className="font-medium text-sm text-gray-800">{arg.title || arg.argument}</p>
                  {arg.basis && <p className="text-xs text-gray-500 mt-1">Base: {arg.basis}</p>}
                  {arg.reference && <p className="text-xs text-indigo-600 mt-1">Ref: {arg.reference}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Arguments */}
        {data.technicalArguments && data.technicalArguments.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-3">Argumentos Tecnicos</h4>
            <div className="space-y-3">
              {data.technicalArguments.map((arg, idx) => (
                <div key={idx} className="bg-white p-3 rounded border">
                  <p className="font-medium text-sm text-gray-800">{arg.title || arg.argument}</p>
                  {arg.evidence && <p className="text-xs text-gray-500 mt-1">Evidencia: {arg.evidence}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Precedents */}
        {data.precedents && data.precedents.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">Precedentes Relevantes</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {data.precedents.map((prec, idx) => (
                <li key={idx}>• {prec.reference}: {prec.summary}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested Strategy */}
        {data.strategy && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">Estrategia Sugerida</h4>
            <p className="text-sm text-green-700">{data.strategy}</p>
          </div>
        )}
      </div>
    )
  }

  const renderRiskAnalysis = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Risk Level */}
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
            {data.probability && (
              <span className="text-sm font-medium">
                {(data.probability * 100).toFixed(0)}% probabilidad resolucion negativa
              </span>
            )}
          </div>
          {data.summary && <p className="mt-2 text-sm text-gray-600">{data.summary}</p>}
        </div>

        {/* Potential Outcomes */}
        {data.potentialOutcomes && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Posibles Resultados</h4>
            <div className="space-y-2">
              {data.potentialOutcomes.map((outcome, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">{outcome.result}</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    outcome.likelihood === 'high' ? 'bg-green-200 text-green-800' :
                    outcome.likelihood === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {(outcome.probability * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mitigation Steps */}
        {data.mitigationSteps && data.mitigationSteps.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Pasos de Mitigacion</h4>
            <ol className="space-y-1 text-sm text-blue-700 list-decimal list-inside">
              {data.mitigationSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    )
  }

  const renderDraftResponse = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Draft Response */}
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-medium text-gray-700 mb-3">Respuesta Sugerida</h4>
          <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap text-sm">
            {data.draftResponse || data.response}
          </div>
        </div>

        {/* Key Points */}
        {data.keyPoints && data.keyPoints.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Puntos Clave</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              {data.keyPoints.map((point, idx) => (
                <li key={idx}>• {point}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested Attachments */}
        {data.suggestedAttachments && data.suggestedAttachments.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Documentos a Adjuntar</h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              {data.suggestedAttachments.map((att, idx) => (
                <li key={idx}>• {att}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Apply Button */}
        <button
          onClick={() => onApplySuggestion && onApplySuggestion(data.draftResponse || data.response)}
          className="w-full py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
        >
          Usar Esta Respuesta
        </button>
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

        {/* Embedded Sections */}
        {data.documentAnalysis && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Analisis Documental</h4>
            {renderDocumentAnalysis(data.documentAnalysis)}
          </div>
        )}

        {data.riskAssessment && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Evaluacion de Riesgo</h4>
            <div className={`p-3 rounded ${
              data.riskAssessment.level === 'high' ? 'bg-red-50' :
              data.riskAssessment.level === 'medium' ? 'bg-yellow-50' :
              'bg-green-50'
            }`}>
              <p className="font-medium">
                Riesgo: {data.riskAssessment.level === 'high' ? 'Alto' :
                        data.riskAssessment.level === 'medium' ? 'Medio' : 'Bajo'}
              </p>
            </div>
          </div>
        )}

        {/* Recommended Response */}
        {data.recommendedResponse && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-2">Respuesta Recomendada</h4>
            <p className="text-sm text-indigo-700 whitespace-pre-wrap">{data.recommendedResponse}</p>
            <button
              onClick={() => onApplySuggestion && onApplySuggestion(data.recommendedResponse)}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              Usar Esta Respuesta
            </button>
          </div>
        )}

        {/* Action Items */}
        {data.actionItems && data.actionItems.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-3">Acciones Recomendadas</h4>
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
                  <p className="text-sm text-gray-700">{item.action}</p>
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
            {activeTab === 'analyze' && 'Analiza los documentos asociados al requerimiento'}
            {activeTab === 'arguments' && 'Sugiere argumentos legales y tecnicos'}
            {activeTab === 'risk' && 'Evalua el riesgo de resolucion negativa'}
            {activeTab === 'draft' && 'Redacta una respuesta profesional'}
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
      case 'analyze':
        return renderDocumentAnalysis(currentResult)
      case 'arguments':
        return renderArguments(currentResult)
      case 'risk':
        return renderRiskAnalysis(currentResult)
      case 'draft':
        return renderDraftResponse(currentResult)
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
              <h2 className="font-bold">Analisis IA - Requerimiento</h2>
              <p className="text-sm text-white/80">{requirement.requirementNumber} - {requirement.subject}</p>
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

export default function RequirementManager({ expeditionId, onRequirementChange }) {
  const { t } = useTranslation()
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showResponseForm, setShowResponseForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(null)
  const [showAIPanel, setShowAIPanel] = useState(null) // requirement object or null

  // Formulario nuevo requerimiento
  const [newRequirement, setNewRequirement] = useState({
    requirementType: 'documentary',
    channel: 'orange',
    subject: '',
    description: '',
    deadline: '',
    requestedItems: []
  })

  // Formulario respuesta
  const [responseForm, setResponseForm] = useState({
    responseType: 'documentary',
    notes: ''
  })

  // Cargar requerimientos
  useEffect(() => {
    if (expeditionId) {
      loadRequirements()
    }
  }, [expeditionId])

  const loadRequirements = async () => {
    try {
      setLoading(true)
      const response = await requirementsAPI.getByExpedition(expeditionId)
      const data = response.data?.data || response.data || []
      setRequirements(data)
    } catch (error) {
      console.error('Error loading requirements:', error)
      toast.error(t('requirements.errorLoading'))
    } finally {
      setLoading(false)
    }
  }

  // Crear nuevo requerimiento
  const handleCreateRequirement = async (e) => {
    e.preventDefault()
    if (!newRequirement.subject || !newRequirement.description) {
      toast.error(t('requirements.fillRequired'))
      return
    }

    setSubmitting(true)
    try {
      await requirementsAPI.create({
        expeditionId,
        ...newRequirement
      })
      toast.success(t('requirements.created'))
      setShowNewForm(false)
      setNewRequirement({
        requirementType: 'documentary',
        channel: 'orange',
        subject: '',
        description: '',
        deadline: '',
        requestedItems: []
      })
      loadRequirements()
      onRequirementChange?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear requerimiento')
    } finally {
      setSubmitting(false)
    }
  }

  // Agregar respuesta
  const handleAddResponse = async (requirementId) => {
    if (!responseForm.notes) {
      toast.error(t('requirements.writeResponse'))
      return
    }

    setSubmitting(true)
    try {
      await requirementsAPI.addResponse(requirementId, responseForm)
      toast.success(t('requirements.responseAdded'))
      setShowResponseForm(null)
      setResponseForm({ responseType: 'documentary', notes: '' })
      loadRequirements()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al agregar respuesta')
    } finally {
      setSubmitting(false)
    }
  }

  // Enviar a AEAT
  const handleSubmitToAEAT = async (requirementId, responseIndex) => {
    setSubmitting(true)
    try {
      const response = await requirementsAPI.submitToAEAT(requirementId, responseIndex)
      const result = response.data?.data || response.data
      toast.success(result.message || 'Enviado a AEAT')
      loadRequirements()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al enviar a AEAT')
    } finally {
      setSubmitting(false)
    }
  }

  // Generar respuesta con IA
  const handleGenerateAI = async (requirementId) => {
    setGeneratingAI(requirementId)
    try {
      const response = await requirementsAPI.generateAIResponse(requirementId)
      const data = response.data?.data || response.data
      setResponseForm({
        responseType: 'documentary',
        notes: data.suggestedResponse || ''
      })
      setShowResponseForm(requirementId)
      toast.success(t('requirements.aiResponseGenerated'))
    } catch (error) {
      toast.error(t('requirements.errorAiResponse'))
    } finally {
      setGeneratingAI(null)
    }
  }

  // Resolver requerimiento
  const handleResolve = async (requirementId, status) => {
    setSubmitting(true)
    try {
      await requirementsAPI.resolve(requirementId, {
        status,
        notes: `Resuelto como ${status}`
      })
      toast.success(t('requirements.resolved'))
      loadRequirements()
      onRequirementChange?.()
    } catch (error) {
      toast.error('Error al resolver requerimiento')
    } finally {
      setSubmitting(false)
    }
  }

  // Calcular dias restantes
  const getDaysRemaining = (deadline) => {
    if (!deadline) return null
    const now = new Date()
    const dl = new Date(deadline)
    const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('requirements.title')}
          {requirements.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({requirements.length})
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t('requirements.newRequirement')}
        </button>
      </div>

      {/* Formulario nuevo requerimiento */}
      {showNewForm && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">{t('requirements.createRequirement')}</h4>
          <form onSubmit={handleCreateRequirement} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('requirements.requirementType')}
                </label>
                <select
                  value={newRequirement.requirementType}
                  onChange={(e) => setNewRequirement({ ...newRequirement, requirementType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('requirements.channel')}
                </label>
                <select
                  value={newRequirement.channel}
                  onChange={(e) => setNewRequirement({ ...newRequirement, channel: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="yellow">{t('requirements.channelYellow')} - {t('requirements.channelYellowDesc')}</option>
                  <option value="orange">{t('requirements.channelOrange')} - {t('requirements.channelOrangeDesc')}</option>
                  <option value="red">{t('requirements.channelRed')} - {t('requirements.channelRedDesc')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('requirements.subject')} *
              </label>
              <input
                type="text"
                value={newRequirement.subject}
                onChange={(e) => setNewRequirement({ ...newRequirement, subject: e.target.value })}
                placeholder="Ej: Solicitud de factura comercial"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.description')} *
              </label>
              <textarea
                value={newRequirement.description}
                onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                placeholder="Detalle del requerimiento..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('requirements.deadline')}
              </label>
              <input
                type="date"
                value={newRequirement.deadline}
                onChange={(e) => setNewRequirement({ ...newRequirement, deadline: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t('requirements.creating') : t('requirements.createRequirement')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de requerimientos */}
      {requirements.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <p className="text-gray-600">{t('requirements.noPendingRequirements')}</p>
          <p className="text-sm text-gray-500">{t('requirements.expeditionNoRequirements')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((req) => {
            const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
            const channelConfig = CHANNEL_CONFIG[req.channel] || CHANNEL_CONFIG.orange
            const daysRemaining = getDaysRemaining(req.deadline)
            const isExpanded = expandedId === req._id
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={req._id}
                className={`border rounded-lg overflow-hidden ${
                  daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0
                    ? 'border-orange-300 bg-orange-50'
                    : daysRemaining !== null && daysRemaining < 0
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Header del requerimiento */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : req._id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Indicador de canal */}
                      <div
                        className={`w-3 h-3 rounded-full mt-1.5 ${channelConfig.color}`}
                        title={`Canal ${channelConfig.label}`}
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {req.requirementNumber}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{req.subject}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{TYPE_LABELS[req.requirementType] || req.requirementType}</span>
                          {req.deadline && (
                            <span className={`flex items-center gap-1 ${
                              daysRemaining < 0 ? 'text-red-600 font-medium' :
                              daysRemaining <= 3 ? 'text-orange-600 font-medium' : ''
                            }`}>
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {daysRemaining < 0
                                ? `Vencido hace ${Math.abs(daysRemaining)} dias`
                                : daysRemaining === 0
                                ? 'Vence hoy'
                                : `${daysRemaining} dias restantes`}
                            </span>
                          )}
                          {req.responses?.length > 0 && (
                            <span>{req.responses.length} respuesta(s)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {daysRemaining !== null && daysRemaining <= 3 && req.status !== 'resolved' && (
                        <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                      )}
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 bg-gray-50">
                    {/* Descripcion */}
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Descripcion</h5>
                      <p className="text-sm text-gray-600">{req.description}</p>
                    </div>

                    {/* Items solicitados */}
                    {req.requestedItems && req.requestedItems.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Items Solicitados</h5>
                        <ul className="space-y-1">
                          {req.requestedItems.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              {item.provided ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                              )}
                              <span className={item.provided ? 'text-gray-500 line-through' : 'text-gray-700'}>
                                {item.description}
                              </span>
                              {item.mandatory && !item.provided && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Respuestas anteriores */}
                    {req.responses && req.responses.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Respuestas</h5>
                        <div className="space-y-2">
                          {req.responses.map((resp, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium">Respuesta #{resp.responseNumber}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(resp.submittedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-600 whitespace-pre-wrap">{resp.notes}</p>
                              {resp.aeatSubmission?.submitted && (
                                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircleIcon className="h-3.5 w-3.5" />
                                  Enviado a AEAT - {resp.aeatSubmission.confirmationNumber}
                                </div>
                              )}
                              {!resp.aeatSubmission?.submitted && req.status !== 'resolved' && (
                                <button
                                  onClick={() => handleSubmitToAEAT(req._id, idx)}
                                  disabled={submitting}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <PaperAirplaneIcon className="h-3.5 w-3.5" />
                                  Enviar a AEAT
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inspeccion fisica (canal rojo) */}
                    {req.channel === 'red' && req.physicalInspection && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                        <h5 className="text-sm font-medium text-red-800 mb-2">Inspeccion Fisica</h5>
                        {req.physicalInspection.scheduled ? (
                          <div className="text-sm text-red-700">
                            <p>Fecha: {new Date(req.physicalInspection.scheduledDate).toLocaleDateString()}</p>
                            <p>Hora: {req.physicalInspection.scheduledTime}</p>
                            <p>Lugar: {req.physicalInspection.location?.name}</p>
                            {req.physicalInspection.completed && (
                              <p className="mt-2 font-medium">
                                Resultado: {req.physicalInspection.result}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-red-600">Pendiente de programar</p>
                        )}
                      </div>
                    )}

                    {/* Formulario de respuesta */}
                    {showResponseForm === req._id && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <h5 className="text-sm font-medium text-blue-800 mb-2">Nueva Respuesta</h5>
                        <div className="space-y-3">
                          <select
                            value={responseForm.responseType}
                            onChange={(e) => setResponseForm({ ...responseForm, responseType: e.target.value })}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="documentary">Documentacion</option>
                            <option value="clarification">Aclaracion</option>
                            <option value="additional_info">Informacion Adicional</option>
                          </select>
                          <textarea
                            value={responseForm.notes}
                            onChange={(e) => setResponseForm({ ...responseForm, notes: e.target.value })}
                            placeholder="Escribe tu respuesta..."
                            rows={4}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setShowResponseForm(null)
                                setResponseForm({ responseType: 'documentary', notes: '' })
                              }}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleAddResponse(req._id)}
                              disabled={submitting}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {submitting ? 'Guardando...' : 'Guardar Respuesta'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Acciones */}
                    {req.status !== 'resolved' && req.status !== 'closed' && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t">
                        <button
                          onClick={() => setShowResponseForm(req._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded hover:bg-gray-50"
                        >
                          <DocumentTextIcon className="h-4 w-4" />
                          Agregar Respuesta
                        </button>
                        <button
                          onClick={() => handleGenerateAI(req._id)}
                          disabled={generatingAI === req._id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          {generatingAI === req._id ? 'Generando...' : 'Generar con IA'}
                        </button>
                        <button
                          onClick={() => setShowAIPanel(req)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gradient-to-r from-luci to-luci-dark text-white rounded hover:opacity-90"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          Analisis IA Completo
                        </button>
                        <button
                          onClick={() => handleResolve(req._id, 'levante')}
                          disabled={submitting}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Marcar Levante
                        </button>
                      </div>
                    )}

                    {/* Resolucion */}
                    {req.resolution && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <h5 className="text-sm font-medium text-green-800 mb-1">Resolucion</h5>
                        <p className="text-sm text-green-700">
                          Estado: {req.resolution.status} - {new Date(req.resolution.date).toLocaleDateString()}
                        </p>
                        {req.resolution.notes && (
                          <p className="text-sm text-green-600 mt-1">{req.resolution.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* AI Panel Modal */}
      {showAIPanel && (
        <RequirementAIPanel
          requirement={showAIPanel}
          onClose={() => setShowAIPanel(null)}
          onApplySuggestion={(response) => {
            setResponseForm({
              responseType: 'documentary',
              notes: response
            })
            setShowResponseForm(showAIPanel._id)
            setShowAIPanel(null)
          }}
        />
      )}
    </div>
  )
}
