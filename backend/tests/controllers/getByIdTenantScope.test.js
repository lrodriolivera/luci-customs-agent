/**
 * Los accesos por id de plazos, inspecciones y comunicaciones al inspector
 * comprueban de quien es el documento.
 *
 * deadlineController.getById, inspectionController.getById e
 * inspectorCommunicationController.getById devolvian el documento que el
 * service encontraba con un findById plano, sin mirar el tenant ni el
 * propietario: cualquier usuario autenticado leia el de otro cliente conociendo
 * su id (hallazgos F70/F77, F71/F78 y F72/F79 del escaneo del 3/Nov/2026).
 *
 * Deadline e Inspection tienen tenantId: se aplica ensureSameTenant (que desde
 * 88445e1 usa siempre el tenant del usuario, no la cabecera X-Tenant-ID).
 * InspectorCommunication no tiene tenantId, solo createdBy: se aplica la misma
 * regla que _loadOwnedComm ya usa en las escrituras.
 */

jest.mock('../../src/services/deadlineService', () => ({ getById: jest.fn() }));
jest.mock('../../src/services/inspectionService', () => ({ getById: jest.fn() }));
jest.mock('../../src/services/inspectorCommunicationService', () => ({ getById: jest.fn() }));

const deadlineService = require('../../src/services/deadlineService');
const inspectionService = require('../../src/services/inspectionService');
const commService = require('../../src/services/inspectorCommunicationService');
const deadlineController = require('../../src/controllers/deadlineController');
const inspectionController = require('../../src/controllers/inspectionController');
const commController = require('../../src/controllers/inspectorCommunicationController');

const TENANT_A = '6a5769e0b11d798e7e783602';
const TENANT_B = '6a5769e0b11d798e7e7836ff';
const USER_A = '6a5769e0b11d798e7e78aaaa';
const USER_B = '6a5769e0b11d798e7e78bbbb';

/** Peticion autenticada; tenantHeader simula X-Tenant-ID copiado en req.tenantId. */
function req({ userId = USER_B, tenantId = TENANT_B, role = 'admin', tenantHeader } = {}) {
  return {
    params: { id: 'doc1' },
    query: {},
    body: {},
    tenantId: tenantHeader,
    user: { _id: userId, id: userId, role, tenantId }
  };
}

function res() {
  const r = { statusCode: 200, headersSent: false };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; r.headersSent = true; return r; };
  return r;
}

describe.each([
  ['deadlineController.getById', deadlineController, deadlineService],
  ['inspectionController.getById', inspectionController, inspectionService]
])('%s: acota por tenant', (_nombre, controller, service) => {
  test('el admin de otro tenant recibe 404 y no ve el documento', async () => {
    service.getById.mockResolvedValue({ _id: 'doc1', tenantId: TENANT_A, secreto: 'x' });
    const r = res();

    await controller.getById(req(), r);

    expect(r.statusCode).toBe(404);
    expect(r.body.success).toBe(false);
    expect(r.body.data).toBeUndefined();
  });

  test('tampoco con la cabecera X-Tenant-ID del tenant victima', async () => {
    service.getById.mockResolvedValue({ _id: 'doc1', tenantId: TENANT_A, secreto: 'x' });
    const r = res();

    await controller.getById(req({ tenantHeader: TENANT_A }), r);

    expect(r.statusCode).toBe(404);
    expect(r.body.data).toBeUndefined();
  });

  test('un usuario del mismo tenant sigue leyendolo', async () => {
    service.getById.mockResolvedValue({ _id: 'doc1', tenantId: TENANT_A });
    const r = res();

    await controller.getById(req({ userId: USER_A, tenantId: TENANT_A, role: 'agent' }), r);

    expect(r.statusCode).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data._id).toBe('doc1');
  });

  test('si no existe sigue respondiendo 404', async () => {
    service.getById.mockResolvedValue(null);
    const r = res();

    await controller.getById(req({ tenantId: TENANT_A }), r);

    expect(r.statusCode).toBe(404);
  });
});

describe('inspectorCommunicationController.getById: acota por propietario', () => {
  test('otro usuario recibe 404 y no ve la comunicacion', async () => {
    commService.getById.mockResolvedValue({ _id: 'doc1', createdBy: { _id: USER_A, name: 'A' } });
    const r = res();

    await commController.getById(req(), r);

    expect(r.statusCode).toBe(404);
    expect(r.body.data).toBeUndefined();
  });

  test('el creador sigue leyendola (createdBy poblado o como id)', async () => {
    commService.getById.mockResolvedValue({ _id: 'doc1', createdBy: { _id: USER_A, name: 'A' } });
    const r1 = res();
    await commController.getById(req({ userId: USER_A, tenantId: TENANT_A }), r1);
    expect(r1.statusCode).toBe(200);
    expect(r1.body.data._id).toBe('doc1');

    commService.getById.mockResolvedValue({ _id: 'doc1', createdBy: USER_A });
    const r2 = res();
    await commController.getById(req({ userId: USER_A, tenantId: TENANT_A }), r2);
    expect(r2.statusCode).toBe(200);
  });

  test('si no existe sigue respondiendo 404', async () => {
    commService.getById.mockResolvedValue(null);
    const r = res();

    await commController.getById(req(), r);

    expect(r.statusCode).toBe(404);
  });
});
