/**
 * El cuerpo CC515CV1Ent que genera LUCI valida contra el XSD OFICIAL de la AEAT
 * (CC515CV1Ent.xsd + ES_CC515C_v514.xsd y tipos, guía AES V1.25).
 * Casos: autodespacho, representación directa e indirecta, en PRE y producción.
 * Requiere `xmllint` (libxml2); si no está instalado el bloque se omite.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expeditionToAesData } = require('../../../src/services/aeat/aesData');
const { buildAESExportXML } = require('../../../src/services/aeat/aesXmlBuilder');
const { TENANT_AGENTE, expedienteAes } = require('../../fixtures/aeat-aes/expedienteAes');

const XSD = path.join(__dirname, '../../fixtures/aeat-aes-xsd/CC515CV1Ent.xsd');
const hayXmllint = (() => {
  try { execFileSync('xmllint', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
})();

function cuerpo(expedition, isPRE = true) {
  const xml = buildAESExportXML(expeditionToAesData(expedition, { tenant: TENANT_AGENTE, isPRE }));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml.match(/<ent:CC515CV1Ent[\s\S]*<\/ent:CC515CV1Ent>/)[0];
}

function validar(xml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesxsd-'));
  const f = path.join(dir, 'aes.xml');
  fs.writeFileSync(f, xml);
  try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, f], { stdio: 'pipe' });
    return '';
  } catch (e) {
    return String(e.stderr || e.message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const autodespacho = () => expedienteAes({ client: { ...expedienteAes().client, eori: 'ESB22477020', nif: 'B22477020' } });

(hayXmllint ? describe : describe.skip)('CC515CV1Ent contra el XSD oficial', () => {
  test('autodespacho (exportador = tenant)', () => {
    expect(validar(cuerpo(autodespacho()))).toBe('');
  });
  test('exportador cliente con representación directa (Representative status 2)', () => {
    const xml = cuerpo(expedienteAes());
    expect(xml).toContain('<ent:Representative>');
    expect(validar(xml)).toBe('');
  });
  test('exportador cliente con representación indirecta', () => {
    expect(validar(cuerpo(expedienteAes({ representative: { representationType: 'indirect' } })))).toBe('');
  });
  test('salida indirecta y destinatario sin código postal, en producción', () => {
    const declaration = { ...expedienteAes().declaration, officeOfExit: 'ES004601', goodsLocation: '2801AAAAAC' };
    const consignee = { companyName: 'HK Ltd', address: { street: '1 Queen Rd', city: 'Hong Kong', country: 'HK' } };
    expect(validar(cuerpo(expedienteAes({ declaration, consignee }), false))).toBe('');
  });
});
