import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toNumberOrUndefined } from './packageTypes'

export const LOAD_TYPES = ['FCL', 'LCL']
const MARITIME_MODES = ['SEA', 'sea', 'maritime', '1']

const asInput = (value) => (value === undefined || value === null ? '' : String(value))

// Mismo margen que el backend (services/forms/grupajeLcl.js): por debajo es redondeo.
const WEIGHT_TOLERANCE_KG = 1
const WEIGHT_TOLERANCE_RATIO = 0.01

/**
 * ¿Los bultos o los kilos que devolvio la AEAT difieren de los del expediente?
 * No bloquea el H1: se muestra para que el agente lo compruebe y lo valide.
 */
export const differsFromExpedition = (aeat, totals) => {
  if (!aeat || aeat.packages === null || aeat.packages === undefined) return false
  if (aeat.grossWeight === null || aeat.grossWeight === undefined) return false
  const packages = Number(totals?.totalPackages ?? 0)
  const weight = Number(totals?.totalGrossWeight ?? 0)
  const margin = Math.max(WEIGHT_TOLERANCE_KG, weight * WEIGHT_TOLERANCE_RATIO)
  return Number(aeat.packages) !== packages || Math.abs(Number(aeat.grossWeight) - weight) > margin
}

/** ¿Tiene sentido preguntar por contenedor completo o grupaje? */
export const isMaritime = (expedition) => MARITIME_MODES.includes(String(expedition?.transportMode || ''))

/**
 * Tipo de carga maritima y declaracion sumaria en la que se apoya el H1.
 *
 * En un grupaje (LCL) el backend no deja generar ni presentar el H1 hasta que
 * conste la sumaria de la desconsolidacion (una partida master bloquea). Si
 * los bultos o los kilos no coinciden con los del expediente solo se avisa: lo
 * valida el agente. Aqui el agente la registra; lo que bloquea lo decide el
 * backend (services/forms/grupajeLcl.js).
 *
 * @param {{
 *   expedition: object,
 *   isSaving: boolean,
 *   onSave: (transport: { loadType?: string, summaryDeclaration?: object }) => void,
 *   isVerifying?: boolean,
 *   onVerify?: () => void,
 *   verification?: { blocked: boolean, reason: string|null, warning: string|null } | null
 * }} props
 */
export default function GroupageCard({ expedition, isSaving, onSave, isVerifying = false, onVerify, verification = null }) {
  const { t } = useTranslation()
  const transport = expedition.transport || {}
  const [loadType, setLoadType] = useState(transport.loadType || '')
  const [form, setForm] = useState({
    number: asInput(transport.summaryDeclaration?.number),
    item: asInput(transport.summaryDeclaration?.item),
    packages: asInput(transport.summaryDeclaration?.packages),
    grossWeight: asInput(transport.summaryDeclaration?.grossWeight)
  })

  const handleChange = (field) => (e) => {
    const { value } = e.target
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const number = form.number.trim()
    onSave({
      // '' no es un valor valido del tipo de carga: se envia sin definir.
      loadType: loadType || undefined,
      summaryDeclaration: number
        ? {
            number,
            item: form.item.trim() || undefined,
            packages: toNumberOrUndefined(form.packages),
            grossWeight: toNumberOrUndefined(form.grossWeight)
          }
        : undefined
    })
  }

  const totals = expedition.goodsSummary || {}
  const isGroupage = loadType === 'LCL'
  const savedSummary = transport.summaryDeclaration
  const aeat = savedSummary?.aeat
  const differs = transport.loadType === 'LCL' && Boolean(aeat?.verified) && !aeat.error && !aeat.isMaster &&
    differsFromExpedition(aeat, totals)
  const balance = aeat && aeat.packagesBalance !== null && aeat.packagesBalance !== undefined
    ? t('groupage.aeatBalance', { packages: aeat.packagesBalance })
    : ''

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">{t('groupage.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="md:w-1/2">
          <label className="label" htmlFor="load-type">{t('groupage.loadType')}</label>
          <select id="load-type" value={loadType} onChange={(e) => setLoadType(e.target.value)} className="input">
            <option value="">{t('groupage.loadTypeUnset')}</option>
            {LOAD_TYPES.map((type) => (
              <option key={type} value={type}>{t(`groupage.loadType${type}`)}</option>
            ))}
          </select>
        </div>

        {isGroupage && (
          <div role="note" className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            <p className="font-medium">{t('groupage.ruleTitle')}</p>
            <p className="mt-1">{t('groupage.ruleText')}</p>
          </div>
        )}

        {loadType !== '' && (
          <>
            <p className="text-sm font-medium text-gray-700">{t('groupage.summaryDeclaration')}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="label" htmlFor="summary-number">{t('groupage.summaryNumber')}</label>
                <input id="summary-number" type="text" maxLength={40} value={form.number} onChange={handleChange('number')} className="input font-mono" />
                <p className="mt-1 text-xs text-gray-500">{t('groupage.summaryNumberHint')}</p>
              </div>
              <div>
                <label className="label" htmlFor="summary-item">{t('groupage.summaryItem')}</label>
                <input id="summary-item" type="text" maxLength={10} value={form.item} onChange={handleChange('item')} className="input" />
              </div>
              <div />
              <div>
                <label className="label" htmlFor="summary-packages">{t('groupage.summaryPackages')}</label>
                <input id="summary-packages" type="number" min="1" step="1" value={form.packages} onChange={handleChange('packages')} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="summary-weight">{t('groupage.summaryGrossWeight')}</label>
                <input id="summary-weight" type="number" min="0" step="0.001" value={form.grossWeight} onChange={handleChange('grossWeight')} className="input" />
              </div>
              <div className="md:col-span-2 text-sm text-gray-600 self-end">
                {t('groupage.expeditionTotals', {
                  packages: totals.totalPackages ?? 0,
                  weight: Number(totals.totalGrossWeight ?? 0).toLocaleString('es-ES')
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          {onVerify && savedSummary?.number && (
            <button type="button" onClick={onVerify} disabled={isVerifying || isSaving} className="btn-secondary">
              {isVerifying ? t('groupage.verifying') : t('groupage.verify')}
            </button>
          )}
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      {/* Lo que respondio la AEAT la ultima vez que se consulto esta partida. */}
      {aeat && (
        <div
          role="status"
          className={`mt-4 p-3 rounded-lg border text-sm ${
            aeat.verified && !aeat.error && !aeat.isMaster && !differs
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <p className="font-medium">
            {aeat.verified ? t('groupage.aeatVerified') : t('groupage.aeatNotVerified')}
            {aeat.environment ? ` (${aeat.environment})` : ''}
          </p>
          {aeat.error && <p className="mt-1">{aeat.error}</p>}
          {aeat.itemStatus && (
            <p className="mt-1">
              {t('groupage.aeatItem', {
                status: aeat.itemStatusText || aeat.itemStatus,
                packages: aeat.packages ?? '—',
                weight: aeat.grossWeight ?? '—'
              })}
              {balance ? ` ${balance}` : ''}
            </p>
          )}
          {aeat.isMaster && <p className="mt-1 font-medium">{t('groupage.aeatMaster')}</p>}
          {differs && (
            <p className="mt-1 font-medium">
              {t('groupage.aeatDiffers', {
                packages: totals.totalPackages ?? 0,
                weight: Number(totals.totalGrossWeight ?? 0).toLocaleString('es-ES')
              })}
            </p>
          )}
          {(aeat.billOfLading || aeat.location) && (
            <p className="mt-1">
              {[aeat.billOfLading && t('groupage.aeatBillOfLading', { value: aeat.billOfLading }),
                aeat.location && t('groupage.aeatLocation', { value: aeat.location })].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      {verification?.reason && (
        <p role="alert" className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">{verification.reason}</p>
      )}
      {verification?.warning && (
        <p className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">{verification.warning}</p>
      )}
    </div>
  )
}
