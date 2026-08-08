/**
 * El resultado de control (IE143) no se podia registrar desde el producto.
 *
 * `POST /api/transit/:id/control` y `transitAPI.recordControl` existen desde
 * siempre, con CERO puntos de llamada en la UI. Consecuencia concreta hallada en
 * el E2E de 8/Ago/2026: `transitService.recordControlResult` es el UNICO sitio
 * de todo el codigo que asigna `transport.seals[].intactOnArrival`, el campo que
 * la ficha pinta en rojo como "ROTO" y del que depende la conformidad de
 * precintos del CC044. Sin este formulario ese campo no se podia rellenar
 * nunca: los precintos salian siempre como "sin comprobar" y el aviso de
 * discrepancia era inalcanzable en la practica.
 *
 * Ademas: un resultado A1 ("satisfactorio") sobre un precinto que el propio
 * operador acaba de marcar como roto es una contradiccion que se envia a la
 * aduana. Se avisa, sin bloquear: quien decide la calificacion es el actuario.
 */

import { describe, it, expect } from 'vitest'
import {
  TIPOS_CONTROL,
  tipoControl,
  implicaDiscrepancia,
  avisoResultadoIncoherente,
  construirPayloadControl
} from './transitControl'

describe('TIPOS_CONTROL: catalogo de resultados de control NCTS', () => {
  it('cubre los 7 codigos del enum del modelo, sin inventar ninguno', () => {
    expect(TIPOS_CONTROL.map((t) => t.codigo))
      .toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3'])
  })

  it('cada tipo dice que le pasa al transito, no solo como se llama', () => {
    TIPOS_CONTROL.forEach((t) => {
      expect(t.etiqueta).toBeTruthy()
      expect(t.consecuencia).toBeTruthy()
    })
  })

  it('tipoControl devuelve el catalogo por codigo y null si no existe', () => {
    expect(tipoControl('A4').etiqueta).toMatch(/significativa/i)
    expect(tipoControl('Z9')).toBeNull()
    expect(tipoControl(undefined)).toBeNull()
  })
})

describe('implicaDiscrepancia: que resultados dejan el transito en discrepancia', () => {
  // Misma regla que el backend (`recordControlResult`): A4 o cualquier B.
  it('A4 y los B llevan a discrepancia', () => {
    expect(implicaDiscrepancia('A4')).toBe(true)
    expect(implicaDiscrepancia('B1')).toBe(true)
    expect(implicaDiscrepancia('B2')).toBe(true)
    expect(implicaDiscrepancia('B3')).toBe(true)
  })

  it('A1, A2 y A3 no', () => {
    expect(implicaDiscrepancia('A1')).toBe(false)
    expect(implicaDiscrepancia('A2')).toBe(false)
    expect(implicaDiscrepancia('A3')).toBe(false)
  })

  it('sin tipo no afirma nada', () => {
    expect(implicaDiscrepancia(undefined)).toBe(false)
    expect(implicaDiscrepancia('')).toBe(false)
  })
})

describe('avisoResultadoIncoherente: un A1 sobre un precinto roto', () => {
  const rotos = [{ number: 'ES99887', intact: false }]

  it('avisa cuando se califica de satisfactorio con un precinto roto', () => {
    const aviso = avisoResultadoIncoherente('A1', rotos)
    expect(aviso).toMatch(/ES99887/)
    expect(aviso).toMatch(/satisfactorio/i)
  })

  it('nombra todos los precintos rotos', () => {
    const aviso = avisoResultadoIncoherente('A2', [
      { number: 'ES1', intact: false },
      { number: 'ES2', intact: false }
    ])
    expect(aviso).toMatch(/ES1/)
    expect(aviso).toMatch(/ES2/)
  })

  it('no avisa si el resultado ya recoge la discrepancia', () => {
    expect(avisoResultadoIncoherente('A3', rotos)).toBeNull()
    expect(avisoResultadoIncoherente('A4', rotos)).toBeNull()
    expect(avisoResultadoIncoherente('B1', rotos)).toBeNull()
  })

  it('no avisa si ningun precinto consta roto', () => {
    expect(avisoResultadoIncoherente('A1', [{ number: 'ES1', intact: true }])).toBeNull()
    expect(avisoResultadoIncoherente('A1', [])).toBeNull()
  })

  it('un precinto sin comprobar no cuenta como roto', () => {
    // `intact` undefined = el actuario no lo ha mirado. Acusar de incoherencia
    // sobre un campo vacio seria inventarse la contradiccion.
    expect(avisoResultadoIncoherente('A1', [{ number: 'ES1' }])).toBeNull()
  })
})

describe('construirPayloadControl: lo que se manda al IE143', () => {
  const formulario = {
    type: 'A2',
    officer: 'Actuario 12',
    observations: 'Revision documental',
    seals: [
      { number: 'ES1', intact: true },
      { number: 'ES2', intact: false }
    ]
  }

  it('manda el tipo, el actuario y las observaciones', () => {
    const p = construirPayloadControl(formulario)
    expect(p.type).toBe('A2')
    expect(p.officer).toBe('Actuario 12')
    expect(p.observations).toBe('Revision documental')
  })

  it('manda los precintos con `intact` booleano, que es lo que lee el backend', () => {
    // `recordControlResult` hace `seal.intactOnArrival = sealData.intact`: si se
    // manda undefined, sobrescribe con undefined un dato que quizas ya existia.
    const p = construirPayloadControl(formulario)
    expect(p.seals).toEqual([
      { number: 'ES1', intact: true },
      { number: 'ES2', intact: false }
    ])
  })

  it('descarta los precintos sin comprobar en lugar de mandarlos como intactos', () => {
    const p = construirPayloadControl({
      ...formulario,
      seals: [{ number: 'ES1', intact: true }, { number: 'ES2' }]
    })
    expect(p.seals).toEqual([{ number: 'ES1', intact: true }])
  })

  it('no manda la clave `seals` si no se comprobo ninguno', () => {
    const p = construirPayloadControl({ ...formulario, seals: [{ number: 'ES1' }] })
    expect(p.seals).toBeUndefined()
  })

  it('omite observaciones y actuario vacios en lugar de mandar cadenas vacias', () => {
    const p = construirPayloadControl({ type: 'A1', officer: '  ', observations: '', seals: [] })
    expect(p).toEqual({ type: 'A1' })
  })

  it('manda las discrepancias declaradas, ya filtradas', () => {
    const p = construirPayloadControl({
      type: 'A4',
      seals: [],
      discrepancies: [
        { itemNumber: 1, type: 'shortage', declared: '450', found: '400' },
        { itemNumber: 2, type: '', declared: '', found: '' }
      ]
    })
    expect(p.discrepancies).toEqual([
      { itemNumber: 1, type: 'shortage', declared: '450', found: '400' }
    ])
  })
})
