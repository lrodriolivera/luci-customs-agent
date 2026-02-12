const crypto = require('crypto');
const { User, Tenant } = require('../models');
const logger = require('../config/logger');

/**
 * Registro de nuevo usuario
 * POST /api/auth/register
 */
const register = async (req, res) => {
  let tenant = null;
  try {
    const { email, password, name, companyName } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'El email ya esta registrado'
      });
    }

    // Create tenant from company name
    const baseSlug = (companyName || 'empresa')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    if (await Tenant.findOne({ slug })) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    tenant = new Tenant({
      name: companyName || name,
      slug,
      status: 'active',
      subscription: { plan: 'starter', status: 'active', startDate: new Date() },
      limits: Tenant.getDefaultLimits('starter'),
      primaryContact: { name, email }
    });
    await tenant.save();

    // Create user as admin of the new tenant
    const user = new User({
      email,
      password,
      name,
      role: 'admin',
      tenantId: tenant._id,
      organizationId: tenant._id,
      profile: { company: companyName },
      permissions: {
        canCreateExpeditions: true,
        canDeleteExpeditions: true,
        canApproveDeclarations: true,
        canManageUsers: true,
        canAccessReports: true,
        canManageCertificates: true,
        canSignDeclarations: true,
        canUploadDocuments: true,
        canConfigureSystem: true
      }
    });
    await user.save();

    const token = user.generateAuthToken();

    // Welcome email (non-blocking)
    try {
      const emailService = require('../services/emailService');
      await emailService.sendWelcomeEmail(email, name, companyName || name);
    } catch (emailErr) {
      logger.warn('Welcome email no enviado:', emailErr.message);
    }

    logger.info(`Nuevo usuario registrado: ${email}, tenant: ${slug}`);

    res.status(201).json({
      success: true,
      data: { user: user.toPublicJSON(), token }
    });

  } catch (error) {
    // Cleanup orphan tenant if user creation failed
    if (tenant && tenant._id) {
      try { await Tenant.findByIdAndDelete(tenant._id); } catch (e) { /* ignore */ }
    }
    logger.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar usuario'
    });
  }
};

/**
 * Login de usuario
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario y verificar credenciales
    const user = await User.findByCredentials(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales invalidas'
      });
    }

    // Actualizar ultimo login
    user.lastLogin = new Date();
    await user.save();

    // Generar token
    const token = user.generateAuthToken();

    logger.info(`Usuario login: ${email}`);

    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token
      }
    });

  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error al iniciar sesion'
    });
  }
};

/**
 * Refresh token (extend session)
 * POST /api/auth/refresh-token
 */
const refreshToken = async (req, res) => {
  try {
    const token = req.user.generateAuthToken();
    res.json({
      success: true,
      data: { token, user: req.user.toPublicJSON() }
    });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ success: false, error: 'Error al renovar sesion' });
  }
};

/**
 * Obtener usuario actual
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.toPublicJSON()
    });
  } catch (error) {
    logger.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuario'
    });
  }
};

/**
 * Actualizar perfil
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const updates = ['name', 'profile', 'notifications'];
    const allowedUpdates = {};

    updates.forEach(field => {
      if (req.body[field] !== undefined) {
        allowedUpdates[field] = req.body[field];
      }
    });

    Object.assign(req.user, allowedUpdates);
    await req.user.save();

    res.json({
      success: true,
      data: req.user.toPublicJSON()
    });

  } catch (error) {
    logger.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar perfil'
    });
  }
};

/**
 * Cambiar contrasena
 * PUT /api/auth/password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Obtener usuario con password
    const user = await User.findById(req.user._id).select('+password');

    // Verificar password actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Contrasena actual incorrecta'
      });
    }

    // Actualizar password
    user.password = newPassword;
    await user.save();

    logger.info(`Usuario cambio contrasena: ${user.email}`);

    res.json({
      success: true,
      message: 'Contrasena actualizada correctamente'
    });

  } catch (error) {
    logger.error('Error cambiando contrasena:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar contrasena'
    });
  }
};

/**
 * Logout (invalida token actual)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // En un sistema con blacklist de tokens, aqui se invalidaria
    // Por ahora solo respondemos OK (el cliente debe eliminar el token)
    logger.info(`Usuario logout: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Sesion cerrada correctamente'
    });

  } catch (error) {
    logger.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesion'
    });
  }
};

/**
 * Listar usuarios (solo admin)
 * GET /api/auth/users
 */
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;

    const query = {};
    if (req.user.tenantId) query.tenantId = req.user.tenantId;
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users: users.map(u => u.toPublicJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error listando usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar usuarios'
    });
  }
};

/**
 * Actualizar usuario (solo admin)
 * PUT /api/auth/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = ['name', 'role', 'profile', 'permissions', 'isActive'];
    const allowedUpdates = {};

    updates.forEach(field => {
      if (req.body[field] !== undefined) {
        allowedUpdates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      id,
      allowedUpdates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    logger.info(`Usuario actualizado por admin: ${user.email}`);

    res.json({
      success: true,
      data: user.toPublicJSON()
    });

  } catch (error) {
    logger.error('Error actualizando usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar usuario'
    });
  }
};

/**
 * Solicitar reset de contrasena
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  const successResponse = {
    success: true,
    message: 'Si el email existe, recibiras un enlace para restablecer tu contrasena'
  };

  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.json(successResponse);

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'https://aduanas.strixai.es';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      const emailService = require('../services/emailService');
      await emailService.sendPasswordResetEmail(email, user.name, resetUrl);
    } catch (emailErr) {
      logger.warn('Reset email no enviado:', emailErr.message);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, error: 'Error al enviar el email. Intente de nuevo.' });
    }

    logger.info(`Password reset solicitado: ${email}`);
    res.json(successResponse);
  } catch (error) {
    logger.error('Error en forgot password:', error);
    res.status(500).json({ success: false, error: 'Error al procesar la solicitud' });
  }
};

/**
 * Restablecer contrasena con token
 * POST /api/auth/reset-password/:token
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Token invalido o expirado' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.info(`Password reseteado: ${user.email}`);
    res.json({ success: true, message: 'Contrasena actualizada correctamente' });
  } catch (error) {
    logger.error('Error en reset password:', error);
    res.status(500).json({ success: false, error: 'Error al restablecer la contrasena' });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  logout,
  listUsers,
  updateUser,
  forgotPassword,
  resetPassword
};
