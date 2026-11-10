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
  it('senala el peso bruto total a cero', () => {
    const expedicion = expedicionBase();

    expect(h1Generator.totalesNoDeclarables(expedicion)).toMatch(/peso bruto/i);
  });

  it('senala el importe de factura a cero', () => {
    const expedicion = expedicionBase({
      goodsSummary: { totalItems: 1, totalPackages: 20, totalGrossWeight: 120, totalNetWeight: 105, totalValue: 0 }
    });

    expect(h1Generator.totalesNoDeclarables(expedicion)).toMatch(/importe|valor/i);
  });

  it('senala los bultos a cero', () => {
    const expedicion = expedicionBase({
      goodsSummary: { totalItems: 1, totalPackages: 0, totalGrossWeight: 120, totalNetWeight: 105, totalValue: 12500 }
    });

    expect(h1Generator.totalesNoDeclarables(expedicion)).toMatch(/bulto/i);
  });

  it('genera el H1 cuando los totales son correctos', () => {
    const expedicion = expedicionBase({
      goodsSummary: { totalItems: 1, totalPackages: 20, totalGrossWeight: 120, totalNetWeight: 105, totalValue: 12500 }
    });

    expect(h1Generator.totalesNoDeclarables(expedicion)).toBeNull();
    const h1 = h1Generator.generate(expedicion, {}, {
      tenant: { name: 'Agencia SL', customsConfig: { eoriNumbers: { ES: 'ESA00000001' } } }
    });

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

    expect(h1Generator.totalesNoDeclarables(expedicion)).toMatch(/EXP-TEST-0001/);
  });
});

/**
 * Visto en el navegador el 10/Nov/2026: la tarjeta del H1 mostraba un LRN y la
 * vista previa otro. `generate` creaba uno y `buildDeclarationHeader` otro.
 */
describe('h1Generator.generate — un unico LRN por declaracion', () => {
  const h1Generator = require('../../src/services/forms/h1Generator');
  const expediente = {
    expeditionId: 'EXP-LRN', transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345674', eori: 'ESB12345674', address: { street: 'Calle 1', city: 'Valencia', postalCode: '46001' } },
    exporter: { companyName: 'Exportador Ltd', country: 'CN', address: { city: 'Shenzhen' } },
    representative: { eori: 'ESB22477020', companyName: 'Representante SL' },
    goods: [{ itemNumber: 1, description: 'Portatiles', taricCode: '8471300000', originCountry: 'CN', quantity: 10, grossWeight: 25, netWeight: 20, invoiceValue: 5000, packages: { quantity: 2, type: 'CT' } }],
    goodsSummary: { totalItems: 1, totalPackages: 2, totalGrossWeight: 25, totalNetWeight: 20, totalValue: 5000 },
    transport: {}
  };

  test('el LRN de la declaracion, el de los datos y el de la cabecera son el mismo', () => {
    const r = h1Generator.generate(expediente, {});

    expect(r.lrn).toBeTruthy();
    expect(r.data.lrn).toBe(r.lrn);
    expect(r.data.declarationHeader.lrn).toBe(r.lrn);
    expect(r.xml).toContain(r.lrn);
  });

  test('si se le da un LRN lo respeta en los tres sitios', () => {
    const r = h1Generator.generate(expediente, { lrn: 'LRN-DADO-0001' });

    expect(r.lrn).toBe('LRN-DADO-0001');
    expect(r.data.declarationHeader.lrn).toBe('LRN-DADO-0001');
  });
});
