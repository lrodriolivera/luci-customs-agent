import React from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  TruckIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'

export default function PortalStatus() {
  const { expedition } = useOutletContext()

  const statusSteps = [
    {
      id: 'PENDING_DOCS',
      label: 'Esperando Documentos',
      description: 'El cliente debe subir los documentos requeridos',
      icon: DocumentTextIcon
    },
    {
      id: 'DOCS_RECEIVED',
      label: 'Documentos Recibidos',
      description: 'Los documentos han sido recibidos y estan siendo revisados',
      icon: DocumentTextIcon
    },
    {
      id: 'VALIDATING',
      label: 'Validando Informacion',
      description: 'Verificando la informacion de los documentos',
      icon: CheckCircleIcon
    },
    {
      id: 'PROCESSING',
      label: 'Preparando Declaracion',
      description: 'Generando la declaracion aduanera H1/AES',
      icon: BuildingOfficeIcon
    },
    {
      id: 'SUBMITTED',
      label: 'Presentada en Aduana',
      description: 'La declaracion ha sido enviada a la AEAT',
      icon: TruckIcon
    },
    {
      id: 'COMPLETED',
      label: 'Completado',
      description: 'El despacho aduanero ha finalizado',
      icon: CheckCircleIcon
    }
  ]

  const getCurrentStepIndex = () => {
    return statusSteps.findIndex(s => s.id === expedition?.status) || 0
  }

  const currentIndex = getCurrentStepIndex()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estado del Expediente</h1>
        <p className="text-gray-600 mt-1">
          Seguimiento de su {expedition?.operationType === 'IMPORT' ? 'importacion' : 'exportacion'}
        </p>
      </div>

      {/* Main Status */}
      <div className="card bg-gradient-to-r from-luci to-blue-600 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
            {expedition?.status === 'COMPLETED' ? (
              <CheckCircleIcon className="w-10 h-10" />
            ) : (
              <ClockIcon className="w-10 h-10" />
            )}
          </div>
          <div>
            <p className="text-sm opacity-80">Estado Actual</p>
            <h2 className="text-2xl font-bold">
              {statusSteps[currentIndex]?.label || 'Desconocido'}
            </h2>
            <p className="text-sm opacity-90 mt-1">
              {statusSteps[currentIndex]?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Progreso del Expediente</h2>

        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div
            className="absolute left-6 top-0 w-0.5 bg-luci transition-all duration-500"
            style={{ height: `${(currentIndex / (statusSteps.length - 1)) * 100}%` }}
          />

          {/* Steps */}
          <div className="space-y-8">
            {statusSteps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = index < currentIndex
              const isCurrent = index === currentIndex
              const isPending = index > currentIndex

              return (
                <div key={step.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-colors ${
                      isCompleted
                        ? 'bg-luci text-white'
                        : isCurrent
                        ? 'bg-luci text-white ring-4 ring-luci-light'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-2 ${isPending ? 'opacity-50' : ''}`}>
                    <h3 className={`font-semibold ${isCurrent ? 'text-luci' : 'text-gray-900'}`}>
                      {step.label}
                    </h3>
                    <p className="text-sm text-gray-600">{step.description}</p>

                    {/* Timeline event if exists */}
                    {expedition?.timeline?.find(t => t.action?.includes(step.label)) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(
                          expedition.timeline.find(t => t.action?.includes(step.label))?.timestamp
                        ).toLocaleString('es-ES')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Timeline Events */}
      {expedition?.timeline?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Historial de Eventos</h2>
          <div className="space-y-3">
            {expedition.timeline.slice().reverse().map((event, index) => (
              <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 mt-2 rounded-full bg-luci flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{event.action}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.timestamp).toLocaleString('es-ES')}
                  </p>
                  {event.user && (
                    <p className="text-xs text-gray-400">Por: {event.user}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expedition Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Informacion del Expediente</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">ID Expediente</p>
            <p className="font-medium">{expedition?.expeditionId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tipo</p>
            <p className="font-medium">
              {expedition?.operationType === 'IMPORT' ? 'Importacion' : 'Exportacion'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Transporte</p>
            <p className="font-medium">{expedition?.transportMode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Incoterm</p>
            <p className="font-medium">{expedition?.incoterm}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Partidas</p>
            <p className="font-medium">{expedition?.goods?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Documentos</p>
            <p className="font-medium">{expedition?.documents?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fecha Creacion</p>
            <p className="font-medium">
              {expedition?.createdAt && new Date(expedition.createdAt).toLocaleDateString('es-ES')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ultima Actualizacion</p>
            <p className="font-medium">
              {expedition?.updatedAt && new Date(expedition.updatedAt).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
