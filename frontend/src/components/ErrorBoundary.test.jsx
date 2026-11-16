import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary, { esErrorDeCargaDeVersion } from './ErrorBoundary'

vi.mock('@sentry/react', () => ({ captureException: vi.fn(() => 'id') }))
vi.mock('../i18n/i18n', () => ({ default: { t: (k) => k } }))

function Explota({ mensaje }) {
  throw new Error(mensaje)
}

describe('ErrorBoundary', () => {
  let recargar
  beforeEach(() => {
    sessionStorage.clear()
    recargar = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload: recargar }, writable: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  test.each([
    'Failed to fetch dynamically imported module: https://aduanas.strixai.ai/assets/Classification-abc123.js',
    'Importing a module script failed.',
    "'text/html' is not a valid JavaScript MIME type.",
    'Loading chunk 12 failed.'
  ])('reconoce un fallo de carga tras un despliegue: %s', (mensaje) => {
    expect(esErrorDeCargaDeVersion(new Error(mensaje))).toBe(true)
  })

  test('un error normal no es de carga de versión', () => {
    expect(esErrorDeCargaDeVersion(new Error('Objects are not valid as a React child'))).toBe(false)
  })

  test('tras un despliegue recarga la página una vez en lugar de mostrar el error', () => {
    render(<ErrorBoundary><Explota mensaje="Failed to fetch dynamically imported module: /assets/x.js" /></ErrorBoundary>)
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  test('si ya recargó hace poco no entra en bucle: muestra el error', () => {
    sessionStorage.setItem('luci-recarga-version', String(Date.now()))
    render(<ErrorBoundary><Explota mensaje="Failed to fetch dynamically imported module: /assets/x.js" /></ErrorBoundary>)
    expect(recargar).not.toHaveBeenCalled()
    expect(screen.getByText('errorBoundary.title')).toBeInTheDocument()
  })

  test('un error normal muestra la pantalla de error sin recargar', () => {
    render(<ErrorBoundary><Explota mensaje="boom" /></ErrorBoundary>)
    expect(recargar).not.toHaveBeenCalled()
    expect(screen.getByText('errorBoundary.title')).toBeInTheDocument()
  })
})
