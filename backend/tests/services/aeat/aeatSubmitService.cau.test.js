/**
 * aeatSubmitService y el H1 CAU: qué servicio toca, cómo se prepara el mensaje
 * (identificador, LRN, modo test) y cómo se envía.
 */
const mockSendSoap = jest.fn();
jest.mock('../../../src/services/aeat/aeatTransport', () => ({ sendSoap: (...a) => mockSendSoap(...a), loadCertificate: jest.fn(), getBaseUrl: jest.fn() }));
jest.mock('../../../src/services/divisas/tiposCambioOficiales', () => ({
  tipoOficial: async () => ({ divisa: 'USD', tipo: 1.1234, mes: '2026-11', fuente: 'BCE' }),
  aEuros: jest.requireActual('../../../src/services/divisas/tipoCambioAduanero').aEuros
}));

const servicio = require('../../../src/services/aeat/aeatSubmitService');
const { ENDPOINT_CC415A } = require('../../../src/services/aeat/h1CauXmlBuilder');

const TENANT = {
  companyName: 'Agencia SL', customsConfig: { eoriNumbers: { ES: 'ESB22477020' } },
  primaryContact: { name: 'Ana Ruiz', phone: '+34 910000000', email: 'aduanas@agencia.es' }
};
const expediente = () => ({
  expeditionId: 'EXP-2026-AAAA0001', transportMode: 'maritime',
  client: { nif: 'B12345674', eori: 'ESB12345674', address: { postalCode: '46001', country: 'ES' } },
  exporter: { companyName: 'Shenzhen Textiles Ltd', address: '1 Test Road', city: 'Shanghai', country: 'CN' },
  incoterm: { code: 'CIF', place: 'Valencia' },
  transport: { vehicleNationality: 'PA', documentType: 'BL', documentNumber: 'MSCU20268198800',
    summaryDeclaration: { item: '1', aeat: { mrn: '26ES00280180000014', location: '2801AAAAAA' } } },
  declaration: { customsOffice: 'ES002801', invoiceNumber: 'FAC-1' },
  goods: [{ description: 'Sábanas', taricCode: '6302100000', originCountry: 'CN', grossWeight: 994, netWeight: 900, invoiceValue: 10000,
    currency: 'USD', dutyRate: 12, vatRate: 21, packages: { quantity: 89, type: 'CT' } }]
});
const AHORA = new Date('2026-11-12T09:30:00.123Z');
const entorno = process.env.AEAT_ENVIRONMENT;
const elegido = process.env.AEAT_H1_SERVICE;

afterEach(() => {
  process.env.AEAT_ENVIRONMENT = entorno;
  if (elegido === undefined) delete process.env.AEAT_H1_SERVICE; else process.env.AEAT_H1_SERVICE = elegido;
  mockSendSoap.mockReset();
});

describe('servicio del H1', () => {
  test('por defecto sigue el DUA anterior; se activa por tenant o por entorno', () => {
    delete process.env.AEAT_H1_SERVICE;
    expect(servicio.servicioH1({})).toBe('precau');
    expect(servicio.servicioH1({ customsConfig: { h1Service: 'cau' } })).toBe('cau');
    process.env.AEAT_H1_SERVICE = 'cau';
    expect(servicio.servicioH1({})).toBe('cau');
    // Lo configurado en el tenant manda sobre el entorno.
    expect(servicio.servicioH1({ customsConfig: { h1Service: 'precau' } })).toBe('precau');
    process.env.AEAT_H1_SERVICE = 'otro';
    expect(servicio.servicioH1({})).toBe('precau');
  });
});

describe('preparar el H1 CAU', () => {
  test('genera identificador de mensaje y LRN propios, sin blancos y dentro del tamaño admitido', async () => {
    const p = await servicio.prepararH1Cau(expediente(), { tenant: TENANT, ahora: AHORA });

    expect(p.lrn).toBe('LUCI261112093000123');
    expect(p.lrn.length).toBeLessThanOrEqual(22);
    expect(p.messageId).toMatch(/^LUCI261112093000123\d{4}$/);
    expect(p.requestXML).toContain(`<messageIdentification>${p.messageId}</messageIdentification>`);
    expect(p.requestXML).toContain('<LRN>LUCI261112093000123</LRN>');
    expect(p.preparedAt).toBe(AHORA);
  });

  test('fuera de producción va en modo test; en producción, no', async () => {
    process.env.AEAT_ENVIRONMENT = 'test';
    expect((await servicio.prepararH1Cau(expediente(), { tenant: TENANT })).requestXML).toContain('<testIndicator>S</testIndicator>');
    process.env.AEAT_ENVIRONMENT = 'production';
    expect((await servicio.prepararH1Cau(expediente(), { tenant: TENANT })).requestXML).not.toContain('testIndicator');
  });

  test('convierte la factura en divisa con el tipo oficial y toma el contacto del tenant', async () => {
    const { requestXML } = await servicio.prepararH1Cau(expediente(), { tenant: TENANT });

    expect(requestXML).toContain('<invoiceCurrency>USD</invoiceCurrency>');
    expect(requestXML).toContain('<statisticalValue>8901.55</statisticalValue>');
    expect(requestXML).toContain('<phoneNumber>+34 910000000</phoneNumber>');
  });

  test('si faltan datos no prepara nada (422 con la lista)', async () => {
    const sinTelefono = { ...TENANT, primaryContact: { name: 'Ana Ruiz', email: 'aduanas@agencia.es' } };
    await expect(servicio.prepararH1Cau(expediente(), { tenant: sinTelefono })).rejects.toMatchObject({
      status: 422, code: 'DATOS_H1_FALTANTES', faltan: ['teléfono de la persona de contacto del declarante']
    });
  });
});

describe('enviar el H1 CAU', () => {
  test('envía al servicio CC415AV1 y devuelve la respuesta interpretada con el XML enviado', async () => {
    mockSendSoap.mockResolvedValue({ data: '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><es:CC415AV1Sal xmlns:es="x"><CC415R><ACK><ImportOperation><LRN>L1</LRN><MRN>26ES002801I01BMDR0</MRN></ImportOperation></ACK></CC415R></es:CC415AV1Sal></env:Body></env:Envelope>' });

    const r = await servicio.enviarH1Cau('<soap>mensaje</soap>');

    expect(mockSendSoap).toHaveBeenCalledWith('<soap>mensaje</soap>', ENDPOINT_CC415A);
    expect(r).toMatchObject({ success: true, mrn: '26ES002801I01BMDR0', requestXML: '<soap>mensaje</soap>' });
  });
});
