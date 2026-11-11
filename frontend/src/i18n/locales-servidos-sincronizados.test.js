import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// La aplicacion carga las traducciones de /locales/{lng}.json (public/locales),
// no de src/i18n/locales. Si una clave se anade solo en src, en produccion sale
// la clave en crudo (paso con groupage.aeatDiffers el 11/Nov/2026).
const IDIOMAS = ['es', 'ca', 'va', 'en', 'fr', 'it', 'pt']
const leer = (carpeta, idioma) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, carpeta, `${idioma}.json`), 'utf8'))

describe('traducciones servidas (public/locales)', () => {
  test.each(IDIOMAS)('%s: public/locales es igual que src/i18n/locales', (idioma) => {
    expect(leer('../../public/locales', idioma)).toEqual(leer('./locales', idioma))
  })
})
