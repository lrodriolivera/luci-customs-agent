/**
 * Builder del mensaje AltaH7V1Ent (esquema oficial EUCDM de la AEAT para H7).
 * Estructura tomada del ejemplo de la Guía Servicios Web H7 V3.17/3.21.
 *
 * Clave: en el mensaje de ENTRADA NO se declaran tributos (A00/B00). El derecho
 * fijo de 3 EUR/artículo (Reg. 2026/382) lo LIQUIDA la AEAT y lo devuelve en el
 * mensaje de salida (AltaH7V1Sal). Enviar A00 en la entrada provoca el error 20009.
 */
const { buildAltaH7V1XML } = require('../src/services/aeat/h7XmlBuilder');

function minimalData(overrides = {}) {
  return {
    test: true,
    supervisingCustomsOffice: 'ES002801',
    declaranteNIF: '89890001K',
    declaranteNombre: 'STRIX AI SL',
    emailDespacho: 'despacho@strixai.es',
    representanteStatus: '2',
    exportador: { name: 'Shenzhen Global Trading Co Ltd', city: 'Shenzhen', country: 'CN', street: '88 Nanshan', postcode: '518000' },
    importador: { name: 'Maria Garcia Lopez', nid: '12345678Z', city: 'Madrid', country: 'ES', street: 'Calle Alcala 200', postcode: '28028', naturalPerson: 'S', phone: '34600000000' },
    additionalProcedureCode: 'F48',
    partidas: [
      { descripcion: 'Organizador de plastico', taricCode: '39269097', valorFactura: 45, pesobruto: 0.35, bultos: 1 }
    ],
    ...overrides
  };
}

describe('buildAltaH7V1XML — esquema oficial AltaH7V1Ent', () => {
  it('usa el elemento raíz AltaH7V1Ent con su namespace', () => {
    const xml = buildAltaH7V1XML(minimalData());
    expect(xml).toMatch(/AltaH7V1Ent/);
    expect(xml).toMatch(/AltaH7V1Ent\.xsd/);
  });

  it('el mensaje de ENTRADA NO declara tributos (sin CalculationOfTaxes ni taxType A00/B00)', () => {
    const xml = buildAltaH7V1XML(minimalData());
    expect(xml).not.toMatch(/CalculationOfTaxes/);
    expect(xml).not.toMatch(/<taxType>/);
    expect(xml).not.toMatch(/A00/);
  });

  it('testIndicator es S en test y N en producción', () => {
    expect(buildAltaH7V1XML(minimalData({ test: true }))).toMatch(/<testIndicator>S<\/testIndicator>/);
    expect(buildAltaH7V1XML(minimalData({ test: false }))).toMatch(/<testIndicator>N<\/testIndicator>/);
  });

  it('incluye Declarant, Exporter e Importer con sus identificadores', () => {
    const xml = buildAltaH7V1XML(minimalData());
    expect(xml).toMatch(/<Declarant>[\s\S]*<identificationNumber>89890001K<\/identificationNumber>/);
    expect(xml).toMatch(/<Exporter>[\s\S]*Shenzhen Global Trading/);
    expect(xml).toMatch(/<Importer>[\s\S]*<identificationNumber>12345678Z<\/identificationNumber>/);
    expect(xml).toMatch(/<naturalPerson>S<\/naturalPerson>/);
  });

  it('cada partida es un GoodsItem con Value, Commodity y numberOfPackages', () => {
    const xml = buildAltaH7V1XML(minimalData());
    expect(xml).toMatch(/<GoodsItem>\s*<declarationGoodsItemNumber>1<\/declarationGoodsItemNumber>/);
    expect(xml).toMatch(/<Value>\s*<amount>45<\/amount>\s*<currencyCode>EUR<\/currencyCode>\s*<\/Value>/);
    expect(xml).toMatch(/<commodityCode>39269097<\/commodityCode>/);
    expect(xml).toMatch(/<numberOfPackages>1<\/numberOfPackages>/);
  });

  it('emite TransportDocument (obligatorio; por defecto G4 5025)', () => {
    const xml = buildAltaH7V1XML(minimalData());
    expect(xml).toMatch(/<TransportDocument>\s*<transportDocType>5025<\/transportDocType>/);
  });

  it('usa el TransportDocument explícito si viene', () => {
    const xml = buildAltaH7V1XML(minimalData({ transporte: { tipo: 'N740', referencia: 'AWB-123' } }));
    expect(xml).toMatch(/<transportDocType>N740<\/transportDocType>\s*<transportDocRefNum>AWB-123<\/transportDocRefNum>/);
  });

  it('supervisingCustomsOffice se emite como ES + oficina', () => {
    const xml = buildAltaH7V1XML(minimalData());
    expect(xml).toMatch(/<supervisingCustomsOffice>ES002801<\/supervisingCustomsOffice>/);
  });

  it('emite el AdditionalProcedureCode indicado', () => {
    const xml = buildAltaH7V1XML(minimalData({ additionalProcedureCode: 'F49' }));
    expect(xml).toMatch(/<additionalProcedureCode>F49<\/additionalProcedureCode>/);
  });

  it('dos partidas generan dos GoodsItem numerados 1 y 2', () => {
    const xml = buildAltaH7V1XML(minimalData({ partidas: [
      { descripcion: 'A', taricCode: '39269097', valorFactura: 10, pesobruto: 0.1, bultos: 1 },
      { descripcion: 'B', taricCode: '39269097', valorFactura: 20, pesobruto: 0.2, bultos: 1 }
    ]}));
    expect(xml).toMatch(/<declarationGoodsItemNumber>1<\/declarationGoodsItemNumber>/);
    expect(xml).toMatch(/<declarationGoodsItemNumber>2<\/declarationGoodsItemNumber>/);
  });
});
