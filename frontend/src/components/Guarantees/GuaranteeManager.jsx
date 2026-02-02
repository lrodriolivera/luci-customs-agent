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
  CalculatorIcon,
  SparklesIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CurrencyEuroIcon,
  ScaleIcon
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
  const [showAIPanel, setShowAIPanel] = useState(false)
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
            onClick={() => setShowAIPanel(true)}
            className="btn-secondary flex items-center gap-2 bg-gradient-to-r from-luci-light to-purple-50 border-luci/30 text-luci hover:bg-luci-light"
          >
            <SparklesIcon className="h-5 w-5" />
            Analisis IA
          </button>
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

      {/* AI Analysis Panel */}
      {showAIPanel && (
        <GuaranteeAIPanel
          guarantees={guarantees}
          stats={stats}
          onClose={() => setShowAIPanel(false)}
        />
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

// AI Analysis Panel Component
function GuaranteeAIPanel({ guarantees, stats, onClose }) {
  const [activeTab, setActiveTab] = useState('analyze')
  const [loading, setLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [optimizeResult, setOptimizeResult] = useState(null)
  const [recommendResult, setRecommendResult] = useState(null)

  // Form for analysis
  const [operationData, setOperationData] = useState({
    operationType: 'import',
    regime: '40',
    customsValue: '',
    dutyAmount: '',
    vatAmount: '',
    origin: '',
    goodsDescription: ''
  })

  const handleAnalyzeNeeds = async () => {
    if (!operationData.customsValue) {
      toast.error('Ingrese el valor de la operacion')
      return
    }

    setLoading(true)
    try {
      const response = await guaranteesAPI.aiAnalyzeNeeds({
        ...operationData,
        customsValue: parseFloat(operationData.customsValue),
        dutyAmount: parseFloat(operationData.dutyAmount) || 0,
        vatAmount: parseFloat(operationData.vatAmount) || 0,
        existingGuarantees: guarantees.filter(g => g.status === 'active')
      })

      if (response.data.success) {
        setAnalysisResult(response.data.data)
        toast.success('Analisis completado')
      }
    } catch (error) {
      toast.error('Error al analizar necesidades')
    } finally {
      setLoading(false)
    }
  }

  const handleRecommendType = async () => {
    setLoading(true)
    try {
      const response = await guaranteesAPI.aiRecommendType({
        operationProfile: {
          averageMonthlyOperations: 50,
          averageValue: parseFloat(operationData.customsValue) || 100000,
          mainRegimes: ['40', '42'],
          hasOEA: false
        },
        existingGuarantees: guarantees
      })

      if (response.data.success) {
        setRecommendResult(response.data.data)
        toast.success('Recomendacion generada')
      }
    } catch (error) {
      toast.error('Error al generar recomendacion')
    } finally {
      setLoading(false)
    }
  }

  const handleOptimize = async () => {
    setLoading(true)
    try {
      const response = await guaranteesAPI.aiOptimize({
        guarantees: guarantees,
        operationHistory: [],
        projectedOperations: []
      })

      if (response.data.success) {
        setOptimizeResult(response.data.data)
        toast.success('Optimizacion analizada')
      }
    } catch (error) {
      toast.error('Error al optimizar')
    } finally {
      setLoading(false)
    }
  }

  const handleFullAnalysis = async () => {
    setLoading(true)
    try {
      const response = await guaranteesAPI.aiFullAnalysis({
        operation: operationData,
        existingGuarantees: guarantees,
        operatorProfile: {}
      })

      if (response.data.success) {
        setAnalysisResult(response.data.data)
        toast.success('Analisis completo finalizado')
      }
    } catch (error) {
      toast.error('Error en analisis completo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-luci-light to-purple-50 border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-luci" />
            <h2 className="text-xl font-bold text-gray-900">Analisis IA de Garantias</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-4">
            {[
              { key: 'analyze', label: 'Analizar Necesidades', icon: ScaleIcon },
              { key: 'recommend', label: 'Recomendar Tipo', icon: LightBulbIcon },
              { key: 'optimize', label: 'Optimizar Uso', icon: ChartBarIcon }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-luci text-luci'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Analyze Needs Tab */}
          {activeTab === 'analyze' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Operacion</label>
                  <select
                    value={operationData.operationType}
                    onChange={(e) => setOperationData({ ...operationData, operationType: e.target.value })}
                    className="input"
                  >
                    <option value="import">Importacion</option>
                    <option value="export">Exportacion</option>
                    <option value="transit">Transito</option>
                    <option value="warehouse">Deposito Aduanero</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Regimen</label>
                  <select
                    value={operationData.regime}
                    onChange={(e) => setOperationData({ ...operationData, regime: e.target.value })}
                    className="input"
                  >
                    <option value="40">40 - Despacho a libre practica</option>
                    <option value="42">42 - Despacho a LP + exencion IVA</option>
                    <option value="51">51 - Perfeccionamiento activo</option>
                    <option value="53">53 - Importacion temporal</option>
                    <option value="71">71 - Deposito aduanero</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Aduanero (EUR) *</label>
                  <input
                    type="number"
                    value={operationData.customsValue}
                    onChange={(e) => setOperationData({ ...operationData, customsValue: e.target.value })}
                    className="input"
                    placeholder="100000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Aranceles Estimados (EUR)</label>
                  <input
                    type="number"
                    value={operationData.dutyAmount}
                    onChange={(e) => setOperationData({ ...operationData, dutyAmount: e.target.value })}
                    className="input"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">IVA Estimado (EUR)</label>
                  <input
                    type="number"
                    value={operationData.vatAmount}
                    onChange={(e) => setOperationData({ ...operationData, vatAmount: e.target.value })}
                    className="input"
                    placeholder="22050"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pais Origen</label>
                  <input
                    type="text"
                    value={operationData.origin}
                    onChange={(e) => setOperationData({ ...operationData, origin: e.target.value })}
                    className="input"
                    placeholder="CN"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAnalyzeNeeds}
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-5 w-5" />
                  )}
                  Analizar Necesidades
                </button>
                <button
                  onClick={handleFullAnalysis}
                  disabled={loading}
                  className="btn-secondary flex items-center gap-2"
                >
                  Analisis Completo
                </button>
              </div>

              {/* Analysis Result */}
              {analysisResult && (
                <div className="space-y-4 mt-6">
                  {/* Required Amount */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <CurrencyEuroIcon className="h-5 w-5" />
                      Garantia Requerida
                    </h3>
                    <div className="text-3xl font-bold text-blue-700">
                      {(analysisResult.requiredAmount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </div>
                    {analysisResult.existingCoverage && (
                      <div className="mt-3 text-sm">
                        <span className={analysisResult.existingCoverage.sufficient ? 'text-green-600' : 'text-red-600'}>
                          {analysisResult.existingCoverage.sufficient
                            ? '✓ Cobertura suficiente con garantias existentes'
                            : `✗ Deficit de ${(analysisResult.existingCoverage.shortfall || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Recommendation */}
                  {analysisResult.recommendation && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5" />
                        Recomendacion
                      </h4>
                      <p className="text-yellow-700">{analysisResult.recommendation}</p>
                    </div>
                  )}

                  {/* Optimizations */}
                  {analysisResult.optimizations?.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-medium text-green-800 mb-2">Optimizaciones Sugeridas</h4>
                      <ul className="space-y-2">
                        {analysisResult.optimizations.map((opt, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                            <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium">{opt.action}</span>
                              {opt.impact && <span className="text-green-600 ml-2">({opt.impact})</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risks */}
                  {analysisResult.risks?.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <h4 className="font-medium text-red-800 mb-2">Riesgos Identificados</h4>
                      <ul className="space-y-2">
                        {analysisResult.risks.map((risk, i) => (
                          <li key={i} className="text-sm text-red-700">
                            <span className="font-medium">{risk.description}</span>
                            {risk.mitigation && <p className="text-red-600 text-xs mt-1">Mitigacion: {risk.mitigation}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recommend Type Tab */}
          {activeTab === 'recommend' && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Basado en tu perfil de operaciones y garantias existentes, LUCI te recomienda el tipo de garantia mas adecuado.
              </p>

              <button
                onClick={handleRecommendType}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <SparklesIcon className="h-5 w-5" />
                )}
                Generar Recomendacion
              </button>

              {recommendResult && (
                <div className="space-y-4">
                  {/* Main Recommendation */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <h3 className="font-semibold text-purple-900 mb-2">Tipo Recomendado</h3>
                    <div className="text-2xl font-bold text-purple-700">
                      {GUARANTEE_TYPES[recommendResult.recommendedType]?.label || recommendResult.recommendedType}
                    </div>
                    {recommendResult.reasoning && (
                      <p className="mt-2 text-purple-600">{recommendResult.reasoning}</p>
                    )}
                  </div>

                  {/* Alternatives */}
                  {recommendResult.alternatives?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Alternativas</h4>
                      <div className="space-y-3">
                        {recommendResult.alternatives.map((alt, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-4 border">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium">{GUARANTEE_TYPES[alt.type]?.label || alt.type}</span>
                                {alt.estimatedCost && (
                                  <span className="text-gray-500 ml-2">~{alt.estimatedCost}</span>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-green-600 font-medium">Ventajas:</span>
                                <ul className="list-disc list-inside text-gray-600">
                                  {alt.pros?.map((p, j) => <li key={j}>{p}</li>)}
                                </ul>
                              </div>
                              <div>
                                <span className="text-red-600 font-medium">Desventajas:</span>
                                <ul className="list-disc list-inside text-gray-600">
                                  {alt.cons?.map((c, j) => <li key={j}>{c}</li>)}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Implementation Plan */}
                  {recommendResult.implementationPlan?.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-3">Plan de Implementacion</h4>
                      <ol className="space-y-2">
                        {recommendResult.implementationPlan.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-medium">
                              {i + 1}
                            </span>
                            <div className="text-sm">
                              <span className="font-medium text-blue-900">{step.action}</span>
                              {step.timeframe && <span className="text-blue-600 ml-2">({step.timeframe})</span>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Optimize Tab */}
          {activeTab === 'optimize' && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Analiza el uso actual de tus garantias y obtiene sugerencias para optimizar su utilizacion.
              </p>

              <button
                onClick={handleOptimize}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <SparklesIcon className="h-5 w-5" />
                )}
                Analizar Optimizaciones
              </button>

              {optimizeResult && (
                <div className="space-y-4">
                  {/* Current Status */}
                  {optimizeResult.currentStatus && (
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <h4 className="font-medium mb-3">Estado Actual</h4>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{optimizeResult.currentStatus.totalGuarantees || 0}</p>
                          <p className="text-xs text-gray-500">Garantias</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">
                            {(optimizeResult.currentStatus.totalAmount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-orange-600">
                            {(optimizeResult.currentStatus.totalUsed || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <p className="text-xs text-gray-500">Usado</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {(optimizeResult.currentStatus.totalAvailable || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <p className="text-xs text-gray-500">Disponible</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Utilization Analysis */}
                  {optimizeResult.utilizationAnalysis && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-2">Analisis de Utilizacion</h4>
                      <p className="text-blue-700">
                        Utilizacion media: <span className="font-bold">{optimizeResult.utilizationAnalysis.averageUtilization || 0}%</span>
                      </p>
                      {optimizeResult.utilizationAnalysis.underutilized > 0 && (
                        <p className="text-yellow-600 text-sm mt-1">
                          {optimizeResult.utilizationAnalysis.underutilized} garantia(s) infrautilizada(s)
                        </p>
                      )}
                      {optimizeResult.utilizationAnalysis.nearLimit > 0 && (
                        <p className="text-red-600 text-sm mt-1">
                          {optimizeResult.utilizationAnalysis.nearLimit} garantia(s) cerca del limite
                        </p>
                      )}
                    </div>
                  )}

                  {/* Optimizations */}
                  {optimizeResult.optimizations?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Optimizaciones Sugeridas</h4>
                      <div className="space-y-3">
                        {optimizeResult.optimizations.map((opt, i) => (
                          <div key={i} className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="flex items-start gap-3">
                              <LightBulbIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium text-green-800">{opt.type}</span>
                                <p className="text-green-700 text-sm">{opt.description}</p>
                                {opt.impact && (
                                  <p className="text-green-600 text-xs mt-1">Impacto: {opt.impact}</p>
                                )}
                                {opt.action && (
                                  <button className="mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">
                                    {opt.action}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Plan */}
                  {optimizeResult.actionPlan?.length > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-medium text-purple-800 mb-3">Plan de Accion</h4>
                      <ol className="space-y-2">
                        {optimizeResult.actionPlan.map((action, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              action.priority === 1 ? 'bg-red-200 text-red-800' :
                              action.priority === 2 ? 'bg-yellow-200 text-yellow-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {action.priority}
                            </span>
                            <div>
                              <span className="font-medium text-purple-900">{action.action}</span>
                              {action.benefit && <p className="text-purple-600 text-sm">{action.benefit}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Formulario de nueva garantia (sin cambios)
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

// Calculadora de garantia requerida (sin cambios mayores)
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
  const [aiResult, setAiResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

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

  const handleAICalculate = async () => {
    setAiLoading(true)
    try {
      const response = await guaranteesAPI.aiSmartCalculate({
        regime: params.regime,
        subType: params.subType,
        customsValue: parseFloat(params.customsValue) || 0,
        dutyAmount: parseFloat(params.dutyAmount) || 0,
        vatAmount: parseFloat(params.vatAmount) || 0,
        duration: parseInt(params.duration) || 1,
        oeaStatus: params.oeaStatus
      })

      if (response.data.success) {
        setAiResult(response.data.data)
        toast.success('Calculo inteligente completado')
      }
    } catch (error) {
      toast.error('Error en calculo inteligente')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
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

          <div className="flex gap-2">
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              {loading ? 'Calculando...' : 'Calculo Estandar'}
            </button>
            <button
              onClick={handleAICalculate}
              disabled={aiLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
              Calculo Inteligente
            </button>
          </div>

          {result && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Resultado Estandar</h3>
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
              </div>
            </div>
          )}

          {aiResult && (
            <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <SparklesIcon className="h-5 w-5" />
                Resultado Inteligente
              </h3>
              <div className="space-y-3 text-sm">
                {aiResult.calculation && (
                  <>
                    <div className="flex justify-between">
                      <span>Importe base:</span>
                      <span className="font-medium">{aiResult.calculation.baseAmount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Importe Ajustado:</span>
                      <span className="text-purple-700">{aiResult.calculation.adjustedAmount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  </>
                )}

                {aiResult.calculation?.reductions?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-purple-600 font-medium">Reducciones aplicadas:</p>
                    <ul className="text-xs text-purple-700 list-disc list-inside">
                      {aiResult.calculation.reductions.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.specialConsiderations?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-purple-200">
                    <p className="text-xs text-purple-600 font-medium">Consideraciones especiales:</p>
                    <ul className="text-xs text-purple-700 space-y-1">
                      {aiResult.specialConsiderations.map((c, i) => (
                        <li key={i}><span className="font-medium">{c.factor}:</span> {c.impact}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.alternatives?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-purple-200">
                    <p className="text-xs text-purple-600 font-medium">Alternativas:</p>
                    {aiResult.alternatives.map((alt, i) => (
                      <div key={i} className="text-xs bg-white/50 rounded p-2 mt-1">
                        <span className="font-medium">{alt.scenario}:</span> {alt.amount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        {alt.benefit && <span className="text-green-600 ml-1">({alt.benefit})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Detalle de garantia (sin cambios)
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
