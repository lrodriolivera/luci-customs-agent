import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function TermsOfService() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('legal.termsTitle')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('legal.lastUpdated')}</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS1Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS1Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS2Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS2Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>{t('legal.termsS2Classify')}</li>
              <li>{t('legal.termsS2Calculate')}</li>
              <li>{t('legal.termsS2Generate')}</li>
              <li>{t('legal.termsS2Manage')}</li>
              <li>{t('legal.termsS2Portal')}</li>
              <li>{t('legal.termsS2Pdf')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS3Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS3Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS4Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS4Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>{t('legal.termsS4Starter')}</strong></li>
              <li><strong>{t('legal.termsS4Professional')}</strong></li>
              <li><strong>{t('legal.termsS4Business')}</strong></li>
              <li><strong>{t('legal.termsS4Enterprise')}</strong></li>
            </ul>
            <p className="text-gray-700 mt-2">{t('legal.termsS4Vat')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS5Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS5Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS6Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS6Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS7Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS7Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS8Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS8Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS9Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS9Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS10Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS10Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS11Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS11Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS12Title')}</h2>
            <p className="text-gray-700">{t('legal.termsS12Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.termsS13Title')}</h2>
            <p className="text-gray-700">
              {t('legal.contactStrix')} - {t('legal.contactNif')}<br />
              {t('legal.contactEmail')}<br />
              {t('legal.contactWeb')}
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
