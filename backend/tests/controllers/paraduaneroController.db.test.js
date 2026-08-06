/**
 * paraduaneroController — controles paraduaneros (SOIVRE/MAPA/SANIDAD/...).
 *
 * A diferencia de otros controllers de esta campaña, este NO es un wrapper puro:
 * toca los modelos ParaduaneroControl y Expedition directamente y aplica
 * ensureSameTenant. Por eso se ejercita con Mongo EN MEMORIA y modelos reales
 * (no se mockean los modelos). Se mockea SOLO paraduaneroService (frontera: su
 * motor de reglas ya se prueba en tests/services/).
 *
 * Foco: el guard de tenant en analyze/create/getById/update/changeStatus, el
 * filtro por tenant del listado, la agregación de getStats en el controller y
 * los catch → 500.
 *
 * REGRESIÓN (fix 6/Ago, ver SECURITY_AUDIT.md): ParaduaneroControl AHORA declara
 * `tenantId` en su schema y lo hereda del expediente al crearse. Antes del fix:
 *   - ensureSameTenant(control) veía docTenant=null y SIEMPRE dejaba pasar (rama
 *     legacy) → getById/update/changeStatus NO aislaban por tenant.
 *   - list filtraba por filter.tenantId, que nunca casaba ningún documento.
 * Los tests de aislamiento de abajo fijan el comportamiento correcto: un control
 * de otra organización devuelve 404 y el listado sólo trae los propios.
 *
 * jest.config: resetMocks:true → restaurar en beforeEach.
 */

jest.mock('../../src/services/paraduaneroService');

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { ParaduaneroControl, Expedition } = require('../../src/models');
const paraduaneroService = require('../../src/services/paraduaneroService');
const ctrl = require('../../src/controllers/paraduaneroController');

const ORG_A = new mongoose.Types.ObjectId().toString();
const ORG_B = new mongoose.Types.ObjectId().toString();
const USER_A = new mongoose.Types.ObjectId().toString(); // performedBy del timeline exige ObjectId

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const reqA = ({ body = {}, query = {}, params = {} } = {}) =>
  ({ body, query, params, user: { _id: USER_A, tenantId: ORG_A }, tenantId: ORG_A });

async function sembrarExpedition(tenantId = ORG_A) {
  return Expedition.create({
    expeditionId: 'EXP-' + new mongoose.Types.ObjectId().toString().slice(-6),
    tenantId,
    transportMode: 'maritime',
    operationType: 'import',
    client: { nif: 'B12345678', companyName: 'ACME SL' },
    goods: [{
      itemNumber: 1,
      description: 'juguete',
      taricCode: '95030070',
      quantity: 10,
      invoiceValue: 1000
    }]
  });
}

async function sembrarControl(expeditionId, extra = {}) {
  return ParaduaneroControl.create({
    expeditionId,
    tenantId: ORG_A,
    controlType: 'SOIVRE',
    status: 'pending',
    priority: 'normal',
    ...extra
  });
}

describe('paraduaneroController (BD real en memoria)', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(() => {
    Object.keys(paraduaneroService).forEach((k) => {
      if (typeof paraduaneroService[k] === 'function') paraduaneroService[k].mockResolvedValue({ ok: true });
    });
  });

  // ==================== analyzeExpedition ====================
  describe('analyzeExpedition', () => {
    test('éxito: analiza el expediente del propio tenant', async () => {
      const exp = await sembrarExpedition(ORG_A);
      paraduaneroService.analyzeExpedition.mockResolvedValue([{ controlType: 'SOIVRE' }]);
      const res = mockRes();
      await ctrl.analyzeExpedition(reqA({ params: { expeditionId: exp._id.toString() } }), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data.controlsRequired).toBe(1);
      expect(res.body.data.totalGoods).toBe(1);
    });

    test('404 si el expediente es de otro tenant (guard)', async () => {
      const exp = await sembrarExpedition(ORG_B);
      const res = mockRes();
      await ctrl.analyzeExpedition(reqA({ params: { expeditionId: exp._id.toString() } }), res);
      expect(res.statusCode).toBe(404);
    });

    test('404 si el expediente no existe', async () => {
      const res = mockRes();
      await ctrl.analyzeExpedition(reqA({ params: { expeditionId: new mongoose.Types.ObjectId().toString() } }), res);
      expect(res.statusCode).toBe(404);
    });

    test('500 si el service lanza', async () => {
      const exp = await sembrarExpedition(ORG_A);
      paraduaneroService.analyzeExpedition.mockRejectedValue(new Error('x'));
      const res = mockRes();
      await ctrl.analyzeExpedition(reqA({ params: { expeditionId: exp._id.toString() } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== createControls ====================
  describe('createControls', () => {
    test('éxito', async () => {
      const exp = await sembrarExpedition(ORG_A);
      paraduaneroService.createControlsForExpedition.mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]);
      const res = mockRes();
      await ctrl.createControls(reqA({ params: { expeditionId: exp._id.toString() } }), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    test('404 si el expediente es de otro tenant', async () => {
      const exp = await sembrarExpedition(ORG_B);
      const res = mockRes();
      await ctrl.createControls(reqA({ params: { expeditionId: exp._id.toString() } }), res);
      expect(res.statusCode).toBe(404);
    });

    test('500 si el service lanza', async () => {
      const exp = await sembrarExpedition(ORG_A);
      paraduaneroService.createControlsForExpedition.mockRejectedValue(new Error('boom'));
      const res = mockRes();
      await ctrl.createControls(reqA({ params: { expeditionId: exp._id.toString() } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== list ====================
  describe('list', () => {
    test('devuelve controles con paginación y populate', async () => {
      const exp = await sembrarExpedition(ORG_A);
      await sembrarControl(exp._id);
      await sembrarControl(exp._id, { controlType: 'MAPA' });
      const res = mockRes();
      await ctrl.list(reqA({ query: { page: '1', limit: '10' } }), res);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(0);
    });

    test('filtra por controlType/status/priority/expeditionId', async () => {
      const exp = await sembrarExpedition(ORG_A);
      await sembrarControl(exp._id, { controlType: 'SOIVRE', status: 'pending' });
      await sembrarControl(exp._id, { controlType: 'MAPA', status: 'approved' });
      const res = mockRes();
      await ctrl.list(reqA({ query: { controlType: 'MAPA' } }), res);
      expect(res.body.data.every(c => c.controlType === 'MAPA')).toBe(true);
    });

    test('REGRESIÓN aislamiento: list sólo trae los controles del propio tenant', async () => {
      // Se siembran controles de A y de B. Con tenantId ya persistido, el
      // filtro filter.tenantId = ORG_A debe traer SÓLO los de A y ninguno de B.
      const expA = await sembrarExpedition(ORG_A);
      const expB = await sembrarExpedition(ORG_B);
      await sembrarControl(expA._id, { tenantId: ORG_A });
      await sembrarControl(expA._id, { tenantId: ORG_A, controlType: 'MAPA' });
      await sembrarControl(expB._id, { tenantId: ORG_B });
      const res = mockRes();
      await ctrl.list(reqA({ query: {} }), res);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.data.every(c => String(c.tenantId) === ORG_A)).toBe(true);
    });

    test('500 si la query falla (expeditionId no-ObjectId)', async () => {
      const res = mockRes();
      await ctrl.list(reqA({ query: { expeditionId: 'no-es-objectid' } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== getByExpedition ====================
  describe('getByExpedition', () => {
    test('éxito delega en el service', async () => {
      paraduaneroService.getControlsForExpedition.mockResolvedValue([{ _id: 'c1' }]);
      const res = mockRes();
      await ctrl.getByExpedition(reqA({ params: { expeditionId: 'e1' } }), res);
      expect(res.body.data).toHaveLength(1);
    });

    test('500 si lanza', async () => {
      paraduaneroService.getControlsForExpedition.mockRejectedValue(new Error('x'));
      const res = mockRes();
      await ctrl.getByExpedition(reqA({ params: { expeditionId: 'e1' } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== getById ====================
  describe('getById', () => {
    test('éxito', async () => {
      const exp = await sembrarExpedition(ORG_A);
      const control = await sembrarControl(exp._id);
      const res = mockRes();
      await ctrl.getById(reqA({ params: { id: control._id.toString() } }), res);
      expect(res.body.success).toBe(true);
      expect(String(res.body.data._id)).toBe(control._id.toString());
    });

    test('404 si no existe', async () => {
      const res = mockRes();
      await ctrl.getById(reqA({ params: { id: new mongoose.Types.ObjectId().toString() } }), res);
      expect(res.statusCode).toBe(404);
    });

    test('REGRESIÓN aislamiento: 404 si el control es de otro tenant', async () => {
      const exp = await sembrarExpedition(ORG_B);
      const control = await sembrarControl(exp._id, { tenantId: ORG_B });
      const res = mockRes();
      // Usuario de A pidiendo un control de B: debe recibir 404, no los datos.
      await ctrl.getById(reqA({ params: { id: control._id.toString() } }), res);
      expect(res.statusCode).toBe(404);
    });

    test('500 si el id no es ObjectId válido', async () => {
      const res = mockRes();
      await ctrl.getById(reqA({ params: { id: 'malformado' } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== update ====================
  describe('update', () => {
    test('solo actualiza campos permitidos y añade evento al timeline', async () => {
      const exp = await sembrarExpedition(ORG_A);
      const control = await sembrarControl(exp._id);
      const res = mockRes();
      await ctrl.update(reqA({
        params: { id: control._id.toString() },
        body: { notes: 'nota nueva', priority: 'high', status: 'approved' /* NO permitido */ }
      }), res);
      expect(res.body.success).toBe(true);
      const recargado = await ParaduaneroControl.findById(control._id);
      expect(recargado.notes).toBe('nota nueva');
      expect(recargado.priority).toBe('high');
      expect(recargado.status).toBe('pending'); // status no está en allowedFields
      expect(recargado.timeline.some(t => t.action === 'note_added')).toBe(true);
    });

    test('404 si no existe', async () => {
      const res = mockRes();
      await ctrl.update(reqA({ params: { id: new mongoose.Types.ObjectId().toString() }, body: {} }), res);
      expect(res.statusCode).toBe(404);
    });

    test('REGRESIÓN aislamiento: 404 y NO muta un control de otro tenant', async () => {
      const exp = await sembrarExpedition(ORG_B);
      const control = await sembrarControl(exp._id, { tenantId: ORG_B, notes: 'original' });
      const res = mockRes();
      await ctrl.update(reqA({ params: { id: control._id.toString() }, body: { notes: 'intento ajeno' } }), res);
      expect(res.statusCode).toBe(404);
      const recargado = await ParaduaneroControl.findById(control._id);
      expect(recargado.notes).toBe('original'); // no se tocó
    });

    test('500 si el id es inválido', async () => {
      const res = mockRes();
      await ctrl.update(reqA({ params: { id: 'malo' }, body: {} }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== changeStatus ====================
  describe('changeStatus', () => {
    test('cambia estado y fija resolvedAt en approved', async () => {
      const exp = await sembrarExpedition(ORG_A);
      const control = await sembrarControl(exp._id);
      const res = mockRes();
      await ctrl.changeStatus(reqA({
        params: { id: control._id.toString() },
        body: { status: 'approved', reason: 'todo correcto' }
      }), res);
      expect(res.body.success).toBe(true);
      const recargado = await ParaduaneroControl.findById(control._id);
      expect(recargado.status).toBe('approved');
      expect(recargado.resolvedAt).toBeTruthy();
      expect(recargado.timeline.some(t => t.action === 'status_changed')).toBe(true);
    });

    test('estado no resolutivo no fija resolvedAt', async () => {
      const exp = await sembrarExpedition(ORG_A);
      const control = await sembrarControl(exp._id);
      const res = mockRes();
      await ctrl.changeStatus(reqA({
        params: { id: control._id.toString() },
        body: { status: 'under_inspection' }
      }), res);
      const recargado = await ParaduaneroControl.findById(control._id);
      expect(recargado.status).toBe('under_inspection');
      expect(recargado.resolvedAt).toBeFalsy();
    });

    test('404 si no existe', async () => {
      const res = mockRes();
      await ctrl.changeStatus(reqA({ params: { id: new mongoose.Types.ObjectId().toString() }, body: { status: 'approved' } }), res);
      expect(res.statusCode).toBe(404);
    });

    test('REGRESIÓN aislamiento: 404 y NO cambia el estado de un control de otro tenant', async () => {
      const exp = await sembrarExpedition(ORG_B);
      const control = await sembrarControl(exp._id, { tenantId: ORG_B, status: 'pending' });
      const res = mockRes();
      await ctrl.changeStatus(reqA({ params: { id: control._id.toString() }, body: { status: 'approved' } }), res);
      expect(res.statusCode).toBe(404);
      const recargado = await ParaduaneroControl.findById(control._id);
      expect(recargado.status).toBe('pending'); // no se tocó
    });

    test('500 si el id es inválido', async () => {
      const res = mockRes();
      await ctrl.changeStatus(reqA({ params: { id: 'malo' }, body: { status: 'approved' } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== provide/schedule/record/issue (delegan al service) ====================
  describe('handlers que delegan en el service', () => {
    const casos = [
      ['provideDocument', 'markDocumentProvided', { params: { id: 'c1', code: 'C620' }, body: { documentId: 'd1' } }],
      ['scheduleInspection', 'scheduleInspection', { params: { id: 'c1' }, body: { date: '2026-01-01' } }],
      ['recordInspectionResult', 'recordInspectionResult', { params: { id: 'c1' }, body: { result: 'approved' } }],
      ['issueCertificate', 'issueCertificate', { params: { id: 'c1' }, body: { type: 'CE' } }]
    ];

    test.each(casos)('%s: éxito', async (handler, svcFn, args) => {
      paraduaneroService[svcFn].mockResolvedValue({ _id: 'c1', status: 'ok' });
      const res = mockRes();
      await ctrl[handler](reqA(args), res);
      expect(res.body.success).toBe(true);
    });

    test.each(casos)('%s: 500 si lanza', async (handler, svcFn, args) => {
      paraduaneroService[svcFn].mockRejectedValue(new Error('fallo'));
      const res = mockRes();
      await ctrl[handler](reqA(args), res);
      expect(res.statusCode).toBe(500);
    });
  });

  // ==================== getStats (agregación en el controller) ====================
  describe('getStats', () => {
    test('formatea y totaliza las estadísticas por tipo', async () => {
      paraduaneroService.getStats.mockResolvedValue([
        { _id: 'SOIVRE', total: 10, pending: 4, inProgress: 2, approved: 3, rejected: 1 },
        { _id: 'MAPA', total: 5, pending: 1, inProgress: 1, approved: 2, rejected: 1 }
      ]);
      const res = mockRes();
      await ctrl.getStats(reqA({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } }), res);
      expect(res.body.data.byType.SOIVRE.total).toBe(10);
      expect(res.body.data.totals).toEqual({
        total: 15, pending: 5, inProgress: 3, approved: 5, rejected: 2
      });
    });

    test('sin datos devuelve totales a cero', async () => {
      paraduaneroService.getStats.mockResolvedValue([]);
      const res = mockRes();
      await ctrl.getStats(reqA(), res);
      expect(res.body.data.totals.total).toBe(0);
    });

    test('500 si lanza', async () => {
      paraduaneroService.getStats.mockRejectedValue(new Error('x'));
      const res = mockRes();
      await ctrl.getStats(reqA(), res);
      expect(res.statusCode).toBe(500);
    });
  });
});
