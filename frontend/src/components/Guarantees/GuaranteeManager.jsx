import React, { useState, useEffect } from 'react'
import { guaranteesAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ShieldCheckIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline'

// Configuracion de tipos de garantia
const GUARANTEE_TYPES = {
  CGU: { label: 'Garantia Global (CGU)', color: 'purple', icon: ShieldCheckIcon },
  individual: { label: 'Individual', color: 'blue', icon: DocumentTextIcon },
  deposit: { label: 'Deposito', color: 'green', icon: BanknotesIcon },
  bank_guarantee: { label: 'Aval Bancario', color: 'indigo', icon: BanknotesIcon },
  insurance: { label: 'Seguro Caucion', color: 'yellow', icon: ShieldCheckIcon },
  surety: { label: 'Fianza', color: 'orange', icon: BanknotesIcon }
}

// Estados
const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'gray', icon: ClockIcon },
  pending: { label: 'Pendiente', color: 'yellow', icon: ClockIcon },
  active: { label: 'Activa', color: 'green', icon: CheckCircleIcon },
  suspended: { label: 'Suspendida', color: 'orange', icon: ExclamationTriangleIcon },
  expired: { label: 'Expirada', color: 'red', icon: XCircleIcon },
  cancelled: { label: 'Cancelada', color: 'gray', icon: XCircleIcon },
  exhausted: { label: 'Agotada', color: 'red', icon: ExclamationTriangleIcon }
}

// Usos
const USAGE_TYPES = [
  { value: 'general', label: 'Uso General' },
  { value: 'transit', label: 'Transito (T1/T2)' },
  { value: 'customs_warehouse', label: 'Deposito Aduanero' },
  { value: 'temporary_import', label: 'Importacion Temporal' },
  { value: 'inward_processing', label: 'Perfeccionamiento Activo' },
  { value: 'outward_processing', label: 'Perfeccionamiento Pasivo' },
  { value: 'duty_deferment', label: 'Pago Diferido' },
  { value: 'end_use', label: 'Destino Final' }
]

export default function GuaranteeManager() {
  const [guarantees, setGuarantees] = useState([])
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [selectedGuarantee, setSelectedGuarantee] = useState(null)
  const [filters, setFilters] = useState({
    status: '',
    type: ''
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      setLoading(true)
      const [guaranteesRes, statsRes, alertsRes] = await Promise.all([
        guaranteesAPI.list(filters),
        guaranteesAPI.getStats(),
        guaranteesAPI.getAlerts()
      ])

      if (guaranteesRes.data.success) setGuarantees(guaranteesRes.data.data)
      if (statsRes.data.success) setStats(statsRes.data.data)
      if (alertsRes.data.success) setAlerts(alertsRes.data.data)
    } catch (error) {
      toast.error('Error al cargar garantias')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (id) => {
    const grn = prompt('Ingrese el GRN (Guarantee Reference Number):')
    if (!grn) return

    try {
      await guaranteesAPI.activate(id, { grn })
      toast.success('Garantia activada')
      loadData()
    } catch (error) {
      toast.error('Error al activar garantia')
    }
  }

  const handleAcknowledgeAlert = async (guaranteeId, alertId) => {
    try {
      await guaranteesAPI.acknowledgeAlert(guaranteeId, alertId)
      toast.success('Alerta reconocida')
      loadData()
    } catch (error) {
      toast.error('Error al reconocer alerta')
    }
  }

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  }

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  const getTypeBadge = (type) => {
    const config = GUARANTEE_TYPES[type] || GUARANTEE_TYPES.individual
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        {config.label}
      </span>
    )
  }

  const getAvailabilityBar = (guarantee) => {
    const percent = (guarantee.availableAmount / guarantee.totalAmount) * 100
    let color = 'bg-green-500'
    if (percent < 20) color = 'bg-red-500'
    else if (percent < 50) color = 'bg-yellow-500'

    return (
      <div className="w-full">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Disponible</span>
          <span className="font-medium">{percent.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1 text-gray-500">
          <span>{formatCurrency(guarantee.availableAmount)}</span>
          <span>{formatCurrency(guarantee.totalAmount)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Garantias Aduaneras</h1>
          <p className="text-gray-600">CGU, avales, depositos y seguros de caucion</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCalculator(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <CalculatorIcon className="h-5 w-5" />
            Calculadora
          </button>
          <button
            onClick={() => setShowNewForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Nueva Garantia
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BellAlertIcon className="h-5 w-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Alertas Pendientes ({alerts.length})</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert._id} className="flex justify-between items-center bg-white p-2 rounded border border-yellow-200">
                <div>
                  <span className="font-medium text-sm">{alert.guaranteeReference}</span>
                  <span className="text-gray-500 mx-2">-</span>
                  <span className="text-sm text-yellow-700">{alert.message}</span>
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.guaranteeId, alert._id)}
                  className="text-xs text-yellow-600 hover:text-yellow-800"
                >
                  Reconocer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Garantias Activas</p>
                <p className="text-2xl font-bold text-green-900">{stats.active}</p>
              </div>
              <CheckCircleIcon className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Importe Total</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <BanknotesIcon className="h-10 w-10 text-blue-500" />
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Disponible</p>
                <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.availableAmount)}</p>
              </div>
              <ArrowTrendingUpIcon className="h-10 w-10 text-purple-500" />
            </div>
          </div>

          <div className="card bg-orange-50 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Consumido</p>
                <p className="text-2xl font-bold text-orange-900">{formatCurrency(stats.consumedAmount)}</p>
              </div>
              <ArrowTrendingDownIcon className="h-10 w-10 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {stats && (stats.lowBalance > 0 || stats.expiringIn30Days > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {stats.lowBalance > 0 && (
            <div className="card bg-red-50 border-red-200">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <span className="text-red-800 font-medium">{stats.lowBalance} garantias con saldo bajo</span>
              </div>
            </div>
          )}
          {stats.expiringIn30Days > 0 && (
            <div className="card bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-800 font-medium">{stats.expiringIn30Days} garantias expiran en 30 dias</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="input"
            >
              <option value="">Todos</option>
              {Object.entries(GUARANTEE_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadData} className="btn-secondary">
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Guarantees List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : guarantees.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay garantias registradas</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="btn-primary mt-4"
            >
              Crear primera garantia
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {guarantees.map((guarantee) => (
              <div key={guarantee._id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{guarantee.name}</h3>
                      {getTypeBadge(guarantee.type)}
                      {getStatusBadge(guarantee.status)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Referencia:</span>
                        <span className="ml-2 font-medium">{guarantee.reference}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">GRN:</span>
                        <span className="ml-2 font-mono">{guarantee.grn || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Vigencia:</span>
                        <span className="ml-2">
                          {new Date(guarantee.validFrom).toLocaleDateString('es-ES')} - {new Date(guarantee.validUntil).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 max-w-md">
                      {getAvailabilityBar(guarantee)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {guarantee.status === 'draft' && (
                      <button
                        onClick={() => handleActivate(guarantee._id)}
                        className="btn-primary text-sm"
                      >
                        Activar
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedGuarantee(guarantee)}
                      className="btn-secondary text-sm"
                    >
                      Ver detalles
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Guarantee Modal */}
      {showNewForm && (
        <GuaranteeForm
          onClose={() => setShowNewForm(false)}
          onCreated={() => {
            setShowNewForm(false)
            loadData()
          }}
        />
      )}

      {/* Calculator Modal */}
      {showCalculator && (
        <GuaranteeCalculator onClose={() => setShowCalculator(false)} />
      )}

      {/* Detail Modal */}
      {selectedGuarantee && (
        <GuaranteeDetail
          guarantee={selectedGuarantee}
          onClose={() => setSelectedGuarantee(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  )
}

// Formulario de nueva garantia
function GuaranteeForm({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'CGU',
    usage: 'general',
    totalAmount: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    guarantor: {
      type: 'bank',
      name: '',
      policyNumber: ''
    },
    alertThresholds: {
      lowBalancePercent: 20,
      expiryWarningDays: 30
    }
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await guaranteesAPI.create({
        ...formData,
        totalAmount: parseFloat(formData.totalAmount)
      })

      if (response.data.success) {
        toast.success(`Garantia ${response.data.data.reference} creada`)
        onCreated()
      }
    } catch (error) {
      toast.error('Error al crear garantia')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Nueva Garantia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Ej: Garantia Global 2024"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input"
              >
                {Object.entries(GUARANTEE_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Uso Principal</label>
              <select
                value={formData.usage}
                onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                className="input"
              >
                {USAGE_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Importe Total (EUR) *</label>
            <input
              type="number"
              required
              min="100"
              step="0.01"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
              className="input"
              placeholder="100000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valida Desde *</label>
              <input
                type="date"
                required
                value={formData.validFrom}
                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valida Hasta *</label>
              <input
                type="date"
                required
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* Garante */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Datos del Garante</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Garante</label>
                <select
                  value={formData.guarantor.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    guarantor: { ...formData.guarantor, type: e.target.value }
                  })}
                  className="input"
                >
                  <option value="bank">Banco</option>
                  <option value="insurance">Aseguradora</option>
                  <option value="self">Propio</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.guarantor.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    guarantor: { ...formData.guarantor, name: e.target.value }
                  })}
                  className="input"
                  placeholder="Nombre del banco o aseguradora"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Numero de Poliza/Aval</label>
                <input
                  type="text"
                  value={formData.guarantor.policyNumber}
                  onChange={(e) => setFormData({
                    ...formData,
                    guarantor: { ...formData.guarantor, policyNumber: e.target.value }
                  })}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Configuracion de Alertas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Alertar si disponible bajo (%)</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={formData.alertThresholds.lowBalancePercent}
                  onChange={(e) => setFormData({
                    ...formData,
                    alertThresholds: { ...formData.alertThresholds, lowBalancePercent: parseInt(e.target.value) }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alertar antes de vencimiento (dias)</label>
                <input
                  type="number"
                  min="7"
                  max="90"
                  value={formData.alertThresholds.expiryWarningDays}
                  onChange={(e) => setFormData({
                    ...formData,
                    alertThresholds: { ...formData.alertThresholds, expiryWarningDays: parseInt(e.target.value) }
                  })}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creando...' : 'Crear Garantia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Calculadora de garantia requerida
function GuaranteeCalculator({ onClose }) {
  const [params, setParams] = useState({
    regime: 'transit',
    subType: 'T1',
    customsValue: '',
    dutyAmount: '',
    vatAmount: '',
    duration: 1,
    oeaStatus: ''
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const regimeOptions = {
    transit: ['T1', 'T2', 'TIR'],
    customs_warehouse: ['public', 'private', 'type_A', 'type_B'],
    temporary_import: ['partial_relief', 'total_relief'],
    inward_processing: ['suspension', 'drawback'],
    duty_deferment: ['monthly']
  }

  const handleCalculate = async () => {
    setLoading(true)
    try {
      const response = await guaranteesAPI.calculate({
        ...params,
        customsValue: parseFloat(params.customsValue) || 0,
        dutyAmount: parseFloat(params.dutyAmount) || 0,
        vatAmount: parseFloat(params.vatAmount) || 0,
        duration: parseInt(params.duration) || 1
      })

      if (response.data.success) {
        setResult(response.data.data)
      }
    } catch (error) {
      toast.error('Error al calcular')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Calculadora de Garantia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Regimen</label>
              <select
                value={params.regime}
                onChange={(e) => setParams({
                  ...params,
                  regime: e.target.value,
                  subType: regimeOptions[e.target.value]?.[0] || ''
                })}
                className="input"
              >
                <option value="transit">Transito</option>
                <option value="customs_warehouse">Deposito Aduanero</option>
                <option value="temporary_import">Importacion Temporal</option>
                <option value="inward_processing">Perfeccionamiento Activo</option>
                <option value="duty_deferment">Pago Diferido</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subtipo</label>
              <select
                value={params.subType}
                onChange={(e) => setParams({ ...params, subType: e.target.value })}
                className="input"
              >
                {regimeOptions[params.regime]?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Aranceles (EUR)</label>
              <input
                type="number"
                min="0"
                value={params.dutyAmount}
                onChange={(e) => setParams({ ...params, dutyAmount: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IVA (EUR)</label>
              <input
                type="number"
                min="0"
                value={params.vatAmount}
                onChange={(e) => setParams({ ...params, vatAmount: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {params.regime === 'temporary_import' && (
            <div>
              <label className="block text-sm font-medium mb-1">Duracion (meses)</label>
              <input
                type="number"
                min="1"
                max="24"
                value={params.duration}
                onChange={(e) => setParams({ ...params, duration: e.target.value })}
                className="input"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Estado OEA (opcional)</label>
            <select
              value={params.oeaStatus}
              onChange={(e) => setParams({ ...params, oeaStatus: e.target.value })}
              className="input"
            >
              <option value="">Sin OEA</option>
              <option value="AEOC">OEA-C (Simplificaciones)</option>
              <option value="AEOF">OEA-F (Full)</option>
              <option value="AEOS">OEA-S (Seguridad)</option>
              <option value="AEOCF">OEA Combinado</option>
            </select>
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Calculando...' : 'Calcular Garantia Requerida'}
          </button>

          {result && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Resultado</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base de calculo:</span>
                  <span className="font-medium">{result.baseAmount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                {result.oeaReduction > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Reduccion OEA ({result.oeaStatus}):</span>
                    <span>-{result.oeaReduction?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Garantia Requerida:</span>
                  <span className="text-blue-700">{result.finalAmount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                <p className="text-xs text-gray-600 mt-2">{result.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Detalle de garantia
function GuaranteeDetail({ guarantee, onClose, onUpdated }) {
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(true)

  useEffect(() => {
    loadMovements()
  }, [guarantee._id])

  const loadMovements = async () => {
    try {
      const response = await guaranteesAPI.getMovements(guarantee._id)
      if (response.data.success) {
        setMovements(response.data.data)
      }
    } catch (error) {
      console.error('Error loading movements:', error)
    } finally {
      setLoadingMovements(false)
    }
  }

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{guarantee.name}</h2>
            <p className="text-gray-500">{guarantee.reference}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info general */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500 text-sm">Tipo:</span>
              <p className="font-medium">{GUARANTEE_TYPES[guarantee.type]?.label}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">GRN:</span>
              <p className="font-mono">{guarantee.grn || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Vigencia:</span>
              <p>{new Date(guarantee.validFrom).toLocaleDateString('es-ES')} - {new Date(guarantee.validUntil).toLocaleDateString('es-ES')}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Uso:</span>
              <p>{USAGE_TYPES.find(u => u.value === guarantee.usage)?.label || guarantee.usage}</p>
            </div>
          </div>

          {/* Importes */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-3">Importes</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-gray-500 text-sm">Total</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(guarantee.totalAmount)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Consumido</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(guarantee.consumedAmount)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Disponible</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(guarantee.availableAmount)}</p>
              </div>
            </div>
          </div>

          {/* Movimientos */}
          <div>
            <h3 className="font-medium mb-3">Movimientos Recientes</h3>
            {loadingMovements ? (
              <p className="text-gray-500 text-center py-4">Cargando...</p>
            ) : movements.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Sin movimientos</p>
            ) : (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {movements.map((mov, idx) => (
                  <div key={idx} className="px-4 py-2 flex justify-between items-center text-sm">
                    <div>
                      <span className={mov.type === 'consumption' ? 'text-red-600' : 'text-green-600'}>
                        {mov.type === 'consumption' ? 'Consumo' : mov.type === 'release' ? 'Liberacion' : mov.type}
                      </span>
                      {mov.description && <span className="text-gray-500 ml-2">- {mov.description}</span>}
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${mov.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {mov.amount > 0 ? '+' : ''}{formatCurrency(mov.amount)}
                      </span>
                      <p className="text-xs text-gray-400">{new Date(mov.createdAt).toLocaleString('es-ES')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
