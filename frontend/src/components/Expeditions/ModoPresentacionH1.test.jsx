import React from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (clave) => clave }) }))
import ModoPresentacionH1 from './ModoPresentacionH1'

describe('<ModoPresentacionH1 />', () => {
  test('ofrece declaración o predeclaración con sus dos modos de activación', () => {
    render(<ModoPresentacionH1 valor="" onCambio={() => {}} />)
    const selector = screen.getByLabelText('expeditions.presentationMode')
    expect([...selector.options].map((o) => o.value)).toEqual(['', 'Aduanas', 'Operador'])
    expect(screen.getByRole('option', { name: 'expeditions.presentationModeOperator' })).toBeInTheDocument()
  })

  test('avisa al elegir predeclaración y comunica el modo', () => {
    const onCambio = vi.fn()
    const { rerender } = render(<ModoPresentacionH1 valor="" onCambio={onCambio} />)
    fireEvent.change(screen.getByLabelText('expeditions.presentationMode'), { target: { value: 'Operador' } })
    expect(onCambio).toHaveBeenCalledWith('Operador')

    rerender(<ModoPresentacionH1 valor="Operador" onCambio={onCambio} />)
    expect(screen.getByText('expeditions.presentationModeHint')).toBeInTheDocument()
  })
})
