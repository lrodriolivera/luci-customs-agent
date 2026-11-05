import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let requestInterceptor
let responseInterceptor
let mockCognito

beforeEach(async () => {
  const mockApi = Object.assign(vi.fn(), {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn((ok, ko) => { requestInterceptor = { ok, ko } }) },
      response: { use: vi.fn((ok, ko) => { responseInterceptor = { ok, ko } }) }
    }
  })
  mockCognito = { isConfigured: vi.fn(() => true), getAccessToken: vi.fn(async () => 'token-cognito') }
  global.localStorage = { getItem: vi.fn(() => 'token-legacy'), setItem: vi.fn(), removeItem: vi.fn() }
  vi.doMock('axios', () => ({ default: { create: vi.fn(() => mockApi) } }))
  vi.doMock('@sentry/react', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }))
  vi.doMock('../i18n/i18n', () => ({ default: { language: 'es' } }))
  vi.doMock('./cognitoService', () => mockCognito)
  await import('./api.js')
})

afterEach(() => vi.resetModules())

describe('api.js — Authorization en llamadas públicas', () => {
  it.each([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password/abc',
    '/api/portal/abc/documents'
  ])('no adjunta Authorization en %s', async (url) => {
    const config = await requestInterceptor.ok({ headers: {}, method: 'post', url })
    expect(config.headers.Authorization).toBeUndefined()
    expect(mockCognito.getAccessToken).not.toHaveBeenCalled()
    expect(global.localStorage.getItem).not.toHaveBeenCalled()
  })

  it('sigue adjuntando Authorization en una ruta privada', async () => {
    const config = await requestInterceptor.ok({ headers: {}, method: 'get', url: '/api/expeditions/1' })
    expect(config.headers.Authorization).toBe('Bearer token-cognito')
  })

  it('un 401 en una ruta pública no reintenta con token ni redirige', async () => {
    const error = {
      response: { status: 401 },
      config: { url: '/api/auth/reset-password/abc', headers: {} }
    }
    await expect(responseInterceptor.ko(error)).rejects.toBe(error)
    expect(mockCognito.getAccessToken).not.toHaveBeenCalled()
    expect(error.config.headers.Authorization).toBeUndefined()
  })
})
