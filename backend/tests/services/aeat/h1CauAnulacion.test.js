/**
 * Anulación de una declaración de importación CAU (CC414A). La petición se
 * valida contra el XSD oficial; la respuesta se monta con la estructura de
 * `ES_CC410A.xsd`.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildAnulacionH1CauXML, interpretarAnulacionH1Cau, anulablePorServicio } = require('../../../src/services/aeat/h1CauAnulacion');

const ESQUEMA = path.join(__dirname, '../../fixtures/aeat-cau/CC414AV1Ent.xsd');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
const CONTACTO = { nombre: 'Ana Ruiz', telefono: '+34 910000000', email: 'aduanas@agencia.es' };
const peticion = (extra = {}) => ({
  mensajeId: 'LUCI2611121000000001234', lrn: 'LUCI261112100000000', numeroRegistro: '26ES00280112345678', motivo: 'Mercancía <no> embarcada & pedido cancelado',
  declarante: { id: 'ESB22477020', contacto: CONTACTO }, fecha: new Date('2026-11-12T09:30:00Z'), ...extra
});
const NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/CC410AV1Sal.xsd';
const sobre = (contenido) => `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><es:CC410AV1Sal xmlns:es="${NS}"><Message><messageIdentification>M1</messageIdentification></Message>${contenido}</es:CC410AV1Sal></env:Body></env:Envelope>`;

function validar(xml) {
  const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(xml)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cc414a-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  try { execFileSync('xmllint', ['--noout', '--schema', ESQUEMA, fichero], { stdio: 'pipe' }); return null; } catch (e) { return String(e.stderr || e.message); }
}

describe('anulación H1 CAU: qué se puede anular por servicio web', () => {
  test('solo lo que aún no está activado', () => {
    expect(['60', '61', '63', '65', '66', 63].every(anulablePorServicio)).toBe(true);
  });

  test('una declaración activada, levantada o ya anulada, no', () => {
    expect(['64', '62', '96', '40', '0', '', null, undefined].some(anulablePorServicio)).toBe(false);
  });
});

describe('anulación H1 CAU: petición', () => {
  test('una predeclaración se identifica por LRN y número de registro, sin MRN', () => {
    const xml = buildAnulacionH1CauXML(peticion());

    expect(xml).toContain('<LRN>LUCI261112100000000</LRN><customsRegistrationNumber>26ES00280112345678</customsRegistrationNumber><invalidationRequestDateAndTime>2026-11-12T10:30:00</invalidationRequestDateAndTime>');
    expect(xml).not.toContain('<MRN>');
    expect(xml).toContain('<invalidationReason>Mercancía &lt;no&gt; embarcada &amp; pedido cancelado</invalidationReason>');
    expect(xml).toContain('<testIndicator>S</testIndicator>');
    expect(buildAnulacionH1CauXML(peticion({ test: false }))).not.toContain('testIndicator');
  });

  test('exige motivo, identificación de la predeclaración y declarante', () => {
    expect(() => buildAnulacionH1CauXML(peticion({ motivo: '  ' }))).toThrow('motivo');
    expect(() => buildAnulacionH1CauXML(peticion({ numeroRegistro: '' }))).toThrow('número de registro');
    expect(() => buildAnulacionH1CauXML(peticion({ declarante: {} }))).toThrow('declarante');
  });

  siHayXmllint('valida contra el XSD de la AEAT, con y sin representante', () => {
    expect(validar(buildAnulacionH1CauXML(peticion()))).toBeNull();
    expect(validar(buildAnulacionH1CauXML(peticion({
      declarante: { id: 'ESB12345674' }, representante: { id: 'ESB22477020', estado: '2', contacto: CONTACTO }
    })))).toBeNull();
  });
});

describe('anulación H1 CAU: respuesta', () => {
  test('anulación admitida', () => {
    const r = interpretarAnulacionH1Cau(sobre(`<CC410A>
      <ImportOperation><LRN>LUCI261112100000000</LRN><customsRegistrationNumber>26ES00280112345678</customsRegistrationNumber><invalidationDecisionDateAndTime>2026-11-12T10:31:00</invalidationDecisionDateAndTime><invalidationRequestDateAndTime>2026-11-12T10:30:00</invalidationRequestDateAndTime><invalidationInitiatedByCustoms>0</invalidationInitiatedByCustoms><invalidationJustification>Solicitada por el operador</invalidationJustification></ImportOperation>
      <CustomsOfficeOfImport><referenceNumber>ES002801</referenceNumber></CustomsOfficeOfImport>
      <Declarant><identificationNumber>ESB22477020</identificationNumber></Declarant>
      <edeclarationCSVId>CSVANULACION</edeclarationCSVId>
    </CC410A>`));

    expect(r).toMatchObject({
      success: true, tipo: 'anulada', lrn: 'LUCI261112100000000', numeroRegistro: '26ES00280112345678', mrn: null,
      fechaDecision: '2026-11-12T10:31:00', justificacion: 'Solicitada por el operador', csv: 'CSVANULACION'
    });
  });

  test('un rechazo trae su motivo', () => {
    const r = interpretarAnulacionH1Cau(sobre('<CC456A><FunctionalError><errorPointer>MRN</errorPointer><errorCode>99</errorCode><errorReason>21200</errorReason><remarks>La declaración está activada</remarks></FunctionalError></CC456A>'));

    expect(r).toMatchObject({ success: false, tipo: 'error_funcional', error: '21200 La declaración está activada' });
  });

  test('fallos SOAP, errores de XML y respuestas vacías o ajenas no se toman por buenas', () => {
    expect(interpretarAnulacionH1Cau('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Client</faultcode><faultstring>Petición incorrecta</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>'))
      .toMatchObject({ success: false, tipo: 'fault', reintentable: false, error: 'Petición incorrecta' });
    expect(interpretarAnulacionH1Cau(sobre('<CD917A><XmlError><errorText>Elemento no esperado</errorText></XmlError></CD917A>'))).toMatchObject({ tipo: 'error_xml', error: 'Elemento no esperado' });
    expect(interpretarAnulacionH1Cau('').success).toBe(false);
    expect(interpretarAnulacionH1Cau('<html/>').success).toBe(false);
    expect(interpretarAnulacionH1Cau(sobre('')).error).toBe('La respuesta no trae ni la anulación ni errores');
  });
});
