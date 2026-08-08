/**
 * MUI v7 eliminó la API `<Grid item xs={..} md={..}>` en favor de `<Grid size={{ xs, md }}>`.
 * Con la API vieja el Grid NO recibe ancho: los campos colapsan al mínimo del contenido
 * (bug real visto en /ens: "Aduana de Entrada" quedaba en 87px, ilegible e inusable, y
 * los filtros Estado/Modo en 46px).
 *
 * Este test bloquea la regresión leyendo el fuente: no hay forma fiable de medir anchos
 * de layout en JSDOM, y el fallo es exactamente "se usó la API obsoleta".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const DIR = dirname(fileURLToPath(import.meta.url))

const COMPONENTES = [
  'ENSDeclarationList.jsx',
  'ENSDeclarationForm.jsx',
  'ENSDeclarationDetail.jsx',
  'ENSBatchUpload.jsx'
]

describe('ENS: Grid usa la API de MUI v7 (size), no la de v5 (item xs=)', () => {
  for (const archivo of COMPONENTES) {
    it(`${archivo} no usa <Grid item ...>`, () => {
      const fuente = readFileSync(join(DIR, archivo), 'utf8')
      const obsoletos = fuente.match(/<Grid\s+item[\s>]/g) || []
      expect(obsoletos).toHaveLength(0)
    })

    it(`${archivo}: todo Grid no-container declara size`, () => {
      const fuente = readFileSync(join(DIR, archivo), 'utf8')
      // Cada apertura de <Grid ...> hasta el primer '>' que no sea parte de una expresión
      const aperturas = fuente.match(/<Grid\b[^>]*>/g) || []
      const sinTamano = aperturas.filter(
        (tag) => !tag.includes('container') && !tag.includes('size=')
      )
      expect(sinTamano).toEqual([])
    })
  }
})
