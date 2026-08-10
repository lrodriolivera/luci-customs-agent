/**
 * Tests para authController.
 *
 * Es la puerta de entrada al sistema y estaba al 0% de cobertura. Se cubren
 * las rutas de credenciales y de recuperacion de contrasena, priorizando las
 * propiedades de seguridad (no filtrar si un email existe, no aceptar tokens
 * caducados, hashear el token de reset) sobre el camino feliz.
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

jest.mock('../../src/models', () => ({
  User: {
    findByCredentials: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn()
  },
  Tenant: { findById: jest.fn() }
}));
jest.mock('../../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn()
}));

const { User } = require('../../src/models');
const emailService = require('../../src/services/emailService');
const authController = require('../../src/controllers/authController');

// Usuario autenticado simulado, para las rutas que van detras del middleware.
const AUTH_USER = { _id: 'u1', email: 'tester@strixai.es' };

const app = express();
app.use(express.json());
app.post('/api/auth/login', authController.login);
app.post('/api/auth/forgot-password', authController.forgotPassword);
app.post('/api/auth/reset-password/:token', authController.resetPassword);
app.post('/api/auth/change-password', (req, _res, next) => { req.user = AUTH_USER; next(); }, authController.changePassword);

/** Usuario de Mongoose simulado: save/compare/token son los metodos que toca el controller. */
function mockUser(overrides = {}) {
  return {
    _id: 'u1',
    email: 'tester@strixai.es',
    name: 'Tester',
    save: jest.fn().mockResolvedValue(true),
    comparePassword: jest.fn().mockResolvedValue(true),
    generateAuthToken: jest.fn().mockReturnValue('jwt-token'),
    toPublicJSON: jest.fn().mockReturnValue({ id: 'u1', email: 'tester@strixai.es' }),
    ...overrides
  };
}

describe('authController', () => {
  afterEach(() => jest.clearAllMocks());

  describe('POST /login', () => {
    test('devuelve token y usuario con credenciales validas', async () => {
      const user = mockUser();
      User.findByCredentials.mockResolvedValue(user);

      const res = await request(app).post('/api/auth/login')
        .send({ email: 'tester@strixai.es', password: 'Tester2026!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe('jwt-token');
      expect(user.save).toHaveBeenCalled(); // persiste lastLogin
    });

    test('responde 401 sin revelar si el email existe', async () => {
      User.findByCredentials.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/login')
        .send({ email: 'noexiste@strixai.es', password: 'loquesea' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Credenciales invalidas');
      // El mensaje no debe distinguir "usuario no existe" de "password mal".
      expect(JSON.stringify(res.body)).not.toMatch(/no existe|not found|usuario/i);
    });

    test('nunca devuelve el hash de la contrasena', async () => {
      const user = mockUser();
      User.findByCredentials.mockResolvedValue(user);

      const res = await request(app).post('/api/auth/login')
        .send({ email: 'tester@strixai.es', password: 'Tester2026!' });

      expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
    });

    test('responde 500 sin filtrar el error interno si la BD falla', async () => {
      User.findByCredentials.mockRejectedValue(new Error('ECONNREFUSED mongo:27017'));

      const res = await request(app).post('/api/auth/login')
        .send({ email: 'tester@strixai.es', password: 'x' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error al iniciar sesion');
      expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|mongo/);
    });
  });

  describe('POST /forgot-password', () => {
    test('guarda el token HASHEADO, nunca en claro', async () => {
      const user = mockUser();
      User.findOne.mockResolvedValue(user);
      // `sendPasswordResetEmail` devuelve el resultado de `sendEmail`, no un
      // booleano: mockearlo con `true` inventaba un contrato que la fuente real
      // no tiene y era justo lo que dejaba pasar el bug de abajo.
      emailService.sendPasswordResetEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });

      await request(app).post('/api/auth/forgot-password').send({ email: 'tester@strixai.es' });

      // El enlace lleva el token en claro; en BD solo debe quedar su sha256.
      const urlEnviada = emailService.sendPasswordResetEmail.mock.calls[0][2];
      const tokenEnClaro = urlEnviada.split('/reset-password/')[1];
      const esperado = crypto.createHash('sha256').update(tokenEnClaro).digest('hex');

      expect(user.resetPasswordToken).toBe(esperado);
      expect(user.resetPasswordToken).not.toBe(tokenEnClaro);
      expect(user.resetPasswordExpires).toBeGreaterThan(Date.now());
    });

    test('responde igual para un email inexistente (no enumera usuarios)', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/forgot-password')
        .send({ email: 'noexiste@strixai.es' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('limpia el token si el email no se pudo enviar', async () => {
      const user = mockUser();
      User.findOne.mockResolvedValue(user);
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP caido'));

      const res = await request(app).post('/api/auth/forgot-password')
        .send({ email: 'tester@strixai.es' });

      expect(res.status).toBe(500);
      // Sin esto quedaria un token valido que nadie recibio.
      expect(user.resetPasswordToken).toBeUndefined();
      expect(user.resetPasswordExpires).toBeUndefined();
    });

    /**
     * `emailService.sendEmail` NO lanza en sus tres modos de fallo: devuelve
     * `{success:false}` con un `reason`. Un try/catch no ve ninguno de los tres,
     * asi que el usuario leia "recibiras un enlace" para un correo que nunca
     * salio, y ademas con el token ya invalidado esperaba un email inexistente.
     */
    describe.each([
      ['no hay SMTP/SES configurado', { success: false, reason: 'not_configured' }],
      ['el destinatario esta suprimido', { success: false, reason: 'suppressed', skipped: ['tester@strixai.es'] }],
      ['el envio falla y se captura dentro', { success: false, error: 'Connection timeout' }]
    ])('cuando %s', (_caso, resultadoEnvio) => {
      test('responde 500 y limpia el token en vez de prometer un email que no salio', async () => {
        const user = mockUser();
        User.findOne.mockResolvedValue(user);
        emailService.sendPasswordResetEmail.mockResolvedValue(resultadoEnvio);

        const res = await request(app).post('/api/auth/forgot-password')
          .send({ email: 'tester@strixai.es' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBeUndefined();
        expect(user.resetPasswordToken).toBeUndefined();
        expect(user.resetPasswordExpires).toBeUndefined();
      });
    });

    test('un envio con exito sigue respondiendo 200', async () => {
      const user = mockUser();
      User.findOne.mockResolvedValue(user);
      emailService.sendPasswordResetEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });

      const res = await request(app).post('/api/auth/forgot-password')
        .send({ email: 'tester@strixai.es' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(user.resetPasswordToken).toBeDefined();
    });

    /**
     * Compatibilidad: hay llamantes historicos y tests que resuelven el envio
     * con un valor sin `success`. Tratar eso como fallo romperia el reset para
     * quien no haya migrado, asi que solo un `success === false` explicito
     * cuenta como error.
     */
    test('un resultado sin campo success no se interpreta como fallo', async () => {
      const user = mockUser();
      User.findOne.mockResolvedValue(user);
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      const res = await request(app).post('/api/auth/forgot-password')
        .send({ email: 'tester@strixai.es' });

      expect(res.status).toBe(200);
      expect(user.resetPasswordToken).toBeDefined();
    });
  });

  describe('POST /reset-password/:token', () => {
    test('busca por el hash del token, no por el token recibido', async () => {
      const user = mockUser();
      User.findOne.mockResolvedValue(user);

      await request(app).post('/api/auth/reset-password/token-en-claro')
        .send({ password: 'NuevaPass2026!' });

      const filtro = User.findOne.mock.calls[0][0];
      expect(filtro.resetPasswordToken)
        .toBe(crypto.createHash('sha256').update('token-en-claro').digest('hex'));
      // Y solo vale si aun no ha expirado.
      expect(filtro.resetPasswordExpires).toHaveProperty('$gt');
    });

    test('rechaza token invalido o caducado', async () => {
      User.findOne.mockResolvedValue(null); // el $gt de la fecha no casa

      const res = await request(app).post('/api/auth/reset-password/caducado')
        .send({ password: 'NuevaPass2026!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Token invalido o expirado');
    });

    test('invalida el token tras usarlo (no reutilizable)', async () => {
      const user = mockUser();
      User.findOne.mockResolvedValue(user);

      await request(app).post('/api/auth/reset-password/valido')
        .send({ password: 'NuevaPass2026!' });

      expect(user.password).toBe('NuevaPass2026!');
      expect(user.resetPasswordToken).toBeUndefined();
      expect(user.save).toHaveBeenCalled();
    });
  });

  describe('POST /change-password', () => {
    test('exige la contrasena actual correcta', async () => {
      const user = mockUser({ comparePassword: jest.fn().mockResolvedValue(false) });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      const res = await request(app).post('/api/auth/change-password')
        .send({ currentPassword: 'incorrecta', newPassword: 'Nueva2026!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Contrasena actual incorrecta');
      expect(user.save).not.toHaveBeenCalled();
    });

    test('actualiza la contrasena cuando la actual es correcta', async () => {
      const user = mockUser();
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      const res = await request(app).post('/api/auth/change-password')
        .send({ currentPassword: 'Tester2026!', newPassword: 'Nueva2026!' });

      expect(res.status).toBe(200);
      expect(user.password).toBe('Nueva2026!');
      expect(user.save).toHaveBeenCalled();
    });

    test('pide el password explicitamente con select (no viene por defecto)', async () => {
      const user = mockUser();
      const select = jest.fn().mockResolvedValue(user);
      User.findById.mockReturnValue({ select });

      await request(app).post('/api/auth/change-password')
        .send({ currentPassword: 'x', newPassword: 'y' });

      expect(select).toHaveBeenCalledWith('+password');
    });
  });
});
