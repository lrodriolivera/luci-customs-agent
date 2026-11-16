import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FaltanParaPresentar from './FaltanParaPresentar'

describe('FaltanParaPresentar', () => {
  test('lista cada dato que falta con dónde se completa', () => {
    render(<FaltanParaPresentar
      tipo="AES"
      faltan={['aduana de salida (expediente › declaración AES)', 'número de la factura comercial (expediente › número de factura)']}
      onCerrar={() => {}}
    />)
    expect(screen.getByRole('alert')).toHaveTextContent('Faltan datos para presentar el AES')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('aduana de salida')
    expect(items[0]).toHaveTextContent('expediente › declaración AES')
  })

  test('sin lista no pinta nada', () => {
    const { container } = render(<FaltanParaPresentar tipo="AES" faltan={[]} onCerrar={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('el botón cierra el aviso', () => {
    const onCerrar = vi.fn()
    render(<FaltanParaPresentar tipo="H1" faltan={['incoterm (expediente › incoterm)']} onCerrar={onCerrar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onCerrar).toHaveBeenCalled()
  })
})
