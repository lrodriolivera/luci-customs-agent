/**
 * cc007XmlBuilder: XML de notificacion de llegada NCTS (mensaje CC007C) para la
 * AEAT. Se envia cuando la mercancia llega a la aduana de destino en una
 * operacion de transito.
 *
 * Generador PURO —sin BD ni red—: genera su propio transactionId con Date y
 * Math.random, pero no hace I/O. Es un mensaje casi plano; la unica rama es la
 * fecha de llegada (explicita vs hoy). No se asertan fecha ni id exactos, solo
 * su forma y el volcado de campos.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildCC007ArrivalXML } = require('../../../src/services/aeat/cc007XmlBuilder');

describe('buildCC007ArrivalXML', () => {
  test('envuelve en un envelope SOAP con el mensaje CC007C qualified', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ES00085123456789' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC007CV1Ent');
    expect(xml).toContain('<ent:messageType>CC007C</ent:messageType>');
    expect(xml).toContain('<ent:messageRecipient>NTA.ES</ent:messageRecipient>');
  });

  test('vuelca MRN, aduana de destino y EORI del destinatario', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', officeOfDestination: 'ES000851', traderEORI: 'ESB22477020' });

    expect(xml).toContain('<ent:MRN>26ESX</ent:MRN>');
    expect(xml).toContain('<ent:referenceNumber>ES000851</ent:referenceNumber>');
    expect(xml).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(xml).toContain('<ent:messageSender>ESB22477020</ent:messageSender>');
    // El idioma de comunicacion en destino es siempre ES.
    expect(xml).toContain('<ent:communicationLanguageAtDestination>ES</ent:communicationLanguageAtDestination>');
  });

  test('el procedimiento simplificado cae a 0 (normal) por defecto', () => {
    expect(buildCC007ArrivalXML({ mrn: '26ESX' })).toContain('<ent:simplifiedProcedure>0</ent:simplifiedProcedure>');
    expect(buildCC007ArrivalXML({ mrn: '26ESX', simplifiedProcedure: '1' })).toContain('<ent:simplifiedProcedure>1</ent:simplifiedProcedure>');
  });

  test('la fecha de llegada cae a ahora (DateTimeType) si no se da', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:preparationDateAndTime>/);
    expect(xml).toMatch(/<ent:arrivalNotificationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:arrivalNotificationDateAndTime>/);
  });

  /**
   * Los llamantes historicos pasaban AAAAMMDD (el formato que generaba el propio
   * builder antes de la correccion), asi que se sigue aceptando y se traduce.
   */
  test('traduce el AAAAMMDD historico a DateTimeType en vez de mandarlo tal cual', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', arrivalDate: '20260804' });
    expect(xml).toContain('<ent:preparationDateAndTime>2026-08-04T00:00:00</ent:preparationDateAndTime>');
  });

  test('acepta un Date (lo que pasa transitService) y lo normaliza', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', arrivalDate: new Date('2026-08-04T10:30:00Z') });
    expect(xml).toContain('<ent:preparationDateAndTime>2026-08-04T10:30:00</ent:preparationDateAndTime>');
  });

  test('respeta la fecha de llegada explicita', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', arrivalDate: '2026-08-04T10:30:00' });
    expect(xml).toContain('<ent:preparationDateAndTime>2026-08-04T10:30:00</ent:preparationDateAndTime>');
    expect(xml).toContain('<ent:arrivalNotificationDateAndTime>2026-08-04T10:30:00</ent:arrivalNotificationDateAndTime>');
  });
});

/**
 * E2E 8/Ago: AEAT PRE rechazo el CC007 con
 *   "1207 - Se esperaba nodo inicio (...CC007CV1Ent.xsd}incidentFlag) y se ha
 *    encontrado nodo evento"
 * El builder se escribio sin mirar el XSD oficial (ES_CC007C_v515.xsd, que
 * incluye ES_ctypes_v515.xsd) y le faltaban tres cosas obligatorias:
 * `incidentFlag` en TransitOperation, el bloque `Indicadores007` y el bloque
 * `Consignment` con LocationOfGoods. Ademas las fechas iban en AAAAMMDD cuando
 * DateTimeType exige `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`, y el destinatario
 * era `NETA.ES` mientras el IE015 aceptado usa `NTA.ES`.
 *
 * El orden del sequence del XSD es normativo: un elemento correcto en el sitio
 * equivocado da el mismo error 1207 que uno ausente.
 */
describe('buildCC007ArrivalXML: conformidad con ES_CC007C_v515.xsd', () => {
  test('TransitOperation lleva incidentFlag despues de simplifiedProcedure', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    expect(xml).toContain('<ent:incidentFlag>0</ent:incidentFlag>');
    expect(xml.indexOf('<ent:simplifiedProcedure>'))
      .toBeLessThan(xml.indexOf('<ent:incidentFlag>'));
    expect(xml.indexOf('<ent:incidentFlag>'))
      .toBeLessThan(xml.indexOf('</ent:TransitOperation>'));
  });

  test('incluye Indicadores007 con indicadorTipoSumaria (obligatorio en el XSD)', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    expect(xml).toContain('<ent:Indicadores007>');
    expect(xml).toMatch(/<ent:indicadorTipoSumaria>.{1,2}<\/ent:indicadorTipoSumaria>/);
  });

  /**
   * Del codelist NCTS P5: typeOfLocation A = "lugar designado" y
   * qualifierOfIdentification V = "identificador de aduana", que se acompana de
   * CustomsOffice/referenceNumber. Se elige esta pareja y no B+Y ("lugar
   * autorizado" + numero de autorizacion) porque la aduana de destino ya se
   * conoce, mientras que un numero de autorizacion habria que inventarlo.
   */
  test('incluye Consignment con LocationOfGoods (obligatorio en el XSD)', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX', officeOfDestination: 'ES002901' });
    expect(xml).toContain('<ent:Consignment>');
    expect(xml).toContain('<ent:LocationOfGoods>');
    expect(xml).toContain('<ent:typeOfLocation>A</ent:typeOfLocation>');
    expect(xml).toContain('<ent:qualifierOfIdentification>V</ent:qualifierOfIdentification>');
    // La aduana del LocationOfGoods es la de destino: aparece dos veces en el XML.
    expect(xml.match(/<ent:referenceNumber>ES002901<\/ent:referenceNumber>/g)).toHaveLength(2);
  });

  test('respeta el orden del sequence: TraderAtDestination < Indicadores007 < Consignment', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    expect(xml.indexOf('<ent:TraderAtDestination>'))
      .toBeLessThan(xml.indexOf('<ent:Indicadores007>'));
    expect(xml.indexOf('<ent:Indicadores007>'))
      .toBeLessThan(xml.indexOf('<ent:Consignment>'));
  });

  test('las fechas usan DateTimeType (AAAA-MM-DDThh:mm:ss), no AAAAMMDD', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:preparationDateAndTime>/);
    expect(xml).toMatch(/<ent:arrivalNotificationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:arrivalNotificationDateAndTime>/);
  });

  test('el destinatario es NTA.ES, el mismo que acepta el IE015', () => {
    expect(buildCC007ArrivalXML({ mrn: '26ESX' }))
      .toContain('<ent:messageRecipient>NTA.ES</ent:messageRecipient>');
  });

  test('messageIdentification no pasa de 35 caracteres (MessageIdentificationContentType)', () => {
    const xml = buildCC007ArrivalXML({ mrn: '26ESX' });
    const id = xml.match(/<ent:messageIdentification>(.*?)<\/ent:messageIdentification>/)[1];
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(35);
  });
});
