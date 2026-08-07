import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirm } from './useConfirm'

describe('useConfirm', () => {
  it('abre el diálogo y resuelve true al confirmar', async () => {
    const { result } = renderHook(() => useConfirm())

    let promesa
    act(() => { promesa = result.current.confirm({ message: 'ok?' }) })
    expect(result.current.dialogProps.open).toBe(true)
    expect(result.current.dialogProps.message).toBe('ok?')

    act(() => { result.current.dialogProps.onConfirm() })
    await expect(promesa).resolves.toBe(true)
    expect(result.current.dialogProps.open).toBe(false)
  })

  it('resuelve false al cancelar', async () => {
    const { result } = renderHook(() => useConfirm())

    let promesa
    act(() => { promesa = result.current.confirm('¿seguro?') })
    // Acepta string como mensaje.
    expect(result.current.dialogProps.message).toBe('¿seguro?')

    act(() => { result.current.dialogProps.onCancel() })
    await expect(promesa).resolves.toBe(false)
  })
})
