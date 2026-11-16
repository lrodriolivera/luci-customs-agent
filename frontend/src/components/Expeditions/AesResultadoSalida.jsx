import React from 'react'

/**
 * Resultado de la salida de la UE de un AES presentado, según los avisos que
 * LUCI lee de la bandeja de la AEAT (salida efectiva, parada, levantes).
 * La AEAT no dice por qué aduana salió: se muestra la de salida declarada.
 *
 * @param {{ expedition: { declaration?: object } }} props
 */
const fecha = (valor) => {
  if (!valor) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

function Dato({ etiqueta, valor }) {
  if (!valor) return null
  return (
    <div>
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className="text-sm font-medium text-gray-900">{valor}</dd>
    </div>
  )
}

function resumen(decl, s) {
  if (s.salida?.confirmada || decl.exitConfirmedAt) {
    return { titulo: 'Salida confirmada', estilo: 'border-green-400 bg-green-50 text-green-800', fecha: fecha(s.salida?.fecha || decl.exitConfirmedAt), etiquetaFecha: 'Fecha de salida efectiva' }
  }
  if (s.salida?.parada || s.estado === 'ST') {
    return { titulo: 'Salida parada: la exportación no se ha realizado', estilo: 'border-red-400 bg-red-50 text-red-800', fecha: fecha(s.salida?.fechaParada || s.disconformidad?.fecha), etiquetaFecha: 'Fecha de parada' }
  }
  if (s.final) {
    return { titulo: s.estadoTexto || `Estado ${s.estado}`, estilo: 'border-red-400 bg-red-50 text-red-800' }
  }
  return { titulo: s.estadoTexto || 'Pendiente de que la AEAT confirme la salida', estilo: 'border-blue-200 bg-blue-50 text-blue-800' }
}

export default function AesResultadoSalida({ expedition }) {
  const decl = expedition?.declaration || {}
  if (decl.type !== 'AES' || !decl.mrn) return null
  const s = decl.aesSalida || {}
  const r = resumen(decl, s)
  const avisos = decl.aesAvisos || []

  return (
    <section aria-labelledby="aes-salida-titulo" className={`card border-2 ${r.estilo}`}>
      <h2 id="aes-salida-titulo" className="text-lg font-semibold mb-1">Salida de la UE</h2>
      <p className="font-medium mb-3">{r.titulo}</p>
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Dato etiqueta={r.etiquetaFecha} valor={r.fecha} />
        <Dato etiqueta="Aduana de salida (declarada)" valor={s.aduanaSalida || decl.officeOfExit} />
        <Dato etiqueta="Resultado" valor={s.salida?.resultadoTexto} />
        <Dato etiqueta="Levante en la aduana de salida" valor={fecha(s.levanteSalida?.fecha)} />
        <Dato etiqueta="Motivo" valor={s.disconformidad?.motivo || s.invalidacion?.justificacion} />
      </dl>
      {avisos.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">Avisos de la AEAT</p>
          <ul className="text-sm space-y-0.5">
            {avisos.map((a) => (
              <li key={a.id}>{fecha(a.fecha) || ''} · {a.texto}{a.estadoAES ? ` (${a.estadoAES})` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
