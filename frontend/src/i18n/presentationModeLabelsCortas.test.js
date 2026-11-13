import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// El selector "Como se presenta" (ModoPresentacionH1.jsx) va en una columna
// estrecha: las etiquetas largas ("Declaración: se activa al presentarla",
// "Predeclaración: la activa la aduana cuando la sumaria esté activa"...) se
// cortaban. Se acortan en los 7 idiomas y en las dos carpetas que sirve la
// aplicacion (ver locales-servidos-sincronizados.test.js), manteniendo el
// aviso (presentationModeHint) intacto.
const IDIOMAS = ['es', 'ca', 'va', 'en', 'fr', 'it', 'pt']
const CARPETAS = ['./locales', '../../public/locales']
const LARGO_MAXIMO = 40

describe('expeditions.presentationMode* son etiquetas cortas', () => {
  for (const carpeta of CARPETAS) {
    for (const idioma of IDIOMAS) {
      test(`${carpeta}/${idioma}.json`, () => {
        const contenido = JSON.parse(fs.readFileSync(path.resolve(__dirname, carpeta, `${idioma}.json`), 'utf8'))
        const { presentationModeDeclaration, presentationModeCustoms, presentationModeOperator, presentationModeHint } = contenido.expeditions

        expect(presentationModeDeclaration.length).toBeLessThanOrEqual(LARGO_MAXIMO)
        expect(presentationModeCustoms.length).toBeLessThanOrEqual(LARGO_MAXIMO)
        expect(presentationModeOperator.length).toBeLessThanOrEqual(LARGO_MAXIMO)
        // El aviso no se toca.
        expect(presentationModeHint.length).toBeGreaterThan(LARGO_MAXIMO)
      })
    }
  }
})
