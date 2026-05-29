#!/usr/bin/env node
/**
 * Probe de PERSISTENCIA AEAT PRE
 *
 * Consulta varios MRN H1 aceptados por AEAT PRE usando el servicio oficial
 * ConsultaImportacionV2 (verificado activo el 23/Abr/2026).
 *
 * Veredicto:
 *   Si ALGUN MRN devuelve estado real → AEAT PRE si persiste, el portal filtra por otro criterio
 *   Si TODOS devuelven "no existe" o fault → AEAT PRE NO persiste (confirma hipotesis)
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_PATH = path.resolve(__dirname, '../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const BASE_URL = 'https://prewww1.aeat.es';
const ENDPOINT = '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ConsultaImportacionV2SOAP';
const TIMEOUT = 30000;

const { buildQueryImportXML } = require('../src/services/aeat/queryXmlBuilder');

const MRNS = [
  { mrn: '26ES00280130001R50', origen: 'H1 probe circuitos 23/Abr (hoy, MRN devuelto por AEAT PRE hace horas)' },
  { mrn: '26ES00280130001PZ2', origen: 'H1 aceptado 22/Abr' },
  { mrn: '26ES002801300011Y8', origen: 'H1 aceptado (memoria)' },
  { mrn: '25ES00280180003993', origen: 'SUMARIA DUA de Jose Antonio (control, el confirma que EXISTE)' },
];

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

async function consultarMRN(mrn) {
  const xml = buildQueryImportXML(mrn, { test: true });
  try {
    const response = await axios.post(BASE_URL + ENDPOINT, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });
    const body = typeof response.data === 'string' ? response.data : '';
    return { status: response.status, body };
  } catch (err) {
    return { status: 0, error: err.message, body: '' };
  }
}

function parseResponse(body) {
  return {
    codigo: (body.match(/<CodigoRespuesta>([^<]+)</) || [])[1],
    descError: (body.match(/<DescripcionError>([^<]+)</) || [])[1],
    mrnResp: (body.match(/<NumeroDeReferencia>([^<]+)</) || body.match(/<NumeroDeReferenciaAsignado>([^<]+)</) || [])[1],
    circuito: (body.match(/<Circuito>([^<]+)</) || [])[1],
    situacion: (body.match(/<Situacion>([^<]+)</) || [])[1],
    estadoDespacho: (body.match(/<EstadoDespacho>([^<]+)</) || [])[1],
    fechaAdmision: (body.match(/<FechaAdmision>([^<]+)</) || body.match(/<FechaPresentacion>([^<]+)</) || [])[1],
    fault: (body.match(/<faultstring>([^<]+)</) || [])[1],
    tipoResp: (body.match(/<TipoRespuesta>([^<]+)</) || [])[1],
    // ConsultaImportacionV2 devuelve estructura compleja - guardar longitud total
    tamano: body.length
  };
}

async function main() {
  console.log('========================================================================');
  console.log('  PROBE PERSISTENCIA: ConsultaImportacionV2 contra AEAT PRE');
  console.log('  Cert: STRIX AI SL (ESB22477020) | Endpoint:', BASE_URL + ENDPOINT);
  console.log('========================================================================\n');

  loadCertificate();

  const resultados = [];
  for (const t of MRNS) {
    console.log('------------------------------------------------------------------------');
    console.log(`  MRN: ${t.mrn}`);
    console.log(`  Origen: ${t.origen}`);
    console.log('------------------------------------------------------------------------');
    const res = await consultarMRN(t.mrn);
    console.log(`  HTTP: ${res.status}  |  Respuesta: ${res.body.length} bytes`);

    const safeName = t.mrn;
    const respFile = path.join(__dirname, `persistencia-probe-${safeName}.xml`);
    fs.writeFileSync(respFile, res.body);

    const parsed = parseResponse(res.body);
    if (parsed.fault) {
      console.log(`  🔴 FAULT: ${parsed.fault.substring(0, 200)}`);
    } else if (parsed.descError) {
      console.log(`  ⚠️  Codigo: ${parsed.codigo}   Error: ${parsed.descError}`);
    } else if (parsed.mrnResp || parsed.circuito || parsed.situacion || parsed.fechaAdmision) {
      console.log(`  🟢 PERSISTIDO`);
      if (parsed.mrnResp) console.log(`     NumeroDeReferencia: ${parsed.mrnResp}`);
      if (parsed.circuito) console.log(`     Circuito: ${parsed.circuito}`);
      if (parsed.situacion) console.log(`     Situacion: ${parsed.situacion}`);
      if (parsed.estadoDespacho) console.log(`     EstadoDespacho: ${parsed.estadoDespacho}`);
      if (parsed.fechaAdmision) console.log(`     Fecha: ${parsed.fechaAdmision}`);
    } else {
      console.log(`  ❓ Respuesta no interpretada - revisar ${respFile}`);
      console.log(`     preview: ${res.body.substring(0, 250).replace(/\n/g, ' ')}`);
    }
    resultados.push({ ...t, parsed, respFile });
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n========================================================================');
  console.log('  VEREDICTO');
  console.log('========================================================================');

  const persistidos = resultados.filter(r => r.parsed.mrnResp || r.parsed.circuito || r.parsed.situacion || r.parsed.fechaAdmision);
  const noExisten = resultados.filter(r => r.parsed.descError || r.parsed.fault);

  console.log(`  Persistidos (respuesta con datos): ${persistidos.length} / ${resultados.length}`);
  console.log(`  No existen o fault:                ${noExisten.length} / ${resultados.length}`);

  if (persistidos.length === resultados.length) {
    console.log('\n  🟢 AEAT PRE SI PERSISTE. El portal web SvH1SQuery filtra por otro criterio.');
  } else if (noExisten.length === resultados.length) {
    console.log('\n  🔴 AEAT PRE NO PERSISTE. Confirma la hipotesis de no-persistencia.');
    console.log('     Los MRN que PRE genera son de validacion y se descartan tras el ACK.');
  } else {
    console.log('\n  🟡 Resultado mixto. Detalle por MRN:');
    for (const r of resultados) {
      const marker = (r.parsed.mrnResp || r.parsed.circuito || r.parsed.situacion || r.parsed.fechaAdmision) ? '🟢' : '🔴';
      console.log(`     ${marker} ${r.mrn} - ${r.origen}`);
    }
  }

  console.log('');
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
