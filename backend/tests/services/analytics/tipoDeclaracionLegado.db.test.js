/**
 * Expedientes antiguos con MRN pero sin declaration.type.
 *
 * _resumenH1AES (PR #93) cuenta H1 y AES por declaration.type, y los
 * expedientes presentados antes de que LUCI guardara el tipo no contaban en
 * Analítica aunque tuvieran MRN. Se deduce el tipo en la propia consulta, sin
 * modificar datos, a partir de la letra de procedimiento del MRN (posición 17;
 * Reglamento de Ejecución (UE) 2015/2447, anexo B, estructura del MRN, campo 4
 * «identificador de procedimiento»): R/S = declaración de importación -> H1;
 * A/B = exportación -> AES. Solo si el resto de datos no lo contradice
 * (operationType, h7Data). Cualquier otra letra (tránsito J/K/L, etc.) o un MRN
 * con otro formato no se cuenta.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { Expedition } = require('../../../src/models');
const { volumenDeclaraciones, derechosLiquidados } = require('../../../src/services/analytics/realMetricsService');

usarBaseDeDatosEnMemoria();

const A = new mongoose.Types.ObjectId();
const hace = (dias) => new Date(Date.now() - dias * 86400000);
const RANGO = { desde: hace(10), hasta: hace(0) };

// MRN reales de preproducción de la AEAT (fixtures del repo): letra 17 R = importación.
const MRN_IMPORTACION = '26ES009999I00270R1';
const MRN_EXPORTACION = '26ES002801100321B8';
const MRN_TRANSITO = '26ES002801500473J5';

const legado = (declaration, { operationType = 'import', createdAt = hace(3), calculations = {} } = {}) => ({
  expeditionId: String(new mongoose.Types.ObjectId()),
  tenantId: A,
  operationType,
  status: 'levante',
  deletedAt: null,
  createdAt,
  declaration,
  calculations
});

beforeEach(async () => {
  await Expedition.collection.deleteMany({});
});

describe('volumenDeclaraciones: tipo deducido del MRN en expedientes antiguos', () => {
  test('MRN de importación (R) en expediente de importación cuenta como H1', async () => {
    await Expedition.collection.insertOne(legado({ mrn: MRN_IMPORTACION, submittedAt: hace(2) }));

    const r = await volumenDeclaraciones(A, RANGO);

    expect(r.porTipo.H1).toBe(1);
    expect(r.total).toBe(1);
  });

  test('MRN de exportación (B) en expediente de exportación cuenta como AES', async () => {
    await Expedition.collection.insertOne(
      legado({ mrn: MRN_EXPORTACION, submittedAt: hace(2) }, { operationType: 'export' })
    );

    expect((await volumenDeclaraciones(A, RANGO)).porTipo.AES).toBe(1);
  });

  test('sin fecha de presentación, usa la de la respuesta de la AEAT o la del expediente', async () => {
    await Expedition.collection.insertMany([
      legado({ mrn: MRN_IMPORTACION, aeatResponse: { timestamp: hace(4) } }, { createdAt: hace(30) }),
      legado({ mrn: MRN_IMPORTACION }, { createdAt: hace(5) }),
      legado({ mrn: MRN_IMPORTACION }, { createdAt: hace(50) })
    ]);

    expect((await volumenDeclaraciones(A, RANGO)).porTipo.H1).toBe(2);
  });

  test.each([
    ['letra de tránsito (J)', { mrn: MRN_TRANSITO, submittedAt: hace(2) }, {}],
    ['MRN con formato que no es el de la UE', { mrn: 'MRN-123', submittedAt: hace(2) }, {}],
    ['MRN de importación en expediente de exportación', { mrn: MRN_IMPORTACION, submittedAt: hace(2) }, { operationType: 'export' }],
    ['MRN de exportación en expediente de importación', { mrn: MRN_EXPORTACION, submittedAt: hace(2) }, {}],
    ['expediente con datos de H7 (bajo valor)', { mrn: MRN_IMPORTACION, submittedAt: hace(2), h7Data: { total: 10 } }, {}],
    ['anulado', { mrn: MRN_IMPORTACION, submittedAt: hace(2), cancelledAt: hace(1) }, {}],
    ['tipo explícito distinto (H7)', { type: 'H7', mrn: MRN_IMPORTACION, submittedAt: hace(2) }, {}]
  ])('no cuenta: %s', async (_caso, declaration, opciones) => {
    await Expedition.collection.insertOne(legado(declaration, opciones));

    const r = await volumenDeclaraciones(A, RANGO);

    expect(r.porTipo.H1).toBe(0);
    expect(r.porTipo.AES).toBe(0);
  });

  test('los que sí tienen tipo siguen exigiendo fecha de presentación (sin cambios)', async () => {
    await Expedition.collection.insertOne(legado({ type: 'H1', mrn: MRN_IMPORTACION }));

    expect((await volumenDeclaraciones(A, RANGO)).porTipo.H1).toBe(0);
  });

  test('derechosLiquidados suma también los antiguos deducidos', async () => {
    await Expedition.collection.insertOne(
      legado({ mrn: MRN_IMPORTACION, submittedAt: hace(2) }, { calculations: { totalDuties: 100, totalVat: 21 } })
    );

    const r = await derechosLiquidados(A, RANGO);

    expect(r.declaraciones).toBe(1);
    expect(r.total).toBe(121);
  });
});
