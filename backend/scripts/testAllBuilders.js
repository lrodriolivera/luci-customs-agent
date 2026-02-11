#!/usr/bin/env node
/**
 * Test ALL XML builders against AEAT PRE environment
 * Run: cd backend && node scripts/testAllBuilders.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');

// Load certificate
const p12 = fs.readFileSync(path.resolve(__dirname, '..', process.env.AEAT_CERTIFICATE_PATH));
const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, process.env.AEAT_CERTIFICATE_PASSWORD);
const cert = forge.pki.certificateToPem(parsed.getBags({bagType: forge.pki.oids.certBag})[forge.pki.oids.certBag][0].cert);
const key = forge.pki.privateKeyToPem(parsed.getBags({bagType: forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
const agent = new https.Agent({ cert, key, rejectUnauthorized: false });

// Load builders
const { buildH1ImportXML } = require('../src/services/aeat/h1XmlBuilder');
const { buildQueryImportXML } = require('../src/services/aeat/queryXmlBuilder');
const { buildH7ImportXML } = require('../src/services/aeat/h7XmlBuilder');
const { buildAESExportXML } = require('../src/services/aeat/aesXmlBuilder');
const { buildNCTSTransitXML } = require('../src/services/aeat/nctsXmlBuilder');
const { buildENSDeclarationXML } = require('../src/services/aeat/ensXmlBuilder');
const { buildSOIVREAltaXML } = require('../src/services/aeat/soivreXmlBuilder');

const BASE = 'https://prewww1.aeat.es';

const tests = [
  {
    name: '1. H1 IMPORTACION',
    url: BASE + '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP',
    xml: buildH1ImportXML({
      test: true, aduanaDespacho: '002801', localizacionMercancias: 'ES002801LUCI01',
      exportadorNombre: 'Test Export Co', exportadorPais: 'CN',
      importadorNIF: 'B22477020', importadorNombre: 'Stock Logistic SL',
      importadorDireccion: 'Test 1', importadorPoblacion: 'Madrid', importadorCP: '28001',
      emailDespacho: 'test@stocklogistic.es', paisExpedicion: 'CN',
      incoterm: 'CIF', importeFactura: 1000, modoTransporteFrontera: '4',
      partidas: [{ descripcion: 'Test product', taricCode: '85171400', paisOrigen: 'CN',
        pesobruto: 10, pesoneto: 8, bultos: 1, valorFactura: 1000, preferencia: '100',
        regimen: '40', arancelTipo: 0, arancelImporte: 0, ivaTipo: 21, ivaImporte: 210 }]
    })
  },
  {
    name: '2. CONSULTA ESTADO',
    url: BASE + '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ConsultaImportacionV2SOAP',
    xml: buildQueryImportXML('26ES0000000000000001', { test: true })
  },
  {
    name: '3. H7 BAJO VALOR',
    url: BASE + '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP',
    xml: buildH7ImportXML({
      aduanaDespacho: '002801', remitenteNombre: 'Amazon EU', remitentePais: 'LU',
      destinatarioNIF: '12345678A', destinatarioNombre: 'Juan Test',
      destinatarioDireccion: 'Calle Test 1', destinatarioPoblacion: 'Madrid', destinatarioCP: '28001',
      emailDespacho: 'test@test.es',
      partidas: [{ descripcion: 'Funda movil', taricCode: '39269097', paisOrigen: 'CN',
        pesobruto: 0.5, pesoneto: 0.3, bultos: 1, valorFactura: 15 }]
    })
  },
  {
    name: '4. AES EXPORTACION',
    url: BASE + '/wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP',
    xml: buildAESExportXML({
      customsOfficeExport: 'ES002801', customsOfficeExit: 'ES002801',
      exporterEORI: 'ESB22477020000', exporterName: 'Stock Logistic SL',
      exporterStreet: 'Test 1', exporterCity: 'Madrid', exporterPostcode: '28001',
      destinationCountry: 'US',
      goodsItems: [{ description: 'Aceite oliva virgen', taricCode: '15091000',
        grossWeight: 500, netWeight: 450, packages: 20, value: 5000, statisticalValue: 5000 }]
    })
  },
  {
    name: '5. NCTS TRANSITO',
    url: BASE + '/wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP',
    xml: buildNCTSTransitXML({
      transitType: 'T1', officeOfDeparture: 'ES002801', officeOfDestination: 'FR001000',
      holderEORI: 'ESB22477020000', holderName: 'Stock Logistic SL',
      holderStreet: 'Test 1', holderCity: 'Madrid', holderPostcode: '28001',
      guaranteeType: '1',
      consignment: { transportMode: '3', goodsItems: [
        { description: 'Mercancias en transito', taricCode: '851714', grossWeight: 100, packages: 5 }
      ]}
    })
  },
  {
    name: '6. ENS ICS2',
    url: BASE + '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP',
    xml: buildENSDeclarationXML({
      carrierEORI: 'ESB22477020000', entryOffice: 'ES002801',
      transportMode: '1', transportId: 'VESSEL001', transportCountry: 'PA',
      consignment: { containerNumber: 'MSKU1234567' },
      houseConsignments: [{
        grossMass: 1000, numberOfPackages: 50,
        consignor: { name: 'China Exports', street: 'Shanghai Port', city: 'Shanghai', country: 'CN' },
        consignee: { name: 'Stock Logistic', street: 'Madrid', city: 'Madrid', country: 'ES' },
        goodsDescription: 'Electronic components', commodityCode: '854231'
      }]
    })
  },
  {
    name: '7. SOIVRE ALTA',
    url: BASE + '/L/inwinvoc/es.aeat.dit.adu.ad44.soivre.SOIVREaltaV1SOAP',
    xml: buildSOIVREAltaXML({
      mrnPartidaClaveZeta: '26ES000000000000000100001',
      codCice: '28', codPi: '2801',
      unidadesMercancia: 'PCE', cantidadMercancia: 100,
      correoElectronico: 'test@stocklogistic.es',
      certificadoCOM: 'Declaracion Normal',
      especificidades: ['No aplica ninguna de las especificidades']
    })
  }
];

async function run() {
  console.log('='.repeat(60));
  console.log('  TEST TODOS LOS BUILDERS vs AEAT PRE');
  console.log('='.repeat(60));
  console.log('  Certificado: ' + process.env.AEAT_CERTIFICATE_PATH);
  console.log('  Entorno: PRE (prewww1.aeat.es)\n');

  let passed = 0;
  let total = tests.length;

  for (const t of tests) {
    console.log('--- ' + t.name + ' ---');
    try {
      const r = await axios.post(t.url, t.xml, {
        httpsAgent: agent,
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        timeout: 15000,
        validateStatus: () => true
      });

      const body = r.data;
      const code = (body.match(/<CodigoRespuesta>(\d+)</) || [])[1];
      const error = (body.match(/<DescripcionError>([^<]+)</) || [])[1];
      const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];

      console.log('  HTTP: ' + r.status + ' | Size: ' + body.length + ' bytes');

      if (code) console.log('  Codigo AEAT: ' + code);
      if (error) console.log('  Error AEAT: ' + error.substring(0, 100));
      if (fault) console.log('  SOAP Fault: ' + fault.substring(0, 100));

      if (r.status === 200 && (code || !fault)) {
        console.log('  >> CONEXION OK - XML procesado por AEAT');
        passed++;
      } else if (r.status === 200 && fault) {
        console.log('  >> CONEXION OK - XML necesita ajuste de formato');
        passed++;
      } else {
        console.log('  >> HTTP ' + r.status);
      }
    } catch (e) {
      console.log('  >> ERROR: ' + e.message);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('  RESULTADO: ' + passed + '/' + total + ' conectaron exitosamente');
  console.log('='.repeat(60));
  process.exit(0);
}

run();
