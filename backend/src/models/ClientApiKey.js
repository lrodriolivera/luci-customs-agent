/**
 * Client API Key Model
 * Phase 6.7: Portal Cliente Avanzado
 * Manages API keys for client ERP integrations
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const ApiKeySchema = new mongoose.Schema({
  // Organization/Client reference
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Key identification
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  // The actual key (hashed for security)
  keyHash: {
    type: String,
    required: true,
    unique: true
  },
  keyPrefix: {
    type: String,
    required: true
  },

  // Permissions and scope
  permissions: [{
    type: String,
    enum: [
      'expeditions:read',
      'expeditions:write',
      'expeditions:create',
      'documents:read',
      'documents:write',
      'declarations:read',
      'declarations:write',
      'payments:read',
      'payments:write',
      'stats:read'
    ]
  }],

  // Rate limiting
  rateLimit: {
    requestsPerMinute: { type: Number, default: 60 },
    requestsPerDay: { type: Number, default: 10000 }
  },

  // IP whitelist (optional)
  ipWhitelist: [String],

  // Usage tracking
  usage: {
    totalRequests: { type: Number, default: 0 },
    lastUsedAt: Date,
    lastUsedIp: String
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'revoked'],
    default: 'active'
  },

  // Expiration (optional)
  expiresAt: Date,

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revokedAt: Date,
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revokeReason: String

}, {
  timestamps: true
});

// Indexes
ApiKeySchema.index({ organizationId: 1, status: 1 });
ApiKeySchema.index({ keyPrefix: 1 });
ApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate a new API key
ApiKeySchema.statics.generateKey = function() {
  const key = `lca_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12);
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  return { key, prefix, hash };
};

// Find by key (for authentication)
ApiKeySchema.statics.findByKey = async function(key) {
  if (!key || !key.startsWith('lca_')) {
    return null;
  }

  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const apiKey = await this.findOne({
    keyHash: hash,
    status: 'active'
  }).populate('organizationId');

  if (!apiKey) {
    return null;
  }

  // Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    apiKey.status = 'inactive';
    await apiKey.save();
    return null;
  }

  return apiKey;
};

// Update usage stats
ApiKeySchema.methods.recordUsage = async function(ip) {
  this.usage.totalRequests += 1;
  this.usage.lastUsedAt = new Date();
  this.usage.lastUsedIp = ip;
  await this.save();
};

// Check if IP is allowed
ApiKeySchema.methods.isIpAllowed = function(ip) {
  if (!this.ipWhitelist || this.ipWhitelist.length === 0) {
    return true;
  }
  return this.ipWhitelist.includes(ip);
};

// Check permission
ApiKeySchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Revoke key
ApiKeySchema.methods.revoke = async function(userId, reason) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = userId;
  this.revokeReason = reason;
  await this.save();
};

// Virtual for masked key display
ApiKeySchema.virtual('maskedKey').get(function() {
  return `${this.keyPrefix}...`;
});

// Transform for API responses
ApiKeySchema.methods.toSafeJSON = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    keyPrefix: this.keyPrefix,
    permissions: this.permissions,
    rateLimit: this.rateLimit,
    ipWhitelist: this.ipWhitelist,
    status: this.status,
    expiresAt: this.expiresAt,
    usage: {
      totalRequests: this.usage.totalRequests,
      lastUsedAt: this.usage.lastUsedAt
    },
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('ClientApiKey', ApiKeySchema);
