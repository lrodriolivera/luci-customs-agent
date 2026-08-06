/**
 * h1Generator — el DUA no puede salir con pesos e importes a cero
 *
 * El generador lee los totales de `expedition.goodsSummary`, que un hook
 * pre-save calcula sumando `grossWeight` / `invoiceValue` / `packages.quantity`
 * de cada partida. Si esos campos llegan con otro nombre —Mongoose los descarta
 * en silencio— el hook suma sobre vacío y `goodsSummary` queda a cero.
 *
 * El resultado era un XML sintacticamente valido, con `errors: []`, y
 * `TotalGrossMassMeasure`, `TotalInvoiceAmount` y `TotalPackageQuantity` a 0:
 * una declaracion con valor cero presentada ante la AEAT sin un solo aviso.
 *
 * Detectado en las pruebas E2E del 6/Ago/2026 (expediente EXP-2026-982957C3).
 */

const h1Generator = require('../../src/services/forms/h1Generator');

/** Expediente minimo con lo que el generador necesita para no fallar antes. */
const expedicionBase = (overrides = {}) => ({
  expeditionId: 'EXP-TEST-0001',
  operationType: 'import',
  transportMode: 'maritime',
  client: {
    companyName: 'STRIX AI PIONEER SOLUTIONS SL',
    nif: 'B22477020',
    eori: 'ESB22477020',
    address: { street: 'Gran Via 45', city: 'Madrid', postalCode: '28013', country: 'ES' }
  },
  goods: [{
    itemNumber: 1,
    description: 'Catalogos comerciales impresos',
    taricCode: '4911109000',
    quantity: 500,
    originCountry: 'CN'
  }],
  goodsSummary: { totalItems: 1, totalPackages: 0, totalGrossWeight: 0, totalNetWeight: 0, totalValue: 0 },
  incoterm: { code: 'FOB' },
  customsOffice: 'ES003911',
  ...overrides
});

describe('h1Generator — totales de la declaracion', () => {
  it('rechaza generar un H1 cuando el peso bruto total es cero', () => {
    const expedicion = expedicionBase();

    expect(() => h1Generator.generate(expedicion))
      .toThrow(/peso bruto/i);
  });

  it('rechaza generar un H1 cuando el importe de factura total es cero', () => {
    const expedicion = expedicionBase({
      goodsSummary: { totalItems: 1, totalPackages: 20, totalGrossWeight: 120, totalNetWeight: 105, totalValue: 0 }
    });

    expect(() => h1Generator.generate(expedicion))
      .toThrow(/importe|valor/i);
  });

  it('rechaza generar un H1 sin bultos declarados', () => {
    const expedicion = expedicionBase({
      goodsSummary: { totalItems: 1, totalPackages: 0, totalGrossWeight: 120, totalNetWeight: 105, totalValue: 12500 }
    });

    expect(() => h1Generator.generate(expedicion))
      .toThrow(/bulto/i);
  });

  it('genera el H1 cuando los totales son correctos', () => {
    const expedicion = expedicionBase({
      goodsSummary: { totalItems: 1, totalPackages: 20, totalGrossWeight: 120, totalNetWeight: 105, totalValue: 12500 }
    });

    const h1 = h1Generator.generate(expedicion);

    expect(h1.data.declarationHeader.totalGrossMass).toBe(120);
    expect(h1.data.declarationHeader.totalPackages).toBe(20);
    // Lo que de verdad viaja a la AEAT es el XML, no la estructura intermedia.
    expect(h1.xml).toContain('<TotalGrossMassMeasure>120</TotalGrossMassMeasure>');
    expect(h1.xml).toContain('<TotalInvoiceAmount>12500</TotalInvoiceAmount>');
    expect(h1.xml).toContain('<TotalPackageQuantity>20</TotalPackageQuantity>');
  });

  it('nombra el campo que falta, para que el agente sepa que corregir', () => {
    // Un "datos invalidos" generico obliga a adivinar cual de los tres es.
    const expedicion = expedicionBase();

    expect(() => h1Generator.generate(expedicion))
      .toThrow(/EXP-TEST-0001/);
  });
});
