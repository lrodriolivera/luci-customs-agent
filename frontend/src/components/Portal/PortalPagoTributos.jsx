import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { portalAPI } from '../../services/api'
import { hrefSeguro } from '../../utils/url'

const euros = (v) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (v) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-ES')
}

/** Guarda en el equipo del cliente el PDF que devuelve el portal. */
function guardarPdf(blob, nombre) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

/**
 * Pago de los tributos de aduana del H1, en el portal del cliente (UAT
 * 16/Nov/2026). Antes de presentar, el cliente elige: R (pago aplazado con la
 * garantia de su agente de aduanas) o A (pago previo al levante con el modelo
 * 031). Con A y el H1 admitido, ve el importe que liquido la AEAT, descarga el
 * H1 definitivo, tiene los datos para rellenar el 031 y sube el justificante de
 * pago, que la agente necesita para obtener el levante.
 *
 * @param {{ token: string, pago: object|null }} props - `pago` es `expedition.pagoTributos`
 */
export default function PortalPagoTributos({ token, pago }) {
  const { t } = useTranslation()
  const [estado, setEstado] = useState(pago)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [descargando, setDescargando] = useState(false)
  if (!estado) return null

  const descargarH1 = async () => {
    setDescargando(true)
    setError(null)
    try {
      const respuesta = await portalAPI.downloadH1Definitivo(token)
      guardarPdf(new Blob([respuesta.data], { type: 'application/pdf' }), `H1_${estado.mrn || 'definitivo'}.pdf`)
    } catch (e) {
      setError(t('portal.taxPayment.downloadError'))
    } finally {
      setDescargando(false)
    }
  }

  const elegir = async (paymentMethod) => {
    setGuardando(true)
    setError(null)
    try {
      const respuesta = await portalAPI.setPaymentMethod(token, paymentMethod)
      setEstado(respuesta.data?.data || { ...estado, paymentMethod })
    } catch (e) {
      setError(e.response?.data?.error || t('portal.taxPayment.error'))
    } finally {
      setGuardando(false)
    }
  }

  const opciones = [
    { valor: 'R', titulo: t('portal.taxPayment.optionR'), texto: t('portal.taxPayment.optionRHelp') },
    { valor: 'A', titulo: t('portal.taxPayment.optionA'), texto: t('portal.taxPayment.optionAHelp') }
  ]

  return (
    <section className="card" aria-labelledby="portal-pago-tributos">
      <h2 id="portal-pago-tributos" className="text-lg font-semibold mb-2">{t('portal.taxPayment.title')}</h2>

      {estado.editable ? (
        <>
          <p className="text-sm text-gray-600 mb-3">{t('portal.taxPayment.choose')}</p>
          <div className="space-y-2" role="radiogroup" aria-label={t('portal.taxPayment.title')}>
            {opciones.map((o) => (
              <label key={o.valor} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${estado.paymentMethod === o.valor ? 'border-luci bg-blue-50' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="forma-pago-tributos"
                  value={o.valor}
                  checked={estado.paymentMethod === o.valor}
                  onChange={() => elegir(o.valor)}
                  disabled={guardando}
                />
                <span>
                  <span className="block font-medium text-gray-900">{o.titulo}</span>
                  <span className="block text-sm text-gray-600">{o.texto}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-700">
          {estado.paymentMethod === 'R' ? t('portal.taxPayment.optionR') : estado.paymentMethod === 'A' ? t('portal.taxPayment.optionA') : t('portal.taxPayment.byAgent')}
        </p>
      )}

      {estado.pendientePago && (
        <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {estado.totalAPagar !== null && (
            <p className="font-semibold">{t('portal.taxPayment.amountDue', { importe: euros(estado.totalAPagar) })}</p>
          )}
          <p className="mt-1">{t('portal.taxPayment.howToPay')}</p>
          <a href={hrefSeguro(estado.urlPago)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-blue-700 hover:underline">
            {t('portal.taxPayment.payLink')}
          </a>
          <p className="mt-2">{t('portal.taxPayment.waiting')}</p>
        </div>
      )}

      {estado.modelo031 && (
        <div role="group" aria-label={t('portal.taxPayment.form031')} className="mt-3 rounded-lg border border-gray-200 p-3 text-sm">
          <p className="font-medium text-gray-900 mb-2">{t('portal.taxPayment.form031')}</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-xs text-gray-500">{t('portal.taxPayment.reference')}</dt>
              <dd className="font-mono text-gray-900 break-all">{estado.modelo031.referencia}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('portal.taxPayment.amount')}</dt>
              <dd className="text-gray-900">{euros(estado.modelo031.importe)} €</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('portal.taxPayment.importerNif')}</dt>
              <dd className="text-gray-900">{estado.modelo031.nifImportador || '—'}</dd>
            </div>
            {estado.modelo031.limiteDePago && (
              <div>
                <dt className="text-xs text-gray-500">{t('portal.taxPayment.deadline')}</dt>
                <dd className="text-gray-900">{fecha(estado.modelo031.limiteDePago)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {(estado.h1Definitivo || estado.pendientePago) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {estado.h1Definitivo && (
            <button type="button" onClick={descargarH1} disabled={descargando} className="btn-secondary">
              {t('portal.taxPayment.downloadH1')}
            </button>
          )}
          {estado.pendientePago && (estado.justificante ? (
            <p className="text-green-700">
              {t('portal.taxPayment.receiptReceived', { fecha: estado.justificante.subidoEn ? fecha(estado.justificante.subidoEn) : '—' })}
            </p>
          ) : (
            <Link to={`/portal/${encodeURIComponent(token)}/documents?tipo=customs_payment_receipt`} className="btn-primary">
              {t('portal.taxPayment.uploadReceipt')}
            </Link>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
