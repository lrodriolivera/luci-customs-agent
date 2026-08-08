import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { transitAPI } from '../../services/api'
import {
  TruckIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  XMarkIcon,
  ShieldCheckIcon,
  BoltIcon,
  CurrencyEuroIcon,
  LightBulbIcon,
  ArrowTrendingUpIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import {
  normalizarValidacionRuta,
  normalizarPrediccionIncidencias,
  normalizarSugerenciaGarantia,
  normalizarAnalisisCompleto,
  normalizarAutocompletado,
  mezclarSugerencia,
  etiquetaPreparacion,
  importeEUR,
  ETIQUETA_RIESGO
} from './transitAIContract'
import { normalizarMensajes } from './transitMessages'
import { destinoFueraDeEspana, avisoDestinoExtranjero } from './transitDestino'
import { avisoPrecintosRotos } from './transitPrecintos'

const TRANSIT_TYPES = {
  T1: { label: 'T1 - No Union', color: 'blue', description: 'Mercancias no comunitarias' },
  T2: { label: 'T2 - Union', color: 'green', description: 'Mercancias comunitarias' },
  T2F: { label: 'T2F - Union Fiscal', color: 'teal', description: 'Zonas francas' },
  TIR: { label: 'TIR - Carnet TIR', color: 'purple', description: 'Convenio TIR' }
}

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'gray', icon: DocumentTextIcon },
  submitted: { label: 'Enviado', color: 'blue', icon: ArrowPathIcon },
  accepted: { label: 'Aceptado', color: 'indigo', icon: CheckCircleIcon },
  released: { label: 'Liberado', color: 'cyan', icon: TruckIcon },
  in_transit: { label: 'En Transito', color: 'orange', icon: TruckIcon },
  arrived: { label: 'Llegado', color: 'yellow', icon: MapPinIcon },
  unloaded: { label: 'Descargado', color: 'amber', icon: MapPinIcon },
  control_requested: { label: 'Control', color: 'amber', icon: ExclamationTriangleIcon },
  goods_released: { label: 'Entregado', color: 'lime', icon: CheckCircleIcon },
  discrepancy: { label: 'Discrepancia', color: 'red', icon: ExclamationTriangleIcon },
  enquiry: { label: 'Busqueda', color: 'red', icon: ExclamationTriangleIcon },
  // `recovered` y `written_off` estan en el enum de Transit.status desde el
  // principio y faltaban aqui: caian en el fallback a `draft` y un transito dado
  // de baja se etiquetaba "Borrador" en gris, o sea, sin presentar.
  recovered: { label: 'Recuperado', color: 'lime', icon: CheckCircleIcon },
  written_off: { label: 'Dado de Baja', color: 'gray', icon: ExclamationCircleIcon },
  completed: { label: 'Completado', color: 'green', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelado', color: 'gray', icon: ExclamationTriangleIcon }
}

/**
 * Un estado que el frontend no conozca se muestra con su codigo crudo. Antes
 * caia en `STATUS_CONFIG.draft` y se presentaba como "Borrador": una etiqueta
 * falsa y tranquilizadora oculta el desajuste con el backend, un codigo visible
 * lo delata.
 */
const configEstado = (status) =>
  STATUS_CONFIG[status] || { label: status || 'Desconocido', color: 'gray', icon: ExclamationCircleIcon }

const TRANSPORT_MODES = {
  '1': 'Maritimo',
  '2': 'Ferrocarril',
  '3': 'Carretera',
  '4': 'Aereo',
  '5': 'Postal',
  '7': 'Tuberia',
  '8': 'Navegacion interior'
}

// ==================== Transit AI Panel Component ====================
function TransitAIPanel({ transit, onClose, onApplySuggestion }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('validate')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState({
    validate: null,
    incidents: null,
    guarantee: null,
    full: null
  })

  const tabs = [
    { id: 'validate', label: 'Validar Ruta', icon: ShieldCheckIcon },
    { id: 'incidents', label: 'Predecir Incidencias', icon: ExclamationCircleIcon },
    { id: 'guarantee', label: 'Sugerir Garantia', icon: CurrencyEuroIcon },
    { id: 'full', label: 'Analisis Completo', icon: SparklesIcon }
  ]

  const runAnalysis = async (type) => {
    try {
      setLoading(true)
      setError(null)
      let res

      switch (type) {
        case 'validate':
          res = await transitAPI.aiValidateRoute(transit._id)
          break
        case 'incidents':
          res = await transitAPI.aiPredictIncidents(transit._id)
          break
        case 'guarantee':
          res = await transitAPI.aiSuggestGuarantee(transit._id)
          break
        case 'full':
          res = await transitAPI.aiFullAnalysis(transit._id)
          break
      }

      if (res.data.success) {
        setResults(prev => ({ ...prev, [type]: res.data.data }))
      }
    } catch (err) {
      setError(err.response?.data?.error || `Error en analisis ${type}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApplySuggestion = async (suggestedData) => {
    try {
      setLoading(true)
      const res = await transitAPI.aiApplySuggestion(transit._id, suggestedData)
      if (res.data.success) {
        onApplySuggestion && onApplySuggestion()
        onClose()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error aplicando sugerencia')
    } finally {
      setLoading(false)
    }
  }

  const renderRouteValidation = (raw) => {
    const data = normalizarValidacionRuta(raw)
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Veredicto: valida / con problemas / no evaluada. El fallo del
            analisis es un tercer estado, no un rechazo de la ruta. */}
        {data.fallo ? (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <ExclamationCircleIcon className="w-6 h-6 text-amber-600" />
              <span className="font-medium text-amber-800">
                No se pudo validar la ruta
              </span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              La ruta no ha quedado ni aprobada ni rechazada. Vuelva a ejecutar el analisis o revise la ruta manualmente.
            </p>
          </div>
        ) : (
          <div className={`p-4 rounded-lg ${data.esValida ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              {data.esValida ? (
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              )}
              <span className={`font-medium ${data.esValida ? 'text-green-800' : 'text-red-800'}`}>
                {data.esValida ? 'Ruta Valida' : 'Ruta con Problemas'}
              </span>
            </div>
          </div>
        )}

        {/* Analisis de ruta */}
        {(data.analisis.distancia || data.analisis.dias !== null) && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Analisis de Ruta</h4>
            <div className="space-y-2 text-sm">
              {data.analisis.distancia && (
                <p><span className="text-gray-500">Distancia:</span> {data.analisis.distancia}</p>
              )}
              {data.analisis.dias !== null && (
                <p><span className="text-gray-500">Dias de transito estimados:</span> {data.analisis.dias}</p>
              )}
            </div>
          </div>
        )}

        {/* Incidencias detectadas (routeValidation.issues) */}
        {data.incidencias.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Incidencias Detectadas</h4>
            <div className="space-y-3">
              {data.incidencias.map((inc, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  inc.tipo === 'error' ? 'border-red-200 bg-red-50' :
                  inc.tipo === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium uppercase text-gray-500">{inc.tipo}</span>
                    {inc.segmento && (
                      <span className="text-xs text-gray-500">{inc.segmento}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{inc.descripcion}</p>
                  {inc.recomendacion && (
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Recomendacion:</span> {inc.recomendacion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restricciones de circulacion */}
        {data.analisis.restricciones.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Restricciones
            </h4>
            <ul className="space-y-2 text-sm text-yellow-700">
              {data.analisis.restricciones.map((r, idx) => (
                <li key={idx}>
                  <span className="font-medium">{r.country}:</span> {r.restriction}
                  {r.period && <span className="text-xs"> ({r.period})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Aduanas de transito sugeridas */}
        {data.aduanasSugeridas.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Aduanas de Transito Sugeridas</h4>
            <div className="space-y-2">
              {data.aduanasSugeridas.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">{a.code} {a.name && `- ${a.name}`}</p>
                    <p className="text-xs text-gray-500">{a.country} {a.reason && `- ${a.reason}`}</p>
                  </div>
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">#{a.sequence}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recomendaciones */}
        {data.recomendaciones.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <LightBulbIcon className="w-5 h-5" />
              Recomendaciones
            </h4>
            <ul className="space-y-1 text-sm text-blue-700">
              {data.recomendaciones.map((r, idx) => (
                <li key={idx}>• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const renderIncidentPrediction = (raw) => {
    const data = normalizarPrediccionIncidencias(raw)
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Nivel de riesgo */}
        <div className={`p-4 rounded-lg ${
          data.riesgo === 'high' ? 'bg-red-50 border border-red-200' :
          data.riesgo === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BoltIcon className={`w-6 h-6 ${
                data.riesgo === 'high' ? 'text-red-600' :
                data.riesgo === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              <span className={`font-medium ${
                data.riesgo === 'high' ? 'text-red-800' :
                data.riesgo === 'medium' ? 'text-yellow-800' :
                'text-green-800'
              }`}>
                Riesgo {ETIQUETA_RIESGO[data.riesgo]}
              </span>
            </div>
            {data.score !== null && (
              <span className="text-sm font-medium">
                Puntuacion de riesgo: {data.score}/100
              </span>
            )}
          </div>
        </div>

        {/* Incidencias previstas */}
        {data.incidencias.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Incidencias Potenciales</h4>
            <div className="space-y-3">
              {data.incidencias.map((inc, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  inc.gravedad === 'high' ? 'border-red-200 bg-red-50' :
                  inc.gravedad === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{inc.tipo}</span>
                    {inc.probabilidad !== null && (
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        inc.gravedad === 'high' ? 'bg-red-200 text-red-800' :
                        inc.gravedad === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-gray-200 text-gray-800'
                      }`}>
                        {inc.probabilidad}% probabilidad
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{inc.descripcion}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    {inc.etapa && <span><span className="font-medium">Etapa:</span> {inc.etapa}</span>}
                    {inc.retraso && <span><span className="font-medium">Retraso posible:</span> {inc.retraso}</span>}
                  </div>
                  {inc.medidas.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Mitigacion:</span> {inc.medidas.join('; ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Probabilidad de control por etapa */}
        {data.probabilidadControl && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Probabilidad de Control</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.probabilidadControl.departure ?? 0}%</p>
                <p className="text-xs text-gray-500">En partida</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{data.probabilidadControl.transit ?? 0}%</p>
                <p className="text-xs text-gray-500">En transito</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{data.probabilidadControl.arrival ?? 0}%</p>
                <p className="text-xs text-gray-500">En destino</p>
              </div>
            </div>
          </div>
        )}

        {/* Recomendaciones (objetos con prioridad) */}
        {data.recomendaciones.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-2 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5" />
              Medidas Preventivas Recomendadas
            </h4>
            <ul className="space-y-2 text-sm text-indigo-700">
              {data.recomendaciones.map((r, idx) => (
                <li key={idx}>
                  • <span className="font-medium">{r.accion}</span>
                  {r.motivo && <span className="text-xs text-indigo-600"> — {r.motivo}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const renderGuaranteeSuggestion = (raw) => {
    const data = normalizarSugerenciaGarantia(raw)
    if (!data) return null
    return (
      <div className="space-y-4">
        {/* Garantia recomendada */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
            <CurrencyEuroIcon className="w-5 h-5" />
            Garantia Recomendada
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Tipo</p>
              <p className="font-medium">{data.tipo || 'No determinado'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Importe</p>
              <p className="font-medium text-lg">{importeEUR(data.importe) || 'No calculado'}</p>
            </div>
          </div>
          {data.motivo && (
            <p className="mt-3 text-sm text-gray-600">{data.motivo}</p>
          )}
          {/*
            Sin `codigoTipo` no hay valor valido para el enum `guarantee.type` del
            modelo, asi que no se ofrece aplicar: guardarlo daria un
            ValidationError de Mongoose.
          */}
          {data.codigoTipo && (
            <button
              onClick={() => handleApplySuggestion({
                guarantee: {
                  type: data.codigoTipo,
                  ...(data.importe !== null && { amount: data.importe }),
                  currency: 'EUR'
                }
              })}
              disabled={loading}
              className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
            >
              Aplicar al Transito
            </button>
          )}
        </div>

        {/* Detalle del calculo */}
        {(data.calculo.base !== null || data.calculo.desglose) && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Detalle del Calculo</h4>
            <div className="space-y-2 text-sm">
              {data.calculo.desglose && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Derechos de aduana</span>
                    <span>{importeEUR(data.calculo.desglose.duties) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">IVA</span>
                    <span>{importeEUR(data.calculo.desglose.vat) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Impuestos especiales</span>
                    <span>{importeEUR(data.calculo.desglose.excise) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Otros</span>
                    <span>{importeEUR(data.calculo.desglose.other) || '-'}</span>
                  </div>
                </>
              )}
              {data.calculo.base !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Importe base</span>
                  <span>{importeEUR(data.calculo.base)}</span>
                </div>
              )}
              {data.calculo.reduccion !== null && (
                <div className={`flex justify-between ${data.calculo.reduccion > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  <span>Reduccion aplicada</span>
                  <span>-{data.calculo.reduccion}%</span>
                </div>
              )}
              {data.calculo.motivoReduccion && (
                <p className="text-xs text-gray-500">{data.calculo.motivoReduccion}</p>
              )}
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Importe final</span>
                <span>{importeEUR(data.importe) || 'No calculado'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Alternativas */}
        {data.alternativas.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Alternativas</h4>
            <div className="space-y-2">
              {data.alternativas.map((alt, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">{alt.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {alt.notas}
                      {alt.plazo && ` - Tramitacion: ${alt.plazo}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {alt.coste !== null && <p className="text-sm font-medium">{importeEUR(alt.coste)}</p>}
                    {alt.idoneidad !== null && <p className="text-xs text-gray-500">Idoneidad {alt.idoneidad}%</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Garantia global existente */}
        {data.garantiaGlobal && (
          <div className={`border rounded-lg p-4 ${data.garantiaGlobal.puedeUsarla ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
            <h4 className={`font-medium mb-3 ${data.garantiaGlobal.puedeUsarla ? 'text-blue-800' : 'text-gray-700'}`}>
              Garantia Global del Operador
            </h4>
            <div className="space-y-1 text-sm">
              <p>
                {data.garantiaGlobal.puedeUsarla
                  ? 'Se puede cubrir esta operacion con la garantia global existente.'
                  : 'La garantia global no cubre esta operacion.'}
              </p>
              {data.garantiaGlobal.recomendacion && (
                <p className="text-gray-600">{data.garantiaGlobal.recomendacion}</p>
              )}
            </div>
          </div>
        )}

        {/* Avisos */}
        {data.avisos.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Advertencias
            </h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              {data.avisos.map((w, idx) => (
                <li key={idx}>• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recomendaciones */}
        {data.recomendaciones.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <LightBulbIcon className="w-5 h-5" />
              Recomendaciones
            </h4>
            <ul className="space-y-1 text-sm text-blue-700">
              {data.recomendaciones.map((r, idx) => (
                <li key={idx}>• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const renderFullAnalysis = (raw) => {
    const data = normalizarAnalisisCompleto(raw)
    if (!data) return null
    const puntuacion = data.puntuacion
    return (
      <div className="space-y-4">
        {/* Resumen de preparacion */}
        <div className={`p-4 rounded-lg ${
          puntuacion >= 80 ? 'bg-green-50 border border-green-200' :
          puntuacion >= 60 ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Preparacion del Transito</h4>
              <p className="text-sm text-gray-600">{etiquetaPreparacion(data.nivel)}</p>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-bold ${
                puntuacion >= 80 ? 'text-green-600' :
                puntuacion >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {puntuacion !== null ? `${puntuacion}/100` : 'N/D'}
              </span>
              <p className="text-xs text-gray-500">Puntuacion</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
            <span>Riesgo global: <span className="font-medium">{ETIQUETA_RIESGO[data.riesgoGlobal]}</span></span>
            {data.diasEstimados !== null && <span>Dias estimados: <span className="font-medium">{data.diasEstimados}</span></span>}
            {data.garantiaRequerida !== null && <span>Garantia: <span className="font-medium">{importeEUR(data.garantiaRequerida)}</span></span>}
          </div>
        </div>

        {/* Factores que suman a la preparacion */}
        {data.factores.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Factores Verificados</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {data.factores.map((f, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validacion de ruta embebida */}
        {raw.routeValidation && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <MapPinIcon className="w-5 h-5" />
              Validacion de Ruta
            </h4>
            {renderRouteValidation(raw.routeValidation)}
          </div>
        )}

        {/* Prediccion de incidencias embebida */}
        {raw.incidentPrediction && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <BoltIcon className="w-5 h-5" />
              Prediccion de Incidencias
            </h4>
            {renderIncidentPrediction(raw.incidentPrediction)}
          </div>
        )}

        {/* Garantia embebida */}
        {raw.guaranteeSuggestion && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <CurrencyEuroIcon className="w-5 h-5" />
              Garantia
            </h4>
            {renderGuaranteeSuggestion(raw.guaranteeSuggestion)}
          </div>
        )}

        {/* Proximos pasos (nextSteps, prioridad numerica) */}
        {data.proximosPasos.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-3">Proximos Pasos</h4>
            <div className="space-y-2">
              {data.proximosPasos.map((paso, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    paso.prioridad === 1 ? 'bg-red-200 text-red-800' :
                    paso.prioridad === 2 ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {paso.prioridad ?? idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{paso.accion}</p>
                    {paso.detalle && <p className="text-xs text-gray-500">{paso.detalle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    const currentResult = results[activeTab]

    if (!currentResult) {
      return (
        <div className="text-center py-8">
          <SparklesIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {activeTab === 'validate' && 'Valida la ruta del transito con IA'}
            {activeTab === 'incidents' && 'Predice posibles incidencias en el transito'}
            {activeTab === 'guarantee' && 'Obtiene sugerencias de garantia optima'}
            {activeTab === 'full' && 'Ejecuta un analisis completo con LUCI'}
          </p>
          <button
            onClick={() => runAnalysis(activeTab)}
            disabled={loading}
            className="px-6 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark disabled:opacity-50"
          >
            {loading ? 'Analizando...' : 'Ejecutar Analisis'}
          </button>
        </div>
      )
    }

    switch (activeTab) {
      case 'validate':
        return renderRouteValidation(currentResult)
      case 'incidents':
        return renderIncidentPrediction(currentResult)
      case 'guarantee':
        return renderGuaranteeSuggestion(currentResult)
      case 'full':
        return renderFullAnalysis(currentResult)
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-luci to-luci-dark text-white">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-6 h-6" />
            <div>
              <h2 className="font-bold">Analisis IA - Transito</h2>
              <p className="text-sm text-white/80">{transit.mrn || transit.lrn} - {transit.transitType}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-luci text-luci bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {results[tab.id] && (
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-luci" />
              <span className="ml-2 text-gray-500">Analizando con IA...</span>
            </div>
          ) : (
            renderContent()
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Cerrar
          </button>
          {results[activeTab] && (
            <button
              onClick={() => runAnalysis(activeTab)}
              disabled={loading}
              className="px-4 py-2 text-luci border border-luci rounded-lg hover:bg-luci hover:text-white disabled:opacity-50"
            >
              Actualizar Analisis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Main Transit Manager Component ====================
export default function TransitManager() {
  const { t } = useTranslation()
  const [transits, setTransits] = useState([])
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ transitType: '', status: '', search: '' })
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [showAIPanel, setShowAIPanel] = useState(null) // transit object or null

  useEffect(() => {
    loadData()
  }, [filters, pagination.page])

  /**
   * Cambiar de filtro tiene que devolver a la pagina 1.
   *
   * Filtrando desde la pagina 2 se mantenia `page: 2`, y la API responde 200
   * con lista vacia cuando el filtro no llega a esa pagina. Peor: el paginador
   * solo se pinta con `pages > 1`, asi que si el resultado cabia en una pagina
   * el usuario se quedaba con la pantalla vacia y sin boton para volver,
   * creyendo que no existian transitos de ese tipo.
   */
  const actualizarFiltro = (campo, valor) => {
    setFilters(f => ({ ...f, [campo]: valor }))
    setPagination(p => (p.page === 1 ? p : { ...p, page: 1 }))
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [listRes, statsRes, overdueRes] = await Promise.all([
        transitAPI.list({ ...filters, page: pagination.page, limit: pagination.limit }),
        transitAPI.getStats({}),
        transitAPI.getOverdue()
      ])

      if (listRes.data.success) {
        setTransits(listRes.data.data.transits)
        setPagination(prev => ({ ...prev, ...listRes.data.data.pagination }))
      }
      if (statsRes.data.success) setStats(statsRes.data.data)
      if (overdueRes.data.success) setOverdue(overdueRes.data.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando transitos')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id, action, data = {}) => {
    try {
      setActionLoading(`${id}-${action}`)
      let res

      switch (action) {
        case 'submit':
          res = await transitAPI.submit(id)
          break
        case 'release-departure':
          res = await transitAPI.releaseAtDeparture(id)
          break
        case 'start':
          res = await transitAPI.startTransit(id)
          break
        case 'arrival':
          res = await transitAPI.notifyArrival(id, data)
          break
        case 'unloading':
          res = await transitAPI.notifyUnloading(id, data)
          break
        case 'release-goods':
          res = await transitAPI.releaseGoods(id)
          break
        case 'complete':
          res = await transitAPI.complete(id)
          break
        case 'delete':
          res = await transitAPI.delete(id)
          break
        default:
          throw new Error('Accion no reconocida')
      }

      if (res.data.success) {
        loadData()
      }
    } catch (err) {
      setError(err.response?.data?.error || `Error ejecutando ${action}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getNextActions = (transit) => {
    const actions = []
    // El CC007 y el CC044 van a la aduana de destino, y LUCI solo habla con
    // AEAT: con destino extranjero esos dos avisos no pueden prosperar (ver
    // transitDestino.js). Liberar mercancias es local y sigue disponible.
    const destinoExtranjero = destinoFueraDeEspana(transit)

    switch (transit.status) {
      case 'draft':
        actions.push({ key: 'submit', label: 'Enviar a NCTS', color: 'blue' })
        actions.push({ key: 'delete', label: 'Eliminar', color: 'red' })
        break
      case 'submitted':
        // El IE015 salio y el IE028 con el MRN no ha llegado. Este estado no
        // ofrecia ninguna accion: ni boton aqui, ni transicion que lo aceptara
        // en el backend, y eliminar exige draft. El transito quedaba inmovil.
        // No se ofrece "Eliminar": AEAT puede tener ya la declaracion.
        actions.push({ key: 'submit', label: 'Reintentar Envio a NCTS', color: 'blue' })
        break
      case 'accepted':
        actions.push({ key: 'release-departure', label: 'Liberar en Partida', color: 'cyan' })
        break
      case 'released':
        actions.push({ key: 'start', label: 'Iniciar Transito', color: 'orange' })
        break
      case 'in_transit':
        if (!destinoExtranjero) {
          actions.push({ key: 'arrival', label: 'Notificar Llegada', color: 'yellow' })
        }
        break
      case 'arrived':
        // El CC044 es opcional: se puede liberar directamente o notificar antes
        // la descarga (precintos/conformidad de la mercancia).
        if (!destinoExtranjero) {
          actions.push({ key: 'unloading', label: 'Notificar Descarga', color: 'amber' })
        }
        actions.push({ key: 'release-goods', label: 'Liberar Mercancias', color: 'lime' })
        break
      case 'unloaded':
      case 'control_requested':
        actions.push({ key: 'release-goods', label: 'Liberar Mercancias', color: 'lime' })
        break
      case 'goods_released':
        actions.push({ key: 'complete', label: 'Completar', color: 'green' })
        break
    }

    return actions
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null
    const diff = new Date(deadline) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('transit.title')}</h1>
          <p className="text-gray-500">{t('transit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark"
          >
            <PlusIcon className="w-5 h-5" />
            {t('transit.newTransit')}
          </button>
        </div>
      </div>

      {/* Alerts - Overdue */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            {overdue.length} transito(s) vencido(s)
          </div>
          <div className="space-y-1">
            {overdue.slice(0, 3).map(t => (
              <div key={t._id} className="text-sm text-red-700">
                {t.mrn || t.lrn} - {t.transitType} - Vencio: {formatDate(t.deadlines?.arrivalDeadline)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total || 0}</p>
          </div>
          {Object.entries(TRANSIT_TYPES).map(([type, config]) => (
            <div key={type} className={`bg-${config.color}-50 rounded-lg p-4 border border-${config.color}-200`}>
              <p className="text-sm text-gray-600">{type}</p>
              <p className="text-2xl font-bold">{stats.byType?.[type] || 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Buscar MRN, LRN, referencia..."
            value={filters.search}
            onChange={(e) => actualizarFiltro('search', e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={filters.transitType}
            onChange={(e) => actualizarFiltro('transitType', e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">{t('transit.allTypes')}</option>
            {Object.entries(TRANSIT_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => actualizarFiltro('status', e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">{t('transit.allStatuses')}</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className="w-5 h-5" />
            {t('common.update')}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Cerrar</button>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Cargando...</p>
          </div>
        ) : transits.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TruckIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            {t('transit.noTransits')}
          </div>
        ) : (
          <div className="divide-y">
            {transits.map(transit => {
              const statusConfig = configEstado(transit.status)
              const StatusIcon = statusConfig.icon
              const typeConfig = TRANSIT_TYPES[transit.transitType] || {}
              const isExpanded = expandedId === transit._id
              const daysRemaining = getDaysRemaining(transit.deadlines?.arrivalDeadline)
              const actions = getNextActions(transit)

              return (
                <div key={transit._id} className="hover:bg-gray-50">
                  {/* Main row */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : transit._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg bg-${typeConfig.color}-100`}>
                          <TruckIcon className={`w-6 h-6 text-${typeConfig.color}-600`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{transit.mrn || transit.lrn}</span>
                            <span className={`px-2 py-0.5 text-xs rounded bg-${typeConfig.color}-100 text-${typeConfig.color}-800`}>
                              {transit.transitType}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {transit.reference} | {transit.principal?.name || 'Sin principal'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* AI Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowAIPanel(transit)
                          }}
                          className="p-2 text-luci hover:bg-luci/10 rounded-lg transition-colors"
                          title="Analisis IA"
                        >
                          <SparklesIcon className="w-5 h-5" />
                        </button>

                        {/* Deadline indicator */}
                        {daysRemaining !== null && transit.status !== 'completed' && (
                          <div className={`flex items-center gap-1 text-sm ${
                            daysRemaining < 0 ? 'text-red-600' :
                            daysRemaining <= 2 ? 'text-orange-600' : 'text-gray-600'
                          }`}>
                            <ClockIcon className="w-4 h-4" />
                            {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d vencido` : `${daysRemaining}d`}
                          </div>
                        )}

                        {/* Route summary */}
                        <div className="text-sm text-gray-500 hidden md:block">
                          <MapPinIcon className="w-4 h-4 inline mr-1" />
                          {transit.departureOffice?.code} → {transit.destinationOffice?.code}
                        </div>

                        {/* Status */}
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-${statusConfig.color}-100 text-${statusConfig.color}-800`}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-sm">{statusConfig.label}</span>
                        </div>

                        {/* Expand icon */}
                        {isExpanded ? (
                          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        {/* Info */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700">Informacion</h4>
                          <div className="text-sm space-y-1">
                            <p><span className="text-gray-500">MRN:</span> {transit.mrn || 'Pendiente'}</p>
                            <p><span className="text-gray-500">LRN:</span> {transit.lrn}</p>
                            <p><span className="text-gray-500">Transporte:</span> {TRANSPORT_MODES[transit.transport?.mode] || '-'}</p>
                            <p><span className="text-gray-500">Garantia:</span> {transit.guarantee?.grn || 'Sin garantia'}</p>
                            <p><span className="text-gray-500">Items:</span> {transit.totals?.itemCount || 0}</p>
                            <p><span className="text-gray-500">Peso bruto:</span> {transit.totals?.grossWeight?.toLocaleString() || 0} kg</p>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700">Fechas</h4>
                          <div className="text-sm space-y-1">
                            <p><span className="text-gray-500">Declaracion:</span> {formatDate(transit.dates?.declaration)}</p>
                            <p><span className="text-gray-500">Liberacion partida:</span> {formatDate(transit.dates?.releaseAtDeparture)}</p>
                            <p><span className="text-gray-500">Llegada:</span> {formatDate(transit.dates?.actualArrival)}</p>
                            <p><span className="text-gray-500">Entrega mercancia:</span> {formatDate(transit.dates?.goodsRelease)}</p>
                            <p><span className="text-gray-500">Ultimacion:</span> <span className={transit.dates?.completion ? 'font-semibold text-green-700' : 'text-gray-400'}>{formatDate(transit.dates?.completion) || 'Pendiente'}</span></p>
                            <p><span className="text-gray-500">Limite llegada:</span> <span className={transit.deadlines?.arrivalDeadline && new Date(transit.deadlines.arrivalDeadline) < new Date() ? 'text-red-600 font-semibold' : ''}>{formatDate(transit.deadlines?.arrivalDeadline)}</span></p>
                          </div>
                        </div>

                        {/* Precintos / Seals */}
                        {transit.transport?.seals?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700 flex items-center gap-1">
                            <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
                            Precintos ({transit.transport.seals.length})
                          </h4>
                          <div className="text-sm space-y-1">
                            {transit.transport.seals.map((seal, si) => (
                              <div key={si} className={`flex items-center gap-2 px-2 py-1 rounded ${seal.intactOnArrival === false ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <span className={`w-2 h-2 rounded-full ${seal.intactOnArrival === false ? 'bg-red-500' : seal.intactOnArrival === true ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className="font-mono font-medium">{seal.number}</span>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-500">{seal.sealType === 'customs' ? 'Aduanero' : seal.sealType === 'carrier' ? 'Transportista' : seal.sealType === 'oea' ? 'OEA' : seal.sealType}</span>
                                {seal.affixedBy && <span className="text-gray-400">por {seal.affixedBy}</span>}
                                {seal.intactOnArrival === false && <span className="text-red-600 font-semibold text-xs">ROTO</span>}
                                {seal.intactOnArrival === true && <span className="text-green-600 text-xs">Intacto</span>}
                              </div>
                            ))}
                          </div>
                          {transit.transport.sealCount && (
                            <p className="text-xs text-gray-500">Total precintos declarados: {transit.transport.sealCount}</p>
                          )}
                        </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700">Acciones</h4>
                          <div className="flex flex-wrap gap-2">
                            {/* AI Analysis Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowAIPanel(transit)
                              }}
                              className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-luci to-luci-dark text-white hover:opacity-90 flex items-center gap-1"
                            >
                              <SparklesIcon className="w-4 h-4" />
                              Analisis IA
                            </button>

                            {actions.map(action => (
                              <button
                                key={action.key}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAction(transit._id, action.key)
                                }}
                                disabled={actionLoading === `${transit._id}-${action.key}`}
                                className={`px-3 py-1.5 text-sm rounded-lg bg-${action.color}-100 text-${action.color}-800 hover:bg-${action.color}-200 disabled:opacity-50`}
                              >
                                {actionLoading === `${transit._id}-${action.key}` ? 'Procesando...' : action.label}
                              </button>
                            ))}
                          </div>

                          {/* Por que faltan "Notificar Llegada"/"Notificar Descarga":
                              el transito no termina en Espana y esos avisos se
                              presentan ante la aduana de destino, no ante AEAT. */}
                          {['in_transit', 'arrived'].includes(transit.status) &&
                            avisoDestinoExtranjero(transit) && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-amber-800">{avisoDestinoExtranjero(transit)}</p>
                            </div>
                          )}

                          {/* El CC044 no puede declarar precintos conformes si
                              alguno consta roto: el backend lo rechaza, asi que
                              se dice aqui y no via un 400 al pulsar. */}
                          {['arrived', 'control_requested'].includes(transit.status) &&
                            avisoPrecintosRotos(transit) && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-red-800">{avisoPrecintosRotos(transit)}</p>
                            </div>
                          )}

                          {/* Mensajes NCTS: los intercambiados con AEAT y los que
                              solo son registro local (ver transitMessages.js) */}
                          {transit.messages?.length > 0 && (() => {
                            const mensajes = normalizarMensajes(transit.messages)
                            const intercambiados = mensajes.filter(m => m.intercambiado).length

                            return (
                              <div className="mt-2">
                                <p className="text-sm text-gray-500">
                                  <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                                  {intercambiados > 0
                                    ? `${intercambiados} mensaje(s) intercambiados con AEAT`
                                    : 'Ningun mensaje intercambiado con AEAT'}
                                </p>
                                <ul className="mt-1 space-y-1">
                                  {mensajes.map((m, i) => (
                                    <li key={`${m.tipo}-${m.fecha}-${i}`} className="text-xs flex flex-wrap items-center gap-2">
                                      <span className="font-mono font-medium text-gray-700">{m.tipo}</span>
                                      <span className="text-gray-500">{m.descripcion}</span>
                                      {m.intercambiado ? (
                                        <span className="text-gray-400">
                                          {m.direccion === 'inbound' ? 'recibido de AEAT' : 'enviado a AEAT'}
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                          Solo registro local, no enviado a AEAT
                                        </span>
                                      )}
                                      {m.fecha && (
                                        <span className="text-gray-400">
                                          {new Date(m.fecha).toLocaleString('es-ES')}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Mostrando {transits.length} de {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <TransitCreateForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false)
            loadData()
          }}
        />
      )}

      {/* AI Panel Modal */}
      {showAIPanel && (
        <TransitAIPanel
          transit={showAIPanel}
          onClose={() => setShowAIPanel(null)}
          onApplySuggestion={loadData}
        />
      )}
    </div>
  )
}

// ==================== Create Form Component with AI Auto-Complete ====================
function TransitCreateForm({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    reference: '',
    transitType: 'T1',
    principal: { eori: '', name: '', address: { street: '', city: '', postalCode: '', country: 'ES' } },
    departureOffice: { code: '', name: '', country: 'ES' },
    destinationOffice: { code: '', name: '', country: '' },
    transport: { mode: '3', vehicleId: '', nationality: '' },
    seals: [{ number: '', sealType: 'customs', affixedBy: '' }],
    guarantee: { type: '1', grn: '' },
    route: { countries: [] },
    // `prevDocType` / `prevDocRef` son campos de formulario: handleSubmit los
    // convierte en `previousDocuments` (el formato del modelo) y los descarta.
    goodsItems: [{ itemNumber: 1, description: '', taricCode: '', grossWeight: 0, packages: { count: 1, type: 'CT' }, prevDocType: 'N337', prevDocRef: '' }]
  })
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [expeditionId, setExpeditionId] = useState('')

  const handleAIAutoComplete = async () => {
    try {
      setAiLoading(true)
      setError(null)
      const res = await transitAPI.aiAutoComplete(formData, expeditionId || undefined)

      if (res.data.success) {
        setAiSuggestion(normalizarAutocompletado(res.data.data))
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error obteniendo sugerencias IA')
    } finally {
      setAiLoading(false)
    }
  }

  const applySuggestion = () => {
    if (!aiSuggestion?.datos) return
    // `mezclarSugerencia` descarta los nulls y las listas vacias que devuelve el
    // backend cuando no puede inferir un campo. Un spread plano dejaba
    // `principal.eori` en null (input controlado sin value, imposible escribir)
    // y borraba las partidas de mercancia ya escritas a mano.
    setFormData(prev => mezclarSugerencia(prev, aiSuggestion.datos))
    setAiSuggestion(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      // El modelo guarda los precintos en `transport.seals`; enviarlos en la raiz
      // hacia que Mongoose descartase la clave sin avisar y el precinto escrito por
      // el usuario desaparecia, presentandose el transito sin precintos declarados.
      const { seals, ...resto } = formData
      const precintos = (seals || []).filter(s => s.number?.trim())

      // AEAT exige al menos un documento previo por partida en el IE015 ("No vienen
      // Previous Document..."), asi que el formulario lo pide en campos aparte y
      // aqui se traduce al formato del modelo. Si el usuario los deja en blanco no
      // se manda la clave: un array vacio no cumple la regla y ademas Mongoose
      // guardaria una partida con un documento sin tipo ni referencia.
      const partidas = (resto.goodsItems || []).map(({ prevDocType, prevDocRef, ...g }, idx) => {
        const tipo = prevDocType?.trim()
        const referencia = prevDocRef?.trim()
        if (!tipo || !referencia) return g
        return {
          ...g,
          previousDocuments: [{ type: tipo, reference: referencia, goodsItemNumber: String(idx + 1) }]
        }
      })

      const payload = {
        ...resto,
        goodsItems: partidas,
        transport: { ...resto.transport, seals: precintos, sealCount: precintos.length }
      }

      const res = await transitAPI.create(payload)
      if (res.data.success) {
        onCreated()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando transito')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">Nuevo Transito NCTS</h2>
          <button
            onClick={handleAIAutoComplete}
            disabled={aiLoading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-luci to-luci-dark text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
          >
            <SparklesIcon className="w-4 h-4" />
            {aiLoading ? 'Analizando...' : 'Autocompletar con IA'}
          </button>
        </div>

        {/* AI Suggestion Panel */}
        {aiSuggestion && (
          <div className="p-4 bg-luci/5 border-b">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-luci" />
                <span className="font-medium text-luci">Sugerencia de LUCI</span>
              </div>
              <button
                onClick={() => setAiSuggestion(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {aiSuggestion.confianza !== null && (
              <p className="text-sm text-gray-600 mb-3">
                Confianza: {aiSuggestion.confianza}%
                {aiSuggestion.confianza < 40 && (
                  <span className="text-yellow-700"> — revise todos los campos antes de presentar</span>
                )}
              </p>
            )}

            {aiSuggestion.completados.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1">
                  {aiSuggestion.completados.length === 1
                    ? '1 campo completado:'
                    : `${aiSuggestion.completados.length} campos completados:`}
                </p>
                <p className="text-xs text-gray-600">{aiSuggestion.completados.join(', ')}</p>
              </div>
            )}

            {/* Lo mas importante del panel: los campos que la IA rellena sin poder
                verificarlos. Antes no se pintaban y se aplicaban a ciegas. */}
            {aiSuggestion.porConfirmar.length > 0 && (
              <div className="bg-orange-50 rounded p-2 mb-3">
                <p className="text-xs font-medium text-orange-800 mb-1">Requieren confirmacion:</p>
                <ul className="text-xs text-orange-700 space-y-1">
                  {aiSuggestion.porConfirmar.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium">{c.campo}</span>
                      {c.valor !== null && c.valor !== '' && <span> = {String(c.valor)}</span>}
                      {c.motivo && <span className="block text-orange-600">{c.motivo}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiSuggestion.avisos.length > 0 && (
              <div className="bg-yellow-50 rounded p-2 mb-3">
                <p className="text-xs font-medium text-yellow-800 mb-1">Advertencias:</p>
                <ul className="text-xs text-yellow-700 space-y-0.5">
                  {aiSuggestion.avisos.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={applySuggestion}
              className="w-full py-2 bg-luci text-white rounded-lg hover:bg-luci-dark text-sm"
            >
              Aplicar Sugerencias
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Expedition Link for AI */}
          <div>
            <label htmlFor="transit-expedition-id" className="block text-sm font-medium mb-1">ID Expediente (opcional, para autocompletar)</label>
            <input
              id="transit-expedition-id"
              type="text"
              value={expeditionId}
              onChange={(e) => setExpeditionId(e.target.value)}
              placeholder="Ingresa ID de expediente existente"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Si tienes un expediente, la IA puede extraer datos automaticamente</p>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="transit-reference" className="block text-sm font-medium mb-1">Referencia *</label>
              <input
                id="transit-reference"
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData(f => ({ ...f, reference: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label htmlFor="transit-type" className="block text-sm font-medium mb-1">Tipo de Transito *</label>
              <select
                id="transit-type"
                value={formData.transitType}
                onChange={(e) => setFormData(f => ({ ...f, transitType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {Object.entries(TRANSIT_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Principal */}
          <div>
            <h3 className="font-medium mb-2">Principal Obligado</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="transit-principal-eori" className="block text-sm text-gray-600 mb-1">EORI *</label>
                <input
                  id="transit-principal-eori"
                  type="text"
                  value={formData.principal.eori}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    principal: { ...f.principal, eori: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label htmlFor="transit-principal-name" className="block text-sm text-gray-600 mb-1">Nombre *</label>
                <input
                  id="transit-principal-name"
                  type="text"
                  value={formData.principal.name}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    principal: { ...f.principal, name: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>
          </div>

          {/* Offices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Aduana de Partida</h3>
              <input
                type="text"
                placeholder="Codigo (ej: ES002801)"
                value={formData.departureOffice.code}
                onChange={(e) => setFormData(f => ({
                  ...f,
                  departureOffice: { ...f.departureOffice, code: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <h3 className="font-medium mb-2">Aduana de Destino</h3>
              <input
                type="text"
                placeholder="Codigo (ej: ES002901)"
                value={formData.destinationOffice.code}
                onChange={(e) => setFormData(f => ({
                  ...f,
                  destinationOffice: { ...f.destinationOffice, code: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          {/* Transport */}
          <div>
            <h3 className="font-medium mb-2">Transporte</h3>
            <select
              value={formData.transport.mode}
              onChange={(e) => setFormData(f => ({
                ...f,
                transport: { ...f.transport, mode: e.target.value }
              }))}
              className="w-full border rounded-lg px-3 py-2"
            >
              {Object.entries(TRANSPORT_MODES).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
          </div>

          {/* Guarantee */}
          {formData.transitType === 'T1' && (
            <div>
              <h3 className="font-medium mb-2">Garantia</h3>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={formData.guarantee.type}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    guarantee: { ...f.guarantee, type: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="0">0 - Dispensa</option>
                  <option value="1">1 - Global</option>
                  <option value="2">2 - Individual fianza</option>
                  <option value="3">3 - Efectivo</option>
                </select>
                <input
                  type="text"
                  placeholder="GRN (Numero de referencia)"
                  value={formData.guarantee.grn}
                  onChange={(e) => setFormData(f => ({
                    ...f,
                    guarantee: { ...f.guarantee, grn: e.target.value }
                  }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}

          {/* Transport Details */}
          <div>
            <h3 className="font-medium mb-2">Identificacion medio de transporte</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Matricula / ID vehiculo"
                value={formData.transport.vehicleId}
                onChange={(e) => setFormData(f => ({
                  ...f,
                  transport: { ...f.transport, vehicleId: e.target.value }
                }))}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="text"
                placeholder="Nacionalidad (ej: ES)"
                maxLength={2}
                value={formData.transport.nationality}
                onChange={(e) => setFormData(f => ({
                  ...f,
                  transport: { ...f.transport, nationality: e.target.value.toUpperCase() }
                }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Precintos / Seals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium flex items-center gap-1">
                <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
                Precintos del transito
              </h3>
              <button
                type="button"
                onClick={() => setFormData(f => ({
                  ...f,
                  seals: [...f.seals, { number: '', sealType: 'customs', affixedBy: '' }]
                }))}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Agregar precinto
              </button>
            </div>
            {formData.seals.map((seal, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
                <input
                  type="text"
                  placeholder={`Precinto ${idx + 1} - Numero`}
                  value={seal.number}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      seals: f.seals.map((s, i) => (i === idx ? { ...s, number: e.target.value } : s))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={seal.sealType}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      seals: f.seals.map((s, i) => (i === idx ? { ...s, sealType: e.target.value } : s))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="customs">Aduanero</option>
                  <option value="carrier">Transportista</option>
                  <option value="shipper">Expedidor</option>
                  <option value="oea">OEA (precinto especial)</option>
                </select>
                <input
                  type="text"
                  placeholder="Colocado por"
                  value={seal.affixedBy}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      seals: f.seals.map((s, i) => (i === idx ? { ...s, affixedBy: e.target.value } : s))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                {formData.seals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFormData(f => ({
                      ...f,
                      seals: f.seals.filter((_, i) => i !== idx)
                    }))}
                    className="text-red-400 hover:text-red-600 flex items-center justify-center"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Partidas de mercancia. Sin estos campos el transito se creaba con
              description/taricCode vacios y grossWeight 0, y AEAT rechazaba el IE015
              con el patron de <ent:grossMass>, un mensaje que no nombra el campo. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Partidas de mercancia</h3>
              <button
                type="button"
                onClick={() => setFormData(f => ({
                  ...f,
                  goodsItems: [...f.goodsItems, {
                    itemNumber: f.goodsItems.length + 1,
                    description: '',
                    taricCode: '',
                    grossWeight: 0,
                    packages: { count: 1, type: 'CT' },
                    prevDocType: 'N337',
                    prevDocRef: ''
                  }]
                }))}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Agregar partida
              </button>
            </div>
            {formData.goodsItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                <input
                  type="text"
                  required
                  placeholder={`Partida ${idx + 1} - Descripcion de la mercancia`}
                  value={item.description}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      goodsItems: f.goodsItems.map((g, i) => (i === idx ? { ...g, description: e.target.value } : g))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                />
                <input
                  type="text"
                  required
                  placeholder="Codigo TARIC (ej: 73041100)"
                  value={item.taricCode}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      goodsItems: f.goodsItems.map((g, i) => (i === idx ? { ...g, taricCode: e.target.value } : g))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="0.001"
                    step="0.001"
                    placeholder="Peso bruto (kg)"
                    value={item.grossWeight || ''}
                    onChange={(e) => {
                      setFormData(f => ({
                        ...f,
                        goodsItems: f.goodsItems.map((g, i) => (i === idx ? { ...g, grossWeight: Number(e.target.value) } : g))
                      }))
                    }}
                    className="border rounded-lg px-3 py-2 text-sm w-full"
                  />
                  {formData.goodsItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({
                        ...f,
                        goodsItems: f.goodsItems
                          .filter((_, i) => i !== idx)
                          .map((g, i) => ({ ...g, itemNumber: i + 1 }))
                      }))}
                      className="text-red-400 hover:text-red-600 flex items-center"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Documento previo: AEAT lo exige por partida en el IE015. Sin el,
                    el envio se rechazaba con "No vienen Previous Document..." y el
                    formulario no ofrecia ninguna forma de aportarlo. */}
                <input
                  type="text"
                  placeholder={`Tipo doc. previo (ej: N337)`}
                  value={item.prevDocType || ''}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      goodsItems: f.goodsItems.map((g, i) => (i === idx ? { ...g, prevDocType: e.target.value } : g))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Referencia doc. previo (ej: sumaria 25ES...)"
                  value={item.prevDocRef || ''}
                  onChange={(e) => {
                    setFormData(f => ({
                      ...f,
                      goodsItems: f.goodsItems.map((g, i) => (i === idx ? { ...g, prevDocRef: e.target.value } : g))
                    }))
                  }}
                  className="border rounded-lg px-3 py-2 text-sm md:col-span-3"
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-luci text-white rounded-lg hover:bg-luci-dark disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Transito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
