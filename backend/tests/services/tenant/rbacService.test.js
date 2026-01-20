/**
 * Tests for RBAC Service
 * Phase 6.3: Multi-Tenancy Support Tests
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const rbacService = require('../../../src/services/tenant/rbacService');

describe('RBAC Service', () => {
  const testTenantId = 'test-tenant-1';
  const testUserId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    test('should define RESOURCES', () => {
      expect(rbacService.RESOURCES).toBeDefined();
      expect(rbacService.RESOURCES.DECLARATION).toBe('declaration');
      expect(rbacService.RESOURCES.EXPEDITION).toBe('expedition');
      expect(rbacService.RESOURCES.USER).toBe('user');
    });

    test('should define ACTIONS', () => {
      expect(rbacService.ACTIONS).toBeDefined();
      expect(rbacService.ACTIONS.CREATE).toBe('create');
      expect(rbacService.ACTIONS.READ).toBe('read');
      expect(rbacService.ACTIONS.UPDATE).toBe('update');
      expect(rbacService.ACTIONS.DELETE).toBe('delete');
    });

    test('should define BUILT_IN_ROLES', () => {
      expect(rbacService.BUILT_IN_ROLES).toBeDefined();
      expect(rbacService.BUILT_IN_ROLES.super_admin).toBeDefined();
      expect(rbacService.BUILT_IN_ROLES.tenant_admin).toBeDefined();
      expect(rbacService.BUILT_IN_ROLES.agent).toBeDefined();
    });
  });

  describe('getBuiltInRoles', () => {
    test('should return all built-in roles', () => {
      const roles = rbacService.getBuiltInRoles();

      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      expect(roles.find(r => r.id === 'super_admin')).toBeDefined();
    });
  });

  describe('getRole', () => {
    test('should get built-in role by ID', () => {
      const result = rbacService.getRole('agent');

      expect(result.success).toBe(true);
      expect(result.role.id).toBe('agent');
      expect(result.role.isBuiltIn).toBe(true);
    });

    test('should return error for non-existent role', () => {
      const result = rbacService.getRole('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Role not found');
    });
  });

  describe('listRoles', () => {
    test('should list all roles for tenant', () => {
      const result = rbacService.listRoles(testTenantId);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.roles)).toBe(true);
      expect(result.builtInCount).toBeGreaterThan(0);
    });
  });

  describe('createRole', () => {
    test('should create custom role', () => {
      const result = rbacService.createRole(testTenantId, {
        name: 'Custom Manager',
        description: 'Custom role with specific permissions',
        permissions: ['declaration:read', 'declaration:create', 'expedition:read']
      });

      expect(result.success).toBe(true);
      expect(result.role.name).toBe('Custom Manager');
      expect(result.role.isBuiltIn).toBe(false);
      expect(result.role.tenantId).toBe(testTenantId);
    });

    test('should not override built-in role', () => {
      const result = rbacService.createRole(testTenantId, {
        id: 'agent',
        name: 'Override Agent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('built-in');
    });
  });

  describe('updateRole', () => {
    test('should update custom role', () => {
      const createResult = rbacService.createRole(testTenantId, {
        name: 'Update Test Role',
        permissions: ['declaration:read']
      });

      const result = rbacService.updateRole(testTenantId, createResult.role.id, {
        name: 'Updated Role Name',
        permissions: ['declaration:read', 'declaration:update']
      });

      expect(result.success).toBe(true);
      expect(result.role.name).toBe('Updated Role Name');
    });

    test('should not update built-in role', () => {
      const result = rbacService.updateRole(testTenantId, 'agent', {
        name: 'Modified Agent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('built-in');
    });
  });

  describe('deleteRole', () => {
    test('should delete custom role', () => {
      const createResult = rbacService.createRole(testTenantId, {
        name: 'Delete Test Role'
      });

      const result = rbacService.deleteRole(testTenantId, createResult.role.id);

      expect(result.success).toBe(true);
    });

    test('should not delete built-in role', () => {
      const result = rbacService.deleteRole(testTenantId, 'agent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('built-in');
    });
  });

  describe('assignRole', () => {
    test('should assign role to user', () => {
      const result = rbacService.assignRole(testTenantId, testUserId, 'manager');

      expect(result.success).toBe(true);
      expect(result.roles).toContain('manager');
    });

    test('should not duplicate role assignment', () => {
      rbacService.assignRole(testTenantId, testUserId, 'manager');
      const result = rbacService.assignRole(testTenantId, testUserId, 'manager');

      const roleCount = result.roles.filter(r => r === 'manager').length;
      expect(roleCount).toBe(1);
    });

    test('should return error for non-existent role', () => {
      const result = rbacService.assignRole(testTenantId, testUserId, 'non-existent');

      expect(result.success).toBe(false);
    });
  });

  describe('removeRole', () => {
    test('should remove role from user', () => {
      rbacService.assignRole(testTenantId, 'remove-test-user', 'manager');
      rbacService.assignRole(testTenantId, 'remove-test-user', 'viewer');

      const result = rbacService.removeRole(testTenantId, 'remove-test-user', 'manager');

      expect(result.success).toBe(true);
      expect(result.roles).not.toContain('manager');
    });
  });

  describe('getUserRoles', () => {
    test('should get user roles', () => {
      rbacService.assignRole(testTenantId, 'get-roles-user', 'manager');

      const result = rbacService.getUserRoles(testTenantId, 'get-roles-user');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.roles)).toBe(true);
      expect(result.roles.find(r => r.id === 'manager')).toBeDefined();
    });

    test('should return default role for user without assigned roles', () => {
      const result = rbacService.getUserRoles(testTenantId, 'new-user-no-roles');

      expect(result.success).toBe(true);
      expect(result.roles.length).toBeGreaterThan(0);
    });
  });

  describe('setUserRoles', () => {
    test('should set user roles', () => {
      const result = rbacService.setUserRoles(testTenantId, 'set-roles-user', ['manager', 'viewer']);

      expect(result.success).toBe(true);
      expect(result.roles).toContain('manager');
      expect(result.roles).toContain('viewer');
    });

    test('should return error for invalid role', () => {
      const result = rbacService.setUserRoles(testTenantId, 'invalid-roles-user', ['non-existent']);

      expect(result.success).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    test('should get user permissions', () => {
      rbacService.setUserRoles(testTenantId, 'perms-user', ['agent']);

      const result = rbacService.getUserPermissions(testTenantId, 'perms-user');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(result.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('hasPermission', () => {
    test('should check permission - allowed', () => {
      rbacService.setUserRoles(testTenantId, 'has-perm-user', ['agent']);

      const result = rbacService.hasPermission(testTenantId, 'has-perm-user', 'declaration', 'read');

      expect(result).toBe(true);
    });

    test('should check permission - denied', () => {
      rbacService.setUserRoles(testTenantId, 'denied-perm-user', ['viewer']);

      const result = rbacService.hasPermission(testTenantId, 'denied-perm-user', 'declaration', 'delete');

      expect(result).toBe(false);
    });

    test('should allow all for super_admin', () => {
      rbacService.setUserRoles(testTenantId, 'super-admin-user', ['super_admin']);

      const result = rbacService.hasPermission(testTenantId, 'super-admin-user', 'anything', 'anything');

      expect(result).toBe(true);
    });

    test('should check wildcard permissions', () => {
      rbacService.setUserRoles(testTenantId, 'admin-user', ['tenant_admin']);

      const result = rbacService.hasPermission(testTenantId, 'admin-user', 'expedition', 'delete');

      expect(result).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    test('should check all permissions', () => {
      rbacService.setUserRoles(testTenantId, 'all-perms-user', ['agent']);

      const result = rbacService.hasAllPermissions(testTenantId, 'all-perms-user', [
        { resource: 'declaration', action: 'read' },
        { resource: 'declaration', action: 'create' }
      ]);

      expect(result).toBe(true);
    });

    test('should return false if any permission missing', () => {
      rbacService.setUserRoles(testTenantId, 'missing-perm-user', ['viewer']);

      const result = rbacService.hasAllPermissions(testTenantId, 'missing-perm-user', [
        { resource: 'declaration', action: 'read' },
        { resource: 'declaration', action: 'delete' }
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    test('should return true if any permission exists', () => {
      rbacService.setUserRoles(testTenantId, 'any-perm-user', ['viewer']);

      const result = rbacService.hasAnyPermission(testTenantId, 'any-perm-user', [
        { resource: 'declaration', action: 'delete' },
        { resource: 'declaration', action: 'read' }
      ]);

      expect(result).toBe(true);
    });

    test('should return false if no permission exists', () => {
      rbacService.setUserRoles(testTenantId, 'no-perm-user', ['viewer']);

      const result = rbacService.hasAnyPermission(testTenantId, 'no-perm-user', [
        { resource: 'declaration', action: 'delete' },
        { resource: 'user', action: 'create' }
      ]);

      expect(result).toBe(false);
    });
  });

  describe('getAccessibleResources', () => {
    test('should return accessible resources', () => {
      rbacService.setUserRoles(testTenantId, 'access-user', ['agent']);

      const result = rbacService.getAccessibleResources(testTenantId, 'access-user', 'read');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources.length).toBeGreaterThan(0);
    });
  });

  describe('validatePermission', () => {
    test('should validate valid permission', () => {
      const result = rbacService.validatePermission('declaration:read');

      expect(result.valid).toBe(true);
    });

    test('should validate permission with multiple actions', () => {
      const result = rbacService.validatePermission('declaration:read,create,update');

      expect(result.valid).toBe(true);
    });

    test('should validate permission with scope', () => {
      const result = rbacService.validatePermission('declaration:read:own');

      expect(result.valid).toBe(true);
    });

    test('should reject invalid format', () => {
      const result = rbacService.validatePermission('invalid');

      expect(result.valid).toBe(false);
    });

    test('should reject invalid resource', () => {
      const result = rbacService.validatePermission('invalid_resource:read');

      expect(result.valid).toBe(false);
    });
  });

  describe('getPermissionInfo', () => {
    test('should return permission info', () => {
      const result = rbacService.getPermissionInfo();

      expect(result.resources).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.format).toBeDefined();
    });
  });

  describe('cloneRole', () => {
    test('should clone role', () => {
      const result = rbacService.cloneRole(testTenantId, 'agent', {
        name: 'Custom Agent'
      });

      expect(result.success).toBe(true);
      expect(result.role.name).toBe('Custom Agent');
      expect(result.role.permissions.length).toBeGreaterThan(0);
    });

    test('should return error for non-existent source', () => {
      const result = rbacService.cloneRole(testTenantId, 'non-existent', {
        name: 'Clone Test'
      });

      expect(result.success).toBe(false);
    });
  });
});
