/**
 * Admin Routes
 * Rutas para panel de administración
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

// TODAS las rutas de administracion exigen sesion y rol admin. Sin esto el
// panel entero era publico: /users listaba emails, nombres, roles y permisos
// de todos los usuarios sin token, y las rutas de escritura permitian crear,
// modificar y borrar usuarios o resetear sus contrasenas.
router.use(auth);
router.use(requireRole('admin'));

/**
 * @openapi
 * /api/admin/dashboard:
 *   get:
 *     tags: [admin]
 *     summary: Dashboard admin (métricas del tenant)
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [admin]
 *     summary: Listar usuarios del tenant (tenant-scoped desde el guard)
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive] } }
 *       - { in: query, name: role, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 */
router.get('/users', adminController.listUsers);

/**
 * @openapi
 * /api/admin/users/{id}:
 *   get:
 *     tags: [admin]
 *     summary: Obtener usuario (tenant-guarded)
 *   put:
 *     tags: [admin]
 *     summary: Actualizar usuario
 *   delete:
 *     tags: [admin]
 *     summary: Soft delete de usuario
 */
router.get('/users/:id', adminController.getUser);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

/**
 * @openapi
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     tags: [admin]
 *     summary: Restablecer password (genera temporal)
 */
router.post('/users/:id/reset-password', adminController.resetUserPassword);

// Roles
router.get('/roles', adminController.listRoles);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Audit Logs
router.get('/audit', adminController.getAuditLogs);
router.get('/audit/stats', adminController.getAuditStats);

module.exports = router;
