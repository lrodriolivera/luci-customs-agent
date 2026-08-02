/**
 * Los ultimos casos del barrido de propiedad: vinculos entre documentos y
 * creacion a partir de un expediente.
 *
 * Son los que no encajaban en el patron automatizable:
 * - linkGuarantee y linkGuaranteeToOEA cargan DOS documentos con Promise.all y
 *   solo se comprobaba (a veces) uno. Vincular la garantia de otro cliente
 *   consume su saldo; vincular su OEA aplica su reduccion a esta cuenta.
 * - h7Service.createFromExpedition y transitService.create construyen un
 *   documento nuevo copiando mercancias, valores y datos de cliente de una
 *   expedicion: sin guard, de la expedicion de otro.
 */

const TENANT_A = '6a5769e0b11d798e7e783602';
const TENANT_B = '6a5769e0b11d798e7e7836bb';
const USER_A = '6a5769e0b11d798e7e783607';
const USER_B = '6a5769e0b11d798e7e783699';
const DOC_ID = '6a576988706474063cfb5c19';

const mockRegime = { findById: jest.fn() };
const mockGuarantee = { findById: jest.fn() };
const mockExpedition = { findById: jest.fn() };
const mockUser = { findById: jest.fn() };
const mockH7 = { findById: jest.fn() };
const mockTransit = { findById: jest.fn() };

jest.mock('../../src/models/SpecialRegime', () => mockRegime);
// specialRegimeService importa Guarantee por su ruta directa, no desde ../models
jest.mock('../../src/models/Guarantee', () => mockGuarantee);
jest.mock('../../src/models/Expedition', () => mockExpedition);
jest.mock('../../src/models/User', () => mockUser);
jest.mock('../../src/models', () => ({
  Guarantee: mockGuarantee,
  Expedition: mockExpedition,
  H7Declaration: mockH7,
  Transit: mockTransit,
  SpecialRegime: mockRegime
}));
jest.mock('../../src/services/oeaService', () => ({ getById: jest.fn() }), { virtual: true });

const specialRegimeService = require('../../src/services/specialRegimeService');
const h7Service = require('../../src/services/h7Service');

/** User.findById(...).select(...).lean() */
function usuarioDelTenant(tenantId) {
  mockUser.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ tenantId }) })
  });
}

describe('specialRegimeService.linkGuarantee: ambos extremos del vinculo', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza si el regimen es de otro usuario', async () => {
    mockRegime.findById.mockResolvedValue({ _id: DOC_ID, owner: USER_A });
    mockGuarantee.findById.mockResolvedValue({ _id: DOC_ID, owner: USER_B });

    await expect(specialRegimeService.linkGuarantee(DOC_ID, DOC_ID, USER_B))
      .rejects.toThrow('Regimen no encontrado');
  });

  test('rechaza si la GARANTIA es de otro usuario, aunque el regimen sea propio', async () => {
    // El caso que motiva el arreglo: enganchar la garantia ajena a un regimen
    // propio consumiria su saldo.
    mockRegime.findById.mockResolvedValue({ _id: DOC_ID, owner: USER_A });
    mockGuarantee.findById.mockResolvedValue({ _id: DOC_ID, owner: USER_B });

    await expect(specialRegimeService.linkGuarantee(DOC_ID, DOC_ID, USER_A))
      .rejects.toThrow('Garantia no encontrada');
  });

  test('el error de la garantia ajena no la distingue de una inexistente', async () => {
    mockRegime.findById.mockResolvedValue({ _id: DOC_ID, owner: USER_A });

    mockGuarantee.findById.mockResolvedValue({ _id: DOC_ID, owner: USER_B });
    const ajena = specialRegimeService.linkGuarantee(DOC_ID, DOC_ID, USER_A);

    mockGuarantee.findById.mockResolvedValue(null);
    const inexistente = specialRegimeService.linkGuarantee(DOC_ID, DOC_ID, USER_A);

    await expect(ajena).rejects.toThrow('Garantia no encontrada');
    await expect(inexistente).rejects.toThrow('Garantia no encontrada');
  });
});

describe('h7Service.createFromExpedition: expediente de origen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza crear un H7 desde el expediente de otro tenant', async () => {
    mockExpedition.findById.mockResolvedValue({ _id: DOC_ID, tenantId: TENANT_A, goods: [] });
    usuarioDelTenant(TENANT_B);

    await expect(h7Service.createFromExpedition(DOC_ID, USER_B))
      .rejects.toThrow('Expediente no encontrado');
  });

  test('un expediente inexistente da el mismo error', async () => {
    mockExpedition.findById.mockResolvedValue(null);

    await expect(h7Service.createFromExpedition(DOC_ID, USER_A))
      .rejects.toThrow('Expediente no encontrado');
  });

  test('sin userId (job interno) no se comprueba el tenant', async () => {
    mockExpedition.findById.mockResolvedValue({ _id: DOC_ID, tenantId: TENANT_A, goods: [] });

    // Llega a la validacion de negocio (valor <= 150 EUR), no al guard.
    await h7Service.createFromExpedition(DOC_ID, undefined).catch(() => {});

    expect(mockUser.findById).not.toHaveBeenCalled();
  });

  test('un expediente legacy sin tenantId sigue accesible', async () => {
    const exp = { _id: DOC_ID, goods: [] };
    mockExpedition.findById.mockResolvedValue(exp);
    usuarioDelTenant(TENANT_B);

    await h7Service.createFromExpedition(DOC_ID, USER_B).catch(() => {});

    // No se consulta al usuario porque el documento no tiene tenant que comparar.
    expect(mockUser.findById).not.toHaveBeenCalled();
  });
});
