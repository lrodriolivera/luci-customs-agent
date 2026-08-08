/**
 * cc044XmlBuilder: XML de observaciones de descarga NCTS (mensaje CC044C) para
 * la AEAT. Se envia tras descargar la mercancia en destino para confirmar el
 * estado de los precintos y de las mercancias frente a la declaracion de
 * transito.
 *
 * Generador PURO —sin BD ni red—: genera su propio transactionId con Date y
 * Math.random, pero no hace I/O. Las ramas relevantes deciden si la descarga es
 * conforme o arrastra discrepancias, y el estado de precintos. Un error aqui
 * confirma como conforme una descarga con faltas o exceso de mercancia. No se
 * asertan valores exactos de fecha ni el id (dependen del reloj y del azar),
 * solo su forma y las ramas.
 *
 * E2E 8/Ago: el builder se escribio sin mirar ES_CC044C_v515.xsd y la forma era
 * invalida en cuatro puntos. Los tests de este fichero fijan la forma real del
 * esquema; ver el describe de conformidad al final.
 *
 * NO se mockea nada: el codigo bajo prueba es justo el que genera el XML.
 */

const { buildCC044UnloadingXML } = require('../../../src/services/aeat/cc044XmlBuilder');

describe('buildCC044UnloadingXML: envelope y cabecera', () => {
  test('envuelve en un envelope SOAP con el mensaje CC044C qualified', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ES00085123456789' });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<ent:CC044CV1Ent');
    expect(xml).toContain('<ent:messageType>CC044C</ent:messageType>');
    // NTA.ES es el destinatario que acepta el IE015; NETA.ES era un typo.
    expect(xml).toContain('<ent:messageRecipient>NTA.ES</ent:messageRecipient>');
  });

  test('vuelca MRN, aduana de destino real y EORI del destinatario', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', officeOfDestination: 'ES000851', traderEORI: 'ESB22477020' });

    expect(xml).toContain('<ent:MRN>26ESX</ent:MRN>');
    expect(xml).toContain('<ent:referenceNumber>ES000851</ent:referenceNumber>');
    expect(xml).toContain('<ent:identificationNumber>ESB22477020</ent:identificationNumber>');
    // El messageSender tambien es el EORI del destinatario.
    expect(xml).toContain('<ent:messageSender>ESB22477020</ent:messageSender>');
  });

  test('la fecha de preparacion es un DateTimeType (no AAAAMMDD)', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX' });
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:preparationDateAndTime>/);
  });

  /**
   * `unloadingDate` es DateType (AAAA-MM-DD), no DateTimeType: comparte la
   * entrada con preparationDateAndTime pero se recorta a la parte de fecha.
   */
  test('respeta la fecha de descarga explicita y la recorta a DateType', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', unloadingDate: '2026-08-04T10:30:00' });
    expect(xml).toContain('<ent:preparationDateAndTime>2026-08-04T10:30:00</ent:preparationDateAndTime>');
    expect(xml).toContain('<ent:unloadingDate>2026-08-04</ent:unloadingDate>');
  });

  test('acepta una fecha de descarga ya en DateType', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', unloadingDate: '2026-08-04' });
    expect(xml).toContain('<ent:unloadingDate>2026-08-04</ent:unloadingDate>');
    expect(xml).toMatch(/<ent:preparationDateAndTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/ent:preparationDateAndTime>/);
  });
});

describe('descarga conforme (sin discrepancias)', () => {
  test('emite una unica UnloadingRemark con conform=1 cuando la mercancia es conforme', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', goodsConform: true });

    expect((xml.match(/<ent:UnloadingRemark>/g) || []).length).toBe(1);
    expect(xml).toContain('<ent:conform>1</ent:conform>');
  });

  test('conform=0 si la mercancia no es conforme aunque no haya discrepancias detalladas', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', goodsConform: false });
    expect(xml).toContain('<ent:conform>0</ent:conform>');
  });

  test('el estado de precintos refleja sealsOk (1 intactos, 0 rotos)', () => {
    const ok = buildCC044UnloadingXML({ mrn: '26ESX', sealsOk: true });
    const roto = buildCC044UnloadingXML({ mrn: '26ESX', sealsOk: false });

    expect(ok).toContain('<ent:stateOfSeals>1</ent:stateOfSeals>');
    expect(roto).toContain('<ent:stateOfSeals>0</ent:stateOfSeals>');
  });

  test('la descarga se declara completada (unloadingCompletion, obligatorio en el XSD)', () => {
    expect(buildCC044UnloadingXML({ mrn: '26ESX' })).toContain('<ent:unloadingCompletion>1</ent:unloadingCompletion>');
  });
});

describe('descarga con discrepancias', () => {
  /**
   * El XSD solo admite UNA UnloadingRemark (maxOccurs por defecto = 1), asi que
   * las discrepancias no pueden ir una por bloque: se resumen en el texto libre
   * `unloadingRemark` y fuerzan conform=0. El builder emitia una por
   * discrepancia, lo que AEAT rechaza.
   */
  test('resume todas las discrepancias en una sola UnloadingRemark con conform=0', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX',
      goodsDiscrepancies: [
        { itemNumber: 1, description: 'Faltan 5 cajas', shortageOrExcess: 'S', quantity: 5 },
        { itemNumber: 2, description: 'Exceso de 2 palets', shortageOrExcess: 'E', quantity: 2 }
      ]
    });

    expect((xml.match(/<ent:UnloadingRemark>/g) || []).length).toBe(1);
    expect((xml.match(/<ent:conform>0<\/ent:conform>/g) || []).length).toBe(1);
    const texto = xml.match(/<ent:unloadingRemark>(.*?)<\/ent:unloadingRemark>/)[1];
    expect(texto).toContain('Faltan 5 cajas');
    expect(texto).toContain('Exceso de 2 palets');
    // Numero de partida y tipo de discrepancia se conservan en el resumen.
    expect(texto).toMatch(/1/);
    expect(texto).toContain('S');
    expect(texto).toContain('E');
  });

  test('una discrepancia sin campos no rompe ni deja el texto vacio', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX',
      goodsDiscrepancies: [{ description: 'Discrepancia generica' }]
    });

    expect(xml).toContain('<ent:conform>0</ent:conform>');
    expect(xml).toContain('Discrepancia generica');
    // ResultsOfControl / description / controlIndicator NO existen en el XSD.
    expect(xml).not.toContain('<ent:ResultsOfControl>');
    expect(xml).not.toContain('<ent:controlIndicator>');
  });

  test('las discrepancias tambien reflejan el estado de precintos', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX', sealsOk: false,
      goodsDiscrepancies: [{ description: 'x' }]
    });
    expect(xml).toContain('<ent:stateOfSeals>0</ent:stateOfSeals>');
  });

  /**
   * `unloadingRemark` es AlphaNumeric_MAX512_NoSpaces: como maximo 512
   * caracteres y sin espacios al principio ni al final. Un lote grande de
   * discrepancias se pasaria de largo y AEAT rechazaria el mensaje entero.
   */
  test('el texto de observaciones se recorta a 512 caracteres sin espacios en los extremos', () => {
    const xml = buildCC044UnloadingXML({
      mrn: '26ESX',
      goodsDiscrepancies: Array.from({ length: 40 }, (_, i) => ({
        itemNumber: i + 1, description: 'Discrepancia muy larga numero ' + i, shortageOrExcess: 'S'
      }))
    });

    const texto = xml.match(/<ent:unloadingRemark>(.*?)<\/ent:unloadingRemark>/)[1];
    expect(texto.length).toBeLessThanOrEqual(512);
    expect(texto).toBe(texto.trim());
    expect(texto.length).toBeGreaterThan(0);
  });
});

/**
 * Estructura obligatoria de CC044CType (ES_CC044C_v515.xsd):
 *   MESSAGE, TransitOperation, CustomsOfficeOfDestinationActual,
 *   TraderAtDestination, [RepresentanteEnDestino], UnloadingRemark,
 *   [Consignment]
 * El builder anidaba UnloadingRemark dentro de Consignment; el orden del
 * sequence es normativo, asi que eso da un 1207 igual que si faltara.
 */
describe('buildCC044UnloadingXML: conformidad con ES_CC044C_v515.xsd', () => {
  test('UnloadingRemark va al nivel raiz, no dentro de Consignment', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX' });
    expect(xml).toContain('<ent:UnloadingRemark>');
    // Si hubiera Consignment, iria DESPUES de UnloadingRemark.
    const iRemark = xml.indexOf('<ent:UnloadingRemark>');
    const iConsignment = xml.indexOf('<ent:Consignment>');
    if (iConsignment !== -1) expect(iRemark).toBeLessThan(iConsignment);
  });

  test('respeta el orden: TransitOperation < CustomsOffice < TraderAtDestination < UnloadingRemark', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX' });
    const orden = ['<ent:TransitOperation>', '<ent:CustomsOfficeOfDestinationActual>', '<ent:TraderAtDestination>', '<ent:UnloadingRemark>']
      .map(t => xml.indexOf(t));
    expect(orden.every(i => i !== -1)).toBe(true);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  /**
   * TraderAtDestinationType02 solo define identificationNumber: el
   * communicationLanguageAtDestination que si vale en el CC007 aqui es un
   * elemento no declarado.
   */
  test('TraderAtDestination es Type02: sin communicationLanguageAtDestination', () => {
    expect(buildCC044UnloadingXML({ mrn: '26ESX' }))
      .not.toContain('<ent:communicationLanguageAtDestination>');
  });

  test('los elementos de UnloadingRemark van en el orden del XSD', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX', sealsOk: true, goodsDiscrepancies: [{ description: 'x' }] });
    const orden = ['<ent:conform>', '<ent:unloadingCompletion>', '<ent:unloadingDate>', '<ent:stateOfSeals>', '<ent:unloadingRemark>']
      .map(t => xml.indexOf(t));
    expect(orden.every(i => i !== -1)).toBe(true);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  test('messageIdentification no pasa de 35 caracteres', () => {
    const xml = buildCC044UnloadingXML({ mrn: '26ESX' });
    const id = xml.match(/<ent:messageIdentification>(.*?)<\/ent:messageIdentification>/)[1];
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(35);
  });
});
