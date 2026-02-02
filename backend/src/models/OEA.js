/**
 * OEA Model - Operador Economico Autorizado
 * Authorized Economic Operator certification management
 *
 * Types:
 * - OEAC: Customs Simplifications
 * - OEAS: Security and Safety
 * - OEAF: Full (OEAC + OEAS)
 *
 * Stock Logistic - LUCI Customs Agent
 */

const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: {
    type: String,
    enum: ['internal', 'external', 'aeat', 'renewal'],
    required: true
  },
  auditor: {
    name: String,
    organization: String,
    id: String
  },
  scope: [String], // Areas audited
  findings: [{
    severity: {
      type: String,
      enum: ['critical', 'major', 'minor', 'observation']
    },
    area: String,
    description: String,
    recommendation: String,
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'accepted'],
      default: 'open'
    },
    dueDate: Date,
    resolvedDate: Date,
    resolution: String
  }],
  result: {
    type: String,
    enum: ['passed', 'passed_with_conditions', 'failed', 'pending']
  },
  nextAuditDate: Date,
  report: {
    documentId: mongoose.Schema.Types.ObjectId,
    filename: String,
    uploadDate: Date
  },
  notes: String
}, { _id: true });

const benefitSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['guarantee', 'simplification', 'control', 'priority', 'mutual_recognition'],
    required: true
  },
  description: String,
  active: {
    type: Boolean,
    default: true
  },
  activatedDate: Date,
  conditions: [String],
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date
}, { _id: true });

const complianceRecordSchema = new mongoose.Schema({
  period: {
    year: { type: Number, required: true },
    quarter: { type: Number, min: 1, max: 4 }
  },
  metrics: {
    totalDeclarations: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 }, // Percentage
    correctionsRequired: { type: Number, default: 0 },
    lateSubmissions: { type: Number, default: 0 },
    customsInfractions: { type: Number, default: 0 },
    securityIncidents: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['compliant', 'warning', 'non_compliant'],
    default: 'compliant'
  },
  notes: String,
  reviewedBy: String,
  reviewedDate: Date
}, { _id: true });

const oeaSchema = new mongoose.Schema({
  // Organization identification
  organization: {
    name: { type: String, required: true },
    nif: { type: String, required: true, unique: true },
    eori: { type: String, required: true },
    address: {
      street: String,
      city: String,
      postalCode: String,
      province: String,
      country: { type: String, default: 'ES' }
    },
    contact: {
      name: String,
      position: String,
      email: String,
      phone: String
    },
    legalRepresentative: {
      name: String,
      nif: String,
      position: String
    }
  },

  // OEA Certification details
  certification: {
    type: {
      type: String,
      enum: ['OEAC', 'OEAS', 'OEAF'],
      required: true
    },
    number: { type: String, unique: true, sparse: true }, // OEA authorization number
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'suspended', 'revoked', 'expired', 'renewal_pending', 'reevaluation', 'incident'],
      default: 'pending'
    },
    applicationDate: Date,
    approvalDate: Date,
    effectiveDate: Date,
    expirationDate: Date, // Usually 5 years from approval
    lastRenewalDate: Date,
    issuingAuthority: {
      type: String,
      default: 'AEAT - Departamento de Aduanas e Impuestos Especiales'
    },
    responsibleOffice: String, // Delegacion/Administracion AEAT
    // Fields for reevaluation and incident tracking
    previousStatus: String, // To restore after reevaluation/incident resolution
    reevaluationStartDate: Date,
    reevaluationReason: String,
    reevaluationDeadline: Date
  },

  // Incidents tracking (incidencias de mantenimiento)
  incidents: [{
    type: {
      type: String,
      enum: ['compliance', 'security', 'documentation', 'operational', 'other'],
      required: true
    },
    description: String,
    severity: {
      type: String,
      enum: ['critical', 'major', 'minor'],
      default: 'minor'
    },
    reportedDate: Date,
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open'
    },
    resolvedDate: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolution: String,
    affectedAreas: [String],
    correctiveActions: String
  }],

  // Benefits and privileges
  benefits: [benefitSchema],

  // Guarantee reductions
  guaranteeReduction: {
    level: {
      type: String,
      enum: ['none', 'reduced_30', 'reduced_50', 'exempt_100'],
      default: 'none'
    },
    approvedDate: Date,
    conditions: [String],
    linkedGuarantees: [{
      guaranteeId: mongoose.Schema.Types.ObjectId,
      originalAmount: Number,
      reducedAmount: Number
    }]
  },

  // Simplifications granted
  simplifications: [{
    code: String,
    name: String,
    description: String,
    grantedDate: Date,
    conditions: [String],
    active: { type: Boolean, default: true }
  }],

  // Compliance history
  compliance: {
    currentStatus: {
      type: String,
      enum: ['excellent', 'good', 'acceptable', 'warning', 'critical'],
      default: 'good'
    },
    lastAssessmentDate: Date,
    nextAssessmentDate: Date,
    records: [complianceRecordSchema],
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    }
  },

  // Audit history
  audits: [auditSchema],

  // Requirements tracking
  requirements: {
    customsCompliance: {
      status: { type: String, enum: ['met', 'partial', 'not_met'], default: 'met' },
      lastVerified: Date,
      notes: String
    },
    recordKeeping: {
      status: { type: String, enum: ['met', 'partial', 'not_met'], default: 'met' },
      systemDescription: String,
      lastVerified: Date,
      notes: String
    },
    financialSolvency: {
      status: { type: String, enum: ['met', 'partial', 'not_met'], default: 'met' },
      lastVerified: Date,
      financialStatementDate: Date,
      notes: String
    },
    practicalCompetence: {
      status: { type: String, enum: ['met', 'partial', 'not_met'], default: 'met' },
      qualifiedStaff: [{
        name: String,
        position: String,
        certifications: [String]
      }],
      trainingProgram: Boolean,
      lastVerified: Date,
      notes: String
    },
    securityStandards: {
      // Only for OEAS and OEAF
      status: { type: String, enum: ['met', 'partial', 'not_met', 'not_applicable'], default: 'not_applicable' },
      securityPlan: Boolean,
      accessControl: Boolean,
      cargoSecurity: Boolean,
      personnelSecurity: Boolean,
      businessPartnerSecurity: Boolean,
      lastVerified: Date,
      notes: String
    }
  },

  // Mutual recognition
  mutualRecognition: [{
    country: String,
    countryCode: String,
    programName: String, // e.g., "C-TPAT" (USA), "AEO" (Japan)
    recognitionDate: Date,
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'expired']
    },
    benefits: [String]
  }],

  // Activity log
  activityLog: [{
    date: { type: Date, default: Date.now },
    action: String,
    description: String,
    performedBy: String,
    details: mongoose.Schema.Types.Mixed
  }],

  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['application', 'authorization', 'audit_report', 'compliance_certificate',
             'financial_statement', 'security_plan', 'training_record', 'other']
    },
    name: String,
    documentId: mongoose.Schema.Types.ObjectId,
    filename: String,
    uploadDate: Date,
    expirationDate: Date,
    notes: String
  }],

  // Alerts and notifications
  alerts: [{
    type: {
      type: String,
      enum: ['expiration', 'audit_due', 'compliance_issue', 'renewal_reminder',
             'document_expiry', 'finding_due', 'general']
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical']
    },
    message: String,
    dueDate: Date,
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: String,
    acknowledgedDate: Date,
    resolved: { type: Boolean, default: false },
    resolvedDate: Date
  }],

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String

}, {
  timestamps: true
});

// Indexes
oeaSchema.index({ 'organization.nif': 1 });
oeaSchema.index({ 'organization.eori': 1 });
oeaSchema.index({ 'certification.number': 1 });
oeaSchema.index({ 'certification.status': 1 });
oeaSchema.index({ 'certification.type': 1 });
oeaSchema.index({ 'certification.expirationDate': 1 });

// Virtual for days until expiration
oeaSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.certification.expirationDate) return null;
  const now = new Date();
  const expiration = new Date(this.certification.expirationDate);
  const diffTime = expiration - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for active status
oeaSchema.virtual('isActive').get(function() {
  return this.certification.status === 'approved' &&
         (!this.certification.expirationDate || new Date(this.certification.expirationDate) > new Date());
});

// Method to add activity log entry
oeaSchema.methods.addActivityLog = function(action, description, performedBy, details = {}) {
  this.activityLog.push({
    date: new Date(),
    action,
    description,
    performedBy,
    details
  });
  return this.save();
};

// Method to add alert
oeaSchema.methods.addAlert = function(type, severity, message, dueDate = null) {
  this.alerts.push({
    type,
    severity,
    message,
    dueDate,
    acknowledged: false,
    resolved: false
  });
  return this.save();
};

// Method to check compliance status
oeaSchema.methods.checkComplianceStatus = function() {
  const requirements = this.requirements;
  const statuses = [
    requirements.customsCompliance.status,
    requirements.recordKeeping.status,
    requirements.financialSolvency.status,
    requirements.practicalCompetence.status
  ];

  // Add security for OEAS/OEAF
  if (this.certification.type !== 'OEAC') {
    statuses.push(requirements.securityStandards.status);
  }

  const notMet = statuses.filter(s => s === 'not_met').length;
  const partial = statuses.filter(s => s === 'partial').length;

  if (notMet > 0) return 'critical';
  if (partial > 1) return 'warning';
  if (partial === 1) return 'acceptable';
  return 'excellent';
};

// Method to calculate guarantee reduction
oeaSchema.methods.getGuaranteeReductionPercentage = function() {
  switch (this.guaranteeReduction.level) {
    case 'reduced_30': return 30;
    case 'reduced_50': return 50;
    case 'exempt_100': return 100;
    default: return 0;
  }
};

// Static method to find expiring certifications
oeaSchema.statics.findExpiring = function(daysAhead = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    'certification.status': 'approved',
    'certification.expirationDate': {
      $lte: futureDate,
      $gte: new Date()
    }
  });
};

// Static method to find by EORI
oeaSchema.statics.findByEORI = function(eori) {
  return this.findOne({ 'organization.eori': eori });
};

// Pre-save middleware to update compliance status
oeaSchema.pre('save', function(next) {
  if (this.isModified('requirements')) {
    this.compliance.currentStatus = this.checkComplianceStatus();
    this.compliance.lastAssessmentDate = new Date();
  }
  next();
});

module.exports = mongoose.model('OEA', oeaSchema);
