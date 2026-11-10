import React from 'react'
import { useTranslation } from 'react-i18next'

const CAMPOS = ['documentNumber', 'vehicleId', 'departurePort', 'arrivalPort']

/**
 * Datos del documento de transporte en el alta: numero de BL/AWB/CMR, medio,
 * puertos y contenedores. El alta no los pedia; ahora los rellena la lectura
 * del documento de transporte y el agente puede corregirlos antes de crear el
 * expediente.
 *
 * @param {{ value: object, onChange: (campo: string, valor: string) => void }} props
 */
export default function TransportDetailsFields({ value, onChange }) {
  const { t } = useTranslation()

  return (
    <fieldset className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      <legend className="text-sm font-medium text-gray-700 mb-2">{t('draftDocs.transportDetails')}</legend>
      {CAMPOS.map((campo) => (
        <div key={campo}>
          <label className="label" htmlFor={`transport-${campo}`}>{t(`docReading.field.${campo}`)}</label>
          <input
            id={`transport-${campo}`}
            type="text"
            value={value?.[campo] || ''}
            onChange={(e) => onChange(campo, e.target.value)}
            className="input"
          />
        </div>
      ))}
      <div className="md:col-span-2">
        <label className="label" htmlFor="transport-containers">{t('docReading.field.containers')}</label>
        <input
          id="transport-containers"
          type="text"
          value={value?.containers || ''}
          onChange={(e) => onChange('containers', e.target.value.toUpperCase())}
          className="input"
          placeholder="MSCU1234567, TGHU7654321"
        />
        <p className="text-xs text-gray-500 mt-1">{t('draftDocs.containersHint')}</p>
      </div>
    </fieldset>
  )
}
