import React, { useState, useEffect } from 'react'
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  PlayIcon,
  ClockIcon,
  DocumentTextIcon,
  CameraIcon,
  BeakerIcon,
  BuildingOfficeIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { inspectionsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const statusColors = {
  requested: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  pending_results: 'bg-purple-100 text-purple-800'
}

const statusLabels = {
  requested: 'Solicitada',
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Curso',
  suspended: 'Suspendida',
  completed: 'Completada',
  cancelled: 'Cancelada',
  pending_results: 'Pte. Resultados'
}

const typeLabels = {
  physical: 'Fisica',
  documentary: 'Documental',
  scanner: 'Scanner',
  soivre: 'SOIVRE',
  mapa: 'MAPA',
  sanidad: 'Sanidad',
  miterd: 'MITERD',
  combined: 'Combinada',
  post_clearance: 'Post-Despacho',
  random: 'Aleatoria'
}

const resultLabels = {
  approved: 'Aprobada',
  approved_conditions: 'Aprobada c/condiciones',
  rejected: 'Rechazada',
  partial: 'Parcial',
  pending_analysis: 'Pte. Analisis',
  pending_documents: 'Pte. Documentos',
  referred: 'Derivada'
}

const authorityTypes = {
  AEAT: 'AEAT - Agencia Tributaria',
  SOIVRE: 'SOIVRE - Comercio Exterior',
  MAPA: 'MAPA - Agricultura/Veterinaria',
  SANIDAD: 'Sanidad',
  MITERD: 'MITERD - Medio Ambiente',
  POLICE: 'Policia',
  OTHER: 'Otra'
}

const locationTypes = {
  port: 'Puerto',
  airport: 'Aeropuerto',
  warehouse: 'Almacen',
  customs_office: 'Oficina Aduanas',
  border: 'Frontera',
  company: 'Empresa',
  other: 'Otro'
}

const priorityLabels = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente'
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
}

// Ubicaciones predefinidas
const predefinedLocations = [
  { code: 'ESBCN', name: 'Puerto de Barcelona', city: 'Barcelona', type: 'port' },
  { code: 'ESVLC', name: 'Puerto de Valencia', city: 'Valencia', type: 'port' },
  { code: 'ESALG', name: 'Puerto de Algeciras', city: 'Algeciras', type: 'port' },
  { code: 'ESBIO', name: 'Puerto de Bilbao', city: 'Bilbao', type: 'port' },
  { code: 'ESLPA', name: 'Puerto de Las Palmas', city: 'Las Palmas', type: 'port' },
  { code: 'LEMD', name: 'Aeropuerto Madrid-Barajas', city: 'Madrid', type: 'airport' },
  { code: 'LEBL', name: 'Aeropuerto Barcelona-El Prat', city: 'Barcelona', type: 'airport' },
  { code: 'LEZG', name: 'Aeropuerto Zaragoza', city: 'Zaragoza', type: 'airport' },
  { code: 'ES002801', name: 'Aduana de Madrid', city: 'Madrid', type: 'customs_office' },
  { code: 'ES000801', name: 'Aduana de Barcelona', city: 'Barcelona', type: 'customs_office' },
  { code: 'ES004601', name: 'Aduana de Valencia', city: 'Valencia', type: 'customs_office' }
]

export default function InspectionManager() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    inspectionType: ''
  })
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [inspectionTypes, setInspectionTypes] = useState([])

  useEffect(() => {
    loadDashboard()
    loadTypes()
  }, [])

  useEffect(() => {
    if (activeTab === 'list') {
      loadInspections()
    } else if (activeTab === 'calendar') {
      loadCalendar()
    }
  }, [activeTab, filters])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const response = await inspectionsAPI.getDashboard()
      setDashboard(response.data.data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInspections = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.inspectionType) params.inspectionType = filters.inspectionType
      const response = await inspectionsAPI.list(params)
      setInspections(response.data.data.inspections || [])
    } catch (error) {
      console.error('Error loading inspections:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCalendar = async () => {
    try {
      setLoading(true)
      const startDate = new Date()
      startDate.setDate(1)
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)

      const response = await inspectionsAPI.getCalendar(
        startDate.toISOString(),
        endDate.toISOString()
      )
      setInspections(response.data.data.inspections || [])
    } catch (error) {
      console.error('Error loading calendar:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTypes = async () => {
    try {
      const response = await inspectionsAPI.getTypes()
      setInspectionTypes(response.data.data || [])
    } catch (error) {
      console.error('Error loading types:', error)
    }
  }

  const handleStart = async (id) => {
    try {
      await inspectionsAPI.start(id)
      toast.success('Inspeccion iniciada')
      loadDashboard()
      if (activeTab === 'list') loadInspections()
    } catch (error) {
      console.error('Error starting inspection:', error)
      toast.error('Error al iniciar la inspeccion')
    }
  }

  const handleCreate = async (data) => {
    try {
      await inspectionsAPI.create(data)
      setShowCreateModal(false)
      toast.success('Inspeccion creada correctamente')
      loadDashboard()
      if (activeTab === 'list') loadInspections()
    } catch (error) {
      console.error('Error creating inspection:', error)
      toast.error('Error al crear la inspeccion')
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

  const formatTime = (time) => {
    return time || '-'
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
                <p className="text-sm text-gray-500">Programadas Hoy</p>
                <p className="text-2xl font-bold text-blue-600">{dashboard.summary?.scheduledToday || 0}</p>
              </div>
              <CalendarIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{dashboard.summary?.totalPending || 0}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En Curso</p>
                <p className="text-2xl font-bold text-orange-600">{dashboard.summary?.inProgress || 0}</p>
              </div>
              <PlayIcon className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completadas (7 dias)</p>
                <p className="text-2xl font-bold text-green-600">{dashboard.summary?.completedThisWeek || 0}</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Today's Inspections */}
        {dashboard.today?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-medium text-blue-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Inspecciones de Hoy
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.today.map((inspection) => (
                <InspectionRow
                  key={inspection._id}
                  inspection={inspection}
                  onStart={handleStart}
                  onView={() => {
                    setSelectedInspection(inspection)
                    setShowDetail(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Inspections */}
        {dashboard.pending?.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                Proximas Inspecciones
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboard.pending.map((inspection) => (
                <InspectionRow
                  key={inspection._id}
                  inspection={inspection}
                  onStart={handleStart}
                  onView={() => {
                    setSelectedInspection(inspection)
                    setShowDetail(true)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stats by Type */}
        {dashboard.stats?.byType && Object.keys(dashboard.stats.byType).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Por Tipo de Inspeccion</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(dashboard.stats.byType).map(([type, count]) => (
                <div key={type} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{typeLabels[type] || type}</p>
                  <p className="text-xl font-semibold">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats by Result */}
        {dashboard.stats?.byResult && Object.keys(dashboard.stats.byResult).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Resultados</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(dashboard.stats.byResult).map(([result, count]) => (
                <div key={result} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{resultLabels[result] || result}</p>
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
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
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
            value={filters.inspectionType}
            onChange={(e) => setFilters({ ...filters, inspectionType: e.target.value })}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Todos los tipos</option>
            {inspectionTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button
            onClick={() => setFilters({ status: '', inspectionType: '' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numero</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicacion</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resultado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inspections.map((inspection) => (
              <tr key={inspection._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{inspection.inspectionNumber}</p>
                  <p className="text-sm text-gray-500">{inspection.mrn}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{typeLabels[inspection.inspectionType] || inspection.inspectionType}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{inspection.location?.name || '-'}</p>
                  <p className="text-xs text-gray-500">{inspection.location?.city}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{formatDate(inspection.scheduling?.scheduledDate)}</p>
                  <p className="text-xs text-gray-500">{formatTime(inspection.scheduling?.scheduledTime)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[inspection.status]}`}>
                    {statusLabels[inspection.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inspection.result ? (
                    <span className="text-sm">{resultLabels[inspection.result]}</span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedInspection(inspection)
                        setShowDetail(true)
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      title="Ver detalle"
                    >
                      <DocumentTextIcon className="w-5 h-5" />
                    </button>
                    {inspection.status === 'confirmed' && (
                      <button
                        onClick={() => handleStart(inspection._id)}
                        className="text-green-600 hover:text-green-800"
                        title="Iniciar"
                      >
                        <PlayIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inspections.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No hay inspecciones que mostrar
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
          <h1 className="text-2xl font-bold text-gray-900">{t('inspections.title')}</h1>
          <p className="text-gray-500">Gestion de inspecciones fisicas y documentales</p>
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
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva Inspeccion
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
            Lista
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'calendar'
                ? 'border-luci text-luci'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Calendario
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
      {showDetail && selectedInspection && (
        <InspectionDetail
          inspection={selectedInspection}
          onClose={() => setShowDetail(false)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateInspectionModal
          inspectionTypes={inspectionTypes}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

function InspectionRow({ inspection, onStart, onView }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[inspection.status]}`}>
            {statusLabels[inspection.status]}
          </span>
          <p className="font-medium text-gray-900">{inspection.inspectionNumber}</p>
          <span className="text-sm text-gray-500">({typeLabels[inspection.inspectionType]})</span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <MapPinIcon className="w-4 h-4" />
            {inspection.location?.name || 'Sin ubicacion'}
          </span>
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {inspection.scheduling?.scheduledDate
              ? new Date(inspection.scheduling.scheduledDate).toLocaleDateString('es-ES')
              : 'Sin fecha'}
            {inspection.scheduling?.scheduledTime && ` ${inspection.scheduling.scheduledTime}`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {inspection.status === 'confirmed' && (
          <button
            onClick={() => onStart(inspection._id)}
            className="btn-primary text-sm py-1 px-3 flex items-center gap-1"
          >
            <PlayIcon className="w-4 h-4" />
            Iniciar
          </button>
        )}
        <button
          onClick={onView}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <DocumentTextIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function InspectionDetail({ inspection, onClose }) {
  const [checklist, setChecklist] = useState(null)

  useEffect(() => {
    loadChecklist()
  }, [])

  const loadChecklist = async () => {
    try {
      const response = await inspectionsAPI.getChecklist(inspection.inspectionType)
      setChecklist(response.data.data)
    } catch (error) {
      console.error('Error loading checklist:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-medium">{inspection.inspectionNumber}</h3>
            <p className="text-sm text-gray-500">{typeLabels[inspection.inspectionType]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and basic info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <span className={`px-2 py-1 text-sm rounded-full ${statusColors[inspection.status]}`}>
                {statusLabels[inspection.status]}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">MRN</p>
              <p className="font-medium">{inspection.mrn || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Autoridad</p>
              <p className="font-medium">{inspection.authority?.type || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Resultado</p>
              <p className="font-medium">{inspection.result ? resultLabels[inspection.result] : '-'}</p>
            </div>
          </div>

          {/* Location */}
          {inspection.location && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <MapPinIcon className="w-5 h-5" />
                Ubicacion
              </h4>
              <p className="text-gray-900">{inspection.location.name}</p>
              {inspection.location.address && <p className="text-gray-500">{inspection.location.address}</p>}
              {inspection.location.city && <p className="text-gray-500">{inspection.location.city}</p>}
            </div>
          )}

          {/* Scheduling */}
          {inspection.scheduling && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <CalendarIcon className="w-5 h-5" />
                Programacion
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Fecha programada</p>
                  <p>{inspection.scheduling.scheduledDate
                    ? new Date(inspection.scheduling.scheduledDate).toLocaleDateString('es-ES')
                    : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hora</p>
                  <p>{inspection.scheduling.scheduledTime || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duracion estimada</p>
                  <p>{inspection.scheduling.estimatedDuration ? `${inspection.scheduling.estimatedDuration} min` : '-'}</p>
                </div>
                {inspection.scheduling.confirmationNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Confirmacion</p>
                    <p>{inspection.scheduling.confirmationNumber}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inspector */}
          {inspection.inspector && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <UserGroupIcon className="w-5 h-5" />
                Inspector
              </h4>
              <p className="font-medium">{inspection.inspector.name || '-'}</p>
              {inspection.inspector.phone && <p className="text-gray-500">{inspection.inspector.phone}</p>}
              {inspection.inspector.email && <p className="text-gray-500">{inspection.inspector.email}</p>}
            </div>
          )}

          {/* Checklist */}
          {checklist && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <ClipboardDocumentCheckIcon className="w-5 h-5" />
                Checklist de Inspeccion
              </h4>
              <div className="space-y-2">
                {checklist.requirements?.map((item, index) => (
                  <label key={index} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded text-luci" />
                    {item}
                  </label>
                ))}
                {checklist.generalItems?.map((item, index) => (
                  <label key={`gen-${index}`} className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="rounded text-luci" />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {inspection.findings?.discrepanciesFound && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-medium text-orange-800 mb-2">Hallazgos</h4>
              <p className="text-orange-700">{inspection.findings.discrepancySummary}</p>
            </div>
          )}

          {/* Samples */}
          {inspection.samples?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <BeakerIcon className="w-5 h-5" />
                Muestras ({inspection.samples.length})
              </h4>
              <div className="space-y-2">
                {inspection.samples.map((sample, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span>{sample.sampleId} - {sample.purpose}</span>
                    <span className="text-gray-500">{sample.result || 'Pendiente'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {inspection.evidence?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <CameraIcon className="w-5 h-5" />
                Evidencias ({inspection.evidence.length})
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {inspection.evidence.map((item, index) => (
                  <div key={index} className="bg-white p-2 rounded border text-center">
                    <p className="text-xs truncate">{item.fileName}</p>
                    <p className="text-xs text-gray-400">{item.type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateInspectionModal({ inspectionTypes, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    inspectionType: 'physical',
    mrn: '',
    lrn: '',
    location: {
      type: 'port',
      name: '',
      address: '',
      city: '',
      contactPerson: '',
      contactPhone: ''
    },
    scheduling: {
      requestedDate: '',
      requestedTimeSlot: 'morning',
      scheduledDate: '',
      scheduledTime: '',
      estimatedDuration: 120
    },
    authority: {
      type: 'AEAT',
      office: '',
      officeName: ''
    },
    goods: {
      description: '',
      totalPackages: '',
      totalGrossWeight: '',
      containerNumbers: ''
    },
    client: {
      name: '',
      nif: '',
      eori: '',
      contact: '',
      phone: '',
      email: ''
    },
    priority: 'normal',
    internalNotes: ''
  })
  const [loading, setLoading] = useState(false)
  const [usePredefLocation, setUsePredefLocation] = useState(true)
  const [selectedPredefLocation, setSelectedPredefLocation] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    const parts = name.split('.')

    if (parts.length === 2) {
      setFormData(prev => ({
        ...prev,
        [parts[0]]: {
          ...prev[parts[0]],
          [parts[1]]: value
        }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handlePredefLocationChange = (e) => {
    const code = e.target.value
    setSelectedPredefLocation(code)

    if (code) {
      const loc = predefinedLocations.find(l => l.code === code)
      if (loc) {
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            type: loc.type,
            name: loc.name,
            city: loc.city
          }
        }))
      }
    }
  }

  const handleTypeChange = (e) => {
    const type = e.target.value
    const typeConfig = inspectionTypes.find(t => t.value === type)

    setFormData(prev => ({
      ...prev,
      inspectionType: type,
      authority: {
        ...prev.authority,
        type: typeConfig?.authority || 'AEAT'
      },
      scheduling: {
        ...prev.scheduling,
        estimatedDuration: typeConfig?.estimatedDuration || 60
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.inspectionType || !formData.location.name) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setLoading(true)
    try {
      // Procesar containerNumbers como array
      const dataToSend = {
        ...formData,
        goods: {
          ...formData.goods,
          totalPackages: formData.goods.totalPackages ? parseInt(formData.goods.totalPackages) : undefined,
          totalGrossWeight: formData.goods.totalGrossWeight ? parseFloat(formData.goods.totalGrossWeight) : undefined,
          containerNumbers: formData.goods.containerNumbers
            ? formData.goods.containerNumbers.split(',').map(c => c.trim()).filter(c => c)
            : []
        }
      }
      await onCreate(dataToSend)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Nueva Inspeccion</h3>
            <p className="text-sm text-gray-500">Programar una nueva inspeccion fisica o documental</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Tipo y Autoridad */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Inspeccion *
                </label>
                <select
                  name="inspectionType"
                  value={formData.inspectionType}
                  onChange={handleTypeChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  {inspectionTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Autoridad
                </label>
                <select
                  name="authority.type"
                  value={formData.authority.type}
                  onChange={handleChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {Object.entries(authorityTypes).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
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

            {/* MRN/LRN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MRN (Numero de Referencia)
                </label>
                <input
                  type="text"
                  name="mrn"
                  value={formData.mrn}
                  onChange={handleChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ej: 24ES12345678901234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LRN (Referencia Local)
                </label>
                <input
                  type="text"
                  name="lrn"
                  value={formData.lrn}
                  onChange={handleChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Referencia interna"
                />
              </div>
            </div>

            {/* Ubicacion */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-gray-500" />
                Ubicacion de la Inspeccion *
              </h4>

              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={usePredefLocation}
                    onChange={(e) => setUsePredefLocation(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-600">Usar ubicacion predefinida</span>
                </label>
              </div>

              {usePredefLocation ? (
                <select
                  value={selectedPredefLocation}
                  onChange={handlePredefLocationChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Seleccionar ubicacion...</option>
                  <optgroup label="Puertos">
                    {predefinedLocations.filter(l => l.type === 'port').map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.name} - {loc.city}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Aeropuertos">
                    {predefinedLocations.filter(l => l.type === 'airport').map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.name} - {loc.city}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Aduanas">
                    {predefinedLocations.filter(l => l.type === 'customs_office').map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.name} - {loc.city}</option>
                    ))}
                  </optgroup>
                </select>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      name="location.type"
                      value={formData.location.type}
                      onChange={handleChange}
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    >
                      {Object.entries(locationTypes).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      name="location.name"
                      value={formData.location.name}
                      onChange={handleChange}
                      className="w-full rounded-md border-gray-300 shadow-sm"
                      placeholder="Nombre del recinto"
                      required={!usePredefLocation}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                    <input
                      type="text"
                      name="location.address"
                      value={formData.location.address}
                      onChange={handleChange}
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      name="location.city"
                      value={formData.location.city}
                      onChange={handleChange}
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persona de contacto</label>
                  <input
                    type="text"
                    name="location.contactPerson"
                    value={formData.location.contactPerson}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono de contacto</label>
                  <input
                    type="text"
                    name="location.contactPhone"
                    value={formData.location.contactPhone}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Programacion */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-gray-500" />
                Programacion
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha solicitada</label>
                  <input
                    type="date"
                    name="scheduling.requestedDate"
                    value={formData.scheduling.requestedDate}
                    onChange={handleChange}
                    min={today}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Franja horaria</label>
                  <select
                    name="scheduling.requestedTimeSlot"
                    value={formData.scheduling.requestedTimeSlot}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="morning">Manana (08:00-14:00)</option>
                    <option value="afternoon">Tarde (14:00-20:00)</option>
                    <option value="any">Cualquier hora</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
                  <input
                    type="date"
                    name="scheduling.scheduledDate"
                    value={formData.scheduling.scheduledDate}
                    onChange={handleChange}
                    min={today}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input
                    type="time"
                    name="scheduling.scheduledTime"
                    value={formData.scheduling.scheduledTime}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Mercancias */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <ClipboardDocumentCheckIcon className="w-4 h-4 text-gray-500" />
                Mercancias
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                  <textarea
                    name="goods.description"
                    value={formData.goods.description}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    rows={2}
                    placeholder="Descripcion de las mercancias a inspeccionar..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Bultos</label>
                  <input
                    type="number"
                    name="goods.totalPackages"
                    value={formData.goods.totalPackages}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso Bruto Total (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="goods.totalGrossWeight"
                    value={formData.goods.totalGrossWeight}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contenedores (separados por coma)</label>
                  <input
                    type="text"
                    name="goods.containerNumbers"
                    value={formData.goods.containerNumbers}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    placeholder="MSKU1234567, TCLU7654321"
                  />
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
                Cliente / Operador
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razon Social</label>
                  <input
                    type="text"
                    name="client.name"
                    value={formData.client.name}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIF/CIF</label>
                  <input
                    type="text"
                    name="client.nif"
                    value={formData.client.nif}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EORI</label>
                  <input
                    type="text"
                    name="client.eori"
                    value={formData.client.eori}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    placeholder="ES12345678901"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                  <input
                    type="text"
                    name="client.contact"
                    value={formData.client.contact}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="text"
                    name="client.phone"
                    value={formData.client.phone}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="client.email"
                    value={formData.client.email}
                    onChange={handleChange}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
              <textarea
                name="internalNotes"
                value={formData.internalNotes}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm"
                rows={2}
                placeholder="Notas o instrucciones adicionales..."
              />
            </div>

            {/* Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Informacion</p>
                  <p className="text-blue-600">
                    Al crear la inspeccion, se generara automaticamente un plazo en el Gestor de Plazos
                    si se especifica una fecha programada.
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
              disabled={loading}
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
                  Crear Inspeccion
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
