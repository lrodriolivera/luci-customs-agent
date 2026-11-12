/**
 * h1CauXmlBuilder: XML del H1 adaptado al CAU (mensaje CC415A).
 *
 * El XSD oficial impone el orden y el formato de cada elemento, así que la
 * prueba principal valida el XML contra los esquemas de la AEAT con xmllint
 * (se omite donde no esté instalado). No se simula nada.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildH1CauXML, NS_CC415A, fechaHora } = require('../../../src/services/aeat/h1CauXmlBuilder');

const ESQUEMA = path.join(__dirname, '../../fixtures/aeat-cau/CC415AV1Ent.xsd');
const HAY_XMLLINT = spawnSync('xmllint', ['--version']).status === 0;
const siHayXmllint = HAY_XMLLINT ? test : test.skip;

/** Valida contra el XSD oficial el mensaje que va dentro del sobre SOAP. */
function validar(xmlSoap) {
  const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(xmlSoap)[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cc415a-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  try {
    execFileSync('xmllint', ['--noout', '--schema', ESQUEMA, fichero], { stdio: 'pipe' });
    return null;
  } catch (error) {
    return String(error.stderr || error.message);
  }
}

/** Una declaración completa: tipo A, régimen 40, factura en dólares, sumaria como documento previo. */
function declaracion(cambios = {}) {
  return {
    mensaje: { id: 'LUCI-20261112-0001', fecha: new Date('2026-11-12T09:30:00Z') },
    aduanaImportacion: 'ES002801',
    declaracion: { lrn: 'LUCI26ES0000000001', tipo: 'IM', tipoAdicional: 'A' },
    aduanaPresentacion: 'ES002801',
    importador: { id: 'ESB12345674' },
    declarante: { id: 'ESB22477020', contacto: { nombre: 'Ana Ruiz', telefono: '+34 910000000', email: 'aduanas@agencia.es' } },
    garantias: [{ tipo: '1', referencias: [{ grn: '23ESAIL2800000020', pais: 'ES' }] }],
    envio: {
      naturalezaTransaccion: '11',
      divisa: 'USD',
      exportador: { nombre: 'Shenzhen Textiles Ltd', direccion: { calle: '1 Test Road', cp: '200000', ciudad: 'Shanghai', pais: 'CN' } },
      entrega: { incoterm: 'CIF', lugar: 'Valencia', pais: 'ES' },
      paisExpedicion: 'CN',
      destino: { pais: 'ES', region: '46' },
      expedicion: {
        contenedores: true, modoInterior: '3', modoFrontera: '1', masaBruta: 995,
        equipos: [{ contenedor: 'MSCU1234567', partidas: [1] }],
        ubicacion: { tipo: 'B', calificador: 'Y', autorizacion: 'ES002801AAAAAC' },
        medioLlegada: { tipo: '10', id: '9321483' },
        nacionalidadMedioActivo: 'PA',
        documentosTransporte: [{ tipo: 'N705', referencia: 'MSCU20268198800' }]
      },
      partidas: [{
        numero: 1,
        valorEstadistico: 8901.55,
        regimen: { solicitado: '40', precedente: '00', adicionales: ['000'] },
        origen: 'CN',
        descripcion: 'Ropa de cama de punto de algodón <100 % algodón> & fundas',
        codigo: { sa6: '630210', nc2: '00', taric2: '00' },
        masaBruta: 995, masaNeta: 900,
        importeFactura: 10000,
        preferencia: '100',
        tributos: [
          { tipo: 'A00', medioDePago: 'A', bases: [{ tipoImpositivo: 12, importe: 8901.55, cuota: 1068.19 }] },
          { tipo: 'B00', medioDePago: 'A', bases: [{ tipoImpositivo: 21, importe: 9969.74, cuota: 2093.65 }] }
        ],
        bultos: [{ tipo: 'CT', numero: 90, marcas: 'S/M' }],
        documentosPrevios: [{ tipo: 'N337', referencia: '26ES00280180000014', tipoBultos: 'CT', bultos: 90, unidad: 'KGM', cantidad: 995, partida: 1 }],
        documentosJustificativos: [{ tipo: 'N380', referencia: 'FAC-2026-118' }],
        valoracion: { metodo: '1' },
        indicadoresValoracion: '0000'
      }]
    },
    ...cambios
  };
}

describe('buildH1CauXML: esquema oficial', () => {
  siHayXmllint('una declaración completa valida contra el XSD de la AEAT', () => {
    expect(validar(buildH1CauXML(declaracion()))).toBeNull();
  });

  siHayXmllint('con representante directo, varias partidas y ajustes de valor también valida', () => {
    const base = declaracion();
    const xml = buildH1CauXML(declaracion({
      representante: { id: 'ESB22477020', estado: '2', contacto: { nombre: 'Ana Ruiz', telefono: '+34 910000000', email: 'aduanas@agencia.es' } },
      autorizaciones: [{ tipo: 'C514', referencia: 'ESEUS00000001', titular: 'ESB12345674' }],
      envio: {
        ...base.envio,
        documentosJustificativos: [{ tipo: '1005', referencia: 'OCRE' }],
        informacionAdicional: [{ codigo: 'I1033', texto: 'S' }],
        partidas: [
          { ...base.envio.partidas[0], valoracion: { metodo: '1', ajustes: [{ codigo: 'AK', importe: 500 }, { codigo: 'AL', importe: 100 }] } },
          { ...base.envio.partidas[0], numero: 2, unidadesSuplementarias: 10, codigo: { sa6: '847130', nc2: '00', taric2: '00', adicionalesTaric: ['C999'] } }
        ]
      }
    }));
    expect(validar(xml)).toBeNull();
  });

  siHayXmllint('el esquema detecta un dato mal formado (la prueba no es complaciente)', () => {
    const xml = buildH1CauXML(declaracion({ aduanaImportacion: '002801' }));
    expect(validar(xml)).toMatch(/referenceNumber/);
  });
});

describe('buildH1CauXML: contenido', () => {
  const xml = buildH1CauXML(declaracion());

  test('va en un sobre SOAP 1.1 con la raíz en el espacio de nombres del servicio', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<es:CC415AV1Ent xmlns:es="${NS_CC415A}">`);
    expect(xml).toContain('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">');
  });

  test('va en modo test salvo que se pida expresamente lo contrario', () => {
    expect(xml).toContain('<testIndicator>S</testIndicator>');
    expect(buildH1CauXML(declaracion({ mensaje: { id: 'X1234', test: false } }))).not.toContain('testIndicator');
  });

  test('la fecha del mensaje va en hora de Madrid', () => {
    expect(fechaHora(new Date('2026-11-12T09:30:00Z'))).toBe('2026-11-12T10:30:00');
    expect(xml).toContain('<preparationDateAndTime>2026-11-12T10:30:00</preparationDateAndTime>');
  });

  test('escapa los datos: una descripción con < > & no rompe el mensaje', () => {
    expect(xml).toContain('algodón &lt;100 % algodón&gt; &amp; fundas');
  });

  test('la factura va en su divisa y la liquidación en euros, con dos decimales', () => {
    expect(xml).toContain('<invoiceCurrency>USD</invoiceCurrency>');
    expect(xml).toContain('<itemAmountInvoiced>10000.00</itemAmountInvoiced>');
    expect(xml).toContain('<statisticalValue>8901.55</statisticalValue>');
    expect(xml).toContain('<taxRate>12</taxRate><amount>8901.55</amount><taxAmount>1068.19</taxAmount>');
  });

  test('no declara lo que el CAU prohíbe: tipo de cambio, total de factura ni totales de tributos', () => {
    expect(xml).not.toContain('exchangeRate');
    expect(xml).not.toContain('totalAmountInvoiced');
    expect(xml).not.toContain('totalDutiesAndTaxesAmount');
    expect(xml).not.toContain('payableTaxAmount');
  });

  test('la garantía va en euros y con importe cero: el importe lo calcula la AEAT', () => {
    expect(xml).toContain('<GRN>23ESAIL2800000020</GRN><ccQualifier>ES</ccQualifier><currencyCode>EUR</currencyCode><amountToBeCovered>0</amountToBeCovered>');
  });

  test('la sumaria va como documento previo N337 con bultos, kilos y partida', () => {
    expect(xml).toContain('<type>N337</type><referenceNumber>26ES00280180000014</referenceNumber><typeOfPackages>CT</typeOfPackages><numberOfPackages>90</numberOfPackages><measurementUnitAndQualifier>KGM</measurementUnitAndQualifier><quantity>995</quantity><goodsItemIdentifier>1</goodsItemIdentifier>');
  });

  test('sin representante no hay grupo Representative; los grupos vacíos no se emiten', () => {
    expect(xml).not.toContain('Representative');
    expect(xml).not.toContain('<Buyer');
    expect(xml).not.toContain('<Authorisation');
  });

  test('numera las listas desde 1', () => {
    const dos = buildH1CauXML(declaracion({ garantias: [{ tipo: '1', referencias: [{ grn: 'A' }, { grn: 'B' }] }] }));
    expect(dos).toContain('<sequenceNumber>1</sequenceNumber><GRN>A</GRN>');
    expect(dos).toContain('<sequenceNumber>2</sequenceNumber><GRN>B</GRN>');
  });
});
