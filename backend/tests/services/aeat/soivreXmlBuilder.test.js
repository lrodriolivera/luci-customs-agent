/**
 * soivreXmlBuilder: construccion del XML de solicitud de certificado PUE
 * ROHS/RAEE ante SOIVRE (mensaje ROHSSolicitudCertificadoV1Ent) para la AEAT.
 *
 * Generador PURO —sin BD ni red—: solo depende de generateTransactionId
 * (determinista). Es el mensaje que se envia al Punto Unico de Entrada para
 * pedir el certificado de una mercancia electrica/electronica sujeta a ROHS. Se
 * prueban las ramas opcionales (especificidades, referencias DOCUCICE, MRN
 * precedente, codigos RII RAEE/PYA), los defaults de unidad/cantidad y el flag
 * de test que marca el segmento como no productivo.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildSOIVREAltaXML, ENDPOINT_PRE, ENDPOINT_PROD } = require('../../../src/services/aeat/soivreXmlBuilder');

describe('buildSOIVREAltaXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el root ROHSSolicitudCertificadoV1Ent', () => {
    const xml = buildSOIVREAltaXML({ mrnPartida: '26ES00085123456789012' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<roh:ROHSSolicitudCertificadoV1Ent>');
    expect(xml).toContain('<TipoOperacion>ALT</TipoOperacion>');
  });

  test('el SegmentosDeServicio lleva Id, fecha y hora derivados del transactionId', () => {
    const xml = buildSOIVREAltaXML({});
    // fecha=8 digitos, hora=6 digitos.
    expect(xml).toMatch(/<SegmentosDeServicio Id="[^"]+" fecha="\d{8}" hora="\d{6}"/);
  });

  test('en modo test el segmento se marca con Test="S"', () => {
    expect(buildSOIVREAltaXML({})).toContain('Test="S"');
    expect(buildSOIVREAltaXML({ test: false })).not.toContain('Test="S"');
  });

  test('respeta el tipo de operacion (MOD para modificacion)', () => {
    const xml = buildSOIVREAltaXML({ tipoOperacion: 'MOD' });
    expect(xml).toContain('<TipoOperacion>MOD</TipoOperacion>');
  });

  test('exporta los endpoints PRE y PROD del WSDL oficial', () => {
    expect(ENDPOINT_PRE).toContain('/ws/rohs/ROHSsolicitudV1SOAP');
    expect(ENDPOINT_PROD).toContain('/ws/rohs/ROHSsolicitudV1SOAP');
  });
});

describe('MRN de partida y precedentes', () => {
  test('vuelca el MRN de partida y el tipo de documento', () => {
    const xml = buildSOIVREAltaXML({ mrnPartida: '26ES00085123456789012', tipoDocumento: 'DVD' });

    expect(xml).toContain('<MRNPartida>26ES00085123456789012</MRNPartida>');
    expect(xml).toContain('<TipoDocumento>DVD</TipoDocumento>');
  });

  test('el MRN cae a mrnPartidaClaveZeta del legacy si no viene mrnPartida', () => {
    const xml = buildSOIVREAltaXML({ mrnPartidaClaveZeta: '26ESLEGACY000000000000' });
    expect(xml).toContain('<MRNPartida>26ESLEGACY000000000000</MRNPartida>');
  });

  test('emite el MRN precedente y el id de solicitud precedente solo si vienen', () => {
    const con = buildSOIVREAltaXML({ mrnPartidaPrecedente: '25ESPREV', idSolSoivrePrecedente: 'SOL-99' });
    const sin = buildSOIVREAltaXML({});

    expect(con).toContain('<MRNPartidaPrecedente>25ESPREV</MRNPartidaPrecedente>');
    expect(con).toContain('<IdSolSoivrePrecedente>SOL-99</IdSolSoivrePrecedente>');
    expect(sin).not.toContain('<MRNPartidaPrecedente>');
    expect(sin).not.toContain('<IdSolSoivrePrecedente>');
  });
});

describe('unidades de mercancia', () => {
  test('la unidad y la cantidad caen a valores por defecto', () => {
    const xml = buildSOIVREAltaXML({});

    expect(xml).toContain('<UnidadDeMedidaDeMercancia>unidades fisicas</UnidadDeMedidaDeMercancia>');
    expect(xml).toContain('<CantidadDeUnidadesDeMercancia>1</CantidadDeUnidadesDeMercancia>');
  });

  test('respeta la unidad y cantidad explicitas', () => {
    const xml = buildSOIVREAltaXML({ unidadMercancia: 'kilogramos', cantidadMercancia: 250 });

    expect(xml).toContain('<UnidadDeMedidaDeMercancia>kilogramos</UnidadDeMedidaDeMercancia>');
    expect(xml).toContain('<CantidadDeUnidadesDeMercancia>250</CantidadDeUnidadesDeMercancia>');
  });
});

describe('especificidades y referencias DOCUCICE', () => {
  test('emite el bloque Especificidades con un Valor por codigo', () => {
    const xml = buildSOIVREAltaXML({ especificidades: ['01', '15'] });

    expect(xml).toContain('<Especificidades>');
    expect(xml).toContain('<Valor>01</Valor>');
    expect(xml).toContain('<Valor>15</Valor>');
  });

  test('sin especificidades no emite el bloque', () => {
    expect(buildSOIVREAltaXML({})).not.toContain('<Especificidades>');
  });

  test('emite el bloque ReferenciaDocucice con un Valor por referencia', () => {
    const xml = buildSOIVREAltaXML({ referenciasDocucice: ['DOC-1', 'DOC-2'] });

    expect(xml).toContain('<ReferenciaDocucice>');
    expect(xml).toContain('<Valor>DOC-1</Valor>');
    expect(xml).toContain('<Valor>DOC-2</Valor>');
  });

  test('sin referencias no emite el bloque', () => {
    expect(buildSOIVREAltaXML({})).not.toContain('<ReferenciaDocucice>');
  });
});

describe('certificados y codigos RII', () => {
  test('los certificados ROHS y RAEE caen a 01 (Normal) por defecto', () => {
    const xml = buildSOIVREAltaXML({});

    expect(xml).toContain('<CertificadoSolicitadoROHS>01</CertificadoSolicitadoROHS>');
    expect(xml).toContain('<CertificadoSolicitadoRAEE>01</CertificadoSolicitadoRAEE>');
  });

  test('respeta los certificados explicitos', () => {
    const xml = buildSOIVREAltaXML({ certificadoROHS: '02', certificadoRAEE: '03' });

    expect(xml).toContain('<CertificadoSolicitadoROHS>02</CertificadoSolicitadoROHS>');
    expect(xml).toContain('<CertificadoSolicitadoRAEE>03</CertificadoSolicitadoRAEE>');
  });

  test('emite los codigos RII RAEE y PYA solo si vienen', () => {
    const con = buildSOIVREAltaXML({ codigoRAEE: 'RAEE-123', codigoPYA: 'PYA-456' });
    const sin = buildSOIVREAltaXML({});

    expect(con).toContain('<CodigoRAEE>RAEE-123</CodigoRAEE>');
    expect(con).toContain('<CodigoPYA>PYA-456</CodigoPYA>');
    expect(sin).not.toContain('<CodigoRAEE>');
    expect(sin).not.toContain('<CodigoPYA>');
  });

  test('vuelca centro (CodCice), punto de inspeccion (CodPI) y email', () => {
    const xml = buildSOIVREAltaXML({ codCice: '11', codPi: '02', email: 'pue@strixai.es', tipoDeclaracion: '03' });

    expect(xml).toContain('<CodCice>11</CodCice>');
    expect(xml).toContain('<CodPI>02</CodPI>');
    expect(xml).toContain('<email>pue@strixai.es</email>');
    expect(xml).toContain('<TipoDeclaracion>03</TipoDeclaracion>');
  });
});
