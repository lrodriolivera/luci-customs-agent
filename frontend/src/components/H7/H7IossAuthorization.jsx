import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { h7API } from '../../services/api'

const inputClass = 'w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

/**
 * Autorizacion para declarar el IOSS (guia AEAT H7 v3.23): global (relacion
 * H7DEIO en la AEAT) o esporadica, acreditada con el documento 1014. LUCI envia
 * el 1014 solo en representacion indirecta; en directa la AEAT no lo admite.
 * Solo se pinta si el H7 lleva IOSS.
 */
export default function H7IossAuthorization({ declaration, onSaved }) {
  const { t } = useTranslation()
  const [ref, setRef] = useState(declaration.iossAuthorizationRef || '')
  const [saving, setSaving] = useState(false)

  if (!declaration.iossNumber) return null
  // Una H7 rechazada por la AEAT se corrige y se vuelve a presentar.
  const editable = declaration.status === 'draft' || declaration.status === 'rejected'
  const faltaRef = !String(declaration.iossAuthorizationRef || '').trim()

  const guardar = async () => {
    setSaving(true)
    try {
      await h7API.update(declaration._id, { iossAuthorizationRef: ref.trim() })
      toast.success(t('h7.ioss.saved', 'Autorizacion IOSS guardada'))
      if (onSaved) onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || t('h7.ioss.saveError', 'No se pudo guardar la autorizacion IOSS'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border p-5 space-y-3" aria-labelledby="h7-ioss-auth-title">
      <h3 id="h7-ioss-auth-title" className="font-semibold text-gray-700">
        {t('h7.ioss.title', 'Autorizacion IOSS')}
      </h3>
      {editable && faltaRef && (
        <p role="alert" className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-3">
          {t('h7.ioss.authWarning', 'Sin autorizacion global de la AEAT para usar este IOSS (relacion H7DEIO), indica el documento 1014 de autorizacion esporadica. En representacion directa solo vale la autorizacion global.')}
        </p>
      )}
      {editable ? (
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="h7-ioss-auth-ref" className="block text-xs font-medium text-gray-600 mb-1">
              {t('h7.ioss.authRef', 'Autorizacion esporadica IOSS (documento 1014)')}
            </label>
            <input id="h7-ioss-auth-ref" value={ref} onChange={e => setRef(e.target.value)} className={inputClass} placeholder="ESIOSS2026000001" maxLength={70} />
          </div>
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            {t('h7.ioss.save', 'Guardar autorizacion')}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          {t('h7.ioss.authRef', 'Autorizacion esporadica IOSS (documento 1014)')}: <span>{declaration.iossAuthorizationRef || '-'}</span>
        </p>
      )}
    </section>
  )
}
