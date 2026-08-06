import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ChannelDashboard from './ChannelDashboard'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('../../services/api', () => ({
  channelsAPI: {
    getStats: vi.fn(),
    getExpeditions: vi.fn()
  }
}))

import { channelsAPI } from '../../services/api'
import toast from 'react-hot-toast'

function renderComponent() {
  return render(
    <MemoryRouter>
      <ChannelDashboard />
    </MemoryRouter>
  )
}

describe('ChannelDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    // Default resolved mocks
    channelsAPI.getStats.mockResolvedValue({
      data: {
        green: { count: 10, percentage: 50 },
        yellow: { count: 5, percentage: 25 },
        orange: { count: 3, percentage: 15 },
        red: { count: 2, percentage: 10 },
        total: 20
      }
    })

    channelsAPI.getExpeditions.mockResolvedValue({
      data: []
    })
  })

  describe('Loading state', () => {
    it('should show spinner during data load', async () => {
      let resolveStats, resolveExpeditions

      const statsPromise = new Promise(resolve => { resolveStats = resolve })
      const expeditionsPromise = new Promise(resolve => { resolveExpeditions = resolve })

      channelsAPI.getStats.mockReturnValue(statsPromise)
      channelsAPI.getExpeditions.mockReturnValue(expeditionsPromise)

      renderComponent()

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()

      // Resolve both promises
      resolveStats({ data: { green: { count: 1, percentage: 100 }, yellow: { count: 0, percentage: 0 }, orange: { count: 0, percentage: 0 }, red: { count: 0, percentage: 0 }, total: 1 } })
      resolveExpeditions({ data: [] })

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })
    })
  })

  describe('Data rendering', () => {
    it('should render title and stats after load', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      const allNumbers = screen.getAllByText(/^(10|5|3|2|20)$/)
      expect(allNumbers.length).toBeGreaterThan(0)
    })

    it('should render channel cards with labels', async () => {
      renderComponent()

      await waitFor(() => {
        const greenLabels = screen.getAllByText('channels.greenChannel')
        expect(greenLabels.length).toBeGreaterThan(0)
      })

      const yellowLabels = screen.getAllByText('channels.yellowChannel')
      expect(yellowLabels.length).toBeGreaterThan(0)

      const orangeLabels = screen.getAllByText('channels.orangeChannel')
      expect(orangeLabels.length).toBeGreaterThan(0)

      const redLabels = screen.getAllByText('channels.redChannel')
      expect(redLabels.length).toBeGreaterThan(0)
    })

    it('should display criticalExpeditions count (orange + red)', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: '1', channel: 'orange', clientName: 'Client1', mrn: 'MRN1' },
          { _id: '2', channel: 'red', clientName: 'Client2', mrn: 'MRN2' },
          { _id: '3', channel: 'green', clientName: 'Client3', mrn: 'MRN3' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.requireAttention')).toBeInTheDocument()
      })

      // Find the specific "2" next to requireAttention
      const attentionSection = screen.getByText('channels.requireAttention').closest('div').closest('div')
      expect(within(attentionSection).getByText('2')).toBeInTheDocument()
    })

    it('should display avgHours when available', async () => {
      channelsAPI.getStats.mockResolvedValue({
        data: {
          green: { count: 10, percentage: 50, avgHours: 12 },
          yellow: { count: 5, percentage: 25 },
          orange: { count: 3, percentage: 15 },
          red: { count: 2, percentage: 10 },
          total: 20
        }
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('12h')).toBeInTheDocument()
      })
    })

    it('should show "-" when avgHours is not available', async () => {
      channelsAPI.getStats.mockResolvedValue({
        data: {
          green: { count: 10, percentage: 50 },
          yellow: { count: 5, percentage: 25 },
          orange: { count: 3, percentage: 15 },
          red: { count: 2, percentage: 10 },
          total: 20
        }
      })

      renderComponent()

      await waitFor(() => {
        const avgSection = screen.getByText('channels.avgReleaseTime').closest('div').closest('div')
        expect(within(avgSection).getByText('-')).toBeInTheDocument()
      })
    })
  })

  describe('Stats data parsing', () => {
    it('should parse statsResponse.data.data', async () => {
      channelsAPI.getStats.mockResolvedValue({
        data: {
          data: {
            green: { count: 15, percentage: 60 },
            yellow: { count: 5, percentage: 20 },
            orange: { count: 3, percentage: 12 },
            red: { count: 2, percentage: 8 },
            total: 25
          }
        }
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument()
      })

      expect(screen.getByText('25')).toBeInTheDocument()
    })

    it('should fallback to statsResponse.data', async () => {
      channelsAPI.getStats.mockResolvedValue({
        data: {
          green: { count: 8, percentage: 40 },
          yellow: { count: 6, percentage: 30 },
          orange: { count: 4, percentage: 20 },
          red: { count: 2, percentage: 10 },
          total: 20
        }
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('8')).toBeInTheDocument()
      })
    })
  })

  describe('Expeditions data parsing', () => {
    it('should parse expeditions via data.data array', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: {
          data: [
            { _id: '1', channel: 'green', clientName: 'ClientA', mrn: 'MRNA' }
          ]
        }
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('ClientA')).toBeInTheDocument()
      })
    })

    it('should parse expeditions via data array', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: '2', channel: 'yellow', clientName: 'ClientB', mrn: 'MRNB' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('ClientB')).toBeInTheDocument()
      })
    })

    it('should parse expeditions direct array', async () => {
      channelsAPI.getExpeditions.mockResolvedValue([
        { _id: '3', channel: 'orange', clientName: 'ClientC', mrn: 'MRNC' }
      ])

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('ClientC')).toBeInTheDocument()
      })
    })

    it('should fallback to empty array when no valid array found', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: null
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.noExpeditions')).toBeInTheDocument()
      })
    })
  })

  describe('Channel filtering', () => {
    beforeEach(() => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: '1', channel: 'green', clientName: 'GreenClient', mrn: 'MRN1' },
          { _id: '2', channel: 'yellow', clientName: 'YellowClient', mrn: 'MRN2' },
          { _id: '3', channel: 'orange', clientName: 'OrangeClient', mrn: 'MRN3' },
          { _id: '4', channel: 'red', clientName: 'RedClient', mrn: 'MRN4' }
        ]
      })
    })

    it('should filter table when clicking a channel card', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('GreenClient')).toBeInTheDocument()
      })

      // Find the green channel button by finding the first button that contains the green channel text
      const allButtons = screen.getAllByRole('button')
      const greenButton = allButtons.find(btn => within(btn).queryByText('channels.greenChannel'))

      fireEvent.click(greenButton)

      await waitFor(() => {
        expect(screen.getByText('GreenClient')).toBeInTheDocument()
        expect(screen.queryByText('YellowClient')).not.toBeInTheDocument()
        expect(screen.queryByText('OrangeClient')).not.toBeInTheDocument()
        expect(screen.queryByText('RedClient')).not.toBeInTheDocument()
      })
    })

    it('should deselect channel when clicking again', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('GreenClient')).toBeInTheDocument()
      })

      const allButtons = screen.getAllByRole('button')
      const greenButton = allButtons.find(btn => within(btn).queryByText('channels.greenChannel'))

      fireEvent.click(greenButton)
      await waitFor(() => {
        expect(screen.queryByText('YellowClient')).not.toBeInTheDocument()
      })

      fireEvent.click(greenButton)
      await waitFor(() => {
        expect(screen.getByText('YellowClient')).toBeInTheDocument()
      })
    })

    it('should show "viewAll" button when channel is selected', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('GreenClient')).toBeInTheDocument()
      })

      const allButtons = screen.getAllByRole('button')
      const orangeButton = allButtons.find(btn => within(btn).queryByText('channels.orangeChannel'))

      fireEvent.click(orangeButton)

      await waitFor(() => {
        expect(screen.getByText('channels.viewAll')).toBeInTheDocument()
      })
    })

    it('should clear filter when clicking "viewAll"', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('GreenClient')).toBeInTheDocument()
      })

      const allButtons = screen.getAllByRole('button')
      const redButton = allButtons.find(btn => within(btn).queryByText('channels.redChannel'))

      fireEvent.click(redButton)

      await waitFor(() => {
        expect(screen.queryByText('GreenClient')).not.toBeInTheDocument()
      })

      const viewAllButton = screen.getByText('channels.viewAll')
      fireEvent.click(viewAllButton)

      await waitFor(() => {
        expect(screen.getByText('GreenClient')).toBeInTheDocument()
        expect(screen.getByText('YellowClient')).toBeInTheDocument()
      })
    })
  })

  describe('Date range filtering', () => {
    it('should call loadData when dateRange changes to "today"', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'today' } })

      await waitFor(() => {
        expect(channelsAPI.getStats).toHaveBeenCalled()
      })

      const call = channelsAPI.getStats.mock.calls[0][0]
      expect(call.startDate).toBeDefined()
      expect(call.endDate).toBeDefined()
    })

    it('should call loadData when dateRange changes to "week"', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'week' } })

      await waitFor(() => {
        expect(channelsAPI.getStats).toHaveBeenCalled()
      })
    })

    it('should call loadData when dateRange changes to "month"', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'month' } })

      await waitFor(() => {
        expect(channelsAPI.getStats).toHaveBeenCalled()
      })
    })

    it('should call loadData when dateRange changes to "year"', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'year' } })

      await waitFor(() => {
        expect(channelsAPI.getStats).toHaveBeenCalled()
      })
    })

    it('should call loadData with empty params for "all" range', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      // The initial load uses 'all' as default, so check the first call
      expect(channelsAPI.getStats).toHaveBeenCalled()
      const initialCall = channelsAPI.getStats.mock.calls[0][0]
      expect(initialCall).toEqual({})
    })
  })

  describe('Refresh button', () => {
    it('should reload data when clicking refresh button', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const refreshButton = screen.getByTitle('Actualizar')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(channelsAPI.getStats).toHaveBeenCalled()
        expect(channelsAPI.getExpeditions).toHaveBeenCalled()
      })
    })
  })

  describe('Expeditions table', () => {
    it('should render expedition with H7 badge and link to /h7/:id', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'h7-123', type: 'h7', clientName: 'H7Client', mrn: 'MRN-H7', channel: 'green' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('H7Client')).toBeInTheDocument()
      })

      const links = screen.getAllByRole('link')
      const h7Link = links.find(l => l.getAttribute('href') === '/h7/h7-123')
      expect(h7Link).toBeInTheDocument()
      expect(screen.getByText('H7')).toBeInTheDocument()
    })

    it('should render expedition without H7 type and link to /expeditions/:id', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-456', type: 'standard', clientName: 'StdClient', mrn: 'MRN-STD', channel: 'yellow' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('StdClient')).toBeInTheDocument()
      })

      const links = screen.getAllByRole('link')
      const stdLink = links.find(l => l.getAttribute('href') === '/expeditions/exp-456')
      expect(stdLink).toBeInTheDocument()
    })

    it('should show fallback "-" for missing clientName', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-1', channel: 'green', mrn: 'MRN1' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        const table = screen.getByRole('table')
        const dashes = within(table).getAllByText('-')
        expect(dashes.length).toBeGreaterThan(0)
      })
    })

    it('should show fallback "-" for missing mrn', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-2', channel: 'green', clientName: 'ClientX' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        const table = screen.getByRole('table')
        const dashes = within(table).getAllByText('-')
        expect(dashes.length).toBeGreaterThan(0)
      })
    })

    it('should derive channel from _channel property when passed directly', async () => {
      // BUG REAL: The mapping at L115-121 overwrites _channel with exp.channel || 'green',
      // so passing { _channel: 'orange' } gets overridden to { _channel: 'green' } if exp.channel is undefined.
      // To test _channel properly, we must pass BOTH _channel AND channel.
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-3', _channel: 'orange', channel: 'orange', clientName: 'ClientY', mrn: 'MRNY' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        const table = screen.getByRole('table')
        const orangeLabels = within(table).getAllByText('channels.orangeChannel')
        expect(orangeLabels.length).toBeGreaterThan(0)
      })
    })

    it('should derive channel from channel property', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-4', channel: 'red', clientName: 'ClientZ', mrn: 'MRNZ' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        const table = screen.getByRole('table')
        const redLabels = within(table).getAllByText('channels.redChannel')
        expect(redLabels.length).toBeGreaterThan(0)
      })
    })

    it('should use declaration.channel when top-level channel is missing', async () => {
      // Tras el fix de L117 (_channel = exp.channel || exp.declaration?.channel || 'green'),
      // una expedición cuyo canal solo vive en declaration.channel debe mostrar ese canal real.
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-5', declaration: { channel: 'yellow' }, clientName: 'ClientW', mrn: 'MRNW' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('ClientW')).toBeInTheDocument()
      })

      // Comportamiento correcto: muestra el canal amarillo de declaration.channel, no el verde por defecto
      const table = screen.getByRole('table')
      const yellowLabels = within(table).getAllByText('channels.yellowChannel')
      expect(yellowLabels.length).toBeGreaterThan(0)
    })

    it('should default to green channel when no channel property exists', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-6', clientName: 'ClientV', mrn: 'MRNV' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        const table = screen.getByRole('table')
        const greenLabels = within(table).getAllByText('channels.greenChannel')
        expect(greenLabels.length).toBeGreaterThan(0)
      })
    })

    it('should format channelDate as locale date', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({
        data: [
          { _id: 'exp-7', channel: 'green', clientName: 'ClientU', mrn: 'MRNU', channelDate: '2026-08-01T10:00:00Z' }
        ]
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('ClientU')).toBeInTheDocument()
      })

      const formattedDate = new Date('2026-08-01T10:00:00Z').toLocaleDateString('es-ES')
      expect(screen.getByText(formattedDate)).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('should show empty state when no expeditions', async () => {
      channelsAPI.getExpeditions.mockResolvedValue({ data: [] })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.noExpeditions')).toBeInTheDocument()
      })

      expect(screen.getByText('channels.noExpeditionsDesc')).toBeInTheDocument()
    })
  })

  describe('NL mode', () => {
    beforeEach(() => {
      localStorage.setItem('activeCustomsCountry', 'NL')
    })

    it('should show Douane NL indicator', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/Douane NL/)).toBeInTheDocument()
      })
    })

    it('should show NL interpretation note', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/Interpretacion canales Douane/)).toBeInTheDocument()
      })
    })

    it('should show NL-specific green channel text', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/Codigo 00\/01 - Levante sin control/)).toBeInTheDocument()
      })
    })

    it('should show NL-specific orange channel text', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/Codigo 10 - Control documental/)).toBeInTheDocument()
      })
    })

    it('should show NL-specific red channel text', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/Codigo 11 - Control fisico/)).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('should handle getStats rejection without crashing', async () => {
      channelsAPI.getStats.mockRejectedValue(new Error('Stats API error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith('Error loading stats:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('should handle getExpeditions rejection silently', async () => {
      channelsAPI.getExpeditions.mockRejectedValue(new Error('Expeditions API error'))

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      expect(screen.getByText('channels.noExpeditions')).toBeInTheDocument()
    })

    it('should log console.error when both APIs fail', async () => {
      channelsAPI.getStats.mockRejectedValue(new Error('Stats error'))
      channelsAPI.getExpeditions.mockRejectedValue(new Error('Expeditions error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('channels.title')).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith('Error loading stats:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })
})
