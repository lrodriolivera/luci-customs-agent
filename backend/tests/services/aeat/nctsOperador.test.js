/**
 * Mensajes NCTS del operador en la aduana de partida que LUCI no tenía:
 * modificación de la predeclaración (CC013C), solicitud de invalidación
 * (CC014C) y notificación de presentación de las mercancías (CC170C), más la
 * predeclaración (CC015C con additionalDeclarationType D) y la regla del código
 * de mercancía (CSRDT152 + NC «Es 'R'»).
 *
 * Las peticiones se validan contra los XSD oficiales de la AEAT
 * (ncts5/CC0xxCV1Ent.xsd, v51.8.0) descargados el 16/Nov/2026. Las respuestas
 * OK son los ejemplos de la guía «Servicios Web de Tránsito NCTS6» v1.21
 * (25.9 y 25.11) con datos de hoy y validan contra los CC0xxCV1Sal.xsd; la de
 * CC013 se monta con los campos de la guía 11.5 y la EF con el bloque
 * FunctionalError del XSD (no hay rechazos reales de estos servicios todavía).
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildNCTSTransitXML, buildCC013AmendmentXML, validarCodigosMercancia } = require('../../../src/services/aeat/nctsXmlBuilder');
const { buildCC014InvalidationXML } = require('../../../src/services/aeat/cc014XmlBuilder');
const { buildCC170PresentationXML } = require('../../../src/services/aeat/cc170XmlBuilder');
const { interpretarRespuestaNcts, ENDPOINTS_NCTS } = require('../../../src/services/aeat/nctsRespuesta');

const FIX = path.join(__dirname, '../../fixtures/aeat-consultas/ncts');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
const FECHA = new Date('2026-11-16T07:30:10Z');
const MRN = '26ES002801501441J7';

function validar(xml, esquema) {
  const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(xml)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ncts-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  try {
    execFileSync('xmllint', ['--noout', '--schema', path.join(FIX, esquema), fichero], { stdio: 'pipe' });
  } catch (e) {
    throw new Error(String(e.stderr || e.message));
  }
}

/** Datos de la predeclaración que PRE admite (ES002801 -> ES002901, N337 28016000001 p1). */
function datosDeclaracion(extra = {}) {
  return {
    lrn: 'LRNMWIXGE5GQA',
    transitType: 'T1',
    additionalDeclarationType: 'D',
    officeOfDeparture: 'ES002801',
    officeOfDestination: 'ES002901',
    holderEORI: 'ESB22477020',
    holderName: 'STRIX AI SL',
    guaranteeType: '1',
    guaranteeGRN: '26ES0002800000010',
    guaranteeAccessCode: '0000',
    authorisationNumber: 'ESACR02026000002',
    locationAuthorisationNumber: '2801AAAAAA',
    placeOfLoadingCountry: 'ES',
    placeOfLoadingLocation: 'Madrid',
    consigneeEORI: 'ESB22477020',
    consignment: {
      goodsItems: [{
        description: 'Ropa de cama de punto de algodón', taricCode: '6302100000', grossWeight: 25, netWeight: 20,
        packages: 2, packageType: 'CT', previousDocumentType: 'N337', previousDocumentRef: '28016000001', previousDocumentItem: '1'
      }]
    },
    ...extra
  };
}

describe('código de mercancía (CSRDT152 + NC)', () => {
  test('un TARIC de 10 cifras parte en subpartida SA (6) y NC (2)', () => {
    const xml = buildNCTSTransitXML(datosDeclaracion());
    expect(xml).toContain('<ent:harmonizedSystemSubHeadingCode>630210</ent:harmonizedSystemSubHeadingCode>');
    expect(xml).toContain('<ent:combinedNomenclatureCode>00</ent:combinedNomenclatureCode>');
  });

  test('sin las 8 cifras de la NC no se inventa «00»: error que nombra la partida', () => {
    const datos = datosDeclaracion();
    datos.consignment.goodsItems[0].taricCode = '630210';
    expect(() => buildNCTSTransitXML(datos)).toThrow(/Partida 1.*630210.*8 cifras/);
  });

  test('tampoco con el código vacío, ni en la modificación', () => {
    const datos = datosDeclaracion({ mrn: MRN, messageSender: 'B22477020' });
    datos.consignment.goodsItems[0].taricCode = '';
    expect(() => buildCC013AmendmentXML(datos)).toThrow(/Partida 1/);
  });

  test('el error es de validación (422) y lista todas las partidas', () => {
    let error;
    try {
      validarCodigosMercancia([{ taricCode: '6302' }, { taricCode: '63021000' }, { taricCode: 'ABCDEFGH' }]);
    } catch (e) { error = e; }
    expect(error.status).toBe(422);
    expect(error.errors).toHaveLength(2);
    expect(error.errors[0]).toMatch(/Partida 1/);
    expect(error.errors[1]).toMatch(/Partida 3/);
  });

  test('admite el código con espacios o puntos de presentación', () => {
    expect(() => validarCodigosMercancia([{ taricCode: '6302.10 00 00' }])).not.toThrow();
  });
});

describe('CC015C como predeclaración (additionalDeclarationType D)', () => {
  const xml = buildNCTSTransitXML(datosDeclaracion());

  test('lleva D en TransitOperation', () => {
    expect(xml).toContain('<ent:additionalDeclarationType>D</ent:additionalDeclarationType>');
  });

  siHayXmllint('valida contra CC015CV1Ent.xsd', () => {
    expect(() => validar(xml, 'CC015CV1Ent.xsd')).not.toThrow();
  });
});

describe('CC013C: modificación de la predeclaración', () => {
  const xml = buildCC013AmendmentXML(datosDeclaracion({ mrn: MRN, messageSender: 'ESB22477020', mensajeId: 'LUCIN26111607301000001234', fecha: FECHA }));

  test('va al servicio CC013CV1', () => {
    expect(ENDPOINTS_NCTS.CC013C).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CC013CV1SOAP');
  });

  test('remitente = NIF sin ES, tipo CC013C, MRN y modificación completa (amendmentTypeFlag 0)', () => {
    expect(xml).toContain('ncts5/CC013CV1Ent.xsd');
    expect(xml).toContain('<ent:messageSender>B22477020</ent:messageSender>');
    expect(xml).toContain('<ent:messageType>CC013C</ent:messageType>');
    expect(xml).toContain(`<ent:MRN>${MRN}</ent:MRN>`);
    expect(xml).toContain('<ent:amendmentTypeFlag>0</ent:amendmentTypeFlag>');
    expect(xml).toContain('Id="LUCIN26111607301000001234"');
    expect(xml).toContain('<ent:preparationDateAndTime>2026-11-16T08:30:10</ent:preparationDateAndTime>');
  });

  test('no rellena el LRN («No se puede rellenar», guía 11.4)', () => {
    expect(xml).not.toContain('<ent:LRN>');
  });

  test('lleva TODOS los datos de la predeclaración, no solo los cambiados', () => {
    expect(xml).toContain('<ent:HolderOfTheTransitProcedure>');
    expect(xml).toContain('<ent:GRN>26ES0002800000010</ent:GRN>');
    expect(xml).toContain('<ent:referenceNumber>28016000001</ent:referenceNumber>');
    expect(xml).toContain('<ent:authorisationNumber>2801AAAAAA</ent:authorisationNumber>');
  });

  test('exige MRN y remitente válidos antes de salir a la red', () => {
    expect(() => buildCC013AmendmentXML(datosDeclaracion({ mrn: '123', messageSender: 'B22477020' }))).toThrow('MRN');
    expect(() => buildCC013AmendmentXML(datosDeclaracion({ mrn: MRN, messageSender: '' }))).toThrow('remitente');
  });

  siHayXmllint('valida contra CC013CV1Ent.xsd', () => {
    expect(() => validar(xml, 'CC013CV1Ent.xsd')).not.toThrow();
  });
});

describe('CC014C: solicitud de invalidación', () => {
  const datos = {
    mrn: MRN, officeOfDeparture: 'ES002801', holderEORI: 'ESB22477020', motivo: 'Prueba de anulación <LUCI>',
    sender: 'ESB22477020', mensajeId: 'LUCIN26111608151200001234', fecha: FECHA
  };
  const xml = buildCC014InvalidationXML(datos);

  test('va al servicio CC014CV1', () => {
    expect(ENDPOINTS_NCTS.CC014C).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CC014CV1SOAP');
  });

  test('MRN, iniciada por el operador (0), justificación escapada, aduana y titular', () => {
    expect(xml).toContain('<ent:messageSender>B22477020</ent:messageSender>');
    expect(xml).toContain('<ent:messageType>CC014C</ent:messageType>');
    expect(xml).toContain(`<ent:TransitOperation><ent:MRN>${MRN}</ent:MRN></ent:TransitOperation>`);
    expect(xml).toContain('<ent:initiatedByCustoms>0</ent:initiatedByCustoms>');
    expect(xml).toContain('<ent:justification>Prueba de anulación &lt;LUCI&gt;</ent:justification>');
    expect(xml).toContain('<ent:CustomsOfficeOfDeparture><ent:referenceNumber>ES002801</ent:referenceNumber></ent:CustomsOfficeOfDeparture>');
    expect(xml).toContain('<ent:HolderOfTheTransitProcedure><ent:identificationNumber>ESB22477020</ent:identificationNumber></ent:HolderOfTheTransitProcedure>');
    // Fecha de solicitud/decisión: «No se puede rellenar».
    expect(xml).not.toContain('requestDateAndTime');
    expect(xml).not.toContain('<ent:decision>');
  });

  test('sin motivo no se pide la invalidación («es R», guía 10.4)', () => {
    expect(() => buildCC014InvalidationXML({ ...datos, motivo: '   ' })).toThrow(/motivo/i);
  });

  test('un motivo de más de 512 caracteres se rechaza, no se trunca en silencio', () => {
    expect(() => buildCC014InvalidationXML({ ...datos, motivo: 'x'.repeat(513) })).toThrow(/512/);
  });

  test('MRN y aduana de partida obligatorios y bien formados', () => {
    expect(() => buildCC014InvalidationXML({ ...datos, mrn: 'X' })).toThrow('MRN');
    expect(() => buildCC014InvalidationXML({ ...datos, officeOfDeparture: 'ES28' })).toThrow(/aduana de partida/i);
  });

  siHayXmllint('valida contra CC014CV1Ent.xsd', () => {
    expect(() => validar(xml, 'CC014CV1Ent.xsd')).not.toThrow();
  });
});

describe('CC170C: presentación de las mercancías en la aduana de partida', () => {
  const datos = {
    lrn: 'LRNMWIXGE5GQA', officeOfDeparture: 'ES002801', holderEORI: 'ESB22477020', locationAuthorisationNumber: '2801AAAAAA',
    sender: 'ESB22477020', mensajeId: 'LUCIN26111607240400001234', fecha: FECHA
  };
  const xml = buildCC170PresentationXML(datos);

  test('va al servicio CC170CV1', () => {
    expect(ENDPOINTS_NCTS.CC170C).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CC170CV1SOAP');
  });

  test('referencia la predeclaración por LRN + titular y da la ubicación B/Y', () => {
    expect(xml).toContain('<ent:messageType>CC170C</ent:messageType>');
    expect(xml).toContain('<ent:TransitOperation><ent:LRN>LRNMWIXGE5GQA</ent:LRN></ent:TransitOperation>');
    expect(xml).toContain('<ent:HolderOfTheTransitProcedure><ent:identificationNumber>ESB22477020</ent:identificationNumber></ent:HolderOfTheTransitProcedure>');
    expect(xml).toContain('<ent:LocationOfGoods><ent:typeOfLocation>B</ent:typeOfLocation><ent:qualifierOfIdentification>Y</ent:qualifierOfIdentification><ent:authorisationNumber>2801AAAAAA</ent:authorisationNumber></ent:LocationOfGoods>');
    // Nombre y dirección del titular: «No se puede rellenar».
    expect(xml).not.toContain('<ent:name>');
  });

  test('la ubicación es obligatoria y de 10 caracteres (recinto 4 + ubicación)', () => {
    expect(() => buildCC170PresentationXML({ ...datos, locationAuthorisationNumber: '' })).toThrow(/ubicación/i);
    expect(() => buildCC170PresentationXML({ ...datos, locationAuthorisationNumber: '2801' })).toThrow(/ubicación/i);
  });

  test('sin LRN no hay forma de identificar la predeclaración', () => {
    expect(() => buildCC170PresentationXML({ ...datos, lrn: '' })).toThrow(/LRN/);
  });

  siHayXmllint('valida contra CC170CV1Ent.xsd', () => {
    expect(() => validar(xml, 'CC170CV1Ent.xsd')).not.toThrow();
  });
});

describe('respuestas CC013/CC014/CC170', () => {
  test('CC014 OK: invalidada, estado CA, fecha y CSV', () => {
    const r = interpretarRespuestaNcts(leer('respuesta-cc014-ok.xml'), { mensaje: 'CC014C', mrn: MRN });
    expect(r).toMatchObject({
      success: true, tipo: 'aceptada', tipoRespuesta: 'OK', codigoRespuesta: 'I', mrn: MRN,
      estado: 'CA', csv: 'SYLLV39DBRPW3DKV', fechas: { invalidacion: '2026-11-16' }
    });
    expect(r.estadoTexto).toMatch(/invalidada/i);
  });

  test('CC170 OK: admitida bajo control, circuito naranja, estado PD', () => {
    const r = interpretarRespuestaNcts(leer('respuesta-cc170-ok.xml'), { mensaje: 'CC170C', mrn: MRN });
    expect(r).toMatchObject({
      success: true, codigoRespuesta: 'B', mrn: MRN, lrn: 'LRNMWIXGE5GQA', estado: 'PD', circuito: 'N', channel: 'orange',
      fechas: { admision: '2026-11-16' }
    });
  });

  test('CC013 OK: modificación admitida, sigue en PA', () => {
    const r = interpretarRespuestaNcts(leer('respuesta-cc013-ok.xml'), { mensaje: 'CC013C', mrn: MRN });
    expect(r).toMatchObject({ success: true, codigoRespuesta: 'M', estado: 'PA', csv: 'XV8DCB49KY725BYM' });
  });

  test('EF: errores funcionales con puntero y descripción', () => {
    const r = interpretarRespuestaNcts(leer('respuesta-cc014-ef.xml'), { mensaje: 'CC014C', mrn: MRN });
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional', tipoRespuesta: 'EF' });
    expect(r.errores[0]).toMatchObject({ codigo: '12', motivo: '810', puntero: '/CC014C/TransitOperation/MRN' });
    expect(r.error).toContain('Estado del tránsito incorrecto');
  });

  test('EX: errores de XML con su texto', () => {
    const ex = leer('respuesta-ex.xml').replace(/CCTRACV2Sal/g, 'CC013CV1Sal');
    const r = interpretarRespuestaNcts(ex, { mensaje: 'CC013C' });
    expect(r).toMatchObject({ success: false, tipo: 'error_xml' });
    expect(r.error).toContain('No se ha encontrado la etiqueta de inicio');
  });

  test('una respuesta de otro servicio no se toma por buena', () => {
    const r = interpretarRespuestaNcts(leer('respuesta-cc014-ok.xml'), { mensaje: 'CC013C', mrn: MRN });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/CC013CV1Sal/);
  });

  test('si la AEAT contesta con otro MRN, no vale', () => {
    const r = interpretarRespuestaNcts(leer('respuesta-cc014-ok.xml'), { mensaje: 'CC014C', mrn: '26ES002801509999X1' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/otro MRN/);
  });

  test('fallo SOAP y cuerpo vacío', () => {
    const fault = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Server</faultcode><faultstring>Servicio no disponible</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>';
    expect(interpretarRespuestaNcts(fault, { mensaje: 'CC014C' })).toMatchObject({ success: false, tipo: 'fault', reintentable: true, error: 'Servicio no disponible' });
    expect(interpretarRespuestaNcts('', { mensaje: 'CC014C' })).toMatchObject({ success: false, error: 'La AEAT respondió sin contenido' });
  });

  test('CC015 de predeclaración: estado PA', () => {
    const ok = leer('respuesta-cc013-ok.xml').replace(/CC013CV1Sal/g, 'CC015CV1Sal').replace('<codigoRespuesta>M</codigoRespuesta>', '<codigoRespuesta>P</codigoRespuesta>');
    expect(interpretarRespuestaNcts(ok, { mensaje: 'CC015C' })).toMatchObject({ success: true, estado: 'PA' });
  });

  test('mensaje desconocido: error de programación, no respuesta', () => {
    expect(() => interpretarRespuestaNcts('<x/>', { mensaje: 'CC999C' })).toThrow(/CC999C/);
  });
});
