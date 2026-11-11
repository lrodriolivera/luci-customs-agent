/**
 * Forma de representacion del declarante (casilla 14 del DUA).
 *
 * Resolucion del DUA (BOE-A-2014-7683), casilla 14, «Forma de representacion»:
 *   1 autodespacho · 2 representacion directa · 3 representacion indirecta.
 *
 * UAT 10/Nov/2026 (tarjeta H1-01): el H1 que se enviaba a la AEAT llevaba
 * siempre «1», fuese quien fuese el declarante.
 */
const { formaRepresentacionDe, declarantePara } = require('../../../src/services/forms/identificadorAduanero');
const { expeditionToH1Data, buildH1ImportXML } = require('../../../src/services/aeat/h1XmlBuilder');

const TENANT = { companyName: 'Agencia de Aduanas SL', customsConfig: { eoriNumbers: { ES: 'ESB22477020' } } };
const expediente = (extra = {}) => ({
  expeditionId: 'EXP-1',
  transportMode: 'maritime',
  client: { companyName: 'Importadora SL', nif: 'B12345674', eori: 'ESB12345674', address: { street: 'Calle 1', city: 'Valencia', postalCode: '46001' }, contact: { email: 'c@d.es' } },
  exporter: { companyName: 'Shenzhen Ltd', eori: 'CN123', address: 'Road 1', city: 'Shenzhen', country: 'CN' },
  goods: [{ description: 'Portatiles', taricCode: '8471300000', originCountry: 'CN', invoiceValue: 1000, grossWeight: 10, netWeight: 9, packages: { quantity: 1, type: 'CT' } }],
  incoterm: { code: 'CIF' },
  ...extra
});

describe('formaRepresentacionDe', () => {
  test('representacion directa -> 2', () => {
    expect(formaRepresentacionDe({ eori: 'ESB22477020', representationType: 'direct' }, { eori: 'ESB12345674' })).toBe('2');
  });

  test('representacion indirecta -> 3', () => {
    expect(formaRepresentacionDe({ eori: 'ESB22477020', representationType: 'indirect' }, { eori: 'ESB12345674' })).toBe('3');
  });

  test('sin tipo indicado se declara indirecta: es la que hace responsable al representante', () => {
    expect(formaRepresentacionDe({ eori: 'ESB22477020' }, { eori: 'ESB12345674' })).toBe('3');
  });

  test('el declarante es el propio importador -> 1 (autodespacho), diga lo que diga el tipo', () => {
    expect(formaRepresentacionDe({ eori: 'ESB12345674', representationType: 'direct' }, { eori: 'ESB12345674' })).toBe('1');
    expect(formaRepresentacionDe({ eori: 'ESB12345674', representationType: 'indirect' }, { nif: 'b12345674' })).toBe('1');
    expect(formaRepresentacionDe({ eori: 'B12345674' }, { eori: 'ES B-12345674' })).toBe('1');
  });

  test('sin identificacion del importador no se da por hecho el autodespacho', () => {
    expect(formaRepresentacionDe({ eori: 'ESB22477020', representationType: 'direct' }, {})).toBe('2');
    expect(formaRepresentacionDe({ eori: '', representationType: 'direct' }, { eori: '' })).toBe('2');
  });
});

describe('declarantePara — tipo de representacion', () => {
  test('el tipo elegido en el expediente manda aunque el EORI salga del tenant', () => {
    const d = declarantePara(expediente({ representative: { representationType: 'direct' } }), TENANT);
    expect(d.eori).toBe('ESB22477020');
    expect(d.representationType).toBe('direct');
  });

  test('sin tipo en el expediente, el del tenant (indirecta)', () => {
    expect(declarantePara(expediente(), TENANT).representationType).toBe('indirect');
  });
});

describe('H1 que se envia a la AEAT', () => {
  const xmlDe = (exp, tenant = TENANT) => buildH1ImportXML(expeditionToH1Data(exp, { declarante: declarantePara(exp, tenant) }));
  const forma = (xml) => /<C14DeclaranteFormaRepresentacion>([^<]*)</.exec(xml)[1];

  test('representacion directa elegida en el expediente -> casilla 14 con 2', () => {
    const xml = xmlDe(expediente({ representative: { representationType: 'direct' } }));
    expect(forma(xml)).toBe('2');
    expect(xml).toContain('<C14DeclaranteTipoAutorizaDespacho>O</C14DeclaranteTipoAutorizaDespacho>');
  });

  test('sin elegir -> representacion indirecta (3), no autodespacho', () => {
    expect(forma(xmlDe(expediente()))).toBe('3');
  });

  test('el declarante es el importador -> 1 y sin autorizacion de despacho', () => {
    const propio = { companyName: 'Importadora SL', customsConfig: { eoriNumbers: { ES: 'ESB12345674' } } };
    const xml = xmlDe(expediente(), propio);
    expect(forma(xml)).toBe('1');
    expect(xml).not.toContain('C14DeclaranteTipoAutorizaDespacho');
  });
});
