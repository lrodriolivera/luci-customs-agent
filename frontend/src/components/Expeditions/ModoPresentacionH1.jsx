import React from 'react'
import { useTranslation } from 'react-i18next'

const MODOS = [
  { valor: '', clave: 'expeditions.presentationModeDeclaration' },
  { valor: 'Aduanas', clave: 'expeditions.presentationModeCustoms' },
  { valor: 'Operador', clave: 'expeditions.presentationModeOperator' }
]

/**
 * Cómo se presenta el H1: declaración (se activa al presentar) o
 * predeclaración, que activa la aduana cuando la sumaria esté activa o el
 * propio usuario con «Activar» (servicio de la AEAT adaptado al CAU).
 *
 * @param {{ valor: ''|'Aduanas'|'Operador', onCambio: (valor: string) => void, disabled?: boolean }} props
 */
export default function ModoPresentacionH1({ valor, onCambio, disabled = false }) {
  const { t } = useTranslation()
  return (
    <div className="mb-3">
      <label className="label" htmlFor="h1-modo-presentacion">{t('expeditions.presentationMode')}</label>
      <select id="h1-modo-presentacion" className="input" value={valor} disabled={disabled} onChange={(e) => onCambio(e.target.value)}>
        {MODOS.map((m) => <option key={m.valor} value={m.valor}>{t(m.clave)}</option>)}
      </select>
      {valor && <p className="mt-1 text-xs text-gray-600">{t('expeditions.presentationModeHint')}</p>}
    </div>
  )
}
