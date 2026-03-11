import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  ShieldCheckIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline'
import InspectionScheduler from './InspectionScheduler'

export default function ChannelStatus({ expeditionId, channel: propChannel, onStatusChange }) {
  const { t } = useTranslation()

  const CHANNEL_CONFIG = {
    green: {
      color: 'bg-green-500',
      bgLight: 'bg-green-50',
      borderColor: 'border-green-300',
      textColor: 'text-green-800',
      icon: CheckCircleIcon,
      label: t('channels.greenChannel'),
      description: t('channels.greenDesc')
    },
    yellow: {
      color: 'bg-yellow-500',
      bgLight: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      textColor: 'text-yellow-800',
      icon: ClockIcon,
      label: t('channels.yellowChannel'),
      description: t('channels.yellowDesc')
    },
    orange: {
      color: 'bg-orange-500',
      bgLight: 'bg-orange-50',
      borderColor: 'border-orange-300',
      textColor: 'text-orange-800',
      icon: DocumentTextIcon,
      label: t('channels.orangeChannel'),
      description: t('channels.orangeDesc')
    },
    red: {
      color: 'bg-red-500',
      bgLight: 'bg-red-50',
      borderColor: 'border-red-300',
      textColor: 'text-red-800',
      icon: ExclamationTriangleIcon,
      label: t('channels.redChannel'),
      description: t('channels.redDesc')
    }
  }
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reevaluating, setReevaluating] = useState(false)
  const [showInspectionScheduler, setShowInspectionScheduler] = useState(false)

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
        toast.error(t('channels.loadingError'))
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
        toast.success(result.message || t('channels.channelUpdated'))
        loadStatus()
        onStatusChange?.()
      } else {
        toast.error(result.message || t('channels.channelUpdateFailed'))
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('channels.reevaluateError'))
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

      toast.success(t('channels.levanteDownloaded'))
    } catch (error) {
      toast.error(t('channels.levanteDownloadError'))
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
            <span className="font-medium">{t('channels.levanteAuthorized')}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">{t('channels.levanteNumber')}</p>
              <p className="font-mono font-medium">{status.levante.number}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('channels.levanteDate')}</p>
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
            {t('channels.downloadLevante')}
          </button>

          <p className="text-xs text-green-600 text-center mt-2">
            {t('channels.levanteCanWithdraw')}
          </p>
        </div>
      )}

      {channel === 'yellow' && (
        <div className="space-y-3">
          <p className="text-sm text-yellow-700">
            {t('channels.yellowWaiting')}
          </p>

          {status?.pendingCertificates?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('channels.pendingCertificates')}</p>
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
            {reevaluating ? t('channels.verifying') : t('channels.verifyCertificates')}
          </button>

          <p className="text-xs text-yellow-600 text-center">
            {t('channels.yellowUploadHint')}
          </p>
        </div>
      )}

      {channel === 'orange' && (
        <div className="space-y-3">
          <p className="text-sm text-orange-700">
            {t('channels.orangeReview')}
          </p>

          {status?.requirements?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('channels.activeRequirements')}</p>
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
                        {t('channels.expires')}: {new Date(req.deadline).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-orange-600 text-center">
            {t('channels.orangeHint')}
          </p>
        </div>
      )}

      {channel === 'red' && (
        <div className="space-y-3">
          <p className="text-sm text-red-700">
            {t('channels.redInspection')}
          </p>

          {status?.physicalInspection && (
            <div className="p-3 bg-white rounded border">
              <p className="font-medium text-sm text-gray-700 mb-2">
                {t('channels.inspectionStatus')}
              </p>

              {status.physicalInspection.scheduled ? (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-500">{t('channels.inspectionDate')}</span>{' '}
                    <span className="font-medium">
                      {new Date(status.physicalInspection.scheduledDate).toLocaleDateString('es-ES')}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">{t('channels.inspectionTime')}</span>{' '}
                    <span className="font-medium">{status.physicalInspection.scheduledTime}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">{t('channels.inspectionPlace')}</span>{' '}
                    <span className="font-medium">{status.physicalInspection.location?.name}</span>
                  </p>
                  {status.physicalInspection.inspectorName && (
                    <p>
                      <span className="text-gray-500">{t('channels.inspectorLabel')}</span>{' '}
                      <span className="font-medium">{status.physicalInspection.inspectorName}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <ClockIcon className="h-4 w-4" />
                  {t('channels.pendingSchedule')}
                </div>
              )}
            </div>
          )}

          {/* Boton para programar inspeccion */}
          {status?.requirements?.find(r => r.type === 'physical') && (
            <button
              onClick={() => setShowInspectionScheduler(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <CalendarDaysIcon className="h-5 w-5" />
              {status?.physicalInspection?.scheduled ? t('channels.modifyAppointment') : t('channels.scheduleInspection')}
            </button>
          )}

          <p className="text-xs text-red-600 text-center">
            {t('channels.redCannotWithdraw')}
          </p>
        </div>
      )}

      {/* Modal de programacion de inspeccion */}
      {showInspectionScheduler && status?.requirements?.find(r => r.type === 'physical') && (
        <InspectionScheduler
          requirementId={status.requirements.find(r => r.type === 'physical').id}
          currentInspection={status.physicalInspection}
          onScheduled={() => {
            setShowInspectionScheduler(false)
            loadStatus()
            onStatusChange?.()
          }}
          onClose={() => setShowInspectionScheduler(false)}
        />
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
