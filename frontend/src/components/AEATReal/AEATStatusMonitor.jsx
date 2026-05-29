import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  SignalIcon,
  BellAlertIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  SparklesIcon,
  ChartBarIcon,
  DocumentTextIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { aeatRealAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'

export default function AEATStatusMonitor() {
  const { t } = useTranslation()
  const [trackedDeclarations, setTrackedDeclarations] = useState([])
  const [alerts, setAlerts] = useState([])
  const [serviceStatus, setServiceStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDeclaration, setSelectedDeclaration] = useState(null)
  const [showPredictionModal, setShowPredictionModal] = useState(false)
  const [predictionResult, setPredictionResult] = useState(null)
  const [predicting, setPredicting] = useState(false)

  const [predictionForm, setPredictionForm] = useState({
    originCountry: '',
    taricCode: '',
    customsValue: '',
    operationType: 'import'
  })

  const loadData = useCallback(async () => {
    try {
      const [trackedRes, alertsRes, statusRes] = await Promise.all([
        aeatRealAPI.monitoring.getTracked(),
        aeatRealAPI.monitoring.getAlerts({ unacknowledgedOnly: true }),
        aeatRealAPI.getServiceStatus()
      ])

      if (trackedRes.data.success) {
        setTrackedDeclarations(trackedRes.data.data?.declarations || [])
      }
      if (alertsRes.data.success) {
        setAlerts(alertsRes.data.data?.alerts || [])
      }
      if (statusRes.data.success) {
        setServiceStatus(statusRes.data.data)
      }
    } catch (error) {
      console.error('Error loading monitoring data:', error)
      toast.error('Error al cargar datos de monitoreo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [loadData])

  const handleRefreshStatus = async (mrn, certificateAlias) => {
    setRefreshing(true)
    try {
      const response = await aeatRealAPI.monitoring.refresh(mrn, certificateAlias)
      if (response.data.success) {
        toast.success('Estado actualizado')
        loadData()
      }
    } catch (error) {
      toast.error('Error al actualizar estado')
    } finally {
      setRefreshing(false)
    }
  }

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await aeatRealAPI.monitoring.acknowledgeAlert(alertId)
      toast.success('Alerta confirmada')
      loadData()
    } catch (error) {
      toast.error('Error al confirmar alerta')
    }
  }

  const handlePredictChannel = async (e) => {
    e.preventDefault()
    setPredicting(true)
    setPredictionResult(null)

    try {
      const response = await aeatRealAPI.monitoring.predictChannel({
        operationData: {
          originCountry: predictionForm.originCountry,
          operationType: predictionForm.operationType,
          customsValue: parseFloat(predictionForm.customsValue) || 0
        },
        goods: [{
          taricCode: predictionForm.taricCode,
          customsValue: parseFloat(predictionForm.customsValue) || 0
        }]
      })

      if (response.data.success) {
        setPredictionResult(response.data.data)
      }
    } catch (error) {
      toast.error('Error al predecir canal')
    } finally {
      setPredicting(false)
    }
  }

  const getChannelBadge = (channel) => {
    const channelConfig = {
      green: { bg: 'bg-green-100', text: 'text-green-800', label: 'Verde (Levante)' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Naranja (Documental)' },
      red: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rojo (Físico)' },
      yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Amarillo (Certificados)' }
    }

    const config = channelConfig[channel] || { bg: 'bg-gray-100', text: 'text-gray-800', label: channel }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-800', icon: ClockIcon, label: 'Pendiente' },
      submitted: { bg: 'bg-blue-100', text: 'text-blue-800', icon: DocumentTextIcon, label: 'Enviada' },
      accepted: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon, label: 'Aceptada' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon, label: 'Rechazada' },
      released: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon, label: 'Levantada' }
    }

    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </span>
    )
  }

  const getAlertSeverityBadge = (severity) => {
    const severityConfig = {
      critical: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
      high: { bg: 'bg-orange-100', text: 'text-orange-800', icon: ExclamationTriangleIcon },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ExclamationTriangleIcon },
      low: { bg: 'bg-blue-100', text: 'text-blue-800', icon: BellAlertIcon }
    }

    const config = severityConfig[severity] || severityConfig.low
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-4 h-4 mr-1" />
        {severity.toUpperCase()}
      </span>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <SignalIcon className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Monitor de Estado AEAT
              </h1>
              <p className="text-gray-500">
                Seguimiento de declaraciones con análisis LUCI
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setShowPredictionModal(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
            >
              <SparklesIcon className="h-5 w-5 mr-2" />
              Predecir Canal
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Service Status */}
      {serviceStatus && (
        <div className="mb-6 bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${serviceStatus.status.environment === 'production' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium text-gray-700">
                Entorno: {serviceStatus.status.environment === 'production' ? 'Producción' : 'Sandbox'}
              </span>
              <span className="text-sm text-gray-500">
                {serviceStatus.status.certificatesLoaded} certificados | {serviceStatus.status.activeMonitoring} monitorizando
              </span>
            </div>
            {serviceStatus.status.activeAlerts > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <BellAlertIcon className="h-4 w-4 mr-1" />
                {serviceStatus.status.activeAlerts} alertas activas
              </span>
            )}
          </div>

          {/* LUCI Analysis */}
          {serviceStatus.luciAnalysis && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center text-sm text-indigo-600">
                <SparklesIcon className="h-4 w-4 mr-2" />
                <span className="font-medium">LUCI:</span>
                <span className="ml-2 text-gray-600">{serviceStatus.luciAnalysis.summary || 'Sistema operativo'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <BellAlertIcon className="h-5 w-5 text-red-500 mr-2" />
            Alertas Activas
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-white shadow rounded-lg p-4 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getAlertSeverityBadge(alert.severity)}
                    <span className="text-sm font-medium text-gray-900">{alert.mrn}</span>
                    <span className="text-sm text-gray-600">{alert.message}</span>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracked Declarations */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Declaraciones Monitorizadas</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-green-600 animate-spin" />
            <span className="ml-2 text-gray-600">Cargando...</span>
          </div>
        ) : trackedDeclarations.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Sin declaraciones monitorizadas</h3>
            <p className="mt-1 text-sm text-gray-500">
              Las declaraciones enviadas a AEAT aparecerán aquí
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Canal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Actualización</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trackedDeclarations.map((decl) => (
                <tr key={decl.mrn} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-900">{decl.mrn}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {decl.declarationType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(decl.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {decl.channel ? getChannelBadge(decl.channel) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {decl.lastChecked && new Date(decl.lastChecked).getTime() > 0
                      ? new Date(decl.lastChecked).toLocaleString('es-ES')
                      : decl.addedAt
                        ? `Añadida: ${new Date(decl.addedAt).toLocaleString('es-ES')}`
                        : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedDeclaration(decl)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      title="Ver detalles"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleRefreshStatus(decl.mrn, decl.certificateAlias)}
                      disabled={refreshing}
                      className="text-green-600 hover:text-green-900"
                      title="Actualizar"
                    >
                      <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Declaration Details Modal */}
      {selectedDeclaration && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedDeclaration(null)} />
            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Detalles: {selectedDeclaration.mrn}
                </h3>
                <button onClick={() => setSelectedDeclaration(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Tipo</label>
                    <p className="text-sm text-gray-900">{selectedDeclaration.declarationType}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Estado</label>
                    <p className="mt-1">{getStatusBadge(selectedDeclaration.status)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Canal</label>
                    <p className="mt-1">{selectedDeclaration.channel ? getChannelBadge(selectedDeclaration.channel) : 'Pendiente'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Última Verificación</label>
                    <p className="text-sm text-gray-900">
                      {selectedDeclaration.lastChecked && new Date(selectedDeclaration.lastChecked).getTime() > 0
                        ? new Date(selectedDeclaration.lastChecked).toLocaleString('es-ES')
                        : selectedDeclaration.addedAt
                          ? `Añadida: ${new Date(selectedDeclaration.addedAt).toLocaleString('es-ES')}`
                          : '-'}
                    </p>
                  </div>
                </div>

                {selectedDeclaration.luciAnalysis && (
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <SparklesIcon className="h-5 w-5 text-indigo-600 mr-2" />
                      <span className="font-medium text-indigo-900">Análisis LUCI</span>
                    </div>
                    <p className="text-sm text-indigo-800">{selectedDeclaration.luciAnalysis.summary}</p>
                    {selectedDeclaration.luciAnalysis.recommendations?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {selectedDeclaration.luciAnalysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-indigo-700 flex items-start">
                            <CheckCircleIcon className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selectedDeclaration.history && selectedDeclaration.history.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Historial</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDeclaration.history.map((event, idx) => (
                        <div key={idx} className="flex items-start text-sm">
                          <span className="text-gray-400 w-32 flex-shrink-0">
                            {new Date(event.timestamp).toLocaleString('es-ES', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span className="text-gray-600">{event.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Prediction Modal */}
      {showPredictionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowPredictionModal(false)} />
            <div className="relative bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <SparklesIcon className="h-6 w-6 text-indigo-600 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Predicción de Canal con LUCI</h3>
                </div>
                <button onClick={() => setShowPredictionModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handlePredictChannel} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País de Origen</label>
                  <input
                    type="text"
                    value={predictionForm.originCountry}
                    onChange={(e) => setPredictionForm(prev => ({ ...prev, originCountry: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="CN, US, JP..."
                    maxLength={2}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código TARIC</label>
                  <input
                    type="text"
                    value={predictionForm.taricCode}
                    onChange={(e) => setPredictionForm(prev => ({ ...prev, taricCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="8517120000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Aduanero (EUR)</label>
                  <input
                    type="number"
                    value={predictionForm.customsValue}
                    onChange={(e) => setPredictionForm(prev => ({ ...prev, customsValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="50000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operación</label>
                  <select
                    value={predictionForm.operationType}
                    onChange={(e) => setPredictionForm(prev => ({ ...prev, operationType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="import">Importación</option>
                    <option value="export">Exportación</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={predicting}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {predicting ? (
                    <span className="flex items-center justify-center">
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Analizando con LUCI...
                    </span>
                  ) : (
                    'Predecir Canal'
                  )}
                </button>
              </form>

              {/* Prediction Result */}
              {predictionResult && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Resultado de Predicción</h4>

                  {/* Channel Probabilities */}
                  <div className="space-y-2 mb-4">
                    {Object.entries(predictionResult.channelProbabilities || {}).map(([channel, prob]) => (
                      <div key={channel} className="flex items-center">
                        <span className="w-20 text-sm text-gray-600 capitalize">{channel}:</span>
                        <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              channel === 'green' ? 'bg-green-500' :
                              channel === 'orange' ? 'bg-orange-500' :
                              channel === 'red' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`}
                            style={{ width: `${(prob * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-sm font-medium text-gray-700">
                          {(prob * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Predicted Channel */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Canal más probable:</span>
                      {getChannelBadge(predictionResult.predictedChannel)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">Puntuación de riesgo:</span>
                      <span className={`text-sm font-medium ${
                        predictionResult.riskScore < 20 ? 'text-green-600' :
                        predictionResult.riskScore < 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {predictionResult.riskScore}/100
                      </span>
                    </div>
                  </div>

                  {/* LUCI Analysis */}
                  {predictionResult.luciAnalysis && (
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <div className="flex items-center mb-2">
                        <SparklesIcon className="h-4 w-4 text-indigo-600 mr-2" />
                        <span className="text-sm font-medium text-indigo-900">Análisis LUCI</span>
                      </div>
                      <p className="text-sm text-indigo-800">{predictionResult.luciAnalysis.summary}</p>
                      {predictionResult.luciAnalysis.factors?.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {predictionResult.luciAnalysis.factors.map((factor, idx) => (
                            <li key={idx} className="text-xs text-indigo-700">• {factor}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
