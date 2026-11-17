/**
 * calculationController.calculateTotal contra un expediente REAL (Mongo en
 * memoria).
 *
 * Este fichero es el companion de calculationController.test.js. Aquel cubre el
 * camino de items directos con `src/models` mockeado; aqui NO se mockea models,
 * de modo que Expedition es Mongoose de verdad. Se ejercita:
 *   - la lectura de las mercancias del expediente (goods -> items),
 *   - el guard de tenant (ensureSameTenant) sobre el expediente ajeno,
 *   - la persistencia de `calculations` y de los calculos por item en `goods`.
 *
 * Solo se mockea `dutyCalculationService` (Bedrock, frontera externa). El
 * calculo del controller (CIF, base IVA, garantia, agregacion) es real.
 */

const mockCalcDuties = jest.fn();

jest.mock('../../src/services/dutyCalculationService', () => ({
  getDutyInfo: jest.fn(),
  calculateDutiesWithAI: (...a) => mockCalcDuties(...a),
  validateDutyRate: jest.fn(),
  clearMemoryCache: jest.fn()
}));

// axios no debe salir a red: el camino de expediente usa currency EUR.
jest.mock('axios', () => ({ get: jest.fn() }));

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

const { Expedition } = require('../../src/models');
const ctrl = require('../../src/controllers/calculationController');

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

/** Crea un expediente valido para un tenant, con una mercancia. */
async function crearExpedition(tenantId, goods) {
  return Expedition.create({
    tenantId,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B12345678' },
    goods: goods.map((g, i) => ({
      itemNumber: i + 1,
      description: g.description || 'Mercancia',
      taricCode: g.taricCode,
      originCountry: g.originCountry,
      quantity: g.quantity,
      netWeight: g.netWeight,
      invoiceValue: g.invoiceValue,
      currency: 'EUR'
    }))
  });
}

beforeEach(() => {
  mockCalcDuties.mockReset();
});

describe('calculateTotal con expeditionId: lectura y persistencia', () => {
  const tenantA = new mongoose.Types.ObjectId();

  test('lee las mercancias del expediente y persiste los calculos', async () => {
    const exp = await crearExpedition(tenantA, [
      { taricCode: '8471300000', originCountry: 'CN', quantity: 10, netWeight: 5, invoiceValue: 1000 }
    ]);

    mockCalcDuties.mockResolvedValue({
      description: 'CPU', duties: { totalDuty: 47, effectiveDutyRate: 4.7 },
      vat: { amount: 219.87, rate: 21 }, source: 'db', confidence: 90
    });

    const req = {
      body: { expeditionId: exp._id.toString() },
      user: { tenantId: tenantA.toString() },
      tenantId: tenantA.toString()
    };
    const res = crearRes();

    await ctrl.calculateTotal(req, res);

    // Respuesta: se calcularon los items del expediente.
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].taricCode).toBe('8471300000');
    expect(res.body.data.summary.totalDuties).toBe(47);
    // El servicio recibio el valor de factura del expediente (invoiceValue).
    expect(mockCalcDuties.mock.calls[0][0].customsValue).toBe(1000);
    expect(mockCalcDuties.mock.calls[0][0].origin).toBe('CN');

    // Persistencia: el expediente guardado tiene calculations y los goods
    // llevan los tipos/importes calculados.
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.calculations.totalDuties).toBe(47);
    expect(guardado.calculations.calculatedBy).toBe('ai');
    expect(guardado.goods[0].dutyRate).toBe(4.7);
    expect(guardado.goods[0].dutyAmount).toBe(47);
    expect(guardado.goods[0].vatAmount).toBe(219.87);
  });

  test('los items del body tienen prioridad sobre las mercancias del expediente', async () => {
    const exp = await crearExpedition(tenantA, [
      { taricCode: '8471300000', originCountry: 'CN', quantity: 1, netWeight: 1, invoiceValue: 999 }
    ]);

    mockCalcDuties.mockResolvedValue({
      description: 'otro', duties: { totalDuty: 5, effectiveDutyRate: 5 },
      vat: { amount: 10, rate: 21 }, source: 'db', confidence: 90
    });

    const req = {
      body: {
        expeditionId: exp._id.toString(),
        items: [{ taricCode: '6109100010', value: 100, currency: 'EUR' }]
      },
      user: { tenantId: tenantA.toString() },
      tenantId: tenantA.toString()
    };
    const res = crearRes();

    await ctrl.calculateTotal(req, res);

    // Se uso el item del body (100), no el invoiceValue del expediente (999).
    expect(mockCalcDuties.mock.calls[0][0].taricCode).toBe('6109100010');
    expect(mockCalcDuties.mock.calls[0][0].customsValue).toBe(100);
  });

  test('devuelve 404 si el expediente no existe', async () => {
    const idInexistente = new mongoose.Types.ObjectId().toString();
    const req = {
      body: { expeditionId: idInexistente },
      user: { tenantId: tenantA.toString() },
      tenantId: tenantA.toString()
    };
    const res = crearRes();

    await ctrl.calculateTotal(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('calculateTotal: guard de tenant sobre el expediente', () => {
  test('un tenant NO puede calcular sobre el expediente de otro (404, no fuga)', async () => {
    // Guard cross-tenant critico: sin el, el atacante ve la carga (taric,
    // valor, origen) de otro cliente calculando sobre su expediente.
    const tenantDueno = new mongoose.Types.ObjectId();
    const tenantAtacante = new mongoose.Types.ObjectId();

    const exp = await crearExpedition(tenantDueno, [
      { taricCode: '8471300000', originCountry: 'CN', quantity: 1, netWeight: 1, invoiceValue: 5000 }
    ]);

    mockCalcDuties.mockResolvedValue({
      description: 'x', duties: { totalDuty: 1, effectiveDutyRate: 1 },
      vat: { amount: 1, rate: 21 }, source: 'db', confidence: 90
    });

    const req = {
      body: { expeditionId: exp._id.toString() },
      user: { tenantId: tenantAtacante.toString() },
      tenantId: tenantAtacante.toString()
    };
    const res = crearRes();

    await ctrl.calculateTotal(req, res);

    // 404 (no 403) para no filtrar la existencia; y NO se calculo nada.
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockCalcDuties).not.toHaveBeenCalled();

    // El expediente ajeno no fue modificado.
    const intacto = await Expedition.findById(exp._id);
    expect(intacto.calculations).toBeFalsy();
  });
});
