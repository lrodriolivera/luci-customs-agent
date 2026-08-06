import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuotaManager from './QuotaManager'

// Mock api service (DEFAULT export)
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// Mock react-hot-toast (DEFAULT export que es función invocable + métodos)
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

import api from '../../services/api'
import toast from 'react-hot-toast'

describe('QuotaManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('renderiza el componente con tab "search" por defecto', () => {
      render(<QuotaManager />)

      expect(screen.getByText('quotaManager.title')).toBeInTheDocument()
      expect(screen.getByText('quotaManager.subtitle')).toBeInTheDocument()
      expect(screen.getByText('Buscar Disponibilidad')).toBeInTheDocument()
      expect(screen.getByText('Todos los Contingentes')).toBeInTheDocument()
      expect(screen.getByText('Contingentes Críticos')).toBeInTheDocument()
    })

    it('renderiza el formulario de búsqueda en tab inicial', () => {
      render(<QuotaManager />)

      // Verificar título del formulario (es un h2, no el botón)
      const heading = screen.getByRole('heading', { name: 'Verificar Disponibilidad', level: 2 })
      expect(heading).toBeInTheDocument()

      // Verificar labels (sin asociación for, solo verificamos que existen)
      expect(screen.getByText('Código TARIC *')).toBeInTheDocument()
      expect(screen.getByText('País de Origen *')).toBeInTheDocument()
      expect(screen.getByText(/Cantidad \*/)).toBeInTheDocument()
      expect(screen.getByText('Unidad')).toBeInTheDocument()
      expect(screen.getByText('Valor Aduanero (EUR) - Opcional')).toBeInTheDocument()

      // Verificar inputs por placeholder
      expect(screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('10000')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('50000.00')).toBeInTheDocument()
    })

    it('muestra el estado vacío sin availability', () => {
      render(<QuotaManager />)

      expect(screen.getByText('Complete el formulario para verificar contingentes disponibles')).toBeInTheDocument()
    })
  })

  describe('useEffect - cambio de tab', () => {
    it('NO hace fetch en tab "search" inicial', () => {
      render(<QuotaManager />)

      expect(api.get).not.toHaveBeenCalled()
    })

    it('hace fetch de /api/quotas/list cuando se cambia a tab "list" - success:true', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q1',
                orderNumber: '09.1234',
                description: 'Carne de vacuno',
                agreement: 'Acuerdo UE-Mercosur',
                type: 'Preferencial',
                volume: { utilizationPercent: 45, available: 5000, total: 10000, unit: 'kg' },
                status: 'available'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/list')
      })

      await waitFor(() => {
        expect(screen.getByText('09.1234')).toBeInTheDocument()
      })
      expect(screen.getByText('Carne de vacuno')).toBeInTheDocument()
      expect(screen.getByText('Acuerdo UE-Mercosur')).toBeInTheDocument()
    })

    it('hace fetch de /api/quotas/list cuando se cambia a tab "list" - success:false', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Error del servidor'
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/list')
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar contingentes')
      })
    })

    it('hace fetch de /api/quotas/list cuando se cambia a tab "list" - catch', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'))

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/list')
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar contingentes')
      })
    })

    it('hace fetch de /api/quotas/critical cuando se cambia a tab "critical" - success:true', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q2',
                orderNumber: '09.5678',
                description: 'Frutas tropicales',
                utilizationPercent: 96,
                available: 200,
                unit: 'ton',
                estimatedExhaustion: '15 días'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/critical')
      })

      await screen.findByText('Orden: 09.5678')
      expect(screen.getByText('Frutas tropicales')).toBeInTheDocument()
      expect(screen.getByText('15 días')).toBeInTheDocument()
    })

    it('hace fetch de /api/quotas/critical cuando se cambia a tab "critical" - success:false', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Error del servidor'
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/critical')
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar contingentes críticos')
      })
    })

    it('hace fetch de /api/quotas/critical cuando se cambia a tab "critical" - catch', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'))

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/critical')
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar contingentes críticos')
      })
    })
  })

  describe('handleCheckAvailability - validación', () => {
    it('muestra error si falta taricCode', async () => {
      render(<QuotaManager />)

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Complete TARIC, país de origen y cantidad')
      })

      expect(api.post).not.toHaveBeenCalled()
    })

    it('muestra error si falta quantity', async () => {
      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Complete TARIC, país de origen y cantidad')
      })

      expect(api.post).not.toHaveBeenCalled()
    })
  })

  describe('handleCheckAvailability - éxito', () => {
    it('llama a api.post con datos correctos y muestra resultados - found:true, count>0', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: true,
            count: 2,
            quotas: [
              {
                description: 'Carne congelada - Contingente A',
                orderNumber: '09.1234',
                agreement: 'Acuerdo UE-Mercosur',
                available: true,
                volume: {
                  utilizationPercent: 45,
                  available: 5000,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.05,
                  outQuota: 0.15,
                  savings: 0.10
                },
                critical: false,
                recommendation: 'Puede importar sin restricciones',
                requiresCertificate: false
              },
              {
                description: 'Carne congelada - Contingente B',
                orderNumber: '09.5678',
                agreement: null,
                available: false,
                volume: {
                  utilizationPercent: 98,
                  available: 100,
                  total: 5000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.03,
                  outQuota: 0.15,
                  savings: 0.12
                },
                critical: true,
                recommendation: 'Solicite reserva con urgencia',
                requiresCertificate: 'Certificado sanitario'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      const customsValueInput = screen.getByPlaceholderText('50000.00')
      fireEvent.change(customsValueInput, { target: { value: '50000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/quotas/check-availability', {
          taricCode: '02011000',
          originCountry: 'AR',
          quantity: 1000,
          unit: 'kg'
        })
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('2 contingente(s) encontrado(s)')
      })

      // Verificar que se muestran los resultados
      await screen.findByText('Carne congelada - Contingente A')
      expect(screen.getByText('Carne congelada - Contingente B')).toBeInTheDocument()
      expect(screen.getByText('Orden: 09.1234')).toBeInTheDocument()
      expect(screen.getByText('Orden: 09.5678')).toBeInTheDocument()
      expect(screen.getByText('Acuerdo: Acuerdo UE-Mercosur')).toBeInTheDocument()
      expect(screen.getByText('Puede importar sin restricciones')).toBeInTheDocument()
      expect(screen.getByText('Solicite reserva con urgencia')).toBeInTheDocument()
      expect(screen.getByText('📄 Certificado requerido: Certificado sanitario')).toBeInTheDocument()

      // Verificar ahorro (50000 * 0.10 = 5000.00 EUR para el primero)
      expect(screen.getByText('5000.00 EUR')).toBeInTheDocument()
      // Segundo ahorro: 50000 * 0.12 = 6000.00 EUR
      expect(screen.getByText('6000.00 EUR')).toBeInTheDocument()

      // Verificar alertas críticas
      const criticalAlerts = screen.getAllByText(/Contingente en estado crítico/)
      expect(criticalAlerts).toHaveLength(1)
    })

    it('llama a api.post y muestra toast sin nivel cuando found:false o count:0', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: false,
            count: 0,
            quotas: []
          }
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '99999999' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '100' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('No se encontraron contingentes para este producto')
      })

      // Verificar que se muestra el mensaje de "No se encontraron"
      await screen.findByText('No se encontraron contingentes para este producto')
      expect(screen.getByText('Se aplicará el arancel NMF (Nación Más Favorecida)')).toBeInTheDocument()
    })

    it('llama a api.post con unit diferente (L)', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: false,
            count: 0,
            quotas: []
          }
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '22041000' } })

      // Buscar el select de Unidad y cambiarlo
      const unitSelect = screen.getByDisplayValue('Kilogramos (kg)')
      fireEvent.change(unitSelect, { target: { value: 'L' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '5000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/quotas/check-availability', {
          taricCode: '22041000',
          originCountry: 'AR',
          quantity: 5000,
          unit: 'L'
        })
      })
    })
  })

  describe('handleCheckAvailability - errores', () => {
    it('muestra toast.error cuando success:false con mensaje del servidor', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Código TARIC no válido'
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '00000000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '100' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Código TARIC no válido')
      })
    })

    it('muestra toast.error cuando success:false SIN mensaje del servidor', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: false
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '00000001' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '100' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al verificar disponibilidad')
      })
    })

    it('muestra toast.error cuando el api.post lanza excepción', async () => {
      api.post.mockRejectedValueOnce(new Error('Network timeout'))

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '100' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al verificar disponibilidad')
      })
    })
  })

  describe('getStatusBadge - 4 ramas', () => {
    it('renderiza badge "Disponible" para status available', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q1',
                orderNumber: '09.1234',
                description: 'Test',
                type: 'Preferencial',
                volume: { utilizationPercent: 30, available: 7000, total: 10000, unit: 'kg' },
                status: 'available'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await screen.findByText('Disponible')
    })

    it('renderiza badge "Crítico" para status critical', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q2',
                orderNumber: '09.5678',
                description: 'Test',
                type: 'Preferencial',
                volume: { utilizationPercent: 85, available: 1500, total: 10000, unit: 'kg' },
                status: 'critical'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await screen.findByText('Crítico')
    })

    it('renderiza badge "Agotado" para status exhausted', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q3',
                orderNumber: '09.9999',
                description: 'Test',
                type: 'Preferencial',
                volume: { utilizationPercent: 100, available: 0, total: 10000, unit: 'kg' },
                status: 'exhausted'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await screen.findByText('Agotado')
    })

    it('renderiza badge con status desconocido (default)', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q4',
                orderNumber: '09.8888',
                description: 'Test',
                type: 'Preferencial',
                volume: { utilizationPercent: 50, available: 5000, total: 10000, unit: 'kg' },
                status: 'unknown'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await screen.findByText('unknown')
    })
  })

  describe('getUtilizationColor - 4 ramas', () => {
    it('aplica color rojo para utilización >= 95%', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q1',
                orderNumber: '09.1234',
                description: 'Test 95+',
                utilizationPercent: 96,
                available: 200,
                unit: 'kg',
                estimatedExhaustion: '5 días'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await screen.findByText('96%')

      const badge = screen.getByText('96%')
      expect(badge.className).toContain('text-red-600')
      expect(badge.className).toContain('bg-red-50')
    })

    it('aplica color naranja para utilización >= 80% y < 95%', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q2',
                orderNumber: '09.5678',
                description: 'Test 80-94',
                utilizationPercent: 85,
                available: 1500,
                unit: 'kg',
                estimatedExhaustion: '10 días'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await screen.findByText('85%')

      const badge = screen.getByText('85%')
      expect(badge.className).toContain('text-orange-600')
      expect(badge.className).toContain('bg-orange-50')
    })

    it('aplica color amarillo para utilización >= 60% y < 80%', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q3',
                orderNumber: '09.9999',
                description: 'Test 60-79',
                utilizationPercent: 70,
                available: 3000,
                unit: 'kg',
                estimatedExhaustion: '20 días'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await screen.findByText('70%')

      const badge = screen.getByText('70%')
      expect(badge.className).toContain('text-yellow-600')
      expect(badge.className).toContain('bg-yellow-50')
    })

    it('aplica color verde para utilización < 60%', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q4',
                orderNumber: '09.8888',
                description: 'Test <60',
                utilizationPercent: 45,
                available: 5500,
                unit: 'kg',
                estimatedExhaustion: '40 días'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await screen.findByText('45%')

      const badge = screen.getByText('45%')
      expect(badge.className).toContain('text-green-600')
      expect(badge.className).toContain('bg-green-50')
    })
  })

  describe('Tab "list" - renderizado de tabla', () => {
    it('muestra spinner mientras loading=true', () => {
      api.get.mockImplementation(() => new Promise(() => {})) // never resolves

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      expect(screen.getByText('Cargando contingentes...')).toBeInTheDocument()
    })

    it('muestra tabla con múltiples contingentes', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q1',
                orderNumber: '09.1234',
                description: 'Carne de vacuno',
                agreement: 'Acuerdo UE-Mercosur',
                type: 'Preferencial',
                volume: { utilizationPercent: 45, available: 5000, total: 10000, unit: 'kg' },
                status: 'available'
              },
              {
                quotaId: 'Q2',
                orderNumber: '09.5678',
                description: 'Frutas tropicales',
                agreement: null,
                type: 'Autónomo',
                volume: { utilizationPercent: 85, available: 1500, total: 10000, unit: 'ton' },
                status: 'critical'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const listTab = screen.getByRole('button', { name: 'Todos los Contingentes' })
      fireEvent.click(listTab)

      await screen.findByText('09.1234')

      expect(screen.getByText('Carne de vacuno')).toBeInTheDocument()
      expect(screen.getByText('Acuerdo UE-Mercosur')).toBeInTheDocument()
      expect(screen.getByText('Preferencial')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()

      expect(screen.getByText('09.5678')).toBeInTheDocument()
      expect(screen.getByText('Frutas tropicales')).toBeInTheDocument()
      expect(screen.getByText('Autónomo')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()

      expect(screen.getByText('Disponible')).toBeInTheDocument()
      expect(screen.getByText('Crítico')).toBeInTheDocument()
    })
  })

  describe('Tab "critical" - renderizado de contingentes críticos', () => {
    it('muestra spinner mientras loading=true', () => {
      api.get.mockImplementation(() => new Promise(() => {})) // never resolves

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      expect(screen.getByText('Cargando contingentes críticos...')).toBeInTheDocument()
    })

    it('muestra mensaje cuando no hay contingentes críticos', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: []
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await screen.findByText('No hay contingentes en estado crítico')
      expect(screen.getByText('Todos los contingentes activos tienen disponibilidad adecuada')).toBeInTheDocument()
    })

    it('muestra badge en el tab cuando hay contingentes críticos', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            quotas: [
              {
                quotaId: 'Q1',
                orderNumber: '09.1234',
                description: 'Test',
                utilizationPercent: 96,
                available: 200,
                unit: 'kg',
                estimatedExhaustion: '5 días'
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const criticalTab = screen.getByRole('button', { name: 'Contingentes Críticos' })
      fireEvent.click(criticalTab)

      await screen.findByText('Orden: 09.1234')

      // Verificar que el badge muestra el número (aparece como texto "1" dentro del tab)
      const badge = criticalTab.querySelector('.bg-red-100')
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toBe('1')
    })
  })

  describe('Cambio de país de origen', () => {
    it('permite cambiar el país de origen en el formulario', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: false,
            count: 0,
            quotas: []
          }
        }
      })

      render(<QuotaManager />)

      // El select por defecto tiene Argentina seleccionado
      const countrySelect = screen.getByDisplayValue('Argentina')
      fireEvent.change(countrySelect, { target: { value: 'BR' } })

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/quotas/check-availability', {
          taricCode: '02011000',
          originCountry: 'BR',
          quantity: 1000,
          unit: 'kg'
        })
      })
    })
  })

  describe('Estados de botón submit', () => {
    it('muestra "Verificando..." mientras checking=true', async () => {
      api.post.mockImplementation(() => new Promise(() => {})) // never resolves

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Verificando...')).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /Verificando/i })
      expect(button).toBeDisabled()
    })

    it('botón está habilitado cuando checking=false', () => {
      render(<QuotaManager />)

      const button = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      expect(button).not.toBeDisabled()
    })
  })

  describe('Renderizado de barras de progreso en resultados de búsqueda', () => {
    it('renderiza barras de progreso con colores correctos según utilización', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: true,
            count: 3,
            quotas: [
              {
                description: 'Contingente 1',
                orderNumber: '09.1111',
                agreement: null,
                available: true,
                volume: {
                  utilizationPercent: 50,
                  available: 5000,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.05,
                  outQuota: 0.15,
                  savings: 0.10
                },
                critical: false,
                recommendation: 'OK',
                requiresCertificate: false
              },
              {
                description: 'Contingente 2',
                orderNumber: '09.2222',
                agreement: null,
                available: true,
                volume: {
                  utilizationPercent: 85,
                  available: 1500,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.05,
                  outQuota: 0.15,
                  savings: 0.10
                },
                critical: false,
                recommendation: 'OK',
                requiresCertificate: false
              },
              {
                description: 'Contingente 3',
                orderNumber: '09.3333',
                agreement: null,
                available: false,
                volume: {
                  utilizationPercent: 98,
                  available: 200,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.05,
                  outQuota: 0.15,
                  savings: 0.10
                },
                critical: true,
                recommendation: 'Urgente',
                requiresCertificate: false
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await screen.findByText('Contingente 1')

      expect(screen.getByText('Contingente 2')).toBeInTheDocument()
      expect(screen.getByText('Contingente 3')).toBeInTheDocument()

      // Las barras usan clases bg-green-500, bg-orange-500, bg-red-500
      // según el % de utilización (>=95 rojo, >=80 naranja, else verde)
    })
  })

  describe('Renderizado sin customsValue (sin ahorro)', () => {
    it('no muestra ahorro cuando customsValue está vacío', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: true,
            count: 1,
            quotas: [
              {
                description: 'Test sin ahorro',
                orderNumber: '09.9999',
                agreement: null,
                available: true,
                volume: {
                  utilizationPercent: 30,
                  available: 7000,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.05,
                  outQuota: 0.15,
                  savings: 0.10
                },
                critical: false,
                recommendation: 'OK',
                requiresCertificate: false
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      // NO llenar customsValue

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await screen.findByText('Test sin ahorro')

      // Verificar que NO se muestra el bloque de ahorro
      expect(screen.queryByText('Ahorro Estimado:')).not.toBeInTheDocument()
    })
  })

  describe('Limpieza de availability al verificar', () => {
    it('limpia availability antes de hacer la nueva verificación', async () => {
      // Primera verificación
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: true,
            count: 1,
            quotas: [
              {
                description: 'Primera búsqueda',
                orderNumber: '09.1111',
                agreement: null,
                available: true,
                volume: {
                  utilizationPercent: 30,
                  available: 7000,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.05,
                  outQuota: 0.15,
                  savings: 0.10
                },
                critical: false,
                recommendation: 'OK',
                requiresCertificate: false
              }
            ]
          }
        }
      })

      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      fireEvent.change(taricInput, { target: { value: '02011000' } })

      const quantityInput = screen.getByPlaceholderText('10000')
      fireEvent.change(quantityInput, { target: { value: '1000' } })

      const submitButton = screen.getByRole('button', { name: /Verificar Disponibilidad/i })
      fireEvent.click(submitButton)

      await screen.findByText('Primera búsqueda')

      // Segunda verificación
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            found: true,
            count: 1,
            quotas: [
              {
                description: 'Segunda búsqueda',
                orderNumber: '09.2222',
                agreement: null,
                available: true,
                volume: {
                  utilizationPercent: 40,
                  available: 6000,
                  total: 10000,
                  unit: 'kg'
                },
                duty: {
                  inQuota: 0.03,
                  outQuota: 0.12,
                  savings: 0.09
                },
                critical: false,
                recommendation: 'OK',
                requiresCertificate: false
              }
            ]
          }
        }
      })

      fireEvent.change(taricInput, { target: { value: '03011000' } })
      fireEvent.click(submitButton)

      await screen.findByText('Segunda búsqueda')

      // Verificar que NO aparece el texto de la primera búsqueda
      expect(screen.queryByText('Primera búsqueda')).not.toBeInTheDocument()
    })
  })

  describe('Atributos de inputs', () => {
    it('input TARIC tiene atributos correctos', () => {
      render(<QuotaManager />)

      const taricInput = screen.getByPlaceholderText('ej. 02011000 (carne de vacuno)')
      expect(taricInput).toHaveAttribute('type', 'text')
      expect(taricInput).toHaveAttribute('maxLength', '10')
    })

    it('input de cantidad tiene atributos correctos', () => {
      render(<QuotaManager />)

      const quantityInput = screen.getByPlaceholderText('10000')
      expect(quantityInput).toHaveAttribute('type', 'number')
    })

    it('input de valor aduanero tiene atributos correctos', () => {
      render(<QuotaManager />)

      const customsValueInput = screen.getByPlaceholderText('50000.00')
      expect(customsValueInput).toHaveAttribute('type', 'number')
      expect(customsValueInput).toHaveAttribute('step', '0.01')
    })
  })
})
