import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { h7API } from '../../services/api'
import { errorDePartidasAeat, faltanIdentificadores } from './h7AeatRules'

const inputClass = 'w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

/** Valores editables de cada partida (codigo NC/TARIC, C127, C128, C129). */
const CAMPOS = ['taricCode', 'commercialId', 'manufacturerRef', 'gtin']
const idsDe = (items = []) => items.map(it => ({
  taricCode: it.taricCode || '',
  commercialId: it.commercialId || '',
  manufacturerRef: it.manufacturerRef || '',
  gtin: it.gtin || ''
}))

/**
 * Identificadores del producto por partida que la AEAT exige en el H7
 * (C127, C128 y C129 o Y081) y su codigo NC/TARIC (8 o 10 cifras: los borradores
 * de manifiesto antiguos tienen 6). En borrador se pueden completar y guardar; en
 * otros estados solo se muestran.
 */
export default function H7ProductIdsEditor({ declaration, onSaved }) {
  const { t } = useTranslation()
  const items = declaration.items || []
  const editable = declaration.status === 'draft'
  const [ids, setIds] = useState(() => idsDe(items))
  const [saving, setSaving] = useState(false)

  const cambiar = (i, campo, valor) => {
    setIds(prev => prev.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)))
  }

  const guardar = async () => {
    const merged = items.map((it, i) => ({
      ...it,
      taricCode: ids[i].taricCode.trim(),
      commercialId: ids[i].commercialId.trim(),
      manufacturerRef: ids[i].manufacturerRef.trim(),
      gtin: ids[i].gtin.trim() || undefined
    }))
    const error = errorDePartidasAeat(merged, t)
    if (error) return toast.error(error)
    setSaving(true)
    try {
      await h7API.update(declaration._id, { items: merged })
      toast.success(t('h7.productIds.saved', 'Identificadores guardados'))
      if (onSaved) onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || t('h7.productIds.saveError', 'No se pudieron guardar los identificadores'))
    } finally {
      setSaving(false)
    }
  }

  const y081 = t('h7.productIds.y081', 'Y081 (sin EAN/GTIN)')

  return (
    <section className="bg-white rounded-xl border p-5 space-y-3" aria-labelledby="h7-product-ids-title">
      <h3 id="h7-product-ids-title" className="font-semibold text-gray-700">
        {t('h7.productIds.sectionTitle', 'Identificadores del producto (AEAT)')}
      </h3>
      {editable && faltanIdentificadores(items) && (
        <p role="alert" className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-3">
          {t('h7.productIds.missingBanner', 'Faltan identificadores del producto: la AEAT rechaza el H7 sin el identificador comercial (C127) y la referencia del fabricante (C128) en cada partida.')}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">{t('h7.productIds.taricCode', 'Codigo NC/TARIC')}</th>
              <th className="py-2 pr-4">{t('h7.productIds.commercialId', 'Identificador comercial (C127) *')}</th>
              <th className="py-2 pr-4">{t('h7.productIds.manufacturerRef', 'Referencia del fabricante (C128) *')}</th>
              <th className="py-2">{t('h7.productIds.gtin', 'Codigo EAN/GTIN (C129)')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it._id || i} className="border-b last:border-0 align-top">
                <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                {CAMPOS.map(campo => (
                  <td key={campo} className="py-2 pr-4">
                    {editable ? (
                      <input
                        aria-label={`${t(`h7.productIds.${campo}`)} ${i + 1}`}
                        value={ids[i][campo]}
                        onChange={e => cambiar(i, campo, e.target.value)}
                        className={inputClass}
                        maxLength={{ gtin: 14, taricCode: 10 }[campo] || 70}
                        inputMode={campo === 'gtin' || campo === 'taricCode' ? 'numeric' : undefined}
                      />
                    ) : (
                      <span>{it[campo] || (campo === 'gtin' ? y081 : '-')}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {t('h7.productIds.gtinHelp', 'Opcional. Si el producto no tiene codigo EAN/GTIN, LUCI declara Y081 (no existe identificador normalizado del fabricante).')}
      </p>
      {editable && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            {t('h7.productIds.save', 'Guardar identificadores')}
          </button>
        </div>
      )}
    </section>
  )
}
