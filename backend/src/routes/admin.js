/**
 * Admin Routes
 * Rutas para panel de administración
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Users
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
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
