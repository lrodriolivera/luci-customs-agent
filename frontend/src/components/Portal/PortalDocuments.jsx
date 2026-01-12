import React, { useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { portalAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  CloudArrowUpIcon,
  DocumentIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function PortalDocuments() {
  const { expedition, token } = useOutletContext()
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [selectedDocType, setSelectedDocType] = useState('')

  const documentTypes = [
    { value: 'commercial_invoice', label: 'Factura Comercial' },
    { value: 'packing_list', label: 'Packing List' },
    { value: 'bill_of_lading', label: 'Bill of Lading (B/L)' },
    { value: 'air_waybill', label: 'Air Waybill (AWB)' },
    { value: 'cmr', label: 'CMR' },
    { value: 'certificate_origin', label: 'Certificado de Origen' },
    { value: 'eur1', label: 'EUR.1' },
    { value: 'sanitary_certificate', label: 'Certificado Sanitario' },
    { value: 'phytosanitary_certificate', label: 'Certificado Fitosanitario' },
    { value: 'insurance', label: 'Poliza de Seguro' },
    { value: 'other', label: 'Otro Documento' }
  ]

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!selectedDocType) {
      toast.error('Seleccione el tipo de documento primero')
      return
    }

    setUploading(true)

    for (const file of acceptedFiles) {
      try {
        const formData = new FormData()
        formData.append('document', file)
        formData.append('documentType', selectedDocType)

        await portalAPI.uploadDocument(token, formData)

        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: selectedDocType,
          status: 'success'
        }])

        toast.success(`${file.name} subido correctamente`)
      } catch (error) {
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: selectedDocType,
          status: 'error'
        }])
        toast.error(`Error al subir ${file.name}`)
      }
    }

    setUploading(false)
    setSelectedDocType('')
  }, [token, selectedDocType])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: uploading || !selectedDocType
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subir Documentos</h1>
        <p className="text-gray-600 mt-1">
          Suba los documentos requeridos para su expediente de {expedition?.operationType === 'IMPORT' ? 'importacion' : 'exportacion'}
        </p>
      </div>

      {/* Document Type Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">1. Seleccione el tipo de documento</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {documentTypes.map(type => (
            <button
              key={type.value}
              onClick={() => setSelectedDocType(type.value)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                selectedDocType === type.value
                  ? 'border-luci bg-luci-light text-luci'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">2. Suba el archivo</h2>

        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? 'dropzone-active' : ''} ${
            !selectedDocType ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <div className="flex flex-col items-center">
              <ArrowPathIcon className="w-12 h-12 text-luci animate-spin mb-4" />
              <p className="text-gray-600">Subiendo documento...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-700 font-medium">
                {selectedDocType
                  ? 'Arrastre archivos aqui o haga clic para seleccionar'
                  : 'Seleccione primero el tipo de documento'
                }
              </p>
              <p className="text-sm text-gray-500 mt-2">
                PDF, Word, imagenes (max. 10MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Archivos Subidos</h2>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  file.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {file.status === 'success' ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                ) : (
                  <XMarkIcon className="w-5 h-5 text-red-500" />
                )}
                <DocumentIcon className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {documentTypes.find(t => t.value === file.type)?.label}
                  </p>
                </div>
                <span className={`text-xs ${
                  file.status === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {file.status === 'success' ? 'Subido' : 'Error'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Checklist de Documentos</h2>
        <div className="space-y-2">
          {expedition?.documentChecklist?.map((doc, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                doc.uploaded ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              {doc.uploaded ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
              )}
              <span className={doc.uploaded ? 'text-green-700' : 'text-gray-700'}>
                {doc.name}
              </span>
              {doc.required && (
                <span className={`text-xs ml-auto ${doc.uploaded ? 'text-green-600' : 'text-red-500'}`}>
                  {doc.required ? 'Obligatorio' : 'Opcional'}
                </span>
              )}
            </div>
          )) || (
            <p className="text-gray-500 text-sm">Cargando checklist...</p>
          )}
        </div>
      </div>

      {/* Help */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Necesita ayuda?</h3>
        <p className="text-sm text-blue-800">
          Si tiene dudas sobre que documentos subir o como obtenerlos,
          puede consultar con LUCI a traves del chat. Nuestro asistente
          virtual le guiara en el proceso.
        </p>
      </div>
    </div>
  )
}
