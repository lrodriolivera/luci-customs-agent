/**
 * h7Generator: declaracion H7 (importacion simplificada bajo valor, <= 150 EUR).
 *
 * Es la via de despacho del e-commerce B2C: envios de bajo valor con IVA
 * cobrado en origen por la plataforma (IOSS) o liquidado en destino. Un H7 mal
 * formado retiene el paquete en frontera; peor aun, colar un envio > 150 EUR o
 * con alcohol/tabaco por H7 es una declaracion invalida ante la AEAT.
 *
 * OJO: es src/services/forms/h7Generator.js, NO src/services/aeat/h7XmlBuilder.js
 * (ese es otro modulo, con otro modelo de datos, ya testeado aparte).
 *
 * Es un generador puro (solo depende de uuid). Nada mockeado salvo el reloj y el
 * uuid cuando hace falta un LRN determinista. El XML que se comprueba es el real.
 */

const h7 = require('../../src/services/forms/h7Generator');

/** Expediente minimo elegible (valor 0, sin bienes). */
function expedicion(extra = {}) {
  return { goods: [], ...extra };
}

describe('isEligibleForH7: elegibilidad', () => {
  test('un envio <= 150 EUR es elegible', () => {
    expect(h7.isEligibleForH7({ goodsSummary: { totalValue: 100 } }).eligible).toBe(true);
  });

  test('un envio > 150 EUR no es elegible y explica el motivo', () => {
    const r = h7.isEligibleForH7({ goodsSummary: { totalValue: 200 } });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/excede limite/i);
  });

  test('sin goodsSummary suma los invoiceValue de goods', () => {
    const r = h7.isEligibleForH7({ goods: [{ invoiceValue: 80 }, { invoiceValue: 90 }] });
    expect(r.eligible).toBe(false); // 170 > 150
  });

  test('sin ningun dato de valor lo trata como 0 (elegible)', () => {
    expect(h7.isEligibleForH7({}).eligible).toBe(true);
  });

  test('el alcohol (cap. 22) no es elegible para H7', () => {
    const r = h7.isEligibleForH7({ goods: [{ taricCode: '2204100000', description: 'Vino' }] });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/no elegibles/i);
  });

  test('el tabaco (cap. 24) no es elegible para H7', () => {
    const r = h7.isEligibleForH7({ goods: [{ hsCode: '240220', description: 'Cigarros' }] });
    expect(r.eligible).toBe(false);
  });
});

describe('checkRestrictedGoods', () => {
  test('sin goods devuelve lista vacia (no revienta con undefined)', () => {
    expect(h7.checkRestrictedGoods(undefined)).toEqual([]);
  });

  test('detecta el capitulo restringido por taricCode', () => {
    expect(h7.checkRestrictedGoods([{ taricCode: '2208300000', description: 'Whisky' }]))
      .toHaveLength(1);
  });

  test('cae al hsCode cuando no hay taricCode', () => {
    expect(h7.checkRestrictedGoods([{ hsCode: '220300', description: 'Cerveza' }]))
      .toHaveLength(1);
  });

  test('un bien normal (cap. 85) no esta restringido', () => {
    expect(h7.checkRestrictedGoods([{ taricCode: '8517120000', description: 'Movil' }]))
      .toEqual([]);
  });

  test('sin codigo alguno no lo marca como restringido', () => {
    expect(h7.checkRestrictedGoods([{ description: 'Sin codigo' }])).toEqual([]);
  });
});

describe('generate: elegibilidad y forzado', () => {
  test('un envio no elegible lanza con el motivo', () => {
    expect(() => h7.generate({ goodsSummary: { totalValue: 200 } }))
      .toThrow(/excede limite/i);
  });

  test('forceGenerate ignora la elegibilidad y genera igual', () => {
    const r = h7.generate({ goodsSummary: { totalValue: 200 } }, { forceGenerate: true });
    expect(r.xml).toMatch(/<TypeCode>H7<\/TypeCode>/);
    expect(r.eligibility.eligible).toBe(false); // se conserva el veredicto real
  });

  test('un expediente vacio genera un H7B (sin IOSS) valido', () => {
    const r = h7.generate({});
    expect(r.data.declarationType).toBe('H7B');
    expect(r.data.h7Type).toBe('40');
    expect(r.data.iossData).toBeNull();
    expect(r.xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  test('devuelve lrn, data, xml, summary y eligibility', () => {
    const r = h7.generate({});
    expect(r).toHaveProperty('lrn');
    expect(r).toHaveProperty('data');
    expect(r).toHaveProperty('xml');
    expect(r).toHaveProperty('summary');
    expect(r).toHaveProperty('eligibility');
  });
});

describe('generateLRN', () => {
  test('empieza por AAESH7 con el ano de dos digitos', () => {
    // El entorno corre en 2026 -> "26ESH7...".
    expect(h7.generateLRN()).toMatch(/^\d{2}ESH7[0-9A-F]{14}$/);
  });

  test('dos LRN consecutivos no coinciden', () => {
    expect(h7.generateLRN()).not.toBe(h7.generateLRN());
  });
});

describe('IOSS: modo A vs modo B', () => {
  test('con iossNumber en options es H7A/I1 y arma el bloque IOSS', () => {
    const r = h7.generate({}, { iossNumber: 'IMES1234567890' });
    expect(r.data.declarationType).toBe('H7A');
    expect(r.data.h7Type).toBe('I1');
    expect(r.data.iossData.isValid).toBe(true);
    expect(r.xml).toMatch(/<IOSSRegistration>/);
    expect(r.xml).toMatch(/<IdentificationNumber>IMES1234567890<\/IdentificationNumber>/);
  });

  test('el IOSS puede venir en ecommerce y tambien activa el modo A', () => {
    const r = h7.generate({ ecommerce: { iossNumber: 'IMDE9876543210' } });
    expect(r.data.declarationType).toBe('H7A');
    expect(r.xml).toMatch(/<IOSSRegistration>/);
  });

  test('un IOSS con formato invalido se marca isValid=false', () => {
    const r = h7.generate({}, { iossNumber: 'INVALIDO' });
    expect(r.data.iossData.isValid).toBe(false);
  });

  // El additionalDeclarationType mira SOLO options.iossNumber, no el de ecommerce.
  // Por eso un IOSS que viene solo por ecommerce da declarationType 'H7A' pero
  // additionalDeclarationType 'B'. Se fija con test para que el desajuste no pase
  // por descuido si alguien toca la cabecera.
  test('IOSS solo en ecommerce: declarationType H7A pero additionalDeclarationType B', () => {
    const h = h7.buildDeclarationHeader({ ecommerce: { iossNumber: 'IMES1234567890' } }, {}, 'LRN1');
    expect(h.additionalDeclarationType).toBe('B');
    expect(h.iossNumber).toBe('IMES1234567890');
  });
});

describe('buildDeclarationHeader: consignatario y declarante', () => {
  test('el id del consignatario usa EORI si existe (y no es persona fisica)', () => {
    const h = h7.buildDeclarationHeader({ client: { eori: 'ES999', name: 'Ana' } }, {}, 'L');
    expect(h.consignee.identificationNumber).toBe('ES999');
    expect(h.consignee.isPrivateIndividual).toBe(false);
  });

  test('sin EORI cae al NIF y marca persona fisica (B2C)', () => {
    const h = h7.buildDeclarationHeader({ client: { nif: '12345678Z', name: 'Ana' } }, {}, 'L');
    expect(h.consignee.identificationNumber).toBe('12345678Z');
    expect(h.consignee.isPrivateIndividual).toBe(true);
  });

  test('sin EORI ni NIF cae al pasaporte', () => {
    const h = h7.buildDeclarationHeader({ client: { passport: 'X123', name: 'Ana' } }, {}, 'L');
    expect(h.consignee.identificationNumber).toBe('X123');
  });

  test('el declarante usa el EORI del representante si existe', () => {
    const h = h7.buildDeclarationHeader({ representative: { eori: 'ESREP1', companyName: 'Rep SL' } }, {}, 'L');
    expect(h.declarant.identificationNumber).toBe('ESREP1');
    expect(h.declarant.name).toBe('Rep SL');
  });

  // Comportamiento sutil documentado: sin representative.eori, el id del
  // declarante es `ES${nif}`; si tampoco hay nif queda 'ESundefined' (el
  // fallback 'ESB12345678' es inalcanzable porque 'ESundefined' es truthy).
  // No es explotable —solo afecta al formato del id del declarante— pero se fija
  // por escrito para que no se de por hecho que el fallback funciona.
  test('sin EORI del representante compone ES + nif', () => {
    const h = h7.buildDeclarationHeader({ representative: { nif: 'B111' } }, {}, 'L');
    expect(h.declarant.identificationNumber).toBe('ESB111');
  });

  test('sin representante alguno el id del declarante es "ESundefined" (fallback inalcanzable)', () => {
    const h = h7.buildDeclarationHeader({}, {}, 'L');
    expect(h.declarant.identificationNumber).toBe('ESundefined');
    expect(h.declarant.name).toBe('STRIX AI SL'); // este fallback SI se alcanza
  });

  test('sin exporter no hay vendedor (seller null)', () => {
    const h = h7.buildDeclarationHeader({}, {}, 'L');
    expect(h.seller).toBeNull();
  });

  test('con exporter arma el vendedor', () => {
    const h = h7.buildDeclarationHeader({ exporter: { companyName: 'China Co', country: 'CN' } }, {}, 'L');
    expect(h.seller.name).toBe('China Co');
  });
});

describe('buildShipment', () => {
  test('el pais de origen usa exporter.country primero', () => {
    const s = h7.buildShipment({ exporter: { country: 'IN' } }, {});
    expect(s.countryOfDispatch).toBe('IN');
  });

  test('sin exporter usa options.originCountry, y sin nada CN por defecto', () => {
    expect(h7.buildShipment({}, { originCountry: 'US' }).countryOfDispatch).toBe('US');
    expect(h7.buildShipment({}, {}).countryOfDispatch).toBe('CN');
  });

  test('modo aereo usa documento N740; el resto N770', () => {
    expect(h7.buildShipment({ transportMode: 'air' }, {}).transportDocument.type).toBe('N740');
    expect(h7.buildShipment({ transportMode: 'postal' }, {}).transportDocument.type).toBe('N770');
  });

  test('el tracking cae de transport a ecommerce', () => {
    expect(h7.buildShipment({ transport: { trackingNumber: 'T1' } }, {}).trackingNumber).toBe('T1');
    expect(h7.buildShipment({ ecommerce: { trackingNumber: 'E1' } }, {}).trackingNumber).toBe('E1');
  });
});

describe('buildGoodsItem', () => {
  test('sin goods usa el codigo de relleno 999999 y descripcion generica', () => {
    const item = h7.buildGoodsItem({ goods: [] }, {});
    expect(item.commodityCode.hsCode).toBe('999999');
    expect(item.goodsDescription).toBe('Mercancias varias');
  });

  test('un solo item: el simplifiedCode es el propio taricCode', () => {
    const item = h7.buildGoodsItem({ goods: [{ taricCode: '6109100010', invoiceValue: 50, description: 'Camiseta' }] }, {});
    expect(item.commodityCode.simplifiedCode).toBe('6109100010');
  });

  test('varios items: el simplifiedCode agregado es 99999999', () => {
    const item = h7.buildGoodsItem({ goods: [
      { taricCode: '6109100010', invoiceValue: 50, description: 'A' },
      { taricCode: '6505000000', invoiceValue: 40, description: 'B' }
    ] }, {});
    expect(item.commodityCode.simplifiedCode).toBe('99999999');
  });

  test('el item principal es el de mayor valor', () => {
    const item = h7.buildGoodsItem({ goods: [
      { taricCode: '1111111111', invoiceValue: 10, description: 'barato', originCountry: 'IN' },
      { taricCode: '2222222222', invoiceValue: 90, description: 'caro', originCountry: 'CN' }
    ] }, {});
    expect(item.countryOfOrigin).toBe('CN'); // el del caro
  });

  test('el hsCode sale de los 6 primeros digitos del taric cuando no hay hsCode', () => {
    const item = h7.buildGoodsItem({ goods: [{ taricCode: '6109100010', invoiceValue: 50, description: 'X' }] }, {});
    expect(item.commodityCode.hsCode).toBe('610910');
  });

  test('totalPackages sale de goodsSummary si esta, o cuenta 1 por item', () => {
    expect(h7.buildGoodsItem({ goods: [{ invoiceValue: 1 }], goodsSummary: { totalPackages: 7 } }, {}).numberOfPackages).toBe(7);
    expect(h7.buildGoodsItem({ goods: [{ invoiceValue: 1 }, { invoiceValue: 2 }] }, {}).numberOfPackages).toBe(2);
  });
});

describe('calculateIntrinsicValue', () => {
  test('resta flete y seguro del valor total', () => {
    expect(h7.calculateIntrinsicValue({ goodsSummary: { totalValue: 100 }, costs: { freight: 5, insurance: 2 } }))
      .toBe(93);
  });

  test('nunca es negativo (flete+seguro > valor -> 0)', () => {
    expect(h7.calculateIntrinsicValue({ goodsSummary: { totalValue: 10 }, costs: { freight: 8, insurance: 5 } }))
      .toBe(0);
  });
});

describe('calculateVAT', () => {
  test('sin IOSS liquida IVA al 21% por defecto', () => {
    const v = h7.calculateVAT({ goodsSummary: { totalValue: 100 } }, {});
    expect(v.vatRate).toBe(21);
    expect(v.vatAmount).toBeCloseTo(21);
    expect(v.vatAlreadyPaid).toBe(false);
    expect(v.totalToPay).toBeCloseTo(21);
  });

  test('con IOSS el IVA ya esta pagado (importe 0)', () => {
    const v = h7.calculateVAT({ goodsSummary: { totalValue: 100 } }, { iossNumber: 'IMES1234567890' });
    expect(v.vatAmount).toBe(0);
    expect(v.vatAlreadyPaid).toBe(true);
    expect(v.totalToPay).toBe(0);
  });

  test('respeta un vatRate distinto (10%)', () => {
    const v = h7.calculateVAT({ goodsSummary: { totalValue: 100 } }, { vatRate: 0.10 });
    expect(v.vatRate).toBe(10);
    expect(v.vatAmount).toBeCloseTo(10);
  });

  test('el arancel siempre es 0 y exento en H7', () => {
    const v = h7.calculateVAT({ goodsSummary: { totalValue: 100 } }, {});
    expect(v.dutyAmount).toBe(0);
    expect(v.dutyExempt).toBe(true);
  });
});

describe('buildAggregatedDescription', () => {
  test('sin items: "Mercancias varias"', () => {
    expect(h7.buildAggregatedDescription([])).toBe('Mercancias varias');
  });

  test('un item: su descripcion tal cual', () => {
    expect(h7.buildAggregatedDescription([{ description: 'Camiseta' }])).toBe('Camiseta');
  });

  test('tres items exactos: los une sin sufijo', () => {
    expect(h7.buildAggregatedDescription([{ description: 'A' }, { description: 'B' }, { description: 'C' }]))
      .toBe('A, B, C');
  });

  test('mas de tres: los primeros 3 y "y N articulo(s) mas"', () => {
    const d = h7.buildAggregatedDescription([
      { description: 'A' }, { description: 'B' }, { description: 'C' }, { description: 'D' }, { description: 'E' }
    ]);
    expect(d).toBe('A, B, C y 2 articulo(s) mas');
  });

  test('trunca a 200 caracteres', () => {
    const larga = 'X'.repeat(150);
    const d = h7.buildAggregatedDescription([{ description: larga }, { description: larga }]);
    expect(d.length).toBe(200);
  });
});

describe('determineCustomsOffice', () => {
  test.each([
    ['08001', 'ES002805'], // Barcelona
    ['28001', 'ES002101'], // Madrid
    ['46001', 'ES004601'], // Valencia
    ['35001', 'ES003501'], // Las Palmas
    ['38001', 'ES003801'], // Tenerife
    ['11001', 'ES003001']  // Algeciras
  ])('CP %s -> aduana %s', (cp, oficina) => {
    expect(h7.determineCustomsOffice({ client: { address: { postalCode: cp } } })).toBe(oficina);
  });

  test('un CP desconocido cae a Madrid por defecto', () => {
    expect(h7.determineCustomsOffice({ client: { address: { postalCode: '99999' } } })).toBe('ES002101');
  });

  test('sin CP cae a Madrid por defecto', () => {
    expect(h7.determineCustomsOffice({})).toBe('ES002101');
  });
});

describe('getTransportModeCode', () => {
  test.each([
    ['postal', '5'],
    ['air', '4'],
    ['express', '4'],
    ['road', '3'],
    ['desconocido', '5']
  ])('%s -> %s', (modo, codigo) => {
    expect(h7.getTransportModeCode(modo)).toBe(codigo);
  });
});

describe('escapeXml', () => {
  test('escapa los cinco caracteres especiales', () => {
    expect(h7.escapeXml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;');
  });

  test('con valor vacio o nulo devuelve cadena vacia', () => {
    expect(h7.escapeXml('')).toBe('');
    expect(h7.escapeXml(null)).toBe('');
    expect(h7.escapeXml(undefined)).toBe('');
  });
});

describe('generateXML: estructura del mensaje', () => {
  const completa = {
    goodsSummary: { totalValue: 120, totalPackages: 4 },
    goods: [
      { description: 'Camiseta', invoiceValue: 50, grossWeight: 0.3, taricCode: '6109100010', originCountry: 'CN', quantity: 2, packages: { quantity: 2 } },
      { description: 'Gorra', invoiceValue: 40, grossWeight: 0.2, hsCode: '650500', originCountry: 'IN', quantity: 1 },
      { description: 'Calcetines & mas', invoiceValue: 20, grossWeight: 0.1, taricCode: '6115960000' },
      { description: 'Bufanda', invoiceValue: 10, grossWeight: 0.1, taricCode: '6117100000' }
    ],
    client: { eori: 'ES12345678', companyName: 'Cliente SL', address: { street: 'Gran Via 1', city: 'Barcelona', postalCode: '08001' } },
    representative: { eori: 'ESREP999', companyName: 'Rep Aduanero SL' },
    exporter: { companyName: 'China Trade Co', address: 'Main St 1', city: 'Shenzhen', country: 'CN' },
    ecommerce: { iossNumber: 'IMES1234567890', platform: 'Amazon', trackingNumber: 'TRK123' },
    transport: { documentNumber: 'AWB-1', trackingNumber: 'TRK-DOC' },
    transportMode: 'air',
    costs: { freight: 5, insurance: 2 }
  };

  test('modo IOSS + B2B + multi-item: bloques presentes y sin & sin escapar', () => {
    const r = h7.generate(completa, { iossNumber: 'IMES1234567890', customsOffice: 'ES002805', vatRate: 0.10 });
    const xml = r.xml;
    expect(xml).toMatch(/<IOSSRegistration>/);
    expect(xml).toMatch(/<Seller>/);
    expect(xml).toMatch(/<TrackingID>TRK-DOC<\/TrackingID>/);
    expect(xml).toMatch(/<VATAlreadyPaidIndicator>1<\/VATAlreadyPaidIndicator>/);
    expect(xml).not.toMatch(/<PersonTypeCode>/); // B2B (tiene eori)
    expect(xml).toMatch(/<ID>99999999<\/ID>/); // codigo simplificado multi-item
    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#);)/); // "Calcetines & mas" escapado
  });

  test('modo B2C sin IOSS: PersonTypeCode presente, sin seller, IVA a pagar', () => {
    const r = h7.generate({
      goodsSummary: { totalValue: 50 },
      goods: [{ description: 'Libro', invoiceValue: 50, taricCode: '4901990000' }],
      client: { passport: 'X1', name: 'Ana', address: { postalCode: '28001' } },
      transportMode: 'postal'
    }, {});
    const xml = r.xml;
    expect(xml).toMatch(/<PersonTypeCode>1<\/PersonTypeCode>/);
    expect(xml).not.toMatch(/<Seller>/);
    expect(xml).not.toMatch(/<IOSSRegistration>/);
    expect(xml).not.toMatch(/<VATAlreadyPaidIndicator>/);
    expect(xml).toMatch(/<VATAmount currencyID="EUR">10\.50<\/VATAmount>/); // 50 * 0.21
  });
});

describe('calculateSummary', () => {
  test('modo IOSS: resumen con hasIOSS, aduana conocida y despacho < 1 hora', () => {
    const r = h7.generate({
      goodsSummary: { totalValue: 100 },
      client: { eori: 'ES1', address: { postalCode: '08001' } },
      transportMode: 'air'
    }, { iossNumber: 'IMES1234567890', customsOffice: 'ES002805' });
    const s = r.summary;
    expect(s.hasIOSS).toBe(true);
    expect(s.customsOfficeName).toBe('Barcelona - Aeropuerto El Prat');
    expect(s.transportMode).toBe('Express'); // modo air -> codigo 4 -> no '5'
    expect(s.estimatedClearanceTime).toBe('< 1 hora');
    expect(s.isB2C).toBe(false);
  });

  test('modo postal sin IOSS: resumen Postal, sin IOSS, despacho 1-4 horas', () => {
    const r = h7.generate({
      goodsSummary: { totalValue: 30 },
      client: { passport: 'X', address: { postalCode: '00000' } },
      transportMode: 'postal'
    }, {});
    const s = r.summary;
    expect(s.hasIOSS).toBe(false);
    expect(s.transportMode).toBe('Postal'); // codigo '5'
    // CP 00 no mapeado -> aduana por defecto ES002101 (Madrid - Barajas), que SI
    // es una oficina conocida: por eso el nombre no es "Desconocido".
    expect(s.customsOffice).toBe('ES002101');
    expect(s.customsOfficeName).toBe('Madrid - Barajas');
    expect(s.estimatedClearanceTime).toBe('1-4 horas');
    expect(s.isB2C).toBe(true);
  });

  test('una aduana forzada fuera del catalogo se resuelve como "Desconocido"', () => {
    // customsOffice del options entra tal cual en la cabecera; si no esta en
    // H7_CUSTOMS_OFFICES, el nombre cae al literal por defecto.
    const r = h7.generate({ goodsSummary: { totalValue: 10 } }, { customsOffice: 'ESRARO99' });
    expect(r.summary.customsOfficeName).toBe('Desconocido');
  });
});
