const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./config/logger');

// Import routes
let authRoutes, expeditionRoutes, documentRoutes, declarationRoutes;
let portalRoutes, chatRoutes, classificationRoutes, calculationRoutes;
let requirementRoutes, channelRoutes, paraduaneroRoutes, h7Routes, guaranteeRoutes;
let specialRegimeRoutes, dashboardRoutes, transitRoutes, rulesEngineRoutes, exciseDutiesRoutes, quotaRoutes, preferencesRoutes, oeaRoutes;
let deadlineRoutes, inspectionRoutes, communicationRoutes, integrationRoutes;
let aeatRealRoutes, analyticsRoutes, tenantRoutes, mlRoutes, workflowRoutes;
let publicApiRoutes, paymentRoutes, regulationRoutes, adminRoutes;
let ensRoutes, queryRoutes, pueRoutes;

try {
  authRoutes = require('./routes/auth');
  expeditionRoutes = require('./routes/expeditions');
  documentRoutes = require('./routes/documents');
  declarationRoutes = require('./routes/declarations');
  try { portalRoutes = require('./routes/portal'); } catch(e) { console.error('Portal routes not loaded (stripe?):', e.message); }
  chatRoutes = require('./routes/chat');
  classificationRoutes = require('./routes/classification');
  calculationRoutes = require('./routes/calculation');
  requirementRoutes = require('./routes/requirements');
  channelRoutes = require('./routes/channels');
  paraduaneroRoutes = require('./routes/paraduanero');
  h7Routes = require('./routes/h7');
  guaranteeRoutes = require('./routes/guarantees');
  specialRegimeRoutes = require('./routes/specialRegimes');
  dashboardRoutes = require('./routes/dashboard');
  transitRoutes = require('./routes/transit');
  rulesEngineRoutes = require('./routes/rulesEngine');
  exciseDutiesRoutes = require('./routes/exciseDuties');
  quotaRoutes = require('./routes/quotas');
  preferencesRoutes = require('./routes/preferences');
  oeaRoutes = require('./routes/oea');
  deadlineRoutes = require('./routes/deadlines');
  inspectionRoutes = require('./routes/inspections');
  communicationRoutes = require('./routes/communications');
  integrationRoutes = require('./routes/integrations');
  aeatRealRoutes = require('./routes/aeatReal');
  analyticsRoutes = require('./routes/analytics');
  tenantRoutes = require('./routes/tenant');
  mlRoutes = require('./routes/ml');
  workflowRoutes = require('./routes/workflows');
  publicApiRoutes = require('./routes/publicApi');
  paymentRoutes = require('./routes/payments');
  regulationRoutes = require('./routes/regulations');
  adminRoutes = require('./routes/admin');
  ensRoutes = require('./routes/ens');
  queryRoutes = require('./routes/queries');
  pueRoutes = require('./routes/pue');
} catch (err) {
  console.error('Error loading routes:', err.message);
}

const app = express();

// Trust proxy (needed for rate limiter behind Nginx)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  'https://aduanas.strixai.es',
  'http://aduanas.strixai.es',
  process.env.FRONTEND_URL,
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Slug']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: { error: 'Demasiadas solicitudes, por favor intente mas tarde' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'LUCI Customs Agent',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
if (authRoutes) app.use('/api/auth', authRoutes);
if (expeditionRoutes) app.use('/api/expeditions', expeditionRoutes);
if (documentRoutes) app.use('/api/documents', documentRoutes);
if (declarationRoutes) app.use('/api/declarations', declarationRoutes);
if (portalRoutes) app.use('/api/portal', portalRoutes);
if (chatRoutes) app.use('/api/chat', chatRoutes);
if (classificationRoutes) app.use('/api/classification', classificationRoutes);
if (calculationRoutes) app.use('/api/calculation', calculationRoutes);
if (requirementRoutes) app.use('/api/requirements', requirementRoutes);
if (channelRoutes) app.use('/api/channels', channelRoutes);
if (paraduaneroRoutes) app.use('/api/paraduanero', paraduaneroRoutes);
if (h7Routes) app.use('/api/h7', h7Routes);
if (guaranteeRoutes) app.use('/api/guarantees', guaranteeRoutes);
if (specialRegimeRoutes) app.use('/api/special-regimes', specialRegimeRoutes);
if (dashboardRoutes) app.use('/api/dashboard', dashboardRoutes);
if (transitRoutes) app.use('/api/transit', transitRoutes);
if (rulesEngineRoutes) app.use('/api/rules', rulesEngineRoutes);
if (exciseDutiesRoutes) app.use('/api/excise', exciseDutiesRoutes);
if (quotaRoutes) app.use('/api/quotas', quotaRoutes);
if (preferencesRoutes) app.use('/api/preferences', preferencesRoutes);
if (oeaRoutes) app.use('/api/oea', oeaRoutes);
if (deadlineRoutes) app.use('/api/deadlines', deadlineRoutes);
if (inspectionRoutes) app.use('/api/inspections', inspectionRoutes);
if (communicationRoutes) app.use('/api/communications', communicationRoutes);
if (integrationRoutes) app.use('/api/integrations', integrationRoutes);
if (aeatRealRoutes) app.use('/api/aeat-real', aeatRealRoutes);
if (analyticsRoutes) app.use('/api/analytics', analyticsRoutes);
if (tenantRoutes) app.use('/api', tenantRoutes);
if (mlRoutes) app.use('/api/ml', mlRoutes);
if (workflowRoutes) app.use('/api/workflows', workflowRoutes);
if (publicApiRoutes) app.use('/api/v1', publicApiRoutes);
if (paymentRoutes) app.use('/api/payments', paymentRoutes);
if (regulationRoutes) app.use('/api/regulations', regulationRoutes);
if (adminRoutes) app.use('/api/admin', adminRoutes);
if (ensRoutes) app.use('/api/ens', ensRoutes);
if (queryRoutes) app.use('/api/queries', queryRoutes);
if (pueRoutes) app.use('/api/pue', pueRoutes);

// Initialize workflow service
const workflowService = require('./services/workflow');
workflowService.initialize().catch(err => {
  logger.error('Failed to initialize workflow service:', err);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  logger.info(`LUCI Customs Agent running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
