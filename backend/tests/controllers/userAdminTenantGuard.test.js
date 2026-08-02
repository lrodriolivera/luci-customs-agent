/**
 * Aislamiento por tenant en las rutas de administracion de usuarios.
 *
 * updateUser y adminDisableUser estan detras de requireRole('admin'), que es un
 * rol DE TENANT, no del sistema. Sin acotar la consulta al tenant del
 * solicitante, un admin del cliente A podia cambiar el rol y los permisos —o
 * desactivar— a un usuario del cliente B conociendo su id.
 *
 * updateUser usaba findByIdAndUpdate, que el primer barrido de findById no
 * detecto: ese fue el punto ciego.
 */

const request = require('supertest');
const express = require('express');

const mockUser = { findOneAndUpdate: jest.fn(), findOne: jest.fn(), findById: jest.fn() };

jest.mock('../../src/models', () => ({ User: mockUser, Tenant: { findById: jest.fn() } }));
jest.mock('../../src/utils/cognitoService', () => ({ adminDisableUser: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({ sendEmail: jest.fn() }));

const authController = require('../../src/controllers/authController');

const ADMIN_T1 = { _id: 'a1', email: 'admin@t1.es', role: 'admin', tenantId: 't1' };

function app(handler, metodo = 'put') {
  const a = express();
  a.use(express.json());
  a[metodo]('/u/:id', (req, _res, next) => { req.user = ADMIN_T1; next(); }, handler);
  return a;
}

describe('authController.updateUser', () => {
  beforeEach(() => jest.clearAllMocks());

  test('la consulta se acota al tenant del admin', async () => {
    mockUser.findOneAndUpdate.mockResolvedValue({ toPublicJSON: () => ({ id: 'u2' }) });

    await request(app(authController.updateUser)).put('/u/u2').send({ role: 'admin' });

    const [filtro] = mockUser.findOneAndUpdate.mock.calls[0];
    expect(filtro).toEqual({ _id: 'u2', tenantId: 't1' });
  });

  test('404 si el usuario es de otro tenant (la consulta no lo encuentra)', async () => {
    mockUser.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app(authController.updateUser)).put('/u/u9').send({ role: 'admin' });

    expect(res.status).toBe(404);
  });

  test('no se puede escalar privilegios sobre un usuario ajeno', async () => {
    // El caso que motiva el arreglo: cambiar role/permissions cruzando tenants.
    mockUser.findOneAndUpdate.mockResolvedValue(null);

    await request(app(authController.updateUser))
      .put('/u/victima').send({ role: 'admin', permissions: { canManageUsers: true } });

    const [filtro] = mockUser.findOneAndUpdate.mock.calls[0];
    expect(filtro.tenantId).toBe('t1');
  });
});

describe('authController.adminDisableUser', () => {
  beforeEach(() => jest.clearAllMocks());

  test('la busqueda se acota al tenant del admin', async () => {
    mockUser.findOne.mockResolvedValue(null);

    await request(app(authController.adminDisableUser, 'post')).post('/u/u2');

    const [filtro] = mockUser.findOne.mock.calls[0];
    expect(filtro).toEqual({ _id: 'u2', tenantId: 't1' });
  });

  test('404 al desactivar un usuario de otro tenant', async () => {
    mockUser.findOne.mockResolvedValue(null);

    const res = await request(app(authController.adminDisableUser, 'post')).post('/u/u9');

    expect(res.status).toBe(404);
  });

  test('desactiva correctamente un usuario del propio tenant', async () => {
    const victima = {
      _id: 'u2', email: 'u2@t1.es', isActive: true,
      save: jest.fn().mockResolvedValue(true),
      toPublicJSON: () => ({ id: 'u2' })
    };
    mockUser.findOne.mockResolvedValue(victima);

    const res = await request(app(authController.adminDisableUser, 'post')).post('/u/u2');

    expect(res.status).toBe(200);
    expect(victima.isActive).toBe(false);
    expect(victima.save).toHaveBeenCalled();
  });
});
