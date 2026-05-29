#!/usr/bin/env node
/**
 * Probe PUE/SOIVRE (ROHSsolicitudV1) - intentar desbloquear con 3 teorias nuevas:
 *   1) MRN NCTS aceptado hoy con CSV real (no test)
 *   2) Sumaria de Jose Antonio que ya sabemos que existe en BD AEAT
 *   3) tipoDocumento=Z en vez de DUA (builder acepta DUA | DVD | Z)
 *
 * Ejecutar: node tests/aeat-soivre-desbloqueo-probe.js
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_PATH = path.resolve(__dirname, '../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const BASE_URL = 'https://prewww1.aeat.es';
const TIMEOUT = 30000;

const { buildSOIVREAltaXML, ENDPOINT_PRE } = require('../src/services/aeat/soivreXmlBuilder');

let httpsAgent = null;

function loadCertificate() {
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
  console.log('  Certificado cargado OK\n');
}

// Construir MRNPartida: MRN(18) + partida(4) + claveZeta(1) = 23 chars
function buildMrnPartida(mrn, partida = 1, claveZeta = '0') {
  const mrnClean = mrn.substring(0, 18).padEnd(18, '0');
  const part = String(partida).padStart(4, '0').slice(-4);
  const zeta = claveZeta.toString().slice(-1);
  return mrnClean + part + zeta;
}

const CASOS = [
  {
    label: 'H1 aceptado 22/Abr (baseline)',
    mrn: '26ES00280130001PZ2',
    tipoDocumento: 'DUA',
    esperado: 'err 1230 (ya sabemos)'
  },
  {
    label: 'NCTS aceptado HOY con CSV real',
    mrn: '26ES002801500473J5',
    tipoDocumento: 'DUA',
    esperado: '??? MRN con CSV real puede estar indexado'
  },
  {
    label: 'NCTS HOY + tipoDocumento=Z',
    mrn: '26ES002801500473J5',
    tipoDocumento: 'Z',
    esperado: '??? Z podria ser sumaria'
  },
  {
    label: 'Sumaria Jose Antonio (existe en BD) + DUA',
    mrn: '25ES00280180003993',
    tipoDocumento: 'DUA',
    esperado: '??? la sumaria SI existe (NCTS la acepta como N337)'
  },
  {
    label: 'Sumaria Jose Antonio + tipoDocumento=Z',
    mrn: '25ES00280180003993',
    tipoDocumento: 'Z',
    esperado: '??? combinacion mas prometedora'
  },
];

function buildPayload(caso) {
  return buildSOIVREAltaXML({
    test: true,
    tipoOperacion: 'ALT',
    especificidades: ['01'],
    tipoDocumento: caso.tipoDocumento,
    mrnPartida: buildMrnPartida(caso.mrn),
    unidadMercancia: 'unidades fisicas',
    cantidadMercancia: 10,
    codCice: '28',
    codPi: '01',
    email: 'despacho@strixai.es',
    tipoDeclaracion: '01',
    certificadoROHS: '01',
    certificadoRAEE: '02'
  });
}

async function enviar(xml, label) {
  const url = BASE_URL + ENDPOINT_PRE;
  try {
    const response = await axios.post(url, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });
    const body = typeof response.data === 'string' ? response.data : '';
    const safeName = label.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const respFile = path.join(__dirname, `soivre-probe-${safeName}.xml`);
    fs.writeFileSync(respFile, body);
    return { status: response.status, body, respFile };
  } catch (err) {
    return { status: 0, error: err.message, body: '' };
  }
}

function parse(body) {
  return {
    codigo: (body.match(/<CodigoError>([^<]+)</) || body.match(/<codigoError>([^<]+)</) || [])[1],
    error: (body.match(/<DescripcionError>([^<]+)</) || body.match(/<descripcionError>([^<]+)</) || [])[1],
    idSolicitud: (body.match(/<IdSolicitudSOIVRE>([^<]+)</) || [])[1],
    estado: (body.match(/<EstadoSolicitud>([^<]+)</) || [])[1],
    fault: (body.match(/<faultstring>([^<]+)</) || [])[1],
    respType: (body.match(/<TipoRespuesta>([^<]+)</) || [])[1]
  };
}

async function main() {
  console.log('========================================================================');
  console.log('  PROBE SOIVRE desbloqueo - 5 combinaciones');
  console.log('  Endpoint:', BASE_URL + ENDPOINT_PRE);
  console.log('========================================================================\n');

  loadCertificate();
  const resultados = [];

  for (const caso of CASOS) {
    console.log('------------------------------------------------------------------------');
    console.log(`  ${caso.label}`);
    console.log(`    MRN: ${caso.mrn}  |  tipoDocumento: ${caso.tipoDocumento}`);
    console.log(`    MRNPartida (23ch): ${buildMrnPartida(caso.mrn)}`);
    console.log('------------------------------------------------------------------------');

    const xml = buildPayload(caso);
    const res = await enviar(xml, caso.label);
    console.log(`  HTTP: ${res.status} | size: ${res.body.length} bytes`);

    const parsed = parse(res.body);
    if (parsed.idSolicitud) {
      console.log(`  🟢 ACEPTADO - IdSolicitud: ${parsed.idSolicitud}`);
      console.log(`     Estado: ${parsed.estado || '-'}`);
    } else if (parsed.error) {
      const isSameError = parsed.codigo === '1230' || (parsed.error || '').includes('no existe');
      console.log(`  ${isSameError ? '🔴' : '🟡'} RECHAZADO`);
      console.log(`     Codigo: ${parsed.codigo || '-'}`);
      console.log(`     Error: ${parsed.error}`);
      if (!isSameError) console.log(`     ⚠️  ERROR DISTINTO AL 1230 - PISTA RELEVANTE`);
    } else if (parsed.fault) {
      console.log(`  🔴 FAULT: ${parsed.fault.substring(0, 200)}`);
    } else {
      console.log(`  ❓ Respuesta no interpretable:`);
      console.log(`     ${res.body.substring(0, 300)}`);
    }
    console.log(`  Respuesta: ${res.respFile}\n`);
    resultados.push({ ...caso, parsed });
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('========================================================================');
  console.log('  RESUMEN');
  console.log('========================================================================');
  for (const r of resultados) {
    const marker = r.parsed.idSolicitud ? '🟢' : (r.parsed.error && !(r.parsed.error.includes('no existe') || r.parsed.codigo === '1230') ? '🟡 (error distinto)' : '🔴');
    console.log(`  ${marker}  ${r.label.padEnd(50)} → cod:${r.parsed.codigo || '-'} ${r.parsed.error ? `(${(r.parsed.error || '').substring(0, 60)})` : ''}`);
  }
  console.log('');

  const aceptados = resultados.filter(r => r.parsed.idSolicitud);
  const erroresDistintos = resultados.filter(r => r.parsed.error && !((r.parsed.error || '').includes('no existe')) && r.parsed.codigo !== '1230');
  if (aceptados.length > 0) {
    console.log(`  🟢 ${aceptados.length} combinacion(es) ACEPTADA(S) - 6/6 builders si confirma.`);
  } else if (erroresDistintos.length > 0) {
    console.log(`  🟡 ${erroresDistintos.length} combinacion(es) con error DIFERENTE a 1230 - hay pista para avanzar.`);
  } else {
    console.log('  🔴 Todas responden mismo "MRN no existe 1230" - requiere MRN especifico de Jose Antonio.');
  }
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
