/**
 * Los listados de plazos e inspecciones se acotan al tenant del usuario.
 *
 * deadlineController.list e inspectionController.list construian su filtro campo
 * a campo desde req.query (status, category, assignedTo...) y NUNCA anadian el
 * tenantId. El service hace `Deadline.find({ active: true, ...filters })`, de
 * modo que sin tenantId en filters la consulta devuelve los plazos e
 * inspecciones de TODOS los clientes.
 *
 * En el momento de escribir esto la fuga no era observable en produccion porque
 * los 30 deadlines y las 20 inspections pertenecen al mismo tenant. El fallo
 * estaba igualmente en el codigo y se habria manifestado al dar de alta el
 * segundo cliente: es el peor momento para descubrirlo.
 *
 * Es el mismo sexto punto ciego de 6612892 (listados, no accesos por id) en dos
 * controllers que se me escaparon entonces.
 */

const deadlineService = require('../../src/services/deadlineService');
const inspectionService = require('../../src/services/inspectionService');

jest.mock('../../src/services/deadlineService', () => ({ list: jest.fn() }));
jest.mock('../../src/services/inspectionService', () => ({ list: jest.fn() }));

const deadlineController = require('../../src/controllers/deadlineController');
const inspectionController = require('../../src/controllers/inspectionController');

const TENANT_A = '6a5769e0b11d798e7e783602';
const TENANT_B = '6a5769e0b11d798e7e7836ff';

/** Peticion autenticada de un usuario del tenant indicado. */
function req(tenantId, query = {}) {
  return { query, params: {}, body: {}, user: { _id: 'u1', role: 'user', tenantId } };
}

/** Respuesta que captura status y cuerpo. */
function res() {
  const r = { statusCode: 200 };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const VACIO = { deadlines: [], inspections: [], total: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  deadlineService.list.mockResolvedValue(VACIO);
  inspectionService.list.mockResolvedValue(VACIO);
});

describe('deadlineController.list: acota por tenant', () => {
  test('pasa el tenantId del usuario al service', async () => {
    await deadlineController.list(req(TENANT_A), res());

    const [filters] = deadlineService.list.mock.calls[0];
    expect(filters.tenantId).toBe(TENANT_A);
  });

  test('un usuario no puede pedir los plazos de otro tenant por query string', async () => {
    // El filtro se construye desde req.query; si tenantId saliera de ahi, el
    // aislamiento seria trivial de saltar.
    await deadlineController.list(req(TENANT_A, { tenantId: TENANT_B }), res());

    const [filters] = deadlineService.list.mock.calls[0];
    expect(filters.tenantId).toBe(TENANT_A);
  });

  test('conserva los filtros legitimos de la peticion', async () => {
    await deadlineController.list(req(TENANT_A, { status: 'pending', category: 'aeat' }), res());

    const [filters] = deadlineService.list.mock.calls[0];
    expect(filters).toMatchObject({ status: 'pending', category: 'aeat', tenantId: TENANT_A });
  });

  test('un usuario sin tenant no fuerza un filtro vacio', async () => {
    // Usuarios legacy anteriores al multi-tenant: no se les inventa un tenantId
    // undefined, que en Mongo casaria con los documentos sin el campo.
    await deadlineController.list(req(undefined), res());

    const [filters] = deadlineService.list.mock.calls[0];
    expect('tenantId' in filters).toBe(false);
  });
});

describe('inspectionController.list: acota por tenant', () => {
  test('pasa el tenantId del usuario al service', async () => {
    await inspectionController.list(req(TENANT_A), res());

    const [filters] = inspectionService.list.mock.calls[0];
    expect(filters.tenantId).toBe(TENANT_A);
  });

  test('un usuario no puede pedir las inspecciones de otro tenant por query string', async () => {
    await inspectionController.list(req(TENANT_A, { tenantId: TENANT_B }), res());

    const [filters] = inspectionService.list.mock.calls[0];
    expect(filters.tenantId).toBe(TENANT_A);
  });

  test('conserva los filtros legitimos de la peticion', async () => {
    await inspectionController.list(req(TENANT_A, { status: 'scheduled', authorityType: 'SOIVRE' }), res());

    const [filters] = inspectionService.list.mock.calls[0];
    expect(filters).toMatchObject({ status: 'scheduled', tenantId: TENANT_A });
  });

  test('un usuario sin tenant no fuerza un filtro vacio', async () => {
    await inspectionController.list(req(undefined), res());

    const [filters] = inspectionService.list.mock.calls[0];
    expect('tenantId' in filters).toBe(false);
  });
});
