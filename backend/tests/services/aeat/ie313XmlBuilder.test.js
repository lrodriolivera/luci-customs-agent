/**
 * ie313XmlBuilder: XML de rectificacion de una ENS (mensaje IE313 / CC313A,
 * formato IE313V5 unqualified) para la AEAT. Se usa para enmendar una sumaria de
 * entrada antes de que la mercancia llegue.
 *
 * Generador PURO —sin BD ni red—: genera su propio transactionId con Date y
 * Math.random, pero no hace I/O. Las ramas relevantes son los defaults de cada
 * partida rectificada y los totales agregados (numero de items, bultos y masa
 * bruta via reduce). No se asertan fecha ni id exactos (dependen del reloj y del
 * azar), solo su forma y las ramas.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildIE313AmendmentXML } = require('../../../src/services/aeat/ie313XmlBuilder');

/** Una partida rectificada minima. */
function item(extra = {}) {
  return { description: 'Textil', commodityCode: '6109100010', grossWeight: 300, numberOfPackages: 5, packageType: 'CT', ...extra };
}

describe('buildIE313AmendmentXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC313A', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ES00085123456789' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<MesTypMES20>CC313A</MesTypMES20>');
    expect(xml).toContain('<MesRecMES6>NICA.ES</MesRecMES6>');
  });

  /**
   * AEAT PRE rechazo una rectificacion real (8/Ago/2026) con
   * CD917B / XMLERR805 "Invalid XML format" + "Invalid NameSpace", errCod 52,
   * senalando linea 4 columna 148: el elemento raiz. Tres defectos a la vez:
   *   1. El namespace apuntaba a /static_files/common/... cuando la familia ENS
   *      (enswsv5) vive en /ADUA/internet/es/aeat/dit/adu/... — el IE315 que SI
   *      acepta AEAT usa esa ruta.
   *   2. Envolvia el CC313A dentro de <ent:IE313V5Ent>. El IE315V5 que funciona
   *      pone <ent:CC315A> como raiz directa, sin envoltorio Ent.
   *   3. <MesRecMES6> era 'NECA.ES'; el receptor del canal ENS es 'NICA.ES'
   *      (lo confirma el <MesSenMES3>NICA.ES</MesSenMES3> de todo CC328A real).
   * Sin esto, NINGUNA rectificacion de ENS podia llegar nunca a AEAT.
   */
  test('la raiz es <ent:CC313A> con el namespace ADUA de enswsv5 (no un envoltorio Ent)', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ES00085123456789' });

    expect(xml).toContain('<ent:CC313A xmlns:ent="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE313V5Ent.xsd">');
    expect(xml).toContain('</ent:CC313A>');
    expect(xml).not.toContain('IE313V5Ent xmlns');
    expect(xml).not.toContain('static_files');
  });

  test('marca el indicador de entorno de pruebas como hace el IE315', () => {
    expect(buildIE313AmendmentXML({ mrn: '26ESX', test: true })).toContain('<TesIndMES18>1</TesIndMES18>');
    expect(buildIE313AmendmentXML({ mrn: '26ESX', test: false })).toContain('<TesIndMES18>0</TesIndMES18>');
  });

  // MesIdeMES19 es an..14 en el esquema ENS: el transactionId de 24 digitos que
  // generaba el builder desbordaba el tipo.
  test('el identificador de mensaje no pasa de 14 caracteres', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX' });
    const ide = (xml.match(/<MesIdeMES19>([^<]*)</) || [])[1];
    expect(ide.length).toBeLessThanOrEqual(14);
  });

  test('vuelca el MRN original, la aduana de entrada y el transportista', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX', entryOffice: 'ES000851', carrierEORI: 'ESB22477020', carrierName: 'Naviera SA' });

    expect(xml).toContain('<DocNumHEA5>26ESX</DocNumHEA5>');
    expect(xml).toContain('<RefNumCUSOFFFENT731>ES000851</RefNumCUSOFFFENT731>');
    expect(xml).toContain('<TINCO259>ESB22477020</TINCO259>');
    expect(xml).toContain('<NamCO27>Naviera SA</NamCO27>');
    expect(xml).toContain('<MesSenMES3>ESB22477020</MesSenMES3>');
  });

  /**
   * Segundo rechazo real de AEAT PRE (8/Ago/2026) tras corregir el namespace:
   * CD917B / XMLERR805 <ErrReaXMLER802>Element too long (length constraint)
   * <OriAttValXMLER804>CC313A,DatOfPreMES9, codigo 39. La fecha iba en AAAAMMDD
   * (8 digitos) y el canal ENS la exige en AAMMDD (6), como el IE315 que AEAT si
   * acepta; la propia respuesta de AEAT se fecha '260808'.
   */
  test('la fecha de preparacion va en AAMMDD (6 digitos), no AAAAMMDD', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX' });
    expect(xml).toMatch(/<DatOfPreMES9>\d{6}<\/DatOfPreMES9>/);
    expect(xml).not.toMatch(/<DatOfPreMES9>\d{8}<\/DatOfPreMES9>/);
  });

  // El IE315 declara la hora de preparacion; el IE313 la omitia.
  test('declara la hora de preparacion en HHMM', () => {
    expect(buildIE313AmendmentXML({ mrn: '26ESX' })).toMatch(/<TimOfPreMES10>\d{4}<\/TimOfPreMES10>/);
  });

  test('el motivo de rectificacion cae a un texto por defecto si no se da', () => {
    expect(buildIE313AmendmentXML({ mrn: '26ESX' })).toContain('<AmdPlaHEA598>Rectificacion de datos</AmdPlaHEA598>');
    expect(buildIE313AmendmentXML({ mrn: '26ESX', amendmentReason: 'Cambio peso' })).toContain('<AmdPlaHEA598>Cambio peso</AmdPlaHEA598>');
  });
});

describe('totales agregados de la cabecera', () => {
  test('sin partidas el numero de items cae a 1 y los totales a 0', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX', goodsItems: [] });

    expect(xml).toContain('<TotNumOfIteHEA305>1</TotNumOfIteHEA305>');
    expect(xml).toContain('<TotNumOfPacHEA306>0</TotNumOfPacHEA306>');
    expect(xml).toContain('<TotGroMasHEA307>0</TotGroMasHEA307>');
  });

  test('con partidas agrega numero de items, bultos y masa bruta', () => {
    const xml = buildIE313AmendmentXML({
      mrn: '26ESX',
      goodsItems: [item({ numberOfPackages: 5, grossWeight: 300 }), item({ numberOfPackages: 3, grossWeight: 200 })]
    });

    expect(xml).toContain('<TotNumOfIteHEA305>2</TotNumOfIteHEA305>');
    expect(xml).toContain('<TotNumOfPacHEA306>8</TotNumOfPacHEA306>');
    expect(xml).toContain('<TotGroMasHEA307>500</TotGroMasHEA307>');
  });

  test('los bultos de una partida sin numberOfPackages cuentan como 1 en el total', () => {
    const xml = buildIE313AmendmentXML({
      mrn: '26ESX',
      goodsItems: [item({ numberOfPackages: undefined }), item({ numberOfPackages: undefined })]
    });
    // reduce usa (numberOfPackages || 1) -> 2
    expect(xml).toContain('<TotNumOfPacHEA306>2</TotNumOfPacHEA306>');
  });
});

describe('GOOITEGDS: partidas rectificadas', () => {
  test('numera las partidas y trunca el codigo de mercancia a 6', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX', goodsItems: [item({ commodityCode: '6109100010' })] });

    expect(xml).toContain('<IteNumGDS7>1</IteNumGDS7>');
    expect(xml).toContain('<ComCodTarCodGDS10>610910</ComCodTarCodGDS10>');
  });

  test('respeta el sequenceNumber explicito de la partida', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX', goodsItems: [item({ sequenceNumber: 7 })] });
    expect(xml).toContain('<IteNumGDS7>7</IteNumGDS7>');
  });

  test('los campos de la partida caen a valores por defecto si faltan', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX', goodsItems: [{}] });

    expect(xml).toContain('<GooDesGDS23></GooDesGDS23>');
    expect(xml).toContain('<GroMasGDS46>0</GroMasGDS46>');
    expect(xml).toContain('<ComCodTarCodGDS10></ComCodTarCodGDS10>');
    expect(xml).toContain('<NumOfPacGS24>1</NumOfPacGS24>');
    expect(xml).toContain('<KinOfPacGS23>PK</KinOfPacGS23>');
  });

  test('varias partidas generan varios GOOITEGDS numerados por indice', () => {
    const xml = buildIE313AmendmentXML({ mrn: '26ESX', goodsItems: [item(), item(), item()] });

    expect((xml.match(/<GOOITEGDS>/g) || []).length).toBe(3);
    expect(xml).toContain('<IteNumGDS7>3</IteNumGDS7>');
  });
});
