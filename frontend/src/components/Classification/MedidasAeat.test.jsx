import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import MedidasAeat from './MedidasAeat'
import { classificationAPI } from '../../services/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))
vi.mock('../../services/api', () => ({ classificationAPI: { aeatTariff: vi.fn() } }))

// Respuesta real del backend para 6302210089 con origen China (16/11/2026), resumida.
const RESPUESTA = {
  existe: true,
  codigo: '6302210089',
  areaGeografica: 'CN',
  fechaConsulta: '16-11-2026',
  descripcion: 'Las demás',
  url: 'https://www1.agenciatributaria.gob.es/wlpl/inwinvoc/es.aeat.dit.adu.adta.trans.bdm.TtCodNomIntQue',
  medidas: [
    { codigo: '103-APPL', tipo: 'ue', areaGeografica: 'TODOS ERGA OMNES', descripcion: 'Derecho terceros países', derecho: '12,000%', documentos: [] },
    {
      codigo: '107-LVC', tipo: 'ue', areaGeografica: 'TODOS ERGA OMNES', descripcion: 'Derechos de aduana para envíos de escaso valor', derecho: '3,000 EUR',
      documentos: [{ codigo: 'C127', descripcion: 'Identificador del producto comercial' }]
    },
    {
      codigo: 'COM-COMER', tipo: 'nacional', areaGeografica: 'TODOS ERGA OMNES',
      descripcion: 'DOCUMENTO DE CONTROL COMERCIO SEGURIDAD DE LOS PRODUCTOS. REAL DECRETO 330/2008',
      exclusiones: 'Noruega (NO), Turquía (TR)', documentos: []
    },
    { codigo: 'IVA-IVA', tipo: 'iva', areaGeografica: 'TODOS ERGA OMNES', descripcion: 'Impuesto del Valor Añadido', derecho: '21,000%', documentos: [] }
  ]
}

const consultar = () => fireEvent.click(screen.getByRole('button', { name: 'classification.aeat.consult' }))

describe('MedidasAeat', () => {
  beforeEach(() => vi.clearAllMocks())

  test('no consulta la AEAT hasta que se pulsa el botón', () => {
    render(<MedidasAeat code="6302210089" origin="CN" />)
    expect(classificationAPI.aeatTariff).not.toHaveBeenCalled()
  })

  test('muestra las medidas agrupadas: IVA, controles nacionales y medidas de la UE', async () => {
    classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: RESPUESTA } })
    render(<MedidasAeat code="6302210089" origin="CN" />)
    consultar()

    const iva = await screen.findByRole('region', { name: 'classification.aeat.groupTax' })
    expect(within(iva).getByText('Impuesto del Valor Añadido')).toBeInTheDocument()
    expect(within(iva).getByText('21,000%')).toBeInTheDocument()

    const nacional = screen.getByRole('region', { name: 'classification.aeat.groupNational' })
    expect(within(nacional).getByText(/REAL DECRETO 330\/2008/)).toBeInTheDocument()
    expect(within(nacional).getByText('Noruega (NO), Turquía (TR)')).toBeInTheDocument()

    const ue = screen.getByRole('region', { name: 'classification.aeat.groupUe' })
    expect(within(ue).getByText('12,000%')).toBeInTheDocument()
    expect(within(ue).getByText('C127')).toBeInTheDocument()

    expect(classificationAPI.aeatTariff).toHaveBeenCalledWith('6302210089', 'CN')
    expect(screen.getByRole('link', { name: 'classification.aeat.openAeat' })).toHaveAttribute('href', RESPUESTA.url)
  })

  test('sin origen indica que la consulta es para todos los terceros países', async () => {
    classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: { ...RESPUESTA, areaGeografica: '1011' } } })
    render(<MedidasAeat code="6302210089" />)
    consultar()
    expect(await screen.findByText(/classification\.aeat\.ergaOmnes/)).toBeInTheDocument()
  })

  test('si la AEAT no tiene el código lo dice', async () => {
    classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: { ...RESPUESTA, existe: false, medidas: [] } } })
    render(<MedidasAeat code="6302219000" />)
    consultar()
    expect(await screen.findByText('classification.aeat.notFound')).toBeInTheDocument()
  })

  test('muestra el error del servidor si la consulta falla', async () => {
    classificationAPI.aeatTariff.mockRejectedValue({ response: { data: { error: 'No se pudo consultar el Arancel Integrado de la AEAT' } } })
    render(<MedidasAeat code="6302210089" />)
    consultar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el Arancel Integrado de la AEAT')
  })

  describe('contraste con los datos del expediente', () => {
    test('avisa si el arancel y el IVA del expediente no coinciden con la AEAT', async () => {
      classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: RESPUESTA } })
      render(<MedidasAeat code="6302210089" origin="CN" compare={{ dutyRate: 8, vatRate: 10 }} />)
      consultar()

      const avisos = await screen.findAllByRole('status')
      expect(avisos.map((a) => a.textContent)).toEqual([
        'classification.aeat.dutyMismatch:{"expediente":8,"aeat":12}',
        'classification.aeat.vatMismatch:{"expediente":10,"aeat":21}'
      ])
    })

    test('si coinciden lo confirma', async () => {
      classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: RESPUESTA } })
      render(<MedidasAeat code="6302210089" origin="CN" compare={{ dutyRate: 12, vatRate: 21 }} />)
      consultar()
      expect(await screen.findByText('classification.aeat.ratesMatch')).toBeInTheDocument()
      expect(screen.queryByText(/Mismatch/)).not.toBeInTheDocument()
    })

    test('un arancel preferencial del origen no se marca como error, se explica', async () => {
      const conPreferencia = {
        ...RESPUESTA,
        areaGeografica: 'VN',
        medidas: [
          ...RESPUESTA.medidas,
          { codigo: '142-PREF', tipo: 'ue', areaGeografica: 'VN Vietnam', descripcion: 'Preferencias arancelarias', derecho: '0%', documentos: [] }
        ]
      }
      classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: conPreferencia } })
      render(<MedidasAeat code="6302210089" origin="VN" compare={{ dutyRate: 0, vatRate: 21 }} />)
      consultar()
      expect(await screen.findByText('classification.aeat.dutyPreference:{"aeat":0,"general":12}')).toBeInTheDocument()
      expect(screen.queryByText(/dutyMismatch/)).not.toBeInTheDocument()
    })

    test('sin datos del expediente no compara', async () => {
      classificationAPI.aeatTariff.mockResolvedValue({ data: { success: true, data: RESPUESTA } })
      render(<MedidasAeat code="6302210089" origin="CN" />)
      consultar()
      await screen.findByRole('region', { name: 'classification.aeat.groupTax' })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByText('classification.aeat.ratesMatch')).not.toBeInTheDocument()
    })
  })
})
