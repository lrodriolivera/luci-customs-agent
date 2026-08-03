const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { TODOS: ROLES_VALIDOS, AGENT } = require('../constants/roles');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email no valido']
  },

  password: {
    type: String,
    required: false,
    minlength: [6, 'La contrasena debe tener al menos 6 caracteres'],
    select: false
  },

  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },

  givenName: { type: String, trim: true },
  familyName: { type: String, trim: true },
  apellido2: { type: String, trim: true },

  cognitoSub: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },

  // super_admin es rol de PLATAFORMA (cruza tenants); el resto son de TENANT.
  // Sin super_admin en el enum, superAdminOnly exigia un rol que nadie podia
  // tener y /api/v1/tenants quedaba inalcanzable. Ver src/constants/roles.js.
  role: {
    type: String,
    enum: ROLES_VALIDOS,
    default: AGENT
  },

  // Datos profesionales
  profile: {
    company: String,
    position: String,
    phone: String,
    eoriNumber: String, // Si es representante aduanero
    representativeNumber: String // Numero de registro AEAT
  },

  // Permisos especificos
  permissions: {
    canCreateExpeditions: { type: Boolean, default: true },
    canDeleteExpeditions: { type: Boolean, default: false },
    canApproveDeclarations: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canAccessReports: { type: Boolean, default: true },
    // Fase 6.1: Permisos AEAT Real
    canManageCertificates: { type: Boolean, default: false },
    canSignDeclarations: { type: Boolean, default: false },
    canUploadDocuments: { type: Boolean, default: true },
    canConfigureSystem: { type: Boolean, default: false }
  },

  // Notificaciones
  notifications: {
    emailOnNewExpedition: { type: Boolean, default: true },
    emailOnDocumentUploaded: { type: Boolean, default: true },
    emailOnDeclarationReady: { type: Boolean, default: true },
    emailOnChannelAssigned: { type: Boolean, default: true }
  },

  // Multi-tenancy
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  // Estado
  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: Date,

  // Reset password
  resetPasswordToken: String,
  resetPasswordExpires: Date

}, {
  timestamps: true
});

// Index
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, isActive: 1 });

// Hash password before save
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT
UserSchema.methods.generateAuthToken = function() {
  const jwtService = require('../utils/jwtService');
  return jwtService.sign({
    id: this._id,
    email: this.email,
    role: this.role,
    tenantId: this.tenantId ? String(this.tenantId) : undefined
  });
};

// Get public profile
UserSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    givenName: this.givenName,
    familyName: this.familyName,
    apellido2: this.apellido2,
    role: this.role,
    profile: this.profile,
    permissions: this.permissions,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

// Static: Find by credentials
UserSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email, isActive: true }).select('+password');
  if (!user) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  return user;
};

// Soft-delete plugin (adds deletedAt/deletedBy + auto-filter on find)
require('../utils/softDelete')(UserSchema);

module.exports = mongoose.model('User', UserSchema);
