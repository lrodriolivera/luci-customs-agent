import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm">
          <p>
            Utilizamos cookies esenciales para el funcionamiento de la plataforma.
            Al continuar navegando, aceptas su uso.{' '}
            <Link to="/cookies" className="text-sky-400 hover:text-sky-300 underline">
              Politica de Cookies
            </Link>
          </p>
        </div>
        <button
          onClick={accept}
          className="bg-luci hover:bg-luci-dark text-white px-6 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
