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

// El mensaje tiene tres datos que AEAT exige y que el XSD marca opcionales: el
// numero de autorizacion del lugar de la mercancia, la autorizacion ACE de
// destinatario autorizado y la referencia a la sumaria previa. Todas las llamadas
// los llevan; los casos que prueban su ausencia usan buildCC007ArrivalXML directo.
const AUTH = '2901MLG005';
const AUTH_ACE = 'ESACE02026000008';
const SUMARIA = '29016000001';
const buildCC007ArrivalXML_ = (data) => buildCC007ArrivalXML({
  authorisationNumber: AUTH,
  authorisationReference: AUTH_ACE,
  numeroSumariaRecepcion: SUMARIA,
  ...data
});

describe('buildCC007ArrivalXML', () => {
  test('envuelve en un envelope SOAP con el mensaje CC007C qualified', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ES00085123456789' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC007CV1Ent');
    expect(xml).toContain('<ent:messageType>CC007C</ent:messageType>');
    expect(xml).toContain('<ent:messageRecipient>NTA.ES</ent:messageRecipient>');
  });

  test('vuelca MRN, aduana de destino y EORI del destinatario', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', officeOfDestination: 'ES000851', traderEORI: 'ESB22477020' });

    expect(xml).toContain('<ent:MRN>26ESX</ent:MRN>');
    expect(xml).toContain('<ent:referenceNumber>ES000851</ent:referenceNumber>');
    expect(xml).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    expect(xml).toContain('<ent:messageSender>ESB22477020</ent:messageSender>');
  });

  /**
   * El XSD lo marca minOccurs="0", pero PRE lo rechaza con errorReason 2026
   * ("Este elemento debe venir vacio.") sobre el valor 'ES'. Igual que en el
   * CC044, el TraderAtDestination del CC007 solo lleva identificationNumber.
   */
  test('TraderAtDestination no lleva communicationLanguageAtDestination', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', traderEORI: 'ESB22477020' });
    expect(xml).not.toContain('communicationLanguageAtDestination');
  });

  /**
   * PRE rechaza el 0 con errorReason 1415 ("SimplifiedProcedure erroneo") en
   * cuanto la ubicacion es un lugar autorizado, que es el unico caso que admite
   * (typeOfLocation B, ver mas abajo). Es decir: en el CC007 espanol la llegada
   * es siempre de destinatario autorizado, asi que el defecto es 1.
   */
  test('el procedimiento simplificado cae a 1 (destinatario autorizado) por defecto', () => {
    expect(buildCC007ArrivalXML_({ mrn: '26ESX' })).toContain('<ent:simplifiedProcedure>1</ent:simplifiedProcedure>');
    expect(buildCC007ArrivalXML_({ mrn: '26ESX', simplifiedProcedure: '0' })).toContain('<ent:simplifiedProcedure>0</ent:simplifiedProcedure>');
  });

  test('la fecha de llegada cae a ahora (DateTimeType) si no se da', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:preparationDateAndTime>/);
    expect(xml).toMatch(/<ent:arrivalNotificationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:arrivalNotificationDateAndTime>/);
  });

  /**
   * Los llamantes historicos pasaban AAAAMMDD (el formato que generaba el propio
   * builder antes de la correccion), asi que se sigue aceptando y se traduce.
   */
  test('traduce el AAAAMMDD historico a DateTimeType en vez de mandarlo tal cual', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', arrivalDate: '20260804' });
    expect(xml).toContain('<ent:preparationDateAndTime>2026-08-04T00:00:00</ent:preparationDateAndTime>');
  });

  test('acepta un Date (lo que pasa transitService) y lo normaliza', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', arrivalDate: new Date('2026-08-04T10:30:00Z') });
    expect(xml).toContain('<ent:preparationDateAndTime>2026-08-04T10:30:00</ent:preparationDateAndTime>');
  });

  test('respeta la fecha de llegada explicita', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', arrivalDate: '2026-08-04T10:30:00' });
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
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml).toContain('<ent:incidentFlag>0</ent:incidentFlag>');
    expect(xml.indexOf('<ent:simplifiedProcedure>'))
      .toBeLessThan(xml.indexOf('<ent:incidentFlag>'));
    expect(xml.indexOf('<ent:incidentFlag>'))
      .toBeLessThan(xml.indexOf('</ent:TransitOperation>'));
  });

  test('incluye Indicadores007 con indicadorTipoSumaria (obligatorio en el XSD)', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml).toContain('<ent:Indicadores007>');
    expect(xml).toMatch(/<ent:indicadorTipoSumaria>.{1,2}<\/ent:indicadorTipoSumaria>/);
  });

  /**
   * El XSD solo restringe la forma de typeOfLocation / qualifierOfIdentification
   * a `[A-Za-z]{1}`: los valores validos son regla de negocio y AEAT los dicta
   * en la respuesta. Con A+V (lugar designado + identificador de aduana) PRE
   * devolvio literalmente "Debe ser 'B'" / "Debe ser 'Y'", ademas de exigir
   * authorisationNumber y prohibir CustomsOffice. Es decir: en el CC007 espanol
   * la ubicacion es SIEMPRE un lugar autorizado identificado por su numero de
   * autorizacion, no una aduana.
   */
  test('incluye Consignment con LocationOfGoods (obligatorio en el XSD)', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', officeOfDestination: 'ES002901', authorisationNumber: 'ESAWB0000123' });
    expect(xml).toContain('<ent:Consignment>');
    expect(xml).toContain('<ent:LocationOfGoods>');
    expect(xml).toContain('<ent:typeOfLocation>B</ent:typeOfLocation>');
    expect(xml).toContain('<ent:qualifierOfIdentification>Y</ent:qualifierOfIdentification>');
    expect(xml).toContain('<ent:authorisationNumber>ESAWB0000123</ent:authorisationNumber>');
  });

  test('LocationOfGoods no lleva CustomsOffice: AEAT lo rechaza con "no debe rellenarse"', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', officeOfDestination: 'ES002901', authorisationNumber: 'ESAWB0000123' });
    expect(xml).not.toContain('<ent:CustomsOffice>');
    // La aduana de destino sigue apareciendo una sola vez, en su propio bloque.
    expect(xml.match(/<ent:referenceNumber>ES002901<\/ent:referenceNumber>/g)).toHaveLength(1);
  });

  /**
   * authorisationNumber es obligatorio con B+Y, asi que si el llamante no lo
   * aporta hay que fallar aqui —donde el mensaje puede nombrar el dato— y no
   * mandar un XML que AEAT rechazara con "Es Obligatorio" sin mas contexto.
   */
  test('exige authorisationNumber: sin el no se puede construir el mensaje', () => {
    expect(() => buildCC007ArrivalXML({ mrn: '26ESX', officeOfDestination: 'ES002901' }))
      .toThrow(/autorizaci/i);
  });

  /**
   * El codelist de indicadorTipoSumaria no esta en ningun XSD. Se barrieron 45
   * candidatos contra PRE y TODOS dieron errorReason 2066 ("El indicador del tipo
   * de sumaria no es valido"), incluidos 'N' y 'G4'. Los dos unicos validos los
   * confesaron las reglas condicionales vecinas al rellenar sus companeros:
   *   2067 - Si el indicador es 'SP', numeroSumariaRecepcion es obligatorio.
   *   2068 - Si el indicador es 'GP', el grupo G4Previos es obligatorio.
   * Se usa 'SP' porque un transito que llega a un deposito temporal se asocia a
   * la sumaria de recepcion de ese recinto.
   */
  test('el indicador de tipo de sumaria solo admite SP o GP: los 45 demas los rechazo PRE', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:indicadorTipoSumaria>(SP|GP)<\/ent:indicadorTipoSumaria>/);
  });

  /**
   * 2067: con 'SP' la sumaria de recepcion es obligatoria. El formato lo dicto
   * AEAT a base de rechazos: RRRR + ultimo digito del anyo + 6 digitos
   * ('29016000001'). Otros formatos dan "ADDS_Formato de sumaria erroneo" y un
   * recinto que no cuadre con la aduana de destino da "ADDS_Recinto no valido".
   */
  test('con SP incluye numeroSumariaRecepcion: sin el AEAT da 2067', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', numeroSumariaRecepcion: '29016000001' });
    expect(xml).toContain('<ent:indicadorTipoSumaria>SP</ent:indicadorTipoSumaria>');
    expect(xml).toContain('<ent:numeroSumariaRecepcion>29016000001</ent:numeroSumariaRecepcion>');
    expect(xml.indexOf('<ent:indicadorTipoSumaria>'))
      .toBeLessThan(xml.indexOf('<ent:numeroSumariaRecepcion>'));
  });

  test('exige numeroSumariaRecepcion cuando el indicador es SP', () => {
    expect(() => buildCC007ArrivalXML({
      mrn: '26ESX', authorisationNumber: AUTH, authorisationReference: AUTH_ACE
    })).toThrow(/sumaria/i);
  });

  /**
   * 2068: con 'GP' lo obligatorio es el G4 previo, y entonces la sumaria de
   * recepcion NO debe venir ("si no, no debe venir" dice la propia regla).
   */
  test('con GP incluye G4Previos y no la sumaria de recepcion', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', tipoSumaria: 'GP', mrnG4Previo: '26ES002801501095J7', numeroSumariaRecepcion: '' });
    expect(xml).toContain('<ent:indicadorTipoSumaria>GP</ent:indicadorTipoSumaria>');
    expect(xml).toContain('<ent:G4Previos>');
    expect(xml).toContain('<ent:mrnG4Previo>26ES002801501095J7</ent:mrnG4Previo>');
    expect(xml).not.toContain('<ent:numeroSumariaRecepcion>');
  });

  /**
   * Con simplifiedProcedure 1 AEAT exige la autorizacion de destinatario
   * autorizado (errorReason 1440, "la autorizacion debe venir rellena"), y el
   * tipo tiene que ser C522: el C521 del IE015 (expedidor autorizado) lo rechaza
   * con CL236. La referencia es una ACE, no la ACR de la expedicion ni un codigo
   * de ubicacion —esos dan 1437 y 1434 respectivamente— y su titular debe
   * coincidir con el TraderAtDestination (1435).
   */
  test('incluye el bloque Authorisation C522 con la referencia ACE', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', authorisationReference: 'ESACE02026000008' });
    expect(xml).toContain('<ent:Authorisation>');
    expect(xml).toContain('<ent:sequenceNumber>1</ent:sequenceNumber>');
    expect(xml).toContain('<ent:type>C522</ent:type>');
    expect(xml).toContain('<ent:referenceNumber>ESACE02026000008</ent:referenceNumber>');
  });

  test('Authorisation va entre TransitOperation y CustomsOfficeOfDestinationActual', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml.indexOf('</ent:TransitOperation>'))
      .toBeLessThan(xml.indexOf('<ent:Authorisation>'));
    expect(xml.indexOf('<ent:Authorisation>'))
      .toBeLessThan(xml.indexOf('<ent:CustomsOfficeOfDestinationActual>'));
  });

  /**
   * Con el procedimiento normal no hay autorizacion que declarar, y mandarla
   * vacia seria peor que omitirla: AEAT valida su vigencia y su titular.
   */
  test('sin procedimiento simplificado no emite Authorisation', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX', simplifiedProcedure: '0', authorisationReference: '' });
    expect(xml).not.toContain('<ent:Authorisation>');
  });

  test('exige la autorizacion ACE cuando el procedimiento es simplificado', () => {
    expect(() => buildCC007ArrivalXML({
      mrn: '26ESX', authorisationNumber: AUTH, numeroSumariaRecepcion: SUMARIA
    })).toThrow(/ACE|autorizaci/i);
  });

  test('respeta el orden del sequence: TraderAtDestination < Indicadores007 < Consignment', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml.indexOf('<ent:TraderAtDestination>'))
      .toBeLessThan(xml.indexOf('<ent:Indicadores007>'));
    expect(xml.indexOf('<ent:Indicadores007>'))
      .toBeLessThan(xml.indexOf('<ent:Consignment>'));
  });

  test('las fechas usan DateTimeType (AAAA-MM-DDThh:mm:ss), no AAAAMMDD', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:preparationDateAndTime>/);
    expect(xml).toMatch(/<ent:arrivalNotificationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:arrivalNotificationDateAndTime>/);
  });

  test('el destinatario es NTA.ES, el mismo que acepta el IE015', () => {
    expect(buildCC007ArrivalXML_({ mrn: '26ESX' }))
      .toContain('<ent:messageRecipient>NTA.ES</ent:messageRecipient>');
  });

  test('messageIdentification no pasa de 35 caracteres (MessageIdentificationContentType)', () => {
    const xml = buildCC007ArrivalXML_({ mrn: '26ESX' });
    const id = xml.match(/<ent:messageIdentification>(.*?)<\/ent:messageIdentification>/)[1];
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(35);
  });
});
