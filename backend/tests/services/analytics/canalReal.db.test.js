/**
 * «Distribución por Canal» de Analítica, contra Mongo real (en memoria).
 *
 * repartoPorCanal contaba el canal por el status del expediente
 * (green_channel, orange_channel...). En cuanto el expediente pasa a 'levante'
 * o 'completed' ese status desaparece y el canal se perdía, aunque la
 * respuesta de la AEAT lo hubiera dejado guardado en declaration.channel (H1,
 * H1 CAU, AES y H7 de expediente) o en H7Declaration.channel (H7 del
 * manifiesto). Además el panel ni siquiera recibía los canales: el adaptador
 * (cuadroParaPanel) no los pasaba, y la tarjeta salía vacía.
 */
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { Expedition, H7Declaration } = require('../../../src/models');
const { repartoPorCanal } = require('../../../src/services/analytics/realMetricsService');

usarBaseDeDatosEnMemoria();

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();
const hace = (dias) => new Date(Date.now() - dias * 86400000);
const RANGO = { desde: hace(10), hasta: hace(0) };

const exp = (tenantId, { status = 'levante', declaration = {}, createdAt = hace(2), _id } = {}) => ({
  _id: _id || new mongoose.Types.ObjectId(),
  expeditionId: String(new mongoose.Types.ObjectId()),
  tenantId,
  status,
  deletedAt: null,
  createdAt,
  declaration
});

const h7 = (tenantId, channel, extra = {}) => ({
  tenantId,
  channel,
  deletedAt: null,
  submittedAt: hace(1),
  createdAt: hace(1),
  ...extra
});

beforeEach(async () => {
  await Expedition.collection.deleteMany({});
  await H7Declaration.collection.deleteMany({});
});

describe('repartoPorCanal: canal real de la respuesta de la AEAT', () => {
  test('cuenta el canal guardado en declaration.channel aunque el expediente ya tenga levante', async () => {
    await Expedition.collection.insertMany([
      exp(A, { status: 'levante', declaration: { type: 'H1', channel: 'green', submittedAt: hace(3) } }),
      exp(A, { status: 'completed', declaration: { type: 'AES', channel: 'orange', submittedAt: hace(3) } }),
      exp(A, { status: 'levante', declaration: { type: 'H1', channel: 'red', submittedAt: hace(3) } })
    ]);

    const r = await repartoPorCanal(A, RANGO);

    expect(r.canales).toEqual({ green: 1, yellow: 0, orange: 1, red: 1 });
    expect(r.conCanalAsignado).toBe(3);
  });

  test('un expediente antiguo sin declaration.channel cuenta por su status de canal', async () => {
    await Expedition.collection.insertMany([
      exp(A, { status: 'red_channel', declaration: { type: 'H1', submittedAt: hace(3) } })
    ]);

    expect((await repartoPorCanal(A, RANGO)).canales.red).toBe(1);
  });

  test('suma el canal de los H7 del manifiesto (H7Declaration.channel)', async () => {
    await H7Declaration.collection.insertMany([h7(A, 'yellow'), h7(A, 'green')]);

    const r = await repartoPorCanal(A, RANGO);

    expect(r.canales).toEqual({ green: 1, yellow: 1, orange: 0, red: 0 });
  });

  test('un H7 enlazado a un expediente que ya tiene canal no se cuenta dos veces', async () => {
    const idExp = new mongoose.Types.ObjectId();
    await Expedition.collection.insertOne(
      exp(A, { _id: idExp, declaration: { type: 'H7', channel: 'yellow', submittedAt: hace(1) } })
    );
    await H7Declaration.collection.insertOne(h7(A, 'yellow', { expedition: idExp }));

    expect((await repartoPorCanal(A, RANGO)).canales.yellow).toBe(1);
  });

  test('no cuenta expedientes sin canal, anulados ni de otro tenant', async () => {
    await Expedition.collection.insertMany([
      exp(A, { status: 'draft' }),
      exp(A, { declaration: { type: 'H1', channel: 'green', submittedAt: hace(1), cancelledAt: hace(1) } }),
      exp(B, { declaration: { type: 'H1', channel: 'green', submittedAt: hace(1) } })
    ]);
    await H7Declaration.collection.insertOne(h7(B, 'red'));

    const r = await repartoPorCanal(A, RANGO);

    expect(r.conCanalAsignado).toBe(0);
    expect((await repartoPorCanal(B, RANGO)).conCanalAsignado).toBe(2);
  });

  test('el periodo se mide por la presentación, no por la apertura del expediente', async () => {
    await Expedition.collection.insertMany([
      // Abierto hace 40 días, presentado hace 2: entra en los últimos 10 días
      exp(A, { createdAt: hace(40), declaration: { type: 'H1', channel: 'green', submittedAt: hace(2) } }),
      // Presentado hace 40 días: fuera
      exp(A, { createdAt: hace(41), declaration: { type: 'H1', channel: 'red', submittedAt: hace(40) } })
    ]);

    const r = await repartoPorCanal(A, RANGO);

    expect(r.canales).toEqual({ green: 1, yellow: 0, orange: 0, red: 0 });
  });

  test('porcentajes sobre los que tienen canal', async () => {
    await Expedition.collection.insertMany([
      exp(A, { declaration: { type: 'H1', channel: 'green', submittedAt: hace(1) } }),
      exp(A, { declaration: { type: 'H1', channel: 'green', submittedAt: hace(1) } }),
      exp(A, { declaration: { type: 'H1', channel: 'green', submittedAt: hace(1) } }),
      exp(A, { declaration: { type: 'AES', channel: 'red', submittedAt: hace(1) } }),
      exp(A, { status: 'draft' })
    ]);

    const r = await repartoPorCanal(A, RANGO);

    expect(r.porcentajes).toEqual({ green: 75, yellow: 0, orange: 0, red: 25 });
  });
});
