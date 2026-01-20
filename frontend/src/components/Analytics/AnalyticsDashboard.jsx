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
  FunnelIcon
} from '@heroicons/react/24/outline'
import { analyticsAPI } from '../../services/api'

const TIME_PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last_7_days', label: 'Ultimos 7 dias' },
  { value: 'last_30_days', label: 'Ultimos 30 dias' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este ano' }
]

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('last_30_days')
  const [dashboardData, setDashboardData] = useState(null)
  const [kpiData, setKpiData] = useState(null)
  const [realTimeData, setRealTimeData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

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
      toast.error('Error cargando datos del dashboard')
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
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500">Inteligencia de negocio con LUCI</p>
        </div>

        <div className="flex items-center gap-3">
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
    </div>
  )
}
