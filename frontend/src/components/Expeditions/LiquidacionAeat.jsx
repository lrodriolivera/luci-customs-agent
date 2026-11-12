import React from 'react'
import { formatearImporte } from '../../utils/importe'

// Tributos más frecuentes del H1; el resto se muestra con su código.
const TRIBUTOS = { A00: 'Arancel', B00: 'IVA' }
const nombreTributo = (tipo) => (TRIBUTOS[tipo] ? `${TRIBUTOS[tipo]} (${tipo})` : tipo)
const conSigno = (n) => (n > 0 ? `+${formatearImporte(n)}` : formatearImporte(n))
const FUENTES = { presentacion: 'respuesta al presentar', consulta: 'última consulta de estado' }

/** Frase con el resultado: coincide, o cuánto más (o menos) liquida la AEAT. */
function resumen(c) {
  if (c.cuadra) return { texto: 'La liquidación de la AEAT coincide al céntimo con la de LUCI.', clase: 'text-green-800' }
  const sentido = c.diferencia >= 0 ? 'más' : 'menos'
  return {
    texto: `La AEAT liquida ${formatearImporte(Math.abs(c.diferencia), 'EUR')} ${sentido} que LUCI: revisa las partidas marcadas. Lo que se paga es lo que liquida la AEAT.`,
    clase: 'text-red-700'
  }
}

/**
 * Lo que liquida la AEAT frente a lo que declaró LUCI, partida por partida y
 * tributo por tributo, y los certificados de otros organismos que exige.
 *
 * @param {{ datos: { fuente: string|null, comparacion: object|null, certificados: object|null } | null }} props
 */
export default function LiquidacionAeat({ datos }) {
  if (!datos) return null
  const { comparacion, certificados, fuente } = datos
  const conCertificados = (certificados?.partidas || []).flatMap((p) =>
    p.organismos.map((o) => ({ clave: `${p.numero}-${o.organismo}`, partida: p.numero, organismo: o, documentos: o.medidas.flatMap((m) => m.documentos) })))
  if (!comparacion && conCertificados.length === 0) return null

  return (
    <div className="mt-4 space-y-4 text-sm">
      {comparacion && (
        <div>
          <p className="font-medium">Liquidación: LUCI frente a la AEAT</p>
          <p className="text-xs text-gray-500">Según la {FUENTES[fuente] || 'AEAT'}. Importes en euros.</p>
          <div className="mt-2 overflow-x-auto">
            <table aria-label="Liquidación de LUCI frente a la de la AEAT" className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-1 pr-3">Partida</th><th className="py-1 pr-3">Tributo</th>
                  <th className="py-1 pr-3 text-right">Base LUCI</th><th className="py-1 pr-3 text-right">Base AEAT</th>
                  <th className="py-1 pr-3 text-right">Cuota LUCI</th><th className="py-1 pr-3 text-right">Cuota AEAT</th>
                  <th className="py-1 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {comparacion.partidas.flatMap((p) => p.tributos.map((t) => {
                  const distinto = t.diferencia !== 0 || !t.luci || !t.aeat || t.luci.base !== t.aeat.base
                  return (
                    <tr key={`${p.numero}-${t.tipo}`} className={distinto ? 'bg-red-50 text-red-800' : ''}>
                      <td className="py-1 pr-3">{p.numero}</td>
                      <td className="py-1 pr-3">{nombreTributo(t.tipo)}</td>
                      <td className="py-1 pr-3 text-right">{t.luci ? formatearImporte(t.luci.base) : '—'}</td>
                      <td className="py-1 pr-3 text-right">{t.aeat ? formatearImporte(t.aeat.base) : '—'}</td>
                      <td className="py-1 pr-3 text-right">{t.luci ? formatearImporte(t.luci.cuota) : '—'}</td>
                      <td className="py-1 pr-3 text-right">{t.aeat ? formatearImporte(t.aeat.cuota) : '—'}</td>
                      <td className="py-1 text-right font-medium">{conSigno(t.diferencia)}</td>
                    </tr>
                  )
                }))}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <td className="py-1 pr-3" colSpan={4}>Total a pagar</td>
                  <td className="py-1 pr-3 text-right">{formatearImporte(comparacion.totalLuci)}</td>
                  <td className="py-1 pr-3 text-right">{formatearImporte(comparacion.totalAeat)}</td>
                  <td className="py-1 text-right">{conSigno(comparacion.diferencia)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={`mt-2 ${resumen(comparacion).clase}`}>{resumen(comparacion).texto}</p>
        </div>
      )}
      {conCertificados.length > 0 && (
        <div>
          <p className="font-medium">Certificados que exige la AEAT</p>
          <ul className="mt-1 list-disc pl-5 text-amber-900">
            {conCertificados.map((c) => (
              <li key={c.clave}>{`Partida ${c.partida} · ${c.organismo.nombre} (${c.organismo.organismo}): ${c.documentos.join(', ')}`}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-gray-500">Códigos de documento de la AEAT para la casilla 44.</p>
        </div>
      )}
    </div>
  )
}
