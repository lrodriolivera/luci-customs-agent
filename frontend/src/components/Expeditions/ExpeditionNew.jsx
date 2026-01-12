import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { expeditionsAPI, classificationAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, PlusIcon, TrashIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ExpeditionNew() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [classifyingIndex, setClassifyingIndex] = useState(null)
  const [classificationResults, setClassificationResults] = useState({})

  const [formData, setFormData] = useState({
    operationType: 'IMPORT',
    client: {
      companyName: '',
      nif: '',
      eori: '',
      address: '',
      city: '',
      postalCode: '',
      country: 'ES',
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
      toast.error('Introduzca una descripcion del producto para clasificar')
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
          toast.success(`Codigo TARIC sugerido: ${bestSuggestion.code} (${bestSuggestion.confidence}% confianza)`)
        } else {
          toast('No se pudo determinar codigo automaticamente', { icon: '⚠️' })
        }
      } else {
        toast.error('No se encontraron sugerencias')
      }
    } catch (error) {
      console.error('Classification error:', error)
      toast.error('Error al clasificar producto')
    } finally {
      setClassifyingIndex(null)
    }
  }

  // Apply a specific suggestion
  const applySuggestion = (index, suggestion) => {
    handleGoodsChange(index, 'taricCode', suggestion.code)
    handleGoodsChange(index, 'dutyRate', suggestion.duty_rate || 0)
    toast.success(`Codigo ${suggestion.code} aplicado`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await expeditionsAPI.create(formData)
      toast.success('Expediente creado correctamente')
      // Handle different response formats
      const expeditionId = response.data?.data?._id || response.data?._id || response.data?.data?.id
      navigate(`/expeditions/${expeditionId}`)
    } catch (error) {
      console.error('Error creating expedition:', error.response?.data)
      // Handle validation errors from backend
      if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
        const errorMessages = error.response.data.details.map(d => `${d.field}: ${d.message}`).join('\n')
        toast.error(`Errores de validacion:\n${errorMessages}`, { duration: 5000 })
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error)
      } else {
        toast.error(error.response?.data?.message || 'Error al crear expediente')
      }
    } finally {
      setLoading(false)
    }
  }

  const transportModes = [
    { value: 'SEA', label: 'Maritimo' },
    { value: 'AIR', label: 'Aereo' },
    { value: 'ROAD', label: 'Carretera' },
    { value: 'RAIL', label: 'Ferrocarril' },
    { value: 'MULTIMODAL', label: 'Multimodal' }
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
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Expediente</h1>
          <p className="text-gray-500">Crear expediente de {formData.operationType === 'IMPORT' ? 'importacion' : 'exportacion'}</p>
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
        <span className={step === 1 ? 'text-luci font-medium' : ''}>Tipo y Cliente</span>
        <span className={step === 2 ? 'text-luci font-medium' : ''}>Mercancias</span>
        <span className={step === 3 ? 'text-luci font-medium' : ''}>Transporte</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Operation Type and Client */}
        {step === 1 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-semibold">Tipo de Operacion</h2>

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
                <span className="font-medium">Importacion</span>
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
                <span className="font-medium">Exportacion</span>
              </button>
            </div>

            <hr className="my-6" />

            <h2 className="text-lg font-semibold">
              {formData.operationType === 'IMPORT' ? 'Importador' : 'Exportador'} (Cliente)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Razon Social *</label>
                <input
                  type="text"
                  value={formData.client.companyName}
                  onChange={(e) => handleChange('client', 'companyName', e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">NIF/CIF *</label>
                <input
                  type="text"
                  value={formData.client.nif}
                  onChange={(e) => handleChange('client', 'nif', e.target.value.toUpperCase())}
                  className={`input ${formData.client.nif && !/^[A-Z0-9]{8,10}$/.test(formData.client.nif) ? 'border-red-500' : ''}`}
                  placeholder="B12345678"
                  pattern="[A-Z0-9]{8,10}"
                  required
                />
                {formData.client.nif && !/^[A-Z0-9]{8,10}$/.test(formData.client.nif) && (
                  <p className="text-xs text-red-500 mt-1">El NIF debe tener 8-10 caracteres alfanumericos</p>
                )}
              </div>
              <div>
                <label className="label">EORI</label>
                <input
                  type="text"
                  value={formData.client.eori}
                  onChange={(e) => handleChange('client', 'eori', e.target.value)}
                  className="input"
                  placeholder="ES + NIF"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Direccion</label>
                <input
                  type="text"
                  value={formData.client.address}
                  onChange={(e) => handleChange('client', 'address', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Ciudad</label>
                <input
                  type="text"
                  value={formData.client.city}
                  onChange={(e) => handleChange('client', 'city', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Codigo Postal</label>
                <input
                  type="text"
                  value={formData.client.postalCode}
                  onChange={(e) => handleChange('client', 'postalCode', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={formData.client.email}
                  onChange={(e) => handleChange('client', 'email', e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Telefono</label>
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
              {formData.operationType === 'IMPORT' ? 'Exportador (Proveedor)' : 'Consignatario (Destinatario)'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Razon Social</label>
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
                <label className="label">Pais *</label>
                <input
                  type="text"
                  value={formData.operationType === 'IMPORT' ? formData.exporter.country : formData.consignee.country}
                  onChange={(e) => handleChange(
                    formData.operationType === 'IMPORT' ? 'exporter' : 'consignee',
                    'country',
                    e.target.value
                  )}
                  className="input"
                  placeholder="Codigo ISO (ej: CN, US, DE)"
                  required
                />
              </div>
              <div>
                <label className="label">Ciudad</label>
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
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Goods */}
        {step === 2 && (
          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Mercancias</h2>
              <button
                type="button"
                onClick={addGoodsItem}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <PlusIcon className="w-4 h-4" />
                Anadir Partida
              </button>
            </div>

            {formData.goods.map((item, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">Partida {index + 1}</h3>
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
                    <label className="label">Descripcion de la Mercancia *</label>
                    <textarea
                      value={item.description}
                      onChange={(e) => handleGoodsChange(index, 'description', e.target.value)}
                      className="input"
                      rows={2}
                      placeholder="Describa el producto con detalle: material, funcion, uso..."
                      required
                    />
                  </div>

                  {/* Additional info for better classification */}
                  <div>
                    <label className="label">Material Principal</label>
                    <input
                      type="text"
                      value={item.material || ''}
                      onChange={(e) => handleGoodsChange(index, 'material', e.target.value)}
                      className="input"
                      placeholder="Ej: plastico, algodon, metal..."
                    />
                  </div>
                  <div>
                    <label className="label">Uso/Funcion</label>
                    <input
                      type="text"
                      value={item.use || ''}
                      onChange={(e) => handleGoodsChange(index, 'use', e.target.value)}
                      className="input"
                      placeholder="Ej: proteccion movil, decorativo..."
                    />
                  </div>

                  <div>
                    <label className="label">Codigo TARIC</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.taricCode}
                        onChange={(e) => handleGoodsChange(index, 'taricCode', e.target.value)}
                        className="input flex-1"
                        placeholder="10 digitos"
                        maxLength={10}
                      />
                      <button
                        type="button"
                        onClick={() => handleClassifyWithAI(index)}
                        disabled={classifyingIndex === index}
                        className="btn-primary flex items-center gap-1 whitespace-nowrap"
                        title="Clasificar con IA"
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
                        Codigo TARIC valido
                        {item.dutyRate !== undefined && ` - Arancel: ${item.dutyRate}%`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="label">Pais de Origen *</label>
                    <input
                      type="text"
                      value={item.originCountry}
                      onChange={(e) => handleGoodsChange(index, 'originCountry', e.target.value)}
                      className="input"
                      placeholder="Codigo ISO (ej: CN)"
                      required
                    />
                  </div>

                  {/* AI Classification Results */}
                  {classificationResults[index] && (
                    <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1">
                        <SparklesIcon className="w-4 h-4" />
                        Sugerencias de IA
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
                                Arancel: {suggestion.duty_rate || 0}%
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
                                Aplicar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {classificationResults[index].warnings?.length > 0 && (
                        <div className="mt-2 text-xs text-yellow-700">
                          <p className="font-medium">Advertencias:</p>
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
                    <label className="label">Cantidad</label>
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
                        <option value="PCS">Uds</option>
                        <option value="MTR">M</option>
                        <option value="LTR">L</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Peso Neto (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={item.netWeight}
                      onChange={(e) => handleGoodsChange(index, 'netWeight', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Peso Bruto (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={item.grossWeight}
                      onChange={(e) => handleGoodsChange(index, 'grossWeight', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Valor Factura *</label>
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
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-primary"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Transport */}
        {step === 3 && (
          <div className="card space-y-6">
            <h2 className="text-lg font-semibold">Transporte e Incoterm</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Modo de Transporte *</label>
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
                <label className="label">Incoterm *</label>
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
                <label className="label">Lugar Incoterm</label>
                <input
                  type="text"
                  value={formData.incotermPlace}
                  onChange={(e) => handleChange(null, 'incotermPlace', e.target.value)}
                  className="input"
                  placeholder="Ej: Puerto de Barcelona"
                />
              </div>
            </div>

            <hr className="my-6" />

            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <h3 className="font-medium text-gray-700 mb-3">Resumen del Expediente</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Tipo</p>
                  <p className="font-medium">{formData.operationType === 'IMPORT' ? 'Importacion' : 'Exportacion'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium">{formData.client.companyName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Partidas</p>
                  <p className="font-medium">{formData.goods.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Transporte</p>
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
                Anterior
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Creando...' : 'Crear Expediente'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
