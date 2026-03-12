import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ShoppingCartIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'

// STATUS_CONFIG is defined inside the component to use t()

// Transportistas
const CARRIERS_ES = [
  { code: 'CORREOS', name: 'Correos' },
  { code: 'DHL', name: 'DHL Express' },
  { code: 'UPS', name: 'UPS' },
  { code: 'FEDEX', name: 'FedEx' },
  { code: 'TNT', name: 'TNT' },
  { code: 'GLS', name: 'GLS' },
  { code: 'SEUR', name: 'SEUR' },
  { code: 'MRW', name: 'MRW' },
  { code: 'AMAZON', name: 'Amazon Logistics' },
  { code: 'OTHER', name: 'Otro' }
]

const CARRIERS_NL = [
  { code: 'POSTNL', name: 'PostNL' },
  { code: 'DHL', name: 'DHL Express' },
  { code: 'DPD', name: 'DPD' },
  { code: 'UPS', name: 'UPS' },
  { code: 'FEDEX', name: 'FedEx' },
  { code: 'GLS', name: 'GLS' },
  { code: 'TNT', name: 'TNT' },
  { code: 'AMAZON', name: 'Amazon Logistics' },
  { code: 'BOL', name: 'Bol.com Logistics' },
  { code: 'OTHER', name: 'Otro' }
]

const NL_CUSTOMS_OFFICES = [
  { code: 'NL000297', name: 'Rotterdam Haven' },
  { code: 'NL000399', name: 'Schiphol' },
  { code: 'NL000396', name: 'Amsterdam' },
  { code: 'NL000440', name: 'Eindhoven' },
  { code: 'NL000448', name: 'Venlo' },
  { code: 'NL000231', name: 'Breda' },
  { code: 'NL000251', name: 'Rotterdam Rijnmond' },
]

const getActiveCountry = () => localStorage.getItem('activeCustomsCountry') || 'ES'
const CARRIERS = getActiveCountry() === 'NL' ? CARRIERS_NL : CARRIERS_ES

export default function H7DeclarationList() {
  const { t } = useTranslation()

  const STATUS_CONFIG = {
    draft: { label: t('h7.statusDraft'), color: 'gray', icon: ClockIcon },
    validating: { label: t('h7.statusValidating'), color: 'blue', icon: ArrowPathIcon },
    pending: { label: t('h7.statusPending'), color: 'yellow', icon: ClockIcon },
    submitted: { label: t('h7.statusSent'), color: 'blue', icon: DocumentArrowUpIcon },
    accepted: { label: t('h7.statusAccepted'), color: 'green', icon: CheckCircleIcon },
    held: { label: t('h7.statusHeld'), color: 'orange', icon: ExclamationTriangleIcon },
    rejected: { label: t('h7.statusRejected'), color: 'red', icon: XCircleIcon },
    released: { label: t('h7.statusRelease'), color: 'green', icon: CheckCircleIcon },
    delivered: { label: t('h7.statusDelivered'), color: 'emerald', icon: TruckIcon },
    returned: { label: t('h7.statusReturned'), color: 'red', icon: XCircleIcon },
    cancelled: { label: t('h7.statusCancelled'), color: 'gray', icon: XCircleIcon }
  }

  const [declarations, setDeclarations] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    carrier: '',
    search: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showBatchDECO, setShowBatchDECO] = useState(false)
  const [batchSelected, setBatchSelected] = useState([])
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const activeCountry = localStorage.getItem('activeCustomsCountry') || 'ES'
  const isNL = activeCountry === 'NL'

  useEffect(() => {
    loadDeclarations()
    loadStats()
  }, [filters.status, filters.carrier, pagination.page])

  const loadDeclarations = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      }

      const response = await h7API.list(params)
      const data = response.data

      if (data.success) {
        setDeclarations(data.data)
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          pages: data.pagination.pages
        }))
      }
    } catch (error) {
      toast.error(t('h7.loadingH7Error'))
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await h7API.getStats()
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadDeclarations()
  }

  const handleSubmit = async (id) => {
    try {
      const response = await h7API.submit(id)
      if (response.data.success) {
        toast.success(t('h7.declarationSent', { mrn: response.data.data.mrn }))
        loadDeclarations()
        loadStats()
      }
    } catch (error) {
      toast.error(t('h7.errorSendingDecl'))
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('h7.title')}</h1>
          <p className="text-gray-600">{t('h7.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <FunnelIcon className="h-5 w-5" />
            {t('h7.filters')}
          </button>
          {isNL && (
            <button
              onClick={() => setShowBatchDECO(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Batch DECO
            </button>
          )}
          <button
            onClick={() => setShowNewForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            {isNL ? 'Nueva DECO' : t('h7.new')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">{t('h7.totalDeclarations')}</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totals?.declarations || 0}</p>
              </div>
              <ShoppingCartIcon className="h-10 w-10 text-blue-500" />
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">{t('h7.totalValue')}</p>
                <p className="text-2xl font-bold text-green-900">
                  {(stats.totals?.value || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <CheckCircleIcon className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">{t('h7.dutiesCollected')}</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {(stats.totals?.duties || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <DocumentArrowUpIcon className="h-10 w-10 text-yellow-500" />
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">{t('h7.carriers')}</p>
                <p className="text-2xl font-bold text-purple-900">
                  {stats.byCarrier?.length || 0}
                </p>
              </div>
              <TruckIcon className="h-10 w-10 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="card">
          <h3 className="font-semibold mb-4">{t('h7.filters')}</h3>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('h7.searchLabel')}</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder={t('h7.searchPlaceholder')}
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input"
              >
                <option value="">{t('common.all')}</option>
                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('h7.carrier')}</label>
              <select
                value={filters.carrier}
                onChange={(e) => setFilters({ ...filters, carrier: e.target.value })}
                className="input"
              >
                <option value="">{t('common.all')}</option>
                {CARRIERS.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full">
                {t('common.search')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Declarations Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : declarations.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('h7.noDeclarations')}</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="btn-primary mt-4"
            >
              {t('h7.createFirst')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.reference')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.tracking')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.carrier')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.recipient')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.value')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.duties')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('h7.mrnLabel')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {declarations.map((decl) => (
                  <tr key={decl._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/h7/${decl._id}`} className="text-blue-600 hover:underline font-medium">
                        {decl.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {decl.trackingNumber}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="flex items-center gap-1">
                        <TruckIcon className="h-4 w-4 text-gray-400" />
                        {decl.carrier?.code || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">{decl.recipient?.name}</p>
                        <p className="text-gray-500 text-xs">{decl.recipient?.taxId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {decl.totals?.customsValue?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {decl.vatPrepaid ? (
                        <span className="text-green-600">{t('h7.iossPaidLabel')}</span>
                      ) : (
                        <span className="font-medium">
                          {decl.duties?.totalDue?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(decl.status)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {decl.mrn || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {decl.status === 'draft' && (
                          <button
                            onClick={() => handleSubmit(decl._id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('h7.sendLabel')}
                          </button>
                        )}
                        <Link
                          to={`/h7/${decl._id}`}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          {t('h7.viewLabel')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              {t('common.showing')} {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} {t('common.of')} {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New H7 Modal */}
      {showNewForm && (
        <H7NewForm
          onClose={() => setShowNewForm(false)}
          onCreated={() => {
            setShowNewForm(false)
            loadDeclarations()
            loadStats()
          }}
        />
      )}

      {/* Batch DECO Modal (NL only) */}
      {showBatchDECO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{'\u{1F1F3}\u{1F1F1}'} Batch DECO</h2>
                <p className="text-sm text-gray-500">Selecciona declaraciones H7 para enviar en lote via DECO</p>
              </div>
              <button onClick={() => { setShowBatchDECO(false); setBatchSelected([]) }} className="text-gray-400 hover:text-gray-600">
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* CSV upload option */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <ArrowUpTrayIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">Subir CSV con declaraciones DECO</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      toast.success(`CSV "${e.target.files[0].name}" cargado. Procesando...`)
                    }
                  }}
                  className="text-sm"
                />
                <p className="text-xs text-gray-400 mt-2">Formato: tracking,sender,recipient_eori,description,value,taric_code</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-gray-500">o seleccionar existentes</span></div>
              </div>

              {/* Select from existing draft declarations */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {declarations.filter(d => d.status === 'draft').length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No hay declaraciones en borrador para enviar</p>
                ) : (
                  declarations.filter(d => d.status === 'draft').map(decl => (
                    <label key={decl._id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      batchSelected.includes(decl._id) ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={batchSelected.includes(decl._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchSelected([...batchSelected, decl._id])
                          } else {
                            setBatchSelected(batchSelected.filter(id => id !== decl._id))
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{decl.reference}</p>
                        <p className="text-xs text-gray-500">{decl.recipient?.name} - {decl.trackingNumber}</p>
                      </div>
                      <span className="text-sm font-medium">
                        {decl.totals?.customsValue?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </label>
                  ))
                )}
              </div>

              {batchSelected.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-orange-800">{batchSelected.length} declaracion(es) seleccionada(s)</p>
                  <p className="text-xs text-orange-600 mt-1">Se enviaran todas a DECO en un unico lote</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => { setShowBatchDECO(false); setBatchSelected([]) }}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => {
                    if (batchSelected.length === 0) {
                      toast.error('Selecciona al menos una declaracion')
                      return
                    }
                    setBatchSubmitting(true)
                    try {
                      for (const id of batchSelected) {
                        await h7API.submit(id)
                      }
                      toast.success(`${batchSelected.length} declaracion(es) enviada(s) a DECO`)
                      setShowBatchDECO(false)
                      setBatchSelected([])
                      loadDeclarations()
                      loadStats()
                    } catch (error) {
                      toast.error('Error enviando lote DECO')
                    } finally {
                      setBatchSubmitting(false)
                    }
                  }}
                  disabled={batchSelected.length === 0 || batchSubmitting}
                  className="btn-primary disabled:opacity-50 flex items-center gap-2"
                >
                  {batchSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="h-4 w-4" />
                      Enviar Batch DECO ({batchSelected.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para crear nueva H7
function H7NewForm({ onClose, onCreated }) {
  const { t } = useTranslation()
  const activeCountry = localStorage.getItem('activeCustomsCountry') || 'ES'
  const isNL = activeCountry === 'NL'
  const carriers = isNL ? CARRIERS_NL : CARRIERS_ES
  const defaultCarrier = isNL ? { code: 'POSTNL', name: 'PostNL' } : { code: 'CORREOS', name: 'Correos' }
  const [formData, setFormData] = useState({
    trackingNumber: '',
    carrier: defaultCarrier,
    iossNumber: '',
    customsOffice: isNL ? 'NL000399' : '',
    destinationCountry: isNL ? 'NL' : 'ES',
    sender: {
      name: '',
      address: { country: 'CN' }
    },
    recipient: {
      name: '',
      taxId: '',
      eori: '',
      address: {
        street: '',
        city: '',
        postalCode: '',
        country: isNL ? 'NL' : 'ES'
      }
    },
    items: [{
      description: '',
      taricCode: '',
      quantity: 1,
      unitValue: 0,
      totalValue: 0,
      netWeight: 0.1,
      countryOfOrigin: 'CN'
    }],
    totals: {
      shippingCost: 0,
      grossWeight: 0.5,
      packages: 1
    }
  })
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState(null)

  const calculateTotals = () => {
    const intrinsicValue = formData.items.reduce((sum, item) => sum + (item.totalValue || 0), 0)
    const netWeight = formData.items.reduce((sum, item) => sum + (item.netWeight || 0), 0)
    return { intrinsicValue, netWeight }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = value

    // Calcular valor total del item
    if (field === 'quantity' || field === 'unitValue') {
      newItems[index].totalValue = newItems[index].quantity * newItems[index].unitValue
    }

    setFormData({ ...formData, items: newItems })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        description: '',
        taricCode: '',
        quantity: 1,
        unitValue: 0,
        totalValue: 0,
        netWeight: 0.1,
        countryOfOrigin: 'CN'
      }]
    })
  }

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      })
    }
  }

  const validateForm = async () => {
    try {
      const totals = calculateTotals()
      const response = await h7API.validate({
        ...formData,
        totals: {
          ...formData.totals,
          intrinsicValue: totals.intrinsicValue,
          netWeight: totals.netWeight
        }
      })

      setValidation(response.data.data)
      return response.data.data.eligible
    } catch (error) {
      toast.error(t('h7.validationErrorLabel'))
      return false
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const isValid = await validateForm()
    if (!isValid) {
      toast.error(t('h7.doesNotMeetRequirements'))
      return
    }

    setLoading(true)
    try {
      const totals = calculateTotals()
      const response = await h7API.create({
        ...formData,
        totals: {
          ...formData.totals,
          intrinsicValue: totals.intrinsicValue,
          netWeight: totals.netWeight,
          customsValue: totals.intrinsicValue + formData.totals.shippingCost
        }
      })

      if (response.data.success) {
        toast.success(t('h7.declarationCreated', { ref: response.data.data.reference }))
        onCreated()
      }
    } catch (error) {
      toast.error(t('h7.errorCreating'))
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{t('h7.newTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Country indicator */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${isNL ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{isNL ? '🇳🇱' : '🇪🇸'}</span>
              <span className={`font-medium ${isNL ? 'text-orange-700' : 'text-blue-700'}`}>
                {isNL ? 'DECO - Paises Bajos' : 'AEAT - España'}
              </span>
              {isNL && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">H7 max 150 EUR</span>}
            </div>
            <button
              type="button"
              onClick={() => {
                const next = isNL ? 'ES' : 'NL'
                localStorage.setItem('activeCustomsCountry', next)
                window.location.reload()
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Cambiar a {isNL ? 'España' : 'Paises Bajos'}
            </button>
          </div>

          {/* NL DECO info box */}
          {isNL && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">Declaracion DECO (Paises Bajos)</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Valor intrinseco maximo: 150 EUR por envio</li>
                <li>Codigo arancelario: 6 digitos (no 10 como TARIC)</li>
                <li>Si tiene IOSS, el IVA ya fue cobrado en origen</li>
                <li>El destinatario necesita EORI holandes (NLxxxxxxxxx)</li>
                <li>Mercancias sujetas a impuestos especiales NO pueden usar DECO</li>
              </ul>
            </div>
          )}

          {/* Validacion */}
          {validation && !validation.eligible && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">{t('h7.validationErrors')}</h4>
              <ul className="list-disc list-inside text-sm text-red-700">
                {validation.errors?.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Datos del envio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('h7.trackingNumber')} *</label>
              <input
                type="text"
                required
                value={formData.trackingNumber}
                onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                className="input"
                placeholder="AWB o numero de seguimiento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('h7.carrier')} *</label>
              <select
                value={formData.carrier.code}
                onChange={(e) => {
                  const carrier = carriers.find(c => c.code === e.target.value)
                  setFormData({ ...formData, carrier: { code: carrier.code, name: carrier.name } })
                }}
                className="input"
              >
                {carriers.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* IOSS */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('h7.iossNumber')}</label>
            <input
              type="text"
              value={formData.iossNumber}
              onChange={(e) => setFormData({ ...formData, iossNumber: e.target.value })}
              className="input"
              placeholder="IM + 10 digitos (ej: IM2760000001)"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isNL
                ? 'Si el vendedor tiene IOSS, el IVA ya fue cobrado. Formato: IM + pais + digitos (ej: IMNL000000123)'
                : t('h7.iossHint')}
            </p>
          </div>

          {/* NL: Customs office selector */}
          {isNL && (
            <div>
              <label className="block text-sm font-medium mb-1">Aduana de entrada (Paises Bajos) *</label>
              <select
                value={formData.customsOffice}
                onChange={(e) => setFormData({ ...formData, customsOffice: e.target.value })}
                className="input"
                required
              >
                {NL_CUSTOMS_OFFICES.map(o => (
                  <option key={o.code} value={o.code}>{o.name} ({o.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Remitente */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">{t('h7.sender')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formData.sender.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    sender: { ...formData.sender, name: e.target.value }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pais de origen *</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={formData.sender.address.country}
                  onChange={(e) => setFormData({
                    ...formData,
                    sender: {
                      ...formData.sender,
                      address: { ...formData.sender.address, country: e.target.value.toUpperCase() }
                    }
                  })}
                  className="input"
                  placeholder="CN, US, GB..."
                />
              </div>
            </div>
          </div>

          {/* Destinatario */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">{t('h7.recipientBuyer')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    recipient: { ...formData.recipient, name: e.target.value }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{isNL ? 'EORI *' : 'NIF/NIE *'}</label>
                <input
                  type="text"
                  required
                  value={isNL ? formData.recipient.eori : formData.recipient.taxId}
                  onChange={(e) => setFormData({
                    ...formData,
                    recipient: isNL
                      ? { ...formData.recipient, eori: e.target.value.toUpperCase() }
                      : { ...formData.recipient, taxId: e.target.value.toUpperCase() }
                  })}
                  className="input"
                  placeholder={isNL ? 'NL123456789' : '12345678A'}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Direccion *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient.address.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    recipient: {
                      ...formData.recipient,
                      address: { ...formData.recipient.address, street: e.target.value }
                    }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ciudad *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient.address.city}
                  onChange={(e) => setFormData({
                    ...formData,
                    recipient: {
                      ...formData.recipient,
                      address: { ...formData.recipient.address, city: e.target.value }
                    }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Codigo Postal *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient.address.postalCode}
                  onChange={(e) => setFormData({
                    ...formData,
                    recipient: {
                      ...formData.recipient,
                      address: { ...formData.recipient.address, postalCode: e.target.value }
                    }
                  })}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Articulos */}
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">{t('h7.articles')}</h3>
              <button type="button" onClick={addItem} className="btn-secondary text-sm">
                {t('h7.addArticle')}
              </button>
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className="border rounded p-3 mb-3 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{t('h7.article')} {index + 1}</span>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500 text-sm"
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Descripcion *</label>
                    <input
                      type="text"
                      required
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Codigo TARIC *</label>
                    <input
                      type="text"
                      required
                      value={item.taricCode}
                      onChange={(e) => handleItemChange(index, 'taricCode', e.target.value)}
                      className="input text-sm"
                      placeholder="6 digitos"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pais origen</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={item.countryOfOrigin}
                      onChange={(e) => handleItemChange(index, 'countryOfOrigin', e.target.value.toUpperCase())}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Cantidad *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Valor unitario (EUR) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={0.01}
                      value={item.unitValue}
                      onChange={(e) => handleItemChange(index, 'unitValue', parseFloat(e.target.value) || 0)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Valor total (EUR)</label>
                    <input
                      type="number"
                      readOnly
                      value={item.totalValue}
                      className="input text-sm bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Peso neto (kg)</label>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={item.netWeight}
                      onChange={(e) => handleItemChange(index, 'netWeight', parseFloat(e.target.value) || 0)}
                      className="input text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-medium mb-3">{t('h7.summary')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Valor intrinseco</label>
                <input
                  type="text"
                  readOnly
                  value={totals.intrinsicValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  className={`input text-sm bg-white ${totals.intrinsicValue > 150 ? 'border-red-500 text-red-600' : ''}`}
                />
                {totals.intrinsicValue > 150 && (
                  <p className="text-xs text-red-600 mt-1">{t('h7.exceedsH7Limit')}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Gastos de envio (EUR)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.totals.shippingCost}
                  onChange={(e) => setFormData({
                    ...formData,
                    totals: { ...formData.totals, shippingCost: parseFloat(e.target.value) || 0 }
                  })}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Peso bruto (kg)</label>
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={formData.totals.grossWeight}
                  onChange={(e) => setFormData({
                    ...formData,
                    totals: { ...formData.totals, grossWeight: parseFloat(e.target.value) || 0 }
                  })}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Bultos</label>
                <input
                  type="number"
                  min={1}
                  value={formData.totals.packages}
                  onChange={(e) => setFormData({
                    ...formData,
                    totals: { ...formData.totals, packages: parseInt(e.target.value) || 1 }
                  })}
                  className="input text-sm"
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={validateForm}
              className="btn-secondary"
            >
              {t('h7.validate')}
            </button>
            <button
              type="submit"
              disabled={loading || totals.intrinsicValue > 150}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? t('h7.creatingH7') : t('h7.createH7')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
