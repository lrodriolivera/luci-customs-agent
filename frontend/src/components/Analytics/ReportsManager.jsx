import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import {
  DocumentTextIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentChartBarIcon,
  CurrencyEuroIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { analyticsAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../common/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'

const REPORT_TYPE_ICONS = {
  executive_summary: DocumentChartBarIcon,
  operations_detail: ClipboardDocumentListIcon,
  financial_report: CurrencyEuroIcon,
  compliance_report: ShieldCheckIcon,
  declaration_report: DocumentTextIcon,
  client_report: UserGroupIcon,
  customs_statistics: ChartBarIcon,
  audit_trail: DocumentDuplicateIcon
}

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF', icon: '📄' },
  { value: 'xlsx', label: 'Excel', icon: '📊' },
  { value: 'csv', label: 'CSV', icon: '📋' },
  { value: 'json', label: 'JSON', icon: '{ }' }
]

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last_7_days', label: 'Ultimos 7 dias' },
  { value: 'last_30_days', label: 'Ultimos 30 dias' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este ano' }
]

export default function ReportsManager() {
  const { t } = useTranslation()
  const { confirm, dialogProps } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [reportTypes, setReportTypes] = useState([])
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')

  // Form state
  const [selectedType, setSelectedType] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('last_30_days')
  const [selectedFormat, setSelectedFormat] = useState('pdf')
  const [reportTitle, setReportTitle] = useState('')
  const [includeLuciAnalysis, setIncludeLuciAnalysis] = useState(true)

  // Schedule form state
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly')
  const [scheduleDay, setScheduleDay] = useState(1)
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [scheduleRecipients, setScheduleRecipients] = useState('')

  useEffect(() => {
    loadReportTypes()
    loadReports()
  }, [])

  const loadReportTypes = async () => {
    try {
      const response = await analyticsAPI.reports.getTypes()
      if (response.data.success) {
        setReportTypes(response.data.types)
      }
    } catch (error) {
      console.error('Error loading report types:', error)
    }
  }

  const loadReports = async () => {
    try {
      setLoading(true)
      const response = await analyticsAPI.reports.list()
      if (response.data.success) {
        setReports(response.data.reports)
      }
    } catch (error) {
      toast.error(t('analyticsPage.errorLoadingReports'))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!selectedType) {
      toast.error(t('analyticsPage.selectReportType'))
      return
    }

    try {
      setGenerating(true)
      const response = await analyticsAPI.reports.generate({
        type: selectedType,
        period: selectedPeriod,
        format: selectedFormat,
        title: reportTitle || undefined,
        includeLuciAnalysis
      })

      if (response.data.success) {
        toast.success(t('analyticsPage.reportGenerated'))
        setShowGenerateModal(false)
        loadReports()
        resetForm()
      } else {
        toast.error(response.data.error || 'Error generando informe')
      }
    } catch (error) {
      toast.error(t('analyticsPage.errorGeneratingReport'))
      console.error(error)
    } finally {
      setGenerating(false)
    }
  }

  const handleScheduleReport = async () => {
    if (!selectedType) {
      toast.error('Selecciona un tipo de informe')
      return
    }

    try {
      setGenerating(true)
      const response = await analyticsAPI.reports.schedule({
        type: selectedType,
        frequency: scheduleFrequency,
        dayOfWeek: scheduleFrequency === 'weekly' ? scheduleDay : undefined,
        dayOfMonth: scheduleFrequency === 'monthly' ? scheduleDay : undefined,
        time: scheduleTime,
        format: selectedFormat,
        recipients: scheduleRecipients.split(',').map(e => e.trim()).filter(Boolean),
        options: { includeLuciAnalysis }
      })

      if (response.data.success) {
        toast.success('Informe programado correctamente')
        setShowScheduleModal(false)
        resetForm()
      } else {
        toast.error(response.data.error || 'Error programando informe')
      }
    } catch (error) {
      toast.error('Error programando informe')
      console.error(error)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadReport = async (reportId, format) => {
    try {
      const response = await analyticsAPI.reports.download(reportId, format)
      // In production, this would trigger a file download
      toast.success('Descarga iniciada')
    } catch (error) {
      toast.error('Error descargando informe')
      console.error(error)
    }
  }

  const handleDeleteReport = async (reportId) => {
    if (!await confirm({ message: '¿Eliminar este informe?', variant: 'danger' })) return

    try {
      const response = await analyticsAPI.reports.delete(reportId)
      if (response.data.success) {
        toast.success('Informe eliminado')
        loadReports()
      }
    } catch (error) {
      toast.error('Error eliminando informe')
      console.error(error)
    }
  }

  const resetForm = () => {
    setSelectedType('')
    setSelectedPeriod('last_30_days')
    setSelectedFormat('pdf')
    setReportTitle('')
    setIncludeLuciAnalysis(true)
    setScheduleFrequency('weekly')
    setScheduleDay(1)
    setScheduleTime('08:00')
    setScheduleRecipients('')
  }

  const filteredReports = reports.filter(report => {
    const matchesSearch = !searchTerm ||
      report.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.type?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !filterType || report.type === filterType
    return matchesSearch && matchesType
  })

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReportTypeName = (type) => {
    const found = reportTypes.find(t => t.type === type)
    return found?.name || type
  }

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luci"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('analyticsPage.reportsManager')}</h1>
          <p className="text-sm text-gray-500">{t('analyticsPage.reportsManagerSubtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn-secondary"
          >
            <ClockIcon className="w-5 h-5 mr-2" />
            {t('analyticsPage.schedule')}
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn-primary"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            {t('analyticsPage.generateReport')}
          </button>
        </div>
      </div>

      {/* Quick Generate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.slice(0, 4).map((type) => {
          const Icon = REPORT_TYPE_ICONS[type.type] || DocumentTextIcon
          return (
            <button
              key={type.type}
              onClick={() => {
                setSelectedType(type.type)
                setShowGenerateModal(true)
              }}
              className="card hover:border-luci transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-luci-light rounded-lg">
                  <Icon className="w-5 h-5 text-luci" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{type.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{type.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('analyticsPage.searchReports')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-field"
          >
            <option value="">{t('common.allTypes')}</option>
            {reportTypes.map((type) => (
              <option key={type.type} value={type.type}>{type.name}</option>
            ))}
          </select>

          <button
            onClick={loadReports}
            className="btn-secondary p-2"
            title="Actualizar"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reports List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Informe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Periodo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Formato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Generado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>{t('analyticsPage.noReports')}</p>
                    <p className="text-sm">{t('analyticsPage.noReportsHint')}</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const Icon = REPORT_TYPE_ICONS[report.type] || DocumentTextIcon
                  return (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-gray-100 rounded-lg mr-3">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {report.title || getReportTypeName(report.type)}
                            </div>
                            <div className="text-sm text-gray-500">{report.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getReportTypeName(report.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {PERIOD_OPTIONS.find(p => p.value === report.period)?.label || report.period}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="uppercase text-sm font-medium text-gray-600">
                          {report.format}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(report.generatedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadReport(report.id, report.format)}
                            className="p-2 text-gray-500 hover:text-luci hover:bg-luci-light rounded-lg transition-colors"
                            title="Descargar"
                          >
                            <DocumentArrowDownIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Generar Informe</h2>
                <button
                  onClick={() => { setShowGenerateModal(false); resetForm(); }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Informe
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {reportTypes.map((type) => {
                    const Icon = REPORT_TYPE_ICONS[type.type] || DocumentTextIcon
                    return (
                      <button
                        key={type.type}
                        onClick={() => setSelectedType(type.type)}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          selectedType === type.type
                            ? 'border-luci bg-luci-light'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1 ${selectedType === type.type ? 'text-luci' : 'text-gray-500'}`} />
                        <div className="text-sm font-medium">{type.name}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titulo (opcional)
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Titulo personalizado..."
                  className="input-field"
                />
              </div>

              {/* Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Periodo
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="input-field"
                >
                  {PERIOD_OPTIONS.map((period) => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formato
                </label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value)}
                      className={`flex-1 py-2 px-3 border rounded-lg text-center transition-colors ${
                        selectedFormat === format.value
                          ? 'border-luci bg-luci-light text-luci'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="mr-1">{format.icon}</span>
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LUCI Analysis */}
              <div className="flex items-center gap-3 p-4 bg-luci-light rounded-lg">
                <input
                  type="checkbox"
                  id="includeLuci"
                  checked={includeLuciAnalysis}
                  onChange={(e) => setIncludeLuciAnalysis(e.target.checked)}
                  className="w-4 h-4 text-luci border-gray-300 rounded focus:ring-luci"
                />
                <label htmlFor="includeLuci" className="flex items-center gap-2 text-sm">
                  <SparklesIcon className="w-5 h-5 text-luci" />
                  Incluir analisis de LUCI
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowGenerateModal(false); resetForm(); }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={!selectedType || generating}
                className="btn-primary"
              >
                {generating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <DocumentTextIcon className="w-5 h-5 mr-2" />
                    Generar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Report Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Programar Informe</h2>
                <button
                  onClick={() => { setShowScheduleModal(false); resetForm(); }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Informe
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="input-field"
                >
                  <option value="">Seleccionar tipo...</option>
                  {reportTypes.map((type) => (
                    <option key={type.type} value={type.type}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frecuencia
                </label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value)}
                  className="input-field"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              {/* Day Selection */}
              {scheduleFrequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dia de la semana
                  </label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(parseInt(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>Lunes</option>
                    <option value={2}>Martes</option>
                    <option value={3}>Miercoles</option>
                    <option value={4}>Jueves</option>
                    <option value={5}>Viernes</option>
                  </select>
                </div>
              )}

              {scheduleFrequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dia del mes
                  </label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(parseInt(e.target.value))}
                    className="input-field"
                  >
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formato
                </label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="input-field"
                >
                  {FORMAT_OPTIONS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.icon} {format.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destinatarios (emails separados por coma)
                </label>
                <input
                  type="text"
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className="input-field"
                />
              </div>

              {/* LUCI Analysis */}
              <div className="flex items-center gap-3 p-4 bg-luci-light rounded-lg">
                <input
                  type="checkbox"
                  id="includeScheduleLuci"
                  checked={includeLuciAnalysis}
                  onChange={(e) => setIncludeLuciAnalysis(e.target.checked)}
                  className="w-4 h-4 text-luci border-gray-300 rounded focus:ring-luci"
                />
                <label htmlFor="includeScheduleLuci" className="flex items-center gap-2 text-sm">
                  <SparklesIcon className="w-5 h-5 text-luci" />
                  Incluir analisis de LUCI
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowScheduleModal(false); resetForm(); }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleScheduleReport}
                disabled={!selectedType || generating}
                className="btn-primary"
              >
                {generating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                    Programando...
                  </>
                ) : (
                  <>
                    <ClockIcon className="w-5 h-5 mr-2" />
                    Programar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  )
}
