import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import {
  SparklesIcon,
  ChartBarIcon,
  ShieldExclamationIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CpuChipIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline'
import { mlAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'

export default function MLInsights() {
  const { t } = useTranslation()

  const TABS = [
    { id: 'overview', label: t('ml.overview'), icon: ChartBarIcon },
    { id: 'classification', label: t('ml.classification'), icon: AcademicCapIcon },
    { id: 'fraud', label: t('ml.fraudDetection'), icon: ShieldExclamationIcon },
    { id: 'channel', label: t('ml.channelPrediction'), icon: CpuChipIcon },
    { id: 'recommendations', label: t('ml.recommendations'), icon: LightBulbIcon },
    { id: 'autoresponse', label: t('ml.autoResponse'), icon: DocumentTextIcon }
  ]
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)

  // Classification state
  const [classificationInput, setClassificationInput] = useState({
    description: '',
    material: '',
    use: ''
  })
  const [classificationResult, setClassificationResult] = useState(null)

  // Fraud state
  const [fraudInput, setFraudInput] = useState({
    originCountry: 'CN',
    goods: [{ taricCode: '', customsValue: '', quantity: '' }]
  })
  const [fraudResult, setFraudResult] = useState(null)

  // Channel state
  const [channelInput, setChannelInput] = useState({
    originCountry: 'CN',
    goods: [{ taricCode: '', customsValue: '' }],
    operatorEORI: ''
  })
  const [channelResult, setChannelResult] = useState(null)

  // Recommendations state
  const [recsInput, setRecsInput] = useState({
    originCountry: 'CN',
    goods: [{ taricCode: '', customsValue: '' }],
    regime: '4000'
  })
  const [recsResult, setRecsResult] = useState(null)

  // Auto-response state
  const [responseTemplates, setResponseTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    if (activeTab === 'autoresponse') {
      loadTemplates()
    }
  }, [activeTab])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await mlAPI.getStats()
      if (response.data.success) {
        setStats(response.data.statistics)
      }
    } catch (error) {
      toast.error('Error cargando estadisticas ML')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await mlAPI.autoResponse.listTemplates()
      if (response.data.success) {
        setResponseTemplates(response.data.templates)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  // Classification handlers
  const handleClassify = async () => {
    if (!classificationInput.description.trim()) {
      toast.error('Ingrese una descripcion del producto')
      return
    }

    try {
      setLoading(true)
      const response = await mlAPI.classify(classificationInput)
      if (response.data.success) {
        setClassificationResult(response.data)
        toast.success('Producto clasificado')
      }
    } catch (error) {
      toast.error('Error en clasificacion')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Fraud detection handlers
  const handleFraudAnalysis = async () => {
    try {
      setLoading(true)
      const response = await mlAPI.fraud.analyze(fraudInput)
      if (response.data.success) {
        const raw = response.data?.data || response.data
        const overallRiskLevel = raw.overallRiskLevel || raw.riskLevel || raw.overall_risk_level
        setFraudResult({ ...raw, overallRiskLevel })
        toast.success('Analisis completado')
      }
    } catch (error) {
      toast.error('Error en analisis de fraude')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Channel prediction handlers
  const handleChannelPredict = async () => {
    try {
      setLoading(true)
      const response = await mlAPI.channel.predict(channelInput)
      if (response.data.success) {
        const raw = response.data?.prediction || response.data?.data || response.data
        const channelMap = { green: 'verde', yellow: 'naranja', orange: 'naranja', red: 'rojo' }
        const rawChannel = raw.predictedChannel || raw.channel || ''
        const predictedChannel = channelMap[rawChannel] || rawChannel
        const rawConfidence = raw.confidence ?? raw.confidenceScore ?? 0
        const confidence = rawConfidence <= 1 ? Math.round(rawConfidence * 100) : rawConfidence
        setChannelResult({ ...raw, predictedChannel, confidence })
        toast.success('Prediccion completada')
      }
    } catch (error) {
      toast.error('Error en prediccion')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Recommendations handlers
  const handleGetRecommendations = async () => {
    try {
      setLoading(true)
      const response = await mlAPI.recommendations.generate({
        operation: recsInput
      })
      if (response.data.success) {
        setRecsResult(response.data)
        toast.success('Recomendaciones generadas')
      }
    } catch (error) {
      toast.error('Error generando recomendaciones')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getChannelColor = (channel) => {
    switch (channel) {
      case 'verde': return 'text-green-600 bg-green-100'
      case 'naranja': return 'text-orange-600 bg-orange-100'
      case 'rojo': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getConfidenceColor = (level) => {
    switch (level) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  // Render Overview Tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AcademicCapIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Clasificaciones</p>
              <p className="text-xl font-bold">{stats?.classification?.totalClassifications || 0}</p>
              <p className="text-xs text-gray-400">
                Precision: {stats?.classification?.accuracy || 'N/A'}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Analisis Fraude</p>
              <p className="text-xl font-bold">{stats?.fraudDetection?.totalAnalyses || 0}</p>
              <p className="text-xs text-gray-400">
                Alertas: {stats?.fraudDetection?.alertsGenerated || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CpuChipIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Predicciones</p>
              <p className="text-xl font-bold">{stats?.channelPrediction?.totalPredictions || 0}</p>
              <p className="text-xs text-gray-400">
                Precision: {stats?.channelPrediction?.accuracy || 'N/A'}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <LightBulbIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Recomendaciones</p>
              <p className="text-xl font-bold">{stats?.recommendations?.totalGenerated || 0}</p>
              <p className="text-xs text-gray-400">
                Implementadas: {stats?.recommendations?.implemented || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Auto-Respuestas</p>
              <p className="text-xl font-bold">{stats?.autoResponse?.totalGenerated || 0}</p>
              <p className="text-xs text-gray-400">
                Aceptadas: {stats?.autoResponse?.acceptedByAEAT || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <SparklesIcon className="h-5 w-5 mr-2 text-purple-600" />
          Estado del Sistema ML
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {['classification', 'fraudDetection', 'channelPrediction', 'recommendations', 'autoResponse'].map((service) => (
            <div key={service} className="text-center p-3 bg-gray-50 rounded-lg">
              <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium capitalize">{service.replace(/([A-Z])/g, ' $1').trim()}</p>
              <p className="text-xs text-gray-500">Operativo</p>
            </div>
          ))}
        </div>
      </div>

      {/* Model Confidence */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Confianza de Modelos</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Clasificacion TARIC</span>
              <span className="text-sm font-medium">{stats?.classification?.modelConfidence || 85}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${stats?.classification?.modelConfidence || 85}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Prediccion de Circuito</span>
              <span className="text-sm font-medium">{stats?.channelPrediction?.modelAccuracy || 78}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${stats?.channelPrediction?.modelAccuracy || 78}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Deteccion de Fraude</span>
              <span className="text-sm font-medium">{stats?.fraudDetection?.modelAccuracy || 92}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full"
                style={{ width: `${stats?.fraudDetection?.modelAccuracy || 92}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render Classification Tab
  const renderClassification = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <AcademicCapIcon className="h-5 w-5 mr-2 text-blue-600" />
          Clasificacion ML de Producto
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion del Producto *
            </label>
            <textarea
              rows={3}
              value={classificationInput.description}
              onChange={(e) => setClassificationInput({
                ...classificationInput,
                description: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: Camiseta de algodon para hombre, manga corta, cuello redondo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Material
            </label>
            <input
              type="text"
              value={classificationInput.material}
              onChange={(e) => setClassificationInput({
                ...classificationInput,
                material: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: 100% algodon"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uso Principal
            </label>
            <input
              type="text"
              value={classificationInput.use}
              onChange={(e) => setClassificationInput({
                ...classificationInput,
                use: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: vestir, deportivo, trabajo"
            />
          </div>

          <button
            onClick={handleClassify}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <SparklesIcon className="h-5 w-5 mr-2" />
            )}
            Clasificar con ML
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Resultado de Clasificacion</h3>

        {classificationResult ? (
          <div className="space-y-4">
            {classificationResult.classification ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Codigo TARIC Sugerido</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {classificationResult.classification.code}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Capitulo {classificationResult.classification.chapter} - {classificationResult.classification.category}
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm">Confianza</span>
                  <span className={`font-semibold ${getConfidenceColor(classificationResult.confidenceLevel)}`}>
                    {classificationResult.confidence}% ({classificationResult.confidenceLevel})
                  </span>
                </div>

                {classificationResult.requiresManualReview && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-700">
                      Se recomienda revision manual debido a baja confianza
                    </p>
                  </div>
                )}

                {classificationResult.suggestions && classificationResult.suggestions.length > 1 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Alternativas:</p>
                    <div className="space-y-2">
                      {classificationResult.suggestions.slice(1).map((sug, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                          <span className="font-mono font-medium">{sug.code}</span>
                          <span className="text-gray-500 ml-2">{sug.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {classificationResult.additionalChecks && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Verificaciones adicionales:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {classificationResult.additionalChecks.map((check, idx) => (
                        <li key={idx} className="flex items-start">
                          <InformationCircleIcon className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                          {check}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>{classificationResult.message || 'No se pudo determinar la clasificacion'}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <AcademicCapIcon className="h-12 w-12 mx-auto mb-4" />
            <p>Ingrese los datos del producto para obtener una clasificacion</p>
          </div>
        )}
      </div>
    </div>
  )

  // Render Fraud Detection Tab
  const renderFraud = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ShieldExclamationIcon className="h-5 w-5 mr-2 text-red-600" />
          Analisis de Fraude
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pais de Origen
            </label>
            <select
              value={fraudInput.originCountry}
              onChange={(e) => setFraudInput({ ...fraudInput, originCountry: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="CN">China</option>
              <option value="US">Estados Unidos</option>
              <option value="DE">Alemania</option>
              <option value="FR">Francia</option>
              <option value="TR">Turquia</option>
              <option value="IN">India</option>
              <option value="VN">Vietnam</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Codigo TARIC
            </label>
            <input
              type="text"
              value={fraudInput.goods[0].taricCode}
              onChange={(e) => setFraudInput({
                ...fraudInput,
                goods: [{ ...fraudInput.goods[0], taricCode: e.target.value }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Ej: 6109100010"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Aduanero (EUR)
            </label>
            <input
              type="number"
              value={fraudInput.goods[0].customsValue}
              onChange={(e) => setFraudInput({
                ...fraudInput,
                goods: [{ ...fraudInput.goods[0], customsValue: parseFloat(e.target.value) }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Ej: 10000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              value={fraudInput.goods[0].quantity}
              onChange={(e) => setFraudInput({
                ...fraudInput,
                goods: [{ ...fraudInput.goods[0], quantity: parseInt(e.target.value) }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Ej: 1000"
            />
          </div>

          <button
            onClick={handleFraudAnalysis}
            disabled={loading}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <ShieldExclamationIcon className="h-5 w-5 mr-2" />
            )}
            Analizar Fraude
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Resultado del Analisis</h3>

        {fraudResult ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${getRiskLevelColor(fraudResult.overallRiskLevel)}`}>
              <p className="text-sm opacity-80">Nivel de Riesgo</p>
              <p className="text-2xl font-bold uppercase">
                {fraudResult.overallRiskLevel}
              </p>
              <p className="text-sm mt-1">
                Puntuacion: {fraudResult.riskScore}/100
              </p>
            </div>

            {fraudResult.alerts && fraudResult.alerts.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Alertas Detectadas ({fraudResult.alerts.length})
                </p>
                <div className="space-y-2">
                  {fraudResult.alerts.map((alert, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      alert.severity === 'high' ? 'border-red-300 bg-red-50' :
                      alert.severity === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-300 bg-gray-50'
                    }`}>
                      <p className="font-medium text-sm">{alert.type}</p>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                      {alert.evidence && (
                        <p className="text-xs text-gray-500 mt-1">
                          Evidencia: {alert.evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fraudResult.recommendations && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Recomendaciones</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {fraudResult.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <ShieldExclamationIcon className="h-12 w-12 mx-auto mb-4" />
            <p>Ingrese los datos para analizar posibles indicadores de fraude</p>
          </div>
        )}
      </div>
    </div>
  )

  // Render Channel Prediction Tab
  const renderChannel = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <CpuChipIcon className="h-5 w-5 mr-2 text-purple-600" />
          Prediccion de Circuito
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pais de Origen
            </label>
            <select
              value={channelInput.originCountry}
              onChange={(e) => setChannelInput({ ...channelInput, originCountry: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="CN">China</option>
              <option value="US">Estados Unidos</option>
              <option value="DE">Alemania</option>
              <option value="FR">Francia</option>
              <option value="JP">Japon</option>
              <option value="KR">Corea del Sur</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Codigo TARIC
            </label>
            <input
              type="text"
              value={channelInput.goods[0].taricCode}
              onChange={(e) => setChannelInput({
                ...channelInput,
                goods: [{ ...channelInput.goods[0], taricCode: e.target.value }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Ej: 8471300000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Aduanero (EUR)
            </label>
            <input
              type="number"
              value={channelInput.goods[0].customsValue}
              onChange={(e) => setChannelInput({
                ...channelInput,
                goods: [{ ...channelInput.goods[0], customsValue: parseFloat(e.target.value) }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Ej: 50000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              EORI Operador (opcional)
            </label>
            <input
              type="text"
              value={channelInput.operatorEORI}
              onChange={(e) => setChannelInput({ ...channelInput, operatorEORI: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Ej: ES12345678A"
            />
          </div>

          <button
            onClick={handleChannelPredict}
            disabled={loading}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <CpuChipIcon className="h-5 w-5 mr-2" />
            )}
            Predecir Circuito
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Resultado de Prediccion</h3>

        {channelResult ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${getChannelColor(channelResult.predictedChannel)}`}>
              <p className="text-sm opacity-80">Circuito Predicho</p>
              <p className="text-2xl font-bold uppercase">
                {channelResult.predictedChannel}
              </p>
              <p className="text-sm mt-1">
                Confianza: {channelResult.confidence}%
              </p>
            </div>

            {channelResult.probabilities && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Probabilidades</p>
                <div className="space-y-2">
                  {Object.entries(channelResult.probabilities).map(([channel, prob]) => (
                    <div key={channel} className="flex items-center">
                      <span className="w-20 text-sm capitalize">{channel}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mx-2">
                        <div
                          className={`h-2 rounded-full ${
                            channel === 'verde' ? 'bg-green-500' :
                            channel === 'naranja' ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${prob}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-right">{prob}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {channelResult.riskFactors && channelResult.riskFactors.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Factores de Riesgo</p>
                <div className="space-y-2">
                  {channelResult.riskFactors.map((factor, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium">{factor.factor}</span>
                      <span className="text-gray-500 ml-2">+{factor.weight} puntos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {channelResult.suggestions && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-700 mb-1">Sugerencias</p>
                <ul className="text-sm text-blue-600">
                  {channelResult.suggestions.map((sug, idx) => (
                    <li key={idx}>• {sug}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <CpuChipIcon className="h-12 w-12 mx-auto mb-4" />
            <p>Ingrese los datos para predecir el circuito aduanero</p>
          </div>
        )}
      </div>
    </div>
  )

  // Render Recommendations Tab
  const renderRecommendations = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <LightBulbIcon className="h-5 w-5 mr-2 text-yellow-600" />
          Generador de Recomendaciones
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pais de Origen
            </label>
            <select
              value={recsInput.originCountry}
              onChange={(e) => setRecsInput({ ...recsInput, originCountry: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
            >
              <option value="CN">China</option>
              <option value="US">Estados Unidos</option>
              <option value="JP">Japon</option>
              <option value="KR">Corea del Sur</option>
              <option value="MX">Mexico</option>
              <option value="CA">Canada</option>
              <option value="CH">Suiza</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Codigo TARIC
            </label>
            <input
              type="text"
              value={recsInput.goods[0].taricCode}
              onChange={(e) => setRecsInput({
                ...recsInput,
                goods: [{ ...recsInput.goods[0], taricCode: e.target.value }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
              placeholder="Ej: 8517120000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Aduanero (EUR)
            </label>
            <input
              type="number"
              value={recsInput.goods[0].customsValue}
              onChange={(e) => setRecsInput({
                ...recsInput,
                goods: [{ ...recsInput.goods[0], customsValue: parseFloat(e.target.value) }]
              })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
              placeholder="Ej: 100000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Regimen Aduanero
            </label>
            <select
              value={recsInput.regime}
              onChange={(e) => setRecsInput({ ...recsInput, regime: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
            >
              <option value="4000">Importacion definitiva (4000)</option>
              <option value="4200">Importacion con IVA diferido</option>
              <option value="5100">Perfeccionamiento activo</option>
              <option value="5300">Importacion temporal</option>
              <option value="7100">Deposito aduanero</option>
            </select>
          </div>

          <button
            onClick={handleGetRecommendations}
            disabled={loading}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <LightBulbIcon className="h-5 w-5 mr-2" />
            )}
            Generar Recomendaciones
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recomendaciones</h3>

        {recsResult ? (
          <div className="space-y-4">
            {recsResult.totalPotentialSavings > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600">Ahorro Potencial Total</p>
                <p className="text-2xl font-bold text-green-700">
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(recsResult.totalPotentialSavings)}
                </p>
              </div>
            )}

            {recsResult.recommendations && recsResult.recommendations.length > 0 ? (
              <div className="space-y-3">
                {recsResult.recommendations.map((rec, idx) => (
                  <div key={idx} className={`p-4 border rounded-lg ${
                    rec.priority === 'high' ? 'border-yellow-400 bg-yellow-50' :
                    rec.priority === 'medium' ? 'border-blue-300 bg-blue-50' :
                    'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{rec.type}</span>
                      {rec.potentialSavings > 0 && (
                        <span className="text-green-600 font-semibold text-sm">
                          Ahorro: {new Intl.NumberFormat('es-ES', {
                            style: 'currency',
                            currency: 'EUR'
                          }).format(rec.potentialSavings)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{rec.recommendation}</p>
                    {rec.actions && rec.actions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Acciones:</p>
                        <ul className="text-xs text-gray-600">
                          {rec.actions.map((action, actionIdx) => (
                            <li key={actionIdx}>• {action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No se encontraron recomendaciones adicionales
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <LightBulbIcon className="h-12 w-12 mx-auto mb-4" />
            <p>Ingrese los datos para obtener recomendaciones de optimizacion</p>
          </div>
        )}
      </div>
    </div>
  )

  // Render Auto-Response Tab
  const renderAutoResponse = () => (
    <div className="space-y-6">
      {/* Templates List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <DocumentTextIcon className="h-5 w-5 mr-2 text-green-600" />
          Plantillas de Auto-Respuesta AEAT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {responseTemplates.length > 0 ? (
            responseTemplates.map((template) => (
              <div
                key={template.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="flex items-center mb-2">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600 mr-2" />
                  <span className="font-medium text-sm">{template.name}</span>
                </div>
                <p className="text-xs text-gray-500">{template.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    template.type === 'documentary' ? 'bg-blue-100 text-blue-700' :
                    template.type === 'valuation' ? 'bg-purple-100 text-purple-700' :
                    template.type === 'classification' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {template.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {template.successRate}% exito
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-gray-400">
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-4" />
              <p>Cargando plantillas...</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Template Preview */}
      {selectedTemplate && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Vista Previa: {selectedTemplate.name}
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Estructura de la Respuesta</p>
              <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                {selectedTemplate.structure || 'Estructura no disponible'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Campos requeridos:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTemplate.requiredFields?.map((field, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {field}
                    </span>
                  )) || <span className="text-xs text-gray-400">No especificados</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Tasa de exito historica</p>
                <p className="text-2xl font-bold text-green-600">{selectedTemplate.successRate}%</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Usar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <SparklesIcon className="h-8 w-8 mr-3 text-purple-600" />
            ML Insights
          </h1>
          <p className="text-gray-500 mt-1">
            Sistema de Inteligencia Artificial para Aduanas
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
        >
          <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'classification' && renderClassification()}
        {activeTab === 'fraud' && renderFraud()}
        {activeTab === 'channel' && renderChannel()}
        {activeTab === 'recommendations' && renderRecommendations()}
        {activeTab === 'autoresponse' && renderAutoResponse()}
      </div>
    </div>
  )
}
