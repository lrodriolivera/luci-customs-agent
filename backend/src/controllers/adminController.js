/**
 * Admin Controller
 * Panel de administración - Gestión de usuarios, configuración y auditoría
 * Usa MongoDB para persistencia de datos
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../config/logger');
const crypto = require('crypto');
const { puedeAsignarRol, puedeGestionarUsuario } = require('../constants/roles');
const { generarContrasenaTemporal, calcularExpiracionTemporal } = require('../utils/tempPassword');
const { esPasswordValida, MENSAJE_POLITICA } = require('../utils/passwordPolicy');

const { escapeRegex } = require('../utils/escapeRegex');
const { scrub } = require('../services/auditService');
// ==================== In-Memory Storage (Settings & Logs) ====================

// Roles disponibles
const roles = [
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Acceso completo al sistema',
    permissions: ['all'],
    color: 'red'
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Gestión de operaciones y reportes',
    permissions: ['expeditions', 'declarations', 'reports', 'users.view', 'inspections', 'deadlines'],
    color: 'purple'
  },
  {
    id: 'agent',
    name: 'Agente Aduanero',
    description: 'Operaciones aduaneras diarias',
    permissions: ['expeditions', 'declarations', 'calculator', 'classification', 'inspections'],
    color: 'blue'
  },
  {
    id: 'viewer',
    name: 'Consultor',
    description: 'Solo lectura',
    permissions: ['expeditions.view', 'declarations.view', 'reports.view'],
    color: 'gray'
  }
];

// Configuración del sistema
let systemSettings = {
  general: {
    companyName: 'LUCI Aduanas',
    timezone: 'Europe/Madrid',
    language: 'es',
    dateFormat: 'DD/MM/YYYY',
    currency: 'EUR'
  },
  notifications: {
    emailEnabled: true,
    emailFrom: 'notificaciones@luci.es',
    deadlineAlertDays: 3,
    inspectionAlertHours: 24,
    requirementAlertHours: 48
  },
  integrations: {
    aeatEnabled: true,
    aeatEnvironment: 'test',
    taricApiEnabled: true,
    aiAssistantEnabled: true
  },
  security: {
    sessionTimeout: 60,
    passwordMinLength: 8,
    requireTwoFactor: false,
    maxLoginAttempts: 5
  }
};

// Logs de auditoría (en memoria, se puede migrar a MongoDB si se necesita persistencia)
let auditLogs = [];

// ==================== User Management ====================

const listUsers = async (req, res) => {
  try {
    const { status, role, search } = req.query;

    // Tenant isolation: un 'admin' es administrador de SU organizacion, no de
    // la plataforma, asi que solo ve los usuarios de su tenant. Unicamente
    // super_admin (rol de plataforma) los ve todos. Ver src/constants/roles.js.
    const { isSuperAdmin } = require('../utils/tenantGuard');
    let query = {};
    if (!isSuperAdmin(req.user) && req.user?.tenantId) {
      query.tenantId = req.user.tenantId;
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    // Transformar para el frontend
    const transformedUsers = users.map(u => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.isActive ? 'active' : 'inactive',
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
      permissions: u.permissions
    }));

    res.json({
      success: true,
      users: transformedUsers,
      total: transformedUsers.length
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).json({ success: false, error: 'Error al listar usuarios' });
  }
};

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    const { ensureSameTenant } = require('../utils/tenantGuard');
    if (!ensureSameTenant(user, req, res, { resource: 'Usuario' })) return;

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        permissions: user.permissions,
        profile: user.profile
      }
    });
  } catch (error) {
    logger.error('Error getting user:', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuario' });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, name, role, password, generatePassword } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({ success: false, error: 'Email, nombre y rol son requeridos' });
    }

    // Un admin de tenant no puede crear un super_admin (rol de plataforma).
    if (!puedeAsignarRol(req.user, role)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para asignar ese rol.' });
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El email ya está registrado' });
    }

    // Generar contraseña si no se proporciona. Misma generacion (crypto,
    // fuerte) que authController.adminInvite: es temporal por definicion,
    // asi que el usuario tiene que cambiarla en el primer acceso
    // (mustChangePassword), con la misma caducidad de 72h que una invitacion.
    // Si el admin eligio la contraseña el mismo, no se fuerza el cambio: es
    // una decision suya, no una temporal generada al azar.
    let userPassword = password;
    let generatedPassword = null;

    if (!password || generatePassword) {
      generatedPassword = generarContrasenaTemporal();
      userPassword = generatedPassword;
    } else if (!esPasswordValida(password)) {
      // Solo se valida la que elige el admin: la generada ya cumple la
      // politica por construccion (ver utils/tempPassword).
      return res.status(400).json({ success: false, error: MENSAJE_POLITICA });
    }

    // El usuario nuevo hereda el tenant del admin que lo crea. Sin esto quedaba
    // huerfano (tenantId undefined): no aparecia en el listUsers de nadie —que
    // acota por tenant— y ademas ensureSameTenant lo dejaba tocar a CUALQUIER
    // admin (legacy-allow para docs sin tenant). Misma familia de fuga que la
    // escalada corregida en authController.updateUser. super_admin (rol de
    // plataforma) puede indicar el tenant explicitamente en el body.
    const { isSuperAdmin } = require('../utils/tenantGuard');
    const tenantId = isSuperAdmin(req.user)
      ? (req.body.tenantId || req.user?.tenantId)
      : req.user?.tenantId;

    // Crear usuario
    const newUser = new User({
      email: email.toLowerCase(),
      name,
      role,
      password: userPassword,
      tenantId,
      organizationId: tenantId,
      isActive: true,
      mustChangePassword: !!generatedPassword,
      tempPasswordExpires: generatedPassword ? calcularExpiracionTemporal() : undefined,
      permissions: {
        canCreateExpeditions: ['admin', 'supervisor', 'agent'].includes(role),
        canDeleteExpeditions: ['admin', 'supervisor'].includes(role),
        canApproveDeclarations: ['admin', 'supervisor'].includes(role),
        canManageUsers: role === 'admin',
        canAccessReports: ['admin', 'supervisor', 'agent'].includes(role),
        canManageCertificates: ['admin', 'supervisor'].includes(role),
        canSignDeclarations: ['admin', 'supervisor'].includes(role),
        canUploadDocuments: role !== 'viewer',
        canConfigureSystem: role === 'admin'
      }
    });

    await newUser.save();

    // Log de auditoría
    addAuditLog(req, 'USER_CREATE', 'users',
      `Creó nuevo usuario: ${email}`, { newUserId: newUser._id.toString(), role });

    logger.info('User created', { userId: newUser._id, email });

    const response = {
      success: true,
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        status: 'active',
        createdAt: newUser.createdAt
      },
      message: 'Usuario creado exitosamente'
    };

    // Si se generó una contraseña temporal, incluirla en la respuesta -- en
    // su propio campo, UNA sola vez, nunca repetida en `message` (donde
    // podia acabar en un log o una captura de pantalla).
    if (generatedPassword) {
      response.temporaryPassword = generatedPassword;
      response.message = 'Usuario creado. Se genero una contrasena temporal.';
    }

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'El email ya está registrado' });
    }
    res.status(500).json({ success: false, error: 'Error al crear usuario: ' + error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { ensureSameTenant } = require('../utils/tenantGuard');
    if (!ensureSameTenant(user, req, res, { resource: 'Usuario' })) return;

    const { name, role, status, password } = req.body;

    // Un admin de tenant no puede cambiar la contraseña, el email ni el rol de
    // un super_admin: con la contraseña nueva entraba con la cuenta de plataforma.
    const tocaCredenciales = role !== undefined || password !== undefined || req.body.email !== undefined;
    if (tocaCredenciales && !puedeGestionarUsuario(req.user, user)) {
      return res.status(403).json({ success: false, error: 'No puedes modificar a un super administrador.' });
    }

    // Un admin de tenant no puede ascender a nadie (ni a si mismo) a super_admin.
    if (role && !puedeAsignarRol(req.user, role)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para asignar ese rol.' });
    }

    // Antes una contrasena que no llegaba a 6 caracteres se ignoraba EN
    // SILENCIO (ni error ni cambio, el admin creia haberla puesto). Ahora se
    // valida con la misma politica que el resto de puntos que dejan poner
    // una contrasena nueva (BAJO-C): 400 explicito si no la cumple.
    if (password !== undefined && !esPasswordValida(password)) {
      return res.status(400).json({ success: false, error: MENSAJE_POLITICA });
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (status !== undefined) user.isActive = status === 'active';
    if (password) {
      // Igual que createUser con una contrasena elegida por el admin: ya no es
      // una temporal, asi que deja de exigirse el cambio en el primer acceso.
      // Sin esto, un pendiente CADUCADO con la contrasena ya puesta por el
      // admin seguia sin poder entrar (login seguia rechazando por
      // TEMP_PASSWORD_EXPIRED con una contrasena que ya no era temporal).
      user.password = password;
      user.mustChangePassword = false;
      user.tempPasswordExpires = undefined;
    }

    // Actualizar permisos basados en rol
    if (role) {
      user.permissions = {
        canCreateExpeditions: ['admin', 'supervisor', 'agent'].includes(role),
        canDeleteExpeditions: ['admin', 'supervisor'].includes(role),
        canApproveDeclarations: ['admin', 'supervisor'].includes(role),
        canManageUsers: role === 'admin',
        canAccessReports: ['admin', 'supervisor', 'agent'].includes(role),
        canManageCertificates: ['admin', 'supervisor'].includes(role),
        canSignDeclarations: ['admin', 'supervisor'].includes(role),
        canUploadDocuments: role !== 'viewer',
        canConfigureSystem: role === 'admin'
      };
    }

    await user.save();

    // Log de auditoría
    addAuditLog(req, 'USER_UPDATE', 'users',
      `Actualizó usuario: ${user.email}`, { userId: req.params.id, changes: req.body });

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      },
      message: password ? 'Usuario actualizado y contraseña cambiada' : 'Usuario actualizado exitosamente'
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { ensureSameTenant, isSuperAdmin } = require('../utils/tenantGuard');
    if (!ensureSameTenant(user, req, res, { resource: 'Usuario' })) return;

    // Prevenir eliminación del propio usuario o último admin
    if (req.user && req.user.id === req.params.id) {
      return res.status(400).json({ success: false, error: 'No puedes eliminar tu propio usuario' });
    }

    // Tenant-scoped admin count
    const adminCountQuery = { role: 'admin', isActive: true };
    if (!isSuperAdmin(req.user) && req.user?.tenantId) adminCountQuery.tenantId = req.user.tenantId;
    const adminCount = await User.countDocuments(adminCountQuery);
    if (user.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar el último administrador' });
    }

    // Use soft delete (GDPR) instead of hard delete
    await user.softDelete(req.user?._id);

    // Log de auditoría
    addAuditLog(req, 'USER_DELETE', 'users',
      `Eliminó usuario: ${user.email}`, { userId: req.params.id });

    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
};

// ==================== Reset Password ====================

const resetUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { ensureSameTenant } = require('../utils/tenantGuard');
    if (!ensureSameTenant(user, req, res, { resource: 'Usuario' })) return;

    // La contraseña temporal vuelve en la respuesta: restablecer la de un
    // super_admin era tomar su cuenta.
    if (!puedeGestionarUsuario(req.user, user)) {
      return res.status(403).json({ success: false, error: 'No puedes modificar a un super administrador.' });
    }

    // Generar nueva contraseña temporal. Misma generacion (crypto, fuerte)
    // que authController.adminInvite: es temporal por definicion, asi que el
    // usuario tiene que cambiarla en el primer acceso (mustChangePassword),
    // con la misma caducidad de 72h que una invitacion.
    const newPassword = generarContrasenaTemporal();
    user.password = newPassword;
    user.mustChangePassword = true;
    user.tempPasswordExpires = calcularExpiracionTemporal();
    await user.save();

    // Log de auditoría
    addAuditLog(req, 'PASSWORD_RESET', 'users',
      `Restableció contraseña de: ${user.email}`, { userId: req.params.id });

    // La temporal solo en su propio campo, nunca repetida en `message`.
    res.json({
      success: true,
      temporaryPassword: newPassword,
      message: 'Nueva contrasena temporal generada.'
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: 'Error al restablecer contraseña' });
  }
};

// ==================== Roles ====================

const listRoles = async (req, res) => {
  try {
    res.json({ success: true, roles });
  } catch (error) {
    logger.error('Error listing roles:', error);
    res.status(500).json({ success: false, error: 'Error al listar roles' });
  }
};

// ==================== System Settings ====================

const getSettings = async (req, res) => {
  try {
    res.json({ success: true, settings: systemSettings });
  } catch (error) {
    logger.error('Error getting settings:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { section, settings } = req.body;

    if (!section || !settings) {
      return res.status(400).json({ success: false, error: 'Sección y configuración requeridas' });
    }

    if (!systemSettings[section]) {
      return res.status(400).json({ success: false, error: 'Sección no válida' });
    }

    const oldSettings = { ...systemSettings[section] };
    systemSettings[section] = { ...systemSettings[section], ...settings };

    // Log de auditoría
    addAuditLog(req, 'CONFIG_CHANGE', 'settings',
      `Modificó configuración: ${section}`, { section, oldSettings, newSettings: settings });

    logger.info('Settings updated', { section });

    res.json({ success: true, settings: systemSettings });
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar configuración' });
  }
};

// ==================== Audit Logs ====================

const getAuditLogs = async (req, res) => {
  try {
    const { module, action, userId, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let filteredLogs = logsVisibles(req.user);

    if (module) {
      filteredLogs = filteredLogs.filter(l => l.module === module);
    }

    if (action) {
      filteredLogs = filteredLogs.filter(l => l.action === action);
    }

    if (userId) {
      filteredLogs = filteredLogs.filter(l => l.userId === userId);
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) >= new Date(startDate));
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) <= new Date(endDate));
    }

    // Ordenar por fecha descendente
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      logs: paginatedLogs,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    res.status(500).json({ success: false, error: 'Error al obtener logs de auditoría' });
  }
};

const getAuditStats = async (req, res) => {
  try {
    // Estadísticas de los últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const visibles = logsVisibles(req.user);
    const recentLogs = visibles.filter(l => new Date(l.timestamp) >= sevenDaysAgo);

    // Por módulo
    const byModule = recentLogs.reduce((acc, l) => {
      acc[l.module] = (acc[l.module] || 0) + 1;
      return acc;
    }, {});

    // Por acción
    const byAction = recentLogs.reduce((acc, l) => {
      acc[l.action] = (acc[l.action] || 0) + 1;
      return acc;
    }, {});

    // Por usuario
    const byUser = recentLogs.reduce((acc, l) => {
      acc[l.userName] = (acc[l.userName] || 0) + 1;
      return acc;
    }, {});

    // Por día
    const byDay = recentLogs.reduce((acc, l) => {
      const day = l.timestamp.split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      stats: {
        totalLogs: visibles.length,
        last7Days: recentLogs.length,
        byModule,
        byAction,
        byUser,
        byDay
      }
    });
  } catch (error) {
    logger.error('Error getting audit stats:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
};

// ==================== Dashboard Stats ====================

const getDashboardStats = async (req, res) => {
  try {
    // Los conteos se acotan al tenant del admin: un 'admin' es administrador de
    // SU organizacion, no de la plataforma, asi que no debe ver el numero de
    // usuarios de otros clientes. Solo super_admin ve el total global. El match
    // de la agregacion necesita el ObjectId casteado a mano (aggregate no lo
    // castea, misma trampa que en analytics).
    const { isSuperAdmin } = require('../utils/tenantGuard');
    const scope = {};
    if (!isSuperAdmin(req.user) && req.user?.tenantId) {
      scope.tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
    }

    const totalUsers = await User.countDocuments(scope);
    const activeUsers = await User.countDocuments({ ...scope, isActive: true });

    // Usuarios por rol
    const usersByRole = await User.aggregate([
      { $match: scope },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const roleStats = usersByRole.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {});

    // Actividad reciente (últimas 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const visibles = logsVisibles(req.user);
    const recentActivity = visibles.filter(l => new Date(l.timestamp) >= oneDayAgo).length;

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          byRole: roleStats
        },
        activity: {
          last24h: recentActivity,
          totalLogs: visibles.length
        },
        system: {
          aeatStatus: systemSettings.integrations.aeatEnabled ? 'connected' : 'disconnected',
          aiStatus: systemSettings.integrations.aiAssistantEnabled ? 'active' : 'inactive'
        }
      }
    });
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
};

// ==================== Helper Functions ====================

/**
 * Registra una entrada en el log de auditoria de admin (en memoria).
 *
 * - Guarda el tenant de quien actua: el log es uno para todo el proceso y se
 *   filtra por tenant al leerlo (F8, F19).
 * - `details` pasa por auditService.scrub antes de guardarse: USER_UPDATE
 *   guardaba `changes: req.body` y la contraseña nueva quedaba en claro (F5).
 */
function addAuditLog(req, action, module, description, details = {}) {
  const log = {
    id: String(auditLogs.length + 1),
    timestamp: new Date().toISOString(),
    userId: req?.user?.id || 'system',
    userName: req?.user?.name || 'Sistema',
    tenantId: req?.user?.tenantId ? String(req.user.tenantId) : null,
    action,
    module,
    description,
    ip: '192.168.1.100',
    details: scrub(details)
  };

  auditLogs.unshift(log);

  // Mantener solo los últimos 1000 logs en memoria
  if (auditLogs.length > 1000) {
    auditLogs = auditLogs.slice(0, 1000);
  }
}

/**
 * Entradas visibles para quien pregunta: las de su tenant, o todas para un
 * super_admin. Las entradas sin tenant (anteriores a este cambio o del
 * sistema) solo las ve un super_admin. Se vuelven a pasar por scrub al leerlas
 * por si alguna entrada antigua tuviera una contraseña.
 */
function logsVisibles(user) {
  const { isSuperAdmin } = require('../utils/tenantGuard');
  const propios = isSuperAdmin(user)
    ? auditLogs
    : auditLogs.filter((l) => l.tenantId && user?.tenantId && l.tenantId === String(user.tenantId));
  return propios.map((l) => ({ ...l, details: scrub(l.details) }));
}

/** Solo para tests: inserta una entrada tal cual (simula una antigua). */
function _registrarAuditoriaParaTest(entrada) {
  auditLogs.unshift({ id: String(auditLogs.length + 1), timestamp: new Date().toISOString(), ...entrada });
}

module.exports = {
  _registrarAuditoriaParaTest,
  // Users
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,

  // Roles
  listRoles,

  // Settings
  getSettings,
  updateSettings,

  // Audit
  getAuditLogs,
  getAuditStats,

  // Dashboard
  getDashboardStats
};
