import React, { useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { expedition, token } = useOutletContext()
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [selectedDocType, setSelectedDocType] = useState('')

  const documentTypes = [
    { value: 'commercial_invoice', label: t('portal.docCommercialInvoice') },
    { value: 'packing_list', label: t('portal.docPackingList') },
    { value: 'bill_of_lading', label: t('portal.docBillOfLading') },
    { value: 'air_waybill', label: t('portal.docAirWaybill') },
    { value: 'cmr', label: t('portal.docCmr') },
    { value: 'certificate_origin', label: t('portal.docCertificateOrigin') },
    { value: 'eur1', label: t('portal.docEur1') },
    { value: 'sanitary_certificate', label: t('portal.docHealthCert') },
    { value: 'phytosanitary_certificate', label: t('portal.docPhytoCert') },
    { value: 'insurance', label: t('portal.docInsurance') },
    { value: 'other', label: t('portal.docOther') }
  ]

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!selectedDocType) {
      toast.error(t('portal.selectDocFirst'))
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

        toast.success(`${file.name} ${t('portal.uploadSuccess')}`)
      } catch (error) {
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: selectedDocType,
          status: 'error'
        }])
        toast.error(`${t('portal.uploadError')} ${file.name}`)
      }
    }

    setUploading(false)
    setSelectedDocType('')
  }, [token, selectedDocType, t])

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
        <h1 className="text-2xl font-bold text-gray-900">{t('portal.uploadTitle')}</h1>
        <p className="text-gray-600 mt-1">
          {expedition?.operationType === 'IMPORT' ? t('portal.uploadSubtitleImport') : t('portal.uploadSubtitleExport')}
        </p>
      </div>

      {/* Document Type Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{t('portal.selectDocType')}</h2>
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
        <h2 className="text-lg font-semibold mb-4">{t('portal.uploadFile')}</h2>

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
              <p className="text-gray-600">{t('portal.uploading')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-700 font-medium">
                {selectedDocType
                  ? t('portal.dragFiles')
                  : t('portal.selectFirst')
                }
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {t('portal.fileFormats')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">{t('portal.uploadedFiles')}</h2>
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
                  {file.status === 'success' ? t('portal.uploaded') : t('common.error')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{t('portal.docChecklist')}</h2>
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
                  {doc.required ? t('common.required') : t('common.optional')}
                </span>
              )}
            </div>
          )) || (
            <p className="text-gray-500 text-sm">{t('portal.loadingChecklist')}</p>
          )}
        </div>
      </div>

      {/* Help */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">{t('portal.needHelp')}</h3>
        <p className="text-sm text-blue-800">
          {t('portal.helpText')}
        </p>
      </div>
    </div>
  )
}
