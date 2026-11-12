import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getH1Requirements = vi.fn()
const updateH1Data = vi.fn()
const getH1Status = vi.fn()
vi.mock('../../services/api', () => ({
  declarationsAPI: { getH1Requirements: (...a) => getH1Requirements(...a), updateH1Data: (...a) => updateH1Data(...a), getH1Status: (...a) => getH1Status(...a) }
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
})
