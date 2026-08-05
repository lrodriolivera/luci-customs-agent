/**
 * publicApiController — API REST pública para integraciones ERP de clientes
 * (Fase 6.7), montada en /api/v1 tras apiKeyAuth. El middleware fija
 * req.organizationId desde la ClientApiKey; ESE valor es el identificador de la
 * organización y debe acotar TODAS las consultas. Aislamiento entre
 * organizaciones = lógica de negocio crítica (dos ERPs de clientes distintos no
 * pueden verse los expedientes).
 *
 * SIN mocks: no hay dependencias externas (ni IA ni red). Expedition y Payment
 * reales en Mongo en memoria, de modo que los filtros de aislamiento, los
 * aggregate de stats, toClientSummary() y el guardado se ejecutan de verdad.
 * El propio publicApiController NO se mockea.
 *
 * jest.config tiene resetMocks:true (irrelevante aquí, no hay jest.fn de fábrica).
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const publicApiController = require('../../src/controllers/publicApiController');
const { Expedition, Payment } = require('../../src/models');

usarBaseDeDatosEnMemoria();

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}
// req.organizationId lo pone apiKeyAuth; apiKey.keyPrefix se usa en el timeline.
function mockReq({ organizationId, params = {}, body = {}, query = {} } = {}) {
  return {
    organizationId: organizationId ? String(organizationId) : undefined,
    apiKey: { keyPrefix: 'pk_test' },
    params, body, query
  };
}

let ORG_A;
let ORG_B;

beforeEach(() => {
  ORG_A = new mongoose.Types.ObjectId();
  ORG_B = new mongoose.Types.ObjectId();
});

// Expedition real acotada por tenantId (el campo de aislamiento real del schema).
async function sembrarExp(tenantId, over = {}) {
  return Expedition.create({
    tenantId,
    expeditionId: over.expeditionId || `IMP-${Date.now()}-${Math.round(performance.now())}`,
    operationType: 'import',
    transportMode: 'maritime',
    status: 'draft',
    client: { companyName: 'Cliente SL', nif: 'B12345678', eori: 'ESB12345678' },
    createdBy: new mongoose.Types.ObjectId(),
    ...over
  });
}
async function sembrarPago(organizationId, over = {}) {
  return Payment.create({
    organizationId,
    paymentId: over.paymentId || `PAY-${Date.now()}-${Math.round(performance.now())}`,
    subtotal: 100, totalAmount: 121, status: 'completed', paidAt: new Date(),
    items: [{ description: 'Arancel', type: 'duty', amount: 100 }],
    ...over
  });
}

describe('listExpeditions', () => {
  test('lista SOLO los expedientes de la propia organización (aislamiento)', async () => {
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-1' });
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-2' });
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1' });

    const res = mockRes();
    await publicApiController.listExpeditions(mockReq({ organizationId: ORG_A }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.expeditions).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
    const ids = res.body.data.expeditions.map(e => e.expeditionId).sort();
    expect(ids).toEqual(['IMP-A-1', 'IMP-A-2']);
  });

  test('filtra por status', async () => {
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-1', status: 'draft' });
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-2', status: 'documents_received' });

    const res = mockRes();
    await publicApiController.listExpeditions(mockReq({ organizationId: ORG_A, query: { status: 'draft' } }), res);
    expect(res.body.data.expeditions).toHaveLength(1);
    expect(res.body.data.expeditions[0].expeditionId).toBe('IMP-A-1');
  });
});

describe('getExpedition', () => {
  test('404 si el expediente es de otra organización', async () => {
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1' });
    const res = mockRes();
    await publicApiController.getExpedition(mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-B-1' } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('devuelve el detalle con NIF/EORI del cliente y totales de cálculo', async () => {
    await sembrarExp(ORG_A, {
      expeditionId: 'IMP-A-1',
      goods: [{ itemNumber: 1, description: 'Zapatos', taricCode: '6403990000', quantity: 10, invoiceValue: 500 }],
      calculations: { invoiceTotalEur: 500, totalDuties: 40, totalVat: 113.4, totalToPay: 153.4, paid: false }
    });
    const res = mockRes();
    await publicApiController.getExpedition(mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.client.companyName).toBe('Cliente SL');
    // El schema usa client.nif / client.eori, no taxId/eoriNumber.
    expect(res.body.data.client.taxId).toBe('B12345678');
    expect(res.body.data.client.eoriNumber).toBe('ESB12345678');
    expect(res.body.data.goods).toHaveLength(1);
    // El schema usa calculations.totalDuties / totalVat.
    expect(res.body.data.calculations.dutyTotal).toBe(40);
    expect(res.body.data.calculations.vatTotal).toBe(113.4);
    expect(res.body.data.calculations.totalToPay).toBe(153.4);
  });
});

describe('createExpedition', () => {
  test('400 si operationType no es válido', async () => {
    const res = mockRes();
    await publicApiController.createExpedition(
      mockReq({ organizationId: ORG_A, body: { operationType: 'foo', client: { companyName: 'X' } } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 si falta client.companyName', async () => {
    const res = mockRes();
    await publicApiController.createExpedition(
      mockReq({ organizationId: ORG_A, body: { operationType: 'import', client: {} } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('crea el expediente acotado a la organización, con NIF y token de portal', async () => {
    const res = mockRes();
    await publicApiController.createExpedition(mockReq({
      organizationId: ORG_A,
      body: {
        operationType: 'import',
        client: { companyName: 'Nueva SL', taxId: 'B99999999', eoriNumber: 'ESB99999999' },
        goods: [{ description: 'Café', quantity: 5, invoiceValue: 200 }]
      }
    }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.portalToken).toBeTruthy();
    // Debe quedar persistido y acotado al tenant de la organización, con NIF real.
    const guardado = await Expedition.findOne({ expeditionId: res.body.data.expeditionId });
    expect(guardado).not.toBeNull();
    expect(String(guardado.tenantId)).toBe(String(ORG_A));
    expect(guardado.client.nif).toBe('B99999999');
    expect(guardado.client.eori).toBe('ESB99999999');
    expect(guardado.goods).toHaveLength(1);
  });
});

describe('updateExpedition', () => {
  test('404 cross-organización', async () => {
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1' });
    const res = mockRes();
    await publicApiController.updateExpedition(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-B-1' }, body: { incoterm: 'FOB' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('400 si el expediente no está en draft', async () => {
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-1', status: 'documents_received' });
    const res = mockRes();
    await publicApiController.updateExpedition(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' }, body: { incoterm: 'FOB' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS');
  });

  test('actualiza campos permitidos de un draft propio', async () => {
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-1', status: 'draft' });
    const res = mockRes();
    await publicApiController.updateExpedition(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' }, body: { incoterm: 'FOB', clientNotes: 'urgente' } }), res);

    expect(res.body.success).toBe(true);
    const guardado = await Expedition.findOne({ expeditionId: 'IMP-A-1' });
    expect(guardado.incoterm.code).toBe('FOB');
    expect(guardado.clientNotes).toBe('urgente');
    expect(guardado.timeline.some(t => t.action === 'updated')).toBe(true);
  });
});

describe('getExpeditionStatus', () => {
  test('404 cross-organización', async () => {
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1' });
    const res = mockRes();
    await publicApiController.getExpeditionStatus(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-B-1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('devuelve status y los últimos eventos del timeline', async () => {
    await sembrarExp(ORG_A, {
      expeditionId: 'IMP-A-1', status: 'documents_received',
      timeline: [{ action: 'created', description: 'creado' }, { action: 'updated', description: 'actualizado' }]
    });
    const res = mockRes();
    await publicApiController.getExpeditionStatus(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('documents_received');
    expect(res.body.data.recentEvents.length).toBeGreaterThanOrEqual(2);
    // Orden inverso: el último evento primero.
    expect(res.body.data.recentEvents[0].action).toBe('updated');
  });
});

describe('listDocuments', () => {
  test('404 cross-organización', async () => {
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1' });
    const res = mockRes();
    await publicApiController.listDocuments(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-B-1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('lista documentos y checklist del expediente propio', async () => {
    await sembrarExp(ORG_A, {
      expeditionId: 'IMP-A-1',
      documents: [{ type: 'commercial_invoice', fileName: 'f.pdf', originalName: 'factura.pdf', status: 'validated' }],
      documentChecklist: [{ documentType: 'commercial_invoice', required: true, received: true, validated: true }]
    });
    const res = mockRes();
    await publicApiController.listDocuments(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' } }), res);

    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0].fileName).toBe('factura.pdf');
    expect(res.body.data.checklist[0].validated).toBe(true);
  });
});

describe('getDeclaration', () => {
  test('404 cross-organización', async () => {
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1', declaration: { mrn: '25ES001', type: 'H1' } });
    const res = mockRes();
    await publicApiController.getDeclaration(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-B-1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('404 NO_DECLARATION si el expediente propio no tiene declaración', async () => {
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-1' });
    const res = mockRes();
    await publicApiController.getDeclaration(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NO_DECLARATION');
  });

  test('devuelve la declaración con MRN, canal y totales', async () => {
    await sembrarExp(ORG_A, {
      expeditionId: 'IMP-A-1',
      declaration: { type: 'H1', mrn: '25ES00281234567890', status: 'accepted', channel: 'green', lrn: 'LRN-1' },
      calculations: { totalDuties: 40, totalVat: 113.4, totalToPay: 153.4, paid: true }
    });
    const res = mockRes();
    await publicApiController.getDeclaration(
      mockReq({ organizationId: ORG_A, params: { expeditionId: 'IMP-A-1' } }), res);

    expect(res.body.data.declaration.mrn).toBe('25ES00281234567890');
    expect(res.body.data.declaration.channel).toBe('green');
    expect(res.body.data.calculations.dutyTotal).toBe(40);
    expect(res.body.data.calculations.vatTotal).toBe(113.4);
    expect(res.body.data.calculations.paid).toBe(true);
  });
});

describe('listPayments / getPayment', () => {
  test('lista SOLO los pagos de la propia organización', async () => {
    await sembrarPago(ORG_A, { paymentId: 'PAY-A-1' });
    await sembrarPago(ORG_B, { paymentId: 'PAY-B-1' });
    const res = mockRes();
    await publicApiController.listPayments(mockReq({ organizationId: ORG_A }), res);

    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0].paymentId).toBe('PAY-A-1');
    expect(res.body.data.pagination.total).toBe(1);
  });

  test('getPayment 404 cross-organización', async () => {
    await sembrarPago(ORG_B, { paymentId: 'PAY-B-1' });
    const res = mockRes();
    await publicApiController.getPayment(
      mockReq({ organizationId: ORG_A, params: { paymentId: 'PAY-B-1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('getPayment devuelve el resumen de cliente del pago propio', async () => {
    await sembrarPago(ORG_A, { paymentId: 'PAY-A-1', totalAmount: 242 });
    const res = mockRes();
    await publicApiController.getPayment(
      mockReq({ organizationId: ORG_A, params: { paymentId: 'PAY-A-1' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentId).toBe('PAY-A-1');
    expect(res.body.data.totalAmount).toBe(242);
  });
});

describe('getStats', () => {
  test('agrega expediciones, canales y pagos acotados a la organización', async () => {
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-1', status: 'draft', declaration: { channel: 'green' } });
    await sembrarExp(ORG_A, { expeditionId: 'IMP-A-2', status: 'declaration_submitted', declaration: { channel: 'red' } });
    // Ruido de otra organización: NO debe contar.
    await sembrarExp(ORG_B, { expeditionId: 'IMP-B-1', status: 'draft', declaration: { channel: 'green' } });
    await sembrarPago(ORG_A, { paymentId: 'PAY-A-1', status: 'completed', totalAmount: 100 });
    await sembrarPago(ORG_B, { paymentId: 'PAY-B-1', status: 'completed', totalAmount: 999 });

    const res = mockRes();
    await publicApiController.getStats(mockReq({ organizationId: ORG_A }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.expeditions.total).toBe(2);
    expect(res.body.data.channels.total).toBe(2);
    expect(res.body.data.channels.byChannel.green).toBe(1);
    expect(res.body.data.channels.byChannel.red).toBe(1);
    // Solo el pago de ORG_A.
    expect(res.body.data.payments.totalAmount).toBe(100);
    expect(res.body.data.payments.count).toBe(1);
  });
});
