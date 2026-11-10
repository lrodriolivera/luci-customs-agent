import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { documentsAPI } from '../../services/api'

// Mismos tipos que acepta el backend (validators.js -> documentValidators.upload).
export const DOCUMENT_TYPES = [
  'commercial_invoice', 'proforma_invoice', 'packing_list', 'bill_of_lading',
  'air_waybill', 'cmr', 'certificate_origin', 'eur1', 'eur_med', 'atr', 'form_a',
  'sanitary_certificate', 'phytosanitary_certificate', 'veterinary_certificate',
  'fumigation_certificate', 'insurance_certificate', 'dispatch_authorization',
  'import_license', 'export_license', 'ce_certificate', 'quality_certificate', 'other'
]

// Mismo limite que el backend (middleware/upload.js): 50 MB.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.xml'

/**
 * Subida de documentos al expediente por el propio agente de aduanas. Hasta
 * ahora solo podia subirlos el cliente desde el portal.
 *
 * @param {{ expeditionId: string, onUploaded: () => void }} props
 */
export default function DocumentUploader({ expeditionId, onUploaded }) {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const [documentType, setDocumentType] = useState('commercial_invoice')
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > MAX_FILE_SIZE_BYTES) {
      toast.error(t('expeditions.uploadTooLarge'))
      e.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error(t('expeditions.uploadSelectFile'))
      return
    }

    setIsUploading(true)
    try {
      await documentsAPI.upload(expeditionId, file, documentType)
      toast.success(t('expeditions.uploadSuccess'))
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploaded()
    } catch (error) {
      toast.error(error.response?.data?.error || t('expeditions.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 border border-dashed border-gray-300 rounded-xl space-y-3">
      <p className="text-sm font-medium text-gray-700">{t('expeditions.uploadTitle')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="document-type">{t('expeditions.uploadDocumentType')}</label>
          <select
            id="document-type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="input"
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>{t(`expeditions.docType.${type}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="document-file">{t('expeditions.uploadFile')}</label>
          <input
            id="document-file"
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileChange}
            className="input"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isUploading} className="btn-primary flex items-center gap-2">
          <CloudArrowUpIcon className="w-5 h-5" />
          {isUploading ? t('expeditions.uploading') : t('expeditions.uploadButton')}
        </button>
      </div>
    </form>
  )
}
