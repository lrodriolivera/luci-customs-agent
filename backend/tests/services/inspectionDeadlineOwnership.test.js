/**
 * Aislamiento por tenant en inspectionService y deadlineService.
 *
 * Eran los ultimos del barrido y los que mas trabajo previo necesitaban: sus
 * documentos NO tenian ningun campo de propiedad (20 inspecciones y 30
 * deadlines en produccion, todos sin createdBy ni owner), asi que anadir el
 * guard sin mas habria sido proteccion falsa. Se anadio tenantId al schema y se
 * derivo de la expedicion, que es su unico dueno posible.
 *
 * El helper resuelve el tenant desde el userId que ya recibian las funciones,
 * en vez de exigir tenantId en las 19 firmas y sus 47 llamadores.
 *
 * Ids: ObjectId validos. Con strings tipo 'i1', si el mock del modelo no llega
 * a aplicarse, Mongoose lanza CastError en vez del error esperado y el test
 * pasa o falla segun el orden de carga.
 */

const TENANT_A = '6a5769e0b11d798e7e783602';
const TENANT_B = '6a5769e0b11d798e7e7836bb';
const USER_A = '6a5769e0b11d798e7e783607';
const USER_B = '6a5769e0b11d798e7e783699';
const DOC_ID = '6a576988706474063cfb5c19';

const mockInspection = { findById: jest.fn(), findOne: jest.fn().mockResolvedValue(null) };
const mockDeadline = { findById: jest.fn(), findOne: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({}) };
const mockUser = { findById: jest.fn() };
const mockExpedition = { findById: jest.fn() };

// Sin { virtual: true }: estos modulos existen y esa opcion impide que jest
// sustituya el real.
jest.mock('../../src/models/Inspection', () => mockInspection);
jest.mock('../../src/models/Deadline', () => mockDeadline);
jest.mock('../../src/models/User', () => mockUser);
jest.mock('../../src/models/Expedition', () => mockExpedition);

const inspectionService = require('../../src/services/inspectionService');
const deadlineService = require('../../src/services/deadlineService');

/** User.findById(...).select(...).lean() encadenable. */
function usuarioDelTenant(tenantId) {
  mockUser.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ tenantId }) })
  });
}

function inspeccion(tenantId = TENANT_A) {
  return {
    _id: DOC_ID,
    tenantId,
    status: 'scheduled',
    timeline: [],
    samples: [],
    save: jest.fn().mockResolvedValue(true),
    addTimelineEvent: jest.fn()
  };
}

function deadline(tenantId = TENANT_A) {
  return {
    _id: DOC_ID,
    tenantId,
    status: 'pending',
    history: [],
    save: jest.fn().mockResolvedValue(true),
    calculateNextAlert: jest.fn(),
    cancel: jest.fn()
  };
}

describe('inspectionService: aislamiento por tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('un usuario de otro tenant no puede cancelar una inspeccion', async () => {
    mockInspection.findById.mockResolvedValue(inspeccion(TENANT_A));
    usuarioDelTenant(TENANT_B);

    await expect(inspectionService.cancel(DOC_ID, 'motivo', USER_B))
      .rejects.toThrow('Inspección no encontrada');
  });

  test('el usuario de su propio tenant si puede', async () => {
    const doc = inspeccion(TENANT_A);
    mockInspection.findById.mockResolvedValue(doc);
    usuarioDelTenant(TENANT_A);

    await expect(inspectionService.cancel(DOC_ID, 'motivo', USER_A)).resolves.toBeDefined();
    expect(doc.save).toHaveBeenCalled();
  });

  test('el error no distingue "de otro tenant" de "inexistente"', async () => {
    mockInspection.findById.mockResolvedValue(inspeccion(TENANT_A));
    usuarioDelTenant(TENANT_B);
    const ajena = inspectionService.cancel(DOC_ID, 'x', USER_B);

    mockInspection.findById.mockResolvedValue(null);
    const inexistente = inspectionService.cancel(DOC_ID, 'x', USER_A);

    await expect(ajena).rejects.toThrow('Inspección no encontrada');
    await expect(inexistente).rejects.toThrow('Inspección no encontrada');
  });

  test('sin userId (job interno) no se comprueba', async () => {
    const doc = inspeccion(TENANT_A);
    mockInspection.findById.mockResolvedValue(doc);

    await expect(inspectionService.cancel(DOC_ID, 'auto', undefined)).resolves.toBeDefined();
    expect(mockUser.findById).not.toHaveBeenCalled();
  });

  test('una inspeccion legacy sin tenantId sigue accesible', async () => {
    const doc = inspeccion(TENANT_A);
    delete doc.tenantId;   // legacy: el campo no existe en el documento
    mockInspection.findById.mockResolvedValue(doc);
    usuarioDelTenant(TENANT_B);

    await expect(inspectionService.cancel(DOC_ID, 'x', USER_B)).resolves.toBeDefined();
  });

});

describe('deadlineService: aislamiento por tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('un usuario de otro tenant no puede completar un deadline', async () => {
    mockDeadline.findById.mockResolvedValue(deadline(TENANT_A));
    usuarioDelTenant(TENANT_B);

    await expect(deadlineService.complete(DOC_ID, {}, USER_B))
      .rejects.toThrow('Deadline no encontrado');
  });

  test('un usuario de otro tenant no puede cancelarlo', async () => {
    const doc = deadline(TENANT_A);
    mockDeadline.findById.mockResolvedValue(doc);
    usuarioDelTenant(TENANT_B);

    await expect(deadlineService.cancel(DOC_ID, 'motivo', USER_B))
      .rejects.toThrow('Deadline no encontrado');
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('el de su propio tenant si puede', async () => {
    const doc = deadline(TENANT_A);
    mockDeadline.findById.mockResolvedValue(doc);
    usuarioDelTenant(TENANT_A);

    await expect(deadlineService.cancel(DOC_ID, 'motivo', USER_A)).resolves.toBeDefined();
  });
});
