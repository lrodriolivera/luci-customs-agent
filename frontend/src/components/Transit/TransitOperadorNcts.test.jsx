import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  accionesNctsOperador,
  cambiosModificacion,
  ubicacionValida,
  FormularioPresentacion,
  FormularioModificacion,
  FormularioAnulacion
} from './TransitOperadorNcts'
import { transitAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  transitAPI: { presentGoods: vi.fn(), amend: vi.fn(), invalidate: vi.fn() }
}))

const predeclaracion = (extra = {}) => ({
  _id: 'p1', mrn: '26ES002801501441J7', lrn: 'LRN1', status: 'prelodged',
  locationAuthorisationNumber: '2801AAAAAA', destinationOffice: { code: 'ES002901' },
  goodsItems: [{ description: 'Ropa de cama', taricCode: '6302100000', grossWeight: 25, netWeight: 20, packages: { count: 2 } }],
  ncts: { estado: 'PA' },
  ...extra
})

describe('accionesNctsOperador: estados de la guía NCTS6 (tabla 4.3)', () => {
  test('en predeclaración (PA): presentar, modificar y anular', () => {
    expect(accionesNctsOperador(predeclaracion()).map((a) => a.form)).toEqual(['cc170', 'cc013', 'cc014'])
  })

  test('aceptada pendiente de garantía extranjera (PG): solo anular', () => {
    expect(accionesNctsOperador({ status: 'accepted', ncts: { estado: 'PG' } }).map((a) => a.form)).toEqual(['cc014'])
  })

  test('aceptada despachada (DE) o en borrador: ninguna', () => {
    expect(accionesNctsOperador({ status: 'accepted', ncts: { estado: 'DE' } })).toEqual([])
    expect(accionesNctsOperador({ status: 'accepted' })).toEqual([])
    expect(accionesNctsOperador({ status: 'draft' })).toEqual([])
  })
})

describe('utilidades', () => {
  test('ubicación: 10 caracteres, recinto 4 + ubicación 6', () => {
    expect(ubicacionValida('2801AAAAAA')).toBe(true)
    expect(ubicacionValida(' 2801aaaaac ')).toBe(true)
    expect(ubicacionValida('2801')).toBe(false)
  })

  test('cambiosModificacion solo manda lo que cambia', () => {
    const t = predeclaracion()
    expect(cambiosModificacion(t, { destino: 'ES002901', partidas: [{ description: 'Ropa de cama', grossWeight: '25', netWeight: '20', packages: '2' }] })).toEqual({})
    const c = cambiosModificacion(t, { destino: 'ES002901', partidas: [{ description: 'Ropa de cama', grossWeight: '24', netWeight: '20', packages: '2' }] })
    expect(c.goodsItems[0]).toMatchObject({ description: 'Ropa de cama', taricCode: '6302100000', grossWeight: 24, packages: { count: 2 } })
    expect(c.destinationOffice).toBeUndefined()
  })
})

describe('<FormularioPresentacion /> (CC170C)', () => {
  beforeEach(() => vi.clearAllMocks())

  test('envía la ubicación y avisa de lo que implica', async () => {
    transitAPI.presentGoods.mockResolvedValue({ data: { success: true } })
    const onHecho = vi.fn()
    render(<FormularioPresentacion transit={predeclaracion()} onClose={() => {}} onHecho={onHecho} />)
    expect(screen.getByText(/data la sumaria/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Ubicación de la mercancía/i), { target: { value: '2801AAAAAC' } })
    fireEvent.click(screen.getByRole('button', { name: /Presentar mercancía/i }))
    await waitFor(() => expect(transitAPI.presentGoods).toHaveBeenCalledWith('p1', { locationAuthorisationNumber: '2801AAAAAC' }))
    await waitFor(() => expect(onHecho).toHaveBeenCalled())
  })

  test('una ubicación mal formada no se envía', async () => {
    render(<FormularioPresentacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Ubicación de la mercancía/i), { target: { value: '2801' } })
    fireEvent.click(screen.getByRole('button', { name: /Presentar mercancía/i }))
    expect(await screen.findByText(/10 caracteres/i)).toBeInTheDocument()
    expect(transitAPI.presentGoods).not.toHaveBeenCalled()
  })

  test('el rechazo de la AEAT se muestra', async () => {
    transitAPI.presentGoods.mockRejectedValue({ response: { data: { error: 'ADDS_Partida_1_Ubicación incorrecta' } } })
    render(<FormularioPresentacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Presentar mercancía/i }))
    expect(await screen.findByText(/Ubicación incorrecta/)).toBeInTheDocument()
  })
})

describe('<FormularioModificacion /> (CC013C)', () => {
  beforeEach(() => vi.clearAllMocks())

  test('manda la partida modificada', async () => {
    transitAPI.amend.mockResolvedValue({ data: { success: true } })
    const onHecho = vi.fn()
    render(<FormularioModificacion transit={predeclaracion()} onClose={() => {}} onHecho={onHecho} />)
    fireEvent.change(screen.getByLabelText(/Descripción partida 1/i), { target: { value: 'Ropa de cama modificada' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar modificación/i }))
    await waitFor(() => expect(transitAPI.amend).toHaveBeenCalled())
    const [id, cambios] = transitAPI.amend.mock.calls[0]
    expect(id).toBe('p1')
    expect(cambios.goodsItems[0].description).toBe('Ropa de cama modificada')
    await waitFor(() => expect(onHecho).toHaveBeenCalled())
  })

  test('sin cambios no se envía nada', async () => {
    render(<FormularioModificacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Enviar modificación/i }))
    expect(await screen.findByText(/No ha cambiado nada/i)).toBeInTheDocument()
    expect(transitAPI.amend).not.toHaveBeenCalled()
  })

  test('una descripción vacía o un destino mal formado no se envían', async () => {
    render(<FormularioModificacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Descripción partida 1/i), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar modificación/i }))
    expect(await screen.findByText(/no puede quedar vacía/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Descripción partida 1/i), { target: { value: 'Ropa' } })
    fireEvent.change(screen.getByLabelText(/Aduana de destino/i), { target: { value: 'ES29' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar modificación/i }))
    expect(await screen.findByText(/8 caracteres/i)).toBeInTheDocument()
    expect(transitAPI.amend).not.toHaveBeenCalled()
  })

  test('explica qué no se puede modificar', () => {
    render(<FormularioModificacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    expect(screen.getByText(/aduana de partida, el titular/i)).toBeInTheDocument()
  })
})

describe('<FormularioAnulacion /> (CC014C)', () => {
  beforeEach(() => vi.clearAllMocks())

  const rellenar = (motivo = 'Error en la declaración') => {
    fireEvent.change(screen.getByLabelText(/Motivo de la anulación/i), { target: { value: motivo } })
  }

  test('exige motivo y confirmación explícita antes de anular', async () => {
    render(<FormularioAnulacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    const boton = screen.getByRole('button', { name: /Anular en la AEAT/i })
    expect(boton).toBeDisabled()
    rellenar()
    expect(boton).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/definitiva/i))
    expect(boton).not.toBeDisabled()
  })

  test('anula con el motivo', async () => {
    transitAPI.invalidate.mockResolvedValue({ data: { success: true } })
    const onHecho = vi.fn()
    render(<FormularioAnulacion transit={predeclaracion()} onClose={() => {}} onHecho={onHecho} />)
    rellenar('  Mercancía no sale  ')
    fireEvent.click(screen.getByLabelText(/definitiva/i))
    fireEvent.click(screen.getByRole('button', { name: /Anular en la AEAT/i }))
    await waitFor(() => expect(transitAPI.invalidate).toHaveBeenCalledWith('p1', { motivo: 'Mercancía no sale' }))
    await waitFor(() => expect(onHecho).toHaveBeenCalled())
  })

  test('el motivo no pasa de 512 caracteres', () => {
    render(<FormularioAnulacion transit={predeclaracion()} onClose={() => {}} onHecho={() => {}} />)
    expect(screen.getByLabelText(/Motivo de la anulación/i)).toHaveAttribute('maxLength', '512')
  })

  test('el foco va al motivo, Escape cierra y no se puede cerrar con el envío en vuelo', async () => {
    let resolver
    transitAPI.invalidate.mockReturnValue(new Promise((r) => { resolver = r }))
    const onClose = vi.fn()
    render(<FormularioAnulacion transit={predeclaracion()} onClose={onClose} onHecho={() => {}} />)
    expect(screen.getByRole('dialog', { name: /Anular tránsito/i })).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText(/Motivo de la anulación/i))
    rellenar()
    fireEvent.click(screen.getByLabelText(/definitiva/i))
    fireEvent.click(screen.getByRole('button', { name: /Anular en la AEAT/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Cancelar/i })).toBeDisabled())
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }))
    expect(onClose).not.toHaveBeenCalled()
    resolver({ data: { success: true } })
    await waitFor(() => expect(screen.getByRole('button', { name: /Cancelar/i })).not.toBeDisabled())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  test('un error se muestra y no cierra', async () => {
    transitAPI.invalidate.mockRejectedValue({ response: { data: { error: 'Estado del tránsito incorrecto' } } })
    const onHecho = vi.fn()
    render(<FormularioAnulacion transit={predeclaracion()} onClose={() => {}} onHecho={onHecho} />)
    rellenar()
    fireEvent.click(screen.getByLabelText(/definitiva/i))
    fireEvent.click(screen.getByRole('button', { name: /Anular en la AEAT/i }))
    expect(await screen.findByText(/Estado del tránsito incorrecto/)).toBeInTheDocument()
    expect(onHecho).not.toHaveBeenCalled()
  })
})

describe('colores de los botones: sobreviven al purge de Tailwind', () => {
  test('cada color de accionesNctsOperador esta en el safelist (bg-100, text-800, hover:bg-200)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const config = fs.readFileSync(path.resolve(__dirname, '../../../tailwind.config.js'), 'utf8')
    const colores = [...accionesNctsOperador(predeclaracion()), ...accionesNctsOperador({ status: 'accepted', ncts: { estado: 'PG' } })].map((a) => a.color)
    const faltan = colores.flatMap((c) => [`bg-${c}-100`, `text-${c}-800`, `hover:bg-${c}-200`]).filter((cl) => !config.includes(`'${cl}'`))
    expect(faltan).toEqual([])
  })
})
