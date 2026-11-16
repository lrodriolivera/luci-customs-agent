import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { h7API } from '../../services/api'
import toast from 'react-hot-toast'
import ManifestUploader from './ManifestUploader'
import EU2026382Banner from './EU2026382Banner'
import { MODULOS_VISIBLES } from '../../config/modulosVisibles'
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
  ArrowUpTrayIcon,
  DocumentTextIcon
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
  const [showBatchDECO, setShowBatchDECO] = useState(false)
  const [showManifest, setShowManifest] = useState(false)
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
      {/* EU 2026/382 Regulatory Banner */}
      <EU2026382Banner variant="full" />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('h7.title')}</h1>
          <p className="text-gray-600">{t('h7.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManifest(true)}
            className="btn-secondary flex items-center gap-2 bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
          >
            <DocumentTextIcon className="h-5 w-5" />
            Importar Manifiesto
          </button>
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
          {MODULOS_VISIBLES.nuevaH7 && (
            <Link
              to="/h7/new"
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              {isNL ? 'Nueva DECO' : t('h7.new')}
            </Link>
          )}
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
            {MODULOS_VISIBLES.nuevaH7 && (
              <Link to="/h7/new" className="btn-primary mt-4 inline-block">
                {t('h7.createFirst')}
              </Link>
            )}
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

      {/* Manifest Uploader Modal */}
      {showManifest && (
        <ManifestUploader
          onClose={() => setShowManifest(false)}
          onCreated={() => {
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
