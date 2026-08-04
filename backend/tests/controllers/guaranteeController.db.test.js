/**
 * guaranteeController: gestion de garantias aduaneras contra Mongo real.
 *
 * La garantia es lógica de negocio crítica (cubre derechos ante la AEAT) y todo
 * cuelga de su aislamiento por propietario (owner: req.user._id). Lo que se
 * prueba de verdad:
 *   1. list: filtros (status/type/usage/search), paginacion y aislamiento por
 *      owner (un usuario NO ve las garantias de otro).
 *   2. get/update/addDocument/getMovements: el guard de owner. Con el id de una
 *      garantia de otro usuario la respuesta es 404, nunca los datos.
 *   3. update solo permite modificar en estado draft (400 si no).
 *   4. Validaciones de entrada: consume/release exigen importe positivo,
 *      activate exige GRN, findSuitable exige amount, linkExpedition exige ambos.
 *   5. calculate: delega en el calculo puro (ya cubierto aparte) y lo devuelve.
 *   6. aiFullAnalysis: la logica PURA de readinessScore y nextSteps (con
 *      aiService mockeado, que es lo unico que sale a Bedrock).
 *
 * Que se mockea y por que: aiService sale a Bedrock -> se mockea. guaranteeService
 * NO se mockea (sus operaciones ya estan cubiertas y aqui ejercitan el modelo
 * real). El modelo Guarantee NO se mockea: es donde viven las reglas (required,
 * enums, owner) que dan valor al test.
 *
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  analyzeGuaranteeNeeds: jest.fn(),
  recommendGuaranteeType: jest.fn(),
  optimizeGuaranteeUsage: jest.fn(),
  calculateSmartGuaranteeAmount: jest.fn()
}));

const { Guarantee } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const ctrl = require('../../src/controllers/guaranteeController');

usarBaseDeDatosEnMemoria();

/** Usuario simulado. */
function usuario(extra = {}) {
  return { _id: new mongoose.Types.ObjectId(), role: 'operator', name: 'Operario', ...extra };
}

/** Res simulado que captura status y json. */
function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

/** Persiste una garantia minima valida para un owner dado. */
async function crearGarantia(ownerId, extra = {}) {
  return Guarantee.create({
    owner: ownerId,
    type: 'CGU',
    name: 'Garantia global',
    totalAmount: 100000,
    consumedAmount: 0,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2027-01-01'),
    status: 'draft',
    ...extra
  });
}

describe('list: filtros, paginacion y aislamiento por owner', () => {
  test('solo devuelve las garantias del owner autenticado', async () => {
    const user = usuario();
    const otro = usuario();
    await crearGarantia(user._id, { name: 'Mia' });
    await crearGarantia(otro._id, { name: 'De otro' });

    const res = crearRes();
    await ctrl.list({ user, query: {} }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Mia');
  });

  test('filtra por status y calcula la paginacion', async () => {
    const user = usuario();
    await crearGarantia(user._id, { status: 'active', name: 'A' });
    await crearGarantia(user._id, { status: 'draft', name: 'B' });

    const res = crearRes();
    await ctrl.list({ user, query: { status: 'active', page: '1', limit: '10' } }, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('A');
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.pages).toBe(1);
  });

  test('busca por referencia/grn/name con regex', async () => {
    const user = usuario();
    await crearGarantia(user._id, { name: 'Aval Santander', grn: 'ES01GRN' });
    await crearGarantia(user._id, { name: 'Deposito efectivo' });

    const res = crearRes();
    await ctrl.list({ user, query: { search: 'santander' } }, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Aval Santander');
  });
});

describe('get: guard de owner', () => {
  test('devuelve la garantia propia', async () => {
    const user = usuario();
    const g = await crearGarantia(user._id);

    const res = crearRes();
    await ctrl.get({ user, params: { id: g._id.toString() } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data._id.toString()).toBe(g._id.toString());
  });

  test('con el id de una garantia de otro owner responde 404, no los datos', async () => {
    const user = usuario();
    const otro = usuario();
    const g = await crearGarantia(otro._id, { name: 'Secreta' });

    const res = crearRes();
    await ctrl.get({ user, params: { id: g._id.toString() } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.data).toBeUndefined();
  });
});

describe('update: solo en estado draft', () => {
  test('actualiza los campos permitidos de una garantia en draft', async () => {
    const user = usuario();
    const g = await crearGarantia(user._id, { status: 'draft', name: 'Vieja' });

    const res = crearRes();
    await ctrl.update({ user, params: { id: g._id.toString() }, body: { name: 'Nueva', totalAmount: 200000 } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('Nueva');
    expect(res.body.data.totalAmount).toBe(200000);
  });

  test('rechaza con 400 modificar una garantia que no esta en draft', async () => {
    const user = usuario();
    const g = await crearGarantia(user._id, { status: 'active' });

    const res = crearRes();
    await ctrl.update({ user, params: { id: g._id.toString() }, body: { name: 'X' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/active/);
  });

  test('con id de otro owner responde 404', async () => {
    const user = usuario();
    const otro = usuario();
    const g = await crearGarantia(otro._id);

    const res = crearRes();
    await ctrl.update({ user, params: { id: g._id.toString() }, body: { name: 'X' } }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('validaciones de entrada', () => {
  test('activate exige GRN', async () => {
    const res = crearRes();
    await ctrl.activate({ user: usuario(), params: { id: 'x' }, body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/GRN/);
  });

  test('consume exige importe positivo', async () => {
    const res = crearRes();
    await ctrl.consume({ user: usuario(), params: { id: 'x' }, body: { amount: 0 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/positivo/);
  });

  test('release exige importe positivo', async () => {
    const res = crearRes();
    await ctrl.release({ user: usuario(), params: { id: 'x' }, body: { amount: -5 } }, res);

    expect(res.statusCode).toBe(400);
  });

  test('findSuitable exige amount', async () => {
    const res = crearRes();
    await ctrl.findSuitable({ user: usuario(), query: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/amount/);
  });

  test('linkExpedition exige expeditionId y amount', async () => {
    const res = crearRes();
    await ctrl.linkExpedition({ user: usuario(), params: { id: 'x' }, body: { amount: 100 } }, res);

    expect(res.statusCode).toBe(400);
  });

  test('releaseExpedition exige expeditionId', async () => {
    const res = crearRes();
    await ctrl.releaseExpedition({ user: usuario(), params: { id: 'x' }, body: {} }, res);

    expect(res.statusCode).toBe(400);
  });

  test('renew exige newValidUntil', async () => {
    const res = crearRes();
    await ctrl.renew({ user: usuario(), params: { id: 'x' }, body: {} }, res);

    expect(res.statusCode).toBe(400);
  });
});

describe('calculate: calculo de garantia requerida', () => {
  test('devuelve el calculo para una operacion de transito', async () => {
    const res = crearRes();
    await ctrl.calculate({ user: usuario(), body: { operationType: 'transit', customsValue: 50000, dutyRate: 10 } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

describe('addDocument y getMovements: guard de owner', () => {
  test('addDocument agrega un documento a la garantia propia', async () => {
    const user = usuario();
    const g = await crearGarantia(user._id);

    const res = crearRes();
    await ctrl.addDocument({ user, params: { id: g._id.toString() }, body: { type: 'bank_letter', name: 'aval.pdf', url: 'http://x/aval.pdf' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.documents).toHaveLength(1);
  });

  test('addDocument con id de otro owner responde 404', async () => {
    const user = usuario();
    const otro = usuario();
    const g = await crearGarantia(otro._id);

    const res = crearRes();
    await ctrl.addDocument({ user, params: { id: g._id.toString() }, body: { type: 't', name: 'n', url: 'u' } }, res);

    expect(res.statusCode).toBe(404);
  });

  test('getMovements devuelve los movimientos paginados de la garantia propia', async () => {
    const user = usuario();
    const g = await crearGarantia(user._id);

    const res = crearRes();
    await ctrl.getMovements({ user, params: { id: g._id.toString() }, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBe(0);
  });

  test('getMovements con id de otro owner responde 404', async () => {
    const user = usuario();
    const otro = usuario();
    const g = await crearGarantia(otro._id);

    const res = crearRes();
    await ctrl.getMovements({ user, params: { id: g._id.toString() }, query: {} }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('aiFullAnalysis: score de preparacion y proximos pasos (logica pura)', () => {
  test('con garantias activas disponibles y cobertura suficiente sube el readinessScore', async () => {
    const user = usuario();
    await crearGarantia(user._id, { status: 'active', totalAmount: 100000, consumedAmount: 0 });

    aiService.analyzeGuaranteeNeeds.mockResolvedValue({ existingCoverage: { sufficient: true }, recommendation: 'ok' });
    aiService.recommendGuaranteeType.mockResolvedValue({ recommendedType: 'CGU', reasoning: 'mejor' });
    aiService.optimizeGuaranteeUsage.mockResolvedValue({ utilizationAnalysis: { averageUtilization: 50 }, optimizations: [{ x: 1 }] });
    aiService.calculateSmartGuaranteeAmount.mockResolvedValue({ amount: 12345 });

    const res = crearRes();
    await ctrl.aiFullAnalysis({ user, body: { operation: { customsValue: 50000 } } }, res);

    expect(res.statusCode).toBe(200);
    // 30 (activas) + 20 (disponible>50k) + 15 (util<80) + 35 (cobertura suficiente) = 100
    expect(res.body.data.summary.readinessScore).toBe(100);
    expect(res.body.data.summary.factors).toContain('Tiene garantias activas');
    // Cobertura suficiente -> NO se sugiere aumentar; si optimizaciones (prioridad 2) y tipo (prioridad 3).
    expect(res.body.data.nextSteps.map(s => s.priority)).toEqual([2, 3]);
  });

  test('sin cobertura suficiente el primer proximo paso es aumentar la cobertura (prioridad 1)', async () => {
    const user = usuario();
    await crearGarantia(user._id, { status: 'active', totalAmount: 10000, consumedAmount: 0 });

    aiService.analyzeGuaranteeNeeds.mockResolvedValue({ existingCoverage: { sufficient: false }, recommendation: 'sube la cobertura' });
    aiService.recommendGuaranteeType.mockResolvedValue({});
    aiService.optimizeGuaranteeUsage.mockResolvedValue({ optimizations: [] });
    aiService.calculateSmartGuaranteeAmount.mockResolvedValue({});

    const res = crearRes();
    await ctrl.aiFullAnalysis({ user, body: { operation: { customsValue: 5000 } } }, res);

    expect(res.body.data.nextSteps[0].priority).toBe(1);
    expect(res.body.data.nextSteps[0].action).toMatch(/cobertura/i);
  });

  test('sin garantias ni operacion el score es 0 y no hay proximos pasos', async () => {
    const user = usuario();

    const res = crearRes();
    await ctrl.aiFullAnalysis({ user, body: {} }, res);

    expect(res.body.data.summary.readinessScore).toBe(0);
    expect(res.body.data.nextSteps).toHaveLength(0);
    expect(res.body.data.summary.totalActiveGuarantees).toBe(0);
  });
});

describe('aiOptimize: sin garantias activas responde un mensaje guia', () => {
  test('sin garantias activas ni draft no llama a la IA y devuelve mensaje', async () => {
    const user = usuario();

    const res = crearRes();
    await ctrl.aiOptimize({ user, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.currentStatus.totalGuarantees).toBe(0);
    expect(aiService.optimizeGuaranteeUsage).not.toHaveBeenCalled();
  });
});

describe('delegadores hacia guaranteeService (service real, BD real)', () => {
  test('getStats responde 200 con las estadisticas del owner', async () => {
    const user = usuario();
    await crearGarantia(user._id, { status: 'active' });

    const res = crearRes();
    await ctrl.getStats({ user, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  test('getAlerts responde 200 con la lista de alertas y su recuento', async () => {
    const user = usuario();

    const res = crearRes();
    await ctrl.getAlerts({ user, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBe(res.body.data.length);
  });

  test('create persiste una garantia nueva del owner en estado draft (201)', async () => {
    const user = usuario();

    const res = crearRes();
    await ctrl.create({
      user,
      body: {
        type: 'CGU',
        name: 'Nueva garantia',
        totalAmount: 80000,
        validFrom: new Date('2026-06-01'),
        validUntil: new Date('2027-06-01')
      }
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.owner.toString()).toBe(user._id.toString());

    const enBd = await Guarantee.findById(res.body.data._id);
    expect(enBd).not.toBeNull();
  });

  test('create con fecha de fin no futura responde 500 y no persiste', async () => {
    const user = usuario();

    const res = crearRes();
    await ctrl.create({
      user,
      body: {
        type: 'CGU', name: 'Caducada', totalAmount: 1000,
        validFrom: new Date('2020-01-01'), validUntil: new Date('2020-02-01')
      }
    }, res);

    expect(res.statusCode).toBe(500);
    expect(await Guarantee.countDocuments({ owner: user._id })).toBe(0);
  });

  test('suspend cambia el estado de la garantia activa propia a suspended', async () => {
    const user = usuario();
    const g = await crearGarantia(user._id, { status: 'active' });

    const res = crearRes();
    await ctrl.suspend({ user, params: { id: g._id.toString() }, body: { reason: 'Revision' } }, res);

    expect(res.statusCode).toBe(200);
    const enBd = await Guarantee.findById(g._id);
    expect(enBd.status).toBe('suspended');
  });

  test('cancel de una garantia inexistente propaga error de negocio como 400', async () => {
    const user = usuario();

    const res = crearRes();
    await ctrl.cancel({ user, params: { id: new mongoose.Types.ObjectId().toString() }, body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('generateReport responde 200 acotando por owner', async () => {
    const user = usuario();
    await crearGarantia(user._id, { status: 'active' });

    const res = crearRes();
    await ctrl.generateReport({ user, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('aiAnalyzeNeeds y aiSmartCalculate: validan operation', () => {
  test('aiAnalyzeNeeds exige operation', async () => {
    const res = crearRes();
    await ctrl.aiAnalyzeNeeds({ user: usuario(), body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  test('aiSmartCalculate exige operation', async () => {
    const res = crearRes();
    await ctrl.aiSmartCalculate({ user: usuario(), body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  test('aiRecommendType exige operationDetails', async () => {
    const res = crearRes();
    await ctrl.aiRecommendType({ user: usuario(), body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  test('getAiAnalysis devuelve null bajo demanda', async () => {
    const res = crearRes();
    await ctrl.getAiAnalysis({ user: usuario() }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeNull();
  });
});
