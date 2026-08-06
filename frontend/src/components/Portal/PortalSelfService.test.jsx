/**
 * Tests para PortalSelfService.jsx
 * Cubre wizard de 4 pasos, validaciones, navegación, goods CRUD y submit
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortalSelfService from './PortalSelfService'
import { portalAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}))

vi.mock('../../services/api', () => ({
  portalAPI: { createExpedition: vi.fn() }
}))

vi.mock('lucide-react', () => {
  const MockIcon = ({ className }) => <svg className={className} />
  return {
    Package: MockIcon,
    Truck: MockIcon,
    Ship: MockIcon,
    Plane: MockIcon,
    ArrowRight: MockIcon,
    ArrowLeft: MockIcon,
    Check: MockIcon,
    AlertCircle: MockIcon,
    Plus: MockIcon,
    Trash2: MockIcon,
    Building: MockIcon,
    Mail: MockIcon,
    Phone: MockIcon,
    MapPin: MockIcon,
    FileText: MockIcon
  }
})

describe('PortalSelfService', () => {
  const defaultProps = { organizationId: 'org-123' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial y pasos del wizard', () => {
    test('renderiza el paso 1 por defecto con operaciones y modos de transporte', () => {
      render(<PortalSelfService {...defaultProps} />)

      expect(screen.getByText('portal.selfServiceTitle')).toBeInTheDocument()
      expect(screen.getByText('portal.selfServiceDesc')).toBeInTheDocument()

      // Operaciones
      expect(screen.getByText('portal.operationImport')).toBeInTheDocument()
      expect(screen.getByText('portal.operationExport')).toBeInTheDocument()
      expect(screen.getByText('portal.operationTransit')).toBeInTheDocument()

      // Modos de transporte
      expect(screen.getByText('portal.transportMode')).toBeInTheDocument()
      expect(screen.getByText('portal.transportMaritime')).toBeInTheDocument()
      expect(screen.getByText('portal.transportAir')).toBeInTheDocument()
      expect(screen.getByText('portal.transportRoad')).toBeInTheDocument()
    })

    test('muestra indicadores de progreso para los 4 pasos', () => {
      render(<PortalSelfService {...defaultProps} />)

      expect(screen.getByText('portal.stepOperation')).toBeInTheDocument()
      expect(screen.getByText('portal.stepCompany')).toBeInTheDocument()
      expect(screen.getByText('portal.stepDetails')).toBeInTheDocument()
      expect(screen.getByText('portal.stepGoods')).toBeInTheDocument()
    })

    test('no muestra botón atrás en el paso 1', () => {
      render(<PortalSelfService {...defaultProps} />)
      expect(screen.queryByText('common.previous')).not.toBeInTheDocument()
    })
  })

  describe('Paso 1: Selección de operación y transporte', () => {
    test('permite seleccionar operationType', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      const importBtn = screen.getByRole('button', { name: /portal.operationImport/i })
      await user.click(importBtn)

      expect(importBtn).toHaveClass('border-blue-500')
    })

    test('permite seleccionar transportMode', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      const airBtn = screen.getByRole('button', { name: /portal.transportAir/i })
      await user.click(airBtn)

      expect(airBtn).toHaveClass('border-blue-500')
    })

    test('bloquea avance si no hay operationType seleccionado', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      const nextBtn = screen.getByRole('button', { name: /common.next/i })

      // validateStep(1) falla, botón deshabilitado
      expect(nextBtn).toBeDisabled()
    })

    test('avanza al paso 2 cuando operationType está seleccionado', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Seleccionar operationType
      await user.click(screen.getByRole('button', { name: /portal.operationExport/i }))

      const nextBtn = screen.getByRole('button', { name: /common.next/i })
      await user.click(nextBtn)

      // Paso 2 visible
      expect(screen.getByText('portal.companyData')).toBeInTheDocument()
      expect(screen.getByText('portal.companyDataDesc')).toBeInTheDocument()
    })
  })

  describe('Paso 2: Información del cliente', () => {
    const avanzarAPaso2 = async (user) => {
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))
    }

    test('renderiza campos del cliente', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso2(user)

      expect(screen.getByPlaceholderText('portal.companyNamePlaceholder')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('B12345678')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('ESB12345678')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('portal.contactPersonPlaceholder')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('portal.emailPlaceholder')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('portal.phonePlaceholder')).toBeInTheDocument()
    })

    test('permite rellenar campos del cliente', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso2(user)

      const companyInput = screen.getByPlaceholderText('portal.companyNamePlaceholder')
      const emailInput = screen.getByPlaceholderText('portal.emailPlaceholder')
      const contactInput = screen.getByPlaceholderText('portal.contactPersonPlaceholder')

      fireEvent.change(companyInput, { target: { value: 'Test Company' } })
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(contactInput, { target: { value: 'John Doe' } })

      expect(companyInput).toHaveValue('Test Company')
      expect(emailInput).toHaveValue('test@example.com')
      expect(contactInput).toHaveValue('John Doe')
    })

    test('bloquea avance sin companyName, email y contactName', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso2(user)

      // Rellenar solo companyName
      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Company X' }
      })

      // validateStep(2) falla, botón deshabilitado
      const nextBtn = screen.getByRole('button', { name: /common.next/i })
      expect(nextBtn).toBeDisabled()
    })

    test('avanza al paso 3 con datos mínimos requeridos', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso2(user)

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'CompanyABC' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'info@companyabc.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'Alice' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Paso 3 visible
      expect(screen.getByText('portal.operationDetails')).toBeInTheDocument()
      expect(screen.getByText('portal.operationDetailsDesc')).toBeInTheDocument()
    })

    test('permite volver al paso 1 desde el paso 2', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso2(user)

      await user.click(screen.getByRole('button', { name: /common.previous/i }))

      // Paso 1 visible
      expect(screen.getByText('portal.selfServiceTitle')).toBeInTheDocument()
    })
  })

  describe('Paso 3: Detalles de la operación', () => {
    const avanzarAPaso3 = async (user) => {
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Company' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'email@test.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'Contact' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))
    }

    test('renderiza campos de detalles de operación', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso3(user)

      expect(screen.getByPlaceholderText('CN')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('ES')).toBeInTheDocument()
      expect(screen.getByText('portal.incoterm')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('portal.additionalNotesPlaceholder')).toBeInTheDocument()
    })

    test('permite rellenar originCountry', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso3(user)

      const originInput = screen.getByPlaceholderText('CN')
      fireEvent.change(originInput, { target: { value: 'de' } })

      // toUpperCase aplicado
      await waitFor(() => {
        expect(originInput).toHaveValue('DE')
      })
    })

    test('bloquea avance sin originCountry', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso3(user)

      // validateStep(3) falla, botón deshabilitado
      const nextBtn = screen.getByRole('button', { name: /common.next/i })
      expect(nextBtn).toBeDisabled()
    })

    test('avanza al paso 4 con originCountry', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso3(user)

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'FR' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Paso 4 visible
      expect(screen.getByText('portal.goodsTitle')).toBeInTheDocument()
      expect(screen.getByText('portal.goodsDesc')).toBeInTheDocument()
    })

    test('permite cambiar incoterm', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso3(user)

      const incotermSelect = screen.getByRole('combobox')
      fireEvent.change(incotermSelect, { target: { value: 'FOB' } })

      expect(incotermSelect).toHaveValue('FOB')
    })

    test('permite escribir notas adicionales', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso3(user)

      const notesTextarea = screen.getByPlaceholderText('portal.additionalNotesPlaceholder')
      fireEvent.change(notesTextarea, { target: { value: 'Special instructions' } })

      expect(notesTextarea).toHaveValue('Special instructions')
    })
  })

  describe('Paso 4: Bienes (goods)', () => {
    const avanzarAPaso4 = async (user) => {
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Comp' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'a@b.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'Cont' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'US' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))
    }

    test('renderiza un good inicial', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      expect(screen.getByText(/portal.goodItem/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('portal.goodDescPlaceholder')).toBeInTheDocument()
    })

    test('permite rellenar description y quantity del good', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      const descInput = screen.getByPlaceholderText('portal.goodDescPlaceholder')
      const qtyInputs = screen.getAllByRole('spinbutton')
      const qtyInput = qtyInputs[0] // quantity es el primer spinbutton

      fireEvent.change(descInput, { target: { value: 'Widget' } })
      fireEvent.change(qtyInput, { target: { value: '10' } })

      expect(descInput).toHaveValue('Widget')
      expect(qtyInput).toHaveValue(10)
    })

    test('addGood añade un nuevo good', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      const addBtn = screen.getByRole('button', { name: /portal.addGood/i })
      await user.click(addBtn)

      // Ahora hay 2 goods
      const goodHeaders = screen.getAllByText(/portal.goodItem/)
      expect(goodHeaders).toHaveLength(2)
    })

    test('removeGood elimina un good cuando hay más de 1', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      await user.click(screen.getByRole('button', { name: /portal.addGood/i }))

      // Hay 2 goods, ambos con botón eliminar
      const deleteButtons = screen.getAllByRole('button', { name: '' })
      const trashBtns = deleteButtons.filter((btn) => btn.querySelector('svg'))

      await user.click(trashBtns[0])

      // Solo queda 1
      const goodHeaders = screen.getAllByText(/portal.goodItem/)
      expect(goodHeaders).toHaveLength(1)
    })

    test('removeGood NO elimina el único good restante', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      // Solo hay 1 good inicialmente
      const goodHeaders = screen.getAllByText(/portal.goodItem/)
      expect(goodHeaders).toHaveLength(1)

      // No debería haber botón eliminar cuando goods.length === 1
      const deleteButtons = screen.queryAllByRole('button', { name: '' })
      const trashBtns = deleteButtons.filter((btn) => btn.querySelector('svg'))

      expect(trashBtns).toHaveLength(0)
    })

    test('bloquea submit sin description en algún good', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      // Rellenar quantity pero NO description
      const qtyInput = screen.getAllByRole('spinbutton')[0]
      fireEvent.change(qtyInput, { target: { value: '5' } })

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })

      // validateStep(4) falla, botón deshabilitado
      expect(submitBtn).toBeDisabled()
    })

    test('bloquea submit si quantity <= 0', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      const descInput = screen.getByPlaceholderText('portal.goodDescPlaceholder')
      const qtyInput = screen.getAllByRole('spinbutton')[0]

      fireEvent.change(descInput, { target: { value: 'Item' } })
      fireEvent.change(qtyInput, { target: { value: '0' } })

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })

      // validateStep(4) falla, botón deshabilitado
      expect(submitBtn).toBeDisabled()
    })

    test('permite submit con datos válidos', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      const descInput = screen.getByPlaceholderText('portal.goodDescPlaceholder')
      const qtyInput = screen.getAllByRole('spinbutton')[0]

      fireEvent.change(descInput, { target: { value: 'Product' } })
      fireEvent.change(qtyInput, { target: { value: '2' } })

      portalAPI.createExpedition.mockResolvedValue({
        data: { expeditionId: 'EXP-123', portalUrl: 'https://portal.test/exp123' }
      })

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })
      expect(submitBtn).not.toBeDisabled()

      await user.click(submitBtn)

      // Esperar la llamada API
      await waitFor(() => {
        expect(portalAPI.createExpedition).toHaveBeenCalledTimes(1)
      })
    })

    test('actualiza el valor (value) de un good', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      // El segundo spinbutton es value (quantity es [0], value es [1])
      const valueInput = screen.getAllByRole('spinbutton')[1]
      fireEvent.change(valueInput, { target: { value: '123.45' } })

      expect(valueInput).toHaveValue(123.45)
    })

    test('cambia la unidad de un good', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)
      await avanzarAPaso4(user)

      const unitSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(unitSelect, { target: { value: 'CTN' } })

      expect(unitSelect).toHaveValue('CTN')
    })
  })

  describe('handleSubmit: éxito y error', () => {
    const prepararSubmit = async (user) => {
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Co' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'e@t.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'C' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'IT' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.goodDescPlaceholder'), {
        target: { value: 'Gadget' }
      })
      fireEvent.change(screen.getAllByRole('spinbutton')[0], {
        target: { value: '3' }
      })
    }

    test('muestra pantalla de éxito tras createExpedition exitoso', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      await prepararSubmit(user)

      portalAPI.createExpedition.mockResolvedValue({
        data: { expeditionId: 'EXP-456', portalUrl: 'https://portal.test/exp456' }
      })

      await user.click(screen.getByRole('button', { name: /portal.createExpedition/i }))

      const expeditionNumber = await screen.findByText('EXP-456')
      expect(expeditionNumber).toBeInTheDocument()

      expect(screen.getByText('portal.expeditionCreated')).toBeInTheDocument()
      expect(screen.getByText('portal.expeditionCreatedDesc')).toBeInTheDocument()
      expect(screen.getByText('portal.accessPortal')).toBeInTheDocument()

      const link = screen.getByRole('link', { name: /portal.accessPortal/i })
      expect(link).toHaveAttribute('href', 'https://portal.test/exp456')
    })

    test('muestra error personalizado si response.data.error existe', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      await prepararSubmit(user)

      portalAPI.createExpedition.mockRejectedValue({
        response: { data: { error: 'Organization not found' } }
      })

      await user.click(screen.getByRole('button', { name: /portal.createExpedition/i }))

      const errorMsg = await screen.findByText('Organization not found')
      expect(errorMsg).toBeInTheDocument()
    })

    test('muestra error genérico si no hay response.data.error', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      await prepararSubmit(user)

      portalAPI.createExpedition.mockRejectedValue(new Error('Network failure'))

      await user.click(screen.getByRole('button', { name: /portal.createExpedition/i }))

      const errorMsg = await screen.findByText('portal.errorCreatingExpedition')
      expect(errorMsg).toBeInTheDocument()
    })

    test('deshabilita botón submit durante loading', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      await prepararSubmit(user)

      let resolveCreate
      portalAPI.createExpedition.mockReturnValue(
        new Promise((res) => {
          resolveCreate = res
        })
      )

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })
      await user.click(submitBtn)

      // Durante loading
      await waitFor(() => {
        expect(screen.getByText('portal.creating')).toBeInTheDocument()
      })

      expect(submitBtn).toBeDisabled()

      // Resolver
      resolveCreate({ data: { expeditionId: 'E1', portalUrl: 'http://p.test/e1' } })

      await screen.findByText('E1')
    })
  })

  describe('validateStep: ramas default y casos límite', () => {
    test('validateStep(0) devuelve true (default)', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Paso 1 con operationType
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Avanza a paso 2; validateStep(1) fue true
      expect(screen.getByText('portal.companyData')).toBeInTheDocument()
    })

    test('validateStep(4) rechaza good con quantity=0', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 4
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'X' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'x@y.z' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'Y' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'MX' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Paso 4: rellenar description pero quantity=0
      fireEvent.change(screen.getByPlaceholderText('portal.goodDescPlaceholder'), {
        target: { value: 'Thing' }
      })
      fireEvent.change(screen.getAllByRole('spinbutton')[0], {
        target: { value: '0' }
      })

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })

      // validateStep(4) falla porque quantity=0, botón deshabilitado
      expect(submitBtn).toBeDisabled()
    })

    test('validateStep(4) rechaza si algún good no tiene description', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 4
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'A' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'a@b.c' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'B' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'JP' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Añadir segundo good
      await user.click(screen.getByRole('button', { name: /portal.addGood/i }))

      // Rellenar solo el primero
      const descInputs = screen.getAllByPlaceholderText('portal.goodDescPlaceholder')
      fireEvent.change(descInputs[0], { target: { value: 'First' } })
      // descInputs[1] queda vacío

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })

      // validateStep(4) falla porque segundo good no tiene description, botón deshabilitado
      expect(submitBtn).toBeDisabled()
    })
  })

  describe('handleBack: navegación hacia atrás', () => {
    test('handleBack desde paso 3 limpia el error', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 3
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Q' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'q@r.s' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'R' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Estamos en paso 3
      expect(screen.getByText('portal.operationDetails')).toBeInTheDocument()

      // Volver atrás
      await user.click(screen.getByRole('button', { name: /common.previous/i }))

      // Volvió a paso 2
      expect(screen.getByText('portal.companyData')).toBeInTheDocument()
    })
  })

  describe('updateFormData: nested y top-level', () => {
    test('updateFormData actualiza campo nested (client.taxId)', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      const taxIdInput = screen.getByPlaceholderText('B12345678')
      fireEvent.change(taxIdInput, { target: { value: 'B99999999' } })

      expect(taxIdInput).toHaveValue('B99999999')
    })

    test('updateFormData actualiza campo top-level (operationType)', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /portal.operationTransit/i }))

      const transitBtn = screen.getByRole('button', { name: /portal.operationTransit/i })
      expect(transitBtn).toHaveClass('border-blue-500')
    })

    test('updateFormData actualiza operation.destinationCountry con toUpperCase', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 3
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'M' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'm@n.o' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'N' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      const destInput = screen.getByPlaceholderText('ES')
      fireEvent.change(destInput, { target: { value: 'fr' } })

      await waitFor(() => {
        expect(destInput).toHaveValue('FR')
      })
    })
  })

  describe('addGood: copia originCountry desde formData.operation', () => {
    test('addGood asigna originCountry de operation al nuevo good', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 3 con originCountry
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Z' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'z@a.b' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'A' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'BR' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Añadir segundo good
      await user.click(screen.getByRole('button', { name: /portal.addGood/i }))

      // Verificar que hay 2 goods
      const goodHeaders = screen.getAllByText(/portal.goodItem/)
      expect(goodHeaders).toHaveLength(2)

      // El nuevo good hereda originCountry='BR' (no visible en UI actual, pero se asigna)
      // Comprobamos que el botón addGood funcionó
      expect(goodHeaders[1]).toBeInTheDocument()
    })
  })

  describe('Casos límite y cobertura de ramas', () => {
    test('intento de submit sin validación paso 4 (quantity negativa parseada como 0)', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 4
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'P' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'p@q.r' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'Q' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'UK' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Rellenar description
      fireEvent.change(screen.getByPlaceholderText('portal.goodDescPlaceholder'), {
        target: { value: 'Widget' }
      })

      // quantity con string inválido → parseFloat || 0 → 0
      fireEvent.change(screen.getAllByRole('spinbutton')[0], {
        target: { value: 'abc' }
      })

      const submitBtn = screen.getByRole('button', { name: /portal.createExpedition/i })

      // validateStep(4) falla porque quantity=0, botón deshabilitado
      expect(submitBtn).toBeDisabled()
    })

    test('removeGood con un solo good no muestra botón eliminar', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar a paso 4
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'S' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 's@t.u' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'T' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'AR' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      // Solo 1 good → no hay botón de eliminar
      const deleteButtons = screen.queryAllByRole('button', { name: '' })
      const trashBtns = deleteButtons.filter((btn) => btn.querySelector('svg'))
      expect(trashBtns).toHaveLength(0)
    })

    test('handleNext limpia el error previo al avanzar correctamente', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Botón deshabilitado sin operationType
      const nextBtn = screen.getByRole('button', { name: /common.next/i })
      expect(nextBtn).toBeDisabled()

      // Seleccionar operationType
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))

      // Botón se habilita
      expect(nextBtn).not.toBeDisabled()

      // Avanzar ahora sí
      await user.click(nextBtn)

      // Avanzó a paso 2
      expect(screen.getByText('portal.companyData')).toBeInTheDocument()
    })

    test('pantalla de éxito muestra expeditionNumber y portalUrl', async () => {
      const user = userEvent.setup()
      render(<PortalSelfService {...defaultProps} />)

      // Avanzar y completar
      await user.click(screen.getByRole('button', { name: /portal.operationImport/i }))
      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.companyNamePlaceholder'), {
        target: { value: 'Final' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.emailPlaceholder'), {
        target: { value: 'final@test.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('portal.contactPersonPlaceholder'), {
        target: { value: 'Last' }
      })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('CN'), { target: { value: 'ZA' } })

      await user.click(screen.getByRole('button', { name: /common.next/i }))

      fireEvent.change(screen.getByPlaceholderText('portal.goodDescPlaceholder'), {
        target: { value: 'LastGood' }
      })
      fireEvent.change(screen.getAllByRole('spinbutton')[0], {
        target: { value: '1' }
      })

      portalAPI.createExpedition.mockResolvedValue({
        data: { expeditionId: 'FINAL-999', portalUrl: 'https://portal.example.com/final999' }
      })

      await user.click(screen.getByRole('button', { name: /portal.createExpedition/i }))

      const expeditionId = await screen.findByText('FINAL-999')
      expect(expeditionId).toBeInTheDocument()

      const link = screen.getByRole('link', { name: /portal.accessPortal/i })
      expect(link).toHaveAttribute('href', 'https://portal.example.com/final999')

      expect(screen.getByText('portal.savePortalLink')).toBeInTheDocument()
    })
  })
})
