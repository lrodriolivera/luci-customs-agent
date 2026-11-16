import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Medidas de impuestos especiales (codigos I..) de la consulta del Arancel Integrado. */
export function opcionesImpuestoEspecial(datos) {
  return (datos?.medidas || [])
    .filter((m) => m.tipo === 'nacional' && /^I[A-Z0-9]{2}-/.test(m.codigo))
    .map((m) => {
      const especifico = String(m.derecho || '').match(/EUR\s*\/\s*(\S+)/)
      return { medida: m.codigo.slice(0, 3), epigrafe: `0${m.codigo.slice(1, 3)}`, descripcion: m.descripcion, derecho: m.derecho, unidad: especifico ? especifico[1] : null }
    })
}

const euros = (v) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Impuesto especial de una partida (cerveza, alcohol...). La agente elige el
 * epigrafe entre los que da la AEAT para el codigo y escribe la cantidad en la
 * unidad fiscal; el tipo lo pone el servidor desde la AEAT. Va en el H1 como
 * codigo nacional adicional (0A30) y tributo 0A3, y su cuota entra en la base
 * del IVA (comprobado en PRE el 16/11/2026).
 *
 * @param {{ impuesto?: object, opciones: object[], onSave?: Function, onRemove?: Function, saving?: boolean }} props
 */
export default function ImpuestoEspecial({ impuesto, opciones = [], onSave, onRemove, saving = false }) {
  const { t } = useTranslation()
  const [medida, setMedida] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [error, setError] = useState(null)
  const tituloId = useId()

  if (!impuesto?.epigrafe && opciones.length === 0) return null
  const elegida = opciones.find((o) => o.medida === medida)

  const guardar = () => {
    const valor = Number(String(cantidad).replace(',', '.'))
    if (!elegida) return setError(t('expeditions.excise.chooseMeasure'))
    if (!(valor > 0)) return setError(t('expeditions.excise.quantityRequired', { unidad: elegida.unidad || '' }))
    setError(null)
    onSave({ medida, cantidad: valor })
  }

  return (
    <section aria-labelledby={tituloId} className="mt-3 rounded-lg border border-purple-200 bg-purple-50/40 p-3">
      <h4 id={tituloId} className="text-sm font-semibold text-gray-900">{t('expeditions.excise.title')}</h4>

      {impuesto?.epigrafe ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            <span className="font-mono font-semibold">{impuesto.epigrafe}{impuesto.clave}</span>
            <span className="ml-2 text-gray-700">{impuesto.descripcion}</span>
            <span className="ml-2 font-mono">
              {impuesto.cantidad} {impuesto.unidadAeat} × {euros(impuesto.tipo)} € = {euros(impuesto.tipo * impuesto.cantidad)} €
            </span>
          </p>
          {onRemove && (
            <button type="button" onClick={onRemove} disabled={saving} className="text-xs text-red-700 hover:underline">
              {t('expeditions.excise.remove')}
            </button>
          )}
        </div>
      ) : (
        <p role="status" className="mt-1 text-sm text-purple-900">{t('expeditions.excise.required')}</p>
      )}

      {onSave && !impuesto?.epigrafe && (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600 flex-1 min-w-[14rem]">
              {t('expeditions.excise.measure')}
              <select value={medida} onChange={(e) => setMedida(e.target.value)} className="input mt-0.5 w-full" aria-label={t('expeditions.excise.measure')}>
                <option value="">—</option>
                {opciones.map((o) => (
                  <option key={o.medida} value={o.medida}>{o.epigrafe} · {o.descripcion} · {o.derecho || '—'}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              {t('expeditions.excise.quantity', { unidad: elegida?.unidad || '' })}
              <input
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                inputMode="decimal"
                className="input mt-0.5 w-28"
                aria-label={t('expeditions.excise.quantity', { unidad: elegida?.unidad || '' })}
              />
            </label>
            <button type="button" onClick={guardar} disabled={saving} className="btn-secondary text-sm">
              {t('expeditions.excise.save')}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">{t('expeditions.excise.help')}</p>
          {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
        </>
      )}
    </section>
  )
}
