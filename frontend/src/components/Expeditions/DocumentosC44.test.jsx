import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import DocumentosC44 from './DocumentosC44'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))

const SUGERENCIAS = [
  { tipo: '1310', descripcion: 'SOIVRE Mº Comercio (COM)', fuente: 'aeat' },
  { tipo: 'C990', descripcion: 'Autorización de destino final', medida: '117-SUSSH', fuente: 'arancel' },
  { tipo: 'Y081', descripcion: 'No existe identificador normalizado', medida: '107-LVC', fuente: 'arancel' }
]

const pintar = (props = {}) => {
  const onSave = vi.fn()
  render(<DocumentosC44 documentos={[]} sugerencias={SUGERENCIAS} onSave={onSave} {...props} />)
  return onSave
}

describe('DocumentosC44', () => {
  test('lista los documentos de la partida y permite quitar uno', () => {
    const onSave = pintar({ documentos: [{ tipo: 'N003', referencia: 'CAL-1' }, { tipo: 'Y081' }] })

    const lista = screen.getByRole('list', { name: 'expeditions.c44.current' })
    expect(within(lista).getByText('N003')).toBeInTheDocument()
    expect(within(lista).getByText('CAL-1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'expeditions.c44.remove:{"tipo":"N003"}' }))
    expect(onSave).toHaveBeenCalledWith([{ tipo: 'Y081' }])
  })

  test('una sugerencia rellena el código; se añade con su número', () => {
    const onSave = pintar()

    fireEvent.click(screen.getByRole('button', { name: /1310/ }))
    expect(screen.getByLabelText('expeditions.c44.code')).toHaveValue('1310')
    fireEvent.change(screen.getByLabelText('expeditions.c44.reference'), { target: { value: ' ES-SOIVRE-123 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.c44.add' }))

    expect(onSave).toHaveBeenCalledWith([{ tipo: '1310', referencia: 'ES-SOIVRE-123' }])
  })

  test('las autorizaciones (C990) no se ofrecen como documento de la partida', () => {
    pintar()
    expect(screen.queryByRole('button', { name: /C990/ })).not.toBeInTheDocument()
  })

  test('un código Y se añade sin número; uno que no es Y exige número', () => {
    const onSave = pintar()

    fireEvent.change(screen.getByLabelText('expeditions.c44.code'), { target: { value: 'n003' } })
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.c44.add' }))
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.c44.referenceRequired')
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Y081/ }))
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.c44.add' }))
    expect(onSave).toHaveBeenCalledWith([{ tipo: 'Y081', medida: '107-LVC' }])
  })

  test('un código mal formado no se añade', () => {
    const onSave = pintar()
    fireEvent.change(screen.getByLabelText('expeditions.c44.code'), { target: { value: 'C9' } })
    fireEvent.click(screen.getByRole('button', { name: 'expeditions.c44.add' }))
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.c44.codeInvalid')
    expect(onSave).not.toHaveBeenCalled()
  })

  test('sin onSave (solo lectura) no muestra el formulario', () => {
    render(<DocumentosC44 documentos={[{ tipo: 'N003', referencia: 'CAL-1' }]} sugerencias={SUGERENCIAS} />)
    expect(screen.queryByRole('button', { name: 'expeditions.c44.add' })).not.toBeInTheDocument()
    expect(screen.getByText('N003')).toBeInTheDocument()
  })
})
