/**
 * Casilla 41 del H1: la AEAT exige el codigo de unidad del Anexo IX de la
 * Resolucion del DUA (dos caracteres), no el codigo TARIC. Con 'NAR' rechazaba
 * la declaracion (error 2019) para la 8471 30, la del caso H1-01 de la UAT.
 */
const { codigoUnidadDua } = require('../../../src/services/aeat/unidadesSuplementarias');
const { buildH1ImportXML, expeditionToH1Data } = require('../../../src/services/aeat/h1XmlBuilder');

describe('codigoUnidadDua', () => {
  test('numero de articulos del TARIC (NAR, p/st) es UN en el DUA', () => {
    expect(codigoUnidadDua('NAR')).toBe('UN');
    expect(codigoUnidadDua('p/st')).toBe('UN');
    expect(codigoUnidadDua(' nar ')).toBe('UN');
  });

  test('traduce las unidades mas habituales', () => {
    expect(codigoUnidadDua('NPR')).toBe('PA');
    expect(codigoUnidadDua('MTK')).toBe('M2');
    expect(codigoUnidadDua('MTQ')).toBe('M3');
    expect(codigoUnidadDua('MTR')).toBe('M1');
    expect(codigoUnidadDua('LTR')).toBe('LT');
    expect(codigoUnidadDua('HLT')).toBe('HL');
    expect(codigoUnidadDua('MIL')).toBe('MI');
    expect(codigoUnidadDua('TNE')).toBe('TN');
  });

  test('un codigo que ya es del DUA se respeta', () => {
    expect(codigoUnidadDua('UN')).toBe('UN');
    expect(codigoUnidadDua('m2')).toBe('M2');
    expect(codigoUnidadDua('W5')).toBe('W5');
  });

  test('un codigo desconocido se devuelve tal cual, sin inventar una unidad', () => {
    expect(codigoUnidadDua('XYZ')).toBe('XYZ');
  });

  test('sin codigo devuelve null', () => {
    expect(codigoUnidadDua('')).toBeNull();
    expect(codigoUnidadDua(null)).toBeNull();
    expect(codigoUnidadDua(undefined)).toBeNull();
  });
});

describe('H1 hacia la AEAT — casilla 41', () => {
  const declarante = { eori: 'ESB22477020', companyName: 'STRIX AI SL', contact: { email: 'x@y.es' } };
  const expediente = (good) => ({
    expeditionId: 'EXP-2026-C41', transportMode: 'sea',
    client: { companyName: 'Importadora Levante SL', nif: 'B12345674', taxId: 'B12345674', address: { street: 'Calle Mayor 1', city: 'Valencia', postalCode: '46001' } },
    exporter: { companyName: 'Shenzhen Tech Ltd', country: 'CN' },
    declaration: { regime: '40', preference: '100', customsOffice: 'ES002801' }, transport: {},
    goods: [{ description: 'Ordenadores portatiles', taricCode: '8471300000', originCountry: 'CN', grossWeight: 1050, netWeight: 980, invoiceValue: 184800, ...good }]
  });
  const xmlDe = (good) => buildH1ImportXML({ ...expeditionToH1Data(expediente(good), { declarante }), test: true });

  test('portatiles declarados en piezas: UN y la cantidad, no NAR', () => {
    const x = xmlDe({ quantity: 500, unit: 'NAR' });

    expect(x).toContain('<C41UnidadesCodigo>UN</C41UnidadesCodigo>');
    expect(x).toContain('<C41UnidadesNumero>500.000</C41UnidadesNumero>');
    expect(x).not.toContain('NAR');
  });

  test('la unidad suplementaria del catalogo TARIC tambien se traduce', () => {
    const x = xmlDe({ supplementaryUnits: 120, supplementaryUnitType: 'MTK' });

    expect(x).toContain('<C41UnidadesCodigo>M2</C41UnidadesCodigo>');
    expect(x).toContain('<C41UnidadesNumero>120.000</C41UnidadesNumero>');
  });

  test('sin unidades suplementarias la casilla 41 no se declara', () => {
    expect(xmlDe({ quantity: 1050, unit: 'KG' })).not.toContain('C41UnidadesSuplementarias');
  });
});
