#!/usr/bin/env node
/**
 * Test NCTS con TODAS las sumarias de Jose Antonio
 * Prueba cada MRN para encontrar cual funciona
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

// Todas las sumarias de Jose Antonio en diferentes formatos de MRN
const SUMARIAS = [
  // Formato: YY+CC+OFFICE(6)+CHECK(1)+SEQ(6)+CHECK(1) = 18 chars
  { label: '2801-5-000399 (format A)', mrn: '25ES00280180003993', partida: '1' },
  { label: '2801-5-000399 (format B)', mrn: '25ES002801800039​93', partida: '1' },
  { label: '4611-4-000017', mrn: '24ES00461180000175', partida: '1' },
  { label: '4611-4-000018', mrn: '24ES00461180000183', partida: '1' },
  { label: '4611-4-000019', mrn: '24ES00461180000191', partida: '1' },
  { label: '4801-5-000002', mrn: '25ES00480180000027', partida: '1' },
  // Probar con clave antigua como referencia
  { label: '2801-5-000399 (clave)', mrn: '25ES00280150003993', partida: '1' },
  // Sin check digit final
  { label: '2801-5-000399 (no-check)', mrn: '25ES002801800039​9', partida: '1' },
];

let httpsAgent = null;

function loadCert() {
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
}

function buildNCTS(sumariaRef, partidaNum) {
  const { buildNCTSTransitXML } = require('../src/services/aeat/nctsXmlBuilder');
  const transId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
  return buildNCTSTransitXML({
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
    locationAuthorisationNumber: '2801AAAAAC',
    consigneeEORI: STRIX.eori,
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
        previousDocumentType: 'NMRN',
        previousDocumentRef: sumariaRef,
        previousDocumentItem: partidaNum,
      }]
    }
  });
}

async function testSumaria(sumaria) {
  const ref = 'DUA' + sumaria.mrn;
  console.log(`\n  Testing: ${sumaria.label}`);
  console.log(`    Ref: ${ref} (${ref.length} chars) + partida ${sumaria.partida}`);

  if (ref.length !== 21) {
    console.log(`    ⚠ SKIP - ref length ${ref.length} != 21`);
    return { label: sumaria.label, skip: true, error: `length ${ref.length}` };
  }

  try {
    const xml = buildNCTS(ref, sumaria.partida);
    const response = await axios.post(BASE_URL + ENDPOINT, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
      validateStatus: () => true
    });

    const body = response.data || '';
    const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];
    const msgType = (body.match(/<messageType>([^<]+)</) || [])[1];
    const error = (body.match(/<errorDescription>([^<]+)</) || [])[1];
    const mrn = (body.match(/<MRN>([^<]+)</) || body.match(/<DocNumHEA5>([^<]+)</) || [])[1];

    const success = msgType === 'CC028C' || tipoResp === 'OK';

    if (success) {
      console.log(`    ✅ ACEPTADO! MRN: ${mrn}`);
    } else {
      console.log(`    ❌ ${error || tipoResp || 'Error desconocido'}`);
    }

    return { label: sumaria.label, success, mrn, error, ref };
  } catch (err) {
    console.log(`    ❌ Connection error: ${err.message}`);
    return { label: sumaria.label, success: false, error: err.message };
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  NCTS SUMARIA TEST - Probando todas las sumarias');
  console.log('═'.repeat(60));

  loadCert();
  console.log('  Cert OK');

  const results = [];
  for (const s of SUMARIAS) {
    const r = await testSumaria(s);
    results.push(r);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  RESUMEN');
  console.log('═'.repeat(60));
  results.forEach(r => {
    const icon = r.skip ? '⚠' : r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.label.padEnd(35)} ${r.success ? 'MRN=' + r.mrn : r.error || ''}`);
  });
  console.log('═'.repeat(60));
}

main().catch(console.error);
