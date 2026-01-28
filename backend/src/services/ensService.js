/**
 * ENS Declaration Service
 * Servicio para gestion de Declaraciones Sumarias de Entrada (ENS/ICS2)
 *
 * Funcionalidades:
 * - Creacion y validacion de declaraciones ENS
 * - Envio a AEAT via ICS2
 * - Rectificacion y anulacion
 * - Notificacion de llegada
 * - Procesamiento masivo
 * - Analisis de riesgo
 */
const { ENSDeclaration, Expedition } = require('../models');
const ensGenerator = require('./forms/ensGenerator');
const logger = require('../config/logger');

// Configuracion ENS
const ENS_CONFIG = {
  // Plazos segun modo de transporte (horas antes de llegada)
  submissionDeadlines: {
    ROAD: 1,   // 1 hora antes
    RAIL: 2,   // 2 horas antes
    AIR: 4,    // 4 horas antes (vuelos cortos) / 24h (vuelos largos)
    SEA: 24    // 24 horas antes
  },

  // Aduanas de entrada en Espana (principales)
  entryOffices: {
    'ES002801': { name: 'Algeciras', type: 'SEA' },
    'ES002802': { name: 'Barcelona', type: 'SEA' },
    'ES002803': { name: 'Valencia', type: 'SEA' },
    'ES002804': { name: 'Bilbao', type: 'SEA' },
    'ES004600': { name: 'Madrid Barajas', type: 'AIR' },
    'ES000801': { name: 'Barcelona El Prat', type: 'AIR' },
    'ES003001': { name: 'Irun', type: 'ROAD' },
    'ES001701': { name: 'La Junquera', type: 'ROAD' },
    'ES003201': { name: 'Canfranc', type: 'RAIL' },
    'ES001702': { name: 'Portbou', type: 'RAIL' }
  },

  // Paises con riesgo elevado
  highRiskCountries: ['AF', 'IQ', 'IR', 'KP', 'LY', 'SY', 'YE', 'SO', 'VE'],

  // Mercancias sensibles (primeros 4 digitos HS)
  sensitiveGoods: {
    '8703': 'Vehiculos - control de origen',
    '3004': 'Medicamentos - control AEMPS',
    '9302': 'Armas - autorizacion especial',
    '9303': 'Armas - autorizacion especial',
    '2402': 'Tabaco - IIEE',
    '2403': 'Tabaco - IIEE',
    '2208': 'Bebidas espirituosas - IIEE',
    '0106': 'Animales vivos - CITES/SOIVRE',
    '4403': 'Madera - FLEGT'
  }
};

class ENSService {

  /**
   * Crear declaracion ENS
   */
  async createDeclaration(data, userId) {
    try {
      // Validar datos basicos
      const preValidation = this.preValidate(data);
      if (!preValidation.valid) {
        return {
          success: false,
          errors: preValidation.errors,
          suggestions: preValidation.suggestions
        };
      }

      // Crear declaracion
      const declaration = new ENSDeclaration({
        ...data,
        createdBy: userId,
        status: 'draft'
      });

      // Calcular totales si hay houses
      if (declaration.houseConsignments.length > 0 || declaration.goods.length > 0) {
        declaration.calculateTotals();
      }

      // Validar para envio
      const validation = declaration.validateForSubmission();
      if (!validation.valid && !data.allowDraft) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      await declaration.save();

      logger.info(`ENS declaration created: ${declaration.reference}`);

      return {
        success: true,
        data: declaration
      };

    } catch (error) {
      logger.error('Error creating ENS declaration:', error);
      throw error;
    }
  }

  /**
   * Pre-validacion de datos
   */
  preValidate(data) {
    const errors = [];
    const suggestions = [];

    // Validar modo de transporte
    if (!data.transportMode) {
      errors.push({
        field: 'transportMode',
        code: 'ENS_TRANSPORT_MODE_REQUIRED',
        message: 'Modo de transporte es obligatorio'
      });
    }

    // Validar carrier EORI
    if (data.carrier?.eori && !/^[A-Z]{2}\w{1,15}$/.test(data.carrier.eori)) {
      errors.push({
        field: 'carrier.eori',
        code: 'ENS_INVALID_EORI',
        message: 'Formato EORI invalido (debe ser ES + hasta 15 caracteres)'
      });
    }

    // Validar aduana de entrada
    if (data.entryOffice?.code) {
      const office = ENS_CONFIG.entryOffices[data.entryOffice.code];
      if (office && data.transportMode && office.type !== data.transportMode) {
        suggestions.push({
          field: 'entryOffice.code',
          message: `Aduana ${office.name} es tipo ${office.type}, pero transporte es ${data.transportMode}`
        });
      }
    }

    // Verificar plazo de presentacion
    if (data.entryOffice?.expectedArrival && data.transportMode) {
      const deadline = ENS_CONFIG.submissionDeadlines[data.transportMode];
      const arrival = new Date(data.entryOffice.expectedArrival);
      const minSubmissionTime = new Date(arrival.getTime() - deadline * 60 * 60 * 1000);

      if (new Date() > minSubmissionTime) {
        errors.push({
          field: 'entryOffice.expectedArrival',
          code: 'ENS_DEADLINE_PASSED',
          message: `Para ${data.transportMode}, la ENS debe presentarse al menos ${deadline}h antes de la llegada`
        });
      }
    }

    // Verificar paises de alto riesgo
    if (data.consignment?.countryOfDispatch &&
        ENS_CONFIG.highRiskCountries.includes(data.consignment.countryOfDispatch)) {
      suggestions.push({
        field: 'consignment.countryOfDispatch',
        message: `Pais de expedicion ${data.consignment.countryOfDispatch} tiene riesgo elevado - posible control adicional`
      });
    }

    // Verificar mercancias sensibles
    const goods = data.goods || [];
    for (const item of goods) {
      if (item.commodityCode) {
        const hsPrefix = item.commodityCode.substring(0, 4);
        if (ENS_CONFIG.sensitiveGoods[hsPrefix]) {
          suggestions.push({
            field: 'goods.commodityCode',
            message: `Codigo ${item.commodityCode}: ${ENS_CONFIG.sensitiveGoods[hsPrefix]}`
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Validar declaracion completa
   */
  async validateDeclaration(data) {
    const declaration = new ENSDeclaration(data);
    const validation = declaration.validateForSubmission();

    // Pre-validacion adicional
    const preValidation = this.preValidate(data);

    return {
      valid: validation.valid && preValidation.valid,
      errors: [...validation.errors, ...preValidation.errors],
      suggestions: preValidation.suggestions
    };
  }

  /**
   * Enviar a AEAT
   */
  async submitToAEAT(declarationId, userId, certificateAlias) {
    const declaration = await ENSDeclaration.findById(declarationId);
    if (!declaration) {
      throw new Error('Declaracion no encontrada');
    }

    if (declaration.status !== 'draft' && declaration.status !== 'validated') {
      throw new Error(`No se puede enviar declaracion en estado ${declaration.status}`);
    }

    // Validar antes de enviar
    const validation = declaration.validateForSubmission();
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      // Generar XML
      const xmlResult = ensGenerator.generate(declaration, {
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      });

      if (!xmlResult.success) {
        return {
          success: false,
          error: 'Error generando XML',
          details: xmlResult.error
        };
      }

      // Guardar XML generado
      declaration.generatedXML = xmlResult.xml;

      // TODO: Enviar a AEAT real via aeatRealService
      // Por ahora simular respuesta
      const mrn = this.generateMRN('ENS');

      declaration.status = 'submitted';
      declaration.mrn = mrn;
      declaration.submittedAt = new Date();
      declaration.statusHistory.push({
        status: 'submitted',
        timestamp: new Date(),
        user: userId
      });

      // Simular respuesta AEAT
      declaration.aeatResponse = {
        code: '0000',
        message: 'Declaracion ENS aceptada',
        timestamp: new Date(),
        correlationId: `CORR-${Date.now()}`
      };

      // Simular asignacion de estado de riesgo
      const riskStatus = this.simulateRiskAssessment(declaration);
      declaration.riskAssessment = {
        status: riskStatus.status,
        riskScore: riskStatus.score,
        assessedAt: new Date(),
        doNotLoadList: riskStatus.dnl,
        dnlReason: riskStatus.dnlReason
      };

      if (riskStatus.status === 'ACK') {
        declaration.status = 'accepted';
      } else if (riskStatus.status === 'DNL') {
        declaration.status = 'dnl';
      }

      await declaration.save();

      logger.info(`ENS ${declaration.reference} submitted: MRN ${mrn}, Risk: ${riskStatus.status}`);

      return {
        success: true,
        data: {
          reference: declaration.reference,
          mrn,
          status: declaration.status,
          riskAssessment: declaration.riskAssessment
        }
      };

    } catch (error) {
      logger.error('Error submitting ENS to AEAT:', error);
      throw error;
    }
  }

  /**
   * Simular evaluacion de riesgo (para desarrollo)
   */
  simulateRiskAssessment(declaration) {
    let score = 0;
    let dnl = false;
    let dnlReason = null;

    // Factor: pais de expedicion
    if (ENS_CONFIG.highRiskCountries.includes(declaration.consignment?.countryOfDispatch)) {
      score += 40;
    }

    // Factor: mercancias sensibles
    const goods = declaration.goods || [];
    for (const item of goods) {
      const hsPrefix = item.commodityCode?.substring(0, 4);
      if (ENS_CONFIG.sensitiveGoods[hsPrefix]) {
        score += 20;
      }
    }

    // Factor: peso elevado
    if (declaration.consignment?.grossMass > 20000) {
      score += 10;
    }

    // Factor: nuevo transportista (simulado)
    if (Math.random() < 0.1) {
      score += 15;
    }

    // Determinar estado
    let status;
    if (score >= 70) {
      dnl = true;
      dnlReason = 'Alto riesgo - requiere verificacion adicional antes de carga';
      status = 'DNL';
    } else if (score >= 40) {
      status = 'HOLD';
    } else {
      status = 'ACK';
    }

    return {
      status,
      score: Math.min(100, score),
      dnl,
      dnlReason
    };
  }

  /**
   * Rectificar declaracion ENS
   */
  async amendDeclaration(declarationId, amendments, userId) {
    const declaration = await ENSDeclaration.findById(declarationId);
    if (!declaration) {
      throw new Error('Declaracion no encontrada');
    }

    const amendableStatuses = ['submitted', 'accepted'];
    if (!amendableStatuses.includes(declaration.status)) {
      throw new Error(`No se puede rectificar declaracion en estado ${declaration.status}`);
    }

    try {
      // Guardar MRN original si es primera rectificacion
      if (!declaration.amendment?.originalMRN) {
        declaration.amendment = {
          originalMRN: declaration.mrn,
          amendmentReason: amendments.reason,
          amendmentDetails: amendments.details,
          requestedAt: new Date()
        };
      }

      // Aplicar cambios
      const allowedFields = [
        'entryOffice', 'carrier', 'transportMeans', 'consignment',
        'consignor', 'consignee', 'houseConsignments', 'goods'
      ];

      for (const field of allowedFields) {
        if (amendments[field] !== undefined) {
          declaration[field] = amendments[field];
        }
      }

      // Recalcular totales
      declaration.calculateTotals();

      // Generar XML de rectificacion
      const xmlResult = ensGenerator.generateAmendment(declaration.mrn, amendments, {
        originalData: declaration.toObject()
      });

      declaration.generatedXML = xmlResult.xml;
      declaration.status = 'amendment_pending';
      declaration.statusHistory.push({
        status: 'amendment_pending',
        timestamp: new Date(),
        user: userId,
        reason: amendments.reason
      });

      // [DEMO] Simular aceptacion de rectificacion
      declaration.status = 'amended';
      declaration.amendment.processedAt = new Date();
      declaration.statusHistory.push({
        status: 'amended',
        timestamp: new Date(),
        reason: 'Rectificacion aceptada'
      });

      await declaration.save();

      logger.info(`ENS ${declaration.reference} amended`);

      return {
        success: true,
        data: declaration
      };

    } catch (error) {
      logger.error('Error amending ENS:', error);
      throw error;
    }
  }

  /**
   * Anular declaracion ENS
   */
  async cancelDeclaration(declarationId, reason, userId) {
    const declaration = await ENSDeclaration.findById(declarationId);
    if (!declaration) {
      throw new Error('Declaracion no encontrada');
    }

    const cancellableStatuses = ['draft', 'validated', 'submitted', 'accepted'];
    if (!cancellableStatuses.includes(declaration.status)) {
      throw new Error(`No se puede anular declaracion en estado ${declaration.status}`);
    }

    // Si ya tiene MRN, necesita anulacion formal
    if (declaration.mrn) {
      // Generar XML de anulacion
      const xmlResult = ensGenerator.generateCancellation(declaration.mrn, reason);
      declaration.generatedXML = xmlResult.xml;
    }

    declaration.status = 'cancelled';
    declaration.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      user: userId,
      reason: reason || 'Anulada por usuario'
    });

    await declaration.save();

    logger.info(`ENS ${declaration.reference} cancelled`);

    return {
      success: true,
      data: declaration
    };
  }

  /**
   * Notificar llegada
   */
  async notifyArrival(declarationId, arrivalData, userId) {
    const declaration = await ENSDeclaration.findById(declarationId);
    if (!declaration) {
      throw new Error('Declaracion no encontrada');
    }

    if (declaration.status !== 'accepted' && declaration.status !== 'amended') {
      throw new Error(`No se puede notificar llegada en estado ${declaration.status}`);
    }

    // Generar XML de notificacion de llegada
    const xmlResult = ensGenerator.generateArrivalNotification(declaration.mrn, arrivalData);

    declaration.arrival = {
      notifiedAt: new Date(),
      actualArrival: arrivalData.actualArrival || new Date(),
      presentationOffice: arrivalData.presentationOffice || declaration.entryOffice,
      unloadingPlace: arrivalData.unloadingPlace
    };

    declaration.generatedXML = xmlResult.xml;
    declaration.status = 'arrived';
    declaration.statusHistory.push({
      status: 'arrived',
      timestamp: new Date(),
      user: userId,
      reason: 'Llegada notificada'
    });

    // [DEMO] Simular levante automatico para bajo riesgo
    if (declaration.riskAssessment?.status === 'ACK') {
      declaration.status = 'released';
      declaration.statusHistory.push({
        status: 'released',
        timestamp: new Date(),
        reason: 'Levante automatico'
      });
    }

    await declaration.save();

    logger.info(`ENS ${declaration.reference} arrival notified`);

    return {
      success: true,
      data: declaration
    };
  }

  /**
   * Procesar respuesta de analisis de riesgo de AEAT
   */
  async processRiskResponse(mrn, riskData) {
    const declaration = await ENSDeclaration.findOne({ mrn });
    if (!declaration) {
      logger.warn(`ENS not found for MRN: ${mrn}`);
      return { success: false, error: 'Declaration not found' };
    }

    declaration.riskAssessment = {
      status: riskData.status,
      assessedAt: new Date(),
      riskScore: riskData.riskScore,
      doNotLoadList: riskData.dnl || false,
      dnlReason: riskData.dnlReason
    };

    if (riskData.controlDecisions) {
      declaration.riskAssessment.controlDecisions = riskData.controlDecisions.map(cd => ({
        code: cd.code,
        description: cd.description,
        requestedAt: new Date(),
        deadline: cd.deadline
      }));
    }

    // Actualizar estado segun resultado de riesgo
    if (riskData.status === 'DNL') {
      declaration.status = 'dnl';
    } else if (riskData.status === 'ACK') {
      declaration.status = 'accepted';
    }

    declaration.statusHistory.push({
      status: declaration.status,
      timestamp: new Date(),
      reason: `Risk assessment: ${riskData.status}`,
      aeatCode: riskData.responseCode
    });

    await declaration.save();

    return { success: true, data: declaration };
  }

  /**
   * Buscar por contenedor
   */
  async getByContainer(containerNumber, userId) {
    const query = { 'consignment.containerNumber': { $regex: containerNumber, $options: 'i' } };

    // Filtrar por usuario si no es admin
    // En produccion, verificar rol del usuario
    const declarations = await ENSDeclaration.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return {
      success: true,
      data: declarations,
      count: declarations.length
    };
  }

  /**
   * Buscar por conocimiento (B/L, AWB, CMR)
   */
  async getByBillOfLading(bol, userId) {
    const declarations = await ENSDeclaration.find({
      $or: [
        { 'consignment.referenceNumber': { $regex: bol, $options: 'i' } },
        { 'houseConsignments.referenceNumber': { $regex: bol, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 }).limit(50);

    return {
      success: true,
      data: declarations,
      count: declarations.length
    };
  }

  /**
   * Obtener estadisticas
   */
  async getStats(filters = {}) {
    return ENSDeclaration.getStats(filters);
  }

  /**
   * Procesar lote de declaraciones ENS
   */
  async processBatch(declarations, userId, options = {}) {
    const batchId = `ENSBATCH-${Date.now()}`;
    const results = {
      batchId,
      total: declarations.length,
      successful: 0,
      failed: 0,
      declarations: []
    };

    for (let i = 0; i < declarations.length; i++) {
      try {
        const data = {
          ...declarations[i],
          allowDraft: true // Permitir guardar con errores en batch
        };

        const result = await this.createDeclaration(data, userId);

        if (result.success) {
          results.successful++;
          results.declarations.push({
            sequence: i + 1,
            reference: result.data.reference,
            lrn: data.lrn || result.data.lrn,
            status: 'created'
          });

          // Auto-submit si se especifica
          if (options.autoSubmit) {
            const submitResult = await this.submitToAEAT(
              result.data._id,
              userId,
              options.certificateAlias
            );

            if (submitResult.success) {
              results.declarations[results.declarations.length - 1].mrn = submitResult.data.mrn;
              results.declarations[results.declarations.length - 1].status = 'submitted';
            }
          }

        } else {
          results.failed++;
          results.declarations.push({
            sequence: i + 1,
            lrn: data.lrn,
            status: 'failed',
            errors: result.errors
          });
        }

      } catch (error) {
        results.failed++;
        results.declarations.push({
          sequence: i + 1,
          status: 'error',
          error: error.message
        });
      }
    }

    logger.info(`ENS Batch ${batchId}: ${results.successful}/${results.total} successful`);
    return results;
  }

  /**
   * Generar MRN
   */
  generateMRN(type = 'ENS') {
    const year = new Date().getFullYear().toString().substring(2);
    const country = 'ES';
    const random = Math.random().toString().substring(2, 16).padEnd(14, '0');
    return `${year}${country}${random}${type.substring(0, 2)}`;
  }

  /**
   * Obtener aduanas de entrada disponibles
   */
  getEntryOffices(transportMode = null) {
    if (transportMode) {
      return Object.entries(ENS_CONFIG.entryOffices)
        .filter(([_, office]) => office.type === transportMode)
        .map(([code, office]) => ({ code, ...office }));
    }
    return Object.entries(ENS_CONFIG.entryOffices)
      .map(([code, office]) => ({ code, ...office }));
  }

  /**
   * Obtener plazos de presentacion
   */
  getSubmissionDeadlines() {
    return ENS_CONFIG.submissionDeadlines;
  }
}

module.exports = new ENSService();
