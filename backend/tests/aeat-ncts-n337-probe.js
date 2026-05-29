#!/usr/bin/env node
/**
 * Probe NCTS con correccion de Jose Antonio (24/Abr/2026):
 * PreviousDocument de una SUMARIA DE DESCARGA debe usar:
 *   - type: N337 (no NMRN)
 *   - referenceNumber: MRN directo, sin prefijo "DUA"
 *   - goodsItemNumber: si
 *   - SIN measurementUnitAndQualifier ni quantity
 *
 * Ejecutar: node tests/aeat-ncts-n337-probe.js
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_PATH = path.resolve(__dirname, '../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const BASE_URL = 'https://prewww1.aeat.es';
const ENDPOINT = '/wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP';
const TIMEOUT = 30000;

const { buildNCTSTransitXML } = require('../src/services/aeat/nctsXmlBuilder');

const STRIX = {
  eori: 'ESB22477020',
  email: 'despacho@strixai.es'
};
const ADUANA = '002801';
const SUMARIA_MRN = '25ES00280180003993';

let httpsAgent = null;

function loadCertificate() {
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
  console.log('  Certificado cargado OK: Jenifer Romero / STRIX AI SL\n');
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

async function main() {
  console.log('========================================================================');
  console.log('  PROBE NCTS con correccion N337 (Jose Antonio 24/Abr/2026)');
  console.log('  Endpoint:', BASE_URL + ENDPOINT);
  console.log('========================================================================\n');

  loadCertificate();

  const transId = generateTransactionId();
  const xml = buildNCTSTransitXML({
    test: true,
    lrn: 'LRN-N337-' + transId.substring(0, 10),
    transitType: 'T1',
    securityIndicator: '0',
    officeOfDeparture: 'ES' + ADUANA,
    officeOfDestination: 'ES' + ADUANA,
    transitOffices: [],
    holderEORI: STRIX.eori,
    holderContactName: 'Jenifer Romero',
    holderContactPhone: '+34976000000',
    holderContactEmail: STRIX.email,
    holderCountry: 'ES',
    holderCity: 'Zaragoza',
    declarantEORI: STRIX.eori,
    guaranteeType: '1',
    guaranteeGRN: '26ES0002800000010',
    guaranteeAccessCode: '0000',
    guaranteeAmount: 5000,
    authorisationNumber: 'ESACR02026000002',
    countryOfDispatch: 'ES',
    countryOfDestination: 'ES',
    placeOfLoadingCountry: 'ES',
    placeOfLoadingLocation: 'Madrid',
    locationOfGoodsType: 'B',
    locationOfGoodsQualifier: 'Y',
    locationAuthorisationNumber: '2801AAAAAC',
    consigneeEORI: STRIX.eori,
    consignment: {
      transportMode: '3',
      containerIndicator: '0',
      consigneeEORI: STRIX.eori,
      referenceNumberUCR: 'UCR-N337-' + transId.substring(0, 8),
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
        // CORRECCION Jose Antonio: N337 + MRN directo (sin prefijo DUA)
        previousDocumentType: 'N337',
        previousDocumentRef: SUMARIA_MRN,
        previousDocumentItem: '1'
      }]
    }
  });

  // Verificar que el XML generado contiene los cambios
  const hasN337 = xml.includes('<ent:type>N337</ent:type>');
  const hasDUAPrefix = xml.includes('DUA' + SUMARIA_MRN);
  const hasKGM = xml.includes('<ent:measurementUnitAndQualifier>KGM</ent:measurementUnitAndQualifier>');
  const hasQuantity = xml.includes('<ent:quantity>');
  console.log('  Validacion del XML generado:');
  console.log(`    type=N337:                ${hasN337 ? '✅' : '❌'}`);
  console.log(`    referenceNumber sin DUA:  ${!hasDUAPrefix ? '✅' : '❌'}`);
  console.log(`    SIN measurementUnit/KGM:  ${!hasKGM ? '✅' : '❌'}`);
  console.log(`    SIN quantity:             ${!hasQuantity ? '✅' : '❌'}\n`);

  if (!hasN337 || hasDUAPrefix || hasKGM || hasQuantity) {
    console.log('  ⚠️  El XML no se construyo con el formato N337 correcto. Revisar builder.');
    const xmlFile = path.join(__dirname, 'ncts-n337-request.xml');
    fs.writeFileSync(xmlFile, xml);
    console.log(`  XML guardado en ${xmlFile} para inspeccion.`);
  }

  // Enviar a AEAT
  console.log('  Enviando CC015C a AEAT PRE...\n');
  try {
    const response = await axios.post(BASE_URL + ENDPOINT, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });
    const body = typeof response.data === 'string' ? response.data : '';
    console.log(`  HTTP: ${response.status} | size: ${body.length} bytes\n`);

    const reqFile = path.join(__dirname, 'ncts-n337-request.xml');
    const respFile = path.join(__dirname, 'ncts-n337-response.xml');
    fs.writeFileSync(reqFile, xml);
    fs.writeFileSync(respFile, body);

    const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];
    const msgType = (body.match(/<messageType>([^<]+)</) || [])[1];
    const mrn = (body.match(/<MRN>([^<]+)</) || [])[1];
    const errorDesc = (body.match(/<errorDescription>([^<]+)</) || [])[1];
    const errorPointer = (body.match(/<errorPointer>([^<]+)</) || [])[1];
    const errorCode = (body.match(/<errorCode>([^<]+)</) || [])[1];
    const originalValue = (body.match(/<originalAttributeValue>([^<]+)</) || [])[1];

    console.log('========================================================================');
    console.log('  RESULTADO');
    console.log('========================================================================');
    if (msgType === 'CC028C' || mrn) {
      console.log('  🟢 ACEPTADO POR AEAT');
      console.log(`     messageType: ${msgType}`);
      if (mrn) console.log(`     MRN: ${mrn}`);
      console.log(`     tipoRespuesta: ${tipoResp || '-'}`);
      console.log('\n  NCTS DESBLOQUEADO. 5/6 builders aceptados (faltaria solo PUE/SOIVRE).');
    } else if (errorDesc) {
      console.log('  🔴 RECHAZADO');
      console.log(`     tipoRespuesta: ${tipoResp}`);
      console.log(`     errorCode: ${errorCode}`);
      console.log(`     errorPointer: ${errorPointer}`);
      console.log(`     errorDescription: ${errorDesc}`);
      console.log(`     originalAttributeValue: ${originalValue || '-'}`);
    } else {
      console.log('  ❓ Respuesta no interpretada. Revisar:', respFile);
      console.log(`     preview: ${body.substring(0, 400)}`);
    }
    console.log('');
    console.log(`  Request:  ${reqFile}`);
    console.log(`  Response: ${respFile}`);
  } catch (err) {
    console.error('  ERROR de conexion:', err.message);
  }
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
