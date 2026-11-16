/**
 * Un H7 que la AEAT rechaza NO puede quedar aceptado en LUCI.
 *
 * Antes, en PRE, un rechazo por NIF (1040/301) se convertia en "aceptada" con un
 * MRN inventado, canal verde y levante automatico: el usuario veia un H7
 * despachado que la AEAT habia rechazado. Estos tests fijan que:
 *  - un rechazo queda como `rejected`, con el codigo y el motivo literales;
 *  - no se guarda MRN, CSV ni canal que no venga de una respuesta OK;
 *  - un error de comunicacion no cambia el estado, pero deja constancia;
 *  - lo simulado solo se acepta con la simulacion activada y queda marcado.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));
jest.mock('../../src/models', () => ({
  H7Declaration: jest.fn(),
  Expedition: { findById: jest.fn() }
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({ submitH7: jest.fn() }));
jest.mock('../../src/models/Tenant', () => ({ findById: jest.fn() }));
const mockSubmitDeclaration = jest.fn();
jest.mock('../../src/services/customs', () => ({
  CustomsServiceFactory: { getServiceForTenant: jest.fn() }
}));

const h7Service = require('../../src/services/h7Service');
const { H7Declaration } = require('../../src/models');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const Tenant = require('../../src/models/Tenant');
const { CustomsServiceFactory } = require('../../src/services/customs');
const { ErrorValidacion } = require('../../src/services/forms/identificadorAduanero');

const RECHAZO_NIF = {
  success: false,
  code: 'R',
  mrn: null,
  csv: null,
  channel: null,
  estado: 'Rechazada',
  error: '1040: El NIF del importador no esta identificado en la AEAT (Importer.identificationNumber)',
  errores: [{ code: '1040', message: 'El NIF del importador no esta identificado en la AEAT', field: 'Importer.identificationNumber' }],
  rawResponse: '<AltaH7V1Sal>...</AltaH7V1Sal>'
};

function declaracion(overrides = {}) {
  return {
    _id: 'h7-1',
    reference: 'H7-2026-0001',
    status: 'draft',
    totals: { customsValue: 50 },
    vatPrepaid: false,
    duties: { totalDue: 10 },
    items: [{ description: 'Libro', taricCode: '4901990000', commercialId: 'SKU-1', manufacturerRef: 'REF-1' }],
    validateH7Eligibility: jest.fn().mockReturnValue({ eligible: true }),
    calculateDuties: jest.fn(),
    statusHistory: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ENV_ORIGINAL };
  delete process.env.AEAT_ENVIRONMENT; // PRE, que es donde se inventaba el MRN
  delete process.env.AEAT_SIMULATE;
  delete process.env.AEAT_FORCE_SIMULATION;
  H7Declaration.findById = jest.fn();
  Tenant.findById.mockResolvedValue({ customsConfig: { country: 'ES' } });
  CustomsServiceFactory.getServiceForTenant.mockReturnValue({ submitDeclaration: mockSubmitDeclaration });
});

afterAll(() => { process.env = ENV_ORIGINAL; });

describe('rechazo de la AEAT al presentar un H7', () => {
  test.each([
    ['1040', RECHAZO_NIF],
    ['301', { ...RECHAZO_NIF, error: '301: Nif no valido', errores: [{ code: '301', message: 'Nif no valido' }] }]
  ])('un rechazo por NIF (%s) en PRE queda rechazado, sin MRN ni canal', async (codigo, respuesta) => {
    aeatSubmitService.submitH7.mockResolvedValue(respuesta);
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(r.rejected).toBe(true);
    expect(r.error).toContain(codigo);
    expect(r.aeatCode).toBe('R');
    expect(d.status).toBe('rejected');
    expect(d.mrn).toBeUndefined();
    expect(d.channel).toBeUndefined();
    expect(d.releasedAt).toBeUndefined();
    expect(d.aeatResponse.csv).toBeUndefined();
    expect(d.aeatResponse.channel).toBeUndefined();
    expect(d.aeatResponse.code).toBe('R');
    expect(d.aeatResponse.message).toContain(codigo);
    expect(d.aeatResponse.errors.map(e => e.code)).toContain(codigo);
    expect(d.statusHistory.some(h => h.status === 'rejected')).toBe(true);
    expect(d.statusHistory.some(h => ['submitted', 'released', 'accepted'].includes(h.status))).toBe(false);
    expect(d.save).toHaveBeenCalled();
  });

  test('un rechazo sin lista de errores conserva el motivo literal como error', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({ success: false, code: 'R', error: 'Importer.identificationNumber no es valido.' });
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(d.status).toBe('rejected');
    expect(d.aeatResponse.message).toBe('Importer.identificationNumber no es valido.');
    expect(d.aeatResponse.errors).toEqual([{ code: 'R', message: 'Importer.identificationNumber no es valido.' }]);
  });

  test('tampoco inventa nada en produccion', async () => {
    process.env.AEAT_ENVIRONMENT = 'production';
    aeatSubmitService.submitH7.mockResolvedValue(RECHAZO_NIF);
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(d.status).toBe('rejected');
    expect(d.mrn).toBeUndefined();
  });

  test('un H7 rechazado se puede corregir y volver a presentar', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({
      success: true, code: 'A', mrn: '26ESH7A000067962R8', channel: 'green', estado: 'Aceptada', csv: 'CSVREAL'
    });
    const d = declaracion({
      status: 'rejected',
      aeatResponse: { code: 'R', message: RECHAZO_NIF.error, errors: RECHAZO_NIF.errores }
    });
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(true);
    expect(d.mrn).toBe('26ESH7A000067962R8');
    expect(d.aeatResponse.errors).toEqual([]);
  });
});

describe('errores sin respuesta valida de la AEAT', () => {
  test('un error de red no cambia el estado, no inventa MRN y deja constancia', async () => {
    aeatSubmitService.submitH7.mockRejectedValue(new Error('connect ECONNREFUSED 1.2.3.4:443'));
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/ECONNREFUSED/);
    expect(d.status).toBe('draft');
    expect(d.mrn).toBeUndefined();
    expect(d.channel).toBeUndefined();
    expect(d.aeatResponse.code).toBe('SIN_RESPUESTA');
    expect(d.aeatResponse.message).toMatch(/ECONNREFUSED/);
    expect(d.save).toHaveBeenCalled();
  });

  test('un error de validacion previo al envio se propaga sin tocar la declaracion', async () => {
    aeatSubmitService.submitH7.mockRejectedValue(new ErrorValidacion('Falta el EORI del representante', { code: 'EORI' }));
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    await expect(h7Service.submitToAEAT('h7-1', 'u1')).rejects.toThrow('Falta el EORI');
    expect(d.save).not.toHaveBeenCalled();
    expect(d.status).toBe('draft');
  });

  test('una respuesta "aceptada" sin MRN no se da por aceptada', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({ success: true, code: 'A', mrn: null, channel: 'green', estado: 'Aceptada' });
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(d.status).toBe('draft');
    expect(d.channel).toBeUndefined();
    expect(d.releasedAt).toBeUndefined();
  });

  test('aceptada sin canal no se da por canal verde ni levante', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({ success: true, code: 'A', mrn: '26ESH7A000067962R8', channel: null, estado: 'Aceptada' });
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(true);
    expect(d.status).toBe('submitted');
    expect(d.channel).toBeUndefined();
    expect(d.releasedAt).toBeUndefined();
  });
});

describe('respuestas simuladas (otro pais sin certificado)', () => {
  const SIMULADA = { success: true, mrn: '26NL0003000000000001', channel: 'green', code: '0', simulated: true };

  test('sin la simulacion activada se rechaza: no se ha presentado nada', async () => {
    Tenant.findById.mockResolvedValue({ customsConfig: { country: 'NL' } });
    mockSubmitDeclaration.mockResolvedValue(SIMULADA);
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/SIMULAD/);
    expect(d.mrn).toBeUndefined();
    expect(d.status).toBe('draft');
  });

  test('con AEAT_SIMULATE=true se guarda marcada como simulada', async () => {
    process.env.AEAT_SIMULATE = 'true';
    Tenant.findById.mockResolvedValue({ customsConfig: { country: 'NL' } });
    mockSubmitDeclaration.mockResolvedValue(SIMULADA);
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(true);
    expect(r.data.simulado).toBe(true);
    expect(d.simulado).toBe(true);
    expect(d.aeatResponse.message).toMatch(/SIMULAD/);
  });

  test('la simulacion nunca se acepta en produccion', async () => {
    process.env.AEAT_SIMULATE = 'true';
    process.env.AEAT_ENVIRONMENT = 'production';
    Tenant.findById.mockResolvedValue({ customsConfig: { country: 'NL' } });
    mockSubmitDeclaration.mockResolvedValue(SIMULADA);
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(d.mrn).toBeUndefined();
  });
});

describe('revision: duplicados y MRN perdidos', () => {
  test('tras un error sin respuesta no se vuelve a presentar sin confirmar que no consta en la AEAT', async () => {
    const d = declaracion({ aeatResponse: { code: 'SIN_RESPUESTA', message: 'timeout', errors: [] } });
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(false);
    expect(r.requiereConfirmacion).toBe(true);
    expect(aeatSubmitService.submitH7).not.toHaveBeenCalled();
  });

  test('con confirmarReenvio se vuelve a presentar', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({ success: true, code: 'A', mrn: '26ESH7A000067962R8', channel: 'green', estado: 'Aceptada' });
    const d = declaracion({ aeatResponse: { code: 'SIN_MRN', message: 'sin MRN', errors: [] } });
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1', { confirmarReenvio: true });

    expect(r.success).toBe(true);
    expect(aeatSubmitService.submitH7).toHaveBeenCalled();
  });

  test('una aceptacion sin MRN deja codigo SIN_MRN (pide confirmacion al reenviar)', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({ success: true, code: 'A', mrn: null });
    const d = declaracion();
    H7Declaration.findById.mockResolvedValue(d);

    await h7Service.submitToAEAT('h7-1', 'u1');

    expect(d.aeatResponse.code).toBe('SIN_MRN');
  });

  test('si el MRN aceptado no pasa la validacion del modelo se guarda igualmente (no se pierde)', async () => {
    aeatSubmitService.submitH7.mockResolvedValue({ success: true, code: 'A', mrn: '26ESH7A00006796', channel: 'green', estado: 'Aceptada' });
    const errorValidacion = Object.assign(new Error('mrn: Path `mrn` is invalid'), { name: 'ValidationError' });
    const save = jest.fn().mockRejectedValueOnce(errorValidacion).mockResolvedValue(true);
    const d = declaracion({ save });
    H7Declaration.findById.mockResolvedValue(d);

    const r = await h7Service.submitToAEAT('h7-1', 'u1');

    expect(r.success).toBe(true);
    expect(d.mrn).toBe('26ESH7A00006796');
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ validateBeforeSave: false });
  });
});
