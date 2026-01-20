import React, { useState, useEffect } from 'react'
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ScaleIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowPathIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { communicationsAPI } from '../../services/api'

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-purple-100 text-purple-800',
  read: 'bg-cyan-100 text-cyan-800',
  in_process: 'bg-orange-100 text-orange-800',
  awaiting_response: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-teal-100 text-teal-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-red-200 text-red-900',
  archived: 'bg-gray-200 text-gray-700'
}

const statusLabels = {
  draft: 'Borrador',
  pending_review: 'Pte. Revision',
  approved: 'Aprobada',
  sent: 'Enviada',
  delivered: 'Entregada',
  read: 'Leida',
  in_process: 'En Tramite',
  awaiting_response: 'Esperando Respuesta',
  responded: 'Respondida',
  resolved: 'Resuelta',
  rejected: 'Rechazada',
  expired: 'Prescrita',
  archived: 'Archivada'
}

const typeLabels = {
  requirement_response: 'Respuesta Requerimiento',
  allegation: 'Alegacion',
  administrative_appeal: 'Recurso Reposicion',
  economic_appeal: 'Rec. Economico-Adtvo',
  judicial_appeal: 'Rec. Contencioso',
  information_request: 'Solicitud Info',
  clarification: 'Aclaracion',
  notification_response: 'Resp. Notificacion',
  inspection_coordination: 'Coord. Inspeccion',
  voluntary_rectification: 'Rectificacion Voluntaria',
  prior_consultation: 'Consulta Vinculante',
  complaint: 'Queja'
}

const categoryLabels = {
  response: 'Respuestas',
  appeal: 'Recursos',
  request: 'Solicitudes',
  notification: 'Notificaciones',
  coordination: 'Coordinacion',
  other: 'Otros'
}

const resolutionLabels = {
  favorable: 'Favorable',
  unfavorable: 'Desfavorable',
  partial: 'Parcialmente Estimada',
  inadmissible: 'Inadmitida',
  withdrawn: 'Desistida',
  silence_positive: 'Silencio Positivo',
  silence_negative: 'Silencio Negativo'
}

export default function CommunicationsManager() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [communications, setCommunications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    communicationType: ''
  })
  const [selectedCommunication, setSelectedCommunication] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [communicationTypes, setCommunicationTypes] = useState([])
  const [authorities, setAuthorities] = useState([])

  useEffect(() => {
    loadDashboard()
    loadTypes()
    loadAuthorities()
  }, [])

  useEffect(() => {
    if (activeTab === 'list') {
      loadCommunications()
    } else if (activeTab === 'appeals') {
      loadAppeals()
    }
  }, [activeTab, filters])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const response = await communicationsAPI.getDashboard()
      setDashboard(response.data.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCommunications = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.category) params.category = filters.category
      if (filters.communicationType) params.communicationType = filters.communicationType
      const response = await communicationsAPI.list(params)
      setCommunications(response.data.data.communications || [])
    } catch (error) {
      console.error('Error loading communications:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAppeals = async () => {
    try {
      setLoading(true)
      const response = await communicationsAPI.getAppeals(filters.status || null)
      setCommunications(response.data.data || [])
    } catch (error) {
      console.error('Error loading appeals:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTypes = async () => {
    try {
      const response = await communicationsAPI.getTypes()
      setCommunicationTypes(response.data.data || [])
    } catch (error) {
      console.error('Error loading types:', error)
    }
  }

  const loadAuthorities = async () => {
    try {
      const response = await communicationsAPI.getAuthorities()
      setAuthorities(response.data.data || [])
    } catch (error) {
      console.error('Error loading authorities:', error)
    }
  }

  const handleApprove = async (id) => {
    try {
      await communicationsAPI.approve(id)
      loadDashboard()
      if (activeTab === 'list') loadCommunications()
    } catch (error) {
      console.error('Error approving:', error)
    }
  }

  const handleSubmit = async (id) => {
    try {
      await communicationsAPI.submit(id)
      loadDashboard()
      if (activeTab === 'list') loadCommunications()
    } catch (error) {
      console.error('Error submitting:', error)
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null
    const now = new Date()
    const due = new Date(deadline)
    const diffTime = due - now
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const renderDashboard = () => {
    if (!dashboard) return null

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-blue-600">{dashboard.summary?.totalPending || 0}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Vencidas</p>
                <p className="text-2xl font-bold text-red-600">{dashboard.summary?.overdue || 0}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Esperando Respuesta</p>
                <p className="text-2xl font-bold text-yellow-600">{dashboard.summary?.pendingResponse || 0}</p>
              </div>
              <ChatBubbleLeftRightIcon className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Recursos Activos</p>
                <p className="text-2xl font-bold text-purple-600">{dashboard.summary?.totalAppeals || 0}</p>
              </div>
              <ScaleIcon className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Overdue Communications */}
        {dashboard.overdue?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 bg-red-50">
              <h3 className="text-lg font-medium text-red-800 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5" />
                Comunicaciones Vencidas
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.overdue.map((comm) => (
                <CommunicationRow
                  key={comm._id}
                  communication={comm}
                  onView={() => {
                    setSelectedCommunication(comm)
                    setShowDetail(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Communications */}
        {dashboard.pending?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                Comunicaciones Pendientes
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.pending.map((comm) => (
                <CommunicationRow
                  key={comm._id}
                  communication={comm}
                  onApprove={handleApprove}
                  onSubmit={handleSubmit}
                  onView={() => {
                    setSelectedCommunication(comm)
                    setShowDetail(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently Resolved */}
        {dashboard.recentResolved?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5" />
                Resueltas Recientemente
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.recentResolved.map((comm) => (
                <CommunicationRow
                  key={comm._id}
                  communication={comm}
                  onView={() => {
                    setSelectedCommunication(comm)
                    setShowDetail(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stats by Category */}
        {dashboard.stats?.byCategory && Object.keys(dashboard.stats.byCategory).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Por Categoria</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {Object.entries(dashboard.stats.byCategory).map(([cat, count]) => (
                <div key={cat} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{categoryLabels[cat] || cat}</p>
                  <p className="text-xl font-semibold">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderList = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Todas las categorias</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={filters.communicationType}
            onChange={(e) => setFilters({ ...filters, communicationType: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Todos los tipos</option>
            {communicationTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button
            onClick={() => setFilters({ status: '', category: '', communicationType: '' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Communications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comunicacion</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autoridad</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plazo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {communications.map((comm) => {
              const days = getDaysRemaining(comm.deadlines?.submissionDeadline)
              return (
                <tr key={comm._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{comm.communicationNumber}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{comm.subject}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{typeLabels[comm.communicationType] || comm.communicationType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{comm.authority?.type || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {comm.deadlines?.submissionDeadline ? (
                      <div>
                        <p className="text-sm">{formatDate(comm.deadlines.submissionDeadline)}</p>
                        {days !== null && (
                          <p className={`text-xs ${days < 0 ? 'text-red-600 font-medium' : days <= 3 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[comm.status]}`}>
                      {statusLabels[comm.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedCommunication(comm)
                          setShowDetail(true)
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Ver detalle"
                      >
                        <DocumentTextIcon className="w-5 h-5" />
                      </button>
                      {comm.status === 'draft' && (
                        <button
                          onClick={() => handleApprove(comm._id)}
                          className="text-green-600 hover:text-green-800"
                          title="Aprobar"
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                      )}
                      {comm.status === 'approved' && (
                        <button
                          onClick={() => handleSubmit(comm._id)}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="Enviar"
                        >
                          <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {communications.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No hay comunicaciones que mostrar
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicaciones con Inspectores</h1>
          <p className="text-gray-500">Alegaciones, recursos y respuestas a autoridades</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva Comunicacion
          </button>
          <button
            onClick={loadDashboard}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-luci text-luci'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'list'
                ? 'border-luci text-luci'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setActiveTab('appeals')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'appeals'
                ? 'border-luci text-luci'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Recursos
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
        </div>
      ) : (
        activeTab === 'dashboard' ? renderDashboard() : renderList()
      )}

      {/* Detail Modal */}
      {showDetail && selectedCommunication && (
        <CommunicationDetail
          communication={selectedCommunication}
          onClose={() => setShowDetail(false)}
          onApprove={handleApprove}
          onSubmit={handleSubmit}
        />
      )}

      {/* New Communication Modal */}
      {showNewModal && (
        <NewCommunicationModal
          types={communicationTypes}
          authorities={authorities}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            loadDashboard()
          }}
        />
      )}
    </div>
  )
}

function CommunicationRow({ communication, onApprove, onSubmit, onView }) {
  const days = communication.daysUntilDeadline ??
    (communication.deadlines?.submissionDeadline
      ? Math.ceil((new Date(communication.deadlines.submissionDeadline) - new Date()) / (1000 * 60 * 60 * 24))
      : null)

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[communication.status]}`}>
            {statusLabels[communication.status]}
          </span>
          <p className="font-medium text-gray-900">{communication.communicationNumber}</p>
        </div>
        <p className="text-sm text-gray-700 mt-1">{communication.subject}</p>
        <p className="text-xs text-gray-500 mt-1">
          {typeLabels[communication.communicationType]} | {communication.authority?.type || 'Sin autoridad'}
          {days !== null && (
            <span className={days < 0 ? 'text-red-600 font-medium ml-2' : 'ml-2'}>
              {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Vence hoy' : `${days}d restantes`}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {communication.status === 'draft' && onApprove && (
          <button
            onClick={() => onApprove(communication._id)}
            className="btn-secondary text-sm py-1 px-3"
          >
            Aprobar
          </button>
        )}
        {communication.status === 'approved' && onSubmit && (
          <button
            onClick={() => onSubmit(communication._id)}
            className="btn-primary text-sm py-1 px-3 flex items-center gap-1"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            Enviar
          </button>
        )}
        <button onClick={onView} className="p-2 text-gray-400 hover:text-gray-600">
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function CommunicationDetail({ communication, onClose, onApprove, onSubmit }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-medium">{communication.communicationNumber}</h3>
            <p className="text-sm text-gray-500">{typeLabels[communication.communicationType]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and basic info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <span className={`px-2 py-1 text-sm rounded-full ${statusColors[communication.status]}`}>
                {statusLabels[communication.status]}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Categoria</p>
              <p className="font-medium">{categoryLabels[communication.category] || communication.category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Autoridad</p>
              <p className="font-medium">{communication.authority?.type || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Prioridad</p>
              <p className="font-medium capitalize">{communication.priority || 'normal'}</p>
            </div>
          </div>

          {/* Subject and Description */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Asunto</h4>
            <p className="text-gray-900">{communication.subject}</p>
            {communication.description && (
              <p className="text-gray-600 mt-2">{communication.description}</p>
            )}
          </div>

          {/* Deadlines */}
          {communication.deadlines && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <ClockIcon className="w-5 h-5" />
                Plazos
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {communication.deadlines.submissionDeadline && (
                  <div>
                    <p className="text-sm text-gray-500">Presentacion</p>
                    <p className="font-medium">{new Date(communication.deadlines.submissionDeadline).toLocaleDateString('es-ES')}</p>
                  </div>
                )}
                {communication.deadlines.responseDeadline && (
                  <div>
                    <p className="text-sm text-gray-500">Respuesta</p>
                    <p className="font-medium">{new Date(communication.deadlines.responseDeadline).toLocaleDateString('es-ES')}</p>
                  </div>
                )}
                {communication.deadlines.appealDeadline && (
                  <div>
                    <p className="text-sm text-gray-500">Recurso</p>
                    <p className="font-medium">{new Date(communication.deadlines.appealDeadline).toLocaleDateString('es-ES')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Arguments (for appeals) */}
          {communication.arguments?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <ScaleIcon className="w-5 h-5" />
                Argumentos
              </h4>
              <div className="space-y-3">
                {communication.arguments.map((arg, index) => (
                  <div key={index} className="border-l-2 border-luci pl-3">
                    <p className="font-medium">{arg.title || `Argumento ${index + 1}`}</p>
                    <p className="text-sm text-gray-600">{arg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {communication.messages?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
                Mensajes ({communication.messages.length})
              </h4>
              <div className="space-y-3">
                {communication.messages.map((msg, index) => (
                  <div key={index} className={`p-3 rounded-lg ${msg.direction === 'outgoing' ? 'bg-blue-50' : 'bg-white border'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-gray-500">{msg.direction === 'outgoing' ? 'Enviado' : 'Recibido'}</span>
                      <span className="text-xs text-gray-400">
                        {msg.sentAt ? new Date(msg.sentAt).toLocaleDateString('es-ES') : '-'}
                      </span>
                    </div>
                    {msg.subject && <p className="font-medium text-sm">{msg.subject}</p>}
                    <p className="text-sm">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution */}
          {communication.resolution && (
            <div className={`rounded-lg p-4 ${
              communication.resolution.status === 'favorable' ? 'bg-green-50' :
              communication.resolution.status === 'unfavorable' ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <h4 className="font-medium mb-2">Resolucion</h4>
              <p className="font-medium">
                {resolutionLabels[communication.resolution.status] || communication.resolution.status}
              </p>
              {communication.resolution.summary && (
                <p className="text-sm mt-1">{communication.resolution.summary}</p>
              )}
              {communication.resolution.date && (
                <p className="text-xs text-gray-500 mt-2">
                  Fecha: {new Date(communication.resolution.date).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
          )}

          {/* Economic Impact */}
          {communication.economicImpact?.totalAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Impacto Economico</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {communication.economicImpact.claimedAmount > 0 && (
                  <div>
                    <p className="text-gray-500">Reclamado</p>
                    <p className="font-medium">{communication.economicImpact.claimedAmount.toLocaleString('es-ES')} EUR</p>
                  </div>
                )}
                {communication.economicImpact.recognizedAmount > 0 && (
                  <div>
                    <p className="text-gray-500">Reconocido</p>
                    <p className="font-medium">{communication.economicImpact.recognizedAmount.toLocaleString('es-ES')} EUR</p>
                  </div>
                )}
                {communication.economicImpact.penaltyAmount > 0 && (
                  <div>
                    <p className="text-gray-500">Sancion</p>
                    <p className="font-medium text-red-600">{communication.economicImpact.penaltyAmount.toLocaleString('es-ES')} EUR</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div className="flex gap-2">
            {communication.status === 'draft' && (
              <button onClick={() => onApprove(communication._id)} className="btn-secondary">
                Aprobar
              </button>
            )}
            {communication.status === 'approved' && (
              <button onClick={() => onSubmit(communication._id)} className="btn-primary flex items-center gap-2">
                <PaperAirplaneIcon className="w-4 h-4" />
                Enviar
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function NewCommunicationModal({ types, authorities, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    communicationType: '',
    subject: '',
    description: '',
    authorityType: 'AEAT',
    priority: 'normal'
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await communicationsAPI.create({
        ...formData,
        authority: { type: formData.authorityType }
      })
      onCreated()
    } catch (error) {
      console.error('Error creating communication:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium">Nueva Comunicacion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Comunicacion *
            </label>
            <select
              value={formData.communicationType}
              onChange={(e) => setFormData({ ...formData, communicationType: e.target.value })}
              className="w-full rounded-md border-gray-300"
              required
            >
              <option value="">Seleccionar tipo...</option>
              {types.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Autoridad Destinataria *
            </label>
            <select
              value={formData.authorityType}
              onChange={(e) => setFormData({ ...formData, authorityType: e.target.value })}
              className="w-full rounded-md border-gray-300"
              required
            >
              {authorities.map((auth) => (
                <option key={auth.code} value={auth.code}>{auth.shortName} - {auth.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asunto *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full rounded-md border-gray-300"
              placeholder="Asunto de la comunicacion"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border-gray-300"
              rows={3}
              placeholder="Descripcion detallada..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full rounded-md border-gray-300"
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Comunicacion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
