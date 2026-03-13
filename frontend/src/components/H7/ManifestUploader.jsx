import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { manifestAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  SparklesIcon,
  XMarkIcon,
  TableCellsIcon,
  DocumentPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'

const CARRIERS = [
  { code: 'AIRGO', name: 'AIRGO EXPRESS' },
  { code: 'CORREOS', name: 'Correos' },
  { code: 'DHL', name: 'DHL Express' },
  { code: 'UPS', name: 'UPS' },
  { code: 'FEDEX', name: 'FedEx' },
  { code: 'TNT', name: 'TNT' },
  { code: 'GLS', name: 'GLS' },
  { code: 'SEUR', name: 'SEUR' },
  { code: 'MRW', name: 'MRW' },
  { code: 'AMAZON', name: 'Amazon Logistics' },
  { code: 'OTHER', name: 'Otro' }
]

export default function ManifestUploader({ onClose, onCreated }) {
  const { t } = useTranslation()

  // State
  const [step, setStep] = useState('upload') // upload | preview | results | creating
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [options, setOptions] = useState({
    delimiter: ',',
    carrier: 'AIRGO',
    iossNumber: ''
  })
  const [showOptions, setShowOptions] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0 })
  const [createResults, setCreateResults] = useState(null)
  const [previewRows, setPreviewRows] = useState(null)

  // File handling
  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.toLowerCase().split('.').pop()
    if (!['csv', 'txt', 'tsv'].includes(ext)) {
      toast.error('Solo se aceptan archivos CSV, TXT o TSV')
      return
    }
    setFile(f)

    // Quick preview: read first few lines
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const lines = text.split('\n').filter(l => l.trim())
      const delimiter = options.delimiter
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/['"]/g, ''))
      const rows = lines.slice(1, Math.min(6, lines.length)).map(line => {
        return line.split(delimiter).map(v => v.trim().replace(/^['"]|['"]$/g, ''))
      })
      setPreviewRows({ headers, rows, totalLines: lines.length - 1 })
      setStep('preview')
    }
    reader.readAsText(f)
  }, [options.delimiter])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await manifestAPI.downloadTemplate()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_manifiesto_h7.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Plantilla descargada')
    } catch {
      toast.error('Error descargando plantilla')
    }
  }

  // Process with AI
  const handleProcess = async () => {
    if (!file) return
    setProcessing(true)
    try {
      const formData = new FormData()
      formData.append('manifest', file)
      formData.append('delimiter', options.delimiter)
      formData.append('carrier', options.carrier)
      formData.append('iossNumber', options.iossNumber)

      const response = await manifestAPI.upload(formData)
      if (response.data.success) {
        setResults(response.data.data)
        setStep('results')
        toast.success(`Manifiesto procesado: ${response.data.data.summary.h7Ready} declaraciones H7 listas`)
      } else {
        toast.error(response.data.error || 'Error procesando manifiesto')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error procesando manifiesto')
    } finally {
      setProcessing(false)
    }
  }

  // Create H7 declarations
  const handleCreateBatch = async () => {
    if (!results?.h7Declarations?.length) return
    setCreating(true)
    setCreateProgress({ current: 0, total: results.h7Declarations.length })

    try {
      const response = await manifestAPI.createBatch({
        h7Declarations: results.h7Declarations
      })

      if (response.data.success) {
        setCreateResults(response.data.data)
        setStep('creating')
        toast.success(`${response.data.data.created} declaraciones H7 creadas`)
        if (onCreated) onCreated()
      } else {
        toast.error(response.data.error || 'Error creando declaraciones')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error creando declaraciones H7')
    } finally {
      setCreating(false)
    }
  }

  // Reset
  const handleReset = () => {
    setFile(null)
    setPreviewRows(null)
    setResults(null)
    setCreateResults(null)
    setStep('upload')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Importar Manifiesto de Carga</h2>
              <p className="text-sm text-gray-500">
                Sube un CSV con envios y la IA clasificara automaticamente las mercancias
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { key: 'upload', label: '1. Subir CSV' },
              { key: 'preview', label: '2. Vista previa' },
              { key: 'results', label: '3. Clasificacion IA' },
              { key: 'creating', label: '4. Crear H7' }
            ].map((s, idx) => (
              <React.Fragment key={s.key}>
                {idx > 0 && <div className="flex-1 h-0.5 bg-gray-200" />}
                <div className={`flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${
                  step === s.key ? 'text-sky-600' :
                  ['upload', 'preview', 'results', 'creating'].indexOf(step) > idx ? 'text-green-600' :
                  'text-gray-400'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s.key ? 'bg-sky-100 text-sky-600' :
                    ['upload', 'preview', 'results', 'creating'].indexOf(step) > idx ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {['upload', 'preview', 'results', 'creating'].indexOf(step) > idx ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (idx + 1)}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-gray-300 hover:border-sky-300 hover:bg-gray-50'
                }`}
                onClick={() => document.getElementById('manifest-file-input').click()}
              >
                <ArrowUpTrayIcon className={`h-12 w-12 mx-auto mb-4 ${dragOver ? 'text-sky-500' : 'text-gray-400'}`} />
                <p className="text-lg font-medium text-gray-700 mb-1">
                  Arrastra tu manifiesto CSV aqui
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  o haz clic para seleccionar archivo
                </p>
                <p className="text-xs text-gray-400">
                  Formatos aceptados: CSV, TXT, TSV (max 50MB)
                </p>
                <input
                  id="manifest-file-input"
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={(e) => handleFile(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {/* Download Template */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TableCellsIcon className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Plantilla CSV</p>
                    <p className="text-xs text-gray-500">Descarga la plantilla con las columnas esperadas</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Descargar
                </button>
              </div>

              {/* Options toggle */}
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {showOptions ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                Opciones avanzadas
              </button>

              {showOptions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delimitador</label>
                    <select
                      value={options.delimiter}
                      onChange={(e) => setOptions({ ...options, delimiter: e.target.value })}
                      className="input"
                    >
                      <option value=",">Coma (,)</option>
                      <option value=";">Punto y coma (;)</option>
                      <option value="\t">Tabulador</option>
                      <option value="|">Pipe (|)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transportista</label>
                    <select
                      value={options.carrier}
                      onChange={(e) => setOptions({ ...options, carrier: e.target.value })}
                      className="input"
                    >
                      {CARRIERS.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numero IOSS (opcional)</label>
                    <input
                      type="text"
                      value={options.iossNumber}
                      onChange={(e) => setOptions({ ...options, iossNumber: e.target.value })}
                      placeholder="IM0000000000"
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && previewRows && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center justify-between p-3 bg-sky-50 border border-sky-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="h-5 w-5 text-sky-600" />
                  <div>
                    <p className="text-sm font-medium text-sky-800">{file?.name}</p>
                    <p className="text-xs text-sky-600">
                      {previewRows.totalLines} linea(s) de datos | {previewRows.headers.length} columnas
                    </p>
                  </div>
                </div>
                <button onClick={handleReset} className="text-sky-600 hover:text-sky-800 text-sm">
                  Cambiar archivo
                </button>
              </div>

              {/* Column mapping info */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-1">Columnas detectadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewRows.headers.map((h, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 bg-white border border-amber-300 rounded text-xs text-amber-700">
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      {previewRows.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewRows.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{rowIdx + 1}</td>
                        {row.map((val, colIdx) => (
                          <td key={colIdx} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate" title={val}>
                            {val || <span className="text-gray-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.totalLines > 5 && (
                  <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t">
                    Mostrando 5 de {previewRows.totalLines} filas
                  </div>
                )}
              </div>

              {/* Options (inline) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delimitador</label>
                  <select
                    value={options.delimiter}
                    onChange={(e) => {
                      setOptions({ ...options, delimiter: e.target.value })
                      // Re-parse preview
                      handleFile(file)
                    }}
                    className="input"
                  >
                    <option value=",">Coma (,)</option>
                    <option value=";">Punto y coma (;)</option>
                    <option value="\t">Tabulador</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transportista</label>
                  <select
                    value={options.carrier}
                    onChange={(e) => setOptions({ ...options, carrier: e.target.value })}
                    className="input"
                  >
                    {CARRIERS.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IOSS (opcional)</label>
                  <input
                    type="text"
                    value={options.iossNumber}
                    onChange={(e) => setOptions({ ...options, iossNumber: e.target.value })}
                    placeholder="IM0000000000"
                    className="input"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between pt-2">
                <button onClick={handleReset} className="btn-secondary">
                  Volver
                </button>
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Clasificando con IA...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-5 w-5" />
                      Clasificar con IA ({previewRows.totalLines} envios)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Results */}
          {step === 'results' && results && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-800">{results.summary.totalRows}</p>
                  <p className="text-xs text-gray-500">Total filas</p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{results.summary.h7Ready}</p>
                  <p className="text-xs text-green-600">Listos para H7</p>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-700">{results.summary.h1Required}</p>
                  <p className="text-xs text-orange-600">Requieren H1</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">{results.summary.errors}</p>
                  <p className="text-xs text-red-600">Con errores</p>
                </div>
              </div>

              {/* H7 Ready table */}
              {results.h7Declarations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4" />
                    Declaraciones H7 listas ({results.h7Declarations.length})
                  </h3>
                  <div className="overflow-x-auto border border-green-200 rounded-lg">
                    <table className="min-w-full divide-y divide-green-100 text-sm">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Tracking</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Destinatario</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Descripcion</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">HS Code</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Valor</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Peso</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-green-50">
                        {results.h7Declarations.map((decl, idx) => (
                          <tr key={idx} className="hover:bg-green-50/50">
                            <td className="px-3 py-2 text-gray-400">{decl.lineNumber}</td>
                            <td className="px-3 py-2 font-mono text-xs">{decl.trackingNumber}</td>
                            <td className="px-3 py-2">
                              <div>
                                <p className="font-medium text-xs">{decl.recipient.name}</p>
                                <p className="text-gray-400 text-xs">{decl.recipient.taxId || '-'}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2 max-w-[200px] truncate text-xs" title={decl.items[0]?.description}>
                              {decl.items[0]?.description}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-mono font-medium">
                                {decl.items[0]?.taricCode || '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs font-medium">
                              {decl.totals.intrinsicValue?.toFixed(2)} EUR
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {decl.totals.grossWeight} kg
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* H1 Required */}
              {results.h1Required.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    Requieren declaracion H1 ({results.h1Required.length})
                  </h3>
                  <div className="overflow-x-auto border border-orange-200 rounded-lg">
                    <table className="min-w-full divide-y divide-orange-100 text-sm">
                      <thead className="bg-orange-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Tracking</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Descripcion</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Valor</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-orange-50">
                        {results.h1Required.map((item, idx) => (
                          <tr key={idx} className="hover:bg-orange-50/50">
                            <td className="px-3 py-2 text-gray-400">{item.lineNumber}</td>
                            <td className="px-3 py-2 font-mono text-xs">{item.tracking || '-'}</td>
                            <td className="px-3 py-2 text-xs max-w-[200px] truncate">{item.description}</td>
                            <td className="px-3 py-2 text-xs font-medium">{item.value?.toFixed(2)} EUR</td>
                            <td className="px-3 py-2 text-xs text-orange-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
              {results.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <XCircleIcon className="h-4 w-4" />
                    Errores de datos ({results.errors.length})
                  </h3>
                  <div className="space-y-1">
                    {results.errors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                        <span className="font-mono text-red-600">Linea {err.lineNumber}</span>
                        <span className="text-red-700">{err.tracking || '-'}:</span>
                        <span className="text-red-600">{err.errors.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-between pt-4 border-t">
                <button onClick={handleReset} className="btn-secondary">
                  Nuevo manifiesto
                </button>
                {results.h7Declarations.length > 0 && (
                  <button
                    onClick={handleCreateBatch}
                    disabled={creating}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Creando declaraciones...
                      </>
                    ) : (
                      <>
                        <DocumentPlusIcon className="h-5 w-5" />
                        Crear {results.h7Declarations.length} declaraciones H7
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Creation results */}
          {step === 'creating' && createResults && (
            <div className="space-y-4">
              {/* Success summary */}
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircleIcon className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Declaraciones H7 creadas
                </h3>
                <p className="text-gray-600">
                  {createResults.created} de {createResults.total} declaraciones creadas correctamente
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${(createResults.created / createResults.total) * 100}%` }}
                />
              </div>

              {/* Results list */}
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {createResults.results.map((r, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-mono text-xs">{r.tracking}</td>
                        <td className="px-3 py-2 text-xs font-medium text-sky-600">{r.reference || '-'}</td>
                        <td className="px-3 py-2">
                          {r.success ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <CheckCircleIcon className="h-3 w-3" />
                              Creada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                              <XCircleIcon className="h-3 w-3" />
                              {r.error || 'Error'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Failed entries */}
              {createResults.failed > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    {createResults.failed} declaracion(es) no pudieron crearse.
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Revisa los errores arriba y crealas manualmente si es necesario.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t">
                <button onClick={handleReset} className="btn-secondary">
                  Importar otro manifiesto
                </button>
                <button onClick={onClose} className="btn-primary">
                  Ir a declaraciones H7
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
