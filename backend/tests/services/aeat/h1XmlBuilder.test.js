/**
 * h1XmlBuilder: construccion del XML del DUA de importacion (H1) para la AEAT.
 *
 * Es un generador PURO —sin BD ni red—: dado un objeto de datos, escupe el XML
 * SOAP que se presenta a la AEAT. Aqui esta el mayor riesgo regulatorio del
 * producto: una etiqueta mal puesta, un tributo que no se emite o un codigo
 * adicional incompatible tumba la declaracion (errores 2077 y compania, ya
 * vistos en PRE). Se prueban las ramas condicionales que deciden que sale y que
 * no en el XML, y el mapeo desde el expediente LUCI.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildH1ImportXML, expeditionToH1Data: expeditionToH1DataReal, NS_ENT, NS_SOAP } = require('../../../src/services/aeat/h1XmlBuilder');

// Sin identificacion/direccion del exportador ni declarante resuelto no se
// construye el SOAP (422): estos tests de mapeo parten de un expediente valido.
const DECLARANTE = { eori: 'ESA11111111', companyName: 'Agencia SL', contact: {} };
const EXPORTADOR = { eori: 'CN000000001', companyName: 'Shenzhen Co', address: 'Calle 1', city: 'Shenzhen', country: 'CN' };
const expeditionToH1Data = (e, ctx = { declarante: DECLARANTE }) =>
  expeditionToH1DataReal({ exporter: EXPORTADOR, ...e }, ctx);

/** Una partida minima con arancel e IVA. */
function partida(extra = {}) {
  return {
    descripcion: 'Cafe tostado', taricCode: '0901210000', paisOrigen: 'CO',
    pesobruto: 100, pesoneto: 90, bultos: 5, valorFactura: 1000,
    arancelTipo: 7.5, arancelImporte: 75, ivaTipo: 21, ivaImporte: 225.75,
    ...extra
  };
}

describe('buildH1ImportXML: envelope y cabecera', () => {
  test('envuelve el cuerpo en un envelope SOAP con los namespaces correctos', () => {
    const xml = buildH1ImportXML({ partidas: [partida()] });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`xmlns:soapenv="${NS_SOAP}"`);
    expect(xml).toContain(`xmlns:ent="${NS_ENT}"`);
    expect(xml).toContain('<ent:ImportacionCompletaV1Ent');
  });

  test('marca Test="S" por defecto (nunca produccion por accidente)', () => {
    const xml = buildH1ImportXML({ partidas: [partida()] });
    expect(xml).toMatch(/Test="S"/);
  });

  test('solo omite Test="S" cuando test es explicitamente false', () => {
    const xml = buildH1ImportXML({ partidas: [partida()], test: false });
    expect(xml).not.toMatch(/Test="S"/);
  });

  test('cuenta partidas y suma bultos en las casillas C05/C06', () => {
    const xml = buildH1ImportXML({ partidas: [partida({ bultos: 5 }), partida({ bultos: 3 })] });

    expect(xml).toContain('<C05NumeroDePartidas>2</C05NumeroDePartidas>');
    expect(xml).toContain('<C06TotalBultos>8</C06TotalBultos>');
  });

  test('sin partidas, C05 cae a 1 (nunca 0, que la AEAT rechaza)', () => {
    const xml = buildH1ImportXML({ partidas: [] });
    expect(xml).toContain('<C05NumeroDePartidas>1</C05NumeroDePartidas>');
  });

  test('limpia el prefijo ES de la aduana y la trunca a 6 caracteres', () => {
    const xml = buildH1ImportXML({ partidas: [partida()], aduanaDespacho: 'ES00460199' });
    expect(xml).toContain('<CAaduana>004601</CAaduana>');
  });

  test('la aduana cae a 002801 (Madrid) cuando no se indica', () => {
    const xml = buildH1ImportXML({ partidas: [partida()] });
    expect(xml).toContain('<CAaduana>002801</CAaduana>');
  });
});

describe('buildH1ImportXML: casillas opcionales', () => {
  test('emite NumeroReferenciaDUA solo si hay MRN (modificaciones)', () => {
    const con = buildH1ImportXML({ partidas: [partida()], mrn: '26ES00460199R1234567' });
    const sin = buildH1ImportXML({ partidas: [partida()] });

    expect(con).toContain('<NumeroReferenciaDUA>26ES00460199R1234567</NumeroReferenciaDUA>');
    expect(sin).not.toContain('<NumeroReferenciaDUA>');
  });

  test('emite la referencia comercial C07 solo si viene', () => {
    const con = buildH1ImportXML({ partidas: [partida()], referenciaComercial: 'PED-2026-001' });
    const sin = buildH1ImportXML({ partidas: [partida()] });

    expect(con).toContain('<C07ReferenciaComercial>PED-2026-001</C07ReferenciaComercial>');
    expect(sin).not.toContain('<C07ReferenciaComercial>');
  });

  test('emite la provincia de destino C17b solo si viene', () => {
    const con = buildH1ImportXML({ partidas: [partida()], provinciaDestino: '28' });
    const sin = buildH1ImportXML({ partidas: [partida()] });

    expect(con).toContain('<C17bProvinciaIslaDestino>28</C17bProvinciaIslaDestino>');
    expect(sin).not.toContain('<C17bProvinciaIslaDestino>');
  });

  test('emite la garantia de levante solo si viene', () => {
    const con = buildH1ImportXML({ partidas: [partida()], garantiaLevante: 'GRN123' });
    const sin = buildH1ImportXML({ partidas: [partida()] });

    expect(con).toContain('<CBgarantiaLevante>GRN123</CBgarantiaLevante>');
    expect(sin).not.toContain('<CBgarantiaLevante>');
  });

  test('el importador particular emite P solo con valor P', () => {
    const p = buildH1ImportXML({ partidas: [partida()], importadorParticular: 'P' });
    const n = buildH1ImportXML({ partidas: [partida()], importadorParticular: 'N' });

    expect(p).toContain('<C08ImportadorParticular>P</C08ImportadorParticular>');
    expect(n).toContain('<C08ImportadorParticular></C08ImportadorParticular>');
  });

  test('la localizacion de mercancias se autogenera si no se pasa', () => {
    const xml = buildH1ImportXML({ partidas: [partida()], aduanaDespacho: '004601' });
    expect(xml).toContain('<C30LocalizacionMercancias>ES004601LUCI01</C30LocalizacionMercancias>');
  });
});

describe('buildH1ImportXML: tributos por partida', () => {
  test('emite A00 (arancel) y B00 (IVA) cuando ambos tipos estan presentes', () => {
    const xml = buildH1ImportXML({ partidas: [partida()] });

    expect(xml).toContain('<C47TributoClase>A00</C47TributoClase>');
    expect(xml).toContain('<C47TributoClase>B00</C47TributoClase>');
  });

  test('emite A00 incluso con arancel 0 (0 != null: mercancia con derecho cero)', () => {
    // La rama usa != null a proposito: un arancel del 0% se declara, no se omite.
    const xml = buildH1ImportXML({ partidas: [partida({ arancelTipo: 0, arancelImporte: 0 })] });

    expect(xml).toContain('<C47TributoClase>A00</C47TributoClase>');
    expect(xml).toContain('<C47TributoTipoImpositivo>0.000000</C47TributoTipoImpositivo>');
  });

  test('omite A00 si no hay tipo de arancel (arancelTipo null)', () => {
    const xml = buildH1ImportXML({ partidas: [partida({ arancelTipo: null })] });
    expect(xml).not.toContain('<C47TributoClase>A00</C47TributoClase>');
  });

  test('la base del IVA es valor de factura mas arancel (Art. 83 LIVA)', () => {
    // 1000 + 75 = 1075.000
    const xml = buildH1ImportXML({ partidas: [partida({ valorFactura: 1000, arancelImporte: 75 })] });
    expect(xml).toContain('<C47TributoBaseImponible>1075.000</C47TributoBaseImponible>');
  });

  test('el importe total de la partida es arancel mas IVA', () => {
    const xml = buildH1ImportXML({ partidas: [partida({ arancelImporte: 75, ivaImporte: 225.75 })] });
    expect(xml).toContain('<C47ImporteTotal>300.75</C47ImporteTotal>');
  });
});

describe('buildH1ImportXML: codigo adicional (C372) y unidades suplementarias (C41)', () => {
  test('omite C372 cuando el codigo adicional es 000/00/0/vacio', () => {
    for (const vacio of ['000', '00', '0', '']) {
      const xml = buildH1ImportXML({ partidas: [partida({ codigoAdicional: vacio })] });
      expect(xml).not.toContain('<C372CodigoAdicional>');
    }
  });

  test('emite C372 cuando el codigo adicional es real', () => {
    const xml = buildH1ImportXML({ partidas: [partida({ codigoAdicional: 'F44' })] });
    expect(xml).toContain('<C372CodigoAdicional>F44</C372CodigoAdicional>');
  });

  test('emite C41 con el codigo por defecto UN (unidades) si hay unidades sin codigo', () => {
    // El defecto era NAR, el codigo TARIC: la AEAT lo rechaza (error 2019) y
    // exige el del Anexo IX de la Resolucion del DUA, de dos caracteres.
    const xml = buildH1ImportXML({ partidas: [partida({ unidadesSuplementarias: 12 })] });

    expect(xml).toContain('<C41UnidadesCodigo>UN</C41UnidadesCodigo>');
    expect(xml).toContain('<C41UnidadesNumero>12.000</C41UnidadesNumero>');
  });

  test('omite C41 cuando no hay unidades suplementarias', () => {
    const xml = buildH1ImportXML({ partidas: [partida({ unidadesSuplementarias: undefined })] });
    expect(xml).not.toContain('<C41UnidadesSuplementarias>');
  });

  test('la preferencia se parte en codigo (1 digito) y reduccion (resto)', () => {
    const xml = buildH1ImportXML({ partidas: [partida({ preferencia: '300' })] });

    expect(xml).toContain('<C36Preferencia>3</C36Preferencia>');
    expect(xml).toContain('<C36Reduccion>00</C36Reduccion>');
  });
});

describe('buildH1ImportXML: documentos por partida', () => {
  test('emite un C44 por cada documento aportado', () => {
    const xml = buildH1ImportXML({
      partidas: [partida({ documentos: [{ tipo: 'N380', referencia: 'FRA-1' }, { tipo: 'N730', referencia: 'CMR-1' }] })]
    });

    expect((xml.match(/<C44DocumentosYCertificados>/g) || []).length).toBe(2);
    expect(xml).toContain('<C44Tipo>N730</C44Tipo>');
  });

  test('sin documentos, genera uno por defecto N380 con la referencia comercial', () => {
    const xml = buildH1ImportXML({
      partidas: [partida({ documentos: undefined })], referenciaComercial: 'PED-9'
    });

    expect(xml).toContain('<C44Tipo>N380</C44Tipo>');
    expect(xml).toContain('<C44Referencia>PED-9</C44Referencia>');
  });
});

describe('expeditionToH1Data: mapeo desde el expediente LUCI', () => {
  test('sin MRN previo es una DECL nueva; con MRN es una MODI', () => {
    const nueva = expeditionToH1Data({ goods: [] });
    const modi = expeditionToH1Data({ declaration: { mrn: '26ES...' }, goods: [] });

    expect(nueva.tipoOperacion).toBe('DECL');
    expect(modi.tipoOperacion).toBe('MODI');
  });

  test('mapea el modo de transporte de LUCI al codigo AEAT (air -> 4)', () => {
    expect(expeditionToH1Data({ transportMode: 'air', goods: [] }).modoTransporteFrontera).toBe('4');
    expect(expeditionToH1Data({ transportMode: 'maritime', goods: [] }).modoTransporteFrontera).toBe('1');
    // Modo desconocido cae a maritimo.
    expect(expeditionToH1Data({ transportMode: 'pipeline', goods: [] }).modoTransporteFrontera).toBe('1');
  });

  test('resuelve el incoterm tanto si es objeto como si es string', () => {
    expect(expeditionToH1Data({ incoterm: { code: 'FOB' }, goods: [] }).incoterm).toBe('FOB');
    expect(expeditionToH1Data({ incoterm: 'DAP', goods: [] }).incoterm).toBe('DAP');
    expect(expeditionToH1Data({ goods: [] }).incoterm).toBe('CIF');
  });

  test('contenedores es 1 si hay numero de contenedor, 0 si no', () => {
    expect(expeditionToH1Data({ transport: { containerNumber: 'MSKU123' }, goods: [] }).contenedores).toBe('1');
    expect(expeditionToH1Data({ goods: [] }).contenedores).toBe('0');
  });

  test('suma el valor de factura de todas las mercancias', () => {
    const data = expeditionToH1Data({ goods: [{ invoiceValue: 1000 }, { value: 500 }] });
    expect(data.importeFactura).toBe(1500);
  });

  test('infiere unidades suplementarias de la cantidad cuando la unidad es piezas', () => {
    const data = expeditionToH1Data({ goods: [{ unit: 'PCS', quantity: 40 }] });

    expect(data.partidas[0].unidadesSuplementarias).toBe(40);
    expect(data.partidas[0].unidadesCodigo).toBe('NAR');
  });

  test('un codigo adicional vacio se normaliza a 000 (el builder luego lo omite)', () => {
    const data = expeditionToH1Data({ declaration: { additionalProcedure: '' }, goods: [{}] });
    expect(data.partidas[0].codigoAdicional).toBe('000');
  });

  test('calcula el IVA de la partida al 21% si no viene el importe', () => {
    // 1000 * 21 / 100 = 210
    const data = expeditionToH1Data({ goods: [{ invoiceValue: 1000 }] });
    expect(data.partidas[0].ivaImporte).toBe(210);
  });

  test('el data mapeado produce un XML valido de extremo a extremo', () => {
    const data = expeditionToH1Data({
      expeditionId: 'EXP-2026-001',
      client: { companyName: 'Importadora SL', taxId: 'B12345678' },
      declaration: { customsOffice: '004601', regime: '40' },
      transportMode: 'sea',
      goods: [{ description: 'Cafe', taricCode: '0901210000', invoiceValue: 1000, dutyRate: 7.5, dutyAmount: 75, vatRate: 21 }]
    });
    const xml = buildH1ImportXML(data);

    expect(xml).toContain('<ent:ImportacionCompletaV1Ent');
    expect(xml).toContain('<C3312CodigoPosicionTaric>0901210000</C3312CodigoPosicionTaric>');
    expect(xml).toContain('<C08ImportadorRazonSocial>Importadora SL</C08ImportadorRazonSocial>');
    expect(xml).toContain('<C47TributoClase>B00</C47TributoClase>');
  });
});

describe('expeditionToH1Data: sin identificadores inventados (422)', () => {
  const real = expeditionToH1DataReal;
  const cliente = { companyName: 'Cliente SL', nif: 'B00000000' };

  test('exportador sin identificacion: 422 antes de construir el SOAP', () => {
    expect(() => real({ client: cliente, goods: [], exporter: { address: 'Calle 1', city: 'X' } }, { declarante: DECLARANTE }))
      .toThrow(/Falta el EORI del exportador/);
  });
  test('exportador sin direccion: 422, no "Calle Ejemplo 1" ni Zaragoza', () => {
    let e;
    try { real({ goods: [], exporter: { eori: 'CN1' } }, { declarante: DECLARANTE }); } catch (x) { e = x; }
    expect(e.status).toBe(422);
    expect(e.message).toMatch(/dirección del exportador/);
  });
  test('sin declarante resuelto: 422, no ESB22477020', () => {
    expect(() => real({ goods: [], exporter: EXPORTADOR }, {})).toThrow(/Falta el EORI del representante/);
  });
  test('con todo, nada fijo en el resultado', () => {
    const d = real({ goods: [], exporter: EXPORTADOR }, { declarante: DECLARANTE });
    expect(d.declaranteNIF).toBe('ESA11111111');
    expect(d.declaranteNombre).toBe('Agencia SL');
    expect(JSON.stringify(d)).not.toMatch(/B22477020|STRIX AI|Calle Ejemplo|Zaragoza|strixai\.ai/);
  });
});

describe('expeditionToH1Data: factura en divisa', () => {
  const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaPublicacion: '2026-10-21', fuente: 'BCE' };
  const enDolares = {
    expeditionId: 'EXP-USD',
    client: { taxId: 'B12345678', companyName: 'Importadora SL' },
    goods: [
      { description: 'Auriculares', taricCode: '8518300090', invoiceValue: 10000, currency: 'USD', dutyRate: 2, vatRate: 21, dutyAmount: 200, vatAmount: 2142 },
      { description: 'Fundas', taricCode: '4202920000', invoiceValue: 2000, currency: 'USD', dutyRate: 0, vatRate: 21, statisticalValue: 2000 }
    ]
  };

  test('declara la divisa de la factura y liquida los tributos en euros', () => {
    const data = expeditionToH1Data(enDolares, { declarante: DECLARANTE, cambio: USD });

    expect(data.divisa).toBe('USD');
    expect(data.importeFactura).toBe(12000);
    const [p1, p2] = data.partidas;
    // 10.000 USD / 1,1234 = 8.901,55 EUR
    expect(p1.valorFactura).toBe(10000);
    expect(p1.valorEuros).toBe(8901.55);
    expect(p1.valorEstadistico).toBe(8901.55);
    expect(p1.arancelImporte).toBe(178.03);
    expect(p1.ivaImporte).toBe(1906.71);
    // Un valor estadístico igual al de factura es el de factura sin convertir.
    expect(p2.valorEuros).toBe(1780.31);
    expect(p2.valorEstadistico).toBe(1780.31);
    expect(data.importeTotalTributos).toBe(178.03 + 1906.71 + 373.87);
  });

  test('el XML lleva la divisa en la casilla 22 y las bases en euros', () => {
    const xml = buildH1ImportXML(expeditionToH1Data(enDolares, { declarante: DECLARANTE, cambio: USD }));

    expect(xml).toContain('<C221CodigoDivisa>USD</C221CodigoDivisa>');
    expect(xml).toContain('<C222ImporteFactura>12000.000</C222ImporteFactura>');
    expect(xml).toContain('<C42ValorFactura>10000.000</C42ValorFactura>');
    expect(xml).toContain('<C46ValorEstadistico>8901.55</C46ValorEstadistico>');
    expect(xml).toContain('<C47TributoBaseImponible>8901.550</C47TributoBaseImponible>');
    expect(xml).toContain('<C47TributoBaseImponible>9079.580</C47TributoBaseImponible>');
    expect(xml).not.toContain('<C47TributoBaseImponible>10000.000</C47TributoBaseImponible>');
  });

  test('sin tipo de cambio no construye un H1 en dólares (422)', () => {
    expect(() => expeditionToH1Data(enDolares)).toThrow('USD');
    expect(() => expeditionToH1Data(enDolares, { declarante: DECLARANTE, cambio: { divisa: 'EUR', tipo: 1 } })).toThrow('USD');
  });

  test('un expediente en euros sale igual que antes', () => {
    const enEuros = { ...enDolares, goods: enDolares.goods.map((g) => ({ ...g, currency: 'EUR' })) };
    const data = expeditionToH1Data(enEuros);

    expect(data.divisa).toBe('EUR');
    expect(data.partidas[0].valorEuros).toBe(10000);
    expect(data.partidas[0].arancelImporte).toBe(200);
    expect(data.partidas[0].ivaImporte).toBe(2142);
    const xml = buildH1ImportXML(data);
    expect(xml).toContain('<C221CodigoDivisa>EUR</C221CodigoDivisa>');
    expect(xml).toContain('<C47TributoBaseImponible>10000.000</C47TributoBaseImponible>');
  });
});

describe('expeditionToH1Data: total de tributos sin cálculo guardado', () => {
  test('en euros suma arancel e IVA de las partidas (la AEAT rechaza si no cuadra)', () => {
    const data = expeditionToH1Data({
      expeditionId: 'EXP-EUR',
      client: { taxId: 'B12345678', companyName: 'Importadora SL' },
      goods: [{ description: 'Sábanas', taricCode: '6302100000', invoiceValue: 10000, currency: 'EUR', dutyRate: 12, vatRate: 21, dutyAmount: 1200, vatAmount: 2352 }]
    });

    expect(data.importeTotalTributos).toBe(3552);
  });
});
