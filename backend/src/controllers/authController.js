const crypto = require('crypto');
const { User, Tenant } = require('../models');
const logger = require('../config/logger');
const cognitoService = require('../utils/cognitoService');

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
    req.audit?.({ action: 'register', resource: 'User', resourceId: user._id, metadata: { email, tenantId: tenant._id, slug } });

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
    req.audit?.({ action: 'register', resource: 'User', success: false, errorMessage: error.message, metadata: { email: req.body?.email } });
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
      const auditReq = Object.assign({}, req, { user: null });
      auditReq.audit = req.audit;
      req.audit?.({ action: 'login_failed', resource: 'User', success: false, errorMessage: 'Credenciales invalidas', metadata: { email } });
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
    req.user = user;
    req.audit?.({ action: 'login', resource: 'User', resourceId: user._id });

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
    req.audit?.({ action: 'logout', resource: 'User', resourceId: req.user._id });

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

/**
 * Cognito session - verify access token and return user profile
 * POST /api/auth/session
 */
const cognitoSession = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'accessToken es obligatorio' });
    }

    const decoded = await cognitoService.verifyAccessToken(accessToken);
    let user = await User.findOne({ cognitoSub: decoded.sub, isActive: true });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado. Completa el registro primero.',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    logger.info(`Cognito session: ${user.email}`);
    req.audit?.({ action: 'cognito_session', resource: 'User', resourceId: user._id });

    res.json({
      success: true,
      data: { user: user.toPublicJSON() },
    });
  } catch (error) {
    logger.error('Error en cognito session:', error);
    res.status(401).json({ success: false, error: 'Token invalido' });
  }
};

/**
 * Register sync - called by Post Confirmation Lambda
 * POST /api/auth/register-sync
 */
const registerSync = async (req, res) => {
  try {
    const secret = req.header('X-Register-Sync-Secret');
    if (!secret || secret !== process.env.REGISTER_SYNC_SECRET) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { cognitoSub, email, givenName, familyName, apellido2, companyName } = req.body;

    if (!cognitoSub || !email) {
      return res.status(400).json({ success: false, error: 'cognitoSub y email son obligatorios' });
    }

    const existing = await User.findOne({ cognitoSub });
    if (existing) {
      return res.json({ success: true, data: { userId: existing._id, tenantId: existing.tenantId } });
    }

    // If user exists by email but without cognitoSub, link them
    const existingByEmail = await User.findOne({ email, cognitoSub: { $exists: false } });
    if (!existingByEmail) {
      // Also check for null cognitoSub
      const existingByEmail2 = await User.findOne({ email, cognitoSub: null });
      if (existingByEmail2) {
        existingByEmail2.cognitoSub = cognitoSub;
        existingByEmail2.givenName = givenName;
        existingByEmail2.familyName = familyName;
        existingByEmail2.apellido2 = apellido2;
        await existingByEmail2.save();
        logger.info(`Register sync: linked existing user ${email} to cognitoSub ${cognitoSub}`);
        return res.json({ success: true, data: { userId: existingByEmail2._id, tenantId: existingByEmail2.tenantId, linked: true } });
      }
    }
    if (existingByEmail) {
      existingByEmail.cognitoSub = cognitoSub;
      existingByEmail.givenName = givenName;
      existingByEmail.familyName = familyName;
      existingByEmail.apellido2 = apellido2;
      await existingByEmail.save();
      logger.info(`Register sync: linked existing user ${email} to cognitoSub ${cognitoSub}`);
      return res.json({ success: true, data: { userId: existingByEmail._id, tenantId: existingByEmail.tenantId, linked: true } });
    }

    const fullName = [givenName, familyName, apellido2].filter(Boolean).join(' ');

    const baseSlug = (companyName || 'empresa')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    if (await Tenant.findOne({ slug })) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const tenant = new Tenant({
      name: companyName || fullName,
      slug,
      status: 'active',
      subscription: { plan: 'professional', status: 'active', startDate: new Date() },
      limits: Tenant.getDefaultLimits ? Tenant.getDefaultLimits('professional') : {},
      primaryContact: { name: fullName, email },
    });
    await tenant.save();

    const user = new User({
      email,
      name: fullName,
      givenName,
      familyName,
      apellido2,
      cognitoSub,
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
        canConfigureSystem: true,
      },
    });
    await user.save();

    // Update Cognito user with tenantId
    try {
      await cognitoService.adminUpdateAttributes(cognitoSub, {
        'custom:tenantId': String(tenant._id),
        'custom:role': 'admin',
      });
    } catch (cognitoErr) {
      logger.warn('Could not update Cognito attributes:', cognitoErr.message);
    }

    logger.info(`Register sync: ${email}, tenant: ${slug}, cognitoSub: ${cognitoSub}`);

    res.status(201).json({
      success: true,
      data: { userId: user._id, tenantId: tenant._id, slug },
    });
  } catch (error) {
    logger.error('Error en register-sync:', error.message);
    res.status(500).json({ success: false, error: 'Error en register-sync' });
  }
};

/**
 * Admin invite - create user in Cognito with temporary password
 * POST /api/auth/admin/invite
 */
const adminInvite = async (req, res) => {
  try {
    const { email, givenName, familyName, apellido2, role = 'agent' } = req.body;

    if (!email || !givenName || !familyName) {
      return res.status(400).json({ success: false, error: 'email, givenName y familyName son obligatorios' });
    }

    const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 12) + 'A1!';

    const cognitoResult = await cognitoService.adminCreateUser(
      email, givenName, familyName, apellido2, tempPassword
    );

    const cognitoSub = cognitoResult.User.Attributes.find(a => a.Name === 'sub')?.Value;
    const fullName = [givenName, familyName, apellido2].filter(Boolean).join(' ');

    const user = new User({
      email,
      name: fullName,
      givenName,
      familyName,
      apellido2,
      cognitoSub,
      role,
      tenantId: req.user.tenantId,
      organizationId: req.user.tenantId,
      permissions: {
        canCreateExpeditions: true,
        canUploadDocuments: true,
        canAccessReports: role === 'admin' || role === 'supervisor',
        canDeleteExpeditions: role === 'admin',
        canApproveDeclarations: role === 'admin' || role === 'supervisor',
        canManageUsers: role === 'admin',
        canManageCertificates: role === 'admin',
        canSignDeclarations: role === 'admin',
        canConfigureSystem: role === 'admin',
      },
    });
    await user.save();

    await cognitoService.adminUpdateAttributes(cognitoSub, {
      'custom:tenantId': String(req.user.tenantId),
      'custom:role': role,
    });

    logger.info(`Admin invited user: ${email} (role: ${role}) by ${req.user.email}`);
    req.audit?.({ action: 'admin_invite', resource: 'User', resourceId: user._id, metadata: { email, role } });

    res.status(201).json({ success: true, data: user.toPublicJSON() });
  } catch (error) {
    logger.error('Error en admin invite:', error);
    const msg = error.name === 'UsernameExistsException'
      ? 'El usuario ya existe en el sistema'
      : 'Error al invitar usuario';
    res.status(error.name === 'UsernameExistsException' ? 409 : 500).json({ success: false, error: msg });
  }
};

/**
 * Admin disable user
 * POST /api/auth/admin/disable/:id
 */
const adminDisableUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (user.cognitoSub) {
      await cognitoService.adminDisableUser(user.cognitoSub);
    }

    user.isActive = false;
    await user.save();

    logger.info(`Admin disabled user: ${user.email} by ${req.user.email}`);
    req.audit?.({ action: 'admin_disable_user', resource: 'User', resourceId: user._id });

    res.json({ success: true, data: user.toPublicJSON() });
  } catch (error) {
    logger.error('Error disabling user:', error);
    res.status(500).json({ success: false, error: 'Error al desactivar usuario' });
  }
};

/**
 * Change password via Cognito
 * PUT /api/auth/change-password
 */
const cognitoChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const accessToken = req.token;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword y newPassword son obligatorios' });
    }

    await cognitoService.changePassword(accessToken, currentPassword, newPassword);

    logger.info(`Cognito password changed: ${req.user.email}`);
    res.json({ success: true, message: 'Contrasena actualizada correctamente' });
  } catch (error) {
    logger.error('Error changing cognito password:', error);
    const msg = error.name === 'NotAuthorizedException'
      ? 'Contrasena actual incorrecta'
      : 'Error al cambiar contrasena';
    res.status(400).json({ success: false, error: msg });
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
  resetPassword,
  cognitoSession,
  registerSync,
  adminInvite,
  adminDisableUser,
  cognitoChangePassword,
};
