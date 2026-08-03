/**
 * Certificate Management Routes
 * Multi-tenant certificate upload, listing, and deletion
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, requireRole } = require('../middleware/auth');
const certificateManager = require('../services/customs/common/certificateManager');
const logger = require('../config/logger');

// All routes require authentication
router.use(auth);

// Multer config: store in memory, max 5MB, only .p12/.pfx
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.p12') || ext.endsWith('.pfx')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .p12 o .pfx'));
    }
  }
});

/**
 * POST /api/certificates/upload
 * Upload a .p12/.pfx certificate
 * Body (multipart): certificate (file), password (string), country (string)
 */
// Solo admin: sustituye el certificado con el que el tenant firma ante la AEAT.
router.post('/upload', requireRole('admin'), upload.single('certificate'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha proporcionado un archivo de certificado' });
    }

    const { password, country } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'La password del certificado es obligatoria' });
    }

    const tenantId = req.user.tenantId?.toString() || req.user._id.toString();
    const countryCode = (country || 'ES').toUpperCase();

    const result = await certificateManager.storeCertificate(
      tenantId,
      countryCode,
      req.file.buffer,
      password,
      { name: req.file.originalname }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Update tenant's customsConfig if we have a Tenant model
    try {
      const Tenant = require('../models/Tenant');
      await Tenant.findByIdAndUpdate(tenantId, {
        'customsConfig.certificatePath': result.data.filePath,
        'customsConfig.certificatePassword': result.data.encryptedPassword
      });
    } catch (e) {
      // Tenant update is optional; cert is still stored
      logger.warn(`Certificate stored but tenant update failed: ${e.message}`);
    }

    res.json({
      success: true,
      certificate: {
        country: countryCode,
        metadata: result.data.metadata
      }
    });
  } catch (error) {
    logger.error('Certificate upload error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/certificates
 * List all certificates for the tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenantId?.toString() || req.user._id.toString();
    const certs = certificateManager.listCertificates(tenantId);

    res.json({
      success: true,
      certificates: certs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/certificates/:country
 * Delete certificate for a specific country
 */
// Solo admin: sin certificado el tenant no puede presentar ninguna declaracion.
router.delete('/:country', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId?.toString() || req.user._id.toString();
    const country = req.params.country.toUpperCase();
    const deleted = certificateManager.deleteCertificate(tenantId, country);

    if (deleted) {
      // Clear tenant cert config
      try {
        const Tenant = require('../models/Tenant');
        await Tenant.findByIdAndUpdate(tenantId, {
          $unset: { 'customsConfig.certificatePath': 1, 'customsConfig.certificatePassword': 1 }
        });
      } catch (e) { /* optional */ }
    }

    res.json({
      success: deleted,
      message: deleted ? 'Certificado eliminado' : 'Certificado no encontrado'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/certificates/:country/status
 * Check certificate status/validity
 */
router.get('/:country/status', async (req, res) => {
  try {
    const tenantId = req.user.tenantId?.toString() || req.user._id.toString();
    const country = req.params.country.toUpperCase();
    const cert = certificateManager.getCertificate(tenantId, country);

    if (!cert) {
      return res.json({
        success: true,
        status: 'not_configured',
        country
      });
    }

    // Try to read cert info
    const fs = require('fs');
    const forge = require('node-forge');
    let certInfo = {};

    try {
      // We can check file exists and read metadata from filename
      const stats = fs.statSync(cert.filePath);
      const parts = cert.filename.replace('.p12', '').split('_');
      certInfo = {
        filename: cert.filename,
        country: parts[1],
        uploadedAt: new Date(parseInt(parts[2])),
        fileSize: stats.size
      };
    } catch (e) {
      certInfo = { filename: cert.filename };
    }

    res.json({
      success: true,
      status: 'configured',
      country,
      certificate: certInfo
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
