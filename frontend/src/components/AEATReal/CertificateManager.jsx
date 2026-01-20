import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  KeyIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { aeatRealAPI } from '../../services/api'

export default function CertificateManager() {
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedCert, setSelectedCert] = useState(null)
  const [certAnalysis, setCertAnalysis] = useState(null)
  const [includeExpired, setIncludeExpired] = useState(false)

  const [importForm, setImportForm] = useState({
    certificateFile: null,
    password: '',
    type: 'FNMT_PJ',
    alias: ''
  })

  const loadCertificates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await aeatRealAPI.certificates.list(includeExpired)
      if (response.data.success) {
        setCertificates(response.data.data)
      }
    } catch (error) {
      console.error('Error loading certificates:', error)
      toast.error('Error al cargar certificados')
    } finally {
      setLoading(false)
    }
  }, [includeExpired])

  useEffect(() => {
    loadCertificates()
  }, [loadCertificates])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1]
        setImportForm(prev => ({ ...prev, certificateFile: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImport = async (e) => {
    e.preventDefault()

    if (!importForm.certificateFile || !importForm.password) {
      toast.error('Seleccione un certificado e ingrese la contraseña')
      return
    }

    setImporting(true)
    try {
      const response = await aeatRealAPI.certificates.import({
        certificateBase64: importForm.certificateFile,
        password: importForm.password,
        type: importForm.type,
        alias: importForm.alias || undefined
      })

      if (response.data.success) {
        toast.success('Certificado importado correctamente')
        setShowImportModal(false)
        setImportForm({ certificateFile: null, password: '', type: 'FNMT_PJ', alias: '' })
        loadCertificates()
      }
    } catch (error) {
      console.error('Error importing certificate:', error)
      toast.error(error.response?.data?.error || 'Error al importar certificado')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (alias) => {
    if (!window.confirm(`¿Eliminar el certificado "${alias}"?`)) return

    try {
      const response = await aeatRealAPI.certificates.delete(alias)
      if (response.data.success) {
        toast.success('Certificado eliminado')
        loadCertificates()
      }
    } catch (error) {
      toast.error('Error al eliminar certificado')
    }
  }

  const handleViewDetails = async (alias) => {
    setSelectedCert(alias)
    setCertAnalysis(null)

    try {
      const response = await aeatRealAPI.certificates.get(alias)
      if (response.data.success) {
        setCertAnalysis(response.data.data)
      }
    } catch (error) {
      toast.error('Error al obtener detalles')
    }
  }

  const handleVerify = async (alias) => {
    try {
      const response = await aeatRealAPI.certificates.verify(alias)
      if (response.data.success) {
        const verification = response.data.data
        if (verification.isValid) {
          toast.success('Certificado válido')
        } else {
          toast.error(`Certificado inválido: ${verification.errors?.join(', ')}`)
        }
      }
    } catch (error) {
      toast.error('Error al verificar certificado')
    }
  }

  const getCertificateStatusBadge = (cert) => {
    if (!cert.isValid) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircleIcon className="w-4 h-4 mr-1" />
          Inválido
        </span>
      )
    }

    if (cert.daysUntilExpiry <= 30) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
          Por expirar ({cert.daysUntilExpiry} días)
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircleIcon className="w-4 h-4 mr-1" />
        Válido
      </span>
    )
  }

  const getCertTypeLabel = (type) => {
    const types = {
      'FNMT_PF': 'Persona Física',
      'FNMT_PJ': 'Persona Jurídica',
      'FNMT_REP': 'Representante'
    }
    return types[type] || type
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <KeyIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Certificados Digitales AEAT
              </h1>
              <p className="text-gray-500">
                Gestión de certificados FNMT para integración con AEAT
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Importar Certificado
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center space-x-4">
        <label className="flex items-center space-x-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Incluir expirados</span>
        </label>

        <button
          onClick={loadCertificates}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Actualizar
        </button>
      </div>

      {/* Certificates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="ml-2 text-gray-600">Cargando certificados...</span>
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <KeyIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay certificados</h3>
          <p className="mt-1 text-sm text-gray-500">
            Importe un certificado digital FNMT para comenzar
          </p>
          <button
            onClick={() => setShowImportModal(true)}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Importar Certificado
          </button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Certificado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Titular
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validez
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {certificates.map((cert) => (
                <tr key={cert.alias} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ShieldCheckIcon className={`h-5 w-5 mr-2 ${cert.isValid ? 'text-green-500' : 'text-red-500'}`} />
                      <span className="font-medium text-gray-900">{cert.alias}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getCertTypeLabel(cert.type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{cert.subject?.CN || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{cert.subject?.serialNumber || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {new Date(cert.validTo).toLocaleDateString('es-ES')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getCertificateStatusBadge(cert)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(cert.alias)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      title="Ver detalles"
                    >
                      <InformationCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleVerify(cert.alias)}
                      className="text-green-600 hover:text-green-900 mr-3"
                      title="Verificar"
                    >
                      <ShieldCheckIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cert.alias)}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Certificate Details Panel */}
      {selectedCert && certAnalysis && (
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Detalles del Certificado: {selectedCert}
            </h3>
            <button
              onClick={() => { setSelectedCert(null); setCertAnalysis(null) }}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Certificate Info */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Certificado</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Serial Number:</dt>
                  <dd className="text-sm text-gray-900 font-mono">{certAnalysis.certificate?.serialNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Emisor:</dt>
                  <dd className="text-sm text-gray-900">{certAnalysis.certificate?.issuer?.O}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Válido desde:</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(certAnalysis.certificate?.validFrom).toLocaleDateString('es-ES')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Válido hasta:</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(certAnalysis.certificate?.validTo).toLocaleDateString('es-ES')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Días restantes:</dt>
                  <dd className={`text-sm font-medium ${
                    certAnalysis.certificate?.daysUntilExpiry <= 30 ? 'text-red-600' :
                    certAnalysis.certificate?.daysUntilExpiry <= 90 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {certAnalysis.certificate?.daysUntilExpiry} días
                  </dd>
                </div>
              </dl>
            </div>

            {/* LUCI Analysis */}
            {certAnalysis.analysis && (
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <SparklesIcon className="h-5 w-5 text-indigo-600 mr-2" />
                  <h4 className="text-sm font-medium text-indigo-900">Análisis LUCI</h4>
                </div>
                <div className="text-sm text-indigo-800 space-y-2">
                  {certAnalysis.analysis.recommendations?.map((rec, idx) => (
                    <p key={idx} className="flex items-start">
                      <CheckCircleIcon className="h-4 w-4 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" />
                      {rec}
                    </p>
                  ))}
                  {certAnalysis.analysis.warnings?.map((warn, idx) => (
                    <p key={idx} className="flex items-start text-yellow-800">
                      <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                      {warn}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowImportModal(false)} />

            <div className="relative bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Importar Certificado Digital</h3>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleImport} className="space-y-4">
                {/* Certificate File */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Archivo de Certificado (.p12, .pfx)
                  </label>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña del Certificado
                  </label>
                  <input
                    type="password"
                    value={importForm.password}
                    onChange={(e) => setImportForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Contraseña"
                    required
                  />
                </div>

                {/* Certificate Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Certificado
                  </label>
                  <select
                    value={importForm.type}
                    onChange={(e) => setImportForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="FNMT_PF">Persona Física FNMT</option>
                    <option value="FNMT_PJ">Persona Jurídica FNMT</option>
                    <option value="FNMT_REP">Representante FNMT</option>
                  </select>
                </div>

                {/* Alias */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alias (opcional)
                  </label>
                  <input
                    type="text"
                    value={importForm.alias}
                    onChange={(e) => setImportForm(prev => ({ ...prev, alias: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Nombre identificativo"
                  />
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Importante:</p>
                      <ul className="mt-1 list-disc list-inside space-y-1">
                        <li>Use solo certificados FNMT válidos</li>
                        <li>El certificado debe estar registrado en el censo AEAT</li>
                        <li>La contraseña no se almacena en el sistema</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={importing}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <span className="flex items-center">
                        <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </span>
                    ) : (
                      'Importar Certificado'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
