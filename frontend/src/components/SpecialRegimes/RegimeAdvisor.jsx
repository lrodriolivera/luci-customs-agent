import React, { useState } from 'react'
import { specialRegimesAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  SparklesIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CogIcon,
  ClockIcon,
  BuildingStorefrontIcon,
  TruckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

// Iconos por tipo de regimen
const REGIME_ICONS = {
  '51': CogIcon,
  '53': ClockIcon,
  '71': BuildingStorefrontIcon,
  'T1': TruckIcon,
  'T2': TruckIcon
}

// Colores por tipo de regimen
const REGIME_COLORS = {
  '51': 'blue',
  '53': 'purple',
  '71': 'amber',
  'T1': 'green',
  'T2': 'teal'
}

export default function RegimeAdvisor({ onClose, onSelectRegime }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    operation_type: '',
    description: '',
    goods_description: '',
    taric_code: '',
    estimated_value: 0,
    origin_country: '',
    objective: '',
    expected_duration: 12,
    will_reexport: false,
    destination_country: '',
    transformation_process: '',
    final_product: '',
    additional_info: ''
  })
  const [recommendation, setRecommendation] = useState(null)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const analyzeOperation = async () => {
    if (!formData.operation_type || !formData.description || !formData.goods_description) {
      toast.error('Completa los campos obligatorios')
      return
    }

    setLoading(true)
    try {
      const response = await specialRegimesAPI.aiAdvise(formData)
      if (response.data?.success) {
        setRecommendation(response.data.data)
        setStep(2)
      } else {
        toast.error('Error al analizar la operacion')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al conectar con el servicio de IA')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRegime = (regimeCode) => {
    if (onSelectRegime) {
      onSelectRegime(regimeCode, recommendation)
    }
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center gap-3 text-white">
            <SparklesIcon className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-semibold">{t('specialRegimes.aiAdvisorTitle')}</h2>
              <p className="text-sm text-blue-100">{t('specialRegimes.aiAdvisorSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            <OperationForm
              formData={formData}
              onChange={handleChange}
              onAnalyze={analyzeOperation}
              loading={loading}
            />
          ) : (
            <RecommendationView
              recommendation={recommendation}
              onSelectRegime={handleSelectRegime}
              onBack={() => setStep(1)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Formulario de operacion
function OperationForm({ formData, onChange, onAnalyze, loading }) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
        <LightBulbIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-800">Describe tu operacion</p>
          <p className="text-sm text-blue-600">
            Cuanta mas informacion proporciones, mejor sera la recomendacion del regimen especial
          </p>
        </div>
      </div>

      {/* Tipo de operacion */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de operacion <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: 'transformation', label: 'Transformacion', desc: 'Procesar y reexportar' },
            { value: 'temporary_use', label: 'Uso Temporal', desc: 'Ferias, equipos, muestras' },
            { value: 'storage', label: 'Almacenamiento', desc: 'Stock sin derechos' },
            { value: 'transit', label: 'Transito', desc: 'Movimiento entre paises' }
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange('operation_type', opt.value)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                formData.operation_type === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-sm">{opt.label}</p>
              <p className="text-xs text-gray-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Descripcion */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripcion de la operacion <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => onChange('description', e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={3}
          placeholder="Ej: Importar componentes electronicos de China para ensamblar tablets y exportar a Europa"
        />
      </div>

      {/* Mercancias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion de mercancias <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.goods_description}
            onChange={(e) => onChange('goods_description', e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ej: Placas base, pantallas LCD, baterias"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Codigo TARIC (opcional)
          </label>
          <input
            type="text"
            value={formData.taric_code}
            onChange={(e) => onChange('taric_code', e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ej: 8542310000"
          />
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor estimado (EUR)
          </label>
          <input
            type="number"
            value={formData.estimated_value}
            onChange={(e) => onChange('estimated_value', parseFloat(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pais de origen
          </label>
          <input
            type="text"
            value={formData.origin_country}
            onChange={(e) => onChange('origin_country', e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ej: China, USA, Marruecos"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duracion prevista (meses)
          </label>
          <input
            type="number"
            value={formData.expected_duration}
            onChange={(e) => onChange('expected_duration', parseInt(e.target.value) || 12)}
            className="w-full border rounded-lg px-3 py-2"
            min="1"
            max="36"
          />
        </div>
      </div>

      {/* Destino */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.will_reexport}
              onChange={(e) => onChange('will_reexport', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">Se reexportaran las mercancias</span>
          </label>
        </div>
        {formData.will_reexport && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pais de destino
            </label>
            <input
              type="text"
              value={formData.destination_country}
              onChange={(e) => onChange('destination_country', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ej: Alemania, Francia, USA"
            />
          </div>
        )}
      </div>

      {/* Transformacion (si aplica) */}
      {formData.operation_type === 'transformation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proceso de transformacion
            </label>
            <input
              type="text"
              value={formData.transformation_process}
              onChange={(e) => onChange('transformation_process', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ej: Ensamblaje, soldadura, montaje"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto final
            </label>
            <input
              type="text"
              value={formData.final_product}
              onChange={(e) => onChange('final_product', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ej: Tablets, smartphones, ordenadores"
            />
          </div>
        </div>
      )}

      {/* Info adicional */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Informacion adicional
        </label>
        <textarea
          value={formData.additional_info}
          onChange={(e) => onChange('additional_info', e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={2}
          placeholder="Cualquier informacion relevante adicional..."
        />
      </div>

      {/* Boton analizar */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Analizando con IA...
            </>
          ) : (
            <>
              <SparklesIcon className="h-5 w-5" />
              Analizar y Recomendar
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Vista de recomendacion
function RecommendationView({ recommendation, onSelectRegime, onBack }) {
  if (!recommendation) return null

  const regimeCode = recommendation.recommended_regime
  const RegimeIcon = REGIME_ICONS[regimeCode] || CogIcon
  const regimeColor = REGIME_COLORS[regimeCode] || 'gray'

  return (
    <div className="space-y-6">
      {/* Recomendacion principal */}
      <div className={`bg-${regimeColor}-50 border border-${regimeColor}-200 rounded-lg p-6`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 bg-${regimeColor}-100 rounded-full`}>
            <RegimeIcon className={`h-8 w-8 text-${regimeColor}-600`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className={`text-xl font-bold text-${regimeColor}-800`}>
                Regimen {regimeCode}: {recommendation.regime_name}
              </h3>
              <span className={`px-2 py-1 rounded text-sm font-medium bg-${regimeColor}-200 text-${regimeColor}-800`}>
                {recommendation.confidence}% confianza
              </span>
            </div>
            <p className="text-gray-700">{recommendation.reasoning}</p>
          </div>
        </div>
      </div>

      {/* Beneficios */}
      {recommendation.benefits?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            Beneficios
          </h4>
          <ul className="space-y-2">
            {recommendation.benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-green-500 mt-0.5">+</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ahorro estimado */}
      {recommendation.estimated_savings && (
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">Ahorro estimado</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-green-600">Aranceles suspendidos:</span>
              <span className="font-medium ml-2">{recommendation.estimated_savings.duties_saved}%</span>
            </div>
            <div>
              <span className="text-green-600">IVA suspendido:</span>
              <span className="font-medium ml-2">{recommendation.estimated_savings.vat_saved}%</span>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-2">{recommendation.estimated_savings.explanation}</p>
        </div>
      )}

      {/* Requisitos */}
      {recommendation.requirements?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Requisitos</h4>
          <ul className="space-y-2">
            {recommendation.requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-sm bg-gray-50 p-2 rounded">
                <span className="text-gray-400">{i + 1}.</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Advertencias */}
      {recommendation.warnings?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Consideraciones
          </h4>
          <ul className="space-y-1">
            {recommendation.warnings.map((warning, i) => (
              <li key={i} className="text-sm text-amber-700">- {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Proximos pasos */}
      {recommendation.next_steps?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Proximos pasos</h4>
          <div className="space-y-2">
            {recommendation.next_steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                  {i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternativas */}
      {recommendation.alternatives?.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Alternativas</h4>
          <div className="space-y-2">
            {recommendation.alternatives.map((alt, i) => {
              const AltIcon = REGIME_ICONS[alt.regime] || CogIcon
              return (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AltIcon className="h-5 w-5 text-gray-500" />
                    <div>
                      <span className="font-medium">{alt.regime}: {alt.name}</span>
                      <p className="text-xs text-gray-500">{alt.why}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectRegime(alt.regime)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Seleccionar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Volver a analizar
        </button>
        <button
          onClick={() => onSelectRegime(regimeCode)}
          className="btn-primary flex items-center gap-2"
        >
          Crear Regimen {regimeCode}
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
