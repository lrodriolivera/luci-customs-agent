import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mensajeErrorGeneracion, esErrorEoriFaltante } from './errorGeneracion'

const error422 = (quien, error) => ({ response: { status: 422, data: { success: false, code: 'EORI_FALTANTE', quien, error } } })

describe('mensajeErrorGeneracion', () => {
  test('EORI del representante: el mensaje del backend y un enlace a Ajustes > Aduanas', () => {
    const msg = mensajeErrorGeneracion(error422('representante', 'Falta el EORI del representante: configúralo en Ajustes > Aduanas'), 'Error')
    render(<p>{msg}</p>)
    expect(screen.getByText(/Falta el EORI del representante/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Ajustes > Aduanas' })).toHaveAttribute('href', '/settings')
  })

  test('EORI del cliente: mensaje sin enlace a Ajustes (se completa en la ficha del cliente)', () => {
    const msg = mensajeErrorGeneracion(error422('cliente', 'Falta el EORI del cliente: complétalo en la ficha del cliente'), 'Error')
    render(<p>{msg}</p>)
    expect(screen.getByText(/ficha del cliente/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('el texto del enlace usa la traduccion', () => {
    const msg = mensajeErrorGeneracion(error422('representante', 'x'), 'Error', (k) => k)
    render(<p>{msg}</p>)
    expect(screen.getByRole('link', { name: 'declarations.irAAjustesAduanas' })).toBeInTheDocument()
  })

  test('otros errores: texto del backend o el de respaldo', () => {
    expect(mensajeErrorGeneracion({ response: { status: 400, data: { error: 'Solo import' } } }, 'Error')).toBe('Solo import')
    expect(mensajeErrorGeneracion({ response: { status: 500, data: {} } }, 'Error al generar')).toBe('Error al generar')
    expect(mensajeErrorGeneracion(new Error('red'), 'Error al generar')).toBe('Error al generar')
  })

  test('un 422 sin codigo de EORI no es un error de EORI', () => {
    expect(esErrorEoriFaltante({ response: { status: 422, data: { code: 'OTRO' } } })).toBe(false)
  })
})
