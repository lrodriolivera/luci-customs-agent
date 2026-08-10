/**
 * ENS Amendment XML Builder (IE313 / CC313A)
 * Schema: IE313V5Ent.xsd
 * Endpoint: /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE313V5SOAP
 * elementFormDefault: unqualified - children have NO ent: prefix
 *
 * Rectifica una ENS ya presentada antes de que la mercancia llegue.
 *
 * FORMA DEL MENSAJE (corregida el 8/Ago/2026 contra AEAT PRE): un envio real se
 * rechazo con CD917B / XMLERR805 "Invalid XML format: Invalid NameSpace" (codigo
 * 52) senalando el elemento raiz. Se alinea con el IE315 (ensXmlBuilder), que es
 * el unico mensaje de esta familia que AEAT SI acepta:
 *   - namespace bajo /ADUA/internet/es/aeat/dit/adu/aden/enswsv5/, no /static_files/
 *   - la raiz es <ent:CC313A>, sin envoltorio <ent:IE313V5Ent>
 *   - el receptor del canal ENS es NICA.ES (NECA.ES no existe)
 *   - TesIndMES18 declara el entorno y MesIdeMES19 es an..14
 *   - DatOfPreMES9 va en AAMMDD (no AAAAMMDD) y se declara TimOfPreMES10 (HHMM);
 *     un segundo envio real se rechazo con XMLERR805 "Element too long (length
 *     constraint)" sobre CC313A,DatOfPreMES9, codigo 39
 *
 * CUERPO (reescrito el 10/Ago/2026 tras 5 rechazos reales encadenados de PRE). El
 * CC313A NO es un mensaje reducido: lleva el mismo cuerpo que el CC315A, con el
 * MRN y el motivo/fecha de la rectificacion en la cabecera. Lo que habia era un
 * esqueleto minimo divergente, y cada rechazo fue senalando una pieza:
 *   1. "Se esperaba nodo TotNumOfIteHEA305 y ha venido AmdPlaHEA598" -> el motivo
 *      va DESPUES de los totales (el sequence del XSD es normativo).
 *   2. "Se esperaba nodo AmdPlaHEA598 y ha venido DecPlaHEA394" -> y antes del pais.
 *   3. "Se esperaba nodo DatTimAmeHEA113" -> la fecha de la rectificacion es
 *      obligatoria y AEAT la nombra; DecPlaHEA394 no existe en este HEAHEA
 *      ("Se esperaba EndElement (HEAHEA)").
 *   4. "Not supported in this position: CC313A,<TRACONCO2>" -> el expedidor va
 *      DENTRO de cada GOOITEGDS, no a nivel raiz; y hacen falta TRAREP,
 *      PERLODSUMDEC y ExpDatOfArrFIRENT733, igual que en el CC315A.
 *   5. Ya validando el XML, AEAT paso a reglas de negocio y delato el fondo del
 *      asunto: TraModAtBorHEA76 estaba FIJO a '1' (maritimo), asi que toda
 *      rectificacion se declaraba maritima y saltaba "Las ENS del sector maritimo
 *      se deben declarar solo en el sistema ICS2" sobre una ENS ferroviaria.
 *      Ademas faltaban IdeOfMeaOfTraCroHEA85 (C017), el itinerario ITI (C570/R879),
 *      lugares de carga/descarga (C574/C579), referencia comercial (C567),
 *      destinatario en la partida (C584) y marcas de bultos (C062).
 *   6. "Se esperaba nodo DocNumHEA5 y ha venido RefNumHEA4" y despues
 *      "Se esperaba nodo TraModAtBorHEA76 y ha venido RefNumHEA4" -> este HEAHEA
 *      NO lleva LRN: la sumaria que se rectifica se identifica por su MRN y solo
 *      por el, asi que la cabecera abre en DocNumHEA5.
 *   7. "Element too long (length constraint): CC313A,AmdPlaHEA598" -> AmdPlaHEA598
 *      es el LUGAR de la rectificacion (an..35, como DecPlaHEA394 del CC315A), no
 *      el motivo: se le estaba metiendo el texto libre que teclea el usuario. El
 *      CC313A de ENS NO tiene campo para el motivo, asi que el motivo se queda
 *      donde corresponde (el historial de LUCI) y nunca se declara a la aduana
 *      un texto en un campo que significa otra cosa.
 *
 * IMPORTANTE: el contenido tiene que cambiar de verdad. Si el CC313A repite lo ya
 * presentado, AEAT lo rechaza con "The data of the ENS declaration is identical to
 * the previous presentation": las rectificaciones se comparan por contenido.
 *
 * Regla C501, como en el IE315: si viaja el EORI, NO se manda el nombre.
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
 * @param {string} data.mrn - MRN de la ENS original (obligatorio)
 *   (el CC313A no lleva LRN: la sumaria se identifica por su MRN)
 * @param {string} data.senderEORI - Remitente del MENSAJE (titular del certificado)
 * @param {string} data.carrierEORI - EORI del transportista
 * @param {string} data.carrierName - Nombre del transportista (solo si no hay EORI)
 * @param {string} data.entryOffice - Aduana de entrada
 * @param {string} data.transportMode - SEA|AIR|ROAD|RAIL o 1..4
 * @param {string} data.transportId - Identificacion del medio de transporte
 * @param {string} data.transportCountry - Nacionalidad del medio de transporte
 * @param {string|Date} data.expectedArrival - Fecha prevista de llegada DECLARADA
 * @param {string} data.amendmentPlace - Lugar de la rectificacion (an..35). Por
 *   defecto el pais de la aduana de entrada, como el DecPlaHEA394 del CC315A.
 *   El MOTIVO de la rectificacion no se declara: el CC313A no tiene campo para el.
 * @param {Array} data.goodsItems - Partidas rectificadas
 * @param {Array} data.itinerary - Paises de ruta
 * @param {Object} data.consignment - {containerNumber}
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildIE313AmendmentXML(data) {
  const {
    mrn = '',
    senderEORI = '',
    carrierEORI = '',
    carrierName = '',
    entryOffice = '',
    transportMode = '',
    transportId = '',
    transportCountry = '',
    expectedArrival = null,
    amendmentPlace = '',
    goodsItems = [],
    itinerary = [],
    consignment = {},
    test = true
  } = data;

  const transId = generateTransactionId();
  // AAMMDD y HHMM, como el IE315. En AAAAMMDD AEAT lo rechazo con XMLERR805
  // "Element too long (length constraint)" sobre CC313A,DatOfPreMES9 (codigo 39).
  const ahora = new Date();
  const prepDate = String(ahora.getFullYear()).substring(2) +
    String(ahora.getMonth() + 1).padStart(2, '0') +
    String(ahora.getDate()).padStart(2, '0');
  const prepTime = String(ahora.getHours()).padStart(2, '0') +
    String(ahora.getMinutes()).padStart(2, '0');
  const selloAAAAMMDDHHMM = `20${prepDate}${prepTime}`;

  // El modo se toma de la declaracion que se rectifica. Estaba FIJO a '1'
  // (maritimo): con eso AEAT rechazaba toda rectificacion remitiendo a ICS2, aunque
  // la sumaria fuese ferroviaria. Sin modo no se envia: seria declarar uno inventado.
  const modeMap = { SEA: '1', AIR: '4', ROAD: '3', RAIL: '2', 1: '1', 2: '2', 3: '3', 4: '4' };
  const tMode = modeMap[transportMode];
  if (!tMode) {
    throw new Error(`Modo de transporte no valido para el CC313A: ${JSON.stringify(transportMode)}. Debe venir de la ENS que se rectifica (SEA|AIR|ROAD|RAIL o 1..4)`);
  }

  // ExpDatOfArrFIRENT733 (AAAAMMDDHHMM) es la fecha prevista de llegada DECLARADA:
  // sale de la declaracion que se rectifica, no de un relleno. Si no llega, la
  // rectificacion se aborta antes de enviar un dato inventado a la aduana.
  if (!expectedArrival) {
    throw new Error('Falta la fecha prevista de llegada (expectedArrival): el CC313A la exige en ExpDatOfArrFIRENT733 y no se puede inventar');
  }
  const arr = new Date(expectedArrival);
  if (Number.isNaN(arr.getTime())) {
    throw new Error(`Fecha prevista de llegada no valida: ${expectedArrival}`);
  }
  const arrDateStr = arr.getFullYear() +
    String(arr.getMonth() + 1).padStart(2, '0') +
    String(arr.getDate()).padStart(2, '0') +
    String(arr.getHours()).padStart(2, '0') +
    String(arr.getMinutes()).padStart(2, '0');

  const totalPackages = goodsItems.reduce((s, i) => s + (i.numberOfPackages || 1), 0);
  const totalGross = goodsItems.reduce((s, i) => s + (i.grossWeight || 0), 0);

  // Orden estricto del sequence, el mismo del CC315A: IteNumGDS7, GooDesGDS23,
  // GroMasGDS46, PlaLoaGOOITE333, PlaUnlGOOITE333, ComRefNumGIM1, TRACONCO2,
  // COMCODGODITM, TRACONCE2, CONNR2, PACGS2.
  // Los lugares de carga y descarga de cada partida son UN/LOCODE: los dos primeros
  // caracteres son el pais, y de ahi sale el itinerario (ver mas abajo). Se resuelven
  // ANTES de generar el XML para que ambos salgan de la misma fuente y no puedan
  // divergir, que es lo que provocaba el rechazo de AEAT.
  const lugaresPartida = goodsItems.map(item => ({
    carga: item.placeOfLoading || `${item.consignor?.country || 'CN'}ZZZ`,
    descarga: item.placeOfUnloading || 'ESZZZ'
  }));

  const hasContainer = Boolean(consignment.containerNumber);
  const goodsItemsXML = goodsItems.map((item, idx) => {
    const num = item.sequenceNumber || idx + 1;
    const consignor = item.consignor || {};
    const consignee = item.consignee || {};
    return `
      <GOOITEGDS>
        <IteNumGDS7>${num}</IteNumGDS7>
        <GooDesGDS23>${(item.description || '').substring(0, 280)}</GooDesGDS23>
        <GroMasGDS46>${Number(item.grossWeight || 0).toFixed(3)}</GroMasGDS46>
        <ComRefNumGIM1>${item.commercialReference || `REF-${num}`}</ComRefNumGIM1>
        <PlaLoaGOOITE333>${lugaresPartida[idx].carga}</PlaLoaGOOITE333>
        <PlaUnlGOOITE333>${lugaresPartida[idx].descarga}</PlaUnlGOOITE333>
        <TRACONCO2>
          <NamCO27>${consignor.name || 'Expedidor'}</NamCO27>
          <StrAndNumCO222>${consignor.street || '-'}</StrAndNumCO222>
          <PosCodCO223>${consignor.postcode || '00000'}</PosCodCO223>
          <CitCO224>${consignor.city || '-'}</CitCO224>
          <CouCO225>${consignor.country || 'CN'}</CouCO225>
        </TRACONCO2>
        <COMCODGODITM>
          <ComNomCMD1>${(item.commodityCode || '').substring(0, 6)}</ComNomCMD1>
        </COMCODGODITM>
        <TRACONCE2>
          <NamCE27>${consignee.name || 'Destinatario'}</NamCE27>
          <StrAndNumCE222>${consignee.street || '-'}</StrAndNumCE222>
          <PosCodCE223>${consignee.postcode || '00000'}</PosCodCE223>
          <CitCE224>${consignee.city || '-'}</CitCE224>
          <CouCE225>${consignee.country || 'ES'}</CouCE225>
        </TRACONCE2>${hasContainer ? `
        <CONNR2>
          <ConNumNR21>${consignment.containerNumber}</ConNumNR21>
        </CONNR2>` : ''}
        <PACGS2>
          <KinOfPacGS23>${item.packageType || 'PK'}</KinOfPacGS23>
          <NumOfPacGS24>${item.numberOfPackages || 1}</NumOfPacGS24>
          <MarNumOfPacGSL21>${item.marksOfPackages || 'N/M'}</MarNumOfPacGSL21>
        </PACGS2>
      </GOOITEGDS>`;
  }).join('');

  // Itinerario (ITI): AEAT lo exige con las reglas C570 y R879, y ademas impone que
  // "The Place of loading and the Place unloading shall be included in the itinerary".
  // El itinerario que llegaba se derivaba de `countryOfDispatch`/`countryOfDestination`
  // de la expedicion, mientras los lugares de carga/descarga salian del pais del
  // expedidor: cuando la ENS no traia pais de expedicion (no es obligatorio en el
  // esquema), el itinerario se quedaba en ['ES'] y la carga en 'CNZZZ', y AEAT
  // rechazaba la rectificacion por esa incoherencia. Ahora los paises de la ruta se
  // COMPLETAN con los de los lugares ya calculados, en orden de ruta (carga primero,
  // descarga al final), asi que la regla no puede incumplirse por construccion.
  const paisesLugares = [
    ...lugaresPartida.map(l => l.carga.substring(0, 2)),
    ...lugaresPartida.map(l => l.descarga.substring(0, 2))
  ];
  // Sin itinerario explicito la ruta son los propios paises de carga y descarga; el
  // pais del expedidor solo se usa cuando no hay ni una partida de la que leerlos
  // (si no, un lugar de carga declarado en TR arrastraba un 'CN' de relleno a la ruta).
  const rutaBase = itinerary.length > 0
    ? itinerary
    : (paisesLugares.length > 0
      ? []
      : [goodsItems[0]?.consignor?.country || 'CN', 'ES']);
  const paisDescarga = paisesLugares[paisesLugares.length - 1];
  const ruta = [
    // Los de carga van delante: son el inicio de la ruta.
    ...paisesLugares.slice(0, lugaresPartida.length).filter(p => !rutaBase.includes(p)),
    ...rutaBase,
    ...paisesLugares.slice(lugaresPartida.length).filter(p => !rutaBase.includes(p))
  ].filter((p, i, todos) => p && todos.indexOf(p) === i);
  // El pais de descarga es el destino: si ya venia en la ruta, tiene que cerrarla.
  if (paisDescarga && ruta[ruta.length - 1] !== paisDescarga) {
    ruta.splice(ruta.indexOf(paisDescarga), 1);
    ruta.push(paisDescarga);
  }
  const itiXML = ruta.map(c => `
      <ITI>
        <CouOfRouCodITI1>${c}</CouOfRouCodITI1>
      </ITI>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC313A xmlns:ent="${NS_ENT}">
      <MesSenMES3>${senderEORI || carrierEORI}</MesSenMES3>
      <MesRecMES6>NICA.ES</MesRecMES6>
      <DatOfPreMES9>${prepDate}</DatOfPreMES9>
      <TimOfPreMES10>${prepTime}</TimOfPreMES10>
      <TesIndMES18>${test ? '1' : '0'}</TesIndMES18>
      <MesIdeMES19>${transId.substring(0, 14)}</MesIdeMES19>
      <MesTypMES20>CC313A</MesTypMES20>
      <HEAHEA>
        <DocNumHEA5>${mrn}</DocNumHEA5>
        <TraModAtBorHEA76>${tMode}</TraModAtBorHEA76>
        <IdeOfMeaOfTraCroHEA85>${transportId}</IdeOfMeaOfTraCroHEA85>${tMode !== '2' ? `
        <NatOfMeaOfTraCroHEA87>${transportCountry}</NatOfMeaOfTraCroHEA87>` : ''}
        <TotNumOfIteHEA305>${goodsItems.length || 1}</TotNumOfIteHEA305>
        <TotNumOfPacHEA306>${totalPackages}</TotNumOfPacHEA306>
        <TotGroMasHEA307>${totalGross.toFixed(3)}</TotGroMasHEA307>
        <AmdPlaHEA598>${(amendmentPlace || entryOffice.substring(0, 2) || 'ES').substring(0, 35)}</AmdPlaHEA598>
        <DatTimAmeHEA113>${selloAAAAMMDDHHMM}</DatTimAmeHEA113>
      </HEAHEA>${goodsItemsXML}${itiXML}
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
    </ent:CC313A>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildIE313AmendmentXML };
