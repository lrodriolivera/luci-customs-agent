/**
 * ensGenerator: generador de los mensajes XML ICS2 (ENS) para la AEAT.
 *
 * Es un generador PURO —singleton sin requires, sin BD ni red—: dado un objeto
 * de declaracion escupe el XML del mensaje (CC315C presentacion, CC313C
 * rectificacion, CC305C llegada, CC328C anulacion). Se prueban las ramas
 * condicionales que deciden que bloques salen (transportista, consignment,
 * house consignments vs goods items, direcciones opcionales) y los mapeos de
 * codigos (modo de transporte, tipo de identificacion). Un error aqui manda a
 * ICS2 un ENS mal formado o incompleto y la entrada se rechaza en frontera.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const ensGenerator = require('../../../src/services/forms/ensGenerator');

/** Una declaracion ENS minima viable. */
function declaracion(extra = {}) {
  return {
    lrn: 'LRN-2026-001',
    entryOffice: { code: 'ES000851' },
    carrier: { eori: 'ESB22477020' },
    transportMeans: { identification: 'ABC1234', identificationType: 'VEHICLE_REGISTRATION' },
    transportMode: 'ROAD',
    consignment: {
      referenceNumber: 'REF-1', grossMass: 1200, numberOfPackages: 10,
      goodsDescription: 'Textil variado'
    },
    goods: [{ description: 'Camisetas', commodityCode: '6109100010', grossMass: 600 }],
    ...extra
  };
}

describe('generate (CC315C): presentacion ENS', () => {
  test('genera un CC315C con el envelope y los namespaces ICS2', () => {
    const r = ensGenerator.generate(declaracion());

    expect(r.success).toBe(true);
    expect(r.messageType).toBe('CC315C');
    expect(r.xml).toContain('<ie:CC315C');
    expect(r.xml).toContain('urn:wco:datamodel:WCO:DEC-DMS:2');
    expect(r.xml).toContain('<md:MessageType>CC315C</md:MessageType>');
  });

  test('vuelca el LRN y el tipo de declaracion (ENS por defecto)', () => {
    const r = ensGenerator.generate(declaracion());

    expect(r.xml).toContain('<ie:LRN>LRN-2026-001</ie:LRN>');
    expect(r.xml).toContain('<ie:DeclarationType>ENS</ie:DeclarationType>');
  });

  test('el messageId lleva el prefijo ENS', () => {
    const r = ensGenerator.generate(declaracion());
    expect(r.messageId).toMatch(/^LUCI-ENS-/);
  });

  test('con houseConsignments emite grupaje y NO la lista plana de goods', () => {
    const r = ensGenerator.generate(declaracion({
      houseConsignments: [{
        referenceNumber: 'HC-1',
        goods: [{ description: 'Zapatos', commodityCode: '6403000000', grossMass: 300 }]
      }]
    }));

    expect(r.xml).toContain('<ie:HouseConsignment>');
    expect(r.xml).toContain('<ie:SequenceNumber>1</ie:SequenceNumber>');
  });

  test('sin houseConsignments emite la lista plana de goods items', () => {
    const r = ensGenerator.generate(declaracion());

    expect(r.xml).toContain('<ie:GoodsItem>');
    expect(r.xml).toContain('<ie:CommodityCode>6109100010</ie:CommodityCode>');
    expect(r.xml).not.toContain('<ie:HouseConsignment>');
  });

  test('un fallo interno (declaracion null) se captura y devuelve success:false', () => {
    const r = ensGenerator.generate(null);
    expect(r.success).toBe(false);
    expect(typeof r.error).toBe('string');
  });
});

describe('generateAmendment (CC313C): rectificacion', () => {
  test('genera un CC313C con el MRN original y la razon escapada', () => {
    const r = ensGenerator.generateAmendment('26ES00085123456789', { reason: 'Cambio peso & bultos' });

    expect(r.messageType).toBe('CC313C');
    expect(r.xml).toContain('<ie:MRN>26ES00085123456789</ie:MRN>');
    expect(r.xml).toContain('Cambio peso &amp; bultos');
  });

  test('sin razon usa el texto por defecto', () => {
    const r = ensGenerator.generateAmendment('MRN1', {});
    expect(r.xml).toContain('<ie:AmendmentReason>Rectificacion</ie:AmendmentReason>');
  });

  test('emite el bloque Consignment solo si viene en amendments', () => {
    const con = ensGenerator.generateAmendment('MRN1', {
      reason: 'x', consignment: { referenceNumber: 'R1', grossMass: 500, numberOfPackages: 3 }
    });
    const sin = ensGenerator.generateAmendment('MRN1', { reason: 'x' });

    expect(con.xml).toContain('<ie:GrossMass>500</ie:GrossMass>');
    expect(sin.xml).not.toContain('<ie:Consignment>');
  });
});

describe('generateArrivalNotification (CC305C)', () => {
  test('genera un CC305C con el MRN', () => {
    const r = ensGenerator.generateArrivalNotification('MRN-ARR', {});

    expect(r.messageType).toBe('CC305C');
    expect(r.xml).toContain('<ie:MRN>MRN-ARR</ie:MRN>');
    expect(r.xml).toContain('<ie:ArrivalNotification>');
  });

  test('emite oficina de presentacion y lugar de descarga solo si vienen', () => {
    const r = ensGenerator.generateArrivalNotification('MRN', {
      presentationOffice: { code: 'ES000851' }, unloadingPlace: 'Muelle A'
    });

    expect(r.xml).toContain('<ie:CustomsOfficeOfPresentation>');
    expect(r.xml).toContain('<ie:Description>Muelle A</ie:Description>');
  });
});

describe('generateCancellation (CC328C)', () => {
  test('genera un CC328C con MRN y razon por defecto', () => {
    const r = ensGenerator.generateCancellation('MRN-CAN');

    expect(r.messageType).toBe('CC328C');
    expect(r.xml).toContain('<ie:CancellationReason>Anulacion solicitada</ie:CancellationReason>');
  });

  test('escapa la razon de anulacion', () => {
    const r = ensGenerator.generateCancellation('MRN', 'Error <grave>');
    expect(r.xml).toContain('Error &lt;grave&gt;');
  });
});

describe('bloques opcionales del CC315C', () => {
  test('omite el transportista si no viene', () => {
    const r = ensGenerator.generate(declaracion({ carrier: undefined }));
    expect(r.xml).not.toContain('<ie:Carrier>');
  });

  test('el consignment emite equipo de transporte solo con numero de contenedor', () => {
    const con = ensGenerator.generate(declaracion({
      consignment: { referenceNumber: 'R', grossMass: 1, numberOfPackages: 1, goodsDescription: 'x', containerNumber: 'MSKU123', sealNumber: 'SEAL9' }
    }));
    const sin = ensGenerator.generate(declaracion());

    expect(con.xml).toContain('<ie:ContainerIdentificationNumber>MSKU123</ie:ContainerIdentificationNumber>');
    expect(con.xml).toContain('<ie:SealNumber>SEAL9</ie:SealNumber>');
    expect(sin.xml).not.toContain('<ie:TransportEquipment>');
  });

  test('consignor/consignee emiten direccion y persona de contacto solo si vienen', () => {
    const r = ensGenerator.generate(declaracion({
      consignor: { eori: 'PL123', name: 'Fabrica SP', address: { city: 'Lodz', country: 'PL' }, contactPerson: 'Ana' },
      consignee: { eori: 'ES999', name: 'Importadora SL' }
    }));

    expect(r.xml).toContain('<ie:City>Lodz</ie:City>');
    expect(r.xml).toContain('<ie:ContactPerson>Ana</ie:ContactPerson>');
    expect(r.xml).toContain('<ie:Consignee>');
  });
});

describe('mapeos de codigos', () => {
  test('mapea el modo de transporte al codigo ICS2 (ROAD->3, SEA->1, AIR->4)', () => {
    expect(ensGenerator._getTransportModeCode('ROAD')).toBe('3');
    expect(ensGenerator._getTransportModeCode('SEA')).toBe('1');
    expect(ensGenerator._getTransportModeCode('AIR')).toBe('4');
    expect(ensGenerator._getTransportModeCode('COHETE')).toBe('9'); // desconocido
  });

  test('mapea el tipo de identificacion del medio de transporte', () => {
    expect(ensGenerator._getIdentificationType('VEHICLE_REGISTRATION')).toBe('21');
    expect(ensGenerator._getIdentificationType('FLIGHT_NUMBER')).toBe('40');
    expect(ensGenerator._getIdentificationType('OTRO')).toBe('99');
  });
});

describe('_escapeXML', () => {
  test('escapa los cinco caracteres XML reservados', () => {
    expect(ensGenerator._escapeXML(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });

  test('un valor vacio o nulo devuelve cadena vacia', () => {
    expect(ensGenerator._escapeXML(null)).toBe('');
    expect(ensGenerator._escapeXML(undefined)).toBe('');
    expect(ensGenerator._escapeXML('')).toBe('');
  });
});

describe('_buildGoodsItems: numeracion e items opcionales', () => {
  test('numera los items en secuencia y respeta el sequenceNumber explicito', () => {
    const r = ensGenerator.generate(declaracion({
      goods: [
        { description: 'A', commodityCode: '1', grossMass: 1 },
        { description: 'B', commodityCode: '2', grossMass: 2, sequenceNumber: 99 }
      ]
    }));

    expect(r.xml).toContain('<ie:SequenceNumber>1</ie:SequenceNumber>');
    expect(r.xml).toContain('<ie:SequenceNumber>99</ie:SequenceNumber>');
  });

  test('emite los campos opcionales del item solo cuando estan', () => {
    const r = ensGenerator.generate(declaracion({
      goods: [{ description: 'A', commodityCode: '1', grossMass: 1, quantity: 5, countryOfOrigin: 'CN', ucr: 'UCR-1' }]
    }));

    expect(r.xml).toContain('<ie:Quantity>5</ie:Quantity>');
    expect(r.xml).toContain('<ie:CountryOfOrigin>CN</ie:CountryOfOrigin>');
    expect(r.xml).toContain('<ie:UCR>UCR-1</ie:UCR>');
  });
});
