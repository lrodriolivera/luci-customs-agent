'use strict'

/**
 * Credenciales de los E2E (Cypress y Playwright).
 *
 * Única fuente de verdad: las specs NO llevan usuarios, contraseñas ni frases
 * de paso en el código. Se leen del entorno y, si falta algo, se aborta con un
 * error que dice qué variable definir (nunca imprime valores).
 *
 *   E2E_USER           email del usuario de pruebas
 *   E2E_PASS           contraseña del usuario de pruebas
 *   E2E_CERT_PASSWORD  frase de paso del .p12 de pruebas (solo specs de certificados)
 *
 * Ver frontend/.env.example y la sección "Tests E2E" de frontend/README.md.
 */

const HELP =
  'Defínelas en el entorno antes de lanzar los E2E (ver frontend/.env.example y frontend/README.md).'

/**
 * En Cypress las specs corren en el navegador y no ven process.env: allí las
 * variables llegan por Cypress.env() (cypress.config.js las copia del entorno).
 * Playwright y Node usan process.env.
 */
function defaultSource() {
  if (typeof Cypress !== 'undefined' && typeof Cypress.env === 'function') {
    return Cypress.env()
  }
  return process.env
}

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

function readRequired(names, source) {
  const missing = names.filter((name) => isMissing(source[name]))
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno para los E2E: ${missing.join(', ')}. ${HELP}`)
  }
  return names.map((name) => source[name])
}

/**
 * @param {Record<string, string | undefined>} [source]
 * @returns {{ email: string, password: string }}
 */
function getE2ECredentials(source = defaultSource()) {
  const [email, password] = readRequired(['E2E_USER', 'E2E_PASS'], source)
  return { email, password }
}

/**
 * @param {Record<string, string | undefined>} [source]
 * @returns {string}
 */
function getE2ECertPassword(source = defaultSource()) {
  const [certPassword] = readRequired(['E2E_CERT_PASSWORD'], source)
  return certPassword
}

module.exports = { getE2ECredentials, getE2ECertPassword }
