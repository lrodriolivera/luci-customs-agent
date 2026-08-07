import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { channelsAPI } from '../../services/api'
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

export default function ChannelDashboard() {
  const { t } = useTranslation()
  const customsCountry = localStorage.getItem('activeCustomsCountry') || 'ES'
  const isNL = customsCountry === 'NL'

  const CHANNEL_CONFIG = {
    green: {
      color: 'bg-green-500',
      bgLight: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      icon: CheckCircleIcon,
      label: t('channels.greenChannel'),
      description: t('channels.greenDesc')
    },
    yellow: {
      color: 'bg-yellow-500',
      bgLight: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      icon: ClockIcon,
      label: t('channels.yellowChannel'),
      description: t('channels.yellowDesc')
    },
    orange: {
      color: 'bg-orange-500',
      bgLight: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      icon: DocumentTextIcon,
      label: t('channels.orangeChannel'),
      description: t('channels.orangeDesc')
    },
    red: {
      color: 'bg-red-500',
      bgLight: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      icon: ExclamationTriangleIcon,
      label: t('channels.redChannel'),
      description: t('channels.redDesc')
    }
  }
  const [stats, setStats] = useState(null)
  const [expeditions, setExpeditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [dateRange, setDateRange] = useState('all')

  // Inicio del rango segun el selector. null = sin limite ("todo").
  // Se usa tanto para pedir las estadisticas al backend como para filtrar
  // localmente la tabla y los criticos, de modo que todo el panel hable
  // del mismo periodo (antes las tarjetas se filtraban pero la tabla no).
  const rangeStartDate = (range) => {
    const start = new Date()
    switch (range) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        return start
      case 'week':
        start.setDate(start.getDate() - 7)
        return start
      case 'month':
        start.setMonth(start.getMonth() - 1)
        return start
      case 'year':
        start.setFullYear(start.getFullYear() - 1)
        return start
      default:
        return null
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    try {
      setLoading(true)

      // Calcular fechas segun rango
      const endDate = new Date()
      const startDate = rangeStartDate(dateRange)

      // Cargar estadisticas
      try {
        const statsParams = startDate
          ? { startDate: startDate.toISOString(), endDate: endDate.toISOString() }
          : {}
        const statsResponse = await channelsAPI.getStats(statsParams)
        setStats(statsResponse.data?.data || statsResponse.data)
      } catch (e) {
        console.error('Error loading stats:', e)
      }

      // Cargar expedientes con canal via API dedicada
      try {
        const expResponse = await channelsAPI.getExpeditions()
        // Debug: try all possible data paths
        const d1 = expResponse?.data?.data
        const d2 = expResponse?.data
        const d3 = expResponse
        const expData = Array.isArray(d1) ? d1 : Array.isArray(d2) ? d2 : Array.isArray(d3) ? d3 : []
        setExpeditions(expData.map(exp => ({
          ...exp,
          _channel: exp.channel || exp.declaration?.channel || 'green',
          _clientName: exp.clientName || '-',
          _mrn: exp.mrn || '-',
          _channelDate: exp.channelDate || exp.createdAt
        })))
      } catch (e) {
        // Silently handle
      }

    } catch (error) {
      console.error('Error loading channel data:', error)
      toast.error(t('channels.errorLoading'))
    } finally {
      setLoading(false)
    }
  }

  // Filtrar por el rango de fechas activo. El selector alimentaba solo a las
  // tarjetas de estadisticas (via getStats); la tabla y "Requieren atencion"
  // ignoraban el rango, de modo que "Hoy" ponia las tarjetas a 0 mientras la
  // tabla seguia mostrando expedientes de meses atras. Ahora todo el panel se
  // acota al mismo periodo.
  const rangeStart = rangeStartDate(dateRange)
  const expeditionsInRange = rangeStart
    ? expeditions.filter(exp => {
        const fecha = exp._channelDate ? new Date(exp._channelDate) : null
        return fecha && fecha >= rangeStart
      })
    : expeditions

  // Filtrar expedientes por canal seleccionado
  const filteredExpeditions = selectedChannel
    ? expeditionsInRange.filter(exp => (exp._channel || exp.channel || exp.declaration?.channel) === selectedChannel)
    : expeditionsInRange

  // Calcular expedientes criticos (canal rojo sin cita, naranja por vencer)
  const criticalExpeditions = (expeditionsInRange || []).filter(exp => {
    try {
      const channel = exp._channel || exp.channel || exp.declaration?.channel
      return channel === 'red' || channel === 'orange'
    } catch { return false }
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
          <h1 className="text-2xl font-bold text-gray-900">{t('channels.title')}</h1>
          <p className="text-gray-600">{t('channels.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Country indicator */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
            isNL ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {isNL ? '\u{1F1F3}\u{1F1F1} Douane NL' : '\u{1F1EA}\u{1F1F8} AEAT'}
          </span>
          {/* Selector de rango de fechas */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">{t('channels.filterToday')}</option>
            <option value="week">{t('channels.filterWeek')}</option>
            <option value="month">{t('channels.filterMonth')}</option>
            <option value="year">{t('channels.filterYear')}</option>
            <option value="all">{t('channels.filterAll')}</option>
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
                  <p className="text-xs text-gray-500 mt-1">{channelStats.percentage}{t('channels.ofTotal')}</p>
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
              <p className="text-sm text-gray-500">{t('channels.totalProcessed')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('channels.greenRate')}: {stats?.green?.percentage || 0}%
          </div>
        </div>

        {/* Expedientes en atencion */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ExclamationCircleIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('channels.requireAttention')}</p>
              <p className="text-2xl font-bold text-orange-600">{criticalExpeditions.length}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('channels.orangeRedPending')}
          </div>
        </div>

        {/* Tiempo medio de despacho */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CalendarDaysIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('channels.avgReleaseTime')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.green?.avgHours ? `${stats.green.avgHours}h` : '-'}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('channels.greenAvg')}
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
                ? `${t('channels.expeditionsIn')} ${CHANNEL_CONFIG[selectedChannel].label}`
                : t('channels.allExpeditions')
              }
            </h2>
            <span className="text-sm text-gray-500">({filteredExpeditions.length})</span>
          </div>
          {selectedChannel && (
            <button
              onClick={() => setSelectedChannel(null)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {t('channels.viewAll')}
            </button>
          )}
        </div>

        {filteredExpeditions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TruckIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t('channels.noExpeditions')}</p>
            <p className="text-sm">{t('channels.noExpeditionsDesc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">{t('channels.expedition')}</th>
                  <th className="px-4 py-3">{t('h7.clientLabel')}</th>
                  <th className="px-4 py-3">MRN</th>
                  <th className="px-4 py-3">{t('nav.channels')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3">{t('channels.channelDate')}</th>
                  <th className="px-4 py-3">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpeditions.map((exp) => {
                  const channel = exp._channel || exp.channel || exp.declaration?.channel || 'green'
                  const config = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.green
                  const Icon = config.icon

                  return (
                    <tr key={exp._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={exp.type === 'h7' ? `/h7/${exp._id}` : `/expeditions/${exp._id}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {exp.expeditionId || exp.reference || (exp._id || '').slice(-8)}
                          {exp.type === 'h7' && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">H7</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {exp._clientName || exp.client?.companyName || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {exp._mrn || exp.mrn || exp.declaration?.mrn || '-'}
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
                        {exp._channelDate
                          ? new Date(exp._channelDate).toLocaleDateString('es-ES')
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={exp.type === 'h7' ? `/h7/${exp._id}` : `/expeditions/${exp._id}`}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {t('common.viewDetail')}
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
        <h3 className="font-medium text-gray-700 mb-3">{t('channels.legend')}</h3>

        {/* NL channel interpretation note */}
        {isNL && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
            <p className="font-medium mb-1">{'\u{1F1F3}\u{1F1F1}'} Interpretacion canales Douane (Paises Bajos)</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li><span className="font-medium text-green-700">Verde (00/01)</span>: Levante autorizado, sin control</li>
              <li><span className="font-medium text-orange-700">Naranja (10)</span>: Control documental requerido</li>
              <li><span className="font-medium text-red-700">Rojo (11)</span>: Control fisico de mercancias</li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 mt-0.5" />
            <div>
              <p className="font-medium text-green-700">{t('channels.greenChannel')}</p>
              <p className="text-gray-600">{isNL ? 'Codigo 00/01 - Levante sin control' : t('channels.greenLegend')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700">{t('channels.yellowChannel')}</p>
              <p className="text-gray-600">{t('channels.yellowLegend')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 mt-0.5" />
            <div>
              <p className="font-medium text-orange-700">{t('channels.orangeChannel')}</p>
              <p className="text-gray-600">{isNL ? 'Codigo 10 - Control documental' : t('channels.orangeLegend')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">{t('channels.redChannel')}</p>
              <p className="text-gray-600">{isNL ? 'Codigo 11 - Control fisico' : t('channels.redLegend')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
