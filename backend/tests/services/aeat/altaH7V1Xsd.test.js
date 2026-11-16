/**
 * El cuerpo AltaH7V1Ent que genera LUCI valida contra el XSD OFICIAL de la AEAT
 * (AltaH7V1Ent.xsd + TiposDatosH7.xsd, vigentes con la guía H7 v3.23).
 * Casos: F53 sin C129 (Y081), F53 con C129 y F48 con IOSS.
 * Requiere `xmllint` (libxml2); si no está instalado el bloque se omite.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildAltaH7V1XML } = require('../../../src/services/aeat/h7XmlBuilder');

const XSD = path.join(__dirname, '../../fixtures/aeat-h7-xsd/AltaH7V1Ent.xsd');
const hayXmllint = (() => {
  try { execFileSync('xmllint', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
})();

function cuerpo(extra, partida = {}) {
  const xml = buildAltaH7V1XML({
    test: true, declaranteNIF: 'B22477020', declaranteNombre: 'STRIX AI SL', representanteStatus: '3',
    exportador: { name: 'Shenzhen Books', city: 'Shenzhen' },
    importador: { name: 'Maria Garcia', city: 'Madrid', street: 'Calle 1', postcode: '28001' },
    documentos: [{ tipo: 'N380', referencia: 'F-1' }],
    partidas: [{ descripcion: 'Libro', taricCode: '4901990000', valorFactura: 12, pesobruto: 0.3, bultos: 1,
      identificadorComercial: 'SKU-1', referenciaFabricante: 'REF-1', ...partida }],
    ...extra
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml.match(/<n1:AltaH7V1Ent[\s\S]*<\/n1:AltaH7V1Ent>/)[0];
}

function validar(xml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7xsd-'));
  const f = path.join(dir, 'h7.xml');
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

(hayXmllint ? describe : describe.skip)('AltaH7V1Ent contra el XSD oficial', () => {
  test('F53 sin C129 (Y081 en AdditionalReference)', () => {
    const xml = cuerpo({ additionalProcedureCode: 'F53' });
    expect(xml).toContain('<addRefType>Y081</addRefType>');
    expect(validar(xml)).toBe('');
  });
  test('F53 con C129', () => {
    expect(validar(cuerpo({ additionalProcedureCode: 'F53' }, { codigoNormalizado: '9788420412146' }))).toBe('');
  });
  test('F48 con IOSS (AdditionalFiscalRef) y autorizacion esporadica 1014', () => {
    const xml = cuerpo({
      additionalProcedureCode: 'F48', iossNumber: 'IM1234567890',
      documentos: [{ tipo: 'N380', referencia: 'F-1' }, { tipo: '1018', referencia: 'M-1' }, { tipo: '1014', referencia: 'ESIOSS2026000001' }]
    });
    expect(xml).toContain('<AdditionalFiscalRef>');
    expect(xml).toContain('<suppDoctype>1014</suppDoctype>');
    expect(validar(xml)).toBe('');
  });
});
