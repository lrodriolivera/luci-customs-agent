import { describe, it, expect } from 'vitest'
import { navGroups } from './MainLayout'

/**
 * navGroups define el menú lateral real que ve el usuario. "Consultas ADDS"
 * (/queries) no tiene ninguna integración real contra AEAT detrás —
 * summaryQueryService está documentado como modo DEMO, siempre fabrica
 * resultados con Math.random() sin tocar la red. Se oculta del menú para que
 * nadie (la agente de aduanas probando el lunes, o un cliente futuro) llegue
 * ahí pensando que es un dato real.
 */
describe('navGroups', () => {
  it('no incluye un enlace a Consultas ADDS (/queries) mientras no haya integración real', () => {
    const todosLosPaths = navGroups.flatMap(g => g.items.map(i => i.path))
    expect(todosLosPaths).not.toContain('/queries')
  })
})
