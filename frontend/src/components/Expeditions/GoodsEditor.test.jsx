import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GoodsEditor from './GoodsEditor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const item = {
  _id: 'g1',
  description: 'Ordenadores portátiles',
  taricCode: '',
  netWeight: 100,
  grossWeight: 120,
  invoiceValue: 184800,
  currency: 'USD'
}

const renderEditor = (props = {}) => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<GoodsEditor item={item} index={0} isSaving={false} onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('GoodsEditor', () => {
  test('guarda TARIC y bultos como números, conservando el resto de la partida', () => {
    const { onSave } = renderEditor()

    change('expeditions.taricCode', '8471 30 00 00')
    change('expeditions.packagesQuantity', '12')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).toHaveBeenCalledWith({
      taricCode: '8471300000',
      netWeight: 100,
      grossWeight: 120,
      invoiceValue: 184800,
      packages: { quantity: 12, type: 'CT' }
    })
  })

  test('conserva las marcas de bulto existentes al cambiar la cantidad', () => {
    const { onSave } = renderEditor({ item: { ...item, packages: { quantity: 3, type: 'PX', marks: 'N/M' } } })

    change('expeditions.packagesQuantity', '5')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave.mock.calls[0][0].packages).toEqual({ quantity: 5, type: 'PX', marks: 'N/M' })
  })

  test('rechaza un TARIC que no tiene entre 8 y 10 dígitos', () => {
    const { onSave } = renderEditor()

    change('expeditions.taricCode', '8471')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.editGoodsTaricInvalid')
  })

  test('rechaza bultos a cero o con decimales', () => {
    const { onSave } = renderEditor()

    change('expeditions.packagesQuantity', '0')
    fireEvent.click(screen.getByText('common.save'))
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.editGoodsPackagesInvalid')

    change('expeditions.packagesQuantity', '2.5')
    fireEvent.click(screen.getByText('common.save'))
    expect(onSave).not.toHaveBeenCalled()
  })

  test('el importe se teclea en formato español: 184.800 se guarda como 184800', () => {
    const { onSave } = renderEditor({ item: { ...item, invoiceValue: 100 } })

    change('expeditions.invoiceValue (USD)', '184.800')
    expect(screen.getByText('expeditions.valueWillBeSaved')).toBeInTheDocument()
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave.mock.calls[0][0].invoiceValue).toBe(184800)
  })

  test('un importe guardado con tres decimales no se convierte en millares al abrir el editor', () => {
    const { onSave } = renderEditor({ item: { ...item, invoiceValue: 1.234 } })

    expect(screen.getByLabelText('expeditions.invoiceValue (USD)')).toHaveValue('1,234')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave.mock.calls[0][0].invoiceValue).toBe(1.234)
  })

  test('un importe que no se puede interpretar se señala y no se guarda', () => {
    const { onSave } = renderEditor()

    change('expeditions.invoiceValue (USD)', '12.34,5')
    expect(screen.getByText('expeditions.valueNotValid')).toBeInTheDocument()
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).not.toHaveBeenCalled()
  })

  test('rechaza un valor de factura vacío', () => {
    const { onSave } = renderEditor()

    change('expeditions.invoiceValue (USD)', '')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.editGoodsValueInvalid')
  })

  test('un peso vacío se envía como undefined, no como 0', () => {
    const { onSave } = renderEditor()

    change('expeditions.netWeight', '')
    fireEvent.click(screen.getByText('common.save'))

    expect(onSave.mock.calls[0][0].netWeight).toBeUndefined()
  })

  test('cancelar no guarda', () => {
    const { onSave, onCancel } = renderEditor()

    fireEvent.click(screen.getByText('common.cancel'))

    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('mientras guarda, los botones quedan deshabilitados', () => {
    renderEditor({ isSaving: true })

    expect(screen.getByText('common.saving')).toBeDisabled()
    expect(screen.getByText('common.cancel')).toBeDisabled()
  })
})
