import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Patricia (UAT 13/Nov/2026) pidio quitar la mencion al "codigo 1" de la nota
// de autodespacho de RepresentationCard (representation.selfNote): a una
// agente de aduanas no le aporta nada un codigo de casilla del DUA, y Luis
// confirmo que el autodespacho sigue siendo automatico (no se añade al
// desplegable). Este test comprueba que la explicacion en lenguaje llano
// sigue ahi pero sin ese codigo, en los 7 idiomas y en las dos carpetas que
// sirve la aplicacion (ver locales-servidos-sincronizados.test.js).
const IDIOMAS = ['es', 'ca', 'va', 'en', 'fr', 'it', 'pt']
const CARPETAS = ['./locales', '../../public/locales']

const sinTildes = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// "codigo 1" / "codi 1" / "code 1" / "codice 1": la palabra de "codigo" en
// cada idioma, seguida (con hasta dos palabras de hueco) del numero 1.
const MENCIONA_EL_CODIGO = /\bcod(?:igo|i|e|ice)\b(?:\s+\S+){0,2}\s*1\b/

describe('representation.selfNote ya no menciona el codigo de la casilla 14', () => {
  for (const carpeta of CARPETAS) {
    for (const idioma of IDIOMAS) {
      test(`${carpeta}/${idioma}.json`, () => {
        const contenido = JSON.parse(fs.readFileSync(path.resolve(__dirname, carpeta, `${idioma}.json`), 'utf8'))
        const nota = contenido.representation?.selfNote
        expect(typeof nota).toBe('string')
        expect(nota.length).toBeGreaterThan(0)
        expect(sinTildes(nota)).not.toMatch(MENCIONA_EL_CODIGO)
      })
    }
  }
})
