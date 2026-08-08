/**
 * NCTS Arrival Notification XML Builder (CC007C)
 * Schema: CC007CV1Ent.xsd
 * Endpoint: /wlpl/ADTR-JDIT/ws/ncts5/CC007CV1SOAP
 * elementFormDefault: qualified - ALL children need ent: prefix
 *
 * Sent when goods arrive at the office of destination in a transit operation.
 */

const NS_ENT = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC007CV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';

// indicadorTipoSumaria: el XSD solo dice "string maxLength 2" y el codelist no
// esta publicado en ningun esquema. Se barrieron 45 candidatos contra PRE (N, G4,
// DS, DT, SD, ST, 01..11, A..Y, IM, EX, ...) y todos dieron errorReason 2066.
// Los dos unicos valores validos los delataron las reglas condicionales vecinas:
//   2067 - Si el indicador es 'SP', numeroSumariaRecepcion es obligatorio.
//   2068 - Si el indicador es 'GP', el grupo G4Previos es obligatorio.
// 'SP' = sumaria previa de recepcion, el caso normal de un transito que termina
// en un deposito temporal. 'GP' = G4 previo, para mercancia que ya venia en un G4.
const TIPO_SUMARIA_DEFECTO = 'SP';

// Con simplifiedProcedure 1 AEAT exige el bloque Authorisation (errorReason 1440)
// y el tipo tiene que ser C522 (destinatario autorizado): el C521 del IE015
// (expedidor autorizado) lo rechaza con CL236 "no se encuentra en la tabla
// CSRDT236". La referencia debe ser una ACE cuyo titular sea el TraderAtDestination.
const TIPO_AUTORIZACION_DESTINATARIO = 'C522';

// PRE rechaza el procedimiento normal (0) en cuanto la ubicacion es un lugar
// autorizado —el unico typeOfLocation que admite— con errorReason 1415.
const PROCEDIMIENTO_SIMPLIFICADO_DEFECTO = '1';

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
 * Normaliza una fecha al DateTimeType del NCTS (`AAAA-MM-DDThh:mm:ss`).
 *
 * Los llamantes pasan de todo: un Date de Mongoose, un ISO completo con
 * milisegundos y zona, o el AAAAMMDD que usaba la version anterior de este
 * builder. El pattern del XSD no admite ni la Z ni los milisegundos, asi que
 * cualquier entrada se recorta a los 19 primeros caracteres del ISO.
 */
function toDateTime(valor) {
  if (!valor) return new Date().toISOString().substring(0, 19);
  if (valor instanceof Date) return valor.toISOString().substring(0, 19);
  const texto = String(valor);
  // AAAAMMDD (formato antiguo): se le pone la hora a medianoche.
  if (/^\d{8}$/.test(texto)) {
    return `${texto.substring(0, 4)}-${texto.substring(4, 6)}-${texto.substring(6, 8)}T00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${texto}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(texto)) return texto.substring(0, 19);
  const fecha = new Date(texto);
  return isNaN(fecha) ? new Date().toISOString().substring(0, 19) : fecha.toISOString().substring(0, 19);
}

/**
 * Construir XML para notificacion de llegada NCTS
 *
 * La estructura sigue el sequence de CC007CType (ES_CC007C_v515.xsd): grupo
 * MESSAGE, TransitOperation, [Authorisation], CustomsOfficeOfDestinationActual,
 * TraderAtDestination, [RepresentanteEnDestino], Indicadores007, Consignment.
 * El orden es normativo: un elemento correcto fuera de sitio da el mismo error
 * 1207 que uno ausente.
 *
 * @param {Object} data
 * @param {string} data.mrn - MRN del transito
 * @param {string} data.officeOfDestination - Codigo aduana destino (ES + 6 chars)
 * @param {string|Date} data.arrivalDate - Fecha llegada (se normaliza a DateTimeType)
 * @param {string} data.traderEORI - EORI del destinatario
 * @param {string} data.traderName - Nombre del destinatario
 * @param {string} data.simplifiedProcedure - Flag procedimiento simplificado (0/1)
 * @param {string} data.incidentFlag - Flag de incidencias en ruta (0/1)
 * @param {string} data.tipoSumaria - Indicador de tipo de sumaria: 'SP' o 'GP'
 * @param {string} data.numeroSumariaRecepcion - Sumaria previa, obligatoria con 'SP'
 * @param {string} data.mrnG4Previo - MRN del G4 previo, obligatorio con 'GP'
 * @param {string} data.authorisationNumber - Numero de autorizacion del lugar (obligatorio)
 * @param {string} data.authorisationReference - Autorizacion ACE de destinatario autorizado
 * @param {boolean} data.test - Entorno de pruebas
 */
function buildCC007ArrivalXML(data) {
  const {
    mrn = '',
    officeOfDestination = '',
    arrivalDate = '',
    traderEORI = '',
    traderName = '',
    simplifiedProcedure = PROCEDIMIENTO_SIMPLIFICADO_DEFECTO,
    incidentFlag = '0',
    tipoSumaria = TIPO_SUMARIA_DEFECTO,
    numeroSumariaRecepcion = '',
    mrnG4Previo = '',
    authorisationNumber = '',
    authorisationReference = '',
    test = true
  } = data;

  // Los tres datos siguientes los marca el XSD como minOccurs="0" pero AEAT los
  // exige por regla de negocio. Se falla aqui, donde el mensaje puede nombrar el
  // dato, en vez de mandar un XML que rebotara sin decir por que.

  // errorReason 1658 "Es Obligatorio" en cuanto typeOfLocation es B.
  if (!authorisationNumber) {
    throw new Error('CC007: falta el numero de autorizacion del lugar de la mercancia (authorisationNumber)');
  }
  // errorReason 1440 "la autorizacion debe venir rellena" con simplifiedProcedure 1.
  const esSimplificado = String(simplifiedProcedure) === '1';
  if (esSimplificado && !authorisationReference) {
    throw new Error('CC007: el procedimiento simplificado exige la autorizacion ACE de destinatario autorizado (authorisationReference)');
  }
  // errorReason 2067 / 2068: cada indicador exige su companero.
  if (tipoSumaria === 'SP' && !numeroSumariaRecepcion) {
    throw new Error("CC007: el indicador de tipo de sumaria 'SP' exige el numero de sumaria de recepcion (numeroSumariaRecepcion)");
  }
  if (tipoSumaria === 'GP' && !mrnG4Previo) {
    throw new Error("CC007: el indicador de tipo de sumaria 'GP' exige el MRN del G4 previo (mrnG4Previo)");
  }

  const transId = generateTransactionId();
  const prepDate = toDateTime(arrivalDate);

  // 2068 dice "si no, no debe venir": cada companero solo acompana a su indicador.
  const referenciaPrevia = tipoSumaria === 'GP'
    ? `
          <ent:G4Previos>
            <ent:sequenceNumber>1</ent:sequenceNumber>
            <ent:mrnG4Previo>${mrnG4Previo}</ent:mrnG4Previo>
          </ent:G4Previos>`
    : `
          <ent:numeroSumariaRecepcion>${numeroSumariaRecepcion}</ent:numeroSumariaRecepcion>`;

  const bloqueAutorizacion = esSimplificado
    ? `
        <ent:Authorisation>
          <ent:sequenceNumber>1</ent:sequenceNumber>
          <ent:type>${TIPO_AUTORIZACION_DESTINATARIO}</ent:type>
          <ent:referenceNumber>${authorisationReference}</ent:referenceNumber>
        </ent:Authorisation>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}">
  <soapenv:Body>
    <ent:CC007CV1Ent xmlns:ent="${NS_ENT}" Id="${transId}">
      <ent:CC007C>
        <ent:messageSender>${traderEORI}</ent:messageSender>
        <ent:messageRecipient>NTA.ES</ent:messageRecipient>
        <ent:preparationDateAndTime>${prepDate}</ent:preparationDateAndTime>
        <ent:messageIdentification>${transId}</ent:messageIdentification>
        <ent:messageType>CC007C</ent:messageType>
        <ent:TransitOperation>
          <ent:MRN>${mrn}</ent:MRN>
          <ent:arrivalNotificationDateAndTime>${prepDate}</ent:arrivalNotificationDateAndTime>
          <ent:simplifiedProcedure>${simplifiedProcedure}</ent:simplifiedProcedure>
          <ent:incidentFlag>${incidentFlag}</ent:incidentFlag>
        </ent:TransitOperation>${bloqueAutorizacion}
        <ent:CustomsOfficeOfDestinationActual>
          <ent:referenceNumber>${officeOfDestination}</ent:referenceNumber>
        </ent:CustomsOfficeOfDestinationActual>
        <ent:TraderAtDestination>
          <ent:identificationNumber>${traderEORI}</ent:identificationNumber>
        </ent:TraderAtDestination>
        <ent:Indicadores007>
          <ent:indicadorTipoSumaria>${tipoSumaria}</ent:indicadorTipoSumaria>${referenciaPrevia}
        </ent:Indicadores007>
        <ent:Consignment>
          <ent:LocationOfGoods>
            <ent:typeOfLocation>B</ent:typeOfLocation>
            <ent:qualifierOfIdentification>Y</ent:qualifierOfIdentification>
            <ent:authorisationNumber>${authorisationNumber}</ent:authorisationNumber>
          </ent:LocationOfGoods>
        </ent:Consignment>
      </ent:CC007C>
    </ent:CC007CV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildCC007ArrivalXML };
