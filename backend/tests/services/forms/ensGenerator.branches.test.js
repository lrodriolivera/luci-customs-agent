/**
 * ensGenerator.branches: cobertura de RAMAS no tomadas del generador ENS.
 *
 * El test principal (ensGenerator.test.js) cubre la funcionalidad basica,
 * pero muchas ramas condicionales quedan sin tomar. Este fichero construye
 * inputs especificos para disparar:
 *
 * - Bloques opcionales presentes vs ausentes (entryOffice, carrier, transportMeans,
 *   consignment, consignor, consignee, address, notifyParty, etc.)
 * - Campos opcionales dentro de cada bloque (expectedArrival, name, address,
 *   contactPerson, sealNumber, referenceType, countryOfDispatch/Destination, ucr,
 *   quantity, unitOfMeasure, countryOfOrigin, numberOfPackages, kindOfPackages,
 *   marksAndNumbers, eori, etc.)
 * - Variantes de modo de transporte e identificacion
 * - House consignments con/sin consignor/consignee/notifyParty
 *
 * Las lineas sin cubrir del reporte (110,112,114,118-120,240,245,258-259,267,
 * 276,285,290,297,299-301,313-316,328-331,339,343-346,354,360-364,366-367,377,
 * 388,390-392,402) corresponden a estas ramas opcionales.
 */

const ensGenerator = require('../../../src/services/forms/ensGenerator');

/** Declaracion ENS minima. */
function base(extra = {}) {
  return {
    lrn: 'LRN-TEST',
    entryOffice: { code: 'ES000851' },
    carrier: { eori: 'ESB22477020' },
    transportMeans: { identification: 'TEST123', identificationType: 'VEHICLE_REGISTRATION' },
    transportMode: 'ROAD',
    consignment: {
      referenceNumber: 'REF-1', grossMass: 1000, numberOfPackages: 5,
      goodsDescription: 'Mercancia de prueba'
    },
    goods: [{ description: 'Item', commodityCode: '0901210000', grossMass: 500 }],
    ...extra
  };
}

describe('generateAmendment: bloques opcionales en amendments', () => {
  test('amendments.entryOffice presente (linea 110)', () => {
    const r = ensGenerator.generateAmendment('MRN-1', {
      reason: 'Cambio oficina',
      entryOffice: { code: 'ES000999' }
    });

    expect(r.success).toBe(true);
    expect(r.xml).toContain('<ie:ReferenceNumber>ES000999</ie:ReferenceNumber>');
  });

  test('amendments.entryOffice ausente (linea 110 false)', () => {
    const r = ensGenerator.generateAmendment('MRN-1', { reason: 'x' });
    expect(r.xml).not.toContain('CustomsOfficeOfFirstEntry');
  });

  test('amendments.carrier presente (linea 112)', () => {
    const r = ensGenerator.generateAmendment('MRN-2', {
      reason: 'Cambio transportista',
      carrier: { eori: 'ESB99999999' }
    });

    expect(r.success).toBe(true);
    expect(r.xml).toContain('<ie:Carrier>');
  });

  test('amendments.carrier ausente (linea 112 false)', () => {
    const r = ensGenerator.generateAmendment('MRN-2', { reason: 'x' });
    expect(r.xml).not.toContain('<ie:Carrier>');
  });

  test('amendments.transportMeans presente (linea 114)', () => {
    const r = ensGenerator.generateAmendment('MRN-3', {
      reason: 'Cambio vehiculo',
      transportMeans: { identification: 'NEW123', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD'
    });

    expect(r.success).toBe(true);
    expect(r.xml).toContain('<ie:TransportMeansAtBorder>');
  });

  test('amendments.transportMeans ausente (linea 114 false)', () => {
    const r = ensGenerator.generateAmendment('MRN-3', { reason: 'x' });
    expect(r.xml).not.toContain('<ie:TransportMeansAtBorder>');
  });

  test('amendments.consignment.referenceNumber presente (linea 118)', () => {
    const r = ensGenerator.generateAmendment('MRN-4', {
      reason: 'x',
      consignment: { referenceNumber: 'REF-NEW' }
    });

    expect(r.xml).toContain('<ie:ReferenceNumber>REF-NEW</ie:ReferenceNumber>');
  });

  test('amendments.consignment.grossMass presente (linea 119)', () => {
    const r = ensGenerator.generateAmendment('MRN-5', {
      reason: 'x',
      consignment: { grossMass: 1234 }
    });

    expect(r.xml).toContain('<ie:GrossMass>1234</ie:GrossMass>');
  });

  test('amendments.consignment.numberOfPackages presente (linea 120)', () => {
    const r = ensGenerator.generateAmendment('MRN-6', {
      reason: 'x',
      consignment: { numberOfPackages: 77 }
    });

    expect(r.xml).toContain('<ie:NumberOfPackages>77</ie:NumberOfPackages>');
  });

  test('amendments.consignment sin campos opcionales (lineas 118-120 false)', () => {
    const r = ensGenerator.generateAmendment('MRN-7', {
      reason: 'x',
      consignment: {}
    });

    // Solo el wrapper Consignment, sin los tres campos opcionales
    expect(r.xml).toContain('<ie:Consignment>');
    expect(r.xml).not.toContain('<ie:ReferenceNumber>');
    expect(r.xml).not.toContain('<ie:GrossMass>');
    expect(r.xml).not.toContain('<ie:NumberOfPackages>');
  });
});

describe('_buildCustomsOfficeOfFirstEntry: expectedArrival opcional (linea 245)', () => {
  test('expectedArrival presente', () => {
    const r = ensGenerator.generate(base({
      entryOffice: { code: 'ES000851', expectedArrival: '2026-08-10T14:00:00Z' }
    }));

    expect(r.xml).toContain('<ie:ExpectedDateTimeOfArrival>2026-08-10T14:00:00.000Z</ie:ExpectedDateTimeOfArrival>');
  });

  test('expectedArrival ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('ExpectedDateTimeOfArrival');
  });
});

describe('_buildCarrier: name y address opcionales (lineas 258-259)', () => {
  test('carrier.name presente (linea 258)', () => {
    const r = ensGenerator.generate(base({
      carrier: { eori: 'ESB22477020', name: 'Transporte Rapido SL' }
    }));

    expect(r.xml).toContain('<ie:Name>Transporte Rapido SL</ie:Name>');
  });

  test('carrier.name ausente', () => {
    const r = ensGenerator.generate(base({
      carrier: { eori: 'ESB22477020' }
    }));

    // Carrier emitido pero sin Name
    expect(r.xml).toContain('<ie:Carrier>');
    expect(r.xml).not.toContain('<ie:Name>');
  });

  test('carrier.address presente (linea 259)', () => {
    const r = ensGenerator.generate(base({
      carrier: { eori: 'ESB22477020', address: { city: 'Madrid', country: 'ES' } }
    }));

    expect(r.xml).toContain('<ie:Address>');
    expect(r.xml).toContain('<ie:City>Madrid</ie:City>');
  });

  test('carrier.address ausente', () => {
    const r = ensGenerator.generate(base({
      carrier: { eori: 'ESB22477020' }
    }));

    expect(r.xml).not.toContain('<ie:Address>');
  });
});

describe('_buildTransportMeans: nationality opcional (linea 276)', () => {
  test('nationality presente', () => {
    const r = ensGenerator.generate(base({
      transportMeans: { identification: 'ES1234ABC', identificationType: 'VEHICLE_REGISTRATION', nationality: 'ES' }
    }));

    expect(r.xml).toContain('<ie:Nationality>ES</ie:Nationality>');
  });

  test('nationality ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:Nationality>');
  });
});

describe('_buildConsignment: campos opcionales (lineas 290, 297, 299-301)', () => {
  test('referenceType presente (linea 290)', () => {
    const r = ensGenerator.generate(base({
      consignment: {
        referenceNumber: 'REF-1', referenceType: 'AWB', grossMass: 1000,
        numberOfPackages: 5, goodsDescription: 'Mercancia'
      }
    }));

    expect(r.xml).toContain('<ie:ReferenceType>AWB</ie:ReferenceType>');
  });

  test('referenceType ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:ReferenceType>');
  });

  test('sealNumber presente cuando hay containerNumber (linea 297)', () => {
    const r = ensGenerator.generate(base({
      consignment: {
        referenceNumber: 'REF-1', grossMass: 1000, numberOfPackages: 5,
        goodsDescription: 'Mercancia', containerNumber: 'MSKU1234567',
        sealNumber: 'SEAL9999'
      }
    }));

    expect(r.xml).toContain('<ie:SealNumber>SEAL9999</ie:SealNumber>');
  });

  test('sealNumber ausente incluso con containerNumber', () => {
    const r = ensGenerator.generate(base({
      consignment: {
        referenceNumber: 'REF-1', grossMass: 1000, numberOfPackages: 5,
        goodsDescription: 'Mercancia', containerNumber: 'MSKU1234567'
      }
    }));

    expect(r.xml).toContain('<ie:ContainerIdentificationNumber>');
    expect(r.xml).not.toContain('<ie:SealNumber>');
  });

  test('countryOfDispatch presente (linea 299)', () => {
    const r = ensGenerator.generate(base({
      consignment: {
        referenceNumber: 'REF-1', grossMass: 1000, numberOfPackages: 5,
        goodsDescription: 'Mercancia', countryOfDispatch: 'CN'
      }
    }));

    expect(r.xml).toContain('<ie:CountryOfDispatch>CN</ie:CountryOfDispatch>');
  });

  test('countryOfDispatch ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:CountryOfDispatch>');
  });

  test('countryOfDestination presente (linea 300)', () => {
    const r = ensGenerator.generate(base({
      consignment: {
        referenceNumber: 'REF-1', grossMass: 1000, numberOfPackages: 5,
        goodsDescription: 'Mercancia', countryOfDestination: 'ES'
      }
    }));

    expect(r.xml).toContain('<ie:CountryOfDestination>ES</ie:CountryOfDestination>');
  });

  test('countryOfDestination ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:CountryOfDestination>');
  });

  test('ucr presente (linea 301)', () => {
    const r = ensGenerator.generate(base({
      consignment: {
        referenceNumber: 'REF-1', grossMass: 1000, numberOfPackages: 5,
        goodsDescription: 'Mercancia', ucr: 'UCR-CONS-1'
      }
    }));

    expect(r.xml).toContain('<ie:UCR>UCR-CONS-1</ie:UCR>');
  });

  test('ucr ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:UCR>');
  });
});

describe('_buildConsignor: campos opcionales (lineas 313-316)', () => {
  test('eori presente (linea 313)', () => {
    const r = ensGenerator.generate(base({
      consignor: { eori: 'PL123456789' }
    }));

    expect(r.xml).toContain('<ie:Consignor>');
    expect(r.xml).toContain('<ie:IdentificationNumber>PL123456789</ie:IdentificationNumber>');
  });

  test('eori ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { name: 'Fabricante SRL' }
    }));

    expect(r.xml).toContain('<ie:Consignor>');
    // Verificar que dentro del bloque Consignor no hay IdentificationNumber
    const consignorBlock = r.xml.match(/<ie:Consignor>[\s\S]*?<\/ie:Consignor>/);
    expect(consignorBlock[0]).not.toContain('<ie:IdentificationNumber>');
  });

  test('name presente (linea 314)', () => {
    const r = ensGenerator.generate(base({
      consignor: { name: 'Fabricante XYZ' }
    }));

    expect(r.xml).toContain('<ie:Name>Fabricante XYZ</ie:Name>');
  });

  test('name ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { eori: 'PL123' }
    }));

    expect(r.xml).toContain('<ie:Consignor>');
    expect(r.xml).not.toContain('<ie:Name>');
  });

  test('address presente (linea 315)', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { city: 'Varsovia', country: 'PL' } }
    }));

    expect(r.xml).toContain('<ie:Address>');
    expect(r.xml).toContain('<ie:City>Varsovia</ie:City>');
  });

  test('address ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { eori: 'PL123' }
    }));

    expect(r.xml).not.toContain('<ie:Address>');
  });

  test('contactPerson presente (linea 316)', () => {
    const r = ensGenerator.generate(base({
      consignor: { contactPerson: 'Juan Perez' }
    }));

    expect(r.xml).toContain('<ie:ContactPerson>Juan Perez</ie:ContactPerson>');
  });

  test('contactPerson ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { eori: 'PL123' }
    }));

    expect(r.xml).not.toContain('<ie:ContactPerson>');
  });
});

describe('_buildConsignee: campos opcionales (lineas 328-331)', () => {
  test('eori presente (linea 328)', () => {
    const r = ensGenerator.generate(base({
      consignee: { eori: 'ESB88888888' }
    }));

    expect(r.xml).toContain('<ie:Consignee>');
    expect(r.xml).toContain('<ie:IdentificationNumber>ESB88888888</ie:IdentificationNumber>');
  });

  test('eori ausente', () => {
    const r = ensGenerator.generate(base({
      consignee: { name: 'Importadora ABC' }
    }));

    expect(r.xml).toContain('<ie:Consignee>');
    // Verificar que dentro del bloque Consignee no hay IdentificationNumber
    const consigneeBlock = r.xml.match(/<ie:Consignee>[\s\S]*?<\/ie:Consignee>/);
    expect(consigneeBlock[0]).not.toContain('<ie:IdentificationNumber>');
  });

  test('name presente (linea 329)', () => {
    const r = ensGenerator.generate(base({
      consignee: { name: 'Importadora ABC' }
    }));

    expect(r.xml).toContain('<ie:Name>Importadora ABC</ie:Name>');
  });

  test('name ausente', () => {
    const r = ensGenerator.generate(base({
      consignee: { eori: 'ES999' }
    }));

    expect(r.xml).toContain('<ie:Consignee>');
    expect(r.xml).not.toContain('<ie:Name>');
  });

  test('address presente (linea 330)', () => {
    const r = ensGenerator.generate(base({
      consignee: { address: { city: 'Barcelona', country: 'ES' } }
    }));

    expect(r.xml).toContain('<ie:Address>');
    expect(r.xml).toContain('<ie:City>Barcelona</ie:City>');
  });

  test('address ausente', () => {
    const r = ensGenerator.generate(base({
      consignee: { eori: 'ES999' }
    }));

    expect(r.xml).not.toContain('<ie:Address>');
  });

  test('contactPerson presente (linea 331)', () => {
    const r = ensGenerator.generate(base({
      consignee: { contactPerson: 'Maria Lopez' }
    }));

    expect(r.xml).toContain('<ie:ContactPerson>Maria Lopez</ie:ContactPerson>');
  });

  test('contactPerson ausente', () => {
    const r = ensGenerator.generate(base({
      consignee: { eori: 'ES999' }
    }));

    expect(r.xml).not.toContain('<ie:ContactPerson>');
  });
});

describe('_buildAddress: campos opcionales (lineas 343-346)', () => {
  test('streetAndNumber presente (linea 343)', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { streetAndNumber: 'Calle Mayor 123' } }
    }));

    expect(r.xml).toContain('<ie:StreetAndNumber>Calle Mayor 123</ie:StreetAndNumber>');
  });

  test('streetAndNumber ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { city: 'Madrid' } }
    }));

    expect(r.xml).toContain('<ie:Address>');
    expect(r.xml).not.toContain('<ie:StreetAndNumber>');
  });

  test('city presente (linea 344)', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { city: 'Madrid' } }
    }));

    expect(r.xml).toContain('<ie:City>Madrid</ie:City>');
  });

  test('city ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { country: 'ES' } }
    }));

    expect(r.xml).not.toContain('<ie:City>');
  });

  test('postalCode presente (linea 345)', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { postalCode: '28001' } }
    }));

    expect(r.xml).toContain('<ie:PostalCode>28001</ie:PostalCode>');
  });

  test('postalCode ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { city: 'Madrid' } }
    }));

    expect(r.xml).not.toContain('<ie:PostalCode>');
  });

  test('country presente (linea 346)', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { country: 'ES' } }
    }));

    expect(r.xml).toContain('<ie:Country>ES</ie:Country>');
  });

  test('country ausente', () => {
    const r = ensGenerator.generate(base({
      consignor: { address: { city: 'Madrid' } }
    }));

    expect(r.xml).toContain('<ie:Address>');
    expect(r.xml).not.toContain('<ie:Country>');
  });
});

describe('_buildHouseConsignments: campos opcionales (lineas 354, 360-364, 366-367)', () => {
  test('array vacio no emite nada (linea 354)', () => {
    const r = ensGenerator.generate(base({ houseConsignments: [] }));
    expect(r.xml).not.toContain('<ie:HouseConsignment>');
  });

  test('grossMass presente (linea 360)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', grossMass: 789, goods: [] }]
    }));

    expect(r.xml).toContain('<ie:GrossMass>789</ie:GrossMass>');
  });

  test('grossMass ausente', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', goods: [] }]
    }));

    expect(r.xml).toContain('<ie:HouseConsignment>');
    // Verificar que dentro del bloque HouseConsignment no hay GrossMass
    const houseBlock = r.xml.match(/<ie:HouseConsignment>[\s\S]*?<\/ie:HouseConsignment>/);
    expect(houseBlock[0]).not.toContain('<ie:GrossMass>');
  });

  test('numberOfPackages presente (linea 361)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', numberOfPackages: 33, goods: [] }]
    }));

    expect(r.xml).toContain('<ie:NumberOfPackages>33</ie:NumberOfPackages>');
  });

  test('numberOfPackages ausente', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', goods: [] }]
    }));

    // Verificar que dentro del bloque HouseConsignment no hay NumberOfPackages
    const houseBlock = r.xml.match(/<ie:HouseConsignment>[\s\S]*?<\/ie:HouseConsignment>/);
    expect(houseBlock[0]).not.toContain('<ie:NumberOfPackages>');
  });

  test('consignor presente en house (linea 362)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', consignor: { eori: 'PL123' }, goods: [] }]
    }));

    expect(r.xml).toContain('<ie:Consignor>');
  });

  test('consignor ausente en house', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', goods: [] }]
    }));

    expect(r.xml).not.toContain('<ie:Consignor>');
  });

  test('consignee presente en house (linea 363)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', consignee: { eori: 'ES999' }, goods: [] }]
    }));

    expect(r.xml).toContain('<ie:Consignee>');
  });

  test('consignee ausente en house', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', goods: [] }]
    }));

    expect(r.xml).not.toContain('<ie:Consignee>');
  });

  test('notifyParty presente con eori (linea 366)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{
        referenceNumber: 'H1',
        notifyParty: { eori: 'ES777', name: 'Notificado SL' },
        goods: []
      }]
    }));

    expect(r.xml).toContain('<ie:NotifyParty>');
    expect(r.xml).toContain('<ie:IdentificationNumber>ES777</ie:IdentificationNumber>');
  });

  test('notifyParty.name presente (linea 367)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{
        referenceNumber: 'H1',
        notifyParty: { name: 'Notificado ABC' },
        goods: []
      }]
    }));

    expect(r.xml).toContain('<ie:Name>Notificado ABC</ie:Name>');
  });

  test('notifyParty ausente (linea 364 false)', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{ referenceNumber: 'H1', goods: [] }]
    }));

    expect(r.xml).not.toContain('<ie:NotifyParty>');
  });

  test('notifyParty presente pero sin eori ni name', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{
        referenceNumber: 'H1',
        notifyParty: {},
        goods: []
      }]
    }));

    // El wrapper emitido pero sin campos internos
    expect(r.xml).toContain('<ie:NotifyParty>');
    const notifyBlock = r.xml.match(/<ie:NotifyParty>[\s\S]*?<\/ie:NotifyParty>/);
    expect(notifyBlock[0]).not.toContain('<ie:IdentificationNumber>');
    expect(notifyBlock[0]).not.toContain('<ie:Name>');
  });
});

describe('_buildGoodsItems: campos opcionales (lineas 377, 387-392)', () => {
  test('array vacio no emite nada (linea 377)', () => {
    const r = ensGenerator.generate(base({ goods: [] }));
    expect(r.xml).not.toContain('<ie:GoodsItem>');
  });

  test('quantity presente (linea 387)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, quantity: 25 }]
    }));

    expect(r.xml).toContain('<ie:Quantity>25</ie:Quantity>');
  });

  test('quantity ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:Quantity>');
  });

  test('unitOfMeasure presente (linea 388)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, unitOfMeasure: 'KGM' }]
    }));

    expect(r.xml).toContain('<ie:UnitOfMeasure>KGM</ie:UnitOfMeasure>');
  });

  test('unitOfMeasure ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:UnitOfMeasure>');
  });

  test('countryOfOrigin presente (linea 389)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, countryOfOrigin: 'CO' }]
    }));

    expect(r.xml).toContain('<ie:CountryOfOrigin>CO</ie:CountryOfOrigin>');
  });

  test('countryOfOrigin ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:CountryOfOrigin>');
  });

  test('numberOfPackages presente (linea 390)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, numberOfPackages: 12 }]
    }));

    expect(r.xml).toContain('<ie:NumberOfPackages>12</ie:NumberOfPackages>');
  });

  test('numberOfPackages ausente', () => {
    const r = ensGenerator.generate(base());
    // Verificar que dentro del bloque GoodsItem no hay NumberOfPackages
    const goodsBlock = r.xml.match(/<ie:GoodsItem>[\s\S]*?<\/ie:GoodsItem>/);
    expect(goodsBlock[0]).not.toContain('<ie:NumberOfPackages>');
  });

  test('kindOfPackages presente (linea 391)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, kindOfPackages: 'CT' }]
    }));

    expect(r.xml).toContain('<ie:KindOfPackages>CT</ie:KindOfPackages>');
  });

  test('kindOfPackages ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:KindOfPackages>');
  });

  test('marksAndNumbers presente (linea 392)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, marksAndNumbers: 'PALLET-99' }]
    }));

    expect(r.xml).toContain('<ie:MarksAndNumbers>PALLET-99</ie:MarksAndNumbers>');
  });

  test('marksAndNumbers ausente', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:MarksAndNumbers>');
  });

  test('ucr presente en item (linea 393)', () => {
    const r = ensGenerator.generate(base({
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 100, ucr: 'UCR-ITEM-1' }]
    }));

    expect(r.xml).toContain('<ie:UCR>UCR-ITEM-1</ie:UCR>');
  });

  test('ucr ausente en item', () => {
    const r = ensGenerator.generate(base());
    expect(r.xml).not.toContain('<ie:UCR>');
  });
});

describe('_generateMessageId: prefijo variable (linea 402)', () => {
  test('prefijo ENS', () => {
    const id = ensGenerator._generateMessageId('ENS');
    expect(id).toMatch(/^LUCI-ENS-/);
  });

  test('prefijo AMD', () => {
    const id = ensGenerator._generateMessageId('AMD');
    expect(id).toMatch(/^LUCI-AMD-/);
  });

  test('prefijo ARR', () => {
    const id = ensGenerator._generateMessageId('ARR');
    expect(id).toMatch(/^LUCI-ARR-/);
  });

  test('prefijo CAN', () => {
    const id = ensGenerator._generateMessageId('CAN');
    expect(id).toMatch(/^LUCI-CAN-/);
  });

  test('sin prefijo usa MSG por defecto', () => {
    const id = ensGenerator._generateMessageId();
    expect(id).toMatch(/^LUCI-MSG-/);
  });
});

describe('variantes de modo de transporte e identificacion', () => {
  test('modo SEA (maritimo)', () => {
    const r = ensGenerator.generate(base({
      transportMode: 'SEA',
      transportMeans: { identification: 'IMO1234567', identificationType: 'VESSEL_IMO' }
    }));

    expect(r.xml).toContain('<ie:ModeOfTransportAtBorderCode>1</ie:ModeOfTransportAtBorderCode>');
    expect(r.xml).toContain('<ie:IdentificationType>10</ie:IdentificationType>');
  });

  test('modo AIR (aereo)', () => {
    const r = ensGenerator.generate(base({
      transportMode: 'AIR',
      transportMeans: { identification: 'IB1234', identificationType: 'FLIGHT_NUMBER' }
    }));

    expect(r.xml).toContain('<ie:ModeOfTransportAtBorderCode>4</ie:ModeOfTransportAtBorderCode>');
    expect(r.xml).toContain('<ie:IdentificationType>40</ie:IdentificationType>');
  });

  test('modo RAIL (ferrocarril)', () => {
    const r = ensGenerator.generate(base({
      transportMode: 'RAIL',
      transportMeans: { identification: 'TRAIN-99', identificationType: 'TRAIN_NUMBER' }
    }));

    expect(r.xml).toContain('<ie:ModeOfTransportAtBorderCode>2</ie:ModeOfTransportAtBorderCode>');
    expect(r.xml).toContain('<ie:IdentificationType>30</ie:IdentificationType>');
  });

  test('modo MULTIMODAL', () => {
    const r = ensGenerator.generate(base({ transportMode: 'MULTIMODAL' }));
    expect(r.xml).toContain('<ie:ModeOfTransportAtBorderCode>6</ie:ModeOfTransportAtBorderCode>');
  });

  test('identificationType VESSEL_NAME', () => {
    const r = ensGenerator.generate(base({
      transportMode: 'SEA',
      transportMeans: { identification: 'MSC POESIA', identificationType: 'VESSEL_NAME' }
    }));

    expect(r.xml).toContain('<ie:IdentificationType>11</ie:IdentificationType>');
  });
});

describe('cobertura de guard clauses null/undefined (lineas 240, 267, 285, 339, 354)', () => {
  test('_buildCustomsOfficeOfFirstEntry con entryOffice null (linea 240)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: null, // Esto dispara la linea 240
      carrier: { eori: 'ESB22477020' },
      transportMeans: { identification: 'TEST', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: { referenceNumber: 'REF', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x' },
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).not.toContain('CustomsOfficeOfFirstEntry');
  });

  test('_buildTransportMeans con transportMeans null (linea 267)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020' },
      transportMeans: null, // Esto dispara la linea 267
      consignment: { referenceNumber: 'REF', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x' },
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).not.toContain('TransportMeansAtBorder');
  });

  test('_buildConsignment con consignment null (linea 285)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020' },
      transportMeans: { identification: 'TEST', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: null, // Esto dispara la linea 285
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).not.toContain('<ie:Consignment>');
  });

  test('_buildAddress con address null (linea 339)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020', address: null }, // Esto dispara la linea 339
      transportMeans: { identification: 'TEST', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: { referenceNumber: 'REF', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x' },
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).toContain('<ie:Carrier>');
    expect(r.xml).not.toContain('<ie:Address>');
  });

  test('_buildAddress con address undefined (linea 339 branch alternativa)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020' }, // address omitido = undefined
      transportMeans: { identification: 'TEST', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: { referenceNumber: 'REF', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x' },
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).not.toContain('<ie:Address>');
  });

  test('_buildHouseConsignments con houses null (linea 354)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020' },
      transportMeans: { identification: 'TEST', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: { referenceNumber: 'REF', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x' },
      houseConsignments: null, // Esto dispara la linea 354 (!houses)
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).not.toContain('<ie:HouseConsignment>');
    // Deberia emitir goods items en su lugar
    expect(r.xml).toContain('<ie:GoodsItem>');
  });

  test('_buildHouseConsignments con houses undefined (linea 354 branch alternativa)', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-TEST',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020' },
      transportMeans: { identification: 'TEST', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: { referenceNumber: 'REF', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x' },
      // houseConsignments omitido = undefined
      goods: [{ description: 'A', commodityCode: '0901210000', grossMass: 1 }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).not.toContain('<ie:HouseConsignment>');
    expect(r.xml).toContain('<ie:GoodsItem>');
  });
});

describe('cobertura de error paths (lineas 133, 185, 227)', () => {
  test('generateAmendment captura error interno (linea 133)', () => {
    // Pasar un objeto que lance error al intentar acceder a propiedades
    const badAmendments = {
      get reason() { throw new Error('Test error in getter'); }
    };
    const r = ensGenerator.generateAmendment('MRN-1', badAmendments);

    expect(r.success).toBe(false);
    expect(typeof r.error).toBe('string');
  });

  test('generateArrivalNotification captura error interno (linea 185)', () => {
    // Pasar un objeto que lance error al intentar acceder a propiedades
    const badArrival = {
      get actualArrival() { throw new Error('Test error in getter'); }
    };
    const r = ensGenerator.generateArrivalNotification('MRN-1', badArrival);

    expect(r.success).toBe(false);
    expect(typeof r.error).toBe('string');
  });

  // El caso de generateCancellation desaparece con el metodo: era un XML de
  // anulacion inventado (etiquetado CC328C, el acuse de AEAT) que nadie enviaba.
  // La anulacion real es el IE314/CC314A -> tests/services/aeat/ie314XmlBuilder.test.js
});

describe('casos limite y robustez', () => {
  test('goods items nested dentro de houseConsignment reciben indentacion correcta', () => {
    const r = ensGenerator.generate(base({
      houseConsignments: [{
        referenceNumber: 'HC-1',
        goods: [{ description: 'Item anidado', commodityCode: '2204210000', grossMass: 50 }]
      }]
    }));

    // La indentacion interna agrega espacios extra
    expect(r.xml).toContain('<ie:HouseConsignment>');
    expect(r.xml).toContain('<ie:GoodsItem>');
    expect(r.xml).toContain('<ie:CommodityCode>2204210000</ie:CommodityCode>');
  });

  test('declaracion con todos los opcionales maximos simultaneos', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-FULL',
      entryOffice: { code: 'ES000851', expectedArrival: '2026-08-10T10:00:00Z' },
      carrier: { eori: 'ESB22477020', name: 'Transporte SL', address: { streetAndNumber: 'C/Atocha 1', city: 'Madrid', postalCode: '28012', country: 'ES' } },
      transportMeans: { identification: 'ES9999ZZZ', identificationType: 'VEHICLE_REGISTRATION', nationality: 'ES' },
      transportMode: 'ROAD',
      consignment: {
        referenceNumber: 'REF-MAX',
        referenceType: 'BL',
        grossMass: 5000,
        numberOfPackages: 100,
        goodsDescription: 'Mercancia completa',
        containerNumber: 'MSKU9999999',
        sealNumber: 'SEAL1234',
        countryOfDispatch: 'CN',
        countryOfDestination: 'ES',
        ucr: 'UCR-CONS-MAX'
      },
      consignor: {
        eori: 'CN123456789',
        name: 'Fabrica China Ltd',
        address: { streetAndNumber: 'Zona Industrial 3', city: 'Shenzhen', postalCode: '518000', country: 'CN' },
        contactPerson: 'Wang Li'
      },
      consignee: {
        eori: 'ESB88888888',
        name: 'Importadora Iberica SL',
        address: { streetAndNumber: 'Poligono Sur 12', city: 'Sevilla', postalCode: '41010', country: 'ES' },
        contactPerson: 'Carmen Garcia'
      },
      goods: [{
        description: 'Auriculares Bluetooth',
        commodityCode: '8518300000',
        grossMass: 2500,
        quantity: 500,
        unitOfMeasure: 'NAR',
        countryOfOrigin: 'CN',
        numberOfPackages: 50,
        kindOfPackages: 'CT',
        marksAndNumbers: 'BATCH-2026-A',
        ucr: 'UCR-ITEM-MAX'
      }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).toContain('<ie:ExpectedDateTimeOfArrival>');
    expect(r.xml).toContain('<ie:Name>Transporte SL</ie:Name>');
    expect(r.xml).toContain('<ie:Nationality>ES</ie:Nationality>');
    expect(r.xml).toContain('<ie:ReferenceType>BL</ie:ReferenceType>');
    expect(r.xml).toContain('<ie:SealNumber>SEAL1234</ie:SealNumber>');
    expect(r.xml).toContain('<ie:CountryOfDispatch>CN</ie:CountryOfDispatch>');
    expect(r.xml).toContain('<ie:CountryOfDestination>ES</ie:CountryOfDestination>');
    expect(r.xml).toContain('<ie:UCR>UCR-CONS-MAX</ie:UCR>');
    expect(r.xml).toContain('<ie:ContactPerson>Wang Li</ie:ContactPerson>');
    expect(r.xml).toContain('<ie:ContactPerson>Carmen Garcia</ie:ContactPerson>');
    expect(r.xml).toContain('<ie:Quantity>500</ie:Quantity>');
    expect(r.xml).toContain('<ie:UnitOfMeasure>NAR</ie:UnitOfMeasure>');
    expect(r.xml).toContain('<ie:KindOfPackages>CT</ie:KindOfPackages>');
    expect(r.xml).toContain('<ie:MarksAndNumbers>BATCH-2026-A</ie:MarksAndNumbers>');
  });

  test('house consignment con todos los opcionales simultaneos', () => {
    const r = ensGenerator.generate({
      lrn: 'LRN-HC-FULL',
      entryOffice: { code: 'ES000851' },
      carrier: { eori: 'ESB22477020' },
      transportMeans: { identification: 'ES1234', identificationType: 'VEHICLE_REGISTRATION' },
      transportMode: 'ROAD',
      consignment: { referenceNumber: 'REF', grossMass: 1000, numberOfPackages: 10, goodsDescription: 'Grupaje' },
      houseConsignments: [{
        referenceNumber: 'HC-MAX',
        grossMass: 800,
        numberOfPackages: 8,
        consignor: { eori: 'FR123', name: 'Expediteur FR', address: { city: 'Lyon', country: 'FR' }, contactPerson: 'Pierre' },
        consignee: { eori: 'ES888', name: 'Destinatario ES', address: { city: 'Valencia', country: 'ES' }, contactPerson: 'Ana' },
        notifyParty: { eori: 'ES777', name: 'Notificado ES' },
        goods: [{
          description: 'Camisetas',
          commodityCode: '6109100010',
          grossMass: 400,
          quantity: 100,
          unitOfMeasure: 'NAR',
          countryOfOrigin: 'BD',
          numberOfPackages: 4,
          kindOfPackages: 'PK',
          marksAndNumbers: 'MARCA-HC',
          ucr: 'UCR-HC-1'
        }]
      }]
    });

    expect(r.success).toBe(true);
    expect(r.xml).toContain('<ie:HouseConsignment>');
    expect(r.xml).toContain('<ie:GrossMass>800</ie:GrossMass>');
    expect(r.xml).toContain('<ie:NotifyParty>');
    expect(r.xml).toContain('<ie:IdentificationNumber>ES777</ie:IdentificationNumber>');
    expect(r.xml).toContain('<ie:Name>Notificado ES</ie:Name>');
    expect(r.xml).toContain('<ie:Quantity>100</ie:Quantity>');
    expect(r.xml).toContain('<ie:MarksAndNumbers>MARCA-HC</ie:MarksAndNumbers>');
  });
});
