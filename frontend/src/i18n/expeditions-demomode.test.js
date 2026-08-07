import { describe, it, expect } from 'vitest'
import es from './locales/es.json'
import en from './locales/en.json'
import pt from './locales/pt.json'
import ca from './locales/ca.json'
import va from './locales/va.json'
import it_ from './locales/it.json'
import fr from './locales/fr.json'

// El botón "Enviar a AEAT" de la ficha del expediente hace un envío REAL a AEAT PRE
// (mismo aeatSubmitService.submitH1 -> aeatTransport.sendSoap mTLS que produjo un MRN real).
// El aviso bajo el botón (expeditions.demoMode) NO debe decir que "simula" el envío:
// eso engañaría al usuario haciéndole creer que es un test sin efecto, cuando genera un MRN real.
const locales = { es, en, pt, ca, va, it: it_, fr }

describe('i18n expeditions.demoMode — el envío es real a PRE, no simulado', () => {
  for (const lang of Object.keys(locales)) {
    it(`en "${lang}" no afirma que simula el envío`, () => {
      const texto = locales[lang].expeditions.demoMode
      expect(texto).toBeTruthy()
      // No debe contener ninguna forma de "simula" (es/pt/ca/va/it) ni "simulate" (en/fr).
      expect(texto.toLowerCase()).not.toMatch(/simul/)
    })

    it(`en "${lang}" indica que es el entorno de pruebas PRE`, () => {
      const texto = locales[lang].expeditions.demoMode
      expect(texto.toUpperCase()).toContain('PRE')
    })
  }
})
