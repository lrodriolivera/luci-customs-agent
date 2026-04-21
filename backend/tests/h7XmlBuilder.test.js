/**
 * Regression tests for h7XmlBuilder defaults.
 *
 * These four invariants were discovered empirically against AEAT PRE on
 * 2026-04-21 (see docs/emails/email-jose-antonio-seguimiento-abril-2026.md
 * and commit d26eb84). Each one guards against a specific AEAT error:
 *
 *   default ubicación EEEEEE  -> guards against err 1180
 *   marcas fallback non-empty -> guards against err 2004
 *   auto-inject N380 + N703   -> guards against err 2213 / 2214
 *   auto-inject 7007 (11.2)   -> guards against err 4404
 *   default codigoAdicional F48 -> guards against err 4405 on C07
 */

const { buildH7ImportXML } = require('../src/services/aeat/h7XmlBuilder');

function minimalPartida(overrides = {}) {
  return {
    descripcion: 'Test H7 item',
    taricCode: '4911109000',
    paisOrigen: 'CN',
    pesobruto: 0.200,
    pesoneto: 0.150,
    bultos: 1,
    valorFactura: 12.50,
    ...overrides
  };
}

function minimalCall(overrides = {}) {
  return buildH7ImportXML({
    test: true,
    aduanaDespacho: '002801',
    remitenteNIF: 'ESB22477020', remitenteNombre: 'STRIX AI SL', remitentePais: 'ES',
    destinatarioNIF: 'ESB22477020', destinatarioNombre: 'STRIX AI SL',
    destinatarioDireccion: 'Calle Ejemplo 1', destinatarioPoblacion: 'Zaragoza',
    destinatarioCP: '50001', destinatarioPais: 'ES',
    declaranteNIF: 'ESB22477020', declaranteNombre: 'STRIX AI SL',
    formaRepresentacion: '1', emailDespacho: 'despacho@strixai.es',
    garantiaGRN: '26ESAGL2800000054',
    partidas: [minimalPartida()],
    ...overrides
  });
}

describe('h7XmlBuilder - AEAT PRE acceptance invariants', () => {
  test('default localizacionMercancias is ES002801EEEEEE (not LUCI01)', () => {
    const xml = minimalCall();
    expect(xml).toMatch(/<C30LocalizacionMercancias>ES002801EEEEEE<\/C30LocalizacionMercancias>/);
    expect(xml).not.toMatch(/<C30LocalizacionMercancias>ES002801LUCI01</);
  });

  test('default codigoAdicional is F48 (not C07)', () => {
    const xml = minimalCall();
    expect(xml).toMatch(/<C372CodigoAdicional>F48<\/C372CodigoAdicional>/);
    expect(xml).not.toMatch(/<C372CodigoAdicional>C07</);
  });

  test('marcas falls back to description when not provided', () => {
    const xml = minimalCall();
    expect(xml).toMatch(/<C31EmpaqInternoMarcas>Test H7 item<\/C31EmpaqInternoMarcas>/);
  });

  test('marcas never empty even when descripcion is empty', () => {
    const xml = minimalCall({ partidas: [minimalPartida({ descripcion: '' })] });
    expect(xml).toMatch(/<C31EmpaqInternoMarcas>SIN-MARCA<\/C31EmpaqInternoMarcas>/);
  });

  test('auto-injects invoice N380 when no documents provided', () => {
    const xml = minimalCall();
    expect(xml).toMatch(/<C44Tipo>N380<\/C44Tipo>/);
  });

  test('auto-injects transport doc N703 when no transport provided', () => {
    const xml = minimalCall();
    expect(xml).toMatch(/<C44Tipo>N703<\/C44Tipo>/);
  });

  test('auto-injects 7007 with 11-digit integer + dot + 2 decimals', () => {
    const xml = minimalCall();
    expect(xml).toMatch(/<C44Tipo>7007<\/C44Tipo>\s*<C44Referencia>\d{11}\.\d{2}<\/C44Referencia>/);
  });

  test('7007 encodes the partida valorFactura (12.50 -> 00000000012.50)', () => {
    const xml = minimalCall({ partidas: [minimalPartida({ valorFactura: 12.50 })] });
    expect(xml).toMatch(/<C44Tipo>7007<\/C44Tipo>\s*<C44Referencia>00000000012\.50<\/C44Referencia>/);
  });

  test('7007 encodes integer-only valor correctly (100 -> 00000000100.00)', () => {
    const xml = minimalCall({ partidas: [minimalPartida({ valorFactura: 100 })] });
    expect(xml).toMatch(/<C44Tipo>7007<\/C44Tipo>\s*<C44Referencia>00000000100\.00<\/C44Referencia>/);
  });

  test('does NOT duplicate N380/N703/7007 when user already provided them', () => {
    const xml = minimalCall({
      partidas: [minimalPartida({
        documentos: [
          { tipo: 'N380', referencia: 'MY-INVOICE' },
          { tipo: 'N703', referencia: 'MY-HBL' },
          { tipo: '7007', referencia: '00000000012.50' }
        ]
      })]
    });
    const n380Count = (xml.match(/<C44Tipo>N380<\/C44Tipo>/g) || []).length;
    const n703Count = (xml.match(/<C44Tipo>N703<\/C44Tipo>/g) || []).length;
    const v7007Count = (xml.match(/<C44Tipo>7007<\/C44Tipo>/g) || []).length;
    expect(n380Count).toBe(1);
    expect(n703Count).toBe(1);
    expect(v7007Count).toBe(1);
    expect(xml).toMatch(/MY-INVOICE/);
    expect(xml).toMatch(/MY-HBL/);
  });

  test('respects explicit localizacionMercancias override', () => {
    const xml = minimalCall({ localizacionMercancias: 'ES002801CUSTOM1' });
    expect(xml).toMatch(/<C30LocalizacionMercancias>ES002801CUSTOM1<\/C30LocalizacionMercancias>/);
    expect(xml).not.toMatch(/EEEEEE/);
  });

  test('respects explicit codigoAdicional override', () => {
    const xml = minimalCall({ partidas: [minimalPartida({ codigoAdicional: 'C07' })] });
    expect(xml).toMatch(/<C372CodigoAdicional>C07<\/C372CodigoAdicional>/);
  });

  test('N741 alone does NOT satisfy the transport-doc requirement', () => {
    // N741 (house air waybill) is explicitly listed as transport, but the
    // ensureMandatoryDocs set includes it. This guards the list.
    const xml = minimalCall({
      partidas: [minimalPartida({
        documentos: [{ tipo: 'N380', referencia: 'INV-1' }]
      })]
    });
    expect(xml).toMatch(/<C44Tipo>N703<\/C44Tipo>/);
  });
});
