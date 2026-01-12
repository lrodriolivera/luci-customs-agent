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
let requirementRoutes, channelRoutes, paraduaneroRoutes;

try {
  authRoutes = require('./routes/auth');
  expeditionRoutes = require('./routes/expeditions');
  documentRoutes = require('./routes/documents');
  declarationRoutes = require('./routes/declarations');
  portalRoutes = require('./routes/portal');
  chatRoutes = require('./routes/chat');
  classificationRoutes = require('./routes/classification');
  calculationRoutes = require('./routes/calculation');
  requirementRoutes = require('./routes/requirements');
  channelRoutes = require('./routes/channels');
  paraduaneroRoutes = require('./routes/paraduanero');
} catch (err) {
  console.error('Error loading routes:', err.message);
}

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Demasiadas solicitudes, por favor intente más tarde' }
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
