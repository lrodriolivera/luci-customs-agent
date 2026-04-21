#!/usr/bin/env node
/**
 * Probe H7 ubicacion contra AEAT PRE.
 *
 * Itera sobre candidatos de LocalizacionMercancias (C30) y reporta cual pasa.
 * El resto del XML es IDENTICO al del test 6builders (STRIX como declarante,
 * aduana 002801, misma partida de bajo valor).
 *
 * Uso: node tests/aeat-h7-ubicacion-probe.js
 */

const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_PATH = path.resolve(__dirname, '../../Certificados/copia firma strix 70073780W_JENIFER_ROMERO__R__B22477020_.p12');
const CERT_PASS = 'Abadianubaraul90@';
const BASE_URL = 'https://prewww1.aeat.es';
const H7_ENDPOINT = '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP';
const TIMEOUT = 30000;

const STRIX = {
  nif: 'B22477020', eori: 'ESB22477020', nombre: 'STRIX AI SL',
  direccion: 'Calle Ejemplo 1', poblacion: 'Zaragoza', cp: '50001',
  pais: 'ES', email: 'despacho@strixai.es'
};
const ADUANA_TEST = '002801';

// Candidatos basados en (a) datos originales de Jose Antonio, (b) fallbacks
// actuales del builder, (c) variantes tipicas AEAT. Se prueban en orden.
// Smoke post-fix: envia H7 con partida minima (sin docs, sin marcas) y confirma
// que el builder ahora genera marcas + transporte + 7007 automaticamente y que
// AEAT solo se queje de problemas especificos del TARIC (medidas).
const UBICACION_FIJA = 'ES002801EEEEEE';
// Con 7007 (valor intrinseco mercancia) obligatorio para H7 C07/C08.
// Probamos combos de factura N380 + 7007.
// H7 requiere: factura (N380) + transporte (N703/N705/N740/N741) + 7007 formato 11.2 decimal
const V7007 = '00000000012.50'; // valor intrinseco 11 enteros.2 decimales
// Probes con partida minima: sin documentos, sin marcas, sin referencia transporte.
// El builder fixed debe auto-completar factura N380, transporte N703 y 7007.
const TARIC_CANDIDATOS = [
  { taric: '4911109000', desc: 'Impresos publicitarios' },
  { taric: '3926909790', desc: 'Funda plastico (medida 724)' }
];

let httpsAgent;
function loadCertificate() {
  const p12 = fs.readFileSync(CERT_PATH);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, CERT_PASS);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
}

function buildH7(localizacionMercancias, taricCode, descripcion) {
  const { buildH7ImportXML } = require('../src/services/aeat/h7XmlBuilder');
  // Partida minima: sin marcas, sin documentos, sin referencia transporte.
  // El builder post-fix debe inyectarlas.
  return buildH7ImportXML({
    test: true,
    aduanaDespacho: ADUANA_TEST,
    localizacionMercancias,
    remitenteNIF: STRIX.eori, remitenteNombre: STRIX.nombre, remitentePais: STRIX.pais,
    destinatarioNIF: STRIX.eori, destinatarioNombre: STRIX.nombre,
    destinatarioDireccion: STRIX.direccion, destinatarioPoblacion: STRIX.poblacion,
    destinatarioCP: STRIX.cp, destinatarioPais: 'ES',
    declaranteNIF: STRIX.eori, declaranteNombre: STRIX.nombre,
    formaRepresentacion: '1', emailDespacho: STRIX.email,
    partidas: [{
      descripcion: descripcion || 'Articulo H7 bajo valor',
      taricCode: taricCode || '4911109000', paisOrigen: 'CN',
      pesobruto: 0.200, pesoneto: 0.150, bultos: 1,
      valorFactura: 12.50
    }]
  });
}

function parseResponse(body) {
  const code = (body.match(/<CodigoRespuesta>(\d+)</) || [])[1];
  const mrn = (body.match(/<MRN>([^<]+)</) || [])[1];
  const desc = (body.match(/<DescripcionError>([^<]+)</) || [])[1];
  const errCode = (body.match(/<CodigoError>(\d+)</) || [])[1];
  const valorErroneo = (body.match(/<ValorErroneo>([^<]+)</) || [])[1];
  const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];
  return { code, mrn, desc, errCode, valorErroneo, fault };
}

async function probe(loc, label, taric, desc) {
  const xml = buildH7(loc, taric, desc);
  try {
    const res = await axios.post(BASE_URL + H7_ENDPOINT, xml, {
      httpsAgent,
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: TIMEOUT,
      validateStatus: () => true
    });
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const p = parseResponse(body);
    const ok = p.code === '0';
    // dump full error description on failure to understand condition
    const fullDesc = (body.match(/<DescripcionError>([^<]+)</) || [])[1];
    return { label, loc, httpStatus: res.status, ok, ...p, fullDesc };
  } catch (e) {
    return { label, loc, error: e.message };
  }
}

(async () => {
  console.log('=== H7 casilla-44 document probe contra AEAT PRE ===');
  console.log('Declarante: ' + STRIX.eori + ' | Aduana: ' + ADUANA_TEST);
  console.log('Ubicacion fija: ' + UBICACION_FIJA);
  console.log('Fecha: ' + new Date().toISOString());
  console.log();

  loadCertificate();
  console.log('Certificado FNMT cargado.\n');

  const results = [];
  for (const tc of TARIC_CANDIDATOS) {
    const label = `TARIC ${tc.taric} (${tc.desc})`;
    process.stdout.write(`Probing ${label}... `);
    const r = await probe(UBICACION_FIJA, label, tc.taric, tc.desc);
    results.push(r);
    if (r.ok) {
      console.log(`[OK] MRN=${r.mrn}`);
    } else if (r.error) {
      console.log(`[ERR] ${r.error}`);
    } else {
      console.log(`[REJ] errCod=${r.errCode} val="${r.valorErroneo}"`);
      console.log(`      ${(r.fullDesc || '').substring(0, 200)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n=== RESUMEN ===');
  results.forEach(r => {
    const status = r.ok ? 'ACEPTADA' : (r.error ? 'ERROR_RED' : 'RECHAZADA');
    console.log(`${status.padEnd(10)} ${r.label.padEnd(25)} ${r.ok ? 'MRN=' + r.mrn : 'err=' + r.errCode}`);
  });

  const wins = results.filter(r => r.ok);
  if (wins.length) {
    console.log('\nDOCUMENTOS H7 VALIDOS EN CASILLA 44:');
    wins.forEach(r => console.log('  - ' + r.label + ' -> MRN ' + r.mrn));
  }
})();
