import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { countriesGrouped } from '../../data/countries'
import {
  GlobeAltIcon,
  DocumentCheckIcon,
  CurrencyEuroIcon,
  SparklesIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { preferencesAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'

export default function PreferencesCalculator() {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState(null)
  const [certValidation, setCertValidation] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [activeTab, setActiveTab] = useState('eligibility') // eligibility | validation | optimize
  const [formData, setFormData] = useState({
    originCountry: 'CA',
    taricCode: '',
    customsValue: '',
    certificate: '',
    declarationOnOrigin: false,
    exporterType: 'normal',
    rexNumber: '',
    authorizedExporterNumber: ''
  })
  const [certData, setCertData] = useState({
    type: 'EUR.1',
    certificateNumber: '',
    issuedDate: '',
    exporterName: '',
    consigneeName: '',
    originCountry: ''
  })

  const handleCheck = async (e) => {
    e.preventDefault()

    if (!formData.originCountry || !formData.taricCode) {
      toast.error('Complete pais de origen y codigo TARIC')
      return
    }

    setChecking(true)
    setResult(null)

    try {
      const response = await preferencesAPI.checkEligibility({
        originCountry: formData.originCountry,
        goods: [{
          taricCode: formData.taricCode,
          customsValue: parseFloat(formData.customsValue) || 0,
          description: 'Producto a verificar'
        }]
      })

      if (response.data.success) {
        // Transform result for UI compatibility
        const eligibility = response.data.data
        setResult({
          available: eligibility.eligible,
          agreement: eligibility.recommended?.name || (eligibility.agreements[0]?.name),
          certificate: eligibility.recommended?.certificate || (eligibility.agreements[0]?.certificate),
          // El arancel NMF y el preferencial vienen del backend o no se muestran. Aqui
          // habia `standard: 0.125` fijo ("Default standard rate"): un arancel del 12,5%
          // INVENTADO, igual para toda mercancia, con el que se calculaba y presentaba un
          // "Ahorro Total" que no existia (p.ej. 6.250 EUR sobre 50.000 para un TARIC con
          // arancel real del 0% y `savings: 0` devuelto por el backend).
          standard: eligibility.standardRate ?? null,
          preferential: eligibility.recommended?.conditions?.find(c => c.type === 'preferential')?.rate ?? null,
          originRules: eligibility.agreements[0]?.conditions?.find(c => c.type === 'rvc') ?
            { regionalValueContent: 0.45, tolerance: 0.10 } :
            { general: 'Product-specific rules', tolerance: 0.10, regionalValueContent: 0.45 },
          savings: eligibility.savings,
          requirements: eligibility.requirements,
          warnings: eligibility.warnings
        })
        toast.success('Preferencias verificadas')

        // Also get recommendations
        const recsResponse = await preferencesAPI.getRecommendations({
          originCountry: formData.originCountry,
          goods: [{
            taricCode: formData.taricCode,
            customsValue: parseFloat(formData.customsValue) || 0
          }]
        })
        if (recsResponse.data.success) {
          setRecommendations(recsResponse.data.data.recommendations)
        }
      } else {
        toast.error(response.data.error || 'Error al verificar preferencias')
      }
    } catch (error) {
      console.error('Error checking preferences:', error)
      toast.error('Error al verificar preferencias')
    } finally {
      setChecking(false)
    }
  }

  const handleValidateCertificate = async (e) => {
    e.preventDefault()

    if (!certData.type || !certData.issuedDate) {
      toast.error('Complete tipo y fecha de emision')
      return
    }

    setValidating(true)
    setCertValidation(null)

    try {
      const response = await preferencesAPI.validateCertificate(certData)

      if (response.data.success) {
        setCertValidation(response.data.data)
        if (response.data.data.valid) {
          toast.success('Certificado valido')
        } else {
          toast.error('Certificado con problemas')
        }
      } else {
        toast.error(response.data.error || 'Error al validar certificado')
      }
    } catch (error) {
      console.error('Error validating certificate:', error)
      toast.error('Error al validar certificado')
    } finally {
      setValidating(false)
    }
  }

  const countries = countriesGrouped.flatMap(g => g.countries.map(c => ({ code: c.code, name: c.label || c.name })))

  const certificates = [
    { code: 'EUR1', name: 'EUR.1 - Certificado de circulación' },
    { code: 'FORMA', name: 'Form A - Sistema Preferencias Generalizadas' },
    { code: 'ATR', name: 'ATR - Tránsito Union Aduanera Turquía' },
    { code: 'STATEMENT', name: 'Statement on Origin - Declaración en factura' },
    { code: 'NONE', name: 'Sin certificado' }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <GlobeAltIcon className="h-8 w-8 mr-3 text-purple-600" />
          {t('preferencesCalc.title')}
        </h1>
        <p className="mt-2 text-gray-600">
          {t('preferencesCalc.subtitle')}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('eligibility')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'eligibility'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentCheckIcon className="h-5 w-5 inline mr-2" />
            Verificar Elegibilidad
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'validation'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShieldCheckIcon className="h-5 w-5 inline mr-2" />
            Validar Certificado
          </button>
          <button
            onClick={() => setActiveTab('optimize')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'optimize'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <LightBulbIcon className="h-5 w-5 inline mr-2" />
            Recomendaciones
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'eligibility' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div>
          <form onSubmit={handleCheck} className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos del Producto</h2>

            {/* País de origen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                País de Origen
              </label>
              <select
                value={formData.originCountry}
                onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              >
                {/* Se muestra el codigo ISO, no el acuerdo: `countriesGrouped` es el
                    catalogo ISO 3166-1 y no lleva acuerdo comercial, asi que
                    `c.agreement` era SIEMPRE undefined y las 194 opciones se pintaban
                    como "Canada ()". Ademas el acuerdo no depende solo del pais sino
                    del par pais+mercancia, y eso lo resuelve el backend al verificar
                    la elegibilidad: ponerlo aqui seria afirmar un acuerdo sin haberlo
                    comprobado. */}
                {countries.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Código TARIC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código TARIC
              </label>
              <input
                type="text"
                value={formData.taricCode}
                onChange={(e) => setFormData({ ...formData, taricCode: e.target.value })}
                placeholder="ej. 8517120000"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Valor aduanero */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Aduanero (EUR) - Opcional
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.customsValue}
                onChange={(e) => setFormData({ ...formData, customsValue: e.target.value })}
                placeholder="50000.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Para calcular ahorro potencial</p>
            </div>

            {/* Certificado de origen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Certificado de Origen Disponible
              </label>
              <select
                value={formData.certificate}
                onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Seleccione --</option>
                {certificates.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Declaración en factura */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="declarationOnOrigin"
                checked={formData.declarationOnOrigin}
                onChange={(e) => setFormData({ ...formData, declarationOnOrigin: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="declarationOnOrigin" className="ml-2 block text-sm text-gray-700">
                Incluye declaración de origen en factura
              </label>
            </div>

            {/* Tipo de Exportador */}
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Exportador
              </label>
              <select
                value={formData.exporterType}
                onChange={(e) => setFormData({ ...formData, exporterType: e.target.value, rexNumber: '', authorizedExporterNumber: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              >
                <option value="normal">Normal (sin acreditacion)</option>
                <option value="authorized">Exportador Autorizado (EA)</option>
                <option value="rex">Exportador Registrado (REX)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.exporterType === 'authorized' && 'Habilitado para emitir declaraciones en factura sin limite de valor'}
                {formData.exporterType === 'rex' && 'Registrado en sistema REX para certificar origen en SPG/acuerdos modernos'}
                {formData.exporterType === 'normal' && 'Puede usar declaracion en factura solo hasta 6.000 EUR'}
              </p>
            </div>

            {/* Numero REX - solo si exportador REX */}
            {formData.exporterType === 'rex' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero REX
                </label>
                <input
                  type="text"
                  value={formData.rexNumber}
                  onChange={(e) => setFormData({ ...formData, rexNumber: e.target.value.toUpperCase() })}
                  placeholder="ej. REREG/2026/12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Numero de registro en el sistema REX de la UE</p>
              </div>
            )}

            {/* Numero Exportador Autorizado - solo si EA */}
            {formData.exporterType === 'authorized' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero de Autorizacion
                </label>
                <input
                  type="text"
                  value={formData.authorizedExporterNumber}
                  onChange={(e) => setFormData({ ...formData, authorizedExporterNumber: e.target.value.toUpperCase() })}
                  placeholder="ej. ES/001/2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Numero de autorizacion de exportador autorizado</p>
              </div>
            )}

            {/* Info certificado valido segun tipo exportador */}
            {formData.exporterType !== 'normal' && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs font-medium text-purple-800">
                  {formData.exporterType === 'rex'
                    ? 'Certificado valido: Declaracion de origen en factura (Statement on Origin) - sin limite de valor. Aplicable a SPG, CETA, JEFTA, EU-Vietnam y acuerdos modernos.'
                    : 'Certificado valido: Declaracion de origen en factura (EUR.1 no necesario) - sin limite de valor. Aplicable a acuerdos bilaterales y Pan-Euro-Med.'}
                </p>
              </div>
            )}

            {formData.exporterType === 'normal' && parseFloat(formData.customsValue) > 6000 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">
                    Para envios superiores a 6.000 EUR, un exportador normal necesita EUR.1 emitido por aduanas del pais exportador. Solo exportadores Autorizados o REX pueden usar declaracion en factura sin limite.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={checking}
              className="w-full bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 disabled:bg-gray-400 font-medium flex items-center justify-center"
            >
              {checking ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verificando...
                </>
              ) : (
                <>
                  <DocumentCheckIcon className="h-5 w-5 mr-2" />
                  Verificar Preferencias
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Acuerdos Implementados:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>CETA (Canadá), JEFTA (Japón), EU-UK</li>
                  <li>EU-MERCOSUR, EU-MEXICO, EU-CHILE, EU-KOREA, EU-VIETNAM</li>
                  <li>GSP, GSP+, EBA, Pan-Euro-Med</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div>
          {result && (
            <div className="space-y-6">
              {/* Elegibilidad */}
              <div className={`rounded-lg shadow-md p-6 ${
                result.available ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'
              }`}>
                <div className="flex items-center mb-4">
                  {result.available ? (
                    <>
                      <SparklesIcon className="h-8 w-8 text-green-600 mr-3" />
                      <div>
                        <h3 className="text-xl font-bold text-green-900">Preferencia Disponible</h3>
                        <p className="text-sm text-green-700">Este producto es elegible para trato preferencial</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <InformationCircleIcon className="h-8 w-8 text-red-600 mr-3" />
                      <div>
                        <h3 className="text-xl font-bold text-red-900">No Elegible</h3>
                        <p className="text-sm text-red-700">No se encontraron preferencias para este producto</p>
                      </div>
                    </>
                  )}
                </div>

                {result.agreement && (
                  <div className="bg-white rounded-md p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-1">Acuerdo Aplicable:</p>
                    <p className="text-lg font-semibold text-gray-900">{result.agreement}</p>
                  </div>
                )}

                {result.certificate && (
                  <div className="bg-white rounded-md p-4">
                    <p className="text-sm text-gray-600 mb-1">Certificado Requerido:</p>
                    <p className="text-lg font-semibold text-gray-900">{result.certificate}</p>
                  </div>
                )}
              </div>

              {/* Ahorros */}
              {result.available && formData.customsValue && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <CurrencyEuroIcon className="h-6 w-6 mr-2 text-green-600" />
                    Ahorro Estimado
                  </h3>

                  {/* Los tipos solo se muestran si el backend los ha devuelto: antes
                      caian a '12.5' y a 0.125, un arancel inventado que ademas se
                      pintaba como "0.125%" mientras el importe lo usaba como 12,5%.
                      El ahorro es el que calcula el backend (standardDuty -
                      preferentialDuty), no una resta hecha aqui con tipos de relleno. */}
                  <div className="space-y-3">
                    {result.standard != null && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Arancel NMF (sin preferencia):</span>
                        <span className="font-semibold">{result.standard}%</span>
                      </div>
                    )}
                    {result.preferential != null && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Arancel Preferencial:</span>
                        <span className="font-semibold text-green-600">{result.preferential}%</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 bg-green-50 rounded-md px-3">
                      <span className="font-semibold text-gray-900">Ahorro Total:</span>
                      <span className="font-bold text-xl text-green-600">
                        {Number(result.savings || 0).toFixed(2)} EUR
                      </span>
                    </div>
                    {!result.savings && (
                      <p className="text-sm text-gray-500">
                        Este producto ya tiene arancel cero sin preferencia, por lo que el
                        acuerdo no supone ahorro arancelario.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Requisitos */}
              {result.originRules && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Reglas de Origen
                  </h3>
                  <div className="space-y-3">
                    {result.originRules.general && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-700">Regla General:</p>
                        <p className="text-sm text-gray-600">{result.originRules.general}</p>
                      </div>
                    )}
                    {result.originRules.tolerance && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-700">Tolerancia:</p>
                        <p className="text-sm text-gray-600">{(result.originRules.tolerance * 100).toFixed(0)}% de materiales no originarios permitido</p>
                      </div>
                    )}
                    {result.originRules.regionalValueContent && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-700">Contenido de Valor Regional (RVC):</p>
                        <p className="text-sm text-gray-600">Mínimo {(result.originRules.regionalValueContent * 100).toFixed(0)}% de valor agregado</p>
                      </div>
                    )}
                    {result.originRules.cumulation && result.originRules.cumulation.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-700">Acumulación Permitida:</p>
                        <p className="text-sm text-gray-600">{result.originRules.cumulation.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Documentación */}
              {result.available && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DocumentCheckIcon className="h-6 w-6 mr-2 text-purple-600" />
                    Documentacion Necesaria
                  </h3>
                  <ul className="space-y-2">
                    {formData.exporterType === 'rex' ? (
                      <>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                          <span className="text-sm text-gray-700">
                            <strong>Declaracion de origen en factura</strong> (Statement on Origin) con numero REX
                            {formData.rexNumber && <span className="text-purple-600"> ({formData.rexNumber})</span>}
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-blue-600 mr-2 flex-shrink-0">i</span>
                          <span className="text-sm text-gray-500">EUR.1 no necesario - exportador registrado en sistema REX</span>
                        </li>
                      </>
                    ) : formData.exporterType === 'authorized' ? (
                      <>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                          <span className="text-sm text-gray-700">
                            <strong>Declaracion de origen en factura</strong> con numero de autorizacion
                            {formData.authorizedExporterNumber && <span className="text-purple-600"> ({formData.authorizedExporterNumber})</span>}
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-blue-600 mr-2 flex-shrink-0">i</span>
                          <span className="text-sm text-gray-500">EUR.1 no necesario - exportador autorizado sin limite de valor</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                          <span className="text-sm text-gray-700">
                            {parseFloat(formData.customsValue) > 6000
                              ? <><strong>{result.certificate}</strong> emitido por autoridad aduanera del pais exportador</>
                              : <><strong>Declaracion de origen en factura</strong> (envios hasta 6.000 EUR) o <strong>{result.certificate}</strong></>
                            }
                          </span>
                        </li>
                      </>
                    )}
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700">
                        Factura comercial con declaracion de origen
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700">
                        Documentacion que acredite cumplimiento de reglas de origen
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700">
                        Declaracion en DUA con codigo de preferencia arancelaria
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Recomendaciones */}
              {result.available && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900 mb-2">Recomendaciones:</p>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Solicitar {result.certificate} al exportador antes del despacho</li>
                    <li>• Verificar validez del certificado (máximo 10 meses desde emisión)</li>
                    <li>• Conservar documentación durante 3 años</li>
                    <li>• Indicar código de preferencia en casilla 36 del DUA</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {!result && (
            <div className="bg-gray-50 rounded-lg p-12 text-center h-full flex flex-col justify-center">
              <GlobeAltIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                Complete el formulario y verifique la elegibilidad para preferencias arancelarias
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Certificate Validation Tab */}
      {activeTab === 'validation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <form onSubmit={handleValidateCertificate} className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <ShieldCheckIcon className="h-6 w-6 mr-2 text-purple-600" />
                Validar Certificado de Origen
              </h2>

              {/* Tipo de certificado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Certificado
                </label>
                <select
                  value={certData.type}
                  onChange={(e) => setCertData({ ...certData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                >
                  <option value="EUR.1">EUR.1 - Certificado de circulacion</option>
                  <option value="EUR-MED">EUR-MED - Pan-Euro-Med</option>
                  <option value="Form A">Form A - GSP</option>
                  <option value="Statement on Origin">Statement on Origin</option>
                  <option value="ATR">ATR - Union Aduanera Turquia</option>
                </select>
              </div>

              {/* Numero de certificado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero de Certificado
                </label>
                <input
                  type="text"
                  value={certData.certificateNumber}
                  onChange={(e) => setCertData({ ...certData, certificateNumber: e.target.value })}
                  placeholder="ej. ES123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Fecha de emision */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Emision
                </label>
                <input
                  type="date"
                  value={certData.issuedDate}
                  onChange={(e) => setCertData({ ...certData, issuedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Exportador */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Exportador
                </label>
                <input
                  type="text"
                  value={certData.exporterName}
                  onChange={(e) => setCertData({ ...certData, exporterName: e.target.value })}
                  placeholder="Empresa exportadora"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Consignatario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Consignatario
                </label>
                <input
                  type="text"
                  value={certData.consigneeName}
                  onChange={(e) => setCertData({ ...certData, consigneeName: e.target.value })}
                  placeholder="Empresa importadora"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Pais de origen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pais de Origen (ISO-2)
                </label>
                <input
                  type="text"
                  value={certData.originCountry}
                  onChange={(e) => setCertData({ ...certData, originCountry: e.target.value.toUpperCase() })}
                  placeholder="ej. CA, JP, GB"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={validating}
                className="w-full bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 disabled:bg-gray-400 font-medium flex items-center justify-center"
              >
                {validating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Validando...
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="h-5 w-5 mr-2" />
                    Validar Certificado
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Resultados de validacion */}
          <div>
            {certValidation && (
              <div className="space-y-4">
                <div className={`rounded-lg shadow-md p-6 ${
                  certValidation.valid ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'
                }`}>
                  <div className="flex items-center mb-4">
                    {certValidation.valid ? (
                      <>
                        <ShieldCheckIcon className="h-8 w-8 text-green-600 mr-3" />
                        <div>
                          <h3 className="text-xl font-bold text-green-900">Certificado Valido</h3>
                          <p className="text-sm text-green-700">El certificado cumple los requisitos</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
                        <div>
                          <h3 className="text-xl font-bold text-red-900">Certificado Invalido</h3>
                          <p className="text-sm text-red-700">Se encontraron problemas</p>
                        </div>
                      </>
                    )}
                  </div>

                  {certValidation.issues && certValidation.issues.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-red-900 mb-2">Problemas encontrados:</h4>
                      <ul className="space-y-2">
                        {certValidation.issues.map((issue, idx) => (
                          <li key={idx} className="flex items-start bg-white rounded p-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                            <span className="text-sm text-red-700">
                              <strong>{issue.field}:</strong> {issue.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {certValidation.warnings && certValidation.warnings.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-yellow-900 mb-2">Advertencias:</h4>
                      <ul className="space-y-2">
                        {certValidation.warnings.map((warning, idx) => (
                          <li key={idx} className="flex items-start bg-yellow-50 rounded p-2">
                            <InformationCircleIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                            <span className="text-sm text-yellow-700">
                              <strong>{warning.field}:</strong> {warning.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!certValidation && (
              <div className="bg-gray-50 rounded-lg p-12 text-center h-full flex flex-col justify-center">
                <ShieldCheckIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Complete el formulario para validar un certificado de origen
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'optimize' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <LightBulbIcon className="h-6 w-6 mr-2 text-yellow-500" />
              Recomendaciones de Optimizacion
            </h2>

            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-l-4 ${
                      rec.priority === 'high'
                        ? 'bg-green-50 border-green-500'
                        : rec.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          rec.priority === 'high'
                            ? 'bg-green-100 text-green-800'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {rec.type === 'preference' ? 'Preferencia' :
                           rec.type === 'cumulation' ? 'Acumulacion' :
                           rec.type === 'documentation' ? 'Documentacion' : rec.type}
                        </span>
                        <p className="mt-2 text-gray-900 font-medium">{rec.action}</p>
                        {rec.description && (
                          <p className="mt-1 text-sm text-gray-600">{rec.description}</p>
                        )}
                        {rec.requirements && rec.requirements.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500">Requisitos:</p>
                            <ul className="text-xs text-gray-600 list-disc list-inside">
                              {rec.requirements.map((req, i) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {rec.savings > 0 && (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Ahorro potencial</p>
                          <p className="text-xl font-bold text-green-600">{rec.savings.toFixed(2)} EUR</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <LightBulbIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">
                  Verifique la elegibilidad de un producto en la pestana "Verificar Elegibilidad" para obtener recomendaciones personalizadas
                </p>
              </div>
            )}
          </div>

          {/* Info sobre acumulacion */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Sobre la Acumulacion de Origen:</p>
                <p className="text-xs">
                  La acumulacion permite que materiales originarios de paises dentro de una zona de acumulacion
                  (como Pan-Euro-Med) sean tratados como originarios del pais exportador. Esto puede ayudar a
                  cumplir reglas de origen cuando los materiales provienen de multiples fuentes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
