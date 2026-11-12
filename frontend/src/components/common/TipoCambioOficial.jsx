import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calculationsAPI } from '../../services/api'
import { formatearImporte } from '../../utils/importe'
import { aEuros, nombreDelMes, fechaCorta, formatearTipo } from '../../utils/divisas'

// El tipo de un mes no cambia: una consulta por divisa basta para toda la sesión.
const consultas = new Map()

const consultarTipo = (divisa) => {
  if (!consultas.has(divisa)) {
    const consulta = calculationsAPI.getExchangeRate(divisa)
      .then((respuesta) => ({ estado: 'ok', cambio: respuesta.data?.data }))
      .catch((error) => {
        // Un fallo de red no debe quedar recordado: se reintenta la próxima vez.
        if (error?.response?.status !== 404) consultas.delete(divisa)
        return { estado: error?.response?.status === 404 ? 'sinTipo' : 'error' }
      })
    consultas.set(divisa, consulta)
  }
  return consultas.get(divisa)
}

/** Solo para las pruebas. */
export const olvidarTiposConsultados = () => consultas.clear()

/**
 * Debajo de un importe en otra divisa, su equivalente en euros con el tipo de
 * cambio oficial de la aduana (BCE del penúltimo miércoles del mes anterior).
 * Los tributos se liquidan siempre en euros con ese tipo.
 *
 * @param {{ importe: number | null, currency?: string }} props
 */
export default function TipoCambioOficial({ importe, currency = 'EUR' }) {
  const { t, i18n } = useTranslation()
  const divisa = String(currency || 'EUR').toUpperCase()
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (divisa === 'EUR') return undefined
    let vigente = true
    setResultado(null)
    consultarTipo(divisa).then((r) => { if (vigente) setResultado({ ...r, divisa }) })
    return () => { vigente = false }
  }, [divisa])

  if (divisa === 'EUR' || !resultado || resultado.divisa !== divisa) return null

  if (resultado.estado === 'sinTipo') {
    return <p role="alert" className="mt-1 text-xs text-amber-700">{t('expeditions.officialRateMissing', { currency: divisa })}</p>
  }
  if (resultado.estado !== 'ok' || !(resultado.cambio?.tipo > 0)) {
    return <p className="mt-1 text-xs text-gray-500">{t('expeditions.officialRateError', { currency: divisa })}</p>
  }

  const { cambio } = resultado
  const euros = aEuros(importe ?? 0, cambio.tipo)
  return (
    <p className="mt-1 text-xs text-gray-600" data-campo="tipo-cambio-oficial">
      {t('expeditions.officialRate', {
        eur: formatearImporte(euros ?? 0, 'EUR'),
        month: nombreDelMes(cambio.mes, i18n?.language || 'es'),
        rate: formatearTipo(cambio.tipo),
        currency: divisa,
        date: fechaCorta(cambio.fechaPublicacion || cambio.fechaReferencia)
      })}
    </p>
  )
}
