import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function CookiePolicy() {
  const { t } = useTranslation()

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
          <Link to="/landing" className="text-sm text-luci hover:text-luci-dark">{t('legal.backToHome')}</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('legal.cookiesTitle')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('legal.lastUpdated')}</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.cookiesS1Title')}</h2>
            <p className="text-gray-700">{t('legal.cookiesS1Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.cookiesS2Title')}</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">{t('legal.cookiesS2aTitle')}</h3>
            <p className="text-gray-700 mb-3">{t('legal.cookiesS2aText')}</p>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">{t('legal.cookiesTableCookie')}</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">{t('legal.cookiesTablePurpose')}</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">{t('legal.cookiesTableDuration')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">token</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesTokenPurpose')}</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesTokenDuration')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">user</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesUserPurpose')}</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesUserDuration')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">cookie_consent</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesConsentPurpose')}</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesConsentDuration')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">{t('legal.cookiesS2bTitle')}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">{t('legal.cookiesTableProvider')}</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">{t('legal.cookiesTablePurpose')}</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">{t('legal.cookiesTableType')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2 text-gray-700">Stripe</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesStripePurpose')}</td>
                    <td className="px-4 py-2 text-gray-700">{t('legal.cookiesStripeType')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.cookiesS3Title')}</h2>
            <p className="text-gray-700">{t('legal.cookiesS3Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.cookiesS4Title')}</h2>
            <p className="text-gray-700">{t('legal.cookiesS4Text')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1 mt-2">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Safari</a></li>
              <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">Microsoft Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.cookiesS5Title')}</h2>
            <p className="text-gray-700">{t('legal.cookiesS5Text')}</p>
            <p className="text-gray-700 mt-2">
              {t('legal.cookiesS5Privacy')} <Link to="/privacy" className="text-luci hover:text-luci-dark">{t('legal.privacyTitle')}</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
