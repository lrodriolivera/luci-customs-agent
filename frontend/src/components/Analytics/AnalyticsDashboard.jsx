import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyEuroIcon,
  ShieldCheckIcon,
  BoltIcon,
  SparklesIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  FunnelIcon,
  XMarkIcon,
  LightBulbIcon,
  PresentationChartBarIcon,
  MagnifyingGlassCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { analyticsAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'

// ==================== Analytics AI Panel Component ====================
function AnalyticsAIPanel({ period, onClose }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('insights')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState({
    insights: null,
    anomalies: null,
    trends: null,
    executive: null,
    kpi: null,
    full: null
  })

  const tabs = [
    { id: 'insights', label: t('analyticsPage.insights'), icon: LightBulbIcon },
    { id: 'anomalies', label: t('analyticsPage.anomalies'), icon: MagnifyingGlassCircleIcon },
    { id: 'trends', label: t('analyticsPage.trends'), icon: ArrowTrendingUpIcon },
    { id: 'executive', label: t('analyticsPage.executiveReport'), icon: PresentationChartBarIcon },
    { id: 'kpi', label: t('analyticsPage.kpiAnalysis'), icon: BoltIcon },
    { id: 'full', label: t('analyticsPage.fullAnalysis'), icon: SparklesIcon }
  ]

  const runAnalysis = async (type) => {
    try {
      setLoading(true)
      setError(null)
      let res

      switch (type) {
        case 'insights':
          res = await analyticsAPI.ai.generateInsights({ period })
          break
        case 'anomalies':
          res = await analyticsAPI.ai.detectAnomalies({ period })
          break
        case 'trends':
          res = await analyticsAPI.ai.predictTrends({ period })
          break
        case 'executive':
          res = await analyticsAPI.ai.generateExecutiveReport({ period })
          break
        case 'kpi':
          res = await analyticsAPI.ai.analyzeKPIDeviations({ period })
          break
        case 'full':
          res = await analyticsAPI.ai.fullAnalysis({ period })
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

  const renderInsights = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Summary */}
        {data.summary && (
          <div className="bg-luci/5 border border-luci/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <LightBulbIcon className="w-5 h-5 text-luci" />
              <span className="font-medium text-luci">{t('analyticsPage.luciSummary')}</span>
            </div>
            <p className="text-sm text-gray-700">{data.summary}</p>
          </div>
        )}

        {/* Key Insights */}
        {data.insights && data.insights.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">{t('analyticsPage.mainInsights')}</h4>
            <div className="space-y-3">
              {data.insights.map((insight, idx) => (
                <div key={idx} className={`p-3 rounded-lg ${
                  insight.type === 'positive' ? 'bg-green-50' :
                  insight.type === 'negative' ? 'bg-red-50' :
                  insight.type === 'warning' ? 'bg-yellow-50' :
                  'bg-blue-50'
                }`}>
                  <p className="font-medium text-sm">{insight.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                  {insight.action && (
                    <p className="text-xs mt-2 text-blue-600">
                      <span className="font-medium">{t('common.action')}:</span> {insight.action}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-2">{t('analyticsPage.recommendations')}</h4>
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

  const renderAnomalies = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className={`p-4 rounded-lg ${
          data.anomalies?.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center gap-2">
            {data.anomalies?.length > 0 ? (
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
            ) : (
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            )}
            <span className={`font-medium ${data.anomalies?.length > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
              {data.anomalies?.length > 0
                ? `${data.anomalies.length} anomalia(s) detectada(s)`
                : 'No se detectaron anomalias'}
            </span>
          </div>
        </div>

        {/* Anomalies List */}
        {data.anomalies && data.anomalies.length > 0 && (
          <div className="space-y-3">
            {data.anomalies.map((anomaly, idx) => (
              <div key={idx} className={`border rounded-lg p-4 ${
                anomaly.severity === 'critical' ? 'border-red-300 bg-red-50' :
                anomaly.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                anomaly.severity === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                'border-gray-300 bg-gray-50'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-sm">{anomaly.metric || anomaly.type}</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    anomaly.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    anomaly.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                    anomaly.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {anomaly.severity === 'critical' ? 'Critico' :
                     anomaly.severity === 'high' ? 'Alto' :
                     anomaly.severity === 'medium' ? 'Medio' : 'Bajo'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{anomaly.description}</p>
                {anomaly.expectedValue && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span>{t('analyticsPage.expected')}: {anomaly.expectedValue}</span>
                    <span className="mx-2">|</span>
                    <span>{t('analyticsPage.actual')}: {anomaly.actualValue}</span>
                    <span className="mx-2">|</span>
                    <span className="text-red-600">{t('analyticsPage.deviation')}: {anomaly.deviation}%</span>
                  </div>
                )}
                {anomaly.suggestedAction && (
                  <p className="text-xs mt-2 text-blue-600">
                    <span className="font-medium">{t('analyticsPage.suggestedAction')}:</span> {anomaly.suggestedAction}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderTrends = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Predictions */}
        {data.predictions && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">{t('analyticsPage.predictions')}</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(data.predictions).map(([key, pred]) => (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {pred.direction === 'up' ? (
                      <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                    ) : pred.direction === 'down' ? (
                      <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />
                    ) : (
                      <MinusIcon className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-lg font-bold">{pred.percentage}%</span>
                  </div>
                  {pred.confidence && (
                    <p className="text-xs text-gray-400 mt-1">{t('analyticsPage.confidence')}: {(pred.confidence * 100).toFixed(0)}%</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seasonality */}
        {data.seasonality && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">{t('analyticsPage.seasonalPatterns')}</h4>
            <p className="text-sm text-blue-700">{data.seasonality.summary}</p>
            {data.seasonality.peakPeriods && (
              <div className="mt-2 text-xs text-blue-600">
                <span className="font-medium">{t('analyticsPage.peakPeriods')}:</span> {data.seasonality.peakPeriods.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Trend Alerts */}
        {data.alerts && data.alerts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">{t('analyticsPage.trendAlerts')}</h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              {data.alerts.map((alert, idx) => (
                <li key={idx}>• {alert}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const renderExecutive = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Executive Summary */}
        <div className="bg-gradient-to-r from-luci/10 to-purple-50 border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <PresentationChartBarIcon className="w-6 h-6 text-luci" />
            <span className="font-bold text-lg">{t('analyticsPage.executiveReport')}</span>
          </div>
          {data.executiveSummary && (
            <p className="text-gray-700">{data.executiveSummary}</p>
          )}
        </div>

        {/* Key Metrics */}
        {data.keyMetrics && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">{t('analyticsPage.keyMetrics')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.keyMetrics).map(([key, value]) => (
                <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {data.achievements && data.achievements.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">{t('analyticsPage.periodAchievements')}</h4>
            <ul className="space-y-1 text-sm text-green-700">
              {data.achievements.map((ach, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4" />
                  {ach}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas of Concern */}
        {data.concerns && data.concerns.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">{t('analyticsPage.attentionAreas')}</h4>
            <ul className="space-y-1 text-sm text-red-700">
              {data.concerns.map((concern, idx) => (
                <li key={idx}>• {concern}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Strategic Recommendations */}
        {data.strategicRecommendations && data.strategicRecommendations.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-2">{t('analyticsPage.strategicRecommendations')}</h4>
            <div className="space-y-2">
              {data.strategicRecommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-indigo-200 text-indigo-800">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-indigo-700">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Download Report */}
        {data.reportHtml && (
          <button
            onClick={() => {
              const blob = new Blob([data.reportHtml], { type: 'text/html' })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `reporte_ejecutivo_${new Date().toISOString().split('T')[0]}.html`
              a.click()
            }}
            className="w-full py-2 bg-luci text-white rounded-lg hover:bg-luci-dark flex items-center justify-center gap-2"
          >
            <DocumentTextIcon className="w-5 h-5" />
            Descargar Reporte HTML
          </button>
        )}
      </div>
    )
  }

  const renderKPIAnalysis = (data) => {
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Overall Assessment */}
        <div className={`p-4 rounded-lg ${
          data.overallStatus === 'healthy' ? 'bg-green-50 border border-green-200' :
          data.overallStatus === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BoltIcon className={`w-6 h-6 ${
                data.overallStatus === 'healthy' ? 'text-green-600' :
                data.overallStatus === 'warning' ? 'text-yellow-600' :
                'text-red-600'
              }`} />
              <span className={`font-medium ${
                data.overallStatus === 'healthy' ? 'text-green-800' :
                data.overallStatus === 'warning' ? 'text-yellow-800' :
                'text-red-800'
              }`}>
                Estado: {data.overallStatus === 'healthy' ? 'Saludable' :
                        data.overallStatus === 'warning' ? 'Precaucion' : 'Critico'}
              </span>
            </div>
            {data.healthScore && (
              <span className="text-2xl font-bold">{data.healthScore}/100</span>
            )}
          </div>
        </div>

        {/* KPI Deviations */}
        {data.deviations && data.deviations.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">{t('analyticsPage.kpiDeviations')}</h4>
            <div className="space-y-3">
              {data.deviations.map((dev, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{dev.kpiName}</p>
                    <p className="text-xs text-gray-500">{t('common.target')}: {dev.target} | {t('analyticsPage.actual')}: {dev.actual}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${dev.deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {dev.deviation >= 0 ? '+' : ''}{dev.deviation}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Root Causes */}
        {data.rootCauses && data.rootCauses.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">{t('analyticsPage.rootCauses')}</h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              {data.rootCauses.map((cause, idx) => (
                <li key={idx}>• {cause}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvement Actions */}
        {data.improvementActions && data.improvementActions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">{t('analyticsPage.improvementActions')}</h4>
            <div className="space-y-2">
              {data.improvementActions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    action.priority === 'high' ? 'bg-red-200 text-red-800' :
                    action.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{action.action}</p>
                    {action.expectedImpact && (
                      <p className="text-xs text-gray-500">{t('analyticsPage.expectedImpact')}: {action.expectedImpact}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
              <span className="font-medium">{t('analyticsPage.fullLuciAnalysis')}</span>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${
                data.overallScore >= 80 ? 'text-green-600' :
                data.overallScore >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {data.overallScore || 0}/100
              </span>
              <p className="text-xs text-gray-500">{t('analyticsPage.score')}</p>
            </div>
          </div>
          {data.summary && <p className="mt-3 text-sm text-gray-600">{data.summary}</p>}
        </div>

        {/* Section Scores */}
        {data.sections && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

        {/* Embedded Insights */}
        {data.insights && renderInsights({ insights: data.insights, recommendations: data.recommendations })}

        {/* Critical Items */}
        {data.criticalItems && data.criticalItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">{t('analyticsPage.criticalItems')}</h4>
            <ul className="space-y-1 text-sm text-red-700">
              {data.criticalItems.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {data.actionItems && data.actionItems.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-3">{t('analyticsPage.recommendedActions')}</h4>
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
            {activeTab === 'insights' && 'Genera insights automaticos con IA'}
            {activeTab === 'anomalies' && 'Detecta anomalias en los datos'}
            {activeTab === 'trends' && 'Predice tendencias futuras'}
            {activeTab === 'executive' && 'Genera un reporte ejecutivo profesional'}
            {activeTab === 'kpi' && 'Analiza desviaciones de KPIs'}
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
      case 'insights':
        return renderInsights(currentResult)
      case 'anomalies':
        return renderAnomalies(currentResult)
      case 'trends':
        return renderTrends(currentResult)
      case 'executive':
        return renderExecutive(currentResult)
      case 'kpi':
        return renderKPIAnalysis(currentResult)
      case 'full':
        return renderFullAnalysis(currentResult)
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-luci to-luci-dark text-white">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-6 h-6" />
            <div>
              <h2 className="font-bold">{t('analyticsPage.aiAnalysisCenter')}</h2>
              <p className="text-sm text-white/80">{t('analyticsPage.advancedAnalytics')}</p>
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
              <button onClick={() => setError(null)} className="ml-2 underline">{t('common.close')}</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-luci" />
              <span className="ml-2 text-gray-500">{t('analyticsPage.analyzingWithAI')}</span>
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

const TIME_PERIODS = [
  { value: 'today', labelKey: 'analyticsPage.today' },
  { value: 'yesterday', labelKey: 'analyticsPage.yesterday' },
  { value: 'last_7_days', labelKey: 'analyticsPage.last7Days' },
  { value: 'last_30_days', labelKey: 'analyticsPage.last30Days' },
  { value: 'this_month', labelKey: 'analyticsPage.thisMonth' },
  { value: 'last_month', labelKey: 'analyticsPage.lastMonth' },
  { value: 'this_quarter', labelKey: 'analyticsPage.thisQuarter' },
  { value: 'this_year', labelKey: 'analyticsPage.thisYear' }
]

export default function AnalyticsDashboard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('last_30_days')
  const [dashboardData, setDashboardData] = useState(null)
  const [kpiData, setKpiData] = useState(null)
  const [realTimeData, setRealTimeData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAIPanel, setShowAIPanel] = useState(false)

  useEffect(() => {
    loadDashboardData()
    loadKPIData()
    loadRealTimeData()

    // Refresh real-time data every 30 seconds
    const interval = setInterval(loadRealTimeData, 30000)
    return () => clearInterval(interval)
  }, [period])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const response = await analyticsAPI.getDashboard(period)
      if (response.data.success) {
        setDashboardData(response.data.data)
      }
    } catch (error) {
      toast.error(t('analyticsPage.errorLoadingDashboard'))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadKPIData = async () => {
    try {
      const response = await analyticsAPI.kpis.getDashboard()
      if (response.data.success) {
        setKpiData(response.data.data)
      }
    } catch (error) {
      console.error('Error loading KPIs:', error)
    }
  }

  const loadRealTimeData = async () => {
    try {
      const response = await analyticsAPI.getRealTime()
      if (response.data.success) {
        setRealTimeData(response.data.data)
      }
    } catch (error) {
      console.error('Error loading real-time data:', error)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num?.toLocaleString('es-ES') || '0'
  }

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num || 0)
  }

  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'up':
        return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
      case 'down':
        return <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
      default:
        return <MinusIcon className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-100'
      case 'ok':
        return 'text-blue-600 bg-blue-100'
      case 'warning':
        return 'text-yellow-600 bg-yellow-100'
      case 'critical':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getChannelColor = (channel) => {
    switch (channel) {
      case 'green':
        return 'bg-green-500'
      case 'orange':
        return 'bg-orange-500'
      case 'red':
        return 'bg-red-500'
      case 'yellow':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luci"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('analyticsPage.title')}</h1>
          <p className="text-sm text-gray-500">{t('analyticsPage.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAIPanel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-luci to-luci-dark text-white rounded-lg hover:opacity-90"
          >
            <SparklesIcon className="w-5 h-5" />
            Centro de Analisis IA
          </button>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field text-sm py-2"
          >
            {TIME_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <button
            onClick={() => { loadDashboardData(); loadKPIData(); }}
            className="btn-secondary p-2"
            title="Actualizar"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Vision General', icon: ChartBarIcon },
            { id: 'kpis', label: 'KPIs', icon: BoltIcon },
            { id: 'financial', label: 'Financiero', icon: CurrencyEuroIcon },
            { id: 'compliance', label: 'Cumplimiento', icon: ShieldCheckIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-luci text-luci'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Real-time Status Bar */}
      {realTimeData && (
        <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm text-gray-600">En tiempo real</span>
            </div>

            <div className="text-sm">
              <span className="text-gray-500">Declaraciones activas: </span>
              <span className="font-medium">{realTimeData.activeDeclarations}</span>
            </div>

            <div className="text-sm">
              <span className="text-gray-500">Pendientes: </span>
              <span className="font-medium">{realTimeData.pendingSubmissions}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">AEAT: </span>
              <span className={`font-medium ${realTimeData.aeatStatus?.connected ? 'text-green-600' : 'text-red-600'}`}>
                {realTimeData.aeatStatus?.connected ? 'Conectado' : 'Desconectado'}
              </span>
              <span className="text-gray-400">({realTimeData.aeatStatus?.latency}ms)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {realTimeData.alerts?.critical > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                <ExclamationTriangleIcon className="w-4 h-4" />
                {realTimeData.alerts.critical} criticas
              </span>
            )}
            {realTimeData.alerts?.warning > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                {realTimeData.alerts.warning} alertas
              </span>
            )}
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardData && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Declaraciones</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(dashboardData.operations?.totalDeclarations)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DocumentChartBarIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {getTrendIcon(dashboardData.trends?.operations?.direction)}
                <span className={`text-sm ${
                  dashboardData.trends?.operations?.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardData.trends?.operations?.percentage}%
                </span>
                <span className="text-sm text-gray-500">vs periodo anterior</span>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Valor Aduanero</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.financial?.totalDutiesCalculated)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CurrencyEuroIcon className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {getTrendIcon(dashboardData.trends?.financial?.direction)}
                <span className={`text-sm ${
                  dashboardData.trends?.financial?.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dashboardData.trends?.financial?.percentage}%
                </span>
                <span className="text-sm text-gray-500">vs periodo anterior</span>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Cumplimiento</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData.compliance?.documentCompleteness}%
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ShieldCheckIcon className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {getTrendIcon(dashboardData.trends?.compliance?.direction)}
                <span className={`text-sm ${
                  dashboardData.trends?.compliance?.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {Math.abs(dashboardData.trends?.compliance?.percentage || 0)}%
                </span>
                <span className="text-sm text-gray-500">variacion</span>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Tiempo Medio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData.operations?.averageProcessingTime}h
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <ClockIcon className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {getTrendIcon(dashboardData.trends?.performance?.direction)}
                <span className="text-sm text-gray-500">tiempo de procesamiento</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Channel Distribution */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribucion por Canal</h3>
              <div className="space-y-4">
                {dashboardData.channels && Object.entries(dashboardData.channels).map(([channel, value]) => (
                  <div key={channel} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{channel === 'green' ? 'Verde' : channel === 'orange' ? 'Naranja' : channel === 'red' ? 'Rojo' : 'Amarillo'}</span>
                      <span className="text-gray-600">{value}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${getChannelColor(channel)}`}
                        style={{ width: `${value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Declarations by Type */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Declaraciones por Tipo</h3>
              <div className="space-y-3">
                {dashboardData.operations?.declarationsByType && Object.entries(dashboardData.operations.declarationsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 flex items-center justify-center bg-luci-light text-luci font-bold rounded-lg">
                        {type}
                      </span>
                      <span className="font-medium text-gray-900">{type}</span>
                    </div>
                    <span className="text-lg font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LUCI Insights */}
          {dashboardData.luciInsights && (
            <div className="card bg-gradient-to-r from-luci-light to-purple-50 border-luci">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <SparklesIcon className="w-6 h-6 text-luci" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Insights de LUCI</h3>
                  <p className="text-gray-700 mb-4">{dashboardData.luciInsights.summary}</p>

                  {dashboardData.luciInsights.recommendations?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Recomendaciones:</h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        {dashboardData.luciInsights.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {dashboardData.luciInsights.opportunities?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="font-medium text-gray-900">Oportunidades:</h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        {dashboardData.luciInsights.opportunities.map((opp, idx) => (
                          <li key={idx}>{opp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs Tab */}
      {activeTab === 'kpis' && kpiData && (
        <div className="space-y-6">
          {/* Health Score */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Salud del Sistema</h3>
                <p className="text-sm text-gray-500">Score general de KPIs</p>
              </div>
              <div className="text-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke={kpiData.healthScore >= 80 ? '#10b981' : kpiData.healthScore >= 60 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${kpiData.healthScore * 2.51} 251`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                    {kpiData.healthScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs by Category */}
          {kpiData.kpis?.byCategory && Object.entries(kpiData.kpis.byCategory).map(([category, kpis]) => (
            <div key={category} className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
                {category === 'operational' ? 'Operacionales' :
                 category === 'financial' ? 'Financieros' :
                 category === 'compliance' ? 'Cumplimiento' :
                 category === 'quality' ? 'Calidad' : 'Eficiencia'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map((kpi) => (
                  <div key={kpi.kpiId} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{kpi.name}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(kpi.status)}`}>
                        {kpi.status === 'good' ? 'Bueno' :
                         kpi.status === 'ok' ? 'OK' :
                         kpi.status === 'warning' ? 'Alerta' : 'Critico'}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-gray-900">
                        {kpi.value}{kpi.unit === '%' ? '%' : kpi.unit === 'EUR' ? '' : ` ${kpi.unit}`}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        {getTrendIcon(kpi.trend?.direction)}
                        <span>{kpi.trend?.percentage}%</span>
                      </div>
                    </div>
                    {kpi.target && (
                      <div className="mt-2 text-xs text-gray-500">
                        Objetivo: {kpi.target}{kpi.unit === '%' ? '%' : ` ${kpi.unit}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Active Alerts */}
          {kpiData.alerts?.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas Activas</h3>
              <div className="space-y-3">
                {kpiData.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg flex items-center justify-between ${
                      alert.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                      alert.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ExclamationTriangleIcon className={`w-5 h-5 ${
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{alert.kpiName}</p>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                      </div>
                    </div>
                    <button className="btn-secondary text-sm py-1 px-3">
                      Reconocer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === 'financial' && dashboardData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <p className="text-sm text-gray-500">Derechos Calculados</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(dashboardData.financial?.totalDutiesCalculated)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Derechos Pagados</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(dashboardData.financial?.totalDutiesPaid)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Ahorros Potenciales</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboardData.financial?.potentialSavings)}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilizacion de Garantias</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Utilizacion actual</span>
                <span className="font-medium">{dashboardData.financial?.guaranteesUtilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full ${
                    dashboardData.financial?.guaranteesUtilization > 80 ? 'bg-red-500' :
                    dashboardData.financial?.guaranteesUtilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${dashboardData.financial?.guaranteesUtilization}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && dashboardData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card">
              <p className="text-sm text-gray-500">Tasa de Error</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.compliance?.errorRate}%
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Tasa de Rechazo</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.compliance?.rejectionRate}%
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Envios a Tiempo</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.compliance?.onTimeSubmissions}%
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Tasa de Inspeccion</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.compliance?.inspectionRate}%
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Completitud Documental</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#10b981"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(dashboardData.compliance?.documentCompleteness || 0) * 3.52} 352`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold">
                  {dashboardData.compliance?.documentCompleteness}%
                </span>
              </div>
              <div className="flex-1">
                <p className="text-gray-600">
                  El {dashboardData.compliance?.documentCompleteness}% de los expedientes tienen toda la documentacion requerida completa.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Panel Modal */}
      {showAIPanel && (
        <AnalyticsAIPanel
          period={period}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </div>
  )
}
