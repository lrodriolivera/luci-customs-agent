import React from 'react'
import { Link } from 'react-router-dom'

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-luci rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-gray-900">LUCI</span>
          </Link>
          <Link to="/landing" className="text-sm text-luci hover:text-luci-dark">Volver al inicio</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Politica de Cookies</h1>
        <p className="text-sm text-gray-500 mb-8">Ultima actualizacion: 12 de febrero de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Que son las Cookies</h2>
            <p className="text-gray-700">
              Las cookies son pequenos archivos de texto que se almacenan en su dispositivo al visitar
              un sitio web. Permiten al sitio recordar sus preferencias y mejorar su experiencia de navegacion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Cookies que Utilizamos</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">2.1 Cookies Estrictamente Necesarias</h3>
            <p className="text-gray-700 mb-3">
              Estas cookies son esenciales para el funcionamiento de la plataforma. No requieren consentimiento.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Cookie</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Finalidad</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Duracion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">token</td>
                    <td className="px-4 py-2 text-gray-700">Autenticacion del usuario (JWT)</td>
                    <td className="px-4 py-2 text-gray-700">7 dias</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">user</td>
                    <td className="px-4 py-2 text-gray-700">Datos de sesion del usuario</td>
                    <td className="px-4 py-2 text-gray-700">7 dias</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">cookie_consent</td>
                    <td className="px-4 py-2 text-gray-700">Registro de aceptacion de cookies</td>
                    <td className="px-4 py-2 text-gray-700">365 dias</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">2.2 Cookies de Terceros</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Proveedor</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Finalidad</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2 text-gray-700">Stripe</td>
                    <td className="px-4 py-2 text-gray-700">Procesamiento seguro de pagos</td>
                    <td className="px-4 py-2 text-gray-700">Necesaria</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Almacenamiento Local (localStorage)</h2>
            <p className="text-gray-700">
              Ademas de cookies, LUCI utiliza localStorage del navegador para almacenar el token de sesion
              y preferencias del usuario. Estos datos son esenciales para el funcionamiento de la aplicacion
              y se eliminan al cerrar sesion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Gestion de Cookies</h2>
            <p className="text-gray-700">
              Puede gestionar las cookies a traves de la configuracion de su navegador.
              Tenga en cuenta que desactivar las cookies esenciales puede impedir el correcto
              funcionamiento de la plataforma.
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1 mt-2">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Safari</a></li>
              <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Microsoft Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Contacto</h2>
            <p className="text-gray-700">
              Para cualquier consulta sobre nuestra politica de cookies, contacte con
              <strong> soporte@strixai.es</strong>.
            </p>
            <p className="text-gray-700 mt-2">
              Consulte tambien nuestra <Link to="/privacy" className="text-luci hover:text-luci-dark">Politica de Privacidad</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
