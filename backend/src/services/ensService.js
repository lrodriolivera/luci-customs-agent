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
const aeatSubmitService = require('./aeat/aeatSubmitService');
const ics2Service = require('./ics2/ics2Service');
const logger = require('../config/logger');
// Catalogo unico de aduanas de entrada, compartido con el frontend.
const { getEntryOffice, listEntryOffices } = require('../config/entryOffices');

/**
 * Carga una declaracion ENS comprobando que pertenece a quien la pide.
 * Las escrituras (submitToAEAT, amend, cancel, notifyArrival) pasaban el id
 * directo sin mirar createdBy. Mismo error que cuando no existe, para no
 * confirmar ids de otra cuenta. Sin userId (jobs) no se comprueba.
 */
async function _loadOwnedENS(id, userId) {
  const doc = await ENSDeclaration.findById(id);
  if (!doc) {
    throw new Error('Declaracion no encontrada');
  }
  if (userId && doc.createdBy && String(doc.createdBy) !== String(userId)) {
    throw new Error('Declaracion no encontrada');
  }
  return doc;
}


// Configuracion ENS
const ENS_CONFIG = {
  // Plazos segun modo de transporte (horas antes de llegada)
  submissionDeadlines: {
    ROAD: 1,   // 1 hora antes
    RAIL: 2,   // 2 horas antes
    AIR: 4,    // 4 horas antes (vuelos cortos) / 24h (vuelos largos)
    SEA: 24    // 24 horas antes
  },

  // Las aduanas de entrada ya NO viven aqui: estaban duplicadas en el
  // formulario del frontend y en aeatConfig, con los mismos codigos
  // significando aduanas distintas. Fuente unica: config/entryOffices.js.

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

      // Completar campos que el formulario no envia pero el schema requiere
      const modeMap = { 'RAIL': '2', 'ROAD': '3', 'AIR': '4', 'SEA': '1' };
      if (!data.transportMeans) data.transportMeans = {};
      if (!data.transportMeans.modeAtBorder) {
        data.transportMeans.modeAtBorder = modeMap[data.transportMode] || data.transportMode || '3';
      }
      if (!data.transportMeans.identificationType) {
        const idTypeMap = { 'RAIL': 'TRAIN_NUMBER', 'ROAD': 'VEHICLE_REGISTRATION', 'AIR': 'FLIGHT_NUMBER', 'SEA': 'VESSEL_IMO' };
        data.transportMeans.identificationType = idTypeMap[data.transportMode] || 'VEHICLE_REGISTRATION';
      }
      if (!data.transportMeans.identification && data.carrier?.vehicleId) {
        data.transportMeans.identification = data.carrier.vehicleId;
      }
      // carrier.name: si tiene EORI pero no nombre, poner placeholder
      if (data.carrier?.eori && !data.carrier.name) {
        data.carrier.name = data.carrier.eori;
      }
      // Generar LRN si no existe
      if (!data.lrn) {
        const ts = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
        data.lrn = `LUCI${ts}${rnd}`;
      }
      // Completar goods: sequenceNumber y commodityCode desde taricCode. NO se rellena
      // con un codigo inventado: AEAT rechaza la ENS completa con CC316A ("Combined
      // Nomenclature is not valid"), asi que un relleno solo esconde el dato que falta
      // hasta el momento de presentar. Sin codigo, el required del modelo la rechaza.
      if (data.goods && data.goods.length > 0) {
        data.goods.forEach((g, i) => {
          if (!g.sequenceNumber) g.sequenceNumber = i + 1;
          if (!g.commodityCode && g.taricCode) g.commodityCode = g.taricCode;
        });
      }

      // Obtener tenantId del usuario
      const User = require('../models/User');
      const user = await User.findById(userId).select('tenantId').lean();

      // Crear declaracion
      const declaration = new ENSDeclaration({
        ...data,
        createdBy: userId,
        tenantId: data.tenantId || user?.tenantId,
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

    // Validar aduana de entrada contra el catalogo unico.
    //
    // Antes se buscaba en una lista interna que no coincidia con la del
    // formulario: si el codigo no estaba (caso de ES009999, la de PRE), `office`
    // salia undefined y esta comprobacion se saltaba en silencio. Ahora un
    // codigo desconocido es un error explicito.
    if (data.entryOffice?.code) {
      const office = getEntryOffice(data.entryOffice.code);
      if (!office) {
        errors.push({
          field: 'entryOffice.code',
          code: 'ENS_UNKNOWN_ENTRY_OFFICE',
          message: `Aduana de entrada ${data.entryOffice.code} no existe en el catalogo`
        });
      } else if (data.transportMode && !office.modes.includes(data.transportMode)) {
        suggestions.push({
          field: 'entryOffice.code',
          message: `La aduana ${office.name} (${office.code}) admite ${office.modes.join('/')}, pero el transporte es ${data.transportMode}`
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

    // Verificar mercancias sensibles y exigir codigo de mercancia real. AEAT rechaza
    // la ENS entera con CC316A ("Combined Nomenclature is not valid") si el codigo es
    // inventado, asi que se pide aqui en vez de rellenarlo: el required del modelo
    // lanzaria una ValidationError de Mongoose en lugar de un error estructurado.
    const goods = data.goods || [];
    goods.forEach((item, i) => {
      const codigo = item.commodityCode || item.taricCode;
      if (!codigo) {
        errors.push({
          field: `goods.${i}.commodityCode`,
          code: 'ENS_COMMODITY_CODE_REQUIRED',
          message: 'Codigo de mercancia (TARIC/HS) es obligatorio'
        });
      } else if (!/^\d{6,10}$/.test(codigo)) {
        errors.push({
          field: `goods.${i}.commodityCode`,
          code: 'ENS_COMMODITY_CODE_INVALID',
          message: `Codigo de mercancia invalido (${codigo}): debe tener entre 6 y 10 digitos`
        });
      } else {
        const hsPrefix = codigo.substring(0, 4);
        if (ENS_CONFIG.sensitiveGoods[hsPrefix]) {
          suggestions.push({
            field: 'goods.commodityCode',
            message: `Codigo ${codigo}: ${ENS_CONFIG.sensitiveGoods[hsPrefix]}`
          });
        }
      }
    });

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
    const declaration = await _loadOwnedENS(declarationId, userId);

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
      // Enrutar por modo de transporte:
      //  - Ferrocarril (RAIL): canal legacy AEAT (IE315V5 / CC315A). Verificado contra PRE.
      //  - Marítimo / Aéreo / Carretera: ICS2 (sistema UE). La AEAT rechaza estos modos
      //    por el legacy con error 92 (fase 4 ICS2, 2026). Ver services/ics2/ics2Service.js.
      let aeatResult;
      if (ics2Service.requiereICS2(declaration.transportMode)) {
        aeatResult = await ics2Service.submitENSviaICS2(declaration);
      } else {
        // Enviar a AEAT real via aeatSubmitService (usa ensXmlBuilder con formato legacy CC315A)
        aeatResult = await aeatSubmitService.submitENS(declaration);
      }

      // El XML REALMENTE enviado a AEAT. Antes se guardaba aqui el literal
      // 'Enviado via aeatSubmitService', asi que de una ENS presentada con MRN real
      // no quedaba constancia de QUE se declaro y GET /:id/xml devolvia esa nota.
      // Se guarda tambien cuando AEAT rechaza: es el documento con el que se
      // diagnostica el rechazo. ICS2 no envia nada todavia y no aporta XML.
      if (aeatResult.requestXML) {
        declaration.generatedXML = aeatResult.requestXML;
      }

      if (!aeatResult.success) {
        logger.warn(`[ENS] AEAT rechazo: code=${aeatResult.code}, error=${aeatResult.error}`);
        // Persistir el XML enviado aunque el envio se rechace: sin este save() el
        // rechazo no dejaba rastro y no habia con que diagnosticarlo. El estado NO
        // avanza (sigue draft/validated), asi que se puede corregir y reenviar.
        await declaration.save();
        return {
          success: false,
          error: aeatResult.error || 'Error en respuesta AEAT',
          details: aeatResult
        };
      }

      declaration.status = 'submitted';
      declaration.mrn = aeatResult.mrn;
      declaration.submittedAt = new Date();
      declaration.statusHistory.push({
        status: 'submitted',
        timestamp: new Date(),
        user: userId
      });

      declaration.aeatResponse = {
        code: aeatResult.code,
        message: aeatResult.estado || 'Declaracion ENS enviada',
        timestamp: new Date(),
        csv: aeatResult.csv
      };

      // El CC328A acusa el REGISTRO de la ENS, no su analisis de riesgo: AEAT
      // comunica el circuito (ACK / HOLD / DNL) mas tarde y en otro mensaje, que
      // se procesa en processRiskResponse(). Escribir aqui `status: 'ACK'` hacia
      // que la ficha mostrase "Analisis de Riesgo: Aceptada" y "DNL: NO" sobre un
      // analisis que AEAT no habia comunicado. El riesgo queda en PENDING.
      if (aeatResult.success) {
        declaration.status = 'accepted';
      }

      await declaration.save();

      logger.info(`ENS ${declaration.reference} submitted: MRN ${aeatResult.mrn}`);

      return {
        success: true,
        data: {
          reference: declaration.reference,
          mrn: aeatResult.mrn,
          status: declaration.status,
          riskAssessment: declaration.riskAssessment
        }
      };

    } catch (error) {
      logger.error('Error submitting ENS to AEAT:', error);
      throw error;
    }
  }

  // Aqui vivia simulateRiskAssessment(): un generador de circuito aduanero con
  // `Math.random()` y sin un solo llamante. Se elimina en lugar de dejarlo a mano:
  // el unico origen legitimo de `riskAssessment` es processRiskResponse() con un
  // mensaje de AEAT. Las sugerencias de riesgo informativas siguen en preValidate().

  /**
   * Rectificar declaracion ENS
   */
  async amendDeclaration(declarationId, amendments, userId) {
    const declaration = await _loadOwnedENS(declarationId, userId);

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

      // Aqui se genera el IE313 pero NO se envia: quien lo presenta a AEAT es
      // ensController.amend(). Dar la rectificacion por aceptada en este punto
      // (status 'amended' + "Rectificacion aceptada" en el historial) afirmaba que
      // la aduana habia admitido un cambio que ni siquiera habia salido de LUCI.
      // Queda en amendment_pending hasta que AEAT responda.

      await declaration.save();

      logger.info(`ENS ${declaration.reference}: IE313 generado, pendiente de respuesta AEAT`);

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
    const declaration = await _loadOwnedENS(declarationId, userId);

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
    const declaration = await _loadOwnedENS(declarationId, userId);

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

    // El levante lo concede la aduana, no LUCI. Aqui habia un bloque que ponia
    // `status: 'released'` en cuanto el riesgo estaba en ACK; combinado con el ACK
    // que se autoescribia al recibir el CC328A, bastaba pulsar "Notificar Llegada"
    // en la UI para que la mercancia apareciese despachada sin que AEAT hubiera
    // autorizado nada. El paso a 'released' solo lo hace processRiskResponse()
    // con un mensaje real de AEAT.

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
   * Obtener aduanas de entrada disponibles.
   *
   * Lee el catalogo unico de config/entryOffices.js. Antes tenia su propia
   * lista de 10 aduanas mientras el formulario ofrecia otra de 15, con codigos
   * que significaban cosas distintas en cada lado.
   */
  getEntryOffices(transportMode = null) {
    return listEntryOffices(transportMode || undefined);
  }

  /**
   * Obtener plazos de presentacion
   */
  getSubmissionDeadlines() {
    return ENS_CONFIG.submissionDeadlines;
  }
}

module.exports = new ENSService();
