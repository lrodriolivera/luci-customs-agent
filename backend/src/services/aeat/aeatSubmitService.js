/**
 * AEAT Submit Service
 * Puente entre los controllers de la app y los XML builders + aeatRealService.
 * Cada metodo: genera XML con el builder correcto -> envia a AEAT -> procesa respuesta
 */

const logger = require('../../config/logger');
const aeatRealService = require('./aeatRealService');
const certificateService = require('./certificateService');
const { buildH1ImportXML, expeditionToH1Data } = require('./h1XmlBuilder');
const { buildH7ImportXML } = require('./h7XmlBuilder');
const { buildAESExportXML } = require('./aesXmlBuilder');
const { buildNCTSTransitXML } = require('./nctsXmlBuilder');
const { buildENSDeclarationXML } = require('./ensXmlBuilder');
const { buildSOIVREAltaXML } = require('./soivreXmlBuilder');
const { buildH1CancelXML } = require('./h1CancelXmlBuilder');
const { buildCC007ArrivalXML } = require('./cc007XmlBuilder');
const { buildCC044UnloadingXML } = require('./cc044XmlBuilder');
const { buildIE313AmendmentXML } = require('./ie313XmlBuilder');
const { buildQueryImportXML } = require('./queryXmlBuilder');

// Helper: obtener certificado activo
async function _getCertificate() {
  const certs = certificateService.listCertificates();
  if (certs.length > 0) return certs[0];

  // Intentar importar del .env
  const fs = require('fs');
  const path = require('path');
  const certPath = process.env.AEAT_CERTIFICATE_PATH;
  const certPass = process.env.AEAT_CERTIFICATE_PASSWORD;

  if (certPath && certPass) {
    const fullPath = path.resolve(process.cwd(), certPath);
    if (fs.existsSync(fullPath)) {
      const p12Buffer = fs.readFileSync(fullPath);
      const result = await certificateService.importCertificate(p12Buffer, certPass, {
        alias: 'AEAT-AUTO', organizationId: 'system', userId: 'system'
      });
      if (result.success) return { id: result.certificateId, password: certPass };
    }
  }
  return null;
}

// Helper: parsear respuesta SOAP de la AEAT
function _parseAEATResponse(responseData) {
  const body = typeof responseData === 'string' ? responseData : '';
  const code = (body.match(/<CodigoRespuesta>(\d+)</) || [])[1];
  const mrn = (body.match(/<MRN>([^<]+)</) || body.match(/<NumeroReferenciaDUA>([^<]+)</) || body.match(/<DocNumHEA5>([^<]+)</) || [])[1];
  const error = (body.match(/<DescripcionError>([^<]+)</) || body.match(/<DescripcionRespuesta>([^<]+)</) || body.match(/<errorDescription>([^<]+)</) || [])[1];
  const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];
  const csv = (body.match(/<CSV>([^<]+)</) || body.match(/Código Seguro de Verificación ([A-Z0-9]+)/) || [])[1];
  const circuito = (body.match(/<Circuito>([^<]+)</) || body.match(/<circuito>([^<]+)</) || [])[1];
  const estado = (body.match(/<EstadoDespacho>([^<]+)</) || [])[1];
  const xmlError = (body.match(/<errorText>([^<]+)</) || [])[1];
  // ENS legacy: extraer TODOS los errores FUNERRER1
  const ensErrors = [...body.matchAll(/<OriAttValER14>([^<]+)</g)].map(m => m[1]);
  const ensReasons = [...body.matchAll(/<ErrReaER13>([^<]+)</g)].map(m => m[1]);
  const ensPointers = [...body.matchAll(/<ErrPoiER12>([^<]+)</g)].map(m => m[1]);
  const ensError = ensErrors.length > 0 ? ensErrors.join(' | ') : (ensPointers.length > 0 ? ensPointers.map((p, i) => p + (ensReasons[i] ? ':' + ensReasons[i] : '')).join(' | ') : null);
  // AES/NCTS: extraer errorDescription
  const funcErrors = [...body.matchAll(/<errorDescription>([^<]+)</g)].map(m => m[1]);
  const funcError = funcErrors.length > 0 ? funcErrors.join(' | ') : null;

  // Detectar tipo de mensaje (para AES/NCTS/ENS que usan formato diferente)
  const msgType = (body.match(/<MesTypMES20>([^<]+)</) || body.match(/<messageType>([^<]+)</) || [])[1];
  const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];

  const channelMap = { V: 'green', N: 'orange', R: 'red', verde: 'green', naranja: 'orange', rojo: 'red' };

  // Exito: H1/H7 usan CodigoRespuesta 0/1/2, ENS usa CC328A, AES usa CC528C, NCTS usa CC028C
  const isSuccess = code === '0' || code === '1' || code === '2' || code === '0000'
    || msgType === 'CC328A' || msgType === 'CC528C' || msgType === 'CC028C';

  return {
    success: isSuccess,
    code: code || tipoResp || msgType,
    mrn: mrn || null,
    csv: csv || null,
    channel: channelMap[circuito] || channelMap[circuito?.toLowerCase()] || null,
    estado: estado || null,
    error: isSuccess ? null : (error || xmlError || ensError || funcError || fault || null),
    rawResponse: body
  };
}

// Helper: enviar SOAP directo (sin firma XAdES por ahora, para simplificar)
async function _sendToAEAT(soapXML, endpoint) {
  const https = require('https');
  const axios = require('axios');
  const forge = require('node-forge');
  const fs = require('fs');
  const path = require('path');

  const certPath = path.resolve(process.cwd(), process.env.AEAT_CERTIFICATE_PATH || '');
  if (!fs.existsSync(certPath)) {
    throw new Error('Certificado AEAT no encontrado: ' + certPath);
  }

  const p12 = fs.readFileSync(certPath);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12));
  const parsed = forge.pkcs12.pkcs12FromAsn1(asn1, process.env.AEAT_CERTIFICATE_PASSWORD);
  const cert = forge.pki.certificateToPem(parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert);
  const key = forge.pki.privateKeyToPem(parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);

  const isProd = process.env.AEAT_ENVIRONMENT === 'production';
  const baseUrl = isProd ? 'https://www1.agenciatributaria.gob.es' : 'https://prewww1.aeat.es';
  const url = baseUrl + endpoint;

  const agent = new https.Agent({ cert, key, rejectUnauthorized: false });

  logger.info(`[AEAT-SUBMIT] Enviando a ${url}`);

  const response = await axios.post(url, soapXML, {
    httpsAgent: agent,
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: parseInt(process.env.AEAT_TIMEOUT) || 30000,
    validateStatus: () => true
  });

  logger.info(`[AEAT-SUBMIT] Respuesta HTTP ${response.status}, ${response.data.length} bytes`);
  return _parseAEATResponse(response.data);
}

// ==================== METODOS PUBLICOS ====================

/**
 * Enviar declaracion H1 de importacion
 */
async function submitH1(expedition) {
  const data = expeditionToH1Data(expedition);
  data.test = process.env.AEAT_ENVIRONMENT !== 'production';
  const soapXML = buildH1ImportXML(data);
  return _sendToAEAT(soapXML, '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP');
}

/**
 * Enviar declaracion H7 bajo valor
 */
async function submitH7(h7Declaration) {
  const soapXML = buildH7ImportXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    aduanaDespacho: h7Declaration.customsOffice?.replace('ES', '') || '002801',
    remitenteNIF: h7Declaration.sender?.eori || '',
    remitenteNombre: h7Declaration.sender?.name || '',
    remitentePais: h7Declaration.sender?.address?.country || '',
    destinatarioNIF: h7Declaration.recipient?.taxId || '',
    destinatarioNombre: h7Declaration.recipient?.name || '',
    destinatarioDireccion: h7Declaration.recipient?.address?.street || '',
    destinatarioPoblacion: h7Declaration.recipient?.address?.city || '',
    destinatarioCP: h7Declaration.recipient?.address?.postalCode || '',
    emailDespacho: h7Declaration.recipient?.email || 'despacho@strixai.es',
    iossNumber: h7Declaration.iossNumber || '',
    partidas: (h7Declaration.items || []).map(it => ({
      descripcion: it.description,
      taricCode: it.taricCode,
      paisOrigen: it.countryOfOrigin || '',
      pesobruto: it.netWeight || 0.5,
      pesoneto: it.netWeight || 0.3,
      bultos: 1,
      valorFactura: it.totalValue || it.unitValue || 0
    }))
  });
  return _sendToAEAT(soapXML, '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP');
}

/**
 * Enviar declaracion AES exportacion
 */
async function submitAES(expedition) {
  const client = expedition.client || {};
  const goods = expedition.goods || [];
  const decl = expedition.declaration || {};

  const soapXML = buildAESExportXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    lrn: decl.lrn || '',
    customsOfficeExport: decl.customsOffice || 'ES002801',
    customsOfficeExit: decl.customsOffice || 'ES002801',
    exporterEORI: client.eori || '',
    exporterName: client.companyName || '',
    exporterStreet: client.address?.street || '',
    exporterCity: client.address?.city || '',
    exporterPostcode: client.address?.postalCode || '',
    destinationCountry: expedition.destination?.country || '',
    goodsItems: goods.map(g => ({
      description: g.description,
      taricCode: g.taricCode,
      grossWeight: g.grossWeight || 0,
      netWeight: g.netWeight || 0,
      packages: g.numberOfPackages || 1,
      value: g.invoiceValue || g.value || 0,
      statisticalValue: g.statisticalValue || g.invoiceValue || 0
    }))
  });
  return _sendToAEAT(soapXML, '/wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP');
}

/**
 * Enviar declaracion NCTS transito
 */
async function submitNCTS(transit) {
  const principal = transit.principal || {};
  const guarantee = transit.guarantee || {};

  const soapXML = buildNCTSTransitXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    lrn: transit.lrn || '',
    transitType: transit.transitType || 'T1',
    officeOfDeparture: transit.departureOffice?.code || 'ES002801',
    officeOfDestination: transit.destinationOffice?.code || '',
    transitOffices: (transit.transitOffices || []).map((o, i) => ({ sequence: i + 1, code: o.code })),
    holderEORI: principal.eori || '',
    holderName: principal.name || '',
    holderStreet: principal.address?.street || '',
    holderCity: principal.address?.city || '',
    holderPostcode: principal.address?.postalCode || '',
    holderCountry: principal.address?.country || 'ES',
    guaranteeType: guarantee.type || '1',
    guaranteeGRN: guarantee.grn || '',
    guaranteeAccessCode: guarantee.accessCode || '',
    consignment: {
      transportMode: transit.transport?.mode || '3',
      goodsItems: (transit.goodsItems || []).map(g => ({
        description: g.description,
        taricCode: g.taricCode,
        grossWeight: g.grossWeight || 0,
        packages: g.packages?.count || 1,
        packageType: g.packages?.packageType || 'CT'
      }))
    }
  });
  return _sendToAEAT(soapXML, '/wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP');
}

/**
 * Enviar declaracion ENS/ICS2
 */
async function submitENS(ensDeclaration) {
  const carrier = ensDeclaration.carrier || {};
  const cons = ensDeclaration.consignment || {};
  const modeMap = { 'AIR': '4', 'SEA': '1', 'ROAD': '3', 'RAIL': '2', '1': '1', '2': '2', '3': '3', '4': '4' };

  // Construir houseConsignments desde goods (envio directo) o houseConsignments (grupaje)
  let houses = [];
  if (ensDeclaration.houseConsignments && ensDeclaration.houseConsignments.length > 0) {
    houses = ensDeclaration.houseConsignments.map(h => ({
      grossMass: h.grossMass || 0,
      numberOfPackages: h.numberOfPackages || 1,
      placeOfLoading: h.placeOfLoading || '',
      placeOfUnloading: h.placeOfUnloading || '',
      consignor: {
        name: h.consignor?.name || h.consignor?.address?.name || '',
        street: h.consignor?.street || h.consignor?.address?.street || '',
        city: h.consignor?.city || h.consignor?.address?.city || '',
        postcode: h.consignor?.postcode || h.consignor?.address?.postcode || '',
        country: h.consignor?.country || h.consignor?.address?.country || ''
      },
      consignee: {
        name: h.consignee?.name || h.consignee?.address?.name || '',
        street: h.consignee?.street || h.consignee?.address?.street || '',
        city: h.consignee?.city || h.consignee?.address?.city || '',
        postcode: h.consignee?.postcode || h.consignee?.address?.postcode || '',
        country: h.consignee?.country || h.consignee?.address?.country || 'ES'
      },
      goodsDescription: h.goodsDescription || h.goods?.[0]?.description || '',
      commodityCode: h.commodityCode || h.goods?.[0]?.commodityCode || '',
      marksOfPackages: h.marksOfPackages || h.goods?.[0]?.marksOfPackages || 'N/M'
    }));
  } else if (ensDeclaration.goods && ensDeclaration.goods.length > 0) {
    // Envio directo: convertir goods a un solo houseConsignment
    // consignor/consignee pueden estar a nivel raiz del documento
    const rootConsignor = ensDeclaration.consignor || cons.consignor || {};
    const rootConsignee = ensDeclaration.consignee || cons.consignee || {};
    const totalGross = ensDeclaration.goods.reduce((s, g) => s + (g.grossMass || g.grossWeight || 0), 0);
    const totalPkgs = ensDeclaration.goods.reduce((s, g) => s + (g.numberOfPackages || g.packages || 1), 0);
    houses = [{
      grossMass: totalGross || cons.grossMass || 0,
      numberOfPackages: totalPkgs || cons.numberOfPackages || 1,
      placeOfLoading: cons.placeOfLoading || ensDeclaration.placeOfLoading || ((rootConsignor.country || rootConsignor.address?.country || 'CN') + 'ZZZ'),
      placeOfUnloading: cons.placeOfUnloading || ensDeclaration.placeOfUnloading || 'ESZZZ',
      consignor: {
        name: rootConsignor.name || '',
        street: rootConsignor.address?.street || rootConsignor.street || '',
        city: rootConsignor.address?.city || rootConsignor.city || '',
        postcode: rootConsignor.address?.postcode || rootConsignor.postcode || '',
        country: rootConsignor.address?.country || rootConsignor.country || ''
      },
      consignee: {
        name: rootConsignee.name || '',
        street: rootConsignee.address?.street || rootConsignee.street || '',
        city: rootConsignee.address?.city || rootConsignee.city || '',
        postcode: rootConsignee.address?.postcode || rootConsignee.postcode || '',
        country: rootConsignee.address?.country || rootConsignee.country || 'ES'
      },
      goodsDescription: ensDeclaration.goods[0].description || cons.goodsDescription || '',
      commodityCode: ensDeclaration.goods[0].commodityCode || ensDeclaration.goods[0].taricCode || '',
      marksOfPackages: ensDeclaration.goods[0].marksOfPackages || 'N/M'
    }];
  }

  const soapXML = buildENSDeclarationXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    lrn: ensDeclaration.lrn || '',
    carrierEORI: carrier.eori || '',
    entryOffice: ensDeclaration.entryOffice?.code || 'ES002801',
    transportMode: modeMap[ensDeclaration.transportMode] || ensDeclaration.transportMode || '3',
    transportId: ensDeclaration.transportMeans?.identification || carrier.vehicleId || '',
    transportCountry: ensDeclaration.transportMeans?.nationality || '',
    consignment: { containerNumber: cons.containerNumber || '' },
    houseConsignments: houses
  });

  logger.info(`[AEAT-SUBMIT] ENS XML generado: ${soapXML.length} bytes, ${houses.length} houses`);
  return _sendToAEAT(soapXML, '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP');
}

/**
 * Enviar solicitud PUE SOIVRE
 */
async function submitPUE(pueRequest) {
  const soapXML = buildSOIVREAltaXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    mrnPartidaClaveZeta: (pueRequest.declarationMRN || '') + (pueRequest.claveZeta || ''),
    codCice: pueRequest.codCice?.code || '',
    codPi: pueRequest.codPi?.code || '',
    unidadesMercancia: pueRequest.merchandiseUnit || 'PCE',
    cantidadMercancia: pueRequest.merchandiseQuantity || 0,
    correoElectronico: pueRequest.contactEmail || '',
    tipoDeclaracion: pueRequest.declarationTypeSoivre || 'Expediente SOIVRE nuevo',
    codigoSoivreProducto: pueRequest.codigoSoivreProducto || '',
    certificadoCOM: pueRequest.certificates?.com || 'Declaracion Normal',
    certificadoROHS: pueRequest.certificates?.rohs || '',
    certificadoRAEE: pueRequest.certificates?.raee || '',
    numeroRIIRAEE: pueRequest.riiNumbers?.raee || '',
    numeroRIIPyA: pueRequest.riiNumbers?.pya || '',
    especificidades: pueRequest.specificities || []
  });
  return _sendToAEAT(soapXML, '/wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP');
}

/**
 * Consultar estado de declaracion por MRN
 */
async function queryStatus(mrn) {
  const soapXML = buildQueryImportXML(mrn, {
    test: process.env.AEAT_ENVIRONMENT !== 'production'
  });
  return _sendToAEAT(soapXML, '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ConsultaImportacionV2SOAP');
}

/**
 * Cancel H1 declaration
 */
async function cancelH1(data) {
  data.test = process.env.AEAT_ENVIRONMENT !== 'production';
  const xml = buildH1CancelXML(data);
  logger.info(`[AEAT] Cancelling H1: MRN=${data.mrn}`);
  return _sendToAEAT(xml, '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.AnulaImportacionV1SOAP');
}

/**
 * NCTS Arrival notification (CC007)
 */
async function submitNCTSArrival(data) {
  data.test = process.env.AEAT_ENVIRONMENT !== 'production';
  const xml = buildCC007ArrivalXML(data);
  logger.info(`[AEAT] NCTS Arrival: MRN=${data.mrn}`);
  return _sendToAEAT(xml, '/wlpl/ADTR-JDIT/ws/ncts5/CC007CV1SOAP');
}

/**
 * NCTS Unloading remarks (CC044)
 */
async function submitNCTSUnloading(data) {
  data.test = process.env.AEAT_ENVIRONMENT !== 'production';
  const xml = buildCC044UnloadingXML(data);
  logger.info(`[AEAT] NCTS Unloading: MRN=${data.mrn}`);
  return _sendToAEAT(xml, '/wlpl/ADTR-JDIT/ws/ncts5/CC044CV1SOAP');
}

/**
 * ENS Amendment (IE313)
 */
async function submitENSAmendment(data) {
  data.test = process.env.AEAT_ENVIRONMENT !== 'production';
  const xml = buildIE313AmendmentXML(data);
  logger.info(`[AEAT] ENS Amendment: MRN=${data.mrn}`);
  return _sendToAEAT(xml, '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE313V5SOAP');
}

module.exports = {
  submitH1,
  submitH7,
  submitAES,
  submitNCTS,
  submitENS,
  submitPUE,
  queryStatus,
  cancelH1,
  submitNCTSArrival,
  submitNCTSUnloading,
  submitENSAmendment
};
