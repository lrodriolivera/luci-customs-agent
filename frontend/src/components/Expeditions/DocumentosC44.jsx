import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XMarkIcon } from '@heroicons/react/24/outline'

const TIPO = /^[A-Z0-9]{4}$/
// Autorizaciones (separata 4 de la guia CAU): la AEAT las rechaza como
// documento de la partida (error 50610). No se ofrecen.
const AUTORIZACIONES = new Set(['C990', 'N990', 'D019'])
// Los codigos Y son declaraciones sin numero (referencia adicional).
const esY = (tipo) => /^Y/.test(tipo)

/**
 * Casilla 44 de una partida: documentos que exige la AEAT (certificados,
 * licencias, declaraciones Y) con su numero. Van en el H1 de la partida.
 * Las sugerencias salen del Arancel Integrado y de los certificados que pidio
 * la AEAT al presentar; la agente decide cuales aplican (UAT 16/Nov/2026).
 *
 * @param {{
 *   documentos: { tipo: string, referencia?: string, medida?: string }[],
 *   sugerencias?: { tipo: string, descripcion?: string, medida?: string, fuente?: string }[],
 *   onSave?: (documentos: object[]) => void,
 *   saving?: boolean
 * }} props
 */
/** Una propuesta exigida: con su numero (o sin el si es Y) se anade de un clic. */
function Exigido({ doc, onAdd, saving, t }) {
  const [numero, setNumero] = useState('')
  const sinNumero = esY(doc.tipo)
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono font-semibold">{doc.tipo}</span>
      <span className="text-gray-700 flex-1 min-w-[10rem]">{doc.descripcion}</span>
      {!sinNumero && (
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          maxLength={70}
          className="input w-44 font-mono text-xs"
          aria-label={t('expeditions.c44.numberFor', { tipo: doc.tipo })}
        />
      )}
      <button
        type="button"
        disabled={saving || (!sinNumero && !numero.trim())}
        onClick={() => onAdd({ tipo: doc.tipo, ...(numero.trim() ? { referencia: numero.trim() } : {}), ...(doc.medida ? { medida: doc.medida } : {}) })}
        className="btn-secondary text-xs"
        aria-label={t('expeditions.c44.addRequired', { tipo: doc.tipo })}
      >
        {t('expeditions.c44.add')}
      </button>
    </li>
  )
}

export default function DocumentosC44({ documentos = [], sugerencias = [], exigidos = [], condicionales = [], onSave, saving = false }) {
  const { t } = useTranslation()
  const [tipo, setTipo] = useState('')
  const [referencia, setReferencia] = useState('')
  const [medida, setMedida] = useState('')
  const [error, setError] = useState(null)
  const tituloId = useId()

  const yaEstan = new Set([...documentos, ...exigidos, ...condicionales].map((d) => d.tipo))
  const ofrecidas = sugerencias
    .filter((s) => !AUTORIZACIONES.has(s.tipo) && !yaEstan.has(s.tipo))
    .filter((s, i, todas) => todas.findIndex((o) => o.tipo === s.tipo) === i)

  const elegir = (sugerencia) => {
    setTipo(sugerencia.tipo)
    setMedida(sugerencia.medida || '')
    setError(null)
  }

  const anadir = () => {
    const codigo = tipo.trim().toUpperCase()
    const numero = referencia.trim()
    if (!TIPO.test(codigo)) return setError(t('expeditions.c44.codeInvalid'))
    if (AUTORIZACIONES.has(codigo)) return setError(t('expeditions.c44.isAuthorisation'))
    if (!numero && !esY(codigo)) return setError(t('expeditions.c44.referenceRequired'))
    setError(null)
    onSave([...documentos, { tipo: codigo, ...(numero ? { referencia: numero } : {}), ...(medida ? { medida } : {}) }])
    setTipo('')
    setReferencia('')
    setMedida('')
  }

  const quitar = (indice) => onSave(documentos.filter((_, i) => i !== indice))
  const anadirExigido = (doc) => onSave([...documentos, doc])

  return (
    <section className="mt-3 rounded-lg border border-gray-200 bg-white p-3" aria-labelledby={tituloId}>
      <h4 id={tituloId} className="text-sm font-semibold text-gray-900">{t('expeditions.c44.title')}</h4>
      <p className="text-xs text-gray-500 mt-0.5">{t('expeditions.c44.help')}</p>

      {documentos.length > 0 && (
        <ul aria-label={t('expeditions.c44.current')} className="mt-2 space-y-1">
          {documentos.map((d, i) => (
            <li key={`${d.tipo}-${d.referencia || i}`} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-mono font-semibold">{d.tipo}</span>
                {d.referencia && <span className="ml-2 font-mono text-gray-700">{d.referencia}</span>}
                {d.medida && <span className="ml-2 text-xs text-gray-500">{d.medida}</span>}
              </span>
              {onSave && (
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  disabled={saving}
                  aria-label={t('expeditions.c44.remove', { tipo: d.tipo })}
                  className="text-gray-400 hover:text-red-600"
                >
                  <XMarkIcon className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {onSave && (
        <>
          {exigidos.length > 0 && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
              <p role="status" className="text-xs font-medium text-amber-900">{t('expeditions.c44.required', { count: exigidos.length })}</p>
              <ul aria-label={t('expeditions.c44.requiredList')} className="mt-1 space-y-1">
                {exigidos.map((doc) => <Exigido key={doc.tipo} doc={doc} onAdd={anadirExigido} saving={saving} t={t} />)}
              </ul>
            </div>
          )}

          {condicionales.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-600">{t('expeditions.c44.conditional', { count: condicionales.length })}</summary>
              <ul className="mt-1 space-y-0.5">
                {condicionales.map((doc) => (
                  <li key={doc.tipo} className="text-xs text-gray-600">
                    <button type="button" onClick={() => elegir(doc)} className="font-mono font-semibold hover:text-blue-700">{doc.tipo}</button>
                    {' '}{doc.descripcion} — <em>{t(`expeditions.c44.reason_${doc.motivo}`)}</em>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ofrecidas.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-600">{t('expeditions.c44.suggested')}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ofrecidas.map((s) => (
                  <button
                    key={s.tipo}
                    type="button"
                    onClick={() => elegir(s)}
                    title={s.descripcion}
                    className="rounded-full border border-gray-300 px-2 py-0.5 text-xs hover:border-blue-500 hover:text-blue-700"
                  >
                    <span className="font-mono font-semibold">{s.tipo}</span>
                    {s.descripcion && <span className="ml-1 text-gray-600">{s.descripcion.slice(0, 40)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600">
              {t('expeditions.c44.code')}
              <input
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                maxLength={4}
                className="input mt-0.5 w-20 font-mono uppercase"
                aria-label={t('expeditions.c44.code')}
              />
            </label>
            <label className="text-xs text-gray-600 flex-1 min-w-[10rem]">
              {t('expeditions.c44.reference')}
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                maxLength={70}
                className="input mt-0.5 w-full font-mono"
                aria-label={t('expeditions.c44.reference')}
              />
            </label>
            <button type="button" onClick={anadir} disabled={saving} className="btn-secondary text-sm">
              {t('expeditions.c44.add')}
            </button>
          </div>
          {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
        </>
      )}
    </section>
  )
}
