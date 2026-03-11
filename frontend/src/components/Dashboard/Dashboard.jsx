import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { expeditionsAPI, dashboardAPI, classificationAPI } from '../../services/api'
import {
  FolderIcon,
  DocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowRightIcon,
  BellAlertIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  TagIcon,
  CalculatorIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  GlobeAltIcon,
  ArrowUpRightIcon
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // Multi-country: read tenant customs config (default ES/AEAT)
  const customsCountry = (() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      return storedUser?.tenant?.customsConfig?.country || 'ES'
    } catch { return 'ES' }
  })()
  const customsSystem = customsCountry === 'NL' ? 'DMS/DECO' : 'AEAT'
  const countryFlag = customsCountry === 'NL' ? '\u{1F1F3}\u{1F1F1}' : '\u{1F1EA}\u{1F1F8}'

  const quickActions = [
    { path: '/classification', icon: TagIcon, label: t('dashboard.taricClassification'), desc: t('dashboard.aiTariff'), color: 'from-sky-500 to-blue-600', bg: 'bg-sky-50 group-hover:bg-sky-100' },
    { path: '/calculator', icon: CalculatorIcon, label: t('dashboard.calculator'), desc: t('dashboard.dutiesVat'), color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50 group-hover:bg-emerald-100' },
    { path: '/pue', icon: ClipboardDocumentCheckIcon, label: t('dashboard.pueSoivre'), desc: t('dashboard.inspectionsLabel'), color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 group-hover:bg-violet-100' },
    { path: '/declarations', icon: DocumentTextIcon, label: t('dashboard.declarationsLabel'), desc: t('dashboard.h1H7Ens'), color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 group-hover:bg-amber-100' },
  ]
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 })
  const [recentExpeditions, setRecentExpeditions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertStats, setAlertStats] = useState({ total: 0, critical: 0, warning: 0 })
  const [loading, setLoading] = useState(true)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [cacheStats, setCacheStats] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await expeditionsAPI.list({ limit: 5 })
        const expeditions = response.data.expeditions || []
        setRecentExpeditions(expeditions)
        setStats({
          total: response.data.total || expeditions.length,
          pending: expeditions.filter(e => e.status === 'PENDING_DOCS' || e.status === 'pending_docs').length,
          inProgress: expeditions.filter(e => ['DOCS_RECEIVED', 'VALIDATING', 'PROCESSING', 'orange_channel', 'red_channel'].includes(e.status)).length,
          completed: expeditions.filter(e => e.status === 'COMPLETED' || e.status === 'green_channel').length
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    const fetchAlerts = async () => {
      try {
        const response = await dashboardAPI.getAlerts()
        if (response.data.success) {
          setAlerts(response.data.data.alerts || [])
          setAlertStats(response.data.data.stats || { total: 0, critical: 0, warning: 0 })
        }
      } catch (error) {
        console.error('Error fetching alerts:', error)
      } finally {
        setAlertsLoading(false)
      }
    }

    const fetchCacheStats = async () => {
      try {
        const response = await classificationAPI.getCacheStats()
        if (response.data.success) setCacheStats(response.data.data)
      } catch {}
    }

    fetchData()
    fetchAlerts()
    fetchCacheStats()
    const alertInterval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(alertInterval)
  }, [])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('dashboard.goodMorning')
    if (h < 20) return t('dashboard.goodAfternoon')
    return t('dashboard.goodEvening')
  }

  const getStatusConfig = (status) => {
    const map = {
      'PENDING_DOCS': { label: t('dashboard.statusPending'), dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
      'pending_docs': { label: t('dashboard.statusPending'), dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
      'DOCS_RECEIVED': { label: t('dashboard.statusDocsReceived'), dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
      'VALIDATING': { label: t('dashboard.statusValidating'), dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
      'PROCESSING': { label: t('dashboard.statusInProcess'), dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
      'declaration_draft': { label: t('dashboard.statusDraft'), dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-700 ring-gray-200' },
      'ready_for_declaration': { label: t('dashboard.statusReadyH1'), dot: 'bg-indigo-400', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
      'green_channel': { label: t('dashboard.statusGreenChannel'), dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
      'orange_channel': { label: t('dashboard.statusOrangeChannel'), dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
      'red_channel': { label: t('dashboard.statusRedChannel'), dot: 'bg-red-400', badge: 'bg-red-50 text-red-700 ring-red-200' },
      'COMPLETED': { label: t('dashboard.statusCompleted'), dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    }
    return map[status] || { label: status, dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 ring-gray-200' }
  }

  const getAlertIcon = (type) => {
    const icons = {
      requirement_deadline: ClockIcon, requirement_overdue: ExclamationTriangleIcon,
      red_channel_pending: ShieldExclamationIcon, guarantee_low_balance: BanknotesIcon,
      guarantee_expiring: BanknotesIcon, regime_expiring: DocumentCheckIcon,
    }
    return icons[type] || BellAlertIcon
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    )
  }

  const statCards = [
    { label: t('dashboard.statExpeditions'), value: stats.total, icon: FolderIcon, color: 'text-sky-600', iconBg: 'bg-sky-100', accent: 'border-sky-200' },
    { label: t('dashboard.statPending'), value: stats.pending, icon: ClockIcon, color: 'text-amber-600', iconBg: 'bg-amber-100', accent: 'border-amber-200' },
    { label: t('dashboard.statInProgress'), value: stats.inProgress, icon: ArrowTrendingUpIcon, color: 'text-violet-600', iconBg: 'bg-violet-100', accent: 'border-violet-200' },
    { label: t('dashboard.statCompleted'), value: stats.completed, icon: DocumentCheckIcon, color: 'text-emerald-600', iconBg: 'bg-emerald-100', accent: 'border-emerald-200' },
  ]

  return (
    <div className="space-y-6 -mt-6 -mx-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-8 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full translate-y-1/2 blur-3xl" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sky-400 text-sm font-medium">{getGreeting()}</p>
            <h1 className="text-2xl font-bold text-white mt-1">
              {user?.name || t('dashboard.user')}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Country Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <span>{countryFlag}</span>
              <span className="text-white text-sm font-medium">{customsSystem}</span>
            </div>
            <Link to="/expeditions/new" className="bg-white/10 backdrop-blur-sm text-white border border-white/20 font-medium px-5 py-2.5 rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 text-sm">
              <PlusIcon className="w-4 h-4" />
              {t('dashboard.newExpedition')}
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {statCards.map(({ label, value, icon: Icon, color, iconBg }) => (
            <div key={label} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/[0.15] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
                  <p className="text-3xl font-bold text-white mt-1">{value}</p>
                </div>
                <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="px-8 space-y-6">
        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map(({ path, icon: Icon, label, desc, color, bg }) => (
              <Link key={path} to={path} className="group flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all">
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center transition-colors flex-shrink-0`}>
                  <Icon className={`w-5 h-5 bg-gradient-to-br ${color} bg-clip-text`} style={{ color: 'inherit' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <ArrowUpRightIcon className="w-4 h-4 text-gray-300 group-hover:text-gray-500 ml-auto flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {!alertsLoading && alertStats.total > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-red-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <BellAlertIcon className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900 text-sm">{t('dashboard.alerts')}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {alertStats.critical > 0 && <span className="text-red-600 font-medium">{alertStats.critical} {t('dashboard.criticalAlerts')}</span>}
                    {alertStats.critical > 0 && alertStats.warning > 0 && ' · '}
                    {alertStats.warning > 0 && <span className="text-amber-600 font-medium">{alertStats.warning} {t('dashboard.warnings')}</span>}
                  </span>
                </div>
              </div>
              <Link to="/requirements" className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                {t('dashboard.viewAll')} <ArrowRightIcon className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {alerts.slice(0, 3).map((alert) => {
                const AlertIcon = getAlertIcon(alert.type)
                const isCritical = alert.severity === 'critical'
                return (
                  <Link key={alert.id} to={alert.link} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <AlertIcon className={`w-4 h-4 flex-shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{alert.title}</p>
                      <p className="text-xs text-gray-500 truncate">{alert.message}</p>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isCritical ? t('dashboard.criticalLabel') : t('dashboard.warningLabel')}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {!alertsLoading && alertStats.total === 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-emerald-700 font-medium">{t('dashboard.noAlerts')}</p>
          </div>
        )}

        {/* Main Grid: Expeditions + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Expeditions */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">{t('dashboard.recentExpeditions')}</h2>
              <Link to="/expeditions" className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                {t('dashboard.viewAllExpeditions')} <ArrowRightIcon className="w-3 h-3" />
              </Link>
            </div>

            {recentExpeditions.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FolderIcon className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">{t('dashboard.noExpeditions')}</p>
                <p className="text-gray-400 text-xs mt-1">{t('dashboard.createFirstExpedition')}</p>
                <Link to="/expeditions/new" className="inline-flex items-center gap-1.5 text-sm text-sky-600 font-medium mt-4 hover:text-sky-700">
                  <PlusIcon className="w-4 h-4" /> {t('dashboard.createExpedition')}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentExpeditions.map((exp) => {
                  const sc = getStatusConfig(exp.status)
                  return (
                    <Link key={exp._id} to={`/expeditions/${exp._id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">{exp.expeditionId}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${sc.badge}`}>
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {exp.client?.companyName || t('dashboard.noClient')}
                          <span className="mx-1.5 text-gray-300">·</span>
                          {exp.operationType === 'IMPORT' || exp.operationType === 'import' ? t('common.import') : t('common.export')}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400">
                          {new Date(exp.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <ArrowRightIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-sky-500 transition-colors flex-shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* AI Stats Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <SparklesIcon className="w-4 h-4 text-sky-400" />
                  <h3 className="font-semibold text-white text-sm">{t('dashboard.aiEngine')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xl font-bold text-sky-400">{cacheStats?.totalEntries || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('dashboard.taricCodes')}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xl font-bold text-emerald-400">{cacheStats?.totalHits || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('dashboard.aiQueries')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] text-slate-400">{t('dashboard.activeModel')}</p>
                </div>
              </div>
            </div>

            {/* Platform Stats */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">{t('dashboard.platform')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                      <GlobeAltIcon className="w-4 h-4 text-sky-600" />
                    </div>
                    <span className="text-sm text-gray-600">{t('dashboard.countries')}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">195</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                      <TagIcon className="w-4 h-4 text-violet-600" />
                    </div>
                    <span className="text-sm text-gray-600">{t('dashboard.taricChapters')}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">98</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <ClockIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-gray-600">{t('dashboard.aiClassification')}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{t('dashboard.lessThan3Sec')}</span>
                </div>
              </div>
            </div>

            {/* LUCI Assistant CTA */}
            <Link to="/assistant" className="block bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl p-5 hover:shadow-lg hover:shadow-sky-500/20 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t('dashboard.luciAssistant')}</p>
                  <p className="text-sky-100 text-xs">{t('dashboard.aiRegulationQuery')}</p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
