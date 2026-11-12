import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatearImporte, interpretarImporte } from '../../utils/importe'
import TipoCambioOficial from './TipoCambioOficial'

/**
 * Campo de importe que entiende el formato español (punto de millares, coma
 * decimal) y muestra debajo como se va a guardar. Es un campo de texto: los
 * campos numericos del navegador toman el punto como decimal y convertian
 * 184.800 en 184,8 sin avisar.
 *
 * El valor que sube al padre es el texto tal cual; quien guarda lo convierte
 * con `interpretarImporte`.
 *
 * @param {{
 *   id?: string,
 *   value: string | number,
 *   currency?: string,
 *   onChange: (texto: string) => void,
 *   className?: string,
 *   required?: boolean
 * }} props
 */
export default function ImporteInput({ id, value, currency = 'EUR', onChange, className = 'input', required = false }) {
  const { t } = useTranslation()
  const texto = value === null || value === undefined ? '' : String(value)
  const numero = interpretarImporte(texto)
  const noValido = texto.trim() !== '' && numero === null

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        required={required}
        aria-invalid={noValido}
        data-campo="importe"
      />
      {noValido && (
        <p role="alert" className="mt-1 text-xs text-red-600">{t('expeditions.valueNotValid')}</p>
      )}
      {numero !== null && (
        <p className="mt-1 text-xs text-gray-500">
          {t('expeditions.valueWillBeSaved', { amount: formatearImporte(numero, currency) })}
        </p>
      )}
      {currency && currency !== 'EUR' && <TipoCambioOficial importe={numero} currency={currency} />}
    </>
  )
}
