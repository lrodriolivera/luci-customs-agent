/**
 * Del expediente a los datos del H1 CAU: representación, garantía,
 * autorización de despacho, divisa y la lista de datos que faltan. El XML
 * resultante se valida además contra el XSD oficial.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expeditionToH1CauData, conPais, aduana, ubicacionDe, provinciaDe } = require('../../../src/services/aeat/h1CauData');
const { buildH1CauXML } = require('../../../src/services/aeat/h1CauXmlBuilder');

const ESQUEMA = path.join(__dirname, '../../fixtures/aeat-cau/CC415AV1Ent.xsd');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
const AGENTE = { eori: 'ESB22477020', companyName: 'Agencia SL', contact: { name: 'Ana Ruiz', phone: '+34 910000000', email: 'aduanas@agencia.es' } };
const USD = { divisa: 'USD', tipo: 1.1234, mes: '2026-11', fuente: 'BCE' };

function expediente(cambios = {}) {
  return {
    expeditionId: 'EXP-2026-AAAA0001',
    transportMode: 'maritime',
    client: { companyName: 'Importadora SL', nif: 'B12345674', eori: 'ESB12345674', address: { street: 'Calle 1', city: 'Valencia', postalCode: '46001', country: 'ES' } },
    exporter: { companyName: 'Shenzhen Textiles Ltd', address: '1 Test Road', city: 'Shanghai', country: 'CN' },
    representative: { representationType: 'indirect' },
    incoterm: { code: 'CIF', place: 'Valencia' },
    transport: {
      vehicleId: 'MSC AURORA', vehicleNationality: 'pa', documentType: 'BL', documentNumber: 'MSCU20268198800', arrivalPort: 'Valencia',
      containers: [{ number: 'MSCU1234567' }],
      summaryDeclaration: { number: '28016000001', item: '1', aeat: { mrn: '26ES00280180000014', location: '2801AAAAAA' } }
    },
    declaration: { customsOffice: 'ES002801', lrn: '26ESB28D4A2FC2874376', regime: '40', additionalProcedure: '000', preference: '100', invoiceNumber: 'FAC-2026-118' },
    goods: [{
      itemNumber: 1, description: 'Ropa de cama de punto de algodón', taricCode: '6302100000', originCountry: 'CN',
      grossWeight: 995, netWeight: 900, invoiceValue: 10000, currency: 'USD', dutyRate: 12, vatRate: 21,
      packages: { quantity: 90, type: 'CT', marks: 'S/M' }
    }],
    ...cambios
  };
}
const datos = (exp = expediente(), opciones = {}) =>
  expeditionToH1CauData(exp, { declarante: { ...AGENTE, representationType: exp.representative?.representationType }, cambio: USD, mensajeId: 'LUCI-0001', fecha: new Date('2026-11-12T09:30:00Z'), ...opciones });

function validar(d) {
  const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(buildH1CauXML(d))[1];
  const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cc415a-')), 'mensaje.xml');
  fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
  try { execFileSync('xmllint', ['--noout', '--schema', ESQUEMA, fichero], { stdio: 'pipe' }); return null; } catch (e) { return String(e.stderr || e.message); }
}

describe('H1 CAU: quién declara según la representación', () => {
  test('indirecta: el declarante es el agente, con su contacto, y no hay representante', () => {
    const d = datos();
    expect(d.formaRepresentacion).toBe('3');
    expect(d.importador).toEqual({ id: 'ESB12345674' });
    expect(d.declarante).toEqual({ id: 'ESB22477020', contacto: { nombre: 'Ana Ruiz', telefono: '+34 910000000', email: 'aduanas@agencia.es' } });
    expect(d.representante).toBeNull();
  });

  test('directa: el declarante es el importador y el agente va como representante con estado 2', () => {
    const d = datos(expediente({ representative: { representationType: 'direct' } }));
    expect(d.formaRepresentacion).toBe('2');
    expect(d.declarante).toEqual({ id: 'ESB12345674' });
    expect(d.representante).toMatchObject({ id: 'ESB22477020', estado: '2', contacto: { nombre: 'Ana Ruiz' } });
  });

  test('autodespacho: importador y declarante son el mismo, sin representante ni autorización', () => {
    const exp = expediente({ client: { ...expediente().client, nif: 'B22477020', eori: 'ESB22477020' } });
    const d = datos(exp);
    expect(d.formaRepresentacion).toBe('1');
    expect(d.declarante.id).toBe('ESB22477020');
    expect(d.representante).toBeNull();
    expect(d.envio.documentosJustificativos).toEqual([]);
  });
});

describe('H1 CAU: autorización de despacho', () => {
  test('por defecto, por operación sin registro electrónico: documento 1005 OSRE en cabecera', () => {
    expect(datos().envio.documentosJustificativos).toEqual([{ tipo: '1005', referencia: 'OSRE' }]);
  });

  test('con registro electrónico, OCRE; con autorización global no se declara nada', () => {
    const con = (ambito) => datos(expediente({ representative: { representationType: 'indirect', dispatchAuthorizationScope: ambito } })).envio.documentosJustificativos;
    expect(con('OCRE')).toEqual([{ tipo: '1005', referencia: 'OCRE' }]);
    expect(con('global')).toEqual([]);
  });
});

describe('H1 CAU: medio de pago y garantía', () => {
  test('por defecto, pago previo al levante (A) y sin garantía', () => {
    const d = datos();
    expect(d.garantias).toEqual([]);
    expect(d.envio.partidas[0].tributos.map((t) => t.medioDePago)).toEqual(['A', 'A']);
  });

  test('con pago aplazado la garantía del tenant es obligatoria y se declara', () => {
    const d = datos(expediente(), { tenant: { customsConfig: { medioDePago: 'R', garantiaGRN: '26ESAGL2800000054' } } });
    expect(d.garantias).toEqual([{ tipo: '1', referencias: [{ grn: '26ESAGL2800000054' }] }]);
    expect(d.envio.partidas[0].tributos[0].medioDePago).toBe('R');
  });

  test('pago aplazado sin GRN: no se presenta', () => {
    expect(() => datos(expediente(), { tenant: { customsConfig: { medioDePago: 'R' } } })).toThrow('GRN');
  });
});

describe('H1 CAU: importes, divisa y documentos', () => {
  const d = datos();
  const [p] = d.envio.partidas;

  test('la factura va en dólares y la liquidación en euros con el tipo oficial', () => {
    expect(d.envio.divisa).toBe('USD');
    expect(p.importeFactura).toBe(10000);
    expect(p.valorEstadistico).toBe(8901.55);
    expect(p.tributos[0].bases[0]).toEqual({ tipoImpositivo: 12, importe: 8901.55, cuota: 1068.19 });
    expect(p.tributos[1].bases[0]).toEqual({ tipoImpositivo: 21, importe: 9969.74, cuota: 2093.65 });
  });

  test('el código TARIC se parte en 6 + 2 + 2', () => {
    expect(p.codigo).toEqual({ sa6: '630210', nc2: '00', taric2: '00' });
  });

  test('la sumaria va como N337 con su MRN y los bultos y kilos de la partida', () => {
    expect(p.documentosPrevios).toEqual([{ tipo: 'N337', referencia: '26ES00280180000014', tipoBultos: 'CT', bultos: 90, unidad: 'KGMG', cantidad: 995, partida: 1 }]);
  });

  test('documento de transporte real, factura real y ubicación, sin valores inventados', () => {
    expect(d.envio.expedicion.documentosTransporte).toEqual([{ tipo: 'N705', referencia: 'MSCU20268198800' }]);
    expect(p.documentosJustificativos).toEqual([{ tipo: 'N380', referencia: 'FAC-2026-118' }]);
    expect(d.envio.expedicion.ubicacion).toEqual({ tipo: 'B', calificador: 'Y', autorizacion: 'ES002801AAAAAA' });
    expect(d.aduanaPresentacion).toBe('ES002801');
    expect(d.envio.expedicion.medioLlegada).toEqual({ tipo: '11', id: 'MSC AURORA' });
    expect(d.envio.expedicion.nacionalidadMedioActivo).toBe('PA');
    expect(d.envio.destino).toEqual({ pais: 'ES', region: '46' });
    expect(d.envio.entrega).toEqual({ incoterm: 'CIF', lugar: 'Valencia', pais: 'ES' });
  });

  test('el exportador sin identificador va con nombre y dirección', () => {
    expect(d.envio.exportador).toEqual({ nombre: 'Shenzhen Textiles Ltd', direccion: { calle: '1 Test Road', cp: null, ciudad: 'Shanghai', pais: 'CN' } });
  });

  siHayXmllint('el XML que sale de un expediente completo valida contra el XSD oficial', () => {
    expect(validar(datos())).toBeNull();
    expect(validar(datos(expediente({ representative: { representationType: 'direct' } })))).toBeNull();
    expect(validar(datos(expediente(), { tenant: { customsConfig: { medioDePago: 'R', garantiaGRN: '26ESAGL2800000054' } } }))).toBeNull();
  });
});

describe('H1 CAU: datos que faltan', () => {
  test('dice de una vez todo lo que hay que completar, sin inventar nada', () => {
    expect.assertions(4);
    const incompleto = expediente({
      transport: {}, declaration: { customsOffice: 'ES002801' },
      client: { nif: 'B12345674', address: {} }
    });
    try {
      expeditionToH1CauData(incompleto, { declarante: { eori: 'ESB22477020', contact: { name: 'Ana' } }, cambio: USD, mensajeId: 'X' });
    } catch (error) {
      expect(error.status).toBe(422);
      expect(error.code).toBe('DATOS_H1_FALTANTES');
      expect(error.faltan).toEqual(expect.arrayContaining([
        'teléfono de la persona de contacto del declarante', 'correo de la persona de contacto del declarante',
        'referencia local de la declaración (LRN)', 'provincia de destino (código postal del importador)', 'número de la factura comercial',
        'ubicación de las mercancías (recinto y almacén)', 'nacionalidad del medio de transporte en frontera',
        'documento de transporte (tipo y número)', 'MRN de la declaración sumaria'
      ]));
      expect(error.message).toContain('Faltan datos para presentar el H1');
    }
  });

  test('una factura en dólares sin tipo de cambio no se convierte a 1', () => {
    expect(() => expeditionToH1CauData(expediente(), { declarante: AGENTE, mensajeId: 'X' })).toThrow('USD');
  });
});

describe('H1 CAU: ayudantes', () => {
  test('los identificadores llevan prefijo de país', () => {
    expect(conPais('B12345674')).toBe('ESB12345674');
    expect(conPais('ESB12345674')).toBe('ESB12345674');
    expect(conPais('cn 000-000001')).toBe('CN000000001');
    expect(conPais('')).toBeNull();
  });

  test('sin aduana de despacho indicada toma la del recinto de la ubicación', () => {
    const exp = expediente({ declaration: { invoiceNumber: 'FAC-1', lrn: 'L1' } });
    expect(datos(exp).aduanaImportacion).toBe('ES002801');
  });

  test('aduana, ubicación y provincia', () => {
    expect(aduana('002801')).toBe('ES002801');
    expect(aduana('ES002801')).toBe('ES002801');
    expect(aduana('2801')).toBeNull();
    expect(ubicacionDe({ declaration: { goodsLocation: 'es002801aaaaac' } })).toBe('ES002801AAAAAC');
    expect(ubicacionDe({ transport: { summaryDeclaration: { aeat: { location: '2801AAAAAA' } } } })).toBe('ES002801AAAAAA');
    expect(ubicacionDe({})).toBeNull();
    expect(provinciaDe({ postalCode: '46001', country: 'ES' })).toBe('46');
    expect(provinciaDe({ postalCode: '1012', country: 'NL' })).toBeNull();
  });
});
