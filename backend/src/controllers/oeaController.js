/**
 * OEA Controller
 * Endpoints para gestion de Operador Economico Autorizado
 *
 * STRIX AI - LUCI Customs Agent
 */

const oeaService = require('../services/oeaService');
const logger = require('../config/logger');

/**
 * POST /api/oea
 * Crear nueva solicitud OEA
 */
exports.create = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user?.id || 'system';

    if (!data.organization?.nif || !data.organization?.eori || !data.certification?.type) {
      return res.status(400).json({
        success: false,
        error: 'organization.nif, organization.eori y certification.type son obligatorios'
      });
    }

    const validTypes = ['OEAC', 'OEAS', 'OEAF'];
    if (!validTypes.includes(data.certification.type)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de certificacion invalido. Valores permitidos: ${validTypes.join(', ')}`
      });
    }

    const oea = await oeaService.createApplication(data, userId);

    res.status(201).json({
      success: true,
      data: oea
    });

  } catch (error) {
    logger.error('[OEAController] Error in create:', error);
    res.status(error.message.includes('ya tiene') ? 409 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea
 * Listar certificaciones OEA
 */
exports.list = async (req, res) => {
  try {
    const { status, type, search, page, limit } = req.query;

    const result = await oeaService.list(
      { status, type, search },
      { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
    );

    // Handle both { oeas, total } and { data, pagination } formats
    const oeas = result.oeas || result.data || [];
    const total = result.total || result.pagination?.total || oeas.length;

    res.json({
      success: true,
      data: {
        oeas,
        total
      },
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('[OEAController] Error in list:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/stats
 * Obtener estadisticas de OEA
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await oeaService.getStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('[OEAController] Error in getStats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/expiring
 * Obtener certificaciones proximas a expirar
 */
exports.getExpiring = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const expiring = await oeaService.findExpiring(days);
    const expiringList = expiring || [];

    res.json({
      success: true,
      data: expiringList,
      count: expiringList.length
    });

  } catch (error) {
    logger.error('[OEAController] Error in getExpiring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/benefits
 * Obtener catalogo de beneficios
 */
exports.getBenefitsCatalog = async (req, res) => {
  try {
    const benefits = oeaService.getBenefitsCatalog();

    res.json({
      success: true,
      data: benefits
    });

  } catch (error) {
    logger.error('[OEAController] Error in getBenefitsCatalog:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/simplifications
 * Obtener simplificaciones disponibles
 */
exports.getSimplifications = async (req, res) => {
  try {
    const { type } = req.query;
    const simplifications = type
      ? oeaService.getSimplificationsForType(type)
      : oeaService.getSimplificationsCatalog();

    res.json({
      success: true,
      data: simplifications
    });

  } catch (error) {
    logger.error('[OEAController] Error in getSimplifications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/mutual-recognition
 * Obtener paises con reconocimiento mutuo
 */
exports.getMutualRecognition = async (req, res) => {
  try {
    const partners = oeaService.getMutualRecognitionPartners();

    res.json({
      success: true,
      data: partners
    });

  } catch (error) {
    logger.error('[OEAController] Error in getMutualRecognition:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/:id
 * Obtener OEA por ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const oea = await oeaService.getById(id);

    if (!oea) {
      return res.status(404).json({
        success: false,
        error: 'Certificacion OEA no encontrada'
      });
    }

    res.json({
      success: true,
      data: oea
    });

  } catch (error) {
    logger.error('[OEAController] Error in getById:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/eori/:eori
 * Obtener OEA por EORI
 */
exports.getByEORI = async (req, res) => {
  try {
    const { eori } = req.params;
    const oea = await oeaService.getByEORI(eori);

    if (!oea) {
      return res.status(404).json({
        success: false,
        error: 'No se encontro certificacion OEA para este EORI'
      });
    }

    res.json({
      success: true,
      data: oea
    });

  } catch (error) {
    logger.error('[OEAController] Error in getByEORI:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/nif/:nif
 * Obtener OEA por NIF
 */
exports.getByNIF = async (req, res) => {
  try {
    const { nif } = req.params;
    const oea = await oeaService.getByNIF(nif);

    if (!oea) {
      return res.status(404).json({
        success: false,
        error: 'No se encontro certificacion OEA para este NIF'
      });
    }

    res.json({
      success: true,
      data: oea
    });

  } catch (error) {
    logger.error('[OEAController] Error in getByNIF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/oea/:id
 * Actualizar OEA
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userId = req.user?.id || 'system';

    const oea = await oeaService.update(id, data, userId);

    res.json({
      success: true,
      data: oea
    });

  } catch (error) {
    logger.error('[OEAController] Error in update:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/submit
 * Enviar solicitud a revision
 */
exports.submitForReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'system';

    const oea = await oeaService.submitForReview(id, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Solicitud enviada a revision'
    });

  } catch (error) {
    logger.error('[OEAController] Error in submitForReview:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/approve
 * Aprobar certificacion OEA
 */
exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const approvalData = req.body;
    const userId = req.user?.id || 'system';

    if (!approvalData.approvedBy) {
      return res.status(400).json({
        success: false,
        error: 'approvedBy es obligatorio'
      });
    }

    const oea = await oeaService.approve(id, approvalData, userId);

    res.json({
      success: true,
      data: oea,
      message: `Certificacion ${oea.certification?.type} aprobada con numero ${oea.certification?.number}`
    });

  } catch (error) {
    logger.error('[OEAController] Error in approve:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/suspend
 * Suspender certificacion OEA
 */
exports.suspend = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || 'system';

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere motivo de suspension'
      });
    }

    const oea = await oeaService.suspend(id, reason, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Certificacion suspendida'
    });

  } catch (error) {
    logger.error('[OEAController] Error in suspend:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/revoke
 * Revocar certificacion OEA
 */
exports.revoke = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || 'system';

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere motivo de revocacion'
      });
    }

    const oea = await oeaService.revoke(id, reason, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Certificacion revocada'
    });

  } catch (error) {
    logger.error('[OEAController] Error in revoke:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/renewal/initiate
 * Iniciar proceso de renovacion
 */
exports.initiateRenewal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'system';

    const oea = await oeaService.initiateRenewal(id, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Proceso de renovacion iniciado'
    });

  } catch (error) {
    logger.error('[OEAController] Error in initiateRenewal:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/renewal/complete
 * Completar renovacion
 */
exports.completeRenewal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'system';

    const oea = await oeaService.completeRenewal(id, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Renovacion completada'
    });

  } catch (error) {
    logger.error('[OEAController] Error in completeRenewal:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/audit
 * Registrar auditoria
 */
exports.addAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const auditData = req.body;
    const userId = req.user?.id || 'system';

    if (!auditData.type || !auditData.result) {
      return res.status(400).json({
        success: false,
        error: 'type y result son obligatorios'
      });
    }

    const oea = await oeaService.addAudit(id, auditData, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Auditoria registrada'
    });

  } catch (error) {
    logger.error('[OEAController] Error in addAudit:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/oea/:id/requirements/:requirementKey
 * Actualizar estado de requisito
 */
exports.updateRequirement = async (req, res) => {
  try {
    const { id, requirementKey } = req.params;
    const { status, notes } = req.body;
    const userId = req.user?.id || 'system';

    const validStatuses = ['met', 'partial', 'not_met', 'not_applicable'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Estado invalido. Valores permitidos: ${validStatuses.join(', ')}`
      });
    }

    const oea = await oeaService.updateRequirement(id, requirementKey, status, notes, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Requisito actualizado'
    });

  } catch (error) {
    logger.error('[OEAController] Error in updateRequirement:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/compliance
 * Agregar registro de cumplimiento
 */
exports.addComplianceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const recordData = req.body;
    const userId = req.user?.id || 'system';

    if (!recordData.period?.year || !recordData.period?.quarter) {
      return res.status(400).json({
        success: false,
        error: 'period.year y period.quarter son obligatorios'
      });
    }

    const oea = await oeaService.addComplianceRecord(id, recordData, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Registro de cumplimiento agregado'
    });

  } catch (error) {
    logger.error('[OEAController] Error in addComplianceRecord:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/simplifications/:code
 * Otorgar simplificacion
 */
exports.grantSimplification = async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const userId = req.user?.id || 'system';

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'code es obligatorio'
      });
    }

    const oea = await oeaService.grantSimplification(id, code, userId);

    res.json({
      success: true,
      data: oea,
      message: `Simplificacion ${code} otorgada`
    });

  } catch (error) {
    logger.error('[OEAController] Error in grantSimplification:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/calculate-guarantee
 * Calcular reduccion de garantia para una operacion
 */
exports.calculateGuaranteeReduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere amount mayor que 0'
      });
    }

    const result = await oeaService.calculateGuaranteeReduction(id, amount);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[OEAController] Error in calculateGuaranteeReduction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/alerts/:alertId/acknowledge
 * Confirmar alerta
 */
exports.acknowledgeAlert = async (req, res) => {
  try {
    const { id, alertId } = req.params;
    const userId = req.user?.id || 'system';

    const oea = await oeaService.acknowledgeAlert(id, alertId, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Alerta confirmada'
    });

  } catch (error) {
    logger.error('[OEAController] Error in acknowledgeAlert:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/oea/:id/alerts/:alertId/resolve
 * Resolver alerta
 */
exports.resolveAlert = async (req, res) => {
  try {
    const { id, alertId } = req.params;
    const userId = req.user?.id || 'system';

    const oea = await oeaService.resolveAlert(id, alertId, userId);

    res.json({
      success: true,
      data: oea,
      message: 'Alerta resuelta'
    });

  } catch (error) {
    logger.error('[OEAController] Error in resolveAlert:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/oea/info
 * Informacion sobre el modulo OEA
 */
exports.getInfo = async (req, res) => {
  try {
    const info = {
      module: 'LUCI OEA Module',
      version: '1.0.0',
      description: 'Gestion de certificaciones de Operador Economico Autorizado',
      certificationTypes: {
        OEAC: {
          name: 'OEA Simplificaciones Aduaneras',
          description: 'Acceso a simplificaciones en procedimientos aduaneros',
          mainBenefits: [
            'Reduccion de garantias (30-50%)',
            'Despacho centralizado',
            'Menos controles aleatorios',
            'Tramitacion prioritaria'
          ]
        },
        OEAS: {
          name: 'OEA Seguridad y Proteccion',
          description: 'Reconocimiento como operador seguro en la cadena logistica',
          mainBenefits: [
            'Notificacion previa de controles',
            'Menos controles de seguridad',
            'Reconocimiento mutuo internacional',
            'Entrada prioritaria en UE'
          ]
        },
        OEAF: {
          name: 'OEA Completo (Full)',
          description: 'Combinacion de OEAC y OEAS',
          mainBenefits: [
            'Todos los beneficios OEAC',
            'Todos los beneficios OEAS',
            'Reduccion de garantias hasta 100%',
            'Maximo nivel de simplificacion'
          ]
        }
      },
      requirements: [
        'Cumplimiento de legislacion aduanera (3 anos sin infracciones graves)',
        'Sistema de gestion de registros comerciales y transporte',
        'Solvencia financiera demostrable',
        'Competencias profesionales en materia aduanera',
        'Normas de seguridad y proteccion (para OEAS/OEAF)'
      ],
      validityPeriod: '5 anos (renovable)',
      authority: 'AEAT - Departamento de Aduanas e Impuestos Especiales',
      legislation: [
        'Reglamento (UE) 952/2013 - Codigo Aduanero de la Union',
        'Reglamento Delegado (UE) 2015/2446',
        'Reglamento de Ejecucion (UE) 2015/2447'
      ]
    };

    res.json({
      success: true,
      data: info
    });

  } catch (error) {
    logger.error('[OEAController] Error in getInfo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
