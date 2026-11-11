import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { expeditionsAPI } from '../../services/api'

export const REPRESENTATION_TYPES = ['indirect', 'direct']

/**
 * Forma de representacion con la que se presenta la declaracion (casilla 14
 * del DUA). El agente elige directa o indirecta; el autodespacho no se elige:
 * el backend lo declara cuando el declarante es el propio importador
 * (services/forms/identificadorAduanero.js -> formaRepresentacionDe).
 *
 * UAT 10/Nov/2026 (tarjeta H1-01): no habia donde indicarlo y el H1 salia
 * siempre con el mismo codigo.
 *
 * @param {{ expedition: object, onSaved: (expedition: object) => void }} props
 */
export default function RepresentationCard({ expedition, onSaved }) {
  const { t } = useTranslation()
  const saved = expedition.representative?.representationType || 'indirect'
  const [type, setType] = useState(saved)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // El backend sustituye `representative` entero: se envia completo.
      const representative = { ...(expedition.representative || {}), representationType: type }
      const response = await expeditionsAPI.update(expedition._id, { representative })
      onSaved(response.data?.data || response.data)
      toast.success(t('representation.saved'))
    } catch (error) {
      toast.error(error.response?.data?.error || t('representation.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{t('representation.title')}</h2>
      <p className="text-sm text-gray-600 mb-4">{t('representation.intro')}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[16rem]">
          <label className="label" htmlFor="representation-type">{t('representation.type')}</label>
          <select
            id="representation-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
          >
            {REPRESENTATION_TYPES.map((option) => (
              <option key={option} value={option}>{t(`representation.${option}`)}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={isSaving || type === saved} className="btn-primary">
          {isSaving ? t('common.saving') : t('common.save')}
        </button>
      </form>
      <p className="mt-2 text-sm text-gray-700">{t(`representation.${type}Hint`)}</p>
      <p className="mt-3 text-xs text-gray-500">{t('representation.selfNote')}</p>
    </div>
  )
}
