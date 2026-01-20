import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { declarationsAPI, expeditionsAPI } from '../../services/api'
import {
  DocumentTextIcon,
  CurrencyEuroIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline'

export default function H7DeclarationForm({ expeditionId: propExpeditionId, onSuccess }) {
  const params = useParams()
  const navigate = useNavigate()
  const expeditionId = propExpeditionId || params.expeditionId

  const [expedition, setExpedition] = useState(null)
  const [eligibility, setEligibility] = useState(null)
  const [h7Data, setH7Data] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Formulario H7
  const [formData, setFormData] = useState({
    iossNumber: '',
    customsOffice: 'ES000101', // Valencia por defecto
    forceGenerate: false
  })

  useEffect(() => {
    if (expeditionId) {
      fetchData()
    }
  }, [expeditionId])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Obtener expediente
      const expResponse = await expeditionsAPI.get(expeditionId)
      setExpedition(expResponse.data.data || expResponse.data)

      // Verificar elegibilidad H7
      const eligResponse = await declarationsAPI.checkH7Eligibility(expeditionId)
      setEligibility(eligResponse.data.data)

      // Si ya tiene H7 generado, cargarlo
      const exp = expResponse.data.data || expResponse.data
      if (exp.declaration?.type === 'H7') {
        setH7Data(exp.declaration)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const response = await declarationsAPI.generateH7({
        expeditionId,
        iossNumber: formData.iossNumber || undefined,
        customsOffice: formData.customsOffice,
        forceGenerate: formData.forceGenerate
      })

      if (response.data.success) {
        setH7Data(response.data.data.declaration)
        setSuccess('H7 generado correctamente')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar H7')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await declarationsAPI.submitH7(expeditionId)

      if (response.data.success) {
        setH7Data(response.data.data.declaration)
        setSuccess(`H7 enviado correctamente. MRN: ${response.data.data.mrn}`)
        if (onSuccess) {
          onSuccess(response.data.data)
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar H7')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
      </div>
    )
  }

  if (!expedition) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <p className="text-red-600">Expediente no encontrado</p>
      </div>
    )
  }

  const isH7Generated = h7Data?.lrn
  const isH7Submitted = h7Data?.status === 'submitted'
  const totalValue = expedition.goodsSummary?.totalValue || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <ShoppingBagIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Declaracion H7</h2>
            <p className="text-sm text-gray-500">Importacion de bajo valor (E-commerce)</p>
          </div>
        </div>
        {isH7Submitted && (
          <span className="badge bg-green-100 text-green-800 px-3 py-1">
            Enviada - MRN: {h7Data.mrn}
          </span>
        )}
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Elegibilidad H7 */}
      <div className={`card border-l-4 ${eligibility?.eligible ? 'border-l-green-500 bg-green-50' : 'border-l-yellow-500 bg-yellow-50'}`}>
        <div className="flex items-start gap-4">
          {eligibility?.eligible ? (
            <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
          ) : (
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className={`font-semibold ${eligibility?.eligible ? 'text-green-800' : 'text-yellow-800'}`}>
              {eligibility?.eligible ? 'Expediente elegible para H7' : 'Advertencia de elegibilidad'}
            </h3>
            <p className={`text-sm mt-1 ${eligibility?.eligible ? 'text-green-600' : 'text-yellow-600'}`}>
              {eligibility?.reason || `Valor: ${totalValue.toFixed(2)} EUR (limite: 150 EUR)`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Valor intrínseco</p>
            <p className={`text-xl font-bold ${totalValue <= 150 ? 'text-green-600' : 'text-red-600'}`}>
              {totalValue.toFixed(2)} EUR
            </p>
          </div>
        </div>
      </div>

      {/* Info H7 */}
      <div className="card bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Que es el H7?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Declaracion simplificada para envios e-commerce de bajo valor (hasta 150 EUR)</li>
              <li>Exento de aranceles pero sujeto a IVA (21%)</li>
              <li>Si tiene numero IOSS, el IVA ya esta pagado por el vendedor</li>
              <li>Despacho rapido (normalmente menos de 1 hora)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {!isH7Submitted && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Configuracion H7</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IOSS Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero IOSS (opcional)
              </label>
              <input
                type="text"
                name="iossNumber"
                value={formData.iossNumber}
                onChange={handleInputChange}
                placeholder="IM372XXXXXXXXX"
                className="input"
                disabled={isH7Generated}
              />
              <p className="text-xs text-gray-500 mt-1">
                Import One-Stop Shop - Si el vendedor ya pago el IVA
              </p>
            </div>

            {/* Customs Office */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aduana de presentacion
              </label>
              <select
                name="customsOffice"
                value={formData.customsOffice}
                onChange={handleInputChange}
                className="input"
                disabled={isH7Generated}
              >
                <option value="ES000101">Valencia (ES000101)</option>
                <option value="ES000301">Barcelona (ES000301)</option>
                <option value="ES002801">Madrid Barajas (ES002801)</option>
                <option value="ES004101">Sevilla (ES004101)</option>
                <option value="ES004801">Bilbao (ES004801)</option>
              </select>
            </div>

            {/* Force Generate */}
            {!eligibility?.eligible && !isH7Generated && (
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="forceGenerate"
                    checked={formData.forceGenerate}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-luci focus:ring-luci"
                  />
                  <span className="text-sm text-gray-700">
                    Generar H7 aunque el valor exceda 150 EUR (no recomendado)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3 mt-6">
            {!isH7Generated ? (
              <button
                onClick={handleGenerate}
                disabled={generating || (!eligibility?.eligible && !formData.forceGenerate)}
                className="btn-primary flex items-center gap-2"
              >
                {generating ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <DocumentTextIcon className="w-5 h-5" />
                )}
                Generar H7
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5" />
                )}
                Enviar a AEAT
              </button>
            )}

            {isH7Generated && !isH7Submitted && (
              <button
                onClick={() => {
                  setH7Data(null)
                  setFormData(prev => ({ ...prev, forceGenerate: false }))
                }}
                className="btn-secondary"
              >
                Regenerar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resumen H7 Generado */}
      {isH7Generated && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-purple-500" />
            Resumen H7
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">LRN</p>
              <p className="font-mono font-medium">{h7Data.lrn}</p>
            </div>
            {h7Data.mrn && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">MRN</p>
                <p className="font-mono font-medium text-green-700">{h7Data.mrn}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Estado</p>
              <p className={`font-medium ${h7Data.status === 'submitted' ? 'text-green-600' : 'text-yellow-600'}`}>
                {h7Data.status === 'submitted' ? 'Enviada' : 'Borrador'}
              </p>
            </div>
          </div>

          {/* Calculo IVA */}
          {h7Data.vatCalculation && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <CurrencyEuroIcon className="w-5 h-5 text-green-500" />
                Calculo de Derechos
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Valor intrínseco</p>
                  <p className="font-semibold">{h7Data.vatCalculation.intrinsicValue?.toFixed(2) || totalValue.toFixed(2)} EUR</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Arancel</p>
                  <p className="font-semibold text-green-600">0.00 EUR (exento)</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">IVA ({h7Data.vatCalculation.vatRate || 21}%)</p>
                  <p className="font-semibold">{h7Data.vatCalculation.vatAmount?.toFixed(2) || '0.00'} EUR</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total a pagar</p>
                  <p className="font-bold text-lg text-luci">
                    {h7Data.vatCalculation.totalToPay?.toFixed(2) || '0.00'} EUR
                  </p>
                </div>
              </div>

              {h7Data.h7Data?.iossData && (
                <div className="mt-3 bg-green-50 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-green-700">
                    IVA ya pagado via IOSS ({h7Data.h7Data.iossData.iossNumber})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Canal asignado */}
          {h7Data.channel && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-blue-500" />
                Resultado AEAT
              </h4>
              <div className={`p-4 rounded-lg ${
                h7Data.channel === 'green' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl`}>
                    {h7Data.channel === 'green' ? '🟢' : '🟡'}
                  </span>
                  <div>
                    <p className={`font-semibold ${h7Data.channel === 'green' ? 'text-green-800' : 'text-yellow-800'}`}>
                      {h7Data.channel === 'green' ? 'CANAL VERDE - Levante inmediato' : 'CANAL AMARILLO - Pendiente pago IVA'}
                    </p>
                    <p className={`text-sm ${h7Data.channel === 'green' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {h7Data.channel === 'green'
                        ? 'El paquete puede ser entregado inmediatamente'
                        : 'Mercancia retenida hasta liquidacion del IVA'
                      }
                    </p>
                  </div>
                </div>
                {h7Data.levanteNumber && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-sm text-gray-600">
                      Numero de levante: <span className="font-mono font-medium">{h7Data.levanteNumber}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Datos del envio */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Datos del envio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Expediente</p>
            <p className="font-medium">{expedition.expeditionId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cliente</p>
            <p className="font-medium">{expedition.client?.companyName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Origen</p>
            <p className="font-medium">{expedition.exporter?.country || expedition.goods?.[0]?.originCountry || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Items</p>
            <p className="font-medium">{expedition.goods?.length || 0} producto(s)</p>
          </div>
        </div>

        {/* Lista de productos */}
        {expedition.goods && expedition.goods.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Productos</h4>
            <div className="space-y-2">
              {expedition.goods.map((good, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{good.description}</p>
                    <p className="text-xs text-gray-500">
                      TARIC: {good.taricCode || 'Sin clasificar'} · Origen: {good.originCountry || 'N/A'}
                    </p>
                  </div>
                  <p className="font-semibold text-luci">{(good.invoiceValue || 0).toFixed(2)} EUR</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
