import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BuildingLibraryIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { classificationAPI } from '../../services/api'

// Codigo de la AEAT para "todos los terceros paises" (erga omnes).
const AREA_ERGA_OMNES = '1011'

// Orden en que se presentan: lo que mas pesa en la liquidacion y en el
// despacho (IVA, controles nacionales) antes que el detalle de la UE.
const GRUPOS = [
  { clave: 'groupTax', tipos: ['iva', 'igic'] },
  { clave: 'groupNational', tipos: ['nacional'] },
  { clave: 'groupUe', tipos: ['ue'] }
]

/** "12,000%" -> 12; sin porcentaje (EUR, unidades...) -> null. */
const porcentaje = (derecho) => {
  const m = String(derecho || '').match(/^\s*([\d.,]+)\s*%\s*$/)
  return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null
}

/**
 * Compara el arancel y el IVA del expediente con los de la AEAT.
 * Arancel general: medida 103. Una preferencia (1xx distinta de 103) solo
 * cuenta si su area es el origen consultado; si el expediente usa ese tipo,
 * no es un error, pero exige prueba de origen.
 * @returns {{ clave: string, valores: object, aviso: boolean }[]}
 */
/** Arancel general (103), preferencias del origen e IVA segun la AEAT. */
function tiposAeat(datos) {
  const medidas = datos?.medidas || []
  return {
    general: porcentaje(medidas.find((m) => m.codigo.startsWith('103'))?.derecho),
    preferencias: medidas
      .filter((m) => /^1\d\d/.test(m.codigo) && !m.codigo.startsWith('103') && datos.areaGeografica && m.areaGeografica?.startsWith(datos.areaGeografica))
      .map((m) => ({ codigo: m.codigo, tipo: porcentaje(m.derecho) }))
      .filter((p) => p.tipo !== null),
    iva: porcentaje(medidas.find((m) => m.tipo === 'iva')?.derecho)
  }
}

function contrastar(datos, compare) {
  if (!compare || !datos?.existe) return []
  const resultado = []
  const { general, preferencias: prefs, iva: ivaAeat } = tiposAeat(datos)
  const preferencias = prefs.map((p) => p.tipo)
  const arancel = typeof compare.dutyRate === 'number' ? compare.dutyRate : null
  if (arancel !== null && general !== null) {
    if (preferencias.includes(arancel) && arancel !== general) {
      resultado.push({ clave: 'dutyPreference', valores: { aeat: arancel, general }, aviso: false })
    } else if (arancel !== general) {
      resultado.push({ clave: 'dutyMismatch', valores: { expediente: arancel, aeat: general }, aviso: true })
    }
  }

  const iva = typeof compare.vatRate === 'number' ? compare.vatRate : null
  if (iva !== null && ivaAeat !== null && iva !== ivaAeat) {
    resultado.push({ clave: 'vatMismatch', valores: { expediente: iva, aeat: ivaAeat }, aviso: true })
  }
  return resultado
}

/**
 * Una medida del Arancel Integrado: codigo, descripcion, derecho, exclusiones
 * y documentos que exige.
 * @param {{ medida: object, t: Function }} props
 */
function Medida({ medida, t }) {
  return (
    <li className="py-2 border-t border-gray-100 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-800">
          <span className="font-mono text-xs text-gray-500 mr-2">{medida.codigo}</span>
          {medida.descripcion}
        </p>
        {medida.derecho && (
          <span className="shrink-0 font-mono text-sm font-semibold text-gray-900">{medida.derecho}</span>
        )}
      </div>
      {medida.areaGeografica && !/ERGA OMNES/.test(medida.areaGeografica) && (
        <p className="text-xs text-gray-500 mt-0.5">{medida.areaGeografica}</p>
      )}
      {medida.exclusiones && (
        <p className="text-xs text-gray-600 mt-0.5">
          {t('classification.aeat.exclusions')}: <span>{medida.exclusiones}</span>
        </p>
      )}
      {medida.documentos?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {medida.documentos.map((doc) => (
            <li key={doc.codigo} className="text-xs text-gray-600">
              <span className="font-mono font-semibold">{doc.codigo}</span> — {doc.descripcion}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Consulta bajo demanda del Arancel Integrado de la AEAT para un codigo TARIC:
 * la capa nacional espanola (IVA, impuestos especiales, controles e
 * inspecciones) que el catalogo TARIC de la UE no trae. UAT 16/Nov/2026.
 *
 * Con `compare` ({ dutyRate, vatRate } del expediente) avisa si el arancel o
 * el IVA que usa LUCI no coinciden con los de la AEAT.
 *
 * Con `onApply(medida?)` ofrece guardar en la partida el arancel y el IVA de
 * la AEAT (sin medida, el general; con ella, esa preferencia del origen).
 *
 * @param {{ code: string, origin?: string, compare?: { dutyRate?: number, vatRate?: number }, onApply?: Function, applying?: boolean, className?: string }} props
 */
export default function MedidasAeat({ code, origin, compare, onApply, onLoaded, autoLoad = false, applying = false, className = 'mt-3 pl-9' }) {
  const { t } = useTranslation()
  const [estado, setEstado] = useState({ cargando: false, datos: null, error: null, automatica: false })

  const consultar = async (automatica = false) => {
    setEstado({ cargando: true, datos: null, error: null, automatica })
    try {
      // El origen del expediente se escribe a mano: solo se envia si es un
      // codigo ISO de dos letras; si no, se consulta para todos los paises.
      const origen = /^[A-Za-z]{2}$/.test(String(origin || '').trim()) ? origin.trim().toUpperCase() : undefined
      const respuesta = await classificationAPI.aeatTariff(code, origen)
      setEstado({ cargando: false, datos: respuesta.data?.data, error: null, automatica })
      onLoaded?.(respuesta.data?.data)
    } catch (error) {
      setEstado({
        cargando: false,
        datos: null,
        error: error.response?.data?.error || t('classification.aeat.error'),
        automatica
      })
    }
  }

  // En el expediente se consulta sola al abrirlo (pocas partidas; la sede
  // tiene cache de 24 h), para proponer documentos sin que haya que pulsar.
  useEffect(() => {
    if (autoLoad) consultar(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, code, origin])

  const { cargando, datos, error } = estado
  const contraste = contrastar(datos, compare)
  // Botones para guardar en la partida lo que dice la AEAT (solo en el
  // expediente, que pasa onApply). El general si hay diferencias; cada
  // preferencia del origen aparte, porque exige prueba de origen.
  const tipos = datos?.existe ? tiposAeat(datos) : null
  const hayDiferencias = contraste.some((c) => c.aviso)
  const opciones = onApply && tipos ? [
    ...(hayDiferencias && tipos.general !== null
      ? [{ medida: undefined, etiqueta: t('classification.aeat.useAeat', { arancel: tipos.general, iva: tipos.iva ?? compare?.vatRate }) }]
      : []),
    ...tipos.preferencias
      .filter((p) => p.tipo !== compare?.dutyRate)
      .map((p) => ({ medida: p.codigo, etiqueta: t('classification.aeat.usePreference', { medida: p.codigo, arancel: p.tipo }) }))
  ] : []
  const origenTexto = !datos || datos.areaGeografica === AREA_ERGA_OMNES
    ? t('classification.aeat.ergaOmnes')
    : datos.areaGeografica

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => consultar(false)}
        disabled={cargando}
        className="btn-secondary text-sm inline-flex items-center gap-1.5"
      >
        <BuildingLibraryIcon className="w-4 h-4" aria-hidden="true" />
        {cargando ? t('classification.aeat.loading') : t('classification.aeat.consult')}
      </button>

      {/* Un fallo de la consulta automatica no salta como alerta: se informa
          y la agente puede reintentar con el boton. */}
      {error && (
        <p role={estado.automatica ? undefined : 'alert'} className="mt-2 text-sm text-red-700">{error}</p>
      )}

      {datos && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{t('classification.aeat.title')}</p>
            <a
              href={datos.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
            >
              {t('classification.aeat.openAeat')}
              <ArrowTopRightOnSquareIcon className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            {t('classification.aeat.meta', { fecha: datos.fechaConsulta, origen: origenTexto })}
          </p>

          {contraste.map(({ clave, valores, aviso }) => (
            <p
              key={clave}
              role="status"
              className={`mt-2 text-sm rounded px-2 py-1 ${aviso ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}
            >
              {t(`classification.aeat.${clave}`, valores)}
            </p>
          ))}
          {compare && datos.existe && contraste.length === 0 && (
            <p className="mt-2 text-sm text-green-700">{t('classification.aeat.ratesMatch')}</p>
          )}

          {opciones.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {opciones.map(({ medida, etiqueta }) => (
                <button
                  key={medida || 'general'}
                  type="button"
                  onClick={() => onApply(medida)}
                  disabled={applying}
                  className="btn-primary text-xs"
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          )}

          {!datos.existe && (
            <p className="mt-2 text-sm text-amber-800">{t('classification.aeat.notFound')}</p>
          )}

          {datos.existe && GRUPOS.map(({ clave, tipos }) => {
            const medidas = (datos.medidas || []).filter((m) => tipos.includes(m.tipo))
            if (medidas.length === 0) return null
            const id = `aeat-${code}-${clave}`
            return (
              <section key={clave} aria-labelledby={id} className="mt-3">
                <h4 id={id} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t(`classification.aeat.${clave}`)}
                </h4>
                <ul className="mt-1">
                  {medidas.map((medida) => (
                    <Medida key={`${medida.codigo}-${medida.areaGeografica}`} medida={medida} t={t} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
