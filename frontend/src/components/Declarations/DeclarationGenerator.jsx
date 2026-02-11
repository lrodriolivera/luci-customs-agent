import React, { useState, useEffect } from 'react'
import { expeditionsAPI, declarationsAPI, knowledgeAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function DeclarationGenerator() {
  const [expeditions, setExpeditions] = useState([])
  const [selectedExpedition, setSelectedExpedition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aeatResult, setAeatResult] = useState(null)
  const [declarationType, setDeclarationType] = useState('H1')
  const [options, setOptions] = useState({
    regime: '40',
    additionalProcedure: '000',
    preference: '100'
  })
  const [regimeInfo, setRegimeInfo] = useState(null)
  const [generatedDeclaration, setGeneratedDeclaration] = useState(null)

  useEffect(() => {
    const fetchExpeditions = async () => {
      try {
        const response = await expeditionsAPI.list({ status: 'PROCESSING,DOCS_RECEIVED,VALIDATING' })
        setExpeditions(response.data.expeditions || [])
      } catch (error) {
        console.error('Error fetching expeditions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExpeditions()
  }, [])

  useEffect(() => {
    const fetchRegimeInfo = async () => {
      if (options.regime) {
        try {
          const response = await knowledgeAPI.regimeInfo(options.regime)
          setRegimeInfo(response.data)
        } catch (error) {
          console.error('Error fetching regime info:', error)
        }
      }
    }

    fetchRegimeInfo()
  }, [options.regime])

  const handleGenerate = async () => {
    if (!selectedExpedition) {
      toast.error('Seleccione un expediente')
      return
    }

    setGenerating(true)
    setGeneratedDeclaration(null)

    try {
      const response = declarationType === 'H1'
        ? await declarationsAPI.generateH1({
            expedition: selectedExpedition,
            regime: options.regime,
            additional_procedure: options.additionalProcedure,
            preference: options.preference
          })
        : await declarationsAPI.generateAES({
            expedition: selectedExpedition,
            export_type: options.regime
          })

      setGeneratedDeclaration(response.data)
      toast.success(`Declaracion ${declarationType} generada`)
    } catch (error) {
      toast.error('Error al generar declaracion')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportXML = async () => {
    if (!selectedExpedition) return

    try {
      const response = await declarationsAPI.exportXML(selectedExpedition._id, declarationType)
      const blob = new Blob([response.data], { type: 'application/xml' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${declarationType}_${selectedExpedition.expeditionId}.xml`
      a.click()
      toast.success('XML descargado')
    } catch (error) {
      toast.error('Error al exportar XML')
    }
  }

  const handleSubmitToAEAT = async () => {
    if (!selectedExpedition) return
    if (!confirm(`Enviar declaracion ${declarationType} a AEAT?`)) return

    setSubmitting(true)
    setAeatResult(null)
    try {
      const response = await declarationsAPI.submit(selectedExpedition._id)
      const resultData = response.data?.data || response.data
      setAeatResult(resultData)

      if (resultData.channel === 'green') {
        toast.success(`Canal VERDE - MRN: ${resultData.mrn}`)
      } else if (resultData.channel === 'orange') {
        toast('Canal NARANJA - Revision documental', { icon: '🟠' })
      } else if (resultData.channel === 'red') {
        toast('Canal ROJO - Inspeccion fisica', { icon: '🔴' })
      } else {
        toast.success(`Enviado a AEAT - MRN: ${resultData.mrn || 'Pendiente'}`)
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al enviar a AEAT')
    } finally {
      setSubmitting(false)
    }
  }

  const regimes = [
    { code: '40', label: 'Libre Practica (40)' },
    { code: '42', label: 'Libre Practica + Entrega Intra-UE (42)' },
    { code: '44', label: 'Libre Practica + Destino Final (44)' },
    { code: '51', label: 'Perfeccionamiento Activo (51)' },
    { code: '53', label: 'Importacion Temporal (53)' },
    { code: '61', label: 'Reimportacion (61)' },
    { code: '71', label: 'Deposito Aduanero (71)' }
  ]

  const preferences = [
    { code: '100', label: 'Sin Preferencia (MFN)' },
    { code: '200', label: 'SPG' },
    { code: '300', label: 'Preferencial (EUR.1)' },
    { code: '400', label: 'Union Aduanera (ATR)' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generador de Declaraciones</h1>
        <p className="text-gray-500 mt-1">
          Genere declaraciones H1 (importacion) o AES (exportacion) con ayuda de IA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Declaration Type */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Tipo de Declaracion</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setDeclarationType('H1')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  declarationType === 'H1'
                    ? 'border-luci bg-luci-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-2 block">📥</span>
                <span className="font-medium">H1 - Importacion</span>
                <p className="text-sm text-gray-500 mt-1">Declaracion de importacion</p>
              </button>
              <button
                onClick={() => setDeclarationType('AES')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  declarationType === 'AES'
                    ? 'border-luci bg-luci-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-2 block">📤</span>
                <span className="font-medium">AES - Exportacion</span>
                <p className="text-sm text-gray-500 mt-1">Declaracion de exportacion</p>
              </button>
            </div>
          </div>

          {/* Expedition Selection */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Seleccionar Expediente</h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luci"></div>
              </div>
            ) : expeditions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay expedientes disponibles para generar declaraciones
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {expeditions.map((exp) => (
                  <div
                    key={exp._id}
                    onClick={() => setSelectedExpedition(exp)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedExpedition?._id === exp._id
                        ? 'border-luci bg-luci-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{exp.expeditionId}</p>
                        <p className="text-sm text-gray-500">{exp.client?.companyName}</p>
                      </div>
                      <span className={`badge ${exp.operationType === 'IMPORT' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {exp.operationType === 'IMPORT' ? 'Importacion' : 'Exportacion'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          {selectedExpedition && declarationType === 'H1' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Opciones de Declaracion</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Regimen Aduanero</label>
                  <select
                    value={options.regime}
                    onChange={(e) => setOptions({ ...options, regime: e.target.value })}
                    className="input"
                  >
                    {regimes.map(r => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Procedimiento Adicional</label>
                  <input
                    type="text"
                    value={options.additionalProcedure}
                    onChange={(e) => setOptions({ ...options, additionalProcedure: e.target.value })}
                    className="input"
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="label">Preferencia</label>
                  <select
                    value={options.preference}
                    onChange={(e) => setOptions({ ...options, preference: e.target.value })}
                    className="input"
                  >
                    {preferences.map(p => (
                      <option key={p.code} value={p.code}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex gap-4">
            <button
              onClick={handleGenerate}
              disabled={!selectedExpedition || generating}
              className="btn-primary flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generando con IA...
                </>
              ) : (
                <>
                  <DocumentTextIcon className="w-5 h-5" />
                  Generar {declarationType}
                </>
              )}
            </button>

            {generatedDeclaration && (
              <>
                <button
                  onClick={handleExportXML}
                  className="btn-success flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Descargar XML
                </button>
                <button
                  onClick={handleSubmitToAEAT}
                  disabled={submitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Enviando a AEAT...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-5 h-5" />
                      Enviar a AEAT
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* AEAT Result */}
          {aeatResult && (
            <div className={`card border-2 ${
              aeatResult.channel === 'green' ? 'border-green-300 bg-green-50' :
              aeatResult.channel === 'orange' ? 'border-orange-300 bg-orange-50' :
              aeatResult.channel === 'red' ? 'border-red-300 bg-red-50' :
              'border-blue-300 bg-blue-50'
            }`}>
              <h3 className="font-semibold mb-2">Respuesta AEAT</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {aeatResult.mrn && <div><span className="text-gray-600">MRN:</span> <span className="font-mono font-medium">{aeatResult.mrn}</span></div>}
                {aeatResult.channel && <div><span className="text-gray-600">Canal:</span> <span className="font-medium uppercase">{aeatResult.channel}</span></div>}
              </div>
            </div>
          )}

          {/* Generated Result */}
          {generatedDeclaration && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircleIcon className="w-6 h-6 text-green-500" />
                <h2 className="text-lg font-semibold">Declaracion Generada</h2>
              </div>

              {generatedDeclaration.warnings?.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-sm">
                  <p className="font-medium text-yellow-800 mb-1">Advertencias:</p>
                  <ul className="list-disc list-inside text-yellow-700">
                    {generatedDeclaration.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {generatedDeclaration.recommendations?.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 mb-1">Recomendaciones:</p>
                  <ul className="list-disc list-inside text-blue-700">
                    {generatedDeclaration.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(generatedDeclaration.declaration_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Regime Info */}
        <div className="space-y-6">
          {regimeInfo && !regimeInfo.error && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">
                Regimen {regimeInfo.code}: {regimeInfo.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">{regimeInfo.description}</p>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Requisitos</p>
                  <ul className="text-sm text-gray-700 mt-1 space-y-1">
                    {regimeInfo.requirements?.map((req, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-luci">-</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">IVA</p>
                  <p className="text-sm text-gray-700 mt-1">{regimeInfo.vat}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Uso Tipico</p>
                  <p className="text-sm text-gray-700 mt-1">{regimeInfo.typical_use}</p>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">
              <InformationCircleIcon className="w-5 h-5 inline mr-1 text-luci" />
              Sobre H1
            </h3>
            <p className="text-sm text-gray-600">
              El sistema H1 es el nuevo formato de declaracion de importacion de la UE,
              obligatorio en Espana desde octubre 2025. Reemplaza al antiguo DUA
              (Documento Unico Administrativo).
            </p>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-2">Importante</h3>
            <p className="text-sm text-yellow-700">
              La declaracion generada es un borrador. Revise todos los campos
              antes de presentarla ante la AEAT. La responsabilidad final
              recae en el declarante.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
