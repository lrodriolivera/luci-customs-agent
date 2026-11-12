import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ExpeditionNew from './ExpeditionNew'
import { expeditionsAPI, documentsAPI } from '../../services/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))
vi.mock('react-hot-toast', () => {
  const toastFn = vi.fn()
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  return { default: toastFn }
})
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => vi.fn() }))
vi.mock('../../services/api', () => ({
  expeditionsAPI: { create: vi.fn() },
  classificationAPI: { classify: vi.fn() },
  documentsAPI: { readDraft: vi.fn(), removeDraft: vi.fn() },
  // La factura de prueba va en dólares: el alta consulta el tipo oficial.
  calculationsAPI: { getExchangeRate: vi.fn(() => Promise.resolve({ data: { data: { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaPublicacion: '2026-10-21' } } })) }
}))

const vacia = {
  legible: true, leido: true, confianza: 90, notas: [],
  exportador: { nombre: null, direccion: null, ciudad: null, pais: null },
  importador: { nombre: null, identificacionFiscal: null, direccion: null, ciudad: null, pais: null },
  factura: { numero: null, fecha: null, moneda: null, importeTotal: null, incoterm: null, lugarIncoterm: null },
  transporte: { numeroDocumento: null, medio: null, puertoCarga: null, puertoDescarga: null, contenedores: [], tipoCarga: null },
  partidas: [], totales: { bultos: null, pesoBrutoKg: null, pesoNetoKg: null }
}
const FACTURA = {
  ...vacia,
  exportador: { nombre: 'Shenzhen Tech Ltd', direccion: null, ciudad: 'Shenzhen', pais: 'CN' },
  importador: { nombre: 'Importadora SL', identificacionFiscal: 'B12345674', direccion: null, ciudad: 'Valencia', pais: 'ES' },
  factura: { ...vacia.factura, moneda: 'USD', importeTotal: 184800, incoterm: 'FOB', lugarIncoterm: 'Shenzhen' },
  partidas: [{ descripcion: 'Ordenadores portatiles', codigoMercancia: '8471300000', paisOrigen: 'CN', cantidad: 480, unidad: 'PCS', bultos: null, tipoBulto: null, pesoBrutoKg: null, pesoNetoKg: null, importe: 184800 }]
}
const BL = {
  ...vacia,
  transporte: { numeroDocumento: 'MEDUSZ123456', medio: 'MSC OSCAR', puertoCarga: 'Yantian', puertoDescarga: 'Valencia', contenedores: ['MSCU1150584'], tipoCarga: 'LCL' },
  totales: { bultos: 12, pesoBrutoKg: 924.48, pesoNetoKg: 864 }
}
const respuesta = (id, type, originalName, extraction) => ({ data: { data: { draft: { id, type, originalName }, extraction } } })

const subir = (nombres) => fireEvent.change(screen.getByLabelText('draftDocs.selectFiles'), {
  target: { files: nombres.map((n) => new File(['x'], n, { type: 'application/pdf' })) }
})

describe('<ExpeditionNew /> — alta desde la documentación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    expeditionsAPI.create.mockResolvedValue({ data: { data: { _id: 'exp1' } } })
  })

  test('dos documentos subidos a la vez rellenan el alta entre los dos y viajan adjuntos', async () => {
    documentsAPI.readDraft
      .mockResolvedValueOnce(respuesta('d1', 'commercial_invoice', 'factura.pdf', FACTURA))
      .mockResolvedValueOnce(respuesta('d2', 'bill_of_lading', 'bl.pdf', BL))
    render(<MemoryRouter><ExpeditionNew /></MemoryRouter>)

    subir(['factura.pdf', 'bl.pdf'])
    await waitFor(() => expect(screen.getByText('bl.pdf')).toBeInTheDocument())

    // Paso 1: partes rellenadas por la factura.
    expect(screen.getByDisplayValue('Importadora SL')).toBeInTheDocument()
    expect(screen.getByDisplayValue('B12345674')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Shenzhen Tech Ltd')).toBeInTheDocument()
    fireEvent.change(document.querySelector('input[type="email"]'), { target: { value: 'c@d.es' } })
    fireEvent.click(screen.getByText('common.next'))

    // Paso 2: la partida viene de la factura y los bultos y pesos, del BL.
    expect(screen.getByDisplayValue('Ordenadores portatiles')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8471300000')).toBeInTheDocument()
    expect(screen.getByLabelText(/expeditions.packagesQuantity/)).toHaveValue(12)
    fireEvent.click(screen.getByText('common.next'))

    // Paso 3: transporte del BL, incoterm de la factura.
    expect(screen.getByLabelText('docReading.field.documentNumber')).toHaveValue('MEDUSZ123456')
    expect(screen.getByLabelText('docReading.field.containers')).toHaveValue('MSCU1150584')
    fireEvent.click(screen.getByText('expeditions.createButton'))

    await waitFor(() => expect(expeditionsAPI.create).toHaveBeenCalled())
    const enviado = expeditionsAPI.create.mock.calls[0][0]
    expect(enviado.draftDocuments).toEqual([{ id: 'd1', type: 'commercial_invoice' }, { id: 'd2', type: 'bill_of_lading' }])
    expect(enviado.client).toMatchObject({ companyName: 'Importadora SL', nif: 'B12345674', city: 'Valencia' })
    expect(enviado.exporter).toMatchObject({ companyName: 'Shenzhen Tech Ltd', country: 'CN' })
    expect(enviado.goods[0]).toMatchObject({
      description: 'Ordenadores portatiles', taricCode: '8471300000', originCountry: 'CN',
      invoiceValue: 184800, currency: 'USD', grossWeight: '924.48', packages: { quantity: 12, type: 'CT' }
    })
    expect(enviado.incoterm).toBe('FOB')
    expect(enviado.transport).toEqual({
      loadType: 'LCL', documentNumber: 'MEDUSZ123456', documentType: 'BL', vehicleId: 'MSC OSCAR',
      departurePort: 'Yantian', arrivalPort: 'Valencia', containers: [{ number: 'MSCU1150584' }]
    })
    expect(enviado.transportDetails).toBeUndefined()
  })

  test('lo que el agente ya habia escrito no se pisa', async () => {
    documentsAPI.readDraft.mockResolvedValueOnce(respuesta('d1', 'commercial_invoice', 'factura.pdf', FACTURA))
    render(<MemoryRouter><ExpeditionNew /></MemoryRouter>)
    const empresa = Array.from(document.querySelectorAll('form input[type="text"]')).find((i) => i.closest('.md\\:col-span-2'))
    fireEvent.change(empresa, { target: { value: 'Mi Cliente SA' } })

    subir(['factura.pdf'])
    await waitFor(() => expect(screen.getByText('factura.pdf')).toBeInTheDocument())

    expect(empresa).toHaveValue('Mi Cliente SA')
    expect(screen.getByText('draftDocs.warnTitle')).toBeInTheDocument()
  })

  test('un documento quitado no viaja con el alta; sin documentos no se envia la lista', async () => {
    documentsAPI.readDraft.mockResolvedValueOnce(respuesta('d1', 'commercial_invoice', 'factura.pdf', FACTURA))
    documentsAPI.removeDraft.mockResolvedValueOnce({ data: { success: true } })
    render(<MemoryRouter><ExpeditionNew /></MemoryRouter>)
    subir(['factura.pdf'])
    await waitFor(() => expect(screen.getByText('factura.pdf')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('draftDocs.remove: factura.pdf'))
    await waitFor(() => expect(screen.queryByText('factura.pdf')).not.toBeInTheDocument())
    fireEvent.change(document.querySelector('input[type="email"]'), { target: { value: 'c@d.es' } })
    fireEvent.click(screen.getByText('common.next'))
    fireEvent.change(screen.getByLabelText(/expeditions.packagesQuantity/), { target: { value: '3' } })
    fireEvent.click(screen.getByText('common.next'))
    fireEvent.click(screen.getByText('expeditions.createButton'))

    await waitFor(() => expect(expeditionsAPI.create).toHaveBeenCalled())
    expect(expeditionsAPI.create.mock.calls[0][0].draftDocuments).toBeUndefined()
  })
})
