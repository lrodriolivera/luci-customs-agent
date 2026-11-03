/**
 * Los builders del XML que se envia a la AEAT escapan los datos.
 *
 * Los builders interpolaban con template strings los datos de la declaracion
 * (descripciones, nombres, referencias, MRN...) tal cual. Un valor con '<' o
 * '&' rompia el XML firmado o, peor, metia elementos nuevos en el mensaje que se
 * presenta a la AEAT en nombre del declarante (hallazgos de inyeccion XML del
 * escaneo del 3/Nov/2026). Solo h7XmlBuilder e ie314XmlBuilder escapaban.
 *
 * Para cada builder se inyecta la misma carga en un campo de texto que vuelca y
 * se comprueba que el XML sigue bien formado, que no aparece ningun elemento
 * <Pwned> y que el valor llega como texto literal.
 */

const { DOMParser } = require('@xmldom/xmldom');

const { buildENSDeclarationXML } = require('../../../src/services/aeat/ensXmlBuilder');
const { buildAESExportXML } = require('../../../src/services/aeat/aesXmlBuilder');
const { buildCC007ArrivalXML } = require('../../../src/services/aeat/cc007XmlBuilder');
const { buildCC044UnloadingXML } = require('../../../src/services/aeat/cc044XmlBuilder');
const { buildH1ImportXML } = require('../../../src/services/aeat/h1XmlBuilder');
const { buildH1CancelXML } = require('../../../src/services/aeat/h1CancelXmlBuilder');
const { buildIE313AmendmentXML } = require('../../../src/services/aeat/ie313XmlBuilder');
const { buildNCTSTransitXML } = require('../../../src/services/aeat/nctsXmlBuilder');
const { buildQueryImportXML } = require('../../../src/services/aeat/queryXmlBuilder');
const { buildSOIVREAltaXML } = require('../../../src/services/aeat/soivreXmlBuilder');

const CARGA = 'A&B</X><Pwned>1</Pwned><X a="\'">';

/** Parsea en modo estricto: cualquier error o aviso de buena formacion falla. */
function parsear(xml) {
  const errores = [];
  const doc = new DOMParser({
    errorHandler: {
      warning: (m) => errores.push(m),
      error: (m) => errores.push(m),
      fatalError: (m) => errores.push(m)
    }
  }).parseFromString(xml, 'text/xml');
  return { doc, errores };
}

/** Texto de todos los nodos del documento, para buscar la carga literal. */
function todoElTexto(nodo) {
  let texto = '';
  for (let n = nodo.firstChild; n; n = n.nextSibling) {
    texto += n.nodeType === 3 ? n.data : todoElTexto(n);
  }
  return texto;
}

const CASOS = [
  ['ensXmlBuilder (descripcion de la partida)', () => buildENSDeclarationXML({
    lrn: 'LRN-1', carrierEORI: 'ESB22477020', entryOffice: 'ES000851',
    consignment: { grossMass: 1, numberOfPackages: 1 },
    houseConsignments: [{ goodsDescription: CARGA, commodityCode: '610910', grossMass: 1, numberOfPackages: 1 }]
  })],
  ['aesXmlBuilder (descripcion de la partida)', () => buildAESExportXML({
    goodsItems: [{ description: CARGA, taricCode: '1509100000', grossWeight: 1, netWeight: 1, value: 1, packages: 1 }]
  })],
  ['cc007XmlBuilder (MRN)', () => buildCC007ArrivalXML({
    mrn: CARGA, authorisationNumber: '2901MLG005', authorisationReference: 'ESACE02026000008',
    numeroSumariaRecepcion: '29016000001'
  })],
  ['cc044XmlBuilder (MRN)', () => buildCC044UnloadingXML({ mrn: CARGA })],
  ['h1XmlBuilder (descripcion de la partida)', () => buildH1ImportXML({
    partidas: [{ descripcion: CARGA, taricCode: '0901210000', paisOrigen: 'CO', pesobruto: 1, pesoneto: 1, bultos: 1, valorFactura: 1 }]
  })],
  ['h1CancelXmlBuilder (MRN)', () => buildH1CancelXML({ mrn: CARGA })],
  ['ie313XmlBuilder (descripcion de la partida)', () => buildIE313AmendmentXML({
    mrn: '26ESX', transportMode: 'RAIL', expectedArrival: '2026-09-01T08:30:00.000Z',
    goodsItems: [{ description: CARGA, commodityCode: '6109100010', grossWeight: 1, numberOfPackages: 1, packageType: 'CT' }]
  })],
  ['nctsXmlBuilder (descripcion de la partida)', () => buildNCTSTransitXML({
    lrn: 'LRN-TR-1', officeOfDeparture: 'ES000851', officeOfDestination: 'FR001300', holderEORI: 'ESB22477020',
    consignment: { goodsItems: [{ description: CARGA, taricCode: '84295200', grossWeight: 1, netWeight: 1, packages: 1 }] }
  })],
  ['queryXmlBuilder (MRN)', () => buildQueryImportXML(CARGA)],
  ['soivreXmlBuilder (MRN de partida)', () => buildSOIVREAltaXML({ mrnPartida: CARGA })]
];

describe.each(CASOS)('%s escapa los datos', (_nombre, construir) => {
  test('devuelve un string', () => {
    expect(typeof construir()).toBe('string');
  });

  test('el XML sigue bien formado', () => {
    const { errores } = parsear(construir());
    expect(errores).toEqual([]);
  });

  test('no se cuela ningun elemento inyectado', () => {
    const { doc } = parsear(construir());
    expect(doc.getElementsByTagName('Pwned').length).toBe(0);
  });

  test('el valor llega como texto literal', () => {
    const { doc } = parsear(construir());
    expect(todoElTexto(doc)).toContain('A&B</X><Pwned>1</Pwned>');
  });
});
