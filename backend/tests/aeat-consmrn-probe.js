#!/usr/bin/env node
/**
 * Probe ConsDespV4 - consultar estado de MRN via SOAP oficial AEAT
 *
 * Objetivo: verificar si los MRN que AEAT PRE nos ha aceptado (y que NO aparecen
 * en el portal web SvH1SQuery/SvH7SQuery) al menos existen en alguna BD consultable
 * por otros servicios.
 *
 * Valores de respuesta posibles en campo Despachado:
 *   SI = MRN despachado
 *   NO = MRN no despachado (pero EXISTE)
 *   NE = MRN no encontrado (NO EXISTE en la BD)
 *
 * Si devuelve "NE" para todos nuestros MRN → confirma que AEAT PRE no persiste.
 * Si devuelve "NO" → los MRN sí estan persistidos, solo no estan despachados.
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_PATH = path.resolve(__dirname, '../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const TIMEOUT = 30000;

// Endpoint candidatos (el PDF oficial no muestra la URL completa en PRE)
const ENDPOINTS_PRE = [
  // Patron igual a otros servicios ADEX/DIT
  'https://prewww1.aeat.es/wlpl/ADEX-JDIT/ws/ConsDespV4SOAP',
  'https://prewww1.aeat.es/wlpl/inwinvoc/es.aeat.dit.adu.adex.ws.consmrn.ConsDespV4SOAP',
  'https://prewww1.aeat.es/wlpl/ADEX-JDIT/ConsDespV4SOAP',
  // Variantes
  'https://prewww1.aeat.es/wlpl/ADUA-JDIT/ws/ConsDespV4SOAP',
  'https://prewww1.aeat.es/wlpl/ADIP-JDIT/ws/ConsDespV4SOAP',
];

// MRN que queremos verificar
const MRNS_TEST = [
  { mrn: '26ES00280130001R50', origen: 'H1 probe circuitos 23/Abr (aceptado hace horas)' },
  { mrn: '26ES00280130001PZ2', origen: 'H1 aceptado 22/Abr (memoria 6 builders)' },
  { mrn: '26ES002801300011Y8', origen: 'H1 aceptado (memoria)' },
  { mrn: '26ES002801300011Z6', origen: 'H7 aceptado (memoria)' },
  { mrn: '26ES00280130001ND8', origen: 'H7 aceptado 21/Abr (memoria)' },
  { mrn: '25ES00280180003993', origen: 'SUMARIA Jose Antonio confirma existe (referencia control)' },
];

let httpsAgent = null;

function loadCertificate() {
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
}

function buildConsDespXML(mrn) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <soapenv:Body>
   <ConsDespV4Ent
       xmlns="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adex/ws/consmrn/ConsDespV4Ent.xsd"
       xmlns:td="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adex/ws/consmrn/ConsDespV4Dat.xsd">
     <MRN>${mrn}</MRN>
   </ConsDespV4Ent>
 </soapenv:Body>
</soapenv:Envelope>`;
}

async function tryEndpoint(endpoint, xml) {
  try {
    const response = await axios.post(endpoint, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'SOAPAction': '' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });
    const body = typeof response.data === 'string' ? response.data : '';
    return { status: response.status, body, bodyPreview: body.substring(0, 400) };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

async function discoverEndpoint(mrn) {
  const xml = buildConsDespXML(mrn);
  console.log('Descubriendo endpoint valido para ConsDespV4...');
  for (const ep of ENDPOINTS_PRE) {
    const res = await tryEndpoint(ep, xml);
    const is404 = res.status === 404;
    const isXML = res.body && res.body.includes('<');
    const hasConsDesp = res.body && (res.body.includes('ConsDespV4Sal') || res.body.includes('Despachado'));
    const hasFault = res.body && (res.body.includes('faultstring') || res.body.includes('Fault'));
    const marker = hasConsDesp ? '✅ CONSDESP' : (hasFault ? '⚠️  FAULT' : (is404 ? '❌ 404' : (isXML ? '📄 XML' : '❓ OTRO')));
    console.log(`  ${marker}  HTTP ${res.status}  ${ep}`);
    if (hasConsDesp || hasFault) {
      console.log(`    preview: ${res.bodyPreview.replace(/\n/g, ' ').substring(0, 300)}`);
    }
    if (hasConsDesp) return ep;
  }
  return null;
}

async function consultarMRN(endpoint, mrn) {
  const xml = buildConsDespXML(mrn);
  const res = await tryEndpoint(endpoint, xml);
  const body = res.body || '';
  const despachado = (body.match(/<Despachado>([^<]+)</) || [])[1];
  const estadoECS = (body.match(/<EstadoECS>([^<]+)</) || [])[1];
  const aduanaSalida = (body.match(/<AduanaSalidaECS>([^<]+)</) || [])[1];
  const mrnResp = (body.match(/<MRN>([^<]+)</) || [])[1];
  const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];

  return { mrn, mrnResp, despachado, estadoECS, aduanaSalida, fault, status: res.status, body };
}

async function main() {
  console.log('========================================================================');
  console.log('  PROBE: ConsDespV4 consulta MRN via SOAP oficial AEAT');
  console.log('  Cert: STRIX AI SL (ESB22477020)');
  console.log('========================================================================\n');

  loadCertificate();

  const endpoint = await discoverEndpoint(MRNS_TEST[0].mrn);
  if (!endpoint) {
    console.log('\n❌ Ningun endpoint devolvio respuesta valida ConsDespV4.');
    console.log('   Revisar la URL en el WSDL oficial del PDF.');
    process.exit(1);
  }

  console.log(`\n✅ Endpoint activo: ${endpoint}\n`);
  console.log('========================================================================');
  console.log('  Consultando MRNs');
  console.log('========================================================================\n');

  const resultados = [];
  for (const t of MRNS_TEST) {
    console.log(`\n  MRN: ${t.mrn}`);
    console.log(`  Origen: ${t.origen}`);
    const res = await consultarMRN(endpoint, t.mrn);
    if (res.despachado) {
      const signif = { SI: 'DESPACHADO', NO: 'NO DESPACHADO (pero EXISTE)', NE: 'NO ENCONTRADO (no existe en BD)' }[res.despachado] || res.despachado;
      console.log(`  → Despachado: ${res.despachado}  (${signif})`);
      if (res.estadoECS) console.log(`  → EstadoECS: ${res.estadoECS}`);
      if (res.aduanaSalida) console.log(`  → AduanaSalidaECS: ${res.aduanaSalida}`);
    } else if (res.fault) {
      console.log(`  → FAULT: ${res.fault}`);
    } else {
      console.log(`  → Respuesta no interpretable (HTTP ${res.status})`);
      console.log(`     ${res.body.substring(0, 200)}`);
    }
    resultados.push({ ...t, ...res });
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n========================================================================');
  console.log('  RESUMEN');
  console.log('========================================================================');
  console.log(`  MRN                        Despachado  Significado`);
  console.log(`  -------------------------  ----------  ----------------------------------`);
  for (const r of resultados) {
    const d = r.despachado || '---';
    const s = { SI: 'persistido, despachado', NO: 'persistido, no despachado', NE: 'NO PERSISTE' }[d] || (r.fault ? 'FAULT' : 'sin respuesta');
    console.log(`  ${r.mrn.padEnd(25)}  ${d.padEnd(10)}  ${s}`);
  }

  const ne_count = resultados.filter(r => r.despachado === 'NE').length;
  const existe_count = resultados.filter(r => r.despachado === 'SI' || r.despachado === 'NO').length;
  console.log('\n========================================================================');
  console.log(`  ${existe_count} MRN persisten en BD AEAT PRE`);
  console.log(`  ${ne_count} MRN NO existen ("NE")`);
  console.log('========================================================================');
  if (ne_count === resultados.length) {
    console.log('\n  🔴 CONFIRMA: AEAT PRE no persiste declaraciones en la BD consultable.');
    console.log('     Todos los MRN aceptados por PRE devuelven "MRN NO ENCONTRADO".');
  } else if (existe_count === resultados.length) {
    console.log('\n  🟢 AEAT PRE si persiste. El portal SvH1SQuery/SvH7SQuery filtra por otro criterio.');
  } else {
    console.log('\n  🟡 Resultado mixto - revisar caso por caso.');
  }
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
