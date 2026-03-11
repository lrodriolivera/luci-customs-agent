import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('legal.privacyTitle')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('legal.lastUpdated')}</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS1Title')}</h2>
            <p className="text-gray-700">
              <strong>STRIX AI SL</strong> {t('legal.privacyS1Text1').replace('STRIX AI SL (en adelante, "STRIX AI"), con', '(en adelante, "STRIX AI"), con')}
            </p>
            <p className="text-gray-700">{t('legal.privacyS1Contact')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS2Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS2Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>{t('legal.privacyS2Registration')}</strong></li>
              <li><strong>{t('legal.privacyS2Usage')}</strong></li>
              <li><strong>{t('legal.privacyS2Billing')}</strong></li>
              <li><strong>{t('legal.privacyS2Customs')}</strong></li>
              <li><strong>{t('legal.privacyS2Technical')}</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS3Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS3Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>{t('legal.privacyS3Account')}</li>
              <li>{t('legal.privacyS3Declarations')}</li>
              <li>{t('legal.privacyS3Classification')}</li>
              <li>{t('legal.privacyS3Duties')}</li>
              <li>{t('legal.privacyS3Notifications')}</li>
              <li>{t('legal.privacyS3BillingPurpose')}</li>
              <li>{t('legal.privacyS3Improve')}</li>
              <li>{t('legal.privacyS3Legal')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS4Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS4Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>{t('legal.privacyS4Contract')}</strong></li>
              <li><strong>{t('legal.privacyS4Obligation')}</strong></li>
              <li><strong>{t('legal.privacyS4Interest')}</strong></li>
              <li><strong>{t('legal.privacyS4Consent')}</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS5Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS5Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>{t('legal.privacyS5Aeat')}</strong></li>
              <li><strong>{t('legal.privacyS5Stripe')}</strong></li>
              <li><strong>{t('legal.privacyS5Aws')}</strong></li>
              <li><strong>{t('legal.privacyS5Anthropic')}</strong></li>
            </ul>
            <p className="text-gray-700 mt-2">{t('legal.privacyS5NoSell')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS6Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS6Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS7Title')}</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>{t('legal.privacyS7Account')}</strong></li>
              <li><strong>{t('legal.privacyS7Customs')}</strong></li>
              <li><strong>{t('legal.privacyS7Billing')}</strong></li>
              <li><strong>{t('legal.privacyS7Logs')}</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS8Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS8Intro')}</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>{t('legal.privacyS8Access')}</strong></li>
              <li><strong>{t('legal.privacyS8Rectification')}</strong></li>
              <li><strong>{t('legal.privacyS8Erasure')}</strong></li>
              <li><strong>{t('legal.privacyS8Restriction')}</strong></li>
              <li><strong>{t('legal.privacyS8Portability')}</strong></li>
              <li><strong>{t('legal.privacyS8Objection')}</strong></li>
            </ul>
            <p className="text-gray-700 mt-2">{t('legal.privacyS8Contact')}</p>
            <p className="text-gray-700 mt-2">
              {t('legal.privacyS8Aepd')} <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">www.aepd.es</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS9Title')}</h2>
            <p className="text-gray-700">{t('legal.privacyS9Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS10Title')}</h2>
            <p className="text-gray-700">
              {t('legal.privacyS10Text')} <Link to="/cookies" className="text-luci hover:text-luci-dark">{t('legal.cookiesTitle')}</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{t('legal.privacyS11Title')}</h2>
            <p className="text-gray-700">
              {t('legal.contactStrix')}<br />
              {t('legal.contactNif')}<br />
              {t('legal.contactEmail')}<br />
              {t('legal.contactWeb')}
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
