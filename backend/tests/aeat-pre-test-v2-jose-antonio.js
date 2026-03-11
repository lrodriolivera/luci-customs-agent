#!/usr/bin/env node
/**
 * Test V2 de los 6 builders contra AEAT PRE
 * Fecha: 2026-03-03
 * Con datos REALES proporcionados por Jose Antonio (DIT) el 3/Mar/2026:
 *   - Representante aduanero: ES89890010F (Juan Aduanero Aduanero)
 *   - Garantia importacion: 26ESAGL2800000054
 *   - Garantia transito: 26ES0002800000010
 *   - Auth transito expedicion: ESACR02026000002
 *   - Ubicaciones, sumarias con y sin contenedores
 *
 * Ejecutar: node tests/aeat-pre-test-v2-jose-antonio.js
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// ========== CONFIGURACION ==========
const CERT_PATH = path.resolve(__dirname, '../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const BASE_URL = 'https://prewww1.aeat.es';
const TIMEOUT = 30000;

// Datos de STRIX AI SL
const STRIX = {
  nif: 'B22477020',
  eori: 'ESB22477020',
  nombre: 'STRIX AI SL',
  direccion: 'Calle Ejemplo 1',
  poblacion: 'Zaragoza',
  cp: '50001',
  pais: 'ES',
  email: 'despacho@strixai.es'
};

// Datos de Jose Antonio (3/Mar/2026)
const JOSE_ANTONIO = {
  // Garantias
  garantiaImportacion: '26ESAGL2800000054',  // despacho a consumo
  garantiaTransito: '26ES0002800000010',
  // Autorizaciones transito
  authExpedicion: 'ESACR02026000002',
  authRecepcion: 'ESACE02026000008',
  // Ubicaciones
  ubicExpedicionVerde: '2801AAAAAC',
  ubicExpedicionNaranja: '4811CDF001',
  ubicExpedicionRojo: '4801ADT005',
  ubicRecepcionVerde: '2801AAAAAC',
  ubicRecepcionNaranja: '2911ADTPRU',
  ubicRecepcionRojo: '2901MLG005',
  ubicExport: '2801AAAAAC',
  // Sumarias disponibles
  sumarias: {
    // Todas las sumarias de Jose Antonio - diferentes formatos de MRN para probar
    s1: { mrn: '25ES00280180003993', partida: '1', ubic: '2801AAAAAC', label: 'MRN25-2801-000399' },
    s2: { mrn: '24ES00461180000175', partida: '1', ubic: '4611ADT031', label: 'MRN24-4611-000017' },
    s3: { mrn: '24ES00461180000183', partida: '1', ubic: '4611ADT031', label: 'MRN24-4611-000018' },
    s4: { mrn: '24ES00461180000191', partida: '1', ubic: '4611VLC001', label: 'MRN24-4611-000019' },
    s5: { mrn: '25ES00480180000027', partida: '1', ubic: '4801ADT002', label: 'MRN25-4801-000002' },
  }
};

// Aduanas reales (no 009999)
const ADUANA_IMPORT = '002801';  // Madrid - Barajas area
const ADUANA_EXPORT = '002801';

// ========== HELPERS ==========
let httpsAgent = null;

function loadCertificate() {
  if (!fs.existsSync(CERT_PATH)) {
    throw new Error('Certificado no encontrado: ' + CERT_PATH);
  }
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
  console.log('  Certificado cargado OK: Jenifer Romero / STRIX AI SL');
}

async function sendToAEAT(xml, endpoint, label) {
  const url = BASE_URL + endpoint;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  BUILDER: ${label}`);
  console.log(`  URL: ${url}`);
  console.log(`  XML size: ${xml.length} bytes`);
  console.log('='.repeat(70));

  try {
    const response = await axios.post(url, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });

    console.log(`  HTTP Status: ${response.status}`);
    console.log(`  Response size: ${(response.data || '').length} bytes`);

    const body = typeof response.data === 'string' ? response.data : '';
    const code = (body.match(/<CodigoRespuesta>(\d+)</) || [])[1];
    const mrn = (body.match(/<MRN>([^<]+)</) || body.match(/<NumeroReferenciaDUA>([^<]+)</) || body.match(/<DocNumHEA5>([^<]+)</) || [])[1];
    const error = (body.match(/<DescripcionError>([^<]+)</) || body.match(/<errorDescription>([^<]+)</) || [])[1];
    const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];
    const csv = (body.match(/<CSV>([^<]+)</) || body.match(/Código Seguro de Verificación ([A-Z0-9]+)/) || [])[1];
    const circuito = (body.match(/<Circuito>([^<]+)</) || body.match(/<circuito>([^<]+)</) || body.match(/<circuitoAEAT>([^<]+)</) || [])[1];
    const xmlError = (body.match(/<errorText>([^<]+)</) || [])[1];
    const ensError = (body.match(/<OriAttValER14>([^<]+)</) || [])[1];
    const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];
    const msgType = (body.match(/<MesTypMES20>([^<]+)</) || body.match(/<messageType>([^<]+)</) || [])[1];
    const valorErroneo = (body.match(/<ValorErroneo>([^<]+)</) || [])[1];
    const codError = (body.match(/<CodigoError>([^<]+)</) || [])[1];

    const success = code === '0' || code === '1' || code === '2' || code === 'OK'
      || msgType === 'CC328A'
      || msgType === 'CC528C'
      || msgType === 'CC028C'
      || tipoResp === 'OK';

    if (success) {
      console.log(`  RESULTADO: ✅ ACEPTADO`);
      if (mrn) console.log(`  MRN: ${mrn}`);
      if (csv) console.log(`  CSV: ${csv}`);
      if (circuito) console.log(`  Canal: ${circuito}`);
      if (msgType) console.log(`  Tipo respuesta: ${msgType}`);
    } else {
      console.log(`  RESULTADO: ❌ RECHAZADO`);
      console.log(`  Codigo: ${code || codError || tipoResp || 'N/A'}`);
      if (error) console.log(`  Error AEAT: ${error}`);
      if (codError) console.log(`  Codigo error: ${codError}`);
      if (valorErroneo) console.log(`  Valor erroneo: ${valorErroneo}`);
      if (xmlError) console.log(`  Error XML: ${xmlError.substring(0, 200)}`);
      if (ensError) console.log(`  Error ENS: ${ensError}`);
      if (fault) console.log(`  Fault: ${fault}`);
    }

    // Guardar respuesta
    const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
    const respFile = path.join(__dirname, `aeat-v2-response-${safeName}.xml`);
    fs.writeFileSync(respFile, body);
    console.log(`  Respuesta guardada: ${respFile}`);

    // Guardar request tambien
    const reqFile = path.join(__dirname, `aeat-v2-request-${safeName}.xml`);
    fs.writeFileSync(reqFile, xml);

    return { label, success, code: code || codError || tipoResp, mrn, csv, circuito, error: error || xmlError || ensError || fault, httpStatus: response.status, msgType, valorErroneo };
  } catch (err) {
    console.log(`  RESULTADO: ❌ ERROR DE CONEXION`);
    console.log(`  Error: ${err.message}`);
    return { label, success: false, error: err.message, httpStatus: 0 };
  }
}

function generateTransactionId() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0') +
    String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

// ========== BUILDERS ==========

function buildTestH1() {
  const { buildH1ImportXML } = require('../src/services/aeat/h1XmlBuilder');
  return buildH1ImportXML({
    test: true,
    tipoOperacion: 'DECL',
    aduanaDespacho: ADUANA_IMPORT,
    estatutoMercancias: 'IM',
    procedimiento: 'A',
    // Exportador (remitente extranjero)
    exportadorNIF: STRIX.eori,
    exportadorNombre: STRIX.nombre,
    exportadorDireccion: STRIX.direccion,
    exportadorPoblacion: STRIX.poblacion,
    exportadorCP: STRIX.cp,
    exportadorPais: STRIX.pais,
    // Importador (STRIX)
    importadorNIF: STRIX.eori,
    importadorNombre: STRIX.nombre,
    importadorDireccion: STRIX.direccion,
    importadorPoblacion: STRIX.poblacion,
    importadorCP: STRIX.cp,
    importadorPais: STRIX.pais,
    // Declarante (representacion directa)
    declaranteNIF: STRIX.eori,
    declaranteNombre: STRIX.nombre,
    formaRepresentacion: '1',
    tipoAutorizaDespacho: 'O',
    emailDespacho: STRIX.email,
    // Paises
    paisExpedicion: 'CN',
    paisDestino: 'ES',
    // Transporte
    modoTransporteFrontera: '3',
    identidadTransporteFrontera: 'ABC1234',
    paisTransporteFrontera: 'ES',
    provinciaDestino: '28',  // 28 = Madrid (aduana 2801)
    contenedores: '0',
    // Condiciones
    incoterm: 'CIF',
    incotermNombre: 'CIF',
    incotermZona: '1',
    // Divisa
    divisa: 'EUR',
    importeFactura: 120,
    naturalezaTransaccion: '11',
    // Localizacion - formato ES00RRRRN (RRRR=recinto, N=texto 1-6)
    localizacionMercancias: 'ES00' + JOSE_ANTONIO.ubicExpedicionVerde,
    // Garantia de Jose Antonio
    garantia: JOSE_ANTONIO.garantiaImportacion,
    // Tributos
    importeTotalTributos: 25.20,
    modalidadPago: 'A',
    // Referencia
    referenciaComercial: 'TEST-H1-V2-2026',
    // Partidas
    partidas: [{
      descripcion: 'Ropa de cama de algodon para uso domestico',
      taricCode: '6302100000',
      paisOrigen: 'CN',
      pesobruto: 150.000,
      pesoneto: 120.000,
      bultos: 2,
      tipoBulto: 'CT',
      marcas: 'TEST-IMPORT',
      documentos: [
        { tipo: 'N380', referencia: 'FACTURA-001' },
        { tipo: 'N730', referencia: 'CMR-001' },
        { tipo: 'N741', referencia: 'BL-001' },
      ],
      valorFactura: 120,
      valorEstadistico: 120,
      preferencia: '100',
      regimen: '40',
      regimenPrecedente: '00',
      codigoAdicional: 'F44',
      arancelTipo: 0,
      arancelImporte: 0,
      ivaTipo: 21,
      ivaImporte: 25.20,
      // Sin unidades suplementarias (6302 no las requiere)
    }]
  });
}

function buildTestH7() {
  const { buildH7ImportXML } = require('../src/services/aeat/h7XmlBuilder');
  return buildH7ImportXML({
    test: true,
    aduanaDespacho: ADUANA_IMPORT,
    // Remitente
    remitenteNIF: STRIX.eori,
    remitenteNombre: STRIX.nombre,
    remitentePais: STRIX.pais,
    // Destinatario/Importador
    destinatarioNIF: STRIX.eori,
    destinatarioNombre: STRIX.nombre,
    destinatarioDireccion: STRIX.direccion,
    destinatarioPoblacion: STRIX.poblacion,
    destinatarioCP: STRIX.cp,
    destinatarioPais: 'ES',
    // Declarante
    declaranteNIF: STRIX.eori,
    declaranteNombre: STRIX.nombre,
    formaRepresentacion: '1',
    emailDespacho: STRIX.email,
    // Garantia de Jose Antonio
    garantiaGRN: JOSE_ANTONIO.garantiaImportacion,
    // Ubicacion de Jose Antonio (formato ES00RRRRN)
    localizacionMercancias: 'ES00' + JOSE_ANTONIO.ubicExpedicionVerde,
    // Partidas
    partidas: [{
      descripcion: 'Cafe verde sin tostar ni descafeinar',
      taricCode: '0901110000',
      paisOrigen: 'CN',
      pesobruto: 0.200,
      pesoneto: 0.150,
      bultos: 1,
      tipoBulto: 'PK',
      marcas: 'S/M',
      valorFactura: 12.50,
      codigoAdicional: 'F44',
      documentos: [
        { tipo: 'N380', referencia: 'FACTURA-H7-001' },
        { tipo: 'N730', referencia: 'CMR-H7-001' },
      ]
    }]
  });
}

function buildTestAES() {
  const { buildAESExportXML } = require('../src/services/aeat/aesXmlBuilder');
  const transId = generateTransactionId();
  return buildAESExportXML({
    test: true,
    lrn: 'LRN-AES-' + transId.substring(0, 10),
    declarationType: 'EX',
    additionalDeclarationType: 'A',
    security: '2',
    invoiceCurrency: 'EUR',
    totalAmountInvoiced: 3000,
    customsOfficeExport: 'ES' + ADUANA_EXPORT,
    customsOfficeExit: 'ES' + ADUANA_EXPORT,
    // Exportador
    exporterEORI: STRIX.eori,
    // Declarante
    declarantEORI: STRIX.eori,
    declarantContactName: 'Jenifer Romero',
    declarantContactPhone: '+34976000000',
    declarantContactEmail: STRIX.email,
    // Consignatario
    consigneeName: 'US TECH IMPORTS LLC',
    consigneeStreet: '100 Main Street',
    consigneeCity: 'New York',
    consigneePostcode: '10001',
    consigneeCountry: 'US',
    // Envio
    countryOfExport: 'ES',
    destinationCountry: 'US',
    natureOfTransaction: '11',
    // DeliveryTerms
    incotermCode: 'DAP',
    incotermUNLocode: 'USNYC',
    directExport: true,
    provinciaExport: '28',  // Madrid
    // Transporte (export directa: sin inlandMode ni departureTransport)
    modeOfTransportAtBorder: '3',
    departureTransportType: '30',
    departureTransportId: 'ABC1234',
    departureTransportCountry: 'ES',
    activeBorderTransportType: '30',
    activeBorderTransportId: 'ABC1234',
    activeBorderTransportCountry: 'ES',
    // LocationOfGoods - ubicacion de Jose Antonio para export
    locationOfGoodsType: 'B',
    locationOfGoodsQualifier: 'Y',
    locationAuthorisationNumber: JOSE_ANTONIO.ubicExport,
    // Partidas
    goodsItems: [{
      description: 'Equipos informaticos para exportacion',
      taricCode: '84714100',
      grossWeight: 5.000,
      netWeight: 4.500,
      packages: 1,
      packageType: 'PK',
      value: 3000,
      statisticalValue: 3000,
      invoiceRef: 'INV-EXP-001',
      shippingMarks: 'STRIX-EXP-001',
      supplementaryUnits: 2,
      countryOfOrigin: 'ES'
    }]
  });
}

function buildTestNCTS() {
  const { buildNCTSTransitXML } = require('../src/services/aeat/nctsXmlBuilder');
  const transId = generateTransactionId();
  return buildNCTSTransitXML({
    test: true,
    lrn: 'LRN-NCTS-' + transId.substring(0, 10),
    transitType: 'T1',
    securityIndicator: '0',
    officeOfDeparture: 'ES' + ADUANA_IMPORT,
    officeOfDestination: 'ES' + ADUANA_IMPORT,
    transitOffices: [],
    // Titular
    holderEORI: STRIX.eori,
    holderContactName: 'Jenifer Romero',
    holderContactPhone: '+34976000000',
    holderContactEmail: STRIX.email,
    holderCountry: 'ES',
    holderCity: 'Zaragoza',
    // Declarante
    declarantEORI: STRIX.eori,
    // Garantia real de Jose Antonio (tipo 1 = garantia comprensiva con GRN)
    guaranteeType: '1',
    guaranteeGRN: JOSE_ANTONIO.garantiaTransito,
    guaranteeAccessCode: '0000',
    guaranteeAmount: 5000,
    // Autorizacion C521 para ubicacion privada
    authorisationNumber: JOSE_ANTONIO.authExpedicion,
    // Paises
    countryOfDispatch: 'ES',
    countryOfDestination: 'ES',
    // Lugar de carga
    placeOfLoadingCountry: 'ES',
    placeOfLoadingLocation: 'Madrid',
    // LocationOfGoods
    locationOfGoodsType: 'B',
    locationOfGoodsQualifier: 'Y',
    locationAuthorisationNumber: JOSE_ANTONIO.ubicExpedicionVerde,
    // Consignatario
    consigneeEORI: STRIX.eori,
    // Envio
    consignment: {
      transportMode: '3',
      containerIndicator: '0',
      consigneeEORI: STRIX.eori,
      referenceNumberUCR: 'UCR-NCTS-' + transId.substring(0, 8),
      goodsItems: [{
        description: 'Equipos informaticos en transito',
        taricCode: '84713000',
        grossWeight: 500.000,
        netWeight: 450.000,
        packages: 10,
        packageType: 'PK',
        shippingMarks: 'STRIX-TR-001',
        countryOfDispatch: 'ES',
        countryOfDestination: 'ES',
        consigneeEORI: STRIX.eori,
        // Referencia a sumaria previa (Jose Antonio)
        previousDocumentType: 'NMRN',
        // DUA + MRN 18 chars = 21 chars total
        previousDocumentRef: 'DUA' + JOSE_ANTONIO.sumarias.s1.mrn,
        previousDocumentItem: '1'
      }]
    }
  });
}

function buildTestENS() {
  const { buildENSDeclarationXML } = require('../src/services/aeat/ensXmlBuilder');
  const transId = generateTransactionId();
  return buildENSDeclarationXML({
    test: true,
    lrn: 'LRN-ENS-' + transId.substring(0, 10),
    carrierEORI: STRIX.eori,
    carrierName: '',
    entryOffice: 'ES009999',  // Mantener 009999 para ENS (ya funciona)
    transportMode: '2',  // Ferrocarril (unico modo legacy)
    transportId: 'TRAIN-ES-002',
    transportCountry: 'ES',
    consignment: { containerNumber: '' },
    houseConsignments: [{
      grossMass: 150.000,
      numberOfPackages: 2,
      placeOfLoading: 'CNSZX',
      placeOfUnloading: 'ESZAZ',
      consignor: {
        name: 'SHENZHEN ELECTRONICS CO LTD',
        street: '123 Technology Road',
        city: 'Shenzhen',
        postcode: '518000',
        country: 'CN'
      },
      consignee: {
        name: STRIX.nombre,
        street: STRIX.direccion,
        city: STRIX.poblacion,
        postcode: STRIX.cp,
        country: 'ES'
      },
      goodsDescription: 'Servidores rack para procesamiento de datos',
      commodityCode: '847130',
      marksOfPackages: 'STRIX-SERVER-002'
    }]
  });
}

function buildTestPUE() {
  const { buildSOIVREAltaXML } = require('../src/services/aeat/soivreXmlBuilder');
  return buildSOIVREAltaXML({
    test: true,
    tipoOperacion: 'ALT',
    especificidades: ['06'],
    tipoDocumento: 'DUA',
    mrnPartida: '26ES009999Z000001300001',
    unidadMercancia: 'unidades fisicas',
    cantidadMercancia: 2,
    codCice: '50',
    codPi: '01',
    email: STRIX.email,
    tipoDeclaracion: '01',
    certificadoROHS: '01',
    certificadoRAEE: '02',
  });
}

// ========== MAIN ==========
async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('  TEST V2 AEAT PRE - CON DATOS DE JOSE ANTONIO');
  console.log('  Fecha: ' + new Date().toISOString());
  console.log('  EORI: ' + STRIX.eori);
  console.log('  Empresa: ' + STRIX.nombre);
  console.log('  Aduana import/export: ' + ADUANA_IMPORT);
  console.log('  Garantia import: ' + JOSE_ANTONIO.garantiaImportacion);
  console.log('  Garantia transito: ' + JOSE_ANTONIO.garantiaTransito);
  console.log('  Servidor: ' + BASE_URL);
  console.log('█'.repeat(70));

  console.log('\n[1/7] Cargando certificado FNMT...');
  loadCertificate();

  const tests = [
    { name: 'H1 - Importacion Completa', builder: buildTestH1, endpoint: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP' },
    { name: 'H7 - Importacion Simplificada', builder: buildTestH7, endpoint: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP' },
    { name: 'AES - Exportacion', builder: buildTestAES, endpoint: '/wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP' },
    { name: 'NCTS - Transito', builder: buildTestNCTS, endpoint: '/wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP' },
    { name: 'ENS - Declaracion Sumaria', builder: buildTestENS, endpoint: '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP' },
    { name: 'PUE - ROHS', builder: buildTestPUE, endpoint: '/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP' },
  ];

  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    console.log(`\n[${i + 2}/7] Generando XML: ${t.name}...`);

    let xml;
    try {
      xml = t.builder();
    } catch (err) {
      console.log(`  ❌ Error generando XML: ${err.message}`);
      results.push({ label: t.name, success: false, error: 'Build error: ' + err.message });
      continue;
    }

    const safeName = t.name.replace(/[^a-zA-Z0-9]/g, '_');
    const xmlFile = path.join(__dirname, `aeat-v2-request-${safeName}.xml`);
    fs.writeFileSync(xmlFile, xml);
    console.log(`  XML guardado: ${xmlFile}`);

    const result = await sendToAEAT(xml, t.endpoint, t.name);
    results.push(result);

    if (i < tests.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // RESUMEN
  console.log('\n\n' + '█'.repeat(70));
  console.log('  RESUMEN FINAL - TEST V2 AEAT PRE (DATOS JOSE ANTONIO)');
  console.log('█'.repeat(70));
  console.log('');

  const accepted = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const detail = r.success
      ? `MRN=${r.mrn || 'N/A'} Canal=${r.circuito || 'N/A'}`
      : `Error: ${(r.error || 'Desconocido').substring(0, 100)}`;
    console.log(`  ${icon} ${r.label.padEnd(35)} ${detail}`);
  });

  console.log('');
  console.log(`  Total: ${results.length} | Aceptados: ${accepted.length} | Rechazados: ${rejected.length}`);
  console.log('');
  console.log('█'.repeat(70));
  console.log('  FIN TEST V2 - ' + new Date().toISOString());
  console.log('█'.repeat(70) + '\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
