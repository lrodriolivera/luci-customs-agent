jest.mock('../../../src/services/divisas/tiposCambioOficiales', () => ({
  tipoOficial: jest.fn(),
  aEuros: jest.requireActual('../../../src/services/divisas/tipoCambioAduanero').aEuros
}));

const { tipoOficial } = require('../../../src/services/divisas/tiposCambioOficiales');
const {
  divisaDelExpediente, cambioDelExpediente, cambioObligatorio
} = require('../../../src/services/divisas/cambioDelExpediente');

const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaReferencia: '2026-10-21', fechaPublicacion: '2026-10-21', fuente: 'BCE' };

describe('divisa del expediente', () => {
  test('sin divisa en las partidas es EUR', () => {
    expect(divisaDelExpediente({ goods: [{ invoiceValue: 10 }, { invoiceValue: 5, currency: 'eur' }] })).toBe('EUR');
    expect(divisaDelExpediente({})).toBe('EUR');
  });

  test('toma la divisa común de las partidas', () => {
    expect(divisaDelExpediente({ goods: [{ currency: 'USD' }, { currency: 'usd ' }] })).toBe('USD');
  });

  test('con divisas distintas no se puede declarar (422)', () => {
    expect.assertions(3);
    try {
      divisaDelExpediente({ goods: [{ currency: 'USD' }, { currency: 'GBP' }] });
    } catch (error) {
      expect(error.status).toBe(422);
      expect(error.code).toBe('DIVISAS_MEZCLADAS');
      expect(error.message).toContain('USD, GBP');
    }
  });
});

describe('cambio del expediente', () => {
  beforeEach(() => tipoOficial.mockReset());

  test('en euros no consulta el tipo', async () => {
    expect(await cambioDelExpediente({ goods: [{ currency: 'EUR' }] })).toEqual({ divisa: 'EUR', tipo: 1 });
    expect(tipoOficial).not.toHaveBeenCalled();
  });

  test('en dólares devuelve el tipo oficial del mes', async () => {
    tipoOficial.mockResolvedValue(USD);
    expect(await cambioDelExpediente({ goods: [{ currency: 'USD' }] })).toEqual(USD);
    expect(tipoOficial).toHaveBeenCalledWith('USD', {});
  });

  test('una divisa sin tipo oficial obliga a declarar en euros (422)', async () => {
    tipoOficial.mockResolvedValue(null);
    await expect(cambioDelExpediente({ goods: [{ currency: 'ARS' }] })).rejects.toMatchObject({
      status: 422, code: 'DIVISA_SIN_TIPO_OFICIAL'
    });
  });
});

describe('cambio obligatorio al construir el H1', () => {
  test('un expediente en euros no necesita tipo', () => {
    expect(cambioObligatorio({ goods: [{}] })).toEqual({ divisa: 'EUR', tipo: 1 });
  });

  test('en otra divisa exige el tipo de esa misma divisa', () => {
    const expediente = { goods: [{ currency: 'USD' }] };
    expect(cambioObligatorio(expediente, USD)).toBe(USD);
    expect(() => cambioObligatorio(expediente)).toThrow('USD');
    expect(() => cambioObligatorio(expediente, { divisa: 'GBP', tipo: 0.84 })).toThrow('USD');
    expect(() => cambioObligatorio(expediente, { divisa: 'USD', tipo: 0 })).toThrow('USD');
  });
});
