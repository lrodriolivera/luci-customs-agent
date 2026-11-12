import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getH1Requirements = vi.fn()
const updateH1Data = vi.fn()
vi.mock('../../services/api', () => ({
  declarationsAPI: { getH1Requirements: (...a) => getH1Requirements(...a), updateH1Data: (...a) => updateH1Data(...a) }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import H1DataCard from './H1DataCard'

const respuesta = (extra = {}) => ({
  data: { data: {
    servicio: 'cau', listo: false, faltan: ['número de la factura comercial', 'nacionalidad del medio de transporte en frontera'],
    datos: { invoiceNumber: '', vehicleNationality: '', dispatchAuthorizationScope: 'OSRE' }, ...extra
  } }
})

describe('<H1DataCard />', () => {
  beforeEach(() => {
    getH1Requirements.mockReset()
    updateH1Data.mockReset()
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
      .mockResolvedValueOnce(respuesta({ listo: true, faltan: [], datos: { invoiceNumber: 'FAC-1', vehicleNationality: 'PA', dispatchAuthorizationScope: 'global' } }))
    updateH1Data.mockResolvedValue({ data: { success: true } })
    render(<H1DataCard expedition={{ _id: 'e1' }} />)
    await screen.findByText('Faltan datos para presentar el H1:')

    fireEvent.change(screen.getByLabelText('Número de la factura comercial'), { target: { value: 'FAC-1' } })
    fireEvent.change(screen.getByLabelText('Nacionalidad del medio de transporte en frontera'), { target: { value: 'PA' } })
    fireEvent.change(screen.getByLabelText('Autorización de despacho del representante'), { target: { value: 'global' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(updateH1Data).toHaveBeenCalledWith('e1', { invoiceNumber: 'FAC-1', vehicleNationality: 'PA', dispatchAuthorizationScope: 'global' }))
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
})
