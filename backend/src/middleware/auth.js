const jwtService = require('../utils/jwtService');
const cognitoService = require('../utils/cognitoService');
const { User } = require('../models');

const AUTH_MODE = process.env.AUTH_MODE || 'dual';

async function verifyCognito(token) {
  const decoded = await cognitoService.verifyAccessToken(token);
  const user = await User.findOne({ cognitoSub: decoded.sub, isActive: true });
  if (!user) return null;
  return { user, decoded };
}

async function verifyLegacy(token) {
  const decoded = jwtService.verify(token);
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) return null;
  return { user, decoded };
}

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Acceso denegado. Token no proporcionado.',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let result = null;

    if (AUTH_MODE === 'cognito' && cognitoService.isConfigured()) {
      result = await verifyCognito(token);
    } else if (AUTH_MODE === 'legacy') {
      result = await verifyLegacy(token);
    } else if (AUTH_MODE === 'dual') {
      if (cognitoService.isConfigured()) {
        try {
          result = await verifyCognito(token);
        } catch (_) {
          // Cognito verification failed, try legacy
        }
      }
      if (!result) {
        try {
          result = await verifyLegacy(token);
        } catch (_) {
          // Legacy also failed
        }
      }
    }

    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'Token invalido o usuario inactivo.',
      });
    }

    req.user = result.user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: error.name === 'TokenExpiredError' ? 'Token expirado.' : 'Token invalido.',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Error de autenticacion.',
    });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para esta accion.' });
    }
    next();
  };
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado.' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para esta accion.' });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    let result = null;

    if (AUTH_MODE === 'cognito' && cognitoService.isConfigured()) {
      try { result = await verifyCognito(token); } catch (_) {}
    } else if (AUTH_MODE === 'legacy') {
      try { result = await verifyLegacy(token); } catch (_) {}
    } else if (AUTH_MODE === 'dual') {
      if (cognitoService.isConfigured()) {
        try { result = await verifyCognito(token); } catch (_) {}
      }
      if (!result) {
        try { result = await verifyLegacy(token); } catch (_) {}
      }
    }

    if (result) {
      req.user = result.user;
      req.token = token;
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  auth,
  authenticate: auth,
  requireAuth: auth,
  requireRole,
  requirePermission,
  optionalAuth,
};
