/**
 * h1Generator (vista previa cuando aún no se puede preparar el mensaje CAU):
 * el país del incoterm y el valor en aduana salen de las mismas reglas que el
 * H1 CAU (`lugarDeEntrega.js`, `ajustesDelValor.js`). Antes ponía «ES» a
 * cualquier incoterm y no restaba el transporte posterior a la entrada.
 */
const h1Generator = require('../../../src/services/forms/h1Generator');

const TENANT = { name: 'Agencia Test SL', customsConfig: { eoriNumbers: { ES: 'ESA00000001' } } };

function expediente(incoterm, costs = {}) {
  return {
    client: {
      nif: 'B22477020', eori: 'ESB22477020', companyName: 'Cliente Test',
      address: { street: 'Calle Test 1', city: 'Barcelona', postalCode: '08001' }, contact: { name: 'Contacto' }
    },
    exporter: { companyName: 'Shenzhen Ltd', country: 'CN' },
    incoterm,
    goodsSummary: { totalPackages: 10, totalGrossWeight: 100, totalValue: 10000 },
    costs,
    transport: { arrivalPort: 'BARCELONA', departurePort: 'SHANGHAI' },
    goods: [{
      hsCode: '851830', taricCode: '8518300090', description: 'Auriculares', invoiceValue: 10000, currency: 'EUR',
      grossWeight: 100, netWeight: 95, packages: { quantity: 10, type: 'CT', marks: 'S/M' }, dutyRate: 0
    }]
  };
}

describe('h1Generator: país del lugar del incoterm', () => {
  test('FOB: el lugar está en el país de expedición', () => {
    const { data } = h1Generator.generate(expediente({ code: 'FOB', place: 'Shanghai' }, { freight: 0, insurance: 0 }), {}, { tenant: TENANT });
    expect(data.goodsShipment.deliveryTerms).toEqual({ code: 'FOB', location: 'Shanghai', country: 'CN' });
  });

  test('DAP: el lugar está en España', () => {
    const { data } = h1Generator.generate(expediente({ code: 'DAP', place: 'Madrid' }, { freightAfterEntry: { amount: 0 } }), {}, { tenant: TENANT });
    expect(data.goodsShipment.deliveryTerms).toEqual({ code: 'DAP', location: 'Madrid', country: 'ES' });
  });
});

describe('h1Generator: transporte después de la entrada (BA)', () => {
  test('DAP: el transporte interior se resta del valor en aduana, no de la base del IVA', () => {
    const { data } = h1Generator.generate(
      expediente({ code: 'DAP', place: 'Madrid' }, { freightAfterEntry: { amount: 400, currency: 'EUR' } }), {}, { tenant: TENANT }
    );
    expect(data.valuation.deductions.freightAfterImport).toBe(400);
    expect(data.valuation.customsValue).toBe(9600);
    expect(data.goodsItems[0].customsValue).toBe(9600);
    // El IVA vuelve a incluirlo: transporte hasta el primer destino (art. 83.Dos.2º LIVA).
    expect(data.dutyTaxFee.vat.baseAmount).toBe(10000);
  });

  test('ajustes opcionales: cánones (AI) suman y comisiones de compra (BF) restan', () => {
    const costs = { otherAdjustments: [{ code: 'AI', amount: 300, currency: 'EUR' }, { code: 'BF', amount: 100, currency: 'EUR' }] };
    const { data } = h1Generator.generate(expediente({ code: 'CIF', place: 'Barcelona' }, costs), {}, { tenant: TENANT });
    expect(data.valuation.additions.royalties).toBe(300);
    expect(data.valuation.deductions.buyingCommissions).toBe(100);
    expect(data.valuation.customsValue).toBe(10200);
  });
});
