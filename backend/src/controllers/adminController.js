/**
 * Admin Controller
 * Panel de administración - Gestión de usuarios, configuración y auditoría
 * Usa MongoDB para persistencia de datos
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../config/logger');
const crypto = require('crypto');

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
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
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

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El email ya está registrado' });
    }

    // Generar contraseña si no se proporciona
    let userPassword = password;
    let generatedPassword = null;

    if (!password || generatePassword) {
      // Generar contraseña temporal de 12 caracteres
      generatedPassword = crypto.randomBytes(6).toString('hex');
      userPassword = generatedPassword;
    }

    if (userPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
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
    addAuditLog(req.user?.id || 'system', req.user?.name || 'Sistema', 'USER_CREATE', 'users',
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

    // Si se generó una contraseña temporal, incluirla en la respuesta
    if (generatedPassword) {
      response.temporaryPassword = generatedPassword;
      response.message = `Usuario creado. Contraseña temporal: ${generatedPassword}`;
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

    if (name) user.name = name;
    if (role) user.role = role;
    if (status !== undefined) user.isActive = status === 'active';
    if (password && password.length >= 6) {
      user.password = password;
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
    addAuditLog(req.user?.id || 'system', req.user?.name || 'Sistema', 'USER_UPDATE', 'users',
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
    addAuditLog(req.user?.id || 'system', req.user?.name || 'Sistema', 'USER_DELETE', 'users',
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

    // Generar nueva contraseña temporal
    const newPassword = crypto.randomBytes(6).toString('hex');
    user.password = newPassword;
    await user.save();

    // Log de auditoría
    addAuditLog(req.user?.id || 'system', req.user?.name || 'Sistema', 'PASSWORD_RESET', 'users',
      `Restableció contraseña de: ${user.email}`, { userId: req.params.id });

    res.json({
      success: true,
      temporaryPassword: newPassword,
      message: `Nueva contraseña temporal: ${newPassword}`
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
    addAuditLog(req.user?.id || 'system', req.user?.name || 'Sistema', 'CONFIG_CHANGE', 'settings',
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

    let filteredLogs = [...auditLogs];

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

    const recentLogs = auditLogs.filter(l => new Date(l.timestamp) >= sevenDaysAgo);

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
        totalLogs: auditLogs.length,
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
    const recentActivity = auditLogs.filter(l => new Date(l.timestamp) >= oneDayAgo).length;

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
          totalLogs: auditLogs.length
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

function addAuditLog(userId, userName, action, module, description, details = {}) {
  const log = {
    id: String(auditLogs.length + 1),
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action,
    module,
    description,
    ip: '192.168.1.100',
    details
  };

  auditLogs.unshift(log);

  // Mantener solo los últimos 1000 logs en memoria
  if (auditLogs.length > 1000) {
    auditLogs = auditLogs.slice(0, 1000);
  }
}

module.exports = {
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
