import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { channelsAPI, expeditionsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  TruckIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'

// Configuracion de canales
const CHANNEL_CONFIG = {
  green: {
    color: 'bg-green-500',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    icon: CheckCircleIcon,
    label: 'Canal Verde',
    description: 'Levante autorizado'
  },
  yellow: {
    color: 'bg-yellow-500',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    icon: ClockIcon,
    label: 'Canal Amarillo',
    description: 'Certificados pendientes'
  },
  orange: {
    color: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    icon: DocumentTextIcon,
    label: 'Canal Naranja',
    description: 'Revision documental'
  },
  red: {
    color: 'bg-red-500',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    icon: ExclamationTriangleIcon,
    label: 'Canal Rojo',
    description: 'Inspeccion fisica'
  }
}

export default function ChannelDashboard() {
  const [stats, setStats] = useState(null)
  const [expeditions, setExpeditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [dateRange, setDateRange] = useState('week')

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    try {
      setLoading(true)

      // Calcular fechas segun rango
      const endDate = new Date()
      let startDate = new Date()
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
        default:
          startDate = null
      }

      // Cargar estadisticas y expedientes en paralelo
      const [statsResponse, expeditionsResponse] = await Promise.all([
        channelsAPI.getStats({ startDate: startDate?.toISOString(), endDate: endDate.toISOString() }),
        expeditionsAPI.list()
      ])

      setStats(statsResponse.data?.data || statsResponse.data)

      // Filtrar expedientes con canal asignado
      const allExpeditions = expeditionsResponse.data?.data || expeditionsResponse.data?.expeditions || []
      const withChannel = allExpeditions.filter(exp => exp.channel || exp.declaration?.channel)
      setExpeditions(withChannel)

    } catch (error) {
      console.error('Error loading channel data:', error)
      toast.error('Error al cargar datos de circuitos')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar expedientes por canal seleccionado
  const filteredExpeditions = selectedChannel
    ? expeditions.filter(exp => (exp.channel || exp.declaration?.channel) === selectedChannel)
    : expeditions

  // Calcular expedientes criticos (canal rojo sin cita, naranja por vencer)
  const criticalExpeditions = expeditions.filter(exp => {
    const channel = exp.channel || exp.declaration?.channel
    if (channel === 'red') return true // Todos los rojos son criticos
    if (channel === 'orange') {
      // Verificar si tiene requerimientos por vencer
      // Por ahora marcamos todos los naranja como atencion
      return true
    }
    return false
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Circuitos</h1>
          <p className="text-gray-600">Control y seguimiento de canales aduaneros</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de rango de fechas */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">Hoy</option>
            <option value="week">Ultima semana</option>
            <option value="month">Ultimo mes</option>
            <option value="year">Ultimo ano</option>
            <option value="all">Todo</option>
          </select>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Actualizar"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tarjetas de estadisticas por canal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(CHANNEL_CONFIG).map(([channel, config]) => {
          const channelStats = stats?.[channel] || { count: 0, percentage: 0 }
          const Icon = config.icon
          const isSelected = selectedChannel === channel

          return (
            <button
              key={channel}
              onClick={() => setSelectedChannel(isSelected ? null : channel)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? `${config.borderColor} ${config.bgLight} ring-2 ring-offset-2 ring-${channel === 'green' ? 'green' : channel === 'yellow' ? 'yellow' : channel === 'orange' ? 'orange' : 'red'}-300`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{channelStats.count}</span>
              </div>
              <p className={`font-medium ${config.textColor}`}>{config.label}</p>
              <p className="text-xs text-gray-500">{config.description}</p>
              {channelStats.percentage > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.color}`}
                      style={{ width: `${channelStats.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{channelStats.percentage}% del total</p>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Resumen y alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Total procesados */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total procesados</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Tasa canal verde: {stats?.green?.percentage || 0}%
          </div>
        </div>

        {/* Expedientes en atencion */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ExclamationCircleIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Requieren atencion</p>
              <p className="text-2xl font-bold text-orange-600">{criticalExpeditions.length}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Canal naranja y rojo pendientes
          </div>
        </div>

        {/* Tiempo medio de despacho */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CalendarDaysIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tiempo medio levante</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.green?.avgHours ? `${stats.green.avgHours}h` : '-'}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Canal verde promedio
          </div>
        </div>
      </div>

      {/* Lista de expedientes */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">
              {selectedChannel
                ? `Expedientes en ${CHANNEL_CONFIG[selectedChannel].label}`
                : 'Todos los expedientes con canal asignado'
              }
            </h2>
            <span className="text-sm text-gray-500">({filteredExpeditions.length})</span>
          </div>
          {selectedChannel && (
            <button
              onClick={() => setSelectedChannel(null)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Ver todos
            </button>
          )}
        </div>

        {filteredExpeditions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TruckIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay expedientes con canal asignado</p>
            <p className="text-sm">Los expedientes apareceran aqui despues de enviar la declaracion a AEAT</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">Expediente</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">MRN</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha Canal</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpeditions.map((exp) => {
                  const channel = exp.channel || exp.declaration?.channel
                  const config = CHANNEL_CONFIG[channel]
                  const Icon = config?.icon || DocumentTextIcon

                  return (
                    <tr key={exp._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/expeditions/${exp._id}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {exp.expeditionId || exp.reference || exp._id.slice(-8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {exp.client?.companyName || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {exp.mrn || exp.declaration?.mrn || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config?.bgLight} ${config?.textColor}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {config?.label || channel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{exp.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {exp.declaration?.channelAssignedAt
                          ? new Date(exp.declaration.channelAssignedAt).toLocaleDateString('es-ES')
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/expeditions/${exp._id}`}
                          className="text-sm text-blue-600 hover:text-blue-700"
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

      {/* Leyenda de canales */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-700 mb-3">Leyenda de Circuitos Aduaneros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 mt-0.5" />
            <div>
              <p className="font-medium text-green-700">Canal Verde</p>
              <p className="text-gray-600">Levante inmediato. La mercancia puede retirarse.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700">Canal Amarillo</p>
              <p className="text-gray-600">Esperando certificados adicionales.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 mt-0.5" />
            <div>
              <p className="font-medium text-orange-700">Canal Naranja</p>
              <p className="text-gray-600">Revision documental por AEAT.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Canal Rojo</p>
              <p className="text-gray-600">Inspeccion fisica obligatoria.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
