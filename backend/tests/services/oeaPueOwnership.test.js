/**
 * Propiedad en oeaService y pueService.
 *
 * Mismo patron que ya se arreglo en guaranteeService: las escrituras pasaban el
 * id directo al servicio, que hacia findById sin mirar createdBy. Con el id de
 * una certificacion OEA o una solicitud PUE ajena se podia aprobarla,
 * suspenderla, revocarla, enviarla a AEAT o cancelarla.
 *
 * En OEA habia ademas una fuga de lectura: list() no filtraba por propietario,
 * asi que devolvia TODAS las certificaciones del sistema —con NIF, EORI y
 * representante legal de cada empresa— a cualquier usuario.
 */

const mockOEA = { findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn() };
const mockPUE = { findById: jest.fn() };

jest.mock('../../src/models/OEA', () => mockOEA);
jest.mock('../../src/models', () => ({
  PUERequest: mockPUE,
  Expedition: { findById: jest.fn() },
  OEA: mockOEA
}));

const oeaService = require('../../src/services/oeaService');
const pueService = require('../../src/services/pueService');

const DUEÑO = 'user-dueno';
const OTRO = 'user-ajeno';

describe('oeaService: propiedad en las escrituras', () => {
  beforeEach(() => jest.clearAllMocks());

  function oea(overrides = {}) {
    return {
      _id: 'o1',
      createdBy: DUEÑO,
      certification: { status: 'draft', type: 'OEAC' },
      statusHistory: [],
      incidents: [],
      addActivityLog: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
      ...overrides
    };
  }

  test('un tercero no puede suspender una certificacion ajena', async () => {
    const doc = oea({ certification: { status: 'active' } });
    mockOEA.findById.mockResolvedValue(doc);

    await expect(oeaService.suspend('o1', 'motivo', OTRO))
      .rejects.toThrow('Certificacion OEA no encontrada');
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('un tercero no puede revocarla', async () => {
    const doc = oea({ certification: { status: 'active' } });
    mockOEA.findById.mockResolvedValue(doc);

    await expect(oeaService.revoke('o1', 'motivo', OTRO))
      .rejects.toThrow('Certificacion OEA no encontrada');
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('el error no distingue "ajena" de "inexistente"', async () => {
    mockOEA.findById.mockResolvedValue(oea());
    const ajena = oeaService.update('o1', {}, OTRO);

    mockOEA.findById.mockResolvedValue(null);
    const inexistente = oeaService.update('o9', {}, DUEÑO);

    await expect(ajena).rejects.toThrow('Certificacion OEA no encontrada');
    await expect(inexistente).rejects.toThrow('Certificacion OEA no encontrada');
  });

  test('sin userId (job interno) no se comprueba', async () => {
    mockOEA.findById.mockResolvedValue(oea());
    await expect(oeaService.update('o1', {}, undefined)).resolves.toBeDefined();
  });

  test('una OEA legacy sin createdBy sigue accesible', async () => {
    mockOEA.findById.mockResolvedValue(oea({ createdBy: undefined }));
    await expect(oeaService.update('o1', {}, OTRO)).resolves.toBeDefined();
  });
});

describe('oeaService.list: fuga de lectura', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    };
    mockOEA.find.mockReturnValue(chain);
    mockOEA.countDocuments.mockResolvedValue(0);
  });

  test('filtra por createdBy cuando se pasa userId', async () => {
    await oeaService.list({ userId: DUEÑO }, {});

    const [query] = mockOEA.find.mock.calls[0];
    expect(query.createdBy).toBe(DUEÑO);
  });

  test('los filtros de negocio conviven con el de propietario', async () => {
    await oeaService.list({ userId: DUEÑO, status: 'active' }, {});

    const [query] = mockOEA.find.mock.calls[0];
    expect(query.createdBy).toBe(DUEÑO);
    expect(query['certification.status']).toBe('active');
  });
});

describe('pueService: propiedad en las escrituras', () => {
  beforeEach(() => jest.clearAllMocks());

  function pue(overrides = {}) {
    return {
      _id: 'p1',
      createdBy: DUEÑO,
      status: 'draft',
      documents: [],
      timeline: [],
      statusHistory: [],
      save: jest.fn().mockResolvedValue(true),
      ...overrides
    };
  }

  test('un tercero no puede enviar a AEAT una solicitud ajena', async () => {
    // Enviar a AEAT en nombre de otro es lo mas grave de este servicio.
    const doc = pue({ status: 'validated' });
    mockPUE.findById.mockResolvedValue(doc);

    await expect(pueService.submitToAEAT('p1', OTRO))
      .rejects.toThrow('Solicitud no encontrada');
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('un tercero no puede cancelarla', async () => {
    const doc = pue();
    mockPUE.findById.mockResolvedValue(doc);

    await expect(pueService.cancelRequest('p1', 'motivo', OTRO))
      .rejects.toThrow('Solicitud no encontrada');
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('el propietario si puede operar sobre la suya', async () => {
    const doc = pue();
    mockPUE.findById.mockResolvedValue(doc);

    await expect(pueService.cancelRequest('p1', 'motivo', DUEÑO)).resolves.toBeDefined();
    expect(doc.save).toHaveBeenCalled();
  });

  test('compara ObjectId y string sin falsos negativos', async () => {
    // createdBy llega como ObjectId de Mongoose; userId como string del JWT.
    const doc = pue({ createdBy: { toString: () => DUEÑO } });
    mockPUE.findById.mockResolvedValue(doc);

    await expect(pueService.cancelRequest('p1', 'motivo', DUEÑO)).resolves.toBeDefined();
  });
});
