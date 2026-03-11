import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import es from './locales/es.json'
import ca from './locales/ca.json'
import va from './locales/va.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import pt from './locales/pt.json'

export const languages = [
  { code: 'es', name: 'Espanol', flag: 'ES' },
  { code: 'ca', name: 'Catala', flag: 'CA' },
  { code: 'va', name: 'Valencia', flag: 'VA' },
  { code: 'en', name: 'English', flag: 'GB' },
  { code: 'fr', name: 'Francais', flag: 'FR' },
  { code: 'it', name: 'Italiano', flag: 'IT' },
  { code: 'pt', name: 'Portugues', flag: 'PT' }
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      ca: { translation: ca },
      va: { translation: va },
      en: { translation: en },
      fr: { translation: fr },
      it: { translation: it },
      pt: { translation: pt }
    },
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  })

export default i18n
