import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PartiesCard from './PartiesCard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

const EXP = {
  operationType: 'import',
  client: { companyName: 'Distribuciones Iberica del Levante S.L.', nif: 'B46123451', eori: 'ESB46123451', address: { street: 'Calle 1', city: 'Valencia', postalCode: '46001', country: 'ES' }, contact: { name: 'Ana', email: 'ana@x.es' } },
  exporter: { companyName: 'Shanghai Hongtai', address: 'No. 1288 Pudong Ave', city: 'Shanghai', postalCode: '200120', country: 'CN' }
}

describe('PartiesCard', () => {
  test('muestra importador y exportador; sin onSave no se puede editar', () => {
    render(<PartiesCard expedition={EXP} />)
    expect(screen.getByText('B46123451')).toBeInTheDocument()
    expect(screen.getByText('Shanghai Hongtai')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument()
  })

  test('cambia el NIF del importador sin rehacer el expediente (UAT 16/Nov/2026)', async () => {
    const onSave = vi.fn().mockResolvedValue()
    render(<PartiesCard expedition={EXP} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }))

    fireEvent.change(screen.getByLabelText('expeditions.nifCif'), { target: { value: '89890010f' } })
    fireEvent.change(screen.getByLabelText('expeditions.eori'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('expeditions.parties.country'), { target: { value: 'cn' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const { client, exporter } = onSave.mock.calls[0][0]
    expect(client).toMatchObject({ companyName: 'Distribuciones Iberica del Levante S.L.', nif: '89890010F', eori: '', address: { city: 'Valencia', country: 'ES' } })
    expect(exporter).toMatchObject({ companyName: 'Shanghai Hongtai', postalCode: '200120', country: 'CN' })
    expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument()
  })

  test('sin razón social o NIF no guarda', () => {
    const onSave = vi.fn()
    render(<PartiesCard expedition={EXP} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }))
    fireEvent.change(screen.getByLabelText('expeditions.nifCif'), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('expeditions.parties.required')
    expect(onSave).not.toHaveBeenCalled()
  })
})
