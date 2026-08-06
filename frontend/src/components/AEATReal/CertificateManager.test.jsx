import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import CertificateManager from './CertificateManager'
import { aeatRealAPI } from '../../services/api'

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k })
}))

// Mock API
vi.mock('../../services/api', () => ({
  aeatRealAPI: {
    certificates: {
      list: vi.fn(),
      import: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      verify: vi.fn()
    }
  }
}))

// Mock FileReader
class MockFileReader {
  readAsDataURL(file) {
    // Simula la lectura async
    setTimeout(() => {
      this.onload({
        target: {
          result: 'data:application/x-pkcs12;base64,QUJDREVG'
        }
      })
    }, 0)
  }
}

describe('CertificateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global FileReader
    global.FileReader = MockFileReader
    // Mock window.confirm
    vi.spyOn(window, 'confirm')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial load and empty state', () => {
    test('renders loading state initially', () => {
      aeatRealAPI.certificates.list.mockReturnValue(new Promise(() => {}))
      render(<CertificateManager />)
      expect(screen.getByText('Cargando certificados...')).toBeInTheDocument()
    })

    test('renders empty state when no certificates', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')
      expect(screen.getByText('Importe un certificado digital FNMT para comenzar')).toBeInTheDocument()
    })

    test('handles list API error gracefully', async () => {
      aeatRealAPI.certificates.list.mockRejectedValue(new Error('Network error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(<CertificateManager />)
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar certificados')
      })
      expect(screen.getByText('No hay certificados')).toBeInTheDocument()
      consoleErrorSpy.mockRestore()
    })

    test('handles list API with non-array data', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: null }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')
    })

    test('handles list API with success false', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: false }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')
    })
  })

  describe('Certificate list rendering', () => {
    const mockCertificates = [
      {
        alias: 'cert-test-1',
        type: 'FNMT_PJ',
        subject: 'CN=Test Company',
        subjectDetails: { serialNumber: 'B12345678' },
        validTo: '2027-12-31T23:59:59.000Z',
        isValid: true,
        daysUntilExpiry: 500
      },
      {
        alias: 'cert-test-2',
        type: 'FNMT_PF',
        subject: { CN: 'John Doe' },
        subjectDetails: { CN: 'John Doe', serialNumber: '12345678A' },
        validTo: '2026-09-15T23:59:59.000Z',
        isValid: true,
        daysUntilExpiry: 25
      },
      {
        alias: 'cert-invalid',
        type: 'FNMT_REP',
        subject: 'CN=Invalid Cert',
        validTo: '2025-01-01T00:00:00.000Z',
        isValid: false,
        daysUntilExpiry: -200
      }
    ]

    test('renders certificates table with all rows', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: mockCertificates }
      })
      render(<CertificateManager />)
      await screen.findByText('cert-test-1')
      expect(screen.getByText('cert-test-2')).toBeInTheDocument()
      expect(screen.getByText('cert-invalid')).toBeInTheDocument()
    })

    test('renders certificate type labels correctly', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: mockCertificates }
      })
      render(<CertificateManager />)
      await screen.findByText('Persona Jurídica')
      expect(screen.getByText('Persona Física')).toBeInTheDocument()
      expect(screen.getByText('Representante')).toBeInTheDocument()
    })

    test('renders unknown certificate type as fallback', async () => {
      const certUnknown = {
        alias: 'cert-unknown',
        type: 'UNKNOWN_TYPE',
        subject: 'CN=Unknown',
        validTo: '2027-01-01T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 300
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [certUnknown] }
      })
      render(<CertificateManager />)
      await screen.findByText('UNKNOWN_TYPE')
    })

    test('renders valid certificate badge', async () => {
      const validCert = {
        alias: 'cert-valid',
        type: 'FNMT_PJ',
        subject: 'CN=Valid',
        validTo: '2027-01-01T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 300
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [validCert] }
      })
      render(<CertificateManager />)
      await screen.findByText('Válido')
    })

    test('renders expiring soon certificate badge', async () => {
      const expiringSoon = {
        alias: 'cert-expiring',
        type: 'FNMT_PJ',
        subject: 'CN=Expiring',
        validTo: '2026-09-15T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 20
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [expiringSoon] }
      })
      render(<CertificateManager />)
      await waitFor(() => {
        expect(screen.getByText(/Por expirar/)).toBeInTheDocument()
      })
    })

    test('renders invalid certificate badge', async () => {
      const invalidCert = {
        alias: 'cert-invalid',
        type: 'FNMT_PJ',
        subject: 'CN=Invalid',
        validTo: '2025-01-01T00:00:00.000Z',
        isValid: false,
        daysUntilExpiry: -100
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [invalidCert] }
      })
      render(<CertificateManager />)
      await screen.findByText('Inválido')
    })

    test('handles subject as string format', async () => {
      const cert = {
        alias: 'cert-string-subject',
        type: 'FNMT_PJ',
        subject: 'CN=String Subject',
        validTo: '2027-01-01T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 300
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [cert] }
      })
      render(<CertificateManager />)
      await screen.findByText('CN=String Subject')
    })

    test('handles subject as object with CN', async () => {
      const cert = {
        alias: 'cert-object-subject',
        type: 'FNMT_PJ',
        subject: { CN: 'Object CN' },
        validTo: '2027-01-01T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 300
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [cert] }
      })
      render(<CertificateManager />)
      await screen.findByText('Object CN')
    })

    test('handles subject with subjectDetails CN fallback', async () => {
      const cert = {
        alias: 'cert-details-cn',
        type: 'FNMT_PJ',
        subject: {},
        subjectDetails: { CN: 'Details CN' },
        validTo: '2027-01-01T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 300
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [cert] }
      })
      render(<CertificateManager />)
      await screen.findByText('Details CN')
    })

    test('handles subject with N/A fallback', async () => {
      const cert = {
        alias: 'cert-no-cn',
        type: 'FNMT_PJ',
        subject: {},
        validTo: '2027-01-01T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 300
      }
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [cert] }
      })
      render(<CertificateManager />)
      await screen.findByText('N/A')
    })
  })

  describe('includeExpired filter', () => {
    test('toggles includeExpired and reloads certificates', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const checkbox = screen.getByLabelText('Incluir expirados')
      expect(checkbox.checked).toBe(false)

      fireEvent.click(checkbox)
      await waitFor(() => {
        expect(aeatRealAPI.certificates.list).toHaveBeenCalledWith(true)
      })

      fireEvent.click(checkbox)
      await waitFor(() => {
        expect(aeatRealAPI.certificates.list).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Manual refresh', () => {
    test('clicking Actualizar reloads certificates', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      aeatRealAPI.certificates.list.mockClear()
      const refreshButton = screen.getByRole('button', { name: /Actualizar/i })
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(aeatRealAPI.certificates.list).toHaveBeenCalled()
      })
    })
  })

  describe('Import modal', () => {
    test('opens import modal when clicking Importar Certificado', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      // Usar el botón del header (primero en el DOM)
      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      expect(screen.getByText('Importar Certificado Digital')).toBeInTheDocument()
    })

    test('closes import modal when clicking close button', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])
      expect(screen.getByText('Importar Certificado Digital')).toBeInTheDocument()

      // Botón X dentro del modal
      const modalContainer = screen.getByText('Importar Certificado Digital').parentElement
      const closeButton = modalContainer.querySelector('button')
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Importar Certificado Digital')).not.toBeInTheDocument()
      })
    })

    test('closes modal when clicking Cancel button', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])
      const cancelButton = screen.getByRole('button', { name: 'Cancelar' })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Importar Certificado Digital')).not.toBeInTheDocument()
      })
    })

    test('closes modal when clicking overlay', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])
      const overlay = document.querySelector('.fixed.inset-0.bg-gray-500')
      fireEvent.click(overlay)

      await waitFor(() => {
        expect(screen.queryByText('Importar Certificado Digital')).not.toBeInTheDocument()
      })
    })
  })

  describe('Import form validation', () => {
    test('shows error when submitting without file', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const passwordInput = screen.getByPlaceholderText('Contraseña')
      fireEvent.change(passwordInput, { target: { value: 'test123' } })

      // Submit form
      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Seleccione un certificado e ingrese la contraseña')
      })
    })

    test('shows error when submitting without password', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      // No ingresar password, solo intentar enviar
      const passwordInput = screen.getByPlaceholderText('Contraseña')
      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Seleccione un certificado e ingrese la contraseña')
      })
    })
  })

  describe('Import certificate', () => {
    test('imports certificate successfully', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      aeatRealAPI.certificates.import.mockResolvedValue({
        data: { success: true }
      })

      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['cert-content'], 'cert.p12', { type: 'application/x-pkcs12' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      let passwordInput
      await waitFor(() => {
        passwordInput = screen.getByPlaceholderText('Contraseña')
        fireEvent.change(passwordInput, { target: { value: 'test123' } })
      })

      const aliasInput = screen.getByPlaceholderText('Nombre identificativo')
      fireEvent.change(aliasInput, { target: { value: 'mi-cert' } })

      const typeSelect = screen.getByDisplayValue('Persona Jurídica FNMT')
      fireEvent.change(typeSelect, { target: { value: 'FNMT_PF' } })

      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(aeatRealAPI.certificates.import).toHaveBeenCalledWith({
          certificateBase64: 'QUJDREVG',
          password: 'test123',
          type: 'FNMT_PF',
          alias: 'mi-cert'
        })
        expect(toast.success).toHaveBeenCalledWith('Certificado importado correctamente')
      })
    })

    test('imports certificate without optional alias', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      aeatRealAPI.certificates.import.mockResolvedValue({
        data: { success: true }
      })

      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['cert-content'], 'cert.p12', { type: 'application/x-pkcs12' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      let passwordInput
      await waitFor(() => {
        passwordInput = screen.getByPlaceholderText('Contraseña')
        fireEvent.change(passwordInput, { target: { value: 'test123' } })
      })

      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(aeatRealAPI.certificates.import).toHaveBeenCalledWith({
          certificateBase64: 'QUJDREVG',
          password: 'test123',
          type: 'FNMT_PJ',
          alias: undefined
        })
      })
    })

    test('handles import error with API error message', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      aeatRealAPI.certificates.import.mockRejectedValue({
        response: {
          data: {
            error: 'Invalid certificate format'
          }
        }
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['cert-content'], 'cert.p12', { type: 'application/x-pkcs12' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      let passwordInput
      await waitFor(() => {
        passwordInput = screen.getByPlaceholderText('Contraseña')
        fireEvent.change(passwordInput, { target: { value: 'test123' } })
      })

      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid certificate format')
      })
      consoleErrorSpy.mockRestore()
    })

    test('handles import error with generic message', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      aeatRealAPI.certificates.import.mockRejectedValue(new Error('Network error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['cert-content'], 'cert.p12', { type: 'application/x-pkcs12' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      let passwordInput
      await waitFor(() => {
        passwordInput = screen.getByPlaceholderText('Contraseña')
        fireEvent.change(passwordInput, { target: { value: 'test123' } })
      })

      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al importar certificado')
      })
      consoleErrorSpy.mockRestore()
    })

    test('shows importing state while import is in progress', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      aeatRealAPI.certificates.import.mockReturnValue(new Promise(() => {}))

      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['cert-content'], 'cert.p12', { type: 'application/x-pkcs12' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      let passwordInput
      await waitFor(() => {
        passwordInput = screen.getByPlaceholderText('Contraseña')
        fireEvent.change(passwordInput, { target: { value: 'test123' } })
      })

      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Importando...')).toBeInTheDocument()
      })
    })

    test('resets form after successful import', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [] }
      })
      aeatRealAPI.certificates.import.mockResolvedValue({
        data: { success: true }
      })

      render(<CertificateManager />)
      await screen.findByText('No hay certificados')

      const importButtons = screen.getAllByText('Importar Certificado')
      fireEvent.click(importButtons[0])

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['cert-content'], 'cert.p12', { type: 'application/x-pkcs12' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      let passwordInput
      await waitFor(() => {
        passwordInput = screen.getByPlaceholderText('Contraseña')
        fireEvent.change(passwordInput, { target: { value: 'test123' } })
      })

      const aliasInput = screen.getByPlaceholderText('Nombre identificativo')
      fireEvent.change(aliasInput, { target: { value: 'mi-cert' } })

      const form = passwordInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.queryByText('Importar Certificado Digital')).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete certificate', () => {
    const mockCert = {
      alias: 'cert-to-delete',
      type: 'FNMT_PJ',
      subject: 'CN=Test',
      validTo: '2027-12-31T23:59:59.000Z',
      isValid: true,
      daysUntilExpiry: 500
    }

    test('deletes certificate when confirmed', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.delete.mockResolvedValue({
        data: { success: true }
      })
      window.confirm.mockReturnValue(true)

      render(<CertificateManager />)
      await screen.findByText('cert-to-delete')

      const deleteButtons = screen.getAllByTitle('Eliminar')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('¿Eliminar el certificado "cert-to-delete"?')
        expect(aeatRealAPI.certificates.delete).toHaveBeenCalledWith('cert-to-delete')
        expect(toast.success).toHaveBeenCalledWith('Certificado eliminado')
      })
    })

    test('does not delete when user cancels confirmation', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      window.confirm.mockReturnValue(false)

      render(<CertificateManager />)
      await screen.findByText('cert-to-delete')

      const deleteButtons = screen.getAllByTitle('Eliminar')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled()
      })
      expect(aeatRealAPI.certificates.delete).not.toHaveBeenCalled()
    })

    test('handles delete error', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.delete.mockRejectedValue(new Error('Delete failed'))
      window.confirm.mockReturnValue(true)

      render(<CertificateManager />)
      await screen.findByText('cert-to-delete')

      const deleteButtons = screen.getAllByTitle('Eliminar')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al eliminar certificado')
      })
    })
  })

  describe('View certificate details', () => {
    const mockCert = {
      alias: 'cert-details',
      type: 'FNMT_PJ',
      subject: 'CN=Test',
      validTo: '2027-12-31T23:59:59.000Z',
      isValid: true,
      daysUntilExpiry: 500
    }

    const mockAnalysis = {
      certificate: {
        serialNumber: '1234567890ABCDEF',
        issuer: { O: 'FNMT' },
        validFrom: '2024-01-01T00:00:00.000Z',
        validTo: '2027-12-31T23:59:59.000Z',
        daysUntilExpiry: 500
      },
      analysis: {
        recommendations: ['Certificado válido para uso en producción'],
        warnings: ['Renovar antes de 30 días del vencimiento']
      }
    }

    test('shows certificate details when clicking info button', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.get.mockResolvedValue({
        data: { success: true, data: mockAnalysis }
      })

      render(<CertificateManager />)
      await screen.findByText('cert-details')

      const infoButton = screen.getByTitle('Ver detalles')
      fireEvent.click(infoButton)

      await waitFor(() => {
        expect(aeatRealAPI.certificates.get).toHaveBeenCalledWith('cert-details')
        expect(screen.getByText('Detalles del Certificado: cert-details')).toBeInTheDocument()
        expect(screen.getByText('1234567890ABCDEF')).toBeInTheDocument()
      })
    })

    test('shows LUCI analysis with recommendations', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.get.mockResolvedValue({
        data: { success: true, data: mockAnalysis }
      })

      render(<CertificateManager />)
      await screen.findByText('cert-details')

      const infoButton = screen.getByTitle('Ver detalles')
      fireEvent.click(infoButton)

      await waitFor(() => {
        expect(screen.getByText('Certificado válido para uso en producción')).toBeInTheDocument()
        expect(screen.getByText('Renovar antes de 30 días del vencimiento')).toBeInTheDocument()
      })
    })

    test('closes details panel when clicking X', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.get.mockResolvedValue({
        data: { success: true, data: mockAnalysis }
      })

      render(<CertificateManager />)
      await screen.findByText('cert-details')

      const infoButton = screen.getByTitle('Ver detalles')
      fireEvent.click(infoButton)

      await waitFor(() => {
        expect(screen.getByText('Detalles del Certificado: cert-details')).toBeInTheDocument()
      })

      const closeButtons = screen.getAllByRole('button', { name: '' })
      const closeButton = closeButtons.find(btn =>
        btn.closest('.mt-6') && btn.querySelector('svg')
      )
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Detalles del Certificado: cert-details')).not.toBeInTheDocument()
      })
    })

    test('handles get details error', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.get.mockRejectedValue(new Error('Get failed'))

      render(<CertificateManager />)
      await screen.findByText('cert-details')

      const infoButton = screen.getByTitle('Ver detalles')
      fireEvent.click(infoButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al obtener detalles')
      })
    })

    test('shows details without analysis section if not present', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            certificate: mockAnalysis.certificate
            // No analysis section
          }
        }
      })

      render(<CertificateManager />)
      await screen.findByText('cert-details')

      const infoButton = screen.getByTitle('Ver detalles')
      fireEvent.click(infoButton)

      await waitFor(() => {
        expect(screen.getByText('Detalles del Certificado: cert-details')).toBeInTheDocument()
        expect(screen.getByText('1234567890ABCDEF')).toBeInTheDocument()
      })
      expect(screen.queryByText('Análisis LUCI')).not.toBeInTheDocument()
    })
  })

  describe('Verify certificate', () => {
    const mockCert = {
      alias: 'cert-verify',
      type: 'FNMT_PJ',
      subject: 'CN=Test',
      validTo: '2027-12-31T23:59:59.000Z',
      isValid: true,
      daysUntilExpiry: 500
    }

    test('shows success message when certificate is valid', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.verify.mockResolvedValue({
        data: {
          success: true,
          data: { isValid: true }
        }
      })

      render(<CertificateManager />)
      await screen.findByText('cert-verify')

      const verifyButton = screen.getByTitle('Verificar')
      fireEvent.click(verifyButton)

      await waitFor(() => {
        expect(aeatRealAPI.certificates.verify).toHaveBeenCalledWith('cert-verify')
        expect(toast.success).toHaveBeenCalledWith('Certificado válido')
      })
    })

    test('shows error message when certificate is invalid', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.verify.mockResolvedValue({
        data: {
          success: true,
          data: {
            isValid: false,
            errors: ['Certificate expired', 'Invalid signature']
          }
        }
      })

      render(<CertificateManager />)
      await screen.findByText('cert-verify')

      const verifyButton = screen.getByTitle('Verificar')
      fireEvent.click(verifyButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Certificado inválido: Certificate expired, Invalid signature')
      })
    })

    test('handles verify API error', async () => {
      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [mockCert] }
      })
      aeatRealAPI.certificates.verify.mockRejectedValue(new Error('Verify failed'))

      render(<CertificateManager />)
      await screen.findByText('cert-verify')

      const verifyButton = screen.getByTitle('Verificar')
      fireEvent.click(verifyButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al verificar certificado')
      })
    })
  })

  describe('getCertificateStatusBadge helper', () => {
    test('renders all three badge states in same render', async () => {
      const certs = [
        {
          alias: 'valid',
          type: 'FNMT_PJ',
          subject: 'CN=Valid',
          validTo: '2027-12-31T23:59:59.000Z',
          isValid: true,
          daysUntilExpiry: 500
        },
        {
          alias: 'expiring',
          type: 'FNMT_PJ',
          subject: 'CN=Expiring',
          validTo: '2026-09-15T23:59:59.000Z',
          isValid: true,
          daysUntilExpiry: 20
        },
        {
          alias: 'invalid',
          type: 'FNMT_PJ',
          subject: 'CN=Invalid',
          validTo: '2025-01-01T00:00:00.000Z',
          isValid: false,
          daysUntilExpiry: -100
        }
      ]

      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: certs }
      })

      render(<CertificateManager />)

      await screen.findByText('valid')
      expect(screen.getByText('Válido')).toBeInTheDocument()
      expect(screen.getByText(/Por expirar/)).toBeInTheDocument()
      expect(screen.getByText('Inválido')).toBeInTheDocument()
    })

    test('covers exact boundary of 30 days', async () => {
      const cert = {
        alias: 'boundary',
        type: 'FNMT_PJ',
        subject: 'CN=Boundary',
        validTo: '2026-09-06T00:00:00.000Z',
        isValid: true,
        daysUntilExpiry: 30
      }

      aeatRealAPI.certificates.list.mockResolvedValue({
        data: { success: true, data: [cert] }
      })

      render(<CertificateManager />)
      await waitFor(() => {
        expect(screen.getByText(/Por expirar/)).toBeInTheDocument()
      })
    })
  })
})
