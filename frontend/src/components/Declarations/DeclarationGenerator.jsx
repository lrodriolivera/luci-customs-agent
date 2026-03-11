import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { expeditionsAPI, declarationsAPI, knowledgeAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function DeclarationGenerator() {
  const { t } = useTranslation()
  const [expeditions, setExpeditions] = useState([])
  const [selectedExpedition, setSelectedExpedition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aeatResult, setAeatResult] = useState(null)
  const [declarationType, setDeclarationType] = useState('H1')

  // Multi-country: tenant customs config (default ES/AEAT)
  const [customsCountry] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      return user?.tenant?.customsConfig?.country || 'ES'
    } catch { return 'ES' }
  })
  const [options, setOptions] = useState({
    regime: '40',
    additionalProcedure: '000',
    preference: '100'
  })
  const [regimeInfo, setRegimeInfo] = useState(null)
  const [generatedDeclaration, setGeneratedDeclaration] = useState(null)

  useEffect(() => {
    const fetchExpeditions = async () => {
      try {
        const response = await expeditionsAPI.list({ status: 'PROCESSING,DOCS_RECEIVED,VALIDATING' })
        setExpeditions(response.data.expeditions || [])
      } catch (error) {
        console.error('Error fetching expeditions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExpeditions()
  }, [])

  useEffect(() => {
    const fetchRegimeInfo = async () => {
      if (options.regime) {
        try {
          const response = await knowledgeAPI.regimeInfo(options.regime)
          setRegimeInfo(response.data)
        } catch (error) {
          console.error('Error fetching regime info:', error)
        }
      }
    }

    fetchRegimeInfo()
  }, [options.regime])

  const handleGenerate = async () => {
    if (!selectedExpedition) {
      toast.error(t('declarations.selectExpeditionError'))
      return
    }

    setGenerating(true)
    setGeneratedDeclaration(null)

    try {
      const response = declarationType === 'H1'
        ? await declarationsAPI.generateH1({
            expedition: selectedExpedition,
            regime: options.regime,
            additional_procedure: options.additionalProcedure,
            preference: options.preference
          })
        : await declarationsAPI.generateAES({
            expedition: selectedExpedition,
            export_type: options.regime
          })

      setGeneratedDeclaration(response.data)
      toast.success(t('declarations.declarationGeneratedType', { type: declarationType }))
    } catch (error) {
      toast.error(t('declarations.errorGenerating'))
    } finally {
      setGenerating(false)
    }
  }

  const handleExportXML = async () => {
    if (!selectedExpedition) return

    try {
      const response = await declarationsAPI.exportXML(selectedExpedition._id, declarationType)
      const blob = new Blob([response.data], { type: 'application/xml' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${declarationType}_${selectedExpedition.expeditionId}.xml`
      a.click()
      toast.success(t('declarations.xmlDownloaded'))
    } catch (error) {
      toast.error(t('declarations.errorExportXml'))
    }
  }

  const handleSubmitToAEAT = async () => {
    if (!selectedExpedition) return
    if (!confirm(t('declarations.confirmSendAeat', { type: declarationType }))) return

    setSubmitting(true)
    setAeatResult(null)
    try {
      const response = await declarationsAPI.submit(selectedExpedition._id)
      const resultData = response.data?.data || response.data
      setAeatResult(resultData)

      if (resultData.channel === 'green') {
        toast.success(`${t('declarations.greenChannel')} ${resultData.mrn}`)
      } else if (resultData.channel === 'orange') {
        toast(t('declarations.orangeChannel'), { icon: '🟠' })
      } else if (resultData.channel === 'red') {
        toast(t('declarations.redChannel'), { icon: '🔴' })
      } else {
        toast.success(t('declarations.sentToAeatMrn', { mrn: resultData.mrn || t('common.pending') }))
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('declarations.errorSendAeat'))
    } finally {
      setSubmitting(false)
    }
  }

  const regimes = [
    { code: '40', label: t('declarations.regime40') },
    { code: '42', label: t('declarations.regime42') },
    { code: '44', label: t('declarations.regime44') },
    { code: '51', label: t('declarations.regime51') },
    { code: '53', label: t('declarations.regime53') },
    { code: '61', label: t('declarations.regime61') },
    { code: '71', label: t('declarations.regime71') }
  ]

  const preferences = [
    { code: '100', label: t('declarations.noPreference') },
    { code: '200', label: t('declarations.spg') },
    { code: '300', label: t('declarations.preferentialEur1') },
    { code: '400', label: t('declarations.customsUnionAtr') }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('declarations.title')}</h1>
          <p className="text-gray-500 mt-1">
            {t('declarations.subtitle')}
          </p>
        </div>

        {/* Country / Customs System Indicator */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
          customsCountry === 'NL'
            ? 'bg-orange-50 border-orange-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <span className="text-lg">{customsCountry === 'NL' ? '\u{1F1F3}\u{1F1F1}' : '\u{1F1EA}\u{1F1F8}'}</span>
          <div className="text-sm">
            <span className={`font-medium ${customsCountry === 'NL' ? 'text-orange-700' : 'text-blue-700'}`}>
              {customsCountry === 'NL'
                ? (declarationType === 'H7' ? 'Paises Bajos - DECO' : 'Paises Bajos - DMS 4.0')
                : 'Espana - AEAT'
              }
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Declaration Type */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">{t('declarations.declarationType')}</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setDeclarationType('H1')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  declarationType === 'H1'
                    ? 'border-luci bg-luci-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-2 block">📥</span>
                <span className="font-medium">{t('declarations.h1Import')}</span>
                <p className="text-sm text-gray-500 mt-1">{t('declarations.h1Description')}</p>
              </button>
              <button
                onClick={() => setDeclarationType('AES')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  declarationType === 'AES'
                    ? 'border-luci bg-luci-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-2 block">📤</span>
                <span className="font-medium">{t('declarations.aesExport')}</span>
                <p className="text-sm text-gray-500 mt-1">{t('declarations.aesDescription')}</p>
              </button>
            </div>
          </div>

          {/* Expedition Selection */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">{t('declarations.selectExpedition')}</h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
              </div>
            ) : expeditions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {t('declarations.noExpeditionsAvailable')}
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {expeditions.map((exp) => (
                  <div
                    key={exp._id}
                    onClick={() => setSelectedExpedition(exp)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedExpedition?._id === exp._id
                        ? 'border-luci bg-luci-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{exp.expeditionId}</p>
                        <p className="text-sm text-gray-500">{exp.client?.companyName}</p>
                      </div>
                      <span className={`badge ${exp.operationType === 'IMPORT' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {exp.operationType === 'IMPORT' ? t('common.import') : t('common.export')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          {selectedExpedition && declarationType === 'H1' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">{t('declarations.declarationOptions')}</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">{t('declarations.customsRegime')}</label>
                  <select
                    value={options.regime}
                    onChange={(e) => setOptions({ ...options, regime: e.target.value })}
                    className="input"
                  >
                    {regimes.map(r => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('declarations.additionalProcedure')}</label>
                  <input
                    type="text"
                    value={options.additionalProcedure}
                    onChange={(e) => setOptions({ ...options, additionalProcedure: e.target.value })}
                    className="input"
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="label">{t('declarations.preference')}</label>
                  <select
                    value={options.preference}
                    onChange={(e) => setOptions({ ...options, preference: e.target.value })}
                    className="input"
                  >
                    {preferences.map(p => (
                      <option key={p.code} value={p.code}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex gap-4">
            <button
              onClick={handleGenerate}
              disabled={!selectedExpedition || generating}
              className="btn-primary flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('declarations.generating')}
                </>
              ) : (
                <>
                  <DocumentTextIcon className="w-5 h-5" />
                  {t('declarations.generate')} {declarationType}
                </>
              )}
            </button>

            {generatedDeclaration && (
              <>
                <button
                  onClick={handleExportXML}
                  className="btn-success flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  {t('declarations.downloadXml')}
                </button>
                <button
                  onClick={handleSubmitToAEAT}
                  disabled={submitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      {t('declarations.sendingToAeat')}
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-5 h-5" />
                      {t('declarations.sendToAeat')}
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* AEAT Result */}
          {aeatResult && (
            <div className={`card border-2 ${
              aeatResult.channel === 'green' ? 'border-green-300 bg-green-50' :
              aeatResult.channel === 'orange' ? 'border-orange-300 bg-orange-50' :
              aeatResult.channel === 'red' ? 'border-red-300 bg-red-50' :
              'border-blue-300 bg-blue-50'
            }`}>
              <h3 className="font-semibold mb-2">{t('declarations.aeatResponse')}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {aeatResult.mrn && <div><span className="text-gray-600">{t('declarations.mrn')}:</span> <span className="font-mono font-medium">{aeatResult.mrn}</span></div>}
                {aeatResult.channel && <div><span className="text-gray-600">{t('declarations.channel')}:</span> <span className="font-medium uppercase">{aeatResult.channel}</span></div>}
              </div>
            </div>
          )}

          {/* Generated Result */}
          {generatedDeclaration && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircleIcon className="w-6 h-6 text-green-500" />
                <h2 className="text-lg font-semibold">{t('declarations.generated')}</h2>
              </div>

              {generatedDeclaration.warnings?.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-sm">
                  <p className="font-medium text-yellow-800 mb-1">{t('declarations.warningsLabel')}</p>
                  <ul className="list-disc list-inside text-yellow-700">
                    {generatedDeclaration.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {generatedDeclaration.recommendations?.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 mb-1">{t('declarations.recommendations')}:</p>
                  <ul className="list-disc list-inside text-blue-700">
                    {generatedDeclaration.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(generatedDeclaration.declaration_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Regime Info */}
        <div className="space-y-6">
          {regimeInfo && !regimeInfo.error && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">
                {t('declarations.regime')} {regimeInfo.code}: {regimeInfo.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">{regimeInfo.description}</p>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">{t('declarations.requirements')}</p>
                  <ul className="text-sm text-gray-700 mt-1 space-y-1">
                    {regimeInfo.requirements?.map((req, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-luci">-</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">{t('declarations.vat')}</p>
                  <p className="text-sm text-gray-700 mt-1">{regimeInfo.vat}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">{t('declarations.typicalUse')}</p>
                  <p className="text-sm text-gray-700 mt-1">{regimeInfo.typical_use}</p>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">
              <InformationCircleIcon className="w-5 h-5 inline mr-1 text-luci" />
              {t('declarations.aboutH1')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('declarations.h1Info')}
            </p>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-2">{t('declarations.important')}</h3>
            <p className="text-sm text-yellow-700">
              {t('declarations.h1Disclaimer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
