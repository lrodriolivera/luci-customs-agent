import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GroupageCard, { isMaritime } from './GroupageCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))

const expedition = {
  transportMode: 'SEA',
  goodsSummary: { totalPackages: 12, totalGrossWeight: 1050.5 },
  transport: { carrier: 'MSC' }
}

const renderCard = (props = {}) => {
  const onSave = vi.fn()
  render(<GroupageCard expedition={expedition} isSaving={false} onSave={onSave} {...props} />)
  return { onSave }
}

const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('GroupageCard', () => {
  test('sin tipo de carga no pide la sumaria ni muestra la regla', () => {
    renderCard()

    expect(screen.queryByLabelText('groupage.summaryNumber')).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  test('al marcar grupaje explica la regla y muestra los totales del expediente para contrastar', () => {
    renderCard()

    change('groupage.loadType', 'LCL')

    expect(screen.getByRole('note')).toHaveTextContent('groupage.ruleText')
    expect(screen.getByText('groupage.expeditionTotals:{"packages":12,"weight":"1050,5"}')).toBeInTheDocument()
  })

  test('guarda el tipo de carga y la sumaria con bultos y peso como números', () => {
    const { onSave } = renderCard()

    change('groupage.loadType', 'LCL')
    change('groupage.summaryNumber', ' 46112600012345 ')
    change('groupage.summaryItem', '3')
    change('groupage.summaryPackages', '12')
    change('groupage.summaryGrossWeight', '1050.5')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).toHaveBeenCalledWith({
      loadType: 'LCL',
      summaryDeclaration: { number: '46112600012345', item: '3', packages: 12, grossWeight: 1050.5 }
    })
  })

  test('grupaje sin sumaria todavía: se guarda el tipo de carga y la sumaria queda sin definir', () => {
    const { onSave } = renderCard()

    change('groupage.loadType', 'LCL')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).toHaveBeenCalledWith({ loadType: 'LCL', summaryDeclaration: undefined })
  })

  test('quitar el tipo de carga lo envía sin definir, no como cadena vacía', () => {
    const { onSave } = renderCard({ expedition: { ...expedition, transport: { loadType: 'FCL' } } })

    change('groupage.loadType', '')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).toHaveBeenCalledWith({ loadType: undefined, summaryDeclaration: undefined })
  })

  test('carga los datos ya registrados en el expediente', () => {
    renderCard({
      expedition: {
        ...expedition,
        transport: { loadType: 'LCL', summaryDeclaration: { number: 'S-1', item: '2', packages: 12, grossWeight: 1050.5 } }
      }
    })

    expect(screen.getByLabelText('groupage.loadType')).toHaveValue('LCL')
    expect(screen.getByLabelText('groupage.summaryNumber')).toHaveValue('S-1')
    expect(screen.getByLabelText('groupage.summaryPackages')).toHaveValue(12)
  })

  test('mientras guarda el botón queda deshabilitado', () => {
    renderCard({ isSaving: true })
    expect(screen.getByText('common.saving')).toBeDisabled()
  })

  test('isMaritime reconoce las formas en que se guarda el modo marítimo', () => {
    expect(isMaritime({ transportMode: 'SEA' })).toBe(true)
    expect(isMaritime({ transportMode: 'maritime' })).toBe(true)
    expect(isMaritime({ transportMode: 'AIR' })).toBe(false)
    expect(isMaritime(undefined)).toBe(false)
  })
})
