import React, { useState, useEffect } from 'react'
import { channelsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  TruckIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

// Configuracion de canales
const CHANNEL_CONFIG = {
  green: {
    color: 'bg-green-500',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-800',
    icon: CheckCircleIcon,
    label: 'Canal Verde',
    description: 'Levante autorizado'
  },
  yellow: {
    color: 'bg-yellow-500',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-800',
    icon: ClockIcon,
    label: 'Canal Amarillo',
    description: 'Certificados pendientes'
  },
  orange: {
    color: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-300',
    textColor: 'text-orange-800',
    icon: DocumentTextIcon,
    label: 'Canal Naranja',
    description: 'Revision documental'
  },
  red: {
    color: 'bg-red-500',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-300',
    textColor: 'text-red-800',
    icon: ExclamationTriangleIcon,
    label: 'Canal Rojo',
    description: 'Inspeccion fisica'
  }
}

export default function ChannelStatus({ expeditionId, channel: propChannel, onStatusChange }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reevaluating, setReevaluating] = useState(false)

  useEffect(() => {
    if (expeditionId) {
      loadStatus()
    }
  }, [expeditionId])

  const loadStatus = async () => {
    try {
      setLoading(true)
      const response = await channelsAPI.getStatus(expeditionId)
      const data = response.data?.data || response.data
      setStatus(data)
    } catch (error) {
      console.error('Error loading channel status:', error)
      // Si no hay canal, no es error
      if (error.response?.status !== 400) {
        toast.error('Error al cargar estado del canal')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReevaluate = async () => {
    setReevaluating(true)
    try {
      const response = await channelsAPI.reevaluate(expeditionId)
      const result = response.data?.data || response.data

      if (result.success) {
        toast.success(result.message || 'Canal actualizado')
        loadStatus()
        onStatusChange?.()
      } else {
        toast.error(result.message || 'No se pudo actualizar el canal')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al reevaluar canal')
    } finally {
      setReevaluating(false)
    }
  }

  const handleDownloadLevante = async () => {
    try {
      const response = await channelsAPI.getLevante(expeditionId)
      const data = response.data?.data || response.data

      // Crear un "documento" simple con los datos del levante
      const levanteText = `
========================================
DOCUMENTO DE LEVANTE
========================================

Numero de Levante: ${data.levanteNumber}
Fecha: ${new Date(data.levanteDate).toLocaleDateString('es-ES')}
MRN: ${data.mrn}
Expediente: ${data.expeditionId}

IMPORTADOR:
- Razon Social: ${data.importer?.name || 'N/A'}
- NIF: ${data.importer?.nif || 'N/A'}
- EORI: ${data.importer?.eori || 'N/A'}

Aduana: ${data.customsOffice}

MERCANCIAS:
${data.goods?.map(g =>
  `  ${g.item}. ${g.description}
     TARIC: ${g.taricCode} | Origen: ${g.origin}
     Bultos: ${g.packages || '-'} | Peso: ${g.grossWeight || '-'} kg
     Valor: ${g.value || '-'} EUR`
).join('\n\n') || 'Sin mercancias'}

========================================
LEVANTE AUTORIZADO
La mercancia puede retirarse del recinto aduanero
========================================
      `.trim()

      const blob = new Blob([levanteText], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Levante_${data.levanteNumber}.txt`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Documento de levante descargado')
    } catch (error) {
      toast.error('Error al descargar levante')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Si no hay status o canal, usar el prop
  const channel = status?.channel || propChannel
  if (!channel) {
    return null
  }

  const config = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.green
  const ChannelIcon = config.icon

  return (
    <div className={`rounded-lg border-2 ${config.borderColor} ${config.bgLight} p-4`}>
      {/* Header del canal */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center`}>
            <ChannelIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className={`font-bold ${config.textColor}`}>{config.label}</h3>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>

        {/* Boton actualizar */}
        <button
          onClick={loadStatus}
          className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-white"
          title="Actualizar estado"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Contenido segun canal */}
      {channel === 'green' && status?.levante?.authorized && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <ShieldCheckIcon className="h-5 w-5" />
            <span className="font-medium">Levante Autorizado</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Numero Levante</p>
              <p className="font-mono font-medium">{status.levante.number}</p>
            </div>
            <div>
              <p className="text-gray-500">Fecha Levante</p>
              <p className="font-medium">
                {status.levante.date
                  ? new Date(status.levante.date).toLocaleDateString('es-ES')
                  : '-'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadLevante}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            Descargar Levante
          </button>

          <p className="text-xs text-green-600 text-center mt-2">
            La mercancia puede retirarse del recinto aduanero
          </p>
        </div>
      )}

      {channel === 'yellow' && (
        <div className="space-y-3">
          <p className="text-sm text-yellow-700">
            Esperando certificados para completar el despacho.
          </p>

          {status?.pendingCertificates?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Certificados pendientes:</p>
              <ul className="space-y-1">
                {status.pendingCertificates.map((cert, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 border-2 border-yellow-400 rounded" />
                    <span>{cert.name}</span>
                    <span className="text-xs text-gray-500">({cert.authority})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleReevaluate}
            disabled={reevaluating}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${reevaluating ? 'animate-spin' : ''}`} />
            {reevaluating ? 'Verificando...' : 'Verificar Certificados'}
          </button>

          <p className="text-xs text-yellow-600 text-center">
            Suba los certificados y pulse verificar para actualizar el estado
          </p>
        </div>
      )}

      {channel === 'orange' && (
        <div className="space-y-3">
          <p className="text-sm text-orange-700">
            Revision documental requerida por AEAT.
          </p>

          {status?.requirements?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Requerimientos activos:</p>
              <ul className="space-y-2">
                {status.requirements.map((req) => (
                  <li key={req.id} className="p-2 bg-white rounded border text-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{req.number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    {req.deadline && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Vence: {new Date(req.deadline).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-orange-600 text-center">
            Responda los requerimientos en la seccion de Requerimientos AEAT
          </p>
        </div>
      )}

      {channel === 'red' && (
        <div className="space-y-3">
          <p className="text-sm text-red-700">
            Inspeccion fisica requerida. La mercancia permanece retenida.
          </p>

          {status?.physicalInspection && (
            <div className="p-3 bg-white rounded border">
              <p className="font-medium text-sm text-gray-700 mb-2">
                Estado de la inspeccion:
              </p>

              {status.physicalInspection.scheduled ? (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-500">Fecha:</span>{' '}
                    <span className="font-medium">
                      {new Date(status.physicalInspection.scheduledDate).toLocaleDateString('es-ES')}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Hora:</span>{' '}
                    <span className="font-medium">{status.physicalInspection.scheduledTime}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Lugar:</span>{' '}
                    <span className="font-medium">{status.physicalInspection.location?.name}</span>
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <ClockIcon className="h-4 w-4" />
                  Pendiente de programar cita
                </div>
              )}
            </div>
          )}

          {status?.requirements?.filter(r => r.type === 'physical').length > 0 && (
            <p className="text-xs text-red-600 text-center">
              Gestione la inspeccion desde la seccion de Requerimientos
            </p>
          )}
        </div>
      )}

      {/* MRN */}
      {status?.mrn && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">MRN</p>
          <p className="font-mono text-sm font-medium">{status.mrn}</p>
        </div>
      )}
    </div>
  )
}
