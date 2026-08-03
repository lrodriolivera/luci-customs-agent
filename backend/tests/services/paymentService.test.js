/**
 * Tests para paymentService (estaba al 0%).
 *
 * Mueve dinero: cobros por derechos de aduana e IVA de importacion, reembolsos
 * y confirmacion de pagos manuales. El foco esta en lo que no debe pasar nunca
 * —reembolsar o dar por pagado el cobro de otro cliente, reembolsar mas de lo
 * cobrado, aceptar un webhook sin firma— por encima del camino feliz.
 */

const mockPayment = { findOne: jest.fn(), findById: jest.fn(), find: jest.fn() };
const mockExpedition = { findById: jest.fn() };

jest.mock('../../src/models', () => ({
  Payment: mockPayment,
  Expedition: mockExpedition,
  Tenant: { findById: jest.fn() }
}));

const paymentService = require('../../src/services/paymentService');

const ORG_A = '6a5769e0b11d798e7e783602';
const ORG_B = '6a5769e0b11d798e7e7836bb';
const USER = '6a5769e0b11d798e7e783607';

/** Pago completado de 1.000 EUR, propiedad de ORG_A. */
function pago(overrides = {}) {
  return {
    paymentId: 'PAY-2026-0001',
    organizationId: ORG_A,
    status: 'completed',
    totalAmount: 1000,
    currency: 'EUR',
    stripe: {},
    metadata: {},
    items: [],
    processRefund: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe('paymentService.refundPayment', () => {
  beforeEach(() => jest.clearAllMocks());

  test('la consulta se acota a la organizacion del solicitante', async () => {
    // requireRole('admin') es un rol DE TENANT: sin acotar, un admin podia
    // reembolsar el pago de otro cliente conociendo su paymentId.
    mockPayment.findOne.mockResolvedValue(null);

    await paymentService.refundPayment('PAY-2026-0001', 100, 'x', USER, ORG_A).catch(() => {});

    expect(mockPayment.findOne).toHaveBeenCalledWith({
      paymentId: 'PAY-2026-0001',
      organizationId: ORG_A
    });
  });

  test('un pago de otra organizacion no se encuentra', async () => {
    mockPayment.findOne.mockResolvedValue(null); // el filtro por org no casa

    await expect(paymentService.refundPayment('PAY-2026-0001', 100, 'x', USER, ORG_B))
      .rejects.toThrow('Payment not found');
  });

  test('solo se reembolsan pagos completados', async () => {
    const p = pago({ status: 'pending' });
    mockPayment.findOne.mockResolvedValue(p);

    await expect(paymentService.refundPayment('PAY-2026-0001', 100, 'x', USER, ORG_A))
      .rejects.toThrow('Can only refund completed payments');
    expect(p.processRefund).not.toHaveBeenCalled();
  });

  test('un pago ya reembolsado no se puede reembolsar otra vez', async () => {
    // processRefund deja el estado en refunded/partially_refunded, y el guard
    // de "solo completed" es lo que impide el doble reembolso.
    const p = pago({ status: 'partially_refunded' });
    mockPayment.findOne.mockResolvedValue(p);

    await expect(paymentService.refundPayment('PAY-2026-0001', 100, 'x', USER, ORG_A))
      .rejects.toThrow('Can only refund completed payments');
    expect(p.processRefund).not.toHaveBeenCalled();
  });

  test('no se puede reembolsar mas de lo cobrado', async () => {
    const p = pago();
    mockPayment.findOne.mockResolvedValue(p);

    await expect(paymentService.refundPayment('PAY-2026-0001', 1500, 'x', USER, ORG_A))
      .rejects.toThrow('Refund amount exceeds payment amount');
    expect(p.processRefund).not.toHaveBeenCalled();
  });

  test('sin importe se reembolsa el total', async () => {
    const p = pago();
    mockPayment.findOne.mockResolvedValue(p);

    await paymentService.refundPayment('PAY-2026-0001', null, 'duplicado', USER, ORG_A);

    expect(p.processRefund).toHaveBeenCalledWith(1000, 'duplicado', USER, undefined);
  });

  test('un reembolso parcial pasa el importe indicado', async () => {
    const p = pago();
    mockPayment.findOne.mockResolvedValue(p);

    await paymentService.refundPayment('PAY-2026-0001', 250, 'parcial', USER, ORG_A);

    expect(p.processRefund).toHaveBeenCalledWith(250, 'parcial', USER, undefined);
  });
});

describe('paymentService.confirmManualPayment', () => {
  beforeEach(() => jest.clearAllMocks());

  test('la consulta se acota a la organizacion', async () => {
    mockPayment.findOne.mockResolvedValue(null);

    await paymentService.confirmManualPayment('PAY-2026-0001', USER, ORG_A).catch(() => {});

    expect(mockPayment.findOne).toHaveBeenCalledWith({
      paymentId: 'PAY-2026-0001',
      organizationId: ORG_A
    });
  });

  test('no se puede dar por pagado el cobro de otra organizacion', async () => {
    mockPayment.findOne.mockResolvedValue(null);

    await expect(paymentService.confirmManualPayment('PAY-2026-0001', USER, ORG_B))
      .rejects.toThrow('Payment not found');
  });

  test('marca el pago como completado y deja traza de quien lo confirmo', async () => {
    const p = pago({ status: 'pending', items: [{ expeditionId: 'e1', amount: 100 }] });
    mockExpedition.findById.mockResolvedValue(null);
    mockPayment.findOne.mockResolvedValue(p);

    await paymentService.confirmManualPayment('PAY-2026-0001', USER, ORG_A);

    expect(p.status).toBe('completed');
    expect(p.paidAt).toBeInstanceOf(Date);
    expect(p.metadata.confirmedBy).toBe(USER);
    expect(p.save).toHaveBeenCalled();
  });

  test('un pago manual SIN items no revienta al confirmarse', async () => {
    // items no es obligatorio en el schema; antes esto lanzaba TypeError
    // despues de marcar el pago como completado, devolviendo un 500.
    const p = pago({ status: 'pending' });
    delete p.items;
    mockPayment.findOne.mockResolvedValue(p);

    await expect(paymentService.confirmManualPayment('PAY-2026-0001', USER, ORG_A))
      .resolves.toBeDefined();
    expect(p.status).toBe('completed');
  });
});

describe('paymentService.calculatePaymentItems', () => {
  test('desglosa derechos, IVA e impuestos especiales', () => {
    const items = paymentService.calculatePaymentItems({
      expeditionId: 'EXP-2026-0100',
      _id: 'e1',
      calculations: { totalDuties: 120, totalVat: 210, totalSpecialTaxes: 30 },
      declaration: { mrn: '26ES001' }
    });

    expect(items.map(i => i.type)).toEqual(['duty', 'vat', 'special_tax']);
    expect(items.map(i => i.amount)).toEqual([120, 210, 30]);
  });

  test('omite los conceptos con importe cero', () => {
    const items = paymentService.calculatePaymentItems({
      expeditionId: 'EXP-2026-0100',
      calculations: { totalDuties: 0, totalVat: 210, totalSpecialTaxes: 0 }
    });

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('vat');
  });

  test('acepta los alias antiguos de los campos de calculo', () => {
    // calculationController escribe totalDuties/totalVat; los nombres viejos
    // siguen tolerandose para no romper expedientes ya calculados.
    const items = paymentService.calculatePaymentItems({
      expeditionId: 'EXP-2026-0100',
      calculations: { dutyTotal: 50, vatTotal: 100 }
    });

    expect(items.map(i => i.amount)).toEqual([50, 100]);
  });

  test('sin calculos no genera items', () => {
    expect(paymentService.calculatePaymentItems({ expeditionId: 'X' })).toEqual([]);
  });

  test('usa el MRN como referencia si existe', () => {
    const [item] = paymentService.calculatePaymentItems({
      expeditionId: 'EXP-2026-0100',
      calculations: { totalDuties: 10 },
      declaration: { mrn: '26ES00280112345678' }
    });

    expect(item.reference).toBe('26ES00280112345678');
  });
});
