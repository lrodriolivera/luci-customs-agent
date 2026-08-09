/**
 * ensRiskParser — traduce los mensajes de RIESGO que AEAT envia sobre una ENS ya
 * registrada a la forma que consume ensService.processRiskResponse().
 *
 * Por que existe: el CC328A solo acusa el REGISTRO de la ENS. El circuito
 * (ACK / HOLD / DNL) llega despues, en un mensaje aparte y asincrono. Hasta ahora
 * `processRiskResponse` era el unico camino legitimo para escribir
 * `riskAssessment` y NO TENIA NINGUN LLAMANTE, asi que el circuito se quedaba en
 * PENDING para siempre (y un bloque [DEMO] se inventaba un ACK, ver da7241d).
 *
 * Se comprobo empiricamente contra PRE que NO se puede sacar por consulta:
 * `ConsultaImportacionV2` con un MRN de ENS devuelve CodigoRespuesta 9 /
 * CodigoError 6020 "No existe importación con la referencia solicitada" — es un
 * canal de declaraciones de importacion H1. De ahi que la via sea la ingesta del
 * mensaje que AEAT deposita, no un polling inventado.
 *
 * Sin mocks: el parser es una funcion pura sobre string XML.
 */

const { parseENSRiskMessage } = require('../../../src/services/aeat/ensRiskParser');

// Sobres reales del canal enswsv5, con el namespace repetido en cada hijo del
// body tal y como los emite AEAT (por eso los regex llevan [^>]*).
const NS = 'https://www3.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/aden/enswsv5/CC351ASal.xsd';

const sobre = (cuerpo) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>${cuerpo}</soapenv:Body>
</soapenv:Envelope>`;

describe('parseENSRiskMessage', () => {

  // ---------- DNL: el caso que no puede fallar ----------

  describe('CC351A (Do Not Load)', () => {
    const dnl = sobre(`
      <ie:CC351A xmlns:ie="${NS}">
        <HEAHEA>
          <DocNumHEA5>26ES009999Z0000750</DocNumHEA5>
          <RisAnaResHEA1>DNL</RisAnaResHEA1>
          <RisAnaMotHEA2>Mercancia sujeta a verificacion previa a la carga</RisAnaMotHEA2>
        </HEAHEA>
      </ie:CC351A>`);

    test('reconoce el mensaje y extrae el MRN', () => {
      const r = parseENSRiskMessage(dnl);
      expect(r.recognised).toBe(true);
      expect(r.messageType).toBe('CC351A');
      expect(r.mrn).toBe('26ES009999Z0000750');
    });

    test('un CC351A es SIEMPRE do-not-load, con status DNL', () => {
      const r = parseENSRiskMessage(dnl);
      expect(r.risk.status).toBe('DNL');
      expect(r.risk.dnl).toBe(true);
      expect(r.risk.dnlReason).toMatch(/verificacion previa a la carga/i);
    });

    test('sin motivo explicito sigue siendo DNL (no degrada a ACK)', () => {
      const r = parseENSRiskMessage(sobre(`
        <ie:CC351A xmlns:ie="${NS}">
          <HEAHEA><DocNumHEA5>26ES009999Z0000751</DocNumHEA5></HEAHEA>
        </ie:CC351A>`));
      expect(r.risk.status).toBe('DNL');
      expect(r.risk.dnl).toBe(true);
    });
  });

  // ---------- Control documental / fisico ----------

  describe('CC324A (decision de control)', () => {
    const control = sobre(`
      <ie:CC324A xmlns:ie="${NS.replace('CC351A', 'CC324A')}">
        <HEAHEA>
          <DocNumHEA5>26ES009999Z0000752</DocNumHEA5>
          <RisAnaResHEA1>HOLD</RisAnaResHEA1>
        </HEAHEA>
        <CONDEC>
          <ConCodCONDEC1>A20</ConCodCONDEC1>
          <ConDesCONDEC2>Control documental</ConDesCONDEC2>
          <ConLimDatCONDEC3>20260815</ConLimDatCONDEC3>
        </CONDEC>
      </ie:CC324A>`);

    test('mapea el estado a HOLD', () => {
      const r = parseENSRiskMessage(control);
      expect(r.messageType).toBe('CC324A');
      expect(r.risk.status).toBe('HOLD');
      expect(r.risk.dnl).toBe(false);
    });

    test('extrae la decision de control con su codigo, descripcion y plazo', () => {
      const r = parseENSRiskMessage(control);
      expect(r.risk.controlDecisions).toHaveLength(1);
      expect(r.risk.controlDecisions[0]).toMatchObject({
        code: 'A20',
        description: 'Control documental'
      });
      // AAAAMMDD -> Date. El dia importa: es el plazo del control.
      expect(r.risk.controlDecisions[0].deadline.toISOString().substring(0, 10)).toBe('2026-08-15');
    });

    test('varias decisiones de control se extraen todas', () => {
      const r = parseENSRiskMessage(sobre(`
        <ie:CC324A xmlns:ie="x">
          <HEAHEA><DocNumHEA5>26ES009999Z0000753</DocNumHEA5><RisAnaResHEA1>HOLD</RisAnaResHEA1></HEAHEA>
          <CONDEC><ConCodCONDEC1>A20</ConCodCONDEC1><ConDesCONDEC2>Documental</ConDesCONDEC2></CONDEC>
          <CONDEC><ConCodCONDEC1>B30</ConCodCONDEC1><ConDesCONDEC2>Escaner</ConDesCONDEC2></CONDEC>
        </ie:CC324A>`));
      expect(r.risk.controlDecisions.map(c => c.code)).toEqual(['A20', 'B30']);
    });
  });

  // ---------- Circuito despejado ----------

  describe('CC328A con analisis de riesgo (ACK)', () => {
    test('un CC328A que SI trae RisAnaResHEA1 vale como analisis', () => {
      const r = parseENSRiskMessage(sobre(`
        <ie:CC328A xmlns:ie="x">
          <HEAHEA>
            <DocNumHEA5>26ES009999Z0000754</DocNumHEA5>
            <RisAnaResHEA1>ACK</RisAnaResHEA1>
          </HEAHEA>
        </ie:CC328A>`));
      expect(r.recognised).toBe(true);
      expect(r.risk.status).toBe('ACK');
      expect(r.risk.dnl).toBe(false);
    });

    /**
     * El nucleo del bug de da7241d: el acuse de registro pelado NO es un analisis
     * de riesgo. Si el parser lo tradujese a ACK volveriamos a fabricar el
     * veredicto, esta vez desde el parser.
     */
    test('un CC328A SIN RisAnaResHEA1 no se acepta como analisis de riesgo', () => {
      const r = parseENSRiskMessage(sobre(`
        <ie:CC328A xmlns:ie="x">
          <HEAHEA><DocNumHEA5>26ES009999Z0000755</DocNumHEA5></HEAHEA>
        </ie:CC328A>`));
      expect(r.recognised).toBe(false);
      expect(r.risk).toBeUndefined();
      expect(r.reason).toMatch(/acuse de registro/i);
    });
  });

  // ---------- Entradas que no debe aceptar ----------

  describe('rechazos', () => {
    test('un mensaje de tipo desconocido no se reconoce', () => {
      const r = parseENSRiskMessage(sobre('<ie:CC999Z xmlns:ie="x"><HEAHEA/></ie:CC999Z>'));
      expect(r.recognised).toBe(false);
      expect(r.mrn).toBeUndefined();
    });

    test('un mensaje de riesgo sin MRN no se reconoce (no hay a quien aplicarlo)', () => {
      const r = parseENSRiskMessage(sobre(`
        <ie:CC351A xmlns:ie="x"><HEAHEA><RisAnaResHEA1>DNL</RisAnaResHEA1></HEAHEA></ie:CC351A>`));
      expect(r.recognised).toBe(false);
      expect(r.reason).toMatch(/MRN/i);
    });

    test.each([[''], [null], [undefined], ['no soy xml']])('entrada invalida (%p) no revienta', (entrada) => {
      const r = parseENSRiskMessage(entrada);
      expect(r.recognised).toBe(false);
    });

    test('un estado de riesgo fuera del enum del modelo no se acepta', () => {
      const r = parseENSRiskMessage(sobre(`
        <ie:CC324A xmlns:ie="x">
          <HEAHEA><DocNumHEA5>26ES009999Z0000756</DocNumHEA5><RisAnaResHEA1>PERO_QUE_ES_ESTO</RisAnaResHEA1></HEAHEA>
        </ie:CC324A>`));
      expect(r.recognised).toBe(false);
      expect(r.reason).toMatch(/PERO_QUE_ES_ESTO/);
    });
  });

  // ---------- Robustez de formato ----------

  test('tolera el namespace repetido en cada hijo y los saltos de linea de AEAT', () => {
    const r = parseENSRiskMessage(`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><ie:CC351A xmlns:ie="${NS}"><HEAHEA xmlns:ie="${NS}"><DocNumHEA5 xmlns:ie="${NS}">26ES009999Z0000757</DocNumHEA5><RisAnaResHEA1>DNL</RisAnaResHEA1></HEAHEA></ie:CC351A></soapenv:Body></soapenv:Envelope>`);
    expect(r.recognised).toBe(true);
    expect(r.mrn).toBe('26ES009999Z0000757');
  });

  test('acepta el cuerpo sin sobre SOAP', () => {
    const r = parseENSRiskMessage(`<ie:CC351A xmlns:ie="x"><HEAHEA><DocNumHEA5>26ES009999Z0000758</DocNumHEA5><RisAnaResHEA1>DNL</RisAnaResHEA1></HEAHEA></ie:CC351A>`);
    expect(r.recognised).toBe(true);
    expect(r.risk.status).toBe('DNL');
  });

  test('un plazo con fecha ilegible deja deadline sin fijar, pero conserva el control', () => {
    const r = parseENSRiskMessage(sobre(`
      <ie:CC324A xmlns:ie="x">
        <HEAHEA><DocNumHEA5>26ES009999Z0000759</DocNumHEA5><RisAnaResHEA1>HOLD</RisAnaResHEA1></HEAHEA>
        <CONDEC><ConCodCONDEC1>A20</ConCodCONDEC1><ConLimDatCONDEC3>NO-ES-FECHA</ConLimDatCONDEC3></CONDEC>
      </ie:CC324A>`));
    expect(r.risk.controlDecisions[0].code).toBe('A20');
    expect(r.risk.controlDecisions[0].deadline).toBeUndefined();
  });
});
