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

  describe('consulta en la AEAT', () => {
    const conSumaria = (aeat) => ({
      ...expedition,
      transport: { loadType: 'LCL', summaryDeclaration: { number: '46116000123', item: '3', packages: 12, grossWeight: 1050.5, aeat } }
    })

    test('sin sumaria guardada no hay nada que consultar', () => {
      renderCard({ onVerify: vi.fn() })
      expect(screen.queryByText('groupage.verify')).not.toBeInTheDocument()
    })

    test('con la sumaria guardada se puede consultar en la AEAT', () => {
      const onVerify = vi.fn()
      renderCard({ expedition: conSumaria(undefined), onVerify })

      fireEvent.click(screen.getByText('groupage.verify'))

      expect(onVerify).toHaveBeenCalledTimes(1)
    })

    test('muestra lo que respondió la AEAT: estado, bultos, kilos, saldo, conocimiento y ubicación', () => {
      renderCard({
        expedition: conSumaria({
          verified: true, environment: 'ES.AEAT', itemStatus: 'AC', itemStatusText: 'Activa', isMaster: false,
          packages: 12, grossWeight: 1050.5, packagesBalance: 12, billOfLading: 'BL-1', location: '4611ADT001'
        })
      })

      const estado = screen.getByRole('status')
      expect(estado).toHaveTextContent('groupage.aeatVerified (ES.AEAT)')
      expect(estado).toHaveTextContent('groupage.aeatItem:{"status":"Activa","packages":12,"weight":1050.5}')
      expect(estado).toHaveTextContent('groupage.aeatBalance:{"packages":12}')
      expect(estado).toHaveTextContent('groupage.aeatBillOfLading:{"value":"BL-1"}')
      expect(estado).toHaveTextContent('groupage.aeatLocation:{"value":"4611ADT001"}')
      expect(estado).not.toHaveTextContent('groupage.aeatMaster')
    })

    test('una partida máster se señala expresamente', () => {
      renderCard({
        expedition: conSumaria({ verified: true, itemStatus: 'MA', itemStatusText: 'Máster activo', isMaster: true, packages: 820, grossWeight: 14200 })
      })

      expect(screen.getByRole('status')).toHaveTextContent('groupage.aeatMaster')
    })

    test('si no se pudo consultar lo dice, con el motivo', () => {
      renderCard({ expedition: conSumaria({ verified: false, error: 'ECONNRESET' }) })

      const estado = screen.getByRole('status')
      expect(estado).toHaveTextContent('groupage.aeatNotVerified')
      expect(estado).toHaveTextContent('ECONNRESET')
    })

    test('el motivo del bloqueo y el aviso de la última consulta quedan a la vista', () => {
      renderCard({
        expedition: conSumaria(undefined),
        verification: { blocked: true, reason: 'La partida es máster', warning: 'No se pudo comprobar' }
      })

      expect(screen.getByRole('alert')).toHaveTextContent('La partida es máster')
      expect(screen.getByText('No se pudo comprobar')).toBeInTheDocument()
    })

    test('mientras consulta el botón queda deshabilitado', () => {
      renderCard({ expedition: conSumaria(undefined), onVerify: vi.fn(), isVerifying: true })
      expect(screen.getByText('groupage.verifying')).toBeDisabled()
    })
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
