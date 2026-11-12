/**
 * h1Generator con la factura en otra divisa: la factura se muestra en su
 * divisa y el valor en aduana, los tributos y el XML van en euros con el tipo
 * oficial del mes. Antes la divisa salía siempre «EUR» con tipo 1.
 */
const h1Generator = require('../../../src/services/forms/h1Generator');

const TENANT = { name: 'Agencia Test SL', customsConfig: { eoriNumbers: { ES: 'ESA00000001' } } };
const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaReferencia: '2026-10-21', fechaPublicacion: '2026-10-21', fuente: 'BCE' };

function expediente(divisa) {
  return {
    client: {
      nif: 'B22477020', eori: 'ESB22477020', companyName: 'Cliente Test',
      address: { street: 'Calle Test 1', city: 'Barcelona', postalCode: '08001' },
      contact: { name: 'Contacto' }
    },
    goodsSummary: { totalPackages: 10, totalGrossWeight: 100, totalValue: 10000 },
    costs: { freight: 500, insurance: 100 },
    transport: { arrivalPort: 'BARCELONA' },
    goods: [{
      hsCode: '851830', taricCode: '8518300090', description: 'Auriculares', invoiceValue: 10000, currency: divisa,
      grossWeight: 100, netWeight: 95, packages: { quantity: 10, type: 'CT', marks: 'S/M' }
    }]
  };
}

describe('h1Generator: factura en divisa', () => {
  test('la factura va en dólares y el valor en aduana en euros', () => {
    const { data } = h1Generator.generate(expediente('USD'), {}, { tenant: TENANT, cambio: USD });

    expect(data.goodsShipment.currency).toBe('USD');
    expect(data.goodsShipment.exchangeRate).toBe(1.1234);
    expect(data.valuation.invoiceValue).toBe(10000);
    expect(data.valuation.invoiceCurrency).toBe('USD');
    expect(data.valuation.invoiceValueEur).toBe(8901.55);
    // 8.901,55 EUR + 500 de flete + 100 de seguro
    expect(data.valuation.customsValue).toBeCloseTo(9501.55, 2);
    expect(data.valuation.exchangeRateMonth).toBe('2026-11');
    expect(data.valuation.exchangeRateSource).toBe('BCE');
    expect(data.goodsItems[0].customsValue).toBeCloseTo(9501.55, 2);
  });

  test('sin el tipo de cambio no genera un H1 en dólares', () => {
    expect(() => h1Generator.generate(expediente('USD'), {}, { tenant: TENANT })).toThrow('USD');
  });

  test('en euros no cambia nada: tipo 1 y valor de factura tal cual', () => {
    const { data } = h1Generator.generate(expediente('EUR'), {}, { tenant: TENANT });

    expect(data.goodsShipment.currency).toBe('EUR');
    expect(data.goodsShipment.exchangeRate).toBe(1);
    expect(data.valuation.invoiceValueEur).toBe(10000);
    expect(data.valuation.customsValue).toBe(10600);
    expect(data.valuation.exchangeRateSource).toBeUndefined();
  });
});
