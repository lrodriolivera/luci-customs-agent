import React, { useState } from 'react'
import { Link } from 'react-router-dom'
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

const features = [
  {
    icon: TagIcon,
    title: 'Clasificacion TARIC con IA',
    description: 'Clasificacion arancelaria automatica con inteligencia artificial. Navega el arbol TARIC completo generado en tiempo real.'
  },
  {
    icon: CalculatorIcon,
    title: 'Calculo de Derechos',
    description: 'Calcula aranceles, IVA y preferencias comerciales al instante. Incluye tarifas estacionales y precios de entrada.'
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: 'PUE SOIVRE/ROHS Digital',
    description: 'Solicitudes de inspeccion SOIVRE y ROHS/RAEE automatizadas con autorrelleno desde MRN y validacion RII.'
  },
  {
    icon: DocumentTextIcon,
    title: 'Declaraciones H1/H7/ENS',
    description: 'Genera declaraciones aduaneras H1, H7 e-commerce y ENS/ICS2 con asistencia de inteligencia artificial.'
  },
  {
    icon: ShieldCheckIcon,
    title: 'Regimenes y Garantias',
    description: 'Gestion completa de regimenes especiales, garantias CGU, OEA y transitos NCTS.'
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Asistente IA 24/7',
    description: 'Consulta normativa CAU, reglamentos y procedimientos aduaneros con un experto virtual disponible siempre.'
  }
]

const audiences = [
  {
    icon: BuildingOfficeIcon,
    title: 'Agentes de Aduanas',
    description: 'Acelera tu despacho aduanero con clasificacion IA, calculo automatico de derechos y gestion integral de expedientes.'
  },
  {
    icon: TruckIcon,
    title: 'Freight Forwarders',
    description: 'Integra el despacho aduanero en tu cadena logistica. Declaraciones H1, PUE SOIVRE y control de circuitos en una sola plataforma.'
  },
  {
    icon: CubeTransparentIcon,
    title: 'Importadores y Exportadores',
    description: 'Controla tus operaciones de comercio exterior. Visibilidad completa de aranceles, plazos e inspecciones.'
  }
]

const plans = [
  {
    name: 'Starter',
    planId: 'free',
    price: 'Gratis',
    period: '',
    description: 'Para probar la plataforma',
    features: [
      '10 clasificaciones IA / mes',
      'Calculadora de derechos basica',
      'Arbol TARIC completo',
      '1 usuario',
    ],
    cta: 'Empezar Gratis',
    ctaLink: '/login',
    highlighted: false
  },
  {
    name: 'Professional',
    planId: 'professional',
    price: '149',
    period: '/ mes',
    description: 'Para agencias y transitarios',
    features: [
      'Clasificaciones IA ilimitadas',
      'PUE SOIVRE / ROHS completo',
      'Declaraciones H1, H7, ENS',
      'Hasta 5 usuarios',
      'Motor de reglas y preferencias',
      'Soporte por email',
    ],
    cta: 'Probar 14 dias gratis',
    ctaLink: '/login?plan=professional',
    highlighted: true
  },
  {
    name: 'Enterprise',
    planId: 'enterprise',
    price: 'Personalizado',
    period: '',
    description: 'Para grandes operadores',
    features: [
      'Todo de Professional',
      'Usuarios ilimitados',
      'Acceso API',
      'Integraciones custom (AEAT, ERP)',
      'Soporte prioritario + onboarding',
      'SLA 99.9%',
    ],
    cta: 'Contactar Ventas',
    ctaLink: '#contact',
    highlighted: false
  }
]

export default function LandingPage() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' })
  const [formSent, setFormSent] = useState(false)

  const handleContactSubmit = (e) => {
    e.preventDefault()
    // In a real app, this would send to an API
    setFormSent(true)
    setTimeout(() => setFormSent(false), 5000)
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
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Funciones</a>
              <a href="#for-who" className="text-gray-600 hover:text-gray-900 transition-colors">Para quien</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Precios</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contacto</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Iniciar Sesion
              </Link>
              <a href="#contact" className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-sky-500/25 transition-all">
                Solicitar Demo
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
            Potenciado por Inteligencia Artificial
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
            Tu Agente Aduanero
            <br />
            <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
              Inteligente
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Clasificacion TARIC con IA, calculo de derechos automatico y gestion completa de declaraciones aduaneras. Todo en una sola plataforma.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#contact" className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:shadow-xl hover:shadow-sky-500/25 transition-all text-center">
              Solicitar Demo Gratuita
            </a>
            <Link to="/login" className="w-full sm:w-auto bg-white text-gray-700 font-semibold px-8 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-center">
              Probar Gratis
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Sin tarjeta de credito. 10 clasificaciones IA gratis al mes.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Todo lo que necesitas para el despacho aduanero
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Una plataforma integral que combina inteligencia artificial con el conocimiento experto en aduanas
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
              { value: '98', label: 'Capitulos TARIC' },
              { value: '195', label: 'Paises cubiertos' },
              { value: '<3s', label: 'Clasificacion IA' },
              { value: '24/7', label: 'Disponibilidad' },
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Dissenado para profesionales del comercio exterior</h2>
            <p className="mt-4 text-lg text-gray-600">Sea cual sea tu rol en la cadena de suministro, LUCI te ayuda</p>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Planes simples y transparentes</h2>
            <p className="mt-4 text-lg text-gray-600">Empieza gratis, escala cuando lo necesites</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div key={i} className={`relative rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-sky-50 to-blue-50 border-2 border-sky-300 shadow-xl shadow-sky-500/10'
                  : 'bg-white border border-gray-200'
              }`}>
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Mas Popular
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  <div className="mt-4 mb-6">
                    {plan.price === 'Gratis' || plan.price === 'Personalizado' ? (
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
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Solicita una demo personalizada</h2>
            <p className="mt-4 text-lg text-slate-400">Te mostramos como LUCI puede transformar tu despacho aduanero en 15 minutos</p>
          </div>

          {formSent ? (
            <div className="text-center py-12 bg-slate-800 rounded-2xl">
              <CheckIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white">Solicitud enviada</h3>
              <p className="text-slate-400 mt-2">Nos pondremos en contacto contigo en menos de 24h</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="bg-slate-800 rounded-2xl p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
                    placeholder="tu@empresa.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Empresa</label>
                <input
                  type="text"
                  value={contactForm.company}
                  onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
                  placeholder="Nombre de tu empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Mensaje (opcional)</label>
                <textarea
                  rows={3}
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 resize-none"
                  placeholder="Cuentanos sobre tu operativa..."
                />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg hover:shadow-sky-500/25 transition-all">
                Solicitar Demo Gratuita
              </button>
              <p className="text-center text-xs text-slate-500">Te respondemos en menos de 24 horas laborables</p>
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
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="https://strixai.es" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">strixai.es</a>
              <span>info@strixai.es</span>
            </div>
            <p className="text-sm text-slate-500">
              Strix AI {new Date().getFullYear()}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
