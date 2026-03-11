import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { declarationsAPI } from '../../services/api'

/**
 * Componente para declaraciones H7 (bajo valor <= 150 EUR)
 * Para comercio electronico B2C con sistema IOSS
 */
const H7Declaration = ({ expedition, onUpdate }) => {
  const { t } = useTranslation()

  // Multi-country support
  const isNL = (() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      return storedUser?.tenant?.customsConfig?.country === 'NL'
    } catch { return false }
  })()

  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState(null)
  const [h7Data, setH7Data] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [iossNumber, setIossNumber] = useState(expedition?.ecommerce?.iossNumber || '')
  const [showXML, setShowXML] = useState(false)

  // Verificar elegibilidad al montar
  useEffect(() => {
    if (expedition?._id) {
      checkEligibility()
    }
  }, [expedition?._id])

  const checkEligibility = async () => {
    try {
      const { data } = await declarationsAPI.checkH7Eligibility(expedition._id)
      setEligibility(data.data)
    } catch (err) {
      console.error('Error verificando elegibilidad H7:', err)
    }
  }

  const handleGenerateH7 = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data } = await declarationsAPI.generateH7({
        expeditionId: expedition._id,
        iossNumber: iossNumber || undefined
      })

      setH7Data(data.data)
      setSuccess('Declaracion H7 generada correctamente')
      if (onUpdate) onUpdate()

    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar H7')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitH7 = async () => {
    if (!confirm('Enviar declaracion H7 a AEAT?')) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data } = await declarationsAPI.submitH7(expedition._id)
      setH7Data({ ...h7Data, ...data.data })
      setSuccess(`H7 enviado - MRN: ${data.data.mrn} - Canal: ${data.data.channel.toUpperCase()}`)
      if (onUpdate) onUpdate()

    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar H7')
    } finally {
      setLoading(false)
    }
  }

  // Si ya tiene declaracion H7
  const existingH7 = expedition?.declaration?.type === 'H7'
  const isSubmitted = expedition?.declaration?.status === 'submitted'

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📦</span>
            Declaracion H7 - Bajo Valor
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Declaracion simplificada para envios con valor intrinseco &le; 150 EUR
          </p>
        </div>

        {eligibility && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            eligibility.eligible
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {eligibility.eligible ? 'Apto para H7' : 'No apto para H7'}
          </span>
        )}
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Info de elegibilidad */}
      {eligibility && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Verificacion de elegibilidad</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Valor actual:</span>
              <span className="ml-2 font-medium">{eligibility.currentValue?.toFixed(2)} EUR</span>
            </div>
            <div>
              <span className="text-blue-700">Limite H7:</span>
              <span className="ml-2 font-medium">{eligibility.valueLimit} EUR</span>
            </div>
            <div className="col-span-2">
              <span className="text-blue-700">Estado:</span>
              <span className="ml-2">{eligibility.reason}</span>
            </div>
          </div>
        </div>
      )}

      {/* Formulario IOSS */}
      {eligibility?.eligible && !existingH7 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Numero IOSS (Import One-Stop Shop)
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={iossNumber}
              onChange={(e) => setIossNumber(e.target.value.toUpperCase())}
              placeholder="IMESxxxxxxxxxx (opcional)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              maxLength={14}
            />
            <span className="text-xs text-gray-500 self-center">
              Si el vendedor tiene IOSS registrado, el IVA ya fue cobrado
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Formato: IM + 2 letras pais + 10 digitos (ej: IMES1234567890)
          </p>
        </div>
      )}

      {/* Declaracion existente */}
      {existingH7 && (
        <div className="mb-6 space-y-4">
          {/* Cabecera */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-gray-500 block">LRN</span>
                <span className="font-mono text-sm">{expedition.declaration.lrn}</span>
              </div>
              {expedition.declaration.mrn && (
                <div>
                  <span className="text-xs text-gray-500 block">MRN</span>
                  <span className="font-mono text-sm text-green-600">{expedition.declaration.mrn}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 block">Estado</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  isSubmitted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isSubmitted ? 'Enviado' : 'Borrador'}
                </span>
              </div>
              {expedition.declaration.channel && (
                <div>
                  <span className="text-xs text-gray-500 block">Canal</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    expedition.declaration.channel === 'green'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {expedition.declaration.channel.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Detalles H7 */}
          {expedition.declaration.h7Data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Info envio */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Datos del Envio</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor intrinseco:</span>
                    <span className="font-medium">
                      {expedition.declaration.h7Data.shipment?.intrinsicValue?.toFixed(2)} EUR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Origen:</span>
                    <span>{expedition.declaration.h7Data.shipment?.countryOfDispatch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tracking:</span>
                    <span className="font-mono text-xs">
                      {expedition.declaration.h7Data.shipment?.trackingNumber || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Impuestos */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Calculo Impuestos</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aranceles:</span>
                    <span className="text-green-600 font-medium">0.00 EUR (Exento)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">IVA ({expedition.declaration.vatCalculation?.vatRate}%):</span>
                    <span className={
                      expedition.declaration.vatCalculation?.vatAlreadyPaid
                        ? 'text-green-600'
                        : 'font-medium'
                    }>
                      {expedition.declaration.vatCalculation?.vatAlreadyPaid
                        ? 'Pagado via IOSS'
                        : `${expedition.declaration.vatCalculation?.vatAmount?.toFixed(2)} EUR`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-medium">Total a pagar:</span>
                    <span className="font-bold text-lg">
                      {expedition.declaration.vatCalculation?.totalToPay?.toFixed(2)} EUR
                    </span>
                  </div>
                </div>
              </div>

              {/* IOSS */}
              {expedition.declaration.h7Data.iossData && (
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg col-span-2">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                    <span>✓</span> IOSS Registrado
                  </h4>
                  <div className="text-sm text-green-700">
                    <span className="font-mono">{expedition.declaration.h7Data.iossData.iossNumber}</span>
                    <span className="ml-4">IVA ya cobrado por la plataforma de venta</span>
                  </div>
                </div>
              )}

              {/* Levante */}
              {expedition.declaration.levanteNumber && (
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg col-span-2">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                    <span>✓</span> Levante Autorizado
                  </h4>
                  <div className="text-sm text-green-700">
                    <span>Numero: </span>
                    <span className="font-mono">{expedition.declaration.levanteNumber}</span>
                    <span className="ml-4">Paquete listo para entrega</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ver XML */}
          <div className="mt-4">
            <button
              onClick={() => setShowXML(!showXML)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {showXML ? '▼ Ocultar XML' : '▶ Ver XML generado'}
            </button>
            {showXML && expedition.declaration.xmlContent && (
              <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-96">
                {expedition.declaration.xmlContent}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-4 pt-4 border-t">
        {!existingH7 && eligibility?.eligible && (
          <button
            onClick={handleGenerateH7}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Generando...
              </>
            ) : (
              <>
                <span>📄</span>
                Generar H7
              </>
            )}
          </button>
        )}

        {existingH7 && !isSubmitted && (
          <button
            onClick={handleSubmitH7}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Enviando...
              </>
            ) : (
              <>
                <span>📤</span>
                Enviar a AEAT
              </>
            )}
          </button>
        )}

        {existingH7 && (
          <button
            onClick={async () => {
              try {
                const { data } = await declarationsAPI.getXML(expedition._id)
                const blob = new Blob([data], { type: 'application/xml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${expedition.expeditionId}_H7.xml`
                a.click()
              } catch (err) {
                setError('Error descargando XML')
              }
            }}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <span>⬇️</span>
            Descargar XML
          </button>
        )}
      </div>

      {/* Info adicional */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-900 mb-2">Informacion H7</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Declaracion simplificada para envios de bajo valor (&le; 150 EUR)</li>
          <li>• Sin aranceles aduaneros (exentos por valor)</li>
          <li>• IVA aplicable: 21% (puede estar prepagado via IOSS)</li>
          <li>• IOSS: Import One-Stop Shop - IVA cobrado en origen por plataformas registradas</li>
          <li>• Tiempo de despacho estimado: 1-4 horas (inmediato con IOSS)</li>
        </ul>
      </div>

      {/* NL DECO specific note */}
      {isNL && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
            <span>{'\u{1F1F3}\u{1F1F1}'}</span> DECO - Paises Bajos
          </h4>
          <ul className="text-sm text-orange-800 space-y-1">
            <li>• DECO: Maximo 150 EUR por envio</li>
            <li>• Codigo mercancia: solo 6 digitos (HS6) en lugar de TARIC 10 digitos</li>
            <li>• IOSS recomendado para envios e-commerce B2C</li>
            <li>• Sistema: Douane Management Systeem (DMS) / DECO</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default H7Declaration
