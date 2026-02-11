/**
 * ENS/ICS2 XML Builder - Declaracion sumaria de entrada
 * Schema: IE315V5Ent.xsd (formato legacy ICS: HEAHEA, GOOITEGDS, etc.)
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP
 * Root element: CC315A (NO IE315)
 * elementFormDefault="unqualified" - hijos sin prefijo
 */

const { generateTransactionId } = require('./queryXmlBuilder');
const NS_ENT = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE315V5Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Construir XML de declaracion ENS/ICS2
 */
function buildENSDeclarationXML(data) {
  const {
    lrn = '',
    // Carrier
    carrierEORI = '', carrierName = '',
    // Entry office
    entryOffice = 'ES002801',
    // Transport
    transportMode = '1', transportId = '', transportCountry = '',
    // Consignment
    consignment = {},
    // Houses
    houseConsignments = [],
    test = true
  } = data;

  const transId = generateTransactionId();
  const now = new Date();
  // Formato fecha AEAT ENS: AAMMDD
  const datPrep = String(now.getFullYear()).substring(2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  // Formato hora: HHMM
  const timPrep = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');

  const totalGross = consignment.grossMass || houseConsignments.reduce((s, h) => s + (h.grossMass || 0), 0);
  const totalPackages = consignment.numberOfPackages || houseConsignments.reduce((s, h) => s + (h.numberOfPackages || 0), 0);

  // Transport mode map
  const modeMap = { 'SEA': '1', 'RAIL': '2', 'ROAD': '3', 'AIR': '4', '1': '1', '2': '2', '3': '3', '4': '4' };
  const tMode = modeMap[transportMode] || '1';

  // Generar GOOITEGDS (partidas de mercancias)
  // GOOITEGDS orden XSD: IteNumGDS7, GooDesGDS23, GroMasGDS46, PRODOCDC2, TRACONCO2, COMCODGODITM, TRACONCE2, CONNR2, PACGS2
  const goodsXML = houseConsignments.map((h, i) => `
  <GOOITEGDS>
    <IteNumGDS7>${i + 1}</IteNumGDS7>
    <GooDesGDS23>${(h.goodsDescription || h.goods?.[0]?.description || '').substring(0, 280)}</GooDesGDS23>
    <GroMasGDS46>${Number(h.grossMass || 0).toFixed(3)}</GroMasGDS46>
    <PRODOCDC2>
      <DocTypDC21>N380</DocTypDC21>
      <DocRefDC23>INV-${i + 1}</DocRefDC23>
    </PRODOCDC2>
    <TRACONCO2>
      <NamCO27>${h.consignor?.name || ''}</NamCO27>
      <StrAndNumCO222>${h.consignor?.street || h.consignor?.address?.street || ''}</StrAndNumCO222>
      <CitCO224>${h.consignor?.city || h.consignor?.address?.city || ''}</CitCO224>
      <CouCO225>${h.consignor?.country || h.consignor?.address?.country || ''}</CouCO225>
    </TRACONCO2>
    <COMCODGODITM>
      <ComNomCMD1>${(h.commodityCode || h.goods?.[0]?.commodityCode || '').substring(0, 6)}</ComNomCMD1>
    </COMCODGODITM>
    <TRACONCE2>
      <NamCE27>${h.consignee?.name || ''}</NamCE27>
      <StrAndNumCE222>${h.consignee?.street || h.consignee?.address?.street || ''}</StrAndNumCE222>
      <CitCE224>${h.consignee?.city || h.consignee?.address?.city || ''}</CitCE224>
      <CouCE225>${h.consignee?.country || h.consignee?.address?.country || 'ES'}</CouCE225>
    </TRACONCE2>
    <CONNR2>
      <ConNumNR21>${consignment.containerNumber || 'CONT0001'}</ConNumNR21>
    </CONNR2>
    <PACGS2>
      <KinOfPacGS23>${h.packageType || 'CT'}</KinOfPacGS23>
      <NumOfPacGS24>${h.numberOfPackages || 1}</NumOfPacGS24>
    </PACGS2>
  </GOOITEGDS>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC315A xmlns:ent="${NS_ENT}">
  <MesSenMES3>${carrierEORI}</MesSenMES3>
  <MesRecMES6>NICA.ES</MesRecMES6>
  <DatOfPreMES9>${datPrep}</DatOfPreMES9>
  <TimOfPreMES10>${timPrep}</TimOfPreMES10>
  <TesIndMES18>${test ? '1' : '0'}</TesIndMES18>
  <MesIdeMES19>${transId.substring(0, 14)}</MesIdeMES19>
  <MesTypMES20>CC315A</MesTypMES20>
  <HEAHEA>
    <RefNumHEA4>${lrn || transId.substring(0, 22)}</RefNumHEA4>
    <TraModAtBorHEA76>${tMode}</TraModAtBorHEA76>
    <TotNumOfIteHEA305>${houseConsignments.length || 1}</TotNumOfIteHEA305>
    <TotNumOfPacHEA306>${totalPackages || 1}</TotNumOfPacHEA306>
    <TotGroMasHEA307>${Number(totalGross).toFixed(3)}</TotGroMasHEA307>
    <DecPlaHEA394>${entryOffice.substring(0, 2) || 'ES'}</DecPlaHEA394>
    <DecDatTimHEA114>${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}</DecDatTimHEA114>
  </HEAHEA>
${goodsXML}
  <ITI>
    <CouOfRouCodITI1>ES</CouOfRouCodITI1>
  </ITI>
  <TRAREP>
    <NamTRE1>${carrierName || 'STOCK LOGISTIC SL'}</NamTRE1>
    <TINTRE1>${carrierEORI}</TINTRE1>
  </TRAREP>
  <CUSOFFFENT730>
    <RefNumCUSOFFFENT731>${entryOffice}</RefNumCUSOFFFENT731>
    <ExpDatOfArrFIRENT733>${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()+1).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}</ExpDatOfArrFIRENT733>
  </CUSOFFFENT730>
  <TRACARENT601>
    <TINTRACARENT602>${carrierEORI}</TINTRACARENT602>
  </TRACARENT601>
    </ent:CC315A>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildENSDeclarationXML };
