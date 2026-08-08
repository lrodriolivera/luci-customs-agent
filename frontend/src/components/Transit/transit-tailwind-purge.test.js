import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * E2E 8/Ago: TransitManager compone clases de color al vuelo
 * (`bg-${typeConfig.color}-100`, `text-${statusConfig.color}-800`,
 * `hover:bg-${action.color}-200`). El purge de Tailwind solo conserva las clases
 * que encuentra COMO TEXTO LITERAL en el fuente, asi que las que ningun otro
 * componente usaba desaparecieron del CSS de produccion: el tipo T2F (teal) salia
 * sin color, el estado "Entregado" (lime) sin chip y el boton "Liberar
 * Mercancias" sin fondo ni color de texto. No hay error de compilacion ni de
 * consola: el elemento simplemente se pinta en blanco.
 *
 * Este test exige que cada combinacion color x variante que el componente puede
 * generar este declarada en el `safelist` de tailwind.config.js.
 */
const DIR = path.resolve(__dirname, '../../..')
const FUENTE = fs.readFileSync(path.join(__dirname, 'TransitManager.jsx'), 'utf8')
const CONFIG = fs.readFileSync(path.join(DIR, 'tailwind.config.js'), 'utf8')

/** Extrae los `color: 'x'` de un objeto de configuracion del componente. */
function coloresDe(nombreBloque) {
  const inicio = FUENTE.indexOf(nombreBloque)
  if (inicio === -1) throw new Error(`No se encuentra ${nombreBloque} en TransitManager.jsx`)
  const bloque = FUENTE.slice(inicio, FUENTE.indexOf('\n}', inicio))
  return [...new Set([...bloque.matchAll(/color:\s*'([a-z]+)'/g)].map(m => m[1]))]
}

// Variantes que el JSX construye para cada familia (ver las plantillas del fuente).
const VARIANTES = {
  'const TRANSIT_TYPES': ['bg-C-50', 'border-C-200', 'bg-C-100', 'text-C-600', 'text-C-800'],
  'const STATUS_CONFIG': ['bg-C-100', 'text-C-800'],
  'const getNextActions': ['bg-C-100', 'text-C-800', 'hover:bg-C-200']
}

describe('TransitManager: las clases de color dinamicas sobreviven al purge', () => {
  it('el fuente sigue componiendo clases con interpolacion (guarda del test)', () => {
    expect(FUENTE).toMatch(/\$\{(typeConfig|statusConfig|action|config)\.color\}/)
  })

  for (const [bloque, plantillas] of Object.entries(VARIANTES)) {
    it(`las clases de ${bloque} estan en el safelist de tailwind.config.js`, () => {
      const faltan = coloresDe(bloque)
        .flatMap(color => plantillas.map(p => p.replace('C', color)))
        .filter(clase => !CONFIG.includes(`'${clase}'`) && !CONFIG.includes(`"${clase}"`))
      expect(faltan).toEqual([])
    })
  }
})
