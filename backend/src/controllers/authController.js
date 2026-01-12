const { User } = require('../models');
const logger = require('../config/logger');

/**
 * Registro de nuevo usuario
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, name, role, profile } = req.body;

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'El email ya esta registrado'
      });
    }

    // Crear usuario
    const user = new User({
      email,
      password,
      name,
      role: role || 'agent',
      profile: profile || {}
    });

    await user.save();

    // Generar token
    const token = user.generateAuthToken();

    logger.info(`Nuevo usuario registrado: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token
      }
    });

  } catch (error) {
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

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  listUsers,
  updateUser
};
