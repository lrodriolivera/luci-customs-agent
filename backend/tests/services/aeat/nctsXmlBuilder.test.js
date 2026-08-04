/**
 * nctsXmlBuilder: construccion del XML de la declaracion de TRANSITO (NCTS5,
 * mensaje CC015C EUCDM qualified) para la AEAT.
 *
 * Generador PURO —sin BD ni red—: solo depende de generateTransactionId (que
 * es determinista y no hace I/O). Aqui viven las reglas AEAT de transito que si
 * se rompen tumban la declaracion: la garantia distingue tres casos (tipo
 * 0/1/3/4 exige GRN, tipo 2/6/8 emite una GuaranteeReference vacia, el resto no
 * emite ninguna), el EORI del titular/consignatario excluye name/Address
 * (reglas 1499/1626), y el documento previo NMRN arrastra medida y cantidad.
 * Se prueban esas ramas condicionales una a una.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildNCTSTransitXML } = require('../../../src/services/aeat/nctsXmlBuilder');

/** Una partida de transito minima. */
function item(extra = {}) {
  return {
    description: 'Maquinaria industrial', taricCode: '84295200',
    grossWeight: 1500, netWeight: 1400,
    packages: 5, packageType: 'CS', ...extra
  };
}

/** Datos base de una declaracion de transito viable. */
function base(extra = {}) {
  return {
    lrn: 'LRN-TR-001', officeOfDeparture: 'ES000851', officeOfDestination: 'FR001300',
    holderEORI: 'ESB22477020',
    consignment: { goodsItems: [item()] },
    ...extra
  };
}

describe('buildNCTSTransitXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC015C qualified', () => {
    const xml = buildNCTSTransitXML(base());

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC015CV1Ent');
    expect(xml).toContain('<ent:messageType>CC015C</ent:messageType>');
    expect(xml).toContain('<ent:messageRecipient>NTA.ES</ent:messageRecipient>');
  });

  test('el LRN cae al transactionId cuando no se pasa', () => {
    const xml = buildNCTSTransitXML(base({ lrn: '' }));
    expect(xml).toMatch(/<ent:LRN>.+<\/ent:LRN>/);
  });

  test('respeta el LRN, el tipo de transito y el tipo de declaracion adicional', () => {
    const xml = buildNCTSTransitXML(base({ lrn: 'LRN-X', transitType: 'T2', additionalDeclarationType: 'D' }));

    expect(xml).toContain('<ent:LRN>LRN-X</ent:LRN>');
    expect(xml).toContain('<ent:declarationType>T2</ent:declarationType>');
    expect(xml).toContain('<ent:additionalDeclarationType>D</ent:additionalDeclarationType>');
  });

  test('vuelca las aduanas de partida y destino', () => {
    const xml = buildNCTSTransitXML(base());

    const dep = xml.slice(xml.indexOf('<ent:CustomsOfficeOfDeparture>'), xml.indexOf('</ent:CustomsOfficeOfDeparture>'));
    expect(dep).toContain('<ent:referenceNumber>ES000851</ent:referenceNumber>');
    const dest = xml.slice(xml.indexOf('<ent:CustomsOfficeOfDestinationDeclared>'), xml.indexOf('</ent:CustomsOfficeOfDestinationDeclared>'));
    expect(dest).toContain('<ent:referenceNumber>FR001300</ent:referenceNumber>');
  });

  test('la masa bruta total es la suma de los pesos brutos de las partidas', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ grossWeight: 1500 }), item({ grossWeight: 250 })] }
    }));
    // grossMass del Consignment con 3 decimales.
    expect(xml).toContain('<ent:grossMass>1750.000</ent:grossMass>');
  });

  test('emite el bloque Authorisation solo si viene authorisationNumber', () => {
    const con = buildNCTSTransitXML(base({ authorisationNumber: 'ES-AUTH-1' }));
    const sin = buildNCTSTransitXML(base());

    expect(con).toContain('<ent:Authorisation>');
    expect(con).toContain('<ent:referenceNumber>ES-AUTH-1</ent:referenceNumber>');
    expect(sin).not.toContain('<ent:Authorisation>');
  });
});

describe('titular del transito (regla 1499/1626: EORI excluye name/Address)', () => {
  test('con EORI del titular NO se emiten name ni Address', () => {
    const xml = buildNCTSTransitXML(base({ holderEORI: 'ESB22477020' }));

    const holder = xml.slice(xml.indexOf('<ent:HolderOfTheTransitProcedure>'), xml.indexOf('</ent:HolderOfTheTransitProcedure>'));
    expect(holder).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(holder).not.toContain('<ent:Address>');
  });

  test('sin EORI del titular se emiten name y Address', () => {
    const xml = buildNCTSTransitXML(base({
      holderEORI: '', holderName: 'Transitos SL', holderStreet: 'Calle 1',
      holderCity: 'Zaragoza', holderPostcode: '50001'
    }));

    const holder = xml.slice(xml.indexOf('<ent:HolderOfTheTransitProcedure>'), xml.indexOf('</ent:HolderOfTheTransitProcedure>'));
    expect(holder).toContain('<ent:name>Transitos SL</ent:name>');
    expect(holder).toContain('<ent:city>Zaragoza</ent:city>');
  });

  test('la persona de contacto cae a valores por defecto de despacho', () => {
    const xml = buildNCTSTransitXML(base());

    expect(xml).toContain('<ent:eMailAddress>despacho@strixai.es</ent:eMailAddress>');
    expect(xml).toContain('<ent:phoneNumber>+34976000000</ent:phoneNumber>');
  });

  test('respeta los contactos explicitos del titular', () => {
    const xml = buildNCTSTransitXML(base({
      holderContactName: 'Ana', holderContactPhone: '+34600111222', holderContactEmail: 'ana@t.es'
    }));

    expect(xml).toContain('<ent:name>Ana</ent:name>');
    expect(xml).toContain('<ent:eMailAddress>ana@t.es</ent:eMailAddress>');
  });
});

describe('garantia: los tres casos por tipo', () => {
  test('tipo 1 (0/1/3/4) exige GRN con importe cubierto', () => {
    const xml = buildNCTSTransitXML(base({ guaranteeType: '1', guaranteeGRN: 'ES01GRN123', guaranteeAmount: 5000 }));

    const g = xml.slice(xml.indexOf('<ent:Guarantee>'), xml.indexOf('</ent:Guarantee>'));
    expect(g).toContain('<ent:guaranteeType>1</ent:guaranteeType>');
    expect(g).toContain('<ent:GRN>ES01GRN123</ent:GRN>');
    expect(g).toContain('<ent:amountToBeCovered>5000.00</ent:amountToBeCovered>');
  });

  test('el codigo de acceso de la garantia cae a 0000 si no se da', () => {
    const xml = buildNCTSTransitXML(base({ guaranteeType: '0', guaranteeGRN: 'G1' }));
    expect(xml).toContain('<ent:accessCode>0000</ent:accessCode>');
  });

  test('el importe cubierto cae a grossMass*10 si no hay guaranteeAmount', () => {
    const xml = buildNCTSTransitXML(base({
      guaranteeType: '3', guaranteeGRN: 'G',
      consignment: { goodsItems: [item({ grossWeight: 200 })] }
    }));
    // 200 * 10 = 2000
    expect(xml).toContain('<ent:amountToBeCovered>2000.00</ent:amountToBeCovered>');
  });

  test('sin importe ni peso el importe cubierto cae al literal 10000', () => {
    const xml = buildNCTSTransitXML(base({
      guaranteeType: '4', guaranteeGRN: 'G',
      consignment: { goodsItems: [item({ grossWeight: 0 })] }
    }));
    // guaranteeAmount ausente, totalGross*10 = 0 (falsy) -> 10000
    expect(xml).toContain('<ent:amountToBeCovered>10000.00</ent:amountToBeCovered>');
  });

  test('tipo 2 (2/6/8) emite una GuaranteeReference vacia sin GRN', () => {
    const xml = buildNCTSTransitXML(base({ guaranteeType: '2' }));

    const g = xml.slice(xml.indexOf('<ent:Guarantee>'), xml.indexOf('</ent:Guarantee>'));
    expect(g).toContain('<ent:GuaranteeReference>');
    expect(g).toContain('<ent:amountToBeCovered>0.00</ent:amountToBeCovered>');
    expect(g).not.toContain('<ent:GRN>');
  });

  test('un tipo sin categoria (p.ej. 5) no emite ninguna GuaranteeReference', () => {
    const xml = buildNCTSTransitXML(base({ guaranteeType: '5' }));

    const g = xml.slice(xml.indexOf('<ent:Guarantee>'), xml.indexOf('</ent:Guarantee>'));
    expect(g).toContain('<ent:guaranteeType>5</ent:guaranteeType>');
    expect(g).not.toContain('<ent:GuaranteeReference>');
  });
});

describe('oficinas de transito', () => {
  test('emite una CustomsOfficeOfTransitDeclared por cada oficina intermedia', () => {
    const xml = buildNCTSTransitXML(base({
      transitOffices: [{ code: 'FR000100', sequence: 1 }, { code: 'DE000200' }]
    }));

    expect((xml.match(/<ent:CustomsOfficeOfTransitDeclared>/g) || []).length).toBe(2);
    expect(xml).toContain('<ent:referenceNumber>FR000100</ent:referenceNumber>');
    expect(xml).toContain('<ent:referenceNumber>DE000200</ent:referenceNumber>');
  });

  test('sin oficinas de transito no emite ninguna', () => {
    const xml = buildNCTSTransitXML(base());
    expect(xml).not.toContain('<ent:CustomsOfficeOfTransitDeclared>');
  });
});

describe('HouseConsignment y consignatario por partida', () => {
  test('numera las partidas y parte el TARIC en subheading (6) + CN (2)', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ taricCode: '84295200' })] }
    }));

    expect(xml).toContain('<ent:harmonizedSystemSubHeadingCode>842952</ent:harmonizedSystemSubHeadingCode>');
    expect(xml).toContain('<ent:combinedNomenclatureCode>00</ent:combinedNomenclatureCode>');
    expect(xml).toContain('<ent:goodsItemNumber>1</ent:goodsItemNumber>');
  });

  test('un TARIC sin los ultimos digitos cae al CN por defecto 00', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ taricCode: '842952' })] }
    }));
    expect(xml).toContain('<ent:combinedNomenclatureCode>00</ent:combinedNomenclatureCode>');
  });

  test('con EORI de consignatario emite identificationNumber, sin name', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ consigneeEORI: 'FR9999' })] }
    }));

    const hc = xml.slice(xml.indexOf('<ent:HouseConsignment>'), xml.indexOf('</ent:HouseConsignment>'));
    expect(hc).toContain('<ent:identificationNumber>FR9999</ent:identificationNumber>');
    expect(hc).not.toContain('<ent:name>');
  });

  test('sin EORI pero con nombre de consignatario emite name + Address', () => {
    const xml = buildNCTSTransitXML(base({
      officeOfDestination: 'FR001300',
      consignment: { goodsItems: [item({ consigneeName: 'Destinataire SARL', consigneeCity: 'Lyon' })] }
    }));

    const hc = xml.slice(xml.indexOf('<ent:HouseConsignment>'), xml.indexOf('</ent:HouseConsignment>'));
    expect(hc).toContain('<ent:name>Destinataire SARL</ent:name>');
    expect(hc).toContain('<ent:city>Lyon</ent:city>');
    // El pais de la direccion cae a los dos primeros digitos de la aduana destino.
    expect(hc).toContain('<ent:country>FR</ent:country>');
  });

  test('el consignatario a nivel consignment aplica a la partida si no lo trae ella', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { consigneeEORI: 'FR-CONS-GLOBAL', goodsItems: [item()] }
    }));
    expect(xml).toContain('<ent:identificationNumber>FR-CONS-GLOBAL</ent:identificationNumber>');
  });

  test('el consignatario a nivel data (raiz) tambien aplica a la partida', () => {
    const xml = buildNCTSTransitXML(base({
      consigneeEORI: 'FR-CONS-ROOT',
      consignment: { goodsItems: [item()] }
    }));
    expect(xml).toContain('<ent:identificationNumber>FR-CONS-ROOT</ent:identificationNumber>');
  });

  test('el nombre de consignatario a nivel consignment aplica si la partida no lo trae', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { consigneeName: 'Consignee Global', consigneeStreet: 'Rue 1', consigneePostcode: '69000', consigneeCity: 'Lyon', consigneeCountry: 'FR', goodsItems: [item()] }
    }));

    const hc = xml.slice(xml.indexOf('<ent:HouseConsignment>'), xml.indexOf('</ent:HouseConsignment>'));
    expect(hc).toContain('<ent:name>Consignee Global</ent:name>');
    expect(hc).toContain('<ent:streetAndNumber>Rue 1</ent:streetAndNumber>');
    expect(hc).toContain('<ent:postcode>69000</ent:postcode>');
  });

  test('sin netWeight el peso neto cae al peso bruto de la partida', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ grossWeight: 800, netWeight: undefined })] }
    }));
    // netMass = netWeight || grossWeight || 0 -> 800.000
    expect(xml).toContain('<ent:netMass>800.000</ent:netMass>');
  });

  test('sin pesos la partida cae a 0.000 en masas', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ grossWeight: undefined, netWeight: undefined })] }
    }));
    expect(xml).toContain('<ent:netMass>0.000</ent:netMass>');
  });

  test('sin datos de consignatario no emite el bloque Consignee de la partida', () => {
    const xml = buildNCTSTransitXML(base());
    const hc = xml.slice(xml.indexOf('<ent:HouseConsignment>'), xml.indexOf('</ent:HouseConsignment>'));
    expect(hc).not.toContain('<ent:Consignee>');
  });

  test('el pais de despacho/destino de la partida cae a defaults del titular y la aduana', () => {
    const xml = buildNCTSTransitXML(base({
      holderCountry: 'ES', officeOfDestination: 'FR001300',
      consignment: { goodsItems: [item()] }
    }));

    const ci = xml.slice(xml.indexOf('<ent:ConsignmentItem>'), xml.indexOf('</ent:ConsignmentItem>'));
    expect(ci).toContain('<ent:countryOfDispatch>ES</ent:countryOfDispatch>');
    expect(ci).toContain('<ent:countryOfDestination>FR</ent:countryOfDestination>');
  });

  test('trunca la descripcion de la mercancia a 512 caracteres', () => {
    const largo = 'Z'.repeat(600);
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ description: largo })] }
    }));
    expect(xml).toContain('<ent:descriptionOfGoods>' + 'Z'.repeat(512) + '</ent:descriptionOfGoods>');
  });

  test('el bulto cae a valores por defecto (PK, 1 bulto, N/M) si no se dan', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ packageType: undefined, packages: undefined, shippingMarks: undefined })] }
    }));

    expect(xml).toContain('<ent:typeOfPackages>PK</ent:typeOfPackages>');
    expect(xml).toContain('<ent:numberOfPackages>1</ent:numberOfPackages>');
    expect(xml).toContain('<ent:shippingMarks>N/M</ent:shippingMarks>');
  });

  test('varias partidas generan varios HouseConsignment numerados', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item(), item(), item()] }
    }));
    expect((xml.match(/<ent:HouseConsignment>/g) || []).length).toBe(3);
    expect(xml).toContain('<ent:declarationGoodsItemNumber>3</ent:declarationGoodsItemNumber>');
  });
});

describe('documento previo (PreviousDocument)', () => {
  test('sin previousDocumentType no emite el bloque', () => {
    const xml = buildNCTSTransitXML(base());
    expect(xml).not.toContain('<ent:PreviousDocument>');
  });

  test('con un documento previo generico emite tipo y referencia, sin medida', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ previousDocumentType: 'N730', previousDocumentRef: 'CMR-1' })] }
    }));

    const pd = xml.slice(xml.indexOf('<ent:PreviousDocument>'), xml.indexOf('</ent:PreviousDocument>'));
    expect(pd).toContain('<ent:type>N730</ent:type>');
    expect(pd).toContain('<ent:referenceNumber>CMR-1</ent:referenceNumber>');
    expect(pd).not.toContain('<ent:measurementUnitAndQualifier>');
  });

  test('un documento previo NMRN arrastra unidad de medida KGM y cantidad', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ previousDocumentType: 'NMRN', previousDocumentRef: '26ES...', netWeight: 1400 })] }
    }));

    const pd = xml.slice(xml.indexOf('<ent:PreviousDocument>'), xml.indexOf('</ent:PreviousDocument>'));
    expect(pd).toContain('<ent:measurementUnitAndQualifier>KGM</ent:measurementUnitAndQualifier>');
    expect(pd).toContain('<ent:quantity>1400.000</ent:quantity>');
  });

  test('el numero de item del documento previo se castea a entero (por defecto 1)', () => {
    const xml = buildNCTSTransitXML(base({
      consignment: { goodsItems: [item({ previousDocumentType: 'N730', previousDocumentRef: 'R', previousDocumentItem: '3' })] }
    }));

    const pd = xml.slice(xml.indexOf('<ent:PreviousDocument>'), xml.indexOf('</ent:PreviousDocument>'));
    expect(pd).toContain('<ent:goodsItemNumber>3</ent:goodsItemNumber>');
  });
});

describe('lugar de carga y localizacion', () => {
  test('el lugar de carga cae a defaults del titular (pais/ciudad)', () => {
    const xml = buildNCTSTransitXML(base({ holderCountry: 'ES', holderCity: 'Barcelona' }));

    const pl = xml.slice(xml.indexOf('<ent:PlaceOfLoading>'), xml.indexOf('</ent:PlaceOfLoading>'));
    expect(pl).toContain('<ent:country>ES</ent:country>');
    expect(pl).toContain('<ent:location>Barcelona</ent:location>');
  });

  test('respeta el lugar de carga explicito', () => {
    const xml = buildNCTSTransitXML(base({ placeOfLoadingCountry: 'PT', placeOfLoadingLocation: 'Lisboa' }));

    const pl = xml.slice(xml.indexOf('<ent:PlaceOfLoading>'), xml.indexOf('</ent:PlaceOfLoading>'));
    expect(pl).toContain('<ent:country>PT</ent:country>');
    expect(pl).toContain('<ent:location>Lisboa</ent:location>');
  });

  test('el numero de autorizacion de la localizacion cae a aduana+001 si no se da', () => {
    const xml = buildNCTSTransitXML(base({ officeOfDeparture: 'ES000851' }));
    expect(xml).toContain('<ent:authorisationNumber>ES000851001</ent:authorisationNumber>');
  });
});
