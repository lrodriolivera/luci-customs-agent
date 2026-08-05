/**
 * middleware/auth — autenticación (dual/cognito/legacy), requireRole,
 * requirePermission y optionalAuth.
 *
 * AUTH_MODE se lee a nivel de módulo, así que para probar cada modo recargamos
 * el módulo con jest.isolateModules tras fijar process.env.AUTH_MODE. Aquí es
 * SEGURO usar isolateModules porque NO tocamos Mongo real: mockeamos el modelo
 * User y los dos verificadores (jwtService / cognitoService) — que son las
 * únicas fronteras del middleware. No se ejecuta ninguna verificación real ni
 * se sale a Cognito/AWS.
 *
 * jest.config: resetMocks:true → implementaciones fijadas por test.
 */

jest.mock('../../src/utils/jwtService', () => ({ verify: jest.fn() }));
jest.mock('../../src/utils/cognitoService', () => ({
  verifyAccessToken: jest.fn(),
  isConfigured: jest.fn()
}));
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findById: jest.fn() }
}));

const jwtService = require('../../src/utils/jwtService');
const cognitoService = require('../../src/utils/cognitoService');
const { User } = require('../../src/models');

/** Carga el middleware con un AUTH_MODE concreto. */
function cargarAuth(mode) {
  let mod;
  jest.isolateModules(() => {
    if (mode === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = mode;
    mod = require('../../src/middleware/auth');
  });
  return mod;
}

/** Fabrica req/res/next de Express. */
function fabricarCtx(authHeader) {
  const req = { header: (h) => (h === 'Authorization' ? authHeader : undefined) };
  const res = {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
  const next = jest.fn();
  return { req, res, next };
}

afterAll(() => { delete process.env.AUTH_MODE; });

// ==================== auth: header ====================
describe('auth — validación del header', () => {
  test('401 si no hay header Authorization', async () => {
    const { auth } = cargarAuth('legacy');
    const { req, res, next } = fabricarCtx(undefined);
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Token no proporcionado/);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 si el header no empieza por "Bearer "', async () => {
    const { auth } = cargarAuth('legacy');
    const { req, res, next } = fabricarCtx('Basic abc');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ==================== auth: modo legacy ====================
describe('auth — modo legacy', () => {
  test('adjunta req.user y llama next con token válido y usuario activo', async () => {
    const { auth } = cargarAuth('legacy');
    jwtService.verify.mockReturnValue({ id: 'u1' });
    User.findById.mockResolvedValue({ _id: 'u1', isActive: true, role: 'admin' });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('u1');
    expect(req.token).toBe('tok');
  });

  test('401 si el usuario está inactivo', async () => {
    const { auth } = cargarAuth('legacy');
    jwtService.verify.mockReturnValue({ id: 'u1' });
    User.findById.mockResolvedValue({ _id: 'u1', isActive: false });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalido/);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 si el usuario no existe', async () => {
    const { auth } = cargarAuth('legacy');
    jwtService.verify.mockReturnValue({ id: 'noexiste' });
    User.findById.mockResolvedValue(null);
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
  });

  test('401 con token JWT malformado (JsonWebTokenError)', async () => {
    const { auth } = cargarAuth('legacy');
    const err = new Error('bad'); err.name = 'JsonWebTokenError';
    jwtService.verify.mockImplementation(() => { throw err; });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalido/);
  });

  test('401 "Token expirado" con TokenExpiredError', async () => {
    const { auth } = cargarAuth('legacy');
    const err = new Error('exp'); err.name = 'TokenExpiredError';
    jwtService.verify.mockImplementation(() => { throw err; });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/expirado/);
  });

  test('500 ante error inesperado no-JWT', async () => {
    const { auth } = cargarAuth('legacy');
    jwtService.verify.mockImplementation(() => { throw new Error('db down'); });
    // findById tampoco se llega a invocar; el throw viene de verify dentro del try.
    const { req, res, next } = fabricarCtx('Bearer tok');
    // verifyLegacy captura su propio throw? No: en 'legacy' no hay try interno,
    // el throw sube al catch del middleware → error genérico no-JWT → 500.
    await auth(req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Error de autenticacion/);
  });
});

// ==================== auth: modo cognito ====================
describe('auth — modo cognito', () => {
  test('verifica por Cognito cuando está configurado', async () => {
    const { auth } = cargarAuth('cognito');
    cognitoService.isConfigured.mockReturnValue(true);
    cognitoService.verifyAccessToken.mockResolvedValue({ sub: 'cog-1' });
    User.findOne.mockResolvedValue({ _id: 'u9', isActive: true });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('u9');
    expect(User.findOne).toHaveBeenCalledWith({ cognitoSub: 'cog-1', isActive: true });
  });

  test('401 si Cognito no está configurado (result queda null)', async () => {
    const { auth } = cargarAuth('cognito');
    cognitoService.isConfigured.mockReturnValue(false);
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(cognitoService.verifyAccessToken).not.toHaveBeenCalled();
  });

  test('401 si verifyCognito no encuentra usuario', async () => {
    const { auth } = cargarAuth('cognito');
    cognitoService.isConfigured.mockReturnValue(true);
    cognitoService.verifyAccessToken.mockResolvedValue({ sub: 'x' });
    User.findOne.mockResolvedValue(null);
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
  });
});

// ==================== auth: modo dual ====================
describe('auth — modo dual', () => {
  test('usa Cognito primero si está configurado y funciona', async () => {
    const { auth } = cargarAuth('dual');
    cognitoService.isConfigured.mockReturnValue(true);
    cognitoService.verifyAccessToken.mockResolvedValue({ sub: 'c1' });
    User.findOne.mockResolvedValue({ _id: 'uc', isActive: true });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('uc');
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  test('cae a legacy si Cognito lanza', async () => {
    const { auth } = cargarAuth('dual');
    cognitoService.isConfigured.mockReturnValue(true);
    cognitoService.verifyAccessToken.mockRejectedValue(new Error('cognito no'));
    jwtService.verify.mockReturnValue({ id: 'ul' });
    User.findById.mockResolvedValue({ _id: 'ul', isActive: true });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('ul');
  });

  test('cae a legacy directamente si Cognito no está configurado', async () => {
    const { auth } = cargarAuth('dual');
    cognitoService.isConfigured.mockReturnValue(false);
    jwtService.verify.mockReturnValue({ id: 'ul2' });
    User.findById.mockResolvedValue({ _id: 'ul2', isActive: true });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(cognitoService.verifyAccessToken).not.toHaveBeenCalled();
  });

  test('401 si ambos verificadores fallan', async () => {
    const { auth } = cargarAuth('dual');
    cognitoService.isConfigured.mockReturnValue(true);
    cognitoService.verifyAccessToken.mockRejectedValue(new Error('no'));
    jwtService.verify.mockImplementation(() => { throw new Error('no'); });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ==================== requireRole ====================
describe('requireRole', () => {
  test('401 si no hay req.user', () => {
    const { requireRole } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    requireRole('admin')(req, res, next);
    expect(res.statusCode).toBe(401);
  });

  test('403 si el rol no está permitido', () => {
    const { requireRole } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    req.user = { role: 'operator' };
    requireRole('admin')(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('next() si el rol coincide (uno de varios)', () => {
    const { requireRole } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    req.user = { role: 'admin' };
    requireRole('super_admin', 'admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ==================== requirePermission ====================
describe('requirePermission', () => {
  test('401 si no hay req.user', () => {
    const { requirePermission } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    requirePermission('canExport')(req, res, next);
    expect(res.statusCode).toBe(401);
  });

  test('admin pasa siempre (bypass de permisos)', () => {
    const { requirePermission } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    req.user = { role: 'admin' };
    requirePermission('loQueSea')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('403 si falta el permiso concreto', () => {
    const { requirePermission } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    req.user = { role: 'operator', permissions: { canView: true } };
    requirePermission('canExport')(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('next() si tiene el permiso', () => {
    const { requirePermission } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    req.user = { role: 'operator', permissions: { canExport: true } };
    requirePermission('canExport')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('403 si el usuario no tiene objeto permissions', () => {
    const { requirePermission } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx();
    req.user = { role: 'operator' };
    requirePermission('canExport')(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

// ==================== optionalAuth ====================
describe('optionalAuth', () => {
  test('sigue sin usuario si no hay header', async () => {
    const { optionalAuth } = cargarAuth('dual');
    const { req, res, next } = fabricarCtx(undefined);
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('adjunta usuario en dual vía legacy', async () => {
    const { optionalAuth } = cargarAuth('dual');
    cognitoService.isConfigured.mockReturnValue(false);
    jwtService.verify.mockReturnValue({ id: 'uo' });
    User.findById.mockResolvedValue({ _id: 'uo', isActive: true });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('uo');
  });

  test('sigue sin usuario si el token es inválido (no lanza)', async () => {
    const { optionalAuth } = cargarAuth('legacy');
    jwtService.verify.mockImplementation(() => { throw new Error('bad'); });
    const { req, res, next } = fabricarCtx('Bearer malo');
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('modo cognito: adjunta usuario si Cognito valida', async () => {
    const { optionalAuth } = cargarAuth('cognito');
    cognitoService.isConfigured.mockReturnValue(true);
    cognitoService.verifyAccessToken.mockResolvedValue({ sub: 's' });
    User.findOne.mockResolvedValue({ _id: 'ok', isActive: true });
    const { req, res, next } = fabricarCtx('Bearer tok');
    await optionalAuth(req, res, next);
    expect(req.user._id).toBe('ok');
  });
});
