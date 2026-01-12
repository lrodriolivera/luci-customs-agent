import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useParams } from 'react-router-dom'
import { portalAPI } from '../../services/api'
import {
  HomeIcon,
  DocumentArrowUpIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export default function PortalLayout() {
  const { token } = useParams()
  const [expedition, setExpedition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchExpedition = async () => {
      try {
        const response = await portalAPI.access(token)
        setExpedition(response.data.expedition)
      } catch (err) {
        setError(err.response?.data?.message || 'Enlace no valido o expirado')
      } finally {
        setLoading(false)
      }
    }

    fetchExpedition()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-luci rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando portal...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso No Disponible
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Si cree que esto es un error, contacte con Stock Logistic.
          </p>
        </div>
      </div>
    )
  }

  const navItems = [
    { path: `/portal/${token}`, icon: HomeIcon, label: 'Inicio', end: true },
    { path: `/portal/${token}/documents`, icon: DocumentArrowUpIcon, label: 'Documentos' },
    { path: `/portal/${token}/chat`, icon: ChatBubbleLeftRightIcon, label: 'Chat con LUCI' },
    { path: `/portal/${token}/status`, icon: ClockIcon, label: 'Estado' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-luci rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">L</span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Portal de Cliente</h1>
                <p className="text-sm text-gray-500">Stock Logistic</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {expedition?.client?.companyName}
              </p>
              <p className="text-xs text-gray-500">
                Expediente: {expedition?.expeditionId}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1 mt-4 -mb-px">
            {navItems.map(({ path, icon: Icon, label, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                    isActive
                      ? 'border-luci text-luci bg-luci-light bg-opacity-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet context={{ expedition, token }} />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-medium text-luci">LUCI</span> - Agente Aduanero Inteligente
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Stock Logistic &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}
