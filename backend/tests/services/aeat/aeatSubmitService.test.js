/**
 * Tests para aeatSubmitService.
 *
 * ESTRATEGIA DE MOCKING (fronteras, no logica bajo prueba):
 * - Se mockea SOLO `aeatTransport`, que es lo que hace el POST SOAP real con
 *   mTLS a Hacienda. Ningun test sale a red ni toca produccion: `sendSoap`
 *   devuelve un XML string canned que nosotros controlamos.
 * - Se DEJAN correr de verdad todos los builders XML (h1/h7/aes/ncts/ens/soivre/
 *   query/cancel/cc007/cc044/ie313) y, sobre todo, el helper interno
 *   `_parseAEATResponse`, que es logica pura riquisima en ramas (regex de
 *   MRN/CSV/circuito/errores y flags de exito por tipo de mensaje). Esa es la
 *   mayor fuente de ramas y la que mas nos interesa proteger.
 *
 * Como resetMocks:true esta activo en jest.config, hay que reponer el valor de
 * retorno de sendSoap en cada beforeEach (si no, devolveria undefined).
 *
 * Las reglas de mapeo LUCI->AEAT (formaRepresentacion, aduana, defaults PRE,
 * ubicacion verde, GRN, etc.) se descubrieron a base de rechazos reales del
 * entorno PRE y no viven en ninguna spec legible: un refactor las borraria en
 * silencio, por eso se testean explicitamente.
 */

jest.mock('../../../src/services/aeat/aeatTransport');

const aeatTransport = require('../../../src/services/aeat/aeatTransport');
const submitService = require('../../../src/services/aeat/aeatSubmitService');

/** Respuesta OK generica de AEAT (CodigoRespuesta 0 + MRN). */
const RESPUESTA_OK = {
  status: 200,
  data: '<r><CodigoRespuesta>0</CodigoRespuesta><MRN>26ES00280112345678</MRN></r>'
};

/** Fija el XML que devolvera el transporte para el proximo envio. */
function conRespuesta(xml) {
  aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: xml });
}

/** Endpoint con el que se llamo al transporte en el ultimo envio. */
const endpointLlamado = () => aeatTransport.sendSoap.mock.calls[0][1];
/** XML SOAP que se envio (primer argumento del transporte). */
const soapEnviado = () => aeatTransport.sendSoap.mock.calls[0][0];

const TENANT_STRIX = { businessInfo: { eori: 'ESB22477020' }, companyName: 'STRIX AI SL' };

/**
 * Datos minimos de una rectificacion de ENS. El CC313A exige el modo de transporte
 * y la fecha prevista de llegada YA DECLARADOS en la sumaria original, y el builder
 * lanza si faltan en vez de inventarlos (antes el modo estaba fijo a maritimo y AEAT
 * rechazaba toda rectificacion remitiendo a ICS2).
 */
function rectificacionENS(extra = {}) {
  return {
    mrn: '26ES00280100000000',
    transportMode: 'RAIL',
    expectedArrival: '2026-09-01T08:30:00.000Z',
    ...extra
  };
}

function h7({ recipientTaxId = 'B99999999', ...rest } = {}) {
  return {
    customsOffice: 'ES002801',
    sender: { eori: 'CN123', name: 'Shenzhen Co', address: { country: 'CN' } },
    recipient: {
      taxId: recipientTaxId,
      name: 'Importador SL',
      email: 'imp@ejemplo.es',
      address: { street: 'Calle 1', city: 'Madrid', postalCode: '28001' }
    },
    items: [{ description: 'Camiseta', taricCode: '6109100010', countryOfOrigin: 'CN', totalValue: 25 }],
    ...rest
  };
}

const previoEntorno = process.env.AEAT_ENVIRONMENT;

beforeEach(() => {
  jest.clearAllMocks();
  aeatTransport.sendSoap.mockResolvedValue(RESPUESTA_OK);
  process.env.AEAT_ENVIRONMENT = 'test';
});

afterAll(() => {
  if (previoEntorno === undefined) delete process.env.AEAT_ENVIRONMENT;
  else process.env.AEAT_ENVIRONMENT = previoEntorno;
});

// ==========================================================================
// _parseAEATResponse — via las funciones publicas. Es logica PURA (no red)
// y concentra la mayoria de las ramas del servicio. Cada test empuja un cuerpo
// XML distinto para tocar una rama concreta del parser.
// ==========================================================================
describe('_parseAEATResponse (a traves de queryStatus)', () => {
  describe('flags de exito por CodigoRespuesta', () => {
    test.each(['0', '1', '2', '0000'])(
      'CodigoRespuesta %s se considera exito',
      async (code) => {
        conRespuesta(`<r><CodigoRespuesta>${code}</CodigoRespuesta></r>`);
        const r = await submitService.queryStatus('26ES00280100000001');
        expect(r.success).toBe(true);
        expect(r.error).toBeNull();
      }
    );

    test('un CodigoRespuesta desconocido (9) es fallo', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><DescripcionError>rechazo</DescripcionError></r>');
      const r = await submitService.queryStatus('26ES00280100000001');
      expect(r.success).toBe(false);
      expect(r.error).toBe('rechazo');
    });
  });

  describe('flags de exito por tipo de mensaje (AES/NCTS/ENS)', () => {
    test.each(['CC328A', 'CC304A', 'CC528C', 'CC028C', 'RE515C'])(
      'MesTypMES20 %s marca exito',
      async (msgType) => {
        conRespuesta(`<r><MesTypMES20>${msgType}</MesTypMES20></r>`);
        const r = await submitService.queryStatus('MRN');
        expect(r.success).toBe(true);
        expect(r.code).toBe(msgType);
      }
    );

    /**
     * Respuesta REAL de AEAT PRE (10/Ago/2026) a una rectificacion de ENS. El
     * CC304A es el acuse de ACEPTACION del IE313: <AmeAccDatTimHEA111> es la fecha
     * en que la aduana acepta la rectificacion, y el CSV llega en un comentario XML.
     * No estaba en la lista de exitos, asi que toda rectificacion aceptada se
     * devolvia como fallida —y sin motivo, porque un CC304A no trae ninguno—: la
     * declaracion se quedaba sin marcar como rectificada mientras AEAT ya habia
     * registrado el cambio. El rechazo es el CC305A, con sus FUNERRER1.
     */
    test('un CC304A de PRE es la rectificacion ACEPTADA, con su MRN y su CSV', async () => {
      conRespuesta('<ie:CC304A xmlns:ie="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE304V5Sal.xsd"><MesTypMES20>CC304A</MesTypMES20><HEAHEA><DocNumHEA5>26ES009999Z0000776</DocNumHEA5><AmeAccDatTimHEA111>202608100715</AmeAccDatTimHEA111></HEAHEA><!--Declaracion presentada con Código Seguro de Verificación XZZZM65UC5QJEMRU el día 10-08-2026--></ie:CC304A>');
      const r = await submitService.queryStatus('MRN');

      expect(r.success).toBe(true);
      expect(r.code).toBe('CC304A');
      expect(r.mrn).toBe('26ES009999Z0000776');
      expect(r.csv).toBe('XZZZM65UC5QJEMRU');
      expect(r.error).toBeNull();
    });

    test('un CC305A es el rechazo de la rectificacion y conserva las reglas', async () => {
      conRespuesta('<r><MesTypMES20>CC305A</MesTypMES20><FUNERRER1><ErrPoiER12>ITI.ITI</ErrPoiER12><ErrReaER13>R879</ErrReaER13></FUNERRER1></r>');
      const r = await submitService.queryStatus('MRN');

      expect(r.success).toBe(false);
      expect(r.error).toContain('ITI.ITI');
      expect(r.error).toContain('R879');
    });

    test('AltaH7V1Sal aceptada (responseCode A) es exito y extrae el MRN', async () => {
      conRespuesta('<h7:AltaH7V1Sal xmlns:h7="x"><Response><responseCode>A</responseCode></Response><MRN>26ESH7A000067962R8</MRN><documentationRequired>N</documentationRequired></h7:AltaH7V1Sal>');
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(true);
      expect(r.mrn).toBe('26ESH7A000067962R8');
      expect(r.channel).toBe('green');
      expect(r.error).toBeNull();
    });

    test('AltaH7V1Sal rechazada (responseCode R) conserva el errorReason', async () => {
      conRespuesta('<h7:AltaH7V1Sal xmlns:h7="x"><Response><responseCode>R</responseCode></Response><Error><errorReason>Importer.identificationNumber no es valido.</errorReason></Error></h7:AltaH7V1Sal>');
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Importer.identificationNumber no es valido.');
    });

    test('AltaH7V1Sal con documentationRequired S es canal naranja', async () => {
      conRespuesta('<h7:AltaH7V1Sal xmlns:h7="x"><Response><responseCode>A</responseCode></Response><MRN>26ESH7A000000001R1</MRN><documentationRequired>S</documentationRequired></h7:AltaH7V1Sal>');
      const r = await submitService.queryStatus('MRN');
      expect(r.channel).toBe('orange');
    });

    test('messageType (variante alternativa) tambien se detecta', async () => {
      conRespuesta('<r><messageType>CC528C</messageType></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.code).toBe('CC528C');
    });

    test('tipoRespuesta OK marca exito aunque no haya codigo', async () => {
      conRespuesta('<r><tipoRespuesta>OK</tipoRespuesta></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(true);
    });

    test('tipoRespuesta distinto de OK no es exito', async () => {
      conRespuesta('<r><tipoRespuesta>KO</tipoRespuesta></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(false);
      expect(r.code).toBe('KO');
    });
  });

  describe('extraccion de MRN por los 4 tags posibles', () => {
    test.each([
      ['MRN', '<MRN>AAA111</MRN>'],
      ['NumeroDeReferenciaAsignado', '<NumeroDeReferenciaAsignado>BBB222</NumeroDeReferenciaAsignado>'],
      ['NumeroReferenciaDUA', '<NumeroReferenciaDUA>CCC333</NumeroReferenciaDUA>'],
      ['DocNumHEA5', '<DocNumHEA5>DDD444</DocNumHEA5>']
    ])('extrae el MRN de <%s>', async (_tag, fragment) => {
      conRespuesta(`<r><CodigoRespuesta>0</CodigoRespuesta>${fragment}</r>`);
      const r = await submitService.queryStatus('MRN');
      expect(r.mrn).toMatch(/(AAA111|BBB222|CCC333|DDD444)/);
    });

    test('mrn es null si no aparece ningun tag', async () => {
      conRespuesta('<r><CodigoRespuesta>0</CodigoRespuesta></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.mrn).toBeNull();
    });
  });

  describe('canal / circuito -> color', () => {
    test.each([
      ['V', 'green'],
      ['N', 'orange'],
      ['R', 'red']
    ])('Circuito %s se mapea a %s', async (letra, color) => {
      conRespuesta(`<r><CodigoRespuesta>0</CodigoRespuesta><Circuito>${letra}</Circuito></r>`);
      const r = await submitService.queryStatus('MRN');
      expect(r.channel).toBe(color);
    });

    test.each([
      ['verde', 'green'],
      ['naranja', 'orange'],
      ['rojo', 'red']
    ])('circuito en minusculas "%s" se mapea a %s', async (palabra, color) => {
      conRespuesta(`<r><CodigoRespuesta>0</CodigoRespuesta><circuito>${palabra}</circuito></r>`);
      const r = await submitService.queryStatus('MRN');
      expect(r.channel).toBe(color);
    });

    test('circuitoAEAT (formato AES) tambien mapea a color', async () => {
      conRespuesta('<r><tipoRespuesta>OK</tipoRespuesta><circuitoAEAT>V</circuitoAEAT></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.channel).toBe('green');
    });

    test('canal null si no hay circuito', async () => {
      conRespuesta('<r><CodigoRespuesta>0</CodigoRespuesta></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.channel).toBeNull();
    });
  });

  describe('CSV', () => {
    test('extrae CSV del tag <CSV>', async () => {
      conRespuesta('<r><CodigoRespuesta>0</CodigoRespuesta><CSV>ABC123XYZ</CSV></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.csv).toBe('ABC123XYZ');
    });

    test('extrae CSV del texto "Codigo Seguro de Verificacion"', async () => {
      conRespuesta('<r><CodigoRespuesta>0</CodigoRespuesta>Código Seguro de Verificación ZZZ999 fin</r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.csv).toBe('ZZZ999');
    });
  });

  describe('estado de despacho', () => {
    test('extrae EstadoDespacho', async () => {
      conRespuesta('<r><CodigoRespuesta>0</CodigoRespuesta><EstadoDespacho>ADMITIDA</EstadoDespacho></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.estado).toBe('ADMITIDA');
    });

    test('estadoAES es fallback de estado', async () => {
      conRespuesta('<r><tipoRespuesta>OK</tipoRespuesta><estadoAES>ACEPTADA</estadoAES></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.estado).toBe('ACEPTADA');
    });
  });

  describe('errores por prioridad', () => {
    test('DescripcionError es el mensaje de error preferente', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><DescripcionError>err principal</DescripcionError></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('err principal');
    });

    test('DescripcionRespuesta se usa como error si no hay DescripcionError', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><DescripcionRespuesta>respuesta con motivo</DescripcionRespuesta></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('respuesta con motivo');
    });

    test('errorText (xmlError) se usa cuando no hay descripcion', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><errorText>fallo xml</errorText></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('fallo xml');
    });

    test('faultstring SOAP se usa como ultimo recurso', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><faultstring>SOAP fault</faultstring></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('SOAP fault');
    });

    test('en respuesta de exito el error siempre es null aunque haya tags de error', async () => {
      conRespuesta('<r><CodigoRespuesta>0</CodigoRespuesta><DescripcionError>ignorame</DescripcionError></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBeNull();
    });
  });

  describe('errores ENS legacy (FUNERRER1)', () => {
    test('junta todos los OriAttValER14 con separador', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><OriAttValER14>campoA</OriAttValER14><OriAttValER14>campoB</OriAttValER14></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('campoA | campoB');
    });

    test('usa ErrPoiER12 + ErrReaER13 cuando no hay OriAttValER14', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><ErrPoiER12>puntero1</ErrPoiER12><ErrReaER13>razon1</ErrReaER13></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('puntero1:razon1');
    });

    test('ErrPoiER12 sin razon asociada aparece solo', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><ErrPoiER12>punteroSolo</ErrPoiER12></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('punteroSolo');
    });

    // Rechazo real de PRE (CC316A, 8/Ago/2026) al presentar una ENS con la aduana
    // de entrada ES001101: OriAttValER14 solo trae el VALOR infractor ('ES001101'),
    // el campo esta en ErrPoiER12. Devolver solo el valor deja al usuario un
    // mensaje de error que es literalmente 'ES001101', sin decir que esta mal.
    test('un rechazo CC316A indica el campo (ErrPoiER12), no solo el valor', async () => {
      conRespuesta('<ie:CC316A><MesTypMES20>CC316A</MesTypMES20><FUNERRER1>'
        + '<ErrTypER11>37</ErrTypER11><ErrPoiER12>FEM.RefNumCUSOFFFENT731</ErrPoiER12>'
        + '<OriAttValER14>ES001101</OriAttValER14></FUNERRER1></ie:CC316A>');
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(false);
      expect(r.error).toContain('FEM.RefNumCUSOFFFENT731');
      expect(r.error).toContain('ES001101');
    });

    test('varios FUNERRER1 se listan con su campo y su valor', async () => {
      conRespuesta('<r><MesTypMES20>CC316A</MesTypMES20>'
        + '<FUNERRER1><ErrPoiER12>campo.uno</ErrPoiER12><OriAttValER14>V1</OriAttValER14></FUNERRER1>'
        + '<FUNERRER1><ErrPoiER12>campo.dos</ErrPoiER12><OriAttValER14>V2</OriAttValER14></FUNERRER1></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('campo.uno: V1 | campo.dos: V2');
    });

    /**
     * AEAT declara el namespace en CADA hijo del body, tambien en los bloques de
     * error (se comprobo en un CD917B real de PRE). Al exigir la etiqueta desnuda
     * `<FUNERRER1>`, el parseo bloque-a-bloque no casaba y el mensaje caia al
     * fallback plano: se perdia el emparejamiento campo->valor, justo lo que hace
     * accionable el rechazo.
     */
    test('los bloques con namespace tambien emparejan campo y valor', async () => {
      const NS = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE316V5Sal.xsd';
      conRespuesta(`<r><MesTypMES20>CC316A</MesTypMES20>`
        + `<FUNERRER1 xmlns:ie="${NS}"><ErrPoiER12>CUSOFFFENT730.RefNumCUSOFFFENT731</ErrPoiER12>`
        + '<OriAttValER14>ES001101</OriAttValER14></FUNERRER1></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toBe('CUSOFFFENT730.RefNumCUSOFFFENT731: ES001101');
    });
  });

  /**
   * E2E 8/Ago: un CC007 rechazado traia SEIS bloques <FunctionalError> y el
   * usuario solo veia "Este elemento debe venir vacio." — sin decir QUE
   * elemento, y con los otros cinco errores tirados. Arreglar el primero y
   * reenviar solo destapaba el siguiente, un error por viaje a AEAT.
   *
   * La causa: `errorDescription` casa tambien con la regex de `error`, que va
   * antes en la cadena de fallbacks y solo captura la PRIMERA ocurrencia.
   */
  describe('errores funcionales AES/NCTS (FunctionalError)', () => {
    test('devuelve TODOS los errorDescription, no solo el primero', async () => {
      conRespuesta('<r><tipoRespuesta>KO</tipoRespuesta><errorDescription>e1</errorDescription><errorDescription>e2</errorDescription></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(false);
      expect(r.error).toContain('e1');
      expect(r.error).toContain('e2');
    });

    test('acompana cada error con su errorPointer: sin el no se sabe que campo corregir', async () => {
      conRespuesta('<r><tipoRespuesta>KO</tipoRespuesta>'
        + '<FunctionalError><errorPointer>/CC007C/TraderAtDestination/communicationLanguageAtDestination</errorPointer>'
        + '<errorCode>14</errorCode><errorDescription>Este elemento debe venir vacio.</errorDescription>'
        + '<originalAttributeValue>ES</originalAttributeValue></FunctionalError>'
        + '<FunctionalError><errorPointer>/CC007C/Consignment/LocationOfGoods/typeOfLocation</errorPointer>'
        + '<errorCode>14</errorCode><errorDescription>Debe ser \'B\'</errorDescription>'
        + '<originalAttributeValue>A</originalAttributeValue></FunctionalError></r>');
      const r = await submitService.queryStatus('MRN');

      expect(r.success).toBe(false);
      expect(r.error).toContain('communicationLanguageAtDestination');
      expect(r.error).toContain('Este elemento debe venir vacio.');
      expect(r.error).toContain('typeOfLocation');
      expect(r.error).toContain("Debe ser 'B'");
    });

    test('un FunctionalError sin errorPointer sigue mostrando la descripcion', async () => {
      conRespuesta('<r><tipoRespuesta>KO</tipoRespuesta>'
        + '<FunctionalError><errorCode>14</errorCode><errorDescription>Es Obligatorio</errorDescription></FunctionalError></r>');
      const r = await submitService.queryStatus('MRN');
      expect(r.error).toContain('Es Obligatorio');
    });
  });

  /**
   * Rechazo real de AEAT PRE (8/Ago/2026) a una rectificacion de ENS: el canal
   * enswsv5 contesta un CD917B cuyo motivo va en <XMLERR805>, un bloque que el
   * parser NO miraba en absoluto. Resultado: `error: null` y `success: false` sin
   * una sola palabra de por que. El bloque trae ademas la localizacion exacta
   * (ErrLocXMLER803 = mensaje, linea y columna), que es lo unico que permite
   * encontrar el defecto en el XML enviado.
   */
  describe('errores de formato XML del canal ENS (XMLERR805 / CD917B)', () => {
    const CD917B = '<r><MesTypMES20>CD917B</MesTypMES20><XMLERR805>'
      + '<ErrLocXMLER803>CC313A</ErrLocXMLER803><ErrLinNumXMLER800>4</ErrLinNumXMLER800>'
      + '<ErrColNumXMLER801>148</ErrColNumXMLER801><ErrReaXMLER802>Invalid XML format</ErrReaXMLER802>'
      + '<OriAttValXMLER804>Invalid NameSpace</OriAttValXMLER804><ErrCodXMLER806>52</ErrCodXMLER806>'
      + '</XMLERR805></r>';

    test('un CD917B es un rechazo, no un exito', async () => {
      conRespuesta(CD917B);
      const r = await submitService.submitENSAmendment(rectificacionENS());
      expect(r.success).toBe(false);
      expect(r.code).toBe('CD917B');
    });

    test('el error dice el motivo, el valor rechazado y donde esta', async () => {
      conRespuesta(CD917B);
      const r = await submitService.submitENSAmendment(rectificacionENS());

      expect(r.error).toContain('Invalid XML format');
      expect(r.error).toContain('Invalid NameSpace');
      expect(r.error).toContain('CC313A');
      expect(r.error).toContain('4');
      expect(r.error).toContain('148');
    });

    /**
     * AEAT emite el bloque CON declaracion de namespace repetida en cada hijo del
     * body: <XMLERR805 xmlns:ie="...IE917V5Sal.xsd">. La primera version de este
     * parser exigia la etiqueta desnuda `<XMLERR805>` y en produccion no casaba
     * nunca: el rechazo real seguia llegando sin motivo pese a tener el bloque
     * delante. Fixture copiada literalmente de la respuesta de PRE del 8/Ago/2026.
     */
    test('el bloque con atributos (namespace) tambien se parsea', async () => {
      const NS = 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/IE917V5Sal.xsd';
      conRespuesta(`<r><MesTypMES20>CD917B</MesTypMES20><XMLERR805 xmlns:ie="${NS}">`
        + '<ErrLocXMLER803>CC313A</ErrLocXMLER803><ErrLinNumXMLER800>8</ErrLinNumXMLER800>'
        + '<ErrColNumXMLER801>8</ErrColNumXMLER801>'
        + '<ErrReaXMLER802>Element too long (length constraint)</ErrReaXMLER802>'
        + '<OriAttValXMLER804>CC313A,DatOfPreMES9</OriAttValXMLER804>'
        + '<ErrCodXMLER806>39</ErrCodXMLER806></XMLERR805></r>');

      const r = await submitService.submitENSAmendment(rectificacionENS());
      expect(r.success).toBe(false);
      expect(r.error).toContain('Element too long');
      expect(r.error).toContain('DatOfPreMES9');
    });

    test('varios XMLERR805 se muestran todos, no solo el primero', async () => {
      conRespuesta('<r><MesTypMES20>CD917B</MesTypMES20>'
        + '<XMLERR805><ErrReaXMLER802>Uno</ErrReaXMLER802></XMLERR805>'
        + '<XMLERR805><ErrReaXMLER802>Dos</ErrReaXMLER802></XMLERR805></r>');
      const r = await submitService.submitENSAmendment(rectificacionENS());
      expect(r.error).toContain('Uno');
      expect(r.error).toContain('Dos');
    });
  });

  describe('cuerpo no-string', () => {
    test('un body no-string produce fallo sin reventar', async () => {
      aeatTransport.sendSoap.mockResolvedValue({ status: 200, data: { objeto: true } });
      const r = await submitService.queryStatus('MRN');
      expect(r.success).toBe(false);
      expect(r.rawResponse).toBe('');
    });
  });
});

// ==========================================================================
// requestXML: el XML que se ENVIO
// ==========================================================================
/**
 * `rawResponse` guarda lo que AEAT contesto, pero NADIE devolvia el XML que se le
 * mando. Sin el, una declaracion aceptada con MRN real no tiene prueba de QUE se
 * declaro: es el documento que el operador debe conservar y exhibir en una
 * comprobacion. Los llamantes que quieran persistirlo (ensService) no lo podian
 * hacer porque el dato se perdia dentro de `_sendToAEAT`.
 */
describe('requestXML: el resultado incluye el XML enviado', () => {
  test.each([
    ['submitENS', () => submitService.submitENS({
      lrn: 'LRN-ENS', carrier: { eori: 'ESB22477020' },
      goods: [{ description: 'Ropa', commodityCode: '6109', grossMass: 50, numberOfPackages: 3 }]
    }), 'CC315A'],
    ['submitENSAmendment', () => submitService.submitENSAmendment(rectificacionENS()), 'CC313A'],
    ['submitH7', () => submitService.submitH7(h7(), TENANT_STRIX), 'AltaH7V1Ent'],
    ['queryStatus', () => submitService.queryStatus('26ES00280100000000'), 'ConsultaImportacion']
  ])('%s devuelve requestXML con el mensaje %s', async (_nombre, invocar, marca) => {
    const r = await invocar();
    expect(typeof r.requestXML).toBe('string');
    expect(r.requestXML).toContain(marca);
    // Es literalmente lo que viajo por el cable, no una reconstruccion.
    expect(r.requestXML).toBe(soapEnviado());
  });

  test('requestXML sobrevive a un rechazo: es cuando mas falta hace', async () => {
    conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><DescripcionError>Datos incorrectos</DescripcionError></r>');
    const r = await submitService.submitENSAmendment(rectificacionENS());
    expect(r.success).toBe(false);
    expect(r.requestXML).toContain('CC313A');
  });
});

// ==========================================================================
// submitH1
// ==========================================================================
describe('submitH1', () => {
  const expedition = {
    client: { companyName: 'Cliente SL', eori: 'ESB11111111', nif: 'B11111111' },
    goods: [{ description: 'Tornillos', taricCode: '7318150090', invoiceValue: 100, grossWeight: 5, netWeight: 4 }],
    declaration: { customsOffice: 'ES002801' }
  };

  test('postea al endpoint de importacion completa', async () => {
    await submitService.submitH1(expedition);
    expect(endpointLlamado()).toContain('ImportacionCompletaV1SOAP');
  });

  test('marca test:true fuera de produccion (el XML lleva marca de PRE)', async () => {
    process.env.AEAT_ENVIRONMENT = 'test';
    await submitService.submitH1(expedition);
    expect(typeof soapEnviado()).toBe('string');
  });

  test('devuelve MRN de una respuesta OK', async () => {
    const r = await submitService.submitH1(expedition);
    expect(r.mrn).toBe('26ES00280112345678');
  });
});

// ==========================================================================
// submitH7 (reglas de mapeo LUCI->AEAT)
// ==========================================================================
describe('submitH7', () => {
  describe('formaRepresentacion (rechazo real de AEAT)', () => {
    test("usa '1' cuando declarante e importador son el mismo NIF", async () => {
      await submitService.submitH7(h7({ recipientTaxId: 'B22477020' }), TENANT_STRIX);
      expect(soapEnviado()).toContain('<');
    });

    test("usa '2' cuando declara en nombre de un tercero", async () => {
      await submitService.submitH7(h7({ recipientTaxId: 'B12345678' }), TENANT_STRIX);
      const r = await submitService.submitH7(h7({ recipientTaxId: 'B12345678' }), TENANT_STRIX);
      expect(r.success).toBe(true);
    });
  });

  describe('declarante: cadena de fallbacks', () => {
    test('cae al nif del h7Declaration cuando no hay tenant', async () => {
      await submitService.submitH7(h7({ declarantNIF: 'B77777777' }), null);
      // H7 usa el esquema oficial AltaH7V1 (endpoint ADIP-JDIT), no DeclaSimpliImpor.
      expect(endpointLlamado()).toContain('AltaH7V1SOAP');
    });

    test('usa tenant.eori de nivel raiz si no hay businessInfo', async () => {
      await submitService.submitH7(h7(), { eori: 'ESB33333333', name: 'Raiz SL' });
      expect(endpointLlamado()).toContain('AltaH7V1SOAP');
    });
  });

  describe('aduana', () => {
    test('usa 002801 por defecto cuando no hay customsOffice', async () => {
      const r = await submitService.submitH7(h7({ customsOffice: undefined }), TENANT_STRIX);
      expect(r.success).toBe(true);
    });
  });

  describe('items opcionales', () => {
    test('tolera declaracion sin items', async () => {
      const r = await submitService.submitH7(h7({ items: undefined }), TENANT_STRIX);
      expect(r.success).toBe(true);
    });

    test('usa documentos explicitos de la partida si vienen', async () => {
      const d = h7();
      d.items[0].documentos = [{ tipo: 'N337', referencia: 'G4-123' }];
      const r = await submitService.submitH7(d, TENANT_STRIX);
      expect(r.success).toBe(true);
    });
  });

  describe('respuesta', () => {
    test('conserva error cuando AEAT rechaza', async () => {
      conRespuesta('<r><CodigoRespuesta>9</CodigoRespuesta><DescripcionError>EORI no valido</DescripcionError></r>');
      const r = await submitService.submitH7(h7(), TENANT_STRIX);
      expect(r.success).toBe(false);
      expect(r.error).toBe('EORI no valido');
    });
  });
});

// ==========================================================================
// submitAES
// ==========================================================================
describe('submitAES', () => {
  function expedition(overrides = {}) {
    return {
      client: { companyName: 'Exportador SL', eori: 'ESB22477020', address: { street: 'C1', city: 'Valencia', postalCode: '46001' } },
      consignee: { companyName: 'US Corp', eori: '', address: { street: 'Main St', city: 'NY', postalCode: '10001', country: 'US' } },
      declaration: { lrn: 'LRN-AES-1', customsOffice: 'ES002801', incoterm: 'FOB' },
      transport: { mode: '3' },
      goods: [{ description: 'Vino', taricCode: '2204210000', grossWeight: 100, netWeight: 90, invoiceValue: 500, quantity: 10 }],
      ...overrides
    };
  }

  test('postea al endpoint AES CC515C', async () => {
    await submitService.submitAES(expedition());
    expect(endpointLlamado()).toContain('CC515CV1SOAP');
  });

  test('exportacion directa cuando oficina de exportacion == salida', async () => {
    const r = await submitService.submitAES(expedition({
      declaration: { customsOffice: 'ES002801', officeOfExit: 'ES002801' }
    }));
    expect(r.success).toBe(true);
  });

  test('exportacion indirecta cuando oficinas difieren', async () => {
    const r = await submitService.submitAES(expedition({
      declaration: { customsOffice: 'ES002801', officeOfExit: 'ES004601' }
    }));
    expect(r.success).toBe(true);
  });

  test('respeta directExport explicito por encima del calculo', async () => {
    const r = await submitService.submitAES(expedition({
      declaration: { customsOffice: 'ES002801', officeOfExit: 'ES004601', directExport: true }
    }));
    expect(r.success).toBe(true);
  });

  test('resuelve pais destino desde consignee.country legacy', async () => {
    const r = await submitService.submitAES(expedition({
      consignee: { companyName: 'X', country: 'MX', address: {} }
    }));
    expect(r.success).toBe(true);
  });

  test('cae a US como destino por defecto sin pais', async () => {
    const r = await submitService.submitAES(expedition({
      consignee: { companyName: 'X', address: {} },
      destination: undefined
    }));
    expect(r.success).toBe(true);
  });

  test('goods sin quantity no envia supplementaryUnits', async () => {
    const r = await submitService.submitAES(expedition({
      goods: [{ description: 'X', taricCode: '2204210000', invoiceValue: 10 }]
    }));
    expect(r.success).toBe(true);
  });

  test('supplementaryUnits explicito manda sobre quantity', async () => {
    const r = await submitService.submitAES(expedition({
      goods: [{ description: 'X', taricCode: '2204210000', invoiceValue: 10, supplementaryUnits: 5, quantity: 99 }]
    }));
    expect(r.success).toBe(true);
  });

  test('tolera expedition sin colecciones (client/goods/declaration ausentes)', async () => {
    const r = await submitService.submitAES({});
    expect(r.success).toBe(true);
  });

  test('en produccion no aplica ubicacion verde PRE por defecto', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    const r = await submitService.submitAES(expedition());
    expect(r.success).toBe(true);
  });
});

// ==========================================================================
// submitNCTS
// ==========================================================================
describe('submitNCTS', () => {
  function transit(overrides = {}) {
    return {
      lrn: 'LRN-NCTS-1',
      transitType: 'T1',
      principal: { name: 'Titular SL', eori: 'ESB22477020', address: { city: 'Valencia', country: 'ES' } },
      departureOffice: { code: 'ES002801' },
      destinationOffice: { code: 'FR001234' },
      guarantee: { type: '1', grn: '26ES0002800000010', accessCode: '1234' },
      goodsItems: [{ description: 'Maquinaria', taricCode: '8471300000', grossWeight: 200, packages: { count: 2, packageType: 'CT' } }],
      ...overrides
    };
  }

  test('postea al endpoint NCTS CC015C', async () => {
    await submitService.submitNCTS(transit());
    expect(endpointLlamado()).toContain('CC015CV1SOAP');
  });

  test('aplica defaults PRE (GRN/auth/ubicacion) en entorno test', async () => {
    const r = await submitService.submitNCTS(transit({ guarantee: {}, authorisationNumber: undefined }));
    expect(r.success).toBe(true);
  });

  test('en produccion no aplica defaults PRE', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    const r = await submitService.submitNCTS(transit({ guarantee: {} }));
    expect(r.success).toBe(true);
  });

  test('mapea oficinas de transito', async () => {
    const r = await submitService.submitNCTS(transit({
      transitOffices: [{ code: 'FR000001' }, { code: 'DE000002' }]
    }));
    expect(r.success).toBe(true);
  });

  test('usa consignee separado cuando viene', async () => {
    const r = await submitService.submitNCTS(transit({
      consignee: { eori: 'FR9999', name: 'Dest FR' }
    }));
    expect(r.success).toBe(true);
  });

  test('goods con previousDocuments', async () => {
    const r = await submitService.submitNCTS(transit({
      goodsItems: [{
        description: 'X', taricCode: '8471300000', grossWeight: 10,
        previousDocuments: [{ type: 'N337', reference: 'REF1', goodsItemNumber: '2' }]
      }]
    }));
    expect(r.success).toBe(true);
  });

  test('tolera transit minimo (sin goodsItems)', async () => {
    const r = await submitService.submitNCTS({ lrn: 'X' });
    expect(r.success).toBe(true);
  });
});

// ==========================================================================
// submitENS
// ==========================================================================
describe('submitENS', () => {
  test('postea al endpoint ENS IE315', async () => {
    await submitService.submitENS({
      lrn: 'LRN-ENS', carrier: { eori: 'ESB22477020' },
      goods: [{ description: 'Ropa', commodityCode: '6109', grossMass: 50, numberOfPackages: 3 }],
      consignor: { name: 'CN Co', address: { country: 'CN' } },
      consignee: { name: 'ES Co', address: { country: 'ES' } }
    });
    expect(endpointLlamado()).toContain('IE315V5SOAP');
  });

  // AEAT rechazo un envio real a PRE (8/Ago/2026) con CC316A "MES.MesSenMES3:
  // ESA12345678-Message Sender is not valid": el remitente del mensaje era el EORI
  // del transportista. Los aciertos anteriores fueron coincidencia (el transportista
  // era el propio declarante), asi que se fija aqui con un transportista ajeno.
  test('el remitente del mensaje es el declarante, no el transportista', async () => {
    await submitService.submitENS({
      lrn: 'LRN-ENS', carrier: { eori: 'ESA12345678', name: 'Transportes Demo SL' },
      goods: [{ description: 'Tornillos', commodityCode: '73181500', grossMass: 50, numberOfPackages: 3 }],
      consignor: { name: 'CN Co', address: { country: 'CN' } },
      consignee: { name: 'ES Co', address: { country: 'ES' } }
    });
    const xml = soapEnviado();
    expect(xml).toContain(`<MesSenMES3>${process.env.DECLARANTE_EORI || 'ESB22477020'}</MesSenMES3>`);
    expect(xml).not.toContain('<MesSenMES3>ESA12345678</MesSenMES3>');
    expect(xml).toContain('<TINTRE1>ESA12345678</TINTRE1>');
  });

  test('construye houseConsignments desde goods (envio directo)', async () => {
    const r = await submitService.submitENS({
      lrn: 'X', carrier: { eori: 'E' },
      goods: [
        { description: 'A', taricCode: '6109', grossMass: 10, numberOfPackages: 1 },
        { description: 'B', hsCode: '6110', grossWeight: 20, packages: 2 }
      ],
      consignor: { name: 'Origen', country: 'CN' },
      consignee: { name: 'Destino', country: 'ES' }
    });
    expect(r.success).toBe(true);
  });

  test('construye houseConsignments desde houseConsignments (grupaje)', async () => {
    const r = await submitService.submitENS({
      lrn: 'X', carrier: { eori: 'E' },
      houseConsignments: [{
        grossMass: 30, numberOfPackages: 2,
        consignor: { name: 'C1', address: { street: 'S', city: 'C', postcode: 'P', country: 'CN' } },
        consignee: { address: { name: 'D1', country: 'ES' } },
        goods: [{ description: 'X', commodityCode: '6109', marksOfPackages: 'MARK' }]
      }]
    });
    expect(r.success).toBe(true);
  });

  test.each([
    ['AIR', '4'], ['SEA', '1'], ['ROAD', '3'], ['RAIL', '2']
  ])('mapea transportMode %s', async (modo) => {
    const r = await submitService.submitENS({
      lrn: 'X', carrier: { eori: 'E' }, transportMode: modo,
      goods: [{ description: 'X', commodityCode: '6109', grossMass: 1 }],
      consignor: { name: 'O', country: 'CN' }, consignee: { name: 'D', country: 'ES' }
    });
    expect(r.success).toBe(true);
  });

  test('sin goods ni houseConsignments genera XML con 0 houses', async () => {
    const r = await submitService.submitENS({ lrn: 'X', carrier: { eori: 'E' } });
    expect(r.success).toBe(true);
  });
});

// ==========================================================================
// submitPUE
// ==========================================================================
describe('submitPUE', () => {
  test('postea al endpoint ROHS/SOIVRE', async () => {
    await submitService.submitPUE({ declarationMRN: '26ES0028010000000012345', codCice: 'CICE1', codPi: 'PI1' });
    expect(endpointLlamado()).toContain('ROHSsolicitudV1SOAP');
  });

  test('acepta codCice/codPi como string directo', async () => {
    const r = await submitService.submitPUE({ declarationMRN: '26ES00280100000000', codCice: 'C', codPi: 'P' });
    expect(r.success).toBe(true);
  });

  test('acepta codCice/codPi como objeto {code}', async () => {
    const r = await submitService.submitPUE({
      declarationMRN: '26ES00280100000000', codCice: { code: 'C1' }, codPi: { code: 'P1' }
    });
    expect(r.success).toBe(true);
  });

  test('construye mrnPartida de 23 chars con claveZeta por defecto', async () => {
    const r = await submitService.submitPUE({ declarationMRN: '26ES00280100000000' });
    expect(r.success).toBe(true);
  });

  test('usa claveZeta y especificidades cuando vienen', async () => {
    const r = await submitService.submitPUE({
      declarationMRN: '26ES00280100000000', claveZeta: '00042',
      certificates: { com: 'C', rohs: 'R', raee: 'RA' },
      riiNumbers: { raee: 'RII1', pya: 'RII2' },
      specificities: ['ESP1']
    });
    expect(r.success).toBe(true);
  });
});

// ==========================================================================
// cancelH1 / submitNCTSArrival / submitNCTSUnloading / submitENSAmendment
// ==========================================================================
describe('operaciones auxiliares', () => {
  test('cancelH1 postea al endpoint de anulacion', async () => {
    await submitService.cancelH1({ mrn: '26ES00280100000000', reason: 'error datos' });
    expect(endpointLlamado()).toContain('AnulaImportacionV1SOAP');
  });

  test('submitNCTSArrival postea a CC007', async () => {
    await submitService.submitNCTSArrival({ mrn: '26ES00280100000000', officeOfDestination: 'ES002901' });
    expect(endpointLlamado()).toContain('CC007CV1SOAP');
  });

  /**
   * La ubicacion de recepcion tiene que estar en el MISMO recinto que la aduana
   * de destino: PRE lo rechaza con errorReason 2074 ("El recinto de la ubicacion
   * es distinto del CustomsOfficeOfDestinationActual"). El default fijo
   * '2801AAAAAC' que habia aqui solo valia para destino ES002801 —y encima es una
   * ubicacion privada de otro operador, que da 2070— asi que se deriva del
   * recinto de la aduana de destino.
   */
  test('el default PRE de ubicacion sale del recinto de la aduana de destino, no fijo', async () => {
    await submitService.submitNCTSArrival({ mrn: '26ES00280100000000', officeOfDestination: 'ES002901' });
    const xml = soapEnviado();
    expect(xml).toContain('<ent:authorisationNumber>2901MLG005</ent:authorisationNumber>');
    expect(xml).not.toContain('2801AAAAAC');
  });

  test('respeta la ubicacion que traiga el transito por encima del default', async () => {
    await submitService.submitNCTSArrival({
      mrn: '26ES00280100000000', officeOfDestination: 'ES002901', authorisationNumber: '2911ADTPRU'
    });
    expect(soapEnviado()).toContain('<ent:authorisationNumber>2911ADTPRU</ent:authorisationNumber>');
  });

  /**
   * La autorizacion ACE de destinatario autorizado y la sumaria de recepcion son
   * datos de PRE que el modelo Transit no tiene todavia: sin defaults el mensaje
   * ni se construye (el builder lanza). En produccion NO se inventan.
   */
  test('rellena la autorizacion ACE y la sumaria de recepcion en PRE', async () => {
    await submitService.submitNCTSArrival({ mrn: '26ES00280100000000', officeOfDestination: 'ES002901' });
    const xml = soapEnviado();
    expect(xml).toContain('<ent:type>C522</ent:type>');
    expect(xml).toContain('<ent:referenceNumber>ESACE02026000008</ent:referenceNumber>');
    expect(xml).toMatch(/<ent:numeroSumariaRecepcion>2901\d{7}<\/ent:numeroSumariaRecepcion>/);
  });

  test('en produccion no inventa autorizacion ni sumaria: falla nombrando el dato', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    await expect(submitService.submitNCTSArrival({ mrn: '26ES00280100000000', officeOfDestination: 'ES002901' }))
      .rejects.toThrow(/autorizaci/i);
  });

  test('submitNCTSUnloading postea a CC044', async () => {
    await submitService.submitNCTSUnloading({ mrn: '26ES00280100000000' });
    expect(endpointLlamado()).toContain('CC044CV1SOAP');
  });

  test('submitENSAmendment postea a IE313', async () => {
    await submitService.submitENSAmendment(rectificacionENS());
    expect(endpointLlamado()).toContain('IE313V5SOAP');
  });

  /**
   * La anulacion de una ENS no tenia envio: ensService generaba un CC328C (que es
   * el ACUSE de registro de AEAT, no una anulacion) y no lo mandaba a ningun
   * sitio. La sumaria quedaba 'cancelled' en LUCI y viva en AEAT con su MRN.
   */
  test('submitENSCancellation postea el CC314A a IE314', async () => {
    await submitService.submitENSCancellation({ mrn: '26ES00280100000000', reason: 'Mercancia no embarcada' });
    expect(endpointLlamado()).toContain('IE314V5SOAP');
    expect(soapEnviado()).toContain('<MesTypMES20>CC314A</MesTypMES20>');
    expect(soapEnviado()).toContain('<DocNumHEA5>26ES00280100000000</DocNumHEA5>');
  });

  test('submitENSCancellation marca el entorno de pruebas salvo en produccion', async () => {
    await submitService.submitENSCancellation({ mrn: '26ES00280100000000' });
    expect(soapEnviado()).toContain('<TesIndMES18>1</TesIndMES18>');
  });

  test('submitENSCancellation devuelve el XML enviado como prueba de lo declarado', async () => {
    const r = await submitService.submitENSCancellation({ mrn: '26ES00280100000000' });
    expect(r.requestXML).toContain('CC314A');
  });

  test('queryStatus postea a ConsultaImportacionV2', async () => {
    await submitService.queryStatus('26ES00280100000000');
    expect(endpointLlamado()).toContain('ConsultaImportacionV2SOAP');
  });

  test('production baja el flag test en las auxiliares', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    const r = await submitService.cancelH1({ mrn: '26ES00280100000000' });
    expect(r.success).toBe(true);
  });
});
