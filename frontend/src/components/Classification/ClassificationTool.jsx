import React, { useState } from 'react'
import { classificationAPI, knowledgeAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon,
  TagIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function ClassificationTool() {
  const [description, setDescription] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState({
    material: '',
    use: '',
    origin: ''
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [selectedCode, setSelectedCode] = useState(null)
  const [validating, setValidating] = useState(false)

  const handleClassify = async (e) => {
    e.preventDefault()
    if (!description.trim()) {
      toast.error('Introduzca una descripcion del producto')
      return
    }

    setLoading(true)
    setResults(null)
    setSelectedCode(null)

    try {
      const response = await classificationAPI.classify({
        description,
        additional_info: Object.fromEntries(
          Object.entries(additionalInfo).filter(([_, v]) => v)
        ),
        language: 'es'
      })

      setResults(response.data)
    } catch (error) {
      toast.error('Error al clasificar producto')
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async (code) => {
    setValidating(true)
    setSelectedCode(code)

    try {
      const response = await classificationAPI.validate(
        code,
        description,
        additionalInfo.origin
      )

      setResults(prev => ({
        ...prev,
        validationResult: response.data
      }))

      if (response.data.is_valid) {
        toast.success('Codigo validado correctamente')
      } else {
        toast.error('El codigo podria no ser correcto')
      }
    } catch (error) {
      toast.error('Error al validar codigo')
    } finally {
      setValidating(false)
    }
  }

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100'
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clasificacion TARIC</h1>
        <p className="text-gray-500 mt-1">
          Utilice IA para clasificar productos y obtener codigos arancelarios
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleClassify} className="card space-y-4">
            <div>
              <label className="label">Descripcion del Producto *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={4}
                placeholder="Describa el producto de forma detallada. Incluya material, composicion, uso, etc."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Material Principal</label>
                <input
                  type="text"
                  value={additionalInfo.material}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, material: e.target.value })}
                  className="input"
                  placeholder="Ej: algodon, plastico..."
                />
              </div>
              <div>
                <label className="label">Uso/Funcion</label>
                <input
                  type="text"
                  value={additionalInfo.use}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, use: e.target.value })}
                  className="input"
                  placeholder="Ej: decorativo, industrial..."
                />
              </div>
              <div>
                <label className="label">Pais de Origen</label>
                <input
                  type="text"
                  value={additionalInfo.origin}
                  onChange={(e) => setAdditionalInfo({ ...additionalInfo, origin: e.target.value })}
                  className="input"
                  placeholder="Codigo ISO (ej: CN)"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Analizando con IA...
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-5 h-5" />
                  Clasificar Producto
                </>
              )}
            </button>
          </form>

          {/* Results */}
          {results && (
            <div className="card mt-6">
              <h2 className="text-lg font-semibold mb-4">Sugerencias de Clasificacion</h2>

              {results.warnings?.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">Advertencias</p>
                      <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                        {results.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {results.suggestions?.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-4 border-2 rounded-xl transition-colors ${
                      selectedCode === suggestion.code
                        ? 'border-luci bg-luci-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <TagIcon className="w-6 h-6 text-gray-400" />
                        <div>
                          <p className="font-mono text-lg font-bold text-gray-900">
                            {suggestion.code}
                          </p>
                          <p className="text-gray-600">{suggestion.description}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                        {suggestion.confidence}%
                      </span>
                    </div>

                    {suggestion.reasoning && (
                      <p className="mt-2 text-sm text-gray-500 pl-9">
                        {suggestion.reasoning}
                      </p>
                    )}

                    {suggestion.duty_rate !== undefined && (
                      <p className="mt-2 text-sm text-gray-600 pl-9">
                        Arancel: <span className="font-medium">{suggestion.duty_rate}%</span>
                      </p>
                    )}

                    <div className="mt-3 pl-9 flex gap-2">
                      <button
                        onClick={() => handleValidate(suggestion.code)}
                        disabled={validating}
                        className="btn-secondary text-sm"
                      >
                        {validating && selectedCode === suggestion.code ? 'Validando...' : 'Validar'}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(suggestion.code)}
                        className="btn-secondary text-sm"
                      >
                        Copiar Codigo
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {results.additional_info_needed?.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Informacion adicional recomendada</p>
                      <ul className="text-sm text-blue-700 mt-1 list-disc list-inside">
                        {results.additional_info_needed.map((info, i) => (
                          <li key={i}>{info}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Result */}
              {results.validationResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  results.validationResult.is_valid
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {results.validationResult.is_valid ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        results.validationResult.is_valid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {results.validationResult.is_valid ? 'Codigo Validado' : 'Revision Requerida'}
                      </p>
                      <p className={`text-sm mt-1 ${
                        results.validationResult.is_valid ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {results.validationResult.reasoning}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Confianza: {results.validationResult.confidence}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Help */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Consejos de Clasificacion</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-luci">1.</span>
                Describa el producto con detalle: material, composicion, uso
              </li>
              <li className="flex items-start gap-2">
                <span className="text-luci">2.</span>
                Indique si es un producto acabado o semiacabado
              </li>
              <li className="flex items-start gap-2">
                <span className="text-luci">3.</span>
                Especifique el proceso de fabricacion si es relevante
              </li>
              <li className="flex items-start gap-2">
                <span className="text-luci">4.</span>
                Valide siempre el codigo sugerido antes de usarlo
              </li>
            </ul>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-2">Aviso Legal</h3>
            <p className="text-sm text-yellow-700">
              Las sugerencias de clasificacion son orientativas. Para operaciones
              criticas, consulte con un experto o solicite una ITV (Informacion
              Tarifaria Vinculante) a la AEAT.
            </p>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Estructura TARIC</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-mono">XX</span> - Capitulo (2 dig.)</p>
              <p><span className="font-mono">XXXX</span> - Partida (4 dig.)</p>
              <p><span className="font-mono">XXXXXX</span> - Subpartida SA (6 dig.)</p>
              <p><span className="font-mono">XXXXXXXX</span> - NC (8 dig.)</p>
              <p><span className="font-mono">XXXXXXXXXX</span> - TARIC (10 dig.)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
