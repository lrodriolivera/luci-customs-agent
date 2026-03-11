import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { calculationsAPI, knowledgeAPI } from '../../services/api'
import { commonCountries, allCountries } from '../../data/countries'
import toast from 'react-hot-toast'
import {
  CalculatorIcon,
  InformationCircleIcon,
  CurrencyEuroIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  SunIcon
} from '@heroicons/react/24/outline'

export default function DutyCalculator() {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    taricCode: '',
    value: '',
    origin: '',
    preference: '100',
    incoterm: 'CIF',
    importDate: new Date().toISOString().split('T')[0]
  })
  const [calculating, setCalculating] = useState(false)
  const [result, setResult] = useState(null)
  const [incotermInfo, setIncotermInfo] = useState(null)

  useEffect(() => {
    const fetchIncotermInfo = async () => {
      if (formData.incoterm) {
        try {
          const response = await knowledgeAPI.incotermInfo(formData.incoterm)
          setIncotermInfo(response.data)
        } catch (error) {
          console.error('Error fetching incoterm info:', error)
        }
      }
    }

    fetchIncotermInfo()
  }, [formData.incoterm])

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    setResult(null)
  }

  const handleCalculate = async (e) => {
    e.preventDefault()

    if (!formData.taricCode || !formData.value || !formData.origin) {
      toast.error(t('calculator.fillRequired'))
      return
    }

    setCalculating(true)
    setResult(null)

    try {
      const response = await calculationsAPI.calculateDuties({
        taricCode: formData.taricCode,
        value: parseFloat(formData.value),
        origin: formData.origin,
        preference: formData.preference,
        importDate: formData.importDate || null
      })

      setResult(response.data)
    } catch (error) {
      toast.error(t('calculator.errorCalculating'))
    } finally {
      setCalculating(false)
    }
  }

  const incoterms = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']

  const preferences = [
    { code: '100', label: t('calculator.mfn') },
    { code: '200', label: t('calculator.spg') },
    { code: '300', label: t('calculator.preferentialEur1') },
    { code: '400', label: t('calculator.customsUnionAtr') }
  ]

  // Paises no comunes para el optgroup "Todos"
  const commonCodes = new Set(commonCountries.map(c => c.code))
  const otherCountries = allCountries.filter(c => !commonCodes.has(c.code))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('calculator.title')}</h1>
        <p className="text-gray-500 mt-1">
          {t('calculator.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calculator Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleCalculate} className="card space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('calculator.taricCode')} *</label>
                <input
                  type="text"
                  value={formData.taricCode}
                  onChange={(e) => handleChange('taricCode', e.target.value)}
                  className="input font-mono"
                  placeholder="0000000000"
                  maxLength={10}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{t('calculator.tenDigits')}</p>
              </div>

              <div>
                <label className="label">{t('calculator.customsValue')} *</label>
                <div className="relative">
                  <CurrencyEuroIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => handleChange('value', e.target.value)}
                    className="input pl-10"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('calculator.originCountry')} *</label>
                <select
                  value={formData.origin}
                  onChange={(e) => handleChange('origin', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">{t('calculator.select')}</option>
                  <optgroup label={t('calculator.mostCommon')}>
                    {commonCountries.map(o => (
                      <option key={o.code} value={o.code}>{o.label} ({o.code})</option>
                    ))}
                  </optgroup>
                  <optgroup label={t('calculator.allCountries')}>
                    {otherCountries.map(o => (
                      <option key={o.code} value={o.code}>{o.label} ({o.code})</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="label">{t('calculator.tariffPreference')}</label>
                <select
                  value={formData.preference}
                  onChange={(e) => handleChange('preference', e.target.value)}
                  className="input"
                >
                  {preferences.map(p => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('calculator.incoterm')}</label>
                <select
                  value={formData.incoterm}
                  onChange={(e) => handleChange('incoterm', e.target.value)}
                  className="input"
                >
                  {incoterms.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {t('calculator.incotermEffect')}
                </p>
              </div>

              <div>
                <label className="label">
                  <CalendarDaysIcon className="w-4 h-4 inline mr-1" />
                  {t('calculator.importDate')}
                </label>
                <input
                  type="date"
                  value={formData.importDate}
                  onChange={(e) => handleChange('importDate', e.target.value)}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('calculator.dateEffect')}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={calculating}
              className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
            >
              {calculating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('calculator.calculating')}
                </>
              ) : (
                <>
                  <CalculatorIcon className="w-5 h-5" />
                  {t('calculator.calculate')}
                </>
              )}
            </button>
          </form>

          {/* Results */}
          {result && result.data && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('calculator.result')}</h2>
                <div className="flex items-center gap-2">
                  {result.data.source && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      result.data.source === 'local_db' ? 'bg-green-100 text-green-700' :
                      result.data.source === 'ai_realtime' ? 'bg-purple-100 text-purple-700' :
                      result.data.source === 'ai_cache' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {result.data.source === 'local_db' ? t('calculator.localDb') :
                       result.data.source === 'ai_realtime' ? 'IA' :
                       result.data.source === 'ai_cache' ? t('calculator.aiCache') :
                       result.data.source === 'estimated' ? t('calculator.estimated') : result.data.source}
                    </span>
                  )}
                  {result.data.confidence && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      result.data.confidence >= 90 ? 'bg-green-100 text-green-700' :
                      result.data.confidence >= 70 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {result.data.confidence}% {t('calculator.confidence')}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {result.data.description && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{result.data.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">{t('calculator.customsValueResult')}</p>
                  <p className="text-xl font-bold text-gray-900">
                    {(result.data.customsValue || result.data.customs_value || result.data.valueEur)?.toFixed(2)} EUR
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">{t('calculator.tariff')}</p>
                  <p className="text-xl font-bold text-blue-600">
                    {(result.data.dutyAmount ?? result.data.duty_amount ?? 0).toFixed(2)} EUR
                  </p>
                  <p className="text-xs text-gray-500">{(result.data.dutyRate ?? result.data.effective_duty_rate ?? 0)}%</p>
                  {result.data.seasonal && (
                    <span className="inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                      <SunIcon className="w-3 h-3" />
                      {t('calculator.seasonal')}
                    </span>
                  )}
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">{t('calculator.vatLabel')}</p>
                  <p className="text-xl font-bold text-purple-600">
                    {(result.data.vatAmount || result.data.vat_amount)?.toFixed(2)} EUR
                  </p>
                  <p className="text-xs text-gray-500">{result.data.vatRate || result.data.vat_rate}%</p>
                  {result.data.vatType && result.data.vatType !== 'standard' && (
                    <p className={`text-xs mt-1 font-medium ${
                      result.data.vatType === 'super_reduced' ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {result.data.vatType === 'reduced' ? t('calculator.reduced') : t('calculator.superReduced')}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">{t('calculator.totalToPay')}</p>
                  <p className="text-xl font-bold text-green-600">
                    {(result.data.totalToPay || result.data.total_to_pay)?.toFixed(2)} EUR
                  </p>
                </div>
              </div>

              {/* Warnings */}
              {result.data.warnings && result.data.warnings.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">{t('calculator.importantWarnings')}</p>
                      <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                        {result.data.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Antidumping Warning */}
              {result.data.antidumping?.applies && (
                <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start gap-2">
                    <ShieldCheckIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">{t('calculator.antidumpingDuties')}</p>
                      <p className="text-sm text-red-700 mt-1">
                        {t('calculator.antidumpingDescription')}
                        {result.data.antidumpingDuty > 0 && ` (+${result.data.antidumpingDuty?.toFixed(2)} EUR)`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seasonal Tariff Info */}
              {result.data.seasonal && (
                <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-start gap-2 mb-3">
                    <SunIcon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-orange-800">
                        {t('calculator.seasonalTariff')} — {result.data.seasonal.description}
                      </p>
                      <p className="text-sm text-orange-700 mt-1">
                        {t('calculator.currentPeriod')} <span className="font-semibold">{result.data.seasonal.periodLabel}</span> — {t('calculator.appliedRate')} <span className="font-semibold">{result.data.seasonal.currentRate}%</span>
                      </p>
                      {result.data.seasonal.hasEntryPrice && result.data.seasonal.entryPrice && (
                        <p className="text-sm text-orange-700 mt-1">
                          {t('calculator.entryPrice')} <span className="font-semibold">{result.data.seasonal.entryPrice} {result.data.seasonal.entryPriceUnit}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Seasonal Timeline */}
                  {result.data.seasonal.allSeasons && result.data.seasonal.allSeasons.length > 1 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-orange-800 mb-2">{t('calculator.periodCalendar')}</p>
                      <div className="space-y-1">
                        {result.data.seasonal.allSeasons.map((season, i) => {
                          const isCurrent = season.label === result.data.seasonal.periodLabel
                          return (
                            <div
                              key={i}
                              className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                                isCurrent
                                  ? 'bg-orange-200 text-orange-900 font-semibold'
                                  : 'bg-white/60 text-orange-700'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />}
                                {season.label}
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="font-mono">{season.from} a {season.to}</span>
                                <span className="font-semibold w-14 text-right">{season.rate}%</span>
                                {season.entryPrice && (
                                  <span className="text-orange-600 w-24 text-right">{season.entryPrice} €/100kg</span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Detailed Breakdown */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium text-gray-700 mb-3">{t('calculator.detailedBreakdown')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('calculator.taricCode')}</span>
                    <span className="font-mono">{result.data.taricCode || result.data.taric_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('calculator.origin')}</span>
                    <span>{result.data.origin || '-'}</span>
                  </div>
                  {result.data.importDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('calculator.importDate')}</span>
                      <span>{new Date(result.data.importDate + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('calculator.baseMfnRate')}</span>
                    <span>{(result.data.baseDutyRate ?? result.data.base_duty_rate ?? result.data.dutyRate ?? 0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('calculator.effectiveRate')}</span>
                    <span className="font-medium">{(result.data.dutyRate ?? result.data.effective_duty_rate ?? 0)}%</span>
                  </div>
                  {result.data.dutyType && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('calculator.tariffType')}</span>
                      <span className="capitalize">{result.data.dutyType.replace('_', ' ')}</span>
                    </div>
                  )}
                  {result.data.preferenceApplied && (
                    <div className="flex justify-between text-green-600">
                      <span>{t('calculator.appliedPreference')}</span>
                      <span>{result.data.preferenceApplied.agreement || result.data.preferenceApplied}</span>
                    </div>
                  )}
                  {result.data.specificDuty > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('calculator.specificDuty')}</span>
                      <span>{result.data.specificDuty?.toFixed(2)} EUR</span>
                    </div>
                  )}
                  {result.data.antidumpingDuty > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>{t('calculator.antidumpingDuty')}</span>
                      <span>+{result.data.antidumpingDuty?.toFixed(2)} EUR</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('calculator.vatBase')}</span>
                    <span>{(result.data.vatBase || result.data.vat_base)?.toFixed(2)} EUR</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('calculator.totalTaxes')}</span>
                    <span className="font-medium">{(result.data.totalTaxes || result.data.total_taxes)?.toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t('calculator.totalPayable')}</span>
                    <span className="text-green-600">{(result.data.totalToPay || result.data.total_to_pay)?.toFixed(2)} EUR</span>
                  </div>
                </div>
              </div>

              {/* Supplementary Unit Info */}
              {result.data.supplementaryUnit?.required && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">{t('calculator.supplementaryUnits')}</span> {result.data.supplementaryUnit.description} ({result.data.supplementaryUnit.type})
                  </p>
                </div>
              )}

              {/* Required Documents */}
              {result.data.requiredDocuments && result.data.requiredDocuments.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-medium text-gray-700 mb-2">{t('calculator.requiredDocuments')}</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {result.data.requiredDocuments.slice(0, 5).map((doc, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        <span className="font-mono text-xs bg-gray-100 px-1 rounded">{doc.code}</span>
                        {doc.name || doc.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Incoterm Info */}
          {incotermInfo && !incotermInfo.error && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">
                {incotermInfo.name} ({formData.incoterm})
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {t('calculator.deliveryPoint')}: {incotermInfo.delivery_point}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">
                  {t('calculator.customsValueAdjustments')}
                </p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {incotermInfo.customs_value_adjustments?.map((adj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-luci">-</span>
                      {adj}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">
              <InformationCircleIcon className="w-5 h-5 inline mr-1 text-luci" />
              {t('calculator.customsValueCalculation')}
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>{t('calculator.customsValueInfo')}</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>CIF/CIP:</strong> {t('calculator.cifCip')}</li>
                <li><strong>FOB/FCA:</strong> {t('calculator.fobFca')}</li>
                <li><strong>EXW:</strong> {t('calculator.exw')}</li>
                <li><strong>DDP:</strong> {t('calculator.ddp')}</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t('calculator.vatTypesSpain')}
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span>{t('calculator.general')}</span>
                <span className="font-medium">21%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('calculator.reduced')}</span>
                <span className="font-medium">10%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('calculator.superReduced')}</span>
                <span className="font-medium">4%</span>
              </div>
            </div>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-2">{t('calculator.disclaimer')}</h3>
            <p className="text-sm text-yellow-700">
              {t('calculator.disclaimerText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
