import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { HelpButton, HelpModal } from '../Help'
import useContextualHelp from '../../hooks/useContextualHelp'
import FloatingAssistant from './FloatingAssistant'
import LanguageSelector from './LanguageSelector'
import {
  HomeIcon,
  FolderIcon,
  TagIcon,
  DocumentTextIcon,
  CalculatorIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  SignalIcon,
  ShoppingCartIcon,
  ShieldCheckIcon,
  CubeTransparentIcon,
  TruckIcon,
  BeakerIcon,
  GlobeAltIcon,
  ChartBarIcon,
  IdentificationIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  CloudIcon,
  KeyIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserGroupIcon,
  BuildingLibraryIcon,
  LinkIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'

// Grupos del sidebar (con claves i18n)
const navGroups = [
  {
    id: 'operations',
    labelKey: 'nav.operations',
    icon: HomeIcon,
    items: [
      { path: '/', icon: HomeIcon, labelKey: 'nav.dashboard' },
      { path: '/expeditions', icon: FolderIcon, labelKey: 'nav.expeditions' },
      { path: '/channels', icon: SignalIcon, labelKey: 'nav.channels' },
      { path: '/requirements', icon: ClipboardDocumentCheckIcon, labelKey: 'nav.requirements' },
    ]
  },
  {
    id: 'declarations',
    labelKey: 'nav.declarations',
    icon: DocumentTextIcon,
    items: [
      { path: '/classification', icon: TagIcon, labelKey: 'nav.taricClassification' },
      { path: '/declarations', icon: DocumentTextIcon, labelKey: 'nav.declarationsH1' },
      { path: '/declarations/h1/new', icon: DocumentTextIcon, labelKey: 'nav.newH1' },
      { path: '/h7', icon: ShoppingCartIcon, labelKey: 'nav.h7Ecommerce' },
      { path: '/h7/new', icon: ShoppingCartIcon, labelKey: 'nav.newH7' },
      { path: '/ens', icon: DocumentTextIcon, labelKey: 'nav.ensIcs2' },
      { path: '/pue', icon: ClipboardDocumentCheckIcon, labelKey: 'nav.pueSoivre' },
    ]
  },
  {
    id: 'calculation',
    labelKey: 'nav.calculationRules',
    icon: CalculatorIcon,
    items: [
      { path: '/calculator', icon: CalculatorIcon, labelKey: 'nav.dutyCalculator' },
      { path: '/preferences', icon: GlobeAltIcon, labelKey: 'nav.preferences' },
      { path: '/rules-engine', icon: BeakerIcon, labelKey: 'nav.rulesEngine' },
      { path: '/excise-duties', icon: BeakerIcon, labelKey: 'nav.exciseDuties' },
      { path: '/quotas', icon: ChartBarIcon, labelKey: 'nav.quotas' },
      { path: '/regulations', icon: BookOpenIcon, labelKey: 'nav.regulationsCau' },
    ]
  },
  {
    id: 'control',
    labelKey: 'nav.customsControl',
    icon: ClipboardDocumentCheckIcon,
    items: [
      { path: '/deadlines', icon: ClockIcon, labelKey: 'nav.deadlines' },
      { path: '/inspections', icon: MagnifyingGlassIcon, labelKey: 'nav.inspections' },
      { path: '/communications', icon: EnvelopeIcon, labelKey: 'nav.communications' },
      { path: '/queries', icon: MagnifyingGlassIcon, labelKey: 'nav.queriesAdds' },
    ]
  },
  {
    id: 'regimes',
    labelKey: 'nav.regimes',
    icon: BuildingLibraryIcon,
    items: [
      { path: '/guarantees', icon: ShieldCheckIcon, labelKey: 'nav.guarantees' },
      { path: '/oea', icon: IdentificationIcon, labelKey: 'nav.oea' },
      { path: '/special-regimes', icon: CubeTransparentIcon, labelKey: 'nav.specialRegimes' },
      { path: '/transit', icon: TruckIcon, labelKey: 'nav.transitNcts' },
    ]
  },
  {
    id: 'integrations',
    labelKey: 'nav.aeatIntegrations',
    icon: LinkIcon,
    items: [
      { path: '/aeat/certificates', icon: KeyIcon, labelKey: 'nav.aeatCertificates' },
      { path: '/aeat/monitor', icon: SignalIcon, labelKey: 'nav.aeatMonitor' },
      { path: '/nl-customs', icon: GlobeAltIcon, labelKey: 'nav.nlCustoms' },
      { path: '/integrations', icon: CloudIcon, labelKey: 'nav.integrations' },
    ]
  },
  {
    id: 'admin',
    labelKey: 'nav.administration',
    icon: AdjustmentsHorizontalIcon,
    items: [
      { path: '/analytics', icon: ChartBarIcon, labelKey: 'nav.analytics' },
      { path: '/settings', icon: Cog6ToothIcon, labelKey: 'nav.settings' },
      { path: '/ml-insights', icon: SparklesIcon, labelKey: 'nav.mlInsights' },
      { path: '/admin', icon: UserGroupIcon, labelKey: 'nav.adminPanel' },
    ]
  }
]

function SidebarGroup({ group, isExpanded, isActive, isOpen, onToggle, onNavClick, t }) {
  const GroupIcon = group.icon

  if (!isExpanded) {
    return (
      <div className="mb-1">
        {group.items.map(({ path, icon: Icon, labelKey }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive: active }) =>
              `flex items-center justify-center p-2 rounded-lg transition-colors mb-0.5 ${
                active
                  ? 'bg-sky-500/20 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`
            }
            onClick={onNavClick}
            title={t(labelKey)}
          >
            <Icon className="w-5 h-5" />
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
          isActive
            ? 'text-sky-300'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <GroupIcon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{t(group.labelKey)}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-2 pl-2 border-l border-slate-700 space-y-0.5 mt-0.5">
          {group.items.map(({ path, icon: Icon, labelKey }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive: active }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-sky-500/20 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                }`
              }
              onClick={onNavClick}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t(labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MainLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })
  const [isHovered, setIsHovered] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const { isOpen: helpOpen, open: openHelp, close: closeHelp, helpData } = useContextualHelp()

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
  }, [isCollapsed])

  // Auto-expand the group containing the active route
  useEffect(() => {
    const activeGroup = navGroups.find(g =>
      g.items.some(item =>
        item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path)
      )
    )
    if (activeGroup) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.id]: true }))
    }
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleGroup = (groupId) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const isGroupActive = (group) => {
    return group.items.some(item =>
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path)
    )
  }

  const isExpanded = !isCollapsed || isHovered

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Skip to content (accessibility) */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-luci focus:text-white focus:top-0 focus:left-0">
        {t('nav.skipToContent')}
      </a>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label={t('nav.mainMenu')}
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          bg-slate-900 text-white
          transform transition-all duration-300 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isExpanded ? 'w-64' : 'w-16'}
        `}
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
              <span className="font-bold text-lg text-white tracking-tight">LUCI</span>
              <span className="text-[10px] text-slate-400 block -mt-1">by Strix AI</span>
            </div>
          </div>
          <button
            className="lg:hidden p-1 text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <XMarkIcon className="w-6 h-6" aria-hidden="true" />
          </button>
          <button
            className={`hidden lg:flex p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-all ${isExpanded ? '' : 'absolute -right-3 top-5 bg-slate-800 border border-slate-600 shadow-lg'}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? t('nav.pinMenu') : t('nav.collapseMenu')}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <ChevronLeftIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar-dark">
          {navGroups.map(group => (
            <SidebarGroup
              key={group.id}
              group={group}
              isExpanded={isExpanded}
              isActive={isGroupActive(group)}
              isOpen={openGroups[group.id] || false}
              onToggle={() => toggleGroup(group.id)}
              onNavClick={() => setSidebarOpen(false)}
              t={t}
            />
          ))}
        </nav>

        {/* LUCI Assistant button */}
        <div className="flex-shrink-0 px-2 pb-2">
          <NavLink
            to="/assistant"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              } ${!isExpanded ? 'justify-center' : ''}`
            }
            title={!isExpanded ? t('nav.luciAssistant') : undefined}
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {t('nav.luciAssistant')}
            </span>
            {isExpanded && (
              <span className="ml-auto text-[10px] bg-sky-400/20 text-sky-300 px-1.5 py-0.5 rounded-full">{t('nav.ai')}</span>
            )}
          </NavLink>
        </div>

        {/* User section */}
        <div className="flex-shrink-0 p-3 border-t border-slate-700/50">
          <div className={`flex items-center gap-3 mb-2 ${!isExpanded ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              <p className="text-sm font-medium text-white truncate">
                {user?.name || t('nav.user')}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role === 'admin' ? t('nav.admin') : t('nav.customsAgent')}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${!isExpanded ? 'justify-center' : ''}`}
            title={!isExpanded ? t('nav.logout') : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {t('nav.logout')}
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 -ml-2"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Bars3Icon className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector variant="header" />
            <span className="text-xs text-gray-400 hidden sm:block">
              {t('common.poweredBy')}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" role="main" className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <FloatingAssistant />
      <HelpButton onClick={openHelp} />
      <HelpModal isOpen={helpOpen} onClose={closeHelp} helpData={helpData} />
    </div>
  )
}
