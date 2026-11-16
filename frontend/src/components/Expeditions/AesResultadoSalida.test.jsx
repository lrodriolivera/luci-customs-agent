import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AesResultadoSalida from './AesResultadoSalida'

const conDeclaracion = (declaration) => ({ declaration: { type: 'AES', mrn: '26ES002801100319B6', officeOfExit: 'ES002801', ...declaration } })

describe('AesResultadoSalida', () => {
  test('salida confirmada: fecha, aduana de salida y resultado', () => {
    render(<AesResultadoSalida expedition={conDeclaracion({
      exitConfirmedAt: '2026-11-16T00:00:00.000Z',
      aesSalida: { estado: 'SA', final: true, aduanaSalida: 'ES002801', salida: { confirmada: true, fecha: '2026-11-16', resultado: 'A2', resultadoTexto: 'Resultado automático considerado conforme' } },
      aesAvisos: [{ id: '1', tipo: 'CSALID', texto: 'Resultado de la salida', estadoAES: 'SA', fecha: '2026-11-16' }]
    })} />)
    const bloque = screen.getByRole('region', { name: 'Salida de la UE' })
    expect(bloque).toHaveTextContent('Salida confirmada')
    expect(bloque).toHaveTextContent('16/11/2026')
    expect(bloque).toHaveTextContent('ES002801')
    expect(bloque).toHaveTextContent('Resultado automático considerado conforme')
    expect(screen.getByRole('listitem')).toHaveTextContent('Resultado de la salida')
  })

  test('salida parada: fecha de parada y motivo de la disconformidad', () => {
    render(<AesResultadoSalida expedition={conDeclaracion({
      aesSalida: { estado: 'ST', final: true, salida: { confirmada: false, parada: true, fechaParada: '2026-11-16', resultadoTexto: 'Resultado disconforme' },
        disconformidad: { aduana: 'salida', motivo: 'No hay apenas kilos.' } }
    })} />)
    const bloque = screen.getByRole('region', { name: 'Salida de la UE' })
    expect(bloque).toHaveTextContent('Salida parada')
    expect(bloque).toHaveTextContent('16/11/2026')
    expect(bloque).toHaveTextContent('No hay apenas kilos.')
  })

  test('sin aviso todavía: pendiente, con la aduana de salida declarada', () => {
    render(<AesResultadoSalida expedition={conDeclaracion({})} />)
    const bloque = screen.getByRole('region', { name: 'Salida de la UE' })
    expect(bloque).toHaveTextContent('Pendiente de que la AEAT confirme la salida')
    expect(bloque).toHaveTextContent('ES002801')
  })

  test('levante en salida recibido: estado intermedio', () => {
    render(<AesResultadoSalida expedition={conDeclaracion({
      aesSalida: { estado: 'PS', estadoTexto: 'Con levante en la aduana de salida, pendiente de salida', levanteSalida: { fecha: '2026-11-16', csv: 'DBGZ6TBAS32GJ76E' } }
    })} />)
    expect(screen.getByRole('region', { name: 'Salida de la UE' })).toHaveTextContent('Con levante en la aduana de salida')
  })

  test('no se pinta si no es un AES presentado', () => {
    const { container: a } = render(<AesResultadoSalida expedition={{ declaration: { type: 'H1', mrn: 'X' } }} />)
    expect(a).toBeEmptyDOMElement()
    const { container: b } = render(<AesResultadoSalida expedition={{ declaration: { type: 'AES' } }} />)
    expect(b).toBeEmptyDOMElement()
  })
})
