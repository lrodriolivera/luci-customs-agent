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

describe('h1Generator: liquidación a partir de las partidas', () => {
  test('el arancel sale del tipo de cada partida, no de un 0 % fijo', () => {
    const exp = expediente('USD');
    exp.goods[0].dutyRate = 12;
    exp.goods[0].vatRate = 21;
    exp.costs = {};
    const { data } = h1Generator.generate(exp, {}, { tenant: TENANT, cambio: USD });

    // 8.901,55 EUR × 12 % = 1.068,19; IVA 21 % × 9.969,74 = 2.093,65 (lo mismo que liquida la AEAT)
    expect(data.dutyTaxFee.importDuty.rate).toBe(12);
    expect(data.dutyTaxFee.importDuty.payableAmount).toBe(1068.19);
    expect(data.dutyTaxFee.vat.baseAmount).toBeCloseTo(9969.74, 2);
    expect(data.dutyTaxFee.vat.payableAmount).toBe(2093.65);
  });

  test('con varias partidas suma el arancel de cada una y da el tipo efectivo', () => {
    const exp = expediente('EUR');
    exp.costs = {};
    exp.goodsSummary.totalValue = 10000;
    exp.goods = [
      { ...exp.goods[0], invoiceValue: 6000, dutyRate: 12, vatRate: 21 },
      { ...exp.goods[0], invoiceValue: 4000, dutyRate: 0, vatRate: 21 }
    ];
    const { data } = h1Generator.generate(exp, {}, { tenant: TENANT });

    expect(data.dutyTaxFee.importDuty.payableAmount).toBe(720);
    expect(data.dutyTaxFee.importDuty.rate).toBe(7.2);
    expect(data.dutyTaxFee.vat.payableAmount).toBe(2251.2);
  });

  test('un tipo global indicado expresamente sigue mandando', () => {
    const exp = expediente('EUR');
    exp.goods[0].dutyRate = 12;
    exp.costs = {};
    const { data } = h1Generator.generate(exp, { tariffRate: 5 }, { tenant: TENANT });

    expect(data.dutyTaxFee.importDuty.rate).toBe(5);
    expect(data.dutyTaxFee.importDuty.payableAmount).toBe(500);
  });
});

describe('h1Generator: flete y seguro hasta la UE según el incoterm', () => {
  const GBP = { divisa: 'GBP', tipo: 0.83825, mes: '2026-11', fuente: 'BCE' };
  const conGastos = (incoterm) => ({
    ...expediente('USD'),
    incoterm: { code: incoterm, place: 'Shanghai' },
    costs: { freight: { amount: 1123.4, currency: 'USD' }, insurance: { amount: 83.83, currency: 'GBP' } }
  });

  test('FOB: suma flete y seguro en euros, cada uno con su tipo, y muestra los importes en su divisa', () => {
    const { data } = h1Generator.generate(conGastos('FOB'), {}, { tenant: TENANT, cambio: USD, cambiosGastos: { GBP } });

    expect(data.valuation.additions.freightToEU).toBe(1000);
    expect(data.valuation.additions.insuranceToEU).toBe(100.01);
    expect(data.valuation.customsValue).toBeCloseTo(10001.56, 2);
    expect(data.valuation.statisticalValue).toBeCloseTo(10001.56, 2);
    expect(data.goodsShipment.transportCharges).toMatchObject({ freightAmount: 1123.4, freightCurrency: 'USD' });
    expect(data.goodsShipment.insuranceCharges).toEqual({ insuranceAmount: 83.83, insuranceCurrency: 'GBP' });
  });

  test('CFR: solo el seguro; CIF: nada', () => {
    const cfr = h1Generator.generate(conGastos('CFR'), {}, { tenant: TENANT, cambio: USD, cambiosGastos: { GBP } }).data;
    expect(cfr.valuation.additions.freightToEU).toBe(0);
    expect(cfr.valuation.customsValue).toBeCloseTo(9001.56, 2);

    const cif = h1Generator.generate(conGastos('CIF'), {}, { tenant: TENANT, cambio: USD, cambiosGastos: { GBP } }).data;
    expect(cif.valuation.customsValue).toBe(8901.55);
  });

  test('sin el tipo de la divisa del seguro la vista previa no lo toma como euros', () => {
    const { data } = h1Generator.generate(conGastos('FOB'), {}, { tenant: TENANT, cambio: USD });
    expect(data.valuation.additions.insuranceToEU).toBe(0);
    expect(data.valuation.additions.freightToEU).toBe(1000);
  });
});
