const { aplicarCauAVistaPrevia } = require('../../../src/services/aeat/h1CauVistaPrevia');

const VISTA = {
  lrn: 'L1',
  declarationHeader: {
    lrn: 'L1', customsOfficeLodgement: 'ES003001', customsOfficePresentation: 'ES003001', customsOfficeEntry: 'ES003001',
    importer: { name: 'Importadora SL', identificationNumber: 'ESB12345674' },
    declarant: { name: 'Agencia SL', identificationNumber: 'ESB22477020', representativeStatus: '3' }
  },
  guarantee: { guaranteeType: '1' },
  dutyTaxFee: { paymentMethod: 'A', paymentMethodDescription: 'Pago al contado', totalDuty: 3161.84 },
  goodsShipment: {
    currency: 'USD', countryOfDestination: 'ES', regionOfDestination: 'ES-VC', goodsLocation: { typeOfLocation: 'B', qualifierOfIdentification: 'T' }, placeOfUnloading: { location: 'Puerto de Algeciras', code: 'ESALG' },
    transportDocument: { type: 'N705', reference: 'MSCU20268198800' }
  },
  goodsItems: [{ itemNumber: 1, customsValue: 8901.55, supportingDocuments: [{ type: 'N380', reference: 'QA-escaneado-factura.pdf' }] }]
};
const CAU = {
  aduanaImportacion: 'ES002801', aduanaPresentacion: 'ES002801',
  declarante: { id: 'ESB22477020' }, representante: null, garantias: [],
  envio: {
    destino: { pais: 'ES', region: '46' },
    documentosJustificativos: [{ tipo: '1005', referencia: 'OSRE' }],
    expedicion: { ubicacion: { tipo: 'B', calificador: 'Y', autorizacion: 'ES002801AAAAAA' }, documentosTransporte: [{ tipo: 'N705', referencia: 'MSCU20268198800' }] },
    partidas: [{ documentosPrevios: [{ tipo: 'N337', referencia: '26ES00280180000014' }], documentosJustificativos: [{ tipo: 'N380', referencia: 'FAC-2026-118' }], tributos: [{ tipo: 'A00', medioDePago: 'A' }] }]
  }
};

describe('vista previa del H1 por el servicio CAU', () => {
  const vista = aplicarCauAVistaPrevia(VISTA, CAU);

  test('muestra las aduanas que se envían, no las deducidas del puerto', () => {
    expect(vista.declarationHeader).toMatchObject({ customsOfficeLodgement: 'ES002801', customsOfficePresentation: 'ES002801' });
    // La aduana de entrada no va en el mensaje: se conserva.
    expect(vista.declarationHeader.customsOfficeEntry).toBe('ES003001');
  });

  test('muestra la ubicación de las mercancías que se declara', () => {
    expect(vista.goodsShipment.goodsLocation).toEqual({ typeOfLocation: 'B', qualifierOfIdentification: 'Y' });
    expect(vista.goodsShipment.placeOfUnloading).toEqual({ location: 'ES002801AAAAAA', code: 'ESALG' });
    expect(vista.goodsShipment.currency).toBe('USD');
  });

  test('los documentos de la partida son los que se declaran: sumaria, factura, transporte y autorización', () => {
    expect(vista.goodsItems[0].supportingDocuments).toEqual([
      { type: 'N337', reference: '26ES00280180000014' },
      { type: 'N380', reference: 'FAC-2026-118' },
      { type: 'N705', reference: 'MSCU20268198800' },
      { type: '1005', reference: 'OSRE' }
    ]);
    expect(vista.goodsItems[0].customsValue).toBe(8901.55);
  });

  test('marca el servicio y no modifica el original', () => {
    expect(vista.servicio).toBe('CC415AV1');
    expect(VISTA.declarationHeader.customsOfficeLodgement).toBe('ES003001');
    expect(VISTA.servicio).toBeUndefined();
  });

  test('sin ubicación ni documento de transporte conserva lo que había', () => {
    const sin = aplicarCauAVistaPrevia(VISTA, { aduanaImportacion: 'ES002801', aduanaPresentacion: 'ES002801', envio: { partidas: [] } });
    expect(sin.goodsShipment.placeOfUnloading.location).toBe('Puerto de Algeciras');
    expect(sin.goodsShipment.transportDocument).toEqual(VISTA.goodsShipment.transportDocument);
    expect(sin.goodsItems[0].supportingDocuments).toEqual(VISTA.goodsItems[0].supportingDocuments);
  });

  test('en representación indirecta el declarante es la agencia y no hay representante', () => {
    expect(vista.declarationHeader.declarant).toEqual({ name: 'Agencia SL', identificationNumber: 'ESB22477020', representativeStatus: '3' });
    expect(vista.declarationHeader.representative).toBeNull();
  });

  test('en representación directa el declarante es el importador y la agencia va como representante', () => {
    const directa = aplicarCauAVistaPrevia(
      { ...VISTA, declarationHeader: { ...VISTA.declarationHeader, declarant: { ...VISTA.declarationHeader.declarant, representativeStatus: '2' } } },
      { ...CAU, declarante: { id: 'ESB12345674' }, representante: { id: 'ESB22477020', estado: '2' } }
    );

    expect(directa.declarationHeader.declarant).toEqual({ name: 'Importadora SL', identificationNumber: 'ESB12345674', representativeStatus: '2' });
    expect(directa.declarationHeader.representative).toEqual({ name: 'Agencia SL', identificationNumber: 'ESB22477020' });
  });

  test('la región de destino es el código de provincia que se declara', () => {
    expect(vista.goodsShipment.regionOfDestination).toBe('46');
    expect(vista.goodsShipment.countryOfDestination).toBe('ES');
  });

  test('con pago previo al levante no se declara garantía; con pago aplazado, la del mensaje', () => {
    expect(vista.guarantee).toBeNull();
    expect(vista.dutyTaxFee).toEqual(VISTA.dutyTaxFee);

    const aplazado = aplicarCauAVistaPrevia(VISTA, {
      ...CAU, garantias: [{ tipo: '1', referencias: [{ grn: '26ESAGL2800000054' }] }],
      envio: { ...CAU.envio, partidas: [{ ...CAU.envio.partidas[0], tributos: [{ tipo: 'A00', medioDePago: 'R' }] }] }
    });
    expect(aplazado.guarantee).toEqual({ guaranteeType: '1', grn: '26ESAGL2800000054' });
    expect(aplazado.dutyTaxFee).toMatchObject({ paymentMethod: 'R', totalDuty: 3161.84 });
    expect(aplazado.dutyTaxFee.paymentMethodDescription).toBeUndefined();
  });

  test('el LRN no se muestra hasta presentar: lo asigna LUCI con cada mensaje', () => {
    expect(vista.lrn).toBeNull();
    expect(vista.declarationHeader.lrn).toBeNull();
  });
});

describe('vista previa con una divisa que el BCE no cotiza', () => {
  const enDirhams = {
    ...VISTA,
    goodsShipment: { ...VISTA.goodsShipment, currency: 'MAD', totalInvoicedAmount: 100000, exchangeRate: 10.8 },
    valuation: { invoiceCurrency: 'MAD', invoiceValue: 100000 },
    goodsItems: [{ ...VISTA.goodsItems[0], invoiceValue: 100000 }]
  };
  const cau = {
    ...CAU,
    envio: {
      ...CAU.envio, divisa: 'EUR',
      documentosJustificativos: [{ tipo: '1017', referencia: 'MAD 10.8' }],
      partidas: [{ ...CAU.envio.partidas[0], importeFactura: 9259.26 }]
    }
  };

  test('muestra la factura en euros (el contravalor que se declara) y el 1017', () => {
    const vista = aplicarCauAVistaPrevia(enDirhams, cau);
    expect(vista.goodsShipment).toMatchObject({ currency: 'EUR', totalInvoicedAmount: 9259.26, exchangeRate: null });
    expect(vista.valuation).toMatchObject({ invoiceCurrency: 'EUR', invoiceValue: 9259.26 });
    expect(vista.goodsItems[0].invoiceValue).toBe(9259.26);
    expect(vista.goodsItems[0].supportingDocuments).toContainEqual({ type: '1017', reference: 'MAD 10.8' });
  });

  test('con la misma divisa no toca los importes', () => {
    const vista = aplicarCauAVistaPrevia(VISTA, { ...CAU, envio: { ...CAU.envio, divisa: 'USD' } });
    expect(vista.goodsShipment.currency).toBe('USD');
    expect(vista.goodsItems[0].customsValue).toBe(8901.55);
  });
});
