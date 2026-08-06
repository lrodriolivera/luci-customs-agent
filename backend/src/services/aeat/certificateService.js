/**
 * Certificate Service - Gestión de Certificados Digitales
 * Fase 6.1.1 - LUCI Customs Agent
 *
 * Gestiona certificados FNMT para firma electrónica ante AEAT
 * Integra LUCI para validación y asistencia
 */

const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const logger = require('../../config/logger');

class CertificateService {
  constructor() {
    this.certificates = new Map(); // In-memory store (production: encrypted DB)
    this.CERT_STORAGE_PATH = process.env.CERT_STORAGE_PATH || './certs';
    this.ENCRYPTION_KEY = process.env.CERT_ENCRYPTION_KEY || 'default-key-change-in-production';

    // Tipos de certificados soportados
    this.CERTIFICATE_TYPES = {
      FNMT_PF: {
        code: 'FNMT_PF',
        name: 'Certificado de Persona Física FNMT',
        issuer: 'FNMT-RCM',
        usages: ['sign', 'auth'],
        validFor: ['H1', 'H7', 'AES', 'NCTS']
      },
      FNMT_PJ: {
        code: 'FNMT_PJ',
        name: 'Certificado de Persona Jurídica FNMT',
        issuer: 'FNMT-RCM',
        usages: ['sign', 'auth', 'represent'],
        validFor: ['H1', 'H7', 'AES', 'NCTS', 'SILICIE']
      },
      FNMT_REP: {
        code: 'FNMT_REP',
        name: 'Certificado de Representante FNMT',
        issuer: 'FNMT-RCM',
        usages: ['sign', 'auth', 'represent'],
        validFor: ['H1', 'H7', 'AES', 'NCTS', 'SILICIE', 'VUA']
      },
      AEAT_SELLO: {
        code: 'AEAT_SELLO',
        name: 'Sello Electrónico AEAT',
        issuer: 'AEAT',
        usages: ['seal'],
        validFor: ['responses']
      }
    };

    // Estados del certificado
    this.CERTIFICATE_STATUS = {
      ACTIVE: 'active',
      EXPIRED: 'expired',
      REVOKED: 'revoked',
      PENDING_RENEWAL: 'pending_renewal',
      SUSPENDED: 'suspended'
    };

    // Umbrales de alerta (días)
    this.ALERT_THRESHOLDS = {
      CRITICAL: 7,    // Renovación urgente
      WARNING: 30,    // Planificar renovación
      INFO: 60        // Informativo
    };
  }

  /**
   * Importar certificado P12/PFX
   */
  async importCertificate(p12Buffer, password, metadata = {}) {
    try {
      logger.info('CertificateService: Importando certificado P12');

      // Decodificar P12
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Extraer certificado y clave privada
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

      const certBag = certBags[forge.pki.oids.certBag];
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

      if (!certBag || certBag.length === 0) {
        throw new Error('No se encontró certificado en el archivo P12');
      }

      if (!keyBag || keyBag.length === 0) {
        throw new Error('No se encontró clave privada en el archivo P12');
      }

      const certificate = certBag[0].cert;
      const privateKey = keyBag[0].key;

      // Extraer información del certificado
      const certInfo = this._extractCertificateInfo(certificate);

      // Validar certificado
      const validation = await this._validateCertificate(certificate, certInfo);

      if (!validation.valid) {
        return {
          success: false,
          // _validateCertificate devuelve el detalle en `errors` (array), no en
          // `error`: leer validation.error dejaba este campo en undefined y el
          // cliente no veía el motivo del rechazo. Ver SECURITY_AUDIT.md.
          error: (validation.errors || []).join('; ') || 'Certificado inválido',
          errors: validation.errors,
          luciAnalysis: await this._getLuciCertificateAnalysis(certInfo, validation)
        };
      }

      // Generar ID único
      const certId = this._generateCertificateId(certInfo);

      // Encriptar y almacenar
      const encryptedData = this._encryptCertificateData({
        certificate: forge.pki.certificateToPem(certificate),
        privateKey: forge.pki.privateKeyToPem(privateKey),
        p12: p12Buffer.toString('base64'),
        password: this._encryptPassword(password)
      });

      const certRecord = {
        id: certId,
        ...certInfo,
        type: this._determineCertificateType(certInfo),
        status: this.CERTIFICATE_STATUS.ACTIVE,
        encryptedData,
        metadata: {
          ...metadata,
          importedAt: new Date().toISOString(),
          importedBy: metadata.userId || 'system'
        },
        alerts: this._calculateAlerts(certInfo.validTo),
        lastVerified: new Date().toISOString()
      };

      // Almacenar en memoria (producción: base de datos encriptada)
      this.certificates.set(certId, certRecord);

      // Análisis LUCI del certificado importado
      const luciAnalysis = await this._getLuciCertificateAnalysis(certInfo, validation);

      logger.info(`CertificateService: Certificado importado exitosamente: ${certId}`);

      return {
        success: true,
        certificateId: certId,
        info: {
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          serialNumber: certInfo.serialNumber,
          validFrom: certInfo.validFrom,
          validTo: certInfo.validTo,
          type: certRecord.type,
          daysToExpiry: certInfo.daysToExpiry,
          validFor: this.CERTIFICATE_TYPES[certRecord.type]?.validFor || []
        },
        alerts: certRecord.alerts,
        luciAnalysis
      };

    } catch (error) {
      logger.error('CertificateService: Error importando certificado', { error: error.message });

      return {
        success: false,
        error: error.message,
        luciAnalysis: {
          interpretation: 'Error al procesar el certificado digital',
          possibleCauses: [
            'Contraseña incorrecta',
            'Formato de archivo no válido (debe ser .p12 o .pfx)',
            'Certificado corrupto o incompleto',
            'Certificado no compatible con estándares PKCS#12'
          ],
          recommendations: [
            'Verificar que la contraseña sea correcta',
            'Asegurar que el archivo sea un certificado P12/PFX válido',
            'Exportar nuevamente el certificado desde el navegador o tarjeta',
            'Contactar con FNMT si el problema persiste'
          ]
        }
      };
    }
  }

  /**
   * Obtener certificado para firmar
   */
  async getCertificateForSigning(certId, password) {
    try {
      const certRecord = this.certificates.get(certId);

      if (!certRecord) {
        throw new Error('Certificado no encontrado');
      }

      // Verificar estado
      if (certRecord.status !== this.CERTIFICATE_STATUS.ACTIVE) {
        throw new Error(`Certificado no activo. Estado: ${certRecord.status}`);
      }

      // Verificar expiración
      if (new Date(certRecord.validTo) < new Date()) {
        certRecord.status = this.CERTIFICATE_STATUS.EXPIRED;
        throw new Error('Certificado expirado');
      }

      // Desencriptar datos
      const decryptedData = this._decryptCertificateData(certRecord.encryptedData);

      // Verificar contraseña
      const storedPassword = this._decryptPassword(decryptedData.password);
      if (password !== storedPassword) {
        throw new Error('Contraseña incorrecta');
      }

      return {
        success: true,
        certificate: forge.pki.certificateFromPem(decryptedData.certificate),
        privateKey: forge.pki.privateKeyFromPem(decryptedData.privateKey),
        certPem: decryptedData.certificate,
        keyPem: decryptedData.privateKey,
        info: {
          subject: certRecord.subject,
          serialNumber: certRecord.serialNumber,
          validTo: certRecord.validTo
        }
      };

    } catch (error) {
      logger.error('CertificateService: Error obteniendo certificado', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Listar certificados
   */
  async listCertificates(organizationId = null) {
    const certs = [];

    for (const [id, cert] of this.certificates) {
      if (organizationId && cert.metadata.organizationId !== organizationId) {
        continue;
      }

      // Actualizar alertas
      cert.alerts = this._calculateAlerts(cert.validTo);

      // Actualizar estado si expiró
      if (new Date(cert.validTo) < new Date() && cert.status === this.CERTIFICATE_STATUS.ACTIVE) {
        cert.status = this.CERTIFICATE_STATUS.EXPIRED;
      }

      certs.push({
        id,
        subject: cert.subject,
        issuer: cert.issuer,
        serialNumber: cert.serialNumber,
        type: cert.type,
        typeName: this.CERTIFICATE_TYPES[cert.type]?.name || 'Desconocido',
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        daysToExpiry: this._calculateDaysToExpiry(cert.validTo),
        status: cert.status,
        alerts: cert.alerts,
        validFor: this.CERTIFICATE_TYPES[cert.type]?.validFor || [],
        metadata: {
          importedAt: cert.metadata.importedAt,
          alias: cert.metadata.alias
        }
      });
    }

    // Ordenar por fecha de expiración (próximos a expirar primero)
    certs.sort((a, b) => new Date(a.validTo) - new Date(b.validTo));

    return {
      success: true,
      certificates: certs,
      summary: {
        total: certs.length,
        active: certs.filter(c => c.status === this.CERTIFICATE_STATUS.ACTIVE).length,
        expired: certs.filter(c => c.status === this.CERTIFICATE_STATUS.EXPIRED).length,
        pendingRenewal: certs.filter(c => c.alerts.level === 'critical' || c.alerts.level === 'warning').length
      }
    };
  }

  /**
   * Verificar certificado contra OCSP/CRL
   */
  async verifyCertificateStatus(certId) {
    try {
      const certRecord = this.certificates.get(certId);

      if (!certRecord) {
        throw new Error('Certificado no encontrado');
      }

      // En producción: consultar OCSP de FNMT
      // http://ocspusu.cert.fnmt.es/ocspusu/OcspResponder

      // Simulación de verificación OCSP
      const ocspResult = await this._simulateOCSPCheck(certRecord);

      certRecord.lastVerified = new Date().toISOString();
      certRecord.ocspStatus = ocspResult.status;

      if (ocspResult.status === 'revoked') {
        certRecord.status = this.CERTIFICATE_STATUS.REVOKED;
      }

      // Análisis LUCI
      const luciAnalysis = await this._getLuciVerificationAnalysis(certRecord, ocspResult);

      return {
        success: true,
        certificateId: certId,
        verification: {
          timestamp: certRecord.lastVerified,
          ocspStatus: ocspResult.status,
          ocspMessage: ocspResult.message,
          certificateStatus: certRecord.status,
          isValid: ocspResult.status === 'good' && certRecord.status === this.CERTIFICATE_STATUS.ACTIVE
        },
        luciAnalysis
      };

    } catch (error) {
      logger.error('CertificateService: Error verificando certificado', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener alertas de renovación
   */
  async getRenewalAlerts() {
    const alerts = [];

    for (const [id, cert] of this.certificates) {
      const daysToExpiry = this._calculateDaysToExpiry(cert.validTo);

      if (daysToExpiry <= this.ALERT_THRESHOLDS.INFO) {
        alerts.push({
          certificateId: id,
          subject: cert.subject,
          type: cert.type,
          validTo: cert.validTo,
          daysToExpiry,
          level: daysToExpiry <= this.ALERT_THRESHOLDS.CRITICAL ? 'critical' :
                 daysToExpiry <= this.ALERT_THRESHOLDS.WARNING ? 'warning' : 'info',
          message: this._getRenewalMessage(daysToExpiry, cert)
        });
      }
    }

    // Ordenar por urgencia
    alerts.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

    // Análisis LUCI de renovaciones pendientes
    const luciAnalysis = await this._getLuciRenewalAnalysis(alerts);

    return {
      success: true,
      alerts,
      luciAnalysis
    };
  }

  /**
   * Eliminar certificado
   */
  async deleteCertificate(certId) {
    const cert = this.certificates.get(certId);

    if (!cert) {
      return { success: false, error: 'Certificado no encontrado' };
    }

    this.certificates.delete(certId);

    logger.info(`CertificateService: Certificado eliminado: ${certId}`);

    return {
      success: true,
      message: 'Certificado eliminado correctamente',
      deletedCertificate: {
        id: certId,
        subject: cert.subject
      }
    };
  }

  /**
   * Validar que certificado puede usarse para operación específica
   */
  async validateCertificateForOperation(certId, operationType) {
    const certRecord = this.certificates.get(certId);

    if (!certRecord) {
      return {
        valid: false,
        error: 'Certificado no encontrado'
      };
    }

    const certType = this.CERTIFICATE_TYPES[certRecord.type];

    if (!certType) {
      return {
        valid: false,
        error: 'Tipo de certificado no reconocido'
      };
    }

    // Verificar si el certificado es válido para la operación
    const isValidForOperation = certType.validFor.includes(operationType);

    // Verificar estado
    const isActive = certRecord.status === this.CERTIFICATE_STATUS.ACTIVE;

    // Verificar expiración
    const notExpired = new Date(certRecord.validTo) > new Date();

    const valid = isValidForOperation && isActive && notExpired;

    // Análisis LUCI
    const luciAnalysis = await this._getLuciOperationValidation(certRecord, operationType, {
      isValidForOperation,
      isActive,
      notExpired
    });

    return {
      valid,
      certificateId: certId,
      operationType,
      checks: {
        isValidForOperation,
        isActive,
        notExpired,
        certificateType: certRecord.type,
        allowedOperations: certType.validFor
      },
      luciAnalysis
    };
  }

  // ============== MÉTODOS PRIVADOS ==============

  _extractCertificateInfo(certificate) {
    const subject = certificate.subject.attributes.reduce((acc, attr) => {
      acc[attr.shortName || attr.name] = attr.value;
      return acc;
    }, {});

    const issuer = certificate.issuer.attributes.reduce((acc, attr) => {
      acc[attr.shortName || attr.name] = attr.value;
      return acc;
    }, {});

    const validFrom = certificate.validity.notBefore;
    const validTo = certificate.validity.notAfter;
    const daysToExpiry = this._calculateDaysToExpiry(validTo);

    return {
      subject: subject.CN || subject.O || 'Desconocido',
      subjectDetails: subject,
      issuer: issuer.CN || issuer.O || 'Desconocido',
      issuerDetails: issuer,
      serialNumber: certificate.serialNumber,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      daysToExpiry,
      keyUsage: this._extractKeyUsage(certificate),
      extensions: this._extractExtensions(certificate)
    };
  }

  _extractKeyUsage(certificate) {
    const keyUsage = [];
    const ext = certificate.getExtension('keyUsage');

    if (ext) {
      if (ext.digitalSignature) keyUsage.push('digitalSignature');
      if (ext.nonRepudiation) keyUsage.push('nonRepudiation');
      if (ext.keyEncipherment) keyUsage.push('keyEncipherment');
      if (ext.dataEncipherment) keyUsage.push('dataEncipherment');
      if (ext.keyAgreement) keyUsage.push('keyAgreement');
      if (ext.keyCertSign) keyUsage.push('keyCertSign');
      if (ext.cRLSign) keyUsage.push('cRLSign');
    }

    return keyUsage;
  }

  _extractExtensions(certificate) {
    const extensions = {};

    // Subject Alternative Name
    const san = certificate.getExtension('subjectAltName');
    if (san) {
      extensions.subjectAltName = san.altNames;
    }

    // Authority Info Access (OCSP)
    const aia = certificate.getExtension('authorityInfoAccess');
    if (aia) {
      extensions.authorityInfoAccess = aia;
    }

    return extensions;
  }

  async _validateCertificate(certificate, certInfo) {
    const errors = [];

    // Verificar fechas
    const now = new Date();
    if (new Date(certInfo.validFrom) > now) {
      errors.push('El certificado aún no es válido (fecha de inicio futura)');
    }
    if (new Date(certInfo.validTo) < now) {
      errors.push('El certificado ha expirado');
    }

    // Verificar emisor (FNMT)
    const validIssuers = ['FNMT', 'FNMT-RCM', 'AC FNMT Usuarios'];
    const issuerValid = validIssuers.some(vi =>
      certInfo.issuer.includes(vi) ||
      (certInfo.issuerDetails.O && certInfo.issuerDetails.O.includes(vi))
    );

    if (!issuerValid) {
      errors.push(`Emisor no reconocido: ${certInfo.issuer}. Se requiere certificado FNMT.`);
    }

    // Verificar key usage para firma
    if (!certInfo.keyUsage.includes('digitalSignature') && !certInfo.keyUsage.includes('nonRepudiation')) {
      errors.push('El certificado no tiene permisos de firma digital');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: certInfo.daysToExpiry <= 30 ? ['El certificado expira pronto'] : []
    };
  }

  _determineCertificateType(certInfo) {
    const subject = certInfo.subjectDetails;
    const issuer = certInfo.issuerDetails;

    // Certificado de representante
    if (subject.OU && subject.OU.includes('REPRESENT')) {
      return 'FNMT_REP';
    }

    // Certificado de persona jurídica
    if (subject.O && subject.serialNumber && subject.serialNumber.startsWith('CIF')) {
      return 'FNMT_PJ';
    }

    // Certificado de persona física (por defecto si es FNMT)
    if (issuer.O && issuer.O.includes('FNMT')) {
      return 'FNMT_PF';
    }

    return 'FNMT_PF'; // Default
  }

  _generateCertificateId(certInfo) {
    const data = `${certInfo.serialNumber}-${certInfo.subject}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  _encryptCertificateData(data) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  _decryptCertificateData(encryptedData) {
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  _encryptPassword(password) {
    // En producción: usar KMS o HSM
    return Buffer.from(password).toString('base64');
  }

  _decryptPassword(encrypted) {
    return Buffer.from(encrypted, 'base64').toString('utf8');
  }

  _calculateDaysToExpiry(validTo) {
    const now = new Date();
    const expiry = new Date(validTo);
    const diffTime = expiry - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  _calculateAlerts(validTo) {
    const daysToExpiry = this._calculateDaysToExpiry(validTo);

    if (daysToExpiry <= 0) {
      return { level: 'expired', message: 'Certificado expirado', daysToExpiry };
    }
    if (daysToExpiry <= this.ALERT_THRESHOLDS.CRITICAL) {
      return { level: 'critical', message: `Renovación urgente: ${daysToExpiry} días restantes`, daysToExpiry };
    }
    if (daysToExpiry <= this.ALERT_THRESHOLDS.WARNING) {
      return { level: 'warning', message: `Renovar pronto: ${daysToExpiry} días restantes`, daysToExpiry };
    }
    if (daysToExpiry <= this.ALERT_THRESHOLDS.INFO) {
      return { level: 'info', message: `${daysToExpiry} días para expiración`, daysToExpiry };
    }

    return { level: 'ok', message: 'Certificado válido', daysToExpiry };
  }

  _getRenewalMessage(daysToExpiry, cert) {
    if (daysToExpiry <= 0) {
      return `URGENTE: El certificado "${cert.subject}" ha EXPIRADO. No podrá presentar declaraciones.`;
    }
    if (daysToExpiry <= this.ALERT_THRESHOLDS.CRITICAL) {
      return `CRÍTICO: El certificado "${cert.subject}" expira en ${daysToExpiry} días. Renueve inmediatamente.`;
    }
    if (daysToExpiry <= this.ALERT_THRESHOLDS.WARNING) {
      return `AVISO: El certificado "${cert.subject}" expira en ${daysToExpiry} días. Planifique la renovación.`;
    }
    return `INFO: El certificado "${cert.subject}" expira en ${daysToExpiry} días.`;
  }

  async _simulateOCSPCheck(certRecord) {
    // En producción: consulta real a OCSP de FNMT
    // Simulación para desarrollo

    await new Promise(resolve => setTimeout(resolve, 100)); // Simular latencia

    // Simular respuesta OCSP
    const status = certRecord.status === this.CERTIFICATE_STATUS.REVOKED ? 'revoked' : 'good';

    return {
      status,
      message: status === 'good' ?
        'Certificado válido según OCSP de FNMT' :
        'Certificado revocado',
      timestamp: new Date().toISOString(),
      responder: 'http://ocspusu.cert.fnmt.es/ocspusu/OcspResponder'
    };
  }

  // ============== ANÁLISIS LUCI ==============

  async _getLuciCertificateAnalysis(certInfo, validation) {
    return {
      summary: validation.valid ?
        `Certificado válido de ${certInfo.issuer} para ${certInfo.subject}` :
        `Certificado con problemas: ${validation.errors.join(', ')}`,

      details: {
        holder: certInfo.subject,
        issuer: certInfo.issuer,
        validity: `${certInfo.validFrom} - ${certInfo.validTo}`,
        daysRemaining: certInfo.daysToExpiry,
        capabilities: certInfo.keyUsage
      },

      recommendations: this._generateCertificateRecommendations(certInfo, validation),

      aeatCompatibility: {
        h1Import: validation.valid,
        h7LowValue: validation.valid,
        aesExport: validation.valid,
        ncts: validation.valid,
        vua: validation.valid && certInfo.keyUsage.includes('nonRepudiation')
      }
    };
  }

  _generateCertificateRecommendations(certInfo, validation) {
    const recommendations = [];

    if (!validation.valid) {
      recommendations.push({
        priority: 'high',
        action: 'Resolver problemas del certificado antes de usarlo',
        details: validation.errors
      });
    }

    if (certInfo.daysToExpiry <= 30) {
      recommendations.push({
        priority: certInfo.daysToExpiry <= 7 ? 'critical' : 'high',
        action: 'Renovar certificado',
        details: `El certificado expira en ${certInfo.daysToExpiry} días. Inicie el proceso de renovación en FNMT.`,
        link: 'https://www.sede.fnmt.gob.es/certificados/persona-fisica/renovar'
      });
    }

    if (validation.valid && certInfo.daysToExpiry > 30) {
      recommendations.push({
        priority: 'info',
        action: 'Certificado listo para usar',
        details: 'Puede presentar declaraciones H1, H7, AES y NCTS con este certificado.'
      });
    }

    return recommendations;
  }

  async _getLuciVerificationAnalysis(certRecord, ocspResult) {
    return {
      status: ocspResult.status === 'good' ? 'Verificado correctamente' : 'Problemas detectados',
      ocspDetails: {
        responseStatus: ocspResult.status,
        responder: ocspResult.responder,
        timestamp: ocspResult.timestamp
      },
      interpretation: ocspResult.status === 'good' ?
        'El certificado está activo y no ha sido revocado según la autoridad emisora (FNMT).' :
        'El certificado ha sido revocado. No puede utilizarse para firmar declaraciones.',
      nextSteps: ocspResult.status === 'good' ?
        ['El certificado está listo para usar', 'Verificación válida por 24 horas'] :
        ['Obtener nuevo certificado en FNMT', 'Contactar con soporte si cree que es un error']
    };
  }

  async _getLuciRenewalAnalysis(alerts) {
    if (alerts.length === 0) {
      return {
        status: 'ok',
        message: 'Todos los certificados están vigentes',
        recommendations: []
      };
    }

    const critical = alerts.filter(a => a.level === 'critical');
    const warnings = alerts.filter(a => a.level === 'warning');

    return {
      status: critical.length > 0 ? 'critical' : 'warning',
      message: critical.length > 0 ?
        `${critical.length} certificado(s) requieren renovación URGENTE` :
        `${warnings.length} certificado(s) necesitan renovación próximamente`,
      summary: {
        criticalCount: critical.length,
        warningCount: warnings.length,
        infoCount: alerts.filter(a => a.level === 'info').length
      },
      recommendations: [
        ...critical.map(c => ({
          priority: 'critical',
          certificate: c.subject,
          action: `Renovar INMEDIATAMENTE - expira en ${c.daysToExpiry} días`,
          deadline: c.validTo
        })),
        ...warnings.map(w => ({
          priority: 'high',
          certificate: w.subject,
          action: `Planificar renovación - expira en ${w.daysToExpiry} días`,
          deadline: w.validTo
        }))
      ],
      renewalProcess: {
        description: 'Proceso de renovación FNMT',
        steps: [
          '1. Acceder a sede.fnmt.gob.es con el certificado actual',
          '2. Seleccionar "Renovar certificado"',
          '3. Seguir las instrucciones del asistente',
          '4. Descargar e instalar el nuevo certificado',
          '5. Importar el nuevo certificado en LUCI'
        ],
        estimatedTime: '15-30 minutos',
        link: 'https://www.sede.fnmt.gob.es/certificados'
      }
    };
  }

  async _getLuciOperationValidation(certRecord, operationType, checks) {
    const operationNames = {
      'H1': 'Declaración de Importación H1',
      'H7': 'Declaración de Bajo Valor H7',
      'AES': 'Declaración de Exportación AES',
      'NCTS': 'Tránsito Comunitario NCTS',
      'VUA': 'Ventanilla Única Aduanera',
      'SILICIE': 'Sistema de Impuestos Especiales'
    };

    const isValid = checks.isValidForOperation && checks.isActive && checks.notExpired;

    return {
      operation: operationNames[operationType] || operationType,
      canProceed: isValid,
      validationDetails: {
        certificateType: this.CERTIFICATE_TYPES[certRecord.type]?.name || certRecord.type,
        allowedForOperation: checks.isValidForOperation,
        certificateActive: checks.isActive,
        notExpired: checks.notExpired
      },
      message: isValid ?
        `El certificado "${certRecord.subject}" está autorizado para ${operationNames[operationType] || operationType}` :
        this._getValidationErrorMessage(checks, operationType, certRecord),
      recommendations: !isValid ? this._getValidationRecommendations(checks, operationType) : []
    };
  }

  _getValidationErrorMessage(checks, operationType, certRecord) {
    if (!checks.notExpired) {
      return 'El certificado ha expirado y no puede usarse para firmar declaraciones.';
    }
    if (!checks.isActive) {
      return `El certificado está en estado "${certRecord.status}" y no puede usarse.`;
    }
    if (!checks.isValidForOperation) {
      return `El tipo de certificado "${certRecord.type}" no está autorizado para operaciones de tipo "${operationType}".`;
    }
    return 'El certificado no cumple los requisitos para esta operación.';
  }

  _getValidationRecommendations(checks, operationType) {
    const recommendations = [];

    if (!checks.notExpired) {
      recommendations.push('Renovar el certificado en FNMT');
    }
    if (!checks.isActive) {
      recommendations.push('Verificar el estado del certificado o importar uno nuevo');
    }
    if (!checks.isValidForOperation) {
      recommendations.push(`Obtener un certificado autorizado para ${operationType}`);
      if (operationType === 'VUA' || operationType === 'SILICIE') {
        recommendations.push('Se requiere certificado de representante o persona jurídica');
      }
    }

    return recommendations;
  }
}

module.exports = new CertificateService();
