/**
 * Multi-tenant Certificate Manager
 * Stores customs certificates (FNMT, PKIoverheid, etc.) per tenant
 * Supports local filesystem storage with future S3 migration path
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../../../config/logger');

class CertificateManager {
  constructor() {
    this.storageDir = process.env.CERT_STORAGE_DIR || '/opt/luci-customs/certs';
    this._ensureStorageDir();
  }

  _ensureStorageDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
      }
    } catch (err) {
      logger.warn(`CertificateManager: Could not create storage dir ${this.storageDir}: ${err.message}`);
    }
  }

  /**
   * Store a certificate for a tenant
   * @param {string} tenantId
   * @param {string} country - 'ES', 'NL', etc.
   * @param {Buffer} certBuffer - .p12/.pfx file content
   * @param {string} password - certificate password
   * @param {object} metadata - {name, type, expiresAt, issuedTo}
   */
  async storeCertificate(tenantId, country, certBuffer, password, metadata = {}) {
    // Validate the certificate can be opened
    try {
      const forge = require('node-forge');
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(certBuffer));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Extract cert info
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;

      if (cert) {
        metadata.issuedTo = cert.subject.getField('CN')?.value || 'Unknown';
        metadata.issuer = cert.issuer.getField('CN')?.value || 'Unknown';
        metadata.validFrom = cert.validity.notBefore;
        metadata.validUntil = cert.validity.notAfter;
        metadata.serialNumber = cert.serialNumber;
      }
    } catch (error) {
      return { success: false, error: `Certificado invalido o password incorrecta: ${error.message}` };
    }

    // Generate unique filename
    const filename = `${tenantId}_${country}_${Date.now()}.p12`;
    const filePath = path.join(this.storageDir, filename);

    // Encrypt password before storing
    const encryptedPassword = this._encryptPassword(password);

    // Save file with restricted permissions
    fs.writeFileSync(filePath, certBuffer, { mode: 0o600 });

    logger.info(`Certificate stored for tenant ${tenantId} (${country}): ${metadata.issuedTo}`);

    return {
      success: true,
      data: {
        filePath,
        filename,
        country,
        encryptedPassword,
        metadata: {
          name: metadata.name || filename,
          type: country === 'ES' ? 'FNMT' : country === 'NL' ? 'PKIoverheid' : 'X.509',
          issuedTo: metadata.issuedTo,
          issuer: metadata.issuer,
          validFrom: metadata.validFrom,
          validUntil: metadata.validUntil,
          serialNumber: metadata.serialNumber,
          uploadedAt: new Date()
        }
      }
    };
  }

  /**
   * Get certificate for a tenant + country
   */
  getCertificate(tenantId, country) {
    try {
      const pattern = `${tenantId}_${country}_`;
      const files = fs.readdirSync(this.storageDir)
        .filter(f => f.startsWith(pattern) && f.endsWith('.p12'))
        .sort()
        .reverse(); // Most recent first

      if (files.length === 0) return null;

      return {
        filePath: path.join(this.storageDir, files[0]),
        filename: files[0]
      };
    } catch (err) {
      logger.warn(`CertificateManager: Error reading certs for ${tenantId}/${country}: ${err.message}`);
      return null;
    }
  }

  /**
   * Delete certificate for a tenant + country
   */
  deleteCertificate(tenantId, country) {
    const cert = this.getCertificate(tenantId, country);
    if (cert) {
      fs.unlinkSync(cert.filePath);
      logger.info(`Certificate deleted for tenant ${tenantId} (${country})`);
      return true;
    }
    return false;
  }

  /**
   * List all certificates for a tenant
   */
  listCertificates(tenantId) {
    try {
      const prefix = `${tenantId}_`;
      return fs.readdirSync(this.storageDir)
        .filter(f => f.startsWith(prefix) && f.endsWith('.p12'))
        .map(f => {
          const parts = f.replace('.p12', '').split('_');
          return {
            filename: f,
            country: parts[1],
            uploadedAt: new Date(parseInt(parts[2])),
            filePath: path.join(this.storageDir, f)
          };
        });
    } catch (err) {
      logger.warn(`CertificateManager: Error listing certs for ${tenantId}: ${err.message}`);
      return [];
    }
  }

  _encryptPassword(password) {
    const key = process.env.CERT_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptPassword(encryptedPassword) {
    const key = process.env.CERT_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key';
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = new CertificateManager();
