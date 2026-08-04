/**
 * aesXmlBuilder: construccion del XML de la declaracion de EXPORTACION (AES,
 * mensaje CC515C EUCDM) para la AEAT.
 *
 * Generador PURO —sin BD ni red—: solo depende de generateTransactionId (que
 * es determinista y no hace I/O). Aqui viven reglas AEAT validadas en PRE que
 * si se rompen tumban la exportacion: EORI excluye name/Address (reglas
 * 1289/1290), DeliveryTerms es UNLocode XOR location+country, security=2 mete
 * el itinerario de paises, y la exportacion directa omite el transporte
 * interior. Se prueban esas ramas condicionales una a una.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildAESExportXML } = require('../../../src/services/aeat/aesXmlBuilder');

/** Una partida de exportacion minima. */
function item(extra = {}) {
  return {
    description: 'Aceite de oliva', taricCode: '1509100000',
    grossWeight: 500, netWeight: 480, value: 2000,
    packages: 20, packageType: 'BX', ...extra
  };
}

describe('buildAESExportXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC515C', () => {
    const xml = buildAESExportXML({ goodsItems: [item()] });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC515CV1Ent');
    expect(xml).toContain('<ent:messageType>CC515C</ent:messageType>');
  });

  test('el LRN cae al transactionId cuando no se pasa', () => {
    const xml = buildAESExportXML({ goodsItems: [item()] });
    // LRN vacio -> usa transId; comprobamos que el tag no queda vacio.
    expect(xml).toMatch(/<ent:LRN>.+<\/ent:LRN>/);
  });

  test('respeta el LRN explicito', () => {
    const xml = buildAESExportXML({ lrn: 'LRN-EXP-1', goodsItems: [item()] });
    expect(xml).toContain('<ent:LRN>LRN-EXP-1</ent:LRN>');
  });

  test('el total facturado se calcula sumando el valor de las partidas si no se da', () => {
    const xml = buildAESExportXML({ goodsItems: [item({ value: 2000 }), item({ value: 500 })] });
    expect(xml).toContain('<ent:totalAmountInvoiced>2500.00</ent:totalAmountInvoiced>');
  });

  test('un total facturado explicito prevalece sobre la suma de partidas', () => {
    const xml = buildAESExportXML({ totalAmountInvoiced: 9999, goodsItems: [item({ value: 2000 })] });
    expect(xml).toContain('<ent:totalAmountInvoiced>9999.00</ent:totalAmountInvoiced>');
  });

  test('la masa bruta total es la suma de los pesos brutos de las partidas', () => {
    const xml = buildAESExportXML({ goodsItems: [item({ grossWeight: 500 }), item({ grossWeight: 250 })] });
    expect(xml).toContain('<ent:grossMass>750.000</ent:grossMass>');
  });
});

describe('regla 1289/1290: EORI excluye name/Address', () => {
  test('con EORI del exportador NO se emiten name ni Address', () => {
    const xml = buildAESExportXML({ exporterEORI: 'ESB22477020', goodsItems: [item()] });

    expect(xml).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    // El bloque Exporter no debe llevar su <ent:name> ni <ent:Address>.
    const exporterBlock = xml.slice(xml.indexOf('<ent:Exporter>'), xml.indexOf('</ent:Exporter>'));
    expect(exporterBlock).not.toContain('<ent:name>');
    expect(exporterBlock).not.toContain('<ent:Address>');
  });

  test('sin EORI del exportador se emiten name y Address', () => {
    const xml = buildAESExportXML({
      exporterEORI: '', exporterName: 'Exportadora SL', exporterCity: 'Zaragoza',
      goodsItems: [item()]
    });

    const exporterBlock = xml.slice(xml.indexOf('<ent:Exporter>'), xml.indexOf('</ent:Exporter>'));
    expect(exporterBlock).toContain('<ent:name>Exportadora SL</ent:name>');
    expect(exporterBlock).toContain('<ent:city>Zaragoza</ent:city>');
  });

  test('el consignatario aplica la misma regla EORI vs Address', () => {
    const conEori = buildAESExportXML({ consigneeEORI: 'US123', goodsItems: [item()] });
    const sinEori = buildAESExportXML({ consigneeEORI: '', consigneeName: 'Buyer Inc', destinationCountry: 'US', goodsItems: [item()] });

    const blockCon = conEori.slice(conEori.indexOf('<ent:Consignee>'), conEori.indexOf('</ent:Consignee>'));
    expect(blockCon).not.toContain('<ent:name>');

    const blockSin = sinEori.slice(sinEori.indexOf('<ent:Consignee>'), sinEori.indexOf('</ent:Consignee>'));
    expect(blockSin).toContain('<ent:name>Buyer Inc</ent:name>');
    // El pais de la direccion cae al destino si no se da.
    expect(blockSin).toContain('<ent:country>US</ent:country>');
  });

  test('el declarante cae al EORI del exportador si no tiene uno propio', () => {
    const xml = buildAESExportXML({ exporterEORI: 'ESB1', declarantEORI: '', goodsItems: [item()] });
    const decl = xml.slice(xml.indexOf('<ent:Declarant>'), xml.indexOf('</ent:Declarant>'));
    expect(decl).toContain('<ent:identificationNumber>ESB1</ent:identificationNumber>');
  });

  test('los contactos del declarante caen a valores por defecto de STRIX', () => {
    const xml = buildAESExportXML({ goodsItems: [item()] });
    expect(xml).toContain('<ent:eMailAddress>despacho@strixai.es</ent:eMailAddress>');
    expect(xml).toContain('<ent:name>Despacho</ent:name>');
  });
});

describe('DeliveryTerms: UNLocode XOR location+country', () => {
  test('con UNLocode emite el codigo de localizacion ONU, sin location', () => {
    const xml = buildAESExportXML({ incotermCode: 'FOB', incotermUNLocode: 'ESVLC', goodsItems: [item()] });

    const dt = xml.slice(xml.indexOf('<ent:DeliveryTerms>'), xml.indexOf('</ent:DeliveryTerms>'));
    expect(dt).toContain('<ent:UNLocode>ESVLC</ent:UNLocode>');
    expect(dt).not.toContain('<ent:location>');
  });

  test('sin UNLocode emite location + country (con defaults)', () => {
    const xml = buildAESExportXML({ incotermCode: 'DAP', destinationCountry: 'MA', goodsItems: [item()] });

    const dt = xml.slice(xml.indexOf('<ent:DeliveryTerms>'), xml.indexOf('</ent:DeliveryTerms>'));
    expect(dt).toContain('<ent:location>Destino</ent:location>');
    expect(dt).toContain('<ent:country>MA</ent:country>');
  });
});

describe('exportacion directa y security', () => {
  test('la exportacion directa omite el transporte interior y el DepartureTransportMeans', () => {
    const xml = buildAESExportXML({ directExport: true, goodsItems: [item()] });

    expect(xml).not.toContain('<ent:inlandModeOfTransport>');
    expect(xml).not.toContain('<ent:DepartureTransportMeans>');
  });

  test('sin exportacion directa emite el transporte interior y el medio de salida', () => {
    const xml = buildAESExportXML({ directExport: false, inlandModeOfTransport: '3', goodsItems: [item()] });

    expect(xml).toContain('<ent:inlandModeOfTransport>3</ent:inlandModeOfTransport>');
    expect(xml).toContain('<ent:DepartureTransportMeans>');
  });

  test('security=2 mete el itinerario de paises (origen y destino)', () => {
    const xml = buildAESExportXML({ security: '2', countryOfExport: 'ES', destinationCountry: 'US', goodsItems: [item()] });

    const routings = (xml.match(/<ent:CountryOfRoutingOfConsignment>/g) || []).length;
    expect(routings).toBe(2);
  });

  test('security distinto de 2 no mete itinerario', () => {
    const xml = buildAESExportXML({ security: '0', goodsItems: [item()] });
    expect(xml).not.toContain('<ent:CountryOfRoutingOfConsignment>');
  });

  test('el medio de transporte en frontera cae al de salida si no se da', () => {
    const xml = buildAESExportXML({
      departureTransportId: 'TRUCK-1', departureTransportCountry: 'ES',
      activeBorderTransportId: '', activeBorderTransportCountry: '',
      goodsItems: [item()]
    });

    const active = xml.slice(xml.indexOf('<ent:ActiveBorderTransportMeans>'), xml.indexOf('</ent:ActiveBorderTransportMeans>'));
    expect(active).toContain('<ent:identificationNumber>TRUCK-1</ent:identificationNumber>');
    expect(active).toContain('<ent:nationality>ES</ent:nationality>');
  });
});

describe('partidas (GoodsItem)', () => {
  test('numera las partidas y parte el TARIC en subheading (6) + CN (2)', () => {
    const xml = buildAESExportXML({ goodsItems: [item({ taricCode: '1509100000' })] });

    expect(xml).toContain('<ent:declarationGoodsItemNumber>1</ent:declarationGoodsItemNumber>');
    expect(xml).toContain('<ent:harmonizedSystemSubHeadingCode>150910</ent:harmonizedSystemSubHeadingCode>');
    expect(xml).toContain('<ent:combinedNomenclatureCode>00</ent:combinedNomenclatureCode>');
  });

  test('emite Origin con region de despacho solo si el pais de export es ES', () => {
    const es = buildAESExportXML({ countryOfExport: 'ES', goodsItems: [item({ countryOfOrigin: 'ES', regionOfDispatch: '50' })] });
    const no = buildAESExportXML({ countryOfExport: 'FR', goodsItems: [item({ countryOfOrigin: 'FR' })] });

    expect(es).toContain('<ent:regionOfDispatch>50</ent:regionOfDispatch>');
    const originNo = no.slice(no.indexOf('<ent:Origin>'), no.indexOf('</ent:Origin>'));
    expect(originNo).not.toContain('<ent:regionOfDispatch>');
  });

  test('sin countryOfOrigin no emite el bloque Origin', () => {
    const xml = buildAESExportXML({ goodsItems: [item({ countryOfOrigin: undefined })] });
    // Solo debe existir el Origin si hay pais; la partida base no lo lleva.
    expect(xml).not.toContain('<ent:Origin>');
  });

  test('emite supplementaryUnits solo si viene (0 se emite: != null)', () => {
    const con = buildAESExportXML({ goodsItems: [item({ supplementaryUnits: 0 })] });
    const sin = buildAESExportXML({ goodsItems: [item({ supplementaryUnits: undefined })] });

    expect(con).toContain('<ent:supplementaryUnits>0</ent:supplementaryUnits>');
    expect(sin).not.toContain('<ent:supplementaryUnits>');
  });

  test('trunca la descripcion de la mercancia a 512 caracteres', () => {
    const largo = 'X'.repeat(600);
    const xml = buildAESExportXML({ goodsItems: [item({ description: largo })] });
    expect(xml).toContain('<ent:descriptionOfGoods>' + 'X'.repeat(512) + '</ent:descriptionOfGoods>');
  });

  test('varias partidas generan varios GoodsItem numerados', () => {
    const xml = buildAESExportXML({ goodsItems: [item(), item(), item()] });
    expect((xml.match(/<ent:GoodsItem>/g) || []).length).toBe(3);
    expect(xml).toContain('<ent:declarationGoodsItemNumber>3</ent:declarationGoodsItemNumber>');
  });
});
