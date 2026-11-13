/**
 * H1 y AES presentados, contra Mongo real (en memoria).
 *
 * H1 y AES viven en expedition.declaration (no tienen coleccion propia como
 * H7Declaration o Transit), asi que no los contaba volumenDeclaraciones ni
 * derechosLiquidados: "Este mes" salia a 0 aunque se hubieran presentado H1 en
 * el periodo. Estos tests cubren que ahora se cuentan por su fecha de
 * presentacion (declaration.submittedAt), aislados por tenant, y que las
 * predeclaraciones pendientes de activar y las anuladas no cuentan como
 * presentadas.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { Expedition } = require('../../../src/models');
const { volumenDeclaraciones, derechosLiquidados } = require('../../../src/services/analytics/realMetricsService');

usarBaseDeDatosEnMemoria();

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();
const hace = (dias) => new Date(Date.now() - dias * 86400000);

// Se inserta en crudo (como expedientesActivos.db.test.js): el modelo exige
// muchos campos que aqui no importan para estas agregaciones.
const exp = (tenantId, declaration, calculations = {}) => ({
  expeditionId: String(new mongoose.Types.ObjectId()),
  tenantId,
  status: 'levante',
  deletedAt: null,
  createdAt: hace(1),
  declaration,
  calculations
});

const RANGO_MES = { desde: hace(10), hasta: hace(0) };

beforeEach(async () => {
  await Expedition.collection.deleteMany({});
});

describe('volumenDeclaraciones: H1 y AES presentados', () => {
  test('cuenta un H1 y un AES presentados dentro del mes', async () => {
    await Expedition.collection.insertMany([
      exp(A, { type: 'H1', status: 'submitted', submittedAt: hace(5), acceptanceDate: hace(5) }),
      exp(A, { type: 'AES', status: 'submitted', submittedAt: hace(3), acceptanceDate: hace(3) })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(1);
    expect(r.porTipo.AES).toBe(1);
    expect(r.total).toBe(2);
  });

  test('no cuenta un H1 presentado en otro mes (fuera del rango elegido)', async () => {
    await Expedition.collection.insertMany([
      exp(A, { type: 'H1', status: 'submitted', submittedAt: hace(60), acceptanceDate: hace(60) })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(0);
    expect(r.total).toBe(0);
  });

  test('no cuenta un H1 de otro tenant: aislamiento igual que el resto de metricas', async () => {
    await Expedition.collection.insertMany([
      exp(B, { type: 'H1', status: 'submitted', submittedAt: hace(1), acceptanceDate: hace(1) })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(0);
    expect(await volumenDeclaraciones(B, RANGO_MES)).toMatchObject({ total: 1, porTipo: expect.objectContaining({ H1: 1 }) });
  });

  test('no cuenta un H1 anulado (declaration.cancelledAt)', async () => {
    await Expedition.collection.insertMany([
      exp(A, {
        type: 'H1', status: 'submitted', submittedAt: hace(1), acceptanceDate: hace(1),
        cancelledAt: hace(1)
      })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(0);
    expect(r.total).toBe(0);
  });

  test('no cuenta una predeclaracion pendiente de activar (estado 63, sin activadaEn)', async () => {
    await Expedition.collection.insertMany([
      exp(A, {
        type: 'H1', status: 'submitted', submittedAt: hace(1), acceptanceDate: hace(1),
        predeclaracion: { modo: 'Operador', numeroRegistro: 'REG-1' },
        aeatResponse: { responseCode: '63' }
      })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(0);
    expect(r.total).toBe(0);
  });

  test('cuenta una predeclaracion ya activada (con activadaEn), aunque el estado siga siendo 63', async () => {
    await Expedition.collection.insertMany([
      exp(A, {
        type: 'H1', status: 'submitted', submittedAt: hace(1), acceptanceDate: hace(1),
        predeclaracion: { modo: 'Operador', numeroRegistro: 'REG-1', activadaEn: hace(1) },
        aeatResponse: { responseCode: '63' }
      })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(1);
    expect(r.total).toBe(1);
  });

  test('no cuenta un H1 generado pero aun no presentado (sin submittedAt)', async () => {
    await Expedition.collection.insertMany([
      exp(A, { type: 'H1', status: 'draft' })
    ]);

    const r = await volumenDeclaraciones(A, RANGO_MES);

    expect(r.porTipo.H1).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe('derechosLiquidados: H1 y AES presentados', () => {
  test('usa lo liquidado por la AEAT (aeatResponse.liquidacion.totalAPagar) si esta disponible', async () => {
    await Expedition.collection.insertMany([
      exp(
        A,
        {
          type: 'H1', status: 'submitted', submittedAt: hace(1), acceptanceDate: hace(1),
          aeatResponse: { liquidacion: { totalAPagar: 999 } }
        },
        { customsValue: 1000, totalDuties: 50, totalVat: 100 }
      )
    ]);

    const r = await derechosLiquidados(A, RANGO_MES);

    expect(r.total).toBe(999);
    expect(r.valorEnAduana).toBe(1000);
    // Arancel e IVA siguen siendo lo calculado: la AEAT no desglosa su total.
    expect(r.arancel).toBe(50);
    expect(r.iva).toBe(100);
    expect(r.declaraciones).toBe(1);
  });

  test('sin liquidacion de la AEAT, usa lo calculado (customsValue/totalDuties/totalVat)', async () => {
    await Expedition.collection.insertMany([
      exp(
        A,
        { type: 'AES', status: 'submitted', submittedAt: hace(1), acceptanceDate: hace(1) },
        { customsValue: 500, totalDuties: 20, totalVat: 40 }
      )
    ]);

    const r = await derechosLiquidados(A, RANGO_MES);

    expect(r.total).toBe(60);
    expect(r.valorEnAduana).toBe(500);
    expect(r.arancel).toBe(20);
    expect(r.iva).toBe(40);
  });

  test('anuladas y predeclaraciones pendientes no aportan al liquidado', async () => {
    await Expedition.collection.insertMany([
      exp(
        A,
        { type: 'H1', status: 'submitted', submittedAt: hace(1), cancelledAt: hace(1) },
        { customsValue: 1000, totalDuties: 100, totalVat: 200 }
      ),
      exp(
        A,
        {
          type: 'H1', status: 'submitted', submittedAt: hace(1),
          predeclaracion: { modo: 'Aduanas', numeroRegistro: 'REG-2' },
          aeatResponse: { responseCode: '63' }
        },
        { customsValue: 2000, totalDuties: 150, totalVat: 300 }
      )
    ]);

    const r = await derechosLiquidados(A, RANGO_MES);

    expect(r.declaraciones).toBe(0);
    expect(r.total).toBe(0);
  });

  test('suma H1/AES junto con H7 cuando ambos existen', async () => {
    const { H7Declaration } = require('../../../src/models');
    // Insercion en crudo (bypass de validacion), igual que Expedition arriba:
    // el modelo H7 exige muchos campos que no importan para esta agregacion.
    await H7Declaration.collection.insertOne({
      tenantId: A,
      status: 'accepted',
      deletedAt: null,
      duties: { tariff: { amount: 10 }, vat: { amount: 20 }, totalDue: 30 },
      totals: { customsValue: 300 },
      createdAt: hace(1)
    });
    await Expedition.collection.insertMany([
      exp(
        A,
        { type: 'AES', status: 'submitted', submittedAt: hace(1) },
        { customsValue: 500, totalDuties: 20, totalVat: 40 }
      )
    ]);

    const r = await derechosLiquidados(A, RANGO_MES);

    expect(r.declaraciones).toBe(2);
    expect(r.total).toBe(90); // 30 (H7) + 60 (AES calculado, sin liquidacion AEAT)
    expect(r.valorEnAduana).toBe(800);
  });
});
