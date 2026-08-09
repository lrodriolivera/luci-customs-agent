/**
 * ie314XmlBuilder: XML de ANULACION de una ENS (mensaje IE314 / CC314A) para la
 * AEAT, canal legacy enswsv5.
 *
 * Por que existe este builder: `ensService.cancelDeclaration` generaba un CC328C
 * inventado (ensGenerator.generateCancellation) que NUNCA se enviaba a nadie, y
 * ponia la declaracion en 'cancelled' con MRN real. Verificado el 9/Ago/2026
 * contra el desplegado: la ENS-2026-000025 obtuvo el MRN 26ES009999Z0000768 de
 * PRE, se pulso Anular, LUCI respondio "Declaracion ENS anulada" con
 * status='cancelled' y aeatMessages VACIO. Para AEAT esa sumaria seguia viva.
 * El CC328C ademas no es el mensaje de anulacion: en enswsv5 la anulacion es el
 * IE314 (aeatRealService ya la tenia dada de alta como ICS2_ENS_CANCEL).
 *
 * Generador PURO —sin BD ni red—. Se calca la forma del IE313 (ie313XmlBuilder),
 * que es la que AEAT acepta en esta familia: raiz <ent:CC314A> sin envoltorio
 * Ent, namespace bajo /ADUA/internet/..., receptor NICA.ES, DatOfPreMES9 en
 * AAMMDD + TimOfPreMES10 en HHMM, MesIdeMES19 an..14.
 */

const { buildIE314CancelXML } = require('../../../src/services/aeat/ie314XmlBuilder');

const MRN = '26ES009999Z0000768';

describe('buildIE314CancelXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC314A', () => {
    const xml = buildIE314CancelXML({ mrn: MRN });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<soapenv:Envelope');
    expect(xml).toContain('<MesTypMES20>CC314A</MesTypMES20>');
  });

  /**
   * Las tres trampas que ya costaron un rechazo real en el IE313 (CD917B /
   * XMLERR805 "Invalid NameSpace", errCod 52): namespace /static_files/, un
   * envoltorio <ent:IE314V5Ent> alrededor del mensaje, y 'NECA.ES' como receptor.
   */
  test('la raiz es <ent:CC314A> con el namespace ADUA de enswsv5, sin envoltorio Ent', () => {
    const xml = buildIE314CancelXML({ mrn: MRN });

    expect(xml).toContain('<ent:CC314A xmlns:ent="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE314V5Ent.xsd">');
    expect(xml).toContain('</ent:CC314A>');
    expect(xml).not.toContain('IE314V5Ent xmlns');
    expect(xml).not.toContain('static_files');
  });

  test('el receptor del canal ENS es NICA.ES', () => {
    expect(buildIE314CancelXML({ mrn: MRN })).toContain('<MesRecMES6>NICA.ES</MesRecMES6>');
    expect(buildIE314CancelXML({ mrn: MRN })).not.toContain('NECA.ES');
  });

  test('el remitente es el EORI del declarante', () => {
    const xml = buildIE314CancelXML({ mrn: MRN, declarantEORI: 'ESB22477020' });
    expect(xml).toContain('<MesSenMES3>ESB22477020</MesSenMES3>');
  });

  test('marca el indicador de entorno de pruebas', () => {
    expect(buildIE314CancelXML({ mrn: MRN, test: true })).toContain('<TesIndMES18>1</TesIndMES18>');
    expect(buildIE314CancelXML({ mrn: MRN, test: false })).toContain('<TesIndMES18>0</TesIndMES18>');
  });

  // AEAT rechazo el IE313 con "Element too long (length constraint)" sobre
  // DatOfPreMES9 cuando iba en AAAAMMDD: en esta familia la fecha es AAMMDD.
  test('la fecha de preparacion va en AAMMDD y la hora en HHMM', () => {
    const xml = buildIE314CancelXML({ mrn: MRN });

    const fecha = xml.match(/<DatOfPreMES9>(\d+)<\/DatOfPreMES9>/);
    const hora = xml.match(/<TimOfPreMES10>(\d+)<\/TimOfPreMES10>/);
    expect(fecha[1]).toHaveLength(6);
    expect(hora[1]).toHaveLength(4);
  });

  test('el identificador de mensaje no pasa de 14 caracteres (an..14)', () => {
    const xml = buildIE314CancelXML({ mrn: MRN });
    const id = xml.match(/<MesIdeMES19>([^<]+)<\/MesIdeMES19>/);
    expect(id[1].length).toBeLessThanOrEqual(14);
  });
});

describe('buildIE314CancelXML: cuerpo de la anulacion', () => {
  test('declara el MRN de la sumaria que se anula', () => {
    expect(buildIE314CancelXML({ mrn: MRN })).toContain(`<DocNumHEA5>${MRN}</DocNumHEA5>`);
  });

  test('declara el motivo de la anulacion', () => {
    const xml = buildIE314CancelXML({ mrn: MRN, reason: 'Mercancia no embarcada' });
    expect(xml).toContain('<AmdPlaHEA598>Mercancia no embarcada</AmdPlaHEA598>');
  });

  test('sin motivo pone uno generico en vez de dejar el elemento vacio', () => {
    const xml = buildIE314CancelXML({ mrn: MRN });
    expect(xml).toMatch(/<AmdPlaHEA598>.+<\/AmdPlaHEA598>/);
  });

  test('escapa los caracteres XML del motivo', () => {
    const xml = buildIE314CancelXML({ mrn: MRN, reason: 'Error en <peso> & cantidad' });
    expect(xml).toContain('&lt;peso&gt; &amp; cantidad');
    expect(xml).not.toContain('<peso>');
  });

  test('incluye la aduana de entrada de la sumaria original', () => {
    const xml = buildIE314CancelXML({ mrn: MRN, entryOffice: 'ES009999' });
    expect(xml).toContain('<RefNumCUSOFFFENT731>ES009999</RefNumCUSOFFFENT731>');
  });

  /**
   * Un XML de anulacion sin MRN no identifica nada: AEAT no puede saber que
   * sumaria anular. Es mejor fallar aqui que enviar un mensaje inutil.
   */
  test('falla si no se da el MRN, en vez de generar una anulacion sin destinatario', () => {
    expect(() => buildIE314CancelXML({})).toThrow(/MRN/i);
    expect(() => buildIE314CancelXML({ mrn: '' })).toThrow(/MRN/i);
  });
});
