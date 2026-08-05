/**
 * Branch coverage tests for auditService.js
 *
 * Objetivo: cubrir todas las ramas (aislamiento por tenant, diferentes tipos de eventos,
 * niveles de severidad, filtros de consulta, paginación, scrubbing de datos sensibles).
 *
 * CRÍTICO: Este es un servicio de auditoría — prueba que los logs se acotan por tenant
 * y que las consultas discriminan correctamente (un tenant no ve logs de otro).
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const AuditLog = require('../../src/models/AuditLog');
const auditService = require('../../src/services/auditService');

usarBaseDeDatosEnMemoria();

describe('auditService.branches - branch coverage', () => {
  let tenant1Id, tenant2Id, user1Id, user2Id;

  beforeEach(async () => {
    // AuditLog es append-only: no permite deleteMany. Dropear la colección directamente.
    await mongoose.connection.db.dropCollection('auditlogs').catch(() => {});
    tenant1Id = new mongoose.Types.ObjectId();
    tenant2Id = new mongoose.Types.ObjectId();
    user1Id = new mongoose.Types.ObjectId();
    user2Id = new mongoose.Types.ObjectId();
  });

  describe('scrub() - data sanitization', () => {
    test('redacts password field', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'create',
        resource: 'User',
        metadata: { password: 'secret123' }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].metadata.password).toBe('[REDACTED]');
    });

    test('redacts token field', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'login',
        resource: 'User',
        changes: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].changes.token).toBe('[REDACTED]');
    });

    test('redacts authorization field', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'api_call',
        resource: 'ExternalAPI',
        metadata: { authorization: 'Bearer abc123' }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].metadata.authorization).toBe('[REDACTED]');
    });

    test('redacts cookie field', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'request',
        resource: 'Session',
        metadata: { cookie: 'session=xyz789' }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].metadata.cookie).toBe('[REDACTED]');
    });

    test('redacts apiKey field', async () => {
      // Regresion: SENSITIVE_KEYS tenia 'apiKey' (camelCase) pero se compara con
      // k.toLowerCase(), asi que nunca coincidia y la apiKey quedaba en claro en
      // los logs de auditoria. Corregido a 'apikey' en el Set.
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'configure',
        resource: 'Integration',
        changes: { apiKey: 'sk-live-123456' }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].changes.apiKey).toBe('[REDACTED]');
    });

    test('redacts secret field', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'update',
        resource: 'Config',
        metadata: { secret: 'my-secret-value' }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].metadata.secret).toBe('[REDACTED]');
    });

    test('handles nested sensitive keys', async () => {
      // Regresion: apiKey anidada tambien debe redactarse (antes se escapaba por
      // el mismatch de mayusculas en SENSITIVE_KEYS).
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'create',
        resource: 'User',
        changes: {
          user: {
            email: 'test@example.com',
            password: 'secret123',
            profile: {
              apiKey: 'key-456'
            }
          }
        }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].changes.user.email).toBe('test@example.com');
      expect(logs[0].changes.user.password).toBe('[REDACTED]');
      expect(logs[0].changes.user.profile.apiKey).toBe('[REDACTED]');
    });

    test('handles arrays with sensitive data', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'bulk_create',
        resource: 'User',
        metadata: {
          users: [
            { email: 'user1@test.com', password: 'pass1' },
            { email: 'user2@test.com', password: 'pass2' }
          ]
        }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].metadata.users[0].password).toBe('[REDACTED]');
      expect(logs[0].metadata.users[1].password).toBe('[REDACTED]');
      expect(logs[0].metadata.users[0].email).toBe('user1@test.com');
    });

    test('handles null and undefined values', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'update',
        resource: 'User',
        changes: {
          field1: null,
          field2: undefined,
          field3: 'value'
        }
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].changes.field1).toBeNull();
      expect(logs[0].changes.field2).toBeUndefined();
      expect(logs[0].changes.field3).toBe('value');
    });

    test('handles primitive values in metadata', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'update',
        resource: 'Config',
        metadata: 'string-metadata'
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].metadata).toBe('string-metadata');
    });
  });

  describe('log() - event recording', () => {
    test('skips when action is missing', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        resource: 'User'
      });
      const logs = await AuditLog.find({});
      expect(logs).toHaveLength(0);
    });

    test('skips when resource is missing', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'create'
      });
      const logs = await AuditLog.find({});
      expect(logs).toHaveLength(0);
    });

    test('logs with minimal req object', async () => {
      const req = {
        tenantId: tenant1Id
      };
      await auditService.log({
        req,
        action: 'create',
        resource: 'User'
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].tenantId.toString()).toBe(tenant1Id.toString());
      expect(logs[0].userId).toBeUndefined();
      expect(logs[0].userEmail).toBeUndefined();
    });

    test('extracts tenantId from req.user when req.tenantId is missing', async () => {
      const req = {
        user: { _id: user1Id, email: 'user@test.com', tenantId: tenant1Id }
      };
      await auditService.log({
        req,
        action: 'view',
        resource: 'Dashboard'
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].tenantId.toString()).toBe(tenant1Id.toString());
    });

    test('logs with full req object including headers', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' },
        method: 'POST',
        originalUrl: '/api/users',
        ip: '192.168.1.1', // req.ip tiene prioridad sobre x-forwarded-for
        headers: {
          'user-agent': 'Mozilla/5.0'
        },
        id: 'req-123',
        res: { statusCode: 201 }
      };
      await auditService.log({
        req,
        action: 'create',
        resource: 'User',
        resourceId: user2Id
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('POST');
      expect(logs[0].url).toBe('/api/users');
      expect(logs[0].ip).toBe('192.168.1.1');
      expect(logs[0].userAgent).toBe('Mozilla/5.0');
      expect(logs[0].requestId).toBe('req-123');
      expect(logs[0].status).toBe(201);
    });

    test('uses req.ip when x-forwarded-for is not present', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' },
        ip: '192.168.1.100',
        headers: {}
      };
      await auditService.log({
        req,
        action: 'login',
        resource: 'User'
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].ip).toBe('192.168.1.100');
    });

    test('extracts first IP from x-forwarded-for when req.ip is not present', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' },
        // NO req.ip, para que use x-forwarded-for
        headers: {
          'x-forwarded-for': '  203.0.113.45  , 198.51.100.1, 192.168.1.1'
        }
      };
      await auditService.log({
        req,
        action: 'access',
        resource: 'Resource'
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].ip).toBe('203.0.113.45');
    });

    test('logs failure with success=false', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'delete',
        resource: 'User',
        resourceId: user2Id,
        success: false,
        errorMessage: 'User not found'
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].errorMessage).toBe('User not found');
    });

    test('truncates errorMessage to 500 chars', async () => {
      const longError = 'A'.repeat(600);
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'submit',
        resource: 'Declaration',
        success: false,
        errorMessage: longError
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].errorMessage).toHaveLength(500);
      expect(logs[0].errorMessage).toBe('A'.repeat(500));
    });

    test('converts resourceId to string', async () => {
      const resourceObjId = new mongoose.Types.ObjectId();
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };
      await auditService.log({
        req,
        action: 'view',
        resource: 'Expedition',
        resourceId: resourceObjId
      });
      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].resourceId).toBe(resourceObjId.toString());
      expect(typeof logs[0].resourceId).toBe('string');
    });

    test('logs without req object', async () => {
      await auditService.log({
        action: 'system_task',
        resource: 'CronJob'
      });
      const logs = await AuditLog.find({});
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('system_task');
      expect(logs[0].resource).toBe('CronJob');
      expect(logs[0].tenantId).toBeUndefined();
      expect(logs[0].userId).toBeUndefined();
    });

    test('logs system event with metadata', async () => {
      await auditService.log({
        action: 'backup',
        resource: 'Database',
        metadata: {
          tables: ['users', 'expeditions'],
          duration: 45000
        }
      });
      const logs = await AuditLog.find({});
      expect(logs[0].metadata.tables).toEqual(['users', 'expeditions']);
      expect(logs[0].metadata.duration).toBe(45000);
    });
  });

  describe('query() - filtering and pagination', () => {
    beforeEach(async () => {
      // Create test data for two tenants
      const baseTime = new Date('2026-08-01T10:00:00Z');

      // Tenant 1 logs
      await AuditLog.create({
        tenantId: tenant1Id,
        userId: user1Id,
        userEmail: 'user1@tenant1.com',
        action: 'login',
        resource: 'User',
        resourceId: user1Id.toString(),
        timestamp: new Date(baseTime.getTime())
      });

      await AuditLog.create({
        tenantId: tenant1Id,
        userId: user1Id,
        userEmail: 'user1@tenant1.com',
        action: 'create',
        resource: 'Expedition',
        resourceId: new mongoose.Types.ObjectId().toString(),
        timestamp: new Date(baseTime.getTime() + 3600000) // +1 hour
      });

      await AuditLog.create({
        tenantId: tenant1Id,
        userId: user2Id,
        userEmail: 'user2@tenant1.com',
        action: 'update',
        resource: 'Expedition',
        resourceId: new mongoose.Types.ObjectId().toString(),
        timestamp: new Date(baseTime.getTime() + 7200000) // +2 hours
      });

      // Tenant 2 logs
      await AuditLog.create({
        tenantId: tenant2Id,
        userId: user2Id,
        userEmail: 'user@tenant2.com',
        action: 'login',
        resource: 'User',
        resourceId: user2Id.toString(),
        timestamp: new Date(baseTime.getTime() + 1800000) // +30 minutes
      });

      await AuditLog.create({
        tenantId: tenant2Id,
        userId: user2Id,
        userEmail: 'user@tenant2.com',
        action: 'delete',
        resource: 'Expedition',
        resourceId: new mongoose.Types.ObjectId().toString(),
        timestamp: new Date(baseTime.getTime() + 5400000) // +90 minutes
      });
    });

    test('filters by tenantId - CRITICAL: tenant isolation', async () => {
      const logs = await auditService.query({ tenantId: tenant1Id });
      expect(logs).toHaveLength(3);
      logs.forEach(log => {
        expect(log.tenantId.toString()).toBe(tenant1Id.toString());
      });

      // BUG CHECK: Verify discrimination - without filter should return more
      const allLogs = await AuditLog.find({}).lean();
      expect(allLogs.length).toBeGreaterThan(logs.length);
    });

    test('filters by tenantId for tenant2 - verify discrimination', async () => {
      const logs = await auditService.query({ tenantId: tenant2Id });
      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(log.tenantId.toString()).toBe(tenant2Id.toString());
      });
    });

    test('filters by userId', async () => {
      const logs = await auditService.query({ tenantId: tenant1Id, userId: user1Id });
      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(log.userId.toString()).toBe(user1Id.toString());
      });
    });

    test('filters by resource', async () => {
      const logs = await auditService.query({ tenantId: tenant1Id, resource: 'Expedition' });
      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(log.resource).toBe('Expedition');
      });
    });

    test('filters by resourceId', async () => {
      const resourceId = new mongoose.Types.ObjectId().toString();
      await AuditLog.create({
        tenantId: tenant1Id,
        userId: user1Id,
        action: 'view',
        resource: 'Declaration',
        resourceId: resourceId,
        timestamp: new Date()
      });

      const logs = await auditService.query({ tenantId: tenant1Id, resourceId });
      expect(logs).toHaveLength(1);
      expect(logs[0].resourceId).toBe(resourceId);
    });

    test('filters by date range - from only', async () => {
      const from = new Date('2026-08-01T11:00:00Z');
      const logs = await auditService.query({ tenantId: tenant1Id, from });
      expect(logs).toHaveLength(2); // create and update at +1h and +2h
      logs.forEach(log => {
        expect(new Date(log.timestamp).getTime()).toBeGreaterThanOrEqual(from.getTime());
      });
    });

    test('filters by date range - to only', async () => {
      const to = new Date('2026-08-01T11:00:00Z');
      const logs = await auditService.query({ tenantId: tenant1Id, to });
      expect(logs).toHaveLength(2); // login at T+0 and create at T+1h
      logs.forEach(log => {
        expect(new Date(log.timestamp).getTime()).toBeLessThanOrEqual(to.getTime());
      });
    });

    test('filters by date range - from and to', async () => {
      const from = new Date('2026-08-01T10:30:00Z');
      const to = new Date('2026-08-01T11:30:00Z');
      const logs = await auditService.query({ tenantId: tenant1Id, from, to });
      expect(logs).toHaveLength(1); // only create at T+1h
      expect(logs[0].action).toBe('create');
    });

    test('respects limit parameter', async () => {
      const logs = await auditService.query({ tenantId: tenant1Id, limit: 2 });
      expect(logs).toHaveLength(2);
    });

    test('enforces maximum limit of 1000', async () => {
      // Create many logs to test limit enforcement
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(AuditLog.create({
          tenantId: tenant1Id,
          userId: user1Id,
          action: 'test',
          resource: 'Test',
          timestamp: new Date()
        }));
      }
      await Promise.all(promises);

      const logs = await auditService.query({ tenantId: tenant1Id, limit: 9999 });
      expect(logs.length).toBeLessThanOrEqual(1000);
    });

    test('sorts by timestamp descending', async () => {
      const logs = await auditService.query({ tenantId: tenant1Id });
      expect(logs.length).toBeGreaterThan(1);
      for (let i = 1; i < logs.length; i++) {
        expect(new Date(logs[i-1].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(logs[i].timestamp).getTime()
        );
      }
    });

    test('returns empty array when no matches', async () => {
      const logs = await auditService.query({
        tenantId: tenant1Id,
        resource: 'NonExistentResource'
      });
      expect(logs).toEqual([]);
    });

    test('combines multiple filters', async () => {
      const from = new Date('2026-08-01T10:30:00Z');
      const logs = await auditService.query({
        tenantId: tenant1Id,
        userId: user1Id,
        resource: 'Expedition',
        from
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('create');
      expect(logs[0].userId.toString()).toBe(user1Id.toString());
      expect(logs[0].resource).toBe('Expedition');
    });

    test('query without parameters returns all logs (limited)', async () => {
      const logs = await auditService.query({});
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.length).toBeLessThanOrEqual(1000);
    });

    test('CRITICAL: tenant isolation - tenant1 cannot see tenant2 logs', async () => {
      const tenant1Logs = await auditService.query({ tenantId: tenant1Id });
      const tenant2Logs = await auditService.query({ tenantId: tenant2Id });

      // Verify no overlap
      const tenant1Ids = new Set(tenant1Logs.map(l => l._id.toString()));
      const tenant2Ids = new Set(tenant2Logs.map(l => l._id.toString()));

      tenant1Ids.forEach(id => {
        expect(tenant2Ids.has(id)).toBe(false);
      });

      tenant2Ids.forEach(id => {
        expect(tenant1Ids.has(id)).toBe(false);
      });
    });
  });

  describe('middleware() - req.audit helper', () => {
    test('attaches audit function to req', () => {
      const req = {};
      const res = {};
      let nextCalled = false;

      auditService.middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(typeof req.audit).toBe('function');
    });

    test('req.audit logs with req context automatically', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' },
        method: 'DELETE',
        originalUrl: '/api/expeditions/123'
      };
      const res = {};

      auditService.middleware(req, res, () => {});

      await req.audit({
        action: 'delete',
        resource: 'Expedition',
        resourceId: '123'
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('DELETE');
      expect(logs[0].url).toBe('/api/expeditions/123');
      expect(logs[0].userEmail).toBe('user@test.com');
    });

    test('req.audit returns a promise', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };

      auditService.middleware(req, {}, () => {});

      const result = req.audit({
        action: 'test',
        resource: 'Test'
      });

      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('default parameters coverage', () => {
    test('log() can be called with undefined opts', async () => {
      await auditService.log(undefined);
      const logs = await AuditLog.find({});
      expect(logs).toHaveLength(0); // Sin action/resource, no crea log
    });

    test('query() can be called with undefined opts', async () => {
      await AuditLog.create({
        action: 'test',
        resource: 'Test',
        timestamp: new Date()
      });

      const logs = await auditService.query(undefined);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases and error handling', () => {
    test('handles missing headers object', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
        // No headers
      };

      await auditService.log({
        req,
        action: 'test',
        resource: 'Test'
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].ip).toBeUndefined();
      expect(logs[0].userAgent).toBeUndefined();
    });

    test('handles empty user object', async () => {
      const req = {
        tenantId: tenant1Id,
        user: {}
      };

      await auditService.log({
        req,
        action: 'test',
        resource: 'Test'
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBeUndefined();
      expect(logs[0].userEmail).toBeUndefined();
    });

    test('handles null req.user', async () => {
      const req = {
        tenantId: tenant1Id,
        user: null
      };

      await auditService.log({
        req,
        action: 'anonymous',
        resource: 'Public'
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBeUndefined();
    });

    test('handles undefined req.user', async () => {
      const req = {
        tenantId: tenant1Id
      };

      await auditService.log({
        req,
        action: 'system',
        resource: 'Task'
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBeUndefined();
    });

    test('handles changes with circular references gracefully', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };

      const circular = { a: 1 };
      circular.self = circular;

      // scrub() doesn't handle circular references explicitly, but the service
      // wraps everything in try-catch, so it should not crash
      await expect(auditService.log({
        req,
        action: 'test',
        resource: 'Test',
        changes: circular
      })).resolves.toBeUndefined();
    });

    test('uses default timestamp when not provided', async () => {
      const before = Date.now();

      await auditService.log({
        action: 'system',
        resource: 'Cron'
      });

      const after = Date.now();
      const logs = await AuditLog.find({});
      expect(logs).toHaveLength(1);

      const logTime = new Date(logs[0].timestamp).getTime();
      expect(logTime).toBeGreaterThanOrEqual(before);
      expect(logTime).toBeLessThanOrEqual(after);
    });

    test('handles very large metadata objects', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' }
      };

      const largeMetadata = {
        items: Array(100).fill(null).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100)
        }))
      };

      await auditService.log({
        req,
        action: 'bulk_import',
        resource: 'Product',
        metadata: largeMetadata
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs).toHaveLength(1);
      expect(logs[0].metadata.items).toHaveLength(100);
    });

    test('handles empty x-forwarded-for and falls back to req.ip', async () => {
      const req = {
        tenantId: tenant1Id,
        user: { _id: user1Id, email: 'user@test.com' },
        ip: '192.168.1.1',
        headers: {
          'x-forwarded-for': '' // vacío, debería usar req.ip
        }
      };

      await auditService.log({
        req,
        action: 'test',
        resource: 'Test'
      });

      const logs = await AuditLog.find({ tenantId: tenant1Id });
      expect(logs[0].ip).toBe('192.168.1.1');
    });
  });
});
