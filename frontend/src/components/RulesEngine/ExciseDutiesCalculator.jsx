import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  BeakerIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

export default function ExciseDutiesCalculator() {
  const { t } = useTranslation()
  const [detecting, setDetecting] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [detection, setDetection] = useState(null)
  const [calculation, setCalculation] = useState(null)
  const [formData, setFormData] = useState({
    taricCode: '',
    description: '',
    quantity: '',
    unit: 'L',
    alcoholContent: '',
    price: '',
    productType: ''
  })

  const handleDetect = async (e) => {
    e.preventDefault()

    if (!formData.taricCode) {
      toast.error('Ingrese un código TARIC')
      return
    }

    setDetecting(true)
    setDetection(null)
    setCalculation(null)

    try {
      const response = await fetch('http://localhost:5001/api/excise/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taricCode: formData.taricCode
        })
      })

      const data = await response.json()

      if (data.success) {
        setDetection(data.data)
        if (data.data.subject) {
          toast.success(`Producto sujeto a Impuestos Especiales: ${data.data.categoryName}`)
        } else {
          toast.info('Producto no sujeto a Impuestos Especiales')
        }
      } else {
        toast.error(data.error || 'Error al detectar')
      }
    } catch (error) {
      console.error('Error detecting excise:', error)
      toast.error('Error al detectar producto')
    } finally {
      setDetecting(false)
    }
  }

  const handleCalculate = async (e) => {
    e.preventDefault()

    if (!formData.taricCode || !formData.quantity) {
      toast.error('Complete código TARIC y cantidad')
      return
    }

    setCalculating(true)
    setCalculation(null)

    try {
      const response = await fetch('http://localhost:5001/api/excise/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taricCode: formData.taricCode,
          description: formData.description,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          alcoholContent: formData.alcoholContent ? parseFloat(formData.alcoholContent) : undefined,
          price: formData.price ? parseFloat(formData.price) : undefined,
          productType: formData.productType || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setCalculation(data.data)
        if (data.data.applicable) {
          toast.success(`Impuesto calculado: ${data.data.amount} EUR`)
        } else {
          toast.info('No aplican impuestos especiales')
        }
      } else {
        toast.error(data.error || 'Error al calcular')
      }
    } catch (error) {
      console.error('Error calculating excise:', error)
      toast.error('Error al calcular impuesto')
    } finally {
      setCalculating(false)
    }
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case 'ALCOHOL': return 'text-purple-600 bg-purple-50'
      case 'TOBACCO': return 'text-orange-600 bg-orange-50'
      case 'HYDROCARBONS': return 'text-blue-600 bg-blue-50'
      case 'ELECTRICITY': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const productTypes = {
    ALCOHOL: [
      { value: '', label: '-- Seleccione --' },
      { value: 'BEER', label: 'Cerveza' },
      { value: 'WINE', label: 'Vino' },
      { value: 'SPIRITS', label: 'Bebidas espirituosas' },
      { value: 'ETHYL_ALCOHOL', label: 'Alcohol etílico' }
    ],
    TOBACCO: [
      { value: '', label: '-- Seleccione --' },
      { value: 'CIGARETTES', label: 'Cigarrillos' },
      { value: 'CIGARS', label: 'Cigarros (puros)' },
      { value: 'FINE_CUT', label: 'Picadura para liar' },
      { value: 'OTHER_TOBACCO', label: 'Otros tabacos' }
    ],
    HYDROCARBONS: [
      { value: '', label: '-- Seleccione --' },
      { value: 'GASOLINE', label: 'Gasolina' },
      { value: 'DIESEL', label: 'Gasóleo/Diésel' },
      { value: 'KEROSENE', label: 'Queroseno' },
      { value: 'FUEL_OIL', label: 'Fuelóleo' },
      { value: 'LPG', label: 'GLP (Gas licuado)' },
      { value: 'NATURAL_GAS', label: 'Gas natural' },
      { value: 'COAL', label: 'Carbón' }
    ]
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BeakerIcon className="h-8 w-8 mr-3 text-orange-600" />
          {t('excise.title')}
        </h1>
        <p className="mt-2 text-gray-600">
          {t('excise.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="space-y-6">
          {/* Detección */}
          <form onSubmit={handleDetect} className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Detectar Producto</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código TARIC *
              </label>
              <input
                type="text"
                value={formData.taricCode}
                onChange={(e) => setFormData({ ...formData, taricCode: e.target.value })}
                placeholder="ej. 2203000010 (cerveza)"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ejemplos: 2203 (cerveza), 2402 (cigarrillos), 2710 (hidrocarburos)
              </p>
            </div>

            <button
              type="submit"
              disabled={detecting}
              className="w-full bg-orange-600 text-white py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400 font-medium flex items-center justify-center"
            >
              {detecting ? 'Detectando...' : 'Detectar Producto'}
            </button>
          </form>

          {/* Cálculo */}
          {detection && detection.subject && (
            <form onSubmit={handleCalculate} className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Calcular Impuesto</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción del producto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unidad
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="L">Litros (L)</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="ton">Toneladas (ton)</option>
                    <option value="units">Unidades</option>
                    <option value="kWh">Kilovatios-hora (kWh)</option>
                    <option value="MWh">Megavatios-hora (MWh)</option>
                  </select>
                </div>
              </div>

              {/* Campos específicos según categoría */}
              {detection.category === 'ALCOHOL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grado Alcohólico (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.alcoholContent}
                    onChange={(e) => setFormData({ ...formData, alcoholContent: e.target.value })}
                    placeholder="5.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              {detection.category === 'TOBACCO' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio Venta al Público (EUR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="5000.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              {detection.category === 'HYDROCARBONS' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Producto
                  </label>
                  <select
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  >
                    {productTypes.HYDROCARBONS.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={calculating}
                className="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center justify-center"
              >
                {calculating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Calculando...
                  </>
                ) : (
                  'Calcular Impuesto'
                )}
              </button>
            </form>
          )}

          {/* Info SILICIE */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Sistema SILICIE:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Alcohol: Ley 38/1992 - €/litro/grado o €/litro alcohol puro</li>
                  <li>Tabaco: Componente específico + proporcional (mínimo garantizado)</li>
                  <li>Hidrocarburos: €/1000 litros, €/tonelada o €/gigajulio</li>
                  <li>Electricidad: 5.11% sobre consumo</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          {/* Detección */}
          {detection && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                {detection.subject ? (
                  <CheckCircleIcon className="h-6 w-6 mr-2 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-6 w-6 mr-2 text-gray-600" />
                )}
                Resultado de Detección
              </h3>

              {detection.subject ? (
                <div>
                  <div className={`p-4 rounded-lg mb-4 ${getCategoryColor(detection.category)}`}>
                    <p className="font-medium text-lg">{detection.categoryName}</p>
                    <p className="text-sm mt-1">{detection.description}</p>
                    <p className="text-xs mt-2">Rango TARIC: {detection.taricRange}</p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm font-medium text-yellow-900">⚠️ Producto Sujeto a IIEE</p>
                    <p className="text-xs text-yellow-800 mt-1">
                      Este producto requiere cálculo y pago de Impuestos Especiales
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-600">Producto NO sujeto a Impuestos Especiales</p>
                  <p className="text-sm text-gray-500 mt-2">
                    No se requieren declaraciones SILICIE para este TARIC
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cálculo */}
          {calculation && (
            <>
              {calculation.applicable ? (
                <div className="space-y-6">
                  {/* Resultado del impuesto */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Impuesto Calculado
                    </h3>

                    <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-6 mb-4">
                      <p className="text-sm text-gray-600 mb-2">Impuesto Especial a Pagar:</p>
                      <p className="text-4xl font-bold text-orange-600">{calculation.amount.toFixed(2)} EUR</p>
                    </div>

                    <div className="space-y-2">
                      {calculation.subcategory && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">Subcategoría:</span>
                          <span className="font-medium">{calculation.subcategory}</span>
                        </div>
                      )}
                      {calculation.rate && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">Tarifa:</span>
                          <span className="font-medium">{calculation.rate} {calculation.unit}</span>
                        </div>
                      )}
                      {calculation.calculation && (
                        <div className="py-2">
                          <p className="text-xs text-gray-600 mb-1">Cálculo:</p>
                          <p className="text-sm font-mono text-gray-700 bg-gray-50 p-2 rounded">
                            {calculation.calculation}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Componentes (para tabaco) */}
                    {calculation.specificComponent !== undefined && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm py-1">
                          <span className="text-gray-600">Componente específico:</span>
                          <span>{calculation.specificComponent.toFixed(2)} EUR</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                          <span className="text-gray-600">Componente proporcional:</span>
                          <span>{calculation.proportionalComponent.toFixed(2)} EUR</span>
                        </div>
                        {calculation.minimumTax && (
                          <div className="flex justify-between text-sm py-1">
                            <span className="text-gray-600">Impuesto mínimo:</span>
                            <span>{calculation.minimumTax.toFixed(2)} EUR</span>
                          </div>
                        )}
                      </div>
                    )}

                    {calculation.note && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-md">
                        <p className="text-sm text-blue-800">{calculation.note}</p>
                      </div>
                    )}
                  </div>

                  {/* Requisitos */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <DocumentTextIcon className="h-6 w-6 mr-2 text-gray-600" />
                      Requisitos y Documentación
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        <span className="text-sm text-gray-700">
                          Registro como operador SILICIE ante la Agencia Tributaria
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        <span className="text-sm text-gray-700">
                          Documento Administrativo Electrónico (e-AD) en EMCS
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        <span className="text-sm text-gray-700">
                          Declaración-liquidación mensual modelo 553 (hidrocarburos) o correspondiente
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        <span className="text-sm text-gray-700">
                          Garantía para suspensión de impuestos (si aplica)
                        </span>
                      </li>
                      {calculation.category === 'TOBACCO' && (
                        <li className="flex items-start">
                          <span className="text-orange-600 mr-2">•</span>
                          <span className="text-sm text-orange-700 font-medium">
                            Marcas fiscales obligatorias para cigarrillos y picadura
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 text-center">
                  <ExclamationCircleIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">No se pudo calcular el impuesto</p>
                  {calculation.error && (
                    <p className="text-sm text-gray-500 mt-2">{calculation.error}</p>
                  )}
                  {calculation.exemption && (
                    <p className="text-sm text-green-600 mt-2">{calculation.exemption}</p>
                  )}
                </div>
              )}
            </>
          )}

          {!detection && !calculation && (
            <div className="bg-gray-50 rounded-lg p-12 text-center h-full flex flex-col justify-center">
              <BeakerIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                Ingrese un código TARIC para detectar si el producto está sujeto a Impuestos Especiales
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
