/**
 * Tests for Tenant Service
 * Phase 6.3: Multi-Tenancy Support Tests
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const tenantService = require('../../../src/services/tenant/tenantService');

describe('Tenant Service', () => {
  let testTenantId;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    test('should define TENANT_STATUS', () => {
      expect(tenantService.TENANT_STATUS).toBeDefined();
      expect(tenantService.TENANT_STATUS.ACTIVE).toBe('active');
      expect(tenantService.TENANT_STATUS.SUSPENDED).toBe('suspended');
      expect(tenantService.TENANT_STATUS.CANCELLED).toBe('cancelled');
    });

    test('should define PLAN_TYPES', () => {
      expect(tenantService.PLAN_TYPES).toBeDefined();
      expect(tenantService.PLAN_TYPES.FREE).toBe('free');
      expect(tenantService.PLAN_TYPES.STARTER).toBe('starter');
      expect(tenantService.PLAN_TYPES.PROFESSIONAL).toBe('professional');
      expect(tenantService.PLAN_TYPES.ENTERPRISE).toBe('enterprise');
    });

    test('should define PLAN_LIMITS', () => {
      expect(tenantService.PLAN_LIMITS).toBeDefined();
      expect(tenantService.PLAN_LIMITS.free).toBeDefined();
      expect(tenantService.PLAN_LIMITS.enterprise).toBeDefined();
    });
  });

  describe('createTenant', () => {
    test('should create a new tenant', async () => {
      const result = await tenantService.createTenant({
        name: 'Test Company',
        businessType: 'customs_agent',
        nif: 'B12345678',
        eori: 'ES12345678901234',
        contactName: 'John Doe',
        contactEmail: 'john@test.com'
      });

      expect(result.success).toBe(true);
      expect(result.tenant).toBeDefined();
      expect(result.tenant.name).toBe('Test Company');
      expect(result.tenant.slug).toBeDefined();
      expect(result.tenant.status).toBe('pending');
      testTenantId = result.tenant.id;
    });

    test('should generate unique slug', async () => {
      const result1 = await tenantService.createTenant({
        name: 'Unique Company',
        contactName: 'Test',
        contactEmail: 'test@test.com'
      });

      // Second tenant should get error because slug already exists
      const result2 = await tenantService.createTenant({
        name: 'Unique Company 2',
        slug: 'unique-company-2',
        contactName: 'Test2',
        contactEmail: 'test2@test.com'
      });

      expect(result1.tenant.slug).not.toBe(result2.tenant.slug);
    });

    test('should return error for duplicate slug', async () => {
      await tenantService.createTenant({
        name: 'Duplicate Slug Test',
        slug: 'duplicate-slug'
      });

      const result = await tenantService.createTenant({
        name: 'Another Company',
        slug: 'duplicate-slug'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Slug already exists');
    });
  });

  describe('getTenant', () => {
    test('should get tenant by ID', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Get Test'
      });

      const result = tenantService.getTenant(createResult.tenant.id);

      expect(result.success).toBe(true);
      expect(result.tenant.name).toBe('Get Test');
    });

    test('should return error for non-existent tenant', () => {
      const result = tenantService.getTenant('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');
    });
  });

  describe('getTenantBySlug', () => {
    test('should get tenant by slug', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Slug Test Company',
        slug: 'slug-test-company'
      });

      const result = tenantService.getTenantBySlug(createResult.tenant.slug);

      expect(result.success).toBe(true);
      expect(result.tenant.name).toBe('Slug Test Company');
    });
  });

  describe('listTenants', () => {
    test('should list all tenants', () => {
      const result = tenantService.listTenants();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.tenants)).toBe(true);
    });

    test('should support pagination', () => {
      const result = tenantService.listTenants({ page: 1, limit: 5 });

      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
    });

    test('should filter by status', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Active Filter Test'
      });
      await tenantService.activateTenant(createResult.tenant.id);

      const result = tenantService.listTenants({ status: 'active' });

      expect(result.success).toBe(true);
      result.tenants.forEach(tenant => {
        expect(tenant.status).toBe('active');
      });
    });
  });

  describe('updateTenant', () => {
    test('should update tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Update Test'
      });

      const result = await tenantService.updateTenant(createResult.tenant.id, {
        name: 'Updated Name'
      });

      expect(result.success).toBe(true);
      expect(result.tenant.name).toBe('Updated Name');
    });

    test('should return error for non-existent tenant', async () => {
      const result = await tenantService.updateTenant('non-existent', { name: 'Test' });

      expect(result.success).toBe(false);
    });
  });

  describe('activateTenant', () => {
    test('should activate tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Activate Test'
      });

      const result = await tenantService.activateTenant(createResult.tenant.id);

      expect(result.success).toBe(true);
      expect(result.tenant.status).toBe('active');
      expect(result.tenant.activatedAt).toBeDefined();
    });
  });

  describe('suspendTenant', () => {
    test('should suspend tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Suspend Test'
      });
      await tenantService.activateTenant(createResult.tenant.id);

      const result = await tenantService.suspendTenant(createResult.tenant.id, 'Payment issues');

      expect(result.success).toBe(true);
      expect(result.tenant.status).toBe('suspended');
      expect(result.tenant.suspendedAt).toBeDefined();
    });
  });

  describe('cancelTenant', () => {
    test('should cancel tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Cancel Test'
      });

      const result = await tenantService.cancelTenant(createResult.tenant.id, 'User requested');

      expect(result.success).toBe(true);
      expect(result.tenant.status).toBe('cancelled');
      expect(result.tenant.cancelledAt).toBeDefined();
    });
  });

  describe('isActive', () => {
    test('should return true for active tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'IsActive Test'
      });
      await tenantService.activateTenant(createResult.tenant.id);

      const result = tenantService.isActive(createResult.tenant.id);

      expect(result).toBe(true);
    });

    test('should return false for suspended tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Suspended Test'
      });
      await tenantService.activateTenant(createResult.tenant.id);
      await tenantService.suspendTenant(createResult.tenant.id);

      const result = tenantService.isActive(createResult.tenant.id);

      expect(result).toBe(false);
    });
  });

  describe('changePlan', () => {
    test('should change tenant plan', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Plan Test'
      });

      const result = await tenantService.changePlan(createResult.tenant.id, 'professional');

      expect(result.success).toBe(true);
      expect(result.tenant.subscription.plan).toBe('professional');
      expect(result.tenant.limits).toBeDefined();
    });

    test('should return error for invalid plan', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Invalid Plan Test'
      });

      const result = await tenantService.changePlan(createResult.tenant.id, 'invalid_plan');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plan');
    });
  });

  describe('getAvailablePlans', () => {
    test('should return available plans', () => {
      const result = tenantService.getAvailablePlans();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.find(p => p.id === 'free')).toBeDefined();
      expect(result.find(p => p.id === 'enterprise')).toBeDefined();
    });
  });

  describe('canUseFeature', () => {
    test('should check feature availability', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Feature Test'
      });
      await tenantService.changePlan(createResult.tenant.id, 'professional');

      const canUseAnalytics = tenantService.canUseFeature(createResult.tenant.id, 'analytics');
      const canUseSSO = tenantService.canUseFeature(createResult.tenant.id, 'sso');

      expect(canUseAnalytics).toBe(true);
      expect(canUseSSO).toBe(false);
    });
  });

  describe('hasReachedLimit', () => {
    test('should check limit status', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Limit Test'
      });

      const result = tenantService.hasReachedLimit(createResult.tenant.id, 'users');

      expect(typeof result).toBe('boolean');
    });
  });

  describe('incrementUsage', () => {
    test('should increment usage', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Usage Test'
      });

      const result = await tenantService.incrementUsage(createResult.tenant.id, 'declarations', 5);

      expect(result.success).toBe(true);
      expect(result.usage.declarations).toBe(5);
    });
  });

  describe('getUsageStats', () => {
    test('should return usage stats', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Usage Stats Test'
      });
      await tenantService.incrementUsage(createResult.tenant.id, 'declarations', 10);

      const result = tenantService.getUsageStats(createResult.tenant.id);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.currentUsage).toBeDefined();
      expect(result.data.limits).toBeDefined();
    });
  });

  describe('updateSettings', () => {
    test('should update tenant settings', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Settings Test'
      });

      const result = await tenantService.updateSettings(createResult.tenant.id, {
        branding: {
          primaryColor: '#FF0000'
        }
      });

      expect(result.success).toBe(true);
      expect(result.settings.branding.primaryColor).toBe('#FF0000');
    });
  });

  describe('deleteTenant', () => {
    test('should delete tenant', async () => {
      const createResult = await tenantService.createTenant({
        name: 'Delete Test'
      });

      const result = await tenantService.deleteTenant(createResult.tenant.id, true);

      expect(result.success).toBe(true);

      // Verify deletion
      const getResult = tenantService.getTenant(createResult.tenant.id);
      expect(getResult.success).toBe(false);
    });
  });
});
