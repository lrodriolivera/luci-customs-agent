import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { requirementsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

// Mapeo de estados a colores y textos
const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
  in_progress: { color: 'bg-blue-100 text-blue-800', label: 'En Proceso' },
  awaiting_client: { color: 'bg-purple-100 text-purple-800', label: 'Esperando Cliente' },
  response_ready: { color: 'bg-indigo-100 text-indigo-800', label: 'Respuesta Lista' },
  submitted: { color: 'bg-cyan-100 text-cyan-800', label: 'Enviado' },
  under_review: { color: 'bg-orange-100 text-orange-800', label: 'En Revision' },
  resolved: { color: 'bg-green-100 text-green-800', label: 'Resuelto' },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rechazado' },
  closed: { color: 'bg-gray-100 text-gray-800', label: 'Cerrado' }
}

// Mapeo de canales a colores
const CHANNEL_CONFIG = {
  green: { color: 'bg-green-500', label: 'Verde' },
  yellow: { color: 'bg-yellow-500', label: 'Amarillo' },
  orange: { color: 'bg-orange-500', label: 'Naranja' },
  red: { color: 'bg-red-500', label: 'Rojo' }
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

export default function RequirementsList() {
  const [requirements, setRequirements] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    channel: '',
    requirementType: ''
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      setLoading(true)
      const [reqResponse, statsResponse] = await Promise.all([
        requirementsAPI.list(filters),
        requirementsAPI.getStats()
      ])

      const reqData = reqResponse.data?.data || reqResponse.data || []
      const statsData = statsResponse.data?.data || statsResponse.data

      setRequirements(reqData)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading requirements:', error)
      toast.error('Error al cargar requerimientos')
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null
    const now = new Date()
    const dl = new Date(deadline)
    const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({ status: '', channel: '', requirementType: '' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requerimientos AEAT</h1>
          <p className="text-gray-500 mt-1">Gestion de requerimientos y controles</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <ArrowPathIcon className="h-5 w-5" />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-200">
            <p className="text-sm text-yellow-700">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-800">{stats.pending || 0}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200">
            <p className="text-sm text-blue-700">En Proceso</p>
            <p className="text-2xl font-bold text-blue-800">{stats.inProgress || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-200">
            <p className="text-sm text-green-700">Resueltos</p>
            <p className="text-2xl font-bold text-green-800">{stats.resolved || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-4 flex-wrap">
          <FunnelIcon className="h-5 w-5 text-gray-400" />

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={filters.channel}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los canales</option>
            <option value="yellow">Amarillo</option>
            <option value="orange">Naranja</option>
            <option value="red">Rojo</option>
          </select>

          <select
            value={filters.requirementType}
            onChange={(e) => handleFilterChange('requirementType', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {(filters.status || filters.channel || filters.requirementType) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Requirements List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : requirements.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Sin requerimientos</h3>
          <p className="text-gray-500 mt-1">No hay requerimientos que coincidan con los filtros</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requerimiento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expediente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requirements.map((req) => {
                const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                const channelConfig = CHANNEL_CONFIG[req.channel] || CHANNEL_CONFIG.orange
                const daysRemaining = getDaysRemaining(req.deadline)

                return (
                  <tr key={req._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{req.requirementNumber}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">{req.subject}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/expeditions/${req.expeditionId?._id || req.expeditionId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {req.expeditionId?.expeditionId || 'Ver expediente'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {TYPE_LABELS[req.requirementType] || req.requirementType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${channelConfig.color}`}></span>
                        <span className="text-sm text-gray-700">{channelConfig.label}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {req.deadline ? (
                        <span className={`flex items-center gap-1 text-sm ${
                          daysRemaining < 0 ? 'text-red-600 font-medium' :
                          daysRemaining <= 3 ? 'text-orange-600 font-medium' :
                          'text-gray-600'
                        }`}>
                          <CalendarIcon className="h-4 w-4" />
                          {daysRemaining < 0
                            ? `Vencido (${Math.abs(daysRemaining)}d)`
                            : daysRemaining === 0
                            ? 'Hoy'
                            : `${daysRemaining} dias`}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/expeditions/${req.expeditionId?._id || req.expeditionId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
