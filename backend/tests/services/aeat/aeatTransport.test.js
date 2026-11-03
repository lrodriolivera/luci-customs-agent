/**
 * Tests para aeatTransport.sendSoap: verificacion del certificado del servidor.
 *
 * Contra la AEAT real (AEAT_ENVIRONMENT=production) el agente TLS debe
 * verificar siempre el certificado del servidor; si no, cualquiera en la ruta
 * de red podria suplantar a Hacienda y devolver MRN/circuito falsos.
 *
 * Se mockean las fronteras (fs, node-forge, https, axios, logger) con funciones
 * planas: resetMocks:true en jest.config vaciaria las implementaciones de jest.fn.
 * Ningun test sale a red ni lee el certificado real.
 */

const mockPosts = [];

jest.mock('fs', () => ({
  existsSync: () => true,
  readFileSync: () => 'p12'
}));

jest.mock('node-forge', () => ({
  asn1: { fromDer: () => ({}) },
  util: { createBuffer: () => ({}) },
  pkcs12: {
    pkcs12FromAsn1: () => ({
      getBags: ({ bagType }) => ({ [bagType]: [{ cert: {}, key: {} }] })
    })
  },
  pki: {
    oids: { certBag: 'certBag', pkcs8ShroudedKeyBag: 'pkcs8ShroudedKeyBag' },
    certificateToPem: () => 'CERT-PEM',
    privateKeyToPem: () => 'KEY-PEM'
  }
}));

jest.mock('https', () => ({
  Agent: function Agent(options) {
    this.options = options;
  }
}));

jest.mock('axios', () => ({
  post: async (url, body, config) => {
    mockPosts.push({ url, config });
    return { status: 200, data: '<ok/>' };
  }
}));

jest.mock('../../../src/config/logger', () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
}));

const { sendSoap } = require('../../../src/services/aeat/aeatTransport');

const PROD_BASE_URL = 'https://www1.agenciatributaria.gob.es';
const PRE_BASE_URL = 'https://prewww1.aeat.es';
const ENDPOINT = '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP';

const previoEntorno = process.env.AEAT_ENVIRONMENT;

beforeEach(() => {
  mockPosts.length = 0;
});

afterAll(() => {
  if (previoEntorno === undefined) delete process.env.AEAT_ENVIRONMENT;
  else process.env.AEAT_ENVIRONMENT = previoEntorno;
});

describe('aeatTransport.sendSoap - verificacion TLS del servidor', () => {
  test('en produccion verifica el certificado del servidor AEAT', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';

    await sendSoap('<soap/>', ENDPOINT);

    expect(mockPosts).toHaveLength(1);
    expect(mockPosts[0].url).toBe(PROD_BASE_URL + ENDPOINT);
    expect(mockPosts[0].config.httpsAgent.options.rejectUnauthorized).toBe(true);
  });

  test('en produccion mantiene el certificado cliente para mTLS', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';

    await sendSoap('<soap/>', ENDPOINT);

    const { options } = mockPosts[0].config.httpsAgent;
    expect(options.cert).toBe('CERT-PEM');
    expect(options.key).toBe('KEY-PEM');
  });

  test.each(['test', 'simulation', undefined])(
    'fuera de produccion (%s) solo se relaja la verificacion contra el host PRE',
    async (entorno) => {
      if (entorno === undefined) delete process.env.AEAT_ENVIRONMENT;
      else process.env.AEAT_ENVIRONMENT = entorno;

      await sendSoap('<soap/>', ENDPOINT);

      expect(mockPosts[0].url).toBe(PRE_BASE_URL + ENDPOINT);
      expect(mockPosts[0].config.httpsAgent.options.rejectUnauthorized).toBe(false);
    }
  );
});
