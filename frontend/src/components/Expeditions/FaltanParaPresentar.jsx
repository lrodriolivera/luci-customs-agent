import React from 'react'

/**
 * Datos que faltan para presentar una declaración (422 del backend con
 * `faltan`). Cada línea dice el dato y, entre paréntesis, dónde se completa.
 *
 * @param {{ tipo: string, faltan: string[], onCerrar: () => void }} props
 */
export default function FaltanParaPresentar({ tipo, faltan, onCerrar }) {
  if (!Array.isArray(faltan) || faltan.length === 0) return null
  return (
    <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">
          Faltan datos para presentar el {tipo}. No se ha enviado nada a la AEAT; complétalos y vuelve a presentar:
        </p>
        <button type="button" onClick={onCerrar} className="text-amber-700 hover:text-amber-900 underline">
          Cerrar
        </button>
      </div>
      <ul className="mt-2 list-disc pl-5 space-y-1">
        {faltan.map((dato) => <li key={dato}>{dato}</li>)}
      </ul>
    </div>
  )
}
