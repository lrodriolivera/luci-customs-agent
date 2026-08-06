import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntegrationsManager from './IntegrationsManager'

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// Mock API
vi.mock('../../services/api', () => ({
  integrationsAPI: {
    list: vi.fn(),
    getStatus: vi.fn(),
    getStats: vi.fn(),
    testConnectivity: vi.fn(),
    vua: {
      getServices: vi.fn(),
      getAuthorities: vi.fn()
    },
    traces: {
      getCHEDTypes: vi.fn(),
      getBCPs: vi.fn()
    },
    ncts: {
      getTransitTypes: vi.fn(),
      getGuaranteeTypes: vi.fn(),
      getOffices: vi.fn()
    }
  }
}))

import { integrationsAPI } from '../../services/api'

describe('IntegrationsManager', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy.mockRestore()
  })

  const mockIntegrations = [
    {
      code: 'AEAT',
      name: 'Agencia Tributaria',
      description: 'Declaraciones aduaneras AEAT',
      country: 'ES',
      category: 'customs',
      required: true,
      available: true
    },
    {
      code: 'VUA',
      name: 'Ventanilla Única',
      description: 'Controles paraduaneros',
      country: 'ES',
      category: 'paraduanero',
      required: false,
      available: true
    },
    {
      code: 'TRACES',
      name: 'TRACES NT',
      description: 'Control sanitario UE',
      country: 'UE',
      category: 'sanitary',
      required: false,
      available: true
    },
    {
      code: 'NCTS',
      name: 'Sistema Tránsito',
      description: 'NCTS Phase 5',
      country: 'UE',
      category: 'transit',
      required: false,
      available: true
    }
  ]

  const mockStatus = {
    integrations: {
      AEAT: {
        status: 'active',
        environment: 'production',
        simulationMode: false,
        timestamp: '2026-08-06T10:00:00Z'
      },
      VUA: {
        status: 'simulation',
        environment: 'test',
        simulationMode: true,
        timestamp: '2026-08-06T10:00:00Z'
      },
      TRACES: {
        status: 'error',
        environment: 'production',
        simulationMode: false,
        timestamp: '2026-08-06T10:00:00Z'
      },
      NCTS: {
        status: 'inactive',
        environment: 'test',
        simulationMode: false,
        timestamp: '2026-08-06T10:00:00Z'
      }
    },
    summary: {
      total: 4,
      active: 1,
      simulation: 1,
      error: 1,
      inactive: 1
    }
  }

  const mockStats = {
    integrations: {
      AEAT: {
        calls: 12500,
        success: 12400,
        errors: 100,
        avgResponseTime: 1.2
      },
      VUA: {
        calls: 3200,
        success: 3100,
        errors: 100,
        avgResponseTime: 0.8
      }
    },
    totals: {
      calls: 15700,
      success: 15500,
      errors: 200,
      successRate: 98.7
    }
  }

  const setupMocks = (opts = {}) => {
    integrationsAPI.list.mockResolvedValue({
      data: { data: opts.integrations !== undefined ? opts.integrations : mockIntegrations }
    })
    integrationsAPI.getStatus.mockResolvedValue({
      data: { data: opts.status !== undefined ? opts.status : mockStatus }
    })
    integrationsAPI.getStats.mockResolvedValue({
      data: { data: opts.stats !== undefined ? opts.stats : mockStats }
    })
  }

  describe('Initial loading', () => {
    it('shows spinner while loading', () => {
      integrationsAPI.list.mockImplementation(() => new Promise(() => {})) // never resolves
      integrationsAPI.getStatus.mockImplementation(() => new Promise(() => {}))
      integrationsAPI.getStats.mockImplementation(() => new Promise(() => {}))

      const { container } = render(<IntegrationsManager />)

      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('text-luci')
    })

    it('loads and displays integrations dashboard', async () => {
      setupMocks()
      render(<IntegrationsManager />)

      // Wait for the component to finish loading
      await waitFor(() => {
        expect(integrationsAPI.list).toHaveBeenCalledTimes(1)
      })

      // Header and navigation
      expect(await screen.findByText('integrations.title')).toBeInTheDocument()
      expect(screen.getByText('integrations.subtitle')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'VUA' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'TRACES' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'NCTS' })).toBeInTheDocument()

      // Status summary (dashboard view)
      expect(screen.getAllByText('Total')).toHaveLength(2) // summary + table footer
      expect(screen.getByText('Activas')).toBeInTheDocument()
      expect(screen.getByText('Simulacion')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Inactivas')).toBeInTheDocument()

      // Integrations grid
      expect(screen.getAllByText('AEAT')).toHaveLength(2) // appears in grid + stats table
      expect(screen.getByText('Agencia Tributaria')).toBeInTheDocument()
      expect(screen.getAllByText('VUA')).toHaveLength(3) // button + grid + stats table
      expect(screen.getAllByText('TRACES')).toHaveLength(2) // button + grid (not in stats)
      expect(screen.getAllByText('NCTS')).toHaveLength(2) // button + grid (not in stats)
    })

    it('handles empty integrations list', async () => {
      setupMocks({ integrations: [], status: null, stats: null })
      render(<IntegrationsManager />)

      await waitFor(() => {
        expect(integrationsAPI.list).toHaveBeenCalledTimes(1)
      })

      expect(await screen.findByText('integrations.title')).toBeInTheDocument()
      // No integration cards should be rendered
      expect(screen.queryByText('AEAT')).not.toBeInTheDocument()
    })

    it('handles loadData error and logs to console', async () => {
      integrationsAPI.list.mockRejectedValue(new Error('API failure'))
      integrationsAPI.getStatus.mockResolvedValue({ data: { data: null } })
      integrationsAPI.getStats.mockResolvedValue({ data: { data: null } })

      render(<IntegrationsManager />)

      await waitFor(() => {
        expect(integrationsAPI.list).toHaveBeenCalledTimes(1)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error cargando integraciones:', expect.any(Error))
      // Component should still render
      expect(await screen.findByText('integrations.title')).toBeInTheDocument()
    })
  })

  describe('Status colors and icons', () => {
    it('displays all status types correctly', async () => {
      setupMocks()
      render(<IntegrationsManager />)

      await waitFor(() => {
        expect(integrationsAPI.list).toHaveBeenCalledTimes(1)
      })

      // Wait for integrations to be displayed
      await screen.findByText('Agencia Tributaria')

      // Check that status badges are rendered
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('simulation')).toBeInTheDocument()
      expect(screen.getByText('error')).toBeInTheDocument()
      expect(screen.getByText('inactive')).toBeInTheDocument()

      // Check maintenance status with a different integration
      const mockWithMaintenance = [
        ...mockIntegrations.slice(0, 3),
        {
          code: 'TEST_MAINT',
          name: 'Test Maintenance',
          description: 'Test',
          country: 'ES',
          category: 'test',
          required: false,
          available: false
        }
      ]
      const statusWithMaintenance = {
        ...mockStatus,
        integrations: {
          ...mockStatus.integrations,
          TEST_MAINT: {
            status: 'maintenance',
            environment: 'test',
            simulationMode: false,
            timestamp: '2026-08-06T10:00:00Z'
          }
        }
      }

      setupMocks({ integrations: mockWithMaintenance, status: statusWithMaintenance })

      const { unmount } = render(<IntegrationsManager />)

      await screen.findByText('TEST_MAINT')
      expect(screen.getByText('maintenance')).toBeInTheDocument()

      unmount()
    })

    it('displays integration without status info as inactive', async () => {
      const integrationNoStatus = [
        {
          code: 'UNKNOWN',
          name: 'Unknown System',
          description: 'No status',
          country: 'XX',
          category: 'other',
          required: false,
          available: false
        }
      ]
      setupMocks({ integrations: integrationNoStatus, status: { integrations: {} } })

      render(<IntegrationsManager />)

      await screen.findByText('UNKNOWN')
      expect(screen.getByText('inactive')).toBeInTheDocument()
    })
  })

  describe('View navigation', () => {
    it('switches to VUA view', async () => {
      setupMocks()
      integrationsAPI.vua.getServices.mockResolvedValue({
        data: {
          data: [
            { code: 'SRV1', name: 'Service 1', authorities: ['AUTH1', 'AUTH2'] }
          ]
        }
      })
      integrationsAPI.vua.getAuthorities.mockResolvedValue({
        data: {
          data: [{ code: 'AUTH1', name: 'Authority 1' }]
        }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const vuaButton = screen.getByRole('button', { name: 'VUA' })
      await user.click(vuaButton)

      // VUA panel loading
      expect(await screen.findByText('Ventanilla Unica Aduanera')).toBeInTheDocument()
      expect(screen.getByText('Servicios Disponibles')).toBeInTheDocument()
      expect(screen.getByText('Autoridades Conectadas')).toBeInTheDocument()
    })

    it('switches to TRACES view', async () => {
      setupMocks()
      integrationsAPI.traces.getCHEDTypes.mockResolvedValue({
        data: {
          data: [
            { code: 'CHED-A', name: 'Animals', description: 'Live animals', authority: 'TRACES' }
          ]
        }
      })
      integrationsAPI.traces.getBCPs.mockResolvedValue({
        data: {
          data: [
            { code: 'BCP1', name: 'Border Point 1', type: 'airport', authorities: ['TRACES'] }
          ]
        }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const tracesButton = screen.getByRole('button', { name: 'TRACES' })
      await user.click(tracesButton)

      expect(await screen.findByText('TRACES NT - Control Sanitario UE')).toBeInTheDocument()
      expect(screen.getByText('Tipos de CHED')).toBeInTheDocument()
      expect(screen.getByText('Puntos de Control Fronterizo (BCP)')).toBeInTheDocument()
    })

    it('switches to NCTS view', async () => {
      setupMocks()
      integrationsAPI.ncts.getTransitTypes.mockResolvedValue({
        data: {
          data: [
            {
              code: 'T1',
              name: 'External transit',
              description: 'Non-Union goods',
              guaranteeRequired: true,
              carnetRequired: false
            }
          ]
        }
      })
      integrationsAPI.ncts.getGuaranteeTypes.mockResolvedValue({
        data: {
          data: [
            { key: 'G1', code: '0', name: 'Waiver', description: 'No guarantee required' }
          ]
        }
      })
      integrationsAPI.ncts.getOffices.mockResolvedValue({
        data: {
          data: {
            departure: [{ code: 'ES001000', name: 'Madrid' }],
            destination: [{ code: 'FR001000', name: 'Paris', country: 'FR' }]
          }
        }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const nctsButton = screen.getByRole('button', { name: 'NCTS' })
      await user.click(nctsButton)

      expect(await screen.findByText('NCTS Phase 5 - Sistema de Transito UE')).toBeInTheDocument()
      expect(screen.getByText('Tipos de Transito')).toBeInTheDocument()
      expect(screen.getByText('Tipos de Garantia')).toBeInTheDocument()
    })

    it('switches back to dashboard', async () => {
      setupMocks()
      integrationsAPI.vua.getServices.mockResolvedValue({ data: { data: [] } })
      integrationsAPI.vua.getAuthorities.mockResolvedValue({ data: { data: [] } })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      // Go to VUA
      await user.click(screen.getByRole('button', { name: 'VUA' }))
      await screen.findByText('Ventanilla Unica Aduanera')

      // Go back to dashboard
      await user.click(screen.getByRole('button', { name: 'Dashboard' }))

      // Dashboard content should be visible again
      expect(screen.getByText('Agencia Tributaria')).toBeInTheDocument()
      expect(screen.getAllByText('Total')).toHaveLength(2) // summary + table footer
    })
  })

  describe('Test connectivity', () => {
    it('tests connectivity successfully and reloads status', async () => {
      setupMocks()

      // Make testConnectivity slow so we can catch "Probando..."
      integrationsAPI.testConnectivity.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100))
      )

      const updatedStatus = {
        ...mockStatus,
        integrations: {
          ...mockStatus.integrations,
          AEAT: {
            ...mockStatus.integrations.AEAT,
            timestamp: '2026-08-06T11:00:00Z'
          }
        }
      }

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      // Mock the getStatus call that happens after testConnectivity
      integrationsAPI.getStatus.mockResolvedValueOnce({ data: { data: updatedStatus } })

      // Find all Test buttons (there are multiple integrations)
      const testButtons = screen.getAllByText('Test')
      await user.click(testButtons[0]) // Click first test button (AEAT)

      // Should show "Probando..." while testing
      expect(await screen.findByText('Probando...')).toBeInTheDocument()

      await waitFor(() => {
        expect(integrationsAPI.testConnectivity).toHaveBeenCalledWith('AEAT')
        expect(integrationsAPI.getStatus).toHaveBeenCalledTimes(2) // initial + reload
      })

      // Button should revert to "Test" (no longer "Probando...")
      await waitFor(() => {
        expect(screen.queryByText('Probando...')).not.toBeInTheDocument()
      })
    })

    it('handles testConnectivity error', async () => {
      setupMocks()
      integrationsAPI.testConnectivity.mockRejectedValue(new Error('Connection failed'))
      integrationsAPI.getStatus.mockResolvedValue({ data: { data: mockStatus } })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const testButtons = screen.getAllByText('Test')
      await user.click(testButtons[0])

      await waitFor(() => {
        expect(integrationsAPI.testConnectivity).toHaveBeenCalledWith('AEAT')
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error probando conectividad:', expect.any(Error))

      // Button should be enabled again
      await waitFor(() => {
        expect(testButtons[0]).not.toBeDisabled()
      })
    })

    it('prevents clicking test button while testing', async () => {
      setupMocks()
      integrationsAPI.testConnectivity.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({ data: { success: true } }), 100)
      }))

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const testButtons = screen.getAllByText('Test')
      await user.click(testButtons[0])

      // Button should be disabled while testing
      await waitFor(() => {
        const probandoButton = screen.getByText('Probando...').closest('button')
        expect(probandoButton).toBeDisabled()
      })
    })

    it('does not trigger integration click when clicking test button', async () => {
      setupMocks()
      integrationsAPI.testConnectivity.mockResolvedValue({ data: { success: true } })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const testButtons = screen.getAllByText('Test')
      await user.click(testButtons[0])

      // Wait for the test to complete
      await waitFor(() => {
        expect(integrationsAPI.testConnectivity).toHaveBeenCalled()
      })

      // Modal should NOT open (stopPropagation should have worked)
      expect(screen.queryByText('Estado de Conexion')).not.toBeInTheDocument()
    })
  })

  describe('Integration detail modal', () => {
    it('opens modal when clicking integration card', async () => {
      setupMocks()
      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const aeatCard = screen.getByText('Agencia Tributaria').closest('div[class*="bg-white"]')
      await user.click(aeatCard)

      // Modal content
      expect(screen.getByText('AEAT - Agencia Tributaria')).toBeInTheDocument()
      expect(screen.getByText('Categoria')).toBeInTheDocument()
      expect(screen.getAllByText('customs').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Pais/Region')).toBeInTheDocument()
      expect(screen.getAllByText('ES').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Requerido')).toBeInTheDocument()
      expect(screen.getAllByText('Si').length).toBeGreaterThanOrEqual(2) // Requerido + Disponible both "Si"
      expect(screen.getByText('Disponible')).toBeInTheDocument()
      expect(screen.getByText('Estado de Conexion')).toBeInTheDocument()
      expect(screen.getByText('production')).toBeInTheDocument()
      // simulationMode: false shows as "No"
      const noTexts = screen.getAllByText('No')
      expect(noTexts.length).toBeGreaterThan(0)
    })

    it('closes modal when clicking X button', async () => {
      setupMocks()
      const { container } = render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      const aeatCard = screen.getByText('Agencia Tributaria').closest('div[class*="bg-white"]')
      await user.click(aeatCard)

      expect(screen.getByText('AEAT - Agencia Tributaria')).toBeInTheDocument()

      // Find and click close button (in modal header with text-gray-400)
      const closeButton = container.querySelector('.fixed button.text-gray-400')
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('AEAT - Agencia Tributaria')).not.toBeInTheDocument()
      })
    })

    it('shows modal for integration without status info', async () => {
      const integrationNoStatus = [
        {
          code: 'UNKNOWN',
          name: 'Unknown System',
          description: 'No status',
          country: 'XX',
          category: 'other',
          required: false,
          available: false
        }
      ]
      setupMocks({ integrations: integrationNoStatus, status: { integrations: {} } })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('UNKNOWN')

      const unknownCard = screen.getByText('UNKNOWN').closest('div[class*="bg-white"]')
      await user.click(unknownCard)

      expect(screen.getByText('UNKNOWN - Unknown System')).toBeInTheDocument()
      // Estado de Conexion should NOT be displayed when status is null
      expect(screen.queryByText('Estado de Conexion')).not.toBeInTheDocument()
    })
  })

  describe('Stats table', () => {
    it('displays stats table with formatted numbers', async () => {
      setupMocks()
      render(<IntegrationsManager />)

      await screen.findByText('Agencia Tributaria')

      expect(screen.getByText('Estadisticas de Uso (Ultimos 30 dias)')).toBeInTheDocument()
      expect(screen.getByText('Integracion')).toBeInTheDocument()
      expect(screen.getByText('Llamadas')).toBeInTheDocument()
      expect(screen.getByText('Exitosas')).toBeInTheDocument()
      expect(screen.getByText('Errores')).toBeInTheDocument()
      expect(screen.getByText('% Exito')).toBeInTheDocument()
      expect(screen.getByText('Tiempo Resp. (s)')).toBeInTheDocument()

      // Check that calls/success/errors are displayed (toLocaleString format may vary)
      expect(screen.getByText(/12[.,]500/)).toBeInTheDocument()
      expect(screen.getByText(/12[.,]400/)).toBeInTheDocument()
      expect(screen.getByText('3200')).toBeInTheDocument() // no separator for <10k
      expect(screen.getByText('3100')).toBeInTheDocument() // no separator for <10k

      // Check calculated percentage
      expect(screen.getByText('99.2%')).toBeInTheDocument() // (12400/12500)*100
      expect(screen.getByText('96.9%')).toBeInTheDocument() // (3100/3200)*100

      // Check totals
      expect(screen.getByText(/15[.,]700/)).toBeInTheDocument()
      expect(screen.getByText(/15[.,]500/)).toBeInTheDocument()
      expect(screen.getByText('98.7%')).toBeInTheDocument()
    })

    it('does not display stats table when stats is null', async () => {
      setupMocks({ stats: null })
      render(<IntegrationsManager />)

      await screen.findByText('Agencia Tributaria')

      expect(screen.queryByText('Estadisticas de Uso (Ultimos 30 dias)')).not.toBeInTheDocument()
    })
  })

  describe('Reload functionality', () => {
    it('reloads data when clicking reload button', async () => {
      setupMocks()
      const { container } = render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      expect(integrationsAPI.list).toHaveBeenCalledTimes(1)

      // Find the reload button (has bg-gray-100 class and contains ArrowPathIcon)
      const reloadButton = container.querySelector('button.bg-gray-100.rounded-lg.p-2')
      await user.click(reloadButton)

      await waitFor(() => {
        expect(integrationsAPI.list).toHaveBeenCalledTimes(2)
        expect(integrationsAPI.getStatus).toHaveBeenCalledTimes(2)
        expect(integrationsAPI.getStats).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('VUA Panel', () => {
    it('loads and displays VUA services and authorities', async () => {
      setupMocks()
      integrationsAPI.vua.getServices.mockResolvedValue({
        data: {
          data: [
            { code: 'SRV1', name: 'Service 1', authorities: ['AUTH1', 'AUTH2'] },
            { code: 'SRV2', name: 'Service 2', authorities: ['AUTH3'] }
          ]
        }
      })
      integrationsAPI.vua.getAuthorities.mockResolvedValue({
        data: {
          data: [
            { code: 'AUTH1', name: 'Authority 1' },
            { code: 'AUTH2', name: 'Authority 2' }
          ]
        }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'VUA' }))

      expect(await screen.findByText('Service 1')).toBeInTheDocument()
      expect(screen.getByText('SRV1')).toBeInTheDocument()
      expect(screen.getByText('Authority 1')).toBeInTheDocument()
      expect(screen.getByText('AUTH1')).toBeInTheDocument()
    })

    it('handles VUA data loading error', async () => {
      setupMocks()
      integrationsAPI.vua.getServices.mockRejectedValue(new Error('VUA API failure'))
      integrationsAPI.vua.getAuthorities.mockResolvedValue({ data: { data: [] } })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'VUA' }))

      await waitFor(() => {
        expect(integrationsAPI.vua.getServices).toHaveBeenCalled()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error cargando datos VUA:', expect.any(Error))
    })

    it('shows VUA loading spinner', async () => {
      setupMocks()
      integrationsAPI.vua.getServices.mockImplementation(() => new Promise(() => {}))
      integrationsAPI.vua.getAuthorities.mockImplementation(() => new Promise(() => {}))

      const { container } = render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'VUA' }))

      // VUA panel should show spinner
      const vuaSpinner = container.querySelector('.h-32 .animate-spin')
      expect(vuaSpinner).toBeInTheDocument()
    })
  })

  describe('TRACES Panel', () => {
    it('loads and displays TRACES types and BCPs', async () => {
      setupMocks()
      integrationsAPI.traces.getCHEDTypes.mockResolvedValue({
        data: {
          data: [
            { code: 'CHED-A', name: 'Animals', description: 'Live animals', authority: 'TRACES' },
            { code: 'CHED-P', name: 'Plants', description: 'Plant products', authority: 'TRACES' }
          ]
        }
      })
      integrationsAPI.traces.getBCPs.mockResolvedValue({
        data: {
          data: [
            { code: 'BCP1', name: 'Border Point 1', type: 'airport', authorities: ['TRACES', 'CUSTOMS'] },
            { code: 'BCP2', name: 'Border Point 2', type: 'seaport', authorities: ['TRACES'] }
          ]
        }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'TRACES' }))

      expect(await screen.findByText('CHED-A')).toBeInTheDocument()
      expect(screen.getByText('Animals')).toBeInTheDocument()
      expect(screen.getByText('BCP1')).toBeInTheDocument()
      expect(screen.getByText('Border Point 1')).toBeInTheDocument()
    })

    it('truncates BCPs list and shows count message', async () => {
      setupMocks()
      integrationsAPI.traces.getCHEDTypes.mockResolvedValue({ data: { data: [] } })

      // Create 15 BCPs (more than the slice(0,10) limit)
      const manyBcps = Array.from({ length: 15 }, (_, i) => ({
        code: `BCP${i + 1}`,
        name: `Border Point ${i + 1}`,
        type: 'airport',
        authorities: ['TRACES']
      }))

      integrationsAPI.traces.getBCPs.mockResolvedValue({
        data: { data: manyBcps }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'TRACES' }))

      await screen.findByText('BCP1')

      // Only first 10 should be visible
      expect(screen.getByText('BCP10')).toBeInTheDocument()
      expect(screen.queryByText('BCP11')).not.toBeInTheDocument()

      // Count message
      expect(screen.getByText('... y 5 mas')).toBeInTheDocument()
    })

    it('handles TRACES data loading error', async () => {
      setupMocks()
      integrationsAPI.traces.getCHEDTypes.mockResolvedValue({ data: { data: [] } })
      integrationsAPI.traces.getBCPs.mockRejectedValue(new Error('TRACES API failure'))

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'TRACES' }))

      await waitFor(() => {
        expect(integrationsAPI.traces.getBCPs).toHaveBeenCalled()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error cargando datos TRACES:', expect.any(Error))
    })
  })

  describe('NCTS Panel', () => {
    it('loads and displays NCTS transit types, guarantees, and offices', async () => {
      setupMocks()
      integrationsAPI.ncts.getTransitTypes.mockResolvedValue({
        data: {
          data: [
            {
              code: 'T1',
              name: 'External transit',
              description: 'Non-Union goods',
              guaranteeRequired: true,
              carnetRequired: false
            },
            {
              code: 'T2',
              name: 'Internal transit',
              description: 'Union goods',
              guaranteeRequired: false,
              carnetRequired: true
            }
          ]
        }
      })
      integrationsAPI.ncts.getGuaranteeTypes.mockResolvedValue({
        data: {
          data: [
            { key: 'G1', code: '0', name: 'Waiver', description: 'No guarantee required' },
            { key: 'G2', code: '1', name: 'Comprehensive', description: 'Full guarantee' }
          ]
        }
      })
      integrationsAPI.ncts.getOffices.mockResolvedValue({
        data: {
          data: {
            departure: [
              { code: 'ES001000', name: 'Madrid' },
              { code: 'ES002000', name: 'Barcelona' }
            ],
            destination: [
              { code: 'FR001000', name: 'Paris', country: 'FR' },
              { code: 'DE001000', name: 'Berlin', country: 'DE' }
            ]
          }
        }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'NCTS' }))

      expect(await screen.findByText('T1')).toBeInTheDocument()
      expect(screen.getByText('External transit')).toBeInTheDocument()
      expect(screen.getByText('Requiere Garantia')).toBeInTheDocument()
      expect(screen.getByText('Requiere Carnet')).toBeInTheDocument()

      expect(screen.getByText('Waiver')).toBeInTheDocument()
      expect(screen.getByText('Comprehensive')).toBeInTheDocument()

      expect(screen.getByText('Aduanas de Salida (ES)')).toBeInTheDocument()
      expect(screen.getByText('Madrid')).toBeInTheDocument()
      expect(screen.getByText('Aduanas de Destino (UE)')).toBeInTheDocument()
      expect(screen.getByText('Paris')).toBeInTheDocument()
      expect(screen.getByText('(FR)')).toBeInTheDocument()
    })

    it('truncates offices list (slice 0,5)', async () => {
      setupMocks()
      integrationsAPI.ncts.getTransitTypes.mockResolvedValue({ data: { data: [] } })
      integrationsAPI.ncts.getGuaranteeTypes.mockResolvedValue({ data: { data: [] } })

      const manyOffices = {
        departure: Array.from({ length: 8 }, (_, i) => ({
          code: `ES00${i + 1}000`,
          name: `Office ${i + 1}`
        })),
        destination: Array.from({ length: 7 }, (_, i) => ({
          code: `FR00${i + 1}000`,
          name: `Dest ${i + 1}`,
          country: 'FR'
        }))
      }

      integrationsAPI.ncts.getOffices.mockResolvedValue({
        data: { data: manyOffices }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'NCTS' }))

      await screen.findByText('Office 1')

      // First 5 should be visible
      expect(screen.getByText('Office 5')).toBeInTheDocument()
      expect(screen.queryByText('Office 6')).not.toBeInTheDocument()

      expect(screen.getByText('Dest 5')).toBeInTheDocument()
      expect(screen.queryByText('Dest 6')).not.toBeInTheDocument()
    })

    it('truncates guarantee types (slice 0,8)', async () => {
      setupMocks()
      integrationsAPI.ncts.getTransitTypes.mockResolvedValue({ data: { data: [] } })
      integrationsAPI.ncts.getOffices.mockResolvedValue({
        data: { data: { departure: [], destination: [] } }
      })

      const manyGuarantees = Array.from({ length: 12 }, (_, i) => ({
        key: `G${i + 1}`,
        code: String(i),
        name: `Guarantee ${i + 1}`,
        description: `Desc ${i + 1}`
      }))

      integrationsAPI.ncts.getGuaranteeTypes.mockResolvedValue({
        data: { data: manyGuarantees }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'NCTS' }))

      await screen.findByText('Guarantee 1')

      // First 8 should be visible
      expect(screen.getByText('Guarantee 8')).toBeInTheDocument()
      expect(screen.queryByText('Guarantee 9')).not.toBeInTheDocument()
    })

    it('handles NCTS data loading error', async () => {
      setupMocks()
      integrationsAPI.ncts.getTransitTypes.mockRejectedValue(new Error('NCTS API failure'))
      integrationsAPI.ncts.getGuaranteeTypes.mockResolvedValue({ data: { data: [] } })
      integrationsAPI.ncts.getOffices.mockResolvedValue({
        data: { data: { departure: [], destination: [] } }
      })

      render(<IntegrationsManager />)
      const user = userEvent.setup()

      await screen.findByText('Agencia Tributaria')

      await user.click(screen.getByRole('button', { name: 'NCTS' }))

      await waitFor(() => {
        expect(integrationsAPI.ncts.getTransitTypes).toHaveBeenCalled()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error cargando datos NCTS:', expect.any(Error))
    })
  })

  describe('getStatusInfo', () => {
    it('returns null when status is null', async () => {
      setupMocks({ status: null })
      render(<IntegrationsManager />)

      await screen.findByText('Agencia Tributaria')

      // All integrations should show 'inactive' status
      const inactiveBadges = screen.getAllByText('inactive')
      expect(inactiveBadges.length).toBeGreaterThan(0)
    })

    it('returns null when status.integrations is missing', async () => {
      setupMocks({ status: { summary: { total: 0 } } })
      render(<IntegrationsManager />)

      await screen.findByText('Agencia Tributaria')

      const inactiveBadges = screen.getAllByText('inactive')
      expect(inactiveBadges.length).toBeGreaterThan(0)
    })
  })

  describe('Environment info rendering', () => {
    it('displays environment and simulation mode info', async () => {
      setupMocks()
      render(<IntegrationsManager />)

      await screen.findByText('Agencia Tributaria')

      // AEAT: production, no simulation
      const aeatCard = screen.getByText('Agencia Tributaria').closest('div[class*="bg-white"]')
      expect(aeatCard).toHaveTextContent('Ambiente: production')
      expect(aeatCard).not.toHaveTextContent('(Simulacion)')

      // VUA: test, with simulation
      const vuaCard = screen.getByText('Ventanilla Única').closest('div[class*="bg-white"]')
      expect(vuaCard).toHaveTextContent('Ambiente: test (Simulacion)')
    })

    it('does not display environment info when not available', async () => {
      const statusNoEnv = {
        integrations: {
          AEAT: {
            status: 'active',
            timestamp: '2026-08-06T10:00:00Z'
          }
        },
        summary: { total: 1, active: 1, simulation: 0, error: 0, inactive: 0 }
      }

      setupMocks({ status: statusNoEnv })
      render(<IntegrationsManager />)

      await screen.findByText('Agencia Tributaria')

      const aeatCard = screen.getByText('Agencia Tributaria').closest('div[class*="bg-white"]')
      expect(aeatCard).not.toHaveTextContent('Ambiente:')
    })
  })
})
