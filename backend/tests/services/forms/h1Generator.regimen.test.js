/**
 * h1Generator (vista previa): el régimen sale del expediente con su precedente
 * y su descripción oficial (config/regimenesH1), no siempre «40.00».
 */
const h1Generator = require('../../../src/services/forms/h1Generator');

const TENANT = { name: 'Agencia Test SL', customsConfig: { eoriNumbers: { ES: 'ESA00000001' } } };

function expediente(declaration) {
  return {
    client: {
      nif: 'B22477020', eori: 'ESB22477020', companyName: 'Cliente Test',
      address: { street: 'Calle Test 1', city: 'Barcelona', postalCode: '08001' }, contact: { name: 'Contacto' }
    },
    exporter: { companyName: 'Shenzhen Ltd', country: 'CN' },
    incoterm: { code: 'CIF', place: 'Barcelona' },
    goodsSummary: { totalPackages: 10, totalGrossWeight: 100, totalValue: 10000 },
    transport: { arrivalPort: 'BARCELONA', departurePort: 'SHANGHAI' },
    declaration,
    goods: [{
      hsCode: '851830', taricCode: '8518300090', description: 'Auriculares', invoiceValue: 10000, currency: 'EUR',
      grossWeight: 100, netWeight: 95, packages: { quantity: 10, type: 'CT', marks: 'S/M' }, dutyRate: 0
    }]
  };
}

describe('h1Generator: régimen de la vista previa', () => {
  test('sin precedente guardado: 40.00 con su descripción oficial', () => {
    const { data } = h1Generator.generate(expediente({ regime: '40' }), {}, { tenant: TENANT });
    expect(data.goodsItems[0]).toMatchObject({
      requestedProcedure: '40', previousProcedure: '00',
      procedureDescription: 'Despacho a libre práctica con despacho simultáneo a consumo de mercancías'
    });
  });

  test('con el precedente elegido en «Datos para presentar el H1» (40.71)', () => {
    const { data } = h1Generator.generate(expediente({ regime: '40', previousRegime: '71' }), { regime: '40' }, { tenant: TENANT });
    expect(data.goodsItems[0].previousProcedure).toBe('71');
    expect(data.goodsItems[0].procedureDescription).toMatch(/procedente de depósito aduanero$/);
  });

  test('el régimen adicional elegido va con su descripción', () => {
    const { data } = h1Generator.generate(expediente({ regime: '40', additionalProcedure: 'C08' }), {}, { tenant: TENANT });
    expect(data.goodsItems[0]).toMatchObject({ additionalProcedure: 'C08', additionalProcedureDescription: 'Envíos de particular a particular.' });
  });
});
