import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

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
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es',
    supportedLngs: languages.map(l => l.code),
    load: 'languageOnly',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    backend: {
      loadPath: '/locales/{{lng}}.json'
    },
    react: {
      useSuspense: false
    }
  })

export default i18n
