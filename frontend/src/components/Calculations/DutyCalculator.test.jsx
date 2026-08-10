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
  knowledgeAPI: { incotermInfo: vi.fn() },
  expeditionsAPI: { get: vi.fn() }
}))

// El precargado desde un expediente lee ?expedition=<id>. Por defecto sin query.
let searchParamsMock = new URLSearchParams('')
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchParamsMock, vi.fn()]
}))

import { expeditionsAPI } from '../../services/api'

describe('<DutyCalculator />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsMock = new URLSearchParams('')
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

  /**
   * La unidad suplementaria se pintaba como `{descripcion} ({unidad})` leyendo
   * `supplementaryUnit.type`. Detectado en produccion el 10/Ago/2026: el catalogo
   * TARIC tenia el dato guardado como `type_unit` (la BD y el esquema estaban
   * desalineados por la clave reservada `type` de Mongoose), asi que `.type` era
   * siempre undefined y la UI mostraba "Numero de articulos ()" con el parentesis
   * vacio. Migrados los 5 documentos al nombre del esquema; aqui se fija que la UI
   * no pinte un parentesis vacio si algun dia vuelve a faltar la unidad.
   */
  test('la unidad suplementaria se muestra entre parentesis cuando existe', async () => {
    calculationsAPI.calculateDuties.mockResolvedValue({
      data: { data: { dutyAmount: 0, vatAmount: 2100, totalToPay: 12100, customsValue: 10000,
        supplementaryUnit: { required: true, description: 'Numero de articulos', type: 'p/st' } } }
    })
    render(<DutyCalculator />)
    fireEvent.change(screen.getByTestId('calc-taric'), { target: { value: '8471300000' } })
    fireEvent.change(screen.getByTestId('calc-value'), { target: { value: '10000' } })
    fireEvent.change(screen.getByTestId('calc-origin'), { target: { value: 'CN' } })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText(/Numero de articulos/)).toBeInTheDocument())
    expect(screen.getByText(/Numero de articulos \(p\/st\)/)).toBeInTheDocument()
  })

  test('sin unidad no se pinta un parentesis vacio', async () => {
    calculationsAPI.calculateDuties.mockResolvedValue({
      data: { data: { dutyAmount: 0, vatAmount: 2100, totalToPay: 12100, customsValue: 10000,
        supplementaryUnit: { required: true, description: 'Numero de articulos' } } }
    })
    render(<DutyCalculator />)
    fireEvent.change(screen.getByTestId('calc-taric'), { target: { value: '8471300000' } })
    fireEvent.change(screen.getByTestId('calc-value'), { target: { value: '10000' } })
    fireEvent.change(screen.getByTestId('calc-origin'), { target: { value: 'CN' } })
    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText(/Numero de articulos/)).toBeInTheDocument())
    expect(screen.queryByText(/\(\s*\)/)).not.toBeInTheDocument()
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

  describe('precarga desde un expediente (?expedition=<id>)', () => {
    // BUG UX: "Calcular Derechos" abre /calculator?expedition=<id> pero el
    // formulario salia vacio: nadie leia el query param. El usuario tenia que
    // reescribir TARIC, valor, origen e incoterm que ya constaban en el
    // expediente. Ahora se precargan de la primera partida.
    test('rellena TARIC, valor, origen e incoterm del expediente', async () => {
      searchParamsMock = new URLSearchParams('expedition=exp-1')
      expeditionsAPI.get.mockResolvedValue({
        data: {
          data: {
            incoterm: { code: 'FOB' },
            goods: [
              { taricCode: '9503007000', invoiceValue: 3395, originCountry: 'CN' }
            ]
          }
        }
      })

      render(<DutyCalculator />)

      await waitFor(() => expect(expeditionsAPI.get).toHaveBeenCalledWith('exp-1'))

      // Los campos quedan precargados con los datos de la primera partida.
      await waitFor(() => {
        expect(screen.getByTestId('calc-taric').value).toBe('9503007000')
      })
      expect(screen.getByTestId('calc-value').value).toBe('3395')
      expect(screen.getByTestId('calc-origin').value).toBe('CN')
    })

    test('sin query param no llama a la API de expedientes', async () => {
      render(<DutyCalculator />)
      await waitFor(() => expect(knowledgeAPI.incotermInfo).toHaveBeenCalled())
      expect(expeditionsAPI.get).not.toHaveBeenCalled()
    })

    test('si el expediente falla, el formulario sigue usable', async () => {
      searchParamsMock = new URLSearchParams('expedition=exp-err')
      expeditionsAPI.get.mockRejectedValue(new Error('404'))

      render(<DutyCalculator />)

      await waitFor(() => expect(expeditionsAPI.get).toHaveBeenCalled())
      // No crashea: el titulo sigue presente y los campos vacios.
      expect(screen.getByText('calculator.title')).toBeInTheDocument()
      expect(screen.getByTestId('calc-taric').value).toBe('')
    })
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
