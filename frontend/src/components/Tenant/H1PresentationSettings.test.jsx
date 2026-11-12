import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const get = vi.fn()
const update = vi.fn()
vi.mock('../../services/api', () => ({ tenantH1API: { get: (...a) => get(...a), update: (...a) => update(...a) } }))

import H1PresentationSettings from './H1PresentationSettings'

const GUARDADO = { h1Service: 'precau', medioDePago: 'A', garantiaGRN: '', contacto: { name: 'Ana Ruiz', phone: '', email: 'aduanas@agencia.es' } }

describe('<H1PresentationSettings />', () => {
  beforeEach(() => {
    get.mockReset()
    update.mockReset()
    get.mockResolvedValue({ data: { data: GUARDADO } })
  })

  test('carga la configuración guardada', async () => {
    render(<H1PresentationSettings />)

    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Ruiz'))
    expect(screen.getByLabelText('Servicio de la AEAT')).toHaveValue('precau')
    expect(screen.getByLabelText('Medio de pago')).toHaveValue('A')
  })

  test('guarda el servicio, el pago, la garantía y el contacto', async () => {
    const nuevo = { h1Service: 'cau', medioDePago: 'R', garantiaGRN: '26ESAGL2800000054', contacto: { name: 'Ana Ruiz', phone: '+34 910000000', email: 'aduanas@agencia.es' } }
    update.mockResolvedValue({ data: { data: nuevo } })
    render(<H1PresentationSettings />)
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Ruiz'))

    fireEvent.change(screen.getByLabelText('Servicio de la AEAT'), { target: { value: 'cau' } })
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'R' } })
    fireEvent.change(screen.getByLabelText('Número de garantía (GRN) *'), { target: { value: '26ESAGL2800000054' } })
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '+34 910000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar presentación del H1' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(nuevo))
    expect(await screen.findByRole('status')).toHaveTextContent('Configuración del H1 guardada')
  })

  test('con pago aplazado la garantía pasa a ser obligatoria', async () => {
    render(<H1PresentationSettings />)
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Ruiz'))

    expect(screen.getByLabelText('Número de garantía (GRN)')).not.toBeRequired()
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'R' } })
    expect(screen.getByLabelText('Número de garantía (GRN) *')).toBeRequired()
  })

  test('muestra el error del servidor', async () => {
    update.mockRejectedValue({ response: { data: { error: 'El pago aplazado (R) exige un número de garantía (GRN)' } } })
    render(<H1PresentationSettings />)
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Ruiz'))

    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '+34 910000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar presentación del H1' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('exige un número de garantía')
  })
})
