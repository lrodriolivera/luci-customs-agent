import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RulesEngineAnalyzer from './RulesEngineAnalyzer'

// Mock de react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

// Mock de react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock de api con export default
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn()
  }
}))

import toast from 'react-hot-toast'
import api from '../../services/api'

describe('RulesEngineAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Resetear el mock para que no mantenga resolvedValues previos
    api.post.mockReset()
  })

  it('renderiza el título y subtítulo traducidos', () => {
    render(<RulesEngineAnalyzer />)
    expect(screen.getByText('rulesEngine.title')).toBeInTheDocument()
    expect(screen.getByText('rulesEngine.subtitle')).toBeInTheDocument()
  })

  it('renderiza el formulario con valores iniciales', () => {
    render(<RulesEngineAnalyzer />)
    expect(screen.getByText('Datos de la Operación')).toBeInTheDocument()
    expect(screen.getByText('Tipo de Operación')).toBeInTheDocument()
    expect(screen.getByText('País de Origen')).toBeInTheDocument()
    expect(screen.getByText('País de Destino')).toBeInTheDocument()
    expect(screen.getByText('Productos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analizar Operación/i })).toBeInTheDocument()
  })

  it('renderiza el mensaje inicial cuando no hay análisis', () => {
    render(<RulesEngineAnalyzer />)
    expect(screen.getByText(/Complete el formulario y haga clic en "Analizar Operación" para ver los resultados/i)).toBeInTheDocument()
  })

  it('cambia el tipo de operación', () => {
    const { container } = render(<RulesEngineAnalyzer />)
    const selects = container.querySelectorAll('select')
    const typeSelect = selects[0]
    fireEvent.change(typeSelect, { target: { value: 'export' } })
    expect(typeSelect.value).toBe('export')
  })

  it('cambia el país de origen', () => {
    const { container } = render(<RulesEngineAnalyzer />)
    const selects = container.querySelectorAll('select')
    const originSelect = selects[1]
    fireEvent.change(originSelect, { target: { value: 'US' } })
    expect(originSelect.value).toBe('US')
  })

  it('cambia el país de destino', () => {
    const { container } = render(<RulesEngineAnalyzer />)
    const selects = container.querySelectorAll('select')
    const destSelect = selects[2]
    fireEvent.change(destSelect, { target: { value: 'FR' } })
    expect(destSelect.value).toBe('FR')
  })

  it('actualiza los campos del primer producto', () => {
    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    const descriptionInput = container.querySelector('input[placeholder="Descripción"]')
    const quantityInput = container.querySelector('input[placeholder="Cantidad"]')
    const valueInput = container.querySelector('input[placeholder="Valor aduanero (EUR)"]')

    fireEvent.change(taricInput, { target: { value: '1234567890' } })
    fireEvent.change(descriptionInput, { target: { value: 'Producto de prueba' } })
    fireEvent.change(quantityInput, { target: { value: '100' } })
    fireEvent.change(valueInput, { target: { value: '5000' } })

    expect(taricInput.value).toBe('1234567890')
    expect(descriptionInput.value).toBe('Producto de prueba')
    expect(quantityInput.value).toBe('100')
    expect(valueInput.value).toBe('5000')
  })

  it('agrega un nuevo producto', () => {
    render(<RulesEngineAnalyzer />)
    const addButton = screen.getByRole('button', { name: /\+ Agregar Producto/i })

    expect(screen.getByText('Producto 1')).toBeInTheDocument()
    expect(screen.queryByText('Producto 2')).not.toBeInTheDocument()

    fireEvent.click(addButton)

    expect(screen.getByText('Producto 1')).toBeInTheDocument()
    expect(screen.getByText('Producto 2')).toBeInTheDocument()
  })

  it('elimina un producto cuando hay más de uno', () => {
    render(<RulesEngineAnalyzer />)
    const addButton = screen.getByRole('button', { name: /\+ Agregar Producto/i })

    fireEvent.click(addButton)
    expect(screen.getByText('Producto 2')).toBeInTheDocument()

    const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i })
    fireEvent.click(deleteButtons[1])

    expect(screen.queryByText('Producto 2')).not.toBeInTheDocument()
    expect(screen.getByText('Producto 1')).toBeInTheDocument()
  })

  it('no muestra el botón eliminar cuando hay un solo producto', () => {
    render(<RulesEngineAnalyzer />)
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument()
  })

  it('muestra error cuando no hay productos', async () => {
    const { container } = render(<RulesEngineAnalyzer />)
    const form = container.querySelector('form')

    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Agregue al menos un producto')
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('muestra error cuando el primer producto no tiene código TARIC', async () => {
    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')

    // Dejar el taricCode vacío (valor por defecto)
    expect(taricInput.value).toBe('')

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Agregue al menos un producto')
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('realiza el análisis exitosamente con respuesta success:true', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: {
            tariff: 100,
            vat: { rate: 0.21, amount: 21 },
            total: 121
          },
          quotas: [],
          documentation: []
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/rules/analyze', expect.objectContaining({
        type: 'import',
        originCountry: 'CN',
        destinationCountry: 'ES',
        goods: expect.arrayContaining([
          expect.objectContaining({
            taricCode: '1234567890',
            quantity: 0,
            customsValue: 0
          })
        ])
      }))
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Análisis completado')
    })

    expect(screen.getByText('Resumen del Análisis')).toBeInTheDocument()
    expect(screen.getByText('Operación Elegible')).toBeInTheDocument()
  })

  it('muestra error cuando la respuesta tiene success:false', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Error de validación'
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error de validación')
    })
  })

  it('muestra error genérico cuando la respuesta tiene success:false sin mensaje', async () => {
    const mockResponse = {
      data: {
        success: false
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error en el análisis')
    })
  })

  it('maneja errores de red con catch', async () => {
    api.post.mockRejectedValue(new Error('Network error'))

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al analizar operación')
    })
  })

  it('deshabilita el botón mientras está analizando', async () => {
    // Promesa que no resuelve durante la aserción: el estado analyzing se mantiene estable
    let resolvePost
    api.post.mockImplementation(() => new Promise(resolve => { resolvePost = resolve }))

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const submitButton = screen.getByRole('button', { name: /Analizar Operación/i })
    expect(submitButton).not.toBeDisabled()

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Analizando...')).toBeInTheDocument()
    })

    const disabledButton = screen.getByRole('button', { name: /Analizando.../i })
    expect(disabledButton).toBeDisabled()

    // Resolver para no dejar la promesa colgada tras la aserción
    resolvePost({ data: { success: true, data: { summary: { eligible: true, alerts: [], warnings: [], recommendations: [] }, taxes: { total: 0 } } } })
    await waitFor(() => expect(screen.queryByText('Analizando...')).not.toBeInTheDocument())
  })

  it('renderiza operación con restricciones (eligible:false)', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: false,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: {
            tariff: 100,
            total: 100
          }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('Operación con Restricciones')).toBeInTheDocument()
    })
  })

  it('renderiza alertas con severidad critical', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [
              { severity: 'critical', code: 'CRIT-001', message: 'Error crítico' }
            ],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('CRIT-001')).toBeInTheDocument()
      expect(screen.getByText('Error crítico')).toBeInTheDocument()
    })

    const alertContainer = screen.getByText('CRIT-001').parentElement.parentElement.parentElement
    expect(alertContainer.className).toContain('text-red-600')
    expect(alertContainer.className).toContain('bg-red-50')
  })

  it('renderiza alertas con severidad high', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [
              { severity: 'high', code: 'HIGH-001', message: 'Alerta alta' }
            ],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('HIGH-001')).toBeInTheDocument()
    })

    const alertContainer = screen.getByText('HIGH-001').parentElement.parentElement.parentElement
    expect(alertContainer.className).toContain('text-orange-600')
    expect(alertContainer.className).toContain('bg-orange-50')
  })

  it('renderiza alertas con severidad medium', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [
              { severity: 'medium', code: 'MED-001', message: 'Alerta media' }
            ],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('MED-001')).toBeInTheDocument()
    })

    const alertContainer = screen.getByText('MED-001').parentElement.parentElement.parentElement
    expect(alertContainer.className).toContain('text-yellow-600')
    expect(alertContainer.className).toContain('bg-yellow-50')
  })

  it('renderiza alertas con severidad default (low/unknown)', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [
              { severity: 'low', code: 'LOW-001', message: 'Alerta baja' }
            ],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('LOW-001')).toBeInTheDocument()
    })

    const alertContainer = screen.getByText('LOW-001').parentElement.parentElement.parentElement
    expect(alertContainer.className).toContain('text-gray-600')
    expect(alertContainer.className).toContain('bg-gray-50')
  })

  it('renderiza warnings', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [
              { code: 'WARN-001', message: 'Advertencia importante' }
            ],
            recommendations: []
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('WARN-001')).toBeInTheDocument()
      expect(screen.getByText('Advertencia importante')).toBeInTheDocument()
    })
  })

  it('renderiza impuestos con tarifa', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: {
            tariff: 250.50,
            total: 250.50
          }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Impuestos y Aranceles')).toBeInTheDocument()
      expect(screen.getByText('Arancel:')).toBeInTheDocument()
    })

    const allElements = screen.getAllByText('250.50 EUR')
    expect(allElements.length).toBeGreaterThan(0)
  })

  it('renderiza IVA con tasa y cantidad', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: {
            vat: {
              rate: 0.21,
              amount: 210
            },
            total: 210
          }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/IVA \(21%\)/i)).toBeInTheDocument()
    })

    const allVatElements = screen.getAllByText('210.00 EUR')
    expect(allVatElements.length).toBeGreaterThan(0)
  })

  it('renderiza impuestos especiales cuando son aplicables', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: {
            excise: {
              applicable: true,
              amount: 50
            },
            total: 50
          }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Impuestos Especiales:')).toBeInTheDocument()
    })

    const allExciseElements = screen.getAllByText('50.00 EUR')
    expect(allExciseElements.length).toBeGreaterThan(0)
  })

  it('no renderiza impuestos especiales cuando no son aplicables', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: {
            excise: {
              applicable: false,
              amount: 0
            },
            total: 0
          }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Impuestos y Aranceles')).toBeInTheDocument()
    })

    expect(screen.queryByText('Impuestos Especiales:')).not.toBeInTheDocument()
  })

  it('renderiza recomendaciones con acción', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: [
              {
                message: 'Considere usar el régimen simplificado',
                action: 'Consulte con su agente aduanal'
              }
            ]
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Recomendaciones')).toBeInTheDocument()
      expect(screen.getByText('Considere usar el régimen simplificado')).toBeInTheDocument()
      expect(screen.getByText(/→ Consulte con su agente aduanal/i)).toBeInTheDocument()
    })
  })

  it('renderiza recomendaciones sin acción', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: [
              {
                message: 'Verificar documentación'
              }
            ]
          },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Verificar documentación')).toBeInTheDocument()
    })
  })

  it('renderiza contingente disponible', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 },
          quotas: [
            {
              description: 'Contingente para productos textiles',
              orderNumber: 'Q001',
              product: '1234567890',
              available: true,
              duty: {
                savings: 0.5
              }
            }
          ]
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Contingentes Disponibles')).toBeInTheDocument()
      expect(screen.getByText('Contingente para productos textiles')).toBeInTheDocument()
      expect(screen.getByText(/Orden: Q001/i)).toBeInTheDocument()
      expect(screen.getByText(/Producto: 1234567890/i)).toBeInTheDocument()
      expect(screen.getByText('Disponible')).toBeInTheDocument()
      expect(screen.getByText(/Ahorro: 50.00% del arancel/i)).toBeInTheDocument()
    })
  })

  it('renderiza contingente agotado', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 },
          quotas: [
            {
              description: 'Contingente agotado',
              orderNumber: 'Q002',
              product: '9876543210',
              available: false
            }
          ]
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Agotado')).toBeInTheDocument()
    })
  })

  it('renderiza documentación requerida como strings', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 },
          documentation: [
            'Certificado de origen',
            'Factura comercial',
            'Documento de transporte'
          ]
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Documentación Requerida')).toBeInTheDocument()
      expect(screen.getByText('Certificado de origen')).toBeInTheDocument()
      expect(screen.getByText('Factura comercial')).toBeInTheDocument()
      expect(screen.getByText('Documento de transporte')).toBeInTheDocument()
    })
  })

  it('renderiza documentación como objetos con type', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: {
            eligible: true,
            alerts: [],
            warnings: [],
            recommendations: []
          },
          taxes: { total: 0 },
          documentation: [
            { type: 'Certificado sanitario' },
            { name: 'Permiso de importación' }
          ]
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Certificado sanitario')).toBeInTheDocument()
      expect(screen.getByText('Permiso de importación')).toBeInTheDocument()
    })
  })

  it('convierte cantidad y valor a números en el payload', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { eligible: true, alerts: [], warnings: [], recommendations: [] },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    const quantityInput = container.querySelector('input[placeholder="Cantidad"]')
    const valueInput = container.querySelector('input[placeholder="Valor aduanero (EUR)"]')

    fireEvent.change(taricInput, { target: { value: '1234567890' } })
    fireEvent.change(quantityInput, { target: { value: '50' } })
    fireEvent.change(valueInput, { target: { value: '2500.75' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/rules/analyze', expect.objectContaining({
        goods: expect.arrayContaining([
          expect.objectContaining({
            taricCode: '1234567890',
            quantity: 50,
            customsValue: 2500.75
          })
        ])
      }))
    })
  })

  it('convierte valores no numéricos a 0', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { eligible: true, alerts: [], warnings: [], recommendations: [] },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    const quantityInput = container.querySelector('input[placeholder="Cantidad"]')
    const valueInput = container.querySelector('input[placeholder="Valor aduanero (EUR)"]')

    fireEvent.change(taricInput, { target: { value: '1234567890' } })
    fireEvent.change(quantityInput, { target: { value: '' } })
    fireEvent.change(valueInput, { target: { value: 'abc' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/rules/analyze', expect.objectContaining({
        goods: expect.arrayContaining([
          expect.objectContaining({
            quantity: 0,
            customsValue: 0
          })
        ])
      }))
    })
  })

  it('maneja múltiples productos con valores mixtos', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          summary: { eligible: true, alerts: [], warnings: [], recommendations: [] },
          taxes: { total: 0 }
        }
      }
    }
    api.post.mockResolvedValue(mockResponse)

    const { container } = render(<RulesEngineAnalyzer />)

    // Agregar segundo producto
    const addButton = screen.getByRole('button', { name: /\+ Agregar Producto/i })
    fireEvent.click(addButton)

    const allTaricInputs = container.querySelectorAll('input[placeholder="Código TARIC"]')
    const allQuantityInputs = container.querySelectorAll('input[placeholder="Cantidad"]')

    fireEvent.change(allTaricInputs[0], { target: { value: '1111111111' } })
    fireEvent.change(allQuantityInputs[0], { target: { value: '10' } })

    fireEvent.change(allTaricInputs[1], { target: { value: '2222222222' } })
    fireEvent.change(allQuantityInputs[1], { target: { value: '20' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/rules/analyze', expect.objectContaining({
        goods: [
          expect.objectContaining({
            taricCode: '1111111111',
            quantity: 10
          }),
          expect.objectContaining({
            taricCode: '2222222222',
            quantity: 20
          })
        ]
      }))
    })
  })

  it('limpia el análisis previo al enviar nuevo formulario', async () => {
    const mockResponse1 = {
      data: {
        success: true,
        data: {
          summary: { eligible: true, alerts: [], warnings: [], recommendations: [] },
          taxes: { total: 100 }
        }
      }
    }

    const mockResponse2 = {
      data: {
        success: true,
        data: {
          summary: { eligible: false, alerts: [], warnings: [], recommendations: [] },
          taxes: { total: 200 }
        }
      }
    }

    api.post.mockResolvedValueOnce(mockResponse1)

    const { container } = render(<RulesEngineAnalyzer />)
    const taricInput = container.querySelector('input[placeholder="Código TARIC"]')
    fireEvent.change(taricInput, { target: { value: '1234567890' } })

    const form = container.querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Operación Elegible')).toBeInTheDocument()
    })

    // Segundo análisis
    api.post.mockResolvedValueOnce(mockResponse2)
    fireEvent.submit(form)

    // Durante el análisis, el panel de resultados desaparece
    await waitFor(() => {
      expect(screen.queryByText('Operación Elegible')).not.toBeInTheDocument()
    })

    // Al completar, muestra el nuevo resultado
    await waitFor(() => {
      expect(screen.getByText('Operación con Restricciones')).toBeInTheDocument()
    })
  })
})
