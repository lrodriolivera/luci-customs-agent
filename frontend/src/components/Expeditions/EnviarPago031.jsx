import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { expeditionsAPI } from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmDialog from '../common/ConfirmDialog'

/**
 * Boton «Enviar al cliente el H1 y el 031». Solo con pago previo al levante
 * (forma de pago A) y el H1 presentado. No es automatico (decision del
 * 17/Nov/2026): la agente revisa la liquidacion y lo envia. El servidor
 * comprueba que la AEAT haya liquidado el importe (si no, 409).
 *
 * @param {{ expedition: object, onSent?: () => void }} props
 */
export default function EnviarPago031({ expedition, onSent }) {
  const { t } = useTranslation()
  const { confirm, dialogProps } = useConfirm()
  const [enviando, setEnviando] = useState(false)
  const decl = expedition?.declaration || {}
  if (expedition?.operationType === 'export' || decl.paymentMethod !== 'A' || !decl.mrn) return null

  const ultimoEnvio = [...(expedition.timeline || [])].reverse().find((e) => e.action === 'payment_031_sent')
  const destino = expedition.client?.contact?.email

  const enviar = async () => {
    const ok = await confirm({
      title: t('expeditions.pago031.confirmTitle'),
      message: destino ? t('expeditions.pago031.confirmMessage', { email: destino }) : t('expeditions.pago031.noEmail'),
      confirmLabel: t('expeditions.pago031.send')
    })
    if (!ok || !destino) return
    setEnviando(true)
    try {
      await expeditionsAPI.sendPago031(expedition._id)
      toast.success(t('expeditions.pago031.sent', { email: destino }))
      if (onSent) onSent()
    } catch (error) {
      toast.error(error.response?.data?.error || t('expeditions.pago031.error'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button type="button" onClick={enviar} disabled={enviando} className="btn-secondary flex items-center gap-2">
        <EnvelopeIcon className="w-5 h-5" />
        {enviando ? t('common.sending', t('expeditions.pago031.sending')) : t('expeditions.pago031.button')}
      </button>
      {ultimoEnvio && (
        <span className="self-center text-xs text-gray-500">
          {t('expeditions.pago031.lastSent', { date: new Date(ultimoEnvio.timestamp).toLocaleString() })}
        </span>
      )}
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
