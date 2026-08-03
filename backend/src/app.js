const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Sentry error tracking (initialize before everything else)
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    release: '1.0.0'
  });
}

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
let ensRoutes, queryRoutes, pueRoutes, certificateRoutes, manifestRoutes;
let auditRoutes, gdprRoutes, emailRoutes;

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
  certificateRoutes = require('./routes/certificates');
  try { manifestRoutes = require('./routes/manifest'); } catch(e) { console.error('Manifest routes not loaded:', e.message); }
  auditRoutes = require('./routes/audit');
  try { gdprRoutes = require('./routes/gdpr'); } catch(e) { console.error('GDPR routes not loaded:', e.message); }
  try { emailRoutes = require('./routes/email'); } catch(e) { console.error('Email routes not loaded:', e.message); }
} catch (err) {
  console.error('Error loading routes:', err.message);
}

const app = express();

// Trust proxy (needed for rate limiter behind Nginx)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security middleware - helmet with CSP tuned for LUCI (Stripe + Sentry + self)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'connect-src': ["'self'", 'https://api.stripe.com', 'https://*.sentry.io', 'https://*.ingest.sentry.io', 'wss:', 'https:'],
      'frame-src': ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      'font-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Compression (skip for already-compressed content)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024
}));

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

// Rate limiting - distributed via Redis when available, per-worker otherwise.
// Each limiter gets its own Store instance with a distinct prefix; sharing a
// single Store across limiters triggers ERR_ERL_DOUBLE_COUNT in v7.
let makeRateLimitStore = () => undefined;
if (process.env.CACHE_BACKEND === 'redis' || process.env.RATELIMIT_BACKEND === 'redis') {
  try {
    const { default: RedisStore } = require('rate-limit-redis');
    const { getRedisClient } = require('./services/cacheService');
    const client = getRedisClient();
    if (client) {
      makeRateLimitStore = (prefix) => new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix
      });
      logger.info('Rate limit: distributed (Redis)');
    }
  } catch (err) {
    logger.warn('rate-limit-redis not available, using in-memory store', { error: err.message });
  }
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  store: makeRateLimitStore('rl:general:'),
  message: { success: false, error: 'Demasiadas solicitudes, por favor intente mas tarde' },
  skip: (req) => req.path === '/api/health' ||
    /^\/api\/auth\/(login|register|forgot-password)$/.test(req.path)
});
app.use('/api/', limiter);

// Strict rate limiting for auth endpoints (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: makeRateLimitStore('rl:auth:'),
  message: { success: false, error: 'Demasiados intentos. Espere 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Stripe webhook (MUST come before express.json to preserve raw body for signature verification)
app.post('/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const paymentService = require('./services/paymentService');
      const result = await paymentService.handleWebhook(
        req.body,
        req.headers['stripe-signature']
      );
      res.json(result);
    } catch (error) {
      logger.error('Webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// Body parsing (AFTER webhook route)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Saneo de errores salientes: los controllers responden con error.message en
// 448 catch, que en produccion filtra CastError de Mongoose con el nombre del
// modelo, cadenas de conexion y rutas del servidor. Va antes que las rutas
// para envolver res.json.
const { sanitizeErrors } = require('./middleware/sanitizeErrors');
app.use(sanitizeErrors);

// Request metrics (request ID + latency + per-endpoint counters)
const { requestMetrics, snapshot: metricsSnapshot } = require('./middleware/metrics');
app.use(requestMetrics);

// Audit helper (req.audit())
const auditService = require('./services/auditService');
app.use(auditService.middleware);

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// OpenAPI docs (dev + admin)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const openapiSpec = require('./config/openapi');
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
      customSiteTitle: 'LUCI API Docs',
      customCss: '.swagger-ui .topbar { display: none }'
    }));
    app.get('/api/openapi.json', (req, res) => res.json(openapiSpec));
  } catch (e) {
    logger.warn('Swagger UI not available:', e.message);
  }
}

// Metrics snapshot (admin only) — prefixed /api so Nginx proxies it
app.get('/api/internal/metrics', async (req, res) => {
  try {
    const jwtService = require('./utils/jwtService');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' });
    const decoded = jwtService.verify(authHeader.split(' ')[1]);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    res.json(metricsSnapshot());
  } catch (e) {
    res.status(401).json({ error: 'Token invalido' });
  }
});

// Health check. Nginx proxies /api/* to this backend, so /api/health is
// reachable externally; the legacy /health path is swallowed by the SPA
// fallback and is kept only for direct (localhost) probes.
async function healthHandler(req, res) {
  const mongoose = require('mongoose');
  const mongoState = mongoose.connection.readyState;
  const mongoStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  let redisStatus = 'disabled';
  try {
    const { getRedisClient } = require('./services/cacheService');
    const client = getRedisClient && getRedisClient();
    if (client) {
      const pong = await Promise.race([
        client.ping(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500))
      ]);
      redisStatus = pong === 'PONG' ? 'connected' : 'degraded';
    }
  } catch (err) {
    redisStatus = 'error';
  }

  const mongoOk = mongoState === 1;
  const redisOk = redisStatus === 'connected' || redisStatus === 'disabled';
  const healthy = mongoOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    service: 'LUCI Customs Agent',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    mongo: mongoStatus[mongoState] || 'unknown',
    redis: redisStatus,
    node: process.version
  });
}

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Contact form (public, rate limited)
app.post('/api/contact', authLimiter, express.json(), async (req, res) => {
  try {
    const { name, email, company, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Campos obligatorios: nombre, email, mensaje' });
    }
    const emailService = require('./services/emailService');
    await emailService.sendEmail(
      'luci@strixai.es',
      `[LUCI Contact] ${name} - ${company || 'Sin empresa'}`,
      `<h3>Nuevo contacto desde aduanas.strixai.es</h3>
       <p><strong>Nombre:</strong> ${name}</p>
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Empresa:</strong> ${company || 'No indicada'}</p>
       <p><strong>Mensaje:</strong></p><p>${message}</p>`
    );
    logger.info(`Contact form: ${email} (${company})`);
    res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (error) {
    logger.error('Contact form error:', error.message);
    res.json({ success: true, message: 'Mensaje recibido' });
  }
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
if (certificateRoutes) app.use('/api/certificates', certificateRoutes);
if (manifestRoutes) app.use('/api/manifest', manifestRoutes);
if (auditRoutes) app.use('/api/audit', auditRoutes);
if (gdprRoutes) app.use('/api/gdpr', gdprRoutes);
if (emailRoutes) app.use('/api/email', emailRoutes);

// Email test endpoint (admin only, non-production only)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_EMAIL_TEST === 'true') {
  app.post('/api/email/test', async (req, res) => {
    try {
      const jwtService = require('./utils/jwtService');
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token requerido' });
      }
      const decoded = jwtService.verify(authHeader.split(' ')[1]);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Solo administradores' });
      }
      const emailService = require('./services/emailService');
      const { to } = req.body;
      const result = await emailService.sendTestEmail(to || decoded.email);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Email test error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// Initialize workflow service
const workflowService = require('./services/workflow');
workflowService.initialize().catch(err => {
  logger.error('Failed to initialize workflow service:', err);
});

// Initialize BullMQ workers (opt-in to avoid duplication in cluster)
try {
  require('./workers/classificationWorker').start();
} catch (err) {
  logger.warn('classificationWorker not started', { error: err.message });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack, url: req.originalUrl, method: req.method, userId: req.user?._id });
  if (process.env.SENTRY_DSN) Sentry.captureException(err);

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

const server = app.listen(PORT, () => {
  logger.info(`LUCI Customs Agent running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
let isShuttingDown = false;
const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');
    const mongoose = require('mongoose');
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error('Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION:', reason);
});

module.exports = app;
