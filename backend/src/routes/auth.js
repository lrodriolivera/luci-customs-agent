const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, requireRole } = require('../middleware/auth');
const { authValidators } = require('../middleware/validators');

// Rutas publicas
router.post('/register', authValidators.register, authController.register);
router.post('/login', authValidators.login, authController.login);
router.post('/forgot-password', authValidators.forgotPassword, authController.forgotPassword);
router.post('/reset-password/:token', authValidators.resetPassword, authController.resetPassword);

// Rutas protegidas
router.get('/me', auth, authController.getMe);
router.put('/profile', auth, authController.updateProfile);
router.put('/password', auth, authController.changePassword);
router.post('/logout', auth, authController.logout);

// Rutas de admin
router.get('/users', auth, requireRole('admin'), authController.listUsers);
router.put('/users/:id', auth, requireRole('admin'), authController.updateUser);

module.exports = router;
