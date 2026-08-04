/**
 * paymentService: alta manual, confirmacion y reembolso contra Mongo real.
 *
 * Es dinero y aislamiento entre clientes. Dos cosas se prueban de verdad:
 *   1. El ciclo de un cobro por transferencia: alta -> confirmacion -> reembolso,
 *      con los importes cuadrando.
 *   2. El guard de organizacion en confirmar y reembolsar. requireRole('admin')
 *      es un rol DE TENANT: sin acotar por organizationId, un admin podia
 *      confirmar o reembolsar el cobro de otro cliente conociendo su paymentId
 *      (auditado en ef596b4). Estos tests fijan esa proteccion.
 *
 * BD en memoria efimera, NO produccion. calculatePaymentItems es puro y se
 * prueba sin BD.
 *
 * BUG ENCONTRADO al escribir esto (fix en el modelo Payment): el esquema
 * declaraba `paymentMethod: { type: String, brand, last4, ... }`. Mongoose
 * interpreta ese `type: String` como el SchemaType del bloque entero, no como
 * un subcampo, asi que createManualPayment -- que asigna { type: 'bank_transfer' }
 * -- reventaba con ValidationError y NINGUN pago manual podia guardarse.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const paymentService = require('../../src/services/paymentService');

usarBaseDeDatosEnMemoria();

/** Alta manual minima para una organizacion. */
function datosPago(items = [{ description: 'Derechos', type: 'duty', amount: 100 }]) {
  return { clientEmail: 'cliente@ejemplo.es', clientName: 'Cliente SL', items };
}

describe('calculatePaymentItems: desglose del cobro (puro)', () => {
  const expedition = {
    expeditionId: 'EXP-2026-1',
    _id: new mongoose.Types.ObjectId(),
    declaration: { mrn: '26ES00280112345678' }
  };

  test('genera una linea por cada tributo con importe positivo', () => {
    const items = paymentService.calculatePaymentItems({
      ...expedition, calculations: { totalDuties: 100, totalVat: 210, totalSpecialTaxes: 5 }
    });

    expect(items.map(i => i.type)).toEqual(['duty', 'vat', 'special_tax']);
    expect(items.map(i => i.amount)).toEqual([100, 210, 5]);
  });

  test('omite los tributos que son cero', () => {
    // Sin impuestos especiales no se emite esa linea.
    const items = paymentService.calculatePaymentItems({
      ...expedition, calculations: { totalDuties: 100, totalVat: 0, totalSpecialTaxes: 0 }
    });

    expect(items.length).toBe(1);
    expect(items[0].type).toBe('duty');
  });

  test('sin calculos no genera ninguna linea', () => {
    const items = paymentService.calculatePaymentItems({ ...expedition, calculations: {} });

    expect(items).toEqual([]);
  });

  test('usa el MRN como referencia cuando existe', () => {
    const items = paymentService.calculatePaymentItems({
      ...expedition, calculations: { totalDuties: 100 }
    });

    expect(items[0].reference).toBe('26ES00280112345678');
  });
});

describe('createManualPayment', () => {
  test('crea el pago por transferencia y calcula el total', async () => {
    // Regresion del bug de paymentMethod: este save fallaba antes del fix.
    const org = new mongoose.Types.ObjectId();

    const p = await paymentService.createManualPayment(org, datosPago([
      { description: 'Derechos', type: 'duty', amount: 100 },
      { description: 'IVA', type: 'vat', amount: 210 }
    ]));

    expect(p.totalAmount).toBe(310);
    expect(p.status).toBe('pending');
    expect(p.paymentMethod.type).toBe('bank_transfer');
    expect(String(p.organizationId)).toBe(String(org));
  });

  test('cada pago recibe un identificador unico', async () => {
    const org = new mongoose.Types.ObjectId();

    const a = await paymentService.createManualPayment(org, datosPago());
    const b = await paymentService.createManualPayment(org, datosPago());

    expect(a.paymentId).not.toBe(b.paymentId);
  });
});

describe('confirmManualPayment', () => {
  test('marca el pago como completado y registra quien lo confirma', async () => {
    const org = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const p = await paymentService.createManualPayment(org, datosPago());

    const c = await paymentService.confirmManualPayment(p.paymentId, user, org);

    expect(c.status).toBe('completed');
    expect(c.paidAt).toBeInstanceOf(Date);
    expect(String(c.metadata.confirmedBy)).toBe(String(user));
  });

  test('un admin de otra organizacion NO puede confirmar el cobro', async () => {
    // El guard clave: mismo error que si no existiera, para no confirmar que el
    // paymentId pertenece a otra cuenta.
    const orgPropia = new mongoose.Types.ObjectId();
    const orgAjena = new mongoose.Types.ObjectId();
    const p = await paymentService.createManualPayment(orgPropia, datosPago());

    await expect(
      paymentService.confirmManualPayment(p.paymentId, new mongoose.Types.ObjectId(), orgAjena)
    ).rejects.toThrow(/not found/i);
  });
});

describe('refundPayment', () => {
  /** Deja un pago completado listo para reembolsar. */
  async function pagoCompletado(org, user, amount = 100) {
    const p = await paymentService.createManualPayment(org, datosPago([
      { description: 'Derechos', type: 'duty', amount }
    ]));
    await paymentService.confirmManualPayment(p.paymentId, user, org);
    return p.paymentId;
  }

  test('reembolsa un pago completado', async () => {
    const org = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const paymentId = await pagoCompletado(org, user);

    const r = await paymentService.refundPayment(paymentId, null, 'mercancia devuelta', user, org);

    expect(['refunded', 'partially_refunded']).toContain(r.status);
  });

  test('no se puede reembolsar un pago que no esta completado', async () => {
    // Reembolsar un pendiente devolveria dinero que nunca entro.
    const org = new mongoose.Types.ObjectId();
    const p = await paymentService.createManualPayment(org, datosPago());

    await expect(
      paymentService.refundPayment(p.paymentId, null, 'x', new mongoose.Types.ObjectId(), org)
    ).rejects.toThrow(/completed/i);
  });

  test('no se puede reembolsar por encima del importe cobrado', async () => {
    const org = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const paymentId = await pagoCompletado(org, user, 100);

    await expect(
      paymentService.refundPayment(paymentId, 99999, 'x', user, org)
    ).rejects.toThrow(/exceeds/i);
  });

  test('un admin de otra organizacion NO puede reembolsar el cobro', async () => {
    const orgPropia = new mongoose.Types.ObjectId();
    const orgAjena = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const paymentId = await pagoCompletado(orgPropia, user);

    await expect(
      paymentService.refundPayment(paymentId, null, 'x', new mongoose.Types.ObjectId(), orgAjena)
    ).rejects.toThrow(/not found/i);
  });
});
