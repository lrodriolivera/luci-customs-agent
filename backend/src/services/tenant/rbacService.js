/**
 * RBAC Service (Role-Based Access Control)
 * Phase 6.3: Multi-Tenancy Support
 *
 * Advanced roles and permissions management
 */

const logger = require('../../config/logger');

/**
 * Resource types
 */
const RESOURCES = {
  TENANT: 'tenant',
  USER: 'user',
  EXPEDITION: 'expedition',
  DECLARATION: 'declaration',
  DOCUMENT: 'document',
  CERTIFICATE: 'certificate',
  GUARANTEE: 'guarantee',
  REQUIREMENT: 'requirement',
  INSPECTION: 'inspection',
  COMMUNICATION: 'communication',
  TRANSIT: 'transit',
  REPORT: 'report',
  SETTINGS: 'settings',
  BILLING: 'billing',
  API_KEY: 'api_key',
  WEBHOOK: 'webhook'
};

/**
 * Actions
 */
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  SUBMIT: 'submit',
  EXPORT: 'export',
  IMPORT: 'import',
  SIGN: 'sign',
  MANAGE: 'manage',
  ADMIN: 'admin'
};

/**
 * Built-in roles with permissions
 */
const BUILT_IN_ROLES = {
  // Super admin - full access
  super_admin: {
    id: 'super_admin',
    name: 'Super Administrador',
    description: 'Acceso completo al sistema',
    isBuiltIn: true,
    permissions: ['*:*'], // All resources, all actions
    priority: 100
  },

  // Tenant admin - full access within tenant
  tenant_admin: {
    id: 'tenant_admin',
    name: 'Administrador',
    description: 'Administrador de la organizacion',
    isBuiltIn: true,
    permissions: [
      'user:*',
      'expedition:*',
      'declaration:*',
      'document:*',
      'certificate:*',
      'guarantee:*',
      'requirement:*',
      'inspection:*',
      'communication:*',
      'transit:*',
      'report:*',
      'settings:*',
      'billing:read',
      'api_key:*',
      'webhook:*'
    ],
    priority: 90
  },

  // Manager - can manage most operations
  manager: {
    id: 'manager',
    name: 'Gestor',
    description: 'Gestor de operaciones aduaneras',
    isBuiltIn: true,
    permissions: [
      'user:read',
      'expedition:*',
      'declaration:*',
      'document:*',
      'certificate:read',
      'guarantee:*',
      'requirement:*',
      'inspection:*',
      'communication:*',
      'transit:*',
      'report:read,create,export',
      'settings:read'
    ],
    priority: 70
  },

  // Agent - standard customs agent
  agent: {
    id: 'agent',
    name: 'Agente Aduanero',
    description: 'Agente de aduanas estandar',
    isBuiltIn: true,
    permissions: [
      'expedition:read,create,update',
      'declaration:read,create,update,submit',
      'document:read,create,update',
      'certificate:read',
      'guarantee:read',
      'requirement:read,update',
      'inspection:read,update',
      'communication:read,create',
      'transit:read,create,update',
      'report:read'
    ],
    priority: 50
  },

  // Operator - limited operational access
  operator: {
    id: 'operator',
    name: 'Operador',
    description: 'Operador con acceso limitado',
    isBuiltIn: true,
    permissions: [
      'expedition:read,update',
      'declaration:read,update',
      'document:read,create',
      'requirement:read',
      'inspection:read',
      'communication:read'
    ],
    priority: 30
  },

  // Viewer - read-only access
  viewer: {
    id: 'viewer',
    name: 'Visualizador',
    description: 'Solo lectura',
    isBuiltIn: true,
    permissions: [
      'expedition:read',
      'declaration:read',
      'document:read',
      'guarantee:read',
      'requirement:read',
      'inspection:read',
      'communication:read',
      'report:read'
    ],
    priority: 10
  },

  // Client portal - external client access
  client: {
    id: 'client',
    name: 'Cliente',
    description: 'Acceso portal cliente',
    isBuiltIn: true,
    permissions: [
      'expedition:read:own',
      'declaration:read:own',
      'document:read:own,create:own',
      'communication:read:own,create:own'
    ],
    priority: 5
  }
};

/**
 * In-memory storage for custom roles
 */
let customRoles = new Map(); // tenantId -> Map<roleId, role>
let userRoles = new Map(); // `${tenantId}:${userId}` -> [roleIds]

/**
 * Get all built-in roles
 */
function getBuiltInRoles() {
  return Object.values(BUILT_IN_ROLES);
}

/**
 * Get role by ID
 */
function getRole(roleId, tenantId = null) {
  // Check built-in roles first
  if (BUILT_IN_ROLES[roleId]) {
    return { success: true, role: BUILT_IN_ROLES[roleId] };
  }

  // Check custom roles
  if (tenantId) {
    const tenantRoles = customRoles.get(tenantId);
    if (tenantRoles?.has(roleId)) {
      return { success: true, role: tenantRoles.get(roleId) };
    }
  }

  return { success: false, error: 'Role not found' };
}

/**
 * List all roles for a tenant
 */
function listRoles(tenantId) {
  const roles = [...Object.values(BUILT_IN_ROLES)];

  // Add tenant's custom roles
  const tenantRoles = customRoles.get(tenantId);
  if (tenantRoles) {
    roles.push(...tenantRoles.values());
  }

  // Sort by priority
  roles.sort((a, b) => b.priority - a.priority);

  return {
    success: true,
    roles,
    builtInCount: Object.keys(BUILT_IN_ROLES).length,
    customCount: tenantRoles?.size || 0
  };
}

/**
 * Create custom role
 */
function createRole(tenantId, roleData) {
  try {
    const roleId = roleData.id || `role-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Can't override built-in roles
    if (BUILT_IN_ROLES[roleId]) {
      return { success: false, error: 'Cannot override built-in role' };
    }

    const role = {
      id: roleId,
      name: roleData.name,
      description: roleData.description || '',
      isBuiltIn: false,
      permissions: roleData.permissions || [],
      priority: roleData.priority || 40,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!customRoles.has(tenantId)) {
      customRoles.set(tenantId, new Map());
    }
    customRoles.get(tenantId).set(roleId, role);

    logger.info(`[RBAC] Created custom role: ${roleId} for tenant ${tenantId}`);

    return { success: true, role };

  } catch (error) {
    logger.error(`[RBAC] Error creating role: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Update custom role
 */
function updateRole(tenantId, roleId, updates) {
  // Can't update built-in roles
  if (BUILT_IN_ROLES[roleId]) {
    return { success: false, error: 'Cannot update built-in role' };
  }

  const tenantRoles = customRoles.get(tenantId);
  if (!tenantRoles?.has(roleId)) {
    return { success: false, error: 'Role not found' };
  }

  const role = tenantRoles.get(roleId);
  const updatedRole = {
    ...role,
    ...updates,
    id: roleId, // Prevent ID change
    isBuiltIn: false,
    tenantId,
    updatedAt: new Date()
  };

  tenantRoles.set(roleId, updatedRole);

  logger.info(`[RBAC] Updated role: ${roleId}`);

  return { success: true, role: updatedRole };
}

/**
 * Delete custom role
 */
function deleteRole(tenantId, roleId) {
  // Can't delete built-in roles
  if (BUILT_IN_ROLES[roleId]) {
    return { success: false, error: 'Cannot delete built-in role' };
  }

  const tenantRoles = customRoles.get(tenantId);
  if (!tenantRoles?.has(roleId)) {
    return { success: false, error: 'Role not found' };
  }

  tenantRoles.delete(roleId);

  // Remove role from all users
  for (const [key, roles] of userRoles.entries()) {
    if (key.startsWith(`${tenantId}:`)) {
      const filtered = roles.filter(r => r !== roleId);
      userRoles.set(key, filtered);
    }
  }

  logger.info(`[RBAC] Deleted role: ${roleId}`);

  return { success: true };
}

/**
 * Assign role to user
 */
function assignRole(tenantId, userId, roleId) {
  const roleResult = getRole(roleId, tenantId);
  if (!roleResult.success) {
    return { success: false, error: 'Role not found' };
  }

  const key = `${tenantId}:${userId}`;
  const currentRoles = userRoles.get(key) || [];

  if (!currentRoles.includes(roleId)) {
    currentRoles.push(roleId);
    userRoles.set(key, currentRoles);
  }

  logger.info(`[RBAC] Assigned role ${roleId} to user ${userId}`);

  return { success: true, roles: currentRoles };
}

/**
 * Remove role from user
 */
function removeRole(tenantId, userId, roleId) {
  const key = `${tenantId}:${userId}`;
  const currentRoles = userRoles.get(key) || [];

  const filtered = currentRoles.filter(r => r !== roleId);
  userRoles.set(key, filtered);

  logger.info(`[RBAC] Removed role ${roleId} from user ${userId}`);

  return { success: true, roles: filtered };
}

/**
 * Get user's roles
 */
function getUserRoles(tenantId, userId) {
  const key = `${tenantId}:${userId}`;
  const roleIds = userRoles.get(key) || ['agent']; // Default to agent role

  const roles = roleIds.map(id => {
    const result = getRole(id, tenantId);
    return result.success ? result.role : null;
  }).filter(Boolean);

  return { success: true, roles };
}

/**
 * Set user's roles (replace all)
 */
function setUserRoles(tenantId, userId, roleIds) {
  // Validate all roles exist
  for (const roleId of roleIds) {
    const result = getRole(roleId, tenantId);
    if (!result.success) {
      return { success: false, error: `Role not found: ${roleId}` };
    }
  }

  const key = `${tenantId}:${userId}`;
  userRoles.set(key, [...roleIds]);

  logger.info(`[RBAC] Set roles for user ${userId}: ${roleIds.join(', ')}`);

  return { success: true, roles: roleIds };
}

/**
 * Get user's effective permissions
 */
function getUserPermissions(tenantId, userId) {
  const rolesResult = getUserRoles(tenantId, userId);
  if (!rolesResult.success) {
    return { success: false, error: rolesResult.error };
  }

  const permissions = new Set();

  for (const role of rolesResult.roles) {
    for (const permission of role.permissions) {
      permissions.add(permission);
    }
  }

  return {
    success: true,
    permissions: Array.from(permissions),
    roles: rolesResult.roles.map(r => r.id)
  };
}

/**
 * Check if user has permission
 * Permission format: "resource:action" or "resource:action:scope"
 */
function hasPermission(tenantId, userId, resource, action, scope = null) {
  const permissionsResult = getUserPermissions(tenantId, userId);
  if (!permissionsResult.success) {
    return false;
  }

  const permissions = permissionsResult.permissions;

  // Check for wildcard permissions
  if (permissions.includes('*:*')) return true;
  if (permissions.includes(`${resource}:*`)) return true;
  if (permissions.includes(`*:${action}`)) return true;

  // Check specific permission
  const fullPermission = scope
    ? `${resource}:${action}:${scope}`
    : `${resource}:${action}`;

  if (permissions.includes(fullPermission)) return true;

  // Check if permission includes this action in a comma-separated list
  for (const perm of permissions) {
    const [permResource, permActions, permScope] = perm.split(':');

    if (permResource !== resource && permResource !== '*') continue;
    if (permScope && scope && permScope !== scope) continue;

    const actionList = permActions.split(',');
    if (actionList.includes(action) || actionList.includes('*')) {
      return true;
    }
  }

  return false;
}

/**
 * Check multiple permissions (all must pass)
 */
function hasAllPermissions(tenantId, userId, checks) {
  for (const { resource, action, scope } of checks) {
    if (!hasPermission(tenantId, userId, resource, action, scope)) {
      return false;
    }
  }
  return true;
}

/**
 * Check multiple permissions (at least one must pass)
 */
function hasAnyPermission(tenantId, userId, checks) {
  for (const { resource, action, scope } of checks) {
    if (hasPermission(tenantId, userId, resource, action, scope)) {
      return true;
    }
  }
  return false;
}

/**
 * Get resources that user can access
 */
function getAccessibleResources(tenantId, userId, action = 'read') {
  const permissionsResult = getUserPermissions(tenantId, userId);
  if (!permissionsResult.success) {
    return { success: false, error: permissionsResult.error };
  }

  const accessible = [];

  for (const resource of Object.values(RESOURCES)) {
    if (hasPermission(tenantId, userId, resource, action)) {
      accessible.push(resource);
    }
  }

  return { success: true, resources: accessible };
}

/**
 * Validate permission string format
 */
function validatePermission(permission) {
  const parts = permission.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return { valid: false, error: 'Invalid permission format' };
  }

  const [resource, actions, scope] = parts;

  // Check resource
  if (resource !== '*' && !Object.values(RESOURCES).includes(resource)) {
    return { valid: false, error: `Invalid resource: ${resource}` };
  }

  // Check actions
  const actionList = actions.split(',');
  for (const action of actionList) {
    if (action !== '*' && !Object.values(ACTIONS).includes(action)) {
      return { valid: false, error: `Invalid action: ${action}` };
    }
  }

  // Scope is optional and can be any string (e.g., "own")
  return { valid: true };
}

/**
 * Get permission info
 */
function getPermissionInfo() {
  return {
    resources: RESOURCES,
    actions: ACTIONS,
    format: 'resource:action or resource:action1,action2 or resource:action:scope'
  };
}

/**
 * Clone a role
 */
function cloneRole(tenantId, sourceRoleId, newRoleData) {
  const sourceResult = getRole(sourceRoleId, tenantId);
  if (!sourceResult.success) {
    return { success: false, error: 'Source role not found' };
  }

  return createRole(tenantId, {
    ...newRoleData,
    permissions: [...sourceResult.role.permissions],
    priority: newRoleData.priority || sourceResult.role.priority - 1
  });
}

module.exports = {
  // Constants
  RESOURCES,
  ACTIONS,
  BUILT_IN_ROLES,

  // Role management
  getBuiltInRoles,
  getRole,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  cloneRole,

  // User role assignment
  assignRole,
  removeRole,
  getUserRoles,
  setUserRoles,

  // Permission checks
  getUserPermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getAccessibleResources,

  // Utilities
  validatePermission,
  getPermissionInfo
};
