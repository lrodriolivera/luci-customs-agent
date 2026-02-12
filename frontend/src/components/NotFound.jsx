import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-luci/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-luci text-4xl font-bold">404</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagina no encontrada</h1>
        <p className="text-gray-600 mb-6">
          La pagina que buscas no existe o ha sido movida.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark font-medium"
          >
            Ir al Dashboard
          </Link>
          <Link
            to="/landing"
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Pagina Principal
          </Link>
        </div>
      </div>
    </div>
  )
}
