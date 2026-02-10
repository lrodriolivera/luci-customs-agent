import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expeditionsAPI, dashboardAPI, classificationAPI } from '../../services/api'
import {
  FolderIcon,
  DocumentCheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowRightIcon,
  BellAlertIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  TagIcon,
  CalculatorIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  })
  const [recentExpeditions, setRecentExpeditions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertStats, setAlertStats] = useState({ total: 0, critical: 0, warning: 0 })
  const [loading, setLoading] = useState(true)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [cacheStats, setCacheStats] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await expeditionsAPI.list({ limit: 5 })
        const expeditions = response.data.expeditions || []
        setRecentExpeditions(expeditions)
        setStats({
          total: response.data.total || expeditions.length,
          pending: expeditions.filter(e => e.status === 'PENDING_DOCS' || e.status === 'pending_docs').length,
          inProgress: expeditions.filter(e => ['DOCS_RECEIVED', 'VALIDATING', 'PROCESSING', 'orange_channel', 'red_channel'].includes(e.status)).length,
          completed: expeditions.filter(e => e.status === 'COMPLETED' || e.status === 'green_channel').length
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    const fetchAlerts = async () => {
      try {
        const response = await dashboardAPI.getAlerts()
        if (response.data.success) {
          setAlerts(response.data.data.alerts || [])
          setAlertStats(response.data.data.stats || { total: 0, critical: 0, warning: 0 })
        }
      } catch (error) {
        console.error('Error fetching alerts:', error)
      } finally {
        setAlertsLoading(false)
      }
    }

    const fetchCacheStats = async () => {
      try {
        const response = await classificationAPI.getCacheStats()
        if (response.data.success) {
          setCacheStats(response.data.data)
        }
      } catch {}
    }

    fetchData()
    fetchAlerts()
    fetchCacheStats()

    const alertInterval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(alertInterval)
  }, [])

  const getStatusBadge = (status) => {
    const statusMap = {
      'PENDING_DOCS': { label: 'Pendiente Docs', class: 'badge-pending' },
      'pending_docs': { label: 'Pendiente Docs', class: 'badge-pending' },
      'DOCS_RECEIVED': { label: 'Docs Recibidos', class: 'badge-in-progress' },
      'VALIDATING': { label: 'Validando', class: 'badge-in-progress' },
      'PROCESSING': { label: 'En Proceso', class: 'badge-in-progress' },
      'declaration_draft': { label: 'Borrador', class: 'badge-pending' },
      'ready_for_declaration': { label: 'Listo H1', class: 'badge-in-progress' },
      'declaration_submitted': { label: 'Enviada', class: 'badge-in-progress' },
      'green_channel': { label: 'Canal Verde', class: 'bg-green-100 text-green-800' },
      'orange_channel': { label: 'Canal Naranja', class: 'bg-orange-100 text-orange-800' },
      'red_channel': { label: 'Canal Rojo', class: 'bg-red-100 text-red-800' },
      'SUBMITTED': { label: 'Presentada', class: 'badge-completed' },
      'COMPLETED': { label: 'Completado', class: 'badge-completed' },
      'ERROR': { label: 'Error', class: 'badge-error' }
    }
    const config = statusMap[status] || { label: status, class: 'badge-pending' }
    return <span className={`badge ${config.class}`}>{config.label}</span>
  }

  const getAlertIcon = (type) => {
    const icons = {
      requirement_deadline: ClockIcon,
      requirement_overdue: ExclamationTriangleIcon,
      red_channel_pending: ShieldExclamationIcon,
      orange_channel_pending: DocumentTextIcon,
      guarantee_low_balance: BanknotesIcon,
      guarantee_expiring: BanknotesIcon,
      regime_expiring: DocumentCheckIcon,
      paraduanero_pending: DocumentTextIcon
    }
    return icons[type] || BellAlertIcon
  }

  const getSeverityStyles = (severity) => {
    const styles = {
      critical: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-800', badge: 'bg-red-100 text-red-800' },
      warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' },
      info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800' }
    }
    return styles[severity] || styles.info
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Expedientes', value: stats.total, icon: FolderIcon, gradient: 'from-sky-500 to-blue-600', bg: 'bg-sky-50' },
    { label: 'Pendiente Docs', value: stats.pending, icon: ClockIcon, gradient: 'from-amber-400 to-orange-500', bg: 'bg-amber-50' },
    { label: 'En Proceso', value: stats.inProgress, icon: ArrowTrendingUpIcon, gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-50' },
    { label: 'Completados', value: stats.completed, icon: DocumentCheckIcon, gradient: 'from-emerald-400 to-green-600', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen de tu operativa aduanera</p>
        </div>
        <Link to="/expeditions/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Nuevo Expediente</span>
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, gradient, bg }) => (
          <div key={label} className="card group hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Panel */}
      {alertStats.total > 0 && (
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <BellAlertIcon className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Alertas Activas</h2>
                <p className="text-sm text-gray-500">
                  {alertStats.critical > 0 && <span className="text-red-600 font-medium">{alertStats.critical} criticas</span>}
                  {alertStats.critical > 0 && alertStats.warning > 0 && ' · '}
                  {alertStats.warning > 0 && <span className="text-yellow-600 font-medium">{alertStats.warning} advertencias</span>}
                </p>
              </div>
            </div>
            <Link to="/requirements" className="text-luci hover:text-luci-dark text-sm font-medium flex items-center gap-1">
              Ver todas <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          {alertsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-luci"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 4).map((alert) => {
                const AlertIcon = getAlertIcon(alert.type)
                const styles = getSeverityStyles(alert.severity)
                return (
                  <Link key={alert.id} to={alert.link} className={`block p-3 rounded-lg border ${styles.bg} ${styles.border} hover:shadow-sm transition-shadow`}>
                    <div className="flex items-start gap-3">
                      <AlertIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm ${styles.text}`}>{alert.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${styles.badge}`}>
                            {alert.severity === 'critical' ? 'Critico' : alert.severity === 'warning' ? 'Aviso' : 'Info'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* No Alerts */}
      {!alertsLoading && alertStats.total === 0 && (
        <div className="card bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
            <div>
              <h3 className="font-medium text-emerald-800">Sin alertas pendientes</h3>
              <p className="text-sm text-emerald-600">Todos los expedientes y requerimientos estan al dia</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Expeditions - 2/3 width */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Expedientes Recientes</h2>
            <Link to="/expeditions" className="text-luci hover:text-luci-dark text-sm font-medium flex items-center gap-1">
              Ver todos <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          {recentExpeditions.length === 0 ? (
            <div className="text-center py-10">
              <FolderIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No hay expedientes todavia</p>
              <Link to="/expeditions/new" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
                <PlusIcon className="w-4 h-4" /> Crear Primer Expediente
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExpeditions.map((exp) => (
                <Link
                  key={exp._id}
                  to={`/expeditions/${exp._id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    exp.status === 'COMPLETED' || exp.status === 'green_channel' ? 'bg-green-500' :
                    exp.status === 'PENDING_DOCS' || exp.status === 'pending_docs' ? 'bg-amber-400' :
                    exp.status === 'red_channel' ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{exp.expeditionId}</span>
                      {getStatusBadge(exp.status)}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {exp.client?.companyName || 'Sin cliente'} · {exp.operationType === 'IMPORT' || exp.operationType === 'import' ? 'Importacion' : 'Exportacion'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(exp.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                  <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-luci transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar - Quick Actions + AI Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Acciones Rapidas</h3>
            <div className="space-y-2">
              <Link to="/classification" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-sky-50 transition-colors group">
                <div className="w-9 h-9 bg-sky-100 rounded-lg flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                  <TagIcon className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Clasificacion TARIC</p>
                  <p className="text-xs text-gray-500">Clasificar con IA</p>
                </div>
              </Link>
              <Link to="/calculator" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-emerald-50 transition-colors group">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <CalculatorIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Calculadora Derechos</p>
                  <p className="text-xs text-gray-500">Aranceles e IVA</p>
                </div>
              </Link>
              <Link to="/pue" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-violet-50 transition-colors group">
                <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                  <ClipboardDocumentCheckIcon className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">PUE SOIVRE</p>
                  <p className="text-xs text-gray-500">Solicitudes inspeccion</p>
                </div>
              </Link>
              <Link to="/assistant" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-50 transition-colors group">
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Asistente LUCI</p>
                  <p className="text-xs text-gray-500">Consultas normativa</p>
                </div>
              </Link>
            </div>
          </div>

          {/* AI Stats */}
          {cacheStats && (
            <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-5 h-5 text-sky-400" />
                <h3 className="font-semibold">IA Clasificacion</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-sky-400">{cacheStats.totalEntries || 0}</p>
                  <p className="text-xs text-slate-400">Codigos cacheados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{cacheStats.totalHits || 0}</p>
                  <p className="text-xs text-slate-400">Consultas resueltas</p>
                </div>
              </div>
              {cacheStats.validatedCount > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400">
                    {cacheStats.validatedCount} codigos validados manualmente
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
