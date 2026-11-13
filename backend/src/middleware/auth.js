const jwtService = require('../utils/jwtService');
const cognitoService = require('../utils/cognitoService');
const { User } = require('../models');

const AUTH_MODE = process.env.AUTH_MODE || 'dual';

/**
 * Rutas accesibles con una contrasena temporal pendiente de cambio
 * (user.mustChangePassword === true, ver authController.adminInvite). Fuera
 * de esta lista, `auth` responde 403 MUST_CHANGE_PASSWORD: un usuario
 * invitado no puede usar el resto de la aplicacion hasta cambiarla.
 */
const RUTAS_PERMITIDAS_CON_PASSWORD_TEMPORAL = [
  '/api/auth/password',
  '/api/auth/me',
  '/api/auth/logout'
];

function bloqueadoPorPasswordTemporal(req) {
  if (!req.user?.mustChangePassword) return false;
  const ruta = (req.originalUrl || '').split('?')[0];
  return !RUTAS_PERMITIDAS_CON_PASSWORD_TEMPORAL.includes(ruta);
}

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

  // Un token firmado ANTES del ultimo cambio de contrasena ya no vale: sin
  // esto, cambiar la contrasena (o que un admin la restablezca) no cerraba
  // las sesiones abiertas con la vieja, que seguian funcionando hasta que el
  // JWT caducara por su cuenta (hasta 7 dias). decoded.iat esta en segundos
  // (estandar JWT); passwordChangedAt en milisegundos. Si hay
  // passwordChangedAt pero el token no trae iat (no deberia faltar nunca en
  // un JWT normal, pero uno manipulado si podria omitirlo), se rechaza: sin
  // iat no hay forma de comprobar esto.
  if (user.passwordChangedAt) {
    if (typeof decoded.iat !== 'number') return null;
    const cambioEnSegundos = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (decoded.iat < cambioEnSegundos) return null;
  }

  // Complementa a passwordChangedAt: iat tiene resolucion de 1s, asi que un
  // token emitido en el MISMO segundo justo antes del cambio no se
  // distinguia por tiempo. tokenVersion se compara por valor exacto. Un
  // documento o un token sin este campo (de antes de que existiera) cuenta
  // como 0 en ambos lados, asi que las sesiones de antes de este cambio no
  // se rompen.
  const tokenVersionUsuario = user.tokenVersion || 0;
  const tokenVersionToken = decoded.tokenVersion || 0;
  if (tokenVersionUsuario !== tokenVersionToken) return null;

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

    if (bloqueadoPorPasswordTemporal(req)) {
      return res.status(403).json({
        success: false,
        error: 'Debes cambiar tu contrasena temporal antes de continuar.',
        code: 'MUST_CHANGE_PASSWORD'
      });
    }

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

/**
 * Exige que el usuario tenga uno de estos roles.
 *
 * ┌─ OJO ────────────────────────────────────────────────────────────────────┐
 * │ 'admin' es un rol de TENANT, no de plataforma. Un admin de LUCI          │
 * │ administra SU organizacion, no el sistema. El rol de plataforma es       │
 * │ 'super_admin' y se comprueba con superAdminOnly (tenantMiddleware).      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La consecuencia practica es facil de pasar por alto: requireRole('admin') NO
 * acota la ruta a ningun tenant. Solo dice "quien llame ha de ser admin de
 * alguno". Si el handler opera sobre todos los tenants, sigue haciendolo -- con
 * la falsa sensacion de estar protegido.
 *
 * Al proteger una ruta hay que decidir las dos cosas por separado:
 *   1. QUIEN puede llamarla        -> requireRole
 *   2. SOBRE QUE datos actua       -> filtrar por req.user.tenantId en el handler
 *
 * Las rutas admin de alcance global que existen hoy estan inventariadas y
 * justificadas en tests/security/adminIsTenantRole.test.js, que falla si
 * aparece una nueva sin revisar.
 */
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
