/**
 * Identificadores del producto por partida del H7 (guía AEAT H7 v3.23, R23 nota [4],
 * R232, C321): C127 identificador comercial, C128 referencia del fabricante y
 * C129 código normalizado EAN/GTIN (opcional; sin él se envía Y081).
 */
const H7Declaration = require('../../src/models/H7Declaration');

function nuevaH7(item = {}, extra = {}) {
  return new H7Declaration({
    operationType: 'B2C',
    trackingNumber: 'DHL123456789',
    carrier: { code: 'DHL', name: 'DHL' },
    items: [{
      description: 'Libro', taricCode: '4901990000', quantity: 1, unitValue: 12, totalValue: 12,
      netWeight: 0.3, countryOfOrigin: 'CN', ...item
    }],
    totals: { intrinsicValue: 12, customsValue: 12, netWeight: 0.3, packages: 1 },
    ...extra
  });
}

describe('H7Declaration — identificadores del producto en la partida', () => {
  test('guarda commercialId, manufacturerRef y gtin recortados', () => {
    const d = nuevaH7({ commercialId: ' SKU-1 ', manufacturerRef: ' REF-1 ', gtin: ' 9788420412146 ' });
    expect(d.items[0].commercialId).toBe('SKU-1');
    expect(d.items[0].manufacturerRef).toBe('REF-1');
    expect(d.items[0].gtin).toBe('9788420412146');
  });

  test('no son obligatorios al guardar un borrador (se exigen al presentar)', () => {
    const err = nuevaH7().validateSync();
    expect(err && err.errors['items.0.commercialId']).toBeUndefined();
  });

  test('rechaza identificadores de más de 70 caracteres (límite del XSD)', () => {
    const err = nuevaH7({ commercialId: 'x'.repeat(71) }).validateSync();
    expect(err.errors['items.0.commercialId']).toBeDefined();
  });

  test('rechaza un EAN/GTIN con formato inválido', () => {
    const err = nuevaH7({ gtin: '12AB' }).validateSync();
    expect(err.errors['items.0.gtin']).toBeDefined();
  });
});

describe('H7Declaration.validateAeatSubmission', () => {
  test('sin identificadores: dice qué partida y qué falta', () => {
    const r = nuevaH7().validateAeatSubmission();
    expect(r.valid).toBe(false);
    expect(r.errors.map(e => e.code)).toEqual(['H7_FALTA_C127', 'H7_FALTA_C128']);
    expect(r.errors[0].message).toMatch(/^Partida 1:/);
  });

  test('TARIC de 6 cifras: lo rechaza para la AEAT aunque el modelo lo admita', () => {
    const r = nuevaH7({ taricCode: '490199', commercialId: 'S', manufacturerRef: 'R' }).validateAeatSubmission();
    expect(r.errors.map(e => e.code)).toEqual(['H7_NC_8_CIFRAS']);
  });

  test('completa: válida', () => {
    expect(nuevaH7({ commercialId: 'S', manufacturerRef: 'R' }).validateAeatSubmission())
      .toEqual({ valid: true, errors: [] });
  });
});

describe('H7Declaration — IOSS y liquidacion de la AEAT', () => {
  test('guarda la referencia de la autorizacion esporadica IOSS (1014)', () => {
    const d = nuevaH7({}, { iossNumber: 'IM1234567890', iossAuthorizationRef: ' ESIOSS2026000001 ' });
    expect(d.iossAuthorizationRef).toBe('ESIOSS2026000001');
    expect(nuevaH7({}, { iossAuthorizationRef: 'x'.repeat(71) }).validateSync().errors.iossAuthorizationRef).toBeDefined();
  });

  test('guarda los tributos liquidados por la AEAT y su total', () => {
    const d = nuevaH7({}, { duties: { aeatTaxes: [{ taxType: 'F00', amount: 2, base: null }], aeatTotal: 2 } });
    expect(d.duties.aeatTaxes[0].taxType).toBe('F00');
    expect(d.duties.aeatTaxes[0].amount).toBe(2);
    expect(d.duties.aeatTotal).toBe(2);
  });
});
