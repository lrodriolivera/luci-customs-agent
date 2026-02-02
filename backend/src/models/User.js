const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    required: [true, 'La contrasena es obligatoria'],
    minlength: [6, 'La contrasena debe tener al menos 6 caracteres'],
    select: false
  },

  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },

  role: {
    type: String,
    enum: ['admin', 'supervisor', 'agent', 'viewer'],
    default: 'agent'
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
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Get public profile
UserSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
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

module.exports = mongoose.model('User', UserSchema);
