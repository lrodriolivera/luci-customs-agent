/**
 * ENS Controller
 * Controlador para Declaraciones Sumarias de Entrada (ENS/ICS2)
 */
const { ENSDeclaration, Expedition } = require('../models');
const ensService = require('../services/ensService');
const aiService = require('../services/aiService');
const logger = require('../config/logger');
const { ensureSameTenant } = require('../utils/tenantGuard');
const { parseENSRiskMessage } = require('../services/aeat/ensRiskParser');
const { ROLES, esSuperAdmin } = require('../constants/roles');

/**
 * Comprobar que los cambios pedidos han quedado REALMENTE aplicados al documento.
 *
 * Mongoose no lanza cuando no puede castear un valor: lo descarta en silencio.
 * `goods: 'texto'` deja el array vacio, `grossMass: 'mucho'` deja la partida sin
 * peso, y `validateSync()` no siempre lo delata (una partida sin peso puede seguir
 * siendo valida). En una rectificacion eso significa presentar a la aduana algo
 * distinto de lo que pidio el usuario y acreditarlo como si fuera lo pedido, asi
 * que se compara lo aplicado con lo pedido antes de enviar nada.
 *
 * @param {Object} cambios - Cambios pedidos (subconjunto de campos del documento)
 * @param {Object} doc - Documento Mongoose ya modificado
 * @returns {string[]} Rutas de los valores que no llegaron a aplicarse
 */
function camposNoAplicados(cambios, doc) {
  const descartados = [];

  const comparar = (pedido, aplicado, ruta) => {
    if (pedido === null || pedido === undefined) return;
    if (Array.isArray(pedido)) {
      if (!Array.isArray(aplicado) || aplicado.length !== pedido.length) {
        descartados.push(ruta);
        return;
      }
      pedido.forEach((v, i) => comparar(v, aplicado[i], `${ruta}[${i}]`));
      return;
    }
    if (typeof pedido === 'object') {
      // Los subdocumentos se recorren campo a campo: lo que no se pidio no importa.
      for (const [k, v] of Object.entries(pedido)) {
        comparar(v, aplicado?.[k], `${ruta}.${k}`);
      }
      return;
    }
    if (aplicado === undefined || aplicado === null) {
      descartados.push(ruta);
      return;
    }
    // Se compara el valor ya casteado: pedir el peso como "910" y que quede en 910
    // es correcto; que quede en undefined o en otro numero, no.
    const iguales = aplicado instanceof Date
      ? aplicado.getTime() === new Date(pedido).getTime()
      : String(aplicado) === String(pedido);
    if (!iguales) descartados.push(ruta);
  };

  for (const [campo, valor] of Object.entries(cambios)) {
    comparar(valor, doc[campo], campo);
  }
  return descartados;
}

/**
 * Listar declaraciones ENS
 * GET /api/ens
 */
exports.list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      transportMode,
      entryOffice,
      startDate,
      endDate,
      search
    } = req.query;

    // Scope by tenant + role
    const query = {};
    if (req.user.tenantId) query.tenantId = req.user.tenantId;
    if (req.user.role !== 'admin') query.createdBy = req.user._id;

    if (status) query.status = status;
    if (transportMode) query.transportMode = transportMode;
    if (entryOffice) query['entryOffice.code'] = entryOffice;

    // El rango se filtra por la llegada prevista, la unica fecha que muestra la tabla
    // junto a los campos Desde/Hasta: por createdAt, buscar un mes de llegadas devolvia
    // las declaraciones creadas hoy. El dia final entra completo (endDate + 1 dia con
    // $lt), porque new Date('2026-11-30') es medianoche y con $lte se perdia ese dia.
    if (startDate || endDate) {
      query['entryOffice.expectedArrival'] = {};
      if (startDate) query['entryOffice.expectedArrival'].$gte = new Date(startDate);
      if (endDate) {
        const finInclusivo = new Date(endDate);
        finInclusivo.setDate(finInclusivo.getDate() + 1);
        query['entryOffice.expectedArrival'].$lt = finInclusivo;
      }
    }

    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { mrn: { $regex: search, $options: 'i' } },
        { lrn: { $regex: search, $options: 'i' } },
        { 'consignment.referenceNumber': { $regex: search, $options: 'i' } },
        { 'consignment.containerNumber': { $regex: search, $options: 'i' } },
        { 'carrier.eori': { $regex: search, $options: 'i' } },
        { 'carrier.name': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [declarations, total] = await Promise.all([
      ENSDeclaration.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-statusHistory -notes -generatedXML'),
      ENSDeclaration.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: declarations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error listing ENS declarations:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar declaraciones ENS',
      error: error.message
    });
  }
};

/**
 * Obtener estadisticas
 * GET /api/ens/stats
 */
exports.getStats = async (req, res) => {
  try {
    const queryParams = req.user.role === 'admin'
      ? { ...req.query }
      : { ...req.query, createdBy: req.user._id };

    const stats = await ensService.getStats(queryParams);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting ENS stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas',
      error: error.message
    });
  }
};

/**
 * Crear declaracion ENS
 * POST /api/ens
 */
exports.create = async (req, res) => {
  try {
    const result = await ensService.createDeclaration(req.body, req.user._id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Error de validacion ENS',
        errors: result.errors,
        suggestions: result.suggestions
      });
    }

    res.status(201).json({
      success: true,
      message: 'Declaracion ENS creada correctamente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error creating ENS declaration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear declaracion ENS',
      error: error.message
    });
  }
};

/**
 * Obtener declaracion ENS
 * GET /api/ens/:id
 */
exports.get = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const declaration = await ENSDeclaration.findOne(query)
      .populate('expedition', 'reference status');

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion ENS no encontrada'
      });
    }

    res.json({
      success: true,
      data: declaration
    });

  } catch (error) {
    logger.error('Error getting ENS declaration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener declaracion ENS',
      error: error.message
    });
  }
};

/**
 * Actualizar declaracion ENS (solo en draft)
 * PUT /api/ens/:id
 */
exports.update = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const declaration = await ENSDeclaration.findOne(query);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion ENS no encontrada'
      });
    }

    if (declaration.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `No se puede modificar declaracion en estado ${declaration.status}. Use la funcion de rectificacion.`
      });
    }

    // Campos actualizables
    const allowedFields = [
      'transportMode', 'entryOffice', 'carrier', 'transportMeans',
      'consignment', 'consignor', 'consignee', 'houseConsignments',
      'goods', 'documents'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        declaration[field] = req.body[field];
      }
    }

    // Recalcular totales
    if (declaration.houseConsignments.length > 0 || declaration.goods.length > 0) {
      declaration.calculateTotals();
    }

    await declaration.save();

    res.json({
      success: true,
      message: 'Declaracion ENS actualizada',
      data: declaration
    });

  } catch (error) {
    logger.error('Error updating ENS declaration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar declaracion ENS',
      error: error.message
    });
  }
};

/**
 * Validar declaracion ENS
 * POST /api/ens/validate
 */
exports.validate = async (req, res) => {
  try {
    const result = await ensService.validateDeclaration(req.body);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error validating ENS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar ENS',
      error: error.message
    });
  }
};

/**
 * Enviar declaracion a AEAT
 * POST /api/ens/:id/submit
 */
exports.submit = async (req, res) => {
  try {
    const { certificateAlias } = req.body;

    const result = await ensService.submitToAEAT(
      req.params.id,
      req.user._id,
      certificateAlias
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Error al enviar declaracion',
        error: result.error,
        errors: result.errors,
        aeatResponse: result.details
      });
    }

    res.json({
      success: true,
      // Presentacion REAL ante AEAT (entorno segun AEAT_ENVIRONMENT): el MRN
      // devuelto es autentico. No rotular como demo/simulacion.
      message: 'Declaracion ENS enviada a AEAT',
      data: result.data
    });

  } catch (error) {
    logger.error('Error submitting ENS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar declaracion ENS',
      error: error.message
    });
  }
};

/**
 * Anular declaracion ENS
 * POST /api/ens/:id/cancel
 */
exports.cancel = async (req, res) => {
  try {
    const result = await ensService.cancelDeclaration(
      req.params.id,
      req.body.reason,
      req.user._id
    );

    // Un rechazo de AEAT no es una anulacion. `ensService` devuelve el motivo en
    // `error` (no en `errors`), asi que leer solo `errors` dejaba al usuario un
    // 400 sin explicacion sobre una sumaria que sigue viva en la aduana.
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Error al anular declaracion',
        error: result.error,
        errors: result.errors,
        details: result.details
      });
    }

    res.json({
      success: true,
      message: 'Declaracion ENS anulada',
      data: result.data
    });

  } catch (error) {
    logger.error('Error cancelling ENS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al anular declaracion ENS',
      error: error.message
    });
  }
};

/**
 * Ingerir un mensaje de RIESGO de AEAT sobre una ENS ya registrada
 * POST /api/ens/risk-message   body: { xml }
 *
 * Este es el llamante que le faltaba a ensService.processRiskResponse(): el
 * CC328A que se recibe al presentar la ENS solo acusa el REGISTRO, y el circuito
 * (ACK/HOLD/DNL) llega despues en un mensaje aparte. Sin esta puerta de entrada el
 * riesgo se quedaba en PENDING para siempre.
 *
 * No hay alternativa por consulta: se comprobo en PRE que ConsultaImportacionV2
 * responde CodigoRespuesta 9 / CodigoError 6020 ("No existe importación con la
 * referencia solicitada") ante un MRN de ENS, porque es el canal de H1.
 *
 * Restringido a admin: es un veredicto de la aduana sobre la carga y la deuda de
 * un tercero, no algo que deba poder inyectar cualquier operador.
 */
exports.ingestRiskMessage = async (req, res) => {
  try {
    // Las variantes del rol de super administrador se reconocen en un unico
    // sitio (src/constants/roles.js). Enumerarlas aqui a mano reintroducia la
    // divergencia que ese fichero existe para cerrar.
    const esAdmin = req.user?.role === ROLES.ADMIN || esSuperAdmin(req.user);
    if (!esAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Solo un administrador puede registrar un mensaje de riesgo de AEAT'
      });
    }

    const { xml } = req.body || {};
    if (!xml || typeof xml !== 'string') {
      return res.status(400).json({ success: false, error: 'Falta el xml del mensaje de AEAT' });
    }

    const parsed = parseENSRiskMessage(xml);
    if (!parsed.recognised) {
      logger.warn(`[ENS] Mensaje de riesgo no ingerible: ${parsed.reason}`);
      return res.status(422).json({ success: false, error: parsed.reason, data: { messageType: parsed.messageType } });
    }

    const result = await ensService.processRiskResponse(parsed.mrn, parsed.risk);
    if (!result.success) {
      // MRN desconocido: no se crea nada, se informa. Un mensaje de AEAT sobre una
      // ENS que no tenemos es un problema de datos, no una declaracion nueva.
      return res.status(404).json({ success: false, error: result.error, data: { mrn: parsed.mrn } });
    }

    logger.info(`[ENS] Riesgo ingerido: mrn=${parsed.mrn}, tipo=${parsed.messageType}, estado=${parsed.risk.status}`);
    res.json({
      success: true,
      message: `Analisis de riesgo registrado (${parsed.risk.status})`,
      data: { mrn: parsed.mrn, messageType: parsed.messageType, riskAssessment: result.data.riskAssessment, status: result.data.status }
    });

  } catch (error) {
    logger.error('Error ingesting ENS risk message:', error);
    res.status(500).json({ success: false, error: 'Error al registrar el mensaje de riesgo' });
  }
};

/**
 * Notificar llegada
 * POST /api/ens/:id/arrival
 */
exports.notifyArrival = async (req, res) => {
  try {
    const result = await ensService.notifyArrival(
      req.params.id,
      req.body,
      req.user._id
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Error al notificar llegada',
        errors: result.errors
      });
    }

    res.json({
      success: true,
      message: 'Llegada notificada correctamente',
      data: result.data
    });

  } catch (error) {
    logger.error('Error notifying ENS arrival:', error);
    res.status(500).json({
      success: false,
      message: 'Error al notificar llegada',
      error: error.message
    });
  }
};

/**
 * Procesar lote de declaraciones
 * POST /api/ens/batch
 */
exports.processBatch = async (req, res) => {
  try {
    const { declarations, autoSubmit, certificateAlias } = req.body;

    if (!declarations || !Array.isArray(declarations) || declarations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de declaraciones'
      });
    }

    if (declarations.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximo 100 declaraciones por lote'
      });
    }

    const result = await ensService.processBatch(declarations, req.user._id, {
      autoSubmit,
      certificateAlias
    });

    res.json({
      success: true,
      message: `Lote procesado: ${result.successful}/${result.total} exitosas`,
      data: result
    });

  } catch (error) {
    logger.error('Error processing ENS batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar lote',
      error: error.message
    });
  }
};

/**
 * Buscar por contenedor
 * GET /api/ens/search/container/:container
 */
exports.searchByContainer = async (req, res) => {
  try {
    const result = await ensService.getByContainer(
      req.params.container,
      req.user._id
    );

    res.json({
      success: true,
      data: result.data,
      count: result.count
    });

  } catch (error) {
    logger.error('Error searching ENS by container:', error);
    res.status(500).json({
      success: false,
      message: 'Error en busqueda por contenedor',
      error: error.message
    });
  }
};

/**
 * Buscar por B/L
 * GET /api/ens/search/bol/:bol
 */
exports.searchByBOL = async (req, res) => {
  try {
    const result = await ensService.getByBillOfLading(
      req.params.bol,
      req.user._id
    );

    res.json({
      success: true,
      data: result.data,
      count: result.count
    });

  } catch (error) {
    logger.error('Error searching ENS by B/L:', error);
    res.status(500).json({
      success: false,
      message: 'Error en busqueda por conocimiento',
      error: error.message
    });
  }
};

/**
 * Obtener aduanas de entrada
 * GET /api/ens/entry-offices
 */
exports.getEntryOffices = async (req, res) => {
  try {
    const { transportMode } = req.query;
    const offices = ensService.getEntryOffices(transportMode);

    res.json({
      success: true,
      data: offices
    });

  } catch (error) {
    logger.error('Error getting entry offices:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener aduanas de entrada',
      error: error.message
    });
  }
};

/**
 * Obtener plazos de presentacion
 * GET /api/ens/deadlines
 */
exports.getDeadlines = async (req, res) => {
  try {
    const deadlines = ensService.getSubmissionDeadlines();

    res.json({
      success: true,
      data: deadlines
    });

  } catch (error) {
    logger.error('Error getting deadlines:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener plazos',
      error: error.message
    });
  }
};

/**
 * Agregar documento
 * POST /api/ens/:id/document
 */
exports.addDocument = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const declaration = await ENSDeclaration.findOne(query);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion no encontrada'
      });
    }

    const { type, documentNumber, name, url } = req.body;

    // Un `type` invalido hacia estallar el save() y el catch generico respondia
    // 500 "Error al agregar documento", sin decir que el tipo era el problema ni
    // cuales se admiten. Se valida contra el propio enum del esquema (fuente
    // unica) para que el 400 nombre el valor rechazado y los validos.
    const tiposValidos = ENSDeclaration.schema.path('documents').schema.path('type').enumValues;
    if (!type || !tiposValidos.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento invalido',
        error: `Tipo de documento invalido: '${type === undefined ? '' : type}'. Valores admitidos: ${tiposValidos.join(', ')}`
      });
    }

    declaration.documents.push({
      type,
      documentNumber,
      name,
      url,
      uploadedAt: new Date()
    });

    await declaration.save();

    res.json({
      success: true,
      message: 'Documento agregado',
      data: declaration
    });

  } catch (error) {
    logger.error('Error adding document:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar documento',
      error: error.message
    });
  }
};

/**
 * Obtener XML generado
 * GET /api/ens/:id/xml
 */
exports.getXML = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const declaration = await ENSDeclaration.findOne(query)
      .select('reference mrn generatedXML');

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: 'Declaracion no encontrada'
      });
    }

    if (!declaration.generatedXML) {
      return res.status(404).json({
        success: false,
        message: 'XML no disponible. La declaracion aun no ha sido enviada.'
      });
    }

    // Las ENS presentadas antes de que submitToAEAT persistiera `requestXML`
    // guardaron en este campo la nota de log 'Enviado via aeatSubmitService': 29
    // bytes que no son un XML. Servirlos con Content-Type application/xml le
    // entregaba al usuario un ENS_xxx.xml con una frase dentro en lugar de la
    // prueba de lo declarado. Ese XML no se guardo y no es recuperable: se dice.
    if (!declaration.generatedXML.trimStart().startsWith('<')) {
      logger.warn(`[ENS] ${declaration.reference}: generatedXML no es XML (${declaration.generatedXML.length} bytes), no se sirve`);
      return res.status(404).json({
        success: false,
        message: 'El XML de esta declaracion no se conservo al presentarla, asi que no se puede descargar. Las declaraciones presentadas a partir del 8/8/2026 si lo guardan.',
        mrn: declaration.mrn
      });
    }

    res.type('application/xml').send(declaration.generatedXML);

  } catch (error) {
    logger.error('Error getting ENS XML:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener XML',
      error: error.message
    });
  }
};

// ===========================================
// AI-POWERED ENDPOINTS
// ===========================================

/**
 * Analizar y autocompletar ENS desde expediente con IA
 * POST /api/ens/ai/analyze-expedition
 */
exports.aiAnalyzeExpedition = async (req, res) => {
  try {
    const { expeditionId, existingData } = req.body;

    if (!expeditionId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere expeditionId'
      });
    }

    // Obtener expediente
    const expedition = await Expedition.findById(expeditionId);
    // Sin esto se podria operar sobre la ENS de otro tenant conociendo su id.
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    // Llamar a IA para analizar y generar datos ENS
    const analysis = await aiService.analyzeENSData(expedition, existingData || {});

    res.json({
      success: true,
      message: 'Analisis completado con IA',
      data: analysis
    });

  } catch (error) {
    logger.error('Error in AI ENS analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error en analisis IA',
      error: error.message
    });
  }
};

/**
 * Validar ENS con IA antes de envio
 * POST /api/ens/ai/validate
 */
exports.aiValidate = async (req, res) => {
  try {
    const { ensData } = req.body;

    if (!ensData) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere ensData para validar'
      });
    }

    // Validar con IA
    const validation = await aiService.validateENSBeforeSubmit(ensData);

    res.json({
      success: true,
      message: 'Validacion IA completada',
      data: validation
    });

  } catch (error) {
    logger.error('Error in AI ENS validation:', error);
    res.status(500).json({
      success: false,
      message: 'Error en validacion IA',
      error: error.message
    });
  }
};

/**
 * Predecir probabilidad de rechazo con IA
 * POST /api/ens/ai/predict-rejection
 */
exports.aiPredictRejection = async (req, res) => {
  try {
    const { ensId, ensData } = req.body;

    let declaration;
    if (ensId) {
      declaration = await ENSDeclaration.findById(ensId);
      if (!ensureSameTenant(declaration, req, res, { resource: 'Declaracion ENS' })) return;
    } else if (ensData) {
      declaration = ensData;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere ensId o ensData'
      });
    }

    // Obtener datos historicos del operador (si existen)
    let historicalData = {};
    if (declaration.carrier?.eori) {
      const previousDeclarations = await ENSDeclaration.find({
        'carrier.eori': declaration.carrier.eori,
        status: { $in: ['accepted', 'rejected', 'completed'] }
      }).limit(100);

      const rejected = previousDeclarations.filter(d => d.status === 'rejected').length;
      historicalData = {
        previousRejections: rejected,
        totalDeclarations: previousDeclarations.length,
        sectorRejectionRate: previousDeclarations.length > 0
          ? ((rejected / previousDeclarations.length) * 100).toFixed(1)
          : null
      };
    }

    // Predecir con IA
    const prediction = await aiService.predictENSRejection(declaration, historicalData);

    res.json({
      success: true,
      message: 'Prediccion generada',
      data: {
        ...prediction,
        historicalData
      }
    });

  } catch (error) {
    logger.error('Error in AI ENS rejection prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Error en prediccion IA',
      error: error.message
    });
  }
};

/**
 * Obtener sugerencias de IA para mejorar ENS
 * POST /api/ens/:id/ai/suggestions
 */
exports.aiGetSuggestions = async (req, res) => {
  try {
    const declaration = await ENSDeclaration.findById(req.params.id);

    // Sin esto se podria operar sobre la ENS de otro tenant conociendo su id.
    if (!ensureSameTenant(declaration, req, res, { resource: 'Declaracion' })) return;

    // Obtener validacion y prediccion en paralelo
    const [validation, prediction] = await Promise.all([
      aiService.validateENSBeforeSubmit(declaration),
      aiService.predictENSRejection(declaration)
    ]);

    // Combinar sugerencias
    const suggestions = {
      validation,
      prediction,
      combinedRecommendations: [
        ...(validation.suggestions || []),
        ...(prediction.recommendations || [])
      ],
      overallReadiness: Math.round((validation.overallScore + (100 - prediction.rejectionProbability)) / 2)
    };

    res.json({
      success: true,
      message: 'Sugerencias IA generadas',
      data: suggestions
    });

  } catch (error) {
    logger.error('Error getting AI suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo sugerencias IA',
      error: error.message
    });
  }
};

/**
 * Amend ENS declaration (IE313)
 * POST /api/ens/:id/amend
 */
exports.amend = async (req, res) => {
  try {
    const { ENSDeclaration } = require('../models');
    const aeatSubmitService = require('../services/aeat/aeatSubmitService');

    const declaration = await ENSDeclaration.findById(req.params.id);
    // Sin esto se podria operar sobre la ENS de otro tenant conociendo su id.
    if (!ensureSameTenant(declaration, req, res, { resource: 'Declaracion ENS' })) return;
    if (!declaration.mrn) {
      return res.status(400).json({ success: false, error: 'La declaracion no tiene MRN asignado' });
    }

    // Los cambios pedidos se APLICAN a la declaracion antes de enviarla. Antes se
    // ignoraba `req.body.changes` por completo: LUCI mandaba a la aduana los datos
    // SIN rectificar, AEAT aceptaba una "rectificacion" identica a la original y la
    // ENS quedaba marcada 'amended' con el peso y los bultos viejos. Es decir, se
    // acreditaba una rectificacion que nunca se pidio a la aduana.
    const cambios = req.body.changes || {};
    const CAMPOS_RECTIFICABLES = ['consignment', 'goods', 'consignor', 'consignee', 'transportMeans', 'entryOffice'];
    const noRectificables = Object.keys(cambios).filter(c => !CAMPOS_RECTIFICABLES.includes(c));
    if (noRectificables.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos no rectificables via IE313: ${noRectificables.join(', ')}. Rectificables: ${CAMPOS_RECTIFICABLES.join(', ')}`
      });
    }
    for (const [campo, valor] of Object.entries(cambios)) {
      // Los subdocumentos se fusionan (una rectificacion de peso no debe borrar la
      // referencia del B/L); los arrays de partidas se sustituyen enteros.
      declaration[campo] = Array.isArray(valor) || typeof valor !== 'object'
        ? valor
        : { ...(declaration[campo]?.toObject?.() || declaration[campo] || {}), ...valor };
    }

    // Mongoose DESCARTA en silencio lo que no puede castear: `goods: 'texto'` deja
    // el array vacio y `grossMass: 'mucho'` deja la partida sin peso, sin lanzar ni
    // marcar error. Sin esta comprobacion se le presentaba a la aduana una
    // rectificacion DISTINTA de la pedida y se acreditaba como si fuera la pedida.
    const descartados = camposNoAplicados(cambios, declaration);
    if (descartados.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cambios con valor no valido, no se han podido aplicar: ${descartados.join(', ')}`
      });
    }
    // Los totales de la expedicion se recalculan desde las partidas rectificadas: el
    // CC313A declara TotGroMasHEA307/TotNumOfPacHEA306 como suma de las partidas, asi
    // que sin esto la ficha se quedaba con el peso y los bultos ANTERIORES mientras a
    // la aduana ya se le habian declarado los nuevos (el pre('save') de ENS no llama
    // a calculateTotals, a diferencia de ensService.amend).
    declaration.calculateTotals();

    // Se valida ANTES de enviar: una rectificacion que deje la ENS invalida no se
    // presenta a la aduana.
    const errorValidacion = declaration.validateSync();
    if (errorValidacion) {
      return res.status(400).json({
        success: false,
        error: `Los cambios dejan la declaracion invalida: ${errorValidacion.message}`
      });
    }

    const result = await aeatSubmitService.submitENSAmendment({
      mrn: declaration.mrn,
      carrierEORI: declaration.carrier?.eori || req.body.carrierEORI || '',
      carrierName: declaration.carrier?.name || req.body.carrierName || '',
      entryOffice: declaration.entryOffice?.code || req.body.entryOffice || '',
      // El motivo que teclea el usuario NO se declara a la aduana: el unico campo
      // parecido del CC313A es AmdPlaHEA598, que es el LUGAR de la rectificacion
      // (an..35). Mandar ahi el motivo era declarar un texto libre en un campo que
      // significa otra cosa, y AEAT lo rechazaba por longitud. El motivo queda en
      // el historial `amendments` de LUCI, que es donde sirve de justificacion.
      amendmentPlace: declaration.entryOffice?.code?.substring(0, 2) || 'ES',
      // Remitente del MENSAJE: el declarante que firma, no el transportista (el
      // CC315A da "Message Sender is not valid" si se manda un EORI ajeno).
      senderEORI: process.env.DECLARANTE_EORI || 'ESB22477020',
      // El CC313A lleva el mismo cuerpo que el CC315A, asi que necesita el modo y
      // el medio de transporte DECLARADOS. El builder los tenia fijos a maritimo y
      // AEAT rechazaba toda rectificacion remitiendo a ICS2 (regla del sector
      // maritimo) aunque la sumaria fuese ferroviaria.
      transportMode: declaration.transportMode,
      transportId: declaration.transportMeans?.identification || '',
      transportCountry: declaration.transportMeans?.nationality || '',
      consignment: { containerNumber: declaration.consignment?.containerNumber || '' },
      // El CC313A exige ExpDatOfArrFIRENT733: es la fecha prevista de llegada ya
      // declarada, no un dato nuevo que pueda rellenar el builder.
      expectedArrival: declaration.entryOffice?.expectedArrival,
      // Itinerario (reglas C570/R879): pais de expedicion DECLARADO y destino.
      itinerary: [declaration.consignment?.countryOfDispatch, declaration.consignment?.countryOfDestination || 'ES']
        .filter(Boolean),
      // `declaration.goods`, no `goodsItems`: ese campo no existe en el esquema y
      // resolvia siempre a [], de modo que la rectificacion viajaba a AEAT sin
      // partidas y declarando peso bruto y bultos CERO.
      goodsItems: req.body.goodsItems || declaration.goods?.map(g => ({
        sequenceNumber: g.sequenceNumber,
        description: g.description,
        commodityCode: g.commodityCode,
        // El esquema nombra estos dos campos `grossMass` y `kindOfPackages`; leer
        // `grossWeight`/`packageType` daba undefined y el builder los caia a 0/'PK'.
        grossWeight: g.grossMass,
        numberOfPackages: g.numberOfPackages,
        packageType: g.kindOfPackages,
        // El esquema lo llama `marksAndNumbers`; `marksOfPackages` no existe y
        // daba undefined, con lo que la partida viajaba sin marcas (regla C062).
        marksOfPackages: g.marksAndNumbers,
        // Reglas C574/C579/C584: cada partida declara donde se carga, donde se
        // descarga y a quien va. Los tomaba del aire (no los mandaba) y AEAT los
        // reclamaba uno a uno. La ENS no guarda UN/LOCODE de carga/descarga, solo
        // los paises de expedicion y destino: se declara el pais + ZZZ ("lugar no
        // especificado"), la misma convencion que usa el CC315A aceptado.
        placeOfLoading: declaration.consignment?.countryOfDispatch
          ? `${declaration.consignment.countryOfDispatch}ZZZ` : undefined,
        placeOfUnloading: `${declaration.consignment?.countryOfDestination || 'ES'}ZZZ`,
        commercialReference: declaration.consignment?.referenceNumber,
        // AddressSchema nombra los campos `streetAndNumber` y `postalCode`: leer
        // `street`/`postcode` daba undefined y el builder ponia '-' y '00000'.
        consignor: {
          name: declaration.consignor?.name,
          street: declaration.consignor?.address?.streetAndNumber,
          postcode: declaration.consignor?.address?.postalCode,
          city: declaration.consignor?.address?.city,
          country: declaration.consignor?.address?.country || g.countryOfOrigin
        },
        consignee: {
          name: declaration.consignee?.name,
          street: declaration.consignee?.address?.streetAndNumber,
          postcode: declaration.consignee?.address?.postalCode,
          city: declaration.consignee?.address?.city,
          country: declaration.consignee?.address?.country
        }
      })) || []
    });

    // Un rechazo de AEAT no es un exito: antes se respondia 200 con
    // `success: true` y el fallo quedaba escondido en `data.success`, asi que la
    // UI (api.js devuelve response.data) daba la rectificacion por hecha. Un
    // CD917B ademas no trae texto de error (el motivo va en XMLERR805), por eso
    // el mensaje cae al codigo AEAT antes que quedarse vacio.
    // Se sale SIN `save()` a proposito: si la aduana no acepta la rectificacion, lo
    // declarado sigue siendo lo anterior y los cambios aplicados en memoria se
    // descartan. Persistirlos dejaria la BD diciendo una cosa y AEAT otra.
    if (!result.success) {
      const motivo = result.error || (result.code
        ? `AEAT rechazo la rectificacion (${result.code})`
        : 'AEAT rechazo la rectificacion');
      logger.warn(`[ENS] Rectificacion IE313 rechazada: mrn=${declaration.mrn}, code=${result.code}, error=${result.error}`);
      return res.status(400).json({ success: false, error: motivo, data: result });
    }

    // La rectificacion aceptada se acredita: el CC304A y su CSV son el justificante
    // de lo presentado, y `changes` deja constancia de QUE se rectifico. Antes solo
    // quedaba una fecha, sin forma de saber que se cambio ni de probarlo.
    declaration.status = 'amended';
    declaration.amendedAt = new Date();
    declaration.amendmentMRN = result.mrn || declaration.mrn;
    declaration.amendments = [...(declaration.amendments || []), {
      reason: req.body.reason || 'Rectificacion de datos',
      changes: cambios,
      submittedAt: new Date(),
      aeatCode: result.code || null,
      csv: result.csv || null,
      requestXML: result.requestXML || null
    }];
    await declaration.save();

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
