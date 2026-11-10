import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import H1Preview from './H1Preview'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))

// Misma forma que guarda el backend en expedition.declaration.h1Data.
const h1Data = {
  lrn: 'LRN26ES0001',
  declarationHeader: {
    lrn: 'LRN26ES0001',
    declarationType: 'IM',
    additionalDeclarationType: 'A',
    customsOfficeLodgement: 'ES004611',
    customsOfficePresentation: 'ES004611',
    customsOfficeEntry: 'ES004611',
    importer: {
      identificationNumber: 'ESB12345674',
      name: 'Importadora Levante SL',
      address: { streetAndNumber: 'Calle Mayor 1', city: 'Valencia', postcode: '46001', country: 'ES' }
    },
    declarant: { identificationNumber: 'ESB12345674', name: 'Importadora Levante SL', representativeStatus: '2' },
    exporter: { name: 'Shenzhen Tech Ltd', address: { streetAndNumber: 'Nanshan 8', city: 'Shenzhen', country: 'CN' } },
    totalPackages: 12,
    totalGrossMass: 1050.5
  },
  goodsShipment: {
    countryOfDispatch: 'CN',
    countryOfDestination: 'ES',
    regionOfDestination: '46',
    transportMeans: { modeAtBorder: '1', modeInland: '3', identityAtBorder: 'MSC OSCAR', nationality: 'PA' },
    transportDocument: { type: 'N705', reference: 'MEDUAB123456' },
    containerIndicator: '1',
    containers: [{ containerNumber: 'MSCU1234567' }],
    goodsLocation: { typeOfLocation: 'B', qualifierOfIdentification: 'V' },
    deliveryTerms: { code: 'CIF', country: 'ES' },
    totalInvoicedAmount: 184800,
    currency: 'USD',
    exchangeRate: 1.08,
    transportCharges: { freightAmount: 0, freightCurrency: 'USD' },
    insuranceCharges: null
  },
  goodsItems: [
    {
      itemNumber: 1,
      commodityCode: { taricCode: '8471300000' },
      goodsDescription: 'Ordenadores portátiles',
      requestedProcedure: '40',
      previousProcedure: '00',
      countryOfOrigin: 'CN',
      preference: '100',
      grossMass: 1050.5,
      netMass: 980,
      packaging: { numberOfPackages: 12, typeOfPackages: 'CT', shippingMarks: 'N/M' },
      invoiceValue: 184800,
      customsValue: 171111.11,
      statisticalValue: 171111.11,
      supportingDocuments: [{ type: 'N380', reference: 'INV-2026-001' }]
    }
  ],
  valuation: { valuationMethod: '1', valuationMethodDescription: 'Valor de transacción', customsValue: 171111.11 },
  dutyTaxFee: {
    importDuty: { rate: 0, baseAmount: 171111.11, payableAmount: 0 },
    vat: { rate: 21, baseAmount: 171111.11, payableAmount: 35933.33 },
    totalDuty: 35933.33,
    totalDutyCurrency: 'EUR',
    paymentMethod: 'E'
  },
  guarantee: { guaranteeType: '1' }
}

const valorDe = (label) => screen.getByText(label).nextElementSibling

describe('H1Preview', () => {
  test('muestra el LRN de la declaración, no otro distinto de la cabecera', () => {
    render(<H1Preview h1Data={{ ...h1Data, lrn: 'LRN-DECLARACION', declarationHeader: { ...h1Data.declarationHeader, lrn: 'LRN-CABECERA-ANTIGUA' } }} />)

    expect(valorDe('h1Preview.lrn')).toHaveTextContent('LRN-DECLARACION')
  })

  test('sin h1Data no pinta nada', () => {
    const { container } = render(<H1Preview h1Data={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('muestra la representación con su significado, no solo el código', () => {
    render(<H1Preview h1Data={h1Data} />)

    expect(valorDe('h1Preview.representation')).toHaveTextContent('2 — h1Preview.representationDirect')
    expect(valorDe('h1Preview.declarant')).toHaveTextContent('Importadora Levante SL, ESB12345674')
  })

  test('muestra operadores, transporte y contenedores', () => {
    render(<H1Preview h1Data={h1Data} />)

    expect(valorDe('h1Preview.importerAddress')).toHaveTextContent('Calle Mayor 1, 46001, Valencia, ES')
    expect(valorDe('h1Preview.modeAtBorder')).toHaveTextContent('1 — h1Preview.modeSea')
    expect(valorDe('h1Preview.containers')).toHaveTextContent('MSCU1234567')
    expect(valorDe('h1Preview.transportDocument')).toHaveTextContent('N705, MEDUAB123456')
  })

  test('los importes van con punto de millares y coma decimal', () => {
    render(<H1Preview h1Data={h1Data} />)

    expect(valorDe('h1Preview.invoiceTotal')).toHaveTextContent('184.800,00 USD')
    expect(valorDe('h1Preview.vat')).toHaveTextContent('21 % × 171.111,11 EUR = 35.933,33 EUR')
    expect(valorDe('h1Preview.totalDuty')).toHaveTextContent('35.933,33 EUR')
  })

  test('cada partida muestra TARIC, bultos, masas y documentos', () => {
    render(<H1Preview h1Data={h1Data} />)

    const partida = screen.getByText(/h1Preview\.item:\{"number":1\}/).closest('div')
    expect(within(partida).getByText('8471300000')).toBeInTheDocument()
    expect(within(partida).getByText('h1Preview.packages').nextElementSibling).toHaveTextContent('12, CT, N/M')
    expect(within(partida).getByText('h1Preview.procedure').nextElementSibling).toHaveTextContent('40, 00')
    expect(within(partida).getByText('h1Preview.documents').nextElementSibling).toHaveTextContent('N380, INV-2026-001')
  })

  test('un dato que el H1 no lleva se marca como ausente en vez de dejarse en blanco', () => {
    render(<H1Preview h1Data={h1Data} />)

    // insuranceCharges es null: el agente tiene que verlo.
    expect(valorDe('h1Preview.insurance')).toHaveTextContent('h1Preview.missing')
    // Un flete de 0 es un dato, no una ausencia.
    expect(valorDe('h1Preview.freight')).toHaveTextContent('0,00 USD')
  })

  test('un arancel del 0 % se muestra como 0, no como dato ausente', () => {
    render(<H1Preview h1Data={h1Data} />)

    expect(valorDe('h1Preview.importDuty')).toHaveTextContent('0 % × 171.111,11 EUR = 0,00 EUR')
  })

  test('sin contenedores lo dice expresamente', () => {
    const sinContenedor = { ...h1Data, goodsShipment: { ...h1Data.goodsShipment, containerIndicator: '0', containers: [] } }
    render(<H1Preview h1Data={sinContenedor} />)

    expect(valorDe('h1Preview.containers')).toHaveTextContent('h1Preview.containersNo')
  })

  test('un H1 casi vacío no rompe la vista', () => {
    render(<H1Preview h1Data={{ lrn: 'X' }} />)

    expect(valorDe('h1Preview.lrn')).toHaveTextContent('X')
    expect(valorDe('h1Preview.importer')).toHaveTextContent('h1Preview.missing')
    expect(screen.getByText('h1Preview.sectionItems:{"count":0}')).toBeInTheDocument()
  })

  test('se puede plegar y desplegar', () => {
    render(<H1Preview h1Data={h1Data} />)
    const boton = screen.getByRole('button', { name: /h1Preview\.title/ })

    expect(boton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('h1Preview.importer')).not.toBeInTheDocument()
  })
})
