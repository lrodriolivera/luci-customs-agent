#!/usr/bin/env node
/**
 * Test NCTS SIN PreviousDocument
 * Intenta con ubicacion publica que no requiera datado de sumarias
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

const STRIX = {
  nif: 'B22477020', eori: 'ESB22477020', nombre: 'STRIX AI SL',
  direccion: 'Calle Ejemplo 1', poblacion: 'Zaragoza', cp: '50001',
  pais: 'ES', email: 'despacho@strixai.es'
};

let httpsAgent = null;

function loadCert() {
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
}

async function testNCTS(label, locationAuth, withPrevDoc) {
  const { buildNCTSTransitXML } = require('../src/services/aeat/nctsXmlBuilder');
  const transId = Date.now().toString() + Math.random().toString(36).substring(2, 8);

  const goodsItem = {
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
  };

  if (withPrevDoc) {
    goodsItem.previousDocumentType = 'NMRN';
    goodsItem.previousDocumentRef = withPrevDoc;
    goodsItem.previousDocumentItem = '1';
  }

  const xml = buildNCTSTransitXML({
    test: true,
    lrn: 'LRN-NCTS-' + transId.substring(0, 10),
    transitType: 'T1',
    securityIndicator: '0',
    officeOfDeparture: 'ES002801',
    officeOfDestination: 'ES002801',
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
    locationAuthorisationNumber: locationAuth,
    consigneeEORI: STRIX.eori,
    consignment: {
      transportMode: '3',
      containerIndicator: '0',
      consigneeEORI: STRIX.eori,
      referenceNumberUCR: 'UCR-NCTS-' + transId.substring(0, 8),
      goodsItems: [goodsItem]
    }
  });

  console.log(`\n  Test: ${label}`);
  console.log(`    Location: ${locationAuth}, PrevDoc: ${withPrevDoc || 'NONE'}`);

  try {
    const response = await axios.post(BASE_URL + ENDPOINT, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
      validateStatus: () => true
    });

    const body = response.data || '';
    const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];
    const msgType = (body.match(/<messageType>([^<]+)</) || [])[1];
    const mrn = (body.match(/<MRN>([^<]+)</) || [])[1];
    const errors = [];
    const errorRegex = /<errorDescription>([^<]+)</g;
    let m;
    while ((m = errorRegex.exec(body)) !== null) errors.push(m[1]);

    const success = msgType === 'CC028C' || tipoResp === 'OK';

    if (success) {
      console.log(`    ✅ ACEPTADO! MRN: ${mrn}`);

      // Save successful XML
      fs.writeFileSync(path.join(__dirname, 'aeat-ncts-SUCCESS.xml'), xml);
      fs.writeFileSync(path.join(__dirname, 'aeat-ncts-SUCCESS-response.xml'), body);
    } else {
      errors.forEach(e => console.log(`    ❌ ${e}`));
    }
    return { label, success, mrn, errors };
  } catch (err) {
    console.log(`    ❌ ${err.message}`);
    return { label, success: false, errors: [err.message] };
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  NCTS TEST - Sin PreviousDocument y variantes');
  console.log('═'.repeat(60));

  loadCert();

  // Test 1: Sin PreviousDocument, ubicacion verde
  await testNCTS('Sin PrevDoc, ubic verde', '2801AAAAAC', null);
  await new Promise(r => setTimeout(r, 1500));

  // Test 2: Sin PrevDoc, ubicacion naranja
  await testNCTS('Sin PrevDoc, ubic naranja', '4811CDF001', null);
  await new Promise(r => setTimeout(r, 1500));

  // Test 3: Con oficina como ubicacion
  await testNCTS('Sin PrevDoc, oficina', 'ES002801', null);
  await new Promise(r => setTimeout(r, 1500));

  // Test 4: Con sumaria s1 partida formato string
  await testNCTS('Con PrevDoc s1', '2801AAAAAC', 'DUA25ES00280180003993');
  await new Promise(r => setTimeout(r, 1500));

  // Test 5: Tipo T2 (intra-EU, no necesita sumaria normalmente)
  console.log('\n  (Nota: los siguientes tests NO cambian T2, solo varian PrevDoc)');

  console.log('\n' + '═'.repeat(60));
  console.log('  FIN TESTS');
  console.log('═'.repeat(60));
}

main().catch(console.error);
