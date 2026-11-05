import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { getE2ECredentials, getE2ECertPassword } = require('./env.js')

describe('e2e/env', () => {
  describe('getE2ECredentials', () => {
    it('devuelve email y password cuando E2E_USER y E2E_PASS están definidos', () => {
      const creds = getE2ECredentials({ E2E_USER: 'qa@example.test', E2E_PASS: 'p-de-prueba' })

      expect(creds).toEqual({ email: 'qa@example.test', password: 'p-de-prueba' })
    })

    it('lanza un error que nombra E2E_USER cuando falta', () => {
      expect(() => getE2ECredentials({ E2E_PASS: 'x' })).toThrow(/E2E_USER/)
    })

    it('lanza un error que nombra E2E_PASS cuando falta', () => {
      expect(() => getE2ECredentials({ E2E_USER: 'qa@example.test' })).toThrow(/E2E_PASS/)
    })

    it('nombra todas las variables que faltan en un único error', () => {
      expect(() => getE2ECredentials({})).toThrow(/E2E_USER.*E2E_PASS/s)
    })

    it('trata una variable vacía o solo con espacios como ausente', () => {
      expect(() => getE2ECredentials({ E2E_USER: '  ', E2E_PASS: '' })).toThrow(/E2E_USER/)
    })

    it('el error indica dónde configurar las variables y no incluye valores', () => {
      let message = ''
      try {
        getE2ECredentials({ E2E_USER: 'qa@example.test' })
      } catch (err) {
        message = err.message
      }

      expect(message).toMatch(/\.env\.example|README/)
      expect(message).not.toContain('qa@example.test')
    })
  })

  describe('getE2ECertPassword', () => {
    it('devuelve la frase de paso cuando E2E_CERT_PASSWORD está definida', () => {
      expect(getE2ECertPassword({ E2E_CERT_PASSWORD: 'frase-de-prueba' })).toBe('frase-de-prueba')
    })

    it('lanza un error que nombra E2E_CERT_PASSWORD cuando falta', () => {
      expect(() => getE2ECertPassword({})).toThrow(/E2E_CERT_PASSWORD/)
    })
  })

  describe('origen por defecto', () => {
    it('lee de process.env cuando no se pasa origen y no hay Cypress', () => {
      const previous = { user: process.env.E2E_USER, pass: process.env.E2E_PASS }
      process.env.E2E_USER = 'env@example.test'
      process.env.E2E_PASS = 'env-pass'
      try {
        expect(getE2ECredentials()).toEqual({ email: 'env@example.test', password: 'env-pass' })
      } finally {
        if (previous.user === undefined) delete process.env.E2E_USER
        else process.env.E2E_USER = previous.user
        if (previous.pass === undefined) delete process.env.E2E_PASS
        else process.env.E2E_PASS = previous.pass
      }
    })
  })
})
