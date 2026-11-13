const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, requireRole } = require('../middleware/auth');
const { authValidators } = require('../middleware/validators');
const { makeRateLimitStore } = require('../utils/rateLimitStore');

/**
 * Limitador propio de la invitacion de usuarios, DESPUES de auth (necesita
 * req.user) y con clave por usuario, no por IP: antes compartia el
 * authLimiter de app.js (10 req/15min por IP), pensado para login/registro,
 * que ni acotaba por admin ni dejaba margen razonable para invitar a varias
 * personas desde la misma IP (una oficina, una VPN).
 */
const adminInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  store: makeRateLimitStore('rl:admin-invite:'),
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { success: false, error: 'Demasiadas invitaciones. Espera antes de invitar a mas usuarios.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Cupo por TENANT, ademas del cupo por admin de arriba: sin esto, el cupo
 * por admin se esquivaba creando varios admins, cada uno por debajo de su
 * propio limite de 20/hora, pero sumando muchas invitaciones en el mismo
 * tenant. Clave por tenantId (no por usuario): comparten el mismo contador
 * todos los admins de un tenant.
 */
const ADMIN_INVITE_TENANT_DAILY_LIMIT = parseInt(process.env.ADMIN_INVITE_TENANT_DAILY_LIMIT || '50', 10);
const adminInviteTenantLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: ADMIN_INVITE_TENANT_DAILY_LIMIT,
  store: makeRateLimitStore('rl:admin-invite-tenant:'),
  keyGenerator: (req) => String(req.user?.tenantId || req.ip),
  message: { success: false, error: 'Este tenant ha alcanzado el limite diario de invitaciones.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [auth]
 *     summary: Registro público (default role 'agent')
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *     responses:
 *       201: { description: Usuario creado }
 *       400: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', authValidators.register, authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [auth]
 *     summary: Login - retorna JWT con iss/aud
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LoginResponse' }
 *       401: { description: Credenciales inválidas }
 */
router.post('/login', authValidators.login, authController.login);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [auth]
 *     summary: Solicitar email de reset de password
 *     security: []
 */
router.post('/forgot-password', authValidators.forgotPassword, authController.forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password/{token}:
 *   post:
 *     tags: [auth]
 *     summary: Reset password con token
 *     security: []
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema: { type: string }
 */
router.post('/reset-password/:token', authValidators.resetPassword, authController.resetPassword);

/**
 * @openapi
 * /api/auth/refresh-token:
 *   post:
 *     tags: [auth]
 *     summary: Renovar el JWT (requiere token válido aún no expirado)
 *     responses:
 *       200: { description: Nuevo JWT emitido }
 *       401: { description: Token inválido o expirado }
 */
router.post('/refresh-token', auth, authController.refreshToken);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [auth]
 *     summary: Perfil del usuario autenticado
 */
router.get('/me', auth, authController.getMe);

router.put('/profile', auth, authController.updateProfile);
router.put('/password', auth, authValidators.changePassword, authController.changePassword);
router.post('/logout', auth, authController.logout);

router.get('/users', auth, requireRole('admin'), authController.listUsers);
router.put('/users/:id', auth, requireRole('admin'), authController.updateUser);

// Cognito endpoints
router.post('/session', authController.cognitoSession);
router.post('/register-sync', authController.registerSync);
router.post('/admin/invite', auth, requireRole('admin', 'super_admin'), adminInviteLimiter, adminInviteTenantLimiter, authValidators.adminInvite, authController.adminInvite);
router.post('/admin/disable/:id', auth, requireRole('admin'), authController.adminDisableUser);
router.put('/change-password', auth, authController.cognitoChangePassword);

module.exports = router;
