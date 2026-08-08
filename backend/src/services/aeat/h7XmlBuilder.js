/**
 * H7 XML Builder - Declaracion simplificada de importacion (bajo valor <= 150 EUR)
 * Schema: DeclaSimpliImporV1Ent.xsd (mismos tipos que H1: ImportaTiposDeDatos.xsd)
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP
 *
 * CAMBIOS 9/Mar/2026:
 *   - Soporte documento previo N337 (referencia G4 deposito temporal)
 *   - Soporte documento previo 5025 (activacion PreH7 desde G3)
 *   - DSDT cerradas en recintos aereos → obligatorio G3v2/G4
 *
 * EN VIGOR 1/Jul/2026 (Reglamento UE 2026/382):
 *   - Supresion franquicia aduanera 150 EUR
 *   - Derecho fijo transitorio 3 EUR/articulo (IOSS/postal) hasta 1/Jul/2028
 *   - Tributo A00 = 3.00 EUR por articulo (no porcentual); IVA B00 sobre valor + A00
 *   Controlado por el flag `aplicarDerechoFijo2026` (lo fija H7Declaration.calculateDuties).
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/adip/ws/DeclaSimpliImporV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de declaracion H7 para la AEAT
 */
function buildH7ImportXML(data) {
  const {
    aduanaDespacho = '',
    // Exportador/Remitente
    remitenteNIF = '', remitenteNombre = '', remitentePais = '',
    // Destinatario
    destinatarioNIF = '', destinatarioNombre = '', destinatarioDireccion = '',
    destinatarioPoblacion = '', destinatarioCP = '', destinatarioPais = 'ES',
    // Declarante
    declaranteNIF = '', declaranteNombre = '',
    emailDespacho = '',
    formaRepresentacion = '2',
    // Ubicacion
    localizacionMercancias = '',
    // IOSS
    iossNumber = '',
    // Transporte
    modoTransporte = '4',
    // Documento previo (G4/DSDT reference) - obligatorio desde 9/Mar/2026 en aereos
    // N337 = referencia G4 deposito temporal, 5025 = activacion PreH7 desde G3
    documentoPrevioTipo = '',
    documentoPrevioRef = '',
    // Garantia
    garantiaGRN = '',
    // Reglamento UE 2026/382 - derecho fijo transitorio (desde 1/Jul/2026)
    aplicarDerechoFijo2026 = false,
    // Partidas
    partidas = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);
  const numPartidas = partidas.length || 1;
  const totalBultos = partidas.reduce((s, p) => s + (p.bultos || 1), 0);

  // AEAT H7 casilla 44 requiere un set minimo obligatorio por partida cuando
  // C372CodigoAdicional es C07/C08/318/308 (todos los casos nuestros). Verificado
  // empiricamente contra PRE el 21/Abr/2026 iterando errores 2214 / 4404 / 2213:
  //  - Factura comercial (N380 o N935) OBLIGATORIA
  //  - Documento de transporte (N703 HBL, N705 BL, N740 AWB) OBLIGATORIO
  //  - Codigo 7007 con valor intrinseco en formato 11 enteros + 2 decimales OBLIGATORIO
  function format7007(val) {
    // AEAT: importe monetario en euros, 11 enteros + 2 decimales con punto (14 chars)
    const n = Math.round(Number(val || 0) * 100) / 100;
    const intPart = Math.floor(n).toString().padStart(11, '0');
    const decPart = Math.round((n - Math.floor(n)) * 100).toString().padStart(2, '0');
    return `${intPart}.${decPart}`;
  }
  const TRANSPORT_PREFIXES = ['N703', 'N705', 'N714', 'N730', 'N740', 'N741'];
  function ensureMandatoryDocs(p) {
    const base = (p.documentos && p.documentos.length)
      ? [...p.documentos]
      : [{ tipo: p.docTipo || 'N380', referencia: p.docRef || 'FACTURA-001' }];
    const hasInvoice = base.some(d => ['N380', 'N935'].includes(d.tipo));
    const hasTransport = base.some(d => TRANSPORT_PREFIXES.includes(d.tipo));
    const has7007 = base.some(d => d.tipo === '7007');
    if (!hasInvoice) base.unshift({ tipo: 'N380', referencia: p.docRef || 'FACTURA-001' });
    if (!hasTransport) base.push({ tipo: 'N703', referencia: p.transportRef || `HBL-${transId.substring(0, 10)}` });
    if (!has7007) base.push({ tipo: '7007', referencia: format7007(p.valorFactura) });
    return base;
  }

  const partidasXML = partidas.map((p, i) => {
    const marcas = (p.marcas || (p.descripcion || '').substring(0, 35) || 'SIN-MARCA').trim();
    const docs = ensureMandatoryDocs(p);
    // Reglamento (UE) 2026/382: cuando aplica, el derecho fijo A00 es 3 EUR/articulo
    // y el IVA (B00) se calcula sobre valor factura + derecho fijo.
    const valorFactura = Number(p.valorFactura || 0);
    const derechoFijoCuota = aplicarDerechoFijo2026 ? 3.00 : 0;
    const vatBase = valorFactura + derechoFijoCuota;
    const vatCuota = vatBase * 0.21;
    return `
    <Partida>
      <C32NumeroDePartida>${i + 1}</C32NumeroDePartida>
      <C31EmpaquetamientoInterno>
        <C31EmpaqInternoClase>${p.tipoBulto || 'PK'}</C31EmpaqInternoClase>
        <C31EmpaqInternoMarcas>${marcas}</C31EmpaqInternoMarcas>
        <C31EmpaqInternoNumeroBultos>${p.bultos || 1}</C31EmpaqInternoNumeroBultos>
      </C31EmpaquetamientoInterno>
      <C31DescripcionDeLaMercancia>${(p.descripcion || '').substring(0, 250)}</C31DescripcionDeLaMercancia>
      <C3312CodigoPosicionTaric>${p.taricCode || ''}</C3312CodigoPosicionTaric>
      <C34PaisOrigen>${p.paisOrigen || remitentePais}</C34PaisOrigen>
      <C35MasaBrutaEnKg>${Number(p.pesobruto || 0).toFixed(3)}</C35MasaBrutaEnKg>
      <C36Preferencia>1</C36Preferencia>
      <C36Reduccion>00</C36Reduccion>
      <C37RegimenAduanero>
        <C371RegimenSolicitado>40</C371RegimenSolicitado>
        <C371RegimenPrecedente>00</C371RegimenPrecedente>
        <C372CodigoAdicional>${p.codigoAdicional || 'F48'}</C372CodigoAdicional>
      </C37RegimenAduanero>
      <C38MasaNetaEnKg>${Number(p.pesoneto || p.pesobruto || 0).toFixed(3)}</C38MasaNetaEnKg>
      <C42ValorFactura>${Number(p.valorFactura || 0).toFixed(3)}</C42ValorFactura>
      ${docs.map(d => `<C44DocumentosYCertificados>
        <C44Tipo>${d.tipo}</C44Tipo>
        <C44Referencia>${d.referencia}</C44Referencia>
      </C44DocumentosYCertificados>`).join('\n      ')}${documentoPrevioTipo ? `
      <C44DocumentosYCertificados>
        <C44Tipo>${documentoPrevioTipo}</C44Tipo>
        <C44Referencia>${documentoPrevioRef}</C44Referencia>
      </C44DocumentosYCertificados>` : ''}${aplicarDerechoFijo2026 ? `
      <C47TributoDeclarado>
        <C47TributoClase>A00</C47TributoClase>
        <C47TributoBaseImponible>1.000</C47TributoBaseImponible>
        <C47TributoTipoImpositivo>3.000000</C47TributoTipoImpositivo>
        <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
        <C47TributoUnidadFiscal>EUR</C47TributoUnidadFiscal>
        <C47TributoCuota>3.00</C47TributoCuota>
      </C47TributoDeclarado>` : `
      <C47TributoDeclarado>
        <C47TributoClase>A00</C47TributoClase>
        <C47TributoBaseImponible>${Number(p.valorFactura || 0).toFixed(3)}</C47TributoBaseImponible>
        <C47TributoTipoImpositivo>0.000000</C47TributoTipoImpositivo>
        <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
        <C47TributoUnidadFiscal>%</C47TributoUnidadFiscal>
        <C47TributoCuota>0.00</C47TributoCuota>
      </C47TributoDeclarado>`}
      <C47TributoDeclarado>
        <C47TributoClase>B00</C47TributoClase>
        <C47TributoBaseImponible>${vatBase.toFixed(3)}</C47TributoBaseImponible>
        <C47TributoTipoImpositivo>21.000000</C47TributoTipoImpositivo>
        <C47TributoIndicadorMaxMinNor>NO</C47TributoIndicadorMaxMinNor>
        <C47TributoUnidadFiscal>%</C47TributoUnidadFiscal>
        <C47TributoCuota>${vatCuota.toFixed(2)}</C47TributoCuota>
      </C47TributoDeclarado>
      <C47ImporteTotal>${(derechoFijoCuota + vatCuota).toFixed(2)}</C47ImporteTotal>
    </Partida>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:DeclaSimpliImporV1Ent xmlns:ent="${NS_ENT}">
      <SegmentosDeServicio Id="${transId}" fecha="${fecha}" hora="${hora}"${test ? ' Test="S"' : ''}/>
      <CAaduana>${aduanaDespacho.replace(/^ES/, '').substring(0, 6)}</CAaduana>
      <C011EstatutoMercancias>IM</C011EstatutoMercancias>
      <C012ProcedimientoSolicitado>C</C012ProcedimientoSolicitado>
      <C05NumeroDePartidas>${numPartidas}</C05NumeroDePartidas>
      <C06TotalBultos>${totalBultos}</C06TotalBultos>
      <C08Importador>
        <C08ImportadorNID>${destinatarioNIF}</C08ImportadorNID>
        <C08ImportadorParticular>${!destinatarioNIF ? 'P' : ''}</C08ImportadorParticular>
        <C08ImportadorRazonSocial>${destinatarioNombre}</C08ImportadorRazonSocial>
        <C08ImportadorDireccion>${destinatarioDireccion}</C08ImportadorDireccion>
        <C08ImportadorPoblacion>${destinatarioPoblacion}</C08ImportadorPoblacion>
        <C08ImportadorCodigoPostal>${destinatarioCP}</C08ImportadorCodigoPostal>
        <C08ImportadorPais>${destinatarioPais}</C08ImportadorPais>
      </C08Importador>
      <C14Declarante>
        <C14DeclaranteFormaRepresentacion>${formaRepresentacion}</C14DeclaranteFormaRepresentacion>
        <C14DeclaranteNID>${declaranteNIF}</C14DeclaranteNID>
        <C14DeclaranteRazonSocial>${declaranteNombre}</C14DeclaranteRazonSocial>
        <C14DeclaranteTipoAutorizaDespacho>O</C14DeclaranteTipoAutorizaDespacho>
      </C14Declarante>
      <EmailNotificaDespacho>${emailDespacho}</EmailNotificaDespacho>
      <C15aPaisExpedicion>${remitentePais}</C15aPaisExpedicion>
      <C19TransporteEnContenedores>0</C19TransporteEnContenedores>
      <C221CodigoDivisa>EUR</C221CodigoDivisa>
      <C30LocalizacionMercancias>${localizacionMercancias || 'ES' + aduanaDespacho.replace(/^ES/, '').substring(0, 6) + 'EEEEEE'}</C30LocalizacionMercancias>
      <CBImporteTotalTributos>${partidas.reduce((s, p) => {
        // Debe cuadrar EXACTAMENTE con la suma de <C47ImporteTotal> de cada partida
        // (coherencia AEAT; C47ImporteTotal ya viene redondeado a 2 decimales por partida):
        // derecho fijo A00 (si aplica) + IVA B00 sobre (valor factura + derecho fijo).
        const df = aplicarDerechoFijo2026 ? 3.00 : 0;
        const iva = (Number(p.valorFactura || 0) + df) * 0.21;
        return s + Number((df + iva).toFixed(2));
      }, 0).toFixed(2)}</CBImporteTotalTributos>
      <CBmodalidadDePago>R</CBmodalidadDePago>
      <CBgarantiaGRN>${garantiaGRN}</CBgarantiaGRN>${partidasXML}
    </ent:DeclaSimpliImporV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ---------------------------------------------------------------------------
// AltaH7V1Ent — esquema OFICIAL de la AEAT para la declaracion H7 (EUCDM).
// Sustituye al DeclaSimpliImporV1 (formato tipo H1) que AEAT PRE rechaza con
// error interno 20009. Endpoint: /wlpl/ADIP-JDIT/ws/AltaH7V1SOAP.
// IMPORTANTE: en el mensaje de ENTRADA NO se declaran tributos. El derecho fijo
// A00 (3 EUR/articulo, Reg. 2026/382) y el IVA B00 los LIQUIDA la AEAT y los
// devuelve en el mensaje de salida (AltaH7V1Sal). Ref: Guia SW H7 V3.17/3.21.
// ---------------------------------------------------------------------------
const NS_ALTAH7 = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/h7/AltaH7V1Ent.xsd';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Construir el XML SOAP de alta de declaracion H7 (AltaH7V1Ent) para la AEAT.
 */
function buildAltaH7V1XML(data) {
  const {
    test = true,
    supervisingCustomsOffice = 'ES002801',
    declaranteNIF = '', declaranteNombre = '', emailDespacho = '',
    representanteStatus = '2',
    exportador = {},
    importador = {},
    additionalProcedureCode = 'F48',
    transporte = {},
    documentos = [],
    partidas = []
  } = data;

  const transId = generateTransactionId();
  const fecha = transId.substring(0, 8);
  const hora = transId.substring(8, 14);
  const grossMassTotal = partidas.reduce((s, p) => s + Number(p.pesobruto || p.pesoneto || 0), 0);

  // Documentos de soporte a nivel de declaracion (factura, transporte, previo...).
  const docsXML = documentos.map(d => `    <SupportingDocument>
      <suppDoctype>${esc(d.tipo)}</suppDoctype>
      <suppDoctRefNum>${esc(d.referencia)}</suppDoctRefNum>
    </SupportingDocument>`).join('\n');

  // TransportDocument es OBLIGATORIO en AltaH7V1 (AEAT errorCode 1000 si falta).
  // Por defecto se declara el documento previo G4 (5025) usado para activar el (Pre)H7.
  const transDocType = transporte.tipo || '5025';
  const transDocRef = transporte.referencia || 'PR000000000ES';
  const transporteXML = `    <TransportDocument>
      <transportDocType>${esc(transDocType)}</transportDocType>
      <transportDocRefNum>${esc(transDocRef)}</transportDocRefNum>
    </TransportDocument>\n`;

  const partidasXML = partidas.map((p, i) => `    <GoodsItem>
      <declarationGoodsItemNumber>${i + 1}</declarationGoodsItemNumber>
      <Value>
        <amount>${Number(p.valorFactura || 0)}</amount>
        <currencyCode>EUR</currencyCode>
      </Value>
      <Commodity>
        <descriptionOfGoods>${esc((p.descripcion || '').substring(0, 250))}</descriptionOfGoods>
        <commodityCode>${esc(p.taricCode)}</commodityCode>
      </Commodity>
      <GoodsMeasure>
        <grossMass>${Number(p.pesobruto || p.pesoneto || 0).toFixed(4)}</grossMass>
      </GoodsMeasure>
      <numberOfPackages>${p.bultos || 1}</numberOfPackages>
    </GoodsItem>`).join('\n');

  const importadorNidXML = importador.nid
    ? `      <identificationNumber>${esc(importador.nid)}</identificationNumber>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <n1:AltaH7V1Ent xmlns:n1="${NS_ALTAH7}">
      <Message>
        <messageIdentification>${transId}</messageIdentification>
        <messageRecipient>${test ? 'ES.AEAT.PRUEBAS' : 'ES.AEAT'}</messageRecipient>
        <preparationDate>${fecha}</preparationDate>
        <preparationTime>${hora}</preparationTime>
        <testIndicator>${test ? 'S' : 'N'}</testIndicator>
      </Message>
      <Declaration>
        <supervisingCustomsOffice>${esc(supervisingCustomsOffice)}</supervisingCustomsOffice>
        <grossMass>${grossMassTotal.toFixed(4)}</grossMass>
        <Representative>
          <status>${esc(representanteStatus)}</status>
        </Representative>
        <Declarant>
          <ContactPerson>
            <name>${esc(declaranteNombre)}</name>
            <eMailAddress>${esc(emailDespacho || 'despacho@strixai.es')}</eMailAddress>
          </ContactPerson>
          <name>${esc(declaranteNombre)}</name>
          <identificationNumber>${esc(declaranteNIF)}</identificationNumber>
          <Address>
            <city>${esc((data.declarante && data.declarante.city) || 'Zaragoza')}</city>
            <country>${esc((data.declarante && data.declarante.country) || 'ES')}</country>
            <streetAndNumber>${esc((data.declarante && data.declarante.street) || '.')}</streetAndNumber>
            <postcode>${esc((data.declarante && data.declarante.postcode) || '.')}</postcode>
          </Address>
        </Declarant>
        <Exporter>
          <name>${esc(exportador.name)}</name>
          <Address>
            <city>${esc(exportador.city)}</city>
            <country>${esc(exportador.country || 'CN')}</country>
            <streetAndNumber>${esc(exportador.street || '.')}</streetAndNumber>
            <postcode>${esc(exportador.postcode || '.')}</postcode>
          </Address>
        </Exporter>
        <Importer>
${importador.phone ? `          <phoneNumber>${esc(importador.phone)}</phoneNumber>\n` : ''}${importador.email ? `          <eMailAddress>${esc(importador.email)}</eMailAddress>\n` : ''}          <name>${esc(importador.name)}</name>
${importadorNidXML}          <Address>
            <city>${esc(importador.city)}</city>
            <country>${esc(importador.country || 'ES')}</country>
            <streetAndNumber>${esc(importador.street)}</streetAndNumber>
            <postcode>${esc(importador.postcode)}</postcode>
          </Address>
          <naturalPerson>${esc(importador.naturalPerson || 'S')}</naturalPerson>
        </Importer>
${docsXML ? docsXML + '\n' : ''}${transporteXML}        <TranspCostToDest>
          <amount>${Number(data.transportCost || 0)}</amount>
          <currencyCode>EUR</currencyCode>
        </TranspCostToDest>
        <referenceNumberUCR>${esc(data.referenceNumberUCR || 'V')}</referenceNumberUCR>
        <AdditionalProcedure>
          <additionalProcedureCode>${esc(additionalProcedureCode)}</additionalProcedureCode>
        </AdditionalProcedure>${data.iossNumber ? `
        <AdditionalFiscalReference>
          <additionalFiscalRefRole>FR5</additionalFiscalRefRole>
          <additionalFiscalRefVATId>${esc(data.iossNumber)}</additionalFiscalRefVATId>
        </AdditionalFiscalReference>` : ''}
${partidasXML}
      </Declaration>
    </n1:AltaH7V1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildH7ImportXML, buildAltaH7V1XML };
