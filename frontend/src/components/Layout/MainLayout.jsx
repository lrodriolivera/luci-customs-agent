import React, { useState } from 'react'
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
  ShoppingCartIcon
} from '@heroicons/react/24/outline'

const navItems = [
  { path: '/', icon: HomeIcon, label: 'Dashboard' },
  { path: '/expeditions', icon: FolderIcon, label: 'Expedientes' },
  { path: '/channels', icon: SignalIcon, label: 'Circuitos' },
  { path: '/requirements', icon: ClipboardDocumentCheckIcon, label: 'Requerimientos' },
  { path: '/classification', icon: TagIcon, label: 'Clasificacion' },
  { path: '/declarations', icon: DocumentTextIcon, label: 'Declaraciones' },
  { path: '/h7', icon: ShoppingCartIcon, label: 'H7 E-commerce' },
  { path: '/calculator', icon: CalculatorIcon, label: 'Calculadora' },
  { path: '/assistant', icon: ChatBubbleLeftRightIcon, label: 'Asistente LUCI' }
]

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-white border-r border-gray-200
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-luci rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">L</span>
            </div>
            <span className="font-semibold text-xl text-gray-800">LUCI</span>
          </div>
          <button
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-luci-light rounded-full flex items-center justify-center">
              <span className="text-luci font-medium">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
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
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Cerrar Sesion</span>
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
              Stock Logistic - Agente Aduanero
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
