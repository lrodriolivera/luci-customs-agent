/**
 * Tests para pdfGenerator (estaba al 1,7%).
 *
 * Genera los PDF de las declaraciones que el cliente descarga y que acaban
 * presentandose o archivandose: H1, H7, AES, ENS, NCTS y PUE/SOIVRE. Un fallo
 * aqui produce un documento aduanero mal formado o directamente un 500 al
 * descargarlo.
 *
 * Los PDF se generan de verdad (pdfkit no se mockea) y se comprueba que salen
 * buffers validos. No se valida el maquetado —eso es revision visual—, sino
 * que el generador no reviente con los datos incompletos que llegan en la
 * practica: expedientes sin mercancias, sin declaracion, con importes a cero.
 */

const pdfGenerator = require('../../src/services/pdfGenerator');

/** Cabecera de un PDF valido. */
function esPDFValido(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 0 && buffer.subarray(0, 4).toString() === '%PDF';
}

/** Expediente completo, como el que llega tras clasificar y calcular. */
function expedicion(overrides = {}) {
  return {
    expeditionId: 'EXP-2026-0100',
    operationType: 'import',
    status: 'declaration_submitted',
    client: {
      companyName: 'Electronica Iberica S.L.',
      nif: 'B12345678',
      eori: 'ESB12345678',
      address: { street: 'Calle Principal 1', city: 'Madrid', postalCode: '28001', country: 'ES' },
      contact: { name: 'Contacto', email: 'c@ejemplo.es', phone: '+34600000000' }
    },
    goods: [{
      itemNumber: 1,
      description: 'Camisetas de algodon',
      taricCode: '6109100010',
      quantity: 500,
      netWeight: 150,
      grossWeight: 165,
      invoiceValue: 4000,
      originCountry: 'CN',
      dutyRate: 12,
      vatRate: 21,
      dutyAmount: 480,
      vatAmount: 940.8
    }],
    transport: { carrier: 'Maersk', containerNumber: 'MSKU1234567', blNumber: 'BL-001' },
    incoterm: { code: 'CIF', place: 'Valencia' },
    declaration: {
      type: 'H1',
      mrn: '26ES00280112345678',
      lrn: 'LRN123',
      channel: 'green',
      submittedAt: new Date('2026-07-15'),
      customsOffice: 'ES002801'
    },
    calculations: { totalDuties: 480, totalVat: 940.8, totalToPay: 1420.8 },
    ...overrides
  };
}

describe('pdfGenerator: generacion de declaraciones', () => {
  test('H1 produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion());

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('AES (exportacion) produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generateAESPDF(
      expedicion({ operationType: 'export', declaration: { type: 'AES', mrn: '26ES999' } })
    );

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('el resumen de expediente produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion());

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('H7 produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-001',
      mrn: '26ES00280100000001',
      sender: { name: 'Shenzhen Co', eori: 'CN123' },
      recipient: { name: 'Importador SL', taxId: 'B99999999', email: 'i@ejemplo.es' },
      items: [{ description: 'Auriculares', taricCode: '8518300000', totalValue: 45 }],
      totalValue: 45
    });

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('ENS produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-001',
      mrn: '26ES111',
      carrier: { name: 'Maersk', eori: 'DK123' },
      consignment: { containerNumber: 'MSKU1', referenceNumber: 'REF1' },
      houseConsignments: []
    });

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('NCTS produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-NCTS-1',
      mrn: '26ES222',
      transitType: 'T1',
      holder: { name: 'Transitario SL', eori: 'ESB1' },
      goods: [{ description: 'Maquinaria', taricCode: '8479899700', grossMass: 500 }]
    });

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('PUE/SOIVRE produce un PDF valido', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      requestNumber: 'PUE-001',
      type: 'SOIVRE',
      status: 'draft',
      expedition: { expeditionId: 'EXP-2026-0100' },
      goods: [{ description: 'Juguetes', taricCode: '9503007000' }]
    });

    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('pdfGenerator: datos incompletos', () => {
  // El generador recibe lo que haya en el expediente, que en la practica llega
  // a medias: sin clasificar, sin calcular o sin declaracion presentada.

  test('un expediente sin mercancias no revienta', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ goods: [] }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('un expediente sin declaracion presentada no revienta', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ declaration: undefined }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('un expediente sin calculos no revienta', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ calculations: undefined }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('mercancias sin importes ni codigo TARIC no revientan', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{ itemNumber: 1, description: 'Sin clasificar' }]
    }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('una descripcion en forma de objeto {es,en} no revienta', async () => {
    // Es como la guarda el catalogo TARIC. Si esa forma se copia al expediente
    // —al aplicar una clasificacion, por ejemplo— el PDF lanzaba
    // "(...).substring is not a function" y la descarga daba 500.
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        itemNumber: 1,
        description: { es: 'Camisetas de algodon', en: 'Cotton t-shirts' },
        taricCode: '6109100010',
        invoiceValue: 4000
      }]
    }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('un importe que llega como texto no revienta', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{ itemNumber: 1, description: 'x', invoiceValue: '1.234,56' }]
    }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('una fecha invalida no revienta', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { type: 'H1', submittedAt: 'no-es-una-fecha' }
    }));

    expect(esPDFValido(buffer)).toBe(true);
  });

  test('un cliente sin direccion ni contacto no revienta', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      client: { companyName: 'Minimo SL' }
    }));

    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('pdfGenerator: marca de borrador', () => {
  test('la opcion draft genera un PDF distinto al definitivo', async () => {
    // El borrador lleva marca de agua: si saliera identico, el cliente podria
    // confundir una previsualizacion con el documento presentado.
    const definitivo = await pdfGenerator.generateH1PDF(expedicion());
    const borrador = await pdfGenerator.generateH1PDF(expedicion(), { draft: true });

    expect(esPDFValido(borrador)).toBe(true);
    expect(borrador.length).not.toBe(definitivo.length);
  });
});
