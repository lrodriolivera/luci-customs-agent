import React from 'react'
import { XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

/**
 * Lo que la AEAT ha dicho de un H7 que no ha aceptado.
 *
 * - `rejected`: la AEAT lo ha rechazado. Se listan su codigo, el motivo y el
 *   campo tal cual los da la AEAT, para corregir y volver a presentar.
 * - borrador/pendiente con aeatResponse y sin MRN: el ultimo intento no obtuvo
 *   respuesta valida (red, certificado...). No consta presentado.
 *
 * @param {{ declaration: { status: string, mrn?: string, aeatResponse?: { code?: string, message?: string, errors?: Array<{ code?: string, message?: string, field?: string }> } } }} props
 */
export default function H7AeatErrors({ declaration }) {
  const respuesta = declaration.aeatResponse || {}
  const errores = (respuesta.errors || []).filter(e => e && (e.code || e.message))
  const rechazada = declaration.status === 'rejected'
  const sinRespuesta = !rechazada && !declaration.mrn
    && ['draft', 'pending'].includes(declaration.status)
    && Boolean(respuesta.code) && (errores.length > 0 || Boolean(respuesta.message))

  if (!rechazada && !sinRespuesta) return null

  const Icono = rechazada ? XCircleIcon : ExclamationTriangleIcon
  const titulo = rechazada ? 'Rechazada por la AEAT' : 'El último envío no consta presentado'
  const ayuda = rechazada
    ? 'Corrija los datos indicados y vuelva a presentar la declaración.'
    : 'Compruebe en la sede de la AEAT si la declaración consta antes de volver a presentarla.'

  return (
    <section
      role="alert"
      aria-labelledby="h7-aeat-errores"
      className={`rounded-xl border p-4 ${rechazada ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}
    >
      <div className="flex items-start gap-3">
        <Icono className={`h-6 w-6 flex-shrink-0 ${rechazada ? 'text-red-600' : 'text-amber-600'}`} />
        <div className="space-y-2 min-w-0">
          <h2 id="h7-aeat-errores" className={`font-semibold ${rechazada ? 'text-red-800' : 'text-amber-900'}`}>{titulo}</h2>
          {errores.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {errores.map((e, i) => (
                <li key={`${e.code || ''}-${i}`} className="flex flex-wrap gap-x-2">
                  {e.code && <span className="font-mono font-semibold">{e.code}</span>}
                  <span>{e.message}</span>
                  {e.field && <span className="font-mono text-xs text-gray-600">({e.field})</span>}
                </li>
              ))}
            </ul>
          ) : (
            respuesta.message && <p className="text-sm">{respuesta.message}</p>
          )}
          <p className="text-xs text-gray-600">{ayuda}</p>
        </div>
      </div>
    </section>
  )
}
