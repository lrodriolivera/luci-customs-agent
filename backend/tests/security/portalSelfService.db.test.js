/**
 * F6 (escaneo 5/Nov/2026): POST /api/portal/self-service/expeditions estaba sin
 * autenticar y el tenant destino salia de req.body.organizationId, asi que un
 * anonimo creaba expedientes (con token de portal y mensaje de chat) en el
 * tenant de otra empresa.
 *
 * Fuente legitima del tenant: antes de crear el expediente no existe ningun
 * token de portal (el token lo genera esta misma llamada), asi que no hay
 * fuente fiable sin sesion. La ruta exige authenticate y el tenant es el de
 * req.user.tenantId; el body nunca decide.
 *
 * `authenticate` se simula con su contrato real: sin usuario -> 401.
 */

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

let mockUsuario;
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    if (!mockUsuario) return res.status(401).json({ success: false, error: 'No autenticado' });
    req.user = mockUsuario;
    next();
  },
  requireRole: () => (req, res, next) => next()
}));

const { Expedition } = require('../../src/models');
const portalRoutes = require('../../src/routes/portal');

usarBaseDeDatosEnMemoria();

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

const app = express();
app.use(express.json());
app.use('/api/portal', portalRoutes);

const cuerpo = (extra = {}) => ({
  client: { companyName: 'Atacante SL', email: 'a@b.c', taxId: 'B12345678' },
  operation: { operationType: 'import' },
  ...extra
});

beforeEach(() => {
  mockUsuario = null;
});

describe('F6 — autoservicio del portal', () => {
  test('anonimo con organizationId ajeno -> 401 y ninguna Expedition creada', async () => {
    const res = await request(app)
      .post('/api/portal/self-service/expeditions')
      .send(cuerpo({ organizationId: String(TENANT_B) }));

    expect(res.status).toBe(401);
    expect(await Expedition.countDocuments({})).toBe(0);
  });

  test('autenticado de A que pide organizationId de B -> se crea en A, nunca en B', async () => {
    mockUsuario = { _id: new mongoose.Types.ObjectId(), role: 'admin', tenantId: TENANT_A };

    const res = await request(app)
      .post('/api/portal/self-service/expeditions')
      .send(cuerpo({ organizationId: String(TENANT_B) }));

    expect(res.status).toBe(201);
    expect(await Expedition.countDocuments({ tenantId: TENANT_B })).toBe(0);
    const creada = await Expedition.findOne({ tenantId: TENANT_A });
    expect(creada).not.toBeNull();
  });

  test('usuario sin tenant -> 400 y no se crea nada', async () => {
    mockUsuario = { _id: new mongoose.Types.ObjectId(), role: 'admin' };

    const res = await request(app)
      .post('/api/portal/self-service/expeditions')
      .send(cuerpo({ organizationId: String(TENANT_B) }));

    expect(res.status).toBe(400);
    expect(await Expedition.countDocuments({})).toBe(0);
  });
});
