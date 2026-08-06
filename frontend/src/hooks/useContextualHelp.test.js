import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import useContextualHelp from './useContextualHelp'

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(),
  }
})

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
  }),
}))

// Mock getHelpContent
vi.mock('../data/helpContent', () => ({
  default: vi.fn(),
}))

describe('useContextualHelp', () => {
  let mockUseLocation, mockGetHelpContent

  beforeEach(async () => {
    const { useLocation } = await import('react-router-dom')
    mockUseLocation = useLocation

    const getHelpContent = await import('../data/helpContent')
    mockGetHelpContent = getHelpContent.default
  })

  it('should initialize with isOpen false', () => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': { title: 'Dashboard' } })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.isOpen).toBe(false)
  })

  it('should return exact match help data for pathname', () => {
    const helpData = { title: 'Dashboard', description: 'Dashboard help' }
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': helpData })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(helpData)
  })

  it('should return exact match for nested route', () => {
    const helpData = { title: 'Expeditions', description: 'Expeditions help' }
    mockUseLocation.mockReturnValue({ pathname: '/expeditions' })
    mockGetHelpContent.mockReturnValue({
      '/': { title: 'Dashboard' },
      '/expeditions': helpData,
    })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(helpData)
  })

  it('should fallback to parent route for dynamic segments', () => {
    const expeditionsHelp = { title: 'Expeditions', description: 'Expeditions help' }
    mockUseLocation.mockReturnValue({ pathname: '/expeditions/abc123' })
    mockGetHelpContent.mockReturnValue({
      '/': { title: 'Dashboard' },
      '/expeditions': expeditionsHelp,
    })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(expeditionsHelp)
  })

  it('should traverse multiple levels to find parent route', () => {
    const declarationsHelp = { title: 'Declarations', description: 'Declarations help' }
    mockUseLocation.mockReturnValue({ pathname: '/declarations/123/edit' })
    mockGetHelpContent.mockReturnValue({
      '/': { title: 'Dashboard' },
      '/declarations': declarationsHelp,
    })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(declarationsHelp)
  })

  it('should fallback to dashboard (/) when no match found', () => {
    const dashboardHelp = { title: 'Dashboard', description: 'Dashboard help' }
    mockUseLocation.mockReturnValue({ pathname: '/nonexistent/route' })
    mockGetHelpContent.mockReturnValue({
      '/': dashboardHelp,
      '/expeditions': { title: 'Expeditions' },
    })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(dashboardHelp)
  })

  it('should return null when no dashboard fallback exists', () => {
    mockUseLocation.mockReturnValue({ pathname: '/nonexistent/route' })
    mockGetHelpContent.mockReturnValue({
      '/expeditions': { title: 'Expeditions' },
    })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toBeNull()
  })

  it('should update helpData when pathname changes', () => {
    const dashboardHelp = { title: 'Dashboard' }
    const expeditionsHelp = { title: 'Expeditions' }

    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({
      '/': dashboardHelp,
      '/expeditions': expeditionsHelp,
    })

    const { result, rerender } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(dashboardHelp)

    // Simulate pathname change
    mockUseLocation.mockReturnValue({ pathname: '/expeditions' })
    rerender()

    expect(result.current.helpData).toEqual(expeditionsHelp)
  })

  // Note: Testing language change would require dynamically changing the i18n.language mock,
  // which is complex in Vitest. The dependency on i18n.language is verified by the useMemo
  // dependency array in the source code, and React's useMemo behavior is well-tested by React itself.

  it('should open help panel when open is called', () => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': { title: 'Dashboard' } })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.open()
    })

    expect(result.current.isOpen).toBe(true)
  })

  it('should close help panel when close is called', () => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': { title: 'Dashboard' } })

    const { result } = renderHook(() => useContextualHelp())

    act(() => {
      result.current.open()
    })

    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.close()
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('should toggle open/close state correctly', () => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': { title: 'Dashboard' } })

    const { result } = renderHook(() => useContextualHelp())

    // Initially closed
    expect(result.current.isOpen).toBe(false)

    // Open
    act(() => {
      result.current.open()
    })
    expect(result.current.isOpen).toBe(true)

    // Close
    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)

    // Open again
    act(() => {
      result.current.open()
    })
    expect(result.current.isOpen).toBe(true)
  })

  it('should handle pathname with trailing slash', () => {
    const expeditionsHelp = { title: 'Expeditions' }
    mockUseLocation.mockReturnValue({ pathname: '/expeditions/' })
    mockGetHelpContent.mockReturnValue({
      '/': { title: 'Dashboard' },
      '/expeditions': expeditionsHelp,
    })

    const { result } = renderHook(() => useContextualHelp())

    // The split filter(Boolean) removes empty strings from trailing slashes
    expect(result.current.helpData).toEqual(expeditionsHelp)
  })

  it('should handle deeply nested routes with multiple segments', () => {
    const h7Help = { title: 'H7 Declarations' }
    mockUseLocation.mockReturnValue({ pathname: '/declarations/h7/123/details/edit' })
    mockGetHelpContent.mockReturnValue({
      '/': { title: 'Dashboard' },
      '/declarations': { title: 'Declarations' },
      '/declarations/h7': h7Help,
    })

    const { result } = renderHook(() => useContextualHelp())

    // Should match /declarations/h7
    expect(result.current.helpData).toEqual(h7Help)
  })

  it('should return correct help data with intermediate parent missing', () => {
    const classificationsHelp = { title: 'Classifications' }
    // Missing /classifications/products, going directly to /classifications
    mockUseLocation.mockReturnValue({ pathname: '/classifications/products/123' })
    mockGetHelpContent.mockReturnValue({
      '/': { title: 'Dashboard' },
      '/classifications': classificationsHelp,
    })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(classificationsHelp)
  })

  it('should handle root path correctly', () => {
    const dashboardHelp = { title: 'Dashboard', description: 'Main dashboard' }
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': dashboardHelp })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current.helpData).toEqual(dashboardHelp)
  })

  it('should memoize helpData correctly based on pathname and language', () => {
    const dashboardHelp = { title: 'Dashboard' }
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': dashboardHelp })

    const { result, rerender } = renderHook(() => useContextualHelp())

    const firstHelpData = result.current.helpData

    // Rerender without changing dependencies
    rerender()

    // Should be the same reference (memoized)
    expect(result.current.helpData).toBe(firstHelpData)
  })

  it('should return all hook properties', () => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
    mockGetHelpContent.mockReturnValue({ '/': { title: 'Dashboard' } })

    const { result } = renderHook(() => useContextualHelp())

    expect(result.current).toHaveProperty('isOpen')
    expect(result.current).toHaveProperty('open')
    expect(result.current).toHaveProperty('close')
    expect(result.current).toHaveProperty('helpData')
    expect(typeof result.current.open).toBe('function')
    expect(typeof result.current.close).toBe('function')
  })
})
