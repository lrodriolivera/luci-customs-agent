#!/usr/bin/env node
/**
 * Probe: ¿Determiniza AEAT PRE el circuito H1 segun la ubicacion ESACR?
 *
 * Jose Antonio (23/Abr/2026) confirmo estas ubicaciones en autorizacion ESACR02026000002:
 *   - 2801AAAAAC → circuito VERDE
 *   - 4811CDF001 → circuito ROJO
 *   - 4801ADT005 → circuito NARANJA
 *
 * Nota: ESACR es autorizacion de transito (NCTS). Este probe verifica si AEAT
 * aplica el mismo routing a H1 (ImportacionCompletaV1). Si funciona, tenemos
 * canal determinista para demos sin esperar a desbloqueo NCTS.
 *
 * Ejecutar: node tests/aeat-circuito-determinista-probe.js
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_PATH = path.resolve(__dirname, '../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const BASE_URL = 'https://prewww1.aeat.es';
const ENDPOINT_H1 = '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP';
const TIMEOUT = 30000;

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

const ADUANA_IMPORT = '002801';
const GARANTIA_IMPORT = '26ESAGL2800000054';

// Ubicaciones confirmadas por Jose Antonio 23/Abr/2026
const UBICACIONES = [
  { codigo: '2801AAAAAC', circuitoEsperado: 'V', nombre: 'VERDE' },
  { codigo: '4811CDF001', circuitoEsperado: 'R', nombre: 'ROJO' },
  { codigo: '4801ADT005', circuitoEsperado: 'N', nombre: 'NARANJA' },
];

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

function buildH1ForLocation(ubicacion) {
  const { buildH1ImportXML } = require('../src/services/aeat/h1XmlBuilder');
  return buildH1ImportXML({
    test: true,
    tipoOperacion: 'DECL',
    aduanaDespacho: ADUANA_IMPORT,
    estatutoMercancias: 'IM',
    procedimiento: 'A',
    exportadorNIF: STRIX.eori,
    exportadorNombre: STRIX.nombre,
    exportadorDireccion: STRIX.direccion,
    exportadorPoblacion: STRIX.poblacion,
    exportadorCP: STRIX.cp,
    exportadorPais: STRIX.pais,
    importadorNIF: STRIX.eori,
    importadorNombre: STRIX.nombre,
    importadorDireccion: STRIX.direccion,
    importadorPoblacion: STRIX.poblacion,
    importadorCP: STRIX.cp,
    importadorPais: STRIX.pais,
    declaranteNIF: STRIX.eori,
    declaranteNombre: STRIX.nombre,
    formaRepresentacion: '1',
    tipoAutorizaDespacho: 'O',
    emailDespacho: STRIX.email,
    paisExpedicion: 'CN',
    paisDestino: 'ES',
    modoTransporteFrontera: '3',
    identidadTransporteFrontera: 'ABC1234',
    paisTransporteFrontera: 'ES',
    provinciaDestino: '28',
    contenedores: '0',
    incoterm: 'CIF',
    incotermNombre: 'CIF',
    incotermZona: '1',
    divisa: 'EUR',
    importeFactura: 120,
    naturalezaTransaccion: '11',
    // Unica variable entre los 3 envios
    localizacionMercancias: 'ES00' + ubicacion,
    garantia: GARANTIA_IMPORT,
    importeTotalTributos: 25.20,
    modalidadPago: 'A',
    referenciaComercial: 'PROBE-CIRCUITO-' + ubicacion,
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
    }]
  });
}

async function sendH1(xml, label) {
  const url = BASE_URL + ENDPOINT_H1;
  try {
    const response = await axios.post(url, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });

    const body = typeof response.data === 'string' ? response.data : '';
    const code = (body.match(/<CodigoRespuesta>(\d+)</) || [])[1];
    // H1 ImportacionCompletaV1 devuelve MRN en <NumeroDeReferenciaAsignado>, no <MRN>
    const mrn = (body.match(/<NumeroDeReferenciaAsignado>([^<]+)</) || body.match(/<MRN>([^<]+)</) || [])[1];
    // CSV en H1 viene como <CSVdeDeclaracionElectronica>
    const csv = (body.match(/<CSVdeDeclaracionElectronica>([^<]+)</) || body.match(/<CSV>([^<]+)</) || [])[1];
    const circuito = (body.match(/<Circuito>([^<]+)</) || body.match(/<circuito>([^<]+)</) || [])[1];
    const requiereCertif = (body.match(/<RequiereCertificadosNoAduaneros>([^<]+)</) || [])[1];
    const error = (body.match(/<DescripcionError>([^<]+)</) || [])[1];
    const success = code === '0' || code === '1' || code === '2';

    const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
    const respFile = path.join(__dirname, `circuito-probe-response-${safeName}.xml`);
    fs.writeFileSync(respFile, body);

    return { label, success, code, mrn, csv, circuito, requiereCertif, error, httpStatus: response.status, respFile };
  } catch (err) {
    return { label, success: false, error: err.message, httpStatus: 0 };
  }
}

async function main() {
  console.log('========================================================================');
  console.log('  PROBE: Circuito determinista AEAT PRE segun ubicacion ESACR');
  console.log('  Declarante: ESB22477020 (STRIX AI SL) | Aduana: 002801');
  console.log('  Garantia: ' + GARANTIA_IMPORT);
  console.log('========================================================================\n');

  loadCertificate();

  const resultados = [];
  for (const ubi of UBICACIONES) {
    console.log(`\n${'-'.repeat(72)}`);
    console.log(`  Ubicacion: ${ubi.codigo}   Esperado: ${ubi.nombre} (${ubi.circuitoEsperado})`);
    console.log('-'.repeat(72));

    const xml = buildH1ForLocation(ubi.codigo);
    const res = await sendH1(xml, `H1-${ubi.codigo}`);
    res.ubicacion = ubi.codigo;
    res.esperado = ubi.circuitoEsperado;

    if (res.success) {
      const match = res.circuito === ubi.circuitoEsperado;
      console.log(`  ✅ ACEPTADO`);
      console.log(`  MRN: ${res.mrn || 'N/A'}`);
      console.log(`  CSV: ${res.csv || 'N/A'}`);
      console.log(`  Canal devuelto: ${res.circuito || 'N/A'}   ${match ? '✅ COINCIDE' : '⚠️  NO COINCIDE con esperado ' + ubi.circuitoEsperado}`);
      if (res.requiereCertif === 'S') console.log(`  Requiere certificados no aduaneros (SOIVRE/ROHS/etc): SI`);
    } else {
      console.log(`  ❌ RECHAZADO`);
      console.log(`  Codigo: ${res.code || 'N/A'}`);
      console.log(`  Error: ${res.error || 'N/A'}`);
    }
    console.log(`  XML respuesta: ${res.respFile}`);

    resultados.push(res);

    // Pequeña pausa para no saturar PRE
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n========================================================================');
  console.log('  RESUMEN');
  console.log('========================================================================');
  console.log(`  Ubicacion     Esperado   Real   MRN                           Resultado`);
  console.log(`  ------------  --------   ----   ---------------------------   ---------`);
  for (const r of resultados) {
    const ok = r.success && r.circuito === r.esperado;
    const real = r.circuito || (r.success ? '?' : 'ERR');
    const mrn = (r.mrn || '').padEnd(28);
    const status = ok ? '✅ OK' : (r.success ? '⚠️  MISMATCH' : '❌ RECHAZO');
    console.log(`  ${r.ubicacion.padEnd(12)}  ${r.esperado.padEnd(8)}   ${real.padEnd(4)}   ${mrn}  ${status}`);
  }
  console.log('========================================================================\n');

  const todosOk = resultados.every(r => r.success && r.circuito === r.esperado);
  if (todosOk) {
    console.log('  ✅ CONCLUSION: AEAT PRE determiniza el circuito H1 segun ubicacion ESACR.');
    console.log('     Las 3 ubicaciones son utiles para demos y tests E2E con canal forzado.');
  } else {
    console.log('  ⚠️  CONCLUSION: el routing determinista NO aplica (o no aplica completo) a H1.');
    console.log('     Las ubicaciones ESACR solo determinizan NCTS. Esperar a desbloqueo sumaria.');
  }
  console.log('');

  process.exit(todosOk ? 0 : 1);
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
