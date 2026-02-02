import React, { useState, useEffect } from 'react'
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  BellAlertIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { deadlinesAPI } from '../../services/api'
import toast from 'react-hot-toast'

const statusColors = {
  pending: 'bg-blue-100 text-blue-800',
  approaching: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  overdue: 'bg-red-200 text-red-900',
  completed: 'bg-green-100 text-green-800',
  extended: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-gray-100 text-gray-800'
}

const statusLabels = {
  pending: 'Pendiente',
  approaching: 'Proximo',
  urgent: 'Urgente',
  critical: 'Critico',
  overdue: 'Vencido',
  completed: 'Completado',
  extended: 'Extendido',
  cancelled: 'Cancelado'
}

const categoryLabels = {
  requirement: 'Requerimientos',
  guarantee: 'Garantias',
  regime: 'Regimenes',
  oea: 'OEA',
  transit: 'Transitos',
  certificate: 'Certificados',
  declaration: 'Declaraciones',
  inspection: 'Inspecciones',
  payment: 'Pagos',
  other: 'Otros'
}

const deadlineTypes = {
  requirement_response: { label: 'Respuesta a Requerimiento', category: 'requirement' },
  guarantee_expiration: { label: 'Vencimiento de Garantia', category: 'guarantee' },
  guarantee_renewal: { label: 'Renovacion de Garantia', category: 'guarantee' },
  regime_ultimation: { label: 'Ultimacion de Regimen', category: 'regime' },
  regime_account: { label: 'Cuenta de Ultimacion', category: 'regime' },
  oea_renewal: { label: 'Renovacion OEA', category: 'oea' },
  oea_audit: { label: 'Auditoria OEA', category: 'oea' },
  transit_arrival: { label: 'Llegada de Transito', category: 'transit' },
  transit_discharge: { label: 'Descarga de Transito', category: 'transit' },
  certificate_expiration: { label: 'Vencimiento de Certificado', category: 'certificate' },
  license_expiration: { label: 'Vencimiento de Licencia', category: 'certificate' },
  declaration_submission: { label: 'Presentacion de Declaracion', category: 'declaration' },
  h7_completion: { label: 'Completar H7', category: 'declaration' },
  inspection_appointment: { label: 'Cita de Inspeccion', category: 'inspection' },
  paraduanero_response: { label: 'Respuesta Control Paraduanero', category: 'requirement' },
  appeal_deadline: { label: 'Plazo de Alegacion/Recurso', category: 'requirement' },
  payment_deadline: { label: 'Plazo de Pago', category: 'payment' },
  document_presentation: { label: 'Presentacion de Documento', category: 'requirement' },
  customs_storage: { label: 'Almacenamiento Temporal', category: 'other' },
  other: { label: 'Otro', category: 'other' }
}

const priorityLabels = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica'
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
}

export default function DeadlineManager() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [deadlines, setDeadlines] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    category: ''
  })
  const [selectedDeadline, setSelectedDeadline] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('') // 'extend' | 'create'

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (activeTab === 'list') {
      loadDeadlines()
    }
  }, [activeTab, filters])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const response = await deadlinesAPI.getDashboard()
      setDashboard(response.data.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDeadlines = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.category) params.category = filters.category
      const response = await deadlinesAPI.list(params)
      setDeadlines(response.data.data.deadlines || [])
    } catch (error) {
      console.error('Error loading deadlines:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (id) => {
    try {
      await deadlinesAPI.complete(id, 'Completado manualmente')
      loadDashboard()
      if (activeTab === 'list') loadDeadlines()
    } catch (error) {
      console.error('Error completing deadline:', error)
    }
  }

  const handleExtend = async (id, newDate, reason) => {
    try {
      await deadlinesAPI.extend(id, newDate, reason)
      setShowModal(false)
      loadDashboard()
      if (activeTab === 'list') loadDeadlines()
      toast.success('Plazo extendido correctamente')
    } catch (error) {
      console.error('Error extending deadline:', error)
      toast.error('Error al extender el plazo')
    }
  }

  const handleCreate = async (data) => {
    try {
      await deadlinesAPI.create(data)
      setShowModal(false)
      loadDashboard()
      if (activeTab === 'list') loadDeadlines()
      toast.success('Plazo creado correctamente')
    } catch (error) {
      console.error('Error creating deadline:', error)
      toast.error('Error al crear el plazo')
    }
  }

  const openCreateModal = () => {
    setSelectedDeadline(null)
    setModalType('create')
    setShowModal(true)
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDaysRemaining = (dueDate) => {
    if (!dueDate) return null
    const now = new Date()
    const due = new Date(dueDate)
    const diffTime = due - now
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const renderDashboard = () => {
    if (!dashboard) return null

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{dashboard.summary?.overdue || 0}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Vencen Hoy</p>
                <p className="text-2xl font-bold text-orange-600">{dashboard.summary?.dueToday || 0}</p>
              </div>
              <BellAlertIcon className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Esta Semana</p>
                <p className="text-2xl font-bold text-yellow-600">{dashboard.summary?.dueThisWeek || 0}</p>
              </div>
              <CalendarIcon className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Pendientes</p>
                <p className="text-2xl font-bold text-blue-600">{dashboard.summary?.totalPending || 0}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Urgent Deadlines */}
        {dashboard.urgent?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 bg-red-50">
              <h3 className="text-lg font-medium text-red-800 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5" />
                Plazos Urgentes (proximas 48h)
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.urgent.map((deadline) => (
                <DeadlineRow
                  key={deadline._id}
                  deadline={deadline}
                  onComplete={handleComplete}
                  onExtend={() => {
                    setSelectedDeadline(deadline)
                    setModalType('extend')
                    setShowModal(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Overdue Deadlines */}
        {dashboard.overdue?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 bg-orange-50">
              <h3 className="text-lg font-medium text-orange-800 flex items-center gap-2">
                <BellAlertIcon className="w-5 h-5" />
                Plazos Vencidos
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.overdue.map((deadline) => (
                <DeadlineRow
                  key={deadline._id}
                  deadline={deadline}
                  onComplete={handleComplete}
                  onExtend={() => {
                    setSelectedDeadline(deadline)
                    setModalType('extend')
                    setShowModal(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Today's Deadlines */}
        {dashboard.dueToday?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Vencen Hoy
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.dueToday.map((deadline) => (
                <DeadlineRow
                  key={deadline._id}
                  deadline={deadline}
                  onComplete={handleComplete}
                  onExtend={() => {
                    setSelectedDeadline(deadline)
                    setModalType('extend')
                    setShowModal(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stats by Category */}
        {dashboard.stats?.byCategory && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Por Categoria</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <button
            onClick={() => setFilters({ status: '', category: '' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Deadlines Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plazo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dias</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deadlines.map((deadline) => {
              const days = getDaysRemaining(deadline.dueDate)
              return (
                <tr key={deadline._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{deadline.title}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{deadline.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{categoryLabels[deadline.category] || deadline.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(deadline.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${days < 0 ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                      {days < 0 ? `${Math.abs(days)} vencido` : days === 0 ? 'Hoy' : `${days} dias`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[deadline.status]}`}>
                      {statusLabels[deadline.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {deadline.status !== 'completed' && deadline.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => handleComplete(deadline._id)}
                            className="text-green-600 hover:text-green-800"
                            title="Completar"
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDeadline(deadline)
                              setModalType('extend')
                              setShowModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Extender"
                          >
                            <ArrowPathIcon className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {deadlines.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No hay plazos que mostrar
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
          <h1 className="text-2xl font-bold text-gray-900">Gestor de Plazos</h1>
          <p className="text-gray-500">Control de vencimientos y alertas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDashboard}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Actualizar
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo Plazo
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
            Lista Completa
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

      {/* Extend Modal */}
      {showModal && modalType === 'extend' && selectedDeadline && (
        <ExtendModal
          deadline={selectedDeadline}
          onClose={() => setShowModal(false)}
          onExtend={handleExtend}
        />
      )}

      {/* Create Modal */}
      {showModal && modalType === 'create' && (
        <CreateDeadlineModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

function DeadlineRow({ deadline, onComplete, onExtend }) {
  const days = deadline.daysRemaining ?? Math.ceil((new Date(deadline.dueDate) - new Date()) / (1000 * 60 * 60 * 24))

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[deadline.status]}`}>
            {statusLabels[deadline.status]}
          </span>
          <p className="font-medium text-gray-900">{deadline.title}</p>
        </div>
        <p className="text-sm text-gray-500 mt-1">{deadline.description}</p>
        <p className="text-xs text-gray-400 mt-1">
          {categoryLabels[deadline.category]} | Vence: {new Date(deadline.dueDate).toLocaleDateString('es-ES')}
          {days !== null && (
            <span className={days < 0 ? 'text-red-600 font-medium' : ''}>
              {' '}({days < 0 ? `${Math.abs(days)} dias vencido` : days === 0 ? 'Hoy' : `${days} dias restantes`})
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onComplete(deadline._id)}
          className="p-2 text-green-600 hover:bg-green-50 rounded-full"
          title="Marcar completado"
        >
          <CheckCircleIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onExtend}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
          title="Extender plazo"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  )
}

function ExtendModal({ deadline, onClose, onExtend }) {
  const [newDate, setNewDate] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (newDate && reason) {
      onExtend(deadline._id, newDate, reason)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium">Extender Plazo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">{deadline.title}</p>
            <p className="text-sm">
              Fecha actual: <span className="font-medium">{new Date(deadline.dueDate).toLocaleDateString('es-ES')}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva fecha de vencimiento
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-md border-gray-300"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de la extension
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border-gray-300"
              rows={3}
              placeholder="Indique el motivo de la extension..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Extender Plazo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateDeadlineModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    deadlineType: 'other',
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    notes: '',
    client: {
      name: '',
      nif: ''
    }
  })
  const [loading, setLoading] = useState(false)

  const selectedTypeConfig = deadlineTypes[formData.deadlineType]

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.startsWith('client.')) {
      const clientField = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        client: { ...prev.client, [clientField]: value }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleTypeChange = (e) => {
    const type = e.target.value
    const config = deadlineTypes[type]
    setFormData(prev => ({
      ...prev,
      deadlineType: type,
      category: config.category
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.dueDate) return

    setLoading(true)
    try {
      await onCreate({
        ...formData,
        category: selectedTypeConfig.category,
        source: 'manual'
      })
    } finally {
      setLoading(false)
    }
  }

  // Calcular fecha minima (hoy)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Nuevo Plazo</h3>
            <p className="text-sm text-gray-500">Crear un nuevo plazo o vencimiento manual</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Tipo de plazo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Plazo *
                </label>
                <select
                  name="deadlineType"
                  value={formData.deadlineType}
                  onChange={handleTypeChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  {Object.entries(deadlineTypes).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <div className="flex items-center h-10 px-3 bg-gray-100 rounded-md">
                  <span className="text-sm text-gray-600">
                    {categoryLabels[selectedTypeConfig?.category] || 'Otros'}
                  </span>
                </div>
              </div>
            </div>

            {/* Titulo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titulo *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Ej: Respuesta requerimiento AEAT ref. 12345"
                required
              />
            </div>

            {/* Descripcion */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={3}
                placeholder="Descripcion detallada del plazo..."
              />
            </div>

            {/* Fecha y Prioridad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Vencimiento *
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  min={today}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridad
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cliente (opcional) */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                Cliente / Operador (opcional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre / Razon Social
                  </label>
                  <input
                    type="text"
                    name="client.name"
                    value={formData.client.name}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Empresa S.L."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIF/CIF
                  </label>
                  <input
                    type="text"
                    name="client.nif"
                    value={formData.client.nif}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="B12345678"
                  />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas internas
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={2}
                placeholder="Notas adicionales..."
              />
            </div>

            {/* Info de alertas */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <BellAlertIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Alertas automaticas</p>
                  <p className="text-blue-600">
                    Se configuraran alertas automaticas segun el tipo de plazo seleccionado:
                    7 dias, 3 dias y 1 dia antes del vencimiento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              disabled={loading || !formData.title || !formData.dueDate}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  Crear Plazo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
