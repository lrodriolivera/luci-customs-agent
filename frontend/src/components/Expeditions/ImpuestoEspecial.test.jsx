import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ImpuestoEspecial, { opcionesImpuestoEspecial } from './ImpuestoEspecial'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))

const DATOS = { medidas: [
  { codigo: 'IA3-IC.A3', tipo: 'nacional', descripcion: 'IC.Ep.2. Cerveza grado plato < 11', derecho: '7,480 EUR / HL' },
  { codigo: 'VIM-VETIM', tipo: 'nacional', descripcion: 'Control veterinario' },
  { codigo: 'IVA-IVA', tipo: 'iva', derecho: '21,000%' }
] }
const OPCIONES = opcionesImpuestoEspecial(DATOS)

describe('ImpuestoEspecial', () => {
  test('opciones: solo las medidas I.., con epígrafe y unidad', () => {
    expect(OPCIONES).toEqual([{ medida: 'IA3', epigrafe: '0A3', descripcion: 'IC.Ep.2. Cerveza grado plato < 11', derecho: '7,480 EUR / HL', unidad: 'HL' }])
  })

  test('sin impuesto ni opciones no pinta nada', () => {
    const { container } = render(<ImpuestoEspecial opciones={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('avisa de que hay que declararlo y guarda epígrafe y cantidad', () => {
    const onSave = vi.fn()
    render(<ImpuestoEspecial opciones={OPCIONES} onSave={onSave} />)
    expect(screen.getByRole('status')).toHaveTextContent('expeditions.excise.required')

    fireEvent.change(screen.getByLabelText('expeditions.excise.measure'), { target: { value: 'IA3' } })
    fireEvent.change(screen.getByLabelText('expeditions.excise.quantity:{"unidad":"HL"}'), { target: { value: '8,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.excise.save' }))
    expect(onSave).toHaveBeenCalledWith({ medida: 'IA3', cantidad: 8.5 })
  })

  test('pide epígrafe y cantidad', () => {
    const onSave = vi.fn()
    render(<ImpuestoEspecial opciones={OPCIONES} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.excise.save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.excise.chooseMeasure')
    fireEvent.change(screen.getByLabelText('expeditions.excise.measure'), { target: { value: 'IA3' } })
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.excise.save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.excise.quantityRequired')
    expect(onSave).not.toHaveBeenCalled()
  })

  test('muestra el declarado con su cuota y permite quitarlo', () => {
    const onRemove = vi.fn()
    render(<ImpuestoEspecial impuesto={{ epigrafe: '0A3', clave: '0', descripcion: 'Cerveza', tipo: 7.48, cantidad: 8, unidadAeat: 'HL' }} opciones={OPCIONES} onSave={vi.fn()} onRemove={onRemove} />)
    expect(screen.getByText('0A30')).toBeInTheDocument()
    expect(screen.getByText('8 HL × 7,48 € = 59,84 €')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.excise.remove' }))
    expect(onRemove).toHaveBeenCalled()
  })
})
