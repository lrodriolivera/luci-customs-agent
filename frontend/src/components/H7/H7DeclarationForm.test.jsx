import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import H7DeclarationForm from './H7DeclarationForm'

// Mock dependencies
vi.mock('./EU2026382Banner', () => ({
  default: () => null
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => opts ? `${key}${JSON.stringify(opts)}` : key
  })
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
  useNavigate: () => mockNavigate
}))

// Mock API services - must be inside factory
vi.mock('../../services/api', () => ({
  expeditionsAPI: {
    get: vi.fn()
  },
  declarationsAPI: {
    checkH7Eligibility: vi.fn(),
    generateH7: vi.fn(),
    submitH7: vi.fn()
  }
}))

// Access mocked services after import
import { expeditionsAPI as mockExpeditionsAPI, declarationsAPI as mockDeclarationsAPI } from '../../services/api'

describe('H7DeclarationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    // Cleanup
  })

  const mockExpeditionData = {
    expeditionId: 'EXP-001',
    client: {
      companyName: 'Test Company'
    },
    exporter: {
      country: 'CN'
    },
    goodsSummary: {
      totalValue: 100
    },
    goods: [
      {
        description: 'Test Product',
        taricCode: '6203.42.90',
        originCountry: 'CN',
        invoiceValue: 100
      }
    ]
  }

  const mockEligibilityData = {
    eligible: true,
    reason: 'Value under 150 EUR'
  }

  it('should render loading spinner initially', async () => {
    mockExpeditionsAPI.get.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ data: { data: mockExpeditionData } }), 100)
    }))
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const { container } = render(<H7DeclarationForm expeditionId="EXP-001" />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()

    // Let it finish loading
    await screen.findByText('h7.h7Declaration')
  })

  it('should show expedition not found when API returns null directly', async () => {
    // When API returns null as top-level data (not wrapped)
    // Line 66: setExpedition(expResponse.data.data || expResponse.data)
    // If data.data is null, falls back to expResponse.data which is { data: null }
    // This is a bug: expedition becomes { data: null } which is truthy
    // To trigger the !expedition check, we need expResponse.data itself to be falsy
    mockExpeditionsAPI.get.mockResolvedValue({
      data: null
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    // Wait for loading to finish and error card to appear
    await waitFor(() => {
      const errorCard = document.querySelector('.bg-red-50.border-red-200')
      expect(errorCard).toBeTruthy()
      expect(errorCard.textContent).toContain('h7.expeditionNotFound')
    })
  })

  it('should load expedition data successfully (ES country)', async () => {
    localStorage.setItem('activeCustomsCountry', 'ES')
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.getByText('AEAT')).toBeInTheDocument()
    expect(screen.getByText('Cambiar a NL')).toBeInTheDocument()
    expect(screen.getByText('h7.eligible')).toBeInTheDocument()
    expect(screen.getByText('Test Company')).toBeInTheDocument()
  })

  it('should load expedition data successfully (NL country)', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.getByText('DECO')).toBeInTheDocument()
    expect(screen.getByText('Cambiar a ES')).toBeInTheDocument()
    expect(screen.getByText('DECO - Paises Bajos')).toBeInTheDocument()
  })

  it('should switch country when clicking country toggle button', async () => {
    localStorage.setItem('activeCustomsCountry', 'ES')
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('Cambiar a NL')
    const switchButton = screen.getByText('Cambiar a NL')
    fireEvent.click(switchButton)

    expect(localStorage.getItem('activeCustomsCountry')).toBe('NL')
    expect(screen.getByText('DECO')).toBeInTheDocument()
    expect(screen.getByText('Cambiar a ES')).toBeInTheDocument()
  })

  it('should show not eligible warning when expedition exceeds value limit', async () => {
    const notEligibleData = {
      eligible: false,
      reason: 'Value exceeds 150 EUR limit'
    }

    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpeditionData, goodsSummary: { totalValue: 200 } } }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: notEligibleData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.eligibilityWarning')
    expect(screen.getByText('Value exceeds 150 EUR limit')).toBeInTheDocument()
    expect(screen.getByText('200.00 EUR')).toBeInTheDocument()
  })

  it('should handle input changes correctly', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')

    const iossInput = screen.getByPlaceholderText('IM372XXXXXXXXX')
    fireEvent.change(iossInput, { target: { value: 'IM372123456789' } })
    expect(iossInput.value).toBe('IM372123456789')

    const customsOfficeSelect = screen.getByDisplayValue('Valencia (ES000101)')
    fireEvent.change(customsOfficeSelect, { target: { value: 'ES000301' } })
    expect(customsOfficeSelect.value).toBe('ES000301')

    const docPrevioRef = screen.getByPlaceholderText('Ej: G4-2801-2026-00001 o MRN del G4')
    fireEvent.change(docPrevioRef, { target: { value: 'G4-2801-2026-00001' } })
    expect(docPrevioRef.value).toBe('G4-2801-2026-00001')
  })

  it('should handle checkbox input change correctly', async () => {
    const notEligibleData = {
      eligible: false,
      reason: 'Value exceeds limit'
    }

    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpeditionData, goodsSummary: { totalValue: 200 } } }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: notEligibleData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.forceGenerate')

    const forceCheckbox = screen.getByRole('checkbox')
    expect(forceCheckbox.checked).toBe(false)

    fireEvent.click(forceCheckbox)
    expect(forceCheckbox.checked).toBe(true)

    fireEvent.click(forceCheckbox)
    expect(forceCheckbox.checked).toBe(false)
  })

  it('should generate H7 successfully and show success message', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft',
      vatCalculation: {
        intrinsicValue: 100,
        vatRate: 21,
        vatAmount: 21,
        totalToPay: 21
      }
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('h7.h7Generated')
    expect(screen.getByText('h7.h7Summary')).toBeInTheDocument()
    expect(screen.getByText('ES123456789')).toBeInTheDocument()

    // Success message is shown (testing setTimeout is not necessary for coverage)
  })

  it('should handle generateH7 error with response data', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    mockDeclarationsAPI.generateH7.mockRejectedValue({
      response: { data: { error: 'Invalid customs office' } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('Invalid customs office')
    expect(screen.getByText('Invalid customs office')).toBeInTheDocument()
  })

  it('should handle generateH7 error without response data', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    mockDeclarationsAPI.generateH7.mockRejectedValue(new Error('Network error'))

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('h7.errorGenerating')
    expect(screen.getByText('h7.errorGenerating')).toBeInTheDocument()
  })

  it('should disable generate button when not eligible and forceGenerate is false', async () => {
    const notEligibleData = {
      eligible: false,
      reason: 'Value too high'
    }

    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpeditionData, goodsSummary: { totalValue: 200 } } }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: notEligibleData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    expect(generateButton).toBeDisabled()

    // Enable when forceGenerate is checked
    const forceCheckbox = screen.getByRole('checkbox')
    fireEvent.click(forceCheckbox)
    expect(generateButton).not.toBeDisabled()
  })

  it('should submit H7 successfully and call onSuccess', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft',
      vatCalculation: {
        intrinsicValue: 100,
        vatRate: 21,
        vatAmount: 21,
        totalToPay: 21
      }
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    const submittedDeclaration = {
      ...h7Declaration,
      status: 'submitted',
      mrn: 'ES123456789MRN0001'
    }

    mockDeclarationsAPI.submitH7.mockResolvedValue({
      data: {
        success: true,
        data: {
          declaration: submittedDeclaration,
          mrn: 'ES123456789MRN0001'
        }
      }
    })

    const onSuccess = vi.fn()
    render(<H7DeclarationForm expeditionId="EXP-001" onSuccess={onSuccess} />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('ens.sendToAeat')
    const submitButton = screen.getByText('ens.sendToAeat')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        declaration: submittedDeclaration,
        mrn: 'ES123456789MRN0001'
      })
    })

    expect(screen.getByText('Enviada - MRN: ES123456789MRN0001')).toBeInTheDocument()
  })

  it('should handle submitH7 error with response data', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft'
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    mockDeclarationsAPI.submitH7.mockRejectedValue({
      response: { data: { error: 'AEAT service unavailable' } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('ens.sendToAeat')
    const submitButton = screen.getByText('ens.sendToAeat')
    fireEvent.click(submitButton)

    await screen.findByText('AEAT service unavailable')
    expect(screen.getByText('AEAT service unavailable')).toBeInTheDocument()
  })

  it('should handle submitH7 error without response data', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft'
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    mockDeclarationsAPI.submitH7.mockRejectedValue(new Error('Network error'))

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('ens.sendToAeat')
    const submitButton = screen.getByText('ens.sendToAeat')
    fireEvent.click(submitButton)

    await screen.findByText('h7.errorSubmitting')
    expect(screen.getByText('h7.errorSubmitting')).toBeInTheDocument()
  })

  it('should hide form when H7 is submitted', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            mrn: 'ES123456789MRN0001',
            status: 'submitted'
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('Enviada - MRN: ES123456789MRN0001')
    expect(screen.queryByText('h7.generateH7')).not.toBeInTheDocument()
    expect(screen.queryByText('ens.sendToAeat')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('IM372XXXXXXXXX')).not.toBeInTheDocument()
  })

  it('should disable inputs when H7 is generated', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft'
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('ens.sendToAeat')

    const iossInput = screen.getByPlaceholderText('IM372XXXXXXXXX')
    expect(iossInput).toBeDisabled()

    const customsOfficeSelect = screen.getByDisplayValue('Valencia (ES000101)')
    expect(customsOfficeSelect).toBeDisabled()
  })

  it('should allow regeneration of H7', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft'
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('h7.regenerate')
    const regenerateButton = screen.getByText('h7.regenerate')
    fireEvent.click(regenerateButton)

    expect(screen.queryByText('ES123456789')).not.toBeInTheDocument()
    expect(screen.getByText('h7.generateH7')).toBeInTheDocument()

    const iossInput = screen.getByPlaceholderText('IM372XXXXXXXXX')
    expect(iossInput).not.toBeDisabled()
  })

  it('should load existing H7 declaration from expedition', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            status: 'draft',
            vatCalculation: {
              intrinsicValue: 100,
              vatRate: 21,
              vatAmount: 21,
              totalToPay: 21
            }
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Summary')
    expect(screen.getByText('ES123456789')).toBeInTheDocument()
    expect(screen.getByText('ens.sendToAeat')).toBeInTheDocument()
  })

  it('should render green channel result when present', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            mrn: 'ES123456789MRN0001',
            status: 'submitted',
            channel: 'green',
            levanteNumber: 'LEV-001'
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.greenChannelRelease')
    expect(screen.getByText('h7.greenChannelMsg')).toBeInTheDocument()
    expect(screen.getByText(/LEV-001/)).toBeInTheDocument()
  })

  it('should render yellow channel result when present', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            mrn: 'ES123456789MRN0001',
            status: 'submitted',
            channel: 'yellow'
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.yellowChannelPending')
    expect(screen.getByText('h7.yellowChannelMsg')).toBeInTheDocument()
  })

  it('should render IOSS indicator when present', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            status: 'draft',
            vatCalculation: {
              intrinsicValue: 100,
              vatRate: 21,
              vatAmount: 21,
              totalToPay: 21
            },
            h7Data: {
              iossData: {
                iossNumber: 'IM372123456789'
              }
            }
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText(/IM372123456789/)
    expect(screen.getByText(/IM372123456789/)).toBeInTheDocument()
  })

  it('should render products list with details', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('Test Product')
    expect(screen.getByText('Test Product')).toBeInTheDocument()
    // Value appears multiple times - check it exists
    expect(screen.getAllByText('100.00 EUR').length).toBeGreaterThan(0)
  })

  it('should handle fetch error on mount', async () => {
    mockExpeditionsAPI.get.mockRejectedValue({
      response: { data: { error: 'Expedition not found' } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    // When there's an error, expedition stays null and shows expeditionNotFound card
    await waitFor(() => {
      const errorCard = document.querySelector('.bg-red-50')
      expect(errorCard).toBeTruthy()
      expect(errorCard.textContent).toContain('h7.expeditionNotFound')
    })
  })

  it('should use expeditionId from prop when provided', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="PROP-EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(mockExpeditionsAPI.get).toHaveBeenCalledWith('PROP-EXP-001')
  })

  it('should render fallback values when optional data is missing', async () => {
    const minimalExpedition = {
      expeditionId: 'EXP-MIN',
      goodsSummary: {
        totalValue: 50
      }
    }

    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: minimalExpedition }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-MIN" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0)
    expect(screen.getByText('0 producto(s)')).toBeInTheDocument()
  })

  it('should show forceGenerate checkbox only when not eligible and H7 not generated', async () => {
    const notEligibleData = {
      eligible: false,
      reason: 'Value too high'
    }

    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: { ...mockExpeditionData, goodsSummary: { totalValue: 200 } } }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: notEligibleData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.forceGenerate')
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('should not show forceGenerate checkbox when eligible', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.queryByText('h7.forceGenerate')).not.toBeInTheDocument()
  })

  it('should render NL-specific UI elements when country is NL', async () => {
    localStorage.setItem('activeCustomsCountry', 'NL')
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.getByPlaceholderText('IMNL00XXXXXXXXX')).toBeInTheDocument()
    expect(screen.getByText('Rotterdam (NL000010)')).toBeInTheDocument()
    expect(screen.queryByText('Documento Previo G4 (N337)')).not.toBeInTheDocument()
  })

  it('should render ES-specific UI elements when country is ES', async () => {
    localStorage.setItem('activeCustomsCountry', 'ES')
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.getByPlaceholderText('IM372XXXXXXXXX')).toBeInTheDocument()
    expect(screen.getByText('Documento Previo G4 (N337)')).toBeInTheDocument()
    expect(screen.queryByText('DECO - Paises Bajos')).not.toBeInTheDocument()
  })

  it('should call generateH7 with correct parameters including IOSS and documentoPrevio', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft'
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')

    const iossInput = screen.getByPlaceholderText('IM372XXXXXXXXX')
    fireEvent.change(iossInput, { target: { value: 'IM372123456789' } })

    const docPrevioRef = screen.getByPlaceholderText('Ej: G4-2801-2026-00001 o MRN del G4')
    fireEvent.change(docPrevioRef, { target: { value: 'G4-2801-2026-00001' } })

    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('h7.h7Summary')

    expect(mockDeclarationsAPI.generateH7).toHaveBeenCalledWith({
      expeditionId: 'EXP-001',
      iossNumber: 'IM372123456789',
      customsOffice: 'ES000101',
      documentoPrevio: {
        tipo: 'N337',
        referencia: 'G4-2801-2026-00001',
        descripcion: 'Deposito temporal G4'
      },
      forceGenerate: false
    })
  })

  it('should handle generateH7 with empty IOSS by passing undefined', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    const h7Declaration = {
      lrn: 'ES123456789',
      status: 'draft'
    }

    mockDeclarationsAPI.generateH7.mockResolvedValue({
      data: { success: true, data: { declaration: h7Declaration } }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.generateH7')
    const generateButton = screen.getByText('h7.generateH7')
    fireEvent.click(generateButton)

    await screen.findByText('h7.h7Summary')

    expect(mockDeclarationsAPI.generateH7).toHaveBeenCalledWith(
      expect.objectContaining({
        iossNumber: undefined
      })
    )
  })

  it('should show VAT calculation details when present', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            status: 'draft',
            vatCalculation: {
              intrinsicValue: 100,
              vatRate: 21,
              vatAmount: 21,
              totalToPay: 21
            }
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.dutyCalculation')
    // 21.00 EUR appears both as VAT amount and total to pay
    expect(screen.getAllByText('21.00 EUR').length).toBeGreaterThan(0)
  })

  it('should use totalValue fallback when vatCalculation.intrinsicValue is missing', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: {
        data: {
          ...mockExpeditionData,
          declaration: {
            type: 'H7',
            lrn: 'ES123456789',
            status: 'draft',
            vatCalculation: {
              vatRate: 21,
              vatAmount: 21,
              totalToPay: 21
            }
          }
        }
      }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.dutyCalculation')
    // 100.00 EUR appears in eligibility card and in VAT calculation - verify both exist
    expect(screen.getAllByText('100.00 EUR').length).toBeGreaterThan(0)
  })

  it('should render default country as ES when localStorage is empty', async () => {
    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: mockExpeditionData }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('h7.h7Declaration')
    expect(screen.getByText('AEAT')).toBeInTheDocument()
    expect(localStorage.getItem('activeCustomsCountry')).toBeNull()
  })

  it('should render product with missing taricCode as no classification', async () => {
    const expeditionWithoutTaric = {
      ...mockExpeditionData,
      goodsSummary: {
        totalValue: 50
      },
      goods: [
        {
          description: 'Unclassified Product',
          originCountry: 'CN',
          invoiceValue: 50
        }
      ]
    }

    mockExpeditionsAPI.get.mockResolvedValue({
      data: { data: expeditionWithoutTaric }
    })
    mockDeclarationsAPI.checkH7Eligibility.mockResolvedValue({
      data: { data: mockEligibilityData }
    })

    render(<H7DeclarationForm expeditionId="EXP-001" />)

    await screen.findByText('Unclassified Product')
    // Find the specific product details section (there are multiple .text-xs.text-gray-500)
    const productCard = screen.getByText('Unclassified Product').closest('.bg-gray-50')
    expect(productCard.textContent).toContain('h7.noClassification')
  })
})
