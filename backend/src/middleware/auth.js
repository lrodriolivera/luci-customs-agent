const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware de autenticacion JWT
 */
const auth = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Acceso denegado. Token no proporcionado.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Token invalido o usuario inactivo.'
      });
    }

    // Adjuntar usuario a la request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token invalido.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado.'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Error de autenticacion.'
    });
  }
};

/**
 * Middleware para verificar roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta accion.'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar permisos especificos
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado.'
      });
    }

    // Admin tiene todos los permisos
    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta accion.'
      });
    }

    next();
  };
};

/**
 * Middleware opcional de autenticacion
 * No falla si no hay token, pero adjunta usuario si existe
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Ignorar errores y continuar sin usuario
    next();
  }
};

module.exports = {
  auth,
  requireAuth: auth,  // Alias para compatibilidad
  requireRole,
  requirePermission,
  optionalAuth
};
