import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { expeditionsAPI, classificationAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, PlusIcon, TrashIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

const NL_CUSTOMS_OFFICES = [
  { code: 'NL000297', name: 'Rotterdam Haven' },
  { code: 'NL000399', name: 'Schiphol' },
  { code: 'NL000396', name: 'Amsterdam' },
  { code: 'NL000440', name: 'Eindhoven' },
  { code: 'NL000448', name: 'Venlo' },
  { code: 'NL000231', name: 'Breda' },
  { code: 'NL000251', name: 'Rotterdam Rijnmond' },
]

export default function ExpeditionNew() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [classifyingIndex, setClassifyingIndex] = useState(null)
  const [classificationResults, setClassificationResults] = useState({})

  const defaultCountry = localStorage.getItem('activeCustomsCountry') || 'ES'
  const [customsCountry, setCustomsCountry] = useState(defaultCountry)
  const isNL = customsCountry === 'NL'

  const [formData, setFormData] = useState({
    operationType: 'IMPORT',
    country: defaultCountry,
    customsOffice: defaultCountry === 'NL' ? 'NL000399' : '',
    iossNumber: '',
    client: {
      companyName: '',
      nif: '',
      eori: '',
      address: '',
      city: '',
      postalCode: '',
      country: defaultCountry,
      contactPerson: '',
      email: '',
      phone: ''
    },
    exporter: {
      companyName: '',
      address: '',
      city: '',
      country: ''
    },
    consignee: {
      companyName: '',
      address: '',
      city: '',
      country: ''
    },
    goods: [{
      description: '',
      taricCode: '',
      originCountry: '',
      quantity: '',
      quantityUnit: 'KGM',
      netWeight: '',
      grossWeight: '',
      invoiceValue: '',
      currency: 'EUR'
    }],
    transportMode: 'SEA',
    incoterm: 'CIF',
    incotermPlace: ''
  })

  const handleChange = (section, field, value) => {
    if (section) {
      setFormData({
        ...formData,
        [section]: {
          ...formData[section],
          [field]: value
        }
      })
    } else {
      setFormData({
        ...formData,
        [field]: value
      })
    }
  }

  const handleGoodsChange = (index, field, value) => {
    const newGoods = [...formData.goods]
    newGoods[index] = { ...newGoods[index], [field]: value }
    setFormData({ ...formData, goods: newGoods })
  }

  const addGoodsItem = () => {
    setFormData({
      ...formData,
      goods: [...formData.goods, {
        description: '',
        taricCode: '',
        originCountry: '',
        quantity: '',
        quantityUnit: 'KGM',
        netWeight: '',
        grossWeight: '',
        invoiceValue: '',
        currency: 'EUR'
      }]
    })
  }

  const removeGoodsItem = (index) => {
    if (formData.goods.length > 1) {
      const newGoods = formData.goods.filter((_, i) => i !== index)
      setFormData({ ...formData, goods: newGoods })
      // Clean up classification results for removed item
      const newResults = { ...classificationResults }
      delete newResults[index]
      setClassificationResults(newResults)
    }
  }

  // AI Classification function
  const handleClassifyWithAI = async (index) => {
    const item = formData.goods[index]
    if (!item.description || item.description.trim().length < 3) {
      toast.error(t('expeditions.enterDescription'))
      return
    }

    setClassifyingIndex(index)

    try {
      const response = await classificationAPI.classify({
        description: item.description,
        additional_info: {
          material: item.material || '',
          use: item.use || '',
          origin: item.originCountry || ''
        },
        language: 'es'
      })

      const data = response.data
      if (data.suggestions && data.suggestions.length > 0) {
        // Store all suggestions
        setClassificationResults({
          ...classificationResults,
          [index]: data
        })

        // Auto-fill with the best suggestion
        const bestSuggestion = data.suggestions[0]
        if (bestSuggestion.code && bestSuggestion.code !== '0000000000') {
          handleGoodsChange(index, 'taricCode', bestSuggestion.code)
          handleGoodsChange(index, 'dutyRate', bestSuggestion.duty_rate || 0)
          toast.success(`${t('expeditions.taricSuggested')} ${bestSuggestion.code} (${bestSuggestion.confidence}% ${t('expeditions.confidence')})`)
        } else {
          toast(t('expeditions.couldNotDetermine'), { icon: '⚠️' })
        }
      } else {
        toast.error(t('expeditions.noSuggestions'))
      }
    } catch (error) {
      console.error('Classification error:', error)
      toast.error(t('expeditions.classificationError'))
    } finally {
      setClassifyingIndex(null)
    }
  }

  // Apply a specific suggestion
  const applySuggestion = (index, suggestion) => {
    handleGoodsChange(index, 'taricCode', suggestion.code)
    handleGoodsChange(index, 'dutyRate', suggestion.duty_rate || 0)
    toast.success(t('expeditions.codeApplied', { code: suggestion.code }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await expeditionsAPI.create(formData)
      toast.success(t('expeditions.created'))
      // Handle different response formats
      const expeditionId = response.data?.data?._id || response.data?._id || response.data?.data?.id
      navigate(`/expeditions/${expeditionId}`)
    } catch (error) {
      console.error('Error creating expedition:', error.response?.data)
      // Handle validation errors from backend
      if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
        const errorMessages = error.response.data.details.map(d => `${d.field}: ${d.message}`).join('\n')
        toast.error(`${t('expeditions.validationErrors')}\n${errorMessages}`, { duration: 5000 })
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error)
      } else {
        toast.error(error.response?.data?.message || t('expeditions.createError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const transportModes = [
    { value: 'SEA', label: t('expeditions.maritime') },
    { value: 'AIR', label: t('expeditions.air') },
    { value: 'ROAD', label: t('expeditions.road') },
    { value: 'RAIL', label: t('expeditions.rail') },
    { value: 'MULTIMODAL', label: t('expeditions.multimodal') }
  ]

  const incoterms = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/expeditions')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expeditions.newTitle')}</h1>
          <p className="text-gray-500">{formData.operationType === 'IMPORT' ? t('expeditions.createSubtitleImport') : t('expeditions.createSubtitleExport')}</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                step >= s ? 'bg-luci text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`w-20 h-1 ${step > s ? 'bg-luci' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-16 text-sm text-gray-500 mb-8">
        <span className={step === 1 ? 'text-luci font-medium' : ''}>{t('expeditions.stepTypeClient')}</span>
        <span className={step === 2 ? 'text-luci font-medium' : ''}>{t('expeditions.stepGoods')}</span>
        <span className={step === 3 ? 'text-luci font-medium' : ''}>{t('expeditions.stepTransport')}</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Operation Type and Client */}
        {step === 1 && (
          <div className="card space-y-6">
            {/* Country selector */}
            <div>
              <label className="label">Pais de destino aduanero *</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setCustomsCountry('ES')
                    setFormData(prev => ({
                      ...prev,
                      country: 'ES',
                      customsOffice: '',
                      client: { ...prev.client, country: 'ES' }
                    }))
                  }}
                  className={`flex-1 p-3 rounded-xl border-2 transition-colors flex items-center gap-3 ${
                    customsCountry === 'ES'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{'\u{1F1EA}\u{1F1F8}'}</span>
                  <div className="text-left">
                    <span className="font-medium block">Espana (ES)</span>
                    <span className="text-xs text-gray-500">AEAT</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomsCountry('NL')
                    setFormData(prev => ({
                      ...prev,
                      country: 'NL',
                      customsOffice: 'NL000399',
                      client: { ...prev.client, country: 'NL' }
                    }))
                  }}
                  className={`flex-1 p-3 rounded-xl border-2 transition-colors flex items-center gap-3 ${
                    customsCountry === 'NL'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{'\u{1F1F3}\u{1F1F1}'}</span>
                  <div className="text-left">
                    <span className="font-medium block">Paises Bajos (NL)</span>
                    <span className="text-xs text-gray-500">DMS 4.0 / DECO</span>
                  </div>
                </button>
              </div>
            </div>

            {/* NL-specific fields */}
            {isNL && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div>
                  <label className="label">Aduana de entrada (NL) *</label>
                  <select
                    value={formData.customsOffice}
                    onChange={(e) => setFormData({ ...formData, customsOffice: e.target.value })}
                    className="input"
                  >
                    {NL_CUSTOMS_OFFICES.map(o => (
                      <option key={o.code} value={o.code}>{o.name} ({o.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">IOSS (opcional)</label>
                  <input
                    type="text"
                    value={formData.iossNumber}
                    onChange={(e) => setFormData({ ...formData, iossNumber: e.target.value })}
                    className="input"
                    placeholder="IMNL000000123"
                  />
                  <p className="text-xs text-gray-500 mt-1">Si el vendedor tiene IOSS, el IVA ya fue cobrado</p>
                </div>
              </div>
            )}

            <hr className="my-2" />

            <h2 className="text-lg font-semibold">{t('expeditions.operationType')}</h2>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleChange(null, 'operationType', 'IMPORT')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  formData.operationType === 'IMPORT'
                    ? 'border-luci bg-luci-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-2 block">📥</span>
                <span className="font-medium">{t('common.import')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleChange(null, 'operationType', 'EXPORT')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  formData.operationType === 'EXPORT'
                    ? 'border-luci bg-luci-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-2 block">📤</span>
                <span className="font-medium">{t('common.export')}</span>
              </button>
            </div>

            <hr className="my-6" />

            <h2 className="text-lg font-semibold">
              {formData.operationType === 'IMPORT' ? t('expeditions.importer') : t('expeditions.exporter')} ({t('expeditions.client')})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">{t('expeditions.companyName')} *</label>
                <input
                  type="text"
                  value={formData.client.companyName}
                  onChange={(e) => handleChange('client', 'companyName', e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">{isNL ? 'EORI *' : `${t('expeditions.nifCif')} *`}</label>
                {isNL ? (
                  <input
                    type="text"
                    value={formData.client.eori}
                    onChange={(e) => handleChange('client', 'eori', e.target.value.toUpperCase())}
                    className="input"
                    placeholder="NL823456789"
                    required
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={formData.client.nif}
                      onChange={(e) => handleChange('client', 'nif', e.target.value.toUpperCase())}
                      className={`input ${formData.client.nif && !/^[A-Z0-9]{8,10}$/.test(formData.client.nif) ? 'border-red-500' : ''}`}
                      placeholder={t('expeditions.nifPlaceholder')}
                      pattern="[A-Z0-9]{8,10}"
                      required
                    />
                    {formData.client.nif && !/^[A-Z0-9]{8,10}$/.test(formData.client.nif) && (
                      <p className="text-xs text-red-500 mt-1">{t('expeditions.nifValidation')}</p>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="label">{isNL ? 'NIF (opcional)' : t('expeditions.eori')}</label>
                <input
                  type="text"
                  value={isNL ? formData.client.nif : formData.client.eori}
                  onChange={(e) => handleChange('client', isNL ? 'nif' : 'eori', e.target.value)}
                  className="input"
                  placeholder={isNL ? 'Solo si aplica' : t('expeditions.eoriPlaceholder')}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">{t('common.address')}</label>
                <input
                  type="text"
                  value={formData.client.address}
                  onChange={(e) => handleChange('client', 'address', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t('common.city')}</label>
                <input
                  type="text"
                  value={formData.client.city}
                  onChange={(e) => handleChange('client', 'city', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t('common.postalCode')}</label>
                <input
                  type="text"
                  value={formData.client.postalCode}
                  onChange={(e) => handleChange('client', 'postalCode', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t('common.email')} *</label>
                <input
                  type="email"
                  value={formData.client.email}
                  onChange={(e) => handleChange('client', 'email', e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">{t('common.phone')}</label>
                <input
                  type="tel"
                  value={formData.client.phone}
                  onChange={(e) => handleChange('client', 'phone', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <hr className="my-6" />

            <h2 className="text-lg font-semibold">
              {formData.operationType === 'IMPORT' ? t('expeditions.exporterSupplier') : t('expeditions.consignee')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">{t('expeditions.companyName')}</label>
                <input
                  type="text"
                  value={formData.operationType === 'IMPORT' ? formData.exporter.companyName : formData.consignee.companyName}
                  onChange={(e) => handleChange(
                    formData.operationType === 'IMPORT' ? 'exporter' : 'consignee',
                    'companyName',
                    e.target.value
                  )}
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t('common.country')} *</label>
                <input
                  type="text"
                  value={formData.operationType === 'IMPORT' ? formData.exporter.country : formData.consignee.country}
                  onChange={(e) => handleChange(
                    formData.operationType === 'IMPORT' ? 'exporter' : 'consignee',
                    'country',
                    e.target.value
                  )}
                  className="input"
                  placeholder={t('expeditions.isoCodePlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="label">{t('common.city')}</label>
                <input
                  type="text"
                  value={formData.operationType === 'IMPORT' ? formData.exporter.city : formData.consignee.city}
                  onChange={(e) => handleChange(
                    formData.operationType === 'IMPORT' ? 'exporter' : 'consignee',
                    'city',
                    e.target.value
                  )}
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-primary"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Goods */}
        {step === 2 && (
          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('expeditions.goods')}</h2>
              <button
                type="button"
                onClick={addGoodsItem}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <PlusIcon className="w-4 h-4" />
                {t('expeditions.addItem')}
              </button>
            </div>

            {formData.goods.map((item, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">{t('expeditions.itemNumber', { number: index + 1 })}</h3>
                  {formData.goods.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGoodsItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">{t('expeditions.goodsDescription')} *</label>
                    <textarea
                      value={item.description}
                      onChange={(e) => handleGoodsChange(index, 'description', e.target.value)}
                      className="input"
                      rows={2}
                      placeholder={t('expeditions.descriptionPlaceholder')}
                      required
                    />
                  </div>

                  {/* Additional info for better classification */}
                  <div>
                    <label className="label">{t('expeditions.mainMaterial')}</label>
                    <input
                      type="text"
                      value={item.material || ''}
                      onChange={(e) => handleGoodsChange(index, 'material', e.target.value)}
                      className="input"
                      placeholder={t('expeditions.materialPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="label">{t('expeditions.useFunction')}</label>
                    <input
                      type="text"
                      value={item.use || ''}
                      onChange={(e) => handleGoodsChange(index, 'use', e.target.value)}
                      className="input"
                      placeholder={t('expeditions.usePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="label">{t('expeditions.taricCode')}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.taricCode}
                        onChange={(e) => handleGoodsChange(index, 'taricCode', e.target.value)}
                        className="input flex-1"
                        placeholder={t('expeditions.tenDigits')}
                        maxLength={10}
                      />
                      <button
                        type="button"
                        onClick={() => handleClassifyWithAI(index)}
                        disabled={classifyingIndex === index}
                        className="btn-primary flex items-center gap-1 whitespace-nowrap"
                        title={t('expeditions.classifyWithAI')}
                      >
                        {classifyingIndex === index ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            IA...
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-4 h-4" />
                            IA
                          </>
                        )}
                      </button>
                    </div>
                    {item.taricCode && item.taricCode.length === 10 && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        {t('expeditions.validTaric')}
                        {item.dutyRate !== undefined && ` - ${t('expeditions.tariff')}: ${item.dutyRate}%`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="label">{t('expeditions.originCountry')} *</label>
                    <input
                      type="text"
                      value={item.originCountry}
                      onChange={(e) => handleGoodsChange(index, 'originCountry', e.target.value)}
                      className="input"
                      placeholder={t('expeditions.isoCodePlaceholderShort')}
                      required
                    />
                  </div>

                  {/* AI Classification Results */}
                  {classificationResults[index] && (
                    <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1">
                        <SparklesIcon className="w-4 h-4" />
                        {t('expeditions.aiSuggestions')}
                      </p>
                      <div className="space-y-2">
                        {classificationResults[index].suggestions?.slice(0, 3).map((suggestion, sIndex) => (
                          <div
                            key={sIndex}
                            className={`flex items-center justify-between p-2 rounded ${
                              item.taricCode === suggestion.code ? 'bg-green-100 border border-green-300' : 'bg-white'
                            }`}
                          >
                            <div className="flex-1">
                              <span className="font-mono font-bold">{suggestion.code}</span>
                              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                suggestion.confidence >= 80 ? 'bg-green-100 text-green-700' :
                                suggestion.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {suggestion.confidence}%
                              </span>
                              <span className="ml-2 text-sm text-gray-600">
                                {t('expeditions.tariff')}: {suggestion.duty_rate || 0}%
                              </span>
                              {suggestion.description && (
                                <p className="text-xs text-gray-500 mt-1">{suggestion.description}</p>
                              )}
                            </div>
                            {item.taricCode !== suggestion.code && (
                              <button
                                type="button"
                                onClick={() => applySuggestion(index, suggestion)}
                                className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                              >
                                {t('expeditions.apply')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {classificationResults[index].warnings?.length > 0 && (
                        <div className="mt-2 text-xs text-yellow-700">
                          <p className="font-medium">{t('expeditions.warnings')}:</p>
                          <ul className="list-disc list-inside">
                            {classificationResults[index].warnings.map((w, wIndex) => (
                              <li key={wIndex}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="label">{t('expeditions.quantity')}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleGoodsChange(index, 'quantity', e.target.value)}
                        className="input flex-1"
                      />
                      <select
                        value={item.quantityUnit}
                        onChange={(e) => handleGoodsChange(index, 'quantityUnit', e.target.value)}
                        className="input w-24"
                      >
                        <option value="KGM">KG</option>
                        <option value="PCS">{t('expeditions.units')}</option>
                        <option value="MTR">M</option>
                        <option value="LTR">L</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('expeditions.netWeight')}</label>
                    <input
                      type="number"
                      step="0.001"
                      value={item.netWeight}
                      onChange={(e) => handleGoodsChange(index, 'netWeight', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{t('expeditions.grossWeight')}</label>
                    <input
                      type="number"
                      step="0.001"
                      value={item.grossWeight}
                      onChange={(e) => handleGoodsChange(index, 'grossWeight', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{t('expeditions.invoiceValue')} *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.invoiceValue}
                        onChange={(e) => handleGoodsChange(index, 'invoiceValue', e.target.value)}
                        className="input flex-1"
                        required
                      />
                      <select
                        value={item.currency}
                        onChange={(e) => handleGoodsChange(index, 'currency', e.target.value)}
                        className="input w-24"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CNY">CNY</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                {t('common.previous')}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-primary"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Transport */}
        {step === 3 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-semibold">{t('expeditions.transportIncoterm')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('expeditions.transportMode')} *</label>
                <select
                  value={formData.transportMode}
                  onChange={(e) => handleChange(null, 'transportMode', e.target.value)}
                  className="input"
                  required
                >
                  {transportModes.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('expeditions.incoterm')} *</label>
                <select
                  value={formData.incoterm}
                  onChange={(e) => handleChange(null, 'incoterm', e.target.value)}
                  className="input"
                  required
                >
                  {incoterms.map(inc => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">{t('expeditions.incotermPlace')}</label>
                <input
                  type="text"
                  value={formData.incotermPlace}
                  onChange={(e) => handleChange(null, 'incotermPlace', e.target.value)}
                  className="input"
                  placeholder={t('expeditions.incotermPlaceholder')}
                />
              </div>
            </div>

            <hr className="my-6" />

            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <h3 className="font-medium text-gray-700 mb-3">{t('expeditions.expeditionSummary')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{t('expeditions.summaryType')}</p>
                  <p className="font-medium">{formData.operationType === 'IMPORT' ? t('common.import') : t('common.export')}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('expeditions.summaryClient')}</p>
                  <p className="font-medium">{formData.client.companyName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('expeditions.summaryItems')}</p>
                  <p className="font-medium">{formData.goods.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('expeditions.summaryTransport')}</p>
                  <p className="font-medium">{transportModes.find(m => m.value === formData.transportMode)?.label}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary"
              >
                {t('common.previous')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? t('expeditions.creating') : t('expeditions.createButton')}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
