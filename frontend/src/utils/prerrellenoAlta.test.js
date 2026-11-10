import { describe, test, expect } from 'vitest'
import {
  prerrellenarAlta, transporteParaAlta, identificacionFiscal, partidaVacia, transporteVacio
} from './prerrellenoAlta'

const formulario = (extra = {}) => ({
  operationType: 'IMPORT',
  client: { companyName: '', nif: '', eori: '', address: '', city: '', postalCode: '', country: 'ES', email: '' },
  exporter: { companyName: '', address: '', city: '', country: '' },
  consignee: { companyName: '', address: '', city: '', country: '' },
  goods: [partidaVacia()],
  transportMode: 'SEA',
  loadType: '',
  incoterm: 'CIF',
  incotermPlace: '',
  transportDetails: transporteVacio(),
  ...extra
})

const lectura = (extra = {}) => ({
  legible: true, leido: true, confianza: 90, notas: [],
  exportador: { nombre: null, direccion: null, ciudad: null, pais: null },
  importador: { nombre: null, identificacionFiscal: null, direccion: null, ciudad: null, pais: null },
  factura: { numero: null, fecha: null, moneda: null, importeTotal: null, incoterm: null, lugarIncoterm: null },
  transporte: { numeroDocumento: null, medio: null, puertoCarga: null, puertoDescarga: null, contenedores: [], tipoCarga: null },
  partidas: [],
  totales: { bultos: null, pesoBrutoKg: null, pesoNetoKg: null },
  ...extra
})

const FACTURA = lectura({
  exportador: { nombre: 'Shenzhen Tech Ltd', direccion: '88 Nanshan Rd', ciudad: 'Shenzhen', pais: 'CN' },
  importador: { nombre: 'Importadora SL', identificacionFiscal: 'ES-B12345674', direccion: 'Calle Mayor 1', ciudad: 'Valencia', pais: 'ES' },
  factura: { numero: 'INV-1', fecha: null, moneda: 'USD', importeTotal: 184800, incoterm: 'FOB', lugarIncoterm: 'Shenzhen' },
  partidas: [{ descripcion: 'Laptop 14"', codigoMercancia: '847130', paisOrigen: 'CN', cantidad: 480, unidad: 'PCS', bultos: null, tipoBulto: null, pesoBrutoKg: null, pesoNetoKg: null, importe: 184800.5 }]
})

const PACKING = lectura({
  partidas: [{ descripcion: 'Laptop 14"', codigoMercancia: null, paisOrigen: null, cantidad: null, unidad: null, bultos: 1, tipoBulto: 'CT', pesoBrutoKg: 77, pesoNetoKg: 72, importe: null }],
  totales: { bultos: 12, pesoBrutoKg: 924.48, pesoNetoKg: 864 }
})

const BL = lectura({
  transporte: { numeroDocumento: 'MEDUSZ123456', medio: 'MSC OSCAR', puertoCarga: 'Yantian', puertoDescarga: 'Valencia', contenedores: ['MSCU1150584'], tipoCarga: 'LCL' },
  totales: { bultos: 12, pesoBrutoKg: 924.48, pesoNetoKg: null }
})

describe('prerrellenarAlta', () => {
  test('una factura rellena las partes, la partida, el incoterm y la moneda', () => {
    const { formData, rellenados, avisos } = prerrellenarAlta(formulario(), FACTURA, { tipoDocumento: 'commercial_invoice' })

    expect(formData.client).toMatchObject({ companyName: 'Importadora SL', nif: 'B12345674', eori: 'ESB12345674', address: 'Calle Mayor 1', city: 'Valencia' })
    expect(formData.exporter).toMatchObject({ companyName: 'Shenzhen Tech Ltd', country: 'CN', city: 'Shenzhen', address: '88 Nanshan Rd' })
    expect(formData.goods[0]).toMatchObject({ description: 'Laptop 14"', originCountry: 'CN', quantity: '480', quantityUnit: 'PCS', invoiceValue: '184800,5', currency: 'USD' })
    expect(formData.incoterm).toBe('FOB')
    expect(formData.incotermPlace).toBe('Shenzhen')
    expect(avisos).toEqual([])
    expect(rellenados.map((r) => r.campo)).toEqual(expect.arrayContaining(['clientName', 'clientNif', 'counterpartName', 'description', 'invoiceValue', 'currency', 'incotermCode']))
  })

  test('un codigo de mercancia de 6 digitos no se pone como TARIC', () => {
    const { formData } = prerrellenarAlta(formulario(), FACTURA, { tipoDocumento: 'commercial_invoice' })
    expect(formData.goods[0].taricCode).toBe('')
  })

  test('un TARIC de 10 digitos si se rellena', () => {
    const conTaric = lectura({ partidas: [{ ...FACTURA.partidas[0], codigoMercancia: '8471300000' }] })
    const { formData } = prerrellenarAlta(formulario(), conTaric, {})
    expect(formData.goods[0].taricCode).toBe('8471300000')
  })

  test('no pisa lo que el agente ya ha escrito y avisa de la diferencia', () => {
    const escrito = formulario({ client: { ...formulario().client, companyName: 'Otra Empresa SA' } })

    const { formData, avisos } = prerrellenarAlta(escrito, FACTURA, { tipoDocumento: 'commercial_invoice' })

    expect(formData.client.companyName).toBe('Otra Empresa SA')
    expect(avisos).toContainEqual({ campo: 'clientName', valor: 'Importadora SL', actual: 'Otra Empresa SA' })
  })

  test('una descripcion redactada de otra forma no se cambia ni genera aviso', () => {
    const trasFactura = prerrellenarAlta(formulario(), FACTURA, {}).formData
    const otra = lectura({ partidas: [{ ...PACKING.partidas[0], descripcion: 'Laptops 14 inch' }] })

    const { formData, avisos } = prerrellenarAlta(trasFactura, otra, { tipoDocumento: 'packing_list' })

    expect(formData.goods[0].description).toBe('Laptop 14"')
    expect(avisos.filter((a) => a.campo === 'description')).toEqual([])
  })

  test('no avisa cuando el documento dice lo mismo que hay, aunque cambie la caja', () => {
    const escrito = formulario({ client: { ...formulario().client, companyName: 'IMPORTADORA SL' } })
    const { avisos } = prerrellenarAlta(escrito, FACTURA, {})
    expect(avisos.filter((a) => a.campo === 'clientName')).toEqual([])
  })

  test('con una sola partida, el packing list aporta los totales y no el detalle de linea', () => {
    const trasFactura = prerrellenarAlta(formulario(), FACTURA, { tipoDocumento: 'commercial_invoice' }).formData

    const { formData, avisos } = prerrellenarAlta(trasFactura, PACKING, { tipoDocumento: 'packing_list' })

    expect(formData.goods[0].packages).toEqual({ quantity: '12', type: 'CT' })
    expect(formData.goods[0].grossWeight).toBe('924.48')
    expect(formData.goods[0].netWeight).toBe('864')
    expect(formData.goods[0].invoiceValue).toBe('184800,5')
    expect(avisos).toEqual([])
  })

  test('un BL fija el modo, el tipo de carga y los datos del transporte', () => {
    const { formData, rellenados } = prerrellenarAlta(formulario({ transportMode: 'AIR' }), BL, { tipoDocumento: 'bill_of_lading' })

    expect(formData.transportMode).toBe('AIR')
    const desdeDefecto = prerrellenarAlta(formulario(), BL, { tipoDocumento: 'bill_of_lading' }).formData
    expect(desdeDefecto.transportMode).toBe('SEA')
    expect(desdeDefecto.loadType).toBe('LCL')
    expect(desdeDefecto.transportDetails).toEqual({
      documentType: 'BL', documentNumber: 'MEDUSZ123456', vehicleId: 'MSC OSCAR', departurePort: 'Yantian', arrivalPort: 'Valencia', containers: 'MSCU1150584'
    })
    expect(rellenados.length).toBeGreaterThan(0)
  })

  test('un AWB cambia el modo por defecto a aereo y no rellena el tipo de carga', () => {
    const awb = lectura({ transporte: { ...BL.transporte, tipoCarga: 'LCL' } })
    const { formData } = prerrellenarAlta(formulario(), awb, { tipoDocumento: 'air_waybill' })
    expect(formData.transportMode).toBe('AIR')
    expect(formData.loadType).toBe('')
    expect(formData.transportDetails.documentType).toBe('AWB')
  })

  test('el numero de documento de transporte solo se toma de un documento de transporte', () => {
    const facturaConBl = lectura({ transporte: { ...BL.transporte } })
    const { formData } = prerrellenarAlta(formulario(), facturaConBl, { tipoDocumento: 'commercial_invoice' })
    expect(formData.transportDetails.documentNumber).toBe('')
    expect(formData.transportDetails.vehicleId).toBe('MSC OSCAR')
  })

  test('un valor por defecto ya fijado por un documento anterior no se vuelve a cambiar', () => {
    const primera = prerrellenarAlta(formulario(), FACTURA, { tipoDocumento: 'commercial_invoice' })
    const otra = lectura({ factura: { ...FACTURA.factura, incoterm: 'CIF' } })
    const fob = { ...primera.formData, incoterm: 'CIF' }

    const { formData, avisos } = prerrellenarAlta(fob, lectura({ factura: { ...FACTURA.factura, incoterm: 'DAP' } }), { fijados: primera.rellenados.map((r) => r.clave) })

    expect(formData.incoterm).toBe('CIF')
    expect(avisos).toContainEqual({ campo: 'incotermCode', valor: 'DAP', actual: 'CIF' })
    expect(otra.factura.incoterm).toBe('CIF')
  })

  test('varias partidas en el documento crean las partidas del formulario en blanco', () => {
    const dos = lectura({
      factura: { ...FACTURA.factura, importeTotal: 300 },
      partidas: [
        { descripcion: 'Raton', codigoMercancia: null, paisOrigen: 'CN', cantidad: 10, unidad: 'cajas', bultos: 2, tipoBulto: 'CT', pesoBrutoKg: 5, pesoNetoKg: 4, importe: 100 },
        { descripcion: 'Teclado', codigoMercancia: null, paisOrigen: 'VN', cantidad: null, unidad: null, bultos: 3, tipoBulto: 'PX', pesoBrutoKg: 9, pesoNetoKg: 8, importe: 200 }
      ],
      totales: { bultos: 5, pesoBrutoKg: 14, pesoNetoKg: 12 }
    })

    const { formData } = prerrellenarAlta(formulario(), dos, { tipoDocumento: 'commercial_invoice' })

    expect(formData.goods).toHaveLength(2)
    expect(formData.goods[0]).toMatchObject({ description: 'Raton', quantity: '', invoiceValue: '100', packages: { quantity: '2', type: 'CT' } })
    expect(formData.goods[1]).toMatchObject({ description: 'Teclado', originCountry: 'VN', invoiceValue: '200', packages: { quantity: '3', type: 'PX' }, grossWeight: '9' })
  })

  test('si las partidas del documento no casan con las del formulario, no toca ninguna y avisa', () => {
    const escrito = formulario({ goods: [{ ...partidaVacia(), description: 'A' }, { ...partidaVacia(), description: 'B' }] })

    const { formData, avisos } = prerrellenarAlta(escrito, FACTURA, {})

    expect(formData.goods.map((g) => g.invoiceValue)).toEqual(['', ''])
    expect(avisos).toContainEqual({ campo: 'itemsMismatch', valor: 1, actual: 2 })
  })

  test('una moneda que el alta no ofrece no se cambia y se avisa', () => {
    const jpy = lectura({ factura: { ...FACTURA.factura, moneda: 'JPY' }, partidas: FACTURA.partidas })
    const { formData, avisos } = prerrellenarAlta(formulario(), jpy, {})
    expect(formData.goods[0].currency).toBe('EUR')
    expect(avisos).toContainEqual({ campo: 'currencyNotAvailable', valor: 'JPY', partida: 1 })
  })

  test('una identificacion fiscal que no es un NIF valido no se rellena y se avisa', () => {
    const raro = lectura({ importador: { ...FACTURA.importador, identificacionFiscal: 'VAT 12' } })
    const { formData, avisos } = prerrellenarAlta(formulario(), raro, {})
    expect(formData.client.nif).toBe('')
    expect(avisos).toContainEqual({ campo: 'fiscalIdNotRecognised', valor: 'VAT 12' })
  })

  test('en exportacion el cliente es el exportador y el importador va al destinatario', () => {
    const { formData } = prerrellenarAlta(formulario({ operationType: 'EXPORT' }), FACTURA, {})
    expect(formData.client.companyName).toBe('Shenzhen Tech Ltd')
    expect(formData.client.nif).toBe('')
    expect(formData.consignee).toMatchObject({ companyName: 'Importadora SL', country: 'ES', city: 'Valencia' })
    expect(formData.exporter.companyName).toBe('')
  })

  test('un documento ilegible o no leido no cambia nada', () => {
    const base = formulario()
    expect(prerrellenarAlta(base, { ...FACTURA, legible: false }, {})).toEqual({ formData: base, rellenados: [], avisos: [] })
    expect(prerrellenarAlta(base, { ...FACTURA, leido: false }, {}).formData).toBe(base)
    expect(prerrellenarAlta(base, null, {}).formData).toBe(base)
  })

  test('no muta el formulario de entrada', () => {
    const base = formulario()
    const copia = JSON.parse(JSON.stringify(base))
    prerrellenarAlta(base, FACTURA, { tipoDocumento: 'commercial_invoice' })
    expect(base).toEqual(copia)
  })
})

describe('identificacionFiscal', () => {
  test('separa NIF y EORI', () => {
    expect(identificacionFiscal('ES B-12345674')).toEqual({ nif: 'B12345674', eori: 'ESB12345674' })
    expect(identificacionFiscal('b12345674')).toEqual({ nif: 'B12345674' })
    expect(identificacionFiscal('x')).toEqual({})
  })
})

describe('transporteParaAlta', () => {
  test('envia solo lo informado y los contenedores como lista', () => {
    const datos = formulario({ loadType: 'LCL', transportDetails: { ...transporteVacio(), documentType: 'BL', documentNumber: ' MEDU1 ', containers: 'mscu1150584, TGHU8842217' } })
    expect(transporteParaAlta(datos)).toEqual({
      loadType: 'LCL', documentNumber: 'MEDU1', documentType: 'BL', containers: [{ number: 'MSCU1150584' }, { number: 'TGHU8842217' }]
    })
  })

  test('sin nada informado no envia transporte', () => {
    expect(transporteParaAlta(formulario())).toBeUndefined()
    expect(transporteParaAlta(formulario({ transportMode: 'AIR', loadType: 'LCL' }))).toBeUndefined()
  })
})
