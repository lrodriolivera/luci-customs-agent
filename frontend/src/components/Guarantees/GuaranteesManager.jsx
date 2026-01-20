import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { guaranteesAPI } from '../../services/api'
import {
  BanknotesIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  BuildingLibraryIcon
} from '@heroicons/react/24/outline'

export default function GuaranteesManager() {
  const [guarantees, setGuarantees] = useState([])
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')

  // Form state
  const [formData, setFormData] = useState({
    type: 'CGU',
    guarantorName: '',
    guarantorNif: '',
    amount: '',
    currency: 'EUR',
    grn: '',
    expirationDate: '',
    notes: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const [guaranteesRes, statsRes, alertsRes] = await Promise.all([
        guaranteesAPI.list(params),
        guaranteesAPI.getStats(),
        guaranteesAPI.getAlerts()
      ])

      setGuarantees(guaranteesRes.data.data?.guarantees || guaranteesRes.data.data || [])
      setStats(statsRes.data.data)
      setAlerts(alertsRes.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar garantias')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await guaranteesAPI.create({
        ...formData,
        amount: parseFloat(formData.amount)
      })
      setShowCreateForm(false)
      setFormData({
        type: 'CGU',
        guarantorName: '',
        guarantorNif: '',
        amount: '',
        currency: 'EUR',
        grn: '',
        expirationDate: '',
        notes: ''
      })
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear garantia')
    } finally {
      setCreating(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
      active: { label: 'Activa', class: 'bg-green-100 text-green-800' },
      suspended: { label: 'Suspendida', class: 'bg-orange-100 text-orange-800' },
      expired: { label: 'Vencida', class: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelada', class: 'bg-gray-100 text-gray-800' }
    }
    const config = statusMap[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
    return <span className={`badge ${config.class}`}>{config.label}</span>
  }

  const getTypeBadge = (type) => {
    const typeMap = {
      CGU: { label: 'CGU', class: 'bg-blue-100 text-blue-800', desc: 'Garantia Global Unica' },
      deposit: { label: 'Deposito', class: 'bg-purple-100 text-purple-800', desc: 'Deposito en efectivo' },
      bank_guarantee: { label: 'Aval', class: 'bg-indigo-100 text-indigo-800', desc: 'Aval bancario' },
      insurance: { label: 'Seguro', class: 'bg-cyan-100 text-cyan-800', desc: 'Seguro de caucion' }
    }
    const config = typeMap[type] || { label: type, class: 'bg-gray-100 text-gray-800', desc: '' }
    return (
      <span className={`badge ${config.class}`} title={config.desc}>
        {config.label}
      </span>
    )
  }

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency
    }).format(amount || 0)
  }

  const calculateUsagePercent = (guarantee) => {
    if (!guarantee.amount) return 0
    const used = guarantee.amount - (guarantee.balance?.available || 0)
    return Math.round((used / guarantee.amount) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <BanknotesIcon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Garantias Aduaneras</h1>
            <p className="text-sm text-gray-500">CGU, avales bancarios y depositos</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Garantia
        </button>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="card border-l-4 border-l-yellow-500 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            Alertas de Garantias ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert, index) => (
              <div key={index} className="text-sm text-yellow-700">
                {alert.message || alert.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estadisticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Garantias Activas</p>
            <p className="text-2xl font-bold text-gray-900">{stats.active || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Importe Total</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalAmount)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Disponible</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.availableAmount)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Utilizado</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency((stats.totalAmount || 0) - (stats.availableAmount || 0))}
            </p>
          </div>
        </div>
      )}

      {/* Formulario de creacion */}
      {showCreateForm && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Nueva Garantia</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Garantia
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="CGU">CGU - Garantia Global Unica</option>
                  <option value="bank_guarantee">Aval Bancario</option>
                  <option value="deposit">Deposito en Efectivo</option>
                  <option value="insurance">Seguro de Caucion</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importe
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="10000"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="input"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entidad Garante
                </label>
                <input
                  type="text"
                  name="guarantorName"
                  value={formData.guarantorName}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Banco Santander"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIF Garante
                </label>
                <input
                  type="text"
                  name="guarantorNif"
                  value={formData.guarantorNif}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="A28000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GRN (si aplica)
                </label>
                <input
                  type="text"
                  name="grn"
                  value={formData.grn}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="26ESxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Vencimiento
                </label>
                <input
                  type="date"
                  name="expirationDate"
                  value={formData.expirationDate}
                  onChange={handleInputChange}
                  className="input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="btn-primary flex items-center gap-2"
              >
                {creating ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5" />
                )}
                Crear Garantia
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {['all', 'active', 'pending', 'expired'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-luci text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : f === 'pending' ? 'Pendientes' : 'Vencidas'}
          </button>
        ))}
      </div>

      {/* Lista de garantias */}
      <div className="space-y-4">
        {guarantees.length === 0 ? (
          <div className="card text-center py-12">
            <BanknotesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay garantias registradas</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary mt-4"
            >
              Crear Primera Garantia
            </button>
          </div>
        ) : (
          guarantees.map((guarantee) => {
            const usagePercent = calculateUsagePercent(guarantee)
            const isExpanded = expandedId === guarantee._id

            return (
              <div key={guarantee._id} className="card">
                {/* Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : guarantee._id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <BuildingLibraryIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {guarantee.guaranteeNumber}
                        </p>
                        {getTypeBadge(guarantee.type)}
                        {getStatusBadge(guarantee.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {guarantee.guarantor?.name || 'Sin garante'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Disponible / Total</p>
                      <p className="font-semibold">
                        <span className="text-green-600">
                          {formatCurrency(guarantee.balance?.available)}
                        </span>
                        <span className="text-gray-400"> / </span>
                        <span className="text-gray-900">
                          {formatCurrency(guarantee.amount)}
                        </span>
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Barra de uso */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Uso: {usagePercent}%</span>
                    <span>
                      {formatCurrency(guarantee.amount - (guarantee.balance?.available || 0))} utilizado
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usagePercent > 80 ? 'bg-red-500' :
                        usagePercent > 50 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* Detalles expandidos */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">GRN</p>
                        <p className="font-mono text-sm">{guarantee.grn || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">NIF Garante</p>
                        <p className="font-mono text-sm">{guarantee.guarantor?.nif || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fecha Activacion</p>
                        <p className="text-sm">
                          {guarantee.activationDate
                            ? new Date(guarantee.activationDate).toLocaleDateString('es-ES')
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Vencimiento</p>
                        <p className={`text-sm font-medium ${
                          guarantee.expirationDate && new Date(guarantee.expirationDate) < new Date()
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}>
                          {guarantee.expirationDate
                            ? new Date(guarantee.expirationDate).toLocaleDateString('es-ES')
                            : 'Sin fecha'}
                        </p>
                      </div>
                    </div>

                    {/* Expedientes vinculados */}
                    {guarantee.linkedExpeditions && guarantee.linkedExpeditions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Expedientes Vinculados ({guarantee.linkedExpeditions.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {guarantee.linkedExpeditions.slice(0, 5).map((exp, index) => (
                            <Link
                              key={index}
                              to={`/expeditions/${exp.expeditionId}`}
                              className="badge bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                              {exp.expeditionNumber || exp.expeditionId}
                            </Link>
                          ))}
                          {guarantee.linkedExpeditions.length > 5 && (
                            <span className="badge bg-gray-100 text-gray-600">
                              +{guarantee.linkedExpeditions.length - 5} mas
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-2 pt-2">
                      <button className="btn-secondary text-sm">
                        <DocumentTextIcon className="w-4 h-4 mr-1" />
                        Ver Movimientos
                      </button>
                      {guarantee.status === 'active' && (
                        <>
                          <button className="btn-secondary text-sm">
                            <CalendarDaysIcon className="w-4 h-4 mr-1" />
                            Renovar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
