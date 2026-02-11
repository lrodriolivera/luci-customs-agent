import React, { useState, useEffect } from 'react'
import { oeaAPI } from '../../services/api'
import {
  ShieldCheckIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  StarIcon,
  XCircleIcon,
  PauseIcon,
  PlayIcon
} from '@heroicons/react/24/outline'

const OEA_TYPES = {
  OEAC: { label: 'OEAC', desc: 'Simplificaciones Aduaneras', color: 'blue' },
  OEAS: { label: 'OEAS', desc: 'Seguridad y Proteccion', color: 'green' },
  OEAF: { label: 'OEAF', desc: 'Completo (OEAC + OEAS)', color: 'purple' }
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
  under_review: { label: 'En Revision', class: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Aprobado', class: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspendido', class: 'bg-orange-100 text-orange-800' },
  revoked: { label: 'Revocado', class: 'bg-red-100 text-red-800' },
  expired: { label: 'Expirado', class: 'bg-gray-100 text-gray-800' },
  renewal_pending: { label: 'Renovacion Pendiente', class: 'bg-indigo-100 text-indigo-800' },
  reevaluation: { label: 'En Reevaluacion', class: 'bg-purple-100 text-purple-800' },
  incident: { label: 'Con Incidencias', class: 'bg-pink-100 text-pink-800' }
}

export default function OEAManager() {
  const [oeas, setOeas] = useState([])
  const [stats, setStats] = useState(null)
  const [expiring, setExpiring] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('list')
  const [benefits, setBenefits] = useState([])
  const [simplifications, setSimplifications] = useState([])
  const [mutualRecognition, setMutualRecognition] = useState([])

  // Form state
  const [formData, setFormData] = useState({
    organizationName: '',
    nif: '',
    eori: '',
    certificationType: 'OEAC',
    street: '',
    city: '',
    postalCode: '',
    province: '',
    contactName: '',
    contactEmail: '',
    contactPhone: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchData()
    fetchCatalogs()
  }, [filter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const [oeasRes, statsRes, expiringRes] = await Promise.all([
        oeaAPI.list(params),
        oeaAPI.getStats(),
        oeaAPI.getExpiring(90)
      ])

      setOeas(oeasRes.data.data?.oeas || oeasRes.data.data || [])
      setStats(statsRes.data.data)
      setExpiring(expiringRes.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar certificaciones OEA')
    } finally {
      setLoading(false)
    }
  }

  const fetchCatalogs = async () => {
    try {
      const [benefitsRes, simplificationsRes, mutualRes] = await Promise.all([
        oeaAPI.getBenefitsCatalog(),
        oeaAPI.getSimplifications(),
        oeaAPI.getMutualRecognition()
      ])
      // Flatten benefits object into array
      const benefitsData = benefitsRes.data.data || {}
      const flatBenefits = Object.entries(benefitsData).flatMap(([type, items]) =>
        (Array.isArray(items) ? items : []).map(item => ({ ...item, oeaType: type }))
      )
      setBenefits(flatBenefits)
      setSimplifications(simplificationsRes.data.data || [])
      setMutualRecognition(mutualRes.data.data || [])
    } catch (err) {
      console.error('Error fetching catalogs:', err)
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
      await oeaAPI.create({
        organization: {
          name: formData.organizationName,
          nif: formData.nif,
          eori: formData.eori,
          address: {
            street: formData.street,
            city: formData.city,
            postalCode: formData.postalCode,
            province: formData.province,
            country: 'ES'
          },
          contact: {
            name: formData.contactName,
            email: formData.contactEmail,
            phone: formData.contactPhone
          }
        },
        certification: {
          type: formData.certificationType
        }
      })
      setShowCreateForm(false)
      setFormData({
        organizationName: '',
        nif: '',
        eori: '',
        certificationType: 'OEAC',
        street: '',
        city: '',
        postalCode: '',
        province: '',
        contactName: '',
        contactEmail: '',
        contactPhone: ''
      })
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear solicitud OEA')
    } finally {
      setCreating(false)
    }
  }

  const handleSubmitForReview = async (id) => {
    try {
      await oeaAPI.submitForReview(id)
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar para revision')
    }
  }

  const handleInitiateRenewal = async (id) => {
    try {
      await oeaAPI.initiateRenewal(id)
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar renovacion')
    }
  }

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
    return <span className={`badge ${config.class}`}>{config.label}</span>
  }

  const getTypeBadge = (type) => {
    const config = OEA_TYPES[type] || { label: type, desc: '', color: 'gray' }
    return (
      <span
        className={`badge bg-${config.color}-100 text-${config.color}-800`}
        title={config.desc}
      >
        {config.label}
      </span>
    )
  }

  const getComplianceBadge = (status) => {
    const config = {
      excellent: { label: 'Excelente', class: 'bg-green-100 text-green-800' },
      good: { label: 'Bueno', class: 'bg-blue-100 text-blue-800' },
      acceptable: { label: 'Aceptable', class: 'bg-yellow-100 text-yellow-800' },
      warning: { label: 'Alerta', class: 'bg-orange-100 text-orange-800' },
      critical: { label: 'Critico', class: 'bg-red-100 text-red-800' }
    }
    const conf = config[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
    return <span className={`badge ${conf.class}`}>{conf.label}</span>
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('es-ES')
  }

  const getDaysUntilExpiration = (expirationDate) => {
    if (!expirationDate) return null
    const now = new Date()
    const exp = new Date(expirationDate)
    const diffTime = exp - now
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
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
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Operador Economico Autorizado</h1>
            <p className="text-sm text-gray-500">Gestion de certificaciones OEA (OEAC/OEAS/OEAF)</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Solicitud
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {[
            { key: 'list', label: 'Certificaciones', icon: ShieldCheckIcon },
            { key: 'benefits', label: 'Beneficios', icon: StarIcon },
            { key: 'simplifications', label: 'Simplificaciones', icon: DocumentTextIcon },
            { key: 'mutual', label: 'Reconocimiento Mutuo', icon: GlobeAltIcon }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-luci text-luci'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Alertas de expiracion */}
      {expiring.length > 0 && activeTab === 'list' && (
        <div className="card border-l-4 border-l-yellow-500 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            Certificaciones Proximas a Vencer ({expiring.length})
          </h3>
          <div className="space-y-2">
            {expiring.slice(0, 3).map((oea, index) => {
              const days = getDaysUntilExpiration(oea.certification?.expirationDate)
              return (
                <div key={index} className="text-sm text-yellow-700 flex justify-between">
                  <span>{oea.organization?.name} - {oea.certification?.type}</span>
                  <span className="font-medium">{days} dias restantes</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Estadisticas */}
      {stats && activeTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Total OEA</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Aprobados</p>
            <p className="text-2xl font-bold text-green-600">{stats.byStatus?.approved || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">En Revision</p>
            <p className="text-2xl font-bold text-blue-600">{stats.byStatus?.under_review || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.byStatus?.pending || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Por Tipo</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                OEAC: {stats.byType?.OEAC || 0}
              </span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                OEAS: {stats.byType?.OEAS || 0}
              </span>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                OEAF: {stats.byType?.OEAF || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de creacion */}
      {showCreateForm && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Nueva Solicitud OEA</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Datos de organizacion */}
            <div className="border-b pb-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Datos de la Organizacion</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Empresa *
                  </label>
                  <input
                    type="text"
                    name="organizationName"
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="STRIX AI SL"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIF *
                  </label>
                  <input
                    type="text"
                    name="nif"
                    value={formData.nif}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="A12345678"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EORI *
                  </label>
                  <input
                    type="text"
                    name="eori"
                    value={formData.eori}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="ESA12345678000"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Tipo de certificacion */}
            <div className="border-b pb-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Tipo de Certificacion</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(OEA_TYPES).map(([key, config]) => (
                  <label
                    key={key}
                    className={`flex items-start p-4 border rounded-lg cursor-pointer ${
                      formData.certificationType === key
                        ? 'border-luci bg-luci/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="certificationType"
                      value={key}
                      checked={formData.certificationType === key}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">{config.label}</span>
                      <p className="text-sm text-gray-500">{config.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Direccion */}
            <div className="border-b pb-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Direccion</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Calle Principal 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Madrid"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">C.P.</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="28001"
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Persona de Contacto</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Juan Perez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="juan@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="text"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="+34 912345678"
                  />
                </div>
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
                Crear Solicitud
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

      {/* Content based on active tab */}
      {activeTab === 'list' && (
        <>
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'approved', 'under_review', 'pending', 'suspended', 'reevaluation', 'incident'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-luci text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'Todos' :
                 f === 'approved' ? 'Aprobados' :
                 f === 'under_review' ? 'En Revision' :
                 f === 'pending' ? 'Pendientes' :
                 f === 'suspended' ? 'Suspendidos' :
                 f === 'reevaluation' ? 'Reevaluacion' : 'Incidencias'}
              </button>
            ))}
          </div>

          {/* Lista de OEAs */}
          <div className="space-y-4">
            {oeas.length === 0 ? (
              <div className="card text-center py-12">
                <ShieldCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay certificaciones OEA registradas</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="btn-primary mt-4"
                >
                  Crear Primera Solicitud
                </button>
              </div>
            ) : (
              oeas.map((oea) => {
                const isExpanded = expandedId === oea._id
                const daysUntilExp = getDaysUntilExpiration(oea.certification?.expirationDate)

                return (
                  <div key={oea._id} className="card">
                    {/* Header */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : oea._id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">
                              {oea.organization?.name}
                            </p>
                            {getTypeBadge(oea.certification?.type)}
                            {getStatusBadge(oea.certification?.status)}
                            {oea.compliance?.currentStatus && getComplianceBadge(oea.compliance.currentStatus)}
                          </div>
                          <p className="text-sm text-gray-500">
                            EORI: {oea.organization?.eori} | NIF: {oea.organization?.nif}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {oea.certification?.number && (
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Numero OEA</p>
                            <p className="font-mono font-semibold text-gray-900">
                              {oea.certification.number}
                            </p>
                          </div>
                        )}
                        {daysUntilExp !== null && oea.certification?.status === 'approved' && (
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Vencimiento</p>
                            <p className={`font-semibold ${
                              daysUntilExp <= 30 ? 'text-red-600' :
                              daysUntilExp <= 90 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {daysUntilExp} dias
                            </p>
                          </div>
                        )}
                        {isExpanded ? (
                          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Detalles basicos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Fecha Solicitud</p>
                            <p className="text-sm font-medium">
                              {formatDate(oea.certification?.applicationDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Fecha Aprobacion</p>
                            <p className="text-sm font-medium">
                              {formatDate(oea.certification?.approvalDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Fecha Expiracion</p>
                            <p className="text-sm font-medium">
                              {formatDate(oea.certification?.expirationDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Reduccion Garantia</p>
                            <p className="text-sm font-medium">
                              {oea.guaranteeReduction?.level === 'exempt_100' ? '100%' :
                               oea.guaranteeReduction?.level === 'reduced_50' ? '50%' :
                               oea.guaranteeReduction?.level === 'reduced_30' ? '30%' : 'Sin reduccion'}
                            </p>
                          </div>
                        </div>

                        {/* Requisitos */}
                        {oea.requirements && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Estado de Requisitos
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              {Object.entries({
                                customsCompliance: 'Cumplimiento Aduanero',
                                recordKeeping: 'Registros',
                                financialSolvency: 'Solvencia',
                                practicalCompetence: 'Competencia',
                                securityStandards: 'Seguridad'
                              }).map(([key, label]) => {
                                const req = oea.requirements[key]
                                if (req?.status === 'not_applicable') return null
                                return (
                                  <div key={key} className="flex items-center gap-1">
                                    {req?.status === 'met' ? (
                                      <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                    ) : req?.status === 'partial' ? (
                                      <ClockIcon className="w-4 h-4 text-yellow-500" />
                                    ) : (
                                      <XCircleIcon className="w-4 h-4 text-red-500" />
                                    )}
                                    <span className="text-xs text-gray-600">{label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Beneficios activos */}
                        {oea.benefits && oea.benefits.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Beneficios Activos ({oea.benefits.filter(b => b.active).length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {oea.benefits.filter(b => b.active).slice(0, 6).map((benefit, idx) => (
                                <span
                                  key={idx}
                                  className="badge bg-green-100 text-green-800"
                                  title={benefit.description}
                                >
                                  {benefit.name}
                                </span>
                              ))}
                              {oea.benefits.filter(b => b.active).length > 6 && (
                                <span className="badge bg-gray-100 text-gray-600">
                                  +{oea.benefits.filter(b => b.active).length - 6} mas
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Simplificaciones concedidas */}
                        {oea.simplifications && oea.simplifications.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Simplificaciones ({oea.simplifications.filter(s => s.active).length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {oea.simplifications.filter(s => s.active).map((simp, idx) => (
                                <span
                                  key={idx}
                                  className="badge bg-blue-100 text-blue-800"
                                  title={simp.description}
                                >
                                  {simp.code}: {simp.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Auditorias recientes */}
                        {oea.audits && oea.audits.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Ultima Auditoria
                            </p>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex justify-between text-sm">
                                <span>{formatDate(oea.audits[oea.audits.length - 1].date)}</span>
                                <span className={`font-medium ${
                                  oea.audits[oea.audits.length - 1].result === 'passed'
                                    ? 'text-green-600'
                                    : oea.audits[oea.audits.length - 1].result === 'passed_with_conditions'
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }`}>
                                  {oea.audits[oea.audits.length - 1].result === 'passed' ? 'Superada' :
                                   oea.audits[oea.audits.length - 1].result === 'passed_with_conditions' ? 'Superada con condiciones' :
                                   oea.audits[oea.audits.length - 1].result === 'failed' ? 'No superada' : 'Pendiente'}
                                </span>
                              </div>
                              {oea.audits[oea.audits.length - 1].auditor?.name && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Auditor: {oea.audits[oea.audits.length - 1].auditor.name}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Acciones */}
                        <div className="flex gap-2 pt-2 flex-wrap">
                          {oea.certification?.status === 'pending' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSubmitForReview(oea._id); }}
                              className="btn-primary text-sm flex items-center gap-1"
                            >
                              <PlayIcon className="w-4 h-4" />
                              Enviar a Revision
                            </button>
                          )}
                          {oea.certification?.status === 'approved' && daysUntilExp !== null && daysUntilExp <= 180 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleInitiateRenewal(oea._id); }}
                              className="btn-primary text-sm flex items-center gap-1"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                              Iniciar Renovacion
                            </button>
                          )}
                          <button className="btn-secondary text-sm flex items-center gap-1">
                            <DocumentTextIcon className="w-4 h-4" />
                            Ver Historial
                          </button>
                          <button className="btn-secondary text-sm flex items-center gap-1">
                            <CalendarDaysIcon className="w-4 h-4" />
                            Programar Auditoria
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Benefits tab */}
      {activeTab === 'benefits' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(
            benefits.reduce((acc, b) => {
              const cat = b.category || 'other'
              if (!acc[cat]) acc[cat] = []
              acc[cat].push(b)
              return acc
            }, {})
          ).map(([category, items]) => (
            <div key={category} className="card">
              <h3 className="font-semibold text-gray-900 mb-3 capitalize">
                {category === 'guarantee' ? 'Garantias' :
                 category === 'simplification' ? 'Simplificaciones' :
                 category === 'control' ? 'Control' :
                 category === 'priority' ? 'Prioridad' :
                 category === 'mutual_recognition' ? 'Reconocimiento Mutuo' : category}
              </h3>
              <div className="space-y-2">
                {items.map((benefit, idx) => (
                  <div key={idx} className="p-2 bg-gray-50 rounded-lg">
                    <p className="font-medium text-sm text-gray-900">{benefit.name}</p>
                    <p className="text-xs text-gray-500">{benefit.description}</p>
                    <div className="flex gap-1 mt-1">
                      {benefit.types?.map(t => (
                        <span key={t} className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simplifications tab */}
      {activeTab === 'simplifications' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {simplifications.map((simp, idx) => (
            <div key={idx} className="card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-blue-600">{simp.code}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{simp.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{simp.description}</p>
                  <div className="flex gap-1 mt-2">
                    {simp.applicableTo?.map(t => (
                      <span key={t} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                  {simp.requirements && simp.requirements.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-600">Requisitos:</p>
                      <ul className="text-xs text-gray-500 list-disc list-inside">
                        {simp.requirements.slice(0, 3).map((req, ridx) => (
                          <li key={ridx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mutual Recognition tab */}
      {activeTab === 'mutual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mutualRecognition.map((partner, idx) => (
            <div key={idx} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-gray-600">{partner.countryCode}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{partner.country}</h3>
                  <p className="text-sm text-gray-500">{partner.programName}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-2">{partner.description}</p>
              {partner.benefits && partner.benefits.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Beneficios:</p>
                  <div className="flex flex-wrap gap-1">
                    {partner.benefits.map((b, bidx) => (
                      <span key={bidx} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Vigente desde: {formatDate(partner.effectiveDate)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
