/**
 * H7 XML Builder - Declaracion H7 de bajo valor por el servicio AltaH7V1 de la
 * AEAT (esquema AltaH7V1Ent, endpoint /wlpl/ADIP-JDIT/ws/AltaH7V1SOAP).
 *
 * El builder anterior (DeclaSimpliImporV1Ent, formato tipo H1) se retiro: la
 * AEAT PRE lo rechazaba con el error interno 20009 y no lo usaba ningun envio.
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const { codigoNC8, Y081_REF_NUM } = require('./h7Identificadores');
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

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
 * commodityCode del AltaH7V1: XSD alfaNum8Td (exactamente 8). Se envian las 8
 * cifras de la NC; con menos de 8 no hay codigo valido y se corta el envio
 * (antes salia el TARIC de 10 y la AEAT respondia 2101).
 */
function _commodityCode(p, i) {
  const nc = codigoNC8(p.taricCode);
  if (!nc) {
    throw new Error(`Partida ${i + 1}: el código "${p.taricCode || ''}" no vale para la AEAT; el H7 exige el código NC de 8 cifras.`);
  }
  return nc;
}

/**
 * Identificadores del producto de la partida (guia H7 v3.23, R23 nota [4], R232, C321):
 * C127 y C128 (y C129 si lo hay) como SupportingDocument; sin C129, Y081 como
 * AdditionalReference. Solo en la partida: desde el 15/03/2027 no se admiten en cabecera.
 * Orden del XSD (goodsItemTd2): ...numberOfPackages, SupportingDocument*, AdditionalReference*.
 */
function _identificadoresDePartidaXML(p) {
  const docs = [['C127', p.identificadorComercial], ['C128', p.referenciaFabricante], ['C129', p.codigoNormalizado]]
    .filter(([, valor]) => valor != null && String(valor).trim() !== '')
    .map(([tipo, valor]) => `      <SupportingDocument>
        <suppDoctype>${tipo}</suppDoctype>
        <suppDoctRefNum>${esc(String(valor).trim())}</suppDoctRefNum>
      </SupportingDocument>
`).join('');
  const conValor = (v) => v != null && String(v).trim() !== '';
  const tieneC127oC128 = conValor(p.identificadorComercial) || conValor(p.referenciaFabricante);
  const tieneC129 = conValor(p.codigoNormalizado);
  const y081 = tieneC127oC128 && !tieneC129 ? `      <AdditionalReference>
        <addRefType>Y081</addRefType>
        <addRefNum>${esc(Y081_REF_NUM)}</addRefNum>
      </AdditionalReference>
` : '';
  return docs + y081;
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
        <commodityCode>${_commodityCode(p, i)}</commodityCode>
      </Commodity>
      <GoodsMeasure>
        <grossMass>${Number(p.pesobruto || p.pesoneto || 0).toFixed(4)}</grossMass>
      </GoodsMeasure>
      <numberOfPackages>${p.bultos || 1}</numberOfPackages>
${_identificadoresDePartidaXML(p)}    </GoodsItem>`).join('\n');

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
            <eMailAddress>${esc(emailDespacho || 'despacho@strixai.ai')}</eMailAddress>
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
${importador.email ? `          <eMailAddress>${esc(importador.email)}</eMailAddress>\n` : ''}${importador.phone ? `          <phoneNumber>${esc(importador.phone)}</phoneNumber>\n` : ''}          <name>${esc(importador.name)}</name>
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
        <referenceNumberUCR>${esc(data.referenceNumberUCR || 'V')}</referenceNumberUCR>${data.iossNumber ? `
        <AdditionalFiscalRef>
          <additionalFiscalRefVATId>${esc(data.iossNumber)}</additionalFiscalRefVATId>
          <additionalFiscalRefRole>FR5</additionalFiscalRefRole>
        </AdditionalFiscalRef>` : ''}
        <AdditionalProcedure>
          <additionalProcedureCode>${esc(additionalProcedureCode)}</additionalProcedureCode>
        </AdditionalProcedure>
${partidasXML}
      </Declaration>
    </n1:AltaH7V1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildAltaH7V1XML };
