import { describe, it, expect } from 'vitest'
import { ADUANAS_DESPACHO } from './aduanasDespacho'

describe('ADUANAS_DESPACHO (lista oficial de aduanas)', () => {
  it('codigos ES00 + 4 cifras y sin repetir', () => {
    const codigos = ADUANAS_DESPACHO.map(a => a.code)
    expect(new Set(codigos).size).toBe(codigos.length)
    codigos.forEach(c => expect(c).toMatch(/^ES00\d{4}$/))
  })

  it('Madrid aeropuerto (ES002801, recinto de PRE) va primero', () => {
    expect(ADUANAS_DESPACHO[0]).toEqual({ code: 'ES002801', name: 'Madrid - Aeropuerto' })
  })

  it('los codigos de la lista oficial llevan su nombre correcto', () => {
    const nombre = Object.fromEntries(ADUANAS_DESPACHO.map(a => [a.code, a.name]))
    expect(nombre.ES004601).toBe('Valencia - Aeropuerto')
    expect(nombre.ES004611).toBe('Valencia - Marítima')
    expect(nombre.ES001131).toMatch(/^Algeciras - Marítima/)
    expect(nombre.ES000811).toMatch(/^Barcelona - Marítima/)
  })

  it('no quedan los codigos equivocados de la lista anterior', () => {
    const codigos = ADUANAS_DESPACHO.map(a => a.code)
    for (const malo of ['ES003001', 'ES003601', 'ES000301', 'ES001101']) {
      expect(codigos).not.toContain(malo)
    }
  })
})
