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
