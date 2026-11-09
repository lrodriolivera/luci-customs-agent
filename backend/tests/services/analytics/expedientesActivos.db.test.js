/**
 * expedientesActivos contra Mongo real (en memoria): cuenta los expedientes del
 * tenant cuyo status no es terminal, aunque se abrieran hace meses.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { Expedition } = require('../../../src/models');
const { expedientesActivos } = require('../../../src/services/analytics/realMetricsService');

usarBaseDeDatosEnMemoria();

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();
const hace = (dias) => new Date(Date.now() - dias * 86400000);

// Se inserta en crudo: el modelo exige muchos campos que aqui no importan.
const exp = (tenantId, status, extra = {}) => ({
  expeditionId: String(new mongoose.Types.ObjectId()), tenantId, status, deletedAt: null, createdAt: hace(1), ...extra
});

beforeEach(async () => {
  await Expedition.collection.deleteMany({});
});

describe('expedientesActivos (Mongo real)', () => {
  test('cuenta los no terminales y excluye levante, completed y cancelled', async () => {
    await Expedition.collection.insertMany([
      exp(A, 'draft'), exp(A, 'pending_documents'), exp(A, 'declaration_submitted'),
      exp(A, 'green_channel'), exp(A, 'on_hold'),
      exp(A, 'levante'), exp(A, 'completed'), exp(A, 'cancelled')
    ]);
    expect(await expedientesActivos(A)).toBe(5);
  });

  test('un expediente abierto hace meses sigue activo (sin rango de fechas)', async () => {
    await Expedition.collection.insertMany([exp(A, 'validating_documents', { createdAt: hace(400) })]);
    expect(await expedientesActivos(A)).toBe(1);
  });

  test('acota por tenant (string u ObjectId) y no cuenta los borrados', async () => {
    await Expedition.collection.insertMany([
      exp(A, 'draft'), exp(B, 'draft'), exp(B, 'draft'), exp(A, 'draft', { deletedAt: new Date() })
    ]);
    expect(await expedientesActivos(A)).toBe(1);
    expect(await expedientesActivos(String(B))).toBe(2);
  });

  test('plataforma (undefined) cuenta todos los tenants; sin expedientes es 0', async () => {
    expect(await expedientesActivos(A)).toBe(0);
    await Expedition.collection.insertMany([exp(A, 'draft'), exp(B, 'draft')]);
    expect(await expedientesActivos(undefined)).toBe(2);
  });
});
