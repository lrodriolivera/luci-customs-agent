import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getExchangeRate = vi.fn()
vi.mock('../../services/api', () => ({
  calculationsAPI: { getExchangeRate: (...a) => getExchangeRate(...a) }
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (clave, valores) => `${clave} ${JSON.stringify(valores || {})}`,
    i18n: { language: 'es' }
  })
}))

import TipoCambioOficial, { olvidarTiposConsultados } from './TipoCambioOficial'

const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaReferencia: '2026-10-21', fechaPublicacion: '2026-10-21', fuente: 'BCE' }

describe('TipoCambioOficial', () => {
  beforeEach(() => {
    getExchangeRate.mockReset()
    olvidarTiposConsultados()
  })

  test('en euros no muestra nada ni consulta', () => {
    const { container } = render(<TipoCambioOficial importe={100} currency="EUR" />)
    expect(container).toBeEmptyDOMElement()
    expect(getExchangeRate).not.toHaveBeenCalled()
  })

  test('muestra el importe en euros con el tipo oficial del mes', async () => {
    getExchangeRate.mockResolvedValue({ data: { data: USD } })
    render(<TipoCambioOficial importe={10000} currency="USD" />)

    const texto = await screen.findByText(/expeditions\.officialRate /)
    expect(texto.textContent).toContain('"eur":"8.901,55 EUR"')
    expect(texto.textContent).toContain('"month":"noviembre de 2026"')
    expect(texto.textContent).toContain('"rate":"1,1234"')
    expect(texto.textContent).toContain('"date":"21/10/2026"')
    expect(getExchangeRate).toHaveBeenCalledWith('USD')
  })

  test('una divisa sin tipo oficial avisa de que hay que declarar en euros', async () => {
    getExchangeRate.mockRejectedValue({ response: { status: 404 } })
    render(<TipoCambioOficial importe={500} currency="ARS" />)

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('expeditions.officialRateMissing')
  })

  test('si la consulta falla lo dice y la reintenta la próxima vez', async () => {
    getExchangeRate.mockRejectedValueOnce(new Error('red'))
    const { unmount } = render(<TipoCambioOficial importe={500} currency="USD" />)
    await screen.findByText(/expeditions\.officialRateError/)
    unmount()

    getExchangeRate.mockResolvedValue({ data: { data: USD } })
    render(<TipoCambioOficial importe={500} currency="USD" />)
    await screen.findByText(/expeditions\.officialRate /)
    expect(getExchangeRate).toHaveBeenCalledTimes(2)
  })

  test('no repite la consulta de una divisa ya consultada', async () => {
    getExchangeRate.mockResolvedValue({ data: { data: USD } })
    const { unmount } = render(<TipoCambioOficial importe={1} currency="USD" />)
    await screen.findByText(/expeditions\.officialRate /)
    unmount()
    render(<TipoCambioOficial importe={2} currency="USD" />)
    await waitFor(() => expect(screen.getByText(/expeditions\.officialRate /)).toBeInTheDocument())
    expect(getExchangeRate).toHaveBeenCalledTimes(1)
  })
})
