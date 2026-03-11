import React, { useState } from 'react'
import { specialRegimesAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'

export default function YieldValidator({ onClose, regimeData }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    input_goods: regimeData?.goods?.map(g => ({
      description: g.description || '',
      taric_code: g.taricCode || '',
      quantity: g.quantity || 0,
      unit: g.unitOfMeasure || 'KGM',
      weight: g.netWeight || 0,
      value: g.customsValue || 0
    })) || [{ description: '', taric_code: '', quantity: 0, unit: 'KGM', weight: 0, value: 0 }],
    output_goods: regimeData?.inwardProcessing?.mainCompensatingProducts?.map(p => ({
      description: p.description || '',
      taric_code: p.taricCode || '',
      quantity: p.expectedQuantity || 0,
      unit: 'KGM',
      weight: 0,
      value: 0
    })) || [{ description: '', taric_code: '', quantity: 0, unit: 'KGM', weight: 0, value: 0 }],
    process_type: regimeData?.inwardProcessing?.authorizedOperations?.[0] || '',
    process_description: '',
    proposed_yield_rate: regimeData?.inwardProcessing?.yieldRate || 85,
    estimated_waste: regimeData?.inwardProcessing?.wasteLoss?.expectedPercent || 15,
    industry_sector: '',
    calculation_method: regimeData?.inwardProcessing?.yieldMethod || 'calculated'
  })
  const [validation, setValidation] = useState(null)

  const handleInputGoodChange = (index, field, value) => {
    setFormData(prev => {
      const goods = [...prev.input_goods]
      goods[index] = { ...goods[index], [field]: value }
      return { ...prev, input_goods: goods }
    })
  }

  const handleOutputGoodChange = (index, field, value) => {
    setFormData(prev => {
      const goods = [...prev.output_goods]
      goods[index] = { ...goods[index], [field]: value }
      return { ...prev, output_goods: goods }
    })
  }

  const addInputGood = () => {
    setFormData(prev => ({
      ...prev,
      input_goods: [...prev.input_goods, { description: '', taric_code: '', quantity: 0, unit: 'KGM', weight: 0, value: 0 }]
    }))
  }

  const addOutputGood = () => {
    setFormData(prev => ({
      ...prev,
      output_goods: [...prev.output_goods, { description: '', taric_code: '', quantity: 0, unit: 'KGM', weight: 0, value: 0 }]
    }))
  }

  const removeInputGood = (index) => {
    if (formData.input_goods.length > 1) {
      setFormData(prev => ({
        ...prev,
        input_goods: prev.input_goods.filter((_, i) => i !== index)
      }))
    }
  }

  const removeOutputGood = (index) => {
    if (formData.output_goods.length > 1) {
      setFormData(prev => ({
        ...prev,
        output_goods: prev.output_goods.filter((_, i) => i !== index)
      }))
    }
  }

  const validateYield = async () => {
    setLoading(true)
    try {
      const response = await specialRegimesAPI.aiValidateYield(formData)
      if (response.data?.success) {
        setValidation(response.data.data)
      } else {
        toast.error('Error al validar la tasa de rendimiento')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al conectar con el servicio de IA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <BeakerIcon className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-semibold">{t('specialRegimes.yieldValidatorTitle')}</h2>
              <p className="text-sm text-blue-100">{t('specialRegimes.yieldValidatorSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Materias primas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Materias Primas (Entrada)</h3>
              <button
                type="button"
                onClick={addInputGood}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Anadir
              </button>
            </div>
            <div className="space-y-2">
              {formData.input_goods.map((good, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 items-center">
                  <input
                    type="text"
                    value={good.description}
                    onChange={(e) => handleInputGoodChange(index, 'description', e.target.value)}
                    className="col-span-2 border rounded px-2 py-1 text-sm"
                    placeholder="Descripcion"
                  />
                  <input
                    type="text"
                    value={good.taric_code}
                    onChange={(e) => handleInputGoodChange(index, 'taric_code', e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="TARIC"
                  />
                  <input
                    type="number"
                    value={good.quantity}
                    onChange={(e) => handleInputGoodChange(index, 'quantity', parseFloat(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="Cantidad"
                  />
                  <input
                    type="number"
                    value={good.weight}
                    onChange={(e) => handleInputGoodChange(index, 'weight', parseFloat(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="Peso kg"
                  />
                  <button
                    type="button"
                    onClick={() => removeInputGood(index)}
                    className="text-red-500 hover:text-red-700"
                    disabled={formData.input_goods.length === 1}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Productos compensadores */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Productos Compensadores (Salida)</h3>
              <button
                type="button"
                onClick={addOutputGood}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Anadir
              </button>
            </div>
            <div className="space-y-2">
              {formData.output_goods.map((good, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 items-center">
                  <input
                    type="text"
                    value={good.description}
                    onChange={(e) => handleOutputGoodChange(index, 'description', e.target.value)}
                    className="col-span-2 border rounded px-2 py-1 text-sm"
                    placeholder="Descripcion producto final"
                  />
                  <input
                    type="text"
                    value={good.taric_code}
                    onChange={(e) => handleOutputGoodChange(index, 'taric_code', e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="TARIC"
                  />
                  <input
                    type="number"
                    value={good.quantity}
                    onChange={(e) => handleOutputGoodChange(index, 'quantity', parseFloat(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="Cantidad esperada"
                  />
                  <input
                    type="number"
                    value={good.weight}
                    onChange={(e) => handleOutputGoodChange(index, 'weight', parseFloat(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="Peso kg"
                  />
                  <button
                    type="button"
                    onClick={() => removeOutputGood(index)}
                    className="text-red-500 hover:text-red-700"
                    disabled={formData.output_goods.length === 1}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Proceso */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de proceso
              </label>
              <select
                value={formData.process_type}
                onChange={(e) => setFormData(prev => ({ ...prev, process_type: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Seleccionar...</option>
                <option value="assembly">Ensamblaje</option>
                <option value="manufacturing">Fabricacion</option>
                <option value="processing">Procesamiento</option>
                <option value="repair">Reparacion</option>
                <option value="packaging">Embalaje/Envasado</option>
                <option value="mixing">Mezcla/Formulacion</option>
                <option value="cutting">Corte/Confeccion</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sector industrial
              </label>
              <select
                value={formData.industry_sector}
                onChange={(e) => setFormData(prev => ({ ...prev, industry_sector: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Seleccionar...</option>
                <option value="electronics">Electronica</option>
                <option value="textile">Textil</option>
                <option value="automotive">Automocion</option>
                <option value="food">Alimentacion</option>
                <option value="pharmaceutical">Farmaceutico</option>
                <option value="chemical">Quimico</option>
                <option value="machinery">Maquinaria</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          {/* Descripcion del proceso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion del proceso de transformacion
            </label>
            <textarea
              value={formData.process_description}
              onChange={(e) => setFormData(prev => ({ ...prev, process_description: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
              placeholder="Describe el proceso de transformacion..."
            />
          </div>

          {/* Tasas */}
          <div className="grid grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tasa de rendimiento propuesta (%)
              </label>
              <input
                type="number"
                value={formData.proposed_yield_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, proposed_yield_rate: parseFloat(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Perdidas/desperdicios estimados (%)
              </label>
              <input
                type="number"
                value={formData.estimated_waste}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_waste: parseFloat(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metodo de calculo
              </label>
              <select
                value={formData.calculation_method}
                onChange={(e) => setFormData(prev => ({ ...prev, calculation_method: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="standard">Estandar (predefinido)</option>
                <option value="calculated">Calculado (especificaciones)</option>
                <option value="actual">Real (resultados efectivos)</option>
              </select>
            </div>
          </div>

          {/* Resultado de validacion */}
          {validation && (
            <div className={`rounded-lg p-4 ${validation.yield_rate_valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                {validation.yield_rate_valid ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                ) : (
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <h4 className={`font-medium ${validation.yield_rate_valid ? 'text-green-800' : 'text-red-800'}`}>
                    {validation.yield_rate_valid ? 'Tasa de rendimiento valida' : 'Tasa de rendimiento cuestionable'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Confianza: {validation.confidence}% | Tasa sugerida: {validation.suggested_yield_rate}%
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-3">{validation.analysis}</p>

              {validation.waste_allowance && (
                <div className="bg-white rounded p-3 mb-3">
                  <p className="text-sm">
                    <span className="font-medium">Perdidas permitidas:</span> {validation.waste_allowance.percentage}%
                  </p>
                  <p className="text-xs text-gray-500">{validation.waste_allowance.justification}</p>
                </div>
              )}

              {validation.industry_benchmarks && (
                <div className="bg-white rounded p-3 mb-3">
                  <p className="text-sm">
                    <span className="font-medium">Referencia del sector:</span> {validation.industry_benchmarks.typical_range}
                  </p>
                  <p className="text-xs text-gray-500">Fuente: {validation.industry_benchmarks.source}</p>
                </div>
              )}

              {validation.recommendations?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Recomendaciones:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {validation.recommendations.map((rec, i) => (
                      <li key={i}>- {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.documentation_needed?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Documentacion requerida:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {validation.documentation_needed.map((doc, i) => (
                      <li key={i}>- {doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
            <button
              onClick={validateYield}
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Validando...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5" />
                  Validar con IA
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
