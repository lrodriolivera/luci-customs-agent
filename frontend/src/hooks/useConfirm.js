import { useState, useCallback, useRef } from 'react'

/**
 * Hook para confirmaciones con un modal propio en vez de confirm() nativo.
 *
 * Devuelve:
 *  - confirm(opts): Promise<boolean> — abre el modal y resuelve true/false.
 *  - dialogProps: props para <ConfirmDialog {...dialogProps} />.
 *
 * Permite migrar `if (!confirm('...')) return` a `if (!await confirm({ message: '...' })) return`
 * sin cambiar la estructura del handler.
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, opts: {} })
  const resolverRef = useRef(null)

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState({ open: true, opts: typeof opts === 'string' ? { message: opts } : opts })
    })
  }, [])

  const cerrar = useCallback((valor) => {
    setState((s) => ({ ...s, open: false }))
    if (resolverRef.current) {
      resolverRef.current(valor)
      resolverRef.current = null
    }
  }, [])

  const dialogProps = {
    open: state.open,
    ...state.opts,
    onConfirm: () => cerrar(true),
    onCancel: () => cerrar(false)
  }

  return { confirm, dialogProps }
}
