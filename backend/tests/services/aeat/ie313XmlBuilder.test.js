/**
 * ie313XmlBuilder: XML de rectificacion de una ENS (mensaje IE313 / CC313A,
 * formato IE313V5 unqualified) para la AEAT. Se usa para enmendar una sumaria de
 * entrada antes de que la mercancia llegue.
 *
 * Generador PURO —sin BD ni red—: genera su propio transactionId con Date y
 * Math.random, pero no hace I/O. Las ramas relevantes son los defaults de cada
 * partida rectificada y los totales agregados (numero de items, bultos y masa
 * bruta via reduce). No se asertan fecha ni id exactos (dependen del reloj y del
 * azar), solo su forma y las ramas.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 *
 * `base()` incluye los datos que el CC313A exige y que NO se pueden inventar (modo
 * de transporte y fecha prevista de llegada): son de la ENS que se rectifica, y sin
 * ellos el builder lanza en vez de declarar un dato falso ante la aduana.
 */

const { buildIE313AmendmentXML } = require('../../../src/services/aeat/ie313XmlBuilder');

/** Datos minimos aceptables: los obligatorios que salen de la ENS rectificada. */
function base(extra = {}) {
  return { mrn: '26ESX', transportMode: 'RAIL', expectedArrival: '2026-09-01T08:30:00.000Z', ...extra };
}

/** Una partida rectificada minima. */
function item(extra = {}) {
  return { description: 'Textil', commodityCode: '6109100010', grossWeight: 300, numberOfPackages: 5, packageType: 'CT', ...extra };
}

describe('buildIE313AmendmentXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC313A', () => {
    const xml = buildIE313AmendmentXML(base({ mrn: '26ES00085123456789' }));

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<MesTypMES20>CC313A</MesTypMES20>');
    expect(xml).toContain('<MesRecMES6>NICA.ES</MesRecMES6>');
  });

  /**
   * AEAT PRE rechazo una rectificacion real (8/Ago/2026) con
   * CD917B / XMLERR805 "Invalid XML format" + "Invalid NameSpace", errCod 52,
   * senalando linea 4 columna 148: el elemento raiz. Tres defectos a la vez:
   *   1. El namespace apuntaba a /static_files/common/... cuando la familia ENS
   *      (enswsv5) vive en /ADUA/internet/es/aeat/dit/adu/... — el IE315 que SI
   *      acepta AEAT usa esa ruta.
   *   2. Envolvia el CC313A dentro de <ent:IE313V5Ent>. El IE315V5 que funciona
   *      pone <ent:CC315A> como raiz directa, sin envoltorio Ent.
   *   3. <MesRecMES6> era 'NECA.ES'; el receptor del canal ENS es 'NICA.ES'
   *      (lo confirma el <MesSenMES3>NICA.ES</MesSenMES3> de todo CC328A real).
   * Sin esto, NINGUNA rectificacion de ENS podia llegar nunca a AEAT.
   */
  test('la raiz es <ent:CC313A> con el namespace ADUA de enswsv5 (no un envoltorio Ent)', () => {
    const xml = buildIE313AmendmentXML(base({ mrn: '26ES00085123456789' }));

    expect(xml).toContain('<ent:CC313A xmlns:ent="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE313V5Ent.xsd">');
    expect(xml).toContain('</ent:CC313A>');
    expect(xml).not.toContain('IE313V5Ent xmlns');
    expect(xml).not.toContain('static_files');
  });

  test('marca el indicador de entorno de pruebas como hace el IE315', () => {
    expect(buildIE313AmendmentXML(base({ test: true }))).toContain('<TesIndMES18>1</TesIndMES18>');
    expect(buildIE313AmendmentXML(base({ test: false }))).toContain('<TesIndMES18>0</TesIndMES18>');
  });

  // MesIdeMES19 es an..14 en el esquema ENS: el transactionId de 24 digitos que
  // generaba el builder desbordaba el tipo.
  test('el identificador de mensaje no pasa de 14 caracteres', () => {
    const xml = buildIE313AmendmentXML(base());
    const ide = (xml.match(/<MesIdeMES19>([^<]*)</) || [])[1];
    expect(ide.length).toBeLessThanOrEqual(14);
  });

  test('vuelca el MRN original, la aduana de entrada y el transportista', () => {
    const xml = buildIE313AmendmentXML(base({ entryOffice: 'ES000851', carrierEORI: 'ESB22477020', carrierName: 'Naviera SA' }));

    expect(xml).toContain('<DocNumHEA5>26ESX</DocNumHEA5>');
    expect(xml).toContain('<RefNumCUSOFFFENT731>ES000851</RefNumCUSOFFFENT731>');
    // El transportista va en TRAREP/PERLODSUMDEC, como en el CC315A.
    expect(xml).toContain('<TINTRE1>ESB22477020</TINTRE1>');
    expect(xml).toContain('<TINPLD1>ESB22477020</TINPLD1>');
    // Regla C501: con EORI presente NO se manda el nombre.
    expect(xml).not.toContain('<NamTRE1>');
  });

  // Regla C501 en su otra rama: sin EORI, el nombre es lo unico que identifica.
  test('sin EORI del transportista se declara su nombre', () => {
    const xml = buildIE313AmendmentXML(base({ carrierName: 'Naviera SA' }));
    expect(xml).toContain('<NamTRE1>Naviera SA</NamTRE1>');
  });

  test('el remitente del mensaje es el declarante que firma, no el transportista', () => {
    const xml = buildIE313AmendmentXML(base({ senderEORI: 'ESB22477020', carrierEORI: 'DE123456789' }));
    expect(xml).toContain('<MesSenMES3>ESB22477020</MesSenMES3>');
  });

  /**
   * Segundo rechazo real de AEAT PRE (8/Ago/2026) tras corregir el namespace:
   * CD917B / XMLERR805 <ErrReaXMLER802>Element too long (length constraint)
   * <OriAttValXMLER804>CC313A,DatOfPreMES9, codigo 39. La fecha iba en AAAAMMDD
   * (8 digitos) y el canal ENS la exige en AAMMDD (6), como el IE315 que AEAT si
   * acepta; la propia respuesta de AEAT se fecha '260808'.
   */
  test('la fecha de preparacion va en AAMMDD (6 digitos), no AAAAMMDD', () => {
    const xml = buildIE313AmendmentXML(base());
    expect(xml).toMatch(/<DatOfPreMES9>\d{6}<\/DatOfPreMES9>/);
    expect(xml).not.toMatch(/<DatOfPreMES9>\d{8}<\/DatOfPreMES9>/);
  });

  // El IE315 declara la hora de preparacion; el IE313 la omitia.
  test('declara la hora de preparacion en HHMM', () => {
    expect(buildIE313AmendmentXML(base())).toMatch(/<TimOfPreMES10>\d{4}<\/TimOfPreMES10>/);
  });

  // AmdPlaHEA598 es el LUGAR de la rectificacion (an..35), NO el motivo. Llevaba el
  // texto libre que teclea el usuario y AEAT lo rechazo con "Element too long
  // (length constraint): CC313A,AmdPlaHEA598": un motivo de 39 caracteres no cabe
  // en un campo de 35, y ademas se estaba declarando un dato que significa otra cosa.
  test('AmdPlaHEA598 declara el lugar, y por defecto el pais de la aduana de entrada', () => {
    expect(buildIE313AmendmentXML(base({ entryOffice: 'ES009999' })))
      .toContain('<AmdPlaHEA598>ES</AmdPlaHEA598>');
    expect(buildIE313AmendmentXML(base({ amendmentPlace: 'MADRID' })))
      .toContain('<AmdPlaHEA598>MADRID</AmdPlaHEA598>');
  });

  test('el lugar de rectificacion se recorta a los 35 caracteres del esquema', () => {
    const xml = buildIE313AmendmentXML(base({ amendmentPlace: 'X'.repeat(60) }));
    expect(xml).toContain(`<AmdPlaHEA598>${'X'.repeat(35)}</AmdPlaHEA598>`);
    expect(xml).not.toContain('X'.repeat(36));
  });

  // El motivo NO viaja: el CC313A no tiene campo para el. Si volviera a colarse en
  // AmdPlaHEA598 se estaria declarando texto libre en el lugar de rectificacion.
  test('el motivo de la rectificacion no se declara a la aduana', () => {
    const xml = buildIE313AmendmentXML(base({ amendmentReason: 'Correccion de peso tras pesaje en origen' }));
    expect(xml).not.toContain('Correccion de peso');
  });

  // AEAT: "Se esperaba nodo DatTimAmeHEA113". La fecha de la rectificacion es
  // obligatoria y va en AAAAMMDDHHMM.
  test('sella la fecha de la rectificacion en DatTimAmeHEA113 (AAAAMMDDHHMM)', () => {
    expect(buildIE313AmendmentXML(base())).toMatch(/<DatTimAmeHEA113>\d{12}<\/DatTimAmeHEA113>/);
  });
});

/**
 * El CC313A lleva datos de la ENS rectificada que NO se pueden rellenar: el modo de
 * transporte estaba FIJO a '1' (maritimo), asi que AEAT rechazaba toda rectificacion
 * con "Las ENS del sector maritimo se deben declarar solo en el sistema ICS2" aunque
 * la sumaria fuese ferroviaria. Antes que declarar un dato inventado, se aborta.
 */
describe('datos que vienen de la ENS y no se pueden inventar', () => {
  test('traduce el modo de transporte declarado', () => {
    expect(buildIE313AmendmentXML(base({ transportMode: 'RAIL' }))).toContain('<TraModAtBorHEA76>2</TraModAtBorHEA76>');
    expect(buildIE313AmendmentXML(base({ transportMode: 'AIR' }))).toContain('<TraModAtBorHEA76>4</TraModAtBorHEA76>');
    expect(buildIE313AmendmentXML(base({ transportMode: 'ROAD' }))).toContain('<TraModAtBorHEA76>3</TraModAtBorHEA76>');
    expect(buildIE313AmendmentXML(base({ transportMode: '4' }))).toContain('<TraModAtBorHEA76>4</TraModAtBorHEA76>');
  });

  test('sin modo de transporte NO envia nada: lanza en vez de declararlo maritimo', () => {
    expect(() => buildIE313AmendmentXML({ mrn: '26ESX', expectedArrival: '2026-09-01T08:30:00Z' }))
      .toThrow(/Modo de transporte no valido/);
    expect(() => buildIE313AmendmentXML(base({ transportMode: 'PIPELINE' })))
      .toThrow(/Modo de transporte no valido/);
  });

  test('sin fecha prevista de llegada lanza en vez de inventarla', () => {
    expect(() => buildIE313AmendmentXML({ mrn: '26ESX', transportMode: 'RAIL' }))
      .toThrow(/fecha prevista de llegada/i);
    expect(() => buildIE313AmendmentXML(base({ expectedArrival: 'no-es-fecha' })))
      .toThrow(/no valida/i);
  });

  test('la fecha prevista de llegada declarada viaja en AAAAMMDDHHMM', () => {
    const xml = buildIE313AmendmentXML(base({ expectedArrival: new Date(2026, 8, 1, 8, 30) }));
    expect(xml).toContain('<ExpDatOfArrFIRENT733>202609010830</ExpDatOfArrFIRENT733>');
  });

  // Regla C017: el medio de transporte que cruza la frontera. La nacionalidad no
  // se declara en ferrocarril, igual que en el CC315A.
  test('declara el medio de transporte y omite su nacionalidad en ferrocarril', () => {
    const rail = buildIE313AmendmentXML(base({ transportMode: 'RAIL', transportId: 'VAG-1', transportCountry: 'ES' }));
    expect(rail).toContain('<IdeOfMeaOfTraCroHEA85>VAG-1</IdeOfMeaOfTraCroHEA85>');
    expect(rail).not.toContain('<NatOfMeaOfTraCroHEA87>');

    const road = buildIE313AmendmentXML(base({ transportMode: 'ROAD', transportId: '1234ABC', transportCountry: 'ES' }));
    expect(road).toContain('<NatOfMeaOfTraCroHEA87>ES</NatOfMeaOfTraCroHEA87>');
  });
});

describe('totales agregados de la cabecera', () => {
  test('sin partidas el numero de items cae a 1 y los totales a 0', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [] }));

    expect(xml).toContain('<TotNumOfIteHEA305>1</TotNumOfIteHEA305>');
    expect(xml).toContain('<TotNumOfPacHEA306>0</TotNumOfPacHEA306>');
    // 3 decimales como en el IE315, el unico de esta familia que AEAT acepta.
    expect(xml).toContain('<TotGroMasHEA307>0.000</TotGroMasHEA307>');
  });

  test('con partidas agrega numero de items, bultos y masa bruta', () => {
    const xml = buildIE313AmendmentXML(base({
      goodsItems: [item({ numberOfPackages: 5, grossWeight: 300 }), item({ numberOfPackages: 3, grossWeight: 200 })]
    }));

    expect(xml).toContain('<TotNumOfIteHEA305>2</TotNumOfIteHEA305>');
    expect(xml).toContain('<TotNumOfPacHEA306>8</TotNumOfPacHEA306>');
    expect(xml).toContain('<TotGroMasHEA307>500.000</TotGroMasHEA307>');
  });

  /**
   * El sequence del XSD es normativo. Los rechazos reales lo fueron acotando:
   *   "Se esperaba nodo TotNumOfIteHEA305 y ha venido AmdPlaHEA598" -> el motivo va
   *   DESPUES de los totales;
   *   "Se esperaba nodo AmdPlaHEA598 y ha venido DecPlaHEA394" -> DecPlaHEA394 no
   *   existe en este HEAHEA, que termina en DatTimAmeHEA113.
   */
  test('AmdPlaHEA598 va tras los totales, y la cabecera cierra en DatTimAmeHEA113', () => {
    const xml = buildIE313AmendmentXML(base({ amendmentPlace: 'ES', goodsItems: [item()] }));

    expect(xml.indexOf('<TotNumOfIteHEA305>')).toBeLessThan(xml.indexOf('<AmdPlaHEA598>'));
    expect(xml.indexOf('<TotGroMasHEA307>')).toBeLessThan(xml.indexOf('<AmdPlaHEA598>'));
    expect(xml.indexOf('<AmdPlaHEA598>')).toBeLessThan(xml.indexOf('<DatTimAmeHEA113>'));
    expect(xml).not.toContain('<DecPlaHEA394>');
  });

  test('los bultos de una partida sin numberOfPackages cuentan como 1 en el total', () => {
    const xml = buildIE313AmendmentXML(base({
      goodsItems: [item({ numberOfPackages: undefined }), item({ numberOfPackages: undefined })]
    }));
    // reduce usa (numberOfPackages || 1) -> 2
    expect(xml).toContain('<TotNumOfPacHEA306>2</TotNumOfPacHEA306>');
  });
});

describe('GOOITEGDS: partidas rectificadas', () => {
  test('numera las partidas y trunca el codigo de mercancia a 6', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [item({ commodityCode: '6109100010' })] }));

    expect(xml).toContain('<IteNumGDS7>1</IteNumGDS7>');
    // La nomenclatura combinada va en COMCODGODITM, como en el CC315A.
    expect(xml).toContain('<ComNomCMD1>610910</ComNomCMD1>');
  });

  test('respeta el sequenceNumber explicito de la partida', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [item({ sequenceNumber: 7 })] }));
    expect(xml).toContain('<IteNumGDS7>7</IteNumGDS7>');
  });

  test('los campos de la partida caen a valores por defecto si faltan', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [{}] }));

    expect(xml).toContain('<GooDesGDS23></GooDesGDS23>');
    expect(xml).toContain('<GroMasGDS46>0.000</GroMasGDS46>');
    expect(xml).toContain('<NumOfPacGS24>1</NumOfPacGS24>');
    expect(xml).toContain('<KinOfPacGS23>PK</KinOfPacGS23>');
    // Regla C062: las marcas de bultos son obligatorias; 'N/M' es el valor
    // normalizado para "sin marcas", el mismo que usa el CC315A aceptado.
    expect(xml).toContain('<MarNumOfPacGSL21>N/M</MarNumOfPacGSL21>');
  });

  /**
   * Reglas C574/C579/C584/C567: el expedidor va DENTRO de la partida (a nivel raiz
   * AEAT lo rechazo con "Not supported in this position: CC313A,<TRACONCO2>"), y con
   * el destinatario, los lugares de carga/descarga y la referencia comercial.
   */
  test('cada partida declara expedidor, destinatario, carga, descarga y referencia', () => {
    const xml = buildIE313AmendmentXML(base({
      goodsItems: [item({
        placeOfLoading: 'CNSHA', placeOfUnloading: 'ESBCN', commercialReference: 'BL-1',
        consignor: { name: 'Shanghai Steel', street: 'Calle 1', postcode: '20000', city: 'Shanghai', country: 'CN' },
        consignee: { name: 'STRIX AI SL', street: 'Gran Via 1', postcode: '28013', city: 'Madrid', country: 'ES' }
      })]
    }));

    expect(xml).toContain('<PlaLoaGOOITE333>CNSHA</PlaLoaGOOITE333>');
    expect(xml).toContain('<PlaUnlGOOITE333>ESBCN</PlaUnlGOOITE333>');
    expect(xml).toContain('<ComRefNumGIM1>BL-1</ComRefNumGIM1>');
    expect(xml).toContain('<NamCO27>Shanghai Steel</NamCO27>');
    expect(xml).toContain('<CouCO225>CN</CouCO225>');
    expect(xml).toContain('<NamCE27>STRIX AI SL</NamCE27>');
    expect(xml).toContain('<CouCE225>ES</CouCE225>');
    // El expedidor NO puede ir a nivel raiz del mensaje.
    expect(xml.indexOf('<TRACONCO2>')).toBeGreaterThan(xml.indexOf('<GOOITEGDS>'));
    expect(xml.indexOf('<TRACONCO2>')).toBeLessThan(xml.indexOf('</GOOITEGDS>'));
  });

  test('el contenedor se declara en la partida solo si la expedicion lo tiene', () => {
    const con = buildIE313AmendmentXML(base({ goodsItems: [item()], consignment: { containerNumber: 'MSCU1234567' } }));
    expect(con).toContain('<ConNumNR21>MSCU1234567</ConNumNR21>');

    expect(buildIE313AmendmentXML(base({ goodsItems: [item()] }))).not.toContain('<CONNR2>');
  });

  test('varias partidas generan varios GOOITEGDS numerados por indice', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [item(), item(), item()] }));

    expect((xml.match(/<GOOITEGDS>/g) || []).length).toBe(3);
    expect(xml).toContain('<IteNumGDS7>3</IteNumGDS7>');
  });
});

/** Reglas C570/R879: AEAT exige el itinerario de paises de la ruta. */
describe('itinerario (ITI)', () => {
  test('declara los paises de ruta dados', () => {
    const xml = buildIE313AmendmentXML(base({ itinerary: ['CN', 'FR', 'ES'] }));

    expect((xml.match(/<ITI>/g) || []).length).toBe(3);
    expect(xml).toContain('<CouOfRouCodITI1>FR</CouOfRouCodITI1>');
  });

  test('sin itinerario explicito declara el pais del expedidor y ES', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [item({ consignor: { country: 'CN' } })] }));

    expect((xml.match(/<ITI>/g) || []).length).toBe(2);
    expect(xml).toContain('<CouOfRouCodITI1>CN</CouOfRouCodITI1>');
    expect(xml).toContain('<CouOfRouCodITI1>ES</CouOfRouCodITI1>');
  });

  // El itinerario va DESPUES de las partidas, como en el CC315A.
  test('el itinerario va tras las partidas y antes del transportista', () => {
    const xml = buildIE313AmendmentXML(base({ goodsItems: [item()] }));

    expect(xml.indexOf('</GOOITEGDS>')).toBeLessThan(xml.indexOf('<ITI>'));
    expect(xml.indexOf('<ITI>')).toBeLessThan(xml.indexOf('<TRAREP>'));
  });
});
