/**
 * PUE Controller
 * Controlador para gestion de solicitudes PUE (ROHS, COM, ECO, CAL)
 */

const pueService = require('../services/pueService');
const pueGenerator = require('../services/forms/pueGenerator');
const aiService = require('../services/aiService');
const { PUERequest } = require('../models');
const logger = require('../config/logger');
const { ensureSameTenant } = require('../utils/tenantGuard');

/**
 * GET /api/pue/stats
 * Obtener estadisticas PUE
 */
exports.getStats = async (req, res) => {
  try {
    const { startDate, endDate, pueType } = req.query;
    const stats = await pueService.getStats({
      startDate,
      endDate,
      pueType,
      createdBy: req.user?.role !== 'admin' ? req.user?._id : null
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/types
 * Obtener tipos de PUE disponibles
 */
exports.getTypes = async (req, res) => {
  try {
    const types = pueService.getTypes();
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/soivre-offices
 * Obtener oficinas SOIVRE
 */
exports.getSoivreOffices = async (req, res) => {
  try {
    const { province } = req.query;
    const offices = pueService.getSoivreOffices(province);
    res.json({
      success: true,
      data: offices
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting SOIVRE offices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/required-documents/:type
 * Obtener documentos requeridos por tipo PUE
 */
exports.getRequiredDocuments = async (req, res) => {
  try {
    const { type } = req.params;
    const documents = pueService.getRequiredDocuments(type);

    if (!documents.length) {
      return res.status(404).json({
        success: false,
        error: `Tipo PUE no encontrado: ${type}`
      });
    }

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting required documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/validate
 * Validar datos sin crear solicitud
 */
exports.validate = async (req, res) => {
  try {
    const validation = await pueService.preValidate(req.body);
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error('PUE Controller: Error validating:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/check-taric
 * Verificar codigos TARIC para controles PUE
 */
exports.checkTaric = async (req, res) => {
  try {
    const { taricCodes } = req.body;

    if (!taricCodes || !Array.isArray(taricCodes)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de codigos TARIC'
      });
    }

    const results = pueService.checkTaricCodes(taricCodes);
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('PUE Controller: Error checking TARIC:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/batch
 * Procesamiento masivo de solicitudes
 */
exports.processBatch = async (req, res) => {
  try {
    const { requests, autoSubmit, certificateAlias } = req.body;

    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de solicitudes'
      });
    }

    const results = await pueService.processBatch(requests, req.user._id, {
      autoSubmit,
      certificateAlias
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('PUE Controller: Error processing batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/expedition/:id
 * Obtener solicitudes PUE por expedicion
 */
exports.getByExpedition = async (req, res) => {
  try {
    const { id } = req.params;
    const requests = await PUERequest.findByExpedition(id);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting by expedition:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/declaration/:mrn
 * Obtener solicitudes PUE por MRN de declaracion
 */
exports.getByDeclaration = async (req, res) => {
  try {
    const { mrn } = req.params;
    const requests = await PUERequest.findByDeclaration(mrn);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting by declaration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue
 * Listar solicitudes PUE
 */
exports.list = async (req, res) => {
  try {
    const filters = {
      ...req.query,
      createdBy: req.user?.role !== 'admin' ? req.user?._id : req.query.createdBy
    };

    const result = await pueService.list(filters);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('PUE Controller: Error listing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue
 * Crear nueva solicitud PUE
 */
exports.create = async (req, res) => {
  try {
    // El tenant se toma del usuario autenticado, nunca del body: sin esto la
    // solicitud nace sin tenantId y ensureSameTenant la dejaria pasar desde
    // cualquier tenant (permite documentos sin tenant por compatibilidad).
    const result = await pueService.createRequest(
      { ...req.body, tenantId: req.user.tenantId }, req.user._id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error creating:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/:id
 * Obtener solicitud PUE por ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await pueService.getById(id);

    // Sin este guard cualquier usuario autenticado podia leer la solicitud PUE
    // de otro tenant conociendo su id: getById delega en un findById plano sin
    // acotar por tenant. Misma fuga que ya se detecto en getAiAnalysis del
    // expedienteController. ensureSameTenant responde 404 si no existe o si es
    // de otro tenant (y deja pasar al super admin).
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting by ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/pue/:id
 * Actualizar solicitud PUE
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pueService.update(id, req.body, req.user._id);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error updating:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/submit
 * Enviar solicitud a AEAT
 */
exports.submit = async (req, res) => {
  try {
    const { id } = req.params;
    const { certificateAlias } = req.body;

    const result = await pueService.submitToAEAT(id, req.user._id, certificateAlias);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error submitting:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/cancel
 * Cancelar solicitud PUE
 */
exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Motivo de cancelacion requerido'
      });
    }

    const result = await pueService.cancelRequest(id, reason, req.user._id);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error cancelling:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/document
 * Agregar documento a solicitud
 */
exports.addDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pueService.addDocument(id, req.body, req.user._id);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error adding document:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/inspection/schedule
 * Programar inspeccion
 */
exports.scheduleInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pueService.scheduleInspection(id, req.body, req.user._id);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error scheduling inspection:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/inspection/result
 * Registrar resultado de inspeccion
 */
exports.recordInspectionResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pueService.recordInspectionResult(id, req.body, req.user._id);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error recording inspection result:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/certificate
 * Emitir certificado
 */
exports.issueCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pueService.issueCertificate(id, req.body, req.user._id);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('PUE Controller: Error issuing certificate:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/link-declaration
 * Vincular a declaracion aduanera
 */
exports.linkToDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { mrn } = req.body;

    if (!mrn) {
      return res.status(400).json({
        success: false,
        error: 'MRN de declaracion requerido'
      });
    }

    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    request.declarationMRN = mrn;
    request.statusHistory.push({
      status: request.status,
      timestamp: new Date(),
      user: req.user._id,
      reason: `Vinculada a declaracion ${mrn}`
    });
    await request.save();

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('PUE Controller: Error linking to declaration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/:id/status
 * Consultar estado en AEAT
 */
exports.queryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    if (!request.pueReference) {
      return res.status(400).json({
        success: false,
        error: 'Solicitud no ha sido enviada a AEAT'
      });
    }

    const status = await pueService.queryStatus(request.pueReference);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('PUE Controller: Error querying status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/:id/xml
 * Obtener XML generado
 */
exports.getXML = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    // Generate fresh XML if not present or requested
    const xml = req.query.regenerate === 'true' || !request.generatedXML
      ? pueGenerator.generate(request)
      : request.generatedXML;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    logger.error('PUE Controller: Error getting XML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/info
 * Obtener informacion del servicio
 */
exports.getInfo = async (req, res) => {
  try {
    const info = pueService.getInfo();
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/deadlines
 * Obtener proximos vencimientos
 */
exports.getUpcomingDeadlines = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const requests = await PUERequest.getUpcomingDeadlines(parseInt(days));

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting deadlines:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/pue/required-controls
 * Determinar controles PUE requeridos para mercancias
 */
exports.getRequiredControls = async (req, res) => {
  try {
    const { goods } = req.body;

    if (!goods || !Array.isArray(goods)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de mercancias'
      });
    }

    const required = pueService.getRequiredPUE(goods);

    res.json({
      success: true,
      data: required
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting required controls:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===========================================
// PHASE 5: SOIVRE OVERHAUL ENDPOINTS
// ===========================================

/**
 * GET /api/pue/catalogs/all
 * Obtener todos los catalogos SOIVRE de una vez
 */
exports.getAllCatalogs = async (req, res) => {
  try {
    const catalogs = pueService.getAllCatalogs();
    res.json({
      success: true,
      data: catalogs
    });
  } catch (error) {
    logger.error('PUE Controller: Error getting catalogs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/pue/catalogs/specificities/:flowType
 * Obtener especificidades por tipo de flujo
 */
exports.getSpecificities = async (req, res) => {
  try {
    const { flowType } = req.params;
    const data = pueService.getSpecificities(flowType);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('PUE Controller: Error getting specificities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/pue/catalogs/centers
 * Obtener centros SOIVRE (CodCice)
 */
exports.getCenters = async (req, res) => {
  try {
    const data = pueService.getSoivreCenters();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('PUE Controller: Error getting centers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/pue/catalogs/inspection-points/:code
 * Obtener puntos de inspeccion por centro
 */
exports.getInspectionPoints = async (req, res) => {
  try {
    const { code } = req.params;
    const data = pueService.getInspectionPoints(code);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('PUE Controller: Error getting inspection points:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/pue/catalogs/units
 * Obtener unidades de mercancia
 */
exports.getUnits = async (req, res) => {
  try {
    const data = pueService.getMerchandiseUnits();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('PUE Controller: Error getting units:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/pue/catalogs/certificate-types
 * Obtener tipos de certificado
 */
exports.getCertificateTypes = async (req, res) => {
  try {
    const data = pueService.getCertificateTypes();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('PUE Controller: Error getting certificate types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/pue/lookup-mrn
 * Buscar declaracion por MRN + Clave Zeta y extraer datos
 */
exports.lookupMRN = async (req, res) => {
  try {
    const { mrn, claveZeta } = req.body;

    if (!mrn) {
      return res.status(400).json({
        success: false,
        error: 'MRN es obligatorio'
      });
    }

    if (!claveZeta) {
      return res.status(400).json({
        success: false,
        error: 'Clave Zeta (numero de partida) es obligatorio'
      });
    }

    const result = await pueService.lookupMRN(mrn, claveZeta);
    res.json(result);
  } catch (error) {
    logger.error('PUE Controller: Error looking up MRN:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/pue/validate-rii
 * Validar RII (Registro Integrado Industrial) por NIF
 */
exports.validateRII = async (req, res) => {
  try {
    const { nif } = req.body;

    if (!nif) {
      return res.status(400).json({
        success: false,
        error: 'NIF/CIF del importador es obligatorio'
      });
    }

    const result = await pueService.validateRII(nif);
    res.json(result);
  } catch (error) {
    logger.error('PUE Controller: Error validating RII:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ===========================================
// AI-POWERED ENDPOINTS
// ===========================================

/**
 * POST /api/pue/ai/determine-type
 * Determinar tipo(s) de PUE requeridos con IA
 */
exports.aiDetermineType = async (req, res) => {
  try {
    const { goods, context } = req.body;

    if (!goods || !Array.isArray(goods) || goods.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de mercancias'
      });
    }

    // Analisis con IA
    const analysis = await aiService.determinePUEType(goods, context || {});

    res.json({
      success: true,
      message: 'Analisis IA completado',
      data: analysis
    });

  } catch (error) {
    logger.error('PUE Controller: Error in AI type determination:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/ai/analyze-goods
 * Analizar mercancia especifica para requisitos PUE
 */
exports.aiAnalyzeGoods = async (req, res) => {
  try {
    const { description, taricCode } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere descripcion de la mercancia'
      });
    }

    const analysis = await aiService.analyzeGoodsForPUE(description, taricCode);

    res.json({
      success: true,
      message: 'Analisis de mercancia completado',
      data: analysis
    });

  } catch (error) {
    logger.error('PUE Controller: Error in AI goods analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/ai/predict-inspection
 * Predecir resultado de inspeccion PUE
 */
exports.aiPredictInspection = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    // Obtener historial del operador
    let operatorHistory = null;
    if (request.operator?.eori) {
      const previousRequests = await PUERequest.find({
        'operator.eori': request.operator.eori,
        status: { $in: ['approved', 'approved_conditions', 'rejected'] }
      }).limit(50);

      const approved = previousRequests.filter(r =>
        ['approved', 'approved_conditions'].includes(r.status)
      ).length;

      operatorHistory = {
        totalRequests: previousRequests.length,
        approvalRate: previousRequests.length > 0
          ? ((approved / previousRequests.length) * 100).toFixed(1)
          : null
      };
    }

    // Agregar historial a la solicitud para el analisis
    const requestWithHistory = {
      ...request.toObject(),
      operatorHistory
    };

    const prediction = await aiService.predictInspectionOutcome(requestWithHistory);

    res.json({
      success: true,
      message: 'Prediccion generada',
      data: {
        ...prediction,
        operatorHistory
      }
    });

  } catch (error) {
    logger.error('PUE Controller: Error in AI inspection prediction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/ai/suggest-documents
 * Sugerir documentos necesarios para PUE
 */
exports.aiSuggestDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    const suggestions = await aiService.suggestPUEDocuments(request);

    res.json({
      success: true,
      message: 'Sugerencias de documentos generadas',
      data: suggestions
    });

  } catch (error) {
    logger.error('PUE Controller: Error in AI document suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/ai/recommendations
 * Generar recomendaciones para aprobar inspeccion
 */
exports.aiGetRecommendations = async (req, res) => {
  try {
    const { id } = req.params;
    const { inspectionType = 'documental' } = req.body;

    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    const recommendations = await aiService.generatePUERecommendations(request, inspectionType);

    res.json({
      success: true,
      message: 'Recomendaciones generadas',
      data: recommendations
    });

  } catch (error) {
    logger.error('PUE Controller: Error in AI recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/pue/:id/ai/full-analysis
 * Analisis completo con IA (tipo, documentos, prediccion, recomendaciones)
 */
exports.aiFullAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await PUERequest.findById(id);
    // Sin esto se podria operar sobre la solicitud PUE de otro tenant
    // conociendo su id. ensureSameTenant ya responde 404 si no existe.
    if (!ensureSameTenant(request, req, res, { resource: 'Solicitud' })) return;

    // Ejecutar todos los analisis en paralelo
    const [prediction, documents, recommendations] = await Promise.all([
      aiService.predictInspectionOutcome(request),
      aiService.suggestPUEDocuments(request),
      aiService.generatePUERecommendations(request, 'documental')
    ]);

    // Calcular puntuacion global
    const overallScore = Math.round(
      (prediction.predictions?.approved || 50) * 0.4 +
      (documents.completenessScore || 50) * 0.3 +
      (recommendations.overallReadiness || 50) * 0.3
    );

    res.json({
      success: true,
      message: 'Analisis completo generado',
      data: {
        prediction,
        documents,
        recommendations,
        summary: {
          overallScore,
          readyForSubmission: overallScore >= 70,
          criticalIssues: [
            ...(documents.requiredDocuments?.filter(d => d.priority === 'CRITICAL') || []),
            ...(prediction.riskFactors?.filter(r => r.severity === 'HIGH') || [])
          ],
          topRecommendations: (recommendations.checklist || [])
            .filter(c => c.priority === 'HIGH')
            .slice(0, 5)
        }
      }
    });

  } catch (error) {
    logger.error('PUE Controller: Error in AI full analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
