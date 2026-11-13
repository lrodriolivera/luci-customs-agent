import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RepresentationCard from './RepresentationCard'
import { expeditionsAPI, declarationsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({
  expeditionsAPI: { update: vi.fn() },
  declarationsAPI: { getDeclarante: vi.fn() }
}))

const expediente = (representative, client) => ({ _id: 'exp1', representative, client })
const selector = () => screen.getByLabelText('representation.type')
const declaranteRespuesta = (data) => ({ data: { success: true, data } })

describe('RepresentationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sin EORI el backend responde 422: por defecto se simula ese caso, que
    // es justo lo que pasa con un expediente recien creado sin representante.
    declarationsAPI.getDeclarante.mockRejectedValue({ response: { data: { error: 'representation.declarantUnknown' } } })
  })

  test('sin nada guardado muestra representación indirecta, que es la que aplica por defecto', () => {
    render(<RepresentationCard expedition={expediente(undefined)} onSaved={vi.fn()} />)

    expect(selector()).toHaveValue('indirect')
    expect(screen.getByText('representation.indirectHint')).toBeInTheDocument()
    expect(screen.getByText('common.save')).toBeDisabled()
  })

  test('muestra la forma guardada en el expediente', () => {
    render(<RepresentationCard expedition={expediente({ representationType: 'direct' })} onSaved={vi.fn()} />)
    expect(selector()).toHaveValue('direct')
    expect(screen.getByText('representation.directHint')).toBeInTheDocument()
  })

  test('guarda la forma elegida conservando el resto de datos del representante', async () => {
    const actualizado = { _id: 'exp1', representative: { companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'direct' } }
    expeditionsAPI.update.mockResolvedValueOnce({ data: { data: actualizado } })
    const onSaved = vi.fn()
    render(<RepresentationCard expedition={expediente({ companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'indirect' })} onSaved={onSaved} />)

    fireEvent.change(selector(), { target: { value: 'direct' } })
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(actualizado))
    expect(expeditionsAPI.update).toHaveBeenCalledWith('exp1', {
      representative: { companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'direct' }
    })
    expect(toast.success).toHaveBeenCalledWith('representation.saved')
  })

  test('si el guardado falla lo dice y no da el cambio por hecho', async () => {
    expeditionsAPI.update.mockRejectedValueOnce({ response: { data: { error: 'Error al actualizar expediente' } } })
    const onSaved = vi.fn()
    render(<RepresentationCard expedition={expediente(undefined)} onSaved={onSaved} />)

    fireEvent.change(selector(), { target: { value: 'direct' } })
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al actualizar expediente'))
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('explica que el autodespacho lo declara LUCI sin elegirlo', () => {
    render(<RepresentationCard expedition={expediente(undefined)} onSaved={vi.fn()} />)
    expect(screen.getByText('representation.selfNote')).toBeInTheDocument()
  })

  test('pide el declarante al backend (misma regla que el H1) y lo muestra', async () => {
    declarationsAPI.getDeclarante.mockResolvedValue(declaranteRespuesta({
      declarante: { companyName: 'Agencia SL', eori: 'ESB22477020' }, representante: null, forma: '3'
    }))
    render(<RepresentationCard expedition={expediente({ representationType: 'indirect' })} onSaved={vi.fn()} />)

    expect(declarationsAPI.getDeclarante).toHaveBeenCalledWith('exp1')
    expect(await screen.findByText('Agencia SL')).toBeInTheDocument()
    expect(screen.getByText('ESB22477020')).toBeInTheDocument()
    // Forma '3' (indirecta): quien firma con el certificado de LUCI es la
    // agencia, que aqui es el propio declarante.
    expect(screen.getByText('representation.declarantNoteIndirect')).toBeInTheDocument()
    expect(screen.queryByText('representation.representative')).not.toBeInTheDocument()
  })

  test('en representación directa muestra tambien a la agencia como representante', async () => {
    declarationsAPI.getDeclarante.mockResolvedValue(declaranteRespuesta({
      declarante: { companyName: 'Importador SA', eori: 'ESX99999999' },
      representante: { companyName: 'Agencia SL', eori: 'ESB22477020' },
      forma: '2'
    }))
    render(<RepresentationCard expedition={expediente({ representationType: 'direct' })} onSaved={vi.fn()} />)

    expect(await screen.findByText('Importador SA')).toBeInTheDocument()
    expect(screen.getByText('representation.representative')).toBeInTheDocument()
    expect(screen.getByText('Agencia SL')).toBeInTheDocument()
    // Forma '2' (directa): el declarante es el importador, pero quien firma
    // con el certificado de LUCI es la agencia representante, no el importador.
    expect(screen.getByText('representation.declarantNoteDirect')).toBeInTheDocument()
  })

  test('en autodespacho el declarante es el importador y no hay representante', async () => {
    declarationsAPI.getDeclarante.mockResolvedValue(declaranteRespuesta({
      declarante: { companyName: 'Importador SA', eori: 'ESB22477020' }, representante: null, forma: '1'
    }))
    render(<RepresentationCard expedition={expediente(undefined, { companyName: 'Importador SA', eori: 'ESB22477020' })} onSaved={vi.fn()} />)

    expect(await screen.findByText('Importador SA')).toBeInTheDocument()
    expect(screen.queryByText('representation.representative')).not.toBeInTheDocument()
    // Forma '1' (autodespacho): el importador firma con su propio certificado
    // de LUCI, no hay representante que lo haga por el.
    expect(screen.getByText('representation.declarantNoteSelf')).toBeInTheDocument()
  })

  test('si no se conoce la forma todavia, no muestra ninguna nota del declarante', async () => {
    declarationsAPI.getDeclarante.mockRejectedValue({
      response: { data: { error: 'Falta el EORI del representante: configúralo en Ajustes > Aduanas' } }
    })
    render(<RepresentationCard expedition={expediente(undefined)} onSaved={vi.fn()} />)

    expect(await screen.findByText('Falta el EORI del representante: configúralo en Ajustes > Aduanas')).toBeInTheDocument()
    expect(screen.queryByText('representation.declarantNoteIndirect')).not.toBeInTheDocument()
    expect(screen.queryByText('representation.declarantNoteDirect')).not.toBeInTheDocument()
    expect(screen.queryByText('representation.declarantNoteSelf')).not.toBeInTheDocument()
  })

  test('si falta el EORI (422), muestra el motivo que da el backend en vez de dejar la casilla en blanco', async () => {
    declarationsAPI.getDeclarante.mockRejectedValue({
      response: { data: { error: 'Falta el EORI del representante: configúralo en Ajustes > Aduanas' } }
    })
    render(<RepresentationCard expedition={expediente(undefined)} onSaved={vi.fn()} />)

    expect(await screen.findByText('Falta el EORI del representante: configúralo en Ajustes > Aduanas')).toBeInTheDocument()
  })

  test('si falla la consulta sin mensaje del backend, no rompe la tarjeta', async () => {
    declarationsAPI.getDeclarante.mockRejectedValue(new Error('network'))
    render(<RepresentationCard expedition={expediente(undefined)} onSaved={vi.fn()} />)
    expect(await screen.findByText('representation.declarantUnknown')).toBeInTheDocument()
  })

  test('vuelve a pedir el declarante cuando cambia el expediente guardado', async () => {
    declarationsAPI.getDeclarante.mockResolvedValueOnce(declaranteRespuesta({
      declarante: { companyName: 'Agencia SL', eori: 'ESB22477020' }, representante: null, forma: '3'
    }))
    const { rerender } = render(<RepresentationCard expedition={expediente({ representationType: 'indirect' })} onSaved={vi.fn()} />)
    expect(await screen.findByText('Agencia SL')).toBeInTheDocument()

    declarationsAPI.getDeclarante.mockResolvedValueOnce(declaranteRespuesta({
      declarante: { companyName: 'Importador SA', eori: 'ESX99999999' },
      representante: { companyName: 'Agencia SL', eori: 'ESB22477020' },
      forma: '2'
    }))
    rerender(<RepresentationCard expedition={expediente({ representationType: 'direct' })} onSaved={vi.fn()} />)

    expect(await screen.findByText('Importador SA')).toBeInTheDocument()
    expect(declarationsAPI.getDeclarante).toHaveBeenCalledTimes(2)
  })
})
