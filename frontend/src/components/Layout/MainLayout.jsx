import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { HelpButton, HelpModal } from '../Help'
import useContextualHelp from '../../hooks/useContextualHelp'
import FloatingAssistant from './FloatingAssistant'
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

// Grupos del sidebar
const navGroups = [
  {
    id: 'operations',
    label: 'Operaciones',
    icon: HomeIcon,
    items: [
      { path: '/', icon: HomeIcon, label: 'Dashboard' },
      { path: '/expeditions', icon: FolderIcon, label: 'Expedientes' },
      { path: '/channels', icon: SignalIcon, label: 'Circuitos' },
      { path: '/requirements', icon: ClipboardDocumentCheckIcon, label: 'Requerimientos' },
    ]
  },
  {
    id: 'declarations',
    label: 'Declaraciones',
    icon: DocumentTextIcon,
    items: [
      { path: '/classification', icon: TagIcon, label: 'Clasificacion TARIC' },
      { path: '/declarations', icon: DocumentTextIcon, label: 'Declaraciones H1' },
      { path: '/h7', icon: ShoppingCartIcon, label: 'H7 E-commerce' },
      { path: '/ens', icon: DocumentTextIcon, label: 'ENS/ICS2' },
      { path: '/pue', icon: ClipboardDocumentCheckIcon, label: 'PUE SOIVRE' },
    ]
  },
  {
    id: 'calculation',
    label: 'Calculo y Normativa',
    icon: CalculatorIcon,
    items: [
      { path: '/calculator', icon: CalculatorIcon, label: 'Calculadora Derechos' },
      { path: '/preferences', icon: GlobeAltIcon, label: 'Preferencias' },
      { path: '/rules-engine', icon: BeakerIcon, label: 'Motor de Reglas' },
      { path: '/excise-duties', icon: BeakerIcon, label: 'Imp. Especiales' },
      { path: '/quotas', icon: ChartBarIcon, label: 'Contingentes' },
      { path: '/regulations', icon: BookOpenIcon, label: 'Normativa CAU/BOE' },
    ]
  },
  {
    id: 'control',
    label: 'Control Aduanero',
    icon: ClipboardDocumentCheckIcon,
    items: [
      { path: '/deadlines', icon: ClockIcon, label: 'Plazos' },
      { path: '/inspections', icon: MagnifyingGlassIcon, label: 'Inspecciones' },
      { path: '/communications', icon: EnvelopeIcon, label: 'Comunicaciones' },
      { path: '/queries', icon: MagnifyingGlassIcon, label: 'Consultas ADDS' },
    ]
  },
  {
    id: 'regimes',
    label: 'Regimenes',
    icon: BuildingLibraryIcon,
    items: [
      { path: '/guarantees', icon: ShieldCheckIcon, label: 'Garantias' },
      { path: '/oea', icon: IdentificationIcon, label: 'OEA' },
      { path: '/special-regimes', icon: CubeTransparentIcon, label: 'Regimenes Especiales' },
      { path: '/transit', icon: TruckIcon, label: 'Transitos NCTS' },
    ]
  },
  {
    id: 'integrations',
    label: 'AEAT e Integraciones',
    icon: LinkIcon,
    items: [
      { path: '/aeat/certificates', icon: KeyIcon, label: 'Certificados AEAT' },
      { path: '/aeat/monitor', icon: SignalIcon, label: 'Monitor AEAT' },
      { path: '/integrations', icon: CloudIcon, label: 'Integraciones' },
    ]
  },
  {
    id: 'admin',
    label: 'Administracion',
    icon: AdjustmentsHorizontalIcon,
    items: [
      { path: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
      { path: '/settings', icon: Cog6ToothIcon, label: 'Configuracion' },
      { path: '/billing', icon: CreditCardIcon, label: 'Facturacion' },
      { path: '/ml-insights', icon: SparklesIcon, label: 'ML Insights' },
      { path: '/admin', icon: UserGroupIcon, label: 'Admin Panel' },
    ]
  }
]

function SidebarGroup({ group, isExpanded, isActive, isOpen, onToggle, onNavClick }) {
  const GroupIcon = group.icon

  if (!isExpanded) {
    // Collapsed: show only first item icon or group icon
    return (
      <div className="mb-1">
        {group.items.map(({ path, icon: Icon, label }) => (
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
            title={label}
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
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-2 pl-2 border-l border-slate-700 space-y-0.5 mt-0.5">
          {group.items.map(({ path, icon: Icon, label }) => (
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
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MainLayout() {
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
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
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
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <button
            className={`hidden lg:flex p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-all ${isExpanded ? '' : 'absolute -right-3 top-5 bg-slate-800 border border-slate-600 shadow-lg'}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Fijar menu' : 'Colapsar menu'}
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
            title={!isExpanded ? 'Asistente LUCI' : undefined}
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Asistente LUCI
            </span>
            {isExpanded && (
              <span className="ml-auto text-[10px] bg-sky-400/20 text-sky-300 px-1.5 py-0.5 rounded-full">IA</span>
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
                {user?.name || 'Usuario'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role === 'admin' ? 'Administrador' : 'Agente Aduanero'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${!isExpanded ? 'justify-center' : ''}`}
            title={!isExpanded ? 'Cerrar Sesion' : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Cerrar Sesion
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
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 hidden sm:block">
              Powered by Strix AI
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <FloatingAssistant />
      <HelpButton onClick={openHelp} />
      <HelpModal isOpen={helpOpen} onClose={closeHelp} helpData={helpData} />
    </div>
  )
}
