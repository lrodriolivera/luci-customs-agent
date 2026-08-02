/**
 * Tests para aeatSubmitService (estaba al 0%).
 *
 * Aqui vive el mapeo entre los datos de LUCI y lo que la AEAT acepta. Varias de
 * estas reglas se descubrieron a base de rechazos reales contra el entorno PRE,
 * no estan en ninguna especificacion legible y no tenian test que las
 * protegiera: un refactor las borraria en silencio y el fallo solo aparecería
 * al presentar una declaracion.
 *
 * Se mockea aeatTransport, asi que no hace falta certificado ni red: lo que se
 * verifica es el XML que se construye, no la conversacion con Hacienda.
 */

jest.mock('../../../src/services/aeat/aeatTransport', () => ({
  sendSoap: jest.fn().mockResolvedValue({
    status: 200,
    data: '<r><CodigoRespuesta>0</CodigoRespuesta><MRN>26ES00280112345678</MRN></r>'
  })
}));

const mockBuildH7 = jest.fn().mockReturnValue('<soap>h7</soap>');
jest.mock('../../../src/services/aeat/h7XmlBuilder', () => ({
  buildH7ImportXML: (...args) => mockBuildH7(...args)
}));

const aeatTransport = require('../../../src/services/aeat/aeatTransport');
const { submitH7 } = require('../../../src/services/aeat/aeatSubmitService');

/** Declaracion H7 minima con los campos que consume el builder. */
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

const TENANT_STRIX = { businessInfo: { eori: 'ESB22477020' }, companyName: 'STRIX AI SL' };

/** Argumentos con los que se llamo al builder de XML. */
const argsBuilder = () => mockBuildH7.mock.calls[0][0];

/** Respuesta OK de AEAT, con MRN. */
const RESPUESTA_OK = {
  status: 200,
  data: '<r><CodigoRespuesta>0</CodigoRespuesta><MRN>26ES00280112345678</MRN></r>'
};

describe('aeatSubmitService.submitH7', () => {
  beforeEach(() => {
    // clearAllMocks tambien borra los valores de retorno, asi que hay que
    // reponerlos aqui o sendSoap devolveria undefined.
    jest.clearAllMocks();
    aeatTransport.sendSoap.mockResolvedValue(RESPUESTA_OK);
    mockBuildH7.mockReturnValue('<soap>h7</soap>');
  });

  describe('formaRepresentacion (rechazo real de AEAT)', () => {
    test("usa '1' cuando declarante e importador son el mismo NIF", async () => {
      // AEAT rechaza la representacion indirecta ('2') si quien declara es el
      // propio importador. Es el caso de STRIX declarando en nombre propio.
      await submitH7(h7({ recipientTaxId: 'B22477020' }), TENANT_STRIX);
      expect(argsBuilder().formaRepresentacion).toBe('1');
    });

    test('ignora el prefijo ES al comparar los NIF', async () => {
      // El EORI del tenant lleva 'ES' delante y el taxId del importador no;
      // sin normalizar pareceran distintos y se enviaria '2', que AEAT rechaza.
      await submitH7(h7({ recipientTaxId: 'ESB22477020' }), TENANT_STRIX);
      expect(argsBuilder().formaRepresentacion).toBe('1');
    });

    test("usa '2' cuando declara en nombre de un tercero", async () => {
      await submitH7(h7({ recipientTaxId: 'B12345678' }), TENANT_STRIX);
      expect(argsBuilder().formaRepresentacion).toBe('2');
    });

    test('un valor explicito manda sobre el calculo automatico', async () => {
      await submitH7(h7({ recipientTaxId: 'B22477020', formaRepresentacion: '2' }), TENANT_STRIX);
      expect(argsBuilder().formaRepresentacion).toBe('2');
    });
  });

  describe('declarante', () => {
    test('prefiere el EORI del tenant sobre su NIF', async () => {
      await submitH7(h7(), { businessInfo: { eori: 'ESB22477020', nif: 'B22477020' } });
      expect(argsBuilder().declaranteNIF).toBe('ESB22477020');
    });

    test('cae al NIF del tenant si no hay EORI', async () => {
      await submitH7(h7(), { businessInfo: { nif: 'B22477020' } });
      expect(argsBuilder().declaranteNIF).toBe('B22477020');
    });
  });

  describe('entorno', () => {
    const previo = process.env.AEAT_ENVIRONMENT;
    afterEach(() => { process.env.AEAT_ENVIRONMENT = previo; });

    test("test:true salvo que AEAT_ENVIRONMENT sea exactamente 'production'", async () => {
      // Presentar contra produccion tiene efectos legales reales: cualquier
      // valor que no sea 'production' debe quedarse en el entorno de pruebas.
      process.env.AEAT_ENVIRONMENT = 'test';
      await submitH7(h7(), TENANT_STRIX);
      expect(argsBuilder().test).toBe(true);
    });

    test('solo production baja el flag de test', async () => {
      process.env.AEAT_ENVIRONMENT = 'production';
      await submitH7(h7(), TENANT_STRIX);
      expect(argsBuilder().test).toBe(false);
    });
  });

  describe('aduana de despacho', () => {
    test('quita el prefijo ES del codigo de aduana', async () => {
      await submitH7(h7({ customsOffice: 'ES002801' }), TENANT_STRIX);
      expect(argsBuilder().aduanaDespacho).toBe('002801');
    });

    test('usa 002801 cuando no se indica aduana', async () => {
      await submitH7(h7({ customsOffice: undefined }), TENANT_STRIX);
      expect(argsBuilder().aduanaDespacho).toBe('002801');
    });
  });

  describe('partidas', () => {
    test('mapea los items al formato del builder', async () => {
      await submitH7(h7(), TENANT_STRIX);
      const [p] = argsBuilder().partidas;
      expect(p.taricCode).toBe('6109100010');
      expect(p.valorFactura).toBe(25);
      expect(p.paisOrigen).toBe('CN');
    });

    test('adjunta N380 (factura) por defecto a cada partida', async () => {
      // Sin documento asociado la AEAT rechaza la partida.
      await submitH7(h7(), TENANT_STRIX);
      expect(argsBuilder().partidas[0].documentos[0].tipo).toBe('N380');
    });

    test('el derecho fijo del Reg. UE 2026/382 esta desactivado por defecto', async () => {
      // Preparado en el builder pero NO activo: activarlo cambia lo que paga el
      // destinatario, y esa decision no debe colarse por un valor por defecto.
      await submitH7(h7(), TENANT_STRIX);
      expect(argsBuilder().aplicarDerechoFijo2026).toBe(false);
    });
  });

  describe('envio y respuesta', () => {
    test('postea al endpoint de despacho simplificado', async () => {
      await submitH7(h7(), TENANT_STRIX);
      const [, endpoint] = aeatTransport.sendSoap.mock.calls[0];
      expect(endpoint).toContain('DeclaSimpliImporV1SOAP');
    });

    test('extrae el MRN de la respuesta de AEAT', async () => {
      const r = await submitH7(h7(), TENANT_STRIX);
      expect(r.success).toBe(true);
      expect(r.mrn).toBe('26ES00280112345678');
    });

    test('marca fallo y conserva el error cuando AEAT rechaza', async () => {
      aeatTransport.sendSoap.mockResolvedValueOnce({
        status: 200,
        data: '<r><CodigoRespuesta>9</CodigoRespuesta><DescripcionError>EORI no valido</DescripcionError></r>'
      });

      const r = await submitH7(h7(), TENANT_STRIX);

      expect(r.success).toBe(false);
      expect(r.error).toBe('EORI no valido');
      expect(r.mrn).toBeNull();
    });
  });
});
