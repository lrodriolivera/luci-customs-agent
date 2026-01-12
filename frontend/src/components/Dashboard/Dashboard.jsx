import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expeditionsAPI } from '../../services/api'
import {
  FolderIcon,
  DocumentCheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PlusIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  })
  const [recentExpeditions, setRecentExpeditions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await expeditionsAPI.list({ limit: 5 })
        const expeditions = response.data.expeditions || []

        setRecentExpeditions(expeditions)

        // Calculate stats
        setStats({
          total: response.data.total || expeditions.length,
          pending: expeditions.filter(e => e.status === 'PENDING_DOCS').length,
          inProgress: expeditions.filter(e => ['DOCS_RECEIVED', 'VALIDATING', 'PROCESSING'].includes(e.status)).length,
          completed: expeditions.filter(e => e.status === 'COMPLETED').length
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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
      'DOCS_RECEIVED': { label: 'Docs Recibidos', class: 'badge-in-progress' },
      'VALIDATING': { label: 'Validando', class: 'badge-in-progress' },
      'PROCESSING': { label: 'En Proceso', class: 'badge-in-progress' },
      'SUBMITTED': { label: 'Presentada', class: 'badge-completed' },
      'COMPLETED': { label: 'Completado', class: 'badge-completed' },
      'ERROR': { label: 'Error', class: 'badge-error' }
    }
    const config = statusMap[status] || { label: status, class: 'badge-pending' }
    return <span className={config.class}>{config.label}</span>
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
                      <span className={`badge ${exp.operationType === 'IMPORT' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {exp.operationType === 'IMPORT' ? 'Importacion' : 'Exportacion'}
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
