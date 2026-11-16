import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AesDatosSalida from './AesDatosSalida'
import { declarationsAPI } from '../../services/api'
import toast from 'react-hot-toast'

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../services/api', () => ({ declarationsAPI: { update: vi.fn() } }))

const expedicion = { _id: 'exp1', declaration: { type: 'AES', officeOfExit: 'ES004601', goodsLocation: '' } }

describe('AesDatosSalida', () => {
  beforeEach(() => vi.clearAllMocks())

  test('muestra lo guardado y envía la aduana de salida y la ubicación', async () => {
    declarationsAPI.update.mockResolvedValue({ data: { success: true } })
    const onGuardado = vi.fn()
    render(<AesDatosSalida expedition={expedicion} onGuardado={onGuardado} />)
    expect(screen.getByLabelText('Aduana de salida')).toHaveValue('ES004601')
    fireEvent.change(screen.getByLabelText('Ubicación de las mercancías'), { target: { value: '2801aaaaac' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos del AES' }))
    await waitFor(() => expect(declarationsAPI.update).toHaveBeenCalledWith('exp1', { officeOfExit: 'ES004601', goodsLocation: '2801AAAAAC' }))
    expect(toast.success).toHaveBeenCalled()
    expect(onGuardado).toHaveBeenCalled()
  })

  test('muestra el error del backend', async () => {
    declarationsAPI.update.mockRejectedValue({ response: { data: { error: 'La aduana de salida es un código de 8 caracteres' } } })
    render(<AesDatosSalida expedition={expedicion} onGuardado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos del AES' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La aduana de salida es un código de 8 caracteres'))
  })
})
