import React, { useState, useEffect } from 'react'
import { transitAPI } from '../../services/api'
import {
  TruckIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'

const TRANSIT_TYPES = {
  T1: { label: 'T1 - No Union', color: 'blue', description: 'Mercancias no comunitarias' },
  T2: { label: 'T2 - Union', color: 'green', description: 'Mercancias comunitarias' },
  T2F: { label: 'T2F - Union Fiscal', color: 'teal', description: 'Zonas francas' },
  TIR: { label: 'TIR - Carnet TIR', color: 'purple', description: 'Convenio TIR' }
}

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'gray', icon: DocumentTextIcon },
  submitted: { label: 'Enviado', color: 'blue', icon: ArrowPathIcon },
  accepted: { label: 'Aceptado', color: 'indigo', icon: CheckCircleIcon },
  released: { label: 'Liberado', color: 'cyan', icon: TruckIcon },
  in_transit: { label: 'En Transito', color: 'orange', icon: TruckIcon },
  arrived: { label: 'Llegado', color: 'yellow', icon: MapPinIcon },
  control_requested: { label: 'Control', color: 'amber', icon: ExclamationTriangleIcon },
  goods_released: { label: 'Entregado', color: 'lime', icon: CheckCircleIcon },
  discrepancy: { label: 'Discrepancia', color: 'red', icon: ExclamationTriangleIcon },
  enquiry: { label: 'Busqueda', color: 'red', icon: ExclamationTriangleIcon },
  completed: { label: 'Completado', color: 'green', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelado', color: 'gray', icon: ExclamationTriangleIcon }
}

const TRANSPORT_MODES = {
  '1': 'Maritimo',
  '2': 'Ferrocarril',
  '3': 'Carretera',
  '4': 'Aereo',
  '5': 'Postal',
  '7': 'Tuberia',
  '8': 'Navegacion interior'
}

export default function TransitManager() {
  const [transits, setTransits] = useState([])
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ transitType: '', status: '', search: '' })
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    loadData()
  }, [filters, pagination.page])

  const loadData = async () => {
    try {
      setLoading(true)
      const [listRes, statsRes, overdueRes] = await Promise.all([
        transitAPI.list({ ...filters, page: pagination.page, limit: pagination.limit }),
        transitAPI.getStats({}),
        transitAPI.getOverdue()
      ])

      if (listRes.data.success) {
        setTransits(listRes.data.data.transits)
        setPagination(prev => ({ ...prev, ...listRes.data.data.pagination }))
      }
      if (statsRes.data.success) setStats(statsRes.data.data)
      if (overdueRes.data.success) setOverdue(overdueRes.data.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando transitos')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id, action, data = {}) => {
    try {
      setActionLoading(`${id}-${action}`)
      let res

      switch (action) {
        case 'submit':
          res = await transitAPI.submit(id)
          break
        case 'release-departure':
          res = await transitAPI.releaseAtDeparture(id)
          break
        case 'start':
          res = await transitAPI.startTransit(id)
          break
        case 'arrival':
          res = await transitAPI.notifyArrival(id, data)
          break
        case 'release-goods':
          res = await transitAPI.releaseGoods(id)
          break
        case 'complete':
          res = await transitAPI.complete(id)
          break
        case 'delete':
          res = await transitAPI.delete(id)
          break
        default:
          throw new Error('Accion no reconocida')
      }

      if (res.data.success) {
        loadData()
      }
    } catch (err) {
      setError(err.response?.data?.error || `Error ejecutando ${action}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getNextActions = (transit) => {
    const actions = []

    switch (transit.status) {
      case 'draft':
        actions.push({ key: 'submit', label: 'Enviar a NCTS', color: 'blue' })
        actions.push({ key: 'delete', label: 'Eliminar', color: 'red' })
        break
      case 'accepted':
        actions.push({ key: 'release-departure', label: 'Liberar en Partida', color: 'cyan' })
        break
      case 'released':
        actions.push({ key: 'start', label: 'Iniciar Transito', color: 'orange' })
        break
      case 'in_transit':
        actions.push({ key: 'arrival', label: 'Notificar Llegada', color: 'yellow' })
        break
      case 'arrived':
      case 'control_requested':
        actions.push({ key: 'release-goods', label: 'Liberar Mercancias', color: 'lime' })
        break
      case 'goods_released':
        actions.push({ key: 'complete', label: 'Completar', color: 'green' })
        break
    }

    return actions
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null
    const diff = new Date(deadline) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transitos NCTS</h1>
          <p className="text-gray-500">Gestion de operaciones T1/T2/TIR</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Transito
        </button>
      </div>

      {/* Alerts - Overdue */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            {overdue.length} transito(s) vencido(s)
          </div>
          <div className="space-y-1">
            {overdue.slice(0, 3).map(t => (
              <div key={t._id} className="text-sm text-red-700">
                {t.mrn || t.lrn} - {t.transitType} - Vencio: {formatDate(t.deadlines?.arrivalDeadline)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total || 0}</p>
          </div>
          {Object.entries(TRANSIT_TYPES).map(([type, config]) => (
            <div key={type} className={`bg-${config.color}-50 rounded-lg p-4 border border-${config.color}-200`}>
              <p className="text-sm text-gray-600">{type}</p>
              <p className="text-2xl font-bold">{stats.byType?.[type] || 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Buscar MRN, LRN, referencia..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={filters.transitType}
            onChange={(e) => setFilters(f => ({ ...f, transitType: e.target.value }))}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TRANSIT_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Cerrar</button>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Cargando...</p>
          </div>
        ) : transits.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TruckIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            No hay transitos registrados
          </div>
        ) : (
          <div className="divide-y">
            {transits.map(transit => {
              const statusConfig = STATUS_CONFIG[transit.status] || STATUS_CONFIG.draft
              const StatusIcon = statusConfig.icon
              const typeConfig = TRANSIT_TYPES[transit.transitType] || {}
              const isExpanded = expandedId === transit._id
              const daysRemaining = getDaysRemaining(transit.deadlines?.arrivalDeadline)
              const actions = getNextActions(transit)

              return (
                <div key={transit._id} className="hover:bg-gray-50">
                  {/* Main row */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : transit._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg bg-${typeConfig.color}-100`}>
                          <TruckIcon className={`w-6 h-6 text-${typeConfig.color}-600`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{transit.mrn || transit.lrn}</span>
                            <span className={`px-2 py-0.5 text-xs rounded bg-${typeConfig.color}-100 text-${typeConfig.color}-800`}>
                              {transit.transitType}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {transit.reference} | {transit.principal?.name || 'Sin principal'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Deadline indicator */}
                        {daysRemaining !== null && transit.status !== 'completed' && (
                          <div className={`flex items-center gap-1 text-sm ${
                            daysRemaining < 0 ? 'text-red-600' :
                            daysRemaining <= 2 ? 'text-orange-600' : 'text-gray-600'
                          }`}>
                            <ClockIcon className="w-4 h-4" />
                            {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d vencido` : `${daysRemaining}d`}
                          </div>
                        )}

                        {/* Route summary */}
                        <div className="text-sm text-gray-500 hidden md:block">
                          <MapPinIcon className="w-4 h-4 inline mr-1" />
                          {transit.departureOffice?.code} → {transit.destinationOffice?.code}
                        </div>

                        {/* Status */}
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-${statusConfig.color}-100 text-${statusConfig.color}-800`}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-sm">{statusConfig.label}</span>
                        </div>

                        {/* Expand icon */}
                        {isExpanded ? (
                          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        {/* Info */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700">Informacion</h4>
                          <div className="text-sm space-y-1">
                            <p><span className="text-gray-500">MRN:</span> {transit.mrn || 'Pendiente'}</p>
                            <p><span className="text-gray-500">LRN:</span> {transit.lrn}</p>
                            <p><span className="text-gray-500">Transporte:</span> {TRANSPORT_MODES[transit.transport?.mode] || '-'}</p>
                            <p><span className="text-gray-500">Garantia:</span> {transit.guarantee?.grn || 'Sin garantia'}</p>
                            <p><span className="text-gray-500">Items:</span> {transit.totals?.itemCount || 0}</p>
                            <p><span className="text-gray-500">Peso bruto:</span> {transit.totals?.grossWeight?.toLocaleString() || 0} kg</p>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700">Fechas</h4>
                          <div className="text-sm space-y-1">
                            <p><span className="text-gray-500">Declaracion:</span> {formatDate(transit.dates?.declaration)}</p>
                            <p><span className="text-gray-500">Liberacion:</span> {formatDate(transit.dates?.releaseAtDeparture)}</p>
                            <p><span className="text-gray-500">Llegada:</span> {formatDate(transit.dates?.actualArrival)}</p>
                            <p><span className="text-gray-500">Limite:</span> {formatDate(transit.deadlines?.arrivalDeadline)}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700">Acciones</h4>
                          <div className="flex flex-wrap gap-2">
                            {actions.map(action => (
                              <button
                                key={action.key}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAction(transit._id, action.key)
                                }}
                                disabled={actionLoading === `${transit._id}-${action.key}`}
                                className={`px-3 py-1.5 text-sm rounded-lg bg-${action.color}-100 text-${action.color}-800 hover:bg-${action.color}-200 disabled:opacity-50`}
                              >
                                {actionLoading === `${transit._id}-${action.key}` ? 'Procesando...' : action.label}
                              </button>
                            ))}
                          </div>

                          {/* Messages count */}
                          {transit.messages?.length > 0 && (
                            <p className="text-sm text-gray-500 mt-2">
                              <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                              {transit.messages.length} mensaje(s) NCTS
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Mostrando {transits.length} de {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <TransitCreateForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// Create Form Component
function TransitCreateForm({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    reference: '',
    transitType: 'T1',
    principal: { eori: '', name: '', address: { street: '', city: '', postalCode: '', country: 'ES' } },
    departureOffice: { code: '', name: '', country: 'ES' },
    destinationOffice: { code: '', name: '', country: '' },
    transport: { mode: '3' },
    guarantee: { type: '1', grn: '' },
    route: { countries: [] },
    goodsItems: [{ itemNumber: 1, description: '', taricCode: '', grossWeight: 0, packages: { count: 1, type: 'CT' } }]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      const res = await transitAPI.create(formData)
      if (res.data.success) {
        onCreated()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando transito')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Nuevo Transito NCTS</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Referencia *</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData(f => ({ ...f, reference: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Transito *</label>
              <select
                value={formData.transitType}
                onChange={(e) => setFormData(f => ({ ...f, transitType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {Object.entries(TRANSIT_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Principal */}
          <div>
            <h3 className="font-medium mb-2">Principal Obligado</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">EORI *</label>
                <input
                  type="text"
                  value={formData.principal.eori}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    principal: { ...f.principal, eori: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.principal.name}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    principal: { ...f.principal, name: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>
          </div>

          {/* Offices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Aduana de Partida</h3>
              <input
                type="text"
                placeholder="Codigo (ej: ES004801)"
                value={formData.departureOffice.code}
                onChange={(e) => setFormData(f => ({
                  ...f,
                  departureOffice: { ...f.departureOffice, code: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <h3 className="font-medium mb-2">Aduana de Destino</h3>
              <input
                type="text"
                placeholder="Codigo (ej: FR001001)"
                value={formData.destinationOffice.code}
                onChange={(e) => setFormData(f => ({
                  ...f,
                  destinationOffice: { ...f.destinationOffice, code: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          {/* Transport */}
          <div>
            <h3 className="font-medium mb-2">Transporte</h3>
            <select
              value={formData.transport.mode}
              onChange={(e) => setFormData(f => ({
                ...f,
                transport: { ...f.transport, mode: e.target.value }
              }))}
              className="w-full border rounded-lg px-3 py-2"
            >
              {Object.entries(TRANSPORT_MODES).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
          </div>

          {/* Guarantee */}
          {formData.transitType === 'T1' && (
            <div>
              <h3 className="font-medium mb-2">Garantia</h3>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={formData.guarantee.type}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    guarantee: { ...f.guarantee, type: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="0">0 - Dispensa</option>
                  <option value="1">1 - Global</option>
                  <option value="2">2 - Individual fianza</option>
                  <option value="3">3 - Efectivo</option>
                </select>
                <input
                  type="text"
                  placeholder="GRN (Numero de referencia)"
                  value={formData.guarantee.grn}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    guarantee: { ...f.guarantee, grn: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Transito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
