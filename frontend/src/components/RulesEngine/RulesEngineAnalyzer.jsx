import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { countriesGrouped } from '../../data/countries'
import api from '../../services/api'
import {
  BeakerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  CurrencyEuroIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

export default function RulesEngineAnalyzer() {
  const { t } = useTranslation()
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [formData, setFormData] = useState({
    type: 'import',
    originCountry: 'CN',
    destinationCountry: 'ES',
    goods: [
      {
        taricCode: '',
        description: '',
        quantity: '',
        customsValue: '',
        unit: 'kg'
      }
    ]
  })

  const handleGoodChange = (index, field, value) => {
    const newGoods = [...formData.goods]
    newGoods[index][field] = value
    setFormData({ ...formData, goods: newGoods })
  }

  const addGood = () => {
    setFormData({
      ...formData,
      goods: [...formData.goods, {
        taricCode: '',
        description: '',
        quantity: '',
        customsValue: '',
        unit: 'kg'
      }]
    })
  }

  const removeGood = (index) => {
    const newGoods = formData.goods.filter((_, i) => i !== index)
    setFormData({ ...formData, goods: newGoods })
  }

  const handleAnalyze = async (e) => {
    e.preventDefault()

    // Validar que haya al menos un producto
    if (formData.goods.length === 0 || !formData.goods[0].taricCode) {
      toast.error('Agregue al menos un producto')
      return
    }

    setAnalyzing(true)
    setAnalysis(null)

    try {
      const response = await api.post('/api/rules/analyze', {
        ...formData,
        goods: formData.goods.map(g => ({
          ...g,
          quantity: parseFloat(g.quantity) || 0,
          customsValue: parseFloat(g.customsValue) || 0
        }))
      })

      const data = response.data

      if (data.success) {
        setAnalysis(data.data)
        toast.success('Análisis completado')
      } else {
        toast.error(data.error || 'Error en el análisis')
      }
    } catch (error) {
      console.error('Error analyzing operation:', error)
      toast.error('Error al analizar operación')
    } finally {
      setAnalyzing(false)
    }
  }

  const countries = countriesGrouped.flatMap(g => g.countries.map(c => ({ code: c.code, name: c.label || c.name })))

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BeakerIcon className="h-8 w-8 mr-3 text-indigo-600" />
          {t('rulesEngine.title')}
        </h1>
        <p className="mt-2 text-gray-600">
          {t('rulesEngine.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="space-y-6">
          <form onSubmit={handleAnalyze} className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos de la Operación</h2>

            {/* Tipo de operación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Operación
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="import">Importación</option>
                <option value="export">Exportación</option>
              </select>
            </div>

            {/* País de origen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                País de Origen
              </label>
              <select
                value={formData.originCountry}
                onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* País de destino */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                País de Destino
              </label>
              <select
                value={formData.destinationCountry}
                onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Productos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Productos
              </label>
              {formData.goods.map((good, index) => (
                <div key={index} className="mb-4 p-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Producto {index + 1}</span>
                    {formData.goods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGood(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Código TARIC"
                      value={good.taricCode}
                      onChange={(e) => handleGoodChange(index, 'taricCode', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={good.description}
                      onChange={(e) => handleGoodChange(index, 'description', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Cantidad"
                      value={good.quantity}
                      onChange={(e) => handleGoodChange(index, 'quantity', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Valor aduanero (EUR)"
                      value={good.customsValue}
                      onChange={(e) => handleGoodChange(index, 'customsValue', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addGood}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-indigo-500 hover:text-indigo-600"
              >
                + Agregar Producto
              </button>
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 font-medium flex items-center justify-center"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analizando...
                </>
              ) : (
                <>
                  <BeakerIcon className="h-5 w-5 mr-2" />
                  Analizar Operación
                </>
              )}
            </button>
          </form>
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          {analysis && (
            <>
              {/* Resumen */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <InformationCircleIcon className="h-6 w-6 mr-2 text-indigo-600" />
                  Resumen del Análisis
                </h3>

                {/* Eligibilidad */}
                <div className={`p-4 rounded-lg mb-4 ${analysis.summary.eligible ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    {analysis.summary.eligible ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                    ) : (
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
                    )}
                    <span className={`font-medium ${analysis.summary.eligible ? 'text-green-800' : 'text-red-800'}`}>
                      {analysis.summary.eligible ? 'Operación Elegible' : 'Operación con Restricciones'}
                    </span>
                  </div>
                </div>

                {/* Alertas */}
                {analysis.summary.alerts && analysis.summary.alerts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {analysis.summary.alerts.map((alert, idx) => (
                      <div key={idx} className={`p-3 rounded-md ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-start">
                          <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{alert.code}</p>
                            <p className="text-sm">{alert.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {analysis.summary.warnings && analysis.summary.warnings.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {analysis.summary.warnings.map((warning, idx) => (
                      <div key={idx} className="p-3 rounded-md bg-yellow-50 text-yellow-800">
                        <div className="flex items-start">
                          <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{warning.code}</p>
                            <p className="text-sm">{warning.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Impuestos */}
              {analysis.taxes && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <CurrencyEuroIcon className="h-6 w-6 mr-2 text-green-600" />
                    Impuestos y Aranceles
                  </h3>
                  <div className="space-y-2">
                    {analysis.taxes.tariff && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Arancel:</span>
                        <span className="font-semibold">{analysis.taxes.tariff.toFixed(2)} EUR</span>
                      </div>
                    )}
                    {analysis.taxes.vat && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">IVA ({(analysis.taxes.vat.rate * 100).toFixed(0)}%):</span>
                        <span className="font-semibold">{analysis.taxes.vat.amount.toFixed(2)} EUR</span>
                      </div>
                    )}
                    {analysis.taxes.excise && analysis.taxes.excise.applicable && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Impuestos Especiales:</span>
                        <span className="font-semibold text-orange-600">{analysis.taxes.excise.amount.toFixed(2)} EUR</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 bg-gray-50 rounded-md px-3 mt-2">
                      <span className="font-semibold text-gray-900">TOTAL:</span>
                      <span className="font-bold text-xl text-indigo-600">{analysis.taxes.total.toFixed(2)} EUR</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recomendaciones */}
              {analysis.summary.recommendations && analysis.summary.recommendations.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DocumentTextIcon className="h-6 w-6 mr-2 text-blue-600" />
                    Recomendaciones
                  </h3>
                  <div className="space-y-3">
                    {analysis.summary.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 rounded-md">
                        <p className="text-sm text-blue-900">{rec.message}</p>
                        {rec.action && (
                          <p className="text-xs text-blue-700 mt-1">→ {rec.action}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contingentes */}
              {analysis.quotas && analysis.quotas.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Contingentes Disponibles
                  </h3>
                  <div className="space-y-3">
                    {analysis.quotas.map((quota, idx) => (
                      <div key={idx} className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-purple-900">{quota.description}</p>
                            <p className="text-xs text-purple-700">Orden: {quota.orderNumber}</p>
                            <p className="text-xs text-purple-700">Producto: {quota.product}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            quota.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {quota.available ? 'Disponible' : 'Agotado'}
                          </span>
                        </div>
                        {quota.duty && (
                          <p className="text-xs text-purple-600 mt-2">
                            Ahorro: {(quota.duty.savings * 100).toFixed(2)}% del arancel
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentación */}
              {analysis.documentation && analysis.documentation.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DocumentTextIcon className="h-6 w-6 mr-2 text-gray-600" />
                    Documentación Requerida
                  </h3>
                  <ul className="space-y-2">
                    {analysis.documentation.map((doc, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{typeof doc === 'string' ? doc : doc.type || doc.name || JSON.stringify(doc)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!analysis && (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <BeakerIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                Complete el formulario y haga clic en "Analizar Operación" para ver los resultados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
