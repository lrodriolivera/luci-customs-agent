import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
  SignalSlashIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

const navItems = [
  { path: '/', icon: HomeIcon, label: 'Dashboard' },
  { path: '/expeditions', icon: FolderIcon, label: 'Expedientes' },
  { path: '/channels', icon: SignalIcon, label: 'Circuitos' },
  { path: '/requirements', icon: ClipboardDocumentCheckIcon, label: 'Requerimientos' },
  { path: '/deadlines', icon: ClockIcon, label: 'Plazos' },
  { path: '/inspections', icon: MagnifyingGlassIcon, label: 'Inspecciones' },
  { path: '/communications', icon: EnvelopeIcon, label: 'Comunicaciones' },
  { path: '/classification', icon: TagIcon, label: 'Clasificacion' },
  { path: '/regulations', icon: BookOpenIcon, label: 'Normativa CAU/BOE' },
  { path: '/declarations', icon: DocumentTextIcon, label: 'Declaraciones' },
  { path: '/h7', icon: ShoppingCartIcon, label: 'H7 E-commerce' },
  { path: '/ens', icon: DocumentTextIcon, label: 'ENS/ICS2' },
  { path: '/queries', icon: MagnifyingGlassIcon, label: 'Consultas ADDS' },
  { path: '/pue', icon: ClipboardDocumentCheckIcon, label: 'PUE SOIVRE' },
  { path: '/guarantees', icon: ShieldCheckIcon, label: 'Garantias' },
  { path: '/oea', icon: IdentificationIcon, label: 'OEA' },
  { path: '/special-regimes', icon: CubeTransparentIcon, label: 'Regimenes Esp.' },
  { path: '/transit', icon: TruckIcon, label: 'Transitos NCTS' },
  { path: '/calculator', icon: CalculatorIcon, label: 'Calculadora' },
  { path: '/rules-engine', icon: BeakerIcon, label: 'Motor de Reglas' },
  { path: '/preferences', icon: GlobeAltIcon, label: 'Preferencias' },
  { path: '/excise-duties', icon: BeakerIcon, label: 'Imp. Especiales' },
  { path: '/quotas', icon: ChartBarIcon, label: 'Contingentes' },
  { path: '/integrations', icon: CloudIcon, label: 'Integraciones' },
  // AEAT Real Integration (Phase 6.1)
  { path: '/aeat/certificates', icon: KeyIcon, label: 'Certificados AEAT' },
  { path: '/aeat/monitor', icon: SignalIcon, label: 'Monitor AEAT' },
  // Analytics & BI (Phase 6.2)
  { path: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  // Tenant & Multi-Tenancy (Phase 6.3)
  { path: '/settings', icon: Cog6ToothIcon, label: 'Configuracion' },
  { path: '/billing', icon: CreditCardIcon, label: 'Facturacion' },
  // Admin Panel
  { path: '/admin', icon: UserGroupIcon, label: 'Administracion' },
  // ML Advanced (Phase 6.5)
  { path: '/ml-insights', icon: SparklesIcon, label: 'ML Insights' },
  { path: '/assistant', icon: ChatBubbleLeftRightIcon, label: 'Asistente LUCI' }
]

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Recuperar estado guardado
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })
  const [isHovered, setIsHovered] = useState(false)

  // Guardar estado en localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
  }, [isCollapsed])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // El sidebar se expande si no está colapsado O si está siendo hovereado
  const isExpanded = !isCollapsed || isHovered

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isExpanded ? 'w-64' : 'w-16'}
        `}
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-luci rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold">L</span>
            </div>
            <span className={`font-semibold text-xl text-gray-800 whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
              LUCI
            </span>
          </div>
          {/* Mobile close button */}
          <button
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          {/* Desktop collapse toggle */}
          <button
            className={`hidden lg:flex p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all ${isExpanded ? '' : 'absolute -right-3 top-5 bg-white border border-gray-200 shadow-sm'}`}
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

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-luci-light text-luci'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${!isExpanded ? 'justify-center' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
              title={!isExpanded ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* User section - Fixed at bottom */}
        <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white">
          <div className={`flex items-center gap-3 mb-2 ${!isExpanded ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 bg-luci-light rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-luci font-medium text-sm">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Usuario'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role === 'admin' ? 'Administrador' : 'Agente Aduanero'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ${!isExpanded ? 'justify-center' : ''}`}
            title={!isExpanded ? 'Cerrar Sesion' : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Cerrar Sesion
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <button
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          <div className="flex-1 lg:flex-none" />

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Agente Aduanero
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
