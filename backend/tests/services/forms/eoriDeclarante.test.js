/**
 * H1, AES y H7: el declarante sale del representante del expediente o del
 * tenant; el cliente aporta su EORI. Sin ellos: 422 y no hay XML.
 */
const { createElectronicsExpedition } = require('../../fixtures/h1TestData');
const h1 = require('../../../src/services/forms/h1Generator');
const aes = require('../../../src/services/forms/aesGenerator');
const h7 = require('../../../src/services/forms/h7Generator');
const { ErrorValidacion } = require('../../../src/services/forms/identificadorAduanero');

const TENANT = {
  name: 'Agencia Uno SL',
  customsConfig: { eoriNumbers: { ES: 'ESA11111111' } },
  primaryContact: { name: 'Ana', email: 'ana@x.es' }
};
const completa = (extra = {}) => ({
  ...createElectronicsExpedition(),
  goodsSummary: { totalItems: 1, totalPackages: 2, totalGrossWeight: 10, totalNetWeight: 9, totalValue: 100 },
  ...extra
});
const sinRep = (extra = {}) => completa({ representative: undefined, ...extra });

const generadores = {
  H1: (e, ctx) => h1.generate(e, {}, ctx),
  AES: (e, ctx) => aes.generate(e, {}, ctx),
  H7: (e, ctx) => h7.generate(e, { forceGenerate: true }, ctx)
};

describe.each(Object.keys(generadores))('%s: declarante', (tipo) => {
  const gen = generadores[tipo];

  test('con representante con EORI lo usa y no necesita tenant', () => {
    const r = gen(completa({ representative: { eori: 'ESREP0001', companyName: 'Rep SL' } }), {});
    expect(r.xml).toContain('ESREP0001');
    expect(r.xml).not.toMatch(/ESundefined|ESnull|STRIX AI SL|Departamento Aduanas/);
  });

  test('sin representante usa el EORI y el nombre del tenant', () => {
    const r = gen(sinRep(), { tenant: TENANT });
    expect(r.xml).toContain('ESA11111111');
    expect(r.xml).toContain('Agencia Uno SL');
    expect(r.xml).not.toMatch(/ESundefined|ESnull|STRIX AI SL|Departamento Aduanas|B12345678/);
  });

  test('sin representante y sin tenant: 422 y no hay XML', () => {
    let e;
    try { gen(sinRep(), {}); } catch (x) { e = x; }
    expect(e).toBeInstanceOf(ErrorValidacion);
    expect(e.status).toBe(422);
    expect(e.message).toBe('Falta el EORI del representante: configúralo en Ajustes > Aduanas');
  });

  test('tenant sin EORI configurado: 422', () => {
    expect(() => gen(sinRep(), { tenant: { name: 'X' } })).toThrow(ErrorValidacion);
  });

  test('tenant con EORI pero sin nombre: 422 del nombre', () => {
    const t = { customsConfig: { eoriNumbers: { ES: 'ESA11111111' } } };
    expect(() => gen(sinRep(), { tenant: t })).toThrow(/nombre del representante/);
  });
});

describe.each(['H1', 'AES'])('%s: cliente', (tipo) => {
  const gen = generadores[tipo];
  test('cliente sin EORI ni NIF: 422 "del cliente"', () => {
    const e = completa({ client: { companyName: 'Cliente SL' } });
    let err;
    try { gen(e, { tenant: TENANT }); } catch (x) { err = x; }
    expect(err.status).toBe(422);
    expect(err.message).toBe('Falta el EORI del cliente: complétalo en la ficha del cliente');
  });
  test('cliente con solo NIF compone ES+NIF', () => {
    const e = completa({ client: { ...completa().client, eori: undefined, nif: 'B55555555' } });
    expect(gen(e, { tenant: TENANT }).xml).toContain('ESB55555555');
  });
});
