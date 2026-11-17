/**
 * Aplicar un TARIC al expediente: no se guarda un codigo que no se puede declarar.
 *
 * Caso real de preproduccion (17/Nov/2026): «Auriculares inalambricos
 * Bluetooth 5.3 con estuche de carga» quedo con 8518300000, aplicado desde la
 * sugerencia de la IA (POST /api/expeditions/:id/ai/apply-taric/:itemIndex),
 * y con el se genero el H1. Esa linea del TARIC tiene subdivisiones: hay que
 * declarar 8518300010 o 8518300090. Ninguno de los dos endpoints de aplicar
 * comprobaba el catalogo.
 *
 * Se mockea solo lo externo (aiService). BD en memoria, nunca produccion.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  classifyProduct: jest.fn(),
  validateClassification: jest.fn(),
  suggestTaricClassification: jest.fn()
}));

const { TaricCode, Expedition } = require('../../src/models');
const expeditionController = require('../../src/controllers/expeditionController');
const classificationController = require('../../src/controllers/classificationController');

const TENANT = new mongoose.Types.ObjectId();
const usuario = () => ({ _id: new mongoose.Types.ObjectId(), name: 'Operadora', tenantId: TENANT });

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const crearExpediente = () => Expedition.create({
  tenantId: TENANT,
  operationType: 'import',
  transportMode: 'air',
  status: 'classification_pending',
  client: { companyName: 'Importadora SL', nif: 'B12345678' },
  goods: [{
    itemNumber: 1,
    description: 'Auriculares inalambricos Bluetooth 5.3 con estuche de carga',
    quantity: 100,
    invoiceValue: 2000
  }]
});

const linea = (code, isLeaf = true) => ({ code, isLeaf, isActive: true, level: 10, description: { es: `Linea ${code}` } });

describe('aplicar un TARIC no declarable', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(async () => {
    await TaricCode.insertMany([
      linea('8518300000', false),
      linea('8518300010'),
      linea('8518300090')
    ]);
  });

  describe('POST /api/expeditions/:id/ai/apply-taric/:itemIndex', () => {
    it('caso real: rechaza 8518300000 con 422, ofrece las subdivisiones y no toca el expediente', async () => {
      const exp = await crearExpediente();
      const res = crearRes();

      await expeditionController.applyTaricSuggestion({
        params: { id: exp._id, itemIndex: '0' },
        body: { taricCode: '8518300000', hsCode: '851830' },
        user: usuario()
      }, res);

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/8518300000/);
      expect(res.body.data.alternatives.map(a => a.code)).toEqual(['8518300010', '8518300090']);
      const guardado = await Expedition.findById(exp._id);
      expect(guardado.goods[0].taricCode).toBeUndefined();
      expect(guardado.timeline.some(t => t.action === 'taric_updated')).toBe(false);
    });

    it('aplica la subdivision declarable', async () => {
      const exp = await crearExpediente();
      const res = crearRes();

      await expeditionController.applyTaricSuggestion({
        params: { id: exp._id, itemIndex: '0' },
        body: { taricCode: '8518300090' },
        user: usuario()
      }, res);

      expect(res.statusCode).toBe(200);
      const guardado = await Expedition.findById(exp._id);
      expect(guardado.goods[0].taricCode).toBe('8518300090');
    });

    it('rechaza un codigo que no existe en el catalogo (caso 6302219000)', async () => {
      const exp = await crearExpediente();
      const res = crearRes();

      await expeditionController.applyTaricSuggestion({
        params: { id: exp._id, itemIndex: '0' },
        body: { taricCode: '6302219000' },
        user: usuario()
      }, res);

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toMatch(/no existe/);
    });
  });

  describe('POST /api/classification/apply', () => {
    it('caso real: rechaza 8518300000 con 422 y no toca el expediente', async () => {
      const exp = await crearExpediente();
      const res = crearRes();

      await classificationController.applyClassification({
        body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '8518300000' },
        user: usuario()
      }, res);

      expect(res.statusCode).toBe(422);
      expect(res.body.data.alternatives.map(a => a.code)).toEqual(['8518300010', '8518300090']);
      const guardado = await Expedition.findById(exp._id);
      expect(guardado.goods[0].taricCode).toBeUndefined();
      expect(guardado.status).toBe('classification_pending');
    });

    it('aplica la subdivision declarable', async () => {
      const exp = await crearExpediente();
      const res = crearRes();

      await classificationController.applyClassification({
        body: { expeditionId: exp._id.toString(), itemIndex: 0, taricCode: '8518300010' },
        user: usuario()
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.item.taricCode).toBe('8518300010');
    });
  });
});
