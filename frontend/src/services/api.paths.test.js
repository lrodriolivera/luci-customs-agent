import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Valor hostil: si llegara sin codificar a la ruta, el navegador lo normalizaría
// y la petición saldría del prefijo esperado hacia otro endpoint.
const HOSTIL = '../../x?'
const HOSTIL_CODIFICADO = '..%2F..%2Fx%3F'

let llamadas
let apiModule

beforeEach(async () => {
  llamadas = []
  const registrar = (metodo) =>
    vi.fn((url) => {
      llamadas.push({ metodo, url })
      return Promise.resolve({ data: {} })
    })
  const mockApi = Object.assign(vi.fn(), {
    get: registrar('get'),
    post: registrar('post'),
    put: registrar('put'),
    delete: registrar('delete'),
    patch: registrar('patch'),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
  })
  vi.doMock('axios', () => ({ default: { create: vi.fn(() => mockApi) } }))
  vi.doMock('@sentry/react', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }))
  vi.doMock('../i18n/i18n', () => ({ default: { language: 'es' } }))
  vi.doMock('./cognitoService', () => ({ isConfigured: vi.fn(), getAccessToken: vi.fn() }))
  apiModule = await import('./api.js')
})

afterEach(() => {
  vi.resetModules()
})

// Recorre todas las funciones exportadas (también las anidadas) y las llama con
// el valor hostil en todos los argumentos.
function recorrerFunciones(objeto, ruta = '') {
  const encontradas = []
  for (const [clave, valor] of Object.entries(objeto)) {
    const nombre = ruta ? `${ruta}.${clave}` : clave
    if (typeof valor === 'function') encontradas.push([nombre, valor])
    else if (valor && typeof valor === 'object') encontradas.push(...recorrerFunciones(valor, nombre))
  }
  return encontradas
}

describe('api.js — valores interpolados en la ruta', () => {
  it('ninguna llamada con valores hostiles sale de su prefijo ni cambia de ruta', async () => {
    const funciones = recorrerFunciones(
      Object.fromEntries(Object.entries(apiModule).filter(([k]) => k.endsWith('API')))
    )
    expect(funciones.length).toBeGreaterThan(200)

    const fallos = []
    for (const [nombre, fn] of funciones) {
      llamadas.length = 0
      try {
        await fn(HOSTIL, HOSTIL, HOSTIL, HOSTIL)
      } catch (_) {
        // Rechazar el valor (seg lanza) también es una respuesta segura.
        continue
      }
      for (const { url } of llamadas) {
        const sinQuery = url.split('?')[0]
        const tieneTraversal = /(^|\/)\.\.(\/|$)/.test(sinQuery)
        const consultaColada = /x\?/.test(url) // el "?" del valor hostil sin codificar
        if (tieneTraversal || consultaColada) fallos.push(`${nombre} -> ${url}`)
      }
    }
    expect(fallos).toEqual([])
  })

  it('el valor hostil se codifica en las rutas que el informe señala', async () => {
    const { aeatRealAPI, authAPI, portalAPI } = apiModule

    await aeatRealAPI.monitoring.refresh(HOSTIL, 'alias')
    await authAPI.resetPassword(HOSTIL, 'nueva')
    await aeatRealAPI.certificates.delete(HOSTIL)
    await aeatRealAPI.certificates.get(HOSTIL)
    await aeatRealAPI.certificates.verify(HOSTIL)
    await portalAPI.access(HOSTIL)

    const urls = llamadas.map((l) => l.url)
    expect(urls).toEqual([
      `/api/aeat-real/monitoring/${HOSTIL_CODIFICADO}/refresh`,
      `/api/auth/reset-password/${HOSTIL_CODIFICADO}`,
      `/api/aeat-real/certificates/${HOSTIL_CODIFICADO}`,
      `/api/aeat-real/certificates/${HOSTIL_CODIFICADO}`,
      `/api/aeat-real/certificates/${HOSTIL_CODIFICADO}/verify`,
      `/api/portal/${HOSTIL_CODIFICADO}`
    ])
  })

  it('un valor normal no cambia la URL', async () => {
    await apiModule.expeditionsAPI.get('abc123')
    expect(llamadas[0].url).toBe('/api/expeditions/abc123')
  })

  it('un id vacío o undefined falla en vez de pedir la colección', async () => {
    await expect(Promise.resolve().then(() => apiModule.expeditionsAPI.get(undefined))).rejects.toThrow()
    await expect(Promise.resolve().then(() => apiModule.expeditionsAPI.delete(''))).rejects.toThrow()
    expect(llamadas).toEqual([])
  })

  it('el código fuente no interpola nada en una ruta sin pasar por seg()', () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url))
    const fuente = fs.readFileSync(path.join(aqui, 'api.js'), 'utf8')
    const sinProteger = []
    for (const m of fuente.matchAll(/`\/api[^`]*`/g)) {
      for (const i of m[0].matchAll(/\$\{([^}]+)\}/g)) {
        const expr = i[1].trim()
        // Los sufijos de consulta con ternario no son valores de ruta.
        if (/^seg\(/.test(expr) || expr.includes('?')) continue
        sinProteger.push(expr)
      }
    }
    expect(sinProteger).toEqual([])
  })
})
