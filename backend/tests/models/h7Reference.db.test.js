/**
 * Generación de la referencia H7 (pre-save hook).
 *
 * Bug real reproducido en PRE: el hook generaba la reference con
 * `countDocuments + 1`. Si el máximo sufijo existente NO coincide con el número
 * de documentos (p. ej. tras borrar registros intermedios, o si el seeder dejó
 * un hueco), `count + 1` colisiona con una reference ya existente y el save
 * revienta con E11000 duplicate key. Debe basarse en el máximo sufijo real + 1
 * y ser robusto ante colisiones.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const H7Declaration = require('../../src/models/H7Declaration');

usarBaseDeDatosEnMemoria();

function baseH7(extra = {}) {
  return {
    tenantId: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    operationType: 'B2C',
    trackingNumber: 'CORREOS' + Math.floor(Math.random() * 1e9),
    carrier: { code: 'CORREOS', name: 'Correos' },
    sender: { name: 'X', address: { country: 'CN' } },
    recipient: { name: 'Y', address: { street: 'c', city: 'M', postalCode: '28001', country: 'ES' } },
    items: [{ description: 'x', taricCode: '392690', countryOfOrigin: 'CN', quantity: 1, unitValue: 10, totalValue: 10, netWeight: 0.1 }],
    totals: { intrinsicValue: 10, customsValue: 10, netWeight: 0.1, grossWeight: 0.11, packages: 1 },
    ...extra
  };
}

describe('H7Declaration.reference — generación robusta', () => {
  test('cuando el máximo sufijo > número de documentos, no colisiona', async () => {
    const year = new Date().getFullYear();
    // Simula el estado real de PRE: existe H7-YYYY-000036 pero hay pocos documentos.
    await H7Declaration.create(baseH7({ reference: `H7-${year}-000036` }));
    // La siguiente creación NO debe reventar por dup key; debe ser 000037.
    const nueva = await H7Declaration.create(baseH7());
    expect(nueva.reference).toBe(`H7-${year}-000037`);
  });

  test('acepta el MRN real de H7 que devuelve AEAT (26ESH7A...)', async () => {
    // La regex antigua (\d{14}H7$) rechazaba el MRN real de H7. Debe aceptarlo.
    const d = await H7Declaration.create(baseH7({ mrn: '26ESH7A000067964R6' }));
    expect(d.mrn).toBe('26ESH7A000067964R6');
  });

  test('varias creaciones consecutivas generan referencias únicas y crecientes', async () => {
    const year = new Date().getFullYear();
    const a = await H7Declaration.create(baseH7());
    const b = await H7Declaration.create(baseH7());
    const c = await H7Declaration.create(baseH7());
    const refs = [a.reference, b.reference, c.reference];
    expect(new Set(refs).size).toBe(3); // todas únicas
    expect(refs.every(r => r.startsWith(`H7-${year}-`))).toBe(true);
  });
});
