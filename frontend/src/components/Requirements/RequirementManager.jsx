import React, { useState, useEffect } from 'react'
import { requirementsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  CalendarIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

// Mapeo de estados a colores y textos
const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente', icon: ClockIcon },
  in_progress: { color: 'bg-blue-100 text-blue-800', label: 'En Proceso', icon: ClockIcon },
  awaiting_client: { color: 'bg-purple-100 text-purple-800', label: 'Esperando Cliente', icon: ClockIcon },
  response_ready: { color: 'bg-indigo-100 text-indigo-800', label: 'Respuesta Lista', icon: DocumentTextIcon },
  submitted: { color: 'bg-cyan-100 text-cyan-800', label: 'Enviado', icon: PaperAirplaneIcon },
  under_review: { color: 'bg-orange-100 text-orange-800', label: 'En Revision', icon: EyeIcon },
  resolved: { color: 'bg-green-100 text-green-800', label: 'Resuelto', icon: CheckCircleIcon },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rechazado', icon: XCircleIcon },
  closed: { color: 'bg-gray-100 text-gray-800', label: 'Cerrado', icon: CheckCircleIcon }
}

// Mapeo de canales a colores
const CHANNEL_CONFIG = {
  green: { color: 'bg-green-500', label: 'Verde', description: 'Levante automatico' },
  yellow: { color: 'bg-yellow-500', label: 'Amarillo', description: 'Certificados pendientes' },
  orange: { color: 'bg-orange-500', label: 'Naranja', description: 'Revision documental' },
  red: { color: 'bg-red-500', label: 'Rojo', description: 'Inspeccion fisica' }
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

export default function RequirementManager({ expeditionId, onRequirementChange }) {
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showResponseForm, setShowResponseForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(null)

  // Formulario nuevo requerimiento
  const [newRequirement, setNewRequirement] = useState({
    requirementType: 'documentary',
    channel: 'orange',
    subject: '',
    description: '',
    deadline: '',
    requestedItems: []
  })

  // Formulario respuesta
  const [responseForm, setResponseForm] = useState({
    responseType: 'documentary',
    notes: ''
  })

  // Cargar requerimientos
  useEffect(() => {
    if (expeditionId) {
      loadRequirements()
    }
  }, [expeditionId])

  const loadRequirements = async () => {
    try {
      setLoading(true)
      const response = await requirementsAPI.getByExpedition(expeditionId)
      const data = response.data?.data || response.data || []
      setRequirements(data)
    } catch (error) {
      console.error('Error loading requirements:', error)
      toast.error('Error al cargar requerimientos')
    } finally {
      setLoading(false)
    }
  }

  // Crear nuevo requerimiento
  const handleCreateRequirement = async (e) => {
    e.preventDefault()
    if (!newRequirement.subject || !newRequirement.description) {
      toast.error('Completa los campos obligatorios')
      return
    }

    setSubmitting(true)
    try {
      await requirementsAPI.create({
        expeditionId,
        ...newRequirement
      })
      toast.success('Requerimiento creado')
      setShowNewForm(false)
      setNewRequirement({
        requirementType: 'documentary',
        channel: 'orange',
        subject: '',
        description: '',
        deadline: '',
        requestedItems: []
      })
      loadRequirements()
      onRequirementChange?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear requerimiento')
    } finally {
      setSubmitting(false)
    }
  }

  // Agregar respuesta
  const handleAddResponse = async (requirementId) => {
    if (!responseForm.notes) {
      toast.error('Escribe una respuesta')
      return
    }

    setSubmitting(true)
    try {
      await requirementsAPI.addResponse(requirementId, responseForm)
      toast.success('Respuesta agregada')
      setShowResponseForm(null)
      setResponseForm({ responseType: 'documentary', notes: '' })
      loadRequirements()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al agregar respuesta')
    } finally {
      setSubmitting(false)
    }
  }

  // Enviar a AEAT
  const handleSubmitToAEAT = async (requirementId, responseIndex) => {
    setSubmitting(true)
    try {
      const response = await requirementsAPI.submitToAEAT(requirementId, responseIndex)
      const result = response.data?.data || response.data
      toast.success(result.message || 'Enviado a AEAT')
      loadRequirements()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al enviar a AEAT')
    } finally {
      setSubmitting(false)
    }
  }

  // Generar respuesta con IA
  const handleGenerateAI = async (requirementId) => {
    setGeneratingAI(requirementId)
    try {
      const response = await requirementsAPI.generateAIResponse(requirementId)
      const data = response.data?.data || response.data
      setResponseForm({
        responseType: 'documentary',
        notes: data.suggestedResponse || ''
      })
      setShowResponseForm(requirementId)
      toast.success('Respuesta generada con IA')
    } catch (error) {
      toast.error('Error al generar respuesta con IA')
    } finally {
      setGeneratingAI(null)
    }
  }

  // Resolver requerimiento
  const handleResolve = async (requirementId, status) => {
    setSubmitting(true)
    try {
      await requirementsAPI.resolve(requirementId, {
        status,
        notes: `Resuelto como ${status}`
      })
      toast.success('Requerimiento resuelto')
      loadRequirements()
      onRequirementChange?.()
    } catch (error) {
      toast.error('Error al resolver requerimiento')
    } finally {
      setSubmitting(false)
    }
  }

  // Calcular dias restantes
  const getDaysRemaining = (deadline) => {
    if (!deadline) return null
    const now = new Date()
    const dl = new Date(deadline)
    const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24))
    return diff
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Requerimientos AEAT
          {requirements.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({requirements.length})
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo Requerimiento
        </button>
      </div>

      {/* Formulario nuevo requerimiento */}
      {showNewForm && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Crear Requerimiento</h4>
          <form onSubmit={handleCreateRequirement} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Requerimiento
                </label>
                <select
                  value={newRequirement.requirementType}
                  onChange={(e) => setNewRequirement({ ...newRequirement, requirementType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Canal
                </label>
                <select
                  value={newRequirement.channel}
                  onChange={(e) => setNewRequirement({ ...newRequirement, channel: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="yellow">Amarillo - Certificados</option>
                  <option value="orange">Naranja - Documental</option>
                  <option value="red">Rojo - Inspeccion</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asunto *
              </label>
              <input
                type="text"
                value={newRequirement.subject}
                onChange={(e) => setNewRequirement({ ...newRequirement, subject: e.target.value })}
                placeholder="Ej: Solicitud de factura comercial"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion *
              </label>
              <textarea
                value={newRequirement.description}
                onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                placeholder="Detalle del requerimiento..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Limite
              </label>
              <input
                type="date"
                value={newRequirement.deadline}
                onChange={(e) => setNewRequirement({ ...newRequirement, deadline: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creando...' : 'Crear Requerimiento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de requerimientos */}
      {requirements.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <p className="text-gray-600">No hay requerimientos pendientes</p>
          <p className="text-sm text-gray-500">El expediente no tiene requerimientos de AEAT</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((req) => {
            const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
            const channelConfig = CHANNEL_CONFIG[req.channel] || CHANNEL_CONFIG.orange
            const daysRemaining = getDaysRemaining(req.deadline)
            const isExpanded = expandedId === req._id
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={req._id}
                className={`border rounded-lg overflow-hidden ${
                  daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0
                    ? 'border-orange-300 bg-orange-50'
                    : daysRemaining !== null && daysRemaining < 0
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Header del requerimiento */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : req._id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Indicador de canal */}
                      <div
                        className={`w-3 h-3 rounded-full mt-1.5 ${channelConfig.color}`}
                        title={`Canal ${channelConfig.label}`}
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {req.requirementNumber}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{req.subject}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{TYPE_LABELS[req.requirementType] || req.requirementType}</span>
                          {req.deadline && (
                            <span className={`flex items-center gap-1 ${
                              daysRemaining < 0 ? 'text-red-600 font-medium' :
                              daysRemaining <= 3 ? 'text-orange-600 font-medium' : ''
                            }`}>
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {daysRemaining < 0
                                ? `Vencido hace ${Math.abs(daysRemaining)} dias`
                                : daysRemaining === 0
                                ? 'Vence hoy'
                                : `${daysRemaining} dias restantes`}
                            </span>
                          )}
                          {req.responses?.length > 0 && (
                            <span>{req.responses.length} respuesta(s)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {daysRemaining !== null && daysRemaining <= 3 && req.status !== 'resolved' && (
                        <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                      )}
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 bg-gray-50">
                    {/* Descripcion */}
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Descripcion</h5>
                      <p className="text-sm text-gray-600">{req.description}</p>
                    </div>

                    {/* Items solicitados */}
                    {req.requestedItems && req.requestedItems.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Items Solicitados</h5>
                        <ul className="space-y-1">
                          {req.requestedItems.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              {item.provided ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                              )}
                              <span className={item.provided ? 'text-gray-500 line-through' : 'text-gray-700'}>
                                {item.description}
                              </span>
                              {item.mandatory && !item.provided && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Respuestas anteriores */}
                    {req.responses && req.responses.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Respuestas</h5>
                        <div className="space-y-2">
                          {req.responses.map((resp, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium">Respuesta #{resp.responseNumber}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(resp.submittedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-600 whitespace-pre-wrap">{resp.notes}</p>
                              {resp.aeatSubmission?.submitted && (
                                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircleIcon className="h-3.5 w-3.5" />
                                  Enviado a AEAT - {resp.aeatSubmission.confirmationNumber}
                                </div>
                              )}
                              {!resp.aeatSubmission?.submitted && req.status !== 'resolved' && (
                                <button
                                  onClick={() => handleSubmitToAEAT(req._id, idx)}
                                  disabled={submitting}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <PaperAirplaneIcon className="h-3.5 w-3.5" />
                                  Enviar a AEAT
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inspeccion fisica (canal rojo) */}
                    {req.channel === 'red' && req.physicalInspection && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                        <h5 className="text-sm font-medium text-red-800 mb-2">Inspeccion Fisica</h5>
                        {req.physicalInspection.scheduled ? (
                          <div className="text-sm text-red-700">
                            <p>Fecha: {new Date(req.physicalInspection.scheduledDate).toLocaleDateString()}</p>
                            <p>Hora: {req.physicalInspection.scheduledTime}</p>
                            <p>Lugar: {req.physicalInspection.location?.name}</p>
                            {req.physicalInspection.completed && (
                              <p className="mt-2 font-medium">
                                Resultado: {req.physicalInspection.result}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-red-600">Pendiente de programar</p>
                        )}
                      </div>
                    )}

                    {/* Formulario de respuesta */}
                    {showResponseForm === req._id && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <h5 className="text-sm font-medium text-blue-800 mb-2">Nueva Respuesta</h5>
                        <div className="space-y-3">
                          <select
                            value={responseForm.responseType}
                            onChange={(e) => setResponseForm({ ...responseForm, responseType: e.target.value })}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="documentary">Documentacion</option>
                            <option value="clarification">Aclaracion</option>
                            <option value="additional_info">Informacion Adicional</option>
                          </select>
                          <textarea
                            value={responseForm.notes}
                            onChange={(e) => setResponseForm({ ...responseForm, notes: e.target.value })}
                            placeholder="Escribe tu respuesta..."
                            rows={4}
                            className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setShowResponseForm(null)
                                setResponseForm({ responseType: 'documentary', notes: '' })
                              }}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleAddResponse(req._id)}
                              disabled={submitting}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {submitting ? 'Guardando...' : 'Guardar Respuesta'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Acciones */}
                    {req.status !== 'resolved' && req.status !== 'closed' && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t">
                        <button
                          onClick={() => setShowResponseForm(req._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded hover:bg-gray-50"
                        >
                          <DocumentTextIcon className="h-4 w-4" />
                          Agregar Respuesta
                        </button>
                        <button
                          onClick={() => handleGenerateAI(req._id)}
                          disabled={generatingAI === req._id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          {generatingAI === req._id ? 'Generando...' : 'Generar con IA'}
                        </button>
                        <button
                          onClick={() => handleResolve(req._id, 'levante')}
                          disabled={submitting}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Marcar Levante
                        </button>
                      </div>
                    )}

                    {/* Resolucion */}
                    {req.resolution && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <h5 className="text-sm font-medium text-green-800 mb-1">Resolucion</h5>
                        <p className="text-sm text-green-700">
                          Estado: {req.resolution.status} - {new Date(req.resolution.date).toLocaleDateString()}
                        </p>
                        {req.resolution.notes && (
                          <p className="text-sm text-green-600 mt-1">{req.resolution.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
