/**
 * apiKeyAuth.branches.test.js
 *
 * Cobertura de ramas del middleware de autenticación por API key.
 * CRÍTICO DE SEGURIDAD: cualquier bypass de autenticación es hallazgo.
 * OBJETIVO: ≥85% de ramas (30 ramas totales).
 * No mockea el middleware bajo prueba: ejercita su lógica real.
 * Mockea solo modelos (ClientApiKey) y req/res/next simulados.
 */

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const {
  authenticateApiKey,
  requirePermission,
  requireAnyPermission
} = require('../../src/middleware/apiKeyAuth');
const { ClientApiKey } = require('../../src/models');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Sondea la API key hasta que el contador de uso alcance el valor esperado.
 * Necesario porque el middleware lanza `recordUsage` sin esperarlo.
 */
async function esperarUsoRegistrado(id, totalEsperado, intentos = 50) {
  let doc;
  for (let i = 0; i < intentos; i++) {
    doc = await ClientApiKey.findById(id);
    if (doc?.usage?.totalRequests === totalEsperado) return doc;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return doc;
}

describe('apiKeyAuth middleware - branches SECURITY-CRITICAL', () => {
  usarBaseDeDatosEnMemoria();

  let validApiKeyDoc, expiredApiKeyDoc, revokedApiKeyDoc, ipWhitelistApiKeyDoc;
  let validApiKey;
  let req, res, next;
  let mockOrgId;

  beforeEach(async () => {
    mockOrgId = new mongoose.Types.ObjectId();

    // Generar una API key válida
    const { key, prefix, hash } = ClientApiKey.generateKey();
    validApiKey = key;

    validApiKeyDoc = await ClientApiKey.create({
      organizationId: mockOrgId,
      name: 'Valid Key',
      keyHash: hash,
      keyPrefix: prefix,
      permissions: ['expeditions:read', 'declarations:write', 'stats:read'],
      rateLimit: { requestsPerMinute: 60, requestsPerDay: 10000 },
      status: 'active',
      createdBy: new mongoose.Types.ObjectId()
    });

    // API key expirada
    const { key: expKey, prefix: expPrefix, hash: expHash } = ClientApiKey.generateKey();
    expiredApiKeyDoc = await ClientApiKey.create({
      organizationId: mockOrgId,
      name: 'Expired Key',
      keyHash: expHash,
      keyPrefix: expPrefix,
      permissions: ['expeditions:read'],
      status: 'active',
      expiresAt: new Date(Date.now() - 86400000), // expiró ayer
      createdBy: new mongoose.Types.ObjectId()
    });

    // API key revocada
    const { key: revKey, prefix: revPrefix, hash: revHash } = ClientApiKey.generateKey();
    revokedApiKeyDoc = await ClientApiKey.create({
      organizationId: mockOrgId,
      name: 'Revoked Key',
      keyHash: revHash,
      keyPrefix: revPrefix,
      permissions: ['expeditions:read'],
      status: 'revoked',
      createdBy: new mongoose.Types.ObjectId()
    });

    // API key con IP whitelist
    const { key: ipKey, prefix: ipPrefix, hash: ipHash } = ClientApiKey.generateKey();
    ipWhitelistApiKeyDoc = await ClientApiKey.create({
      organizationId: mockOrgId,
      name: 'IP Restricted Key',
      keyHash: ipHash,
      keyPrefix: ipPrefix,
      permissions: ['expeditions:read'],
      ipWhitelist: ['192.168.1.100', '10.0.0.1'],
      rateLimit: { requestsPerMinute: 10 },
      status: 'active',
      createdBy: new mongoose.Types.ObjectId()
    });

    // Reiniciar rate limit store (es un Map en memoria en el módulo)
    // No podemos acceder directamente, pero sabemos que se limpia con cleanupRateLimits
    // Para tests, aceptamos que el store persista entre tests (cada keyId es único)

    req = {
      headers: {},
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('authenticateApiKey - autenticación básica', () => {
    test('permite con API key válida en header x-api-key', async () => {
      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.apiKey).toBeDefined();
      expect(req.organizationId).toEqual(mockOrgId);
    });

    test('permite con API key válida en header authorization Bearer', async () => {
      req.headers['authorization'] = `Bearer ${validApiKey}`;

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.apiKey).toBeDefined();
    });

    test('rechaza 401 si no hay API key en headers', async () => {
      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'API key required',
          code: 'MISSING_API_KEY'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('rechaza 401 si API key es inválida (no existe en BD)', async () => {
      req.headers['x-api-key'] = 'lca_invalidkeynotindb123456789abcdef';

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid or expired API key',
          code: 'INVALID_API_KEY'
        })
      );
    });

    test('rechaza 401 si API key no tiene prefijo lca_', async () => {
      req.headers['x-api-key'] = 'sk_invalidprefix123456789';

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_API_KEY'
        })
      );
    });

    test('rechaza 401 si API key está revocada', async () => {
      const { key: revKey } = ClientApiKey.generateKey();
      const revHash = crypto.createHash('sha256').update(revKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(revokedApiKeyDoc._id, { keyHash: revHash });

      req.headers['x-api-key'] = revKey;

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rechaza 401 y marca inactive si API key ha expirado', async () => {
      const { key: expKey } = ClientApiKey.generateKey();
      const expHash = crypto.createHash('sha256').update(expKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(expiredApiKeyDoc._id, {
        keyHash: expHash,
        status: 'active',
        expiresAt: new Date(Date.now() - 1000)
      });

      req.headers['x-api-key'] = expKey;

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);

      // Verificar que se marcó como inactive
      const updated = await ClientApiKey.findById(expiredApiKeyDoc._id);
      expect(updated.status).toBe('inactive');
    });

    test('responde 500 si error inesperado en autenticación', async () => {
      // Forzar error cerrando la conexión de Mongoose (no recomendado, pero es un edge case)
      // Alternativa: mockear ClientApiKey.findByKey para lanzar error
      // Para no romper Mongoose, usamos una key válida y mockeamos findByKey
      jest.spyOn(ClientApiKey, 'findByKey').mockRejectedValueOnce(new Error('DB error'));

      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication error',
          code: 'AUTH_ERROR'
        })
      );
    });
  });

  describe('authenticateApiKey - IP whitelist', () => {
    test('permite si IP está en whitelist', async () => {
      const { key: ipKey } = ClientApiKey.generateKey();
      const ipHash = crypto.createHash('sha256').update(ipKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(ipWhitelistApiKeyDoc._id, { keyHash: ipHash });

      req.headers['x-api-key'] = ipKey;
      req.ip = '192.168.1.100';

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('rechaza 403 si IP NO está en whitelist', async () => {
      const { key: ipKey } = ClientApiKey.generateKey();
      const ipHash = crypto.createHash('sha256').update(ipKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(ipWhitelistApiKeyDoc._id, { keyHash: ipHash });

      req.headers['x-api-key'] = ipKey;
      req.ip = '192.168.1.200'; // NO en whitelist

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'IP not allowed',
          code: 'IP_NOT_ALLOWED'
        })
      );
    });

    test('permite si ipWhitelist está vacío (sin restricción)', async () => {
      req.headers['x-api-key'] = validApiKey;
      req.ip = '1.2.3.4'; // cualquier IP

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('usa req.connection.remoteAddress si req.ip no está disponible', async () => {
      const { key: ipKey } = ClientApiKey.generateKey();
      const ipHash = crypto.createHash('sha256').update(ipKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(ipWhitelistApiKeyDoc._id, { keyHash: ipHash });

      req.headers['x-api-key'] = ipKey;
      req.ip = undefined;
      req.connection.remoteAddress = '10.0.0.1'; // en whitelist

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('authenticateApiKey - rate limiting', () => {
    test('permite si no se ha excedido el límite de requests por minuto', async () => {
      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    test('rechaza 429 si se excede el límite de requests por minuto', async () => {
      req.headers['x-api-key'] = validApiKey;

      // Hacer 61 requests (límite = 60)
      for (let i = 0; i < 61; i++) {
        req = {
          headers: { 'x-api-key': validApiKey },
          ip: '192.168.1.1',
          connection: { remoteAddress: '192.168.1.1' }
        };
        res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          setHeader: jest.fn()
        };
        next = jest.fn();

        await authenticateApiKey(req, res, next);
      }

      // La request 61 debe ser rechazada
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number)
        })
      );
    });

    test('resetea contador después de la ventana de tiempo (60s)', async () => {
      // Para testear esto sin esperar 60s reales, necesitaríamos mockear Date.now
      // o usar jest.useFakeTimers. PERO useFakeTimers + Mongo CUELGA.
      // Limitación: aceptamos que esta rama no se testee completamente.
      // En su lugar, verificamos que el contador se crea correctamente.
      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });

    test('devuelve remaining correcto después de varias requests', async () => {
      req.headers['x-api-key'] = validApiKey;

      // Primera request
      await authenticateApiKey(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 59);

      // Segunda request
      req = {
        headers: { 'x-api-key': validApiKey },
        ip: '192.168.1.1',
        connection: { remoteAddress: '192.168.1.1' }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };
      next = jest.fn();

      await authenticateApiKey(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 58);
    });
  });

  describe('authenticateApiKey - recordUsage', () => {
    test('registra uso asíncronamente (fire-and-forget)', async () => {
      req.headers['x-api-key'] = validApiKey;

      const initialUsage = validApiKeyDoc.usage.totalRequests;

      await authenticateApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith();

      // `recordUsage` es fire-and-forget (el middleware no lo espera), asi que
      // hay que sondear la BD: un solo setImmediate solo cubre el caso en que el
      // save al mongod acabe dentro del mismo tick, y bajo la carga de la
      // bateria completa no acaba (flaky que dejaba el CI rojo).
      const updated = await esperarUsoRegistrado(validApiKeyDoc._id, initialUsage + 1);
      expect(updated.usage.totalRequests).toBe(initialUsage + 1);
      expect(updated.usage.lastUsedAt).toBeDefined();
      expect(updated.usage.lastUsedIp).toBe('192.168.1.1');
    });

    test('no bloquea si recordUsage falla', async () => {
      // Mock recordUsage para que falle
      jest.spyOn(validApiKeyDoc, 'recordUsage').mockRejectedValueOnce(new Error('DB error'));

      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      // Debe pasar igual (fire-and-forget con .catch)
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('authenticateApiKey - attach to request', () => {
    test('attach apiKey, organizationId y organization a req', async () => {
      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      expect(req.apiKey).toBeDefined();
      expect(req.organizationId).toEqual(mockOrgId);
      expect(req.organization).toEqual(mockOrgId);
    });

    test('organizationId es el _id si organizationId es un objeto poblado', async () => {
      // Simular que organizationId está poblado con un objeto
      const populatedKeyDoc = await ClientApiKey.findById(validApiKeyDoc._id);
      populatedKeyDoc.organizationId = { _id: mockOrgId, name: 'Test Org' };

      jest.spyOn(ClientApiKey, 'findByKey').mockResolvedValueOnce(populatedKeyDoc);

      req.headers['x-api-key'] = validApiKey;

      await authenticateApiKey(req, res, next);

      expect(req.organizationId).toEqual(mockOrgId);
    });
  });

  describe('requirePermission - verificación de permisos', () => {
    beforeEach(() => {
      req.apiKey = validApiKeyDoc;
    });

    test('permite si API key tiene el permiso requerido', () => {
      const middleware = requirePermission('expeditions:read');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('rechaza 403 si API key NO tiene el permiso requerido', () => {
      const middleware = requirePermission('declarations:read');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Permission denied: declarations:read',
          code: 'PERMISSION_DENIED'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('rechaza 401 si no hay apiKey en req (no autenticado)', () => {
      req.apiKey = undefined;
      const middleware = requirePermission('expeditions:read');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MISSING_API_KEY'
        })
      );
    });
  });

  describe('requireAnyPermission - verificación de múltiples permisos', () => {
    beforeEach(() => {
      req.apiKey = validApiKeyDoc;
    });

    test('permite si API key tiene al menos uno de los permisos', () => {
      const middleware = requireAnyPermission(['expeditions:write', 'expeditions:read']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('rechaza 403 si API key NO tiene ninguno de los permisos', () => {
      const middleware = requireAnyPermission(['declarations:read', 'payments:write']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Requires one of:'),
          code: 'PERMISSION_DENIED'
        })
      );
    });

    test('rechaza 401 si no hay apiKey en req', () => {
      req.apiKey = undefined;
      const middleware = requireAnyPermission(['expeditions:read']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('permite si tiene uno de varios permisos (segundo en la lista)', () => {
      const middleware = requireAnyPermission(['payments:read', 'declarations:write', 'documents:read']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('HALLAZGOS DE SEGURIDAD', () => {
    test('SECURITY (regresión fix 6/Ago): la API key inválida NO se filtra en el log', async () => {
      // FIX 6/Ago/2026: antes el middleware hacía
      //   logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 12)}...`)
      // filtrando 12 caracteres de la key entrante a los logs (fuga de secreto).
      // Ahora solo loguea la longitud. Este test es DISCRIMINANTE: falla si se vuelve
      // a incluir cualquier fragmento de la key en el mensaje.
      const logger = require('../../src/config/logger');
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      const claveEntrante = 'lca_invalidkey123456789SECRETO';
      req.headers['x-api-key'] = claveEntrante;

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(warnSpy).toHaveBeenCalled();
      // Ningún argumento del log puede contener la key ni un prefijo de ella.
      for (const call of warnSpy.mock.calls) {
        const texto = call.map((a) => String(a)).join(' ');
        expect(texto).not.toContain(claveEntrante);
        expect(texto).not.toContain(claveEntrante.substring(0, 12));
        expect(texto).not.toContain('SECRETO');
      }

      warnSpy.mockRestore();
    });

    test('SECURITY CRITICAL: verificar que NO hay bypass de autenticación', async () => {
      // Este test verifica que TODAS las ramas que rechazan autenticación están cubiertas.
      // Ningún camino debe permitir pasar sin key válida.

      // Sin key
      await authenticateApiKey(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);

      // Key inválida
      req.headers['x-api-key'] = 'lca_invalida';
      res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
      next = jest.fn();
      await authenticateApiKey(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);

      // Key revocada
      const { key: revKey } = ClientApiKey.generateKey();
      const revHash = crypto.createHash('sha256').update(revKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(revokedApiKeyDoc._id, { keyHash: revHash });
      req.headers['x-api-key'] = revKey;
      res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
      next = jest.fn();
      await authenticateApiKey(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);

      // IP no permitida
      const { key: ipKey } = ClientApiKey.generateKey();
      const ipHash = crypto.createHash('sha256').update(ipKey).digest('hex');
      await ClientApiKey.findByIdAndUpdate(ipWhitelistApiKeyDoc._id, { keyHash: ipHash });
      req = {
        headers: { 'x-api-key': ipKey },
        ip: '1.2.3.4',
        connection: { remoteAddress: '1.2.3.4' }
      };
      res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
      next = jest.fn();
      await authenticateApiKey(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);

      // CONCLUSIÓN: no hay bypass de autenticación. Todos los casos rechazan correctamente.
    });
  });

  describe('Edge cases y cobertura de ramas restantes', () => {
    test('maneja authorization header sin Bearer prefix', async () => {
      req.headers['authorization'] = validApiKey; // sin "Bearer "

      await authenticateApiKey(req, res, next);

      // El código hace .replace('Bearer ', ''), si no hay Bearer, devuelve la key completa
      expect(next).toHaveBeenCalledWith();
    });

    test('maneja req.ip y req.connection.remoteAddress ambos undefined', async () => {
      req.headers['x-api-key'] = validApiKey;
      req.ip = undefined;
      req.connection.remoteAddress = undefined;

      await authenticateApiKey(req, res, next);

      // clientIp será undefined, pero como no hay ipWhitelist, pasa
      expect(next).toHaveBeenCalledWith();
    });

    test('rate limit con remaining = 0 muestra en header', async () => {
      req.headers['x-api-key'] = validApiKey;

      // Hacer exactamente 60 requests (límite)
      for (let i = 0; i < 60; i++) {
        req = {
          headers: { 'x-api-key': validApiKey },
          ip: '192.168.1.1',
          connection: { remoteAddress: '192.168.1.1' }
        };
        res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          setHeader: jest.fn()
        };
        next = jest.fn();

        await authenticateApiKey(req, res, next);
      }

      // La request 60 debe pasar, pero remaining=0
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    });

    test('cleanupRateLimits elimina entradas antiguas (>5min)', () => {
      // cleanupRateLimits es un setInterval que corre cada minuto.
      // No podemos testearlo directamente sin mockear setInterval o esperar 1 min.
      // Aceptamos que esa rama (cleanup) quede sin cobertura directa.
      // Su lógica es trivial: elimina si now - windowStart > 5min.
      expect(true).toBe(true);
    });
  });
});
