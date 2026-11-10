import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { CloudArrowUpIcon, DocumentTextIcon, SparklesIcon, TrashIcon } from '@heroicons/react/24/outline'
import { documentsAPI } from '../../services/api'
import { DOCUMENT_TYPES } from './DocumentUploader'

// Mismos limites que el backend (middleware/upload.js y borradoresDocumento.js).
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
export const MAX_DRAFTS = 10
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.xml'

const AVISOS_PROPIOS = ['itemsMismatch', 'currencyNotAvailable', 'fiscalIdNotRecognised']

/**
 * Alta desde la documentacion: el agente sube los documentos antes de rellenar
 * nada, LUCI los lee y el formulario se rellena con lo leido. Los documentos
 * quedan como borradores y se adjuntan al expediente al crearlo.
 *
 * Este componente sube, lee y lista; quien aplica lo leido al formulario es el
 * alta (`onRead`), que devuelve aqui que campos relleno y que avisos hay.
 *
 * @param {{
 *   drafts: Array<{ id: string, type: string, originalName: string, extraction: object,
 *                   rellenados: Array<object>, avisos: Array<object> }>,
 *   onRead: (draft: object, extraction: object) => void,
 *   onRemove: (id: string) => void,
 *   onTypeChange: (id: string, type: string) => void,
 *   compact?: boolean  en los pasos 2 y 3 solo se muestra un resumen de una linea
 * }} props
 */
export default function DraftDocuments({ drafts, onRead, onRemove, onTypeChange, compact = false }) {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const [readingName, setReadingName] = useState(null)

  const leerArchivos = async (e) => {
    const files = Array.from(e.target.files || [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (files.length === 0) return
    if (drafts.length + files.length > MAX_DRAFTS) {
      toast.error(t('draftDocs.tooMany', { max: MAX_DRAFTS }))
      return
    }

    // De uno en uno: cada lectura rellena sobre lo que dejo la anterior.
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name}: ${t('expeditions.uploadTooLarge')}`)
        continue
      }
      setReadingName(file.name)
      try {
        // «other»: el lector reconoce el tipo; el agente puede corregirlo despues.
        const response = await documentsAPI.readDraft(file, 'other')
        const data = response.data?.data || {}
        if (data.draft) onRead(data.draft, data.extraction || null)
      } catch (error) {
        toast.error(`${file.name}: ${error.response?.data?.error || t('draftDocs.readError')}`)
      }
    }
    setReadingName(null)
  }

  const quitar = async (id) => {
    try {
      await documentsAPI.removeDraft(id)
    } catch (error) {
      // Si ya no existe en el servidor, igualmente deja de ir con el alta.
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.error || t('draftDocs.removeError'))
        return
      }
    }
    onRemove(id)
  }

  const etiqueta = (item) => {
    const campo = t(`draftDocs.field.${item.campo}`, { defaultValue: t(`docReading.field.${item.campo}`) })
    return item.partida ? `${t('docReading.item', { number: item.partida })} · ${campo}` : campo
  }

  const textoAviso = (aviso) => {
    if (AVISOS_PROPIOS.includes(aviso.campo)) {
      return t(`draftDocs.warn.${aviso.campo}`, { value: aviso.valor, current: aviso.actual })
    }
    return t('draftDocs.warn.differs', { field: etiqueta(aviso), value: aviso.valor, current: aviso.actual })
  }

  if (compact) {
    if (drafts.length === 0) return null
    const avisos = drafts.reduce((total, d) => total + d.avisos.length, 0)
    return (
      <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-luci/30 bg-luci-light/40 px-3 py-2 text-sm text-gray-800">
        <SparklesIcon className="w-4 h-4 text-luci" />
        {t('draftDocs.summary', {
          documents: drafts.length,
          count: drafts.reduce((total, d) => total + d.rellenados.length, 0)
        })}
        {avisos > 0 && <span className="text-amber-800">{t('draftDocs.summaryWarnings', { count: avisos })}</span>}
      </p>
    )
  }

  return (
    <section aria-labelledby="draft-docs-title" className="card mb-6 border border-luci/30 bg-luci-light/40">
      <h2 id="draft-docs-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <SparklesIcon className="w-5 h-5 text-luci" />
        {t('draftDocs.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-600">{t('draftDocs.intro')}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={`btn-secondary inline-flex items-center gap-2 cursor-pointer ${readingName ? 'opacity-50 pointer-events-none' : ''}`}>
          <CloudArrowUpIcon className="w-5 h-5" />
          {t('draftDocs.selectFiles')}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            onChange={leerArchivos}
            disabled={Boolean(readingName)}
            className="sr-only"
            aria-label={t('draftDocs.selectFiles')}
          />
        </label>
        {readingName && (
          <span role="status" className="inline-flex items-center gap-2 text-sm text-gray-700">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-luci" />
            {t('draftDocs.reading', { name: readingName })}
          </span>
        )}
      </div>

      {drafts.length > 0 && (
        <ul className="mt-4 space-y-3">
          {drafts.map((draft) => {
            const noLegible = !draft.extraction || draft.extraction.legible === false || draft.extraction.leido === false
            return (
              <li key={draft.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <DocumentTextIcon className="w-5 h-5 text-gray-500 shrink-0" />
                  <span className="font-medium text-gray-900 break-all flex-1 min-w-[10rem]">{draft.originalName}</span>
                  <select
                    aria-label={`${t('expeditions.uploadDocumentType')}: ${draft.originalName}`}
                    value={draft.type}
                    onChange={(e) => onTypeChange(draft.id, e.target.value)}
                    className="input w-56 py-1"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{t(`expeditions.docType.${type}`)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => quitar(draft.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                    aria-label={`${t('draftDocs.remove')}: ${draft.originalName}`}
                  >
                    <TrashIcon className="w-4 h-4" />
                    {t('draftDocs.remove')}
                  </button>
                </div>

                <p className={`mt-2 ${noLegible ? 'text-amber-800' : 'text-gray-700'}`}>
                  {noLegible
                    ? t('draftDocs.notReadable')
                    : `${t('docReading.readOk', { confidence: draft.extraction.confianza ?? 0 })} · ${
                      draft.rellenados.length > 0 ? t('draftDocs.filledCount', { count: draft.rellenados.length }) : t('draftDocs.nothingFilled')
                    }`}
                </p>

                {(draft.extraction?.notas || []).length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-amber-800">
                    {draft.extraction.notas.map((nota, i) => <li key={i}>{nota}</li>)}
                  </ul>
                )}

                {draft.rellenados.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-primary-600 hover:text-primary-800">{t('draftDocs.showFilled')}</summary>
                    <dl className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                      {draft.rellenados.map((item) => (
                        <div key={item.clave} className="flex gap-2">
                          <dt className="text-gray-500">{etiqueta(item)}:</dt>
                          <dd className="font-medium text-gray-900 break-words">{String(item.valor)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}

                {draft.avisos.length > 0 && (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                    <p className="font-medium">{t('draftDocs.warnTitle')}</p>
                    <ul className="mt-1 list-disc list-inside">
                      {draft.avisos.map((aviso, i) => <li key={i}>{textoAviso(aviso)}</li>)}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {drafts.some((d) => d.rellenados.length > 0) && (
        <p className="mt-3 text-sm font-medium text-gray-800">{t('draftDocs.review')}</p>
      )}
    </section>
  )
}
