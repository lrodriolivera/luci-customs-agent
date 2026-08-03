/**
 * Aislamiento por tenant en los listados.
 *
 * Sexto punto ciego del barrido: hasta ahora se habian revisado los accesos por
 * id (findById y variantes), pero no las CONSULTAS DE LISTA. Tres endpoints
 * construian su filtro sin tenantId y devolvian datos de todos los clientes:
 *
 *   - GET /api/requirements ............ requerimientos de AEAT de cualquiera
 *   - GET /api/paraduanero ............. controles paraduaneros de cualquiera
 *   - GET /api/declarations/h7/stats ... estadisticas agregadas sobre TODAS
 *                                        las expediciones del sistema
 *
 * Hoy solo hay un tenant en produccion, asi que no se notaba; con un segundo
 * cliente cada uno habria visto los datos del otro. oeaService.list ya habia
 * adelantado este patron.
 */

const request = require('supertest');
const express = require('express');

const mockRequirement = { find: jest.fn(), countDocuments: jest.fn() };
const mockControl = { find: jest.fn(), countDocuments: jest.fn() };
const mockExpedition = { find: jest.fn() };

jest.mock('../../src/models/Requirement', () => mockRequirement);
jest.mock('../../src/models/Expedition', () => mockExpedition);
jest.mock('../../src/models', () => ({
  Requirement: mockRequirement,
  ParaduaneroControl: mockControl,
  Expedition: mockExpedition
}));
jest.mock('../../src/services/aeat/aeatRealService', () => ({}));
jest.mock('../../src/services/aeat/certificateService', () => ({}));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/paraduaneroService', () => ({}));

const TENANT_A = '6a5769e0b11d798e7e783602';
const USER = { _id: '6a5769e0b11d798e7e783607', tenantId: TENANT_A };

/** find(...).populate().sort().skip().limit() encadenable. */
function cadena(resultado = []) {
  const c = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(resultado),
    lean: jest.fn().mockResolvedValue(resultado)
  };
  return c;
}

function app(handler) {
  const a = express();
  a.use(express.json());
  a.get('/r', (req, _res, next) => { req.user = USER; req.tenantId = TENANT_A; next(); }, handler);
  return a;
}

describe('listados: aislamiento por tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /requirements acota el filtro al tenant del usuario', async () => {
    mockRequirement.find.mockReturnValue(cadena());
    mockRequirement.countDocuments.mockResolvedValue(0);
    const ctrl = require('../../src/controllers/requirementController');

    await request(app(ctrl.getRequirements)).get('/r');

    const [filtro] = mockRequirement.find.mock.calls[0];
    expect(filtro.tenantId).toBe(TENANT_A);
  });

  test('los filtros de negocio conviven con el de tenant', async () => {
    mockRequirement.find.mockReturnValue(cadena());
    mockRequirement.countDocuments.mockResolvedValue(0);
    const ctrl = require('../../src/controllers/requirementController');

    await request(app(ctrl.getRequirements)).get('/r?status=pending&channel=orange');

    const [filtro] = mockRequirement.find.mock.calls[0];
    expect(filtro.tenantId).toBe(TENANT_A);
    expect(filtro.status).toBe('pending');
    expect(filtro.channel).toBe('orange');
  });

  test('el tenant no se puede sobrescribir por query string', async () => {
    mockRequirement.find.mockReturnValue(cadena());
    mockRequirement.countDocuments.mockResolvedValue(0);
    const ctrl = require('../../src/controllers/requirementController');

    await request(app(ctrl.getRequirements)).get('/r?tenantId=otro');

    const [filtro] = mockRequirement.find.mock.calls[0];
    expect(filtro.tenantId).toBe(TENANT_A);
  });

  test('GET /paraduanero acota el filtro al tenant', async () => {
    mockControl.find.mockReturnValue(cadena());
    mockControl.countDocuments.mockResolvedValue(0);
    const ctrl = require('../../src/controllers/paraduaneroController');

    await request(app(ctrl.list)).get('/r');

    const [filtro] = mockControl.find.mock.calls[0];
    expect(filtro.tenantId).toBe(TENANT_A);
  });

  test('las estadisticas H7 solo agregan expediciones del propio tenant', async () => {
    // Sin el filtro, un cliente veia el volumen de declaraciones de todos los
    // demas: cuantas presentan, por que canal y su valor.
    mockExpedition.find.mockResolvedValue([]);
    const ctrl = require('../../src/controllers/declarationController');

    await request(app(ctrl.getH7Stats)).get('/r');

    const [query] = mockExpedition.find.mock.calls[0];
    expect(query.tenantId).toBe(TENANT_A);
    expect(query['declaration.type']).toBe('H7');
  });
});
