import React from 'react'

/**
 * Medidas de control de importación que el TARIC de la UE aplica a cada
 * partida según su código y su país de origen, con los certificados de la
 * casilla 44 que admite cada una. Los datos vienen de los ficheros oficiales
 * de la Comisión Europea; los controles nacionales (SOIVRE, etc.) no están ahí.
 *
 * @param {{ partidas?: Array<{ itemNumber?: number, taricCode: string, originCountry: string, source?: { mes?: string }, measures: object[] }> }} props
 */
export default function MedidasOficialesTaric({ partidas = [] }) {
  const conMedidas = partidas.filter((p) => p.measures?.length > 0)
  if (partidas.length === 0) return null
  const mes = partidas.find((p) => p.source?.mes)?.source.mes

  return (
    <section className="p-4 bg-blue-50 border border-blue-200 rounded-lg" aria-label="Medidas de control de la UE">
      <p className="font-medium text-blue-900">Medidas de control de la UE (TARIC oficial)</p>
      <p className="mt-1 text-xs text-blue-800">
        Según el código y el país de origen de cada partida{mes ? `. Datos de la Comisión Europea, ${mes}` : ''}.
        No incluye los controles nacionales.
      </p>

      {conMedidas.length === 0 && (
        <p className="mt-3 text-sm text-blue-900">El TARIC no aplica medidas de control a estas partidas.</p>
      )}

      {conMedidas.map((partida, i) => (
        <div key={`${partida.taricCode}-${partida.originCountry}-${i}`} className="mt-3">
          <p className="text-sm font-medium text-blue-900">
            {partida.itemNumber ? `Partida ${partida.itemNumber} · ` : ''}{partida.taricCode} · origen {partida.originCountry}
          </p>
          <ul className="mt-2 space-y-3 text-sm text-blue-900">
            {partida.measures.map((medida, j) => (
              <li key={`${medida.tipo}-${j}`} className="rounded bg-white/70 p-2">
                <p className={`font-medium ${medida.prohibicion ? 'text-red-700' : ''}`}>{medida.nombre}</p>
                <p className="text-xs text-gray-600">
                  {medida.baseLegal}
                  {medida.ambito?.origenNombre ? ` · ${medida.ambito.origenNombre}` : ''}
                </p>
                {medida.prohibicion && (
                  <p className="mt-1 text-xs font-medium text-red-700">La importación está prohibida para este origen.</p>
                )}
                {medida.condiciones?.map((grupo) => (
                  <div key={grupo.grupo} className="mt-2">
                    <p className="text-xs font-medium text-gray-700">
                      {grupo.certificados.length > 1 ? 'Declarar uno de estos documentos en la casilla 44:' : 'Declarar en la casilla 44:'}
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-gray-700">
                      {grupo.certificados.map((cert) => (
                        <li key={cert.codigo}>
                          <span className="font-mono font-semibold">{cert.codigo}</span>
                          {cert.descripcion ? ` — ${cert.descripcion}` : ''}
                        </li>
                      ))}
                    </ul>
                    {grupo.exenciones?.length > 0 && (
                      <p className="mt-1 text-xs text-gray-600">
                        Exento hasta {grupo.exenciones.map((e) => `${e.cantidad} ${e.unidad}`).join(' / ')}.
                      </p>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
