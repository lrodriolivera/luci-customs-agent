import { describe, it, expect } from 'vitest'
import { esUrlSegura, hrefSeguro } from './url'

describe('esUrlSegura', () => {
  it.each([
    'https://strixai.ai/docs/a.pdf',
    'http://example.com/x',
    '/expeditions/123',
    'docs/a.pdf',
    '//cdn.example.com/a.pdf'
  ])('%s es segura', (url) => {
    expect(esUrlSegura(url)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://x/1',
    '',
    '   ',
    null,
    undefined,
    42,
    {}
  ])('%j NO es segura', (url) => {
    expect(esUrlSegura(url)).toBe(false)
  })
})

describe('hrefSeguro', () => {
  it('devuelve la URL si es segura y undefined si no', () => {
    expect(hrefSeguro('https://a.b/c')).toBe('https://a.b/c')
    expect(hrefSeguro('javascript:alert(1)')).toBeUndefined()
    expect(hrefSeguro(undefined)).toBeUndefined()
  })
})
