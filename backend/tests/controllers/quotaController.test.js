/**
 * Tests de los endpoints de contingentes arancelarios.
 *
 * La bateria anterior mockeaba el servicio devolviendo el catalogo cableado
 * (`Q090001` con 45.000.000 kg de carne de vacuno, contingentes de CETA y
 * EU-MERCOSUR) y comprobaba que el controlador lo repitiera. Ninguno de esos
 * numeros de orden existe en la base de la Comision, asi que los tests fijaban
 * la forma de un dato inventado. Ahora se comprueba el contrato nuevo: catalogo
 * sincronizado, paginado, sin reserva de cupo y sin clasificacion por acuerdo.
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../src/services/quotaService');
jest.mock('../../src/models/TariffQuota');
jest.mock('../../src/config/logger', () => ({
  debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const quotaController = require('../../src/controllers/quotaController');
const quotaService = require('../../src/services/quotaService');
const TariffQuota = require('../../src/models/TariffQuota');

const app = express();
app.use(express.json());
app.post('/api/quotas/check-availability', quotaController.checkAvailability);
app.post('/api/quotas/claim-data', quotaController.getClaimData);
app.post('/api/quotas/calculate-savings', quotaController.calculateSavings);
app.post('/api/quotas/report', quotaController.generateReport);
app.get('/api/quotas/critical', quotaController.getCritical);
app.get('/api/quotas/list', quotaController.listAll);
app.get('/api/quotas/info', quotaController.getInfo);
app.get('/api/quotas/:orderNumber', quotaController.getByOrderNumber);

const cadena = (resultado) => {
  const api = {};
  ['sort', 'limit', 'skip', 'select'].forEach((m) => { api[m] = jest.fn(() => api); });
  api.lean = jest.fn().mockResolvedValue(resultado);
  return api;
};

const ANO = new Date().getFullYear();

beforeEach(() => {
  jest.clearAllMocks();
  quotaService.URL_OFICIAL = 'https://ec.europa.eu/taxation_customs/dds2/taric/quota_consultation.jsp';
  quotaService.presentar = jest.fn((q) => ({ orderNumber: q.orderNumber, presentado: true }));
  TariffQuota.find = jest.fn(() => cadena([]));
  TariffQuota.findOne = jest.fn(() => cadena(null));
  TariffQuota.countDocuments = jest.fn().mockResolvedValue(0);
});

describe('POST /api/quotas/check-availability', () => {
  test('devuelve el resultado del servicio', async () => {
    quotaService.checkQuotaAvailability.mockResolvedValue({
      found: true, count: 1, quotas: [{ orderNumber: '090006' }]
    });

    const res = await request(app).post('/api/quotas/check-availability')
      .send({ taricCode: '0302410000', originCountry: 'CN', quantity: 1000, unit: 'kg' });

    expect(res.status).toBe(200);
    expect(res.body.data.quotas[0].orderNumber).toBe('090006');
    expect(quotaService.checkQuotaAvailability)
      .toHaveBeenCalledWith('0302410000', 'CN', 1000, 'kg', { year: ANO });
  });

  test('rechaza la peticion sin los campos obligatorios', async () => {
    const res = await request(app).post('/api/quotas/check-availability')
      .send({ taricCode: '0302410000' });

    expect(res.status).toBe(400);
    expect(quotaService.checkQuotaAvailability).not.toHaveBeenCalled();
  });

  test('descarta un ano fuera de rango en vez de consultarlo', async () => {
    quotaService.checkQuotaAvailability.mockResolvedValue({ found: false, quotas: [] });

    await request(app).post('/api/quotas/check-availability')
      .send({ taricCode: '0302410000', originCountry: 'CN', quantity: 1, year: 'abc' });

    expect(quotaService.checkQuotaAvailability.mock.calls[0][4]).toEqual({ year: ANO });
  });

  test('propaga el fallo del servicio como 500 en vez de un "sin contingente"', async () => {
    // Un error de base de datos no puede leerse como que el producto no tiene
    // contingente: son cosas distintas.
    quotaService.checkQuotaAvailability.mockRejectedValue(new Error('Mongo caido'));

    const res = await request(app).post('/api/quotas/check-availability')
      .send({ taricCode: '0302410000', originCountry: 'CN', quantity: 1 });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/quotas/claim-data', () => {
  test('devuelve los datos para consignar el contingente', async () => {
    quotaService.getQuotaClaimData.mockResolvedValue({
      success: true, isReservation: false, orderNumber: '090006', instructions: [], warnings: []
    });

    const res = await request(app).post('/api/quotas/claim-data')
      .send({ orderNumber: '090006', quantity: 1000 });

    expect(res.status).toBe(200);
    // No hay reserva: el cupo lo atribuye la aduana al admitir la declaracion.
    expect(res.body.data.isReservation).toBe(false);
    expect(res.body.data.reservationId).toBeUndefined();
  });

  test('responde 404 cuando el contingente no esta en el catalogo', async () => {
    quotaService.getQuotaClaimData.mockResolvedValue({
      success: false, error: 'Contingente 090001 no encontrado en el catalogo oficial de 2026'
    });

    const res = await request(app).post('/api/quotas/claim-data')
      .send({ orderNumber: '090001', quantity: 1000 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/090001/);
  });

  test('exige orderNumber y quantity', async () => {
    const res = await request(app).post('/api/quotas/claim-data').send({ quantity: 10 });

    expect(res.status).toBe(400);
    expect(quotaService.getQuotaClaimData).not.toHaveBeenCalled();
  });
});

describe('POST /api/quotas/calculate-savings', () => {
  test('pasa al servicio los dos tipos que aporta el llamante', async () => {
    // El tipo dentro del contingente no lo publica el sistema de contingentes:
    // tiene que venir de la medida de TARIC, no de un valor cableado.
    quotaService.calculateQuotaSavings.mockResolvedValue({ applicable: true, savings: 6000 });

    await request(app).post('/api/quotas/calculate-savings').send({
      taricCode: '0302410000', originCountry: 'CN', quantity: 1000, customsValue: 50000,
      inQuotaDuty: 0, outQuotaDuty: 0.12
    });

    expect(quotaService.calculateQuotaSavings).toHaveBeenCalledWith(
      '0302410000', 'CN', 1000, 50000, { inQuotaDuty: 0, outQuotaDuty: 0.12 }
    );
  });

  test('responde 200 con applicable false cuando faltan los tipos', async () => {
    quotaService.calculateQuotaSavings.mockResolvedValue({
      applicable: false, savings: null, message: 'falta el tipo dentro'
    });

    const res = await request(app).post('/api/quotas/calculate-savings')
      .send({ taricCode: '0302410000', originCountry: 'CN', quantity: 1000, customsValue: 50000 });

    expect(res.status).toBe(200);
    expect(res.body.data.savings).toBeNull();
  });
});

describe('GET /api/quotas/critical', () => {
  test('declara que la criticidad la marca TARIC', async () => {
    quotaService.getCriticalQuotas.mockResolvedValue({
      quotas: [{ orderNumber: '090006', critical: true }],
      totalCritical: 1,
      truncated: false,
      limit: 200
    });

    const res = await request(app).get('/api/quotas/critical');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.criticalSource).toBe('taric');
  });

  test('publica el total cuando el tope recorta la lista', async () => {
    // 291 criticos en el catalogo de 2026 y tope de 200: devolver solo `count`
    // se leeria como que hay 200.
    quotaService.getCriticalQuotas.mockResolvedValue({
      quotas: [{ orderNumber: '090006', critical: true }],
      totalCritical: 291,
      truncated: true,
      limit: 200
    });

    const res = await request(app).get('/api/quotas/critical');

    expect(res.body.data).toMatchObject({ totalCritical: 291, truncated: true, limit: 200 });
  });

  test('una lista vacia no es un error', async () => {
    quotaService.getCriticalQuotas.mockResolvedValue({
      quotas: [], totalCritical: 0, truncated: false, limit: 200
    });

    const res = await request(app).get('/api/quotas/critical');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });
});

describe('GET /api/quotas/list', () => {
  test('pagina el listado y dice el total', async () => {
    // La fuente publica ~1.125 contingentes por ano: devolverlos todos de golpe
    // no es viable, y el total tiene que viajar para que la UI no crea que hay 50.
    TariffQuota.countDocuments = jest.fn().mockResolvedValue(1125);
    TariffQuota.find = jest.fn(() => cadena([{ orderNumber: '090006' }, { orderNumber: '090007' }]));
    quotaService.generateQuotaReport.mockResolvedValue({ summary: { lastSyncAt: '2026-08-10T06:00:00.000Z' } });

    const res = await request(app).get('/api/quotas/list?limit=2&page=3');

    expect(res.body.data).toMatchObject({ count: 2, total: 1125, page: 3, limit: 2, synced: true });
    expect(res.body.data.lastSyncAt).toBe('2026-08-10T06:00:00.000Z');
  });

  test('un catalogo vacio se marca como no sincronizado', async () => {
    // Sin esta distincion la lista vacia se lee como "la UE no tiene contingentes".
    quotaService.generateQuotaReport.mockResolvedValue({ summary: { lastSyncAt: null } });

    const res = await request(app).get('/api/quotas/list');

    expect(res.body.data.synced).toBe(false);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.officialSource).toContain('quota_consultation.jsp');
  });

  test('acota el limite pedido para que no se pida el catalogo entero', async () => {
    quotaService.generateQuotaReport.mockResolvedValue({ summary: { lastSyncAt: null } });

    const res = await request(app).get('/api/quotas/list?limit=5000');

    expect(res.body.data.limit).toBe(200);
  });
});

describe('GET /api/quotas/:orderNumber', () => {
  test('devuelve el contingente del catalogo', async () => {
    TariffQuota.findOne = jest.fn(() => cadena({ orderNumber: '090006' }));

    const res = await request(app).get('/api/quotas/090006');

    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe('090006');
  });

  test('404 con el ano en el mensaje cuando el numero de orden no existe', async () => {
    // 090001 es uno de los 10 numeros de orden inventados que llevaba el catalogo.
    const res = await request(app).get('/api/quotas/090001?year=2026');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/090001.*2026/);
  });
});

describe('GET /api/quotas/info', () => {
  test('publica el estado de la sincronizacion y no la promete en vivo', async () => {
    TariffQuota.countDocuments = jest.fn()
      .mockResolvedValueOnce(1125)
      .mockResolvedValueOnce(37);
    TariffQuota.findOne = jest.fn(() => cadena({ syncedAt: new Date('2026-08-10T06:00:00.000Z') }));

    const res = await request(app).get('/api/quotas/info');

    expect(res.body.data.source.isLiveBalance).toBe(false);
    expect(res.body.data.source.syncedQuotas).toBe(1125);
    expect(res.body.data.source.criticalQuotas).toBe(37);
    expect(res.body.data.source.lastSyncAt).toBe('2026-08-10T06:00:00.000Z');
  });

  test('enumera las limitaciones del dato en vez de prometer tiempo real', async () => {
    // La version anterior anunciaba "Verificacion de disponibilidad en tiempo
    // real" y "Reserva y asignacion de contingentes": ninguna de las dos existia.
    const res = await request(app).get('/api/quotas/info');

    const texto = res.body.data.limitations.join(' ');
    expect(texto).toMatch(/FCFS/);
    expect(texto).toMatch(/no reserva cupo|atribucion la hace la aduana/i);
    expect(JSON.stringify(res.body.data)).not.toMatch(/tiempo real/i);
    // Los acuerdos comerciales ya no se afirman: la fuente no clasifica por
    // acuerdo y los que se listaban (CETA, EU-MERCOSUR) estaban inventados.
    expect(JSON.stringify(res.body.data)).not.toMatch(/MERCOSUR|CETA/);
  });
});
