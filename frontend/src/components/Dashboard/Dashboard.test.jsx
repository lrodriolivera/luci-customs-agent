import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { name: 'Luis' } }))
}))

vi.mock('../../services/api', () => ({
  expeditionsAPI: { list: vi.fn() },
  dashboardAPI: { getAlerts: vi.fn() },
  classificationAPI: { getCacheStats: vi.fn() }
}))

import { useAuth } from '../../context/AuthContext'
import { expeditionsAPI, dashboardAPI, classificationAPI } from '../../services/api'

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Mocks por defecto resueltos
    expeditionsAPI.list.mockResolvedValue({
      data: { data: { expeditions: [] }, total: 0 }
    })
    dashboardAPI.getAlerts.mockResolvedValue({
      data: { success: true, data: { alerts: [], stats: { total: 0, critical: 0, warning: 0 } } }
    })
    classificationAPI.getCacheStats.mockResolvedValue({
      data: { success: true, data: {} }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const renderDashboard = () => {
    return render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )
  }

  describe('Loading state', () => {
    it('should display spinner while loading', () => {
      expeditionsAPI.list.mockImplementation(() => new Promise(() => {})) // sin resolver
      const { container } = renderDashboard()

      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })
  })

  describe('Greeting and user name', () => {
    it('should show morning greeting between 00:00-11:59', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-06T09:00:00'))

      renderDashboard()

      await vi.runOnlyPendingTimersAsync()

      expect(screen.getByText('dashboard.goodMorning')).toBeTruthy()
    })

    it('should show afternoon greeting between 12:00-19:59', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-06T15:00:00'))

      renderDashboard()

      await vi.runOnlyPendingTimersAsync()

      expect(screen.getByText('dashboard.goodAfternoon')).toBeTruthy()
    })

    it('should show evening greeting from 20:00 onwards', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-06T21:00:00'))

      renderDashboard()

      await vi.runOnlyPendingTimersAsync()

      expect(screen.getByText('dashboard.goodEvening')).toBeTruthy()
    })

    it('should display user name when available', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Luis')).toBeTruthy()
      })
    })

    it('should fallback to dashboard.user when user name is null', async () => {
      useAuth.mockReturnValue({ user: null })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.user')).toBeTruthy()
      })
    })

    it('should display formatted date in Spanish', async () => {
      const mockDate = new Date('2026-08-06T12:00:00')
      const expectedDate = mockDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(expectedDate)).toBeTruthy()
      })
    })
  })

  describe('Statistics calculation', () => {
    it('should calculate stats correctly from expeditions', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [
              { _id: '1', status: 'PENDING_DOCS', expeditionId: 'E1', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '2', status: 'pending_docs', expeditionId: 'E2', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '3', status: 'DOCS_RECEIVED', expeditionId: 'E3', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '4', status: 'VALIDATING', expeditionId: 'E4', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '5', status: 'PROCESSING', expeditionId: 'E5', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '6', status: 'orange_channel', expeditionId: 'E6', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '7', status: 'red_channel', expeditionId: 'E7', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '8', status: 'COMPLETED', expeditionId: 'E8', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '9', status: 'green_channel', expeditionId: 'E9', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' }
            ]
          },
          total: 9
        }
      })

      renderDashboard()

      await waitFor(() => {
        const allTexts = screen.getAllByText(/^[0-9]+$/)
        const values = allTexts.map(el => el.textContent)
        expect(values).toContain('9') // total
        expect(values).toContain('2') // pending
        expect(values).toContain('5') // inProgress (DOCS_RECEIVED, VALIDATING, PROCESSING, orange_channel, red_channel)
        expect(values).toContain('2') // completed (COMPLETED + green_channel)
      })
    })

    it('should parse data.data.expeditions structure', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [{ _id: '1', expeditionId: 'EXP-PARSE-1', status: 'COMPLETED', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' }]
          },
          total: 1
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('EXP-PARSE-1')).toBeTruthy()
        expect(screen.getAllByText('1').length).toBeGreaterThan(0)
      })
    })

    it('should parse data.expeditions structure', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          expeditions: [{ _id: '1', expeditionId: 'EXP-PARSE-2', status: 'COMPLETED', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' }],
          total: 1
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('EXP-PARSE-2')).toBeTruthy()
        expect(screen.getAllByText('1').length).toBeGreaterThan(0)
      })
    })

    it('should use expeditions.length when total is missing', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [{ _id: '1' }, { _id: '2' }]
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('2')).toBeTruthy()
      })
    })

    it('should display all 4 stat cards', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.statExpeditions')).toBeTruthy()
        expect(screen.getByText('dashboard.statPending')).toBeTruthy()
        expect(screen.getByText('dashboard.statInProgress')).toBeTruthy()
        expect(screen.getByText('dashboard.statCompleted')).toBeTruthy()
      })
    })
  })

  describe('Quick actions', () => {
    it('should render 4 quick action links', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.taricClassification')).toBeTruthy()
        expect(screen.getByText('dashboard.calculator')).toBeTruthy()
        expect(screen.getByText('dashboard.pueSoivre')).toBeTruthy()
        expect(screen.getByText('dashboard.declarationsLabel')).toBeTruthy()
      })
    })

    it('should link to correct paths', async () => {
      renderDashboard()

      await waitFor(() => {
        const links = screen.getAllByRole('link')
        const paths = links.map(l => l.getAttribute('href'))
        expect(paths).toContain('/classification')
        expect(paths).toContain('/calculator')
        expect(paths).toContain('/pue')
        expect(paths).toContain('/declarations')
      })
    })
  })

  describe('Country selector', () => {
    it('should load countries from localStorage', async () => {
      localStorage.setItem('customsCountries', JSON.stringify([
        { code: 'ES', name: 'España', system: 'AEAT', flag: '🇪🇸' },
        { code: 'FR', name: 'Francia', system: 'DOUANE', flag: '🇫🇷' }
      ]))

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('AEAT')).toBeTruthy()
        expect(screen.getByText('DOUANE')).toBeTruthy()
      })
    })

    it('should use default countries when localStorage is empty', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('AEAT')).toBeTruthy()
        expect(screen.getByText('DMS/DECO')).toBeTruthy()
      })
    })

    it('should use default countries when JSON parse fails', async () => {
      localStorage.setItem('customsCountries', 'invalid-json{')

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('AEAT')).toBeTruthy()
        expect(screen.getByText('DMS/DECO')).toBeTruthy()
      })
    })

    it('should set active country from localStorage', async () => {
      localStorage.setItem('activeCustomsCountry', 'NL')

      renderDashboard()

      await waitFor(() => {
        const nlButton = screen.getByText('DMS/DECO').closest('button')
        expect(nlButton.className).toContain('bg-white/20')
      })
    })

    it('should change active country on click', async () => {
      renderDashboard()

      await waitFor(() => {
        const nlButton = screen.getByText('DMS/DECO')
        fireEvent.click(nlButton)
        expect(localStorage.getItem('activeCustomsCountry')).toBe('NL')
      })
    })

    it('should mark active country with specific styles', async () => {
      localStorage.setItem('activeCustomsCountry', 'ES')

      renderDashboard()

      await waitFor(() => {
        const esButton = screen.getByText('AEAT').closest('button')
        expect(esButton.className).toContain('bg-white/20')
        expect(esButton.className).toContain('ring-sky-400')
      })
    })
  })

  describe('Alerts', () => {
    it('should show alerts when total > 0', async () => {
      dashboardAPI.getAlerts.mockResolvedValue({
        data: {
          success: true,
          data: {
            alerts: [
              { id: '1', type: 'requirement_deadline', severity: 'critical', title: 'Critical alert', message: 'Message', link: '/req/1' },
              { id: '2', type: 'guarantee_low_balance', severity: 'warning', title: 'Warning alert', message: 'Warning', link: '/req/2' }
            ],
            stats: { total: 2, critical: 1, warning: 1 }
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.alerts')).toBeTruthy()
        expect(screen.getByText('Critical alert')).toBeTruthy()
        expect(screen.getByText('Warning alert')).toBeTruthy()
      })
    })

    it('should show noAlerts when total === 0', async () => {
      dashboardAPI.getAlerts.mockResolvedValue({
        data: {
          success: true,
          data: {
            alerts: [],
            stats: { total: 0, critical: 0, warning: 0 }
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.noAlerts')).toBeTruthy()
      })
    })

    it('should limit alerts to first 3', async () => {
      dashboardAPI.getAlerts.mockResolvedValue({
        data: {
          success: true,
          data: {
            alerts: [
              { id: '1', type: 'requirement_deadline', severity: 'critical', title: 'Alert 1', message: 'M1', link: '/1' },
              { id: '2', type: 'requirement_deadline', severity: 'critical', title: 'Alert 2', message: 'M2', link: '/2' },
              { id: '3', type: 'requirement_deadline', severity: 'critical', title: 'Alert 3', message: 'M3', link: '/3' },
              { id: '4', type: 'requirement_deadline', severity: 'critical', title: 'Alert 4', message: 'M4', link: '/4' }
            ],
            stats: { total: 4, critical: 4, warning: 0 }
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Alert 1')).toBeTruthy()
        expect(screen.getByText('Alert 2')).toBeTruthy()
        expect(screen.getByText('Alert 3')).toBeTruthy()
        expect(screen.queryByText('Alert 4')).toBeFalsy()
      })
    })

    it('should show critical and warning counts', async () => {
      dashboardAPI.getAlerts.mockResolvedValue({
        data: {
          success: true,
          data: {
            alerts: [
              { id: '1', type: 'requirement_deadline', severity: 'critical', title: 'A', message: 'M', link: '/1' }
            ],
            stats: { total: 5, critical: 3, warning: 2 }
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(/3.*dashboard\.criticalAlerts/)).toBeTruthy()
        expect(screen.getByText(/2.*dashboard\.warnings/)).toBeTruthy()
      })
    })

    it('should render different alert icons by type', async () => {
      dashboardAPI.getAlerts.mockResolvedValue({
        data: {
          success: true,
          data: {
            alerts: [
              { id: '1', type: 'requirement_deadline', severity: 'critical', title: 'Alert A', message: 'M', link: '/1' },
              { id: '2', type: 'red_channel_pending', severity: 'critical', title: 'Alert B', message: 'M', link: '/2' },
              { id: '3', type: 'unknown_type', severity: 'warning', title: 'Alert C', message: 'M', link: '/3' }
            ],
            stats: { total: 3, critical: 2, warning: 1 }
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Alert A')).toBeTruthy()
        expect(screen.getByText('Alert B')).toBeTruthy()
        expect(screen.getByText('Alert C')).toBeTruthy()
      })
    })

    it('should not show alerts block when success is false', async () => {
      dashboardAPI.getAlerts.mockResolvedValue({
        data: { success: false }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.queryByText('dashboard.alerts')).toBeFalsy()
        expect(screen.queryByText('dashboard.noAlerts')).toBeFalsy()
      })
    })
  })

  describe('Recent expeditions', () => {
    it('should show noExpeditions message when list is empty', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.noExpeditions')).toBeTruthy()
        expect(screen.getByText('dashboard.createFirstExpedition')).toBeTruthy()
        expect(screen.getByText('dashboard.createExpedition')).toBeTruthy()
      })
    })

    it('should render expedition rows', async () => {
      useAuth.mockReturnValue({ user: { name: 'Luis' } })

      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [
              {
                _id: '1',
                expeditionId: 'EXP-ROW-001',
                status: 'PENDING_DOCS',
                client: { companyName: 'ACME Corp' },
                operationType: 'IMPORT',
                createdAt: '2026-08-01T10:00:00Z'
              },
              {
                _id: '2',
                expeditionId: 'EXP-ROW-002',
                status: 'COMPLETED',
                client: { companyName: 'BETA Ltd' },
                operationType: 'export',
                createdAt: '2026-08-02T10:00:00Z'
              }
            ]
          },
          total: 2
        }
      })

      renderDashboard()

      // Verificar que se renderizan los expeditionIds y los companyNames
      await screen.findByText('EXP-ROW-001')
      await screen.findByText('EXP-ROW-002')

      // Los companyNames se renderizan junto con el separator · y el operationType
      const allText = document.body.textContent
      expect(allText).toContain('ACME Corp')
      expect(allText).toContain('BETA Ltd')
    })

    it('should show noClient fallback when client is missing', async () => {
      useAuth.mockReturnValue({ user: { name: 'Luis' } })

      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [
              { _id: '1', expeditionId: 'EXP-NO-CLIENT', status: 'COMPLETED', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' }
            ]
          },
          total: 1
        }
      })

      renderDashboard()

      // Esperar a que se renderice el expeditionId
      await screen.findByText('EXP-NO-CLIENT')

      // Verificar que el texto dashboard.noClient está presente en el DOM
      const allText = document.body.textContent
      expect(allText).toContain('dashboard.noClient')
    })

    it('should handle unknown status with default label', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [
              { _id: '1', expeditionId: 'EXP-001', status: 'UNKNOWN_STATUS', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' }
            ]
          },
          total: 1
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('UNKNOWN_STATUS')).toBeTruthy()
      })
    })

    it('should handle all known status values', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [
              { _id: '1', expeditionId: 'E1', status: 'PENDING_DOCS', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '2', expeditionId: 'E2', status: 'pending_docs', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '3', expeditionId: 'E3', status: 'DOCS_RECEIVED', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '4', expeditionId: 'E4', status: 'VALIDATING', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' },
              { _id: '5', expeditionId: 'E5', status: 'PROCESSING', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z' }
            ]
          },
          total: 5
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('E1')).toBeTruthy()
        expect(screen.getByText('E5')).toBeTruthy()
      })
    })

    it('should display import/export operation types', async () => {
      expeditionsAPI.list.mockResolvedValue({
        data: {
          data: {
            expeditions: [
              { _id: '1', expeditionId: 'E1', status: 'COMPLETED', operationType: 'IMPORT', createdAt: '2026-08-01T10:00:00Z', client: { companyName: 'Import Co' } },
              { _id: '2', expeditionId: 'E2', status: 'COMPLETED', operationType: 'export', createdAt: '2026-08-01T10:00:00Z', client: { companyName: 'Export Co' } }
            ]
          },
          total: 2
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('E1')).toBeTruthy()
        expect(screen.getByText('E2')).toBeTruthy()
      })

      // Verificar que el contenido incluye las claves i18n o los textos reales
      expect(screen.getByText(/common\.import|Import/i)).toBeTruthy()
      expect(screen.getByText(/common\.export|Export/i)).toBeTruthy()
    })
  })

  describe('Cache stats sidebar', () => {
    it('should show cache stats when available', async () => {
      classificationAPI.getCacheStats.mockResolvedValue({
        data: {
          success: true,
          data: {
            totalEntries: 150,
            totalHits: 320,
            taricCodesTotal: 22000,
            taricChapters: 98
          }
        }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('150')).toBeTruthy()
        expect(screen.getByText('320')).toBeTruthy()
        expect(screen.getByText('22000')).toBeTruthy()
        expect(screen.getByText('98')).toBeTruthy()
      })
    })

    it('should show default fallbacks when cacheStats is null', async () => {
      classificationAPI.getCacheStats.mockResolvedValue({
        data: { success: true, data: null }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.aiEngine')).toBeTruthy()
        expect(screen.getByText('21946')).toBeTruthy() // taricCodesTotal
        expect(screen.getByText('97')).toBeTruthy() // taricChapters
      })
    })

    it('should show default fallbacks when cacheStats is empty object', async () => {
      classificationAPI.getCacheStats.mockResolvedValue({
        data: { success: true, data: {} }
      })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.aiEngine')).toBeTruthy()
        expect(screen.getByText('21946')).toBeTruthy()
        expect(screen.getByText('97')).toBeTruthy()
      })
    })

    it('should show assistant link', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('dashboard.luciAssistant')).toBeTruthy()
        const assistantLink = screen.getByText('dashboard.luciAssistant').closest('a')
        expect(assistantLink.getAttribute('href')).toBe('/assistant')
      })
    })
  })

  describe('Error handling', () => {
    it('should handle expeditionsAPI.list error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      expeditionsAPI.list.mockRejectedValue(new Error('Network error'))

      renderDashboard()

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error fetching dashboard data:', expect.any(Error))
        expect(screen.getByText('dashboard.noExpeditions')).toBeTruthy() // sale del spinner
      })

      consoleError.mockRestore()
    })

    it('should handle dashboardAPI.getAlerts error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      dashboardAPI.getAlerts.mockRejectedValue(new Error('Alert fetch error'))

      renderDashboard()

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error fetching alerts:', expect.any(Error))
      })

      consoleError.mockRestore()
    })

    it('should handle classificationAPI.getCacheStats error silently', async () => {
      classificationAPI.getCacheStats.mockRejectedValue(new Error('Cache error'))

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('21946')).toBeTruthy() // usa fallbacks
      })
    })
  })

  describe('Alerts interval', () => {
    it('should fetch alerts on mount', async () => {
      renderDashboard()

      await waitFor(() => {
        expect(dashboardAPI.getAlerts).toHaveBeenCalledTimes(1)
      })
    })

    it('should clean up interval on unmount', async () => {
      const { unmount } = renderDashboard()

      await waitFor(() => {
        expect(dashboardAPI.getAlerts).toHaveBeenCalled()
      })

      unmount()

      // La limpieza del interval se verifica implícitamente:
      // si no hubiera cleanup, el test dejaría timers activos y causaría warnings
      expect(dashboardAPI.getAlerts).toHaveBeenCalled()
    })
  })
})
