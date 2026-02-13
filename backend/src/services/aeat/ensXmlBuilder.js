/**
 * ENS/ICS2 XML Builder - Declaracion sumaria de entrada
 * Schema: IE315V5Ent.xsd (formato legacy ICS: HEAHEA, GOOITEGDS, etc.)
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP
 * Root element: CC315A (NO IE315)
 * elementFormDefault="unqualified" - hijos sin prefijo
 *
 * NOTA: ENS maritimo requiere ICS2 (sistema separado). Este endpoint legacy
 * soporta aereo (4), carretera (3) y ferrocarril (2), y RO-RO maritimo.
 *
 * Orden XSD GOOITEGDS: IteNumGDS7, GooDesGDS23, GroMasGDS46,
 *   PlaLoaGOOITE333, PlaUnlGOOITE333, ComRefNumGIM1,
 *   PRODOCDC2, TRACONCO2, COMCODGODITM, TRACONCE2, CONNR2, PACGS2
 *
 * Regla C501: Si EORI/TIN presente, NO enviar nombre (NamTRE1, etc.)
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
    entryOffice = '',
    // Transport
    transportMode = '4', transportId = '', transportCountry = '',
    // Consignment
    consignment = {},
    // Houses
    houseConsignments = [],
    // Itinerary
    itinerary = [],
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
  const tMode = modeMap[transportMode] || '4';

  // Fecha llegada esperada: dia siguiente
  const arrDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const arrDateStr = arrDate.getFullYear() +
    String(arrDate.getMonth() + 1).padStart(2, '0') +
    String(arrDate.getDate()).padStart(2, '0') +
    String(arrDate.getHours()).padStart(2, '0') +
    String(arrDate.getMinutes()).padStart(2, '0');

  // Fecha fin periodo: 2 dias despues
  const endDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const endDateStr = endDate.getFullYear() +
    String(endDate.getMonth() + 1).padStart(2, '0') +
    String(endDate.getDate()).padStart(2, '0');

  // Generar GOOITEGDS (partidas de mercancias)
  // Orden estricto XSD: IteNumGDS7, GooDesGDS23, GroMasGDS46,
  //   PlaLoaGOOITE333, PlaUnlGOOITE333, ComRefNumGIM1,
  //   PRODOCDC2, TRACONCO2, COMCODGODITM, TRACONCE2, CONNR2, PACGS2
  const goodsXML = houseConsignments.map((h, i) => {
    const hasContainer = consignment.containerNumber && consignment.containerNumber.length > 0;
    const placeOfLoading = h.placeOfLoading || '';
    const placeOfUnloading = h.placeOfUnloading || '';
    const consignorPostcode = h.consignor?.postcode || h.consignor?.address?.postcode || '';
    const consigneePostcode = h.consignee?.postcode || h.consignee?.address?.postcode || '';

    return `
  <GOOITEGDS>
    <IteNumGDS7>${i + 1}</IteNumGDS7>
    <GooDesGDS23>${(h.goodsDescription || h.goods?.[0]?.description || '').substring(0, 280)}</GooDesGDS23>
    <GroMasGDS46>${Number(h.grossMass || 0).toFixed(3)}</GroMasGDS46>${h.commercialReference || h.goodsDescription ? `
    <ComRefNumGIM1>${h.commercialReference || ('REF-' + (i + 1))}</ComRefNumGIM1>` : ''}${placeOfLoading ? `
    <PlaLoaGOOITE333>${placeOfLoading}</PlaLoaGOOITE333>` : ''}${placeOfUnloading ? `
    <PlaUnlGOOITE333>${placeOfUnloading}</PlaUnlGOOITE333>` : ''}
    <TRACONCO2>
      <NamCO27>${h.consignor?.name || ''}</NamCO27>
      <StrAndNumCO222>${h.consignor?.street || h.consignor?.address?.street || ''}</StrAndNumCO222>${consignorPostcode ? `
      <PosCodCO223>${consignorPostcode}</PosCodCO223>` : ''}
      <CitCO224>${h.consignor?.city || h.consignor?.address?.city || ''}</CitCO224>
      <CouCO225>${h.consignor?.country || h.consignor?.address?.country || ''}</CouCO225>
    </TRACONCO2>
    <COMCODGODITM>
      <ComNomCMD1>${(h.commodityCode || h.goods?.[0]?.commodityCode || '').substring(0, 6)}</ComNomCMD1>
    </COMCODGODITM>
    <TRACONCE2>
      <NamCE27>${h.consignee?.name || ''}</NamCE27>
      <StrAndNumCE222>${h.consignee?.street || h.consignee?.address?.street || ''}</StrAndNumCE222>${consigneePostcode ? `
      <PosCodCE223>${consigneePostcode}</PosCodCE223>` : ''}
      <CitCE224>${h.consignee?.city || h.consignee?.address?.city || ''}</CitCE224>
      <CouCE225>${h.consignee?.country || h.consignee?.address?.country || 'ES'}</CouCE225>
    </TRACONCE2>${hasContainer ? `
    <CONNR2>
      <ConNumNR21>${consignment.containerNumber}</ConNumNR21>
    </CONNR2>` : ''}
    <PACGS2>
      <KinOfPacGS23>${h.packageType || 'PK'}</KinOfPacGS23>
      <NumOfPacGS24>${h.numberOfPackages || 1}</NumOfPacGS24>${h.marksOfPackages ? `
      <MarNumOfPacGSL21>${h.marksOfPackages}</MarNumOfPacGSL21>` : ''}
    </PACGS2>
  </GOOITEGDS>`;
  }).join('');

  // Itinerario: pais origen + ES (o custom)
  const itiXML = itinerary.length > 0
    ? itinerary.map(c => `
  <ITI>
    <CouOfRouCodITI1>${c}</CouOfRouCodITI1>
  </ITI>`).join('')
    : `
  <ITI>
    <CouOfRouCodITI1>${houseConsignments[0]?.consignor?.country || houseConsignments[0]?.consignor?.address?.country || 'CN'}</CouOfRouCodITI1>
  </ITI>
  <ITI>
    <CouOfRouCodITI1>ES</CouOfRouCodITI1>
  </ITI>`;

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
    <IdeOfMeaOfTraCroHEA85>${transportId}</IdeOfMeaOfTraCroHEA85>${tMode !== '2' ? `
    <NatOfMeaOfTraCroHEA87>${transportCountry}</NatOfMeaOfTraCroHEA87>` : ''}
    <TotNumOfIteHEA305>${houseConsignments.length || 1}</TotNumOfIteHEA305>
    <TotNumOfPacHEA306>${totalPackages || 1}</TotNumOfPacHEA306>
    <TotGroMasHEA307>${Number(totalGross).toFixed(3)}</TotGroMasHEA307>
    <DecPlaHEA394>${entryOffice.substring(0, 2) || 'ES'}</DecPlaHEA394>
    <DecDatTimHEA114>${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}</DecDatTimHEA114>
  </HEAHEA>
${goodsXML}${itiXML}
  <TRAREP>${carrierEORI ? '' : `
    <NamTRE1>${carrierName}</NamTRE1>`}
    <TINTRE1>${carrierEORI}</TINTRE1>
  </TRAREP>
  <PERLODSUMDEC>
    <TINPLD1>${carrierEORI}</TINPLD1>
  </PERLODSUMDEC>
  <CUSOFFFENT730>
    <RefNumCUSOFFFENT731>${entryOffice}</RefNumCUSOFFFENT731>
    <ExpDatOfArrFIRENT733>${arrDateStr}</ExpDatOfArrFIRENT733>
  </CUSOFFFENT730>
  <TRACARENT601>
    <TINTRACARENT602>${carrierEORI}</TINTRACARENT602>
  </TRACARENT601>
    </ent:CC315A>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildENSDeclarationXML };
