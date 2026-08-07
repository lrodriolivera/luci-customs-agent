import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, fallback) => fallback || k })
}))

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando open es false', () => {
    const { container } = render(<ConfirmDialog open={false} message="hola" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza título y mensaje cuando open es true', () => {
    render(<ConfirmDialog open title="Confirmar envío" message="¿Enviar a AEAT?" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Confirmar envío')).toBeInTheDocument()
    expect(screen.getByText('¿Enviar a AEAT?')).toBeInTheDocument()
  })

  it('llama onConfirm al pulsar el botón de confirmar', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open message="x" confirmLabel="Enviar" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Enviar'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('llama onCancel al pulsar cancelar y al clicar el overlay', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open message="x" cancelLabel="Cancelar" onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancelar'))
    // Overlay (el div con role=dialog).
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('no cierra al clicar dentro del cuadro (stopPropagation)', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="T" message="x" onCancel={onCancel} />)
    // Clic en el título (dentro del cuadro) no debe propagar al overlay.
    fireEvent.click(screen.getByText('T'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('aplica estilo danger en la variante danger', () => {
    render(<ConfirmDialog open message="x" confirmLabel="Eliminar" variant="danger" />)
    const btn = screen.getByText('Eliminar')
    expect(btn.className).toMatch(/bg-red-600/)
  })
})
