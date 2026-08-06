import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { expeditionsAPI } from '../../services/api'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function ExpeditionList() {
  const { t } = useTranslation()
  const [expeditions, setExpeditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    operationType: ''
  })

  const fetchExpeditions = async () => {
    setLoading(true)
    try {
      // Only send non-empty filter values
      const params = {}
      if (filters.search) params.search = filters.search
      if (filters.status) params.status = filters.status
      if (filters.operationType) params.operationType = filters.operationType

      const response = await expeditionsAPI.list(params)
      // Handle backend response format: { success, data: { expeditions } }
      const expeditionsData = response.data?.data?.expeditions || response.data?.expeditions || []
      setExpeditions(expeditionsData)
    } catch (error) {
      console.error('Error fetching expeditions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpeditions()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchExpeditions()
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { label: t('expeditions.statusDraft'), class: 'bg-gray-100 text-gray-800' },
      'pending_documents': { label: t('expeditions.statusPendingDocs'), class: 'bg-yellow-100 text-yellow-800' },
      'documents_received': { label: t('expeditions.statusDocsReceived'), class: 'bg-blue-100 text-blue-800' },
      'validating_documents': { label: t('expeditions.statusValidating'), class: 'bg-purple-100 text-purple-800' },
      'documents_validated': { label: t('expeditions.statusDocsValidated'), class: 'bg-indigo-100 text-indigo-800' },
      'ready_for_declaration': { label: t('expeditions.statusDeclarationReady'), class: 'bg-cyan-100 text-cyan-800' },
      'declaration_submitted': { label: t('expeditions.statusSubmitted'), class: 'bg-orange-100 text-orange-800' },
      'declaration_draft': { label: t('expeditions.statusDeclarationDraft'), class: 'bg-slate-100 text-slate-800' },
      'levante': { label: t('expeditions.statusLevante'), class: 'bg-green-100 text-green-800' },
      'green_channel': { label: t('expeditions.statusGreenChannel'), class: 'bg-green-100 text-green-800' },
      'orange_channel': { label: t('expeditions.statusOrangeChannel'), class: 'bg-orange-100 text-orange-800' },
      'red_channel': { label: t('expeditions.statusRedChannel'), class: 'bg-red-100 text-red-800' },
      'completed': { label: t('expeditions.statusCompleted'), class: 'bg-green-100 text-green-800' },
      'cancelled': { label: t('expeditions.statusCancelled'), class: 'bg-gray-100 text-gray-800' }
    }
    const config = statusMap[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>{config.label}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expeditions.title')}</h1>
          <p className="text-gray-500 mt-1">{t('expeditions.subtitle')}</p>
        </div>
        <Link to="/expeditions/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          {t('expeditions.new')}
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('expeditions.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input pl-10"
              />
            </div>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input w-auto"
          >
            <option value="">{t('expeditions.allStatuses')}</option>
            <option value="draft">{t('expeditions.statusDraft')}</option>
            <option value="pending_documents">{t('expeditions.statusPendingDocs')}</option>
            <option value="documents_received">{t('expeditions.statusDocsReceived')}</option>
            <option value="validating_documents">{t('expeditions.statusValidating')}</option>
            <option value="ready_for_declaration">{t('expeditions.statusDeclarationReady')}</option>
            <option value="completed">{t('expeditions.statusCompleted')}</option>
          </select>

          <select
            value={filters.operationType}
            onChange={(e) => setFilters({ ...filters, operationType: e.target.value })}
            className="input w-auto"
          >
            <option value="">{t('expeditions.allTypes')}</option>
            <option value="import">{t('common.import')}</option>
            <option value="export">{t('common.export')}</option>
          </select>

          <button type="submit" className="btn-secondary flex items-center gap-2">
            <FunnelIcon className="w-5 h-5" />
            {t('common.filter')}
          </button>

          <button
            type="button"
            onClick={fetchExpeditions}
            className="btn-secondary"
            title={t('expeditions.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
          </div>
        ) : expeditions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('expeditions.noExpeditions')}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('expeditions.tableId')}</th>
                  <th>{t('expeditions.tableClient')}</th>
                  <th>{t('expeditions.tableType')}</th>
                  <th>Pais</th>
                  <th>{t('expeditions.tableOriginDest')}</th>
                  <th>{t('expeditions.tableStatus')}</th>
                  <th>{t('expeditions.tableDocs')}</th>
                  <th>{t('expeditions.tableDate')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {expeditions.map((exp) => {
                  const expCountry = exp.country || exp.client?.country || 'ES'
                  return (
                  <tr key={exp._id} className="hover:bg-gray-50">
                    <td className="font-medium text-luci">{exp.expeditionId}</td>
                    <td>
                      <div>
                        <p className="font-medium">{exp.client?.companyName || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{exp.client?.nif || exp.client?.eori || ''}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${exp.operationType === 'import' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {exp.operationType === 'import' ? t('common.import') : t('common.export')}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        expCountry === 'NL' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {expCountry === 'NL' ? '\u{1F1F3}\u{1F1F1}' : '\u{1F1EA}\u{1F1F8}'} {expCountry}
                      </span>
                    </td>
                    <td>
                      {exp.operationType === 'import'
                        ? exp.exporter?.country || 'N/A'
                        : exp.consignee?.address?.country || 'N/A'
                      }
                    </td>
                    <td>{getStatusBadge(exp.status)}</td>
                    <td>
                      <span className="text-sm">
                        {t('expeditions.docCount', { count: exp.documents?.length || 0 })}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {new Date(exp.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td>
                      <Link
                        to={`/expeditions/${exp._id}`}
                        className="text-luci hover:text-luci-dark text-sm font-medium"
                      >
                        {t('expeditions.viewDetail')}
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
