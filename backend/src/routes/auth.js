const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, requireRole } = require('../middleware/auth');
const { authValidators } = require('../middleware/validators');

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
router.put('/password', auth, authController.changePassword);
router.post('/logout', auth, authController.logout);

router.get('/users', auth, requireRole('admin'), authController.listUsers);
router.put('/users/:id', auth, requireRole('admin'), authController.updateUser);

module.exports = router;
