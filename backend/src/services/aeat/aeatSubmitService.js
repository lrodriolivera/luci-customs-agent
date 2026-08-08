/**
 * AEAT Submit Service
 * Puente entre los controllers de la app y los XML builders + aeatRealService.
 * Cada metodo: genera XML con el builder correcto -> envia a AEAT -> procesa respuesta
 */

const logger = require('../../config/logger');
const aeatRealService = require('./aeatRealService');
const certificateService = require('./certificateService');
const aeatTransport = require('./aeatTransport');
const { buildH1ImportXML, expeditionToH1Data } = require('./h1XmlBuilder');
const { buildH7ImportXML, buildAltaH7V1XML } = require('./h7XmlBuilder');
const { aplicaDerechoFijo2026 } = require('../../config/reg2026382');
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
  const result = await certificateService.listCertificates();
  const certs = result.certificates || [];
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
  const mrn = (body.match(/<MRN>([^<]+)</)
    || body.match(/<NumeroDeReferenciaAsignado>([^<]+)</)
    || body.match(/<NumeroReferenciaDUA>([^<]+)</)
    || body.match(/<DocNumHEA5>([^<]+)</) || [])[1];
  // OJO: aqui NO se busca <errorDescription>. Esa etiqueta la traen los bloques
  // <FunctionalError> de AES/NCTS, que se parsean mas abajo con su errorPointer;
  // incluirla aqui hacia que este match unico (no global) ganase la precedencia y
  // se perdiesen todos los errores menos el primero, ademas del campo infractor.
  const error = (body.match(/<DescripcionError>([^<]+)</) || body.match(/<DescripcionRespuesta>([^<]+)</) || [])[1];
  const fault = (body.match(/<faultstring>([^<]+)</) || [])[1];
  const csv = (body.match(/<CSV>([^<]+)</) || body.match(/Código Seguro de Verificación ([A-Z0-9]+)/) || [])[1];
  const circuito = (body.match(/<Circuito>([^<]+)</) || body.match(/<circuito>([^<]+)</) || [])[1];
  const estado = (body.match(/<EstadoDespacho>([^<]+)</) || [])[1];
  const xmlError = (body.match(/<errorText>([^<]+)</) || [])[1];
  // ENS legacy: extraer TODOS los errores FUNERRER1. Se parsea bloque a bloque
  // porque cada uno describe UN error con campos complementarios: ErrPoiER12 es el
  // campo infractor y OriAttValER14 el valor rechazado. Un CC316A real solo trae el
  // valor ('ES001101'), y devolverlo suelto deja un mensaje que no dice que esta mal.
  const ensBlocks = [...body.matchAll(/<FUNERRER1>([\s\S]*?)<\/FUNERRER1>/g)].map(m => m[1]);
  const _campo = (b) => (b.match(/<ErrPoiER12>([^<]+)</) || [])[1];
  const _valor = (b) => (b.match(/<OriAttValER14>([^<]+)</) || [])[1];
  const _razon = (b) => (b.match(/<ErrReaER13>([^<]+)</) || [])[1];
  const _describeError = (bloque) => {
    const partes = [_campo(bloque), _valor(bloque) || _razon(bloque)].filter(Boolean);
    return partes.length > 1 ? partes.join(': ') : partes[0];
  };
  const ensDetallados = ensBlocks.map(_describeError).filter(Boolean);
  // Fallback para respuestas sin envoltorio FUNERRER1 (algunos mocks y variantes).
  const ensErrors = [...body.matchAll(/<OriAttValER14>([^<]+)</g)].map(m => m[1]);
  const ensReasons = [...body.matchAll(/<ErrReaER13>([^<]+)</g)].map(m => m[1]);
  const ensPointers = [...body.matchAll(/<ErrPoiER12>([^<]+)</g)].map(m => m[1]);
  const ensError = ensDetallados.length > 0
    ? ensDetallados.join(' | ')
    : (ensErrors.length > 0
      ? ensErrors.join(' | ')
      : (ensPointers.length > 0 ? ensPointers.map((p, i) => p + (ensReasons[i] ? ':' + ensReasons[i] : '')).join(' | ') : null));
  // AES/NCTS: cada <FunctionalError> describe UN error de regla de negocio con su
  // errorPointer (la ruta del campo infractor). Se parsea bloque a bloque para no
  // separar la descripcion de su campo: "Debe ser 'B'" a secas no dice donde.
  const funcBlocks = [...body.matchAll(/<FunctionalError>([\s\S]*?)<\/FunctionalError>/g)].map(m => m[1]);
  const _describeFuncError = (bloque) => {
    const descripcion = (bloque.match(/<errorDescription>([^<]+)</) || [])[1];
    const puntero = (bloque.match(/<errorPointer>([^<]+)</) || [])[1];
    if (!descripcion) return null;
    return puntero ? `${puntero}: ${descripcion}` : descripcion;
  };
  const funcDetallados = funcBlocks.map(_describeFuncError).filter(Boolean);
  // Fallback para respuestas sin envoltorio <FunctionalError> (mocks y variantes).
  const funcErrors = [...body.matchAll(/<errorDescription>([^<]+)</g)].map(m => m[1]);
  const funcError = funcDetallados.length > 0
    ? funcDetallados.join(' | ')
    : (funcErrors.length > 0 ? funcErrors.join(' | ') : null);

  // Canal ENS (enswsv5): un CD917B rechaza el mensaje por FORMATO XML y el motivo
  // vive en <XMLERR805>, no en FUNERRER1 ni en DescripcionError. Sin parsearlo, el
  // rechazo llegaba sin una palabra de explicacion (verificado contra PRE el
  // 8/Ago/2026 con una rectificacion de ENS). Se incluye la localizacion
  // (mensaje/linea/columna) porque es lo unico que situa el defecto en el XML.
  const xmlErrBlocks = [...body.matchAll(/<XMLERR805>([\s\S]*?)<\/XMLERR805>/g)].map(m => m[1]);
  const _describeXmlError = (bloque) => {
    const razon = (bloque.match(/<ErrReaXMLER802>([^<]+)</) || [])[1];
    const valor = (bloque.match(/<OriAttValXMLER804>([^<]+)</) || [])[1];
    const donde = (bloque.match(/<ErrLocXMLER803>([^<]+)</) || [])[1];
    const linea = (bloque.match(/<ErrLinNumXMLER800>([^<]+)</) || [])[1];
    const columna = (bloque.match(/<ErrColNumXMLER801>([^<]+)</) || [])[1];
    const cabeza = [razon, valor].filter(Boolean).join(': ');
    if (!cabeza) return null;
    const sitio = [donde, linea ? `linea ${linea}` : null, columna ? `columna ${columna}` : null]
      .filter(Boolean).join(', ');
    return sitio ? `${cabeza} (${sitio})` : cabeza;
  };
  const xmlFormatError = xmlErrBlocks.map(_describeXmlError).filter(Boolean).join(' | ') || null;

  // Detectar tipo de mensaje (para AES/NCTS/ENS que usan formato diferente)
  const msgType = (body.match(/<MesTypMES20>([^<]+)</) || body.match(/<messageType>([^<]+)</) || [])[1];
  const tipoResp = (body.match(/<tipoRespuesta>([^<]+)</) || [])[1];
  // AES: circuitoAEAT + estadoAES estan en <DatosRespuestaCorrecta>
  const circuitoAES = (body.match(/<circuitoAEAT>([^<]+)</) || [])[1];
  const estadoAES = (body.match(/<estadoAES>([^<]+)</) || [])[1];

  const channelMap = { V: 'green', N: 'orange', R: 'red', verde: 'green', naranja: 'orange', rojo: 'red' };

  // H7 esquema oficial AltaH7V1Sal: <Response><responseCode>A|R</responseCode> + <MRN> + <Error><errorReason>.
  // A = aceptada, R = rechazada. El canal/documentacion se indica en documentationRequired.
  const altaH7Response = (body.match(/<Response>[\s\S]*?<responseCode>([^<]+)<\/responseCode>/) || [])[1];
  const altaH7Error = (body.match(/<errorReason>([^<]+)</) || [])[1];
  const isAltaH7 = /AltaH7V1Sal/.test(body);
  if (isAltaH7) {
    const aceptada = altaH7Response === 'A';
    return {
      success: aceptada,
      code: altaH7Response,
      mrn: mrn || null,
      csv: (body.match(/<edeclarationCSVId>([^<]+)</) || [])[1] || null,
      // documentationRequired 'S' -> canal que exige documentacion (naranja); 'N' -> verde.
      channel: (body.match(/<documentationRequired>S</) ? 'orange' : 'green'),
      estado: aceptada ? 'Aceptada' : 'Rechazada',
      error: aceptada ? null : (altaH7Error || 'Declaracion H7 rechazada por AEAT'),
      rawResponse: body
    };
  }

  // Exito: H1/H7 usan CodigoRespuesta 0/1/2, ENS usa CC328A, AES usa RE515C/CC528C,
  // NCTS usa CC028C. AES real tambien marca <tipoRespuesta>OK</tipoRespuesta>.
  const isSuccess = code === '0' || code === '1' || code === '2' || code === '0000'
    || msgType === 'CC328A' || msgType === 'CC528C' || msgType === 'CC028C' || msgType === 'RE515C'
    || tipoResp === 'OK';

  return {
    success: isSuccess,
    code: code || tipoResp || msgType,
    mrn: mrn || null,
    csv: csv || null,
    channel: channelMap[circuito] || channelMap[circuito?.toLowerCase()] || channelMap[circuitoAES] || null,
    estado: estado || estadoAES || null,
    error: isSuccess ? null : (error || xmlError || ensError || funcError || xmlFormatError || fault || null),
    rawResponse: body
  };
}

// Helper: enviar SOAP directo (sin firma XAdES por ahora, para simplificar)
// El transporte (mTLS + axios) vive en aeatTransport para que los tests del
// mapeo de datos puedan mockearlo sin certificado ni red.
async function _sendToAEAT(soapXML, endpoint) {
  const response = await aeatTransport.sendSoap(soapXML, endpoint);
  // `requestXML` viaja de vuelta al llamante porque el XML enviado es la prueba
  // de QUE se declaro: sin el, una declaracion con MRN real no tiene constancia
  // documental, y un rechazo no se puede diagnosticar. Se devuelve tanto en
  // exito como en error, que es cuando mas falta hace.
  return { ..._parseAEATResponse(response.data), requestXML: soapXML };
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
async function submitH7(h7Declaration, tenant) {
  // Declarante: EORI/NIF del tenant (representante).
  const declaranteNIF = tenant?.businessInfo?.eori || tenant?.businessInfo?.nif || tenant?.eori || tenant?.nif || h7Declaration.declarantNIF || process.env.DECLARANTE_EORI || '';
  const declaranteNombre = tenant?.companyName || tenant?.name || h7Declaration.declarantName || process.env.DECLARANTE_NOMBRE || '';

  // Representacion: '2' (directa) si declarante = importador; '3' (indirecta por
  // representante aduanero) en el resto. AEAT exige que en representacion indirecta
  // el declarante sea representante aduanero registrado (errorCode 1035); el status
  // '3' es el del ejemplo oficial que obtiene MRN.
  const importadorNID = h7Declaration.recipient?.taxId || '';
  const representanteStatus = h7Declaration.formaRepresentacion ||
    (declaranteNIF && declaranteNIF.replace(/^ES/, '') === importadorNID.replace(/^ES/, '') ? '2' : '3');

  // Codigo adicional segun modalidad de IVA (Guia H7 V3.17, apdo. 12):
  //   F48 = IOSS | F49 = acuerdos especiales (SA) | F53 = IVA estandar (tradicional) | C08 = entre particulares.
  // Nuestro caso habitual (particular, IVA a la importacion, sin IOSS) es F53.
  const additionalProcedureCode = h7Declaration.additionalProcedureCode ||
    (h7Declaration.vatPrepaid && /^IM\d{10}$/.test(h7Declaration.iossNumber || '') ? 'F48' : 'F53');

  // Documentos de soporte a nivel de declaracion: factura (N380), documento previo
  // G4 (N337) si aplica. El derecho fijo A00 y el IVA los liquida la AEAT (no van en la entrada).
  // NOTA: el documento previo G4 (N337/5025) va en TransportDocument, NO en
  // SupportingDocument (AEAT errorCode 1107 si se declara N337 aqui).
  const documentos = [{ tipo: 'N380', referencia: h7Declaration.invoiceRef || 'FACTURA-001' }];
  const docPrevioTipo = h7Declaration.documentoPrevio?.tipo || h7Declaration.documentoPrevioTipo;
  const docPrevioRef = h7Declaration.documentoPrevio?.referencia || h7Declaration.documentoPrevioRef;
  // Regla AEAT 3377/R111: con F48 y representacion indirecta es obligatorio el codigo
  // 1018 (autorizacion del declarante) en supportingDocuments. En F53 se comprueba a posteriori.
  if (additionalProcedureCode === 'F48' && representanteStatus !== '1') {
    documentos.push({ tipo: '1018', referencia: h7Declaration.mandatoRef || docPrevioRef || 'MANDATO-001' });
  }

  const soapXML = buildAltaH7V1XML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    supervisingCustomsOffice: h7Declaration.customsOffice?.startsWith('ES') ? h7Declaration.customsOffice : ('ES' + (h7Declaration.customsOffice || '002801').replace(/^ES/, '')),
    declaranteNIF,
    declaranteNombre,
    declarante: {
      city: tenant?.businessInfo?.address?.city || tenant?.address?.city || 'Zaragoza',
      country: tenant?.businessInfo?.address?.country || 'ES',
      street: tenant?.businessInfo?.address?.street || tenant?.address?.street || 'Calle Ejemplo 1',
      postcode: tenant?.businessInfo?.address?.postalCode || tenant?.address?.postalCode || '50001'
    },
    emailDespacho: h7Declaration.recipient?.email || 'despacho@strixai.es',
    representanteStatus,
    exportador: {
      name: h7Declaration.sender?.name || '',
      city: h7Declaration.sender?.address?.city || '',
      country: h7Declaration.sender?.address?.country || 'CN',
      street: h7Declaration.sender?.address?.street || '.',
      postcode: h7Declaration.sender?.address?.postalCode || '.'
    },
    importador: {
      name: h7Declaration.recipient?.name || '',
      nid: importadorNID,
      phone: h7Declaration.recipient?.phone || '',
      email: h7Declaration.recipient?.email || '',
      city: h7Declaration.recipient?.address?.city || '',
      country: h7Declaration.recipient?.address?.country || 'ES',
      street: h7Declaration.recipient?.address?.street || '',
      postcode: h7Declaration.recipient?.address?.postalCode || '',
      // naturalPerson 'S' si es un particular (sin NIF de empresa)
      naturalPerson: h7Declaration.operationType === 'B2C' || !importadorNID ? 'S' : 'N'
    },
    // Codigo adicional de procedimiento: F48 (estandar) / F49 (IOSS) / F53.
    additionalProcedureCode,
    // Documento de transporte (obligatorio): documento previo G4 (5025/N337) de activacion del (Pre)H7.
    transporte: (docPrevioTipo && docPrevioRef)
      ? { tipo: docPrevioTipo === 'N337' ? '5025' : docPrevioTipo, referencia: docPrevioRef }
      : {},
    documentos,
    partidas: (h7Declaration.items || []).map(it => ({
      descripcion: it.description,
      taricCode: it.taricCode,
      pesobruto: it.netWeight || 0.1,
      bultos: 1,
      valorFactura: it.totalValue || it.unitValue || 0
    }))
  });
  return _sendToAEAT(soapXML, '/wlpl/ADIP-JDIT/ws/AltaH7V1SOAP');
}

/**
 * Enviar declaracion AES exportacion
 */
async function submitAES(expedition) {
  const client = expedition.client || {};
  const goods = expedition.goods || [];
  const decl = expedition.declaration || {};
  const transport = expedition.transport || {};
  const isPRE = process.env.AEAT_ENVIRONMENT !== 'production';
  // AEAT PRE registrada por Jose Antonio (2/Mar/2026): ubicacion verde H1/AES
  // '2801AAAAAC' (10 chars, sin prefijo ES). El recinto 'ES002801' NO existe en la
  // tabla de autorizaciones PRE (error 5026 "recinto indicado NO existe").
  const aesLocationDefault = isPRE ? '2801AAAAAC' : '';
  // Resolver pais destino: address.country > country (legacy) > 'US' (export por defecto fuera UE)
  const consigneeCountry = expedition.consignee?.address?.country
    || expedition.consignee?.country
    || '';
  const destCountry = expedition.destination?.country || consigneeCountry || 'US';

  const officeExport = decl.customsOffice || 'ES002801';
  const officeExit = decl.officeOfExit || officeExport;
  // Exportacion directa: misma oficina exportacion y salida (AEAT prohibe
  // DepartureTransportMeans en ese caso, regla 1293).
  const directExport = decl.directExport !== undefined
    ? Boolean(decl.directExport)
    : (officeExport === officeExit);

  const soapXML = buildAESExportXML({
    test: isPRE,
    lrn: decl.lrn || '',
    directExport,
    customsOfficeExport: officeExport,
    customsOfficeExit: officeExit,
    exporterEORI: client.eori || process.env.DECLARANTE_EORI || 'ESB22477020',
    exporterName: client.companyName || process.env.DECLARANTE_NOMBRE || 'STRIX AI SL',
    exporterStreet: client.address?.street || '',
    exporterCity: client.address?.city || '',
    exporterPostcode: client.address?.postalCode || '',
    declarantEORI: process.env.DECLARANTE_EORI || 'ESB22477020',
    declarantName: process.env.DECLARANTE_NOMBRE || 'STRIX AI SL',
    consigneeEORI: expedition.consignee?.eori || '',
    consigneeName: expedition.consignee?.companyName || '',
    consigneeStreet: expedition.consignee?.address?.street || '',
    consigneeCity: expedition.consignee?.address?.city || '',
    consigneePostcode: expedition.consignee?.address?.postalCode || '00000',
    consigneeCountry: consigneeCountry || destCountry,
    destinationCountry: destCountry,
    incotermCode: decl.incoterm || 'FOB',
    incotermLocation: decl.incotermLocation || client.address?.city || 'Valencia',
    incotermCountry: decl.incotermCountry || 'ES',
    modeOfTransportAtBorder: String(transport.mode || '3'),
    inlandModeOfTransport: String(transport.mode || '3'),
    departureTransportType: transport.transportType || '30',
    departureTransportId: transport.vehicleId || transport.plateNumber || 'TRANSPORT-AES',
    departureTransportCountry: transport.country || 'ES',
    activeBorderTransportType: transport.transportType || '30',
    activeBorderTransportId: transport.vehicleId || transport.plateNumber || 'TRANSPORT-AES',
    activeBorderTransportCountry: transport.country || 'ES',
    transportDocType: decl.transportDocType || 'N730',
    transportDocRef: decl.transportDocRef || ('TD-' + Date.now().toString().slice(-10)),
    locationAuthorisationNumber: decl.locationAuthorisationNumber || aesLocationDefault,
    goodsItems: goods.map(g => ({
      description: g.description,
      taricCode: g.taricCode,
      grossWeight: g.grossWeight || 0,
      netWeight: g.netWeight || 0,
      packages: g.numberOfPackages || 1,
      value: g.invoiceValue || g.value || 0,
      statisticalValue: g.statisticalValue || g.invoiceValue || 0,
      countryOfOrigin: g.countryOfOrigin || g.originCountry || 'ES',
      regionOfDispatch: g.regionOfDispatch || '28',
      invoiceRef: g.invoiceRef || decl.invoiceRef || 'INV-AES-001',
      // AEAT error 2149: Taric exige supplementaryUnits para algunos codigos (p.ej. 8471*).
      // Enviar siempre que exista cantidad (>0), AEAT lo valida por TARIC.
      supplementaryUnits: g.supplementaryUnits != null
        ? g.supplementaryUnits
        : (g.quantity > 0 ? Number(g.quantity) : undefined)
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
  const holderEORI = principal.eori || process.env.DECLARANTE_EORI || 'ESB22477020';
  const isPRE = process.env.AEAT_ENVIRONMENT !== 'production';
  // Datos Jose Antonio AEAT PRE (2/Mar/2026): solo aplicar en entorno test
  // Datos Jose Antonio AEAT PRE: GRN 26ES0002800000010, autorizacion expedicion
  // ESACR02026000002, ubicacion verde 2801AAAAAC (10 chars, sin prefijo ES).
  const nctsGuaranteeGRNDefault = isPRE ? '26ES0002800000010' : '';
  const nctsAuthDefault = isPRE ? 'ESACR02026000002' : '';
  const nctsLocationDefault = isPRE ? '2801AAAAAC' : '';

  const soapXML = buildNCTSTransitXML({
    test: isPRE,
    lrn: transit.lrn || '',
    transitType: transit.transitType || 'T1',
    officeOfDeparture: transit.departureOffice?.code || 'ES002801',
    officeOfDestination: transit.destinationOffice?.code || '',
    transitOffices: (transit.transitOffices || []).map((o, i) => ({ sequence: i + 1, code: o.code })),
    holderEORI: holderEORI,
    holderName: principal.name || process.env.DECLARANTE_NOMBRE || 'STRIX AI SL',
    holderStreet: principal.address?.street || '',
    holderCity: principal.address?.city || 'Valencia',
    holderPostcode: principal.address?.postalCode || '',
    holderCountry: principal.address?.country || 'ES',
    declarantEORI: holderEORI,
    guaranteeType: guarantee.type || '1',
    guaranteeGRN: guarantee.grn || nctsGuaranteeGRNDefault,
    guaranteeAccessCode: guarantee.accessCode || '0000',
    authorisationNumber: transit.authorisationNumber || nctsAuthDefault,
    locationAuthorisationNumber: transit.locationAuthorisationNumber || nctsLocationDefault,
    placeOfLoadingCountry: transit.placeOfLoading?.country || 'ES',
    placeOfLoadingLocation: transit.placeOfLoading?.location || principal.address?.city || 'Valencia',
    referenceNumberUCR: transit.referenceNumberUCR || transit.lrn || ('UCR' + Date.now().toString().slice(-14)),
    // Consignee a nivel de HouseConsignment (AEAT regla CSRDT009: si no hay Consignee
    // en Consignment, debe haber uno por HouseConsignment). Fallback al principal
    // si el transit no trae consignee separado: en T1/T2 es habitual que coincidan.
    consigneeEORI: transit.consigneeEORI || transit.consignee?.eori || holderEORI,
    consigneeName: transit.consigneeName || transit.consignee?.name || principal.name || 'STRIX AI SL',
    consignment: {
      transportMode: transit.transport?.mode || '3',
      consigneeEORI: transit.consigneeEORI || transit.consignee?.eori || holderEORI,
      consigneeName: transit.consigneeName || transit.consignee?.name || principal.name || 'STRIX AI SL',
      goodsItems: (transit.goodsItems || []).map(g => {
        const prevDoc = (g.previousDocuments && g.previousDocuments[0]) || {};
        return {
          description: g.description,
          taricCode: g.taricCode,
          grossWeight: g.grossWeight || 0,
          netWeight: g.netWeight || g.grossWeight || 0,
          packages: g.packages?.count || 1,
          packageType: g.packages?.packageType || 'CT',
          countryOfDispatch: g.countryOfDispatch || 'ES',
          countryOfDestination: g.countryOfDestination || (transit.destinationOffice?.code || '').substring(0, 2) || 'ES',
          previousDocumentType: prevDoc.type || '',
          previousDocumentRef: prevDoc.reference || '',
          previousDocumentItem: prevDoc.goodsItemNumber || '1'
        };
      })
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
      commodityCode: ensDeclaration.goods[0].commodityCode || ensDeclaration.goods[0].taricCode || ensDeclaration.goods[0].hsCode || '',
      marksOfPackages: ensDeclaration.goods[0].marksOfPackages || ensDeclaration.goods[0].packages?.marks || 'N/M'
    }];
  }

  const soapXML = buildENSDeclarationXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    lrn: ensDeclaration.lrn || '',
    // Remitente del mensaje: el declarante que firma, NO el transportista (CC316A
    // "Message Sender is not valid" si se envia el EORI de un transportista ajeno).
    senderEORI: process.env.DECLARANTE_EORI || 'ESB22477020',
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
  // SOIVRE MRNPartida = MRN(18) + partida(4) + claveZeta(1) = 23 chars exactos.
  // LUCI almacena claveZeta de 5 chars (partida 4 + zeta 1), ya es el sufijo esperado.
  // Si el MRN trae sufijo de tipo (H1/H7), quedarnos con los primeros 18 chars.
  const rawMRN = pueRequest.declarationMRN || '';
  const mrn18 = rawMRN.slice(0, 18);
  const claveSuffix = (pueRequest.claveZeta || '00001').padStart(5, '0').slice(-5);
  const mrnPartida23 = mrn18 + claveSuffix;

  // CodCice / CodPi pueden venir como objeto o como string directo (por ejemplo
  // desde un test E2E). Tolerar ambos formatos.
  const cice = typeof pueRequest.codCice === 'string'
    ? pueRequest.codCice
    : (pueRequest.codCice?.code || '');
  const pi = typeof pueRequest.codPi === 'string'
    ? pueRequest.codPi
    : (pueRequest.codPi?.code || '');

  const soapXML = buildSOIVREAltaXML({
    test: process.env.AEAT_ENVIRONMENT !== 'production',
    mrnPartida: mrnPartida23,
    tipoDocumento: pueRequest.tipoDocumento || 'DUA',
    codCice: cice,
    codPi: pi,
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
 * Ubicaciones de RECEPCION de tránsitos que Hacienda dio de alta en PRE, por
 * recinto. El CC007 exige que el recinto de la ubicación coincida con el de la
 * aduana de destino (errorReason 2074), asi que no vale un unico default: la
 * '2801AAAAAC' del IE015 es de expedicion y ademas es privada de otro operador
 * (errorReason 2070 si la usamos nosotros).
 */
const UBICACIONES_RECEPCION_PRE = {
  '2901': '2901MLG005',
  '2911': '2911ADTPRU'
};

// Autorizacion ACE de destinatario autorizado que Hacienda dio de alta en PRE.
const AUTORIZACION_RECEPCION_PRE = 'ESACE02026000008';

/**
 * NCTS Arrival notification (CC007)
 *
 * Tres datos que el CC007 exige no viven en el tránsito y en PRE se rellenan con
 * los valores de prueba de Hacienda; en produccion se dejan vacios y el builder
 * falla nombrando el que falte, en vez de inventar una autorizacion ajena:
 *   - authorisationNumber: la ubicacion autorizada de llegada, del recinto de la
 *     aduana de destino (typeOfLocation B + qualifier Y lo hacen obligatorio).
 *   - authorisationReference: la autorizacion ACE de destinatario autorizado.
 *   - numeroSumariaRecepcion: la sumaria previa del recinto, formato ADDS
 *     RRRR + ultimo digito del anyo + 6 digitos.
 */
async function submitNCTSArrival(data) {
  const isPRE = process.env.AEAT_ENVIRONMENT !== 'production';
  data.test = isPRE;

  // El recinto son los 4 ultimos digitos del codigo de aduana ('ES002901' -> '2901').
  const recinto = String(data.officeOfDestination || '').slice(-4);

  if (isPRE) {
    data.authorisationNumber = data.authorisationNumber || UBICACIONES_RECEPCION_PRE[recinto] || '';
    data.authorisationReference = data.authorisationReference || AUTORIZACION_RECEPCION_PRE;
    data.numeroSumariaRecepcion = data.numeroSumariaRecepcion
      || (recinto ? `${recinto}${String(new Date().getFullYear()).slice(-1)}000001` : '');
  }

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
