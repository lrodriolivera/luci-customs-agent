const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Tenant } = require('../models');
const logger = require('../config/logger');
const cognitoService = require('../utils/cognitoService');
const { puedeAsignarRol, puedeGestionarUsuario, AGENT } = require('../constants/roles');
const { filtroTenantOPlataforma, isSuperAdmin } = require('../utils/tenantGuard');
const { generarContrasenaTemporal, calcularExpiracionTemporal } = require('../utils/tempPassword');

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

    // Contrasena temporal de una invitacion (admin/invite) caducada: la
    // credencial sigue siendo correcta (el hash no cambia por caducar), pero
    // es de un solo uso con fecha limite. Sin esto, una invitacion olvidada
    // quedaba valida para siempre.
    if (user.mustChangePassword && user.tempPasswordExpires && user.tempPasswordExpires.getTime() < Date.now()) {
      req.audit?.({
        action: 'login_failed',
        resource: 'User',
        resourceId: user._id,
        success: false,
        errorMessage: 'Contrasena temporal caducada',
        metadata: { email }
      });
      return res.status(401).json({
        success: false,
        error: 'La contrasena temporal ha caducado. Solicite una nueva invitacion al administrador.',
        code: 'TEMP_PASSWORD_EXPIRED'
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

    // La caducidad de la temporal (72h) se comprueba aqui tambien, no solo en
    // el login: un token de vida corta (15 min) emitido justo antes de que la
    // temporal caducara podia seguir usandose para "cambiarla" ya caducada.
    if (user.mustChangePassword && user.tempPasswordExpires && user.tempPasswordExpires.getTime() < Date.now()) {
      return res.status(401).json({
        success: false,
        error: 'La contrasena temporal ha caducado. Solicite una nueva invitacion al administrador.',
        code: 'TEMP_PASSWORD_EXPIRED'
      });
    }

    // Verificar password actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Contrasena actual incorrecta'
      });
    }

    // La temporal no puede quedarse como definitiva "cambiandola" por si misma.
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'La contrasena nueva no puede ser igual a la actual'
      });
    }

    // Actualizar password. Si venia de una invitacion con contrasena temporal
    // (mustChangePassword), este es el momento en que deja de serlo: la
    // temporal queda sustituida (de un solo uso) y el resto de rutas, que
    // middleware/auth.js bloqueaba, vuelven a estar disponibles.
    user.password = newPassword;
    user.mustChangePassword = false;
    user.tempPasswordExpires = undefined;
    await user.save();

    // El guardado actualiza passwordChangedAt (ver pre-save de User), asi que
    // cualquier token firmado antes de este momento -incluido el que llego en
    // esta misma peticion- deja de valer. El cliente necesita uno nuevo.
    const token = user.generateAuthToken();

    logger.info(`Usuario cambio contrasena: ${user.email}`);
    req.audit?.({ action: 'password_changed', resource: 'User', resourceId: user._id });

    res.json({
      success: true,
      message: 'Contrasena actualizada correctamente',
      data: { token }
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

    // filtroTenantOPlataforma: un admin sin tenant (legacy) no debe listar los usuarios de todos.
    const query = { ...filtroTenantOPlataforma(req.user) };
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

    // Un admin de tenant no puede ascender a nadie (ni a si mismo) a super_admin.
    if (allowedUpdates.role !== undefined && !puedeAsignarRol(req.user, allowedUpdates.role)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para asignar ese rol.' });
    }

    // El filtro incluye el tenant del solicitante: requireRole('admin') es un
    // rol DE TENANT, asi que sin esto un admin podia cambiar el rol y los
    // permisos de un usuario de otro cliente conociendo su id.
    const filtro = { _id: id, ...filtroTenantOPlataforma(req.user) };

    // Un admin de tenant no puede quitarle (ni cambiarle) el rol a un super_admin.
    if (allowedUpdates.role !== undefined) {
      const objetivo = await User.findOne(filtro);
      if (objetivo && !puedeGestionarUsuario(req.user, objetivo)) {
        return res.status(403).json({ success: false, error: 'No puedes modificar a un super administrador.' });
      }
    }

    const user = await User.findOneAndUpdate(
      filtro,
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

    const frontendUrl = process.env.FRONTEND_URL || 'https://aduanas.strixai.ai';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    // `emailService.sendEmail` NO lanza en sus tres modos de fallo (sin SMTP/SES
    // configurado, destinatario suprimido, o error de envio capturado dentro):
    // devuelve `{success:false, reason|error}`. Con solo el try/catch, esos tres
    // casos respondian "recibiras un enlace" para un correo que nunca salio, y
    // encima con el token ya invalidado. Hay que mirar el `success`, no solo las
    // excepciones. Un resultado sin `success` se considera correcto para no
    // romper a los llamantes historicos que devuelven otra cosa.
    const fallaEnvio = (motivo) => {
      logger.warn(`Reset email no enviado a ${email}: ${motivo}`);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      return user.save({ validateBeforeSave: false });
    };

    try {
      const emailService = require('../services/emailService');
      const envio = await emailService.sendPasswordResetEmail(email, user.name, resetUrl);
      if (envio && envio.success === false) {
        await fallaEnvio(envio.reason || envio.error || 'motivo desconocido');
        return res.status(500).json({ success: false, error: 'Error al enviar el email. Intente de nuevo.' });
      }
    } catch (emailErr) {
      await fallaEnvio(emailErr.message);
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
    // Si el usuario llego aqui con una invitacion pendiente (mustChangePassword,
    // quiza ya caducada), restablecer por este camino tambien la completa: sin
    // esto, el login seguia rechazando por TEMP_PASSWORD_EXPIRED con la
    // contrasena YA cambiada, dejando la cuenta bloqueada para siempre.
    user.mustChangePassword = false;
    user.tempPasswordExpires = undefined;
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
 * Admin invite - crea un usuario LOCAL (sin Cognito, retirado) en el tenant
 * de quien invita, con una contrasena temporal de un solo uso.
 * POST /api/auth/admin/invite
 *
 * requireRole('admin', 'super_admin') en la ruta decide QUIEN puede llamar.
 * Este controller decide DOS cosas mas, por separado (ver middleware/auth.js):
 *
 *   1. Que rol se concede    -> puedeAsignarRol (un admin de tenant no puede
 *      conceder super_admin; whitelist de campos del body, nada de asignacion
 *      masiva).
 *   2. En que tenant se crea -> SIEMPRE req.user.tenantId para un admin
 *      normal. Un admin NO puede elegir otro tenant ni con tenantId en el
 *      body ni con X-Tenant-ID en la cabecera: ninguno de los dos se lee aqui
 *      salvo que quien invita sea super_admin, y en ese caso solo el tenantId
 *      explicito del body (nunca la cabecera, que ya tiene su propio canal de
 *      override auditado en tenantMiddleware) y queda auditado aparte.
 */
const adminInvite = async (req, res) => {
  try {
    // Lista blanca estricta: solo estos tres campos del body. Cualquier otra
    // cosa (isActive, tenantId para un admin normal, password, hash...) se
    // ignora, no se lee.
    const { email: rawEmail, name, role = AGENT } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();
    const nombre = String(name || '').trim();

    if (!email || !nombre) {
      return res.status(400).json({ success: false, error: 'email y name son obligatorios' });
    }

    // Un admin de tenant no puede invitar a un rol superior al suyo (nada de
    // super_admin); un super_admin si puede.
    if (!puedeAsignarRol(req.user, role)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para asignar ese rol.' });
    }

    // El tenant del usuario nuevo es SIEMPRE el del admin autenticado. Solo un
    // super_admin puede elegirlo explicitamente, y queda auditado. Ese
    // tenantId explicito se valida: un ObjectId con forma invalida, uno que
    // no corresponde a ningun tenant, o uno de un tenant suspendido/cancelado
    // (no activo) se rechazan con 400 en vez de crear el usuario en un
    // tenant inexistente o inoperativo.
    let tenantId = req.user.tenantId;
    let tenantOverride = false;
    if (isSuperAdmin(req.user) && req.body.tenantId) {
      if (!mongoose.isValidObjectId(req.body.tenantId)) {
        return res.status(400).json({ success: false, error: 'tenantId invalido.' });
      }
      const tenantElegido = await Tenant.findById(req.body.tenantId);
      if (!tenantElegido || !tenantElegido.isActive()) {
        return res.status(400).json({ success: false, error: 'El tenant indicado no existe o no esta activo.' });
      }
      tenantId = tenantElegido._id;
      tenantOverride = String(tenantId) !== String(req.user.tenantId || '');
    }
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'No se pudo determinar el tenant para el usuario nuevo.' });
    }

    // El email es unico en toda la plataforma (indice unico de User), no por
    // tenant: si ya existe en CUALQUIER tenant se rechaza, sin decir en cual
    // esta para no filtrar esa informacion a quien invita.
    const yaExiste = await User.findOne({ email });
    if (yaExiste) {
      // Excepcion: una invitacion GENUINA, pendiente (mustChangePassword
      // activo, quiza caducada) y nunca usada, del MISMO tenant, se puede
      // reinvitar -- regenera la temporal y su caducidad en vez de dejar la
      // cuenta bloqueada para siempre solo por BD. Cuatro condiciones, las
      // cuatro necesarias:
      //   - mismo tenant (nunca entre tenants)
      //   - mustChangePassword activo (sigue pendiente)
      //   - invitedAt presente: la cuenta se creo POR ESTE camino (admin/invite),
      //     no por adminController.createUser ni por otro sitio que tambien
      //     deje mustChangePassword activo
      //   - nunca inicio sesion (sin lastLogin): si ya entro una vez con la
      //     temporal, regenerarla por detras le quita el acceso sin avisar
      // Si no se cumplen todas, o si quien reinvita no puede gestionar al
      // objetivo (puedeGestionarUsuario -- un admin de tenant no toca a un
      // super_admin ni para esto), es el mismo 409 generico: no se distingue
      // el motivo para no filtrar informacion a quien invita.
      const mismoTenant = String(yaExiste.tenantId || '') === String(tenantId);
      const invitacionPendienteGenuina = mismoTenant &&
        yaExiste.mustChangePassword &&
        !!yaExiste.invitedAt &&
        !yaExiste.lastLogin &&
        yaExiste.isActive;
      if (invitacionPendienteGenuina && puedeGestionarUsuario(req.user, yaExiste)) {
        const tempPasswordReinvite = generarContrasenaTemporal();
        yaExiste.password = tempPasswordReinvite;
        yaExiste.mustChangePassword = true;
        yaExiste.tempPasswordExpires = calcularExpiracionTemporal();
        await yaExiste.save();

        logger.info(`Admin reinvito usuario pendiente: ${email} por ${req.user.email}`);
        req.audit?.({
          action: 'admin_invite',
          resource: 'User',
          resourceId: yaExiste._id,
          metadata: { email, role: yaExiste.role, tenantId: String(tenantId), reinvite: true }
        });

        return res.status(200).json({
          success: true,
          data: { user: yaExiste.toPublicJSON(), temporaryPassword: tempPasswordReinvite },
          message: 'La invitacion seguia pendiente: se genero una contrasena temporal nueva.'
        });
      }
      return res.status(409).json({ success: false, error: 'No se puede invitar: el correo ya esta en uso.' });
    }

    // Temporal fuerte y aleatoria (crypto, no Math.random). Nunca se guarda en
    // claro: el pre-save de User la hashea como cualquier otra contrasena.
    // Misma generacion que adminController.createUser/resetUserPassword
    // (utils/tempPassword) para que "temporal" signifique lo mismo en
    // cualquier punto que la emita.
    const tempPassword = generarContrasenaTemporal();

    const user = new User({
      email,
      name: nombre,
      role,
      tenantId,
      organizationId: tenantId,
      password: tempPassword,
      isActive: true,
      mustChangePassword: true,
      tempPasswordExpires: calcularExpiracionTemporal(),
      invitedAt: new Date(),
      invitedBy: req.user._id,
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

    logger.info(`Admin invito usuario: ${email} (rol: ${role}) por ${req.user.email}`);
    // Nunca la contrasena temporal en el log ni en la auditoria: metadata solo
    // lleva email/rol/tenant. auditService.log tambien redacta por si acaso
    // cualquier clave que contenga "password" llegara aqui.
    req.audit?.({
      action: 'admin_invite',
      resource: 'User',
      resourceId: user._id,
      metadata: { email, role, tenantId: String(tenantId), tenantOverride }
    });

    res.status(201).json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        // Se devuelve UNA sola vez, en esta respuesta. No se envia por email
        // (no hay garantia de entrega: emailService.sendX ya falla en
        // silencio hoy si SMTP/SES no esta configurado) ni se vuelve a
        // mostrar en ningun otro sitio; el admin debe copiarla y entregarla
        // por un canal seguro.
        temporaryPassword: tempPassword
      },
      message: 'Usuario invitado. Esta contrasena temporal solo se muestra esta vez.'
    });
  } catch (error) {
    logger.error('Error en admin invite:', error);
    // E11000: alguien creo el mismo email entre el findOne y el save (TOCTOU).
    // Mismo 409 generico que la comprobacion de arriba, sin revelar tenant.
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'No se puede invitar: el correo ya esta en uso.' });
    }
    res.status(500).json({ success: false, error: 'Error al invitar usuario' });
  }
};

/**
 * Admin disable user
 * POST /api/auth/admin/disable/:id
 */
const adminDisableUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Acotado al tenant del solicitante, igual que listUsers: 'admin' es un rol
    // de tenant y sin esto se podia desactivar a un usuario de otro cliente.
    const filtro = { _id: id, ...filtroTenantOPlataforma(req.user) };

    const user = await User.findOne(filtro);
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
