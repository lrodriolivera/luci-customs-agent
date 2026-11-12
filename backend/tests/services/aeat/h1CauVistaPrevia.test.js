const { aplicarCauAVistaPrevia } = require('../../../src/services/aeat/h1CauVistaPrevia');

const VISTA = {
  lrn: 'L1',
  declarationHeader: { customsOfficeLodgement: 'ES003001', customsOfficePresentation: 'ES003001', customsOfficeEntry: 'ES003001', declarant: { name: 'Agencia SL' } },
  goodsShipment: {
    currency: 'USD', goodsLocation: { typeOfLocation: 'B', qualifierOfIdentification: 'T' }, placeOfUnloading: { location: 'Puerto de Algeciras', code: 'ESALG' },
    transportDocument: { type: 'N705', reference: 'MSCU20268198800' }
  },
  goodsItems: [{ itemNumber: 1, customsValue: 8901.55, supportingDocuments: [{ type: 'N380', reference: 'QA-escaneado-factura.pdf' }] }]
};
const CAU = {
  aduanaImportacion: 'ES002801', aduanaPresentacion: 'ES002801',
  envio: {
    documentosJustificativos: [{ tipo: '1005', referencia: 'OSRE' }],
    expedicion: { ubicacion: { tipo: 'B', calificador: 'Y', autorizacion: 'ES002801AAAAAA' }, documentosTransporte: [{ tipo: 'N705', referencia: 'MSCU20268198800' }] },
    partidas: [{ documentosPrevios: [{ tipo: 'N337', referencia: '26ES00280180000014' }], documentosJustificativos: [{ tipo: 'N380', referencia: 'FAC-2026-118' }] }]
  }
};

describe('vista previa del H1 por el servicio CAU', () => {
  const vista = aplicarCauAVistaPrevia(VISTA, CAU);

  test('muestra las aduanas que se envían, no las deducidas del puerto', () => {
    expect(vista.declarationHeader).toMatchObject({ customsOfficeLodgement: 'ES002801', customsOfficePresentation: 'ES002801', declarant: { name: 'Agencia SL' } });
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
});
