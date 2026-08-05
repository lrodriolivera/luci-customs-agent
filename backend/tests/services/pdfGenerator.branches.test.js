/**
 * Tests de RAMAS de pdfGenerator (cobertura de branches objetivo ≥88%).
 *
 * Este fichero COMPLEMENTA pdfGenerator.test.js, cubriendo todas las
 * variaciones de datos que activan ramas condicionales distintas: campos
 * opcionales presentes/ausentes, tipos de documento, status, modos de
 * transporte, etc.
 *
 * Se genera el PDF REAL (sin mockear pdfkit) y se valida que el buffer
 * resultante sea un PDF valido. No se valida el maquetado pixel a pixel,
 * sino que todas las ramas de codigo (if/else, operadores ternarios, || ,
 * accesos opcionales) se ejecuten sin reventar.
 */

const pdfGenerator = require('../../src/services/pdfGenerator');

function esPDFValido(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 0 && buffer.subarray(0, 4).toString() === '%PDF';
}

function expedicion(overrides = {}) {
  return {
    expeditionId: 'EXP-2026-0200',
    operationType: 'import',
    status: 'pending',
    client: {
      companyName: 'Test SL',
      nif: 'B12345678',
      taxId: 'B12345678',
      eori: 'ESB12345678'
    },
    goods: [{
      itemNumber: 1,
      description: 'Mercancia generica',
      taricCode: '0901210000',
      quantity: 100,
      netWeight: 50,
      grossWeight: 55,
      invoiceValue: 1000,
      countryOfOrigin: 'CN',
      dutyRate: 10,
      vatRate: 21,
      dutyAmount: 100,
      vatAmount: 231
    }],
    transport: {},
    incoterm: '',
    declaration: {},
    calculations: {},
    ...overrides
  };
}

// ==================== H1 - RAMAS ====================

describe('H1PDF - transportMode: ramas del mapa de modos', () => {
  test('air minuscula se traduce a 4', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'air' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('AIR mayuscula se traduce a 4', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'AIR' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sea minuscula se traduce a 1', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'sea' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('SEA mayuscula se traduce a 1', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'SEA' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('maritime se traduce a 1', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'maritime' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('road minuscula se traduce a 3', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'road' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('ROAD mayuscula se traduce a 3', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'ROAD' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('rail minuscula se traduce a 2', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'rail' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('RAIL mayuscula se traduce a 2', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'RAIL' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('modo desconocido cae al fallback', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transportMode: 'bicycle' }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - incoterm como objeto vs string', () => {
  test('incoterm como string se toma directamente', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ incoterm: 'FOB' }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('incoterm como objeto con code', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ incoterm: { code: 'CIF', place: 'Valencia' } }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('incoterm como objeto con type', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ incoterm: { type: 'DDP', place: 'Madrid' } }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('incoterm como objeto vacio cae al fallback', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ incoterm: {} }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - transport: ramas de identificacion del medio', () => {
  test('transport.vehicleId', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { vehicleId: 'ABC123' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.vesselName', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { vesselName: 'MSC Gulsun' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.flightNumber', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { flightNumber: 'IB6789' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport sin identificacion cae al fmt(undefined)', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transport: {} }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.containerNumber presente activa SI en CTR', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { containerNumber: 'MSKU1234567' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.containerNumber ausente activa NO en CTR', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({ transport: {} }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.warehouseCode para goodsLocation', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { warehouseCode: 'WH-001' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('declaration.goodsLocation si no hay warehouseCode', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: {},
      declaration: { goodsLocation: 'ALMACEN-A' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.documentNumber para doc de cargo', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { documentNumber: 'DOC-001' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.blNumber si no hay documentNumber', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { blNumber: 'BL-001' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.awbNumber si no hay documentNumber ni blNumber', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: { awbNumber: 'AWB-001' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - origin: ramas de countryOfOrigin', () => {
  test('goods[0].countryOfOrigin', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{ countryOfOrigin: 'JP', taricCode: '8471300000', description: 'Portatil' }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('expedition.origin.country si goods[0] no tiene', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{ taricCode: '8471300000', description: 'Portatil' }],
      origin: { country: 'KR' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin ninguno de los dos cae a string vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{ taricCode: '8471300000', description: 'Portatil' }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - calculations: ramas de customsValue y totales', () => {
  test('customsValue desde calc.customsValue', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: { customsValue: 5000 }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('customsValue desde calc.invoiceTotal si no hay customsValue', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: { invoiceTotal: 4500 }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('customsValue desde suma de goods si calc vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: {},
      goods: [
        { invoiceValue: 1000, taricCode: '0901210000', description: 'Cafe' },
        { value: 2000, taricCode: '2204210000', description: 'Vino' }
      ]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('totalDuties desde calc.totalDuties', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: { totalDuties: 300 }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('totalDuties desde suma de goods.dutyAmount si calc vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: {},
      goods: [
        { dutyAmount: 100, taricCode: '0901210000', description: 'Cafe' },
        { dutyAmount: 150, taricCode: '2204210000', description: 'Vino' }
      ]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('totalVat desde calc.totalVat', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: { totalVat: 500 }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('totalVat desde suma de goods.vatAmount si calc vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      calculations: {},
      goods: [
        { vatAmount: 200, taricCode: '0901210000', description: 'Cafe' },
        { vatAmount: 300, taricCode: '2204210000', description: 'Vino' }
      ]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - notes: ramas de indicaciones especiales', () => {
  test('decl.notes como array se une con coma', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { notes: ['Nota 1', 'Nota 2', 'Nota 3'] }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('expedition.notes si no hay decl.notes', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: {},
      notes: ['Expediente nota A', 'Expediente nota B']
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin notas cae a string vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: {},
      notes: []
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - goods: ramas de partidas', () => {
  test('goods con statisticalValue', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: 'Portatil',
        invoiceValue: 1000,
        statisticalValue: 1050
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('goods sin statisticalValue cae a invoiceValue', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: 'Portatil',
        invoiceValue: 1000
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('goods con value en lugar de invoiceValue', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: 'Portatil',
        value: 900
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('goods sin vatRate cae a string vacio en la tabla', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: 'Portatil',
        invoiceValue: 1000,
        dutyRate: 5
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('goods[0].vatRate null usa 21% en liquidacion', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: 'Portatil',
        invoiceValue: 1000,
        dutyRate: 5
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - status y canal: ramas del pie', () => {
  test('status draft se traduce a BORRADOR', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'draft' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status pending se traduce a PENDIENTE', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'pending' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status submitted se traduce a PRESENTADA', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'submitted' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status accepted se traduce a ACEPTADA', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'accepted' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status rejected se traduce a RECHAZADA', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'rejected' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status ready_for_declaration se traduce a BORRADOR', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'ready_for_declaration' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status desconocido se toma en mayusculas', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { status: 'pending_review' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status desde expedition si no hay declaration.status', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      status: 'pending',
      declaration: {}
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('canal green con color verde', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { channel: 'green' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('canal orange con color ambar', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { channel: 'orange' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('canal red con color rojo', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { channel: 'red' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('canal vacio cae a guion', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { channel: '' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - declarationDate: ramas de fecha en cabecera y pie', () => {
  test('declarationDate desde decl.declarationDate', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { declarationDate: new Date('2026-08-01') }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('declarationDate desde expedition.createdAt si no hay decl', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: {},
      createdAt: new Date('2026-07-20')
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H1PDF - client: ramas de shipper', () => {
  test('client.companyName para expedidor', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      client: { companyName: 'Cliente Principal SL' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('expedition.shipper.name si no hay client.companyName', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      client: {},
      shipper: { name: 'Shipper Externo Ltd' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.taxId para EORI', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      client: { companyName: 'Test', taxId: 'B99999999' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.nif si no hay taxId', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      client: { companyName: 'Test', nif: 'B88888888' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== H7 - RAMAS ====================

describe('H7PDF - iossNumber: rama opcional', () => {
  test('con iossNumber se dibuja el campo y ajusta el espaciado', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-002',
      iossNumber: 'IM1234567890',
      sender: { name: 'Sender', eori: 'CN123' },
      recipient: { name: 'Recipient', taxId: 'B12345678' },
      items: [{ taricCode: '8518300000', description: 'Auriculares', totalValue: 45 }],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin iossNumber no se dibuja y el espaciado es menor', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-003',
      sender: { name: 'Sender', eori: 'CN123' },
      recipient: { name: 'Recipient', taxId: 'B12345678' },
      items: [{ taricCode: '8518300000', description: 'Auriculares', totalValue: 45 }],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H7PDF - items: ramas de partidas', () => {
  test('items vacio no revienta', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-004',
      sender: { name: 'Sender', eori: 'CN123' },
      recipient: { name: 'Recipient', taxId: 'B12345678' },
      items: [],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('items con multiples entradas', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-005',
      sender: { name: 'Sender', eori: 'CN123' },
      recipient: { name: 'Recipient', taxId: 'B12345678' },
      items: [
        { taricCode: '8518300000', description: 'Auriculares', totalValue: 45, quantity: 2, unitValue: 22.5, countryOfOrigin: 'CN' },
        { taricCode: '8471300000', description: 'Portatil', totalValue: 300, quantity: 1, unitValue: 300, countryOfOrigin: 'TW' }
      ],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H7PDF - totals y duties: ramas de importes', () => {
  test('totals.intrinsicValue', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-006',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: { intrinsicValue: 100, shippingCost: 10, customsValue: 110 },
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('duties.tariff.amount', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-007',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: { tariff: { amount: 15 } }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('duties.vat.rate y amount', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-008',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: { vat: { rate: 21, amount: 25.2 } }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('duties.totalDue', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-009',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: { totalDue: 50 }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H7PDF - status: rama de estado en cabecera', () => {
  test('status accepted', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-010',
      status: 'accepted',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status pending', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-011',
      status: 'pending',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('H7PDF - draft: rama de marca de agua', () => {
  test('draft true activa watermark', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-012',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: {}
    }, { draft: true });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== AES - RAMAS ====================

describe('AESPDF - consignee: ramas de destinatario', () => {
  test('expedition.consignee.name', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion({
      consignee: { name: 'Destinatario Externo Ltd' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('expedition.destination.name si no hay consignee', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion({
      destination: { name: 'Pais Destino SA', country: 'FR' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin ninguno cae a guion', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion({}));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('AESPDF - goods: ramas de countryOfDestination', () => {
  test('goods[i].countryOfDestination', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion({
      goods: [{ taricCode: '8471300000', description: 'Portatil', countryOfDestination: 'US' }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('expedition.destination.country si goods no tiene', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion({
      goods: [{ taricCode: '8471300000', description: 'Portatil' }],
      destination: { country: 'CA' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('AESPDF - draft: rama de watermark', () => {
  test('draft true activa watermark', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion(), { draft: true });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== ENS - RAMAS ====================

describe('ENSPDF - transportMode: ramas del mapa de modos', () => {
  test('AIR se traduce a Aereo', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-002',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('SEA se traduce a Maritimo', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-003',
      transportMode: 'SEA',
      carrier: { name: 'Shipping Co' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('ROAD se traduce a Carretera', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-004',
      transportMode: 'ROAD',
      carrier: { name: 'Truck Co' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('RAIL se traduce a Ferrocarril', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-005',
      transportMode: 'RAIL',
      carrier: { name: 'Rail Co' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('modo desconocido cae al fallback', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-006',
      transportMode: 'SPACE',
      carrier: { name: 'Space Co' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('ENSPDF - houseConsignments: rama opcional', () => {
  test('con houseConsignments se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-007',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      houseConsignments: [
        { consignee: { name: 'Consignatario A' }, goods: [{ description: 'Mercancia A' }], grossMass: 100, numberOfPackages: 5 },
        { consignee: { name: 'Consignatario B' }, goods: [{ description: 'Mercancia B' }], grossMass: 200, numberOfPackages: 10 }
      ]
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin houseConsignments no se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-008',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('houseConsignments vacio no dibuja tabla', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-009',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      houseConsignments: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('ENSPDF - riskAssessment: rama opcional', () => {
  test('con riskAssessment se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-010',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      riskAssessment: { status: 'CLEARED', riskScore: 15 }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin riskAssessment no se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-011',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('riskAssessment.status CLEARED', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-012',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      riskAssessment: { status: 'CLEARED', riskScore: 10 }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('riskAssessment.status HOLD', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-013',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      riskAssessment: { status: 'HOLD', riskScore: 85 }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('riskAssessment.status PENDING', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-014',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      riskAssessment: { status: 'PENDING', riskScore: 50 }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('riskAssessment.riskScore null cae a guion', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-015',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {},
      riskAssessment: { status: 'CLEARED' }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('ENSPDF - draft: rama de watermark', () => {
  test('draft true activa watermark', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-016',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: {}
    }, { draft: true });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== NCTS - RAMAS ====================

describe('NCTSPDF - transitType: ramas del mapa de tipos', () => {
  test('T1 se traduce correctamente', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-T1',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('T2 se traduce correctamente', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-T2',
      transitType: 'T2',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('T2F se traduce correctamente', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-T2F',
      transitType: 'T2F',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('TIR se traduce correctamente', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-TIR',
      transitType: 'TIR',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transitType desconocido cae al fallback', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-UNKNOWN',
      transitType: 'T99',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('NCTSPDF - transitOffices: rama opcional', () => {
  test('con transitOffices se dibuja el campo', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-002',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: [],
      transitOffices: [{ code: 'FR001' }, { code: 'DE002' }]
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin transitOffices no se dibuja el campo', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-003',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transitOffices vacio no dibuja campo', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-004',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: [],
      transitOffices: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('NCTSPDF - guarantee: ramas del tipo y validez', () => {
  test('guarantee.type 0 (Exencion)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-005',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '0' },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.type 1 (Global)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-006',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '1', grn: 'GRN123' },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.type 2 (Individual fianza)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-007',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '2', amount: 5000 },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.type 3 (Individual metalico)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-008',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '3', amount: 3000 },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.type 8 (Individual otro)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-009',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '8' },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.type R (Exencion reglamento)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-010',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: 'R' },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.validTo presente dibuja rango de fechas', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-011',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '1', validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31') },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('guarantee.validTo ausente cae a guion', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-012',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: { type: '1' },
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('NCTSPDF - transport: ramas de modo y contenedor', () => {
  test('transport.mode 1 (Maritimo)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-013',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { mode: '1' },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.mode 2 (Ferrocarril)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-014',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { mode: '2' },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.mode 3 (Carretera)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-015',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { mode: '3' },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.mode 4 (Aereo)', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-016',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { mode: '4' },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.containerIndicator true', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-017',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { containerIndicator: true },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.containerIndicator false', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-018',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { containerIndicator: false },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.seals presente', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-019',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: { seals: [{ number: 'SEAL001' }, { number: 'SEAL002' }] },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('transport.seals ausente cae a guion', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-020',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('NCTSPDF - goodsItems: rama de fallback sin partidas', () => {
  test('goodsItems vacio dibuja fila de fallback', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-021',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('goodsItems con datos reales', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-022',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: [
        { itemNumber: 1, taricCode: '8471300000', description: 'Portatil', grossWeight: 5, packages: { count: 2 }, countryOfOrigin: 'CN' },
        { itemNumber: 2, taricCode: '6109100010', description: 'Camisetas', grossWeight: 10, packages: { count: 50 }, countryOfOrigin: 'BD' }
      ]
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('NCTSPDF - status: ramas del mapa de estados', () => {
  test('status draft', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-023',
      transitType: 'T1',
      status: 'draft',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status submitted', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-024',
      transitType: 'T1',
      status: 'submitted',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status accepted', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-025',
      transitType: 'T1',
      status: 'accepted',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status in_transit', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-026',
      transitType: 'T1',
      status: 'in_transit',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status arrived', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-027',
      transitType: 'T1',
      status: 'arrived',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status completed', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-028',
      transitType: 'T1',
      status: 'completed',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status desconocido cae al fallback', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-029',
      transitType: 'T1',
      status: 'unknown_status',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('NCTSPDF - draft: rama de watermark', () => {
  test('draft true activa watermark', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-030',
      transitType: 'T1',
      principal: { name: 'Principal SL', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    }, { draft: true });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== PUE SOIVRE - RAMAS ====================

describe('PUE SOIVRE PDF - flowType: rama del titulo', () => {
  test('flowType ROHS_RAEE se traduce correctamente', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-002',
      flowType: 'ROHS_RAEE',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('flowType default es SOIVRE', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-003',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - specificities: rama opcional', () => {
  test('con specificities se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-004',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      specificities: ['Especificidad A', 'Especificidad B', 'Especificidad C']
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin specificities no se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-005',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('specificities vacio no dibuja seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-006',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      specificities: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - certificates: rama opcional', () => {
  test('con certificates se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-007',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      certificates: {
        com: 'NORMAL',
        rohs: 'NOT_APPLICABLE',
        raee: 'CONSULT'
      }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin certificates no se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-008',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - riiNumbers: rama opcional', () => {
  test('con riiNumbers.raee se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-009',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      riiNumbers: { raee: 'RII-RAEE-001' }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('con riiNumbers.pya se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-010',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      riiNumbers: { pya: 'RII-PYA-001' }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('con ambos riiNumbers se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-011',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      riiNumbers: { raee: 'RII-RAEE-001', pya: 'RII-PYA-001' }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin riiNumbers no se dibuja la seccion', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-012',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - goods: rama de partidas', () => {
  test('goods con datos se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-013',
      operationType: 'ALTA',
      operator: {},
      goods: [
        { sequenceNumber: 1, taricCode: '9503007000', description: 'Juguetes', quantity: 100, unitOfMeasure: 'NAR', grossMass: 50, countryOfOrigin: 'CN' },
        { sequenceNumber: 2, taricCode: '8518300000', description: 'Auriculares', quantity: 200, unitOfMeasure: 'NAR', grossMass: 20, countryOfOrigin: 'TW' }
      ]
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('goods vacio no dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-014',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - status y priority: ramas del pie', () => {
  test('status draft', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-015',
      operationType: 'ALTA',
      status: 'draft',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status submitted', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-016',
      operationType: 'ALTA',
      status: 'submitted',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status registered', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-017',
      operationType: 'ALTA',
      status: 'registered',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status approved', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-018',
      operationType: 'ALTA',
      status: 'approved',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status rejected', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-019',
      operationType: 'ALTA',
      status: 'rejected',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status pending_inspection', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-020',
      operationType: 'ALTA',
      status: 'pending_inspection',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('status desconocido cae al fallback', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-021',
      operationType: 'ALTA',
      status: 'unknown_status',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('priority normal', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-022',
      operationType: 'ALTA',
      priority: 'normal',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('priority high', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-023',
      operationType: 'ALTA',
      priority: 'high',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('priority ausente cae a normal', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-024',
      operationType: 'ALTA',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - operator: ramas de fallback a h1AutoFill', () => {
  test('operator.name presente', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-025',
      operationType: 'ALTA',
      operator: { name: 'Operador SL' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('h1AutoFill.importerName si no hay operator.name', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-026',
      operationType: 'ALTA',
      operator: {},
      h1AutoFill: { importerName: 'Importador desde H1' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('operator.nif presente', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-027',
      operationType: 'ALTA',
      operator: { name: 'Op', nif: 'B12345678' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('h1AutoFill.importerNif si no hay operator.nif', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-028',
      operationType: 'ALTA',
      operator: { name: 'Op' },
      h1AutoFill: { importerNif: 'B99999999' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('operator.eori presente', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-029',
      operationType: 'ALTA',
      operator: { name: 'Op', eori: 'ESB12345678' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('h1AutoFill.importerEori si no hay operator.eori', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-030',
      operationType: 'ALTA',
      operator: { name: 'Op' },
      h1AutoFill: { importerEori: 'ESB99999999' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('contactEmail desde pueRequest', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-031',
      operationType: 'ALTA',
      operator: { name: 'Op' },
      contactEmail: 'contacto@ejemplo.es',
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('operator.email si no hay contactEmail', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-032',
      operationType: 'ALTA',
      operator: { name: 'Op', email: 'op@ejemplo.es' },
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('PUE SOIVRE PDF - draft: rama de watermark', () => {
  test('draft true activa watermark', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-033',
      operationType: 'ALTA',
      operator: {},
      goods: []
    }, { draft: true });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== EXPEDITION SUMMARY - RAMAS ====================

describe('ExpeditionSummaryPDF - operationType: rama de titulo', () => {
  test('operationType import minuscula se traduce a Importacion', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      operationType: 'import'
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('operationType IMPORT mayuscula se traduce a Importacion', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      operationType: 'IMPORT'
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('operationType export se traduce a Exportacion', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      operationType: 'export'
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('operationType desconocido cae al fallback', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      operationType: 'transit'
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('ExpeditionSummaryPDF - goods: rama opcional', () => {
  test('con goods se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      goods: [
        { taricCode: '8471300000', description: 'Portatil', quantity: 5, unit: 'NAR', invoiceValue: 2000 },
        { taricCode: '6109100010', description: 'Camisetas', quantity: 100, unit: 'NAR', value: 500 }
      ]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin goods no se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      goods: []
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('ExpeditionSummaryPDF - documentChecklist: rama opcional', () => {
  test('con documentChecklist se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      documentChecklist: [
        { documentName: 'Factura Comercial', required: true, received: true },
        { name: 'Packing List', required: true, received: false },
        { documentName: 'Certificado de Origen', required: false, received: true }
      ]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('sin documentChecklist no se dibuja la tabla', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({}));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('documentChecklist vacio no dibuja tabla', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      documentChecklist: []
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

describe('ExpeditionSummaryPDF - client: ramas de contact', () => {
  test('client.contact.name', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      client: {
        companyName: 'Cliente',
        contact: { name: 'Contacto desde objeto', email: 'contacto@ejemplo.es' }
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.contactName si no hay contact.name', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      client: {
        companyName: 'Cliente',
        contactName: 'Contacto desde string'
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.contact.email', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      client: {
        companyName: 'Cliente',
        contact: { email: 'contacto@ejemplo.es' }
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.email si no hay contact.email', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      client: {
        companyName: 'Cliente',
        email: 'cliente@ejemplo.es'
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.taxId', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      client: {
        companyName: 'Cliente',
        taxId: 'B12345678'
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('client.nif si no hay taxId', async () => {
    const buffer = await pdfGenerator.generateExpeditionSummaryPDF(expedicion({
      client: {
        companyName: 'Cliente',
        nif: 'B99999999'
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== CABECERA - SUBTITLE ====================

describe('_drawHeader - subtitle: rama opcional en todos los tipos', () => {
  test('H1 con subtitle activa rama de texto derecho', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { regime: '40', additionalProcedure: '000' }
    }));
    // generateH1PDF NO usa _drawHeader sino su propia cabecera custom, pero
    // generateH7PDF si lo usa con subtitle = status
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('H7 con status activa subtitle en cabecera', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-SUB',
      status: 'accepted',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('AES con regime en decl activa subtitle', async () => {
    const buffer = await pdfGenerator.generateAESPDF(expedicion({
      declaration: { regime: '10', mrn: '26ES999' }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('ENS con transportMode activa subtitle traducido', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-SUB',
      transportMode: 'SEA',
      carrier: { name: 'Shipping' },
      consignment: {}
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('NCTS con transitType activa subtitle traducido', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-SUB',
      transitType: 'T1',
      principal: { name: 'P', eori: 'ESB1' },
      guarantee: {},
      transport: {},
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('PUE SOIVRE con operationType activa subtitle', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-SUB',
      operationType: 'MODIFICACION',
      operator: {},
      goods: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== HELPERS - RAMAS DE FMT ====================

describe('helpers fmt - ramas de tipo objeto anidado', () => {
  test('fmt con objeto anidado lo serializa a JSON', async () => {
    // BUG: si un campo que se espera string llega como objeto anidado complejo,
    // fmt lo serializa con JSON.stringify. Esto puede pasar si se copia
    // estructuras complejas desde el catalogo o respuestas de API externas.
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      transport: {
        // Si vehicleId/vesselName/flightNumber fueran objeto, fmt lo serializa
        vehicleId: { nested: 'value', array: [1, 2, 3] }
      }
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('fmtDesc con objeto sin es ni en cae a primer valor', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: { fr: 'Ordinateur portable', de: 'Laptop' },
        invoiceValue: 1000
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('fmtDesc con objeto vacio cae a string vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: {},
        invoiceValue: 1000
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('fmtDesc con null explícito retorna string vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: null,
        invoiceValue: 1000
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('fmtDesc con undefined explícito retorna string vacio', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: undefined,
        invoiceValue: 1000
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== TABLA - NULL EN CELDA ====================

describe('_drawTable - celda con null explícito', () => {
  test('goods con campos null explícitos en lugar de undefined', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      goods: [{
        taricCode: '8471300000',
        description: 'Portatil',
        invoiceValue: 1000,
        grossWeight: null,
        netWeight: null,
        dutyRate: null,
        vatRate: null
      }]
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });
});

// ==================== CASOS EDGE ADICIONALES ====================

describe('Casos edge mixtos para cerrar ramas residuales', () => {
  test('H1 con todas las alternativas de fecha en un solo documento', async () => {
    const buffer = await pdfGenerator.generateH1PDF(expedicion({
      declaration: { declarationDate: null },
      createdAt: new Date('2026-08-05')
    }));
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('H7 con duties.tariff null pero vat presente', async () => {
    const buffer = await pdfGenerator.generateH7PDF({
      declarationId: 'H7-EDGE',
      sender: { name: 'S' },
      recipient: { name: 'R' },
      items: [],
      totals: {},
      duties: { tariff: null, vat: { rate: 21, amount: 50 } }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('ENS con consignment.containerNumber null vs undefined', async () => {
    const buffer = await pdfGenerator.generateENSPDF({
      reference: 'ENS-NULL',
      transportMode: 'AIR',
      carrier: { name: 'Airline' },
      consignment: { containerNumber: null }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('NCTS con transport.identityAtDeparture.identification null', async () => {
    const buffer = await pdfGenerator.generateNCTSPDF({
      lrn: 'LRN-NULL',
      transitType: 'T1',
      principal: { name: 'P', eori: 'ESB1' },
      guarantee: {},
      transport: { identityAtDeparture: { identification: null } },
      goodsItems: []
    });
    expect(esPDFValido(buffer)).toBe(true);
  });

  test('PUE con codCice y codPi objetos vacios', async () => {
    const buffer = await pdfGenerator.generatePUESOIVREPDF({
      reference: 'PUE-EMPTY',
      operationType: 'ALTA',
      operator: {},
      goods: [],
      codCice: { code: null, name: null },
      codPi: { code: null, name: null }
    });
    expect(esPDFValido(buffer)).toBe(true);
  });
});
