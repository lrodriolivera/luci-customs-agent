/**
 * AEAT Real Controller
 * Controlador para integración real con servicios web AEAT
 * STRIX AI - LUCI Customs Agent
 *
 * Fase 6.1: Integración Real AEAT
 */

const logger = require('../config/logger');
const {
  certificateService,
  xadesSignatureService,
  aeatRealService,
  aeatStatusMonitorService
} = require('../services/aeat');
const { Expedition } = require('../models');
const aiService = require('../services/aiService');
const { ensureSameTenant } = require('../utils/tenantGuard');

// ============================================
// GESTIÓN DE CERTIFICADOS DIGITALES
// ============================================

/**
 * Importar certificado digital
 * POST /api/aeat-real/certificates/import
 */
const importCertificate = async (req, res) => {
  try {
    const { certificateBase64, password, type, alias } = req.body;

    if (!certificateBase64 || !password) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere certificado y contraseña'
      });
    }

    const certificateBuffer = Buffer.from(certificateBase64, 'base64');

    const result = await certificateService.importCertificate(
      certificateBuffer,
      password,
      {
        type: type || 'FNMT_PJ',
        alias: alias
      }
    );

    // LUCI analiza el certificado importado (opcional)
    let luciAnalysis = null;
    try {
      if (typeof aiService.askLuci === 'function') {
        const analysisPrompt = `Certificado digital importado:
- Alias: ${result.alias}
- Tipo: ${result.type}
- Titular: ${result.subject?.CN || 'N/A'}
- Válido desde: ${result.validFrom}
- Válido hasta: ${result.validTo}
- Días hasta expiración: ${result.daysUntilExpiry}

Proporciona recomendaciones breves sobre el uso de este certificado.`;
        luciAnalysis = await aiService.askLuci(analysisPrompt);
      }
    } catch (analysisError) {
      logger.warn('Error en análisis LUCI del certificado:', analysisError.message);
    }

    logger.info(`Certificado importado: ${result.alias}`, { user: req.user?.email });

    res.json({
      success: true,
      data: {
        certificate: result,
        luciAnalysis
      },
      message: 'Certificado importado correctamente'
    });

  } catch (error) {
    logger.error('Error importando certificado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error importando certificado'
    });
  }
};

/**
 * Listar certificados disponibles
 * GET /api/aeat-real/certificates
 */
const listCertificates = async (req, res) => {
  try {
    const { includeExpired } = req.query;

    const result = await certificateService.listCertificates();

    // Filtrar expirados si no se solicitan
    let certs = result.certificates || [];
    if (includeExpired !== 'true') {
      certs = certs.filter(c => c.status !== 'expired');
    }

    // Mapear a formato esperado por frontend
    const mappedCerts = certs.map(c => ({
      alias: c.metadata?.alias || c.id,
      type: c.type,
      // subject puede ser string (CN) u objeto - normalizar a string para display
      subject: typeof c.subject === 'object' ? (c.subject?.CN || c.subject?.O || 'N/A') : (c.subject || 'N/A'),
      // Exponer también como objeto para compatibilidad
      subjectDetails: typeof c.subject === 'object' ? c.subject : { CN: c.subject },
      issuer: typeof c.issuer === 'object' ? (c.issuer?.CN || c.issuer?.O || 'N/A') : (c.issuer || 'N/A'),
      issuerDetails: typeof c.issuer === 'object' ? c.issuer : { CN: c.issuer },
      validFrom: c.validFrom,
      validTo: c.validTo,
      daysUntilExpiry: c.daysToExpiry,
      isValid: c.status === 'active' && c.daysToExpiry > 0
    }));

    res.json({
      success: true,
      data: mappedCerts
    });

  } catch (error) {
    logger.error('Error listando certificados:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listando certificados'
    });
  }
};

/**
 * Obtener información de un certificado
 * GET /api/aeat-real/certificates/:alias
 */
const getCertificateInfo = async (req, res) => {
  try {
    const { alias } = req.params;

    const certificates = await certificateService.listCertificates();
    const certificate = certificates.find(c => c.alias === alias);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificado no encontrado'
      });
    }

    // LUCI analiza el estado del certificado
    const analysis = await certificateService.analyzeCertificateWithLuci(alias);

    res.json({
      success: true,
      data: {
        certificate,
        analysis
      }
    });

  } catch (error) {
    logger.error('Error obteniendo certificado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo certificado'
    });
  }
};

/**
 * Verificar estado de certificado
 * GET /api/aeat-real/certificates/:alias/verify
 */
const verifyCertificate = async (req, res) => {
  try {
    const { alias } = req.params;

    const verification = await certificateService.verifyCertificateStatus(alias);

    res.json({
      success: true,
      data: verification
    });

  } catch (error) {
    logger.error('Error verificando certificado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error verificando certificado'
    });
  }
};

/**
 * Eliminar certificado
 * DELETE /api/aeat-real/certificates/:alias
 */
const deleteCertificate = async (req, res) => {
  try {
    const { alias } = req.params;

    await certificateService.deleteCertificate(alias);

    logger.info(`Certificado eliminado: ${alias}`, { user: req.user?.email });

    res.json({
      success: true,
      message: 'Certificado eliminado correctamente'
    });

  } catch (error) {
    logger.error('Error eliminando certificado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error eliminando certificado'
    });
  }
};

/**
 * Validar certificado para operación específica
 * POST /api/aeat-real/certificates/validate-for-operation
 */
const validateCertificateForOperation = async (req, res) => {
  try {
    const { certificateAlias, operationType, declarationType } = req.body;

    if (!certificateAlias || !operationType) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere alias de certificado y tipo de operación'
      });
    }

    const validation = await certificateService.validateCertificateForOperation(
      certificateAlias,
      operationType,
      declarationType
    );

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Error validando certificado para operación:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error validando certificado'
    });
  }
};

// ============================================
// FIRMA ELECTRÓNICA XAdES
// ============================================

/**
 * Firmar documento XML para AEAT
 * POST /api/aeat-real/signature/sign
 */
const signDocument = async (req, res) => {
  try {
    const { xmlContent, certificateAlias, serviceType } = req.body;

    if (!xmlContent || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere contenido XML y alias de certificado'
      });
    }

    const signedDocument = await xadesSignatureService.signForAEAT(
      xmlContent,
      certificateAlias,
      serviceType || 'H1_SUBMIT'
    );

    res.json({
      success: true,
      data: signedDocument
    });

  } catch (error) {
    logger.error('Error firmando documento:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error firmando documento'
    });
  }
};

/**
 * Verificar firma de respuesta AEAT
 * POST /api/aeat-real/signature/verify
 */
const verifySignature = async (req, res) => {
  try {
    const { signedXml } = req.body;

    if (!signedXml) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere XML firmado'
      });
    }

    const verification = await xadesSignatureService.verifyAEATResponse(signedXml);

    res.json({
      success: true,
      data: verification
    });

  } catch (error) {
    logger.error('Error verificando firma:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error verificando firma'
    });
  }
};

// ============================================
// ENVÍO DE DECLARACIONES (INTEGRACIÓN REAL AEAT)
// ============================================

/**
 * Enviar declaración H1 a AEAT (producción/sandbox)
 * POST /api/aeat-real/declarations/h1/submit
 */
const submitH1Declaration = async (req, res) => {
  try {
    const { expeditionId, certificateAlias, useSandbox } = req.body;

    if (!expeditionId || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere ID de expediente y certificado'
      });
    }

    const expedition = await Expedition.findById(expeditionId).populate('documents');
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    if (!expedition.declaration?.xmlContent) {
      return res.status(400).json({
        success: false,
        error: 'El expediente no tiene declaración generada'
      });
    }

    // Validación inteligente con LUCI antes del envío
    const preSubmitValidation = await aeatRealService.validateBeforeSubmit({
      declaration: expedition.declaration,
      goods: expedition.goods,
      transport: expedition.transport
    });

    if (!preSubmitValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validación pre-envío fallida',
        data: preSubmitValidation
      });
    }

    // Enviar a AEAT
    const result = await aeatRealService.submitH1Declaration(
      expedition.declaration.xmlContent,
      certificateAlias,
      { useSandbox: useSandbox !== false }
    );

    // Actualizar expediente con resultado
    expedition.declaration.status = result.success ? 'submitted' : 'submission_error';
    expedition.declaration.mrn = result.mrn;
    expedition.declaration.aeatResponse = result;
    expedition.declaration.submittedAt = new Date();

    expedition.timeline.push({
      action: 'declaration_submitted_aeat',
      description: result.success
        ? `Declaración enviada a AEAT. MRN: ${result.mrn}`
        : `Error enviando a AEAT: ${result.error}`,
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      metadata: {
        mrn: result.mrn,
        channel: result.channel,
        useSandbox
      }
    });

    await expedition.save();

    // Iniciar monitoreo de estado si el envío fue exitoso
    if (result.success && result.mrn) {
      await aeatStatusMonitorService.trackDeclaration(result.mrn, {
        expeditionId: expedition._id,
        declarationType: 'H1',
        userId: req.user?._id
      });
    }

    logger.info(`H1 enviado a AEAT: ${expedition.expeditionId}`, {
      mrn: result.mrn,
      success: result.success
    });

    res.json({
      success: true,
      data: {
        result,
        preSubmitValidation,
        expedition: {
          id: expedition._id,
          status: expedition.declaration.status
        }
      }
    });

  } catch (error) {
    logger.error('Error enviando H1 a AEAT:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando declaración a AEAT'
    });
  }
};

/**
 * Enviar declaración H7 a AEAT
 * POST /api/aeat-real/declarations/h7/submit
 */
const submitH7Declaration = async (req, res) => {
  try {
    const { expeditionId, certificateAlias, useSandbox } = req.body;

    if (!expeditionId || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere ID de expediente y certificado'
      });
    }

    const expedition = await Expedition.findById(expeditionId).populate('documents');
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    // Enviar a AEAT
    const result = await aeatRealService.submitH7Declaration(
      expedition.declaration.xmlContent,
      certificateAlias,
      { useSandbox: useSandbox !== false }
    );

    // Actualizar expediente
    expedition.declaration.status = result.success ? 'submitted' : 'submission_error';
    expedition.declaration.mrn = result.mrn;
    expedition.declaration.aeatResponse = result;

    expedition.timeline.push({
      action: 'h7_submitted_aeat',
      description: result.success
        ? `H7 enviado a AEAT. MRN: ${result.mrn}`
        : `Error enviando H7: ${result.error}`,
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      metadata: { mrn: result.mrn }
    });

    await expedition.save();

    // Iniciar monitoreo
    if (result.success && result.mrn) {
      await aeatStatusMonitorService.trackDeclaration(result.mrn, {
        expeditionId: expedition._id,
        declarationType: 'H7'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error enviando H7 a AEAT:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando H7'
    });
  }
};

/**
 * Enviar declaración AES (exportación) a AEAT
 * POST /api/aeat-real/declarations/aes/submit
 */
const submitAESDeclaration = async (req, res) => {
  try {
    const { expeditionId, certificateAlias, useSandbox } = req.body;

    if (!expeditionId || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere ID de expediente y certificado'
      });
    }

    const expedition = await Expedition.findById(expeditionId).populate('documents');
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const result = await aeatRealService.submitAESDeclaration(
      expedition.declaration.xmlContent,
      certificateAlias,
      { useSandbox: useSandbox !== false }
    );

    expedition.declaration.status = result.success ? 'submitted' : 'submission_error';
    expedition.declaration.mrn = result.mrn;
    expedition.declaration.aeatResponse = result;

    expedition.timeline.push({
      action: 'aes_submitted_aeat',
      description: result.success
        ? `AES enviado a AEAT. MRN: ${result.mrn}`
        : `Error enviando AES: ${result.error}`,
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema'
    });

    await expedition.save();

    if (result.success && result.mrn) {
      await aeatStatusMonitorService.trackDeclaration(result.mrn, {
        expeditionId: expedition._id,
        declarationType: 'AES'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error enviando AES a AEAT:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando AES'
    });
  }
};

/**
 * Enviar declaración NCTS (tránsito) a AEAT
 * POST /api/aeat-real/declarations/ncts/submit
 */
const submitNCTSDeclaration = async (req, res) => {
  try {
    const { expeditionId, certificateAlias, messageType, useSandbox } = req.body;

    if (!expeditionId || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere ID de expediente y certificado'
      });
    }

    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const result = await aeatRealService.submitNCTSDeclaration(
      expedition.declaration.xmlContent,
      certificateAlias,
      messageType || 'CC015C',
      { useSandbox: useSandbox !== false }
    );

    expedition.declaration.status = result.success ? 'submitted' : 'submission_error';
    expedition.declaration.mrn = result.mrn;
    expedition.declaration.aeatResponse = result;

    await expedition.save();

    if (result.success && result.mrn) {
      await aeatStatusMonitorService.trackDeclaration(result.mrn, {
        expeditionId: expedition._id,
        declarationType: 'NCTS'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error enviando NCTS a AEAT:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando NCTS'
    });
  }
};

/**
 * Enviar declaración ICS2 (seguridad)
 * POST /api/aeat-real/declarations/ics2/submit
 */
const submitICS2Declaration = async (req, res) => {
  try {
    const { expeditionId, certificateAlias, messageType, useSandbox } = req.body;

    if (!expeditionId || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere ID de expediente y certificado'
      });
    }

    const expedition = await Expedition.findById(expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const result = await aeatRealService.submitICS2Declaration(
      expedition.declaration.xmlContent,
      certificateAlias,
      messageType || 'CC315C',
      { useSandbox: useSandbox !== false }
    );

    expedition.declaration.status = result.success ? 'submitted' : 'submission_error';
    expedition.declaration.aeatResponse = result;

    await expedition.save();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error enviando ICS2 a AEAT:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando ICS2'
    });
  }
};

// ============================================
// CONSULTA DE ESTADO
// ============================================

/**
 * Consultar estado de declaración en AEAT
 * GET /api/aeat-real/declarations/:mrn/status
 */
const getDeclarationStatus = async (req, res) => {
  try {
    const { mrn } = req.params;
    const { certificateAlias, declarationType } = req.query;

    if (!certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere alias de certificado'
      });
    }

    const result = await aeatRealService.queryDeclarationStatus(
      mrn,
      certificateAlias,
      declarationType || 'H1'
    );

    // Análisis inteligente del estado con LUCI
    if (result.success) {
      const luciAnalysis = await aeatStatusMonitorService._analyzeStatusWithLuci(
        mrn,
        result.data
      );
      result.luciAnalysis = luciAnalysis;
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error consultando estado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error consultando estado'
    });
  }
};

/**
 * Obtener bandeja de entrada de AEAT
 * GET /api/aeat-real/inbox
 */
const getInbox = async (req, res) => {
  try {
    const { certificateAlias, messageType, fromDate, toDate } = req.query;

    if (!certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere alias de certificado'
      });
    }

    const result = await aeatRealService.getInbox(certificateAlias, {
      messageType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error obteniendo bandeja:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo bandeja'
    });
  }
};

// ============================================
// MONITOREO DE ESTADO CON LUCI
// ============================================

/**
 * Iniciar tracking de declaración
 * POST /api/aeat-real/monitoring/track
 */
const trackDeclaration = async (req, res) => {
  try {
    const { mrn, declarationType, expeditionId, metadata } = req.body;

    if (!mrn || !declarationType) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere MRN y tipo de declaración'
      });
    }

    const result = await aeatStatusMonitorService.trackDeclaration(mrn, {
      declarationType,
      expeditionId,
      userId: req.user?._id,
      ...metadata
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error iniciando tracking:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error iniciando tracking'
    });
  }
};

/**
 * Obtener declaraciones monitoreadas
 * GET /api/aeat-real/monitoring/tracked
 */
const getTrackedDeclarations = async (req, res) => {
  try {
    const tracked = await aeatStatusMonitorService.listTrackedDeclarations();

    res.json({
      success: true,
      data: tracked
    });

  } catch (error) {
    logger.error('Error obteniendo declaraciones:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo declaraciones'
    });
  }
};

/**
 * Refrescar estado de declaración
 * POST /api/aeat-real/monitoring/:mrn/refresh
 */
const refreshDeclarationStatus = async (req, res) => {
  try {
    const { mrn } = req.params;
    const { certificateAlias } = req.body;

    if (!certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere alias de certificado'
      });
    }

    const result = await aeatStatusMonitorService.refreshDeclarationStatus(
      mrn,
      certificateAlias
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error refrescando estado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error refrescando estado'
    });
  }
};

/**
 * Obtener alertas activas
 * GET /api/aeat-real/monitoring/alerts
 */
const getActiveAlerts = async (req, res) => {
  try {
    const { severity, unacknowledgedOnly } = req.query;

    const alerts = await aeatStatusMonitorService.getActiveAlerts({
      severity,
      unacknowledgedOnly: unacknowledgedOnly === 'true'
    });

    res.json({
      success: true,
      data: alerts
    });

  } catch (error) {
    logger.error('Error obteniendo alertas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo alertas'
    });
  }
};

/**
 * Confirmar alerta
 * POST /api/aeat-real/monitoring/alerts/:alertId/acknowledge
 */
const acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    aeatStatusMonitorService.acknowledgeAlert(alertId, req.user?._id);

    res.json({
      success: true,
      message: 'Alerta confirmada'
    });

  } catch (error) {
    logger.error('Error confirmando alerta:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error confirmando alerta'
    });
  }
};

/**
 * Predecir canal de inspección
 * POST /api/aeat-real/monitoring/predict-channel
 */
const predictInspectionChannel = async (req, res) => {
  try {
    const { operationData, goods, transport } = req.body;

    if (!operationData) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere datos de la operación'
      });
    }

    const prediction = await aeatStatusMonitorService.predictInspectionChannel({
      operationData,
      goods: goods || [],
      transport: transport || {}
    });

    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    logger.error('Error prediciendo canal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error prediciendo canal'
    });
  }
};

// ============================================
// DOCUMENTOS DIGITALES
// ============================================

/**
 * Enviar documentos digitales a AEAT
 * POST /api/aeat-real/documents/submit
 */
const submitDigitalDocuments = async (req, res) => {
  try {
    const { mrn, documents, certificateAlias } = req.body;

    if (!mrn || !documents || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere MRN, documentos y certificado'
      });
    }

    const result = await aeatRealService.submitDigitalDocuments(
      mrn,
      documents,
      certificateAlias
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error enviando documentos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando documentos'
    });
  }
};

// ============================================
// CONECTIVIDAD Y DIAGNÓSTICO
// ============================================

/**
 * Probar conectividad con AEAT
 * POST /api/aeat-real/connectivity/test
 */
const testConnectivity = async (req, res) => {
  try {
    const { certificateAlias, services } = req.body;

    if (!certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere alias de certificado'
      });
    }

    const result = await aeatRealService.testConnectivity(certificateAlias, {
      services: services || ['H1_STATUS', 'AES_STATUS']
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error probando conectividad:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error probando conectividad'
    });
  }
};

/**
 * Recargar certificado SSL para conexión AEAT
 * POST /api/aeat-real/reload-certificate
 */
const reloadSSLCertificate = async (req, res) => {
  try {
    const result = aeatRealService.reloadCertificate();

    logger.info('SSL Certificate reload requested', {
      success: result.success,
      user: req.user?.email
    });

    res.json({
      success: result.success,
      data: result,
      message: result.message
    });

  } catch (error) {
    logger.error('Error reloading SSL certificate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error reloading certificate'
    });
  }
};

/**
 * Obtener estado general del servicio AEAT
 * GET /api/aeat-real/service-status
 */
const getServiceStatus = async (req, res) => {
  try {
    // Obtener info del servicio que incluye SSL status
    const serviceInfo = aeatRealService.getInfo();

    const status = {
      environment: serviceInfo.environment,
      baseUrl: serviceInfo.baseUrl,
      services: Object.keys(aeatRealService.SERVICES).length,
      supportedDeclarations: serviceInfo.supportedDeclarations,
      sslStatus: serviceInfo.sslStatus,
      simulationMode: serviceInfo.simulationMode,
      certificatesLoaded: (await certificateService.listCertificates()).certificates?.length || 0,
      activeMonitoring: ((await aeatStatusMonitorService.listTrackedDeclarations?.()) || {}).total || 0,
      activeAlerts: aeatStatusMonitorService.alerts?.length || 0,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: {
        status,
        luciAnalysis: {
          message: 'Sistema AEAT operativo',
          recommendations: status.simulationMode
            ? ['El sistema está en modo simulación. Para conexión real, solicite autorización de IP a AEAT.']
            : ['Sistema listo para envío de declaraciones reales.']
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estado:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estado'
    });
  }
};

/**
 * Cambiar entorno (sandbox/producción)
 * POST /api/aeat-real/environment
 */
const setEnvironment = async (req, res) => {
  try {
    const { environment } = req.body;

    if (!['sandbox', 'production'].includes(environment)) {
      return res.status(400).json({
        success: false,
        error: 'Entorno debe ser sandbox o production'
      });
    }

    // Solo admins pueden cambiar a producción
    if (environment === 'production' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden usar producción'
      });
    }

    aeatRealService.currentEnvironment = environment;

    logger.info(`Entorno AEAT cambiado a: ${environment}`, {
      user: req.user?.email
    });

    res.json({
      success: true,
      data: {
        environment,
        baseUrl: aeatRealService.BASE_URLS[environment.toUpperCase()]
      }
    });

  } catch (error) {
    logger.error('Error cambiando entorno:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error cambiando entorno'
    });
  }
};

// ============================================
// IMPUESTOS ESPECIALES (SILICIE/EMCS)
// ============================================

/**
 * Enviar movimiento EMCS
 * POST /api/aeat-real/emcs/movement
 */
const submitEMCSMovement = async (req, res) => {
  try {
    const { xmlContent, certificateAlias, messageType, useSandbox } = req.body;

    if (!xmlContent || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere XML y certificado'
      });
    }

    const result = await aeatRealService.submitEMCSMovement(
      xmlContent,
      certificateAlias,
      messageType || 'IE801',
      { useSandbox: useSandbox !== false }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error enviando EMCS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error enviando EMCS'
    });
  }
};

/**
 * Consultar SILICIE
 * POST /api/aeat-real/silicie/query
 */
const querySILICIE = async (req, res) => {
  try {
    const { queryXml, certificateAlias } = req.body;

    if (!queryXml || !certificateAlias) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere XML de consulta y certificado'
      });
    }

    const result = await aeatRealService.querySILICIE(queryXml, certificateAlias);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error consultando SILICIE:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error consultando SILICIE'
    });
  }
};

module.exports = {
  // Certificados
  importCertificate,
  listCertificates,
  getCertificateInfo,
  verifyCertificate,
  deleteCertificate,
  validateCertificateForOperation,

  // Firma
  signDocument,
  verifySignature,

  // Declaraciones
  submitH1Declaration,
  submitH7Declaration,
  submitAESDeclaration,
  submitNCTSDeclaration,
  submitICS2Declaration,
  getDeclarationStatus,
  getInbox,

  // Monitoreo
  trackDeclaration,
  getTrackedDeclarations,
  refreshDeclarationStatus,
  getActiveAlerts,
  acknowledgeAlert,
  predictInspectionChannel,

  // Documentos
  submitDigitalDocuments,

  // Conectividad
  testConnectivity,
  getServiceStatus,
  setEnvironment,
  reloadSSLCertificate,

  // Impuestos especiales
  submitEMCSMovement,
  querySILICIE
};
