import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DutyCalculator from './DutyCalculator'
import { calculationsAPI, knowledgeAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../../services/api', () => ({
  calculationsAPI: { calculateDuties: vi.fn() },
  knowledgeAPI: { incotermInfo: vi.fn() }
}))

describe('<DutyCalculator />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    knowledgeAPI.incotermInfo.mockResolvedValue({ data: { code: 'CIF', description: 'Cost Insurance Freight' } })
  })

  test('renderiza el formulario con el incoterm por defecto CIF', async () => {
    render(<DutyCalculator />)
    expect(screen.getByText('calculator.title')).toBeInTheDocument()
    // El useEffect inicial consulta el incoterm por defecto
    await waitFor(() => expect(knowledgeAPI.incotermInfo).toHaveBeenCalledWith('CIF'))
  })

  test('el useEffect maneja el error de incotermInfo sin romper', async () => {
    knowledgeAPI.incotermInfo.mockRejectedValueOnce(new Error('boom'))
    render(<DutyCalculator />)
    await waitFor(() => expect(knowledgeAPI.incotermInfo).toHaveBeenCalled())
    // El componente sigue montado pese al rechazo
    expect(screen.getByText('calculator.title')).toBeInTheDocument()
  })

  test('validación: campos requeridos vacíos muestran toast y no llaman a la API', async () => {
    render(<DutyCalculator />)
    // El form tiene inputs required, pero handleCalculate valida explícitamente;
    // disparamos submit sobre el form directamente para ejercitar la rama de validación.
    const form = document.querySelector('form')
    fireEvent.submit(form)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('calculator.fillRequired'))
    expect(calculationsAPI.calculateDuties).not.toHaveBeenCalled()
  })

  test('cálculo correcto: rellena campos, envía y muestra el resultado', async () => {
    calculationsAPI.calculateDuties.mockResolvedValue({
      data: { dutyAmount: 120.5, vatAmount: 80, total: 200.5 }
    })
    render(<DutyCalculator />)

    fireEvent.change(screen.getByTestId('calc-taric'), { target: { value: '0901210000' } })
    fireEvent.change(screen.getByTestId('calc-value'), { target: { value: '1000' } })
    fireEvent.change(screen.getByTestId('calc-origin'), { target: { value: 'CN' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() =>
      expect(calculationsAPI.calculateDuties).toHaveBeenCalledWith(
        expect.objectContaining({ taricCode: '0901210000', value: 1000, origin: 'CN' })
      )
    )
  })

  test('resultado rico despliega el bloque de resultado con todas sus sub-secciones', async () => {
    // El estado `result` = response.data; el JSX accede a result.data.* → anidar dos niveles.
    calculationsAPI.calculateDuties.mockResolvedValue({
      data: {
        data: {
          source: 'ai_realtime',
          confidence: 95,
          description: 'Café sin tostar',
          customsValue: 1000,
          dutyAmount: 75,
          dutyRate: 7.5,
          seasonal: true,
          vatAmount: 225,
          vatRate: 21,
          vatType: 'reduced',
          totalToPay: 1300,
          warnings: ['Requiere certificado fitosanitario']
        }
      }
    })
    render(<DutyCalculator />)

    fireEvent.change(screen.getByTestId('calc-taric'), { target: { value: '0901110000' } })
    fireEvent.change(screen.getByTestId('calc-value'), { target: { value: '1000' } })
    fireEvent.change(screen.getByTestId('calc-origin'), { target: { value: 'BR' } })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText('calculator.result')).toBeInTheDocument())
    // Sub-ramas ejercitadas: source, confidence, description, seasonal, vatType, warnings
    expect(screen.getByText('Café sin tostar')).toBeInTheDocument()
    expect(screen.getByText('Requiere certificado fitosanitario')).toBeInTheDocument()
    expect(screen.getByText('calculator.seasonal')).toBeInTheDocument()
  })

  // Las ramas de estilo del render (source/confidence/vatType) son ternarios: para
  // cubrirlas hay que renderizar con cada valor. Parametrizamos.
  test.each([
    ['local_db', 95, 'standard'],
    ['ai_cache', 75, 'super_reduced'],
    ['estimated', 50, 'reduced'],
    ['otra_fuente', 60, 'standard']
  ])('render con source=%s confidence=%s vatType=%s cubre sus ramas de estilo', async (source, confidence, vatType) => {
    calculationsAPI.calculateDuties.mockResolvedValue({
      data: { data: { source, confidence, dutyAmount: 10, vatAmount: 5, vatType, totalToPay: 15, customsValue: 100 } }
    })
    render(<DutyCalculator />)
    fireEvent.change(screen.getByTestId('calc-taric'), { target: { value: '2204210000' } })
    fireEvent.change(screen.getByTestId('calc-value'), { target: { value: '100' } })
    fireEvent.change(screen.getByTestId('calc-origin'), { target: { value: 'FR' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('calculator.result')).toBeInTheDocument())
  })

  test('cálculo con error de API muestra toast de error', async () => {
    calculationsAPI.calculateDuties.mockRejectedValue(new Error('API down'))
    render(<DutyCalculator />)

    fireEvent.change(screen.getByTestId('calc-taric'), { target: { value: '8471300000' } })
    fireEvent.change(screen.getByTestId('calc-value'), { target: { value: '500' } })
    fireEvent.change(screen.getByTestId('calc-origin'), { target: { value: 'US' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('calculator.errorCalculating'))
  })
})
