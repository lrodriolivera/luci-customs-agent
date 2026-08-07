/**
 * Reglamento (UE) 2026/382 — supresión de la franquicia aduanera de 150 EUR.
 * Aplicable desde 1/Jul/2026. Medida transitoria 1/Jul/2026 → 1/Jul/2028:
 * derecho de aduana fijo de 3 EUR/artículo en envíos ≤150 EUR cuando el envío
 * está exento de IVA por IOSS o es un envío postal.
 *
 * Antes de este reglamento el H7 estaba "exento de arancel" (tariff.amount = 0),
 * lo que ya NO se cumple. calculateDuties debe aplicar el derecho fijo.
 */
const H7Declaration = require('../../src/models/H7Declaration');

// Fecha dentro del periodo transitorio (posterior al 1/Jul/2026).
const FECHA_EN_VIGOR = new Date('2026-08-07T00:00:00Z');
const FECHA_PRE_REFORMA = new Date('2026-06-15T00:00:00Z');

function nuevaH7({ intrinsicValue, articulos = 1, carrierCode = 'CORREOS', iossNumber, vatPrepaid = false }) {
  const items = Array.from({ length: articulos }, () => ({
    description: 'Test', taricCode: '39269097', quantity: 1,
    unitValue: intrinsicValue / articulos, totalValue: intrinsicValue / articulos, netWeight: 0.2
  }));
  const d = new H7Declaration({
    operationType: 'B2C',
    trackingNumber: `${carrierCode}123456789`,
    carrier: { code: carrierCode, name: carrierCode },
    iossNumber,
    vatPrepaid,
    items,
    totals: { intrinsicValue, shippingCost: 0, insuranceCost: 0, customsValue: intrinsicValue, netWeight: 0.2, packages: 1 },
    duties: { tariff: { rate: 0, amount: 0 }, vat: { rate: 21, amount: 0, prepaid: vatPrepaid }, handlingFee: 0, totalDue: 0 }
  });
  return d;
}

describe('H7Declaration.calculateDuties — Reglamento (UE) 2026/382', () => {
  test('envío postal (CORREOS) de 22 EUR: aplica derecho fijo de 3 EUR (ya NO 0)', () => {
    const d = nuevaH7({ intrinsicValue: 22, articulos: 1, carrierCode: 'CORREOS' });
    d.calculateDuties(FECHA_EN_VIGOR);
    expect(d.duties.tariff.amount).toBe(3.00);
    expect(d.duties.totalDue).toBeGreaterThan(0);
  });

  test('derecho fijo es 3 EUR POR ARTÍCULO', () => {
    const d = nuevaH7({ intrinsicValue: 60, articulos: 3, carrierCode: 'CORREOS' });
    d.calculateDuties(FECHA_EN_VIGOR);
    expect(d.duties.tariff.amount).toBe(9.00); // 3 artículos × 3 EUR
  });

  test('IVA se calcula sobre base + derecho fijo (no solo sobre el valor)', () => {
    // valor 100, 1 artículo, IOSS -> exento IVA por IOSS: sólo derecho fijo.
    // Sin IOSS (postal) el IVA aplica sobre 100 + 3 = 103 -> 21% = 21.63
    const d = nuevaH7({ intrinsicValue: 100, articulos: 1, carrierCode: 'CORREOS' });
    d.calculateDuties(FECHA_EN_VIGOR);
    expect(d.duties.tariff.amount).toBe(3.00);
    expect(d.duties.vat.amount).toBeCloseTo(21.63, 2); // (100+3)*0.21
  });

  test('envío IOSS (IVA prepagado): derecho fijo aplica, IVA no', () => {
    const d = nuevaH7({ intrinsicValue: 40, articulos: 1, carrierCode: 'DHL', iossNumber: 'IM1234567890', vatPrepaid: true });
    d.calculateDuties(FECHA_EN_VIGOR);
    expect(d.duties.tariff.amount).toBe(3.00);
    expect(d.duties.vat.amount).toBe(0); // prepagado via IOSS
    expect(d.duties.totalDue).toBe(3.00);
  });

  test('cortesía retro: antes del 1/Jul/2026 NO se aplica derecho fijo', () => {
    const d = nuevaH7({ intrinsicValue: 22, articulos: 1, carrierCode: 'CORREOS' });
    d.calculateDuties(FECHA_PRE_REFORMA);
    expect(d.duties.tariff.amount).toBe(0);
  });

  test('sin umbral de 22 EUR: un envío postal de 10 EUR tributa IVA (minimis derogado)', () => {
    const d = nuevaH7({ intrinsicValue: 10, articulos: 1, carrierCode: 'CORREOS' });
    d.calculateDuties(FECHA_EN_VIGOR);
    // 10 + derecho fijo 3 = 13 base IVA -> 2.73
    expect(d.duties.vat.amount).toBeGreaterThan(0);
  });

  test('courier NO postal sin IOSS: derecho fijo transitorio NO aplica (fuera del supuesto)', () => {
    const d = nuevaH7({ intrinsicValue: 40, articulos: 1, carrierCode: 'DHL' });
    d.calculateDuties(FECHA_EN_VIGOR);
    // El derecho fijo de 3€ es solo para IOSS exento o postal; DHL sin IOSS no lo lleva.
    expect(d.duties.tariff.amount).toBe(0);
    // Pero el IVA sí aplica sin umbral de 22€.
    expect(d.duties.vat.amount).toBeGreaterThan(0);
  });
});
