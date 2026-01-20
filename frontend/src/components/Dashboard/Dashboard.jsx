import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expeditionsAPI, dashboardAPI } from '../../services/api'
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
  CheckCircleIcon
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await expeditionsAPI.list({ limit: 5 })
        const expeditions = response.data.expeditions || []

        setRecentExpeditions(expeditions)

        // Calculate stats
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

    fetchData()
    fetchAlerts()

    // Actualizar alertas cada 5 minutos
    const alertInterval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(alertInterval)
  }, [])

  const statCards = [
    {
      label: 'Total Expedientes',
      value: stats.total,
      icon: FolderIcon,
      color: 'bg-blue-500',
      bgLight: 'bg-blue-50'
    },
    {
      label: 'Pendiente Docs',
      value: stats.pending,
      icon: ClockIcon,
      color: 'bg-yellow-500',
      bgLight: 'bg-yellow-50'
    },
    {
      label: 'En Proceso',
      value: stats.inProgress,
      icon: ExclamationCircleIcon,
      color: 'bg-orange-500',
      bgLight: 'bg-orange-50'
    },
    {
      label: 'Completados',
      value: stats.completed,
      icon: DocumentCheckIcon,
      color: 'bg-green-500',
      bgLight: 'bg-green-50'
    }
  ]

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
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-500',
        text: 'text-red-800',
        badge: 'bg-red-100 text-red-800'
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-500',
        text: 'text-yellow-800',
        badge: 'bg-yellow-100 text-yellow-800'
      },
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-500',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-800'
      }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Bienvenido a LUCI - Agente Aduanero Inteligente</p>
        </div>
        <Link to="/expeditions/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Nuevo Expediente
        </Link>
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
                <h2 className="text-lg font-semibold text-gray-900">
                  Alertas Activas
                </h2>
                <p className="text-sm text-gray-500">
                  {alertStats.critical > 0 && (
                    <span className="text-red-600 font-medium">{alertStats.critical} criticas</span>
                  )}
                  {alertStats.critical > 0 && alertStats.warning > 0 && ' · '}
                  {alertStats.warning > 0 && (
                    <span className="text-yellow-600 font-medium">{alertStats.warning} advertencias</span>
                  )}
                </p>
              </div>
            </div>
            <Link
              to="/requirements"
              className="text-luci hover:text-luci-dark text-sm font-medium flex items-center gap-1"
            >
              Ver todas
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          {alertsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-luci"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.slice(0, 5).map((alert) => {
                const AlertIcon = getAlertIcon(alert.type)
                const styles = getSeverityStyles(alert.severity)
                return (
                  <Link
                    key={alert.id}
                    to={alert.link}
                    className={`block p-3 rounded-lg border ${styles.bg} ${styles.border} hover:shadow-sm transition-shadow`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${styles.text}`}>{alert.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${styles.badge}`}>
                            {alert.severity === 'critical' ? 'Critico' : alert.severity === 'warning' ? 'Aviso' : 'Info'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                        {alert.expeditionNumber && (
                          <p className="text-xs text-gray-500 mt-1">
                            Expediente: {alert.expeditionNumber}
                            {alert.client && ` · ${alert.client}`}
                          </p>
                        )}
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </Link>
                )
              })}

              {alerts.length > 5 && (
                <div className="text-center pt-2">
                  <Link
                    to="/requirements"
                    className="text-sm text-luci hover:text-luci-dark font-medium"
                  >
                    Ver {alerts.length - 5} alertas mas...
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Alerts Message */}
      {!alertsLoading && alertStats.total === 0 && (
        <div className="card bg-green-50 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-medium text-green-800">Sin alertas pendientes</h3>
              <p className="text-sm text-green-600">Todos los expedientes y requerimientos estan al dia</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bgLight }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${bgLight} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Expeditions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Expedientes Recientes</h2>
          <Link to="/expeditions" className="text-luci hover:text-luci-dark text-sm font-medium flex items-center gap-1">
            Ver todos
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {recentExpeditions.length === 0 ? (
          <div className="text-center py-8">
            <FolderIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay expedientes todavia</p>
            <Link to="/expeditions/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <PlusIcon className="w-5 h-5" />
              Crear Primer Expediente
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Expediente</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentExpeditions.map((exp) => (
                  <tr key={exp._id} className="hover:bg-gray-50">
                    <td className="font-medium">{exp.expeditionId}</td>
                    <td>{exp.client?.companyName || 'N/A'}</td>
                    <td>
                      <span className={`badge ${exp.operationType === 'IMPORT' || exp.operationType === 'import' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {exp.operationType === 'IMPORT' || exp.operationType === 'import' ? 'Importacion' : 'Exportacion'}
                      </span>
                    </td>
                    <td>{getStatusBadge(exp.status)}</td>
                    <td className="text-gray-500 text-sm">
                      {new Date(exp.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td>
                      <Link
                        to={`/expeditions/${exp._id}`}
                        className="text-luci hover:text-luci-dark text-sm font-medium"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/classification" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <span className="text-2xl">🏷️</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Clasificacion TARIC</h3>
              <p className="text-sm text-gray-500">Clasificar productos con IA</p>
            </div>
          </div>
        </Link>

        <Link to="/calculator" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <span className="text-2xl">🧮</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Calculadora de Derechos</h3>
              <p className="text-sm text-gray-500">Calcular aranceles e IVA</p>
            </div>
          </div>
        </Link>

        <Link to="/assistant" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-luci-light rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Asistente LUCI</h3>
              <p className="text-sm text-gray-500">Consultas de normativa</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
