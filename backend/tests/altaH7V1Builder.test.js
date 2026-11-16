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
    emailDespacho: 'despacho@strixai.ai',
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

// ---------------------------------------------------------------------------
// Rechazos reales de la AEAT en PRE (16/Nov/2026), guía H7 v3.23
// ---------------------------------------------------------------------------
describe('buildAltaH7V1XML — commodityCode de 8 cifras (error 2101)', () => {
  it('recorta un TARIC de 10 cifras a las 8 de la NC', () => {
    const xml = buildAltaH7V1XML(minimalData({ partidas: [
      { descripcion: 'Libro', taricCode: '4901990000', valorFactura: 10, pesobruto: 0.3, bultos: 1,
        identificadorComercial: 'SKU-1', referenciaFabricante: 'REF-1' }
    ]}));
    expect(xml).toMatch(/<commodityCode>49019900<\/commodityCode>/);
  });

  it('lanza un error claro si el código tiene menos de 8 cifras', () => {
    expect(() => buildAltaH7V1XML(minimalData({ partidas: [
      { descripcion: 'Libro', taricCode: '490199', valorFactura: 10, pesobruto: 0.3 }
    ]}))).toThrow(/Partida 1.*8 cifras/);
  });
});

describe('buildAltaH7V1XML — identificadores de producto por partida (error 1353)', () => {
  const conIds = (extra = {}) => minimalData({ additionalProcedureCode: 'F53', partidas: [{
    descripcion: 'Libro', taricCode: '49019900', valorFactura: 10, pesobruto: 0.3, bultos: 1,
    identificadorComercial: 'SKU-LIBRO-1', referenciaFabricante: 'EDT-77', ...extra
  }]});
  const goodsItem = (xml) => xml.match(/<GoodsItem>[\s\S]*<\/GoodsItem>/)[0];

  it('emite C127 y C128 como SupportingDocument de la partida, tras numberOfPackages', () => {
    const gi = goodsItem(buildAltaH7V1XML(conIds()));
    expect(gi).toMatch(/<numberOfPackages>1<\/numberOfPackages>\s*<SupportingDocument>\s*<suppDoctype>C127<\/suppDoctype>\s*<suppDoctRefNum>SKU-LIBRO-1<\/suppDoctRefNum>\s*<\/SupportingDocument>\s*<SupportingDocument>\s*<suppDoctype>C128<\/suppDoctype>\s*<suppDoctRefNum>EDT-77<\/suppDoctRefNum>/);
  });

  it('sin C129 envía Y081 como AdditionalReference (con addRefNum) después de los documentos', () => {
    const gi = goodsItem(buildAltaH7V1XML(conIds()));
    expect(gi).not.toMatch(/C129/);
    expect(gi).toMatch(/<\/SupportingDocument>\s*<AdditionalReference>\s*<addRefType>Y081<\/addRefType>\s*<addRefNum>[^<]+<\/addRefNum>\s*<\/AdditionalReference>\s*<\/GoodsItem>/);
  });

  it('con C129 lo envía como SupportingDocument y no envía Y081', () => {
    const gi = goodsItem(buildAltaH7V1XML(conIds({ codigoNormalizado: '9788420412146' })));
    expect(gi).toMatch(/<suppDoctype>C129<\/suppDoctype>\s*<suppDoctRefNum>9788420412146<\/suppDoctRefNum>/);
    expect(gi).not.toMatch(/Y081/);
    expect(gi).not.toMatch(/AdditionalReference/);
  });

  it('no declara C127/C128/C129/Y081 en cabecera (C321, desde 15/03/2027 prohibido)', () => {
    const xml = buildAltaH7V1XML(conIds());
    const cabecera = xml.split('<GoodsItem>')[0];
    expect(cabecera).not.toMatch(/C127|C128|C129|Y081/);
  });

  it('solo C129 (sin C127/C128) no emite Y081 aunque un valor contenga "C127"', () => {
    const gi = goodsItem(buildAltaH7V1XML(conIds({ identificadorComercial: '', referenciaFabricante: '', codigoNormalizado: 'C127' })));
    expect(gi).not.toMatch(/Y081/);
  });

  it('escapa los caracteres especiales de los identificadores', () => {
    const gi = goodsItem(buildAltaH7V1XML(conIds({ identificadorComercial: 'A&B<1>' })));
    expect(gi).toMatch(/<suppDoctRefNum>A&amp;B&lt;1&gt;<\/suppDoctRefNum>/);
  });
});

describe('buildAltaH7V1XML — IOSS (F48, error 1306)', () => {
  it('emite AdditionalFiscalRef con VATId y después Role, entre referenceNumberUCR y AdditionalProcedure', () => {
    const xml = buildAltaH7V1XML(minimalData({ iossNumber: 'IM1234567890' }));
    expect(xml).not.toMatch(/AdditionalFiscalReference/);
    expect(xml).toMatch(/<\/referenceNumberUCR>\s*<AdditionalFiscalRef>\s*<additionalFiscalRefVATId>IM1234567890<\/additionalFiscalRefVATId>\s*<additionalFiscalRefRole>FR5<\/additionalFiscalRefRole>\s*<\/AdditionalFiscalRef>\s*<AdditionalProcedure>/);
  });

  it('sin IOSS no emite AdditionalFiscalRef', () => {
    expect(buildAltaH7V1XML(minimalData())).not.toMatch(/AdditionalFiscalRef/);
  });
});
