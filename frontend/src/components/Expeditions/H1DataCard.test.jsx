import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getH1Requirements = vi.fn()
const updateH1Data = vi.fn()
const getH1Status = vi.fn()
const cancelH1 = vi.fn()
const activateH1 = vi.fn()
vi.mock('../../services/api', () => ({
  declarationsAPI: {
    getH1Requirements: (...a) => getH1Requirements(...a), updateH1Data: (...a) => updateH1Data(...a),
    getH1Status: (...a) => getH1Status(...a), cancelH1: (...a) => cancelH1(...a), activateH1: (...a) => activateH1(...a)
  }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import H1DataCard from './H1DataCard'

const respuesta = (extra = {}) => ({
  data: { data: {
    servicio: 'cau', listo: false, faltan: ['número de la factura comercial', 'nacionalidad del medio de transporte en frontera'],
    datos: { invoiceNumber: '', exporterPostalCode: '', vehicleNationality: '', dispatchAuthorizationScope: 'OSRE' }, ...extra
  } }
})

describe('<H1DataCard />', () => {
  beforeEach(() => {
    getH1Requirements.mockReset()
    updateH1Data.mockReset()
    getH1Status.mockReset()
    cancelH1.mockReset()
    activateH1.mockReset()
  })

  test('muestra lo que falta para presentar el H1', async () => {
    getH1Requirements.mockResolvedValue(respuesta())
    render(<H1DataCard expedition={{ _id: 'e1' }} />)

    expect(await screen.findByText('Faltan datos para presentar el H1:')).toBeInTheDocument()
    expect(screen.getByText('número de la factura comercial')).toBeInTheDocument()
    expect(getH1Requirements).toHaveBeenCalledWith('e1')
  })

  test('guarda los datos y vuelve a comprobar', async () => {
    getH1Requirements
      .mockResolvedValueOnce(respuesta())
      .mockResolvedValueOnce(respuesta({ listo: true, faltan: [], datos: { invoiceNumber: 'FAC-1', exporterPostalCode: '200000', vehicleNationality: 'PA', dispatchAuthorizationScope: 'global' } }))
    updateH1Data.mockResolvedValue({ data: { success: true } })
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    fireEvent.change(screen.getByLabelText('Número de la factura comercial'), { target: { value: 'FAC-1' } })
    fireEvent.change(screen.getByLabelText('Código postal del exportador'), { target: { value: '200000' } })
    fireEvent.change(screen.getByLabelText('Nacionalidad del medio de transporte en frontera'), { target: { value: 'PA' } })
    fireEvent.change(screen.getByLabelText('Autorización de despacho del representante'), { target: { value: 'global' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(updateH1Data).toHaveBeenCalledWith('e1', { invoiceNumber: 'FAC-1', exporterPostalCode: '200000', vehicleNationality: 'PA', dispatchAuthorizationScope: 'global' }))
    expect(await screen.findByText('El expediente tiene todos los datos que exige el H1.')).toBeInTheDocument()
  })

  const conIncoterm = (incoterm, gastosASumar, extra = {}) => respuesta({ datos: {
    invoiceNumber: 'FAC-1', exporterPostalCode: '200000', vehicleNationality: 'PA', dispatchAuthorizationScope: 'OSRE',
    incoterm, gastosASumar, freightAmount: null, freightCurrency: 'EUR', insuranceAmount: null, insuranceCurrency: 'EUR', ...extra
  } })

  test('FOB: pide flete y seguro con su divisa y los guarda', async () => {
    getH1Requirements.mockResolvedValue(conIncoterm('FOB', { flete: true, seguro: true }))
    updateH1Data.mockResolvedValue({ data: { success: true } })
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.getByText(/Con FOB el precio no incluye el flete ni el seguro/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Flete hasta la entrada en la UE'), { target: { value: '1123.40' } })
    fireEvent.change(screen.getByLabelText('Divisa del flete'), { target: { value: 'USD' } })
    fireEvent.change(screen.getByLabelText('Seguro hasta la entrada en la UE'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(updateH1Data).toHaveBeenCalledWith('e1', {
      invoiceNumber: 'FAC-1', exporterPostalCode: '200000', vehicleNationality: 'PA', dispatchAuthorizationScope: 'OSRE',
      freightAmount: '1123.40', freightCurrency: 'USD', insuranceAmount: '0', insuranceCurrency: 'EUR'
    }))
  })

  test('CFR: solo pide el seguro', async () => {
    getH1Requirements.mockResolvedValue(conIncoterm('CFR', { flete: false, seguro: true }))
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.queryByLabelText('Flete hasta la entrada en la UE')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Seguro hasta la entrada en la UE')).toBeInTheDocument()
    expect(screen.getByText(/Con CFR el precio incluye el flete, no el seguro/)).toBeInTheDocument()
  })

  test('CIF: no pide nada porque el precio ya los incluye', async () => {
    getH1Requirements.mockResolvedValue(conIncoterm('CIF', { flete: false, seguro: false }))
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.queryByLabelText('Flete hasta la entrada en la UE')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Seguro hasta la entrada en la UE')).not.toBeInTheDocument()
    expect(screen.getByText(/Con CIF el precio ya incluye el flete y el seguro/)).toBeInTheDocument()
  })

  test('factura en una divisa sin tipo del BCE: pide el cambio aplicado y lo guarda', async () => {
    getH1Requirements.mockResolvedValue(conIncoterm('CIF', { flete: false, seguro: false }, { invoiceCurrency: 'MAD', invoiceCurrencyWithoutBce: true, appliedExchangeRate: null }))
    updateH1Data.mockResolvedValue({ data: { success: true } })
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.getByText(/El BCE no cotiza MAD/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cambio aplicado: 1 EUR = … MAD'), { target: { value: '10.8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(updateH1Data).toHaveBeenCalledWith('e1', expect.objectContaining({ appliedExchangeRate: '10.8' })))
  })

  test('con una divisa del BCE no pide cambio aplicado', async () => {
    getH1Requirements.mockResolvedValue(conIncoterm('CIF', { flete: false, seguro: false }, { invoiceCurrency: 'USD', invoiceCurrencyWithoutBce: false, appliedExchangeRate: null }))
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.queryByLabelText(/Cambio aplicado/)).not.toBeInTheDocument()
  })

  test('sin cambios no deja guardar', async () => {
    getH1Requirements.mockResolvedValue(respuesta())
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  test('avisa de que el servicio nuevo aún no está activado', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ servicio: 'precau' }))
    render(<H1DataCard expedition={{ _id: 'e1' }} />)

    expect(await screen.findByText(/se presenta todavía por el servicio anterior/)).toBeInTheDocument()
  })

  test('si la comprobación falla lo dice', async () => {
    getH1Requirements.mockRejectedValue({ response: { data: { error: 'Error al comprobar los datos del H1' } } })
    render(<H1DataCard expedition={{ _id: 'e1' }} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error al comprobar los datos del H1')
  })

  test('una declaración presentada por el servicio nuevo permite consultar su estado en la AEAT', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [] }))
    getH1Status.mockResolvedValue({ data: { data: {
      estado: { operacionRegistrada: '64', levante: 'P', pago: 'PL', circuito: 'N', fechaAdmision: '2026-11-12T10:57:04', fechaLevante: null, certificadosRequeridos: 'S',
        textos: { operacionRegistrada: 'Declaración completa activada', levante: 'Pendiente de despacho', pago: null, documentacionPendiente: 'Aduana de presentación' } },
      liquidacion: { totalAPagar: 3552 }, documentosSolicitados: [{ tipo: 'N380', descripcion: 'Factura comercial', partida: 1 }], notificaciones: [{ codigo: '1', texto: 'Aporte la factura' }]
    } } })
    render(<H1DataCard expedition={{ _id: 'e1', declaration: { mrn: '26ES002801I01BMDR0', aeatResponse: { servicio: 'CC415AV1' } } }} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Consultar estado en la AEAT' }))

    expect(await screen.findByText('Naranja (revisión documental)')).toBeInTheDocument()
    expect(getH1Status).toHaveBeenCalledWith('e1')
    expect(screen.getByText('12/11/2026 10:57')).toBeInTheDocument()
    expect(screen.getByText('Declaración completa activada (64)')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de despacho (P)')).toBeInTheDocument()
    // Un código que no está en la guía se muestra tal cual.
    expect(screen.getByText('PL')).toBeInTheDocument()
    expect(screen.getByText('Hay una solicitud de documentación pendiente (aduana de presentación).')).toBeInTheDocument()
    expect(screen.getByText('3.552,00 EUR')).toBeInTheDocument()
    expect(screen.getByText('La AEAT exige certificados de otros organismos.')).toBeInTheDocument()
    expect(screen.getByText('N380 — Factura comercial (partida 1)')).toBeInTheDocument()
    expect(screen.getByText('Aporte la factura')).toBeInTheDocument()
  })

  const presentada = { _id: 'e1', declaration: { mrn: '26ES002801I01BMVR2', aeatResponse: { servicio: 'CC415AV1', responseCode: '64' } } }

  test('una declaración activada no se anula desde aquí: dice que hay que pedírselo a la aduana', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false } }))
    render(<H1DataCard expedition={presentada} soloEstado />)

    fireEvent.click(await screen.findByRole('button', { name: 'Anular declaración' }))

    expect(await screen.findByText(/hay que solicitar la anulación a la aduana/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Motivo de la anulación')).not.toBeInTheDocument()
    expect(cancelH1).not.toHaveBeenCalled()
  })

  test('una predeclaración se anula tras confirmar y con motivo', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: true } }))
    cancelH1.mockResolvedValue({ data: { success: true, data: { tipo: 'anulada' } } })
    render(<H1DataCard expedition={presentada} soloEstado />)

    fireEvent.click(await screen.findByRole('button', { name: 'Anular declaración' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar anulación' })
    expect(confirmar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: 'Error en el número de bultos' } })
    fireEvent.click(confirmar)

    await waitFor(() => expect(cancelH1).toHaveBeenCalledWith('e1', 'Error en el número de bultos'))
    expect(await screen.findByText('La AEAT ha aceptado la anulación.')).toBeInTheDocument()
  })

  test('si la AEAT rechaza la anulación muestra su motivo', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: true } }))
    cancelH1.mockRejectedValue({ response: { status: 400, data: { success: false, error: '20001 La declaración tiene intención de control' } } })
    render(<H1DataCard expedition={presentada} soloEstado />)

    fireEvent.click(await screen.findByRole('button', { name: 'Anular declaración' }))
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: 'Duplicada por error' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(await screen.findByText(/20001 La declaración tiene intención de control/)).toBeInTheDocument()
  })

  test('cancelar el cuadro no envía nada', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: true } }))
    render(<H1DataCard expedition={presentada} soloEstado />)

    fireEvent.click(await screen.findByRole('button', { name: 'Anular declaración' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Motivo de la anulación')).not.toBeInTheDocument()
    expect(cancelH1).not.toHaveBeenCalled()
  })

  const comparacion = (cuadra, a00Aeat) => ({
    cuadra, totalLuci: 3534.8, totalAeat: 3534.8 + (a00Aeat - 1194.19), diferencia: Math.round((a00Aeat - 1194.19) * 100) / 100,
    partidas: [{ numero: 1, tributos: [
      { tipo: 'A00', luci: { base: 9951.55, cuota: 1194.19 }, aeat: { base: 9951.55, cuota: a00Aeat }, diferencia: Math.round((a00Aeat - 1194.19) * 100) / 100 },
      { tipo: 'B00', luci: { base: 11145.74, cuota: 2340.61 }, aeat: { base: 11145.74, cuota: 2340.61 }, diferencia: 0 }
    ] }]
  })
  const CERT = { requeridos: 'S', partidas: [{ numero: 1, organismos: [
    { organismo: 'SIF01', nombre: 'SOIVRE Mº Comercio', medidas: [{ medida: 'COM', documentos: ['1310', '1314'] }] },
    { organismo: 'SIF11', nombre: 'SOIVRE PUE', medidas: [{ medida: 'COM', documentos: ['1235'] }] }
  ] }] }

  test('muestra la liquidación de la AEAT junto a la de LUCI y dice que cuadra', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false },
      liquidacionAeat: { fuente: 'presentacion', comparacion: comparacion(true, 1194.19), certificados: CERT } }))
    render(<H1DataCard expedition={presentada} soloEstado />)

    const tabla = await screen.findByRole('table', { name: 'Liquidación de LUCI frente a la de la AEAT' })
    expect(tabla).toHaveTextContent('Arancel')
    expect(tabla).toHaveTextContent('IVA')
    expect(tabla).toHaveTextContent('1.194,19')
    expect(screen.getByText('La liquidación de la AEAT coincide al céntimo con la de LUCI.')).toBeInTheDocument()
  })

  test('señala la diferencia cuando no cuadra', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false },
      liquidacionAeat: { fuente: 'consulta', comparacion: comparacion(false, 1200), certificados: null } }))
    render(<H1DataCard expedition={presentada} soloEstado />)

    expect(await screen.findByText(/La AEAT liquida 5,81 EUR más que LUCI/)).toBeInTheDocument()
    // En la fila del arancel y en el total.
    expect(screen.getAllByText('+5,81')).toHaveLength(2)
  })

  test('lista los certificados que exige la AEAT por partida y organismo', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false },
      liquidacionAeat: { fuente: 'presentacion', comparacion: null, certificados: CERT } }))
    render(<H1DataCard expedition={presentada} soloEstado />)

    expect(await screen.findByText('Certificados que exige la AEAT')).toBeInTheDocument()
    expect(screen.getByText(/Partida 1 · SOIVRE Mº Comercio \(SIF01\): 1310, 1314/)).toBeInTheDocument()
    expect(screen.getByText(/Partida 1 · SOIVRE PUE \(SIF11\): 1235/)).toBeInTheDocument()
  })

  test('la consulta de estado actualiza la comparación', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false },
      liquidacionAeat: { fuente: 'presentacion', comparacion: comparacion(true, 1194.19), certificados: null } }))
    getH1Status.mockResolvedValue({ data: { data: { estado: { operacionRegistrada: '64', textos: {} },
      liquidacionAeat: { fuente: 'consulta', comparacion: comparacion(false, 1200), certificados: null } } } })
    render(<H1DataCard expedition={presentada} soloEstado />)
    await screen.findByText('La liquidación de la AEAT coincide al céntimo con la de LUCI.')

    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado en la AEAT' }))

    expect(await screen.findByText(/La AEAT liquida 5,81 EUR más que LUCI/)).toBeInTheDocument()
  })

  const PENDIENTE = { modo: 'Operador', numeroRegistro: '26ES009999I00270R1', pendiente: true, activadaEn: null }

  test('una predeclaración pendiente se activa tras confirmar y avisa al expediente', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: true }, predeclaracion: PENDIENTE }))
    activateH1.mockResolvedValue({ data: { success: true, data: { mrn: '26ES009999I00270R1', channel: 'yellow' } } })
    const onCambio = vi.fn()
    render(<H1DataCard expedition={presentada} soloEstado onCambio={onCambio} />)

    expect(await screen.findByText(/Predeclaración pendiente de activar · nº de registro 26ES009999I00270R1/)).toBeInTheDocument()
    expect(screen.getByText(/tipo de cambio del día de la activación/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Activar declaración' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }))

    await waitFor(() => expect(activateH1).toHaveBeenCalledWith('e1'))
    expect(await screen.findByText('La AEAT ha activado la declaración.')).toBeInTheDocument()
    expect(onCambio).toHaveBeenCalled()
  })

  test('si la AEAT rechaza la activación muestra su motivo', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: true }, predeclaracion: PENDIENTE }))
    activateH1.mockRejectedValue({ response: { data: { error: '80008 No existe el documento declarado' } } })
    render(<H1DataCard expedition={presentada} soloEstado />)

    fireEvent.click(await screen.findByRole('button', { name: 'Activar declaración' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }))

    expect(await screen.findByText(/80008 No existe el documento declarado/)).toBeInTheDocument()
  })

  test('una predeclaración que activa la aduana, o ya activada, no ofrece activar', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false },
      predeclaracion: { ...PENDIENTE, pendiente: false, activadaEn: '2026-11-13T07:57:09Z' } }))
    render(<H1DataCard expedition={presentada} soloEstado />)
    await screen.findByRole('button', { name: 'Anular declaración' })

    expect(screen.queryByRole('button', { name: 'Activar declaración' })).not.toBeInTheDocument()
  })

  test('sin MRN, o presentada por el DUA anterior, no ofrece la consulta', async () => {
    getH1Requirements.mockResolvedValue(respuesta())
    render(<H1DataCard expedition={{ _id: 'e1', declaration: { mrn: 'X', aeatResponse: {} } }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    expect(screen.queryByRole('button', { name: 'Consultar estado en la AEAT' })).not.toBeInTheDocument()
  })

  test('con la declaración ya presentada solo ofrece la consulta de estado', async () => {
    getH1Requirements.mockResolvedValue(respuesta())
    render(<H1DataCard soloEstado expedition={{ _id: 'e1', declaration: { mrn: '26ES002801I01BMNR0', aeatResponse: { servicio: 'CC415AV1' } } }} />)

    expect(await screen.findByRole('button', { name: 'Consultar estado en la AEAT' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Faltan datos para presentar el H1:')).not.toBeInTheDocument()
  })
  const AVISO = 'La aduana elegida (ES003001) no es la del recinto donde están las mercancías (ES002801): el H1 se presentará en ES002801. Presentarlo en otra aduana es despacho centralizado y exige la autorización C513 de la AEAT, que LUCI no gestiona.'
  const conAviso = (extra = {}) => respuesta({ avisos: [{ codigo: 'ADUANA_DISTINTA_DEL_RECINTO', elegida: 'ES003001', recinto: 'ES002801', texto: AVISO }], ...extra })

  test('avisa si la aduana elegida no es la del recinto, junto a lo que falta', async () => {
    getH1Requirements.mockResolvedValue(conAviso())
    render(<H1DataCard expedition={{ _id: 'e1' }} />)

    expect(await screen.findByText('Faltan datos para presentar el H1:')).toBeInTheDocument()
    const aviso = screen.getByText(AVISO)
    expect(aviso.closest('[role="status"]')).not.toBeNull()
  })

  test('el aviso también sale con el expediente listo y no impide presentar', async () => {
    getH1Requirements.mockResolvedValue(conAviso({ listo: true, faltan: [] }))
    render(<H1DataCard expedition={{ _id: 'e1' }} />)

    expect(await screen.findByText('El expediente tiene todos los datos que exige el H1.')).toBeInTheDocument()
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })

  test('sin avisos no muestra la caja', async () => {
    getH1Requirements.mockResolvedValue(respuesta({ avisos: [] }))
    render(<H1DataCard expedition={{ _id: 'e1' }} />)

    await screen.findByText('Faltan datos para presentar el H1:')
    expect(screen.queryByText(/no es la del recinto/)).not.toBeInTheDocument()
  })

  test('con soloEstado no muestra el aviso', async () => {
    getH1Requirements.mockResolvedValue(conAviso({ listo: true, faltan: [], anulacion: { presentada: true, anulable: false } }))
    render(<H1DataCard expedition={presentada} soloEstado />)

    expect(await screen.findByRole('button', { name: 'Consultar estado en la AEAT' })).toBeInTheDocument()
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })
})
