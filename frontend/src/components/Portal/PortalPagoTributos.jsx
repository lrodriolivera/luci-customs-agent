import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { portalAPI } from '../../services/api'
import { hrefSeguro } from '../../utils/url'

const euros = (v) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Pago de los tributos de aduana del H1, en el portal del cliente (UAT
 * 16/Nov/2026). Antes de presentar, el cliente elige: R (pago aplazado con la
 * garantia de su agente de aduanas) o A (pago previo al levante con el modelo
 * 031). Con A y el H1 admitido, ve el importe que liquido la AEAT y como pagarlo.
 *
 * @param {{ token: string, pago: object|null }} props - `pago` es `expedition.pagoTributos`
 */
export default function PortalPagoTributos({ token, pago }) {
  const { t } = useTranslation()
  const [estado, setEstado] = useState(pago)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  if (!estado) return null

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

      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
