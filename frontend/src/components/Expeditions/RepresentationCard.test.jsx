import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RepresentationCard from './RepresentationCard'
import { expeditionsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({ expeditionsAPI: { update: vi.fn() } }))

const expediente = (representative) => ({ _id: 'exp1', representative })
const selector = () => screen.getByLabelText('representation.type')

describe('RepresentationCard', () => {
  beforeEach(() => vi.clearAllMocks())

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
})
