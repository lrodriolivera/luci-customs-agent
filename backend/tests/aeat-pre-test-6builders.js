#!/usr/bin/env node
/**
 * Test de los 6 builders core contra AEAT PRE
 * Fecha: 2026-02-13
 * EORI ESB22477020 dado de alta en PRE por Jose Antonio (DIT)
 *
 * Ejecutar: node tests/aeat-pre-test-6builders.js
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

// Datos de STRIX AI SL para testing
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

// Aduana de pruebas
const ADUANA_TEST = '009999';  // Recinto Peninsula pruebas

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

    // Parse response
    const body = typeof response.data === 'string' ? response.data : '';
    const code = (body.match(/<CodigoRespuesta>(\d+)</) || [])[1];
    const mrn = (body.match(/<MRN>([^<]+)</) || body.match(/<NumeroReferenciaDUA>([^<]+)</) || body.match(/<DocNumHEA5>([^<]+)</) || [])[1];
    const error = (body.match(/<DescripcionError>([^<]+)</) || body.match(/<errorDescription>([^<]+)</) || [])[1];
    const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];
    const csv = (body.match(/<CSV>([^<]+)</) || body.match(/Código Seguro de Verificación ([A-Z0-9]+)/) || [])[1];
    const circuito = (body.match(/<Circuito>([^<]+)</) || body.match(/<circuito>([^<]+)</) || [])[1];
    const xmlError = (body.match(/<errorText>([^<]+)</) || [])[1];
    const ensError = (body.match(/<OriAttValER14>([^<]+)</) || [])[1];
    const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];
    const msgType = (body.match(/<MesTypMES20>([^<]+)</) || body.match(/<messageType>([^<]+)</) || [])[1];

    // Resultados - H1/H7 usan CodigoRespuesta, AES/NCTS/ENS usan tipoRespuesta o messageType
    const success = code === '0' || code === '1' || code === '2'
      || msgType === 'CC328A'   // ENS aceptada
      || msgType === 'CC528C'   // AES aceptada
      || msgType === 'CC028C';  // NCTS aceptada

    if (success) {
      console.log(`  RESULTADO: ✅ ACEPTADO`);
      if (mrn) console.log(`  MRN: ${mrn}`);
      if (csv) console.log(`  CSV: ${csv}`);
      if (circuito) console.log(`  Canal: ${circuito}`);
      if (msgType) console.log(`  Tipo respuesta: ${msgType}`);
    } else {
      console.log(`  RESULTADO: ❌ RECHAZADO`);
      console.log(`  Codigo: ${code || tipoResp || 'N/A'}`);
      if (error) console.log(`  Error AEAT: ${error}`);
      if (xmlError) console.log(`  Error XML: ${xmlError.substring(0, 120)}`);
      if (ensError) console.log(`  Error ENS: ${ensError}`);
      if (fault) console.log(`  Fault: ${fault}`);
    }

    // Guardar respuesta completa en archivo
    const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
    const respFile = path.join(__dirname, `aeat-pre-response-${safeName}.xml`);
    fs.writeFileSync(respFile, body);
    console.log(`  Respuesta guardada: ${respFile}`);

    return { label, success, code: code || tipoResp, mrn, csv, circuito, error: error || xmlError || ensError || fault, httpStatus: response.status, msgType };
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
    aduanaDespacho: ADUANA_TEST,
    estatutoMercancias: 'IM',
    procedimiento: 'A',
    // Exportador: STRIX como autoexportador para test en PRE
    // (en PRE solo existe ESB22477020, exportadores extranjeros no estan dados de alta)
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
    // Declarante (STRIX es el mismo importador → representacion directa)
    declaranteNIF: STRIX.eori,
    declaranteNombre: STRIX.nombre,
    formaRepresentacion: '1',  // 1=directa (declarante=importador), 2=indirecta
    tipoAutorizaDespacho: 'G',
    emailDespacho: STRIX.email,
    // Paises
    paisExpedicion: 'CN',
    paisDestino: 'ES',
    // Transporte
    modoTransporteFrontera: '3',  // Carretera (mas simple para test)
    identidadTransporteFrontera: 'ABC1234',
    paisTransporteFrontera: 'ES',
    provinciaDestino: '50',  // 50 = Zaragoza
    contenedores: '0',
    // Condiciones - zona debe ser vacia o un codigo valido AEAT
    incoterm: 'CIF',
    incotermNombre: 'CIF',
    incotermZona: '1',  // codigo zona AEAT (1=Peninsula)
    // Divisa
    divisa: 'EUR',
    importeFactura: 5000,
    naturalezaTransaccion: '11',
    // Localizacion - formato ES00RRRRN (RRRR=recinto, N=texto 1-6)
    localizacionMercancias: 'ES00' + ADUANA_TEST.substring(2, 6) + 'T1',
    // Tributos
    importeTotalTributos: 1200,
    modalidadPago: 'A',
    // Referencia
    referenciaComercial: 'TEST-H1-STRIX-2026',
    // Partidas
    partidas: [{
      descripcion: 'Servidores rack para procesamiento de datos',
      taricCode: '8471300000',
      paisOrigen: 'CN',
      pesobruto: 150.000,
      pesoneto: 120.000,
      bultos: 2,
      tipoBulto: 'CT',
      marcas: 'DELL',
      valorFactura: 5000,
      valorEstadistico: 5000,
      preferencia: '100',
      regimen: '40',
      regimenPrecedente: '00',
      codigoAdicional: '000',
      arancelTipo: 0,
      arancelImporte: 0,
      ivaTipo: 21,
      ivaImporte: 1050
    }]
  });
}

function buildTestH7() {
  const { buildH7ImportXML } = require('../src/services/aeat/h7XmlBuilder');
  return buildH7ImportXML({
    test: true,
    aduanaDespacho: ADUANA_TEST,
    // Remitente: STRIX como remitente para PRE (solo STRIX esta dado de alta)
    remitenteNIF: STRIX.eori,
    remitenteNombre: STRIX.nombre,
    remitentePais: STRIX.pais,
    // Destinatario/Importador: STRIX (unico EORI valido en PRE)
    destinatarioNIF: STRIX.eori,
    destinatarioNombre: STRIX.nombre,
    destinatarioDireccion: STRIX.direccion,
    destinatarioPoblacion: STRIX.poblacion,
    destinatarioCP: STRIX.cp,
    destinatarioPais: 'ES',
    // Declarante - EORI format, representacion directa (declarante=importador)
    declaranteNIF: STRIX.eori,
    declaranteNombre: STRIX.nombre,
    formaRepresentacion: '1',
    emailDespacho: STRIX.email,
    // Partidas (bajo valor < 150 EUR)
    partidas: [{
      descripcion: 'Funda protectora para telefono movil',
      taricCode: '3926909790',
      paisOrigen: 'CN',
      pesobruto: 0.200,
      pesoneto: 0.150,
      bultos: 1,
      tipoBulto: 'PK',
      valorFactura: 12.50
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
    security: '2',  // 2 = obligatorio para destino fuera UE con additionalDeclarationType A
    invoiceCurrency: 'EUR',
    totalAmountInvoiced: 3000,
    customsOfficeExport: 'ES' + ADUANA_TEST,
    customsOfficeExit: 'ES' + ADUANA_TEST,
    // Exportador (STRIX)
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
    // DeliveryTerms - opcion 1: UNLocode (R) + location (O) + country (O)
    incotermCode: 'DAP',
    incotermUNLocode: 'USNYC',  // UN/LOCODE New York
    // Transporte
    modeOfTransportAtBorder: '3',
    inlandModeOfTransport: '3',
    // Transport means
    departureTransportType: '30',  // 30 = matricula vehiculo carretera
    departureTransportId: 'ABC1234',
    departureTransportCountry: 'ES',
    activeBorderTransportType: '30',
    activeBorderTransportId: 'ABC1234',
    activeBorderTransportCountry: 'ES',
    // LocationOfGoods - qualifier Y = authorisationNumber
    locationOfGoodsType: 'B',
    locationOfGoodsQualifier: 'Y',
    locationAuthorisationNumber: 'ES' + ADUANA_TEST,
    // Partidas - 84714100 = computadoras (tiene supplementaryUnits p/st)
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
    officeOfDeparture: 'ES' + ADUANA_TEST,
    officeOfDestination: 'ES' + ADUANA_TEST,
    transitOffices: [],
    // Titular (STRIX)
    holderEORI: STRIX.eori,
    holderContactName: 'Jenifer Romero',
    holderContactPhone: '+34976000000',
    holderContactEmail: STRIX.email,
    holderCountry: 'ES',
    holderCity: 'Zaragoza',
    // Declarante
    declarantEORI: STRIX.eori,
    // Garantia - tipo 8 requiere 1 GuaranteeReference con amountToBeCovered
    guaranteeType: '8',
    guaranteeGRN: '',
    guaranteeAccessCode: '',
    guaranteeAmount: 5000,
    // Paises
    countryOfDispatch: 'ES',
    countryOfDestination: 'ES',
    // Lugar de carga
    placeOfLoadingCountry: 'ES',
    placeOfLoadingLocation: 'Zaragoza',
    // Consignatario
    consigneeEORI: STRIX.eori,
    // Envio
    consignment: {
      transportMode: '3',
      consigneeEORI: STRIX.eori,
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
        consigneeEORI: STRIX.eori
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
    // Carrier
    carrierEORI: STRIX.eori,
    carrierName: '',  // Si tiene EORI, no poner nombre (regla C501)
    // Oficina entrada
    entryOffice: 'ES' + ADUANA_TEST,
    // Transporte: FERROCARRIL (2) - unico modo soportado en legacy ENS
    // Aereo (4), maritimo (1) y carretera (3) requieren ICS2
    transportMode: '2',
    transportId: 'TRAIN-ES-001',
    transportCountry: 'ES',
    // Consignment
    consignment: {
      containerNumber: ''
    },
    // House consignments
    houseConsignments: [{
      grossMass: 150.000,
      numberOfPackages: 2,
      // Lugar de carga y descarga (requeridos)
      placeOfLoading: 'CNSZX',  // Shenzhen airport code
      placeOfUnloading: 'ESZAZ',  // Zaragoza airport code
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
      // Marca de bultos
      marksOfPackages: 'STRIX-SERVER-001'
    }]
  });
}

function buildTestPUE() {
  const { buildSOIVREAltaXML } = require('../src/services/aeat/soivreXmlBuilder');
  return buildSOIVREAltaXML({
    test: true,
    tipoOperacion: 'ALT',
    especificidades: ['06'],  // 06 = Producto ROHS standard
    tipoDocumento: 'DUA',
    // MRN de prueba: 23 chars = MRN(18) + partida(4) + claveZeta(1)
    mrnPartida: '26ES009999Z000001300001',
    unidadMercancia: 'unidades fisicas',
    cantidadMercancia: 2,
    codCice: '50',  // 50 = Zaragoza
    codPi: '01',    // 01 = primer punto inspeccion
    email: STRIX.email,
    tipoDeclaracion: '01',  // 01 = Expediente nuevo
    certificadoROHS: '01',  // 01 = Declaracion normal
    certificadoRAEE: '02',  // 02 = No aplica
  });
}

// ========== MAIN ==========
async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('  TEST AEAT PRE - 6 BUILDERS CORE');
  console.log('  Fecha: ' + new Date().toISOString());
  console.log('  EORI: ' + STRIX.eori + ' (dado de alta en PRE 13/Feb/2026)');
  console.log('  Empresa: ' + STRIX.nombre);
  console.log('  Aduana test: ' + ADUANA_TEST);
  console.log('  Servidor: ' + BASE_URL);
  console.log('█'.repeat(70));

  // Cargar certificado
  console.log('\n[1/7] Cargando certificado FNMT...');
  loadCertificate();

  // Endpoints para cada builder
  const tests = [
    {
      name: 'H1 - Importacion Completa',
      builder: buildTestH1,
      endpoint: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP'
    },
    {
      name: 'H7 - Importacion Simplificada',
      builder: buildTestH7,
      endpoint: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP'
    },
    {
      name: 'AES - Exportacion',
      builder: buildTestAES,
      endpoint: '/wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP'
    },
    {
      name: 'NCTS - Transito',
      builder: buildTestNCTS,
      endpoint: '/wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP'
    },
    {
      name: 'ENS - Declaracion Sumaria',
      builder: buildTestENS,
      endpoint: '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP'
    },
    {
      name: 'PUE - ROHS',
      builder: buildTestPUE,
      endpoint: '/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP'
    }
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

    // Guardar XML enviado para debugging
    const safeName = t.name.replace(/[^a-zA-Z0-9]/g, '_');
    const xmlFile = path.join(__dirname, `aeat-pre-request-${safeName}.xml`);
    fs.writeFileSync(xmlFile, xml);
    console.log(`  XML guardado: ${xmlFile}`);

    const result = await sendToAEAT(xml, t.endpoint, t.name);
    results.push(result);

    // Esperar 1 segundo entre peticiones para no saturar
    if (i < tests.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ========== RESUMEN FINAL ==========
  console.log('\n\n' + '█'.repeat(70));
  console.log('  RESUMEN FINAL - TEST AEAT PRE');
  console.log('█'.repeat(70));
  console.log('');

  const accepted = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const detail = r.success
      ? `MRN=${r.mrn || 'N/A'} Canal=${r.circuito || 'N/A'}`
      : `Error: ${(r.error || 'Desconocido').substring(0, 80)}`;
    console.log(`  ${icon} ${r.label.padEnd(35)} ${detail}`);
  });

  console.log('');
  console.log(`  Total: ${results.length} | Aceptados: ${accepted.length} | Rechazados: ${rejected.length}`);
  console.log('');

  if (rejected.length > 0) {
    console.log('  NOTA: Los rechazos pueden ser por datos incompletos en PRE.');
    console.log('  Jose Antonio (DIT) indico que falta configurar: autorizaciones,');
    console.log('  garantias, sumarias y ubicaciones en el entorno de pruebas.');
  }

  console.log('\n' + '█'.repeat(70));
  console.log('  FIN TEST - ' + new Date().toISOString());
  console.log('█'.repeat(70) + '\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
