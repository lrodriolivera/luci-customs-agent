/**
 * ensXmlBuilder: construccion del XML de la declaracion sumaria de ENTRADA (ENS
 * ICS legacy, mensaje CC315A, formato IE315V5 unqualified) para la AEAT.
 *
 * OJO: no confundir con ensGenerator (mensajes ICS2 CC315C DEC-DMS). Este es el
 * endpoint legacy de la AEAT (aereo/carretera/ferrocarril/RO-RO), con tags tipo
 * HEAHEA/GOOITEGDS/TRACONCO2.
 *
 * Generador PURO —sin BD ni red—: solo depende de generateTransactionId
 * (determinista) y de new Date() para las fechas de preparacion/llegada. Aqui
 * viven reglas AEAT que si se rompen tumban la sumaria: el mapa de modo de
 * transporte, la regla C501 (EORI del transportista excluye su nombre), el
 * ferrocarril (modo 2) que omite la nacionalidad del medio, y el itinerario de
 * paises. Se prueban esas ramas condicionales una a una. No se asertan valores
 * exactos de fecha (dependen del reloj), solo su forma.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildENSDeclarationXML } = require('../../../src/services/aeat/ensXmlBuilder');

/** Un house consignment minimo. */
function house(extra = {}) {
  return {
    goodsDescription: 'Textil variado', commodityCode: '6109100010',
    grossMass: 600, numberOfPackages: 10, packageType: 'CT', ...extra
  };
}

/** Datos base de una sumaria de entrada viable. */
function base(extra = {}) {
  return {
    lrn: 'LRN-ENS-001', carrierEORI: 'ESB22477020', entryOffice: 'ES000851',
    transportMode: '4', transportId: 'FLIGHT-IB123', transportCountry: 'ES',
    consignment: { grossMass: 600, numberOfPackages: 10 },
    houseConsignments: [house()],
    ...extra
  };
}

describe('buildENSDeclarationXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC315A legacy', () => {
    const xml = buildENSDeclarationXML(base());

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC315A');
    expect(xml).toContain('<MesTypMES20>CC315A</MesTypMES20>');
    expect(xml).toContain('<MesRecMES6>NICA.ES</MesRecMES6>');
  });

  test('el numero de referencia cae al transactionId cuando no hay LRN', () => {
    const xml = buildENSDeclarationXML(base({ lrn: '' }));
    expect(xml).toMatch(/<RefNumHEA4>.+<\/RefNumHEA4>/);
  });

  test('respeta el LRN explicito', () => {
    const xml = buildENSDeclarationXML(base({ lrn: 'LRN-XYZ' }));
    expect(xml).toContain('<RefNumHEA4>LRN-XYZ</RefNumHEA4>');
  });

  test('el indicador de test es 1 por defecto y 0 si test:false', () => {
    expect(buildENSDeclarationXML(base())).toContain('<TesIndMES18>1</TesIndMES18>');
    expect(buildENSDeclarationXML(base({ test: false }))).toContain('<TesIndMES18>0</TesIndMES18>');
  });

  test('las fechas de preparacion tienen la forma AAMMDD (6) y HHMM (4)', () => {
    const xml = buildENSDeclarationXML(base());

    expect(xml).toMatch(/<DatOfPreMES9>\d{6}<\/DatOfPreMES9>/);
    expect(xml).toMatch(/<TimOfPreMES10>\d{4}<\/TimOfPreMES10>/);
    // La fecha esperada de llegada es AAAAMMDDHHMM (12 digitos).
    expect(xml).toMatch(/<ExpDatOfArrFIRENT733>\d{12}<\/ExpDatOfArrFIRENT733>/);
  });

  test('el lugar de declaracion son los dos primeros digitos de la aduana de entrada', () => {
    const xml = buildENSDeclarationXML(base({ entryOffice: 'FR001300' }));
    expect(xml).toContain('<DecPlaHEA394>FR</DecPlaHEA394>');
  });
});

describe('mapa de modo de transporte y regla del ferrocarril', () => {
  test('mapea los modos por nombre (SEA->1, RAIL->2, ROAD->3, AIR->4)', () => {
    expect(buildENSDeclarationXML(base({ transportMode: 'SEA' }))).toContain('<TraModAtBorHEA76>1</TraModAtBorHEA76>');
    expect(buildENSDeclarationXML(base({ transportMode: 'ROAD' }))).toContain('<TraModAtBorHEA76>3</TraModAtBorHEA76>');
    expect(buildENSDeclarationXML(base({ transportMode: 'AIR' }))).toContain('<TraModAtBorHEA76>4</TraModAtBorHEA76>');
  });

  test('acepta el modo ya en codigo numerico', () => {
    expect(buildENSDeclarationXML(base({ transportMode: '3' }))).toContain('<TraModAtBorHEA76>3</TraModAtBorHEA76>');
  });

  test('un modo desconocido cae a aereo (4)', () => {
    expect(buildENSDeclarationXML(base({ transportMode: 'COHETE' }))).toContain('<TraModAtBorHEA76>4</TraModAtBorHEA76>');
  });

  test('el ferrocarril (modo 2) omite la nacionalidad del medio de transporte', () => {
    const rail = buildENSDeclarationXML(base({ transportMode: 'RAIL', transportCountry: 'FR' }));
    const road = buildENSDeclarationXML(base({ transportMode: 'ROAD', transportCountry: 'FR' }));

    expect(rail).not.toContain('<NatOfMeaOfTraCroHEA87>');
    expect(road).toContain('<NatOfMeaOfTraCroHEA87>FR</NatOfMeaOfTraCroHEA87>');
  });
});

describe('MesSenMES3: remitente del mensaje = declarante, no transportista', () => {
  // AEAT rechazo un envio real a PRE con CC316A "MES.MesSenMES3: ESA12345678-Message
  // Sender is not valid": MesSenMES3 identifica a quien FIRMA y envia el mensaje (el
  // titular del certificado), no al transportista, que ya viaja en TRAREP/PERLODSUMDEC.
  // Las 4 ENS aceptadas antes lo estaban por coincidencia: su carrier.eori era el
  // propio ESB22477020. Con un transportista de terceros AEAT rechaza siempre.
  test('usa el senderEORI recibido y no el del transportista', () => {
    const xml = buildENSDeclarationXML(base({
      senderEORI: 'ESB22477020', carrierEORI: 'ESA12345678', carrierName: 'Transportes Demo SL'
    }));

    expect(xml).toContain('<MesSenMES3>ESB22477020</MesSenMES3>');
    expect(xml).not.toContain('<MesSenMES3>ESA12345678</MesSenMES3>');
    // El transportista sigue declarado en su sitio.
    expect(xml).toContain('<TINTRE1>ESA12345678</TINTRE1>');
    expect(xml).toContain('<TINPLD1>ESA12345678</TINPLD1>');
  });

  test('sin senderEORI cae al declarante de la configuracion, nunca al transportista', () => {
    const xml = buildENSDeclarationXML(base({ senderEORI: '', carrierEORI: 'ESA12345678' }));

    expect(xml).toContain(`<MesSenMES3>${process.env.DECLARANTE_EORI || 'ESB22477020'}</MesSenMES3>`);
  });
});

describe('regla C501: EORI del transportista excluye su nombre', () => {
  test('con EORI del transportista NO se emite NamTRE1', () => {
    const xml = buildENSDeclarationXML(base({ carrierEORI: 'ESB22477020', carrierName: 'Ignorado SL' }));

    expect(xml).toContain('<TINTRE1>ESB22477020</TINTRE1>');
    expect(xml).not.toContain('<NamTRE1>');
  });

  test('sin EORI del transportista se emite NamTRE1', () => {
    const xml = buildENSDeclarationXML(base({ carrierEORI: '', carrierName: 'Naviera SA' }));

    expect(xml).toContain('<NamTRE1>Naviera SA</NamTRE1>');
  });
});

describe('totales de la cabecera', () => {
  test('la masa bruta total sale del consignment si viene', () => {
    const xml = buildENSDeclarationXML(base({ consignment: { grossMass: 1234, numberOfPackages: 7 } }));

    expect(xml).toContain('<TotGroMasHEA307>1234.000</TotGroMasHEA307>');
    expect(xml).toContain('<TotNumOfPacHEA306>7</TotNumOfPacHEA306>');
  });

  test('sin consignment la masa y los bultos se suman de los houses', () => {
    const xml = buildENSDeclarationXML(base({
      consignment: {},
      houseConsignments: [house({ grossMass: 300, numberOfPackages: 4 }), house({ grossMass: 200, numberOfPackages: 6 })]
    }));

    expect(xml).toContain('<TotGroMasHEA307>500.000</TotGroMasHEA307>');
    expect(xml).toContain('<TotNumOfPacHEA306>10</TotNumOfPacHEA306>');
  });

  test('el numero total de items es el numero de houses', () => {
    const xml = buildENSDeclarationXML(base({ houseConsignments: [house(), house(), house()] }));
    expect(xml).toContain('<TotNumOfIteHEA305>3</TotNumOfIteHEA305>');
  });

  test('sin houses el numero de items y de bultos caen a 1', () => {
    const xml = buildENSDeclarationXML(base({ houseConsignments: [], consignment: {} }));
    expect(xml).toContain('<TotNumOfIteHEA305>1</TotNumOfIteHEA305>');
    expect(xml).toContain('<TotNumOfPacHEA306>1</TotNumOfPacHEA306>');
  });
});

describe('GOOITEGDS: partidas de mercancia', () => {
  test('numera las partidas y trunca el codigo de mercancia a 6 y la descripcion a 280', () => {
    const largo = 'D'.repeat(400);
    const xml = buildENSDeclarationXML(base({
      houseConsignments: [house({ goodsDescription: largo, commodityCode: '6109100010' })]
    }));

    expect(xml).toContain('<IteNumGDS7>1</IteNumGDS7>');
    expect(xml).toContain('<ComNomCMD1>610910</ComNomCMD1>');
    expect(xml).toContain('<GooDesGDS23>' + 'D'.repeat(280) + '</GooDesGDS23>');
  });

  test('la descripcion cae a la del primer good si no hay goodsDescription', () => {
    const xml = buildENSDeclarationXML(base({
      houseConsignments: [{ grossMass: 100, numberOfPackages: 1, goods: [{ description: 'Zapatos', commodityCode: '6403000000' }] }]
    }));

    expect(xml).toContain('<GooDesGDS23>Zapatos</GooDesGDS23>');
    expect(xml).toContain('<ComNomCMD1>640300</ComNomCMD1>');
  });

  test('emite lugar de carga y descarga solo si vienen', () => {
    const con = buildENSDeclarationXML(base({
      houseConsignments: [house({ placeOfLoading: 'Shanghai', placeOfUnloading: 'Valencia' })]
    }));
    const sin = buildENSDeclarationXML(base());

    expect(con).toContain('<PlaLoaGOOITE333>Shanghai</PlaLoaGOOITE333>');
    expect(con).toContain('<PlaUnlGOOITE333>Valencia</PlaUnlGOOITE333>');
    expect(sin).not.toContain('<PlaLoaGOOITE333>');
    expect(sin).not.toContain('<PlaUnlGOOITE333>');
  });

  test('la referencia comercial cae a REF-<n> si hay descripcion pero no referencia', () => {
    const xml = buildENSDeclarationXML(base({ houseConsignments: [house({ commercialReference: '' })] }));
    expect(xml).toContain('<ComRefNumGIM1>REF-1</ComRefNumGIM1>');
  });

  test('respeta la referencia comercial explicita', () => {
    const xml = buildENSDeclarationXML(base({ houseConsignments: [house({ commercialReference: 'INV-2026-9' })] }));
    expect(xml).toContain('<ComRefNumGIM1>INV-2026-9</ComRefNumGIM1>');
  });

  test('expedidor y destinatario caen a valores por defecto si faltan', () => {
    const xml = buildENSDeclarationXML(base({ houseConsignments: [house()], originCountry: 'CN' }));

    expect(xml).toContain('<NamCO27>Expedidor</NamCO27>');
    expect(xml).toContain('<CouCO225>CN</CouCO225>'); // cae a originCountry
    expect(xml).toContain('<NamCE27>Destinatario</NamCE27>');
    expect(xml).toContain('<CouCE225>ES</CouCE225>'); // destinatario por defecto ES
  });

  test('lee la direccion del expedidor tanto plana como anidada en address', () => {
    const plano = buildENSDeclarationXML(base({
      houseConsignments: [house({ consignor: { name: 'Fabrica', street: 'Calle A', postcode: '12345', city: 'Lodz', country: 'PL' } })]
    }));
    const anidado = buildENSDeclarationXML(base({
      houseConsignments: [house({ consignor: { name: 'Fabrica', address: { street: 'Calle B', postcode: '54321', city: 'Wroclaw', country: 'PL' } } })]
    }));

    expect(plano).toContain('<StrAndNumCO222>Calle A</StrAndNumCO222>');
    expect(plano).toContain('<PosCodCO223>12345</PosCodCO223>');
    expect(anidado).toContain('<StrAndNumCO222>Calle B</StrAndNumCO222>');
    expect(anidado).toContain('<CitCO224>Wroclaw</CitCO224>');
  });

  test('emite el contenedor solo si el consignment trae numero de contenedor', () => {
    const con = buildENSDeclarationXML(base({ consignment: { grossMass: 600, numberOfPackages: 10, containerNumber: 'MSKU1234567' } }));
    const sin = buildENSDeclarationXML(base());

    expect(con).toContain('<ConNumNR21>MSKU1234567</ConNumNR21>');
    expect(sin).not.toContain('<CONNR2>');
  });

  test('emite las marcas de bultos solo si vienen', () => {
    const con = buildENSDeclarationXML(base({ houseConsignments: [house({ marksOfPackages: 'PALLET-A' })] }));
    const sin = buildENSDeclarationXML(base());

    expect(con).toContain('<MarNumOfPacGSL21>PALLET-A</MarNumOfPacGSL21>');
    expect(sin).not.toContain('<MarNumOfPacGSL21>');
  });

  test('el bulto cae a PK y 1 si no se dan', () => {
    const xml = buildENSDeclarationXML(base({
      houseConsignments: [{ goodsDescription: 'x', commodityCode: '1', grossMass: 1 }]
    }));

    expect(xml).toContain('<KinOfPacGS23>PK</KinOfPacGS23>');
    expect(xml).toContain('<NumOfPacGS24>1</NumOfPacGS24>');
  });

  test('varios houses generan varios GOOITEGDS numerados', () => {
    const xml = buildENSDeclarationXML(base({ houseConsignments: [house(), house(), house()] }));
    expect((xml.match(/<GOOITEGDS>/g) || []).length).toBe(3);
    expect(xml).toContain('<IteNumGDS7>3</IteNumGDS7>');
  });
});

describe('itinerario de paises', () => {
  test('un itinerario explicito emite un ITI por pais', () => {
    const xml = buildENSDeclarationXML(base({ itinerary: ['CN', 'SG', 'ES'] }));

    expect((xml.match(/<CouOfRouCodITI1>/g) || []).length).toBe(3);
    expect(xml).toContain('<CouOfRouCodITI1>CN</CouOfRouCodITI1>');
    expect(xml).toContain('<CouOfRouCodITI1>SG</CouOfRouCodITI1>');
  });

  test('sin itinerario emite el pais del expedidor del primer house y ES', () => {
    const xml = buildENSDeclarationXML(base({
      itinerary: [],
      houseConsignments: [house({ consignor: { country: 'CN' } })]
    }));

    expect(xml).toContain('<CouOfRouCodITI1>CN</CouOfRouCodITI1>');
    expect(xml).toContain('<CouOfRouCodITI1>ES</CouOfRouCodITI1>');
    expect((xml.match(/<CouOfRouCodITI1>/g) || []).length).toBe(2);
  });

  test('sin itinerario ni pais del expedidor cae a CN por defecto', () => {
    const xml = buildENSDeclarationXML(base({ itinerary: [], houseConsignments: [house({ consignor: undefined })] }));
    expect(xml).toContain('<CouOfRouCodITI1>CN</CouOfRouCodITI1>');
  });
});
