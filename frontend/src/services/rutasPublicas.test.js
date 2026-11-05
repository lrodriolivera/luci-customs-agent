import { describe, it, expect } from 'vitest'
import { esRutaPublica } from './rutasPublicas'

describe('esRutaPublica', () => {
  it.each([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password/tok123',
    '/api/portal/tok123',
    '/api/portal/tok123/documents',
    '/api/portal/tok123/ai/chat?x=1'
  ])('%s es pública', (url) => {
    expect(esRutaPublica(url)).toBe(true)
  })

  it.each([
    '/api/portal/api-keys',
    '/api/portal/api-keys/abc',
    '/api/portal/api-keys/abc?x=1',
    '/api/auth/me',
    '/api/expeditions/1',
    '/api/tenant/billing/cancel',
    '/api/auth/login-extra/secret',
    '/api/portalx/1',
    '/api/aeat-real/portal/1',
    '',
    undefined
  ])('%s NO es pública', (url) => {
    expect(esRutaPublica(url)).toBe(false)
  })
})
