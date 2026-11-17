import React, { useEffect, useMemo, useState } from 'react'
import { declarationsAPI } from '../../services/api'

// El catalogo es fijo (lo publica el backend desde config/regimenesH1.js, con
// sus fuentes oficiales): se pide una vez por sesion.
let catalogoEnCurso = null

/** Para los tests: vuelve a pedir el catalogo. */
export function olvidarCatalogoRegimenesH1() {
  catalogoEnCurso = null
}

function pedirCatalogo() {
  if (!catalogoEnCurso) {
    // Dentro de la promesa: cualquier fallo, incluso al llamar, deja la tarjeta sin desplegables.
    catalogoEnCurso = Promise.resolve()
      .then(() => declarationsAPI.getH1RegimeCatalog())
      .then((r) => {
        const catalogo = r?.data?.data
        if (!Array.isArray(catalogo?.combinaciones) || !Array.isArray(catalogo?.adicionales)) throw new Error('Catálogo de regímenes no válido')
        return catalogo
      })
      .catch((e) => { catalogoEnCurso = null; throw e })
  }
  return catalogoEnCurso
}

/** Catalogo oficial del regimen para el H1: { catalogo, error }. */
export function useCatalogoRegimenesH1() {
  const [estado, setEstado] = useState({ catalogo: null, error: false })
  useEffect(() => {
    let vigente = true
    pedirCatalogo()
      .then((catalogo) => { if (vigente) setEstado({ catalogo, error: false }) })
      .catch(() => { if (vigente) setEstado({ catalogo: null, error: true }) })
    return () => { vigente = false }
  }, [])
  return estado
}

/** «4071» -> «40.71». */
const conPunto = (codigo) => (/^\d{4}$/.test(codigo || '') ? `${codigo.slice(0, 2)}.${codigo.slice(2)}` : codigo)

/** Agrupa por `grupo` conservando el orden del catalogo. */
function agrupar(lista) {
  const grupos = new Map()
  for (const elemento of lista) grupos.set(elemento.grupo, [...(grupos.get(elemento.grupo) || []), elemento])
  return [...grupos.entries()]
}

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Regimen solicitado + precedente (casilla 37.1) y regimen adicional (37.2)
 * con la lista oficial. Un valor guardado fuera del catalogo se muestra tal
 * cual para no perderlo al guardar otros datos.
 *
 * @param {{ catalogo: object, procedure: string, additionalProcedure: string,
 *   onProcedure: (e) => void, onAdditionalProcedure: (e) => void }} props
 */
export default function RegimenH1Campos({ catalogo, procedure, additionalProcedure, onProcedure, onAdditionalProcedure }) {
  const [busqueda, setBusqueda] = useState('')
  const combinacion = catalogo.combinaciones.find((c) => c.codigo === procedure)
  const adicional = catalogo.adicionales.find((a) => a.codigo === additionalProcedure)

  const adicionalesVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return catalogo.adicionales
    // El elegido sigue en la lista aunque no case con la busqueda.
    return catalogo.adicionales.filter((a) => a.codigo === additionalProcedure || normalizar(`${a.codigo} ${a.descripcion}`).includes(q))
  }, [busqueda, catalogo.adicionales, additionalProcedure])

  return (
    <fieldset className="sm:col-span-2 grid gap-3 rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium">Régimen aduanero</legend>
      <div>
        <label className="label" htmlFor="h1-procedure">Régimen solicitado y precedente (casilla 37.1)</label>
        <select id="h1-procedure" className="input" value={procedure || ''} onChange={onProcedure}>
          {procedure && !combinacion && <option value={procedure}>{`${conPunto(procedure)} – no está en el catálogo oficial`}</option>}
          {agrupar(catalogo.combinaciones).map(([grupo, combinaciones]) => (
            <optgroup key={grupo} label={grupo}>
              {combinaciones.map((c) => <option key={c.codigo} value={c.codigo}>{`${conPunto(c.codigo)} – ${c.descripcion}`}</option>)}
            </optgroup>
          ))}
        </select>
        {combinacion?.nota && <p role="note" className="mt-1 text-xs text-amber-800">{combinacion.nota}</p>}
      </div>
      <div>
        <label className="label" htmlFor="h1-additional-procedure">Régimen adicional (casilla 37.2)</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Buscar régimen adicional" className="input sm:w-56" type="search" placeholder="Buscar código o texto"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
          <select id="h1-additional-procedure" className="input" value={additionalProcedure || ''} onChange={onAdditionalProcedure}>
            <option value="">Ninguno</option>
            {additionalProcedure && !adicional && <option value={additionalProcedure}>{`${additionalProcedure} – no está en el catálogo oficial`}</option>}
            {agrupar(adicionalesVisibles).map(([grupo, adicionales]) => (
              <optgroup key={grupo} label={grupo}>
                {adicionales.map((a) => <option key={a.codigo} value={a.codigo}>{`${a.codigo} – ${a.descripcion}`}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {adicional?.nota && <p role="note" className="mt-1 text-xs text-amber-800">{adicional.nota}</p>}
        <p className="mt-1 text-xs text-gray-500">
          Los códigos del impuesto sobre el plástico (1P1–1P5) los añade cada partida según su exención. Fuentes: {catalogo.fuentes?.regimen}; {catalogo.fuentes?.adicionales}.
        </p>
      </div>
    </fieldset>
  )
}
