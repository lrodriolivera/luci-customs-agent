/**
 * Casilla 40 del H1 (documento de cargo: declaracion sumaria) y bultos de la
 * partida, tal como salen hacia la AEAT.
 *
 * Esquema oficial ImportacionCompletaV1Ent.xsd: <C40DocumentoCargoPrecedente>
 * va entre C39Contingente y C41UnidadesSuplementarias, con C40TipoDocumento
 * ('X' = declaracion sumaria), C40ClaseDocumento ('SUM' maritima, 'SUA' aerea)
 * y C40ReferenciaDocumento (RRRRANNNNNN + PPPPP).
 */
const { buildH1ImportXML, expeditionToH1Data, documentoCargoDe } = require('../../../src/services/aeat/h1XmlBuilder');

const declarante = { eori: 'ESB22477020', companyName: 'STRIX AI SL', contact: { email: 'x@y.es' } };

const expediente = (extra = {}) => ({
  expeditionId: 'EXP-2026-LCL',
  transportMode: 'sea',
  client: { companyName: 'Importadora Levante SL', nif: 'B12345674', taxId: 'B12345674', address: { street: 'Calle Mayor 1', city: 'Valencia', postalCode: '46001' } },
  exporter: { companyName: 'Shenzhen Tech Ltd', country: 'CN' },
  incoterm: { code: 'CIF' },
  declaration: { regime: '40', preference: '100', customsOffice: 'ES004611' },
  transport: {},
  goods: [{
    description: 'Ordenadores portatiles', taricCode: '8471300000', originCountry: 'CN',
    grossWeight: 1050.5, netWeight: 980, invoiceValue: 184800, packages: { quantity: 12, type: 'PX', marks: 'LEV-1' }
  }],
  ...extra
});

const xmlDe = (exp) => buildH1ImportXML({ ...expeditionToH1Data(exp, { declarante }), test: true });
const sumaria = { number: '46116000123', item: '3', packages: 12, grossWeight: 1050.5 };

describe('H1 hacia la AEAT — casilla 40 y bultos', () => {
  describe('documentoCargoDe', () => {
    test('sumaria maritima: X / SUM / clave + partida a cinco digitos', () => {
      expect(documentoCargoDe(expediente({ transport: { summaryDeclaration: sumaria } })))
        .toEqual({ tipo: 'X', clase: 'SUM', referencia: '4611600012300003' });
    });

    test('sumaria aerea: clase SUA', () => {
      expect(documentoCargoDe(expediente({ transportMode: 'air', transport: { summaryDeclaration: sumaria } })).clase).toBe('SUA');
    });

    test('admite la clave con separadores y el modo de transporte en mayusculas', () => {
      const doc = documentoCargoDe(expediente({ transportMode: 'SEA', transport: { summaryDeclaration: { ...sumaria, number: '4611 6 000123' } } }));
      expect(doc.referencia).toBe('4611600012300003');
    });

    test('si solo se registro el MRN usa la clave que devolvio la AEAT', () => {
      const conMrn = { number: '26ES00461180001234', item: '12', aeat: { clave: '46116000999' } };
      expect(documentoCargoDe(expediente({ transport: { summaryDeclaration: conMrn } })).referencia).toBe('4611600099900012');
    });

    test('sin clave conocida, sin partida o en un modo sin sumaria no declara la casilla', () => {
      const con = (transport, extra = {}) => documentoCargoDe(expediente({ transport, ...extra }));

      expect(con({})).toBeNull();
      expect(con({ summaryDeclaration: { number: '26ES00461180001234', item: '1' } })).toBeNull();
      expect(con({ summaryDeclaration: { number: '46116000123' } })).toBeNull();
      expect(con({ summaryDeclaration: { number: 'S-PARTIDA', item: '1' } })).toBeNull();
      expect(con({ summaryDeclaration: sumaria }, { transportMode: 'road' })).toBeNull();
    });
  });

  describe('XML', () => {
    test('con sumaria registrada, la partida lleva la casilla 40 entre la masa neta y el valor de factura', () => {
      const x = xmlDe(expediente({ transport: { loadType: 'LCL', summaryDeclaration: sumaria } }));

      expect(x).toContain('<C40TipoDocumento>X</C40TipoDocumento>');
      expect(x).toContain('<C40ClaseDocumento>SUM</C40ClaseDocumento>');
      expect(x).toContain('<C40ReferenciaDocumento>4611600012300003</C40ReferenciaDocumento>');
      expect(x.indexOf('<C38MasaNetaEnKg>')).toBeLessThan(x.indexOf('<C40DocumentoCargoPrecedente>'));
      expect(x.indexOf('<C40DocumentoCargoPrecedente>')).toBeLessThan(x.indexOf('<C42ValorFactura>'));
    });

    test('sin sumaria registrada el XML no lleva la casilla 40', () => {
      expect(xmlDe(expediente())).not.toContain('C40DocumentoCargoPrecedente');
    });

    test('la partida declara los bultos, el tipo y las marcas del expediente, no 1 bulto fijo', () => {
      const x = xmlDe(expediente());

      expect(x).toContain('<C31EmpaqInternoNumeroBultos>12</C31EmpaqInternoNumeroBultos>');
      expect(x).toContain('<C31EmpaqInternoClase>PX</C31EmpaqInternoClase>');
      expect(x).toContain('<C31EmpaqInternoMarcas>LEV-1</C31EmpaqInternoMarcas>');
    });

    test('una partida sin bultos informados sigue saliendo con 1, como antes', () => {
      const sinBultos = expediente();
      delete sinBultos.goods[0].packages;

      expect(xmlDe(sinBultos)).toContain('<C31EmpaqInternoNumeroBultos>1</C31EmpaqInternoNumeroBultos>');
    });
  });
});
