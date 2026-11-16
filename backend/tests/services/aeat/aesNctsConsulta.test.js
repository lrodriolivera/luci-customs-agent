/**
 * Consulta de estado de exportaciones (CCAESC) y tránsitos (CCTRAC) por MRN.
 * Las peticiones se validan contra los XSD oficiales; las respuestas OK y EX
 * son las reales de la preproducción de la AEAT del 16/Nov/2026. La EF se
 * monta con el bloque FunctionalError real de un CC015C rechazado ese día
 * (la consulta no devolvió ninguna EF).
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildConsultaAesXML, buildConsultaNctsXML, interpretarConsultaAes, interpretarConsultaNcts,
  ENDPOINT_AES, ENDPOINT_NCTS
} = require('../../../src/services/aeat/aesNctsConsulta');

const FIX = path.join(__dirname, '../../fixtures/aeat-consultas');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
const FECHA = new Date('2026-11-16T07:11:51Z');

function validar(xml, esquema) {
  const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(xml)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'consulta-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  execFileSync('xmllint', ['--noout', '--schema', path.join(FIX, esquema), fichero], { stdio: 'pipe' });
}

describe('consulta AES (CCAESC): petición', () => {
  const xml = buildConsultaAesXML({ mensajeId: 'LUCIQ261116071151465', mrn: ' 26es002801100321b8 ', sender: 'ESB22477020', fecha: FECHA });

  test('va al servicio CCAESCV1 oficial', () => {
    expect(ENDPOINT_AES).toBe('/wlpl/ADEX-JDIT/ws/aes/CCAESCV1SOAP');
  });

  test('lleva remitente sin ES, destinatario NECA.ES, tipo CCAESC y el MRN normalizado', () => {
    expect(xml).toContain('<c:messageSender>B22477020</c:messageSender>');
    expect(xml).toContain('<c:messageRecipient>NECA.ES</c:messageRecipient>');
    expect(xml).toContain('<c:messageType>CCAESC</c:messageType>');
    expect(xml).toContain('<c:messageIdentification>LUCIQ261116071151465</c:messageIdentification>');
    expect(xml).toContain('Id="LUCIQ261116071151465"');
    expect(xml).toContain('<c:ExportOperation><c:MRN>26ES002801100321B8</c:MRN></c:ExportOperation>');
    expect(xml).toContain('<c:preparationDateAndTime>2026-11-16T08:11:51</c:preparationDateAndTime>');
    expect(xml).not.toContain('Signature');
  });

  test('rechaza MRN o remitente mal formados antes de preguntar a la AEAT', () => {
    expect(() => buildConsultaAesXML({ mensajeId: 'X', mrn: '123', sender: 'B22477020' })).toThrow('MRN');
    expect(() => buildConsultaAesXML({ mensajeId: 'X', mrn: '26ES002801100321B8', sender: '' })).toThrow('remitente');
    expect(() => buildConsultaAesXML({ mensajeId: 'X', mrn: '26ES002801100321B8', sender: 'B2<x>' })).toThrow('remitente');
    expect(() => buildConsultaAesXML({ mensajeId: 'X', mrn: '26ES002801100321B8', sender: 'PT123456789' })).toThrow('remitente');
  });

  siHayXmllint('valida contra CCAESCV1Ent.xsd', () => {
    expect(() => validar(xml, 'aes/CCAESCV1Ent.xsd')).not.toThrow();
  });
});

describe('consulta NCTS (CCTRAC): petición', () => {
  const xml = buildConsultaNctsXML({ mensajeId: 'LUCIQ261116071351165', mrn: '26ES002801501441J7', sender: 'B22477020', fecha: FECHA });

  test('va al servicio CCTRACV2 oficial', () => {
    expect(ENDPOINT_NCTS).toBe('/wlpl/ADTR-JDIT/ws/ncts5/CCTRACV2SOAP');
  });

  test('lleva destinatario NTA.ES, tipo CCTRAC y TransitOperation/MRN', () => {
    expect(xml).toContain('ncts5/CCTRACV2Ent.xsd');
    expect(xml).toContain('<c:CCTRACV2Ent ');
    expect(xml).toContain('<c:messageSender>B22477020</c:messageSender>');
    expect(xml).toContain('<c:messageRecipient>NTA.ES</c:messageRecipient>');
    expect(xml).toContain('<c:messageType>CCTRAC</c:messageType>');
    expect(xml).toContain('<c:TransitOperation><c:MRN>26ES002801501441J7</c:MRN></c:TransitOperation>');
  });

  siHayXmllint('valida contra CCTRACV2Ent.xsd', () => {
    expect(() => validar(xml, 'ncts/CCTRACV2Ent.xsd')).not.toThrow();
  });
});

describe('consulta AES: respuesta', () => {
  test('respuesta OK real: despachada directa, circuito verde, levante y CSV', () => {
    const r = interpretarConsultaAes(leer('aes/respuesta-ok.xml'));
    expect(r).toMatchObject({
      success: true,
      tipo: 'encontrada',
      mrn: '26ES002801100321B8',
      lrn: 'LUCIAES261116071147399',
      tipoDeclaracion: 'EX',
      estado: 'DS',
      estadoTexto: expect.stringContaining('Despachada directa'),
      status: 'RELEASED',
      circuito: 'V',
      channel: 'green',
      fechas: { alta: '2026-11-16T08:11:47', admision: '2026-11-16', levante: '2026-11-16' },
      csv: 'VTURE98JFHDK65CX',
      fase: 'A1',
      error: null
    });
    expect(r.rawResponse).toContain('CCAESCV1Sal');
  });

  test('respuesta EX real: error de XML con su texto', () => {
    const r = interpretarConsultaAes(leer('aes/respuesta-ex.xml'));
    expect(r.success).toBe(false);
    expect(r.tipo).toBe('error_xml');
    expect(r.errores[0]).toMatchObject({ codigo: '18' });
    expect(r.error).toContain('103 - No se ha encontrado la etiqueta de inicio');
  });

  test('respuesta EF: error funcional con descripción y puntero', () => {
    const ef = `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><CCAESCV1Sal xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adex/jdit/ws/aes/CCAESCV1Sal.xsd" Id="1"><messageType>REAESC</messageType><ControlRespuesta><tipoRespuesta>EF</tipoRespuesta></ControlRespuesta><FunctionalError><errorPointer>/CCAESC/ExportOperation/MRN</errorPointer><errorCode>12</errorCode><errorReason>101</errorReason><errorDescription>El MRN no existe</errorDescription></FunctionalError></CCAESCV1Sal></env:Body></env:Envelope>`;
    const r = interpretarConsultaAes(ef);
    expect(r.success).toBe(false);
    expect(r.tipo).toBe('error_funcional');
    expect(r.errores[0]).toMatchObject({ codigo: '12', motivo: '101', puntero: '/CCAESC/ExportOperation/MRN', texto: 'El MRN no existe' });
    expect(r.error).toContain('El MRN no existe');
  });

  test('circuito naranja y estado pendiente de levante pasan a CONTROL/orange', () => {
    const xml = leer('aes/respuesta-ok.xml').replace('<estadoAES>DS</estadoAES>', '<estadoAES>PL</estadoAES>').replace('<circuitoAEAT>V</circuitoAEAT>', '<circuitoAEAT>N</circuitoAEAT>');
    const r = interpretarConsultaAes(xml);
    expect(r.status).toBe('CONTROL');
    expect(r.channel).toBe('orange');
  });

  test('levante sin salida (DS) no es final; salida efectiva (SA) y parada (ST) sí', () => {
    const base = leer('aes/respuesta-ok.xml');
    expect(interpretarConsultaAes(base).final).toBe(false);
    expect(interpretarConsultaAes(base.replace('<estadoAES>DS</estadoAES>', '<estadoAES>SA</estadoAES>'))).toMatchObject({ status: 'RELEASED', final: true });
    expect(interpretarConsultaAes(base.replace('<estadoAES>DS</estadoAES>', '<estadoAES>ST</estadoAES>'))).toMatchObject({ status: 'REJECTED', final: true });
    expect(interpretarConsultaAes(base.replace('<estadoAES>DS</estadoAES>', '<estadoAES>RE</estadoAES>'))).toMatchObject({ status: 'RELEASED', final: false });
  });

  test('una respuesta OK de otro MRN no se da por buena', () => {
    const r = interpretarConsultaAes(leer('aes/respuesta-ok.xml'), { mrn: '26ES002801100999X1' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('otro MRN');
    expect(interpretarConsultaAes(leer('aes/respuesta-ok.xml'), { mrn: '26es002801100321b8' }).success).toBe(true);
  });

  test('estado invalidada pasa a REJECTED; código desconocido con admisión, a ACCEPTED', () => {
    const base = leer('aes/respuesta-ok.xml');
    expect(interpretarConsultaAes(base.replace('<estadoAES>DS</estadoAES>', '<estadoAES>IV</estadoAES>')).status).toBe('REJECTED');
    const raro = interpretarConsultaAes(base.replace('<estadoAES>DS</estadoAES>', '<estadoAES>ZZ</estadoAES>'));
    expect(raro.status).toBe('ACCEPTED');
    expect(raro.estado).toBe('ZZ');
    expect(raro.estadoTexto).toBeNull();
  });

  test('SOAP Fault, vacío, XML roto o de otro servicio no se dan por buenos', () => {
    const fault = '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultcode>env:Server</faultcode><faultstring>Servicio no disponible</faultstring></env:Fault></env:Body></env:Envelope>';
    expect(interpretarConsultaAes(fault)).toMatchObject({ success: false, tipo: 'fault', error: 'Servicio no disponible' });
    expect(interpretarConsultaAes('')).toMatchObject({ success: false });
    expect(interpretarConsultaAes('<a><b>')).toMatchObject({ success: false });
    expect(interpretarConsultaAes(leer('ncts/respuesta-ok.xml'))).toMatchObject({ success: false });
    expect(interpretarConsultaAes(undefined)).toMatchObject({ success: false });
  });
});

describe('consulta NCTS: respuesta', () => {
  test('respuesta OK real: despachado, verde, CSV del DAT y fecha límite', () => {
    const r = interpretarConsultaNcts(leer('ncts/respuesta-ok.xml'));
    expect(r).toMatchObject({
      success: true,
      tipo: 'encontrada',
      mrn: '26ES002801501441J7',
      lrn: 'LRNMWIXGE5GQA',
      tipoDeclaracion: 'T1',
      estado: 'DE',
      status: 'RELEASED',
      circuito: 'V',
      channel: 'green',
      fechas: { alta: '2026-11-16T08:13:48', admision: '2026-11-16', levante: '2026-11-16', limiteLlegada: '2026-11-22' },
      csv: 'BLQPJ8N8YFWG6ZJJ',
      fase: 'P5'
    });
  });

  test('respuesta EX real', () => {
    const r = interpretarConsultaNcts(leer('ncts/respuesta-ex.xml'));
    expect(r).toMatchObject({ success: false, tipo: 'error_xml' });
    expect(r.error).toContain('CCTRACV2Ent');
  });

  test('respuesta EF (bloque real de un CC015C rechazado)', () => {
    const ef = `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><CCTRACV2Sal xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CCTRACV2Sal.xsd" Id="1"><ControlRespuesta><tipoRespuesta>EF</tipoRespuesta></ControlRespuesta><FunctionalError><errorPointer>referenceNumber</errorPointer><errorCode>14</errorCode><errorReason>688</errorReason><errorDescription>ADDS_Partida_1_Ubicación incorrecta</errorDescription></FunctionalError></CCTRACV2Sal></env:Body></env:Envelope>`;
    const r = interpretarConsultaNcts(ef);
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional' });
    expect(r.error).toContain('Ubicación incorrecta');
  });

  test('despachado (DE) no es final; ultimado (UL) sí', () => {
    const base = leer('ncts/respuesta-ok.xml');
    expect(interpretarConsultaNcts(base).final).toBe(false);
    expect(interpretarConsultaNcts(base.replace('<estado>DE</estado>', '<estado>UL</estado>'))).toMatchObject({ status: 'RELEASED', final: true });
    expect(interpretarConsultaNcts(base.replace('<estado>DE</estado>', '<estado>NL</estado>'))).toMatchObject({ status: 'REJECTED', final: true });
  });

  test('pendiente de despacho en rojo pasa a CONTROL/red', () => {
    const xml = leer('ncts/respuesta-ok.xml').replace('<estado>DE</estado>', '<estado>PD</estado>').replace('<circuitoExpedicion>V</circuitoExpedicion>', '<circuitoExpedicion>R</circuitoExpedicion>');
    expect(interpretarConsultaNcts(xml)).toMatchObject({ status: 'CONTROL', channel: 'red' });
  });

  test('sin circuito ni admisión: PENDING y canal nulo', () => {
    const xml = leer('ncts/respuesta-ok.xml').replace('<estado>DE</estado>', '<estado>XX</estado>')
      .replace(/<fechaAdmision>[^<]*<\/fechaAdmision>/, '').replace(/<circuitoExpedicion>[^<]*<\/circuitoExpedicion>/, '');
    expect(interpretarConsultaNcts(xml)).toMatchObject({ status: 'PENDING', channel: null, circuito: null });
  });

  test('OK sin datos de la declaración no es un éxito', () => {
    const vacia = '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><CCTRACV2Sal xmlns="x"><ControlRespuesta><tipoRespuesta>OK</tipoRespuesta></ControlRespuesta></CCTRACV2Sal></env:Body></env:Envelope>';
    expect(interpretarConsultaNcts(vacia)).toMatchObject({ success: false });
  });
});
