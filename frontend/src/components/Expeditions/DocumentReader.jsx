import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { SparklesIcon, ArrowTopRightOnSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { documentsAPI } from '../../services/api'
import { formatearImporte } from '../../utils/importe'

const CAMPOS_IMPORTE = ['invoiceValue']
const CAMPOS_PESO = ['grossWeight', 'netWeight']

/**
 * Lectura de un documento del expediente con IA y aplicacion de lo leido.
 *
 * LUCI solo PROPONE: lista los campos en los que el documento aporta un dato
 * distinto del que tiene el expediente y el agente marca cuales aplicar. Los
 * que rellenan un campo vacio vienen marcados; los que cambiarian un dato ya
 * escrito, no.
 *
 * @param {{
 *   expeditionId: string,
 *   document: object,
 *   autoRead?: boolean,
 *   canApply?: boolean,
 *   canDelete?: boolean,
 *   onDeleted?: (expedition: object|null) => void,
 *   onApplied: (expedition: object) => void,
 *   onRead?: () => void
 * }} props
 */
export default function DocumentReader({ expeditionId, document, autoRead = false, canApply = true, canDelete = false, onDeleted, onApplied, onRead }) {
  const { t } = useTranslation()
  const [extraction, setExtraction] = useState(document.extractedData?.leidoEn ? document.extractedData : null)
  const [proposal, setProposal] = useState(null)
  const [selected, setSelected] = useState([])
  const [isReading, setIsReading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const cargarPropuesta = (lista) => {
    setProposal(lista)
    // Marcado por defecto solo lo que rellena un hueco.
    setSelected(lista.filter((c) => c.actual === null).map((c) => c.clave))
  }

  const leer = async () => {
    setIsReading(true)
    try {
      const response = await documentsAPI.read(expeditionId, document._id)
      const data = response.data?.data || {}
      setExtraction(data.extraction || null)
      cargarPropuesta(data.proposal || [])
      setIsOpen(true)
      if (onRead) onRead()
    } catch (error) {
      toast.error(error.response?.data?.error || t('docReading.readError'))
    } finally {
      setIsReading(false)
    }
  }

  const verPropuesta = async () => {
    if (isOpen) { setIsOpen(false); return }
    setIsOpen(true)
    if (proposal !== null) return
    try {
      const response = await documentsAPI.proposal(expeditionId, document._id)
      cargarPropuesta(response.data?.data?.proposal || [])
    } catch (error) {
      toast.error(error.response?.data?.error || t('docReading.readError'))
    }
  }

  // Lectura automatica del documento recien subido (si el agente no la desmarco).
  useEffect(() => {
    if (autoRead) leer()
    // Solo al montar: `autoRead` identifica al documento recien subido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const abrir = async () => {
    try {
      const response = await documentsAPI.download(expeditionId, document._id)
      const url = window.URL.createObjectURL(new Blob([response.data], { type: document.mimeType || 'application/octet-stream' }))
      window.open(url, '_blank', 'noopener')
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000)
    } catch (error) {
      toast.error(t('docReading.openError'))
    }
  }

  // Borrar pide confirmacion: no se puede deshacer.
  const eliminar = async () => {
    setIsDeleting(true)
    try {
      const response = await documentsAPI.remove(expeditionId, document._id)
      toast.success(t('docReading.deleted'))
      if (onDeleted) onDeleted(response.data?.data?.expedition || null)
    } catch (error) {
      toast.error(error.response?.data?.error || t('docReading.deleteError'))
      setIsDeleting(false)
      setIsConfirmingDelete(false)
    }
  }

  const aplicar = async () => {
    setIsApplying(true)
    try {
      const response = await documentsAPI.apply(expeditionId, document._id, selected)
      const data = response.data?.data || {}
      toast.success(t('docReading.applied', { count: (data.applied || []).length }))
      cargarPropuesta(data.proposal || [])
      if (data.expedition) onApplied(data.expedition)
    } catch (error) {
      toast.error(error.response?.data?.error || t('docReading.applyError'))
    } finally {
      setIsApplying(false)
    }
  }

  const alternar = (clave) => setSelected((prev) => (prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]))

  const valor = (cambio, v) => {
    if (v === null || v === undefined || v === '') return t('docReading.empty')
    if (CAMPOS_IMPORTE.includes(cambio.campo)) return formatearImporte(v)
    if (CAMPOS_PESO.includes(cambio.campo)) return `${Number(v).toLocaleString('es-ES')} kg`
    return String(v)
  }

  const etiqueta = (cambio) => {
    const campo = t(`docReading.field.${cambio.campo}`)
    return cambio.partida ? `${t('docReading.item', { number: cambio.partida })} · ${campo}` : campo
  }

  const noLegible = extraction && (extraction.legible === false || extraction.leido === false)

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={abrir} className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800">
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          {t('docReading.open')}
        </button>
        <button type="button" onClick={leer} disabled={isReading} className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 disabled:opacity-50">
          <SparklesIcon className="w-4 h-4" />
          {isReading ? t('docReading.reading') : (extraction ? t('docReading.readAgain') : t('docReading.read'))}
        </button>
        {extraction && !isReading && (
          <button type="button" onClick={verPropuesta} aria-expanded={isOpen} className="text-gray-600 hover:text-gray-900 underline">
            {isOpen ? t('docReading.hide') : t('docReading.show')}
          </button>
        )}
        {canDelete && !isConfirmingDelete && (
          <button type="button" onClick={() => setIsConfirmingDelete(true)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 ml-auto">
            <TrashIcon className="w-4 h-4" />
            {t('docReading.delete')}
          </button>
        )}
        {canDelete && isConfirmingDelete && (
          <span role="alert" className="inline-flex flex-wrap items-center gap-2 ml-auto text-red-700">
            {t('docReading.deleteConfirm')}
            <button type="button" onClick={eliminar} disabled={isDeleting} className="font-semibold underline disabled:opacity-50">
              {isDeleting ? t('docReading.deleting') : t('docReading.deleteYes')}
            </button>
            <button type="button" onClick={() => setIsConfirmingDelete(false)} disabled={isDeleting} className="text-gray-600 underline">
              {t('common.cancel')}
            </button>
          </span>
        )}
      </div>

      {isOpen && extraction && (
        <div className={`mt-2 p-3 rounded-lg border text-sm ${noLegible ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <p className="font-medium text-gray-800">
            {noLegible ? t('docReading.notReadable') : t('docReading.readOk', { confidence: extraction.confianza ?? 0 })}
          </p>
          {(extraction.notas || []).length > 0 && (
            <ul className="mt-1 list-disc list-inside text-amber-800">
              {extraction.notas.map((nota, i) => <li key={i}>{nota}</li>)}
            </ul>
          )}

          {!noLegible && proposal !== null && proposal.length === 0 && (
            <p className="mt-2 text-gray-600">{t('docReading.nothingToApply')}</p>
          )}

          {!noLegible && proposal !== null && proposal.length > 0 && (
            <>
              <p className="mt-3 text-gray-700">{t('docReading.proposalIntro')}</p>
              <ul className="mt-2 divide-y divide-gray-100">
                {proposal.map((cambio) => (
                  <li key={cambio.clave} className="py-1.5">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-gray-300"
                        checked={selected.includes(cambio.clave)}
                        onChange={() => alternar(cambio.clave)}
                        disabled={!canApply}
                        aria-label={etiqueta(cambio)}
                      />
                      <span className="flex-1">
                        <span className="font-medium text-gray-800">{etiqueta(cambio)}</span>
                        <span className="block text-gray-600">
                          {cambio.actual === null
                            ? <>{t('docReading.fills')}: <strong>{valor(cambio, cambio.nuevo)}</strong></>
                            : <>{valor(cambio, cambio.actual)} → <strong>{valor(cambio, cambio.nuevo)}</strong> <em className="text-amber-700">({t('docReading.changes')})</em></>}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {canApply ? (
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={aplicar} disabled={isApplying || selected.length === 0} className="btn-primary">
                    {isApplying ? t('docReading.applying') : t('docReading.apply', { count: selected.length })}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-amber-800">{t('docReading.locked')}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
