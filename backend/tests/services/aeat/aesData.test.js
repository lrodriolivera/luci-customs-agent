/**
 * aesData: del expediente a los datos del CC515C (AES).
 *
 * Reglas de la guía de la AEAT «Servicios Web de Exportación AES» V1.25:
 * autodespacho/directa/indirecta (p. 46 y 76-79), messageSender = NIF del
 * firmante (p. 69), PhaseID solo en pruebas (§25.5). Sin valores inventados:
 * lo que falta vuelve en un 422 con la lista y dónde se completa.
 */
const { expeditionToAesData } = require('../../../src/services/aeat/aesData');
const { buildAESExportXML } = require('../../../src/services/aeat/aesXmlBuilder');
const { ErrorValidacion } = require('../../../src/services/forms/identificadorAduanero');
const { TENANT_AGENTE, expedienteAes } = require('../../fixtures/aeat-aes/expedienteAes');

const bloque = (xml, tag) => {
  const i = xml.indexOf(`<ent:${tag}>`);
  return i < 0 ? '' : xml.slice(i, xml.indexOf(`</ent:${tag}>`, i));
};

function faltanDe(expedition, opciones = { tenant: TENANT_AGENTE }) {
  try {
    expeditionToAesData(expedition, opciones);
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorValidacion);
    expect(e.status).toBe(422);
    expect(e.code).toBe('DATOS_AES_FALTANTES');
    return e.faltan;
  }
  throw new Error('no lanzó');
}

describe('forma de representación: Declarant, Representative y status', () => {
  test('directa: Declarant = exportador sin contacto; Representative = agente con status 2 y contacto', () => {
    const datos = expeditionToAesData(expedienteAes(), { tenant: TENANT_AGENTE });
    expect(datos.formaRepresentacion).toBe('2');
    const xml = buildAESExportXML(datos);
    const decl = bloque(xml, 'Declarant');
    expect(decl).toContain('<ent:identificationNumber>ES89890010F</ent:identificationNumber>');
    expect(decl).not.toContain('<ent:ContactPerson>');
    const rep = bloque(xml, 'Representative');
    expect(rep).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(rep).toContain('<ent:status>2</ent:status>');
    expect(rep).toContain('<ent:eMailAddress>despacho@strixai.ai</ent:eMailAddress>');
    expect(bloque(xml, 'Exporter')).toContain('ES89890010F');
  });

  test('indirecta: Declarant = agente con contacto y sin Representative', () => {
    const datos = expeditionToAesData(expedienteAes({ representative: { representationType: 'indirect' } }), { tenant: TENANT_AGENTE });
    expect(datos.formaRepresentacion).toBe('3');
    const xml = buildAESExportXML(datos);
    const decl = bloque(xml, 'Declarant');
    expect(decl).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(decl).toContain('<ent:name>Despacho STRIX</ent:name>');
    expect(xml).not.toContain('<ent:Representative>');
  });

  test('sin tipo elegido se declara indirecta (valor por defecto del tenant)', () => {
    const datos = expeditionToAesData(expedienteAes({ representative: undefined }), { tenant: TENANT_AGENTE });
    expect(datos.formaRepresentacion).toBe('3');
    expect(datos.representative).toBeNull();
  });

  test('autodespacho: exportador = tenant; Declarant = Exporter con contacto y sin Representative', () => {
    const client = { ...expedienteAes().client, eori: 'ESB22477020', nif: 'B22477020' };
    const datos = expeditionToAesData(expedienteAes({ client }), { tenant: TENANT_AGENTE });
    expect(datos.formaRepresentacion).toBe('1');
    const xml = buildAESExportXML(datos);
    expect(bloque(xml, 'Declarant')).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(bloque(xml, 'Declarant')).toContain('<ent:ContactPerson>');
    expect(bloque(xml, 'Exporter')).toContain('ESB22477020');
    expect(xml).not.toContain('<ent:Representative>');
  });

  test('tenant exportador sin EORI de cliente: autodespacho con el EORI del tenant', () => {
    const tenant = { ...TENANT_AGENTE, businessInfo: { type: 'exporter', eori: 'ESB22477020' } };
    const datos = expeditionToAesData(expedienteAes({ client: { companyName: 'X', address: expedienteAes().client.address } }), { tenant });
    expect(datos.exporterEORI).toBe('ESB22477020');
    expect(datos.formaRepresentacion).toBe('1');
  });

  test('el contacto del representante del expediente (con su EORI) prevalece sobre el de la agencia', () => {
    const representative = { eori: 'ESB22477020', companyName: 'STRIX AI SL', representationType: 'indirect', contact: { name: 'Ana', phone: '600000000', email: 'ana@x.es' } };
    const datos = expeditionToAesData(expedienteAes({ representative }), { tenant: TENANT_AGENTE });
    expect(datos.declarantContact).toEqual({ name: 'Ana', phone: '600000000', email: 'ana@x.es' });
  });
});

describe('messageSender = NIF del firmante (sin ES)', () => {
  test.each([['directa', 'direct'], ['indirecta', 'indirect']])('%s: el NIF del tenant', (_n, tipo) => {
    const datos = expeditionToAesData(expedienteAes({ representative: { representationType: tipo } }), { tenant: TENANT_AGENTE });
    expect(datos.messageSender).toBe('B22477020');
    expect(buildAESExportXML(datos)).toContain('<ent:messageSender>B22477020</ent:messageSender>');
  });

  test('nunca el EORI del exportador cliente', () => {
    const xml = buildAESExportXML(expeditionToAesData(expedienteAes(), { tenant: TENANT_AGENTE }));
    expect(xml).not.toContain('<ent:messageSender>ES89890010F</ent:messageSender>');
    expect(xml).not.toContain('<ent:messageSender>89890010F</ent:messageSender>');
  });

  test('tenant con EORI de otro país: falta el NIF del firmante', () => {
    const tenant = { ...TENANT_AGENTE, businessInfo: { type: 'customs_agent', eori: 'FR12345678901' } };
    expect(faltanDe(expedienteAes(), { tenant }).join(' ')).toMatch(/NIF español del firmante/);
  });
});

describe('PhaseID y valores de pruebas solo en PRE', () => {
  test('PRE: PhaseID="AES1.1" y ubicación de pruebas 2801AAAAAC para ES002801', () => {
    const datos = expeditionToAesData(expedienteAes(), { tenant: TENANT_AGENTE, isPRE: true });
    const xml = buildAESExportXML(datos);
    expect(xml).toContain('<ent:CC515C PhaseID="AES1.1">');
    expect(datos.locationAuthorisationNumber).toBe('2801AAAAAC');
  });

  test('producción: sin PhaseID y sin ubicación por defecto (422)', () => {
    expect(faltanDe(expedienteAes(), { tenant: TENANT_AGENTE, isPRE: false }).join(' ')).toMatch(/ubicación de las mercancías/);
    const decl = { ...expedienteAes().declaration, goodsLocation: '2801XYZ123' };
    const xml = buildAESExportXML(expeditionToAesData(expedienteAes({ declaration: decl }), { tenant: TENANT_AGENTE, isPRE: false }));
    expect(xml).toContain('<ent:CC515C>');
    expect(xml).not.toContain('PhaseID');
    expect(xml).toContain('<ent:authorisationNumber>2801XYZ123</ent:authorisationNumber>');
  });

  test('la ubicación por defecto de PRE no se aplica a otra aduana', () => {
    const decl = { ...expedienteAes().declaration, customsOffice: 'ES004601', officeOfExit: 'ES004601' };
    expect(faltanDe(expedienteAes({ declaration: decl })).join(' ')).toMatch(/ubicación de las mercancías/);
  });

  test('una ubicación de otra aduana se rechaza (4 primeros = 4 últimos de la aduana)', () => {
    const decl = { ...expedienteAes().declaration, goodsLocation: 'ES004601AAAAAC' };
    expect(faltanDe(expedienteAes({ declaration: decl })).join(' ')).toMatch(/no pertenece a la aduana de exportación ES002801/);
  });
});

describe('destinatario', () => {
  test('sin EORI: nombre y dirección, sin identificationNumber vacío', () => {
    const xml = buildAESExportXML(expeditionToAesData(expedienteAes(), { tenant: TENANT_AGENTE }));
    const c = bloque(xml, 'Consignee');
    expect(c).not.toContain('<ent:identificationNumber>');
    expect(c).toContain('<ent:name>US Corp</ent:name>');
    expect(c).toContain('<ent:postcode>10001</ent:postcode>');
  });

  test('con EORI: solo el identificador', () => {
    const consignee = { eori: 'ES89890010F', address: { country: 'US' } };
    const c = bloque(buildAESExportXML(expeditionToAesData(expedienteAes({ consignee }), { tenant: TENANT_AGENTE })), 'Consignee');
    expect(c).toContain('<ent:identificationNumber>ES89890010F</ent:identificationNumber>');
    expect(c).not.toContain('<ent:Address>');
  });

  test('país sin código postal (CL505): no se exige ni se emite', () => {
    const consignee = { companyName: 'HK Ltd', address: { street: '1 Queen Rd', city: 'Hong Kong', country: 'HK' } };
    const c = bloque(buildAESExportXML(expeditionToAesData(expedienteAes({ consignee }), { tenant: TENANT_AGENTE })), 'Consignee');
    expect(c).not.toContain('<ent:postcode>');
  });
});

describe('sin valores ficticios: 422 con la lista de lo que falta y dónde', () => {
  test('expediente vacío de datos de envío: lista completa', () => {
    const faltan = faltanDe(expedienteAes({
      declaration: { type: 'AES' }, consignee: {}, incoterm: {}, invoiceNumber: '', transport: {},
      client: { companyName: 'Exp', eori: 'ES89890010F' },
      goods: [{ description: 'X', taricCode: '6302100000', invoiceValue: 10 }]
    }), { tenant: TENANT_AGENTE, isPRE: false });
    const todo = faltan.join(' | ');
    for (const patron of [
      /aduana de exportación \(expediente › declaración AES\)/,
      /aduana de salida \(expediente › declaración AES\)/,
      /ubicación de las mercancías/,
      /país de destino \(expediente › destinatario\)/,
      /nombre del destinatario/,
      /incoterm \(expediente › incoterm\)/,
      /lugar convenido del incoterm/,
      /identificación del medio de transporte/,
      /nacionalidad del medio de transporte/,
      /documento de transporte \(tipo y número\) \(expediente › transporte\)/,
      /número de la factura comercial/,
      /peso bruto \(expediente › mercancías, partida 1\)/,
      /peso neto/,
      /número de bultos/,
      /provincia de expedición: código postal español del exportador \(ficha del cliente\)/
    ]) expect(todo).toMatch(patron);
  });

  test('sin contacto en la agencia ni en el expediente: falta el contacto', () => {
    const tenant = { ...TENANT_AGENTE, primaryContact: undefined };
    expect(faltanDe(expedienteAes(), { tenant }).join(' ')).toMatch(/teléfono de la persona de contacto del representante \(Ajustes › Empresa/);
  });

  test('sin país de origen no se inventa ES (es opcional); la provincia sale del código postal', () => {
    const goods = [{ ...expedienteAes().goods[0], originCountry: undefined }];
    const xml = buildAESExportXML(expeditionToAesData(expedienteAes({ goods }), { tenant: TENANT_AGENTE }));
    const origen = bloque(xml, 'Origin');
    expect(origen).not.toContain('<ent:countryOfOrigin>');
    expect(origen).toContain('<ent:regionOfDispatch>28</ent:regionOfDispatch>');
  });

  test('aduana de salida distinta: salida indirecta con medio de salida y modo interior', () => {
    const decl = { ...expedienteAes().declaration, officeOfExit: 'ES004601' };
    const datos = expeditionToAesData(expedienteAes({ declaration: decl }), { tenant: TENANT_AGENTE });
    expect(datos.directExport).toBe(false);
    const xml = buildAESExportXML(datos);
    expect(xml).toContain('<ent:inlandModeOfTransport>3</ent:inlandModeOfTransport>');
    expect(bloque(xml, 'DepartureTransportMeans')).toContain('<ent:identificationNumber>1234ABC</ent:identificationNumber>');
  });

  test('aduana de salida igual: salida directa sin medio de salida', () => {
    const xml = buildAESExportXML(expeditionToAesData(expedienteAes(), { tenant: TENANT_AGENTE }));
    expect(xml).not.toContain('<ent:DepartureTransportMeans>');
    expect(xml).not.toContain('<ent:inlandModeOfTransport>');
    expect(bloque(xml, 'ActiveBorderTransportMeans')).toContain('<ent:nationality>ES</ent:nationality>');
  });

  test('incoterm en destino: el país del lugar convenido es el de destino', () => {
    const datos = expeditionToAesData(expedienteAes({ incoterm: { code: 'dap', place: 'New York' } }), { tenant: TENANT_AGENTE });
    expect(datos.incotermCode).toBe('DAP');
    expect(datos.incotermCountry).toBe('US');
  });

  test('tipo de bulto de tres letras del alta se traduce (CTN -> CT)', () => {
    const goods = [{ ...expedienteAes().goods[0], packages: { quantity: 3, type: 'CTN' } }];
    const xml = buildAESExportXML(expeditionToAesData(expedienteAes({ goods }), { tenant: TENANT_AGENTE }));
    expect(xml).toContain('<ent:typeOfPackages>CT</ent:typeOfPackages>');
  });

  test('sin EORI del exportador: 422 del cliente (antes de la lista)', () => {
    expect(() => expeditionToAesData(expedienteAes({ client: { companyName: 'X' } }), { tenant: TENANT_AGENTE }))
      .toThrow(/Falta el EORI del cliente/);
  });
});
