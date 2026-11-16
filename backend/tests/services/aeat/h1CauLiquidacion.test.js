/**
 * Lo que LUCI declaró en el mensaje CC415A frente a lo que liquida la AEAT,
 * partida por partida y tributo por tributo.
 */
const { liquidacionDeclarada, compararLiquidacion } = require('../../../src/services/aeat/h1CauLiquidacion');

const partidaXml = (n, a00, b00) => `<GoodsShipmentItem><sequenceNumber>${n}</sequenceNumber><Commodity><CalculationOfTaxes><preference>100</preference>
<DutiesAndTaxes><sequenceNumber>1</sequenceNumber><taxType>A00</taxType><methodOfPayment>A</methodOfPayment><TaxBase><sequenceNumber>1</sequenceNumber><taxRate>12</taxRate><amount>${a00[0]}</amount><taxAmount>${a00[1]}</taxAmount></TaxBase></DutiesAndTaxes>
<DutiesAndTaxes><sequenceNumber>2</sequenceNumber><taxType>B00</taxType><methodOfPayment>A</methodOfPayment><TaxBase><sequenceNumber>1</sequenceNumber><taxRate>21</taxRate><amount>${b00[0]}</amount><taxAmount>${b00[1]}</taxAmount></TaxBase></DutiesAndTaxes>
</CalculationOfTaxes></Commodity></GoodsShipmentItem>`;
const mensaje = (...partidas) => `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><es:CC415AV1Ent xmlns:es="x"><CC415A><GoodsShipment>${partidas.join('')}</GoodsShipment></CC415A></es:CC415AV1Ent></soapenv:Body></soapenv:Envelope>`;

const aeat = (partidas, total) => ({
  totalAPagar: total,
  partidas: partidas.map(([numero, a00, b00]) => ({ numero, tributos: [
    { tipo: 'A00', bases: [{ importe: a00[0], cuota: a00[1] }] },
    { tipo: 'B00', bases: [{ importe: b00[0], cuota: b00[1] }] }
  ] }))
});

describe('liquidación declarada por LUCI', () => {
  test('sale del XML enviado: bases y cuotas de cada tributo de cada partida', () => {
    expect(liquidacionDeclarada(mensaje(partidaXml(1, [9951.55, 1194.19], [11145.74, 2340.61])))).toEqual({
      total: 3534.8,
      partidas: [{ numero: 1, tributos: [{ tipo: 'A00', base: 9951.55, cuota: 1194.19 }, { tipo: 'B00', base: 11145.74, cuota: 2340.61 }] }]
    });
  });

  test('sin XML o con un XML que no es el del H1, nada', () => {
    expect(liquidacionDeclarada(undefined)).toBeNull();
    expect(liquidacionDeclarada('<a/>')).toBeNull();
    expect(liquidacionDeclarada('no es xml <')).toBeNull();
  });
});

describe('LUCI frente a la AEAT', () => {
  const luci = liquidacionDeclarada(mensaje(
    partidaXml(1, [9951.55, 1194.19], [11145.74, 2340.61]),
    partidaXml(2, [1000, 120], [1120, 235.2])
  ));

  test('si todo coincide al céntimo lo dice', () => {
    const c = compararLiquidacion(luci, aeat([[1, [9951.55, 1194.19], [11145.74, 2340.61]], [2, [1000, 120], [1120, 235.2]]], 3890));
    expect(c).toMatchObject({ cuadra: true, totalLuci: 3890, totalAeat: 3890, diferencia: 0 });
    expect(c.partidas[0].tributos[0]).toEqual({ tipo: 'A00', luci: { base: 9951.55, cuota: 1194.19 }, aeat: { base: 9951.55, cuota: 1194.19 }, diferencia: 0 });
  });

  test('señala el tributo y la partida que no cuadran y la diferencia (AEAT − LUCI)', () => {
    const c = compararLiquidacion(luci, aeat([[1, [10051.55, 1206.19], [11257.74, 2364.13]], [2, [1000, 120], [1120, 235.2]]], 3925.52));
    expect(c.cuadra).toBe(false);
    expect(c.diferencia).toBe(35.52);
    expect(c.partidas[0].tributos.map((t) => t.diferencia)).toEqual([12, 23.52]);
    expect(c.partidas[1].tributos.map((t) => t.diferencia)).toEqual([0, 0]);
  });

  test('un tributo que solo liquida la AEAT (o solo declara LUCI) también es una diferencia', () => {
    const conAntidumping = aeat([[1, [9951.55, 1194.19], [11145.74, 2340.61]], [2, [1000, 120], [1120, 235.2]]], 3990);
    conAntidumping.partidas[0].tributos.push({ tipo: 'A30', bases: [{ importe: 9951.55, cuota: 100 }] });

    const c = compararLiquidacion(luci, conAntidumping);

    expect(c.cuadra).toBe(false);
    expect(c.partidas[0].tributos[2]).toEqual({ tipo: 'A30', luci: null, aeat: { base: 9951.55, cuota: 100 }, diferencia: 100 });
  });

  test('sin liquidación de la AEAT (predeclaración) o sin lo declarado no se compara', () => {
    expect(compararLiquidacion(luci, null)).toBeNull();
    expect(compararLiquidacion(null, aeat([], 0))).toBeNull();
    expect(compararLiquidacion(luci, { totalAPagar: 10 })).toBeNull();
  });
});

describe('liquidación declarada de un H1 DAP con deducción BA (caso real de PRE, 16/11/2026)', () => {
  const fs = require('fs');
  const path = require('path');
  const { expeditionToH1CauData } = require('../../../src/services/aeat/h1CauData');
  const { buildH1CauXML } = require('../../../src/services/aeat/h1CauXmlBuilder');
  const { interpretarRespuestaH1Cau } = require('../../../src/services/aeat/h1CauResponse');
  const RESPUESTA_PRE = fs.readFileSync(path.join(__dirname, '../../fixtures/aeat-cau/dap-ba-respuesta-real-002801.xml'), 'utf8');

  // El expediente que se presentó en PRE (presentar-dap-ba.js): DAP Madrid, 10.000 EUR, BA 1.000 EUR, 12 % y 21 %.
  const expedition = {
    expeditionId: 'QA-CAU-DAP-BA', transportMode: 'maritime',
    client: { companyName: 'Importadora SL', eori: 'ESB22477020', address: { postalCode: '28001', country: 'ES' } },
    exporter: { companyName: 'Exportador', eori: 'ESB22477020', country: 'CN' },
    representative: { representationType: 'indirect' },
    incoterm: { code: 'DAP', place: 'Madrid' },
    costs: { freightAfterEntry: { amount: 1000, currency: 'EUR' } },
    transport: {
      vehicleNationality: 'PA', documentType: 'BL', documentNumber: 'QACLAUDE0000001',
      summaryDeclaration: { item: '1', aeat: { mrn: '26ES00280180000014', location: '2801AAAAAA' } }
    },
    declaration: { lrn: 'LUCI261116104035037', invoiceNumber: 'QA-FAC-DAP-BA' },
    goods: [{ taricCode: '6302100000', originCountry: 'CN', grossWeight: 100, netWeight: 90, invoiceValue: 10000, currency: 'EUR', dutyRate: 12, vatRate: 21, packages: { quantity: 10, type: 'CT' } }]
  };
  const declarada = () => liquidacionDeclarada(buildH1CauXML(expeditionToH1CauData(expedition, {
    declarante: { eori: 'ESB22477020', representationType: 'indirect', contact: { name: 'A', phone: '1', email: 'a@b.es' } }, mensajeId: 'LUCI261116104035037'
  })));

  test('la base del arancel y la del IVA llevan restado el transporte interior, como liquida la AEAT', () => {
    // A00: 10.000 − 1.000 = 9.000 al 12 % = 1.080. B00: 9.000 + 1.080 = 10.080 al 21 % = 2.116,80.
    expect(declarada().partidas[0].tributos).toEqual([
      { tipo: 'A00', base: 9000, cuota: 1080 },
      { tipo: 'B00', base: 10080, cuota: 2116.8 }
    ]);
    expect(declarada().total).toBe(3196.8);
  });

  test('cuadra con la liquidación real de la AEAT en PRE (MRN 26ES002801I01BQ0R1)', () => {
    const aeat = interpretarRespuestaH1Cau(RESPUESTA_PRE);
    expect(aeat.mrn).toBe('26ES002801I01BQ0R1');
    expect(compararLiquidacion(declarada(), aeat.liquidacion)).toMatchObject({ cuadra: true, totalLuci: 3196.8, totalAeat: 3196.8, diferencia: 0 });
  });
});
