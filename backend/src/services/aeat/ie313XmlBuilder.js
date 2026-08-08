/**
 * ENS Amendment XML Builder (IE313 / CC313A)
 * Schema: IE313V5Ent.xsd
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE313V5SOAP
 * elementFormDefault: unqualified - children have NO ent: prefix
 *
 * Used to amend/rectify an ENS (Entry Summary Declaration) before
 * the goods arrive. Allows modification of carrier, consignment,
 * and goods item data.
 *
 * FORMA DEL MENSAJE (corregida el 8/Ago/2026 contra AEAT PRE): un envio real se
 * rechazo con CD917B / XMLERR805 "Invalid XML format: Invalid NameSpace" (codigo
 * 52) senalando el elemento raiz. Se alinea con el IE315 (ensXmlBuilder), que es
 * el unico mensaje de esta familia que AEAT SI acepta:
 *   - namespace bajo /ADUA/internet/es/aeat/dit/adu/aden/enswsv5/, no /static_files/
 *   - la raiz es <ent:CC313A>, sin envoltorio <ent:IE313V5Ent>
 *   - el receptor del canal ENS es NICA.ES (NECA.ES no existe)
 *   - TesIndMES18 declara el entorno y MesIdeMES19 es an..14
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE313V5Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

function generateTransactionId() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0') +
    String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

/**
 * Construir XML para rectificacion de ENS
 * @param {Object} data
 * @param {string} data.mrn - MRN de la ENS original
 * @param {string} data.lrn - Local Reference Number de la rectificacion
 * @param {string} data.carrierEORI - EORI del transportista
 * @param {string} data.carrierName - Nombre del transportista
 * @param {string} data.entryOffice - Aduana de entrada
 * @param {string} data.amendmentReason - Motivo de la rectificacion
 * @param {Array} data.goodsItems - Partidas rectificadas [{sequenceNumber, description, commodityCode, grossWeight, numberOfPackages, packageType}]
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildIE313AmendmentXML(data) {
  const {
    mrn = '',
    lrn = '',
    carrierEORI = '',
    carrierName = '',
    entryOffice = '',
    amendmentReason = '',
    goodsItems = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const prepDate = new Date().toISOString().substring(0, 10).replace(/-/g, '');

  const goodsItemsXML = goodsItems.map((item, idx) => `
  <GOOITEGDS>
    <IteNumGDS7>${item.sequenceNumber || idx + 1}</IteNumGDS7>
    <GooDesGDS23>${item.description || ''}</GooDesGDS23>
    <GroMasGDS46>${item.grossWeight || 0}</GroMasGDS46>
    <ComCodTarCodGDS10>${(item.commodityCode || '').substring(0, 6)}</ComCodTarCodGDS10>
    <NumOfPacGS24>${item.numberOfPackages || 1}</NumOfPacGS24>
    <KinOfPacGS23>${item.packageType || 'PK'}</KinOfPacGS23>
  </GOOITEGDS>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC313A xmlns:ent="${NS_ENT}">
      <MesSenMES3>${carrierEORI}</MesSenMES3>
      <MesRecMES6>NICA.ES</MesRecMES6>
      <DatOfPreMES9>${prepDate}</DatOfPreMES9>
      <TesIndMES18>${test ? '1' : '0'}</TesIndMES18>
      <MesIdeMES19>${transId.substring(0, 14)}</MesIdeMES19>
      <MesTypMES20>CC313A</MesTypMES20>
      <HEAHEA>
        <DocNumHEA5>${mrn}</DocNumHEA5>
        <TraModAtBorHEA76>1</TraModAtBorHEA76>
        <AmdPlaHEA598>${amendmentReason || 'Rectificacion de datos'}</AmdPlaHEA598>
        <TotNumOfIteHEA305>${goodsItems.length || 1}</TotNumOfIteHEA305>
        <TotNumOfPacHEA306>${goodsItems.reduce((sum, i) => sum + (i.numberOfPackages || 1), 0)}</TotNumOfPacHEA306>
        <TotGroMasHEA307>${goodsItems.reduce((sum, i) => sum + (i.grossWeight || 0), 0)}</TotGroMasHEA307>
        <DecPlaHEA394>ES</DecPlaHEA394>
      </HEAHEA>
      <TRACONCO2>
        <NamCO27>${carrierName}</NamCO27>
        <TINCO259>${carrierEORI}</TINCO259>
      </TRACONCO2>
      <CUSOFFFENT730>
        <RefNumCUSOFFFENT731>${entryOffice}</RefNumCUSOFFFENT731>
      </CUSOFFFENT730>${goodsItemsXML}
    </ent:CC313A>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildIE313AmendmentXML };
