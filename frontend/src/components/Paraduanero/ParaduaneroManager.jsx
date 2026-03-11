import React, { useState, useEffect } from 'react'
import { paraduaneroAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  ShieldCheckIcon,
  DocumentCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BeakerIcon,
  TruckIcon,
  DocumentPlusIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline'

// Configuracion de tipos de control
const CONTROL_TYPES = {
  SOIVRE: {
    label: 'SOIVRE',
    fullName: 'Servicio Oficial de Inspeccion',
    color: 'blue',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: ShieldCheckIcon,
    description: 'Productos industriales, juguetes, electricos, textiles'
  },
  MAPA: {
    label: 'MAPA',
    fullName: 'Ministerio de Agricultura',
    color: 'green',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    icon: BeakerIcon,
    description: 'Control veterinario, fitosanitario, piensos'
  },
  SANIDAD: {
    label: 'SANIDAD',
    fullName: 'Sanidad Exterior',
    color: 'red',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    icon: DocumentCheckIcon,
    description: 'Productos alimentarios, cosmeticos, farmaceuticos'
  },
  MITERD: {
    label: 'MITERD',
    fullName: 'Transicion Ecologica',
    color: 'purple',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    icon: ExclamationTriangleIcon,
    description: 'CITES, residuos, quimicos REACH'
  },
  AEMPS: {
    label: 'AEMPS',
    fullName: 'Agencia del Medicamento',
    color: 'indigo',
    bgLight: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700',
    icon: BeakerIcon,
    description: 'Medicamentos, productos sanitarios'
  },
  AESAN: {
    label: 'AESAN',
    fullName: 'Seguridad Alimentaria',
    color: 'orange',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    icon: DocumentCheckIcon,
    description: 'Seguridad alimentaria'
  }
}

// Estados con colores
const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'gray', icon: ClockIcon },
  documents_required: { label: 'Docs. requeridos', color: 'yellow', icon: DocumentPlusIcon },
  documents_submitted: { label: 'Docs. enviados', color: 'blue', icon: DocumentCheckIcon },
  inspection_pending: { label: 'Insp. pendiente', color: 'orange', icon: CalendarDaysIcon },
  inspection_scheduled: { label: 'Insp. programada', color: 'indigo', icon: CalendarDaysIcon },
  under_inspection: { label: 'En inspeccion', color: 'purple', icon: BeakerIcon },
  lab_analysis: { label: 'En laboratorio', color: 'pink', icon: BeakerIcon },
  treatment_required: { label: 'Req. tratamiento', color: 'red', icon: ExclamationTriangleIcon },
  approved: { label: 'Aprobado', color: 'green', icon: CheckCircleIcon },
  conditional: { label: 'Condicional', color: 'lime', icon: CheckCircleIcon },
  rejected: { label: 'Rechazado', color: 'red', icon: XCircleIcon },
  cancelled: { label: 'Cancelado', color: 'gray', icon: XCircleIcon }
}

export default function ParaduaneroManager({ expeditionId, onControlsChange }) {
  const { t } = useTranslation()
  const [controls, setControls] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [expandedControl, setExpandedControl] = useState(null)

  useEffect(() => {
    if (expeditionId) {
      loadControls()
    }
  }, [expeditionId])

  const loadControls = async () => {
    try {
      setLoading(true)
      const response = await paraduaneroAPI.getByExpedition(expeditionId)
      setControls(response.data?.data || [])
    } catch (error) {
      console.error('Error loading controls:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const response = await paraduaneroAPI.analyze(expeditionId)
      setAnalysis(response.data?.data)
      if (response.data?.data?.controlsRequired === 0) {
        toast.success('No se requieren controles paraduaneros')
      } else {
        toast.success(`Se detectaron ${response.data?.data?.controlsRequired} controles necesarios`)
      }
    } catch (error) {
      toast.error('Error al analizar expediente')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCreateControls = async () => {
    setCreating(true)
    try {
      const response = await paraduaneroAPI.createControls(expeditionId)
      const created = response.data?.data || []
      toast.success(`${created.length} control(es) creado(s)`)
      setAnalysis(null)
      loadControls()
      onControlsChange?.()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear controles')
    } finally {
      setCreating(false)
    }
  }

  const handleMarkDocumentProvided = async (controlId, docCode) => {
    try {
      await paraduaneroAPI.provideDocument(controlId, docCode, { documentId: null })
      toast.success('Documento marcado como proporcionado')
      loadControls()
    } catch (error) {
      toast.error('Error al marcar documento')
    }
  }

  const handleChangeStatus = async (controlId, newStatus, reason = '') => {
    try {
      await paraduaneroAPI.changeStatus(controlId, { status: newStatus, reason })
      toast.success('Estado actualizado')
      loadControls()
      onControlsChange?.()
    } catch (error) {
      toast.error('Error al cambiar estado')
    }
  }

  const toggleExpand = (controlId) => {
    setExpandedControl(expandedControl === controlId ? null : controlId)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Controles Paraduaneros</h3>
          {controls.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 rounded-full">
              {controls.length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadControls}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Actualizar"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? 'Analizando...' : 'Analizar'}
          </button>
        </div>
      </div>

      {/* Resultado del analisis */}
      {analysis && analysis.controlsRequired > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-yellow-800">
                Se requieren {analysis.controlsRequired} control(es) paraduanero(s)
              </p>
              <ul className="mt-2 space-y-1 text-sm text-yellow-700">
                {analysis.controls?.map((ctrl, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full bg-${CONTROL_TYPES[ctrl.controlType]?.color || 'gray'}-500`} />
                    <span className="font-medium">{ctrl.controlType}</span>
                    <span>- {ctrl.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={handleCreateControls}
              disabled={creating}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 whitespace-nowrap"
            >
              {creating ? 'Creando...' : 'Crear Controles'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de controles existentes */}
      {controls.length === 0 ? (
        <div className="p-6 text-center bg-gray-50 rounded-lg">
          <TruckIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No hay controles paraduaneros</p>
          <p className="text-sm text-gray-400">
            Pulse "Analizar" para detectar si se requieren controles
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {controls.map((control) => {
            const typeConfig = CONTROL_TYPES[control.controlType] || CONTROL_TYPES.SOIVRE
            const statusConfig = STATUS_CONFIG[control.status] || STATUS_CONFIG.pending
            const StatusIcon = statusConfig.icon
            const TypeIcon = typeConfig.icon
            const isExpanded = expandedControl === control._id

            return (
              <div
                key={control._id}
                className={`border rounded-lg overflow-hidden ${typeConfig.borderColor}`}
              >
                {/* Cabecera del control */}
                <div
                  className={`p-4 ${typeConfig.bgLight} cursor-pointer`}
                  onClick={() => toggleExpand(control._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${typeConfig.color}-100`}>
                        <TypeIcon className={`h-5 w-5 ${typeConfig.textColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${typeConfig.textColor}`}>
                            {typeConfig.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {control.controlNumber}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {control.subType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-${statusConfig.color}-100 text-${statusConfig.color}-800`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusConfig.label}
                      </span>
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  {!['approved', 'rejected', 'cancelled'].includes(control.status) && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-${typeConfig.color}-500`}
                          style={{ width: `${control.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="p-4 bg-white border-t space-y-4">
                    {/* Mercancias afectadas */}
                    {control.affectedGoods?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Mercancias afectadas:</p>
                        <div className="text-sm text-gray-600 space-y-1">
                          {control.affectedGoods.map((good, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-gray-100 px-1.5 rounded">
                                {good.taricCode}
                              </span>
                              <span>{good.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documentos requeridos */}
                    {control.requiredDocuments?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Documentos requeridos:</p>
                        <div className="space-y-2">
                          {control.requiredDocuments.map((doc) => (
                            <div
                              key={doc._id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <div className="flex items-center gap-2">
                                {doc.provided ? (
                                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                  <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                                )}
                                <div>
                                  <span className="text-sm font-medium">{doc.name}</span>
                                  <span className="text-xs text-gray-500 ml-2">({doc.code})</span>
                                  {doc.mandatory && (
                                    <span className="text-xs text-red-500 ml-1">*</span>
                                  )}
                                </div>
                              </div>
                              {!doc.provided && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMarkDocumentProvided(control._id, doc.code)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Marcar proporcionado
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inspeccion */}
                    {control.inspection?.required && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-sm font-medium text-orange-800 mb-2">
                          Inspeccion requerida
                        </p>
                        {control.inspection.scheduled ? (
                          <div className="text-sm text-orange-700 space-y-1">
                            <p>Fecha: {new Date(control.inspection.scheduledDate).toLocaleDateString('es-ES')}</p>
                            <p>Hora: {control.inspection.scheduledTime}</p>
                            <p>Lugar: {control.inspection.location?.name}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-orange-600">
                            Pendiente de programar
                          </p>
                        )}
                      </div>
                    )}

                    {/* Deadline */}
                    {control.deadline && !['approved', 'rejected'].includes(control.status) && (
                      <div className={`text-sm ${control.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
                        Vence: {new Date(control.deadline).toLocaleDateString('es-ES')}
                        {control.daysUntilDeadline !== null && (
                          <span className="ml-1">
                            ({control.daysUntilDeadline > 0 ? `${control.daysUntilDeadline} dias` : 'Vencido'})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Certificado emitido */}
                    {control.certificate?.issued && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          Certificado emitido: {control.certificate.certificateNumber}
                        </p>
                        <p className="text-xs text-green-600">
                          Valido hasta: {new Date(control.certificate.validUntil).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    )}

                    {/* Acciones rapidas */}
                    {!['approved', 'rejected', 'cancelled'].includes(control.status) && (
                      <div className="flex gap-2 pt-2 border-t">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleChangeStatus(control._id, 'approved', 'Aprobado manualmente')
                          }}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleChangeStatus(control._id, 'rejected', 'Rechazado')
                          }}
                          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-600 mb-2">Tipos de control:</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(CONTROL_TYPES).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full bg-${config.color}-500`} />
              <span className="text-gray-600">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
