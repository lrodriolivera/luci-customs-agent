/**
 * Declarante y representante de la declaracion (casilla 14 del DUA), para que
 * la pantalla de representacion (RepresentationCard, frontend) muestre quien
 * es el declarante antes de generar el H1. Usa las MISMAS funciones puras que
 * el generador del H1 CAU (declarantePara, formaRepresentacionDe), para que
 * nunca diverja de lo que de verdad se presenta a la AEAT.
 *
 * UAT 13/Nov/2026 (Patricia) + correccion del coordinador: una version previa
 * recalculaba la regla en el frontend leyendo el EORI del tenant directamente,
 * y ese campo puede llegar cifrado ("v1:...") si el hook de descifrado no se
 * aplica. Con este endpoint el calculo vive una sola vez en el backend, con
 * las funciones que ya descifran correctamente (identificadorAduanero.js).
 */
const express = require('express');
const request = require('supertest');

const mockExpedition = { findById: jest.fn() };
const mockTenant = { findById: jest.fn() };

jest.mock('../../src/models', () => ({ Expedition: mockExpedition, ChatMessage: { find: jest.fn() } }));
jest.mock('../../src/models/Tenant', () => mockTenant);
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({}));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/divisas/tiposCambioOficiales', () => ({
  tipoOficial: jest.fn(),
  aEuros: jest.requireActual('../../src/services/divisas/tipoCambioAduanero').aEuros
}));
jest.mock('../../src/services/channelService', () => ({}));
jest.mock('../../src/services/emailService', () => ({}));
jest.mock('../../src/services/customs', () => ({ CustomsServiceFactory: {} }));

const declarationController = require('../../src/controllers/declarationController');

const USER = { _id: 'u1', name: 'Tester', tenantId: 't1' };

function expediente(extra = {}) {
  return {
    _id: 'e1', tenantId: 't1',
    client: { companyName: 'Importador SA', eori: 'ESX99999999' },
    ...extra
  };
}

function app() {
  const a = express();
  a.use(express.json());
  const usuario = (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); };
  a.get('/api/declarations/:expeditionId/declarante', usuario, declarationController.getDeclarante);
  return a;
}

beforeEach(() => jest.clearAllMocks());

describe('declarante y representante de la declaracion', () => {
  test('representacion indirecta: el declarante es la propia agencia', async () => {
    mockTenant.findById.mockReturnValue({ lean: async () => ({ businessInfo: {} }) });
    mockExpedition.findById.mockResolvedValue(expediente({
      representative: { companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'indirect' }
    }));

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      declarante: { companyName: 'Agencia SL', eori: 'ESB22477020' },
      representante: null,
      forma: '3'
    });
  });

  test('representacion directa: declarante es el importador y la agencia sale como representante', async () => {
    mockTenant.findById.mockReturnValue({ lean: async () => ({ businessInfo: {} }) });
    mockExpedition.findById.mockResolvedValue(expediente({
      representative: { companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'direct' }
    }));

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      declarante: { companyName: 'Importador SA', eori: 'ESX99999999' },
      representante: { companyName: 'Agencia SL', eori: 'ESB22477020' },
      forma: '2'
    });
  });

  test('autodespacho (mismo EORI que el declarante): el declarante es el importador y no hay representante', async () => {
    mockTenant.findById.mockReturnValue({ lean: async () => ({ businessInfo: {} }) });
    mockExpedition.findById.mockResolvedValue(expediente({
      client: { companyName: 'Importador SA', eori: 'ESB22477020' },
      representative: { companyName: 'Importador SA', eori: 'ESB22477020', representationType: 'indirect' }
    }));

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      declarante: { companyName: 'Importador SA', eori: 'ESB22477020' },
      representante: null,
      forma: '1'
    });
  });

  test('sin representative, cae al EORI del tenant (customsConfig antes que businessInfo)', async () => {
    mockTenant.findById.mockReturnValue({
      lean: async () => ({
        name: 'Agencia del Tenant',
        businessInfo: { eori: 'ESOTRONOUSAR' },
        customsConfig: { eoriNumbers: { ES: 'ESB22477020' } }
      })
    });
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(200);
    expect(res.body.data.declarante).toEqual({ companyName: 'Agencia del Tenant', eori: 'ESB22477020' });
  });

  test('si el EORI del tenant llega cifrado (sin descifrar), nunca se devuelve tal cual', async () => {
    // _claro() de identificadorAduanero.js ya descarta un valor que sigue
    // cifrado tras intentar descifrarlo; este test es la red de seguridad del
    // endpoint para que, pase lo que pase, jamas salga un "v1:..." por la API.
    mockTenant.findById.mockReturnValue({
      lean: async () => ({ name: 'Agencia del Tenant', businessInfo: { eori: 'v1:dDADHsinDescifrar' } })
    });
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('EORI del representante');
  });

  test('sin EORI del representante ni del tenant responde 422 diciendo donde completarlo', async () => {
    mockTenant.findById.mockReturnValue({ lean: async () => ({ businessInfo: {} }) });
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('EORI del representante');
    expect(res.body.code).toBe('EORI_FALTANTE');
  });

  test('expediente de otro tenant devuelve 404', async () => {
    mockExpedition.findById.mockResolvedValue(expediente({ tenantId: 'otro-tenant' }));

    const res = await request(app()).get('/api/declarations/e1/declarante');

    expect(res.status).toBe(404);
  });
});
