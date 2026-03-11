import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  TagIcon,
  CalculatorIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ArrowRightIcon,
  SparklesIcon,
  GlobeAltIcon,
  ClockIcon,
  BuildingOfficeIcon,
  TruckIcon,
  CubeTransparentIcon,
  EnvelopeIcon,
  PhoneIcon
} from '@heroicons/react/24/outline'

export default function LandingPage() {
  const { t } = useTranslation()
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' })
  const [formSent, setFormSent] = useState(false)

  const features = [
    { icon: TagIcon, title: t('landing.feature1Title'), description: t('landing.feature1Desc') },
    { icon: CalculatorIcon, title: t('landing.feature2Title'), description: t('landing.feature2Desc') },
    { icon: ClipboardDocumentCheckIcon, title: t('landing.feature3Title'), description: t('landing.feature3Desc') },
    { icon: DocumentTextIcon, title: t('landing.feature4Title'), description: t('landing.feature4Desc') },
    { icon: ShieldCheckIcon, title: t('landing.feature5Title'), description: t('landing.feature5Desc') },
    { icon: ChatBubbleLeftRightIcon, title: t('landing.feature6Title'), description: t('landing.feature6Desc') }
  ]

  const audiences = [
    { icon: BuildingOfficeIcon, title: t('landing.audience1Title'), description: t('landing.audience1Desc') },
    { icon: TruckIcon, title: t('landing.audience2Title'), description: t('landing.audience2Desc') },
    { icon: CubeTransparentIcon, title: t('landing.audience3Title'), description: t('landing.audience3Desc') }
  ]

  const plans = [
    {
      name: 'Professional',
      planId: 'professional',
      price: '149',
      period: t('landing.perMonth'),
      description: t('landing.planProfessionalDesc'),
      features: [
        '50 declaraciones / mes',
        'H1, H7, AES, NCTS, ENS completos',
        'Envio directo a AEAT',
        'Hasta 5 usuarios',
        'PDF declaraciones (DUA oficial)',
        'Clasificacion TARIC con IA',
        'Portal de clientes',
      ],
      cta: t('landing.requestFreeDemo'),
      ctaLink: '/login?plan=professional',
      highlighted: false
    },
    {
      name: 'Business',
      planId: 'business',
      price: '749',
      period: t('landing.perMonth'),
      description: t('landing.planBusinessDesc'),
      features: [
        '200 declaraciones / mes',
        'Todo de Professional',
        'PUE SOIVRE / ROHS completo',
        'Hasta 15 usuarios',
        'API publica + analytics',
        'Soporte prioritario',
      ],
      cta: t('landing.requestDemo'),
      ctaLink: '/login?plan=business',
      highlighted: true
    },
    {
      name: 'Enterprise',
      planId: 'enterprise',
      price: t('landing.planCustom'),
      period: '',
      description: t('landing.planEnterpriseDesc'),
      features: [
        'Declaraciones ilimitadas',
        'Todo de Business',
        'Usuarios ilimitados',
        'Integraciones custom (ERP, WMS)',
        'Soporte dedicado + onboarding',
        'SLA 99.9%',
      ],
      cta: t('landing.contact'),
      ctaLink: '#contact',
      highlighted: false
    }
  ]

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      })
      if (res.ok) {
        setFormSent(true)
        setContactForm({ name: '', email: '', company: '', message: '' })
        setTimeout(() => setFormSent(false), 8000)
      }
    } catch {
      setFormSent(true)
      setTimeout(() => setFormSent(false), 5000)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <div>
                <span className="font-bold text-lg text-gray-900 tracking-tight">LUCI</span>
                <span className="text-[10px] text-gray-400 block -mt-1">by Strix AI</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">{t('landing.features')}</a>
              <a href="#for-who" className="text-gray-600 hover:text-gray-900 transition-colors">{t('landing.forWhom')}</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">{t('landing.pricing')}</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors">{t('landing.contact')}</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                {t('landing.login')}
              </Link>
              <a href="#contact" className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-sky-500/25 transition-all">
                {t('landing.requestDemo')}
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-sky-50/50 via-white to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-sky-50 text-sky-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-sky-100">
            <SparklesIcon className="w-4 h-4" />
            {t('landing.aiPowered')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
            {t('landing.heroTitle1')}
            <br />
            <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
              {t('landing.heroTitle2')}
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {t('landing.heroDescription')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#contact" className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:shadow-xl hover:shadow-sky-500/25 transition-all text-center">
              {t('landing.requestFreeDemo')}
            </a>
            <Link to="/login" className="w-full sm:w-auto bg-white text-gray-700 font-semibold px-8 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-center">
              {t('landing.requestDemo')}
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">{t('landing.trialInfo')}</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {t('landing.featuresTitle')}
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              {t('landing.featuresSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-gray-100 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-500/5 transition-all">
                <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-sky-100 transition-colors">
                  <feature.icon className="w-6 h-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '98', label: t('landing.statChapters') },
              { value: '195', label: t('landing.statCountries') },
              { value: '<3s', label: t('landing.statAiClassification') },
              { value: '24/7', label: t('landing.statAvailability') },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Who */}
      <section id="for-who" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">{t('landing.audienceTitle')}</h2>
            <p className="mt-4 text-lg text-gray-600">{t('landing.audienceSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {audiences.map((audience, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-blue-600 rounded-xl flex items-center justify-center mb-5 shadow-lg shadow-sky-500/20">
                  <audience.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{audience.title}</h3>
                <p className="text-gray-600 leading-relaxed">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">{t('landing.pricingTitle')}</h2>
            <p className="mt-4 text-lg text-gray-600">{t('landing.pricingSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div key={i} className={`relative rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-sky-50 to-blue-50 border-2 border-sky-300 shadow-xl shadow-sky-500/10'
                  : 'bg-white border border-gray-200'
              }`}>
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    {t('landing.mostPopular')}
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  <div className="mt-4 mb-6">
                    {plan.price === t('landing.planCustom') ? (
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    ) : (
                      <div>
                        <span className="text-4xl font-bold text-gray-900">{plan.price}EUR</span>
                        <span className="text-gray-500">{plan.period}</span>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <CheckIcon className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaLink}
                  className={`block w-full text-center py-2.5 rounded-lg font-medium text-sm transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg hover:shadow-sky-500/25'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">{t('landing.contactTitle')}</h2>
            <p className="mt-4 text-lg text-slate-400">{t('landing.contactSubtitle')}</p>
          </div>

          {formSent ? (
            <div className="text-center py-12 bg-slate-800 rounded-2xl">
              <CheckIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white">{t('landing.contactSuccess')}</h3>
              <p className="text-slate-400 mt-2">{t('landing.contactSuccessDesc')}</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="bg-slate-800 rounded-2xl p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('landing.contactNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
                    placeholder={t('landing.contactName')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('landing.contactEmailLabel')}</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
                    placeholder={t('landing.contactEmail')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('landing.contactCompanyLabel')}</label>
                <input
                  type="text"
                  value={contactForm.company}
                  onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
                  placeholder={t('landing.contactCompany')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{t('landing.contactMessage')}</label>
                <textarea
                  rows={3}
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 resize-none"
                  placeholder={t('landing.contactMessagePlaceholder')}
                />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg hover:shadow-sky-500/25 transition-all">
                {t('landing.contactButton')}
              </button>
              <p className="text-center text-xs text-slate-500">{t('landing.contactResponse')}</p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">L</span>
              </div>
              <span className="font-bold text-white">LUCI</span>
              <span className="text-slate-500 text-sm">by Strix AI</span>
            </div>
            <div className="flex items-center flex-wrap gap-4 sm:gap-6 text-sm text-slate-400">
              <a href="https://strixai.es" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">strixai.es</a>
              <Link to="/privacy" className="hover:text-white transition-colors">{t('landing.footerPrivacy')}</Link>
              <Link to="/terms" className="hover:text-white transition-colors">{t('landing.footerTerms')}</Link>
              <Link to="/cookies" className="hover:text-white transition-colors">{t('landing.footerCookies')}</Link>
            </div>
            <p className="text-sm text-slate-500">
              Strix AI {new Date().getFullYear()}. {t('landing.footerRights')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
