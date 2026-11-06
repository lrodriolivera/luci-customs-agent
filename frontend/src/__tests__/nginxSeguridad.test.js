import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const raiz = resolve(__dirname, '../..')
const conf = readFileSync(resolve(raiz, 'nginx.conf'), 'utf8')

// Cuerpo del bloque `location / { ... }` (las cabeceras van aquí, no en /api, para no duplicar las de helmet)
const bloqueRaiz = (conf.match(/location\s+\/\s*\{([\s\S]*?)\n\s*\}/) || [])[1] || ''
const cabecera = (nombre) => {
  const m = bloqueRaiz.match(new RegExp(`add_header\\s+${nombre}\\s+"([^"]*)"\\s+always\\s*;`, 'i'))
  return m ? m[1] : null
}
const directivas = (csp) =>
  Object.fromEntries(
    csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const [nombre, ...valores] = d.split(/\s+/)
      return [nombre, valores.join(' ')]
    })
  )

describe('nginx.conf: cabeceras de seguridad en location /', () => {
  const csp = cabecera('Content-Security-Policy')

  it('define Content-Security-Policy con always', () => {
    expect(csp).toBeTruthy()
  })

  it("script-src es exactamente 'self' (sin unsafe-inline ni unsafe-eval)", () => {
    expect(directivas(csp || '')['script-src']).toBe("'self'")
    expect(csp).not.toMatch(/unsafe-eval/)
  })

  it.each([
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['frame-ancestors', "'none'"],
    ['form-action', "'self'"],
  ])('%s es %s', (directiva, valor) => {
    expect(directivas(csp || '')[directiva]).toBe(valor)
  })

  it('define el resto de cabeceras', () => {
    expect(cabecera('Strict-Transport-Security')).toMatch(/max-age=\d+/)
    expect(cabecera('X-Content-Type-Options')).toBe('nosniff')
    expect(cabecera('Referrer-Policy')).toBeTruthy()
    expect(cabecera('Permissions-Policy')).toBeTruthy()
  })

  it('no añade cabeceras en /api ni a nivel server (las pone helmet)', () => {
    const fuera = conf.replace(bloqueRaiz, '')
    expect(fuera).not.toMatch(/add_header/i)
  })
})

const indexHtml = resolve(raiz, 'dist/index.html')
describe.skipIf(!existsSync(indexHtml))('dist/index.html', () => {
  const html = existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : ''

  it('no tiene <script> inline', () => {
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attrs, cuerpo]) => !/\bsrc\s*=/.test(attrs) || cuerpo.trim() !== '')
    expect(inline).toEqual([])
  })

  it('no tiene atributos on*=', () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=/i)
  })
})
