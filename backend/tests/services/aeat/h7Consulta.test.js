/**
 * Consulta de estado de un H7 por MRN (servicio ConsultaH7V1). La petición se
 * valida contra el XSD oficial (ConsultaH7V1Ent.xsd + TiposDatosH7.xsd). Las
 * respuestas de tests/fixtures/aeat-consultas/h7 están montadas a mano con la
 * estructura de ConsultaH7V1Sal.xsd (y validan contra él): la AEAT aún no ha
 * respondido a ninguna consulta de LUCI por este servicio.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildConsultaH7XML, interpretarConsultaH7, ESTADOS_H7, ENDPOINT_CONSULTA_H7 } = require('../../../src/services/aeat/h7Consulta');

const XSD = path.join(__dirname, '../../fixtures/aeat-h7-xsd');
const FIX = path.join(__dirname, '../../fixtures/aeat-consultas/h7');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
const FECHA = new Date('2026-11-16T09:30:15Z');
const MRN = '26ESH7A000072339R8';
const NS = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/h7/ConsultaH7V1Sal.xsd';

function validarCuerpo(xml, esquema) {
  const cuerpo = /<(?:soapenv|env):Body>\s*([\s\S]*?)\s*<\/(?:soapenv|env):Body>/.exec(xml)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'consulta-h7-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  execFileSync('xmllint', ['--noout', '--schema', path.join(XSD, esquema), fichero], { stdio: 'pipe' });
}

const sobre = (info, codigo = 'A') => `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><n1:ConsultaH7V1Sal xmlns:n1="${NS}"><Message><messageIdentification>M1</messageIdentification></Message><Response><responseCode>${codigo}</responseCode>${info}</Response></n1:ConsultaH7V1Sal></env:Body></env:Envelope>`;
const info = (estado, extra = '') => `<MRNInfo><MRN>${MRN}</MRN>${extra}<statusDeclaration>${estado}</statusDeclaration></MRNInfo>`;

describe('consulta H7 (ConsultaH7V1): petición', () => {
  test('va al endpoint del WSDL oficial', () => {
    expect(ENDPOINT_CONSULTA_H7).toBe('/wlpl/ADIP-JDIT/ws/ConsultaH7V1SOAP');
  });

  test('en pruebas: ES.AEAT.PRUEBAS, testIndicator S, fecha y hora de Madrid y MRN normalizado', () => {
    const xml = buildConsultaH7XML({ mensajeId: 'LUCIQ2611160930150001234', mrn: ' 26esh7a000072339r8 ', fecha: FECHA, test: true });
    expect(xml).toContain('<n1:ConsultaH7V1Ent xmlns:n1="https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/h7/ConsultaH7V1Ent.xsd">');
    expect(xml).toContain('<messageRecipient>ES.AEAT.PRUEBAS</messageRecipient>');
    expect(xml).toContain('<testIndicator>S</testIndicator>');
    expect(xml).toContain('<preparationDate>20261116</preparationDate><preparationTime>103015</preparationTime>');
    expect(xml).toContain(`<Declaration><MRN_H7>${MRN}</MRN_H7></Declaration>`);
    expect(xml).not.toContain('Signature');
  });

  test('en producción: ES.AEAT y testIndicator N', () => {
    const xml = buildConsultaH7XML({ mensajeId: 'LUCIQ1', mrn: MRN, fecha: FECHA });
    expect(xml).toContain('<messageRecipient>ES.AEAT</messageRecipient>');
    expect(xml).toContain('<testIndicator>N</testIndicator>');
  });

  test('rechaza un MRN mal formado antes de preguntar a la AEAT', () => {
    expect(() => buildConsultaH7XML({ mensajeId: 'LUCIQ1', mrn: '123' })).toThrow('MRN');
    expect(() => buildConsultaH7XML({ mensajeId: 'LUCIQ1', mrn: `${MRN}<x/>` })).toThrow('MRN');
  });

  siHayXmllint('valida contra ConsultaH7V1Ent.xsd (pruebas y producción)', () => {
    for (const test of [true, false]) {
      const xml = buildConsultaH7XML({ mensajeId: 'LUCIQ2611160930150001234', mrn: MRN, fecha: FECHA, test });
      expect(() => validarCuerpo(xml, 'ConsultaH7V1Ent.xsd')).not.toThrow();
    }
  });

  siHayXmllint('las respuestas de los fixtures validan contra ConsultaH7V1Sal.xsd', () => {
    expect(() => validarCuerpo(leer('respuesta-ok-levante.xml'), 'ConsultaH7V1Sal.xsd')).not.toThrow();
    expect(() => validarCuerpo(leer('respuesta-rechazo.xml'), 'ConsultaH7V1Sal.xsd')).not.toThrow();
  });
});

describe('consulta H7: respuesta', () => {
  test('aceptada con levante: estado, circuito, fechas, CSV y liquidación para el monitor', () => {
    const r = interpretarConsultaH7(leer('respuesta-ok-levante.xml'), { mrn: MRN });
    expect(r).toMatchObject({
      success: true, tipo: 'encontrada', mrn: MRN, estado: 'LE', status: 'RELEASED', final: false,
      circuito: 'V', channel: 'green', csv: 'H7LEV9K2M4N6P8QR',
      fechas: { alta: '2026-11-16T09:12:05', admision: '2026-11-16T09:12:05', levante: '2026-11-16T09:12:06' }
    });
    expect(r.estadoTexto).toMatch(/levante/i);
    expect(r.liquidacion).toEqual({
      divisa: 'EUR', total: 5.73,
      tributos: [{ tipo: 'IVA', cuota: 2.73, base: 13 }, { tipo: 'LVCD', cuota: 3, base: null }]
    });
    expect(r.messages[0]).toBe(`LE: ${ESTADOS_H7.LE.texto}`);
  });

  test('rechazo (R) con errores funcionales', () => {
    const r = interpretarConsultaH7(leer('respuesta-rechazo.xml'), { mrn: MRN });
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional', tipoRespuesta: 'R' });
    expect(r.errores[0]).toMatchObject({ tipo: 'F', codigo: '9001', puntero: 'Declaration.MRN_H7' });
    expect(r.error).toContain('9001 - No existe la declaración');
  });

  test('error no funcional (N) se clasifica como error del mensaje', () => {
    const r = interpretarConsultaH7(sobre('', 'R').replace('</Response>', '</Response><Error><errorType>N</errorType><errorCode>103</errorCode><errorReason>Formato</errorReason></Error>'));
    expect(r).toMatchObject({ success: false, tipo: 'error_xml' });
  });

  test.each([
    ['AN', 'REJECTED', true],
    ['U1', 'RELEASED', true],
    ['LE', 'RELEASED', false],
    ['CP', 'RELEASED', false],
    ['NL', 'REJECTED', false],
    ['IN', 'REJECTED', false],
    ['PD', 'CONTROL', false],
    ['DE', 'ACCEPTED', false],
    ['PR', 'PENDING', false],
    ['H1', 'PENDING', false]
  ])('situación %s -> %s (final: %s), según la tabla LSSD', (estado, status, final) => {
    const r = interpretarConsultaH7(sobre(info(estado)), { mrn: MRN });
    expect(r).toMatchObject({ success: true, estado, status, final });
  });

  test('solo AN y U1 son finales', () => {
    expect(Object.keys(ESTADOS_H7).filter((k) => ESTADOS_H7[k].final).sort()).toEqual(['AN', 'U1']);
  });

  test('situación desconocida: se conserva el código; ACCEPTED si hay fecha de admisión', () => {
    const conAdmision = interpretarConsultaH7(sobre(info('ZZ', '<declarationAcceptanceDate>20261116</declarationAcceptanceDate>')), { mrn: MRN });
    expect(conAdmision).toMatchObject({ estado: 'ZZ', estadoTexto: null, status: 'ACCEPTED', final: false });
    expect(interpretarConsultaH7(sobre(info('ZZ')), { mrn: MRN }).status).toBe('PENDING');
  });

  test('circuito en latencia (L): sin canal todavía', () => {
    const r = interpretarConsultaH7(sobre(info('PD', '<riskAnalysisResultCode>L</riskAnalysisResultCode>')), { mrn: MRN });
    expect(r).toMatchObject({ circuito: 'L', channel: null });
    expect(r.circuitoTexto).toMatch(/Latencia/);
  });

  test('si la respuesta es de otro MRN, la consulta falla', () => {
    const r = interpretarConsultaH7(sobre(info('LE')), { mrn: '26ESH7A000000001X1' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('otro MRN');
  });

  test('aceptada sin MRNInfo', () => {
    expect(interpretarConsultaH7(sobre(''), { mrn: MRN }).error).toContain('no trae la declaración');
  });

  test('fault SOAP, XML roto, vacío u otro servicio', () => {
    const fault = interpretarConsultaH7('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultcode>env:Server</faultcode><faultstring>Servicio no disponible</faultstring></env:Fault></env:Body></env:Envelope>');
    expect(fault).toMatchObject({ success: false, tipo: 'fault', reintentable: true, error: 'Servicio no disponible' });
    expect(interpretarConsultaH7('texto plano').error).toContain('no es un XML válido');
    expect(interpretarConsultaH7('').error).toContain('sin contenido');
    expect(interpretarConsultaH7(undefined).error).toContain('sin contenido');
    expect(interpretarConsultaH7('<otra/>').error).toContain('ConsultaH7V1');
  });
});
