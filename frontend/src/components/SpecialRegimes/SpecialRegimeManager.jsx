import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { specialRegimesAPI, guaranteesAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  ArrowPathIcon,
  FunnelIcon,
  CubeTransparentIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  CogIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

// Configuracion de tipos de regimen
const REGIME_CONFIG = {
  '51': {
    code: '51',
    name: 'Perfeccionamiento Activo',
    shortName: 'IP',
    description: 'Transformacion de mercancias importadas para reexportacion',
    color: 'blue',
    icon: CogIcon,
    maxDuration: '36 meses',
    examples: ['Ensamblaje', 'Reparacion', 'Transformacion']
  },
  '53': {
    code: '53',
    name: 'Importacion Temporal',
    shortName: 'TA',
    description: 'Uso temporal de mercancias con obligacion de reexportacion',
    color: 'purple',
    icon: ClockIcon,
    maxDuration: '24 meses',
    examples: ['Ferias', 'Equipos profesionales', 'Muestras']
  },
  '71': {
    code: '71',
    name: 'Deposito Aduanero',
    shortName: 'CW',
    description: 'Almacenamiento de mercancias sin pago de derechos',
    color: 'amber',
    icon: BuildingStorefrontIcon,
    maxDuration: 'Ilimitado',
    examples: ['Stock de seguridad', 'Distribucion', 'Manipulacion']
  },
  'T1': {
    code: 'T1',
    name: 'Transito Externo',
    shortName: 'T1',
    description: 'Movimiento de mercancias no comunitarias',
    color: 'green',
    icon: TruckIcon,
    maxDuration: 'Segun ruta',
    examples: ['Importacion indirecta', 'Transito internacional']
  },
  'T2': {
    code: 'T2',
    name: 'Transito Interno',
    shortName: 'T2',
    description: 'Movimiento de mercancias comunitarias por terceros paises',
    color: 'teal',
    icon: TruckIcon,
    maxDuration: 'Segun ruta',
    examples: ['Envios a Canarias', 'Paso por Suiza']
  }
}

// Estados del regimen
const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'gray', icon: DocumentTextIcon },
  pending: { label: 'Pendiente', color: 'yellow', icon: ClockIcon },
  authorized: { label: 'Autorizado', color: 'blue', icon: CheckCircleIcon },
  active: { label: 'Activo', color: 'green', icon: CheckCircleIcon },
  suspended: { label: 'Suspendido', color: 'orange', icon: ExclamationTriangleIcon },
  discharged: { label: 'Ultimado', color: 'gray', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelado', color: 'red', icon: XMarkIcon },
  expired: { label: 'Vencido', color: 'red', icon: ExclamationTriangleIcon }
}

export default function SpecialRegimeManager() {
  const [stats, setStats] = useState(null)
  const [regimes, setRegimes] = useState([])
  const [expiring, setExpiring] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ regimeCode: '', status: '' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [guarantees, setGuarantees] = useState([])

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      setLoading(true)
      const [statsRes, regimesRes, expiringRes, guaranteesRes] = await Promise.all([
        specialRegimesAPI.getStats(filters),
        specialRegimesAPI.list(filters),
        specialRegimesAPI.getExpiring(30),
        guaranteesAPI.list({ status: 'active' })
      ])

      setStats(statsRes.data?.data || statsRes.data)
      setRegimes(regimesRes.data?.data?.regimes || [])
      setExpiring(expiringRes.data?.data || [])
      setGuarantees(guaranteesRes.data?.data?.guarantees || [])
    } catch (error) {
      console.error('Error loading special regimes:', error)
      toast.error('Error al cargar regimenes especiales')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRegime = async (data) => {
    try {
      await specialRegimesAPI.create(data)
      toast.success('Regimen creado correctamente')
      setShowCreateModal(false)
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear regimen')
    }
  }

  const handleAuthorize = async (id) => {
    try {
      await specialRegimesAPI.authorize(id, {})
      toast.success('Regimen autorizado')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al autorizar')
    }
  }

  const handleActivate = async (id) => {
    try {
      await specialRegimesAPI.activate(id)
      toast.success('Regimen activado')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al activar')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regimenes Especiales</h1>
          <p className="text-gray-600">Gestion de regimenes aduaneros especiales (CAU Art. 210-262)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Actualizar"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Nuevo Regimen
          </button>
        </div>
      </div>

      {/* Stats Cards por Tipo de Regimen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(REGIME_CONFIG).map(([code, config]) => {
          const regimeStats = stats?.byRegime?.[code] || { count: 0, suspendedDuties: 0 }
          const Icon = config.icon
          const isSelected = filters.regimeCode === code

          return (
            <button
              key={code}
              onClick={() => setFilters(f => ({
                ...f,
                regimeCode: isSelected ? '' : code
              }))}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? `border-${config.color}-300 bg-${config.color}-50 ring-2 ring-${config.color}-200`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-full bg-${config.color}-100 flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 text-${config.color}-600`} />
                </div>
                <span className="text-2xl font-bold text-gray-900">{regimeStats.count}</span>
              </div>
              <p className={`font-medium text-${config.color}-700`}>{config.shortName}</p>
              <p className="text-xs text-gray-500 truncate">{config.name}</p>
            </button>
          )
        })}
      </div>

      {/* Alertas de Regimenes por Expirar */}
      {expiring.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            <h3 className="font-medium text-amber-800">
              {expiring.length} regimen(es) por vencer en los proximos 30 dias
            </h3>
          </div>
          <div className="space-y-2">
            {expiring.slice(0, 3).map(regime => {
              const config = REGIME_CONFIG[regime.regimeCode]
              const daysLeft = Math.ceil((new Date(regime.deadlineDate) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={regime._id} className="flex items-center justify-between bg-white p-3 rounded border">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded bg-${config?.color}-100 text-${config?.color}-700`}>
                      {regime.regimeCode}
                    </span>
                    <span className="font-medium">{regime.reference}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${daysLeft <= 7 ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                      {daysLeft} dias restantes
                    </span>
                    <Link
                      to={`/special-regimes/${regime._id}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Ver detalle
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Resumen de Estados y Totales */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CubeTransparentIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Regimenes</p>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">{stats?.byStatus?.active || 0} activos</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ultimados</p>
              <p className="text-2xl font-bold">{stats?.byStatus?.discharged || 0}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Completados correctamente</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <BanknotesIcon className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Derechos Suspendidos</p>
              <p className="text-2xl font-bold">
                {(stats?.totals?.suspendedDuties || 0).toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR'
                })}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">En regimenes activos</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Por Vencer</p>
              <p className="text-2xl font-bold text-amber-600">{stats?.alerts?.expiringSoon || 0}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Proximos 30 dias</p>
        </div>
      </div>

      {/* Filtros y Lista */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <span className="font-medium">Regimenes</span>
            </div>

            {/* Filtro por Estado */}
            <select
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="pending">Pendiente</option>
              <option value="authorized">Autorizado</option>
              <option value="active">Activo</option>
              <option value="discharged">Ultimado</option>
            </select>
          </div>

          {(filters.regimeCode || filters.status) && (
            <button
              onClick={() => setFilters({ regimeCode: '', status: '' })}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla de Regimenes */}
        {regimes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CubeTransparentIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay regimenes especiales</p>
            <p className="text-sm">Crea un nuevo regimen para gestionar operaciones bajo regimenes especiales</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Titular</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Derechos Susp.</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {regimes.map(regime => {
                  const regimeConfig = REGIME_CONFIG[regime.regimeCode]
                  const statusConfig = STATUS_CONFIG[regime.status]
                  const StatusIcon = statusConfig?.icon || DocumentTextIcon
                  const daysLeft = regime.deadlineDate
                    ? Math.ceil((new Date(regime.deadlineDate) - new Date()) / (1000 * 60 * 60 * 24))
                    : null

                  return (
                    <tr key={regime._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/special-regimes/${regime._id}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {regime.reference}
                        </Link>
                        {regime.authorization?.number && (
                          <p className="text-xs text-gray-500">Auth: {regime.authorization.number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${regimeConfig?.color}-100 text-${regimeConfig?.color}-700`}>
                          {regime.regimeCode}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{regimeConfig?.name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {regime.holder?.name || regime.declarant?.name || '-'}
                        {regime.holder?.eori && (
                          <p className="text-xs text-gray-500">{regime.holder.eori}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-${statusConfig?.color}-100 text-${statusConfig?.color}-700`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusConfig?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {(regime.totals?.totalGuaranteed || 0).toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {regime.deadlineDate ? (
                          <>
                            <span className={daysLeft <= 30 ? 'text-amber-600' : ''}>
                              {new Date(regime.deadlineDate).toLocaleDateString('es-ES')}
                            </span>
                            {daysLeft !== null && regime.status === 'active' && (
                              <p className={`text-xs ${daysLeft <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                                {daysLeft > 0 ? `${daysLeft} dias` : 'Vencido'}
                              </p>
                            )}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {regime.status === 'draft' && (
                            <button
                              onClick={() => handleAuthorize(regime._id)}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Autorizar
                            </button>
                          )}
                          {regime.status === 'authorized' && (
                            <button
                              onClick={() => handleActivate(regime._id)}
                              className="text-xs text-green-600 hover:text-green-700"
                            >
                              Activar
                            </button>
                          )}
                          <Link
                            to={`/special-regimes/${regime._id}`}
                            className="text-xs text-gray-600 hover:text-gray-700"
                          >
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leyenda de Regimenes */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-700 mb-3">Tipos de Regimenes Especiales (CAU)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {Object.entries(REGIME_CONFIG).map(([code, config]) => {
            const Icon = config.icon
            return (
              <div key={code} className="flex items-start gap-3 bg-white p-3 rounded border">
                <div className={`p-2 bg-${config.color}-100 rounded`}>
                  <Icon className={`h-5 w-5 text-${config.color}-600`} />
                </div>
                <div>
                  <p className={`font-medium text-${config.color}-700`}>
                    {code} - {config.name}
                  </p>
                  <p className="text-xs text-gray-600">{config.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Duracion max: {config.maxDuration}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de Creacion */}
      {showCreateModal && (
        <CreateRegimeModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRegime}
          guarantees={guarantees}
        />
      )}
    </div>
  )
}

// Modal de Creacion de Regimen
function CreateRegimeModal({ onClose, onCreate, guarantees }) {
  const [formData, setFormData] = useState({
    regimeCode: '51',
    regimeType: 'inward_processing',
    declarant: { name: '', eori: '' },
    holder: { name: '', eori: '' },
    entryCustomsOffice: { code: '', name: '' },
    durationMonths: 12,
    goods: [{
      description: '',
      taricCode: '',
      quantity: 1,
      netWeight: 0,
      customsValue: 0
    }]
  })
  const [loading, setLoading] = useState(false)

  const regimeTypeMap = {
    '51': 'inward_processing',
    '53': 'temporary_admission',
    '71': 'customs_warehouse',
    'T1': 'external_transit',
    'T2': 'internal_transit'
  }

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'regimeCode') {
        updated.regimeType = regimeTypeMap[value] || 'inward_processing'
      }
      return updated
    })
  }

  const handleGoodChange = (index, field, value) => {
    setFormData(prev => {
      const goods = [...prev.goods]
      goods[index] = { ...goods[index], [field]: value }
      return { ...prev, goods }
    })
  }

  const addGood = () => {
    setFormData(prev => ({
      ...prev,
      goods: [...prev.goods, {
        description: '',
        taricCode: '',
        quantity: 1,
        netWeight: 0,
        customsValue: 0
      }]
    }))
  }

  const removeGood = (index) => {
    setFormData(prev => ({
      ...prev,
      goods: prev.goods.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onCreate(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo Regimen Especial</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tipo de Regimen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Regimen
            </label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(REGIME_CONFIG).map(([code, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleChange('regimeCode', code)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      formData.regimeCode === code
                        ? `border-${config.color}-300 bg-${config.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-1 text-${config.color}-600`} />
                    <p className="text-sm font-medium">{code}</p>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {REGIME_CONFIG[formData.regimeCode]?.name}: {REGIME_CONFIG[formData.regimeCode]?.description}
            </p>
          </div>

          {/* Datos del Declarante */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Declarante
              </label>
              <input
                type="text"
                value={formData.declarant.name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  declarant: { ...prev.declarant, name: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EORI del Declarante
              </label>
              <input
                type="text"
                value={formData.declarant.eori}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  declarant: { ...prev.declarant, eori: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="ES12345678X"
              />
            </div>
          </div>

          {/* Aduana de Entrada */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo Aduana Entrada
              </label>
              <input
                type="text"
                value={formData.entryCustomsOffice.code}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  entryCustomsOffice: { ...prev.entryCustomsOffice, code: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="ES004601"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duracion (meses)
              </label>
              <input
                type="number"
                value={formData.durationMonths}
                onChange={(e) => handleChange('durationMonths', parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2"
                min="1"
                max="36"
              />
            </div>
          </div>

          {/* Mercancias */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Mercancias
              </label>
              <button
                type="button"
                onClick={addGood}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Anadir mercancia
              </button>
            </div>
            <div className="space-y-3">
              {formData.goods.map((good, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={good.description}
                        onChange={(e) => handleGoodChange(index, 'description', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Descripcion"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={good.taricCode}
                        onChange={(e) => handleGoodChange(index, 'taricCode', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Cod. TARIC"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={good.customsValue}
                        onChange={(e) => handleGoodChange(index, 'customsValue', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Valor EUR"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={good.netWeight}
                        onChange={(e) => handleGoodChange(index, 'netWeight', parseFloat(e.target.value))}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Peso kg"
                        min="0"
                        step="0.01"
                      />
                      {formData.goods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGood(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Creando...' : 'Crear Regimen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
