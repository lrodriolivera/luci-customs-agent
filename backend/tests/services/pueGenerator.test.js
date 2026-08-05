/**
 * pueGenerator: solicitudes de control paraduanero (PUE).
 *
 * Estaba al 0% de lineas, con 282 ramas sin cubrir. El PUE es la ventanilla
 * unica por la que se piden los controles que otros organismos -- no Aduanas --
 * tienen que autorizar antes del despacho:
 *
 *   ROHS  aparatos electricos, sustancias peligrosas
 *   COM   SOIVRE, calidad comercial y seguridad de producto
 *   ECO   productos agroalimentarios
 *   CAL   calidad comercial de textiles
 *
 * Si la solicitud sale mal formada, la mercancia se queda retenida en frontera
 * hasta que se corrija: el coste es almacenaje y demoras del transportista.
 *
 * Se ejercita el generador real. Nada mockeado: el XML que se comprueba es el
 * que se enviaria a la AEAT.
 */

const pue = require('../../src/services/forms/pueGenerator');

/** Solicitud PUE completa; el tipo se pasa aparte. */
function solicitud(pueType, extra = {}) {
  return {
    pueType,
    reference: 'PUE-CAL-2026-000123',
    expeditionId: 'EXP-2026-0100',
    operator: { name: 'Textiles del Sur SL', nif: 'B12345678', eori: 'ESB12345678' },
    goods: [
      { taricCode: '6109100010', description: 'Camisetas de algodon', quantity: 500, netWeight: 120 }
    ],
    customsOffice: 'ES002801',
    ...extra
  };
}

describe('generate: los cuatro tipos de control', () => {
  test.each(['ROHS', 'COM', 'ECO', 'CAL'])('genera una solicitud %s', (tipo) => {
    const xml = pue.generate(solicitud(tipo));

    expect(typeof xml).toBe('string');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toMatch(/<pue:PUERequest/);
  });

  test.each(['ROHS', 'COM', 'ECO', 'CAL'])('el XML de %s lleva su bloque especifico', (tipo) => {
    // Cada organismo espera su propia estructura: enviar la de otro control
    // hace que la solicitud se rechace sin llegar a tramitarse.
    expect(pue.generate(solicitud(tipo))).toMatch(new RegExp(`<pue:${tipo}`));
  });

  test('un tipo de control inexistente se rechaza en el acto', () => {
    // Mejor fallar aqui que enviar a la AEAT un XML sin cuerpo.
    expect(() => pue.generate(solicitud('INVENTADO')))
      .toThrow(/no soportado/i);
  });

  test('sin tipo de control tampoco genera nada', () => {
    expect(() => pue.generate(solicitud(undefined))).toThrow(/no soportado/i);
  });
});

describe('cabecera del mensaje', () => {
  const xml = pue.generate(solicitud('CAL'));

  test('declara los espacios de nombres de la AEAT', () => {
    expect(xml).toMatch(/xmlns:pue="urn:aeat:adua:pue:v1"/);
    expect(xml).toMatch(/xmlns:common="urn:aeat:adua:common:v1"/);
  });

  test('lleva identificador de mensaje', () => {
    expect(xml).toMatch(/<pue:MessageId>PUE[0-9A-F]+<\/pue:MessageId>/);
  });

  test('dos solicitudes no comparten identificador', () => {
    // Repetirlo haria que la AEAT tomase la segunda por un duplicado.
    const a = pue.generate(solicitud('CAL')).match(/<pue:MessageId>([^<]+)/)[1];
    const b = pue.generate(solicitud('CAL')).match(/<pue:MessageId>([^<]+)/)[1];

    expect(a).not.toBe(b);
  });

  test('incluye la referencia local de la solicitud', () => {
    // Es lo que permite al operador cruzar la respuesta de la AEAT con su
    // propio expediente.
    expect(xml).toMatch(/<pue:LocalReference>PUE-CAL-2026-000123<\/pue:LocalReference>/);
  });
});

describe('datos del operador', () => {
  const xml = pue.generate(solicitud('CAL'));

  test('incluye razon social, NIF y EORI', () => {
    // El EORI es lo que identifica al operador ante toda la aduana de la UE.
    expect(xml).toMatch(/Textiles del Sur SL/);
    expect(xml).toMatch(/B12345678/);
    expect(xml).toMatch(/ESB12345678/);
  });

  test('_buildOperator devuelve un bloque XML', () => {
    const bloque = pue._buildOperator({ name: 'X SL', nif: 'B1', eori: 'ESB1' });

    expect(typeof bloque).toBe('string');
    expect(bloque).toMatch(/X SL/);
  });

  test('_buildAddress tolera una direccion incompleta', () => {
    // Llega asi de altas rapidas de cliente.
    expect(() => pue._buildAddress({})).not.toThrow();
    expect(() => pue._buildAddress(undefined)).not.toThrow();
  });

  test('_buildParty tolera una parte sin datos', () => {
    expect(() => pue._buildParty({}, 'Consignee')).not.toThrow();
  });
});

describe('mercancias declaradas', () => {
  test('incluye el codigo TARIC', () => {
    // Es lo que determina que control aplica.
    expect(pue.generate(solicitud('CAL'))).toMatch(/6109100010/);
  });

  test('incluye la descripcion de la mercancia', () => {
    expect(pue.generate(solicitud('CAL'))).toMatch(/Camisetas de algodon/);
  });

  test('varias mercancias generan varias lineas', () => {
    const xml = pue.generate(solicitud('CAL', {
      goods: [
        { taricCode: '6109100010', description: 'Camisetas', quantity: 100, netWeight: 20 },
        { taricCode: '6203420000', description: 'Pantalones', quantity: 50, netWeight: 30 }
      ]
    }));

    expect(xml).toMatch(/6109100010/);
    expect(xml).toMatch(/6203420000/);
  });

  test('una solicitud sin mercancias no revienta', () => {
    expect(() => pue.generate(solicitud('CAL', { goods: [] }))).not.toThrow();
  });
});

describe('aduana de presentacion', () => {
  test('_buildCustomsOffice recibe la solicitud completa', () => {
    const bloque = pue._buildCustomsOffice(solicitud('CAL'));

    expect(typeof bloque).toBe('string');
  });

  test('tolera una solicitud sin aduana informada', () => {
    expect(() => pue._buildCustomsOffice({})).not.toThrow();
  });
});

describe('consulta de estado', () => {
  test('genera un XML de consulta', () => {
    // Recibe la referencia como cadena, no como objeto.
    const xml = pue.generateStatusQuery('PUE-CAL-2026-000123');

    expect(xml).toMatch(/<pue:PUEStatusQuery/);
    expect(xml).toMatch(/<pue:PUEReference>PUE-CAL-2026-000123<\/pue:PUEReference>/);
  });

  test('la consulta lleva su propio identificador de mensaje', () => {
    expect(pue.generateStatusQuery('PUE-1')).toMatch(/<pue:MessageId>/);
  });
});

describe('anulacion', () => {
  test('genera un XML de anulacion con el motivo', () => {
    // El motivo es obligatorio: la AEAT lo registra en el expediente.
    const xml = pue.generateCancellation('PUE-CAL-2026-000123', 'Mercancia no embarcada en origen');

    expect(xml).toMatch(/<pue:PUECancellation/);
    expect(xml).toMatch(/Mercancia no embarcada en origen/);
  });

  test('la anulacion referencia la solicitud original', () => {
    const xml = pue.generateCancellation('PUE-CAL-2026-000123', 'motivo');

    expect(xml).toMatch(/<pue:PUEReference>PUE-CAL-2026-000123<\/pue:PUEReference>/);
  });
});

describe('datos complementarios', () => {
  test('genera el XML de aportacion de datos', () => {
    // Es la respuesta a un requerimiento del organismo de control.
    const xml = pue.generateComplementaryData(
      'PUE-CAL-2026-000123',
      { documents: [{ type: 'certificate', reference: 'CERT-001' }] }
    );

    expect(typeof xml).toBe('string');
    expect(xml).toMatch(/PUE-CAL-2026-000123/);
  });

  test('tolera que no haya documentos que aportar', () => {
    expect(() => pue.generateComplementaryData('PUE-1', {}))
      .not.toThrow();
  });
});

describe('el XML no se rompe con caracteres especiales', () => {
  test('una razon social con ampersand no invalida el mensaje', () => {
    // "Garcia & Hijos" es un nombre de empresa perfectamente normal, y un &
    // sin escapar hace que la AEAT devuelva error de formato.
    const xml = pue.generate(solicitud('CAL', {
      operator: { name: 'Garcia & Hijos SL', nif: 'B1', eori: 'ESB1' }
    }));

    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#);)/);
  });
});

// El generador es todo ternarios "campo presente -> incluir elemento". Las
// solicitudes reales que llegan de un expediente completo llevan casi todos
// esos campos; se prueba una solicitud con TODO relleno para que cada rama
// opcional (partes, direcciones, transporte, totales, documentos, datos por
// item) genere su elemento, y las variantes de subtipo por organismo.

describe('solicitud completa: se rellenan todas las ramas opcionales', () => {
  const completa = () => ({
    pueType: 'COM',
    pueSubtype: 'COM_MATERIAL_ELECTRICO',
    reference: 'PUE-COM-2026-001',
    declarationMRN: '26ES00281234567890',
    ensReference: 'ENS-2026-001',
    operator: {
      name: 'Importaciones ACME SL', nif: 'B12345678', eori: 'ESB12345678',
      contactPerson: 'Ana', phone: '600000000', email: 'ana@acme.es',
      address: { streetAndNumber: 'Calle Mayor 1', city: 'Madrid', postalCode: '28001', province: 'Madrid', country: 'ES' }
    },
    importer: { name: 'Importador SL', eori: 'ESB2', nif: 'B2', contactPerson: 'Luis', phone: '1', email: 'l@x.es', address: { city: 'Sevilla' } },
    manufacturer: { name: 'Fab China', eori: 'CN1', nif: 'X', registrationNumber: 'REG-1', address: { country: 'CN' } },
    representative: { name: 'Rep SL', eori: 'ESB3', address: { city: 'Vigo' } },
    customsOffice: { code: 'ES002801', name: 'Aduana de Madrid' },
    soivreOffice: { code: 'SOIVRE-MAD', name: 'SOIVRE Madrid', province: 'Madrid' },
    goods: [{
      taricCode: '8471300000', description: 'Portatiles',
      quantity: 100, unitOfMeasure: 'NAR', grossMass: 200, netMass: 180, statisticalValue: 50000,
      countryOfOrigin: 'CN', brand: 'ACME', model: 'X1', serialNumber: 'SN1', batchNumber: 'L1',
      numberOfPackages: 10, kindOfPackages: 'BX', marksAndNumbers: 'ACME-01',
      manufacturer: { name: 'Fab', country: 'CN', registrationNumber: 'R1' },
      certifications: [{ type: 'CE', number: 'CE-1', issuer: 'Notified Body 1234', issuedAt: '2026-01-01', expiresAt: '2027-01-01' }]
    }],
    totals: { items: 1, grossMass: 200, netMass: 180, packages: 10, statisticalValue: 50000 },
    transport: {
      mode: 'maritime', documentType: 'BL', documentNumber: 'BL-1', containerNumber: 'CONT-1',
      sealNumber: 'SEAL-1', vehicleRegistration: 'V-1', vesselName: 'Barco & Co', flightNumber: 'FL-1',
      arrivalDate: '2026-02-01', expectedArrivalDate: '2026-02-02', unloadingPlace: 'Puerto de Valencia'
    },
    attachedDocuments: [{ type: 'invoice', name: 'Factura', documentNumber: 'F-1', url: 'http://x/f', uploadedAt: '2026-01-15' }],
    priority: 'urgent'
  });

  const xml = pue.generate(completa());

  test('incluye MRN, ENS y subtipo en la cabecera', () => {
    expect(xml).toMatch(/<pue:DeclarationMRN>26ES00281234567890<\/pue:DeclarationMRN>/);
    expect(xml).toMatch(/<pue:ENSReference>ENS-2026-001<\/pue:ENSReference>/);
    expect(xml).toMatch(/<pue:PUESubtype>COM_MATERIAL_ELECTRICO<\/pue:PUESubtype>/);
  });

  test('incluye importer, manufacturer y representative', () => {
    expect(xml).toMatch(/Importador SL/);
    expect(xml).toMatch(/Fab China/);
    expect(xml).toMatch(/Rep SL/);
  });

  test('incluye direccion completa del operador', () => {
    expect(xml).toMatch(/Calle Mayor 1/);
    expect(xml).toMatch(/<pue:PostalCode>28001<\/pue:PostalCode>/);
    expect(xml).toMatch(/<pue:Province>Madrid<\/pue:Province>/);
  });

  test('incluye la oficina SOIVRE', () => {
    expect(xml).toMatch(/SOIVRE Madrid/);
  });

  test('incluye datos opcionales por item (marca, modelo, lote, embalaje)', () => {
    expect(xml).toMatch(/<pue:Brand>ACME<\/pue:Brand>/);
    expect(xml).toMatch(/<pue:Model>X1<\/pue:Model>/);
    expect(xml).toMatch(/<pue:BatchNumber>L1<\/pue:BatchNumber>/);
    expect(xml).toMatch(/<pue:NumberOfPackages>10<\/pue:NumberOfPackages>/);
  });

  test('incluye el bloque de transporte con todos sus campos', () => {
    expect(xml).toMatch(/<pue:ContainerNumber>CONT-1<\/pue:ContainerNumber>/);
    expect(xml).toMatch(/<pue:FlightNumber>FL-1<\/pue:FlightNumber>/);
    expect(xml).toMatch(/<pue:UnloadingPlace>Puerto de Valencia<\/pue:UnloadingPlace>/);
    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#);)/); // "Barco & Co" escapado
  });

  test('incluye documentos adjuntos y totales explicitos', () => {
    expect(xml).toMatch(/<pue:Type>invoice<\/pue:Type>/);
    expect(xml).toMatch(/<pue:TotalStatisticalValue currency="EUR">50000<\/pue:TotalStatisticalValue>/);
  });

  test('COM_MATERIAL_ELECTRICO marca LVDCompliant y extrae el organismo notificado del CE', () => {
    expect(xml).toMatch(/<pue:LVDCompliant>true<\/pue:LVDCompliant>/);
    expect(xml).toMatch(/<pue:NotifiedBodyNumber>1234<\/pue:NotifiedBodyNumber>/); // \d{4} del issuer
  });
});

describe('COM: subtipos y directiva', () => {
  const base = (pueSubtype) => ({
    pueType: 'COM', pueSubtype, reference: 'R',
    operator: { name: 'X', nif: 'B1' },
    goods: [{ taricCode: '9503000000', description: 'Juguete' }],
    customsOffice: { code: 'ES1' }
  });

  test.each([
    ['COM_JUGUETES', /ToysSafetyCompliant>true/, /2009\/48\/EC/],
    ['COM_EPI', /PPECategoryCompliant>true/, /2016\/425/],
    ['COM_MAQUINARIA', /MachineryDirectiveCompliant>true/, /2006\/42\/EC/]
  ])('%s activa su bloque y su directiva', (sub, bloque, directiva) => {
    const xml = pue.generate(base(sub));
    expect(xml).toMatch(bloque);
    expect(xml).toMatch(directiva);
  });

  test('un subtipo COM desconocido cae a la directiva general 2001/95/EC', () => {
    const xml = pue.generate(base('COM_OTRO'));
    expect(xml).toMatch(/2001\/95\/EC/);
  });
});

describe('CAL: subtipos y estandares', () => {
  const base = (pueSubtype) => ({
    pueType: 'CAL', pueSubtype, reference: 'R',
    operator: { name: 'X', nif: 'B1' },
    goods: [{ taricCode: '6109100010', description: 'Camiseta', subCategory: 'punto', productCategory: '100% algodon' }],
    customsOffice: { code: 'ES1' }
  });

  test.each([
    ['CAL_TEXTIL', /TextileStandard>EN 13402/],
    ['CAL_CALZADO', /FootwearStandard/],
    ['CAL_CERAMICA', /CeramicStandard/],
    ['CAL_VIDRIO', /GlassStandard/],
    ['CAL_MUEBLES', /FurnitureStandard/]
  ])('%s incluye su estandar', (sub, estandar) => {
    expect(pue.generate(base(sub))).toMatch(estandar);
  });

  test('textil y calzado exigen instrucciones de cuidado', () => {
    expect(pue.generate(base('CAL_TEXTIL'))).toMatch(/CareInstructions>true/);
    expect(pue.generate(base('CAL_CERAMICA'))).toMatch(/CareInstructions>false/);
  });

  test('incluye la composicion (QualityCategory + Composition) del item', () => {
    const xml = pue.generate(base('CAL_TEXTIL'));
    expect(xml).toMatch(/<pue:QualityCategory>punto<\/pue:QualityCategory>/);
    expect(xml).toMatch(/100% algodon/);
  });
});

describe('ROHS: categorias WEEE y componentes peligrosos', () => {
  test('mapea el TARIC a la categoria WEEE (8471 -> IT, 9504 -> juguetes)', () => {
    const xml = pue.generate({
      pueType: 'ROHS', reference: 'R',
      operator: { name: 'X', nif: 'B1' },
      manufacturer: { name: 'Fab', registrationNumber: 'PROD-REG-1' },
      goods: [
        { taricCode: '8471300000', description: 'PC' },
        { taricCode: '9504500000', description: 'Consola' }
      ],
      customsOffice: { code: 'ES1' }
    });
    expect(xml).toMatch(/<pue:Category>3<\/pue:Category>/); // IT
    expect(xml).toMatch(/<pue:Category>7<\/pue:Category>/); // juguetes
    expect(xml).toMatch(/<pue:ProducerRegistrationNumber>PROD-REG-1<\/pue:ProducerRegistrationNumber>/);
  });

  test('declara los componentes peligrosos con CAS y concentracion', () => {
    const xml = pue.generate({
      pueType: 'ROHS', reference: 'R',
      operator: { name: 'X', nif: 'B1' },
      goods: [{
        taricCode: '8471300000', description: 'PC',
        hazardousComponents: [{ substance: 'Plomo', casNumber: '7439-92-1', concentration: 0.05, unit: '%' }]
      }],
      customsOffice: { code: 'ES1' }
    });
    expect(xml).toMatch(/<pue:Substance>Plomo<\/pue:Substance>/);
    expect(xml).toMatch(/<pue:CASNumber>7439-92-1<\/pue:CASNumber>/);
    expect(xml).toMatch(/<pue:Concentration unit="%">0\.05<\/pue:Concentration>/);
  });
});

describe('ECO: certificados y autorizacion de importacion', () => {
  const base = (goods) => ({
    pueType: 'ECO', reference: 'R',
    operator: { name: 'X', nif: 'B1' },
    goods,
    customsOffice: { code: 'ES1' }
  });

  test('recoge certificados ECO/BIO del item y usa el emisor como organismo de control', () => {
    const xml = pue.generate(base([{
      taricCode: '0805100000', description: 'Naranjas eco', productCategory: 'fruta', countryOfOrigin: 'MA',
      certifications: [{ type: 'ECO', number: 'ECO-1', issuer: 'ES-ECO-020', issuedAt: '2026-01-01', expiresAt: '2027-01-01' }]
    }]));
    expect(xml).toMatch(/<pue:Number>ECO-1<\/pue:Number>/);
    expect(xml).toMatch(/ES-ECO-020/);
    expect(xml).toMatch(/<pue:OrganicCategory>fruta<\/pue:OrganicCategory>/);
  });

  test('origen fuera de la lista de equivalencia UE exige autorizacion de importacion', () => {
    // MA (Marruecos) no esta en la lista -> Required true
    const xml = pue.generate(base([{ taricCode: '0805100000', description: 'X', countryOfOrigin: 'MA' }]));
    expect(xml).toMatch(/<pue:Required>true<\/pue:Required>/);
  });

  test('origen en la lista de equivalencia (US) no exige autorizacion', () => {
    const xml = pue.generate(base([{ taricCode: '0805100000', description: 'X', countryOfOrigin: 'US' }]));
    expect(xml).toMatch(/<pue:Required>false<\/pue:Required>/);
  });

  test('sin certificados el bloque de certificado queda vacio (Certificate />)', () => {
    const xml = pue.generate(base([{ taricCode: '0805100000', description: 'X', countryOfOrigin: 'US' }]));
    expect(xml).toMatch(/<pue:Certificate \/>/);
  });
});
