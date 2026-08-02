/**
 * Propiedad de las garantias en guaranteeService.
 *
 * Las garantias son dinero inmovilizado ante Aduanas. El controller filtraba
 * por owner al LEER (findOne({_id, owner})), pero las escrituras pasaban el id
 * directo al servicio, que hacia findById sin mirar de quien era: con el id de
 * una garantia ajena se podia consumir su saldo, liberarla o cancelarla desde
 * las rutas POST /:id/(activate|consume|release|renew|suspend|cancel).
 */

const mockGuarantee = { findById: jest.fn() };

jest.mock('../../src/models', () => ({ Guarantee: mockGuarantee, Expedition: { findById: jest.fn() } }));
jest.mock('../../src/services/oeaService', () => ({}), { virtual: true });

const guaranteeService = require('../../src/services/guaranteeService');

const DUEÑO = 'user-propietario';
const OTRO = 'user-ajeno';

/** Garantia activa con saldo, propiedad de DUEÑO. */
function garantia(overrides = {}) {
  return {
    _id: 'g1',
    reference: 'GAR-2026-001',
    owner: DUEÑO,
    status: 'active',
    totalAmount: 50000,
    consumedAmount: 0,
    availableAmount: 50000,
    statusHistory: [],
    consume: jest.fn(() => 40000),
    release: jest.fn(() => 50000),
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe('guaranteeService: propiedad en las operaciones de escritura', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('consumeGuarantee', () => {
    test('el propietario puede consumir su garantia', async () => {
      const g = garantia();
      mockGuarantee.findById.mockResolvedValue(g);

      const r = await guaranteeService.consumeGuarantee('g1', 10000, {}, 'uso', DUEÑO);

      expect(r.success).toBe(true);
      expect(g.consume).toHaveBeenCalled();
      expect(g.save).toHaveBeenCalled();
    });

    test('un tercero NO puede consumir el saldo ajeno', async () => {
      const g = garantia();
      mockGuarantee.findById.mockResolvedValue(g);

      await expect(guaranteeService.consumeGuarantee('g1', 10000, {}, 'uso', OTRO))
        .rejects.toThrow('Garantia no encontrada');

      // Lo importante: no se toca el saldo.
      expect(g.consume).not.toHaveBeenCalled();
      expect(g.save).not.toHaveBeenCalled();
    });

    test('el error no revela que la garantia existe en otra cuenta', async () => {
      // Mismo mensaje que cuando no existe, para no confirmar ids validos.
      mockGuarantee.findById.mockResolvedValue(garantia());
      const ajena = guaranteeService.consumeGuarantee('g1', 1, {}, 'x', OTRO);

      mockGuarantee.findById.mockResolvedValue(null);
      const inexistente = guaranteeService.consumeGuarantee('g9', 1, {}, 'x', DUEÑO);

      await expect(ajena).rejects.toThrow('Garantia no encontrada');
      await expect(inexistente).rejects.toThrow('Garantia no encontrada');
    });
  });

  describe('el resto de operaciones de escritura', () => {
    test('cancelGuarantee rechaza a un tercero', async () => {
      const g = garantia();
      mockGuarantee.findById.mockResolvedValue(g);

      await expect(guaranteeService.cancelGuarantee('g1', 'motivo', OTRO))
        .rejects.toThrow('Garantia no encontrada');
      expect(g.save).not.toHaveBeenCalled();
    });

    test('suspendGuarantee rechaza a un tercero', async () => {
      const g = garantia();
      mockGuarantee.findById.mockResolvedValue(g);

      await expect(guaranteeService.suspendGuarantee('g1', 'motivo', OTRO))
        .rejects.toThrow('Garantia no encontrada');
      expect(g.save).not.toHaveBeenCalled();
    });

    test('activateGuarantee rechaza a un tercero', async () => {
      const g = garantia({ status: 'draft' });
      mockGuarantee.findById.mockResolvedValue(g);

      await expect(guaranteeService.activateGuarantee('g1', 'GRN1', {}, OTRO))
        .rejects.toThrow('Garantia no encontrada');
      expect(g.save).not.toHaveBeenCalled();
    });
  });

  describe('casos limite', () => {
    test('sin userId (llamada interna) no se comprueba la propiedad', async () => {
      // Jobs y migraciones llaman sin usuario; bloquearlos romperia procesos
      // automaticos que no actuan en nombre de nadie.
      const g = garantia();
      mockGuarantee.findById.mockResolvedValue(g);

      const r = await guaranteeService.consumeGuarantee('g1', 1000, {}, 'job', undefined);

      expect(r.success).toBe(true);
    });

    test('una garantia sin owner (legacy) sigue siendo accesible', async () => {
      const g = garantia({ owner: undefined });
      mockGuarantee.findById.mockResolvedValue(g);

      const r = await guaranteeService.consumeGuarantee('g1', 1000, {}, 'x', OTRO);

      expect(r.success).toBe(true);
    });

    test('compara ObjectId y string sin falsos negativos', async () => {
      // owner llega como ObjectId desde Mongoose y userId como string del JWT.
      const g = garantia({ owner: { toString: () => DUEÑO } });
      mockGuarantee.findById.mockResolvedValue(g);

      const r = await guaranteeService.consumeGuarantee('g1', 1000, {}, 'x', DUEÑO);

      expect(r.success).toBe(true);
    });
  });
});
