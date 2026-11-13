/**
 * Predeclaraciones del H1 CAU (tipo adicional D): alta con su modo de
 * activación, lectura de las respuestas y mensaje de activación CC432A.
 *
 * Las respuestas son reales: preproducción de la AEAT, recinto de pruebas
 * 009999, sin modo test, 13/11/2026 (ver fixtures/aeat-cau/LEEME.md).
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expeditionToH1CauData } = require('../../../src/services/aeat/h1CauData');
const { buildH1CauXML } = require('../../../src/services/aeat/h1CauXmlBuilder');
const { interpretarRespuestaH1Cau } = require('../../../src/services/aeat/h1CauResponse');
const { interpretarAnulacionH1Cau } = require('../../../src/services/aeat/h1CauAnulacion');
const { interpretarConsultaH1Cau } = require('../../../src/services/aeat/h1CauConsulta');
const { buildActivacionH1CauXML, datosDeActivacion, MODOS_ACTIVACION } = require('../../../src/services/aeat/h1CauActivacion');

const FIXTURES = path.join(__dirname, '../../fixtures/aeat-cau');
const real = (nombre) => fs.readFileSync(path.join(FIXTURES, nombre), 'utf8');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
function validar(xml, esquema) {
  const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(xml)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cau-pre-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  try { execFileSync('xmllint', ['--noout', '--schema', path.join(FIXTURES, esquema), fichero], { stdio: 'pipe' }); return null; } catch (e) { return String(e.stderr || e.message); }
}

const AGENTE = { eori: 'ESB22477020', contact: { name: 'Ana Ruiz', phone: '+34 910000000', email: 'aduanas@agencia.es' }, representationType: 'indirect' };
const expediente = () => ({
  expeditionId: 'EXP-2026-AAAA0001', transportMode: 'maritime',
  client: { nif: 'B12345674', eori: 'ESB12345674', address: { postalCode: '46001', country: 'ES' } },
  exporter: { companyName: 'Shenzhen Textiles Ltd', address: '1 Test Road', city: 'Shanghai', postalCode: '200000', country: 'CN' },
  representative: { representationType: 'indirect', dispatchAuthorizationScope: 'global' },
  incoterm: { code: 'CIF', place: 'Valencia' },
  transport: { vehicleId: 'MSC AURORA', vehicleNationality: 'PA', documentType: 'BL', documentNumber: 'MSCU20268198800', containers: [{ number: 'MSCU1234567' }],
    summaryDeclaration: { number: '28016000001', item: '1', aeat: { mrn: '26ES00280180000014', location: '2801AAAAAA' } } },
  declaration: { invoiceNumber: 'FAC-2026-118' },
  goods: [{ description: 'Ropa de cama', taricCode: '6302100000', originCountry: 'CN', grossWeight: 995, netWeight: 900,
    invoiceValue: 10000, currency: 'EUR', dutyRate: 12, vatRate: 21, packages: { quantity: 90, type: 'CT', marks: 'S/M' } }]
});
const datos = (opciones = {}) => expeditionToH1CauData(expediente(), { declarante: AGENTE, mensajeId: 'LUCI-0001', lrn: 'LUCI2611130000001', fecha: new Date('2026-11-13T08:00:00Z'), ...opciones });

describe('alta de una predeclaración', () => {
  test('es tipo D y lleva el modo de activación tras la aduana de importación', () => {
    const d = datos({ predeclaracion: 'Operador' });
    expect(d.declaracion.tipoAdicional).toBe('D');
    expect(d.modoActivacion).toBe('Operador');

    const xml = buildH1CauXML(d);
    expect(xml).toMatch(/<\/CustomsOfficeOfImport>\s*<ModoActivacionDeclaracion>Operador<\/ModoActivacionDeclaracion>\s*<CC415A>/);
    expect(xml).toContain('<additionalDeclarationType>D</additionalDeclarationType>');
  });

  test('sin predeclaración sigue siendo tipo A y sin modo de activación (la AEAT da 80015 si se declara)', () => {
    const xml = buildH1CauXML(datos());
    expect(xml).toContain('<additionalDeclarationType>A</additionalDeclarationType>');
    expect(xml).not.toContain('ModoActivacionDeclaracion');
  });

  test('solo admite los dos modos de la AEAT', () => {
    expect(MODOS_ACTIVACION).toEqual(['Aduanas', 'Operador']);
    expect(() => datos({ predeclaracion: 'Mañana' })).toThrow('modo de activación');
  });

  siHayXmllint('valida contra el XSD oficial en los dos modos', () => {
    expect(validar(buildH1CauXML(datos({ predeclaracion: 'Aduanas' })), 'CC415AV1Ent.xsd')).toBeNull();
    expect(validar(buildH1CauXML(datos({ predeclaracion: 'Operador' })), 'CC415AV1Ent.xsd')).toBeNull();
  });
});

describe('respuestas reales de la AEAT', () => {
  test('alta: pendiente de activar (63), con número de registro y sin MRN ni circuito', () => {
    const r = interpretarRespuestaH1Cau(real('predeclaracion-alta-respuesta-real-009999.xml'));
    expect(r).toMatchObject({ success: true, tipo: 'admitida', mrn: null, numeroRegistro: '26ES009999I00270R1', operacionRegistrada: '63', circuito: null, channel: null });
  });

  test('activación aceptada (respuesta CC432AV1Sal): 90, el MRN es el número de registro, circuito y liquidación', () => {
    const r = interpretarRespuestaH1Cau(real('predeclaracion-activacion-respuesta-real-009999.xml'));
    expect(r).toMatchObject({
      success: true, tipo: 'admitida', mrn: '26ES009999I00270R1', operacionRegistrada: '90',
      operacionRegistradaTexto: 'Predeclaración completa activada', circuito: 'A', channel: 'yellow'
    });
    expect(r.liquidacion.totalAPagar).toBe(355.2);
  });

  test('activación rechazada: error funcional con el motivo de la AEAT', () => {
    const r = interpretarRespuestaH1Cau(real('predeclaracion-activacion-rechazo-real-009999.xml'));
    expect(r).toMatchObject({ success: false, tipo: 'error_funcional' });
    expect(r.error).toContain('80118');
  });

  test('anulación de una predeclaración: anulada por el operador, con CSV', () => {
    const r = interpretarAnulacionH1Cau(real('predeclaracion-anulacion-respuesta-real-009999.xml'));
    expect(r).toMatchObject({ success: true, tipo: 'anulada', numeroRegistro: '26ES009999I00271R0', justificacion: 'POR OPERADOR', csv: 'VKDMAJZUFABESHTC' });
  });

  test('consulta por número de registro: pendiente de activar', () => {
    const r = interpretarConsultaH1Cau(real('predeclaracion-consulta-pendiente-real-009999.xml'));
    expect(r).toMatchObject({ success: true, numeroRegistro: '26ES009999I00270R1', estado: { operacionRegistrada: '63' } });
  });
});

describe('mensaje de activación CC432A', () => {
  const ENVIADO = buildH1CauXML(datos({ predeclaracion: 'Operador' }));

  test('saca del mensaje enviado el LRN, la aduana de presentación, la ubicación y los contenedores', () => {
    expect(datosDeActivacion(ENVIADO)).toEqual({
      lrn: 'LUCI2611130000001', aduanaPresentacion: 'ES002801',
      ubicacion: { tipo: 'B', calificador: 'Y', autorizacion: 'ES002801AAAAAA' },
      contenedores: ['MSCU1234567']
    });
    expect(datosDeActivacion('<a/>')).toBeNull();
  });

  const activacion = (extra = {}) => buildActivacionH1CauXML({
    mensajeId: 'LUCIV2611130000001', numeroRegistro: '26ES009999I00270R1', ...datosDeActivacion(ENVIADO),
    declarante: { id: 'ESB22477020', contacto: { nombre: 'Ana Ruiz' } }, fecha: new Date('2026-11-13T08:00:00Z'), ...extra
  });

  test('identifica la predeclaración y NO lleva persona de contacto (error 80118)', () => {
    const xml = activacion();
    expect(xml).toContain('<customsRegistrationNumber>26ES009999I00270R1</customsRegistrationNumber>');
    expect(xml).toContain('<LRN>LUCI2611130000001</LRN>');
    expect(xml).toContain('<authorisationNumber>ES002801AAAAAA</authorisationNumber>');
    expect(xml).not.toContain('ContactPerson');
    expect(xml).toContain('<testIndicator>S</testIndicator>');
    expect(activacion({ test: false })).not.toContain('testIndicator');
  });

  test('en representación directa añade al representante con su estado', () => {
    const xml = activacion({ representante: { id: 'ESB22477020', estado: '2' }, declarante: { id: 'ESB12345674' } });
    expect(xml).toMatch(/<Representative><identificationNumber>ESB22477020<\/identificationNumber><status>2<\/status><\/Representative>/);
  });

  test('sin número de registro, LRN o ubicación no se monta', () => {
    expect(() => activacion({ numeroRegistro: '' })).toThrow('número de registro');
    expect(() => activacion({ lrn: '' })).toThrow('LRN');
    expect(() => activacion({ ubicacion: null })).toThrow('ubicación');
  });

  siHayXmllint('valida contra el XSD oficial', () => {
    expect(validar(activacion(), 'CC432AV1Ent.xsd')).toBeNull();
    expect(validar(activacion({ representante: { id: 'ESB22477020', estado: '2' } }), 'CC432AV1Ent.xsd')).toBeNull();
  });
});
