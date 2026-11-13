import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { expeditionsAPI, tenantAPI } from '../../services/api'
import { declaranteDe } from '../../utils/declarante'

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
 * UAT 13/Nov/2026 (Patricia): pedia ademas ver QUIEN es el declarante (dato
 * obligatorio del DUA). Se muestra en la casilla "Declarante" de abajo,
 * calculada con la misma regla que usa el backend al generar el H1
 * (utils/declarante.js, espejo de identificadorAduanero.js).
 *
 * @param {{ expedition: object, onSaved: (expedition: object) => void }} props
 */
export default function RepresentationCard({ expedition, onSaved }) {
  const { t } = useTranslation()
  const saved = expedition.representative?.representationType || 'indirect'
  const [type, setType] = useState(saved)
  const [isSaving, setIsSaving] = useState(false)
  const [tenant, setTenant] = useState(null)

  useEffect(() => {
    let vivo = true
    tenantAPI.getMe()
      .then((response) => {
        if (vivo) setTenant(response.data?.data || null)
      })
      .catch(() => {
        // Sin datos del tenant la casilla cae al representative del
        // expediente (si lo hay); si tampoco lo hay, se avisa en vez de
        // dejarla en blanco (declaranteDe devuelve companyName vacio).
      })
    return () => { vivo = false }
  }, [])

  const declarante = declaranteDe({ representative: expedition.representative, client: expedition.client, tenant })

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

      <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-semibold uppercase text-gray-600">{t('representation.declarant')}</p>
        {declarante.companyName
          ? (
            <>
              <p className="text-sm font-medium text-gray-900">{declarante.companyName}</p>
              {declarante.eori && <p className="text-xs text-gray-500">{declarante.eori}</p>}
            </>
          )
          : <p className="text-sm text-gray-500">{t('representation.declarantUnknown')}</p>}
        <p className="mt-1 text-xs text-gray-500">{t('representation.declarantNote')}</p>
      </div>

      <p className="mt-3 text-xs text-gray-500">{t('representation.selfNote')}</p>
    </div>
  )
}
